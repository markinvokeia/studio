-- ─────────────────────────────────────────────────────────────────────────────
-- 013_clinic_fiscal_fields.sql
--
-- Datos fiscales / patronales de la empresa, necesarios para que TODOS los
-- reportes de nómina (BPS, DGI/IRPF, MTSS, banco, recibo) salgan completos sin
-- integrarse con sistemas externos. El RUT ya existe en `clinic`; aquí se
-- agregan el resto de los identificadores requeridos por los organismos.
-- Editable desde /config/clinics. Idempotente.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE IF EXISTS public.clinic
  ADD COLUMN IF NOT EXISTS razon_social      VARCHAR(200),  -- Denominación legal de la empresa
  ADD COLUMN IF NOT EXISTS domicilio_fiscal  TEXT,          -- Domicilio fiscal declarado
  ADD COLUMN IF NOT EXISTS bps_empresa_nro   VARCHAR(20),   -- Nº de empresa / contribuyente BPS
  ADD COLUMN IF NOT EXISTS bps_grupo         VARCHAR(20),   -- Grupo de aportación BPS
  ADD COLUMN IF NOT EXISTS bps_subgrupo      VARCHAR(20),   -- Subgrupo de aportación BPS
  ADD COLUMN IF NOT EXISTS bse_nro           VARCHAR(30),   -- Nº de póliza BSE (accidentes de trabajo)
  ADD COLUMN IF NOT EXISTS mtss_planilla_nro VARCHAR(30),   -- Nº de planilla de trabajo MTSS
  ADD COLUMN IF NOT EXISTS banco_empresa     VARCHAR(80),   -- Banco de la cuenta a debitar (pago de sueldos)
  ADD COLUMN IF NOT EXISTS cuenta_empresa    VARCHAR(30);   -- Nº de cuenta a debitar

COMMENT ON COLUMN public.clinic.razon_social      IS 'Denominación legal de la empresa (reportes nómina)';
COMMENT ON COLUMN public.clinic.bps_empresa_nro   IS 'Nº de empresa/contribuyente BPS';
COMMENT ON COLUMN public.clinic.bps_grupo         IS 'Grupo de aportación BPS';
COMMENT ON COLUMN public.clinic.bps_subgrupo      IS 'Subgrupo de aportación BPS';
COMMENT ON COLUMN public.clinic.bse_nro           IS 'Nº de póliza BSE (accidentes de trabajo)';
COMMENT ON COLUMN public.clinic.mtss_planilla_nro IS 'Nº de planilla de trabajo MTSS';
COMMENT ON COLUMN public.clinic.cuenta_empresa    IS 'Cuenta a debitar para el pago de sueldos';
