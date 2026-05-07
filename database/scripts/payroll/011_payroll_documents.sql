-- ─────────────────────────────────────────────────────────────────────────────
-- 011_payroll_documents.sql
--
-- Tabla de seguimiento de documentos/reportes por período de nómina.
-- Permite mostrar estado (pendiente/generado/error/no_procede), fecha de la
-- última generación, errores y metadatos. Los reportes se recalculan desde
-- payroll_entries; esta tabla solo registra su estado.
-- Idempotente.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE payroll_document_tipo_enum AS ENUM (
    'planilla_sueldos', 'bps_nomina', 'bps_gafi', 'dgi_irpf',
    'bank_file', 'accounting', 'receipts', 'cost_center', 'mtss'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payroll_document_estado_enum AS ENUM (
    'pendiente', 'generado', 'error', 'no_procede'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS payroll_documents (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_period_id  UUID NOT NULL REFERENCES payroll_periods(id) ON DELETE CASCADE,
  clinic_id          INTEGER REFERENCES clinic(id) ON DELETE SET NULL,
  tipo               payroll_document_tipo_enum NOT NULL,
  estado             payroll_document_estado_enum NOT NULL DEFAULT 'pendiente',
  formato            VARCHAR(20),
  generated_at       TIMESTAMPTZ,
  generated_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  error_message      TEXT,
  meta               JSONB,
  created_at         TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT payroll_documents_period_tipo_key UNIQUE (payroll_period_id, tipo)
);

CREATE INDEX IF NOT EXISTS idx_payroll_documents_period ON payroll_documents(payroll_period_id);

COMMENT ON TABLE payroll_documents IS 'Seguimiento de documentos/reportes generados por período de nómina (estado, fecha, errores).';
