-- =============================================================================
-- Órdenes de estudio — corregir las fechas a la hora de la clínica
-- =============================================================================
-- EL PROBLEMA
-- -----------
-- El servidor de base de datos corre en UTC:
--
--     TimeZone        = Etc/UTC
--     now()           = 2026-09-08 21:40:57+00
--     hora en Uruguay = 2026-09-08 18:40:57
--
-- Y todas las columnas de fecha de este módulo son `timestamp WITHOUT time
-- zone`. Un `now()` a secas guarda la hora de pared UTC — las 21:40 — mientras
-- que el front lee esas columnas como hora local y las muestra tal cual. De ahí
-- las tres horas de adelanto que se ven en las notificaciones y en la línea de
-- tiempo de la orden.
--
-- LA CORRECCIÓN
-- -------------
--   1. Los DEFAULT de las tablas de este módulo pasan a hora de la clínica.
--   2. v_study_orders_board compara contra la misma hora (si no, el SLA de
--      "atrasada" y el "vencida" de las citas se corren tres horas).
--   3. Se corrigen las filas YA ESCRITAS, que están en hora UTC.
--
-- Los flujos de n8n se corrigieron aparte (scripts/n8n/study-orders-sql.mjs):
-- ahí `now()` pasó a `now() AT TIME ZONE 'America/Montevideo'`. Este script y
-- esos flujos van juntos: aplicar uno sin el otro deja el módulo a mitad de
-- camino.
--
-- POR QUÉ EL NOMBRE DE LA ZONA Y NO "- INTERVAL '3 hours'"
-- ---------------------------------------------------------
-- Uruguay no cambia la hora desde 2015, pero si algún día vuelve el horario de
-- verano, un offset fijo empieza a mentir en silencio medio año. `AT TIME ZONE`
-- con el nombre de la zona lo resuelve la base contra su tabla de husos.
--
-- ALCANCE DEL PUNTO 3
-- -------------------
-- Sólo toca las tablas que creó este módulo (study_orders, study_order_events,
-- study_order_booking_tokens) y NADA más. `notifications` y `appointments` son
-- compartidas con el resto del sistema: ahí conviven filas escritas por flujos
-- que no son nuestros y que pueden estar usando otra convención, así que
-- corregirlas a ciegas rompería lo ajeno. Las notificaciones de órdenes ya
-- escritas se quedan con su hora adelantada; son avisos viejos y ya leídos.
--
-- Idempotente: se apoya en una marca en db_migrations para no volver a correr el
-- desplazamiento de datos. Ejecutarlo dos veces NO corre las fechas dos veces.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. DEFAULT de las tablas del módulo
-- -----------------------------------------------------------------------------
ALTER TABLE public.study_orders
    ALTER COLUMN created_at SET DEFAULT (now() AT TIME ZONE 'America/Montevideo'),
    ALTER COLUMN updated_at SET DEFAULT (now() AT TIME ZONE 'America/Montevideo');

ALTER TABLE public.study_order_items
    ALTER COLUMN created_at SET DEFAULT (now() AT TIME ZONE 'America/Montevideo');

ALTER TABLE public.study_order_events
    ALTER COLUMN created_at SET DEFAULT (now() AT TIME ZONE 'America/Montevideo');

ALTER TABLE public.study_order_booking_tokens
    ALTER COLUMN created_at SET DEFAULT (now() AT TIME ZONE 'America/Montevideo');

-- El trigger de updated_at también escribía UTC.
CREATE OR REPLACE FUNCTION public.set_study_order_updated_at()
RETURNS trigger AS $fn$
BEGIN
    NEW.updated_at := now() AT TIME ZONE 'America/Montevideo';
    RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.set_study_order_updated_at() IS
    'updated_at en hora de pared de la clínica. La función genérica update_updated_at_column() usa now() a secas y guardaría UTC, que en estas columnas sin zona se lee tres horas adelantado.';

DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['study_orders', 'study_order_items'] LOOP
        IF EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = t AND column_name = 'updated_at') THEN
            EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated_at ON public.%I', t, t);
            EXECUTE format(
                'CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON public.%I
                 FOR EACH ROW EXECUTE FUNCTION public.set_study_order_updated_at()', t, t);
        END IF;
    END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 2. La vista, con la misma hora
-- -----------------------------------------------------------------------------
-- Sólo cambian los dos now(). El resto es idéntico a 071: si se toca algo más
-- acá, hay que actualizar también aquel script.
CREATE OR REPLACE VIEW public.v_study_orders_board AS
WITH item_state AS (
    SELECT i.study_order_id,
           i.id AS item_id,
           EXISTS (SELECT 1
                     FROM public.appointments a
                     JOIN public.appointment_service_catalog asc2 ON asc2.appointment_id = a.id
                    WHERE a.study_order_id = i.study_order_id
                      AND asc2.service_id  = i.service_id
                      AND a.status NOT IN ('cancelled', 'deleted', 'no_show')) AS is_scheduled,
           EXISTS (SELECT 1
                     FROM public.appointments a
                     JOIN public.appointment_service_catalog asc2 ON asc2.appointment_id = a.id
                    WHERE a.study_order_id = i.study_order_id
                      AND asc2.service_id  = i.service_id
                      AND a.status = 'completed')                              AS is_completed
      FROM public.study_order_items i
     WHERE i.is_cancelled = false
)
SELECT o.id,
       o.order_number,
       o.doctor_id,
       o.patient_id,
       o.patient_name,
       o.patient_document,
       o.patient_phone,
       o.status,
       o.preferred_sede_id,
       o.submitted_at,
       o.acknowledged_at,
       o.completed_at,
       o.created_at,
       COUNT(s.item_id)                                AS items_total,
       COUNT(*) FILTER (WHERE s.is_scheduled)          AS items_scheduled,
       COUNT(*) FILTER (WHERE s.is_completed)          AS items_completed,
       -- submitted_at es hora de la clínica: la referencia tiene que serlo también.
       EXTRACT(epoch FROM ((now() AT TIME ZONE 'America/Montevideo') - o.submitted_at)) / 3600.0
                                                       AS hours_since_submitted,
       EXISTS (SELECT 1 FROM public.appointments a
                WHERE a.study_order_id = o.id
                  AND a.end_datetime < (now() AT TIME ZONE 'America/Montevideo')
                  AND a.status NOT IN ('completed', 'cancelled', 'deleted'))   AS has_past_due_appointment,
       CASE
           WHEN o.status = 'cancelled' THEN 'cancelled'
           WHEN o.status = 'draft'     THEN 'draft'
           WHEN o.status = 'completed' THEN 'completed'
           WHEN COUNT(s.item_id) > 0
            AND COUNT(*) FILTER (WHERE s.is_completed) = COUNT(s.item_id) THEN 'completed'
           WHEN COUNT(*) FILTER (WHERE s.is_completed) > 0                THEN 'in_progress'
           WHEN COUNT(s.item_id) > 0
            AND COUNT(*) FILTER (WHERE s.is_scheduled) = COUNT(s.item_id) THEN 'scheduled'
           WHEN COUNT(*) FILTER (WHERE s.is_scheduled) > 0                THEN 'partially_scheduled'
           WHEN o.acknowledged_at IS NULL                                 THEN 'new'
           ELSE 'unscheduled'
       END AS board_status
  FROM public.study_orders o
  LEFT JOIN item_state s ON s.study_order_id = o.id
 GROUP BY o.id;

-- -----------------------------------------------------------------------------
-- 3. Corregir las filas ya escritas
-- -----------------------------------------------------------------------------
-- Todo lo escrito hasta ahora está en hora UTC. `AT TIME ZONE 'UTC'` lo
-- reinterpreta como el instante que era, y el segundo AT TIME ZONE lo baja a la
-- hora de pared de la clínica.
--
-- El guard de db_migrations es lo que hace repetible el script: sin él, correrlo
-- dos veces restaría seis horas.
DO $$
DECLARE ya boolean;
BEGIN
    SELECT EXISTS (SELECT 1 FROM db_migrations
                    WHERE script_name = '077_20260908_study-orders-timezone.sql')
      INTO ya;

    IF ya THEN
        RAISE NOTICE '[husos] El desplazamiento de fechas ya se aplicó. No se toca nada.';
        RETURN;
    END IF;

    UPDATE public.study_orders SET
        created_at      = created_at      AT TIME ZONE 'UTC' AT TIME ZONE 'America/Montevideo',
        updated_at      = updated_at      AT TIME ZONE 'UTC' AT TIME ZONE 'America/Montevideo',
        submitted_at    = submitted_at    AT TIME ZONE 'UTC' AT TIME ZONE 'America/Montevideo',
        acknowledged_at = acknowledged_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Montevideo',
        completed_at    = completed_at    AT TIME ZONE 'UTC' AT TIME ZONE 'America/Montevideo',
        cancelled_at    = cancelled_at    AT TIME ZONE 'UTC' AT TIME ZONE 'America/Montevideo';

    UPDATE public.study_order_items SET
        created_at = created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Montevideo',
        updated_at = updated_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Montevideo';

    UPDATE public.study_order_events SET
        created_at = created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Montevideo';

    UPDATE public.study_order_booking_tokens SET
        created_at   = created_at   AT TIME ZONE 'UTC' AT TIME ZONE 'America/Montevideo',
        expires_at   = expires_at   AT TIME ZONE 'UTC' AT TIME ZONE 'America/Montevideo',
        last_used_at = last_used_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Montevideo',
        revoked_at   = revoked_at   AT TIME ZONE 'UTC' AT TIME ZONE 'America/Montevideo';

    RAISE NOTICE '[husos] Fechas del módulo corregidas a hora de la clínica.';
END $$;

INSERT INTO db_migrations (script_name, version_tag, notes)
VALUES (
    '077_20260908_study-orders-timezone.sql',
    'v1',
    'Órdenes de estudio — fechas en hora de la clínica: DEFAULT, trigger de updated_at, v_study_orders_board y corrección de las filas ya escritas en UTC'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;

-- =============================================================================
-- Rollback manual
-- =============================================================================
-- Ojo: hay que borrar primero la marca de db_migrations, o el bloque de datos no
-- vuelve a correr. Y sólo tiene sentido si además se revierten los flujos de
-- n8n; si no, quedan escribiendo hora local sobre datos en UTC.
-- BEGIN;
-- UPDATE public.study_orders SET
--     created_at = created_at AT TIME ZONE 'America/Montevideo' AT TIME ZONE 'UTC',
--     submitted_at = submitted_at AT TIME ZONE 'America/Montevideo' AT TIME ZONE 'UTC';
--     -- ... y el resto de las columnas, igual
-- ALTER TABLE public.study_orders ALTER COLUMN created_at SET DEFAULT now();
-- DELETE FROM public.db_migrations WHERE script_name = '077_20260908_study-orders-timezone.sql';
-- COMMIT;
