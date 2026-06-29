-- =====================================================================
-- Agrega el estado 'deleted' al CHECK de appointments.status
-- Run on: dev / staging / prod
-- Idempotente: se puede correr varias veces sin efectos secundarios.
-- =====================================================================
--
-- Propósito:
--   El borrado de citas es un soft-delete: la cita pasa a status='deleted'
--   y se excluye al traer las citas (no se elimina la fila). El CHECK
--   actual no permite ese valor, por lo que el UPDATE falla con
--   "appointments_status_check". Aquí se recrea el constraint incluyendo
--   'deleted'.
-- =====================================================================

BEGIN;

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_status_check;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_status_check CHECK (
    status::text = ANY (ARRAY[
      'pending'::character varying,
      'scheduled'::character varying,
      'confirmed'::character varying,
      'arrived'::character varying,
      'in_progress'::character varying,
      'completed'::character varying,
      'no_show'::character varying,
      'cancelled'::character varying,
      'deleted'::character varying
    ]::text[])
  );

COMMIT;
