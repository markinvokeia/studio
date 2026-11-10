-- =============================================================================
-- dev-seed.sql — Puebla DEV con una clínica de demo coherente.
--
-- Pensado para correr DESPUÉS de dev-cleanup.sql. Se pega entero en el Query
-- Tool de pgAdmin y se ejecuta con F5. Corre en una sola transacción: si algo
-- falla no queda nada a medias (ejecutar ROLLBACK; antes de reintentar).
-- Para probar sin aplicar, cambiar el COMMIT del final por ROLLBACK.
--
-- Qué crea (todo marcado con external_id / internal_id = 'seed:…'):
--   * Catálogo: ~30 servicios (odontología general, endodoncia, ortodoncia,
--     cirugía/implantes, periodoncia y medicina estética), categorías de ingreso,
--     padecimientos y medicamentos.
--   * Personal: 6 doctores (con calendario, disponibilidad semanal y servicios)
--     y 2 recepcionistas. Sin contraseña: no pueden iniciar sesión.
--   * Pacientes: 140 adultos + 15 menores a cargo de un adulto.
--   * Agenda: 90 días hacia atrás y 21 hacia adelante, en todos los estados.
--   * Por cada cita atendida: sesión clínica + tratamiento, y venta completa
--     presupuesto → orden → factura → pago, con su caja diaria y movimiento.
--   * Odontograma evolutivo (tabla sesiones), periodontogramas y sesiones
--     estéticas con capas y marcas sobre el mapa facial.
--   * Planes de tratamiento en borrador (presupuestos sin facturar).
--
-- Los triggers financieros quedan ACTIVOS (doc_no, estado de pago, saldos).
-- Se desactiva solo trigger_appointment_change (pg_notify de sincronización
-- con Google Calendar) para no disparar cientos de eventos.
-- =============================================================================

BEGIN;
SET LOCAL lock_timeout = '15s';
SELECT setseed(0.2026);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM users WHERE internal_id LIKE 'seed:%') THEN
    RAISE EXCEPTION 'La base ya tiene datos de seed: corré dev-cleanup.sql primero';
  END IF;
END $$;

ALTER TABLE appointments DISABLE TRIGGER trigger_appointment_change;

-- =============================================================================
-- Funciones auxiliares (pg_temp: desaparecen al cerrar la sesión)
-- =============================================================================
CREATE OR REPLACE FUNCTION pg_temp.pick(arr text[]) RETURNS text LANGUAGE sql VOLATILE AS
$$ SELECT arr[1 + floor(random() * array_length(arr, 1))::int] $$;

CREATE OR REPLACE FUNCTION pg_temp.rint(lo int, hi int) RETURNS int LANGUAGE sql VOLATILE AS
$$ SELECT lo + floor(random() * (hi - lo + 1))::int $$;

-- Cédula uruguaya con dígito verificador válido: 4.475.689-9
CREATE OR REPLACE FUNCTION pg_temp.ci_uy(n int) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  s text := lpad(n::text, 7, '0');
  w int[] := ARRAY[2, 9, 8, 7, 6, 3, 4];
  total int := 0;
BEGIN
  FOR i IN 1..7 LOOP total := total + substr(s, i, 1)::int * w[i]; END LOOP;
  RETURN substr(s, 1, 1) || '.' || substr(s, 2, 3) || '.' || substr(s, 5, 3) || '-' || ((10 - total % 10) % 10)::text;
END $$;

-- Número de documento con la secuencia real, pero con el año/mes del documento
CREATE OR REPLACE FUNCTION pg_temp.docno(t text, ts timestamp) RETURNS text LANGUAGE sql VOLATILE AS $$
  SELECT regexp_replace(public.generate_sequence_value(t::document_type_enum),
                        '\d{4}-\d{2}', to_char(ts, 'YYYY-MM'))
$$;

