-- =============================================================================
-- dev-seed-study-orders.sql — Datos de prueba para las órdenes de estudio (DEV).
--
-- Se pega entero en el Query Tool de pgAdmin y se ejecuta con F5. Corre en una
-- sola transacción: si algo falla no queda nada a medias (ROLLBACK; y reintentar).
-- Para probar sin aplicar, cambiar el COMMIT del final por ROLLBACK.
--
-- Va después de dev-seed.sql (no lo necesita: crea su propio personal y pacientes).
-- Se puede volver a correr: borra y regenera SOLO sus órdenes (OE-DEMO-*), citas y
-- sesiones (seed:so:*), con lo que se les haya cambiado; conserva catálogo y personas.
-- Nunca correrlo contra la base de un cliente.
--
-- Qué crea:
--   * Catálogo: 14 secciones, 78 estudios con precio de demo y 46 opciones. Son los 69
--     estudios de scripts/sql/catalogo-clinica-imagen.sql y las 42 opciones de la migración
--     071, más lo que traen los formularios impresos: resonancias, cráneo completo, modelo
--     digital, biomodelos 3D, placas de 0.40/0.60 y borde de las placas de blanqueamiento.
--   * 4 doctores derivadores, 3 técnicos (rol operador), 2 recepcionistas, 16 pacientes
--     (uno menor con responsable y uno sin documento) y 2 salas en la agenda.
--   * 24 órdenes OE-DEMO-00NN que cubren todos los estados del tablero, con sus citas,
--     sesiones clínicas, puntos a revisar y línea de tiempo.
--   * Si está aplicada la migración 132, también mensajes y notas del chatter.
--
-- Personas inventadas, correos @example.com y comunicaciones desactivadas. Sin contraseñas.
-- No crea lecturas (intakes) ni archivos: los originales se prueban importando fotos.
-- =============================================================================

BEGIN;
SET LOCAL lock_timeout = '15s';

DO $$
BEGIN
  IF to_regclass('public.study_orders') IS NULL OR NOT EXISTS (SELECT 1 FROM roles WHERE name = 'operador')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_schema = 'public' AND table_name = 'study_orders' AND column_name = 'assigned_to') THEN
    RAISE EXCEPTION 'Faltan migraciones de órdenes de estudio (071–078 y 125–131)';
  END IF;
END $$;

-- Evita el aviso (pg_notify) que sincroniza con Google Calendar.
ALTER TABLE appointments DISABLE TRIGGER trigger_appointment_change;

CREATE OR REPLACE FUNCTION pg_temp.ci_uy(n int) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  s text := lpad(n::text, 7, '0');
  w int[] := ARRAY[2, 9, 8, 7, 6, 3, 4];
  total int := 0;
BEGIN
  FOR i IN 1..7 LOOP total := total + substr(s, i, 1)::int * w[i]; END LOOP;
  RETURN substr(s, 1, 1) || '.' || substr(s, 2, 3) || '.' || substr(s, 5, 3) || '-' || ((10 - total % 10) % 10)::text;
END $$;

-- Día hábil (lunes a viernes) a k días hábiles de hoy; 0 = hoy o el próximo hábil.
CREATE OR REPLACE FUNCTION pg_temp.bday(k int) RETURNS date LANGUAGE sql STABLE AS $$
  SELECT d FROM (
    SELECT g::date AS d, row_number() OVER (ORDER BY abs(g::date - t.today)) AS rn
      FROM (SELECT (now() AT TIME ZONE 'America/Montevideo')::date AS today) t,
           generate_series(t.today - CASE WHEN k < 0 THEN 90 ELSE 0 END,
                           t.today + CASE WHEN k < 0 THEN -1 ELSE 90 END, interval '1 day') g
     WHERE extract(isodow FROM g) < 6
  ) x WHERE rn = CASE WHEN k < 0 THEN -k ELSE k + 1 END
$$;

CREATE TEMP TABLE _ctx ON COMMIT DROP AS
SELECT (SELECT s.id FROM sedes s WHERE s.is_active ORDER BY s.id LIMIT 1) AS sede_id,
       (SELECT id FROM users WHERE email = 'system@invokeia.com')         AS system_id,
       (now() AT TIME ZONE 'America/Montevideo')::timestamp               AS now_local;

-- =============================================================================
-- 1. Catálogo de la orden
-- =============================================================================
INSERT INTO miscellaneous_categories (code, name, description, category_type, is_active, external_id)
SELECT v.code, v.name, 'Sección "' || v.name || '" de la orden de estudio.', 'income', true, 'ci-orden:cat:' || v.code
FROM (VALUES
  (1, 'RX-INTRA', 'Radiografías intrabucales'),
  (2, 'EST-EXTRA', 'Otros estudios extraorales'),
  (3, 'RX-EXTRA', 'Radiografías extraorales'),
  (4, 'CEFALO', 'Estudios cefalométricos computarizados'),
  (5, 'FOTO', 'Fotografías'),
  (6, 'MOD-DIG', 'Modelos digitales'),
  (7, 'ALINEA', 'Ortodoncia invisible (alineadores)'),
  (8, 'CONEBEAM', 'Tomografía computarizada volumétrica Cone Beam'),
  (9, 'CIR-GUIA', 'Cirugía guiada para implantes'),
  (10, 'M3DMIX', 'Realidad virtual M3DMIX'),
  (11, 'ECO', 'Ecografías'),
  (12, 'OTROS-SRV', 'Otros servicios'),
  (13, 'RESO-MAG', 'Resonancias magnéticas'),
  (14, 'IMP-3D', 'Impresión 3D (biomodelos)')
) AS v(n, code, name)
WHERE NOT EXISTS (SELECT 1 FROM miscellaneous_categories m WHERE m.external_id = 'ci-orden:cat:' || v.code)
ORDER BY v.n;

