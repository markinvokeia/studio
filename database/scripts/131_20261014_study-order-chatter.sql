-- =============================================================================
-- Órdenes de estudio — chatter: mensajes, notas internas y seguidores
-- =============================================================================
-- Contexto:
--
--   El asistente de edición y el detalle de la orden suman un panel lateral al estilo del
--   chatter de Odoo: los usuarios que siguen la orden conversan sobre ella y, en el mismo hilo,
--   se ve el registro de lo que le fue pasando (la bitácora study_order_events de la 075).
--
--   1. public.study_order_followers  quién sigue cada orden. Seguir = recibir un aviso por cada
--      mensaje nuevo. Se sigue a mano (botón Seguir) o solo:
--        · el doctor derivador, quien la creó y el responsable asignado (trigger de este script);
--        · quien escribe en la orden (lo hace /study-orders/messages/post).
--      Dejar de seguir es definitivo: el trigger solo agrega cuando cambia el doctor o el
--      responsable, no vuelve a suscribir a quien se fue.
--   2. public.study_order_messages   el hilo. Dos tipos, como en Odoo:
--        · message  "Enviar mensaje": lo ven todos los que pueden abrir la orden y avisa a los
--                   seguidores (notificación study_order_message).
--        · note     "Registrar nota": interna de la clínica. Solo la ven y la escriben los que
--                   tienen STUDY_ORDERS_VIEW_ALL (el derivador no) y no avisa a nadie.
--   3. Permiso STUDY_ORDERS_MESSAGE (escribir y manejar seguidores) para los roles que ya ven
--      órdenes (STUDY_ORDERS_VIEW_MINE o STUDY_ORDERS_VIEW_ALL), salvo el agente de WhatsApp.
--   4. Tipo de notificación study_order_message.
--   5. Backfill de seguidores de las órdenes que ya existen.
--
--   El registro de cambios de campos ("Teléfono: 099… → 098…") no necesita DDL: viaja en la
--   metadata del evento `updated` que ya escribe /study-orders/upsert.
--
-- Requiere la 071 (study_orders), la 075 (study_order_events) y la 129 (assigned_to).
-- Idempotente.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Seguidores
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.study_order_followers (
    study_order_id uuid NOT NULL REFERENCES public.study_orders(id) ON DELETE CASCADE,
    user_id        uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    -- Quién lo sumó. NULL = automático (trigger o backfill).
    added_by       uuid REFERENCES public.users(id) ON DELETE SET NULL,
    created_at     timestamp without time zone NOT NULL DEFAULT (now() AT TIME ZONE 'America/Montevideo'),
    PRIMARY KEY (study_order_id, user_id)
);

-- "Órdenes que sigo" y el aviso a los seguidores de una orden salen por la PK; este índice es
-- para lo inverso (qué sigue un usuario, y el ON DELETE CASCADE de users).
CREATE INDEX IF NOT EXISTS idx_study_order_followers_user
    ON public.study_order_followers (user_id);

COMMENT ON TABLE public.study_order_followers IS
    'Quién sigue cada orden de estudio (chatter). Seguir = recibir la notificación study_order_message por cada mensaje nuevo.';
COMMENT ON COLUMN public.study_order_followers.added_by IS
    'Quién lo sumó como seguidor. NULL = automático (doctor, creador o responsable, por trigger o backfill).';

-- -----------------------------------------------------------------------------
-- 2. Mensajes y notas
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.study_order_messages (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    study_order_id uuid NOT NULL REFERENCES public.study_orders(id) ON DELETE CASCADE,
    -- Si se borra el usuario el mensaje queda, sin autor.
    author_id      uuid REFERENCES public.users(id) ON DELETE SET NULL,
    kind           varchar(10) NOT NULL,
    body           text NOT NULL,
    created_at     timestamp without time zone NOT NULL DEFAULT (now() AT TIME ZONE 'America/Montevideo'),

    CONSTRAINT study_order_messages_kind_check CHECK (kind IN ('message', 'note')),
    CONSTRAINT study_order_messages_body_check CHECK (length(btrim(body)) BETWEEN 1 AND 5000)
);

-- El hilo de una orden, del más nuevo al más viejo.
CREATE INDEX IF NOT EXISTS idx_study_order_messages_order
    ON public.study_order_messages (study_order_id, created_at DESC);

