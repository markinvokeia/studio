
BEGIN;

-- 1. Renombrar tabla
ALTER TABLE IF EXISTS public.doctor_contracts
  RENAME TO payroll_contracts;

-- 2. Renombrar columna doctor_id → user_id
ALTER TABLE IF EXISTS public.payroll_contracts
  RENAME COLUMN doctor_id TO user_id;

-- 3. Renombrar constraints
ALTER TABLE IF EXISTS public.payroll_contracts
  RENAME CONSTRAINT doctor_contracts_pkey TO payroll_contracts_pkey;

ALTER TABLE IF EXISTS public.payroll_contracts
  RENAME CONSTRAINT doctor_contracts_clinic_id_fkey TO payroll_contracts_clinic_id_fkey;

ALTER TABLE IF EXISTS public.payroll_contracts
  RENAME CONSTRAINT doctor_contracts_created_by_fkey TO payroll_contracts_created_by_fkey;

ALTER TABLE IF EXISTS public.payroll_contracts
  RENAME CONSTRAINT doctor_contracts_doctor_id_fkey TO payroll_contracts_user_id_fkey;

-- 4. Renombrar índices
ALTER INDEX IF EXISTS public.idx_doctor_contracts_active
  RENAME TO idx_payroll_contracts_active;

ALTER INDEX IF EXISTS public.idx_doctor_contracts_doctor
  RENAME TO idx_payroll_contracts_user;

-- 5. Actualizar comentario
COMMENT ON TABLE public.payroll_contracts
  IS 'Contratos de compensación para empleados (honorarios, arrendamiento, empresa unipersonal, dependencia)';

COMMIT;