CREATE OR REPLACE FUNCTION pg_temp.slug(t text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT regexp_replace(translate(lower(t), 'áéíóúüñ', 'aeiouun'), '[^a-z0-9]+', '.', 'g')
$$;

-- =============================================================================
-- Contexto: sede, caja, roles, métodos de pago
-- =============================================================================
CREATE TEMP TABLE _ctx ON COMMIT DROP AS
SELECT
  (SELECT id FROM sedes WHERE is_active ORDER BY id LIMIT 1)                       AS sede_id,
  (SELECT id FROM roles WHERE name = 'medico')                                      AS role_doctor,
  (SELECT id FROM roles WHERE name = 'recepcionista')                               AS role_recep,
  (SELECT id FROM roles WHERE name = 'paciente')                                    AS role_patient,
  (SELECT id FROM users WHERE email = 'system@invokeia.com')                        AS system_id,
  (now() AT TIME ZONE 'America/Montevideo')::timestamp                              AS now_local;

DO $$
DECLARE c record;
BEGIN
  SELECT * INTO c FROM _ctx;
  IF c.sede_id IS NULL OR c.role_doctor IS NULL OR c.role_recep IS NULL OR c.role_patient IS NULL THEN
    RAISE EXCEPTION 'Falta configuración base (sede activa o roles medico/recepcionista/paciente)';
  END IF;
END $$;

-- Caja de la sede (se crea si no hay)
INSERT INTO cash_points (name, is_active, sede_id, created_at, updated_at)
SELECT 'Caja Recepción', true, sede_id, now(), now() FROM _ctx
WHERE NOT EXISTS (SELECT 1 FROM cash_points cp, _ctx c WHERE cp.sede_id = c.sede_id AND cp.is_active);

ALTER TABLE _ctx ADD COLUMN cash_point_id int;
UPDATE _ctx SET cash_point_id = (SELECT id FROM cash_points cp WHERE cp.sede_id = _ctx.sede_id AND cp.is_active ORDER BY id LIMIT 1);

CREATE TEMP TABLE _pm ON COMMIT DROP AS
SELECT id, name, code, is_cash_equivalent FROM payment_methods
WHERE is_active AND code IN ('CASH', 'DEBIT_CARD', 'CREDIT_CARD', 'BANK_TRANSFER', 'MERCADO_PAGO');

-- Calendarios activos de la sede, uno por doctor
CREATE TEMP TABLE _cal ON COMMIT DROP AS
SELECT row_number() OVER (ORDER BY cs.id) AS n, cs.id
FROM calendar_sources cs, _ctx c
WHERE cs.sede_id = c.sede_id AND coalesce(cs.is_active, true);

-- =============================================================================
-- Catálogos clínicos
-- =============================================================================
INSERT INTO catalogo_padecimientos (nombre, categoria, nivel_alerta) VALUES
  ('Hipertensión arterial', 'Cardiovascular', 2),
  ('Cardiopatía isquémica', 'Cardiovascular', 3),
  ('Arritmia cardíaca', 'Cardiovascular', 3),
  ('Portador de marcapasos', 'Cardiovascular', 3),
  ('Diabetes tipo 1', 'Endocrino', 3),
  ('Diabetes tipo 2', 'Endocrino', 2),
  ('Hipotiroidismo', 'Endocrino', 1),
  ('Asma', 'Respiratorio', 2),
  ('EPOC', 'Respiratorio', 2),
  ('Epilepsia', 'Neurológico', 3),
  ('Hepatitis B', 'Infeccioso', 3),
  ('Hepatitis C', 'Infeccioso', 3),
  ('VIH', 'Infeccioso', 3),
  ('Anticoagulación oral', 'Hematológico', 3),
  ('Hemofilia', 'Hematológico', 3),
  ('Insuficiencia renal crónica', 'Renal', 3),
  ('Osteoporosis con bifosfonatos', 'Osteomuscular', 3),
  ('Artritis reumatoidea', 'Osteomuscular', 1),
  ('Reflujo gastroesofágico', 'Digestivo', 1),
  ('Embarazo', 'Otros', 2),
  ('Trastorno de ansiedad', 'Psiquiátrico', 1),
  ('Bruxismo', 'Odontológico', 1);

INSERT INTO catalogo_medicamentos (nombre_generico, nombre_comercial) VALUES
  ('Amoxicilina 500 mg', 'Amoxidal'),
  ('Amoxicilina + ácido clavulánico 875/125 mg', 'Clavulin'),
  ('Clindamicina 300 mg', 'Dalacin C'),
  ('Azitromicina 500 mg', NULL),
  ('Metronidazol 500 mg', 'Flagyl'),
  ('Ibuprofeno 600 mg', 'Ibupirac'),
  ('Paracetamol 1 g', 'Zolben'),
  ('Diclofenac 50 mg', 'Voltaren'),
  ('Ketorolac 10 mg', NULL),
  ('Dexametasona 4 mg', 'Decadron'),
  ('Clorhexidina 0,12 % (colutorio)', NULL),
  ('Lidocaína 2 % con epinefrina', 'Xylocaína'),
  ('Articaína 4 % con epinefrina', 'Septanest'),
  ('Omeprazol 20 mg', NULL),
  ('Enalapril 10 mg', NULL),
  ('Losartán 50 mg', 'Cozaar'),
  ('Metformina 850 mg', 'Glucophage'),
  ('Levotiroxina 100 mcg', 'T4'),
  ('Warfarina 5 mg', 'Coumadin'),
  ('Ácido acetilsalicílico 100 mg', 'Aspirina'),
  ('Atorvastatina 20 mg', NULL),
  ('Salbutamol inhalador', 'Ventolin'),
  ('Loratadina 10 mg', 'Clarityne'),
  ('Alprazolam 0,5 mg', 'Xanax');

-- Categorías de ingreso para servicios
INSERT INTO miscellaneous_categories (code, name, description, category_type, is_active, external_id)
SELECT v.code, v.name, v.descr, 'income', true, 'seed:cat:' || v.code
FROM (VALUES
  ('SRV_GENERAL',  'Odontología general',  'Consultas, profilaxis y operatoria'),
  ('SRV_ENDO',     'Endodoncia',           'Tratamientos de conducto y pernos'),
  ('SRV_ORTO',     'Ortodoncia',           'Aparatología y controles'),
  ('SRV_CIRUGIA',  'Cirugía e implantes',  'Extracciones, implantes y prótesis fija'),
  ('SRV_PERIO',    'Periodoncia',          'Evaluación, raspados y mantenimiento'),
  ('SRV_ESTETICA', 'Medicina estética',    'Toxina, rellenos, bioestimulación')
) AS v(code, name, descr)
WHERE NOT EXISTS (SELECT 1 FROM miscellaneous_categories mc WHERE mc.code = v.code);

-- =============================================================================
-- Servicios
-- =============================================================================
CREATE TEMP TABLE _svc (
  id int, code text, name text, specialty text, cat_code text, duration int, price numeric,
  color text, tooth boolean, kid boolean, aesthetic boolean, unit_code text, tool text,
  product text, depth text, technique text, proc text, plan text, online boolean
) ON COMMIT DROP;

INSERT INTO _svc (code, name, specialty, cat_code, duration, price, color, tooth, kid, aesthetic, unit_code, tool, product, depth, technique, proc, plan, online) VALUES
 -- general
 ('CONSULTA',     'Consulta y diagnóstico',              'general', 'SRV_GENERAL', 30,  1500, '#3b82f6', false, true,  false, NULL, NULL, NULL, NULL, NULL, 'Examen clínico completo, revisión de tejidos blandos y diagnóstico.', 'Presupuestar el plan de tratamiento', true),
 ('PROFILAXIS',   'Limpieza y profilaxis',               'general', 'SRV_GENERAL', 45,  2800, '#22c55e', false, true,  false, NULL, NULL, NULL, NULL, NULL, 'Tartrectomía supragingival, pulido coronario y enseñanza de técnica de cepillado.', 'Control en 6 meses', true),
 ('RESINA',       'Restauración con resina',             'general', 'SRV_GENERAL', 45,  3900, '#0ea5e9', true,  false, false, NULL, NULL, NULL, NULL, NULL, 'Remoción de caries, aislamiento relativo y restauración con resina compuesta.', 'Controlar sensibilidad postoperatoria', false),
 ('SELLANTE',     'Sellante de fosas y fisuras',         'general', 'SRV_GENERAL', 30,  1400, '#14b8a6', true,  true,  false, NULL, NULL, NULL, NULL, NULL, 'Profilaxis, grabado ácido y colocación de sellante.', 'Control en 6 meses', false),
 ('FLUOR',        'Aplicación de flúor',                 'general', 'SRV_GENERAL', 20,   900, '#10b981', false, true,  false, NULL, NULL, NULL, NULL, NULL, 'Aplicación tópica de barniz de flúor.', 'Control en 6 meses', false),
 ('PEDIATRICA',   'Consulta odontopediátrica',           'general', 'SRV_GENERAL', 30,  1400, '#f59e0b', false, true,  false, NULL, NULL, NULL, NULL, NULL, 'Control odontopediátrico, índice de placa y refuerzo de higiene con los padres.', 'Control en 6 meses', true),
 ('BLANQUEAM',    'Blanqueamiento dental',               'general', 'SRV_GENERAL', 60,  9500, '#a855f7', false, false, false, NULL, NULL, NULL, NULL, NULL, 'Blanqueamiento en consultorio con peróxido de hidrógeno al 35 %, dos ciclos.', 'Evitar alimentos pigmentantes 48 h', true),
 ('RX_PERI',      'Radiografía periapical',              'general', 'SRV_GENERAL', 15,   700, '#64748b', true,  false, false, NULL, NULL, NULL, NULL, NULL, 'Radiografía periapical digital.', NULL, false),
 -- endodoncia
 ('ENDO_UNI',     'Endodoncia unirradicular',            'endodoncia', 'SRV_ENDO', 60,  9800, '#ef4444', true,  false, false, NULL, NULL, NULL, NULL, NULL, 'Apertura, conductometría, preparación biomecánica y obturación del conducto.', 'Restauración definitiva en 15 días', false),
 ('ENDO_MULTI',   'Endodoncia multirradicular',          'endodoncia', 'SRV_ENDO', 90, 14500, '#dc2626', true,  false, false, NULL, NULL, NULL, NULL, NULL, 'Tratamiento de conductos multirradicular con localizador apical y obturación termoplastificada.', 'Perno y corona', false),
 ('RETRATAM',     'Retratamiento endodóntico',           'endodoncia', 'SRV_ENDO', 90, 16000, '#b91c1c', true,  false, false, NULL, NULL, NULL, NULL, NULL, 'Desobturación, repermeabilización y nueva obturación de conductos.', 'Control radiográfico en 6 meses', false),
 ('PERNO',        'Perno de fibra de vidrio',            'endodoncia', 'SRV_ENDO', 45,  4800, '#f97316', true,  false, false, NULL, NULL, NULL, NULL, NULL, 'Desobturación parcial y cementado de perno de fibra.', 'Tallado para corona', false),
 -- ortodoncia
 ('ORTO_CONS',    'Consulta de ortodoncia',              'ortodoncia', 'SRV_ORTO', 30,  1500, '#8b5cf6', false, true,  false, NULL, NULL, NULL, NULL, NULL, 'Evaluación ortodóncica, fotos y modelos de estudio.', 'Presentar plan de ortodoncia', true),
 ('BRACKETS',     'Instalación de brackets metálicos',   'ortodoncia', 'SRV_ORTO', 90, 38000, '#7c3aed', false, false, false, NULL, NULL, NULL, NULL, NULL, 'Cementado de brackets en ambas arcadas y arco inicial NiTi 0.014.', 'Control en 4 semanas', false),
 ('ORTO_CTRL',    'Control mensual de ortodoncia',       'ortodoncia', 'SRV_ORTO', 30,  2600, '#6d28d9', false, true,  false, NULL, NULL, NULL, NULL, NULL, 'Control de aparatología y cambio de ligaduras.', 'Próximo control en 4 semanas', false),
 ('RETENEDOR',    'Retenedor fijo',                      'ortodoncia', 'SRV_ORTO', 45,  5500, '#5b21b6', false, false, false, NULL, NULL, NULL, NULL, NULL, 'Cementado de retenedor lingual de canino a canino.', 'Control en 3 meses', false),
 -- cirugía e implantes
 ('EXODONCIA',    'Extracción simple',                   'cirugia', 'SRV_CIRUGIA', 30,  3200, '#78716c', true,  false, false, NULL, NULL, NULL, NULL, NULL, 'Anestesia infiltrativa, sindesmotomía y extracción. Hemostasia con gasa.', 'Control a los 7 días', false),
 ('TERCER_MOLAR', 'Extracción de tercer molar',          'cirugia', 'SRV_CIRUGIA', 60,  7800, '#57534e', true,  false, false, NULL, NULL, NULL, NULL, NULL, 'Colgajo, osteotomía, odontosección y extracción. Sutura con seda 3-0.', 'Retiro de puntos a los 7 días', false),
 ('IMPLANTE',     'Implante dental',                     'cirugia', 'SRV_CIRUGIA', 90, 42000, '#0f766e', true,  false, false, NULL, NULL, NULL, NULL, NULL, 'Colocación de implante 4.1 x 10 mm con torque de inserción de 35 Ncm.', 'Corona sobre implante en 3 meses', false),
 ('CORONA_IMPL',  'Corona sobre implante',               'cirugia', 'SRV_CIRUGIA', 60, 26000, '#115e59', true,  false, false, NULL, NULL, NULL, NULL, NULL, 'Toma de impresión con transfer y prueba de corona metal-porcelana.', 'Control en 6 meses', false),
 ('CORONA',       'Corona de porcelana',                 'cirugia', 'SRV_CIRUGIA', 60, 21000, '#0d9488', true,  false, false, NULL, NULL, NULL, NULL, NULL, 'Tallado, impresión y cementado de corona de porcelana.', 'Control en 6 meses', false),
 -- periodoncia
 ('PERIO_EVAL',   'Evaluación periodontal',              'periodoncia', 'SRV_PERIO', 45, 2200, '#ec4899', false, false, false, NULL, NULL, NULL, NULL, NULL, 'Periodontograma completo e índice de placa.', 'Raspado por cuadrantes', false),
 ('RASPADO',      'Raspado y alisado radicular (cuadrante)', 'periodoncia', 'SRV_PERIO', 60, 4200, '#db2777', false, false, false, NULL, NULL, NULL, NULL, NULL, 'Raspado y alisado radicular con ultrasonido y curetas Gracey.', 'Reevaluación en 6 semanas', false),
 ('PERIO_MANT',   'Mantenimiento periodontal',           'periodoncia', 'SRV_PERIO', 45, 3200, '#be185d', false, false, false, NULL, NULL, NULL, NULL, NULL, 'Sondaje de control, raspado de zonas activas y pulido.', 'Mantenimiento en 4 meses', false),
 -- medicina estética
 ('EST_CONS',     'Consulta estética',                   'estetica', 'SRV_ESTETICA', 30,  1800, '#f472b6', false, false, false, NULL, NULL, NULL, NULL, NULL, 'Evaluación facial, fotos y plan de tratamiento.', 'Agendar tratamiento', true),
 ('TOXINA',       'Toxina botulínica tercio superior',   'estetica', 'SRV_ESTETICA', 30, 14000, '#e879f9', false, false, true,  'unit', 'point', 'Toxina botulínica tipo A 100 U', 'intramuscular', 'bolus',        'Aplicación de toxina botulínica en frente, entrecejo y patas de gallo.', 'Control a los 15 días', true),
 ('LABIOS',       'Relleno de labios con ácido hialurónico', 'estetica', 'SRV_ESTETICA', 45, 16500, '#d946ef', false, false, true, 'ml', 'point', 'Ácido hialurónico 1 ml (labios)', 'submucosal', 'linear threading', 'Relleno de labios con ácido hialurónico reticulado.', 'Control al mes', true),
 ('SKINBOOSTER',  'Skinbooster',                         'estetica', 'SRV_ESTETICA', 45, 11000, '#c026d3', false, false, true,  'ml', 'area',  'Skinbooster con ácido hialurónico y vitaminas', 'intradermal', 'microdroplets', 'Microinyecciones de skinbooster en mejillas.', 'Segunda sesión al mes', true),
 ('HILOS',        'Hilos tensores PDO',                  'estetica', 'SRV_ESTETICA', 60, 22000, '#a21caf', false, false, true,  'unit', 'line',  'Hilos PDO espiculados 19G', 'subdermal', 'cannula',     'Colocación de hilos tensores en tercio medio y línea mandibular.', 'Control a los 15 días', false),
 ('PEELING',      'Peeling químico',                     'estetica', 'SRV_ESTETICA', 45,  6500, '#86198f', false, false, true,  NULL,   'area',  'Ácido glicólico 35 %', 'superficial', 'brush', 'Peeling químico superficial con ácido glicólico.', 'Fotoprotección estricta 2 semanas', false);

INSERT INTO service_catalog (name, description, category, category_id, duration_minutes, price, is_active, created_at,
                             currency, is_sales, color, service_type, specialty, external_id, bookable_online, unit_id, is_lab)
SELECT s.name, s.proc, mc.name, mc.id, s.duration, s.price, true, now() - interval '200 days',
       'UYU', true, s.color, 'single', s.specialty, 'seed:svc:' || s.code, s.online,
       (SELECT id FROM measurement_units mu WHERE mu.code = s.unit_code), false
FROM _svc s LEFT JOIN miscellaneous_categories mc ON mc.code = s.cat_code;

UPDATE _svc s SET id = sc.id FROM service_catalog sc WHERE sc.external_id = 'seed:svc:' || s.code;

INSERT INTO service_aesthetic_config (service_id, unit_id, marking_tool, default_quantity, default_depth, default_technique,
                                      follow_up_days, follow_up_label, aftercare)
SELECT s.id, (SELECT id FROM measurement_units mu WHERE mu.code = s.unit_code), s.tool,
       CASE s.code WHEN 'TOXINA' THEN 4 WHEN 'LABIOS' THEN 0.5 WHEN 'SKINBOOSTER' THEN 1 WHEN 'HILOS' THEN 1 ELSE NULL END,
       s.depth, s.technique,
       CASE s.code WHEN 'TOXINA' THEN 15 WHEN 'HILOS' THEN 15 ELSE 30 END,
       'Control',
       'No masajear la zona ni hacer ejercicio intenso durante 24 h.'
FROM _svc s WHERE s.aesthetic;

-- =============================================================================
-- Personal
-- =============================================================================
CREATE TEMP TABLE _doc (
  n int, id uuid DEFAULT gen_random_uuid(), name text, email text, sex sex_type, specialty text,
  color text, days smallint[], t_start time, t_end time, cal_id bigint
) ON COMMIT DROP;

INSERT INTO _doc (n, name, email, sex, specialty, color, days, t_start, t_end) VALUES
 (1, 'Dra. Valentina Sosa',    'valentina.sosa@example.com',    'female', 'general',     '#3b82f6', '{1,2,3,4,5}', '09:00', '17:00'),
 (2, 'Dr. Martín Rodríguez',   'martin.rodriguez@example.com',  'male',   'endodoncia',  '#ef4444', '{1,3,5}',     '10:00', '18:00'),
 (3, 'Dra. Lucía Fernández',   'lucia.fernandez@example.com',   'female', 'ortodoncia',  '#8b5cf6', '{2,4,6}',     '09:00', '14:00'),
 (4, 'Dr. Ignacio Varela',     'ignacio.varela@example.com',    'male',   'cirugia',     '#0f766e', '{2,4}',       '14:00', '20:00'),
 (5, 'Dra. Sofía Benítez',     'sofia.benitez@example.com',     'female', 'estetica',    '#e879f9', '{3,5,6}',     '10:00', '16:00'),
 (6, 'Dr. Pablo Ferreira',     'pablo.ferreira@example.com',    'male',   'periodoncia', '#ec4899', '{1,4}',       '08:00', '13:00');

UPDATE _doc d SET cal_id = c.id FROM _cal c WHERE c.n = d.n;

CREATE TEMP TABLE _recep (n int, id uuid DEFAULT gen_random_uuid(), name text, email text, sex sex_type) ON COMMIT DROP;
INSERT INTO _recep (n, name, email, sex) VALUES
 (1, 'Camila Rivero',    'camila.rivero@example.com',    'female'),
 (2, 'Florencia Acosta', 'florencia.acosta@example.com', 'female');

INSERT INTO users (id, name, email, phone_number, internal_id, is_active, color, sex, created_at, created_by,
                   identity_document, identity_document_type, active_sede_id, can_browse_calendars, calendar_source_id)
SELECT d.id, d.name, d.email, '+5982' || (6000000 + d.n * 1111)::text, 'seed:doc:' || d.n, true, d.color, d.sex,
       now() - interval '400 days', c.system_id, pg_temp.ci_uy(2100000 + d.n * 73519), 'cedula_uy', c.sede_id, true, d.cal_id
FROM _doc d, _ctx c;

INSERT INTO users (id, name, email, phone_number, internal_id, is_active, sex, created_at, created_by,
                   identity_document, identity_document_type, active_sede_id, can_browse_calendars)
SELECT r.id, r.name, r.email, '+5982' || (6100000 + r.n * 1111)::text, 'seed:recep:' || r.n, true, r.sex,
       now() - interval '400 days', c.system_id, pg_temp.ci_uy(3200000 + r.n * 81233), 'cedula_uy', c.sede_id, true
FROM _recep r, _ctx c;

INSERT INTO user_roles (user_id, role_id, is_active) SELECT d.id, c.role_doctor, true FROM _doc d, _ctx c;
INSERT INTO user_roles (user_id, role_id, is_active) SELECT r.id, c.role_recep, true FROM _recep r, _ctx c;

INSERT INTO calendar_users (calendar_source_id, user_id) SELECT cal_id, id FROM _doc WHERE cal_id IS NOT NULL;

INSERT INTO availability_rules (user_id, recurrence, start_time, end_time, start_date, days_of_week)
SELECT id, 'weekly', t_start, t_end, current_date - 200, days FROM _doc;

INSERT INTO user_services (user_id, service_id, enabled)
SELECT d.id, s.id, true FROM _doc d JOIN _svc s ON s.specialty = d.specialty
UNION
SELECT d.id, s.id, true FROM _doc d JOIN _svc s ON s.code IN ('CONSULTA', 'RX_PERI') WHERE d.specialty <> 'estetica';

-- =============================================================================
-- Pacientes
-- =============================================================================
CREATE TEMP TABLE _pat (
  n int, id uuid DEFAULT gen_random_uuid(), first text, last1 text, last2 text, sex sex_type,
  birthday date, kid boolean DEFAULT false, responsible uuid
) ON COMMIT DROP;

DO $$
DECLARE
  f_names text[] := ARRAY['María','Lucía','Sofía','Valentina','Camila','Florencia','Agustina','Martina','Carolina','Natalia',
                          'Gabriela','Paula','Andrea','Laura','Mariana','Silvia','Ana','Claudia','Verónica','Fernanda',
                          'Julieta','Victoria','Rosario','Cecilia','Lorena','Graciela','Patricia','Inés','Josefina','Micaela'];
  m_names text[] := ARRAY['Juan','Martín','Diego','Santiago','Nicolás','Federico','Pablo','Gonzalo','Matías','Sebastián',
                          'Andrés','Fernando','Rodrigo','Alejandro','Gustavo','Marcelo','Álvaro','Leonardo','Emiliano','Joaquín',
                          'Felipe','Bruno','Ignacio','Tomás','Carlos','Jorge','Ricardo','Daniel','Hernán','Mauricio'];
  last_names text[] := ARRAY['Rodríguez','González','Fernández','Pérez','García','Martínez','López','Silva','Sosa','Suárez',
                             'Díaz','Pereira','Méndez','Núñez','Castro','Romero','Acosta','Olivera','Cabrera','Ferreira',
                             'Correa','Morales','Hernández','Álvarez','Ramos','Gómez','Benítez','Techera','Píriz','Barreto',
                             'Viera','Cardozo','Machado','Rivero','Vázquez','De León','Bentancur','Larrosa','Etchegaray','Sanguinetti'];
  is_f boolean;
  adult record;
BEGIN
  FOR i IN 1..140 LOOP
    is_f := random() < 0.55;
    INSERT INTO _pat (n, first, last1, last2, sex, birthday)
    VALUES (i,
            CASE WHEN is_f THEN pg_temp.pick(f_names) ELSE pg_temp.pick(m_names) END,
            pg_temp.pick(last_names),
            CASE WHEN random() < 0.6 THEN pg_temp.pick(last_names) END,
            CASE WHEN is_f THEN 'female'::sex_type ELSE 'male'::sex_type END,
            date '1948-01-01' + pg_temp.rint(0, 365 * 55));
  END LOOP;

  -- 15 menores a cargo de un adulto de 28 a 55 años (heredan su primer apellido)
  FOR i IN 141..155 LOOP
    SELECT * INTO adult FROM _pat
    WHERE NOT kid AND birthday BETWEEN current_date - interval '55 years' AND current_date - interval '28 years'
    ORDER BY random() LIMIT 1;
    is_f := random() < 0.5;
    INSERT INTO _pat (n, first, last1, last2, sex, birthday, kid, responsible)
    VALUES (i,
            CASE WHEN is_f THEN pg_temp.pick(f_names) ELSE pg_temp.pick(m_names) END,
            adult.last1, pg_temp.pick(last_names),
            CASE WHEN is_f THEN 'female'::sex_type ELSE 'male'::sex_type END,
            current_date - pg_temp.rint(365 * 4, 365 * 14), true, adult.id);
  END LOOP;
END $$;

INSERT INTO users (id, name, email, phone_number, internal_id, is_active, sex, birthday, created_at, created_by,
                   identity_document, identity_document_type, address, is_dependant, responsible_contact_id,
                   doctor_id, active_sede_id)
SELECT p.id,
       concat_ws(' ', p.first, p.last1, p.last2),
       CASE WHEN p.kid THEN NULL ELSE pg_temp.slug(p.first || ' ' || p.last1) || '.' || p.n || '@example.com' END,
       CASE WHEN p.kid THEN NULL ELSE '+5989' || lpad((1000000 + p.n * 48271 % 8999999)::text, 7, '0') END,
       'seed:pat:' || p.n,
       true, p.sex, p.birthday,
       now() - (pg_temp.rint(30, 700) || ' days')::interval,
       (SELECT id FROM _recep ORDER BY random() LIMIT 1),
       pg_temp.ci_uy(CASE WHEN p.kid THEN 5600000 ELSE 1500000 END + p.n * 29573),
       'cedula_uy',
       CASE WHEN p.kid THEN NULL
            ELSE pg_temp.pick(ARRAY['Av. 18 de Julio','Bulevar Artigas','Av. Rivera','Av. Italia','Av. Brasil',
                                    'Canelones','Colonia','Soriano','Ellauri','Benito Blanco','Av. Arocena','Luis A. de Herrera'])
                 || ' ' || pg_temp.rint(100, 3999) END,
       p.kid, p.responsible,
       (SELECT id FROM _doc WHERE specialty = 'general'),
       c.sede_id
FROM _pat p, _ctx c
ORDER BY p.n;   -- responsables (1..140) antes que los menores

INSERT INTO user_roles (user_id, role_id, is_active) SELECT p.id, c.role_patient, true FROM _pat p, _ctx c;

-- =============================================================================
-- Cajas: una por día hábil (cerradas en el pasado, abierta hoy)
-- =============================================================================
CREATE TEMP TABLE _cash (day date PRIMARY KEY, id int) ON COMMIT DROP;

DO $$
DECLARE
  c record;
  d date;
  v_id int;
  v_recep record;
  v_open timestamp;
BEGIN
  SELECT * INTO c FROM _ctx;
  FOR d IN SELECT g::date FROM generate_series(current_date - 90, current_date, interval '1 day') g LOOP
    CONTINUE WHEN extract(isodow FROM d) = 7;
    SELECT * INTO v_recep FROM _recep ORDER BY random() LIMIT 1;
    v_open := d + time '08:30';
    INSERT INTO cash_sessions (user_id, status, opened_at, closed_at, cash_point_id, opening_details, closing_details, created_by)
    VALUES (v_recep.id,
            CASE WHEN d < current_date THEN 'CLOSE' ELSE 'OPEN' END,
            v_open,
            CASE WHEN d < current_date THEN d + time '19:45' END,
            c.cash_point_id,
            json_build_object('currency', 'UYU', 'date_rate', 40.2,
                              'uyu', json_build_object('500', 2, '1000', 2, '2000', 3, 'total', 9000),
                              'opened_by', v_recep.name, 'opened_at', to_char(v_open, 'YYYY-MM-DD"T"HH24:MI:SS.000"Z"')),
            NULL,
            v_recep.id)
    RETURNING id INTO v_id;
    INSERT INTO cash_session_currencies (cash_session_id, currency, opening_amount, date_rate)
    VALUES (v_id, 'UYU', 9000, 1);
    INSERT INTO _cash VALUES (d, v_id);
  END LOOP;
END $$;

-- =============================================================================
-- Agenda + sesiones clínicas + ventas
-- =============================================================================
CREATE TEMP TABLE _done (                   -- citas atendidas, para odontograma/perio/estética
  appt_id int, patient_id uuid, doctor_id uuid, svc_code text, tooth int, ts timestamp,
  invoice_id int, status text
) ON COMMIT DROP;

DO $$
DECLARE
  c record;
  doc record;
  svc record;
  pat record;
  recep uuid;
  d date;
  slot timestamp;
  slot_end timestamp;
  n_target int;
  n_made int;
  r numeric;
  v_status text;
  v_cancel text;
  v_appt int;
  v_sesion bigint;
  v_quote int; v_qi int; v_order int; v_oi int; v_inv int; v_pay int;
  v_inv_doc text;
  v_tooth int;
  v_paid numeric;
  v_pm record;
  v_pay_ts timestamp;
  adult_teeth int[] := ARRAY[11,12,13,14,15,16,17,21,22,23,24,25,26,27,31,32,33,34,35,36,37,41,42,43,44,45,46,47];
  molars int[] := ARRAY[16,26,36,46,17,27,37,47];
  wisdom int[] := ARRAY[18,28,38,48];
  notes_pool text[] := ARRAY['Paciente colaborador.', 'Refiere sensibilidad al frío.', 'Buena higiene oral.',
                             'Higiene regular, se refuerza técnica de cepillado.', 'Sin complicaciones.',
                             'Se indica analgésico en caso de dolor.', 'Paciente ansioso, se trabaja con calma.', ''];
BEGIN
  SELECT * INTO c FROM _ctx;

  FOR d IN SELECT g::date FROM generate_series(current_date - 90, current_date + 21, interval '1 day') g LOOP
    CONTINUE WHEN extract(isodow FROM d) = 7;

    FOR doc IN SELECT * FROM _doc WHERE extract(isodow FROM d)::smallint = ANY(days) ORDER BY n LOOP
      -- carga del día: más llena en el pasado/próximos días que en el futuro lejano
      n_target := CASE WHEN d > current_date + 10 THEN pg_temp.rint(1, 4) ELSE pg_temp.rint(3, 7) END;
      n_made := 0;
      slot := d + doc.t_start + (pg_temp.rint(0, 2) * 15 || ' minutes')::interval;

      WHILE n_made < n_target LOOP
        -- servicio de la especialidad del doctor (la consulta inicial es la más frecuente)
        SELECT * INTO svc FROM _svc
        WHERE specialty = doc.specialty AND NOT (code = 'BRACKETS' AND random() < 0.7)
        ORDER BY CASE WHEN code IN ('CONSULTA','PROFILAXIS','ORTO_CTRL','EST_CONS','TOXINA','PERIO_MANT') THEN random() * 0.6 ELSE random() END
        LIMIT 1;

        slot_end := slot + (svc.duration || ' minutes')::interval;
        EXIT WHEN slot_end > d + doc.t_end;

        -- paciente: los menores solo van a odontología general / ortodoncia
        IF svc.code = 'PEDIATRICA' OR (doc.specialty IN ('general', 'ortodoncia') AND svc.kid AND random() < 0.25) THEN
          SELECT * INTO pat FROM _pat WHERE kid ORDER BY random() LIMIT 1;
        ELSE
          SELECT * INTO pat FROM _pat WHERE NOT kid ORDER BY random() LIMIT 1;
        END IF;

        -- estado según el momento
        r := random();
        v_cancel := NULL;
        IF slot_end <= c.now_local THEN
          v_status := CASE WHEN r < 0.72 THEN 'completed' WHEN r < 0.76 THEN 'attended_late'
                           WHEN r < 0.86 THEN 'no_show' ELSE 'cancelled' END;
        ELSIF slot <= c.now_local THEN
          v_status := CASE WHEN r < 0.6 THEN 'in_progress' ELSE 'arrived' END;
        ELSIF d = current_date THEN
          v_status := CASE WHEN r < 0.75 THEN 'confirmed' ELSE 'scheduled' END;
        ELSE
          v_status := CASE WHEN r < 0.08 THEN 'cancelled'
                           WHEN d <= current_date + 3 AND r < 0.6 THEN 'confirmed'
                           WHEN r < 0.25 THEN 'confirmed'
                           WHEN r < 0.28 THEN 'pending'
                           ELSE 'scheduled' END;
        END IF;
        IF v_status = 'cancelled' THEN
          v_cancel := pg_temp.pick(ARRAY['in_time','in_time','patient_request','reschedule','by_doctor','late']);
        END IF;

        v_tooth := CASE
          WHEN NOT svc.tooth THEN NULL
          WHEN svc.code = 'TERCER_MOLAR' THEN wisdom[1 + floor(random() * 4)::int]
          WHEN svc.code IN ('ENDO_MULTI', 'SELLANTE', 'IMPLANTE', 'CORONA_IMPL') THEN molars[1 + floor(random() * 8)::int]
          ELSE adult_teeth[1 + floor(random() * array_length(adult_teeth, 1))::int] END;

        recep := (SELECT id FROM _recep ORDER BY random() LIMIT 1);

        INSERT INTO appointments (patient_id, start_datetime, end_datetime, status, summary, description, notes,
                                  created_at, updated_at, assignee_id, calendar_source_id, cancellation_reason,
                                  external_id, created_by)
        VALUES (pat.id, slot, slot_end, v_status,
                concat_ws(' ', pat.first, pat.last1) || ' - ' || svc.name,
                format(E'Cita para: %s\n\nDoctor: %s\n\nServicios:\n%s\n\nNotas:\n',
                       concat_ws(' ', pat.first, pat.last1, pat.last2), doc.name, svc.name),
                CASE WHEN v_tooth IS NOT NULL THEN 'Pieza ' || v_tooth END,
                least(slot - (pg_temp.rint(1, 25) || ' days')::interval, c.now_local - interval '1 hour'),
                least(slot, c.now_local),
                doc.id, doc.cal_id, v_cancel,
                'seed:appt:' || to_char(slot, 'YYYYMMDDHH24MI') || ':' || doc.n,
                recep)
        RETURNING id INTO v_appt;

        INSERT INTO appointment_service_catalog (appointment_id, service_id) VALUES (v_appt, svc.id);

        -- ---------------------------------------------------------------
        -- Atendida: sesión clínica + venta
        -- ---------------------------------------------------------------
        IF v_status IN ('completed', 'attended_late', 'in_progress') THEN
          INSERT INTO sesiones_clinicas (paciente_id, doctor_id, fecha_sesion, procedimiento_realizado, plan_proxima_cita,
                                         diagnostico, notas_clinicas, appointment_id, pieza, external_id, created_by)
          VALUES (pat.id, doc.id, slot AT TIME ZONE 'America/Montevideo',
                  svc.proc || CASE WHEN v_tooth IS NOT NULL THEN ' Pieza ' || v_tooth || '.' ELSE '' END,
                  coalesce(svc.plan, ''),
                  CASE svc.specialty
                    WHEN 'endodoncia'  THEN pg_temp.pick(ARRAY['Pulpitis irreversible','Necrosis pulpar','Periodontitis apical crónica'])
                    WHEN 'periodoncia' THEN pg_temp.pick(ARRAY['Gingivitis asociada a placa','Periodontitis estadio II grado B','Periodontitis estadio III grado B'])
                    WHEN 'cirugia'     THEN pg_temp.pick(ARRAY['Resto radicular','Pieza no restaurable','Tercer molar semiincluido','Edentulismo parcial'])
                    WHEN 'general'     THEN CASE WHEN svc.code = 'RESINA' THEN 'Caries dentinaria' ELSE '' END
                    ELSE '' END,
                  pg_temp.pick(notes_pool),
                  v_appt, v_tooth::text,
                  'seed:sc:' || v_appt,
                  doc.id)
          RETURNING id INTO v_sesion;

          INSERT INTO tratamientos_sesion (sesion_id, numero_diente, descripcion_tratamiento, is_for_next_session, service_catalog_id, created_by)
          VALUES (v_sesion, v_tooth, svc.name, false, svc.id, doc.id);

          INSERT INTO _done VALUES (v_appt, pat.id, doc.id, svc.code, v_tooth, slot, NULL, v_status);

          -- Venta (algunos controles no se cobran)
          IF v_status <> 'in_progress' AND NOT (svc.code IN ('ORTO_CTRL', 'PERIO_MANT') AND random() < 0.15) THEN
            INSERT INTO quotes (user_id, total, status, billing_status, payment_status, created_at, updated_at, currency, is_sales,
                                doc_no, exchange_rate, external_id, doctor_id, gross_total, discount_amount, sede_id, created_by)
            VALUES (pat.id, svc.price, 'Confirmed', 'invoiced', 'not_paid', slot, slot_end, 'UYU', true,
                    pg_temp.docno('quote', slot), 1, 'seed:quote:' || v_appt, doc.id, svc.price, 0, c.sede_id, recep)
            RETURNING id INTO v_quote;

            INSERT INTO quote_items (quote_id, service_id, quantity, unit_price, total, tooth_number, gross_total, discount_amount, created_by)
            VALUES (v_quote, svc.id, 1, svc.price, svc.price, v_tooth, svc.price, 0, recep)
            RETURNING id INTO v_qi;

            INSERT INTO orders (quote_id, user_id, status, created_at, currency, is_sales, doc_no, gross_total, discount_amount)
            VALUES (v_quote, pat.id, 'Completed', slot_end, 'UYU', true, pg_temp.docno('order', slot), svc.price, 0)
            RETURNING id INTO v_order;

            INSERT INTO order_items (order_id, quote_item_id, status, scheduled_date, completed_date, invoiced_date, tooth_number, gross_total, discount_amount)
            VALUES (v_order, v_qi, 'completed', slot, slot_end, slot_end, v_tooth, svc.price, 0)
            RETURNING id INTO v_oi;

            v_inv_doc := pg_temp.docno('invoice', slot);
            INSERT INTO invoices (order_id, total, status, created_at, paid_amount, currency, is_sales, user_id, type,
                                  payment_state, due_date, doc_no, external_id, doctor_id, gross_total, discount_amount,
                                  sede_id, created_by)
            VALUES (v_order, svc.price, 'booked', slot_end, 0, 'UYU', true, pat.id, 'invoice',
                    'unpaid', (slot + interval '30 days')::date, v_inv_doc, 'seed:inv:' || v_appt, doc.id, svc.price, 0,
                    c.sede_id, recep)
            RETURNING id INTO v_inv;

            INSERT INTO invoice_items (invoice_id, order_item_id, quantity, unit_price, total, service_id, tooth_number, gross_total, discount_amount, created_by)
            VALUES (v_inv, v_oi, 1, svc.price, svc.price, svc.id, v_tooth, svc.price, 0, recep);

            UPDATE appointments SET quote_id = v_quote, invoice_id = v_inv WHERE id = v_appt;
            UPDATE sesiones_clinicas SET quote_id = v_quote, invoice_id = v_inv WHERE id = v_sesion;
            UPDATE _done SET invoice_id = v_inv WHERE appt_id = v_appt;

            -- Pago: 82 % total, 10 % parcial, 8 % queda debiendo (hoy siempre se paga)
            r := random();
            v_paid := CASE WHEN d = current_date OR r < 0.82 THEN svc.price
                           WHEN r < 0.92 THEN round(svc.price * 0.5, 0)
                           ELSE 0 END;
            IF v_paid > 0 THEN
              SELECT * INTO v_pm FROM _pm
              ORDER BY CASE code WHEN 'CASH' THEN random() * 0.45 WHEN 'DEBIT_CARD' THEN random() * 0.7 ELSE random() END
              LIMIT 1;
              v_pay_ts := slot_end + (pg_temp.rint(2, 20) || ' minutes')::interval;

              INSERT INTO payments (invoice_id, amount, method, created_at, payment_method_id, cash_session_id, currency, is_sales,
                                    invoice_currency, exchange_rate, converted_amount, user_id, doc_no, external_id, doctor_id, created_by)
              VALUES (v_inv, v_paid, v_pm.name, v_pay_ts, v_pm.id, (SELECT id FROM _cash WHERE day = d), 'UYU', true,
                      'UYU', 1, v_paid, pat.id, pg_temp.docno('payment', slot), 'seed:pay:' || v_appt, doc.id, recep)
              RETURNING id INTO v_pay;

              INSERT INTO cash_movements (cash_session_id, type, payment_method_id, amount, description, created_at, user_id,
                                          payment_id, currency, is_sales, is_trx, source_type, created_by)
              VALUES ((SELECT id FROM _cash WHERE day = d), 'INFLOW', v_pm.id, v_paid, 'Pago factura: ' || v_inv_doc, v_pay_ts, recep,
                      v_pay, 'UYU', true, true, 'payment', recep);
            END IF;
          END IF;
        END IF;

        n_made := n_made + 1;
        slot := slot_end + (pg_temp.rint(0, 2) * 15 || ' minutes')::interval;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

-- Cierre de cajas: totales calculados por tipo de método
UPDATE cash_session_currencies csc SET
  calculated_cash     = t.cash,
  calculated_card     = t.card,
  calculated_transfer = t.transfer,
  calculated_other    = t.other,
  declared_cash       = CASE WHEN cs.status = 'CLOSE' THEN csc.opening_amount + t.cash ELSE 0 END,
  cash_variance       = 0
FROM cash_sessions cs,
     LATERAL (
       SELECT coalesce(sum(p.amount) FILTER (WHERE pm.is_cash_equivalent), 0)                          AS cash,
              coalesce(sum(p.amount) FILTER (WHERE pm.code IN ('DEBIT_CARD', 'CREDIT_CARD')), 0)       AS card,
              coalesce(sum(p.amount) FILTER (WHERE pm.code = 'BANK_TRANSFER'), 0)                      AS transfer,
              coalesce(sum(p.amount) FILTER (WHERE NOT pm.is_cash_equivalent
                                               AND pm.code NOT IN ('DEBIT_CARD', 'CREDIT_CARD', 'BANK_TRANSFER')), 0) AS other
       FROM payments p JOIN payment_methods pm ON pm.id = p.payment_method_id
       WHERE p.cash_session_id = cs.id
     ) t
WHERE cs.id = csc.cash_session_id AND cs.id IN (SELECT id FROM _cash);

UPDATE cash_sessions cs SET closing_details = json_build_object(
         'uyu', json_build_object('total', csc.opening_amount + csc.calculated_cash),
         'usd', json_build_object()),
       bank_deposit_details = json_build_object('uyu', json_build_object(), 'usd', json_build_object())
FROM cash_session_currencies csc
WHERE csc.cash_session_id = cs.id AND cs.status = 'CLOSE' AND cs.id IN (SELECT id FROM _cash);

-- =============================================================================
-- Odontograma evolutivo (tabla sesiones): una entrada por cita dental atendida
-- =============================================================================
DO $$
DECLARE
  r record;
  v_state jsonb;
  v_tooth text;
  v_meta jsonb;
  base_faces text[] := ARRAY['resin','filling','amalgam','sealant','caries'];
  faces text[] := ARRAY['center','top','bottom','left','right'];
BEGIN
  CREATE TEMP TABLE _odo (patient_id uuid PRIMARY KEY, state jsonb) ON COMMIT DROP;

  FOR r IN
    SELECT dn.*, a.status AS appt_status FROM _done dn JOIN appointments a ON a.id = dn.appt_id
    WHERE dn.tooth IS NOT NULL AND dn.status <> 'in_progress'
    ORDER BY dn.patient_id, dn.ts
  LOOP
    SELECT state INTO v_state FROM _odo WHERE patient_id = r.patient_id;
    IF v_state IS NULL THEN
      -- estado inicial: algunos ausentes y restauraciones previas
      v_state := '{}'::jsonb;
      FOR i IN 1..pg_temp.rint(0, 2) LOOP
        v_state := v_state || jsonb_build_object(pg_temp.pick(ARRAY['18','28','38','48','36','46']), jsonb_build_object('whole', 'missing'));
      END LOOP;
      FOR i IN 1..pg_temp.rint(1, 5) LOOP
        v_tooth := pg_temp.pick(ARRAY['11','14','15','16','17','21','24','25','26','27','34','35','36','37','44','45','46','47']);
        IF NOT v_state ? v_tooth THEN
          v_state := v_state || jsonb_build_object(v_tooth, jsonb_build_object(pg_temp.pick(faces), pg_temp.pick(base_faces)));
        END IF;
      END LOOP;
      INSERT INTO _odo VALUES (r.patient_id, v_state);
    END IF;

    v_tooth := r.tooth::text;
    v_meta := jsonb_build_object('at', to_char(r.ts, 'YYYY-MM-DD"T"HH24:MI:SS'), 'by', r.doctor_id, 'st', 'done', 'src', 'manual');

    v_state := v_state || jsonb_build_object(v_tooth,
      CASE r.svc_code
        WHEN 'RESINA'       THEN coalesce(v_state -> v_tooth, '{}') - 'whole' || jsonb_build_object('center', 'resin', 'meta', jsonb_build_object('center', v_meta))
        WHEN 'SELLANTE'     THEN coalesce(v_state -> v_tooth, '{}') || jsonb_build_object('center', 'sealant', 'meta', jsonb_build_object('center', v_meta))
        WHEN 'ENDO_UNI'     THEN jsonb_build_object('whole', 'endo-done', 'meta', jsonb_build_object('t:endo-done', v_meta))
        WHEN 'ENDO_MULTI'   THEN jsonb_build_object('whole', 'endo-done', 'meta', jsonb_build_object('t:endo-done', v_meta))
        WHEN 'RETRATAM'     THEN jsonb_build_object('whole', 'endo-done', 'meta', jsonb_build_object('t:endo-done', v_meta))
        WHEN 'PERNO'        THEN jsonb_build_object('whole', 'endo-done', 'overlays', jsonb_build_array('post-fiber'), 'meta', jsonb_build_object('t:post-fiber', v_meta))
        WHEN 'CORONA'       THEN jsonb_build_object('whole', 'crown', 'meta', jsonb_build_object('t:crown', v_meta))
        WHEN 'EXODONCIA'    THEN jsonb_build_object('whole', 'missing', 'meta', jsonb_build_object('t:missing', v_meta))
        WHEN 'TERCER_MOLAR' THEN jsonb_build_object('whole', 'missing', 'meta', jsonb_build_object('t:missing', v_meta))
        WHEN 'IMPLANTE'     THEN jsonb_build_object('whole', 'implant-osseo', 'meta', jsonb_build_object('t:implant-osseo', v_meta))
        WHEN 'CORONA_IMPL'  THEN jsonb_build_object('whole', 'implant', 'overlays', jsonb_build_array('crown'), 'meta', jsonb_build_object('t:implant', v_meta))
        ELSE coalesce(v_state -> v_tooth, '{}')
      END);

    UPDATE _odo SET state = v_state WHERE patient_id = r.patient_id;

    INSERT INTO sesiones (paciente_id, fecha_sesion, descripcion, notas, estado_odontograma, doctor_id, appointment_id,
                          invoice_id, created_by)
    VALUES (r.patient_id, r.ts AT TIME ZONE 'America/Montevideo',
            (SELECT name FROM _svc WHERE code = r.svc_code) || ' · pieza ' || r.tooth,
            '', v_state, r.doctor_id, r.appt_id, r.invoice_id, r.doctor_id);
  END LOOP;
END $$;

-- =============================================================================
-- Periodontogramas: uno por evaluación / mantenimiento periodontal atendido
-- =============================================================================
DO $$
DECLARE
  r record;
  v_exam bigint;
  v_type text;
  v_status text;
  v_sev numeric;
  v_tooth smallint;
  sd char;
  st char;
  pd int; gm int;
  missing smallint[];
  all_teeth smallint[] := ARRAY[11,12,13,14,15,16,17,18,21,22,23,24,25,26,27,28,31,32,33,34,35,36,37,38,41,42,43,44,45,46,47,48];
BEGIN
  FOR r IN
    SELECT dn.*, row_number() OVER (PARTITION BY dn.patient_id ORDER BY dn.ts) AS nth
    FROM _done dn WHERE dn.svc_code IN ('PERIO_EVAL', 'PERIO_MANT') AND dn.status <> 'in_progress'
    ORDER BY dn.ts
  LOOP
    v_type := CASE WHEN r.svc_code = 'PERIO_EVAL' AND r.nth = 1 THEN 'initial'
                   WHEN r.svc_code = 'PERIO_EVAL' THEN 'reevaluation' ELSE 'maintenance' END;
    v_status := CASE WHEN r.ts < now() - interval '14 days' THEN 'closed' ELSE pg_temp.pick(ARRAY['diagnosed','probed']) END;
    v_sev := CASE WHEN v_type = 'initial' THEN 1.6 WHEN v_type = 'reevaluation' THEN 1.2 ELSE 0.9 END;
    missing := ARRAY[18, 28, 38, 48]::smallint[];

    INSERT INTO perio_exams (patient_id, doctor_id, appointment_id, exam_date, exam_type, title, notes, status, completeness,
                             closed_at, closed_by, created_by, invoice_id)
    VALUES (r.patient_id, r.doctor_id, r.appt_id, r.ts::date, v_type,
            CASE v_type WHEN 'initial' THEN 'Evaluación inicial' WHEN 'reevaluation' THEN 'Reevaluación' ELSE 'Mantenimiento' END,
            '', v_status, 100,
            CASE WHEN v_status = 'closed' THEN r.ts + interval '1 hour' END,
            CASE WHEN v_status = 'closed' THEN r.doctor_id END,
            r.doctor_id, r.invoice_id)
    RETURNING id INTO v_exam;

    FOREACH v_tooth IN ARRAY all_teeth LOOP
      INSERT INTO perio_teeth (exam_id, tooth, status, mobility)
      VALUES (v_exam, v_tooth, CASE WHEN v_tooth = ANY(missing) THEN 'missing' ELSE 'present' END,
              CASE WHEN v_tooth = ANY(missing) THEN NULL WHEN random() < 0.08 THEN 1 ELSE 0 END);
      CONTINUE WHEN v_tooth = ANY(missing);
      FOREACH sd IN ARRAY ARRAY['v','i']::char[] LOOP
        FOREACH st IN ARRAY ARRAY['D','C','M']::char[] LOOP
          pd := least(9, greatest(1, round(CASE WHEN st = 'C' THEN 1.8 ELSE 2.6 END * v_sev * (0.7 + random() * 0.8))::int));
          gm := CASE WHEN random() < 0.15 THEN pg_temp.rint(1, 2) ELSE 0 END;
          -- cal_mm es columna generada (pd_mm + gm_mm)
          INSERT INTO perio_sites (exam_id, tooth, side, site, pd_mm, gm_mm, bop, suppuration, plaque, source)
          VALUES (v_exam, v_tooth, sd, st, pd, gm,
                  random() < CASE WHEN pd >= 4 THEN 0.55 ELSE 0.08 END,
                  pd >= 6 AND random() < 0.2,
                  random() < 0.2 * v_sev,
                  'manual');
        END LOOP;
      END LOOP;
    END LOOP;

    -- estadísticas como las calcula el frontend
    UPDATE perio_exams pe SET stats = s.stats,
      diagnosis = CASE WHEN v_status IN ('diagnosed', 'closed') THEN jsonb_build_object(
          'age', extract(year FROM age(r.ts, (SELECT birthday FROM users WHERE id = r.patient_id)))::int,
          'plan', jsonb_build_array(jsonb_build_object('id', 'maintenance', 'kind', 'maintenance', 'today', v_type = 'maintenance', 'include', true)),
          'risk', CASE WHEN (s.stats ->> 'bopPct')::int > 25 THEN 'high' ELSE 'moderate' END,
          'grade', 'B',
          'stage', CASE WHEN (s.stats ->> 'maxInterproximalCal')::int >= 5 THEN 'III' ELSE 'II' END,
          'extent', 'generalized', 'isCase', true, 'manual', '{}'::jsonb, 'diabetes', 'no',
          'stability', CASE WHEN (s.stats ->> 'b5')::int > 0 THEN 'unstable' ELSE 'stable' END,
          'teethLost', 0, 'cigarettes', 0, 'boneLossPct', 25,
          'confirmedAt', to_char(r.ts, 'YYYY-MM-DD"T"HH24:MI:SS.000"Z"'),
          'maintenanceMonths', 4) END,
      closing = CASE WHEN v_status = 'closed' THEN jsonb_build_object('noCharge', r.invoice_id IS NULL,
          'nextVisit', jsonb_build_object('date', to_char(r.ts + interval '4 months', 'YYYY-MM-DD'), 'kind', 'maintenance', 'mode', 'later')) END
    FROM (
      SELECT jsonb_build_object(
        'sites', count(*),
        'meanPd', round(avg(pd_mm), 2),
        'meanCal', round(avg(cal_mm), 2),
        'bopPct', round(100.0 * count(*) FILTER (WHERE bop) / count(*)),
        'plaquePct', round(100.0 * count(*) FILTER (WHERE plaque) / count(*)),
        'n4', count(*) FILTER (WHERE pd_mm = 4),
        'n5', count(*) FILTER (WHERE pd_mm = 5),
        'n6', count(*) FILTER (WHERE pd_mm >= 6),
        'b4', count(*) FILTER (WHERE pd_mm = 4 AND bop),
        'b5', count(*) FILTER (WHERE pd_mm >= 5 AND bop),
        'teeth5', count(DISTINCT tooth) FILTER (WHERE pd_mm >= 5),
        'maxInterproximalCal', coalesce(max(cal_mm) FILTER (WHERE site <> 'C'), 0)) AS stats
      FROM perio_sites WHERE exam_id = v_exam
    ) s
    WHERE pe.id = v_exam;
  END LOOP;
END $$;

-- =============================================================================
-- Sesiones estéticas con capas y marcas
-- =============================================================================
DO $$
DECLARE
  r record;
  s record;
  v_sess bigint;
  v_layer bigint;
  v_sex sex_type;
  v_status text;
  v_lot text;
  pts jsonb;
  p jsonb;
BEGIN
  FOR r IN SELECT dn.* FROM _done dn JOIN _svc sv ON sv.code = dn.svc_code WHERE sv.aesthetic ORDER BY dn.ts LOOP
    SELECT * INTO s FROM _svc WHERE code = r.svc_code;
    SELECT sex INTO v_sex FROM users WHERE id = r.patient_id;
    v_status := CASE WHEN r.status = 'in_progress' THEN 'in_treatment' ELSE 'closed' END;
    v_lot := upper(substr(s.code, 1, 2)) || pg_temp.rint(1000, 9999);

    INSERT INTO aesthetic_sessions (patient_id, doctor_id, appointment_id, session_date, title, notes, body_figure,
                                    created_at, created_by, updated_at, updated_by, status, completeness, flow_version,
                                    closed_at, closed_by, invoice_id)
    VALUES (r.patient_id, r.doctor_id, r.appt_id, r.ts::date, s.name, '', coalesce(v_sex, 'female')::text,
            r.ts, r.doctor_id, r.ts + interval '40 minutes', r.doctor_id, v_status,
            CASE WHEN v_status = 'closed' THEN 100 ELSE 60 END, 2,
            CASE WHEN v_status = 'closed' THEN r.ts + interval '40 minutes' END,
            CASE WHEN v_status = 'closed' THEN r.doctor_id END,
            r.invoice_id)
    RETURNING id INTO v_sess;

    INSERT INTO aesthetic_layers (session_id, service_id, service_name, product_name, unit_id, marking_tool, lot, lot_expiry, depth, technique, sort_order)
    VALUES (v_sess, s.id, s.name, s.product, (SELECT id FROM measurement_units WHERE code = s.unit_code), s.tool, v_lot,
            (r.ts + interval '18 months')::date, s.depth, s.technique, 0)
    RETURNING id INTO v_layer;

    -- puntos sobre la plantilla facial frontal (coordenadas normalizadas 0..1)
    pts := CASE s.code
      WHEN 'TOXINA' THEN '[
        {"k":"point","x":0.40,"y":0.22,"z":"forehead","q":4},{"k":"point","x":0.50,"y":0.20,"z":"forehead","q":4},
        {"k":"point","x":0.60,"y":0.22,"z":"forehead","q":4},{"k":"point","x":0.50,"y":0.41,"z":"glabella","q":8},
        {"k":"point","x":0.46,"y":0.39,"z":"glabella","q":4},{"k":"point","x":0.54,"y":0.39,"z":"glabella","q":4},
        {"k":"point","x":0.27,"y":0.46,"z":"crowsFeet.right","q":4},{"k":"point","x":0.73,"y":0.46,"z":"crowsFeet.left","q":4}]'::jsonb
      WHEN 'LABIOS' THEN '[
        {"k":"point","x":0.46,"y":0.65,"z":"upperLip","q":0.15},{"k":"point","x":0.54,"y":0.65,"z":"upperLip","q":0.15},
        {"k":"point","x":0.47,"y":0.71,"z":"lowerLip","q":0.1},{"k":"point","x":0.53,"y":0.71,"z":"lowerLip","q":0.1}]'::jsonb
      WHEN 'SKINBOOSTER' THEN '[
        {"k":"area","x":0.35,"y":0.546,"z":"cheek.right","q":1,"poly":[[0.28,0.53],[0.333,0.516],[0.407,0.526],[0.413,0.563],[0.32,0.595]]},
        {"k":"area","x":0.65,"y":0.546,"z":"cheek.left","q":1,"poly":[[0.72,0.53],[0.667,0.516],[0.593,0.526],[0.587,0.563],[0.68,0.595]]}]'::jsonb
      WHEN 'HILOS' THEN '[
        {"k":"line","x":0.33,"y":0.62,"z":"cheek.right","q":2,"poly":[[0.30,0.70],[0.36,0.54]]},
        {"k":"line","x":0.67,"y":0.62,"z":"cheek.left","q":2,"poly":[[0.70,0.70],[0.64,0.54]]},
        {"k":"line","x":0.37,"y":0.76,"z":"jawline.right","q":1,"poly":[[0.31,0.70],[0.43,0.81]]},
        {"k":"line","x":0.63,"y":0.76,"z":"jawline.left","q":1,"poly":[[0.69,0.70],[0.57,0.81]]}]'::jsonb
      ELSE '[
        {"k":"area","x":0.50,"y":0.25,"z":"forehead","q":null,"poly":[[0.36,0.20],[0.64,0.20],[0.66,0.32],[0.34,0.32]]},
        {"k":"area","x":0.35,"y":0.546,"z":"cheek.right","q":null,"poly":[[0.28,0.53],[0.333,0.516],[0.407,0.526],[0.413,0.563],[0.32,0.595]]},
        {"k":"area","x":0.65,"y":0.546,"z":"cheek.left","q":null,"poly":[[0.72,0.53],[0.667,0.516],[0.593,0.526],[0.587,0.563],[0.68,0.595]]}]'::jsonb
    END;

    FOR p IN SELECT * FROM jsonb_array_elements(pts) LOOP
      INSERT INTO aesthetic_marks (layer_id, kind, view, x, y, polygon, zone, quantity, sort_order, created_at, created_by)
      VALUES (v_layer, p ->> 'k', 'front', (p ->> 'x')::numeric, (p ->> 'y')::numeric,
              CASE WHEN p ->> 'k' = 'point' THEN NULL ELSE p -> 'poly' END,
              p ->> 'z', (p ->> 'q')::numeric, 0, r.ts, r.doctor_id);
    END LOOP;

    INSERT INTO aesthetic_session_events (session_id, type, payload, at, actor)
    VALUES (v_sess, 'created', '{}'::jsonb, r.ts, r.doctor_id);
    IF v_status = 'closed' THEN
      INSERT INTO aesthetic_session_events (session_id, type, payload, at, actor)
      VALUES (v_sess, 'closed', '{}'::jsonb, r.ts + interval '40 minutes', r.doctor_id);
      IF r.invoice_id IS NOT NULL THEN
        INSERT INTO aesthetic_session_events (session_id, type, payload, at, actor)
        VALUES (v_sess, 'invoice_linked', jsonb_build_object('invoiceId', r.invoice_id), r.ts + interval '41 minutes', r.doctor_id);
      END IF;
    END IF;
  END LOOP;
