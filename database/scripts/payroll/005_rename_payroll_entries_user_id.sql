-- ─────────────────────────────────────────────────────────────────────────────
-- 005_rename_payroll_entries_user_id.sql
--
-- Renombra la columna doctor_id → user_id en payroll_entries,
-- payroll_honorarios y payroll_session_assignments, junto con sus constraints
-- e índices, para alinearlas con payroll_contracts (ver 003).
-- La columna sigue referenciando users(id); solo cambia el nombre.
-- (Las tablas clínicas patient_sessions y quotes conservan doctor_id.)
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- 1. Renombrar columna doctor_id → user_id
ALTER TABLE IF EXISTS public.payroll_entries
  RENAME COLUMN doctor_id TO user_id;

-- 2. Renombrar constraints
--    FK hacia users(id)
ALTER TABLE IF EXISTS public.payroll_entries
  RENAME CONSTRAINT payroll_entries_doctor_id_fkey TO payroll_entries_user_id_fkey;

--    UNIQUE (payroll_period_id, doctor_id) → (payroll_period_id, user_id)
ALTER TABLE IF EXISTS public.payroll_entries
  RENAME CONSTRAINT payroll_entries_payroll_period_id_doctor_id_key
                 TO payroll_entries_payroll_period_id_user_id_key;

-- 3. Renombrar índices
ALTER INDEX IF EXISTS public.idx_payroll_entries_doctor
  RENAME TO idx_payroll_entries_user;

ALTER INDEX IF EXISTS public.idx_pe_doctor_id
  RENAME TO idx_pe_user_id;

-- ─────────────────────────────────────────────────────────────────────────────
-- payroll_honorarios: doctor_id → user_id
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.payroll_honorarios
  RENAME COLUMN doctor_id TO user_id;

ALTER TABLE IF EXISTS public.payroll_honorarios
  RENAME CONSTRAINT payroll_honorarios_doctor_id_fkey TO payroll_honorarios_user_id_fkey;

ALTER TABLE IF EXISTS public.payroll_honorarios
  RENAME CONSTRAINT payroll_honorarios_payroll_period_id_doctor_id_key
                 TO payroll_honorarios_payroll_period_id_user_id_key;

ALTER INDEX IF EXISTS public.idx_payroll_honorarios_doctor
  RENAME TO idx_payroll_honorarios_user;

-- ─────────────────────────────────────────────────────────────────────────────
-- payroll_session_assignments: doctor_id → user_id
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.payroll_session_assignments
  RENAME COLUMN doctor_id TO user_id;

ALTER TABLE IF EXISTS public.payroll_session_assignments
  RENAME CONSTRAINT payroll_session_assignments_doctor_id_fkey
                 TO payroll_session_assignments_user_id_fkey;

ALTER INDEX IF EXISTS public.idx_psa_doctor_date
  RENAME TO idx_psa_user_date;

ALTER INDEX IF EXISTS public.idx_session_assignments_doctor
  RENAME TO idx_session_assignments_user;

COMMIT;
