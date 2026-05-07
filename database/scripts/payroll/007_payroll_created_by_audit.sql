-- =============================================================================
-- MÓDULO DE NÓMINAS — InvokeIA Studio
-- Script: 007_payroll_created_by_audit.sql
-- Descripción: Agrega la columna de auditoría `created_by` (UUID, NULLEABLE,
--   NO obligatoria) a todas las tablas del módulo de nóminas que aún no la
--   tienen. Referencia a users(id) con ON DELETE SET NULL para no perder filas
--   si se elimina el usuario.
--
--   Idempotente: usa ADD COLUMN IF NOT EXISTS, por lo que es un no-op en las
--   tablas que ya definían created_by (payroll_contracts, payroll_ausencias,
--   payroll_egresos, payroll_manual_adjustments, payroll_novedades).
--
--   NOTA: doctor_contracts fue renombrada a payroll_contracts (ver 003); aquí
--   se referencia la tabla vigente payroll_contracts.
-- Autor: InvokeIA
-- Fecha: 2026-06-17
-- =============================================================================

BEGIN;

ALTER TABLE IF EXISTS public.payroll_categories
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.payroll_concepts
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.payroll_employees
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.payroll_employments
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.payroll_entries
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.payroll_family_charges
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.payroll_honorarios
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.payroll_irpf_deductions
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.payroll_periods
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.payroll_portal_requests
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.payroll_session_assignments
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.payroll_settings
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.payroll_work_calendar
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- ── Ya tenían created_by (no-op por IF NOT EXISTS; se incluyen por completitud) ──
ALTER TABLE IF EXISTS public.payroll_contracts
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.payroll_ausencias
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.payroll_egresos
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.payroll_manual_adjustments
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.payroll_novedades
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

COMMIT;