CREATE TEMP TABLE _svc (code text, name text, section text, dur int, price numeric, descr text, color text) ON COMMIT DROP;
INSERT INTO _svc VALUES
  ('bitewing', 'Bitewing', 'RX-INTRA', 10, 450, NULL, '#3B82F6'),
  ('conductimetria', 'Con conductimetría', 'RX-INTRA', 15, 450, NULL, '#3B82F6'),
  ('oclusal', 'Oclusal', 'RX-INTRA', 10, 450, NULL, '#3B82F6'),
  ('periapical', 'Periapical', 'RX-INTRA', 10, 450, NULL, '#3B82F6'),
  ('periapical-completo', 'Relevamiento periapical completo', 'RX-INTRA', 30, 4200, NULL, '#3B82F6'),
  ('ATM', 'ATM (Boca abierta y cerrada) (LAMINOGRAFÍA)', 'EST-EXTRA', 20, 1600, NULL, '#6366F1'),
  ('mano-puno', 'Mano y puño (Carpal)', 'EST-EXTRA', 15, 1600, NULL, '#6366F1'),
  ('sub-m-vertex', 'Sub mentón Vertex', 'EST-EXTRA', 15, 1600, NULL, '#6366F1'),
  ('opt', 'Panorámica (OPT)', 'RX-EXTRA', 10, 1200, NULL, '#0EA5E9'),
  ('telerradio-frontal', 'Telerradiografía Frontal', 'RX-EXTRA', 10, 1200, NULL, '#0EA5E9'),
  ('telerradio-perfil', 'Telerradiografía Perfil', 'RX-EXTRA', 10, 1200, NULL, '#0EA5E9'),
  ('bjork', 'Bjork Jarabak', 'CEFALO', 15, 900, NULL, '#8B5CF6'),
  ('funcacion-gnathos', 'Fundación Gnathos', 'CEFALO', 15, 900, NULL, '#8B5CF6'),
  ('mcnamara', 'Mcnamara', 'CEFALO', 15, 900, NULL, '#8B5CF6'),
  ('ricketts', 'Ricketts', 'CEFALO', 15, 900, NULL, '#8B5CF6'),
  ('ricketts-resumido', 'Ricketts Resumido', 'CEFALO', 15, 900, NULL, '#8B5CF6'),
  ('roth-jarabak', 'Roth Jarabak', 'CEFALO', 15, 900, NULL, '#8B5CF6'),
  ('steiner', 'Steiner Tweed', 'CEFALO', 15, 900, NULL, '#8B5CF6'),
  ('trevis', 'Trevis', 'CEFALO', 15, 900, NULL, '#8B5CF6'),
  ('vto', 'VTO', 'CEFALO', 20, 900, NULL, '#8B5CF6'),
  ('ft-oclusion', '1 anterior en inoclusión', 'FOTO', 10, 350, NULL, '#EC4899'),
  ('ft-oclusion-frente', '1 oclusión frente', 'FOTO', 10, 350, NULL, '#EC4899'),
  ('ft-llave-oclusion', '2 llaves de oclusión', 'FOTO', 10, 350, NULL, '#EC4899'),
  ('ft-oclusal-2', '2 oclusales', 'FOTO', 10, 350, NULL, '#EC4899'),
  ('ft-overjet', '2 overjet/overbite', 'FOTO', 10, 350, NULL, '#EC4899'),
  ('ft-tres-cuartos', '3/4 perfil', 'FOTO', 10, 350, NULL, '#EC4899'),
  ('contacto-oclusal', 'con contacto oclusales', 'FOTO', 10, 350, NULL, '#EC4899'),
  ('ft-dinamica', 'foto en dinámica', 'FOTO', 15, 350, NULL, '#EC4899'),
  ('ft-perfil', 'Perfil', 'FOTO', 10, 350, NULL, '#EC4899'),
  ('ft-rostro-frente', 'Rostro frente', 'FOTO', 10, 350, NULL, '#EC4899'),
  ('ft-rostro-sonrisa', 'Rostro sonrisa', 'FOTO', 10, 350, NULL, '#EC4899'),
  ('fotografias-todas', 'Todas las fotografías', 'FOTO', 30, 2400, NULL, '#EC4899'),
  ('diagnosticobolton', 'Diagnóstico bolton', 'MOD-DIG', 15, 1800, NULL, '#14B8A6'),
  ('diagnosticodentarias', 'Diagnóstico Medidas dentarias', 'MOD-DIG', 15, 1800, NULL, '#14B8A6'),
  ('diagnosticomoyers', 'Diagnóstico Moyers', 'MOD-DIG', 15, 1800, NULL, '#14B8A6'),
  ('duplicado-yeso', 'Duplicado en yeso', 'MOD-DIG', 30, 1800, NULL, '#14B8A6'),
  ('modelos-trabajo', 'Impresión de modelos de trabajo', 'MOD-DIG', 30, 1800, NULL, '#14B8A6'),
  ('modelo-zocalados', 'Impresión de modelos zocalados', 'MOD-DIG', 30, 1800, NULL, '#14B8A6'),
  ('modelo-articulado', 'Modelos articulados con bisagra posterior', 'MOD-DIG', 40, 1800, NULL, '#14B8A6'),
  ('Ortodoncia', 'Ortodoncia', 'MOD-DIG', 30, 1800, NULL, '#14B8A6'),
  ('Ortopedia', 'Ortopedia', 'MOD-DIG', 30, 1800, NULL, '#14B8A6'),
  ('ortodoncia-bimaxilar', 'Bimaxilar', 'ALINEA', 45, 2500, NULL, '#10B981'),
  ('ortodoncia-mandibula', 'Mandíbula', 'ALINEA', 40, 2500, NULL, '#10B981'),
  ('ortodoncia-maxilar', 'Maxilar', 'ALINEA', 40, 2500, NULL, '#10B981'),
  ('tomo-piezas', '1 a 3 piezas', 'CONEBEAM', 15, 2900, NULL, '#F59E0B'),
  ('hemiarco', 'Hemiarco', 'CONEBEAM', 20, 3800, NULL, '#F59E0B'),
  ('mandibula-completa', 'Mandíbula completa', 'CONEBEAM', 20, 4600, NULL, '#F59E0B'),
  ('maxilar-completo', 'Maxilar completo', 'CONEBEAM', 20, 4600, NULL, '#F59E0B'),
  ('servicio-escaneo', 'Escaneo', 'CIR-GUIA', 30, 2200, NULL, '#EF4444'),
  ('guia-fresa', 'Guía de fresa iniciadora', 'CIR-GUIA', 45, 4500, NULL, '#EF4444'),
  ('guia-precision', 'Guía de precisión', 'CIR-GUIA', 60, 9800, NULL, '#EF4444'),
  ('servicio-planeamiento', 'Planeamiento', 'CIR-GUIA', 60, 6500, 'Trabajo de laboratorio: no ocupa sillón.', '#EF4444'),
  ('servicio-tomografia', 'Tomografía', 'CIR-GUIA', 20, 4500, NULL, '#EF4444'),
  ('m3dmix-maxilares-implantes', 'Maxilares e implantes', 'M3DMIX', 30, 4200, NULL, '#A855F7'),
  ('m3dmix-mandibular', 'Nervio mandibular', 'M3DMIX', 30, 4200, NULL, '#A855F7'),
  ('m3dmix-patologia', 'Patología', 'M3DMIX', 30, 4200, NULL, '#A855F7'),
  ('m3dmix-tercer-molar', 'Tercer molar', 'M3DMIX', 30, 4200, NULL, '#A855F7'),
  ('eco-atm', 'ATM', 'ECO', 20, 2600, NULL, '#06B6D4'),
  ('eco-partes-blandas', 'Partes blandas', 'ECO', 20, 2600, NULL, '#06B6D4'),
  ('diseno-sonrisa', 'Diseño sonrisa e impresión en resina mockup', 'OTROS-SRV', 60, 5200, 'Fotografías + Escaneo bucal + Diseño + Impresión modelo', '#64748B'),
  ('DAM', 'Dispositivo avance mandibular (DAM)', 'OTROS-SRV', 45, 5200, NULL, '#64748B'),
  ('endoguide', 'Endoguide', 'OTROS-SRV', 60, 11500, 'Tomografía + escaneo + planeamiento + guía impresa', '#64748B'),
  ('escaneo-ortodoncia-placas', 'Escaneo final de ortodoncia + placas de contención', 'OTROS-SRV', 45, 5200, NULL, '#64748B'),
  ('perioguide', 'Perioguide para cirugía gingival', 'OTROS-SRV', 60, 5200, 'Escaneo bucal + Impresión de modelo + guías', '#64748B'),
  ('DOE', 'Placa neuromiorelajante/DOE', 'OTROS-SRV', 45, 5200, 'Escaneado bucal + Planeamiento + Placa impresa', '#64748B'),
  ('placas-blanqueamiento', 'Placas de blanqueamiento', 'OTROS-SRV', 40, 5200, 'Escaneo bucal + Impresión de modelo + placas', '#64748B'),
  ('cirugia-ortognatica', 'Planeamiento cirugía ortognática', 'OTROS-SRV', 90, 28000, 'Escaneo bucal + tomografía + planeamiento + Splits', '#64748B'),
  ('protector-bucal', 'Protector bucal', 'OTROS-SRV', 40, 3500, 'Escaneo + modelo + protector bucal', '#64748B'),
  ('solo-escaneo', 'Sólo escaneo', 'OTROS-SRV', 30, 2200, NULL, '#64748B'),
  ('rm-atm', 'Resonancia magnética ATM', 'RESO-MAG', 30, 7800, 'Del formulario impreso vigente.', '#0891B2'),
  ('rm-partes-blandas', 'Resonancia magnética partes blandas', 'RESO-MAG', 30, 7800, 'Del formulario impreso vigente.', '#0891B2'),
  ('craneo-completo', 'Cráneo completo', 'CONEBEAM', 25, 6200, 'Del formulario impreso vigente.', '#F59E0B'),
  ('modelo-digital', 'Modelo digital', 'MOD-DIG', 30, 1800, 'Del formulario impreso vigente.', '#14B8A6'),
  ('modelo-digital-informe', 'Modelo digital con informe', 'MOD-DIG', 30, 2600, 'Del formulario impreso vigente.', '#14B8A6'),
  ('bio-maxilar', 'Biomodelo maxilar superior', 'IMP-3D', 30, 5400, 'Del formulario impreso vigente.', '#84CC16'),
  ('bio-mandibula', 'Biomodelo mandíbula', 'IMP-3D', 30, 5400, 'Del formulario impreso vigente.', '#84CC16'),
  ('bio-region', 'Biomodelo región de interés', 'IMP-3D', 30, 3900, 'Del formulario impreso vigente.', '#84CC16'),
  ('bio-craneo', 'Biomodelo cráneo completo', 'IMP-3D', 30, 11000, 'Del formulario impreso vigente.', '#84CC16');

