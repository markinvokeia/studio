-- =============================================================================
-- MÓDULO DE NÓMINAS — InvokeIA Studio
-- Script: 002_seed_payroll_dev.sql
-- Descripción: Datos de prueba para el módulo de nóminas usando los doctores
--              reales del sistema InvokeIA.
-- Autor: InvokeIA
-- Fecha: 2026-04-30
--
-- PRE-REQUISITOS:
--   1. Ejecutar 001_create_payroll_tables.sql antes de este script.
--   2. La única clínica existente se obtiene automáticamente de la tabla `clinic`.
--      Verificar: SELECT id, name FROM clinic;
--   3. Este script es IDEMPOTENTE: usa INSERT ... ON CONFLICT DO NOTHING.
--
-- DOCTORES INCLUIDOS (users.id reales del sistema):
--   Pedro Suárez      — e4d19d69-30df-4497-a99f-b7e206c24af1  → honorarios %
--   Susel Romero      — b26e9bc4-824e-4dfd-876d-f96f23c7c808  → arrendamiento %
--   Jose L Perales    — 1893cd70-f5d7-4143-8310-5e327f3ab6e5  → honorarios fijo
--   Dr. Romano Roses  — 1e467ab4-c677-4c6b-b65d-0bcd7c842add  → arrendamiento %
--   Dr Manuel Vilano  — 57233abc-341a-4a90-bf7d-21c2d589ee0e  → empleado fijo+%
--   Jean Molina       — 7f03e1e2-2638-4fde-860d-07b6a6c56306  → empleado fijo
--   Dulce Viltre      — e4780813-afd4-43ce-a8ff-ed9f3fc8e269  → empleada fijo
--   Dra. Ana López    — eab92215-052d-42cd-bcd2-1baf5b21e9ee  → empleada fijo+%
--   Murse Ruiz        — 23edf804-24dc-4d63-944a-dfffbe5d3cbf  → empleado fijo
-- =============================================================================


BEGIN;

DO $$ BEGIN
  RAISE NOTICE '=== PAYROLL SEED: Iniciando carga de datos de prueba ===';
END $$;

-- ===========================================================================
-- SECCIÓN 1: payroll_settings — Tasas Uruguay 2026
-- ===========================================================================

INSERT INTO payroll_settings (id, setting_key, setting_value, description) VALUES
  (gen_random_uuid(), 'montepio_employee_rate',     '0.15',    'Montepío BPS empleado (jubilación)'),
  (gen_random_uuid(), 'bps_employer_rate',          '0.075',   'BPS patronal jubilatorio'),
  (gen_random_uuid(), 'bps_employee_rate',          '0.15',    'BPS empleado jubilatorio (alias montepio)'),
  (gen_random_uuid(), 'bps_salary_cap_uyu',         '272564',  'Tope salarial BPS mensual (UYU 2026)'),
  (gen_random_uuid(), 'fonasa_employer_rate',       '0.05',    'FONASA patronal'),
  (gen_random_uuid(), 'fonasa_annual_cap_uyu',      '1000000', 'Tope anual FONASA empleado'),
  (gen_random_uuid(), 'fonasa_table',
    '[
      {"situation":"sin_conyuge_sin_hijos","until_2_5_bpc":0.03,"above_2_5_bpc":0.045},
      {"situation":"con_hijos","until_2_5_bpc":0.06,"above_2_5_bpc":0.09},
      {"situation":"con_conyuge","until_2_5_bpc":0.045,"above_2_5_bpc":0.06},
      {"situation":"con_conyuge_e_hijos","until_2_5_bpc":0.075,"above_2_5_bpc":0.105}
    ]',
    'Tabla FONASA empleado por situación familiar y umbral BPC'),
  (gen_random_uuid(), 'frl_employee_rate',          '0.00125', 'FRL obrero (Fondo de Reconversión Laboral)'),
  (gen_random_uuid(), 'frl_employer_rate',          '0.001',   'FRL patronal'),
  (gen_random_uuid(), 'fgcl_employer_rate',         '0.00025', 'FGCL patronal (Fondo de Garantía de Créditos Laborales)'),
  (gen_random_uuid(), 'bse_employer_rate',          '0.003',   'BSE accidentes de trabajo (tasa estimada — varía por actividad)'),
  (gen_random_uuid(), 'bpc_value_uyu',              '6600',    'Valor BPC 2026 (Unidad de actualización IRPF)'),
  (gen_random_uuid(), 'cpe_value_uyu',              '6693',    'CPE 2026 (Complemento cuota mutual FONASA)'),
  (gen_random_uuid(), 'irpf_brackets',
    '[
      {"from":0,    "to":84,   "rate":0},
      {"from":84,   "to":120,  "rate":0.10},
      {"from":120,  "to":180,  "rate":0.15},
      {"from":180,  "to":600,  "rate":0.24},
      {"from":600,  "to":900,  "rate":0.25},
      {"from":900,  "to":1320, "rate":0.27},
      {"from":1320, "to":2400, "rate":0.31},
      {"from":2400, "to":99999,"rate":0.36}
    ]',
    'Franjas IRPF 2026 (en BPC)'),
  (gen_random_uuid(), 'vacation_days_per_year',     '20',      'Días de vacaciones anuales mínimas'),
  (gen_random_uuid(), 'default_currency',           '"UYU"',   'Moneda por defecto del módulo'),
  (gen_random_uuid(), 'min_salary_national',        '24000',   'Salario mínimo nacional UYU 2026 (estimado)')
