-- ─────────────────────────────────────────────────────────────────────────────
-- 014_honorarios_settings.sql
--
-- Parámetros de cálculo para honorarios de profesionales que facturan
-- (no dependientes): IVA, retención de IRPF por servicios personales y tope
-- mínimo de retención. Son valores POR DEFECTO y configurables desde
-- payroll_settings; ajustar según la normativa vigente DGI.
-- Idempotente.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO payroll_settings (id, setting_key, setting_value, description) VALUES
  (gen_random_uuid(), 'honorarios_iva_rate',            '0.22', 'Tasa de IVA aplicada al honorario facturado'),
  (gen_random_uuid(), 'honorarios_irpf_servicios_rate', '0.07', 'Retención de IRPF por servicios personales sobre el bruto'),
  (gen_random_uuid(), 'honorarios_retencion_iva_rate',  '0',    'Proporción del IVA que se retiene (0 = no se retiene IVA)'),
  (gen_random_uuid(), 'honorarios_retencion_min_uyu',   '0',    'Bruto mínimo a partir del cual se retiene IRPF (tope mínimo)')
ON CONFLICT (setting_key) DO NOTHING;