END $$;

-- =============================================================================
-- Planes de tratamiento pendientes (presupuestos en borrador, sin facturar)
-- =============================================================================
DO $$
DECLARE
  c record;
  pat record;
  plan text[];
  plans text[][] := ARRAY[
    ARRAY['IMPLANTE', 'CORONA_IMPL', 'RX_PERI'],
    ARRAY['ENDO_MULTI', 'PERNO', 'CORONA'],
    ARRAY['ORTO_CONS', 'BRACKETS', 'RETENEDOR'],
    ARRAY['RASPADO', 'RASPADO', 'PERIO_MANT'],
    ARRAY['RESINA', 'RESINA', 'PROFILAXIS'],
    ARRAY['TERCER_MOLAR', 'TERCER_MOLAR', 'RX_PERI']];
  v_quote int;
  v_total numeric;
  v_doc uuid;
  v_ts timestamp;
  v_code text;
  idx int;
BEGIN
  SELECT * INTO c FROM _ctx;
  FOR i IN 1..25 LOOP
    SELECT * INTO pat FROM _pat WHERE NOT kid ORDER BY random() LIMIT 1;
    idx := 1 + floor(random() * 6)::int;
    v_ts := c.now_local - (pg_temp.rint(1, 45) || ' days')::interval;
    v_doc := (SELECT d.id FROM _doc d JOIN _svc s ON s.specialty = d.specialty WHERE s.code = plans[idx][1]);

    INSERT INTO quotes (user_id, total, status, billing_status, payment_status, created_at, updated_at, currency, is_sales,
                        doc_no, exchange_rate, notes, external_id, doctor_id, gross_total, discount_amount, sede_id, created_by)
    VALUES (pat.id, 0, 'draft', 'not_invoiced', 'not_paid', v_ts, v_ts, 'UYU', true,
            pg_temp.docno('quote', v_ts), 1, 'Plan de tratamiento propuesto', 'seed:plan:' || i, v_doc, 0, 0, c.sede_id,
            (SELECT id FROM _recep ORDER BY random() LIMIT 1))
    RETURNING id INTO v_quote;

    FOR j IN 1..3 LOOP
      v_code := plans[idx][j];
      INSERT INTO quote_items (quote_id, service_id, quantity, unit_price, total, tooth_number, gross_total, discount_amount)
      SELECT v_quote, s.id, 1, s.price, s.price,
             CASE WHEN s.tooth THEN pg_temp.pick(ARRAY['16','26','36','46','14','24'])::int END, s.price, 0
      FROM _svc s WHERE s.code = v_code;
    END LOOP;

    SELECT sum(total) INTO v_total FROM quote_items WHERE quote_id = v_quote;
    -- 20 % de los planes con descuento sobre el total
    IF random() < 0.2 THEN
      UPDATE quotes SET gross_total = v_total, discount_scope = 'total', discount_mode = 'percent', discount_value = 10,
                        discount_amount = round(v_total * 0.10, 2), total = v_total - round(v_total * 0.10, 2)
      WHERE id = v_quote;
    ELSE
      UPDATE quotes SET gross_total = v_total, total = v_total WHERE id = v_quote;
    END IF;
  END LOOP;