ON CONFLICT (setting_key) DO NOTHING;

-- ===========================================================================
-- SECCIÓN 2: payroll_categories
-- ===========================================================================

INSERT INTO payroll_categories (id, codigo, nombre, subgrupo, descripcion, salario_minimo_uyu, vigente_desde) VALUES
  ('a1000001-0000-0000-0000-000000000001'::UUID, 'G15-01', 'Odontólogo General',        '01', 'Odontólogo con título habilitante',        52000.00, '2025-01-01'),
  ('a1000001-0000-0000-0000-000000000002'::UUID, 'G15-02', 'Especialista Odontológico', '01', 'Especialista con posgrado reconocido',     68000.00, '2025-01-01'),
  ('a1000001-0000-0000-0000-000000000003'::UUID, 'G15-10', 'Asistente Dental',          '02', 'Auxiliar clínico odontológico',             34000.00, '2025-01-01'),
  ('a1000001-0000-0000-0000-000000000004'::UUID, 'G15-11', 'Recepcionista / Secretaria','03', 'Personal administrativo de atención',      28500.00, '2025-01-01'),
  ('a1000001-0000-0000-0000-000000000005'::UUID, 'G15-20', 'Auxiliar de Servicios',     '04', 'Limpieza y servicios generales',            24000.00, '2025-01-01')
ON CONFLICT DO NOTHING;

-- ===========================================================================
-- SECCIÓN 3: payroll_concepts
-- ===========================================================================

INSERT INTO payroll_concepts (id, codigo, nombre, tipo, grava_bps, grava_irpf, activo) VALUES
  ('b2000001-0000-0000-0000-000000000001'::UUID, '001', 'Sueldo básico',         'haber',       true,  true,  true),
  ('b2000001-0000-0000-0000-000000000002'::UUID, '002', 'Productividad',         'haber',       true,  true,  true),
  ('b2000001-0000-0000-0000-000000000003'::UUID, '003', 'Horas extra hábiles',   'haber',       true,  true,  true),
  ('b2000001-0000-0000-0000-000000000004'::UUID, '004', 'Horas extra feriados',  'haber',       true,  true,  true),
  ('b2000001-0000-0000-0000-000000000005'::UUID, '010', 'Montepío BPS',          'descuento',   false, false, true),
  ('b2000001-0000-0000-0000-000000000006'::UUID, '011', 'FONASA empleado',       'descuento',   false, false, true),
  ('b2000001-0000-0000-0000-000000000007'::UUID, '012', 'FRL obrero',            'descuento',   false, false, true),
  ('b2000001-0000-0000-0000-000000000008'::UUID, '013', 'IRPF retenido',         'descuento',   false, false, true),
  ('b2000001-0000-0000-0000-000000000009'::UUID, '020', 'Provisión aguinaldo',   'provision',   true,  false, true),
  ('b2000001-0000-0000-0000-000000000010'::UUID, '021', 'Provisión vacacional',  'provision',   false, false, true),
  ('b2000001-0000-0000-0000-000000000011'::UUID, '050', 'Horas trabajadas',      'informativo', false, false, true),
  ('b2000001-0000-0000-0000-000000000012'::UUID, '051', 'Sesiones realizadas',   'informativo', false, false, true)