-- Si el nombre ya lo usa otro servicio de la clínica (es único), se distingue con la
-- sección: el ajeno no se toca.
INSERT INTO service_catalog (name, description, category, category_id, duration_minutes, price, currency,
                             is_active, is_sales, color, service_type, external_id)
SELECT CASE WHEN EXISTS (SELECT 1 FROM service_catalog x WHERE lower(x.name) = lower(s.name))
            THEN s.name || ' (' || m.name || ')' ELSE s.name END,
       s.descr, m.name, m.id, s.dur, s.price, 'UYU', true, true, s.color, 'single', 'ci-orden:svc:' || s.code
FROM _svc s JOIN miscellaneous_categories m ON m.external_id = 'ci-orden:cat:' || s.section
WHERE NOT EXISTS (SELECT 1 FROM service_catalog x WHERE x.external_id = 'ci-orden:svc:' || s.code);

INSERT INTO study_order_options (option_kind, code, label, section_code, service_id, group_code, input_type, sort_order, external_id)
SELECT v.kind, v.code, v.label, v.section, sc.id, v.grp, v.input, v.sort, 'ci-orden:opt:' || v.code
FROM (VALUES
  ('modifier', 'telerradio-frontal-analisis', 'Con analisis', 'RX-EXTRA', 'telerradio-frontal', NULL, 'checkbox', 0),
  ('modifier', 'frankfort', 'Plano de Frankfort', 'RX-EXTRA', 'telerradio-perfil', 'tecnica', 'checkbox', 1),
  ('modifier', 'horizontal-verdadero', 'Horizontal verdadero', 'RX-EXTRA', 'telerradio-perfil', 'tecnica', 'checkbox', 2),
  ('modifier', 'labios-reposo', 'Labios en reposo', 'RX-EXTRA', 'telerradio-perfil', 'tecnica', 'checkbox', 3),
  ('modifier', 'labios-contacto', 'Labios en contacto', 'RX-EXTRA', 'telerradio-perfil', 'tecnica', 'checkbox', 4),
  ('modifier', 'mordida-constructiva', 'Mordida constructiva', 'MOD-DIG', 'modelos-trabajo', NULL, 'checkbox', 5),
  ('modifier', 'escaneo-superior', 'SUPERIOR', 'OTROS-SRV', 'escaneo-ortodoncia-placas', 'arcada', 'checkbox', 6),
  ('modifier', 'escaneo-inferior', 'INFERIOR', 'OTROS-SRV', 'escaneo-ortodoncia-placas', 'arcada', 'checkbox', 7),
  ('modifier', 'escaneo-placa-75', '0.75mm', 'OTROS-SRV', 'escaneo-ortodoncia-placas', 'espesor', 'checkbox', 8),
  ('modifier', 'escaneo-placa-1', '1mm', 'OTROS-SRV', 'escaneo-ortodoncia-placas', 'espesor', 'checkbox', 9),
  ('modifier', 'escaneo-placa-15', '1.5mm', 'OTROS-SRV', 'escaneo-ortodoncia-placas', 'espesor', 'checkbox', 10),
  ('modifier', 'escaneo-recto', 'RECTO', 'OTROS-SRV', 'escaneo-ortodoncia-placas', 'borde', 'checkbox', 11),
  ('modifier', 'escaneo-festoneado', 'FESTONEADO', 'OTROS-SRV', 'escaneo-ortodoncia-placas', 'borde', 'checkbox', 12),
  ('modifier', 'placas-superior', 'SUPERIOR', 'OTROS-SRV', 'placas-blanqueamiento', 'arcada', 'checkbox', 13),
  ('modifier', 'placas-inferior', 'INFERIOR', 'OTROS-SRV', 'placas-blanqueamiento', 'arcada', 'checkbox', 14),
  ('modifier', 'tomo-sin-separacion', 'Sin separación de tejidos blandos', 'CONEBEAM', NULL, NULL, 'checkbox', 15),
  ('modifier', 'est-tipo-implante', 'Implante', 'CONEBEAM', NULL, 'indicacion_clinica', 'checkbox', 16),
  ('modifier', 'est-tipo-endodoncia', 'Endodoncia', 'CONEBEAM', NULL, 'indicacion_clinica', 'checkbox', 17),
  ('modifier', 'est-tipo-cirugia', 'Cirugía', 'CONEBEAM', NULL, 'indicacion_clinica', 'checkbox', 18),
  ('modifier', 'est-tipo-ortodoncia', 'Ortodoncia', 'CONEBEAM', NULL, 'indicacion_clinica', 'checkbox', 19),
  ('modifier', 'est-tipo-periodoncia', 'Periodoncia', 'CONEBEAM', NULL, 'indicacion_clinica', 'checkbox', 20),
  ('modifier', 'est-tipo-atm', 'ATM', 'CONEBEAM', NULL, 'indicacion_clinica', 'checkbox', 21),
  ('text', 'indiacion-opt', 'Indicación de la OPT', 'RX-EXTRA', NULL, NULL, 'text', 22),
  ('text', 'estudio-cefalo-compu-otros', 'Otro estudio cefalométrico (texto libre)', 'CEFALO', NULL, NULL, 'text', 23),
  ('text', 'fotografia-interes', 'Interés de la foto en dinámica', 'FOTO', NULL, NULL, 'text', 24),
  ('text', 'ortodoncia-marca', 'Marca o sistema de alineadores', 'ALINEA', NULL, NULL, 'text', 25),
  ('text', 'ortodoncia-info-clinica', 'Información clínica de alineadores', 'ALINEA', NULL, NULL, 'textarea', 26),
  ('text', 'tomo-elementos-sueltos', 'Cone Beam · elementos sueltos', 'CONEBEAM', NULL, NULL, 'text', 27),
  ('text', 'interes-estudio-tomo', 'Interés del estudio Cone Beam', 'CONEBEAM', NULL, NULL, 'textarea', 28),
  ('text', 'implante-marca', 'Marca del implante', 'CIR-GUIA', NULL, NULL, 'text', 29),
  ('text', 'implante-ubicacion', 'Ubicación del implante', 'CIR-GUIA', NULL, NULL, 'text', 30),
  ('text', 'implante-fecha-cirugia', 'Fecha probable de cirugía', 'CIR-GUIA', NULL, NULL, 'date', 31),
  ('text', 'eco-interes', 'Interés del estudio ecográfico', 'ECO', NULL, NULL, 'text', 32),
  ('text', 'solo-escaneo-interes', 'Interés del escaneo', 'OTROS-SRV', NULL, NULL, 'text', 33),
  ('text', 'color-protector', 'Color del protector bucal', 'OTROS-SRV', NULL, NULL, 'text', 34),
  ('text', 'aclaracion', 'Aclaración del profesional', NULL, NULL, NULL, 'textarea', 35),
  ('delivery', 'impreso', 'Impreso', NULL, NULL, NULL, 'checkbox', 36),
  ('delivery', 'imagencloud', 'Imagen Cloud', NULL, NULL, NULL, 'checkbox', 37),
  ('delivery', 'email-medio', 'Mail', NULL, NULL, NULL, 'checkbox', 38),
  ('delivery', 'medcloud', 'Medcloud', NULL, NULL, NULL, 'checkbox', 39),
  ('region_group', 'intraoral_odontogram', 'Indique región de interés', 'RX-INTRA', NULL, NULL, 'checkbox', 40),
  ('region_group', 'conebeam_odontogram', 'Indique región de interés', 'CONEBEAM', NULL, NULL, 'checkbox', 41),
  ('modifier', 'escaneo-placa-040', '0.40mm', 'OTROS-SRV', 'escaneo-ortodoncia-placas', 'espesor', 'checkbox', 42),
  ('modifier', 'escaneo-placa-060', '0.60mm', 'OTROS-SRV', 'escaneo-ortodoncia-placas', 'espesor', 'checkbox', 43),
  ('modifier', 'placas-recto', 'RECTO', 'OTROS-SRV', 'placas-blanqueamiento', 'borde', 'checkbox', 44),
  ('modifier', 'placas-festoneado', 'FESTONEADO', 'OTROS-SRV', 'placas-blanqueamiento', 'borde', 'checkbox', 45)
) AS v(kind, code, label, section, svc, grp, input, sort)
LEFT JOIN service_catalog sc ON sc.external_id = 'ci-orden:svc:' || v.svc
ON CONFLICT (external_id) DO NOTHING;

