-- =============================================================================
-- Órdenes de estudio — fechas automáticas en hora de la clínica (completa la 077)
-- =============================================================================
-- Contexto:
--
--   El servidor corre en UTC y las fechas del módulo son `timestamp WITHOUT time zone` leídas como
--   hora de Montevideo. La 077 pasó los DEFAULT y el trigger de updated_at a hora de la clínica,
--   pero en los entornos donde no se aplicó (DEV, al 26-nov-2026) conviven dos horas:
--
--     - created_at / updated_at salen del DEFAULT now() y del trigger genérico: hora UTC.
--     - status_changed, submitted_at, completed_at, delivered_at… los escribe la 179 o los flujos
--       con `now() AT TIME ZONE 'America/Montevideo'`: hora de la clínica.
--
--   En la Actividad de la orden, "Se creó la orden" queda tres horas después de los cambios de
--   estado (QA de C02.1).
--
--   La 077 ya no se puede correr tal cual: recrea v_study_orders_board con los estados viejos (pisa
--   la 179) y desplaza TODAS las fechas, también las que ya están en hora de la clínica.
--
--   1. DEFAULT en hora de la clínica para las fechas automáticas del módulo.
--   2. Trigger de updated_at en hora de la clínica (el genérico usa now() a secas).
--   3. Sólo donde la 077 nunca se aplicó y una sola vez: corrige las fechas que salieron de esos
--      DEFAULT y triggers. No toca las que escriben la 179 ni los flujos (eventos status_changed,
--      submitted_at, completed_at, delivered_at, cancelled_at, acknowledged_at, expires_at…).
--
-- Donde la 077 ya está aplicada, el punto 3 no hace nada y el 1 sólo suma study_order_options.
-- No toca notifications ni appointments: son compartidas y su hora la pone n8n.
--
-- Requiere 071, 075 y 179. Idempotente: la marca de db_migrations evita correr el punto 3 dos veces.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. DEFAULT
-- -----------------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
    FOR r IN
        SELECT c.table_name, c.column_name
          FROM information_schema.columns c
         WHERE c.table_schema = 'public'
           AND (c.table_name, c.column_name) IN (
                 ('study_orders', 'created_at'), ('study_orders', 'updated_at'),
                 ('study_order_items', 'created_at'), ('study_order_items', 'updated_at'),
                 ('study_order_options', 'created_at'), ('study_order_options', 'updated_at'),
                 ('study_order_events', 'created_at'),
                 ('study_order_booking_tokens', 'created_at'))
    LOOP
        EXECUTE format(
            'ALTER TABLE public.%I ALTER COLUMN %I SET DEFAULT (now() AT TIME ZONE ''America/Montevideo'')',
            r.table_name, r.column_name);
    END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 2. Trigger de updated_at
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_study_order_updated_at()
RETURNS trigger AS $fn$
BEGIN
    NEW.updated_at := now() AT TIME ZONE 'America/Montevideo';
    RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.set_study_order_updated_at() IS
    'updated_at en hora de pared de la clínica. La función genérica update_updated_at_column() usa now() a secas y guardaría UTC.';

-- Se quitan los triggers BEFORE UPDATE que llaman a la función genérica y se deja uno solo.
DO $$
DECLARE
    t   text;
    trg record;