ON CONFLICT DO NOTHING;

-- ===========================================================================
-- SECCIÓN 4: payroll_work_calendar (clinic_id = 1)
-- ===========================================================================

INSERT INTO payroll_work_calendar (id, clinic_id, fecha, tipo, descripcion) VALUES
  ('c3000001-0000-0000-0000-000000000001'::UUID, 1, '2026-01-01', 'feriado_no_laborable', 'Año Nuevo'),
  ('c3000001-0000-0000-0000-000000000002'::UUID, 1, '2026-01-06', 'feriado_comun',        'Reyes'),
  ('c3000001-0000-0000-0000-000000000003'::UUID, 1, '2026-02-16', 'feriado_comun',        'Carnaval — Lunes'),
  ('c3000001-0000-0000-0000-000000000004'::UUID, 1, '2026-02-17', 'feriado_comun',        'Carnaval — Martes'),
  ('c3000001-0000-0000-0000-000000000005'::UUID, 1, '2026-04-02', 'feriado_no_laborable', 'Jueves Santo'),
  ('c3000001-0000-0000-0000-000000000006'::UUID, 1, '2026-04-03', 'feriado_no_laborable', 'Viernes Santo'),
  ('c3000001-0000-0000-0000-000000000007'::UUID, 1, '2026-05-01', 'feriado_no_laborable', 'Día del Trabajador'),
  ('c3000001-0000-0000-0000-000000000008'::UUID, 1, '2026-05-18', 'feriado_comun',        'Batalla de Las Piedras'),
  ('c3000001-0000-0000-0000-000000000009'::UUID, 1, '2026-06-19', 'feriado_no_laborable', 'Día de Artigas'),
  ('c3000001-0000-0000-0000-000000000010'::UUID, 1, '2026-07-18', 'feriado_no_laborable', 'Jura de la Constitución'),
  ('c3000001-0000-0000-0000-000000000011'::UUID, 1, '2026-08-25', 'feriado_no_laborable', 'Declaratoria de Independencia'),
  ('c3000001-0000-0000-0000-000000000012'::UUID, 1, '2026-10-12', 'feriado_comun',        'Día de la Raza'),
  ('c3000001-0000-0000-0000-000000000013'::UUID, 1, '2026-11-02', 'feriado_comun',        'Día de los Difuntos'),
  ('c3000001-0000-0000-0000-000000000014'::UUID, 1, '2026-12-25', 'feriado_no_laborable', 'Navidad')
ON CONFLICT DO NOTHING;

-- ===========================================================================
-- SECCIÓN 5: payroll_employees (clinic_id = 1)
-- ===========================================================================

INSERT INTO payroll_employees (
  id, user_id, clinic_id,
  cedula, nombres, apellidos, fecha_nacimiento, sexo, estado_civil,
  telefono, email, banco, cuenta_banco, numero_bps, fecha_ingreso, activo
)
SELECT
  emp.id::UUID, emp.user_id::UUID, 1,
  emp.cedula, emp.nombres, emp.apellidos, emp.fecha_nacimiento::DATE,
  emp.sexo, emp.estado_civil, emp.telefono, emp.email, emp.banco,
  emp.cuenta_banco, emp.numero_bps, emp.fecha_ingreso::DATE, emp.activo
