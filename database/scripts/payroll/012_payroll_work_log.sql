-- ─────────────────────────────────────────────────────────────────────────────
-- 012_payroll_work_log.sql
--
-- Parte de trabajo diario por empleado: fuente única del cálculo de nómina
-- (horas trabajadas, horas extra, producción) para TODOS los empleados, no solo
-- los médicos. Para médicos se prepobla desde las sesiones clínicas (origen
-- 'auto') pero el usuario decide los valores finales (origen 'manual').
-- Idempotente.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payroll_work_log (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id          UUID NOT NULL REFERENCES payroll_employees(id) ON DELETE CASCADE,
  employment_id        UUID REFERENCES payroll_employments(id) ON DELETE SET NULL,
  clinic_id            INTEGER REFERENCES clinic(id) ON DELETE SET NULL,
  fecha                DATE NOT NULL,
  horas_normales       DECIMAL(5,2) NOT NULL DEFAULT 0,
  horas_extra_habiles  DECIMAL(5,2) NOT NULL DEFAULT 0,
  horas_extra_feriados DECIMAL(5,2) NOT NULL DEFAULT 0,
  sesiones             INTEGER NOT NULL DEFAULT 0,
  produccion_facturada DECIMAL(12,2) NOT NULL DEFAULT 0,
  produccion_listada   DECIMAL(12,2) NOT NULL DEFAULT 0,
  origen               VARCHAR(10) NOT NULL DEFAULT 'manual' CHECK (origen IN ('manual', 'auto')),
  notas                TEXT,
  created_at           TIMESTAMPTZ DEFAULT now(),
  created_by           UUID REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT payroll_work_log_employee_fecha_key UNIQUE (employee_id, fecha)
);

CREATE INDEX IF NOT EXISTS idx_payroll_work_log_employee_fecha ON payroll_work_log(employee_id, fecha);
CREATE INDEX IF NOT EXISTS idx_payroll_work_log_clinic ON payroll_work_log(clinic_id);

COMMENT ON TABLE payroll_work_log IS 'Parte de trabajo diario por empleado (horas, extras, producción). Fuente única del cálculo de nómina.';
