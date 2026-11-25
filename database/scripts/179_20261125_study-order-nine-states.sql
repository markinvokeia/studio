-- =============================================================================
-- Órdenes de estudio — nueve estados y quién los cambia (C02.1)
-- =============================================================================
-- Contexto:
--
--   Hasta acá la orden guardaba cuatro estados (draft / submitted / completed / cancelled) y el
--   avance se derivaba de las citas en v_study_orders_board. La especificación pide nueve estados
--   y saber qué usuario hizo cada cambio: un estado derivado no tiene autor, así que pasa a
--   guardarse.
--
--     draft               BORRADOR
--     confirmed           CONFIRMADA
--     pending_scheduling  AGENDA PENDIENTE
--     scheduled           AGENDADA
--     patient_present     PACIENTE PRESENTE
--     in_execution        EN EJECUCIÓN
--     completed           ESTUDIO COMPLETADO
--     delivered           ENTREGADA   (final)
--     cancelled           CANCELADA   (final)
--
--   1. Columnas delivered_at / delivered_by y CHECK con los nueve estados.
--   2. Conversión de las órdenes existentes ('submitted' se resuelve según sus citas).
--   3. study_order_transition_allowed(): la matriz de transiciones, en un solo lugar.
--   4. Triggers sobre study_orders.status: rechazan lo que no está en la matriz (SQLSTATE 'SO409')
--      y dejan un evento 'status_changed' {from, to} con su autor. Vale para cualquier camino.
--   5. study_order_set_status(): cambia el estado en nombre de alguien (usuario, paciente, sistema).
--   6. study_order_sync(): lleva la orden al estado que dicen sus citas, paso a paso.
--   7. Permiso STUDY_ORDERS_DELIVER y v_study_orders_board con board_status = status.
--
-- El autor sale de lo que fija study_order_set_status() o, en un UPDATE directo, de updated_by: un
-- UPDATE de status tiene que setear updated_by en la misma sentencia.
--
-- Requiere 071, 075, 126 y 129. Idempotente. Va junto con los flujos study-orders-* y el
-- frontend: los flujos viejos escriben 'submitted', que deja de ser un estado válido.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Columnas
-- -----------------------------------------------------------------------------
ALTER TABLE public.study_orders
    ADD COLUMN IF NOT EXISTS delivered_at timestamp without time zone,
    ADD COLUMN IF NOT EXISTS delivered_by uuid;

ALTER TABLE public.study_orders DROP CONSTRAINT IF EXISTS study_orders_delivered_by_fkey;
ALTER TABLE public.study_orders
    ADD CONSTRAINT study_orders_delivered_by_fkey
        FOREIGN KEY (delivered_by) REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.study_orders.status IS
    'Estado de la orden (9 valores, ver study_order_transition_allowed). Desde "scheduled" hasta "completed" lo mueven las citas vía study_order_sync(); el resto, una persona.';
COMMENT ON COLUMN public.study_orders.submitted_at IS
    'Cuándo se confirmó la orden (salió de borrador).';
COMMENT ON COLUMN public.study_orders.delivered_at IS
    'Cuándo se marcó como entregada (hora de Montevideo).';
COMMENT ON COLUMN public.study_orders.delivered_by IS
    'Quién la marcó como entregada (users.id).';

-- -----------------------------------------------------------------------------
-- 2. Eventos: status_changed
-- -----------------------------------------------------------------------------
-- Se conservan los valores que el CHECK ya admite en cada entorno y se agrega el nuevo.
DO $$
DECLARE valores text[];
BEGIN
    SELECT array_agg(m[1]) INTO valores
      FROM regexp_matches(
               (SELECT pg_get_constraintdef(oid) FROM pg_constraint
                 WHERE conrelid = 'public.study_order_events'::regclass
                   AND conname = 'study_order_events_type_check'),
               '''([^'']+)''', 'g') AS m;
    IF valores IS NULL THEN
        RAISE EXCEPTION '[179] No existe study_order_events_type_check: falta aplicar la 075/126/129';
    END IF;
    ALTER TABLE public.study_order_events DROP CONSTRAINT study_order_events_type_check;
    EXECUTE format(
        'ALTER TABLE public.study_order_events ADD CONSTRAINT study_order_events_type_check CHECK (event_type IN (%s))',
        (SELECT string_agg(quote_literal(v), ', ')
           FROM (SELECT DISTINCT v FROM unnest(valores || ARRAY['status_changed']) v) s));