FROM (VALUES
  ('d4000001-0000-0000-0000-000000000001', '7f03e1e2-2638-4fde-860d-07b6a6c56306', '12345600', 'Jean', 'Molina', '1988-05-20', 'M', 'soltero', '+598093326570', 'jeanmolina@gmail.com', 'BROU', '001234560', '71234560', '2024-03-01', true),
  ('d4000001-0000-0000-0000-000000000002', 'e4780813-afd4-43ce-a8ff-ed9f3fc8e269', '69037654', 'Dulce', 'Viltre', '1990-11-08', 'F', 'casado', '+59897502666', 'dmviltre@gmail.com', 'ITAU', '009876540', '89037654', '2023-07-01', true),
  ('d4000001-0000-0000-0000-000000000003', '23edf804-24dc-4d63-944a-dfffbe5d3cbf', 'DOC00300', 'Murse', 'Ruiz', '1985-03-15', 'M', 'casado', '59833333333', 'enfermero@example.com', 'BROU', '007654300', '83333300', '2024-01-15', true),
  ('d4000001-0000-0000-0000-000000000004', '57233abc-341a-4a90-bf7d-21c2d589ee0e', '98765001', 'Manuel', 'Vilano', '1979-07-22', 'M', 'casado', '+59869854', 'mark@email.test', 'BROU', '005555001', '97654001', '2022-06-01', true),
  ('d4000001-0000-0000-0000-000000000005', 'eab92215-052d-42cd-bcd2-1baf5b21e9ee', '22222200', 'Ana', 'López', '1983-09-14', 'F', 'casado', '59822222222', 'medico@example.com', 'BROU', '002222200', '82222200', '2023-01-10', true)
) AS emp(id, user_id, cedula, nombres, apellidos, fecha_nacimiento, sexo, estado_civil, telefono, email, banco, cuenta_banco, numero_bps, fecha_ingreso, activo)
ON CONFLICT DO NOTHING;

-- ===========================================================================
-- SECCIÓN 6: payroll_employments
-- ===========================================================================

INSERT INTO payroll_employments (
  id, employee_id, clinic_id, tipo_contrato, category_id, fecha_inicio,
  jornada_horas_semanales, modalidad_jornada, sueldo_base, productividad_porcentaje,
  productividad_base, tipo_aporte_bps, is_active
)
SELECT
  emp.id::UUID, emp.employee_id::UUID, 1, emp.tipo_contrato::contract_type_enum,
  emp.category_id::UUID, emp.fecha_inicio::DATE, emp.horas_sem,
  emp.modalidad::modalidad_jornada_enum, emp.sueldo_base, emp.prod_pct,
  emp.prod_base::percentage_basis_enum, emp.aporte_bps::tipo_aporte_bps_enum, emp.is_active
FROM (VALUES
  ('e5000001-0000-0000-0000-000000000001', 'd4000001-0000-0000-0000-000000000001', 'dependencia', 'a1000001-0000-0000-0000-000000000001', '2024-03-01', 44, 'mensual', 52000, 0, 'sobre_cobrado', 'industria_comercio', true),
  ('e5000001-0000-0000-0000-000000000002', 'd4000001-0000-0000-0000-000000000002', 'dependencia', 'a1000001-0000-0000-0000-000000000003', '2023-07-01', 44, 'mensual', 34000, 0, 'sobre_cobrado', 'industria_comercio', true),
  ('e5000001-0000-0000-0000-000000000003', 'd4000001-0000-0000-0000-000000000003', 'dependencia', 'a1000001-0000-0000-0000-000000000003', '2024-01-15', 44, 'mensual', 34000, 0, 'sobre_cobrado', 'industria_comercio', true),
  ('e5000001-0000-0000-0000-000000000004', 'd4000001-0000-0000-0000-000000000004', 'dependencia', 'a1000001-0000-0000-0000-000000000001', '2022-06-01', 44, 'mensual', 55000, 30, 'sobre_cobrado', 'industria_comercio', true),
  ('e5000001-0000-0000-0000-000000000005', 'd4000001-0000-0000-0000-000000000005', 'dependencia', 'a1000001-0000-0000-0000-000000000002', '2023-01-10', 44, 'mensual', 68000, 25, 'sobre_cobrado', 'industria_comercio', true)
) AS emp(id, employee_id, tipo_contrato, category_id, fecha_inicio, horas_sem, modalidad, sueldo_base, prod_pct, prod_base, aporte_bps, is_active)
ON CONFLICT DO NOTHING;

-- ===========================================================================
-- SECCIÓN 7: payroll_family_charges
-- ===========================================================================