COMMENT ON TABLE public.study_order_messages IS
    'Hilo del chatter de la orden de estudio. message = visible para todos los que ven la orden y avisa a los seguidores; note = interna de la clínica (STUDY_ORDERS_VIEW_ALL), sin aviso.';
COMMENT ON COLUMN public.study_order_messages.created_at IS
    'Hora de Montevideo, como el resto de las tablas de órdenes.';

-- -----------------------------------------------------------------------------
-- 3. Seguidores automáticos: doctor derivador, creador y responsable
-- -----------------------------------------------------------------------------
-- Ni usuarios inactivos ni el usuario de servicio del agente de WhatsApp (rol agente_ia): crea
-- órdenes en nombre de otros y no tiene quién lea sus avisos.
CREATE OR REPLACE FUNCTION public.study_order_auto_follow()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
    INSERT INTO public.study_order_followers (study_order_id, user_id)
    SELECT NEW.id, c.user_id
      FROM (VALUES (NEW.doctor_id), (NEW.created_by), (NEW.assigned_to)) AS c(user_id)
      JOIN public.users u ON u.id = c.user_id
     WHERE c.user_id IS NOT NULL
       AND u.is_active IS NOT FALSE
       -- En un UPDATE solo el que cambió: quien dejó de seguir no vuelve solo.
       AND (TG_OP = 'INSERT'
            OR (c.user_id = NEW.doctor_id   AND NEW.doctor_id   IS DISTINCT FROM OLD.doctor_id)
            OR (c.user_id = NEW.assigned_to AND NEW.assigned_to IS DISTINCT FROM OLD.assigned_to))
       AND NOT EXISTS (SELECT 1
                         FROM public.user_roles ur
                         JOIN public.roles r ON r.id = ur.role_id
                        WHERE ur.user_id = c.user_id
                          AND lower(trim(r.name)) = 'agente_ia')
    ON CONFLICT (study_order_id, user_id) DO NOTHING;
    RETURN NULL;
END;
$function$;

COMMENT ON FUNCTION public.study_order_auto_follow() IS
    'Suscribe al chatter de la orden al doctor derivador y a quien la creó (al crearla) y al nuevo doctor o responsable (al cambiar). Excluye inactivos y al agente de WhatsApp.';

DROP TRIGGER IF EXISTS trg_study_order_auto_follow ON public.study_orders;
CREATE TRIGGER trg_study_order_auto_follow
    AFTER INSERT OR UPDATE OF doctor_id, assigned_to ON public.study_orders
    FOR EACH ROW EXECUTE FUNCTION public.study_order_auto_follow();

-- -----------------------------------------------------------------------------
-- 4. Backfill: las órdenes que ya existen arrancan con sus seguidores
-- -----------------------------------------------------------------------------
INSERT INTO public.study_order_followers (study_order_id, user_id)
SELECT DISTINCT so.id, c.user_id
  FROM public.study_orders so
 CROSS JOIN LATERAL (VALUES (so.doctor_id), (so.created_by), (so.assigned_to)) AS c(user_id)
  JOIN public.users u ON u.id = c.user_id
 WHERE c.user_id IS NOT NULL
   AND u.is_active IS NOT FALSE
   AND NOT EXISTS (SELECT 1
                     FROM public.user_roles ur
                     JOIN public.roles r ON r.id = ur.role_id
                    WHERE ur.user_id = c.user_id
                      AND lower(trim(r.name)) = 'agente_ia')