-- =============================================================================
-- 2. Salas, personal y pacientes
-- =============================================================================
INSERT INTO calendar_sources (name, color, sede_id, is_active, external_id)
SELECT v.name, v.color, c.sede_id, true, 'seed:so:cal:' || v.n
FROM (VALUES (1, 'Sala Rayos y Tomografía', '#F59E0B'), (2, 'Sala Fotos y Escaneo', '#14B8A6')) AS v(n, name, color), _ctx c
ON CONFLICT (name) DO NOTHING;

CREATE TEMP TABLE _cal ON COMMIT DROP AS
SELECT v.n, cs.id FROM (VALUES (1, 'Sala Rayos y Tomografía'), (2, 'Sala Fotos y Escaneo')) AS v(n, name)
JOIN calendar_sources cs ON cs.name = v.name;

CREATE TEMP TABLE _person (kind text, n int, name text, sex text, role text, birthday date, doc boolean, kid_of int) ON COMMIT DROP;
INSERT INTO _person VALUES
  ('doc', 1, 'Dra. Elena Barrios',     'female', 'medico', NULL, true, NULL),
  ('doc', 2, 'Dr. Gastón Iriarte',     'male',   'medico', NULL, true, NULL),
  ('doc', 3, 'Dr. Ramiro Ponce',       'male',   'medico', NULL, true, NULL),
  ('doc', 4, 'Dra. Carla Mendieta',    'female', 'medico', NULL, true, NULL),
  ('tech', 1, 'Leticia Duarte',        'female', 'operador', NULL, true, NULL),
  ('tech', 2, 'Germán Olivera',        'male',   'operador', NULL, true, NULL),
  ('tech', 3, 'Noelia Franco',         'female', 'operador', NULL, true, NULL),
  ('recep', 1, 'Mariela Quintana',     'female', 'recepcionista', NULL, true, NULL),
  ('recep', 2, 'Sebastián Luna',       'male',   'recepcionista', NULL, true, NULL),
  ('pat', 1, 'Adriana Bermúdez',       'female', 'paciente', '1984-03-12', true, NULL),
  ('pat', 2, 'Luciano Arrieta',        'male',   'paciente', '1997-08-02', true, NULL),
  ('pat', 3, 'Milagros Seoane',        'female', 'paciente', '2005-05-20', true, NULL),
  ('pat', 4, 'Renata Olascoaga',       'female', 'paciente', '2008-11-03', true, NULL),
  ('pat', 5, 'Esteban Vilar',          'male',   'paciente', '1986-06-28', true, NULL),
  ('pat', 6, 'Julio Casavalle',        'male',   'paciente', '1971-01-15', true, NULL),
  ('pat', 7, 'Daniela Moreira',        'female', 'paciente', '1990-09-09', true, NULL),
  ('pat', 8, 'Franco Balbi',           'male',   'paciente', '2001-12-30', true, NULL),
  ('pat', 9, 'Susana Trías',           'female', 'paciente', '1965-04-18', true, NULL),
  ('pat', 10, 'Héctor Larrañaga',      'male',   'paciente', '1958-07-07', true, NULL),
  ('pat', 11, 'Agustina Berro',        'female', 'paciente', '2003-02-14', true, NULL),
  ('pat', 12, 'Norma Echeverry',       'female', 'paciente', '1979-10-21', true, NULL),
  ('pat', 13, 'Thiago Bermúdez',       'male',   'paciente', '2014-06-05', true, 1),
  ('pat', 14, 'Walter Ibáñez',         'male',   'paciente', '1988-08-16', false, NULL),
  ('pat', 15, 'Gloria Urrutia',        'female', 'paciente', '1962-03-29', true, NULL),
  ('pat', 16, 'Pilar Zabaleta',        'female', 'paciente', '1994-05-11', true, NULL);