INSERT INTO payroll_family_charges (id, employee_id, tipo, nombres, apellidos, vigente_desde) VALUES
  ('f6000001-0000-0000-0000-000000000001'::UUID, 'd4000001-0000-0000-0000-000000000002'::UUID, 'hijo',    'Lucía',  'Viltre',    '2020-01-01'),
  ('f6000001-0000-0000-0000-000000000002'::UUID, 'd4000001-0000-0000-0000-000000000004'::UUID, 'conyuge', 'María',  'Vilano',    '2010-05-15'),
  ('f6000001-0000-0000-0000-000000000003'::UUID, 'd4000001-0000-0000-0000-000000000004'::UUID, 'hijo',    'Tomás',  'Vilano',    '2015-03-20'),
  ('f6000001-0000-0000-0000-000000000004'::UUID, 'd4000001-0000-0000-0000-000000000005'::UUID, 'conyuge', 'Carlos', 'González',  '2012-08-10'),
  ('f6000001-0000-0000-0000-000000000005'::UUID, 'd4000001-0000-0000-0000-000000000005'::UUID, 'hijo',    'Sofía',  'López',     '2018-11-30')
ON CONFLICT DO NOTHING;

-- ===========================================================================
-- SECCIÓN 8: doctor_contracts
-- ===========================================================================

INSERT INTO doctor_contracts (
  id, doctor_id, clinic_id, contract_type, calculation_type,
  percentage_rate, percentage_basis, base_salary, currency, valid_from, is_active
)
SELECT
  dc.id::UUID, dc.doctor_id::UUID, 1, dc.contract_type::contract_type_enum,
  dc.calc_type::calculation_type_enum, dc.pct_rate, dc.pct_basis::percentage_basis_enum,
  dc.base_salary, dc.currency, dc.valid_from::DATE, dc.is_active
FROM (VALUES
  ('f7000001-0000-0000-0000-000000000001', 'e4d19d69-30df-4497-a99f-b7e206c24af1', 'honorarios',    'porcentaje', 40, 'sobre_cobrado', NULL, 'UYU', '2025-01-01', true),
  ('f7000001-0000-0000-0000-000000000002', 'b26e9bc4-824e-4dfd-876d-f96f23c7c808', 'arrendamiento', 'porcentaje', 35, 'sobre_cobrado', NULL, 'UYU', '2025-01-01', true),
  ('f7000001-0000-0000-0000-000000000003', '1893cd70-f5d7-4143-8310-5e327f3ab6e5', 'honorarios',    'fijo',       NULL, 'sobre_cobrado', 180000, 'UYU', '2025-06-01', true),
  ('f7000001-0000-0000-0000-000000000004', '1e467ab4-c677-4c6b-b65d-0bcd7c842add', 'arrendamiento', 'porcentaje', 45, 'sobre_cobrado', NULL, 'UYU', '2025-03-01', true)
) AS dc(id, doctor_id, contract_type, calc_type, pct_rate, pct_basis, base_salary, currency, valid_from, is_active)
ON CONFLICT DO NOTHING;

-- ===========================================================================
-- SECCIÓN 9: payroll_periods
-- ===========================================================================

INSERT INTO payroll_periods (
  id, clinic_id, period_year, period_month, status, total_gross, total_net,
  total_employer_cost, entries_count, honorarios_count, total_honorarios,
  generated_at, approved_at, notes
)
SELECT
  p.id::UUID, 1, p.period_year, p.period_month, p.status::payroll_period_status_enum,
  p.total_gross, p.total_net, p.total_employer_cost, p.entries_count, p.honorarios_count,
  p.total_honorarios, p.generated_at::TIMESTAMPTZ, p.approved_at::TIMESTAMPTZ, p.notes
FROM (VALUES
  ('f8000001-0000-0000-0000-000000000001', 2026, 3, 'approved', 618000, 487340, 726480, 5, 4, 486000, '2026-03-31 18:00:00', '2026-04-02 09:00:00', 'Marzo 2026 — cerrado'),
  ('f8000001-0000-0000-0000-000000000002', 2026, 4, 'draft', NULL, NULL, NULL, 0, 0, NULL, NULL, NULL, 'Abril 2026 — en preparación')
) AS p(id, period_year, period_month, status, total_gross, total_net, total_employer_cost, entries_count, honorarios_count, total_honorarios, generated_at, approved_at, notes)
ON CONFLICT DO NOTHING;

