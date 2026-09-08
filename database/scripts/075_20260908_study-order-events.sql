-- =============================================================================
-- Órdenes de estudio — bitácora de eventos
-- =============================================================================
-- Crea:
--   1. public.study_order_events        quién hizo qué y cuándo, por orden
--   2. Backfill de las órdenes que ya existen, para que su línea de tiempo no
--      arranque vacía
--
-- POR QUÉ UNA TABLA Y NO DERIVARLO DE LAS COLUMNAS QUE YA ESTÁN
-- -------------------------------------------------------------
-- `study_orders` guarda submitted_at, acknowledged_at, cancelled_at y
-- completed_at, y de ahí sale la actividad que se muestra hoy. Eso alcanza para
-- cuatro hitos y para nada más:
--
--   · Sólo registra el ÚLTIMO. Una orden reagendada tres veces tiene una sola
--     fecha; las dos primeras se pierden.
--   · No dice QUIÉN. `acknowledged_by` es la única excepción, y es una columna
--     suelta que nadie más imita.
--   · No tiene lugar para lo que pasa del lado de la cita —se movió, se canceló,
--     se registró la sesión— que es justamente lo que el derivador quiere ver.
--
-- Una fila por evento resuelve las tres cosas y además deja la puerta abierta a
-- eventos nuevos sin tocar la DDL: el tipo es un CHECK, no una tabla de
-- catálogo.
--
-- Las columnas de `study_orders` NO se tocan ni se vacían: siguen siendo la
-- fuente de verdad del estado. Esta tabla es el historial, no el estado.
--
-- Dependencias: public.study_orders, public.users, public.appointments,
--               public.sesiones_clinicas
--
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. La bitácora
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.study_order_events (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    study_order_id uuid        NOT NULL,
    event_type     varchar(40) NOT NULL,
    -- Quién. NULL cuando no hay persona detrás: el paciente entrando por el link
    -- público (no tiene cuenta) o el cron de reconciliación.
    actor_id       uuid,
    actor_kind     varchar(20) NOT NULL DEFAULT 'user',
    -- Sobre qué cita, cuando el evento es del lado de la agenda.
    appointment_id integer,
    -- Detalle libre del evento: fechas anterior y nueva de un reagendado, motivo
    -- de una anulación, nombre del estudio... Lo que la tarjeta necesite mostrar
    -- sin tener que volver a consultar.
    metadata       jsonb       NOT NULL DEFAULT '{}'::jsonb,
    created_at     timestamp without time zone NOT NULL DEFAULT now(),

    CONSTRAINT study_order_events_type_check CHECK (event_type IN (
        'created',               -- se creó el borrador
        'updated',               -- se editó el borrador
        'submitted',             -- el derivador la envió a la clínica
        'acknowledged',          -- la recepción la tomó
        'scheduled',             -- se ató una cita a la orden
        'rescheduled',           -- se movió una cita de la orden
        'appointment_updated',   -- se editó una cita de la orden
        'appointment_cancelled', -- se canceló, borró o marcó no-show una cita
        'session_saved',         -- se registró la sesión clínica de una cita
        'completed',             -- todas las líneas atendidas
        'reopened',              -- se cayó una cita de una orden ya cerrada
        'cancelled',             -- la orden se anuló
        'link_created',          -- se generó el link de auto-agendamiento
        'patient_booked'         -- el paciente reservó por ese link
    )),
    CONSTRAINT study_order_events_actor_kind_check CHECK (actor_kind IN ('user', 'patient', 'system'))
);

COMMENT ON TABLE public.study_order_events IS
    'Historial de la orden: una fila por hecho, con quién y cuándo. No reemplaza a las columnas de estado de study_orders — esas siguen siendo la verdad del estado actual; esto es cómo se llegó hasta acá.';
COMMENT ON COLUMN public.study_order_events.actor_id IS
    'Usuario que provocó el evento. NULL con actor_kind patient (el link público no tiene cuenta) o system (el cron de reconciliación).';
COMMENT ON COLUMN public.study_order_events.metadata IS
    'Detalle para pintar la tarjeta sin volver a consultar: from/to de un reagendado, reason de una anulación, service_names, etc.';