INSERT INTO users (name, email, phone_number, internal_id, is_active, sex, birthday, created_by, identity_document,
                   identity_document_type, active_sede_id, can_browse_calendars)
SELECT p.name,
       CASE WHEN p.kid_of IS NULL THEN 'demo.orden.' || p.kind || '.' || p.n || '@example.com' END,
       CASE WHEN p.kid_of IS NULL THEN '+5989900' || CASE p.kind WHEN 'doc' THEN '1' WHEN 'tech' THEN '2' WHEN 'recep' THEN '3' ELSE '4' END
            || lpad(p.n::text, 3, '0') END,
       'seed:so:' || p.kind || ':' || p.n, true, p.sex::sex_type, p.birthday, c.system_id,
       CASE WHEN p.doc THEN pg_temp.ci_uy(CASE p.kind WHEN 'doc' THEN 7600000 WHEN 'tech' THEN 7650000 WHEN 'recep' THEN 7700000 ELSE 7750000 END + p.n * 4327) END,
       'cedula_uy', c.sede_id, p.kind <> 'pat'
FROM _person p, _ctx c
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.internal_id = 'seed:so:' || p.kind || ':' || p.n);

UPDATE users u SET is_dependant = true, responsible_contact_id = r.id
FROM _person p JOIN users r ON r.internal_id = 'seed:so:pat:' || p.kid_of
WHERE u.internal_id = 'seed:so:pat:' || p.n AND p.kind = 'pat' AND p.kid_of IS NOT NULL;

CREATE TEMP TABLE _u ON COMMIT DROP AS
SELECT p.kind, p.n, p.role, u.id, u.name, u.identity_document::text AS doc, u.email::text AS email, u.phone_number::text AS phone
FROM _person p JOIN users u ON u.internal_id = 'seed:so:' || p.kind || ':' || p.n;

INSERT INTO user_roles (user_id, role_id, is_active)
SELECT u.id, r.id, true FROM _u u JOIN roles r ON r.name = u.role
ON CONFLICT DO NOTHING;

INSERT INTO user_communication_preferences (user_id, category_slug, channel_slug, is_enabled)
SELECT u.id, nc.slug, np.platform_name, false FROM _u u CROSS JOIN notification_categories nc CROSS JOIN notification_platforms np
ON CONFLICT (user_id, channel_slug, category_slug) DO UPDATE SET is_enabled = false;

INSERT INTO calendar_users (calendar_source_id, user_id)
SELECT c.id, u.id FROM _cal c CROSS JOIN _u u WHERE u.kind IN ('doc', 'tech')
ON CONFLICT DO NOTHING;

INSERT INTO user_services (user_id, service_id, enabled)
SELECT u.id, s.id, true FROM _u u CROSS JOIN service_catalog s
WHERE u.kind IN ('doc', 'tech') AND s.external_id LIKE 'ci-orden:svc:%'
ON CONFLICT DO NOTHING;

INSERT INTO availability_rules (user_id, recurrence, start_time, end_time, start_date, days_of_week)
SELECT u.id, 'weekly', '08:00', '20:00', current_date - 60, '{1,2,3,4,5}'::smallint[] FROM _u u
WHERE u.kind IN ('doc', 'tech') AND NOT EXISTS (SELECT 1 FROM availability_rules a WHERE a.user_id = u.id);

-- =============================================================================
-- 3. Órdenes, citas y sesiones
-- =============================================================================
DELETE FROM sesiones_clinicas WHERE external_id LIKE 'seed:so:%';
DELETE FROM appointments WHERE external_id LIKE 'seed:so:%';
DELETE FROM study_orders WHERE order_number LIKE 'OE-DEMO-%';