END $$;

-- -----------------------------------------------------------------------------
-- 3. Matriz de transiciones
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.study_order_transition_allowed(p_from text, p_to text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $fn$
    SELECT (p_from, p_to) IN (
        ('draft',              'confirmed'),
        ('draft',              'cancelled'),
        ('confirmed',          'pending_scheduling'),
        ('confirmed',          'scheduled'),
        ('confirmed',          'cancelled'),
        ('pending_scheduling', 'scheduled'),
        ('pending_scheduling', 'cancelled'),
        ('scheduled',          'patient_present'),
        ('scheduled',          'pending_scheduling'),
        ('scheduled',          'cancelled'),
        ('patient_present',    'in_execution'),
        ('patient_present',    'scheduled'),
        ('patient_present',    'pending_scheduling'),
        ('patient_present',    'cancelled'),
        ('in_execution',       'completed'),
        ('in_execution',       'patient_present'),
        ('in_execution',       'pending_scheduling'),
        ('completed',          'delivered'),
        ('completed',          'in_execution'),
        ('completed',          'pending_scheduling')
        -- delivered y cancelled son finales: no salen a ningún lado.
    );
$fn$;

COMMENT ON FUNCTION public.study_order_transition_allowed(text, text) IS
    'Única definición de qué cambios de estado admite una orden de estudio.';

-- -----------------------------------------------------------------------------
-- 4. Qué estado dicen las citas
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.study_order_status_from_appointments(p_order_id uuid, p_current text)
RETURNS text LANGUAGE sql VOLATILE AS $fn$
    WITH item_state AS (
        SELECT EXISTS (SELECT 1 FROM public.appointments a
                         JOIN public.appointment_service_catalog s ON s.appointment_id = a.id
                        WHERE a.study_order_id = i.study_order_id AND s.service_id = i.service_id
                          AND a.status NOT IN ('cancelled', 'deleted', 'no_show')) AS is_scheduled,
               EXISTS (SELECT 1 FROM public.appointments a
                         JOIN public.appointment_service_catalog s ON s.appointment_id = a.id
                        WHERE a.study_order_id = i.study_order_id AND s.service_id = i.service_id
                          AND a.status = 'completed') AS is_completed
          FROM public.study_order_items i
         WHERE i.study_order_id = p_order_id AND i.is_cancelled = false
    ),
    c AS (
        SELECT count(*) AS total,
               count(*) FILTER (WHERE is_scheduled) AS scheduled,
               count(*) FILTER (WHERE is_completed) AS completed
          FROM item_state
    ),
    ap AS (
        SELECT coalesce(bool_or(status IN ('in_progress', 'attended_late')), false) AS executing,
               coalesce(bool_or(status IN ('arrived', 'arrived_late')), false)      AS present
          FROM public.appointments
         WHERE study_order_id = p_order_id
    )
    SELECT CASE
             WHEN c.total > 0 AND c.completed = c.total THEN 'completed'
             WHEN c.completed > 0 OR ap.executing       THEN 'in_execution'
             WHEN ap.present                            THEN 'patient_present'
             WHEN c.total > 0 AND c.scheduled = c.total THEN 'scheduled'
             -- Agendada a medias, o ya había avanzado y se quedó sin citas.
             WHEN c.scheduled > 0
               OR p_current NOT IN ('submitted', 'confirmed') THEN 'pending_scheduling'
             -- Órdenes viejas con un link vigente en manos del paciente.
             WHEN p_current = 'submitted' AND EXISTS (
                    SELECT 1 FROM public.study_order_booking_tokens bt
                     WHERE bt.study_order_id = p_order_id AND bt.revoked_at IS NULL
                       AND bt.used_count < bt.max_uses
                       AND bt.expires_at > (now() AT TIME ZONE 'America/Montevideo')) THEN 'pending_scheduling'
             ELSE 'confirmed'
           END
      FROM c, ap;
$fn$;

-- -----------------------------------------------------------------------------
-- 5. Conversión de lo que ya existe
-- -----------------------------------------------------------------------------
-- Los triggers se quitan antes: 'submitted' no está en la matriz y la conversión no es un cambio
-- de estado hecho por nadie, así que no deja renglones en el historial.
DROP TRIGGER IF EXISTS trg_study_order_status_guard ON public.study_orders;
DROP TRIGGER IF EXISTS trg_study_order_status_log   ON public.study_orders;
ALTER TABLE public.study_orders DROP CONSTRAINT IF EXISTS study_orders_status_check;

UPDATE public.study_orders so
   SET status = public.study_order_status_from_appointments(so.id, 'submitted'),
       completed_at = CASE WHEN public.study_order_status_from_appointments(so.id, 'submitted') = 'completed'
                           THEN coalesce(so.completed_at, now() AT TIME ZONE 'America/Montevideo')
                           ELSE so.completed_at END
 WHERE so.status = 'submitted';

ALTER TABLE public.study_orders
    ADD CONSTRAINT study_orders_status_check
        CHECK (status IN ('draft', 'confirmed', 'pending_scheduling', 'scheduled', 'patient_present',
                          'in_execution', 'completed', 'delivered', 'cancelled'));

DROP INDEX IF EXISTS public.idx_study_orders_pending_ack;
CREATE INDEX idx_study_orders_pending_ack
    ON public.study_orders (submitted_at DESC) WHERE status = 'confirmed' AND acknowledged_at IS NULL;

-- -----------------------------------------------------------------------------
-- 6. Guarda e historial
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.study_order_status_guard()
RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE v_now timestamp := now() AT TIME ZONE 'America/Montevideo';
BEGIN
    IF NOT public.study_order_transition_allowed(OLD.status, NEW.status) THEN
        RAISE EXCEPTION 'STUDY_ORDER_INVALID_TRANSITION: % -> %', OLD.status, NEW.status
              USING ERRCODE = 'SO409';
    END IF;

    IF NEW.status = 'confirmed' THEN
        NEW.submitted_at := coalesce(NEW.submitted_at, v_now);
    ELSIF NEW.status = 'completed' THEN
        NEW.completed_at := v_now;
    ELSIF NEW.status = 'delivered' THEN
        NEW.delivered_at := v_now;
        NEW.delivered_by := NEW.updated_by;
    ELSIF NEW.status = 'cancelled' THEN
        NEW.cancelled_at := coalesce(NEW.cancelled_at, v_now);
    END IF;
    IF OLD.status = 'completed' AND NEW.status <> 'delivered' THEN
        NEW.completed_at := NULL;
    END IF;
    RETURN NEW;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.study_order_status_log()
RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE
    v_kind text := NULLIF(current_setting('app.study_order_actor_kind', true), '');
    v_meta jsonb := coalesce(NULLIF(current_setting('app.study_order_meta', true), ''), '{}')::jsonb;
BEGIN
    v_kind := coalesce(v_kind, CASE WHEN NEW.updated_by IS NULL THEN 'system' ELSE 'user' END);
    INSERT INTO public.study_order_events
           (study_order_id, event_type, actor_id, actor_kind, metadata, created_at)
    VALUES (NEW.id, 'status_changed',
            CASE WHEN v_kind = 'user' THEN NEW.updated_by END,
            v_kind,
            jsonb_build_object('from', OLD.status, 'to', NEW.status)
              || CASE WHEN NEW.status = 'cancelled'
                      THEN jsonb_build_object('reason', NEW.cancellation_reason) ELSE '{}'::jsonb END
              || v_meta,
            -- clock_timestamp y no now(): una orden puede avanzar varios pasos en la misma
            -- transacción y tienen que quedar en orden.
            clock_timestamp() AT TIME ZONE 'America/Montevideo');
    RETURN NULL;
END;
$fn$;

CREATE TRIGGER trg_study_order_status_guard
    BEFORE UPDATE OF status ON public.study_orders
    FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION public.study_order_status_guard();

CREATE TRIGGER trg_study_order_status_log
    AFTER UPDATE OF status ON public.study_orders
    FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION public.study_order_status_log();

-- -----------------------------------------------------------------------------
-- 7. Cambiar el estado en nombre de alguien
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.study_order_set_status(
    p_order_id uuid, p_to text, p_actor_id uuid,
    p_actor_kind text DEFAULT 'user', p_meta jsonb DEFAULT '{}'::jsonb)
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v_status text;
BEGIN
    PERFORM set_config('app.study_order_actor_kind', p_actor_kind, true);
    PERFORM set_config('app.study_order_meta', coalesce(p_meta, '{}'::jsonb)::text, true);
    UPDATE public.study_orders
       SET status = p_to,
           -- Paciente y sistema no tienen usuario: se deja en NULL para no culpar al anterior.
           updated_by = CASE WHEN p_actor_kind = 'user' THEN p_actor_id END
     WHERE id = p_order_id AND status IS DISTINCT FROM p_to
    RETURNING status INTO v_status;
    PERFORM set_config('app.study_order_actor_kind', '', true);
    PERFORM set_config('app.study_order_meta', '', true);
    RETURN v_status;
END;
$fn$;

COMMENT ON FUNCTION public.study_order_set_status(uuid, text, uuid, text, jsonb) IS
    'Cambia el estado con su autor (user | patient | system). Falla con SO409 si la matriz no lo admite; NULL si ya estaba en ese estado.';

-- Lleva la orden al estado de sus citas pasando por cada estado intermedio, para que el historial
-- quede completo. Los pasos que nadie marcó a mano llevan "automatic": true.
CREATE OR REPLACE FUNCTION public.study_order_sync(
    p_order_id uuid, p_actor_id uuid, p_actor_kind text DEFAULT 'user', p_appointment_id integer DEFAULT NULL)
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE
    v_path  constant text[] := ARRAY['confirmed', 'pending_scheduling', 'scheduled', 'patient_present',
                                     'in_execution', 'completed'];
    v_cur    text;
    v_target text;
    v_next   text;
    i        int;
    j        int;
    v_meta   jsonb;
BEGIN
    SELECT status INTO v_cur FROM public.study_orders WHERE id = p_order_id FOR UPDATE;
    -- Borrador, entregada y cancelada las decide una persona.
    IF v_cur IS NULL OR v_cur IN ('draft', 'delivered', 'cancelled') THEN
        RETURN v_cur;
    END IF;

    v_target := public.study_order_status_from_appointments(p_order_id, v_cur);

    WHILE v_cur <> v_target LOOP
        i := array_position(v_path, v_cur);
        j := array_position(v_path, v_target);
        IF j > i THEN
            -- De confirmada se agenda directo, sin pasar por agenda pendiente (carga telefónica).
            v_next := CASE WHEN v_cur = 'confirmed' AND j > 2 THEN 'scheduled' ELSE v_path[i + 1] END;
        ELSIF v_target = 'pending_scheduling' THEN
            v_next := v_target;
        ELSE
            v_next := v_path[i - 1];
        END IF;
        v_meta := CASE WHEN v_next = v_target THEN '{}'::jsonb ELSE '{"automatic": true}'::jsonb END
               || CASE WHEN p_appointment_id IS NULL THEN '{}'::jsonb
                       ELSE jsonb_build_object('appointment_id', p_appointment_id) END;
        PERFORM public.study_order_set_status(p_order_id, v_next, p_actor_id, p_actor_kind, v_meta);
        v_cur := v_next;
    END LOOP;
    RETURN v_cur;
END;
$fn$;

COMMENT ON FUNCTION public.study_order_sync(uuid, uuid, text, integer) IS
    'Recalcula el estado según las citas, en nombre de quien movió la cita. Idempotente: sin cambios no escribe nada.';

-- La orden de una cita, si tiene. La llama /appointments/update_status después de cambiar la cita.
CREATE OR REPLACE FUNCTION public.study_order_sync_appointment(p_appointment_id integer, p_actor_id uuid)
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v_order uuid;
BEGIN
    SELECT study_order_id INTO v_order FROM public.appointments WHERE id = p_appointment_id;
    IF v_order IS NULL THEN RETURN NULL; END IF;
    RETURN public.study_order_sync(v_order, p_actor_id,
                                   CASE WHEN p_actor_id IS NULL THEN 'system' ELSE 'user' END,
                                   p_appointment_id);
END;
$fn$;

-- -----------------------------------------------------------------------------
-- 8. Vista de la bandeja
-- -----------------------------------------------------------------------------
-- Mismas columnas que la 077; board_status pasa a ser el estado guardado.
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
       EXTRACT(epoch FROM ((now() AT TIME ZONE 'America/Montevideo') - o.submitted_at)) / 3600.0
                                                       AS hours_since_submitted,
       (o.status NOT IN ('delivered', 'cancelled') AND EXISTS (SELECT 1 FROM public.appointments a
                WHERE a.study_order_id = o.id
                  AND a.end_datetime < (now() AT TIME ZONE 'America/Montevideo')
                  AND a.status NOT IN ('completed', 'cancelled', 'deleted')))  AS has_past_due_appointment,
       o.status::text AS board_status
  FROM public.study_orders o
  LEFT JOIN item_state s ON s.study_order_id = o.id
 GROUP BY o.id;

-- -----------------------------------------------------------------------------
-- 9. Permiso para marcar la entrega
-- -----------------------------------------------------------------------------
INSERT INTO permissions (name, description, code, module, submenu, permission_type)
VALUES ('Entregar Orden de Estudio', 'Marcar como entregada una orden con los estudios completados',
        'STUDY_ORDERS_DELIVER', 'study_orders', 'study-orders', 'write')
ON CONFLICT (code) DO NOTHING;

-- Los roles que ya trabajan la bandeja.
INSERT INTO role_permissions (role_id, permission_id)
SELECT DISTINCT rp.role_id, pd.id
  FROM role_permissions rp
  JOIN permissions pk ON pk.id = rp.permission_id AND pk.code = 'STUDY_ORDERS_ACKNOWLEDGE'
 CROSS JOIN permissions pd
 WHERE pd.code = 'STUDY_ORDERS_DELIVER'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO public.db_migrations (script_name, version_tag, notes)
VALUES (
    '179_20261125_study-order-nine-states.sql',
    'v1',
    'Órdenes de estudio — nueve estados guardados, matriz de transiciones, historial con autor y permiso STUDY_ORDERS_DELIVER'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;

-- =============================================================================
-- Verificación
-- =============================================================================
-- SELECT status, count(*) FROM study_orders GROUP BY 1 ORDER BY 1;
-- SELECT study_order_transition_allowed('confirmed', 'scheduled') AS valida,   -- true
--        study_order_transition_allowed('draft', 'completed')     AS invalida; -- false

-- =============================================================================
-- Rollback manual (los nueve estados vuelven a cuatro; se pierde el detalle)
-- =============================================================================
-- BEGIN;
-- DROP TRIGGER IF EXISTS trg_study_order_status_guard ON public.study_orders;
-- DROP TRIGGER IF EXISTS trg_study_order_status_log ON public.study_orders;
-- ALTER TABLE public.study_orders DROP CONSTRAINT IF EXISTS study_orders_status_check;
-- UPDATE public.study_orders SET status = CASE WHEN status = 'delivered' THEN 'completed' ELSE 'submitted' END
--  WHERE status NOT IN ('draft', 'completed', 'cancelled');
-- ALTER TABLE public.study_orders ADD CONSTRAINT study_orders_status_check
--     CHECK (status IN ('draft', 'submitted', 'completed', 'cancelled'));
-- DROP INDEX IF EXISTS public.idx_study_orders_pending_ack;
-- CREATE INDEX idx_study_orders_pending_ack ON public.study_orders (submitted_at DESC)
--     WHERE status = 'submitted' AND acknowledged_at IS NULL;
-- -- Volver a correr la sección 2 de la 077 (v_study_orders_board) y después:
-- DROP FUNCTION IF EXISTS public.study_order_sync_appointment(integer, uuid);
-- DROP FUNCTION IF EXISTS public.study_order_sync(uuid, uuid, text, integer);
-- DROP FUNCTION IF EXISTS public.study_order_set_status(uuid, text, uuid, text, jsonb);
-- DROP FUNCTION IF EXISTS public.study_order_status_from_appointments(uuid, text);
-- DROP FUNCTION IF EXISTS public.study_order_status_guard();
-- DROP FUNCTION IF EXISTS public.study_order_status_log();
-- DROP FUNCTION IF EXISTS public.study_order_transition_allowed(text, text);
-- DELETE FROM public.study_order_events WHERE event_type = 'status_changed';
-- DELETE FROM role_permissions WHERE permission_id = (SELECT id FROM permissions WHERE code = 'STUDY_ORDERS_DELIVER');
-- DELETE FROM permissions WHERE code = 'STUDY_ORDERS_DELIVER';
-- ALTER TABLE public.study_orders DROP COLUMN IF EXISTS delivered_at, DROP COLUMN IF EXISTS delivered_by;
-- DELETE FROM public.db_migrations WHERE script_name = '179_20261125_study-order-nine-states.sql';
-- COMMIT;