BEGIN
    FOREACH t IN ARRAY ARRAY['study_orders', 'study_order_items', 'study_order_options'] LOOP
        CONTINUE WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns
                                   WHERE table_schema = 'public' AND table_name = t AND column_name = 'updated_at');
        FOR trg IN
            SELECT tg.tgname
              FROM pg_trigger tg
              JOIN pg_proc p ON p.oid = tg.tgfoid
             WHERE tg.tgrelid = format('public.%I', t)::regclass
               AND NOT tg.tgisinternal
               AND p.proname = 'update_updated_at_column'
        LOOP
            EXECUTE format('DROP TRIGGER %I ON public.%I', trg.tgname, t);
        END LOOP;
        EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated_at ON public.%I', t, t);
        EXECUTE format(
            'CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON public.%I
             FOR EACH ROW EXECUTE FUNCTION public.set_study_order_updated_at()', t, t);
    END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 3. Fechas ya escritas en UTC (sólo donde la 077 no corrió, una vez)
-- -----------------------------------------------------------------------------
-- Sólo cambia created_at / updated_at; los triggers de estado (179) son UPDATE OF status y no se disparan.
-- `AT TIME ZONE 'UTC'` lo reinterpreta como el instante que era y el segundo lo baja a la hora de
-- pared de la clínica.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM db_migrations
                WHERE script_name IN ('077_20260908_study-orders-timezone.sql',
                                      '180_20261126_study-orders-clinic-time.sql')) THEN
        RAISE NOTICE '[180] La 077 o esta migración ya corrigieron las fechas. No se toca nada.';
        RETURN;
    END IF;

    -- Se apagan los triggers de usuario mientras tanto: el de updated_at pisaría la fecha con la
    -- hora actual, la auditoría genérica registraría un cambio por fila y el de autor tocaría
    -- updated_by. Ninguno de esos efectos es un cambio real.
    ALTER TABLE public.study_orders DISABLE TRIGGER USER;
    UPDATE public.study_orders SET
        created_at = created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Montevideo',
        updated_at = updated_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Montevideo';
    ALTER TABLE public.study_orders ENABLE TRIGGER USER;

    ALTER TABLE public.study_order_items DISABLE TRIGGER USER;
    IF EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'study_order_items' AND column_name = 'updated_at') THEN
        UPDATE public.study_order_items SET
            created_at = created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Montevideo',
            updated_at = updated_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Montevideo';
    ELSE
        UPDATE public.study_order_items SET
            created_at = created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Montevideo';
    END IF;
    ALTER TABLE public.study_order_items ENABLE TRIGGER USER;

    IF to_regclass('public.study_order_options') IS NOT NULL THEN
        ALTER TABLE public.study_order_options DISABLE TRIGGER USER;
        UPDATE public.study_order_options SET
            created_at = created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Montevideo',
            updated_at = updated_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Montevideo';
        ALTER TABLE public.study_order_options ENABLE TRIGGER USER;
    END IF;

    -- status_changed lo escribe la 179 con hora de la clínica: no se toca.
    UPDATE public.study_order_events SET
        created_at = created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Montevideo'
     WHERE event_type <> 'status_changed';

    UPDATE public.study_order_booking_tokens SET
        created_at = created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Montevideo';

    RAISE NOTICE '[180] Fechas automáticas del módulo corregidas a hora de la clínica.';
END $$;

INSERT INTO public.db_migrations (script_name, version_tag, notes)
VALUES (
    '180_20261126_study-orders-clinic-time.sql',
    'v1',
    'Órdenes de estudio — DEFAULT y trigger de updated_at en hora de la clínica; corrige created_at/updated_at escritos en UTC donde la 077 no corrió'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;

-- =============================================================================
-- Verificación
-- =============================================================================
-- Defaults en hora de la clínica:
-- SELECT table_name, column_name, column_default FROM information_schema.columns
--  WHERE table_schema = 'public' AND table_name LIKE 'study_order%' AND column_name IN ('created_at', 'updated_at');
-- La Actividad de una orden queda en orden cronológico:
-- SELECT event_type, metadata->>'to' AS hasta, created_at FROM study_order_events
--  WHERE study_order_id = '<id>' ORDER BY created_at;

-- =============================================================================
-- Rollback manual (sólo los DEFAULT y el trigger; las fechas corregidas se quedan)
-- =============================================================================
-- BEGIN;
-- ALTER TABLE public.study_orders ALTER COLUMN created_at SET DEFAULT now(), ALTER COLUMN updated_at SET DEFAULT now();
-- ALTER TABLE public.study_order_items ALTER COLUMN created_at SET DEFAULT now();
-- ALTER TABLE public.study_order_events ALTER COLUMN created_at SET DEFAULT now();
-- ALTER TABLE public.study_order_booking_tokens ALTER COLUMN created_at SET DEFAULT now();
-- DELETE FROM public.db_migrations WHERE script_name = '180_20261126_study-orders-clinic-time.sql';
-- COMMIT;
