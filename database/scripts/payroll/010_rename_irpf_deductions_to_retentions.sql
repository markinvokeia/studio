-- ─────────────────────────────────────────────────────────────────────────────
-- 010_rename_irpf_deductions_to_retentions.sql
--
-- Renombra la tabla payroll_irpf_deductions → payroll_retentions (junto con su
-- índice y constraints). Es solo un cambio de nombre: la estructura, los datos y
-- el cálculo de IRPF (crédito DGI que lee esta tabla) se mantienen igual.
-- El enum irpf_deduction_tipo_enum NO se renombra (se acota el alcance).
-- Idempotente: usa IF EXISTS y DO/EXCEPTION para poder re-ejecutarse.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- 1. Renombrar tabla
ALTER TABLE IF EXISTS public.payroll_irpf_deductions
  RENAME TO payroll_retentions;

-- 2. Renombrar índice
ALTER INDEX IF EXISTS public.idx_payroll_irpf_deductions_employee
  RENAME TO idx_payroll_retentions_employee;

-- 3. Renombrar constraints (PK + FKs). DO/EXCEPTION para no fallar si ya se
--    renombraron o si el nombre auto-generado difiere.
DO $$ BEGIN
  ALTER TABLE public.payroll_retentions
    RENAME CONSTRAINT payroll_irpf_deductions_pkey TO payroll_retentions_pkey;
EXCEPTION WHEN undefined_object THEN NULL; WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.payroll_retentions
    RENAME CONSTRAINT payroll_irpf_deductions_employee_id_fkey TO payroll_retentions_employee_id_fkey;
EXCEPTION WHEN undefined_object THEN NULL; WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.payroll_retentions
    RENAME CONSTRAINT payroll_irpf_deductions_created_by_fkey TO payroll_retentions_created_by_fkey;
EXCEPTION WHEN undefined_object THEN NULL; WHEN undefined_table THEN NULL; END $$;

-- 4. Actualizar comentario
DO $$ BEGIN
  COMMENT ON TABLE public.payroll_retentions
    IS 'Retenciones del empleado (BHU/ANV, caja profesional, alimentos, alquiler, etc.). Alimentan el crédito de IRPF.';
EXCEPTION WHEN undefined_table THEN NULL; END $$;

COMMIT;