-- age / ack = horas desde que se envió / se tomó. appts.d = días hábiles desde hoy.
CREATE TEMP TABLE _orders ON COMMIT DROP AS
SELECT o FROM jsonb_array_elements($orders$[
  {"doc": 1, "pat": 1, "st": "draft", "age": 3, "items": ["opt", "telerradio-perfil"], "mods": {"telerradio-perfil": {"tecnica": ["frankfort", "labios-reposo"]}}, "dl": ["email-medio"], "notes": "Borrador del doctor: falta enviar.", "n": 1},
  {"doc": null, "pat": 2, "st": "draft", "age": 5, "src": "whatsapp", "ref": "Dr. Felipe Korn", "items": ["cirugia-ortognatica"], "notes": "Receta manuscrita: planificación virtual para cirugía ortognática bimaxilar.", "review": [{"code": "handoff_reason", "field": "low_confidence", "label": "Lectura dudosa", "value": null, "confidence": null, "detail": "Orden manuscrita, sin formulario.", "section_code": null}, {"code": "low_confidence", "field": "items.ci-orden:svc:cirugia-ortognatica", "label": "Estudio: Planeamiento cirugía ortognática", "value": "Planificación virtual", "confidence": 0.62, "detail": null, "section_code": "OTROS-SRV"}, {"code": "low_confidence", "field": "patient.document", "label": "Documento del paciente", "value": "Último dígito dudoso", "confidence": 0.55, "detail": null, "section_code": null}], "n": 2},
  {"doc": null, "pat": 3, "st": "draft", "age": 20, "src": "whatsapp", "ref": "Dra. Andrea Pintos", "items": ["tomo-piezas"], "reg": {"CONEBEAM": ["21", "22", "23", "24"]}, "txt": {"tomo-elementos-sueltos": "Canino retenido pieza 23"}, "review": [{"code": "handoff_reason", "field": "low_confidence", "label": "Lectura dudosa", "value": null, "confidence": null, "detail": "Piezas marcadas sin casilla de tamaño.", "section_code": null}, {"code": "low_confidence", "field": "regions.CONEBEAM", "label": "Piezas", "value": "21, 22, 23, 24", "confidence": 0.71, "detail": null, "section_code": "CONEBEAM"}, {"code": "possibly_incomplete", "field": "missing_other_side", "label": "Puede faltar otra cara u hoja de la orden", "value": null, "confidence": null, "detail": null, "section_code": null}], "n": 3},
  {"doc": 1, "pat": 4, "st": "submitted", "age": 2, "items": ["opt", "ft-oclusal-2", "ft-llave-oclusion", "ft-oclusion-frente", "ft-overjet"], "txt": {"indiacion-opt": "Ortodoncia"}, "dl": ["imagencloud", "email-medio"], "notes": "Documentación para ortodoncia.", "n": 4},
  {"doc": 2, "pat": 5, "st": "submitted", "age": 6, "items": ["tomo-piezas"], "reg": {"CONEBEAM": ["26"]}, "sec": {"CONEBEAM": {"indicacion_clinica": ["est-tipo-endodoncia"]}}, "txt": {"interes-estudio-tomo": "Retratamiento de conducto. ¿Raíz MV con luz hacia apical o atrésica? ¿Fractura a nivel cervical?"}, "dl": ["email-medio", "medcloud"], "notes": "URGENTE", "n": 5},
  {"doc": 3, "pat": 6, "st": "submitted", "age": 90, "items": ["servicio-escaneo", "servicio-planeamiento", "guia-fresa"], "txt": {"implante-ubicacion": "Maxilar inferior, 8 implantes"}, "dl": ["email-medio"], "notes": "Ya tiene tomografía. Orden demorada, sin tomar.", "n": 6},
  {"doc": 4, "pat": null, "name": "Rosario Echenique", "st": "submitted", "age": 10, "items": ["periapical", "bitewing"], "reg": {"RX-INTRA": ["16", "46"]}, "dl": ["impreso"], "notes": "Paciente sin vincular a una ficha.", "n": 7},
  {"doc": 4, "pat": 7, "st": "submitted", "age": 30, "ack": 24, "asg": 1, "items": ["maxilar-completo", "mandibula-completa"], "sec": {"CONEBEAM": {"indicacion_clinica": ["est-tipo-atm"]}}, "txt": {"interes-estudio-tomo": "ATM bilateral. Apertura disminuida, dolor al movimiento y luxaciones a repetición."}, "dl": ["imagencloud"], "n": 8},
  {"doc": 1, "pat": 8, "st": "submitted", "age": 120, "ack": 110, "asg": 2, "items": ["periapical-completo", "opt"], "dl": ["impreso", "email-medio"], "n": 9},
  {"doc": 2, "pat": 9, "st": "submitted", "age": 160, "ack": 150, "items": ["rm-atm", "craneo-completo"], "notes": "No asistió a la cita anterior.", "appts": [{"d": -2, "t": "09:00", "s": "no_show", "items": ["craneo-completo"], "tech": 1, "cal": 1}], "n": 10},
  {"doc": 3, "pat": 10, "st": "submitted", "age": 70, "ack": 66, "asg": 1, "items": ["servicio-escaneo", "servicio-planeamiento", "guia-fresa", "mandibula-completa"], "reg": {"CONEBEAM": ["36", "37", "46", "47"]}, "sec": {"CONEBEAM": {"indicacion_clinica": ["est-tipo-implante"]}}, "appts": [{"d": 2, "t": "09:00", "s": "confirmed", "items": ["mandibula-completa", "servicio-escaneo"], "tech": 1, "cal": 1}], "n": 11},
  {"doc": 1, "pat": 11, "st": "submitted", "age": 60, "ack": 50, "items": ["opt", "telerradio-perfil", "modelo-digital-informe"], "mods": {"telerradio-perfil": {"tecnica": ["labios-reposo"]}}, "appts": [{"d": 3, "t": "09:30", "s": "scheduled", "items": ["opt", "telerradio-perfil"], "tech": null, "cal": 1}], "n": 12},
  {"doc": 2, "pat": 12, "st": "submitted", "age": 48, "ack": 40, "asg": 2, "items": ["periapical"], "reg": {"RX-INTRA": ["26"]}, "appts": [{"d": 1, "t": "10:00", "s": "confirmed", "items": ["periapical"], "tech": 1, "cal": 1}], "n": 13},
  {"doc": 1, "pat": 13, "st": "submitted", "age": 40, "ack": 30, "items": ["opt", "ft-oclusal-2", "ft-llave-oclusion", "ft-oclusion-frente", "ft-overjet"], "notes": "Menor a cargo de un responsable.", "appts": [{"d": 1, "t": "10:20", "s": "scheduled", "items": ["opt", "ft-oclusal-2", "ft-llave-oclusion", "ft-oclusion-frente", "ft-overjet"], "tech": 2, "cal": 2}], "n": 14},
  {"doc": 4, "pat": 14, "st": "submitted", "age": 44, "ack": 36, "items": ["opt"], "notes": "Paciente SIN documento: sirve para probar el bloqueo al completar la cita.", "appts": [{"d": 0, "t": "09:30", "s": "confirmed", "items": ["opt"], "tech": 1, "cal": 1}], "n": 15},
  {"doc": 3, "pat": 15, "st": "submitted", "age": 200, "ack": 190, "items": ["bio-mandibula"], "notes": "Cita pasada sin cerrar.", "appts": [{"d": -1, "t": "10:30", "s": "confirmed", "items": ["bio-mandibula"], "tech": 2, "cal": 2}], "n": 16},
  {"doc": null, "pat": 16, "st": "submitted", "age": 26, "ack": 26, "src": "whatsapp", "ref": "Dra. Nadia Mena", "items": ["opt", "periapical"], "reg": {"RX-INTRA": ["11"]}, "review": [{"code": "no_signature", "field": "has_signature", "label": "La orden no tiene firma visible", "value": null, "confidence": null, "detail": null, "section_code": null}], "notblock": true, "notes": "Agendada por el asistente de WhatsApp.", "appts": [{"d": 4, "t": "09:00", "s": "scheduled", "items": ["opt", "periapical"], "tech": null, "cal": 1}], "n": 17},
  {"doc": 3, "pat": 1, "st": "submitted", "age": 200, "ack": 190, "asg": 1, "items": ["servicio-escaneo", "servicio-planeamiento", "guia-fresa"], "txt": {"implante-ubicacion": "36 y 46"}, "appts": [{"d": -3, "t": "09:00", "s": "completed", "items": ["servicio-escaneo"], "tech": 1, "cal": 2, "ses": 1}, {"d": 5, "t": "09:00", "s": "scheduled", "items": ["servicio-planeamiento", "guia-fresa"], "tech": 3, "cal": 1}], "n": 18},
  {"doc": 1, "pat": 5, "st": "submitted", "age": 260, "ack": 250, "items": ["escaneo-ortodoncia-placas", "opt"], "mods": {"escaneo-ortodoncia-placas": {"arcada": ["escaneo-superior", "escaneo-inferior"], "espesor": ["escaneo-placa-040"], "borde": ["escaneo-festoneado"]}}, "appts": [{"d": -4, "t": "09:30", "s": "completed", "items": ["opt"], "tech": 2, "cal": 1, "ses": 1}], "n": 19},
  {"doc": 2, "pat": 3, "st": "completed", "age": 420, "ack": 410, "asg": 1, "items": ["periapical", "bitewing"], "reg": {"RX-INTRA": ["36"]}, "appts": [{"d": -9, "t": "10:00", "s": "completed", "items": ["periapical", "bitewing"], "tech": 1, "cal": 1, "ses": 1}], "n": 20},
  {"doc": 1, "pat": 8, "st": "completed", "age": 560, "ack": 550, "asg": 2, "items": ["opt", "ft-oclusal-2", "ft-llave-oclusion", "ft-oclusion-frente", "ft-overjet", "telerradio-perfil"], "dl": ["imagencloud"], "appts": [{"d": -12, "t": "09:00", "s": "completed", "items": ["opt", "ft-oclusal-2", "ft-llave-oclusion", "ft-oclusion-frente", "ft-overjet"], "tech": 2, "cal": 2, "ses": 1}, {"d": -10, "t": "09:00", "s": "completed", "items": ["telerradio-perfil"], "tech": 1, "cal": 1, "ses": 1}], "n": 21},
  {"doc": 4, "pat": 12, "st": "completed", "age": 800, "ack": 790, "items": ["maxilar-completo"], "appts": [{"d": -18, "t": "10:30", "s": "completed", "items": ["maxilar-completo"], "tech": 3, "cal": 1, "ses": 1}], "n": 22},
  {"doc": 2, "pat": 6, "st": "cancelled", "age": 190, "ack": 180, "items": ["opt"], "cancel": "El paciente se realizó el estudio en otro centro.", "appts": [{"d": -3, "t": "10:30", "s": "cancelled", "items": ["opt"], "tech": 1, "cal": 1}], "n": 23},
  {"doc": 3, "pat": 9, "st": "cancelled", "age": 60, "items": ["placas-blanqueamiento"], "mods": {"placas-blanqueamiento": {"arcada": ["placas-superior", "placas-inferior"], "borde": ["placas-recto"]}}, "cancel": "Orden duplicada.", "n": 24}
]$orders$::jsonb) AS o;