ON CONFLICT (study_order_id, user_id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 5. Permiso STUDY_ORDERS_MESSAGE
-- -----------------------------------------------------------------------------
INSERT INTO permissions (name, description, code, module, submenu, permission_type)
VALUES ('Mensajes en Órdenes de Estudio',
        'Enviar mensajes y registrar notas en el chatter de una orden de estudio, y manejar sus seguidores',
        'STUDY_ORDERS_MESSAGE', 'study_orders', 'study-orders', 'write')
ON CONFLICT (code) DO NOTHING;

-- Todos los roles que ya ven órdenes (las propias o las de la clínica), menos el agente.
INSERT INTO role_permissions (role_id, permission_id)
SELECT DISTINCT rp.role_id, pm.id
  FROM role_permissions rp
  JOIN permissions pv ON pv.id = rp.permission_id
                     AND pv.code IN ('STUDY_ORDERS_VIEW_MINE', 'STUDY_ORDERS_VIEW_ALL')
  JOIN roles r        ON r.id = rp.role_id
 CROSS JOIN permissions pm
 WHERE pm.code = 'STUDY_ORDERS_MESSAGE'
   AND lower(trim(r.name)) <> 'agente_ia'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 6. Tipo de notificación study_order_message
-- -----------------------------------------------------------------------------
-- Mismo método que la 090 y la 129: se leen los valores que el CHECK ya admite y se le agregan
-- los que falten, así no se pierde ningún valor propio de cada entorno.
DO $$
DECLARE
    con_name text;
    valores  text[];
    nuevos   text[] := ARRAY['study_order_message'];
    faltan   text[];
BEGIN
    IF to_regclass('public.notifications') IS NULL THEN
        RAISE EXCEPTION 'No existe public.notifications';
    END IF;

    SELECT conname INTO con_name
      FROM pg_constraint
     WHERE conrelid = 'public.notifications'::regclass
       AND contype  = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%type%'
       AND conname <> 'notifications_priority_check'
     LIMIT 1;

    IF con_name IS NULL THEN
        RAISE NOTICE '[131] notifications no tiene CHECK sobre type: no hace falta ampliarlo.';
        RETURN;
    END IF;

    SELECT array_agg(m[1])
      INTO valores
      FROM regexp_matches(
               (SELECT pg_get_constraintdef(oid) FROM pg_constraint
                 WHERE conrelid = 'public.notifications'::regclass AND conname = con_name),
               '''([^'']+)''', 'g') AS m;

    SELECT array_agg(n) INTO faltan
      FROM unnest(nuevos) AS n
     WHERE NOT (n = ANY (coalesce(valores, ARRAY[]::text[])));

    IF faltan IS NULL THEN
        RAISE NOTICE '[131] % ya admite study_order_message.', con_name;
        RETURN;
    END IF;

    EXECUTE format('ALTER TABLE public.notifications DROP CONSTRAINT %I', con_name);
    EXECUTE format(
        'ALTER TABLE public.notifications ADD CONSTRAINT %I CHECK (type::text = ANY (ARRAY[%s]))',
        con_name,
        (SELECT string_agg(quote_literal(v), ', ')
           FROM (SELECT DISTINCT v FROM unnest(coalesce(valores, ARRAY[]::text[]) || faltan) AS v) s));
END $$;

-- -----------------------------------------------------------------------------
-- 7. Registro de migración
-- -----------------------------------------------------------------------------
INSERT INTO public.db_migrations (script_name, version_tag, notes)
VALUES (
    '131_20261014_study-order-chatter.sql',
    'v2',
    'Órdenes de estudio — chatter: study_order_messages, study_order_followers (+ trigger y backfill), permiso STUDY_ORDERS_MESSAGE y notificación study_order_message'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;

-- =============================================================================
-- Verificación
-- =============================================================================
-- SELECT count(*) AS seguidores, count(DISTINCT study_order_id) AS ordenes FROM public.study_order_followers;
-- SELECT r.name FROM role_permissions rp JOIN roles r ON r.id = rp.role_id
--   JOIN permissions p ON p.id = rp.permission_id WHERE p.code = 'STUDY_ORDERS_MESSAGE' ORDER BY r.name;

-- =============================================================================
-- Rollback manual (borra los mensajes escritos)
-- =============================================================================
-- BEGIN;
-- DELETE FROM public.notifications WHERE type = 'study_order_message';
-- -- (el CHECK de notifications puede quedar con el valor de más: no molesta)
-- DELETE FROM role_permissions WHERE permission_id = (SELECT id FROM permissions WHERE code = 'STUDY_ORDERS_MESSAGE');
-- DELETE FROM permissions WHERE code = 'STUDY_ORDERS_MESSAGE';
-- DROP TRIGGER IF EXISTS trg_study_order_auto_follow ON public.study_orders;
-- DROP FUNCTION IF EXISTS public.study_order_auto_follow();
-- DROP TABLE IF EXISTS public.study_order_messages;
-- DROP TABLE IF EXISTS public.study_order_followers;
-- DELETE FROM public.db_migrations WHERE script_name = '131_20261014_study-order-chatter.sql';
-- COMMIT;
