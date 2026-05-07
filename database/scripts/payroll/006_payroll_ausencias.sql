-- =============================================================================
-- MÓDULO DE NÓMINAS — InvokeIA Studio
-- Script: 006_payroll_ausencias.sql
-- Descripción: Ledger de licencias y ausencias por rango de fechas
--   (vacaciones, licencias médicas/especiales, ausencias justificadas e
--    injustificadas, suspensiones). Complementa a payroll_novedades, que
--    sigue siendo el insumo por período (horas extra, adelanto, bono, descuento).
--   El saldo de vacaciones se CALCULA (no se almacena) desde fecha_ingreso y
--   payroll_settings.vacation_days_per_year + antigüedad.
-- Autor: InvokeIA
-- Fecha: 2026-06-16
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- TIPOS ENUM
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE ausencia_tipo_enum AS ENUM (
    'vacaciones', 'licencia_medica', 'licencia_especial', 'licencia_estudio',
    'ausencia_justificada', 'ausencia_injustificada', 'suspension', 'otro'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ausencia_estado_enum AS ENUM (
    'pendiente', 'aprobada', 'rechazada'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- TABLA: payroll_ausencias
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payroll_ausencias (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   UUID NOT NULL REFERENCES payroll_employees(id) ON DELETE CASCADE,
  clinic_id     INTEGER REFERENCES clinic(id) ON DELETE SET NULL,
  tipo          ausencia_tipo_enum NOT NULL,
  fecha_desde   DATE NOT NULL,
  fecha_hasta   DATE NOT NULL,
  dias          DECIMAL(6,2) NOT NULL DEFAULT 0,
  justificada   BOOLEAN NOT NULL DEFAULT false,
  pagada        BOOLEAN NOT NULL DEFAULT false,
  estado        ausencia_estado_enum NOT NULL DEFAULT 'aprobada',
  descripcion   TEXT,
  documento_url TEXT,
  aprobado_por  VARCHAR(100),
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payroll_ausencias_employee
  ON payroll_ausencias(employee_id);

CREATE INDEX IF NOT EXISTS idx_payroll_ausencias_rango
  ON payroll_ausencias(fecha_desde, fecha_hasta);

CREATE INDEX IF NOT EXISTS idx_payroll_ausencias_tipo
  ON payroll_ausencias(tipo);

COMMENT ON TABLE payroll_ausencias
  IS 'Licencias y ausencias por rango de fechas. Fuente de verdad para saldos de vacaciones y descuentos por ausentismo en nómina/egreso.';

COMMIT;