CREATE INDEX IF NOT EXISTS idx_study_order_events_order
    ON public.study_order_events (study_order_id, created_at);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_study_order_events_order') THEN
        ALTER TABLE public.study_order_events
            ADD CONSTRAINT fk_study_order_events_order
            FOREIGN KEY (study_order_id) REFERENCES public.study_orders (id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_study_order_events_actor') THEN
        ALTER TABLE public.study_order_events
            ADD CONSTRAINT fk_study_order_events_actor
            FOREIGN KEY (actor_id) REFERENCES public.users (id) ON DELETE SET NULL;
    END IF;
    -- Sin FK a appointments a propósito: una cita borrada de verdad no debe
    -- borrar el renglón que cuenta que existió. Queda el id colgado, que es
    -- justamente lo que se quiere de un historial.
END $$;

-- -----------------------------------------------------------------------------
-- 2. Backfill de lo que ya pasó
-- -----------------------------------------------------------------------------
-- Las órdenes que existen hoy tienen sus hitos en columnas. Se los convierte en
-- eventos para que la línea de tiempo no arranque vacía y no parezca que la
-- orden apareció de la nada.
--
-- Lo que no se puede reconstruir se deja afuera antes que inventarlo: de las
-- citas sólo se sabe que existen y cuándo se crearon, no quién las creó, así
-- que su evento va sin actor.
--
-- El guard por NOT EXISTS hace el bloque repetible.
INSERT INTO public.study_order_events (study_order_id, event_type, actor_id, actor_kind, created_at, metadata)
SELECT so.id, 'created', so.created_by,
       CASE WHEN so.created_by IS NULL THEN 'system' ELSE 'user' END,
       so.created_at, jsonb_build_object('backfilled', true)
  FROM public.study_orders so
 WHERE NOT EXISTS (SELECT 1 FROM public.study_order_events e
                    WHERE e.study_order_id = so.id AND e.event_type = 'created');

INSERT INTO public.study_order_events (study_order_id, event_type, actor_id, actor_kind, created_at, metadata)
SELECT so.id, 'submitted', so.doctor_id, 'user', so.submitted_at, jsonb_build_object('backfilled', true)
  FROM public.study_orders so
 WHERE so.submitted_at IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.study_order_events e
                    WHERE e.study_order_id = so.id AND e.event_type = 'submitted');

INSERT INTO public.study_order_events (study_order_id, event_type, actor_id, actor_kind, created_at, metadata)
SELECT so.id, 'acknowledged', so.acknowledged_by,
       CASE WHEN so.acknowledged_by IS NULL THEN 'system' ELSE 'user' END,
       so.acknowledged_at, jsonb_build_object('backfilled', true)
  FROM public.study_orders so
 WHERE so.acknowledged_at IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.study_order_events e
                    WHERE e.study_order_id = so.id AND e.event_type = 'acknowledged');

-- Una cita atada a la orden: no se sabe quién la creó, sólo cuándo.
INSERT INTO public.study_order_events (study_order_id, event_type, actor_id, actor_kind, appointment_id, created_at, metadata)
SELECT a.study_order_id, 'scheduled', NULL, 'system', a.id,
       coalesce(a.created_at, now()),
       jsonb_build_object('backfilled', true, 'start', a.start_datetime, 'end', a.end_datetime)
  FROM public.appointments a
 WHERE a.study_order_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.study_order_events e
                    WHERE e.study_order_id = a.study_order_id
                      AND e.event_type = 'scheduled'
                      AND e.appointment_id = a.id);

-- La sesión clínica sí sabe quién la registró.
INSERT INTO public.study_order_events (study_order_id, event_type, actor_id, actor_kind, appointment_id, created_at, metadata)
SELECT a.study_order_id, 'session_saved', sc.doctor_id,
       CASE WHEN sc.doctor_id IS NULL THEN 'system' ELSE 'user' END,
       a.id, sc.fecha_sesion,
       jsonb_build_object('backfilled', true, 'session_id', sc.id)
  FROM public.sesiones_clinicas sc
  JOIN public.appointments a ON a.id = sc.appointment_id
 WHERE a.study_order_id IS NOT NULL
   AND sc.fecha_sesion IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.study_order_events e
                    WHERE e.study_order_id = a.study_order_id
                      AND e.event_type = 'session_saved'
                      AND e.appointment_id = a.id);

INSERT INTO public.study_order_events (study_order_id, event_type, actor_id, actor_kind, created_at, metadata)
SELECT so.id, 'completed', NULL, 'system', so.completed_at, jsonb_build_object('backfilled', true)
  FROM public.study_orders so
 WHERE so.completed_at IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.study_order_events e
                    WHERE e.study_order_id = so.id AND e.event_type = 'completed');

INSERT INTO public.study_order_events (study_order_id, event_type, actor_id, actor_kind, created_at, metadata)
SELECT so.id, 'cancelled', NULL, 'system', so.cancelled_at,
       jsonb_build_object('backfilled', true, 'reason', so.cancellation_reason)
  FROM public.study_orders so
 WHERE so.cancelled_at IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.study_order_events e
                    WHERE e.study_order_id = so.id AND e.event_type = 'cancelled');

INSERT INTO db_migrations (script_name, version_tag, notes)
VALUES (
    '075_20260908_study-order-events.sql',
    'v1',
    'Órdenes de estudio — bitácora study_order_events (quién/qué/cuándo) + backfill de las órdenes existentes'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;

-- =============================================================================
-- Rollback manual
-- =============================================================================
-- BEGIN;
-- DROP TABLE IF EXISTS public.study_order_events;
-- DELETE FROM public.db_migrations WHERE script_name = '075_20260908_study-order-events.sql';
-- COMMIT;
