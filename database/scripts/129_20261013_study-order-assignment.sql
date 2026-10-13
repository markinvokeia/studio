-- =============================================================================
-- Órdenes de estudio — asignación a un responsable (vista "Estados" de la bandeja)
-- =============================================================================
-- Contexto:
--
--   La bandeja suma una vista por estados (tablero): una columna por cada estado de la orden,
--   con arrastrar y soltar para pasarla al siguiente. Recepción ve las órdenes, las revisa y las
--   asigna a alguien para que se ocupe de ellas.
--
--   1. Columnas `study_orders.assigned_to / assigned_at / assigned_by`: quién revisa la orden
--      ("Revisada por"), desde cuándo y quién se la asignó. Solo se asigna a staff (rol
--      recepcionista, gerente o administrador, el criterio de get_users_filtered(p_only_staff)):
--      lo valida el endpoint, no la DDL, porque los roles de un usuario cambian. Sin asignar = NULL.
--   2. Tipos de evento `assigned` / `unassigned` en la línea de tiempo de la orden.
--   3. Permiso STUDY_ORDERS_ASSIGN, para los roles que ya trabajan la bandeja (los que pueden
--      tomar órdenes: STUDY_ORDERS_ACKNOWLEDGE).
--   4. Tipo de notificación `study_order_assigned`: le avisa a quien se la asignaron.
--
-- El estado de la orden sigue sin guardarse: lo deriva `v_study_orders_board` de las citas. El
-- tablero agrupa por ese estado derivado y arrastrar dispara la acción real (enviar, tomar,
-- agendar, anular), así que esta migración no agrega ninguna columna de estado.
--
-- Requiere la 071 (study_orders), la 075 (study_order_events) y la 126 (último cambio del CHECK
-- de eventos). Idempotente.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Responsable de la orden
-- -----------------------------------------------------------------------------
ALTER TABLE public.study_orders
    ADD COLUMN IF NOT EXISTS assigned_to uuid,
    ADD COLUMN IF NOT EXISTS assigned_at timestamp without time zone,
    ADD COLUMN IF NOT EXISTS assigned_by uuid;

-- Si se borra el usuario la orden queda sin asignar, no se pierde.
ALTER TABLE public.study_orders
    DROP CONSTRAINT IF EXISTS study_orders_assigned_to_fkey;
ALTER TABLE public.study_orders
    ADD CONSTRAINT study_orders_assigned_to_fkey
        FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.study_orders
    DROP CONSTRAINT IF EXISTS study_orders_assigned_by_fkey;
