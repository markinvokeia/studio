-- =============================================================================
-- MÓDULO DE NÓMINAS — InvokeIA Studio
-- Script: 001_create_payroll_tables.sql
-- Descripción: Crea todas las tablas nuevas para el módulo de nóminas
-- Autor: InvokeIA
-- Fecha: 2026-04-30
--
-- INSTRUCCIONES:
--   Ejecutar en orden (las FK dependen de tablas anteriores).
--   Todas las tablas nuevas usan UUID como PK salvo las FK hacia `clinic`.
--   FK hacia `users`  → UUID  (users.id es UUID)
--   FK hacia `clinic` → INTEGER (clinic.id es SERIAL/integer)
--   Ejecutar como superuser o con permisos DDL sobre el schema public.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- TIPOS ENUM
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE contract_type_enum AS ENUM (
    'dependencia', 'arrendamiento', 'honorarios', 'empresa_unipersonal', 'pasante', 'termino', 'suplencia'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE calculation_type_enum AS ENUM (
    'fijo', 'por_hora', 'porcentaje', 'fijo_porcentaje', 'por_prestacion'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE percentage_basis_enum AS ENUM (
    'sobre_cobrado', 'sobre_realizado'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payroll_period_status_enum AS ENUM (
    'draft', 'calculated', 'approved', 'paid', 'closed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payroll_entry_status_enum AS ENUM (
    'draft', 'approved', 'paid'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE fonasa_family_situation_enum AS ENUM (
    'sin_conyuge_sin_hijos', 'con_hijos', 'con_conyuge', 'con_conyuge_e_hijos'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE novedad_type_enum AS ENUM (
    'hora_extra_habil', 'hora_extra_feriado',
    'ausencia_justificada', 'ausencia_injustificada', 'certificado_medico',
    'licencia', 'vacaciones', 'adelanto', 'bono', 'descuento', 'otro'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE honorarios_estado_enum AS ENUM (
    'pendiente', 'validada', 'autorizada', 'pagada', 'rechazada'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE modalidad_jornada_enum AS ENUM (
    'mensual', 'jornal', 'horario'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tipo_aporte_bps_enum AS ENUM (
    'industria_comercio', 'civil'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payroll_concept_tipo_enum AS ENUM (
    'haber', 'descuento', 'provision', 'informativo'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE work_calendar_tipo_enum AS ENUM (
    'feriado_no_laborable', 'feriado_comun', 'cierre_clinica'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE adjustment_type_enum AS ENUM (
    'addition', 'deduction'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE adjustment_category_enum AS ENUM (
    'bono', 'adelanto', 'descuento', 'correccion', 'otro'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE irpf_deduction_tipo_enum AS ENUM (
    'bhu_anv', 'caja_profesional', 'alimentos', 'alquiler', 'otro'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE family_charge_tipo_enum AS ENUM (
    'conyuge', 'hijo', 'hijo_discapacidad'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE honorarios_modalidad_enum AS ENUM (
    'honorarios', 'empresa_unipersonal', 'sociedad'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ---------------------------------------------------------------------------
-- 1. payroll_settings — Configuración de tasas y parámetros (clave-valor JSONB)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payroll_settings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key     VARCHAR(100) UNIQUE NOT NULL,
  setting_value   JSONB NOT NULL,
  description     TEXT,
  updated_at      TIMESTAMPTZ DEFAULT now(),
  updated_by      UUID REFERENCES users(id) ON DELETE SET NULL
);

COMMENT ON TABLE payroll_settings IS 'Parámetros configurables del módulo de nóminas (BPS, FONASA, IRPF, BPC, etc.)';


-- ---------------------------------------------------------------------------
-- 2. payroll_categories — Categorías Grupo 15 MTSS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payroll_categories (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo              VARCHAR(20) NOT NULL,
  nombre              VARCHAR(120) NOT NULL,
  subgrupo            VARCHAR(20),
  descripcion         TEXT,
  salario_minimo_uyu  DECIMAL(12,2) NOT NULL DEFAULT 0,
  vigente_desde       DATE NOT NULL,
  vigente_hasta       DATE,
  created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payroll_categories_vigente ON payroll_categories(vigente_desde);
COMMENT ON TABLE payroll_categories IS 'Categorías del Grupo 15 MTSS con salarios mínimos';


-- ---------------------------------------------------------------------------
-- 3. payroll_concepts — Conceptos/rubros de nómina
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payroll_concepts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo     VARCHAR(10) NOT NULL,
  nombre     VARCHAR(120) NOT NULL,
  tipo       payroll_concept_tipo_enum NOT NULL DEFAULT 'haber',
  grava_bps  BOOLEAN NOT NULL DEFAULT false,
  grava_irpf BOOLEAN NOT NULL DEFAULT false,
  activo     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE payroll_concepts IS 'Catálogo de conceptos/rubros de la liquidación de nómina';


-- ---------------------------------------------------------------------------
-- 4. payroll_work_calendar — Calendario laboral (feriados y cierres)
--    clinic_id NULL = feriado nacional aplica a todas las clínicas
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payroll_work_calendar (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id   INTEGER REFERENCES clinic(id) ON DELETE CASCADE,
  fecha       DATE NOT NULL,
  tipo        work_calendar_tipo_enum NOT NULL,
  descripcion VARCHAR(200) NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (clinic_id, fecha)
);

CREATE INDEX IF NOT EXISTS idx_payroll_work_calendar_fecha ON payroll_work_calendar(fecha);
COMMENT ON TABLE payroll_work_calendar IS 'Días feriados y cierres de clínica. clinic_id NULL = aplica a todas.';


-- ---------------------------------------------------------------------------
-- 5. payroll_employees — Legajo de empleados BPS
--    Representa la persona física registrada ante BPS (puede mapear a un users.id)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payroll_employees (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES users(id) ON DELETE SET NULL,
  clinic_id        INTEGER NOT NULL REFERENCES clinic(id) ON DELETE RESTRICT,
  cedula           VARCHAR(20) NOT NULL,
  nombres          VARCHAR(100) NOT NULL,
  apellidos        VARCHAR(100) NOT NULL,
  fecha_nacimiento DATE,
  sexo             CHAR(1) CHECK (sexo IN ('M', 'F', 'O')),
  estado_civil     VARCHAR(20) CHECK (estado_civil IN ('soltero', 'casado', 'divorciado', 'viudo', 'union_libre')),
  domicilio        TEXT,
  telefono         VARCHAR(30),
  email            VARCHAR(150),
  banco            VARCHAR(80),
  cuenta_banco     VARCHAR(30),
  numero_bps       VARCHAR(20),
  fecha_ingreso    DATE NOT NULL,
  foto_url         TEXT,
  activo           BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payroll_employees_user_id   ON payroll_employees(user_id);
CREATE INDEX IF NOT EXISTS idx_payroll_employees_clinic_id ON payroll_employees(clinic_id);
COMMENT ON TABLE payroll_employees IS 'Legajo del personal bajo relación de dependencia laboral (BPS)';


-- ---------------------------------------------------------------------------
-- 6. payroll_employments — Vinculaciones / contratos laborales BPS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payroll_employments (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id               UUID NOT NULL REFERENCES payroll_employees(id) ON DELETE CASCADE,
  clinic_id                 INTEGER NOT NULL REFERENCES clinic(id) ON DELETE RESTRICT,
  tipo_contrato             contract_type_enum NOT NULL DEFAULT 'dependencia',
  category_id               UUID REFERENCES payroll_categories(id) ON DELETE SET NULL,
  fecha_inicio              DATE NOT NULL,
  fecha_fin                 DATE,
  jornada_horas_semanales   DECIMAL(5,2) NOT NULL DEFAULT 44,
  modalidad_jornada         modalidad_jornada_enum NOT NULL DEFAULT 'mensual',
  sueldo_base               DECIMAL(12,2) NOT NULL DEFAULT 0,
  productividad_porcentaje  DECIMAL(5,2) NOT NULL DEFAULT 0,
  productividad_base        percentage_basis_enum NOT NULL DEFAULT 'sobre_cobrado',
  tipo_aporte_bps           tipo_aporte_bps_enum NOT NULL DEFAULT 'industria_comercio',
  is_active                 BOOLEAN NOT NULL DEFAULT true,
  motivo_baja               VARCHAR(200),
  fecha_baja                DATE,
  created_at                TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payroll_employments_employee ON payroll_employments(employee_id);
COMMENT ON TABLE payroll_employments IS 'Vinculaciones laborales de cada empleado (puede haber múltiples si cambia categoría/sueldo)';


-- ---------------------------------------------------------------------------
-- 7. payroll_family_charges — Cargas de familia del empleado
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payroll_family_charges (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id      UUID NOT NULL REFERENCES payroll_employees(id) ON DELETE CASCADE,
  tipo             family_charge_tipo_enum NOT NULL,
  nombres          VARCHAR(100) NOT NULL,
  apellidos        VARCHAR(100) NOT NULL,
  fecha_nacimiento DATE,
  cedula           VARCHAR(20),
  vigente_desde    DATE NOT NULL,
  vigente_hasta    DATE,
  documento_url    TEXT,
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payroll_family_charges_employee ON payroll_family_charges(employee_id);
COMMENT ON TABLE payroll_family_charges IS 'Cargas de familia de empleados (afecta tasa FONASA)';


-- ---------------------------------------------------------------------------
-- 8. payroll_irpf_deductions — Deducciones IRPF personales del empleado
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payroll_irpf_deductions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     UUID NOT NULL REFERENCES payroll_employees(id) ON DELETE CASCADE,
  tipo            irpf_deduction_tipo_enum NOT NULL DEFAULT 'otro',
  descripcion     VARCHAR(200) NOT NULL,
  monto_mensual   DECIMAL(10,2) NOT NULL DEFAULT 0,
  vigente_desde   DATE NOT NULL,
  vigente_hasta   DATE,
  documento_url   TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payroll_irpf_deductions_employee ON payroll_irpf_deductions(employee_id);
COMMENT ON TABLE payroll_irpf_deductions IS 'Deducciones IRPF declaradas por el empleado (BHU, alimentos, etc.)';


-- ---------------------------------------------------------------------------
-- 9. doctor_contracts — Contratos honorarios/arrendamiento para doctores
--    (Cubre modalidades NO-dependencia: honorarios, arrendamiento, empresa unipersonal)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS doctor_contracts (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id            UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  clinic_id            INTEGER REFERENCES clinic(id) ON DELETE RESTRICT,
  contract_type        contract_type_enum NOT NULL,
  calculation_type     calculation_type_enum NOT NULL DEFAULT 'porcentaje',
  base_salary          DECIMAL(12,2),
  hourly_rate          DECIMAL(10,2),
  percentage_rate      DECIMAL(5,2),
  percentage_threshold DECIMAL(12,2),
  percentage_basis     percentage_basis_enum NOT NULL DEFAULT 'sobre_cobrado',
  per_session_rate     DECIMAL(10,2),
  currency             CHAR(3) NOT NULL DEFAULT 'UYU',
  has_children         BOOLEAN NOT NULL DEFAULT false,
  valid_from           DATE NOT NULL,
  valid_until          DATE,
  is_active            BOOLEAN NOT NULL DEFAULT true,
  notes                TEXT,
  created_at           TIMESTAMPTZ DEFAULT now(),
  created_by           UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_doctor_contracts_doctor ON doctor_contracts(doctor_id);
CREATE INDEX IF NOT EXISTS idx_doctor_contracts_active ON doctor_contracts(is_active);
COMMENT ON TABLE doctor_contracts IS 'Contratos de compensación para doctores (honorarios, arrendamiento, empresa unipersonal)';


-- ---------------------------------------------------------------------------
-- 10. payroll_periods — Períodos mensuales de nómina
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payroll_periods (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id            INTEGER REFERENCES clinic(id) ON DELETE RESTRICT,
  period_year          INTEGER NOT NULL,
  period_month         INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  status               payroll_period_status_enum NOT NULL DEFAULT 'draft',
  total_gross          DECIMAL(14,2),
  total_net            DECIMAL(14,2),
  total_employer_cost  DECIMAL(14,2),
  entries_count        INTEGER DEFAULT 0,
  honorarios_count     INTEGER DEFAULT 0,
  total_honorarios     DECIMAL(14,2),
  generated_at         TIMESTAMPTZ,
  approved_at          TIMESTAMPTZ,
  paid_at              TIMESTAMPTZ,
  closed_at            TIMESTAMPTZ,
  generated_by         UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_by          UUID REFERENCES users(id) ON DELETE SET NULL,
  closed_by            UUID REFERENCES users(id) ON DELETE SET NULL,
  notes                TEXT,
  created_at           TIMESTAMPTZ DEFAULT now(),
  UNIQUE (clinic_id, period_year, period_month)
);

CREATE INDEX IF NOT EXISTS idx_payroll_periods_year_month ON payroll_periods(period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_payroll_periods_status     ON payroll_periods(status);
COMMENT ON TABLE payroll_periods IS 'Períodos mensuales de liquidación de nómina';


-- ---------------------------------------------------------------------------
-- 11. payroll_entries — Liquidación individual por doctor / período
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payroll_entries (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_period_id       UUID NOT NULL REFERENCES payroll_periods(id) ON DELETE CASCADE,
  doctor_id               UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  doctor_contract_id      UUID REFERENCES doctor_contracts(id) ON DELETE SET NULL,
  payroll_employment_id   UUID REFERENCES payroll_employments(id) ON DELETE SET NULL,
  contract_type           contract_type_enum,
  calculation_type        calculation_type_enum,
  clinic_id               INTEGER REFERENCES clinic(id) ON DELETE SET NULL,

  -- Actividad del período
  sessions_count            INTEGER NOT NULL DEFAULT 0,
  hours_worked              DECIMAL(6,2) NOT NULL DEFAULT 0,
  hours_extra_habiles       DECIMAL(5,2),
  hours_extra_feriados      DECIMAL(5,2),
  absence_days              DECIMAL(5,2),
  services_revenue_billed   DECIMAL(12,2) NOT NULL DEFAULT 0,
  services_revenue_listed   DECIMAL(12,2) NOT NULL DEFAULT 0,

  -- Cálculo bruto
  base_amount               DECIMAL(12,2) NOT NULL DEFAULT 0,
  variable_amount           DECIMAL(12,2) NOT NULL DEFAULT 0,
  extra_hours_amount        DECIMAL(10,2),
  gross_salary              DECIMAL(12,2) NOT NULL DEFAULT 0,

  -- Deducciones empleado
  bps_employee              DECIMAL(10,2) NOT NULL DEFAULT 0,
  fonasa_employee           DECIMAL(10,2) NOT NULL DEFAULT 0,
  fonasa_family_situation   fonasa_family_situation_enum,
  fonasa_rate               DECIMAL(5,4),
  frl_employee              DECIMAL(10,2),
  irpf_withholding          DECIMAL(10,2) NOT NULL DEFAULT 0,
  other_deductions          DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_deductions          DECIMAL(10,2) NOT NULL DEFAULT 0,
  net_salary                DECIMAL(12,2) NOT NULL DEFAULT 0,

  -- Costo patronal
  bps_employer              DECIMAL(10,2) NOT NULL DEFAULT 0,
  fonasa_employer           DECIMAL(10,2) NOT NULL DEFAULT 0,
  frl_employer              DECIMAL(10,2),
  fgcl_employer             DECIMAL(10,2),
  bse_employer              DECIMAL(10,2),
  ccm_employer              DECIMAL(10,2),
  aguinaldo_provision       DECIMAL(10,2) NOT NULL DEFAULT 0,
  vacation_provision        DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_employer_cost       DECIMAL(12,2) NOT NULL DEFAULT 0,

  -- Meta
  currency                  CHAR(3) NOT NULL DEFAULT 'UYU',
  exchange_rate             DECIMAL(8,4) NOT NULL DEFAULT 1,
  status                    payroll_entry_status_enum NOT NULL DEFAULT 'draft',
  notes                     TEXT,
  calculated_at             TIMESTAMPTZ,
  created_at                TIMESTAMPTZ DEFAULT now(),

  UNIQUE (payroll_period_id, doctor_id)
);

CREATE INDEX IF NOT EXISTS idx_payroll_entries_period ON payroll_entries(payroll_period_id);
CREATE INDEX IF NOT EXISTS idx_payroll_entries_doctor ON payroll_entries(doctor_id);
COMMENT ON TABLE payroll_entries IS 'Liquidación individual de cada doctor/empleado por período mensual';


-- ---------------------------------------------------------------------------
-- 12. payroll_session_assignments — Sesiones incluidas en una liquidación
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payroll_session_assignments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_entry_id  UUID NOT NULL REFERENCES payroll_entries(id) ON DELETE CASCADE,
  session_id        INTEGER,      -- → patient_sessions.sesion_id (nullable si appointment sin sesión)
  appointment_id    UUID,         -- → appointments.id
  session_date      DATE NOT NULL,
  doctor_id         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  clinic_id         INTEGER REFERENCES clinic(id) ON DELETE SET NULL,
  service_names     TEXT,         -- nombres de servicios concatenados (desnormalizado para performance)
  revenue_billed    DECIMAL(10,2) NOT NULL DEFAULT 0,
  revenue_listed    DECIMAL(10,2) NOT NULL DEFAULT 0,
  hours_billed      DECIMAL(4,2) NOT NULL DEFAULT 0,
  is_included       BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_session_assignments_entry  ON payroll_session_assignments(payroll_entry_id);
CREATE INDEX IF NOT EXISTS idx_session_assignments_doctor ON payroll_session_assignments(doctor_id);
COMMENT ON TABLE payroll_session_assignments IS 'Sesiones asignadas a una liquidación (puede excluirse manualmente)';


-- ---------------------------------------------------------------------------
-- 13. payroll_manual_adjustments — Ajustes manuales (bonos, adelantos, etc.)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payroll_manual_adjustments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_entry_id  UUID NOT NULL REFERENCES payroll_entries(id) ON DELETE CASCADE,
  description       VARCHAR(255) NOT NULL,
  amount            DECIMAL(10,2) NOT NULL,
  adjustment_type   adjustment_type_enum NOT NULL,
  category          adjustment_category_enum NOT NULL DEFAULT 'otro',
  created_at        TIMESTAMPTZ DEFAULT now(),
  created_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by_name   VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_manual_adjustments_entry ON payroll_manual_adjustments(payroll_entry_id);
COMMENT ON TABLE payroll_manual_adjustments IS 'Ajustes manuales sobre una liquidación (bonos, adelantos, correcciones)';


-- ---------------------------------------------------------------------------
-- 14. payroll_novedades — Novedades del período (ausencias, horas extra, etc.)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payroll_novedades (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employment_id   UUID NOT NULL REFERENCES payroll_employments(id) ON DELETE CASCADE,
  period_year     INTEGER NOT NULL,
  period_month    INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  tipo            novedad_type_enum NOT NULL,
  cantidad        DECIMAL(6,2) NOT NULL DEFAULT 1,
  descripcion     TEXT,
  fecha_desde     DATE,
  fecha_hasta     DATE,
  aprobado_por    VARCHAR(100),
  created_at      TIMESTAMPTZ DEFAULT now(),
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_payroll_novedades_employment ON payroll_novedades(employment_id);
CREATE INDEX IF NOT EXISTS idx_payroll_novedades_period     ON payroll_novedades(period_year, period_month);
COMMENT ON TABLE payroll_novedades IS 'Novedades de nómina por empleado y período (ausencias, horas extra, licencias)';


-- ---------------------------------------------------------------------------
-- 15. payroll_honorarios — Liquidación de honorarios profesionales
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payroll_honorarios (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_period_id   UUID NOT NULL REFERENCES payroll_periods(id) ON DELETE CASCADE,
  doctor_id           UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  doctor_rut          VARCHAR(20),
  modalidad           honorarios_modalidad_enum NOT NULL DEFAULT 'honorarios',
  clinic_id           INTEGER REFERENCES clinic(id) ON DELETE SET NULL,
  produccion_base     DECIMAL(12,2) NOT NULL DEFAULT 0,
  porcentaje          DECIMAL(5,2) NOT NULL DEFAULT 0,
  descuentos          DECIMAL(10,2) NOT NULL DEFAULT 0,
  bruto               DECIMAL(12,2) NOT NULL DEFAULT 0,
  iva                 DECIMAL(10,2) NOT NULL DEFAULT 0,
  retenciones         DECIMAL(10,2) NOT NULL DEFAULT 0,
  liquido             DECIMAL(12,2) NOT NULL DEFAULT 0,
  factura_numero      VARCHAR(50),
  factura_fecha       DATE,
  factura_url         TEXT,
  estado              honorarios_estado_enum NOT NULL DEFAULT 'pendiente',
  fecha_pago          DATE,
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  UNIQUE (payroll_period_id, doctor_id)
);

CREATE INDEX IF NOT EXISTS idx_payroll_honorarios_period ON payroll_honorarios(payroll_period_id);
CREATE INDEX IF NOT EXISTS idx_payroll_honorarios_doctor ON payroll_honorarios(doctor_id);
COMMENT ON TABLE payroll_honorarios IS 'Liquidación de honorarios para profesionales no dependientes';


-- ---------------------------------------------------------------------------
-- FUNCIÓN: updated_at trigger genérico
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION payroll_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_payroll_employees_updated_at ON payroll_employees;
CREATE TRIGGER trg_payroll_employees_updated_at
  BEFORE UPDATE ON payroll_employees
  FOR EACH ROW EXECUTE FUNCTION payroll_set_updated_at();


COMMIT;