DO $$
DECLARE
  c     record;  r record;  o jsonb;  a jsonb;  i int;
  v_id  uuid;  v_doc uuid;  v_tech uuid;  v_recep uuid;  v_ack uuid;  v_appt int;  v_ses bigint;
  pat   record;  v_sub timestamp;  v_acked timestamp;  v_start timestamp;  v_end timestamp;
  v_last timestamp;  v_names text;  v_status text;
BEGIN
  SELECT * INTO c FROM _ctx;
  SELECT id INTO v_recep FROM _u WHERE kind = 'recep' AND n = 1;

  FOR r IN SELECT t.o AS j FROM _orders t ORDER BY (t.o ->> 'n')::int LOOP
    o := r.j;
    v_doc := (SELECT id FROM _u WHERE kind = 'doc' AND n = (o ->> 'doc')::int);
    SELECT NULL::uuid AS id, o ->> 'name' AS name, NULL::text AS doc, NULL::text AS email, NULL::text AS phone INTO pat;
    IF o ->> 'pat' IS NOT NULL THEN
      SELECT id, name, doc, email, phone INTO pat FROM _u WHERE kind = 'pat' AND n = (o ->> 'pat')::int;
    END IF;
    v_status := o ->> 'st';
    v_sub    := date_trunc('minute', c.now_local - ((o ->> 'age') || ' hours')::interval);
    v_acked  := date_trunc('minute', c.now_local - ((o ->> 'ack') || ' hours')::interval);
    v_ack    := (SELECT id FROM _u WHERE kind = 'recep' AND n = coalesce((o ->> 'asg')::int, 1));

    INSERT INTO study_orders (order_number, doctor_id, patient_id, patient_name, patient_document, patient_email, patient_phone,
                              status, regions, section_modifiers, texts, delivery_methods, clinical_notes, preferred_sede_id,
                              submitted_at, acknowledged_at, acknowledged_by, cancelled_at, cancellation_reason,
                              created_by, created_at, updated_at, source, referring_doctor_name,
                              assigned_to, assigned_at, assigned_by)
    VALUES ('OE-DEMO-' || lpad(o ->> 'n', 4, '0'), v_doc, pat.id, pat.name, pat.doc, pat.email, pat.phone,
            v_status, coalesce(o -> 'reg', '{}'), coalesce(o -> 'sec', '{}'), coalesce(o -> 'txt', '{}'), coalesce(o -> 'dl', '[]'),
            o ->> 'notes', c.sede_id,
            CASE WHEN v_status <> 'draft' THEN v_sub END, v_acked, CASE WHEN v_acked IS NOT NULL THEN v_ack END,
            CASE WHEN v_status = 'cancelled' THEN c.now_local - interval '20 hours' END, o ->> 'cancel',
            coalesce(v_doc, v_recep), v_sub - interval '10 minutes', v_sub, coalesce(o ->> 'src', 'portal'), o ->> 'ref',
            CASE WHEN o ->> 'asg' IS NOT NULL THEN v_ack END,
            CASE WHEN o ->> 'asg' IS NOT NULL THEN v_acked + interval '5 minutes' END,
            CASE WHEN o ->> 'asg' IS NOT NULL THEN v_recep END)
    RETURNING id INTO v_id;

    INSERT INTO study_order_items (study_order_id, service_id, service_name, section_code, sort_order, modifiers, created_by)
    SELECT v_id, sc.id, sc.name, mc.code, t.ord - 1, coalesce(o -> 'mods' -> t.code, '{}'), coalesce(v_doc, v_recep)
    FROM jsonb_array_elements_text(o -> 'items') WITH ORDINALITY AS t(code, ord)
    JOIN service_catalog sc ON sc.external_id = 'ci-orden:svc:' || t.code
    JOIN miscellaneous_categories mc ON mc.id = sc.category_id;

    IF o -> 'review' IS NOT NULL THEN
      UPDATE study_orders SET review_items = (
        SELECT jsonb_agg(jsonb_build_object(
                 'id', substr(md5((e ->> 'code') || '|' || (e ->> 'field')), 1, 12),
                 'code', e ->> 'code', 'field', e ->> 'field', 'label', e ->> 'label', 'value_read', e ->> 'value',
                 'confidence', e -> 'confidence', 'detail', e ->> 'detail', 'section_code', e ->> 'section_code', 'source', NULL::jsonb,
                 'blocking', NOT coalesce((o ->> 'notblock')::boolean, false), 'status', 'pending',
                 'created_at', to_char(v_sub, 'YYYY-MM-DD"T"HH24:MI:SS')))
        FROM jsonb_array_elements(o -> 'review') e)
      WHERE id = v_id;
    END IF;

    -- Línea de tiempo
    INSERT INTO study_order_events (study_order_id, event_type, actor_id, actor_kind, created_at)
    VALUES (v_id, 'created', coalesce(v_doc, v_recep), 'user', v_sub - interval '10 minutes');
    IF v_status <> 'draft' THEN
      INSERT INTO study_order_events (study_order_id, event_type, actor_id, actor_kind, created_at)
      VALUES (v_id, 'submitted', coalesce(v_doc, v_recep), 'user', v_sub);
    END IF;
    IF v_acked IS NOT NULL THEN
      INSERT INTO study_order_events (study_order_id, event_type, actor_id, actor_kind, created_at)
      VALUES (v_id, 'acknowledged', v_ack, 'user', v_acked);
      IF o ->> 'asg' IS NOT NULL THEN
        INSERT INTO study_order_events (study_order_id, event_type, actor_id, actor_kind, created_at, metadata)
        VALUES (v_id, 'assigned', v_recep, 'user', v_acked + interval '5 minutes',
                jsonb_build_object('assigned_to', v_ack::text, 'assigned_to_name', (SELECT name FROM _u WHERE id = v_ack)));
      END IF;
    END IF;

    -- Citas
    v_last := NULL;
    i := 0;
    FOR a IN SELECT x.value FROM jsonb_array_elements(coalesce(o -> 'appts', '[]')) x LOOP
      i := i + 1;
      v_tech := (SELECT id FROM _u WHERE kind = 'tech' AND n = (a ->> 'tech')::int);
      v_start := pg_temp.bday((a ->> 'd')::int) + (a ->> 't')::time;
      SELECT v_start + make_interval(mins => greatest(15, least(90, sum(sc.duration_minutes)::int))), string_agg(sc.name, E'\n' ORDER BY t.ord)
        INTO v_end, v_names
      FROM jsonb_array_elements_text(a -> 'items') WITH ORDINALITY AS t(code, ord)
      JOIN service_catalog sc ON sc.external_id = 'ci-orden:svc:' || t.code;

      INSERT INTO appointments (patient_id, start_datetime, end_datetime, status, summary, description, notes, created_at, updated_at,
                                assignee_id, technician_id, calendar_source_id, cancellation_reason, study_order_id, external_id, created_by)
      VALUES (pat.id, v_start, v_end, a ->> 's', pat.name || ' - ' || split_part(v_names, E'\n', 1),
              format(E'Cita para: %s\n\nServicios:\n%s\n\nNotas:\n', pat.name, v_names),
              'OE-DEMO-' || lpad(o ->> 'n', 4, '0'),
              least(v_acked + interval '1 hour', v_start - interval '1 hour'), least(v_start, c.now_local),
              v_doc, v_tech, (SELECT id FROM _cal WHERE n = (a ->> 'cal')::int),
              CASE WHEN a ->> 's' = 'cancelled' THEN 'patient_request' END,
              v_id, 'seed:so:appt:' || (o ->> 'n') || ':' || i, v_ack)
      RETURNING id INTO v_appt;

      INSERT INTO appointment_service_catalog (appointment_id, service_id)
      SELECT v_appt, sc.id FROM jsonb_array_elements_text(a -> 'items') AS t(code)
      JOIN service_catalog sc ON sc.external_id = 'ci-orden:svc:' || t.code;

      INSERT INTO study_order_events (study_order_id, event_type, actor_id, actor_kind, appointment_id, created_at)
      VALUES (v_id, 'scheduled', v_ack, 'user', v_appt, least(v_acked + interval '1 hour', v_start - interval '1 hour'));
      IF a ->> 's' = 'cancelled' THEN
        INSERT INTO study_order_events (study_order_id, event_type, actor_id, actor_kind, appointment_id, created_at)
        VALUES (v_id, 'appointment_cancelled', v_ack, 'user', v_appt, least(v_start, c.now_local));
      END IF;

      IF a ->> 'ses' IS NOT NULL THEN
        INSERT INTO sesiones_clinicas (paciente_id, doctor_id, fecha_sesion, procedimiento_realizado, plan_proxima_cita, diagnostico,
                                       notas_clinicas, appointment_id, external_id, created_by)
        VALUES (pat.id, v_tech, v_end AT TIME ZONE 'America/Montevideo', replace(v_names, E'\n', ', '), '', '',
                'Estudio realizado sin incidentes.', v_appt, 'seed:so:sc:' || v_appt, v_tech)
        RETURNING id INTO v_ses;
        INSERT INTO tratamientos_sesion (sesion_id, descripcion_tratamiento, is_for_next_session, service_catalog_id, created_by)
        SELECT v_ses, left(sc.name, 255), false, sc.id, v_tech FROM jsonb_array_elements_text(a -> 'items') AS t(code)
        JOIN service_catalog sc ON sc.external_id = 'ci-orden:svc:' || t.code;
        INSERT INTO study_order_events (study_order_id, event_type, actor_id, actor_kind, appointment_id, created_at)
        VALUES (v_id, 'session_saved', v_tech, 'user', v_appt, v_end);
        v_last := greatest(v_last, v_end);
      END IF;
    END LOOP;

    IF v_status = 'completed' THEN
      UPDATE study_orders SET completed_at = v_last WHERE id = v_id;
      INSERT INTO study_order_events (study_order_id, event_type, actor_kind, created_at) VALUES (v_id, 'completed', 'system', v_last);
    ELSIF v_status = 'cancelled' THEN
      INSERT INTO study_order_events (study_order_id, event_type, actor_id, actor_kind, created_at, metadata)
      VALUES (v_id, 'cancelled', v_recep, 'user', c.now_local - interval '20 hours', jsonb_build_object('reason', o ->> 'cancel'));
    END IF;
  END LOOP;

  -- Chatter (migración 132)
  IF to_regclass('public.study_order_messages') IS NOT NULL THEN
    EXECUTE $q$
      INSERT INTO study_order_messages (study_order_id, author_id, kind, body, created_at)
      SELECT so.id, CASE m.who WHEN 'doc' THEN so.doctor_id ELSE so.acknowledged_by END, m.kind, m.body, so.acknowledged_at + m.delay
      FROM (VALUES
        ('OE-DEMO-0008', 'recep', 'message', '¿Tiene estudios previos de la ATM? Si los hay, que los traiga a la cita.', interval '1 hour'),
        ('OE-DEMO-0008', 'doc',   'message', 'Sí, una resonancia del año pasado. Le aviso.', interval '2 hours'),
        ('OE-DEMO-0008', 'recep', 'note',    'Llamé al paciente: no atiende, reintentar mañana.', interval '3 hours'),
        ('OE-DEMO-0011', 'recep', 'message', 'Quedó agendada la tomografía y el escaneo. Falta el planeamiento.', interval '2 hours')
      ) AS m(num, who, kind, body, delay)
      JOIN study_orders so ON so.order_number = m.num
    $q$;
  ELSE
    RAISE NOTICE 'Sin chatter: falta la migración 132';
  END IF;
END $$;

ALTER TABLE appointments ENABLE TRIGGER trigger_appointment_change;

COMMIT;   -- cambiar por ROLLBACK para probar sin aplicar

-- =============================================================================
-- Resumen (pgAdmin muestra el resultado de esta última consulta)
-- =============================================================================
SELECT 'secciones' AS que, count(*) FROM miscellaneous_categories WHERE external_id LIKE 'ci-orden:cat:%'
UNION ALL SELECT 'estudios', count(*) FROM service_catalog WHERE external_id LIKE 'ci-orden:svc:%'
UNION ALL SELECT 'opciones', count(*) FROM study_order_options WHERE external_id LIKE 'ci-orden:opt:%'
UNION ALL SELECT 'personas', count(*) FROM users WHERE internal_id LIKE 'seed:so:%'
UNION ALL SELECT 'citas', count(*) FROM appointments WHERE external_id LIKE 'seed:so:%'
UNION ALL SELECT 'sesiones clínicas', count(*) FROM sesiones_clinicas WHERE external_id LIKE 'seed:so:%'
UNION ALL SELECT 'órdenes · ' || board_status, count(*) FROM v_study_orders_board WHERE order_number LIKE 'OE-DEMO-%' GROUP BY board_status;