ALTER TABLE public.study_orders
    ADD CONSTRAINT study_orders_assigned_by_fkey
        FOREIGN KEY (assigned_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- "Asignadas a mí": filtro de la bandeja y del tablero.
CREATE INDEX IF NOT EXISTS idx_study_orders_assigned_to
    ON public.study_orders (assigned_to) WHERE assigned_to IS NOT NULL;

COMMENT ON COLUMN public.study_orders.assigned_to IS
    'Quién de la clínica revisa la orden ("Revisada por", users.id). NULL = sin asignar. Solo staff: rol recepcionista, gerente o administrador (lo valida /study-orders/assign).';
COMMENT ON COLUMN public.study_orders.assigned_at IS
    'Cuándo se asignó al responsable actual (hora de Montevideo, como el resto de la tabla).';
COMMENT ON COLUMN public.study_orders.assigned_by IS
    'Quién asignó al responsable actual (users.id).';

-- -----------------------------------------------------------------------------
-- 2. Eventos assigned / unassigned
-- -----------------------------------------------------------------------------
ALTER TABLE public.study_order_events
    DROP CONSTRAINT IF EXISTS study_order_events_type_check;
ALTER TABLE public.study_order_events
    ADD CONSTRAINT study_order_events_type_check
        CHECK (event_type IN ('created', 'updated', 'submitted', 'acknowledged', 'scheduled',
                              'rescheduled', 'appointment_updated', 'appointment_cancelled',
                              'session_saved', 'completed', 'reopened', 'cancelled',
                              'link_created', 'patient_booked', 'review_updated',
                              'assigned', 'unassigned'));

-- -----------------------------------------------------------------------------
-- 3. Permiso STUDY_ORDERS_ASSIGN
-- -----------------------------------------------------------------------------
INSERT INTO permissions (name, description, code, module, submenu, permission_type)
VALUES ('Asignar Orden de Estudio', 'Asignar una orden a un responsable de la clínica para que la revise y la lleve adelante',
        'STUDY_ORDERS_ASSIGN', 'study_orders', 'study-orders', 'write')
ON CONFLICT (code) DO NOTHING;

-- Los roles que ya trabajan la bandeja (pueden tomar órdenes): Administrador, Gerente,
-- Recepcionista y los que cada clínica haya armado con ese permiso.
INSERT INTO role_permissions (role_id, permission_id)
SELECT DISTINCT rp.role_id, pa.id
  FROM role_permissions rp
  JOIN permissions pk ON pk.id = rp.permission_id AND pk.code = 'STUDY_ORDERS_ACKNOWLEDGE'
 CROSS JOIN permissions pa
 WHERE pa.code = 'STUDY_ORDERS_ASSIGN'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 4. Tipo de notificación study_order_assigned
-- -----------------------------------------------------------------------------
-- Mismo método que la 090: se leen los valores que el CHECK ya admite y se le agregan los que
-- falten, así no se pierde ningún valor propio de cada entorno.
DO $$
DECLARE
    con_name text;
    valores  text[];
    nuevos   text[] := ARRAY['study_order_assigned'];
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
     LIMIT 1;

    -- Sin CHECK sobre `type` cualquier valor entra: no hay nada que ampliar.
    IF con_name IS NULL THEN
        RAISE NOTICE '[129] notifications no tiene CHECK sobre type: no hace falta ampliarlo.';
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
        RAISE NOTICE '[129] notifications_type_check ya admite study_order_assigned.';
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
-- 5. Registro de migración
-- -----------------------------------------------------------------------------
INSERT INTO public.db_migrations (script_name, version_tag, notes)
VALUES (
    '129_20261013_study-order-assignment.sql',
    'v2',
    'Órdenes de estudio — responsable asignado (assigned_to/at/by), eventos assigned/unassigned, permiso STUDY_ORDERS_ASSIGN y notificación study_order_assigned'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;

-- =============================================================================
-- Rollback manual
-- =============================================================================
-- Ojo: falla si ya hay eventos assigned/unassigned o notificaciones study_order_assigned.
-- BEGIN;
-- DELETE FROM public.notifications WHERE type = 'study_order_assigned';
-- -- (el CHECK de notifications puede quedar con el valor de más: no molesta)
-- DELETE FROM role_permissions WHERE permission_id = (SELECT id FROM permissions WHERE code = 'STUDY_ORDERS_ASSIGN');
-- DELETE FROM permissions WHERE code = 'STUDY_ORDERS_ASSIGN';
-- DELETE FROM public.study_order_events WHERE event_type IN ('assigned', 'unassigned');
-- ALTER TABLE public.study_order_events DROP CONSTRAINT IF EXISTS study_order_events_type_check;
-- ALTER TABLE public.study_order_events ADD CONSTRAINT study_order_events_type_check
--     CHECK (event_type IN ('created', 'updated', 'submitted', 'acknowledged', 'scheduled',
--                           'rescheduled', 'appointment_updated', 'appointment_cancelled',
--                           'session_saved', 'completed', 'reopened', 'cancelled',
--                           'link_created', 'patient_booked', 'review_updated'));
-- DROP INDEX IF EXISTS public.idx_study_orders_assigned_to;
-- ALTER TABLE public.study_orders DROP CONSTRAINT IF EXISTS study_orders_assigned_to_fkey;
-- ALTER TABLE public.study_orders DROP CONSTRAINT IF EXISTS study_orders_assigned_by_fkey;
-- ALTER TABLE public.study_orders DROP COLUMN IF EXISTS assigned_to,
--                                 DROP COLUMN IF EXISTS assigned_at,
--                                 DROP COLUMN IF EXISTS assigned_by;
-- DELETE FROM public.db_migrations WHERE script_name = '129_20261013_study-order-assignment.sql';
-- COMMIT;