-- ===========================================================================
-- SECCIÓN 10: payroll_entries
-- ===========================================================================

INSERT INTO payroll_entries (
  id, payroll_period_id, doctor_id, payroll_employment_id, contract_type, calculation_type,
  clinic_id, sessions_count, hours_worked, services_revenue_billed, services_revenue_listed,
  base_amount, variable_amount, gross_salary, bps_employee, fonasa_employee,
  fonasa_family_situation, fonasa_rate, frl_employee, irpf_withholding, other_deductions,
  total_deductions, net_salary, bps_employer, fonasa_employer, frl_employer, fgcl_employer,
  bse_employer, ccm_employer, aguinaldo_provision, vacation_provision, total_employer_cost,
  currency, exchange_rate, status, calculated_at
)
SELECT
  e.id::UUID, 'f8000001-0000-0000-0000-000000000001'::UUID, e.doctor_id::UUID,
  e.employment_id::UUID, e.contract_type::contract_type_enum, e.calc_type::calculation_type_enum,
  1, e.sessions, e.hours, e.rev_billed, e.rev_listed, e.base_amt, e.var_amt, e.gross,
  e.bps_emp, e.fonasa_emp, e.fonasa_sit::fonasa_family_situation_enum, e.fonasa_rate,
  e.frl_emp, e.irpf, e.other_ded, e.total_ded, e.net, e.bps_pat, e.fonasa_pat, e.frl_pat,
  e.fgcl_pat, e.bse_pat, e.ccm_pat, e.aguinaldo, e.vacation, e.total_cost, 'UYU', 1,
  'approved'::payroll_entry_status_enum, '2026-03-31 18:00:00'::TIMESTAMPTZ
FROM (VALUES
  ('f9000001-0000-0000-0000-000000000001', '7f03e1e2-2638-4fde-860d-07b6a6c56306', 'e5000001-0000-0000-0000-000000000001', 'dependencia', 'fijo', 68, 136, 112000, 112000, 52000, 0, 52000, 7800, 1560, 'sin_conyuge_sin_hijos', 0.03, 65, 800, 0, 10225, 41775, 3900, 2600, 52, 13, 156, 800, 4333, 1728, 62782),
  ('f9000001-0000-0000-0000-000000000002', 'e4780813-afd4-43ce-a8ff-ed9f3fc8e269', 'e5000001-0000-0000-0000-000000000002', 'dependencia', 'fijo', 45, 90, 48000, 48000, 34000, 0, 34000, 5100, 2040, 'con_hijos', 0.06, 43, 0, 0, 7183, 26817, 2550, 1700, 34, 9, 102, 2040, 2833, 1130, 41068),
  ('f9000001-0000-0000-0000-000000000003', '23edf804-24dc-4d63-944a-dfffbe5d3cbf', 'e5000001-0000-0000-0000-000000000003', 'dependencia', 'fijo', 52, 104, 61000, 61000, 34000, 0, 34000, 5100, 1020, 'sin_conyuge_sin_hijos', 0.03, 43, 0, 0, 6163, 27837, 2550, 1700, 34, 9, 102, 0, 2833, 1130, 38358),
  ('f9000001-0000-0000-0000-000000000004', '57233abc-341a-4a90-bf7d-21c2d589ee0e', 'e5000001-0000-0000-0000-000000000004', 'dependencia', 'fijo_porcentaje', 90, 180, 210000, 210000, 55000, 63000, 118000, 17700, 10620, 'con_conyuge_e_hijos', 0.09, 148, 8500, 0, 36968, 81032, 8850, 5900, 118, 30, 354, 10620, 9833, 3923, 139628),
  ('f9000001-0000-0000-0000-000000000005', 'eab92215-052d-42cd-bcd2-1baf5b21e9ee', 'e5000001-0000-0000-0000-000000000005', 'dependencia', 'fijo_porcentaje', 110, 220, 265000, 265000, 68000, 66250, 134250, 20138, 12083, 'con_conyuge_e_hijos', 0.09, 168, 12400, 0, 44789, 89461, 10069, 6713, 134, 34, 403, 12083, 11188, 4464, 159097)
) AS e(id, doctor_id, employment_id, contract_type, calc_type, sessions, hours, rev_billed, rev_listed, base_amt, var_amt, gross, bps_emp, fonasa_emp, fonasa_sit, fonasa_rate, frl_emp, irpf, other_ded, total_ded, net, bps_pat, fonasa_pat, frl_pat, fgcl_pat, bse_pat, ccm_pat, aguinaldo, vacation, total_cost)
ON CONFLICT DO NOTHING;

