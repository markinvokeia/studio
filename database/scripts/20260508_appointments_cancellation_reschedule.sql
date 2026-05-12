-- =====================================================================
-- Appointments — Estados ampliados + Razones de cancelación + Reagendar
-- Run on: dev / staging / prod
-- Idempotente: se puede correr varias veces sin efectos secundarios.
-- =====================================================================
--
-- Cambios:
--   1. Normaliza el spelling "canceled" → "cancelled" en datos existentes.
--   2. Reemplaza el CHECK del campo `appointments.status` con la lista
--      canónica de 8 estados (incluye arrived, in_progress, no_show).
--   3. Crea la tabla `appointment_status_log` para auditoría de cambios.
--   4. Añade columnas de razón de cancelación (`cancellation_reason`,
--      `cancellation_note`) — sin CHECK de dominio; validación vive en
--      frontend + workflow n8n.
--   5. Extiende `appointment_status_log` con `cancellation_reason` y
--      `cancellation_note`.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Normalizar spelling existente
-- ---------------------------------------------------------------------
UPDATE appointments
SET status = 'cancelled'
WHERE status = 'canceled';

-- ---------------------------------------------------------------------
-- 2. CHECK del dominio de status
-- ---------------------------------------------------------------------
-- ALTER TABLE appointments
--     DROP CONSTRAINT IF EXISTS appointments_status_check;

ALTER TABLE appointments
    ADD CONSTRAINT appointments_status_check
    CHECK (status IN (
        'pending',
        'scheduled',
        'confirmed',
        'arrived',
        'in_progress',
        'completed',
        'no_show',
        'cancelled'
    ));

-- ---------------------------------------------------------------------
-- 3. Tabla de auditoría de cambios de status
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS appointment_status_log (
    id              BIGSERIAL PRIMARY KEY,
    appointment_id  TEXT NOT NULL,
    from_status     VARCHAR(20),
    to_status       VARCHAR(20) NOT NULL,
    changed_by      TEXT,
    changed_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    note            TEXT
);

CREATE INDEX IF NOT EXISTS idx_appt_status_log_appt_id
    ON appointment_status_log (appointment_id, changed_at DESC);

-- ---------------------------------------------------------------------
-- 4. Razón de cancelación (texto libre, sin CHECK de dominio).
--    La lista de valores válidos vive en frontend + workflow n8n.
-- ---------------------------------------------------------------------
ALTER TABLE appointments
    ADD COLUMN IF NOT EXISTS cancellation_reason VARCHAR(20);

-- Texto libre asociado al motivo (se llena cuando reason='other').
ALTER TABLE appointments
    ADD COLUMN IF NOT EXISTS cancellation_note TEXT;

-- ---------------------------------------------------------------------
-- 5. Log: capturar también la razón y el texto libre
-- ---------------------------------------------------------------------
ALTER TABLE appointment_status_log
    ADD COLUMN IF NOT EXISTS cancellation_reason VARCHAR(20),
    ADD COLUMN IF NOT EXISTS cancellation_note   TEXT;

COMMIT;

-- =====================================================================
-- ROLLBACK (ejecutar manualmente si algo va mal)
-- =====================================================================
-- BEGIN;
-- -- 5. Log columns
-- ALTER TABLE appointment_status_log DROP COLUMN IF EXISTS cancellation_note;
-- ALTER TABLE appointment_status_log DROP COLUMN IF EXISTS cancellation_reason;
-- -- 4. Cancellation columns
-- ALTER TABLE appointments DROP COLUMN IF EXISTS cancellation_note;
-- ALTER TABLE appointments DROP COLUMN IF EXISTS cancellation_reason;
-- -- 3. Audit log table
-- DROP INDEX IF EXISTS idx_appt_status_log_appt_id;
-- DROP TABLE IF EXISTS appointment_status_log;
-- -- 2. Status CHECK constraint
-- ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
-- -- 1. Spelling (no se revierte automáticamente; los cancelled originales
-- --    podrían incluir tanto los antiguos canceled como los nuevos)
-- COMMIT;