END $$;

ALTER TABLE appointments ENABLE TRIGGER trigger_appointment_change;

COMMIT;   -- cambiar por ROLLBACK para probar sin aplicar

-- =============================================================================
-- Resumen (pgAdmin muestra el resultado de esta última consulta)
-- =============================================================================
SELECT 'servicios' AS que, count(*) FROM service_catalog WHERE external_id LIKE 'seed:%'
UNION ALL SELECT 'doctores', count(*) FROM users WHERE internal_id LIKE 'seed:doc:%'
UNION ALL SELECT 'recepcionistas', count(*) FROM users WHERE internal_id LIKE 'seed:recep:%'
UNION ALL SELECT 'pacientes (menores)', count(*) FILTER (WHERE is_dependant) FROM users WHERE internal_id LIKE 'seed:pat:%'
UNION ALL SELECT 'pacientes', count(*) FROM users WHERE internal_id LIKE 'seed:pat:%'
UNION ALL SELECT 'citas', count(*) FROM appointments WHERE external_id LIKE 'seed:%'
UNION ALL SELECT 'sesiones clínicas', count(*) FROM sesiones_clinicas WHERE external_id LIKE 'seed:%'
UNION ALL SELECT 'odontogramas (sesiones)', count(*) FROM sesiones s JOIN users u ON u.id = s.paciente_id WHERE u.internal_id LIKE 'seed:%'
UNION ALL SELECT 'periodontogramas', count(*) FROM perio_exams pe JOIN users u ON u.id = pe.patient_id WHERE u.internal_id LIKE 'seed:%'
UNION ALL SELECT 'sesiones estéticas', count(*) FROM aesthetic_sessions ae JOIN users u ON u.id = ae.patient_id WHERE u.internal_id LIKE 'seed:%'
UNION ALL SELECT 'presupuestos', count(*) FROM quotes WHERE external_id LIKE 'seed:%'
UNION ALL SELECT 'facturas', count(*) FROM invoices WHERE external_id LIKE 'seed:%'
UNION ALL SELECT 'pagos', count(*) FROM payments WHERE external_id LIKE 'seed:%'
UNION ALL SELECT 'cajas', count(*) FROM cash_sessions cs JOIN users u ON u.id = cs.user_id WHERE u.internal_id LIKE 'seed:%'
UNION ALL SELECT 'citas · ' || status, count(*) FROM appointments WHERE external_id LIKE 'seed:%' GROUP BY status
UNION ALL SELECT 'facturas · ' || payment_state, count(*) FROM invoices WHERE external_id LIKE 'seed:%' GROUP BY payment_state;