-- ===========================================================================
-- SECCIÓN 11: payroll_honorarios
-- ===========================================================================

INSERT INTO payroll_honorarios (
  id, payroll_period_id, doctor_id, doctor_rut, modalidad, clinic_id,
  produccion_base, porcentaje, descuentos, bruto, iva, retenciones, liquido, estado, created_at
)
SELECT
  h.id::UUID, 'f8000001-0000-0000-0000-000000000001'::UUID, h.doctor_id::UUID,
  h.doctor_rut, h.modalidad::honorarios_modalidad_enum, 1, h.prod_base, h.porcentaje,
  h.descuentos, h.bruto, h.iva, h.retenciones, h.liquido, h.estado::honorarios_estado_enum,
  h.created_at::TIMESTAMPTZ
FROM (VALUES
  ('b0200001-0000-0000-0000-000000000001', 'e4d19d69-30df-4497-a99f-b7e206c24af1', NULL, 'honorarios', 280000, 40, 0, 112000, 11200, 0, 123200, 'autorizada', '2026-03-31 18:00:00'),
  ('b0200001-0000-0000-0000-000000000002', 'b26e9bc4-824e-4dfd-876d-f96f23c7c808', NULL, 'empresa_unipersonal', 320000, 35, 0, 112000, 0, 0, 112000, 'pagada', '2026-03-31 18:00:00'),
  ('b0200001-0000-0000-0000-000000000003', '1893cd70-f5d7-4143-8310-5e327f3ab6e5', NULL, 'honorarios', 180000, 100, 0, 180000, 18000, 0, 198000, 'autorizada', '2026-03-31 18:00:00'),
  ('b0200001-0000-0000-0000-000000000004', '1e467ab4-c677-4c6b-b65d-0bcd7c842add', NULL, 'sociedad', 200000, 45, 0, 90000, 0, 0, 90000, 'pendiente', '2026-03-31 18:00:00')
) AS h(id, doctor_id, doctor_rut, modalidad, prod_base, porcentaje, descuentos, bruto, iva, retenciones, liquido, estado, created_at)
ON CONFLICT DO NOTHING;

-- ===========================================================================
-- SECCIÓN 12: payroll_manual_adjustments
-- ===========================================================================

INSERT INTO payroll_manual_adjustments (id, payroll_entry_id, description, amount, adjustment_type, category) VALUES
  ('f1000001-0000-0000-0000-000000000001'::UUID, 'f9000001-0000-0000-0000-000000000001'::UUID, 'Bono por desempeño Q1', 5000, 'addition', 'bono'),
  ('f1000001-0000-0000-0000-000000000002'::UUID, 'f9000001-0000-0000-0000-000000000002'::UUID, 'Adelanto de sueldo — 15/03', 10000, 'deduction', 'adelanto'),
  ('f1000001-0000-0000-0000-000000000003'::UUID, 'f9000001-0000-0000-0000-000000000003'::UUID, 'Descuento ausencia injustificada 2 días', 2267, 'deduction', 'descuento')
ON CONFLICT DO NOTHING;

-- ===========================================================================
-- SECCIÓN 13: payroll_novedades
-- ===========================================================================

INSERT INTO payroll_novedades (id, employment_id, period_year, period_month, tipo, cantidad, descripcion, fecha_desde, fecha_hasta) VALUES
  ('f2000001-0000-0000-0000-000000000001'::UUID, 'e5000001-0000-0000-0000-000000000003'::UUID, 2026, 3, 'ausencia_injustificada', 2, 'Inasistencia sin aviso', '2026-03-12', '2026-03-13'),
  ('f2000001-0000-0000-0000-000000000002'::UUID, 'e5000001-0000-0000-0000-000000000001'::UUID, 2026, 3, 'hora_extra_habil', 6, 'Horas extra semana 3 de marzo', '2026-03-16', '2026-03-20'),
  ('f2000001-0000-0000-0000-000000000003'::UUID, 'e5000001-0000-0000-0000-000000000004'::UUID, 2026, 3, 'certificado_medico', 3, 'DISSE — gripe', '2026-03-04', '2026-03-06'),
  ('f2000001-0000-0000-0000-000000000004'::UUID, 'e5000001-0000-0000-0000-000000000005'::UUID, 2026, 3, 'adelanto', 150, 'Adelanto de sueldo solicitado', NULL, NULL)
ON CONFLICT DO NOTHING;

-- ===========================================================================
-- SECCIÓN 14: payroll_session_assignments
-- ===========================================================================

INSERT INTO payroll_session_assignments (
  id, payroll_entry_id, session_date, doctor_id, clinic_id,
  revenue_billed, revenue_listed, hours_billed, is_included, service_names
)
SELECT
  s.id::UUID, 'f9000001-0000-0000-0000-000000000001'::UUID, s.session_date::DATE,
  '7f03e1e2-2638-4fde-860d-07b6a6c56306'::UUID, 1, s.rev_billed, s.rev_listed,
  s.hours, s.included, s.services
FROM (VALUES
  ('a3000001-0000-0000-0000-000000000001', '2026-03-03', 3200, 3500, 1.0, true,  'Consulta + Rx'),
  ('a3000001-0000-0000-0000-000000000002', '2026-03-04', 4800, 5200, 1.5, true,  'Ortodoncia control'),
  ('a3000001-0000-0000-0000-000000000003', '2026-03-10', 6500, 7000, 2.0, true,  'Endodoncia'),
  ('a3000001-0000-0000-0000-000000000004', '2026-03-17', 2100, 2200, 0.5, true,  'Consulta'),
  ('a3000001-0000-0000-0000-000000000005', '2026-03-24', 5800, 6500, 1.5, true,  'Blanqueamiento'),
  ('a3000001-0000-0000-0000-000000000006', '2026-03-27', 3500, 3800, 1.0, false, 'Consulta (excluida — error de registro)')
) AS s(id, session_date, rev_billed, rev_listed, hours, included, services)
ON CONFLICT DO NOTHING;


-- ===========================================================================
-- VERIFICACIÓN FINAL
-- ===========================================================================

DO $$ DECLARE
  r RECORD;
BEGIN
  RAISE NOTICE '=== VERIFICACIÓN DE DATOS INSERTADOS ===';
  FOR r IN
    SELECT 'payroll_settings'         AS tabla, COUNT(*) AS filas FROM payroll_settings         UNION ALL
    SELECT 'payroll_categories',                 COUNT(*) FROM payroll_categories         UNION ALL
    SELECT 'payroll_concepts',                   COUNT(*) FROM payroll_concepts           UNION ALL
    SELECT 'payroll_work_calendar',              COUNT(*) FROM payroll_work_calendar      UNION ALL
    SELECT 'payroll_employees',                  COUNT(*) FROM payroll_employees          UNION ALL
    SELECT 'payroll_employments',                COUNT(*) FROM payroll_employments        UNION ALL
    SELECT 'payroll_family_charges',             COUNT(*) FROM payroll_family_charges     UNION ALL
    SELECT 'doctor_contracts',                   COUNT(*) FROM doctor_contracts           UNION ALL
    SELECT 'payroll_periods',                    COUNT(*) FROM payroll_periods            UNION ALL
    SELECT 'payroll_entries',                    COUNT(*) FROM payroll_entries            UNION ALL
    SELECT 'payroll_honorarios',                 COUNT(*) FROM payroll_honorarios         UNION ALL
    SELECT 'payroll_manual_adjustments',         COUNT(*) FROM payroll_manual_adjustments UNION ALL
    SELECT 'payroll_novedades',                  COUNT(*) FROM payroll_novedades          UNION ALL
    SELECT 'payroll_session_assignments',        COUNT(*) FROM payroll_session_assignments
  LOOP
    RAISE NOTICE '  %-35s → % filas', r.tabla, r.filas;
  END LOOP;
  RAISE NOTICE '=== SEED COMPLETADO ===';
END $$;

COMMIT;