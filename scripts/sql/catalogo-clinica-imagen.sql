-- ============================================================================
--  Clínica Imagen — Categorías + catálogo de servicios
--  Generado por scripts/generate-service-catalog.mjs el 2026-09-06
--  Fuente: https://clinicaimagen.uy/ordenes/orden.html
--  12 categorías (public.miscellaneous_categories) · 69 servicios (public.service_catalog).
--
--  Los nombres de servicio son el `value` del checkbox del formulario, tal
--  cual. No hay nombres inventados.
--
--  IDEMPOTENTE por external_id (único en las dos tablas):
--     categorías -> 'ci-orden:cat:<CODE>'
--     servicios  -> 'ci-orden:svc:<id del checkbox>'
--  Re-correrlo no duplica ni pisa filas. Para volver atrás, el bloque del
--  final borra exactamente lo que este script insertó.
--
--  El vínculo servicio->categoría es category_id (FK). Se completa además
--  el campo legacy `category` porque el front lee `category_name || category`.
--
--  >>> PRECIOS: todas las filas salen en 0. Cargalos antes de facturar.
--  NOTA: service_catalog tiene un trigger de auditoría; esta carga escribe
--  69 filas en el log de cambios.
-- ============================================================================

BEGIN;

-- ── PASO 1 · Categorías ────────────────────────────────────────────────────
WITH cats (code, name, description, category_type, external_id) AS (
  VALUES
    ('RX-INTRA', 'Radiografías intrabucales', 'Sección "Radiografías intrabucales" de la orden de estudio.', 'income', 'ci-orden:cat:RX-INTRA'),
    ('EST-EXTRA', 'Otros estudios extraorales', 'Sección "Otros estudios extraorales" de la orden de estudio.', 'income', 'ci-orden:cat:EST-EXTRA'),
    ('RX-EXTRA', 'Radiografías extraorales', 'Sección "Radiografías extraorales" (documentación para ortodoncia).', 'income', 'ci-orden:cat:RX-EXTRA'),
    ('CEFALO', 'Estudios cefalométricos computarizados', 'Sección "Estudios cefalométricos computarizados" de la orden.', 'income', 'ci-orden:cat:CEFALO'),
    ('FOTO', 'Fotografías', 'Sección "Fotografías" de la orden de estudio.', 'income', 'ci-orden:cat:FOTO'),
    ('MOD-DIG', 'Modelos digitales', 'Sección "Modelos digitales (con visualizador 3D)" e impresión de modelos.', 'income', 'ci-orden:cat:MOD-DIG'),
    ('ALINEA', 'Ortodoncia invisible (alineadores)', 'Sección "Ortodoncia invisible (alineadores)" de la orden.', 'income', 'ci-orden:cat:ALINEA'),
    ('CONEBEAM', 'Tomografía computarizada volumétrica Cone Beam', 'Sección "Tomografía computarizada volumétrica Cone Beam" de la orden.', 'income', 'ci-orden:cat:CONEBEAM'),
    ('CIR-GUIA', 'Cirugía guiada para implantes', 'Sección "Cirugía guiada para implantes" de la orden.', 'income', 'ci-orden:cat:CIR-GUIA'),
    ('M3DMIX', 'Realidad virtual M3DMIX', 'Sección "Realidad virtual M3DMIX" de la orden.', 'income', 'ci-orden:cat:M3DMIX'),
    ('ECO', 'Ecografías', 'Sección "Ecografías" del formulario web.', 'income', 'ci-orden:cat:ECO'),
    ('OTROS-SRV', 'Otros servicios', 'Sección "Otros servicios" de la orden de estudio.', 'income', 'ci-orden:cat:OTROS-SRV')
)
INSERT INTO public.miscellaneous_categories (code, name, description, category_type, is_active, external_id)
SELECT c.code, c.name, c.description, c.category_type, true, c.external_id
  FROM cats c
 WHERE NOT EXISTS (
   SELECT 1 FROM public.miscellaneous_categories m
    WHERE m.external_id = c.external_id OR LOWER(m.name) = LOWER(c.name)
 );

-- ── PASO 2 · Cortafuegos ───────────────────────────────────────────────────
-- Ningún servicio puede insertarse sin su categoría: si falta alguna, la
-- transacción aborta acá y no se escribe nada.
DO $$
DECLARE faltan text;
BEGIN
  SELECT string_agg(c.name, ', ')
    INTO faltan
    FROM (VALUES
      ('Radiografías intrabucales', 'ci-orden:cat:RX-INTRA'),
      ('Otros estudios extraorales', 'ci-orden:cat:EST-EXTRA'),
      ('Radiografías extraorales', 'ci-orden:cat:RX-EXTRA'),
      ('Estudios cefalométricos computarizados', 'ci-orden:cat:CEFALO'),
      ('Fotografías', 'ci-orden:cat:FOTO'),
      ('Modelos digitales', 'ci-orden:cat:MOD-DIG'),
      ('Ortodoncia invisible (alineadores)', 'ci-orden:cat:ALINEA'),
      ('Tomografía computarizada volumétrica Cone Beam', 'ci-orden:cat:CONEBEAM'),
      ('Cirugía guiada para implantes', 'ci-orden:cat:CIR-GUIA'),
      ('Realidad virtual M3DMIX', 'ci-orden:cat:M3DMIX'),
      ('Ecografías', 'ci-orden:cat:ECO'),
      ('Otros servicios', 'ci-orden:cat:OTROS-SRV')
    ) AS c(name, external_id)
   WHERE NOT EXISTS (
     SELECT 1 FROM public.miscellaneous_categories m
      WHERE m.external_id = c.external_id OR LOWER(m.name) = LOWER(c.name)
   );
  IF faltan IS NOT NULL THEN
    RAISE EXCEPTION 'Faltan categorías en public.miscellaneous_categories: %', faltan;
  END IF;
END $$;

-- ── PASO 3 · Servicios, colgados de su categoría por category_id ───────────
WITH nuevos (external_id, name, cat_external_id, cat_name, price,
             duration_minutes, currency, description, color) AS (
  VALUES
    ('ci-orden:svc:bitewing', 'Bitewing', 'ci-orden:cat:RX-INTRA', 'Radiografías intrabucales',
     0::numeric(10,2), 10::int, 'UYU', NULL, '#3B82F6'::color_hex),
    ('ci-orden:svc:conductimetria', 'Con conductimetría', 'ci-orden:cat:RX-INTRA', 'Radiografías intrabucales',
     0::numeric(10,2), 15::int, 'UYU', NULL, '#3B82F6'::color_hex),
    ('ci-orden:svc:oclusal', 'Oclusal', 'ci-orden:cat:RX-INTRA', 'Radiografías intrabucales',
     0::numeric(10,2), 10::int, 'UYU', NULL, '#3B82F6'::color_hex),
    ('ci-orden:svc:periapical', 'Periapical', 'ci-orden:cat:RX-INTRA', 'Radiografías intrabucales',
     0::numeric(10,2), 10::int, 'UYU', NULL, '#3B82F6'::color_hex),
    ('ci-orden:svc:periapical-completo', 'Relevamiento periapical completo', 'ci-orden:cat:RX-INTRA', 'Radiografías intrabucales',
     0::numeric(10,2), 30::int, 'UYU', NULL, '#3B82F6'::color_hex),
    ('ci-orden:svc:ATM', 'ATM (Boca abierta y cerrada) (LAMINOGRAFÍA)', 'ci-orden:cat:EST-EXTRA', 'Otros estudios extraorales',
     0::numeric(10,2), 20::int, 'UYU', NULL, '#6366F1'::color_hex),
    ('ci-orden:svc:mano-puno', 'Mano y puño (Carpal)', 'ci-orden:cat:EST-EXTRA', 'Otros estudios extraorales',
     0::numeric(10,2), 15::int, 'UYU', NULL, '#6366F1'::color_hex),
    ('ci-orden:svc:sub-m-vertex', 'Sub mentón Vertex', 'ci-orden:cat:EST-EXTRA', 'Otros estudios extraorales',
     0::numeric(10,2), 15::int, 'UYU', NULL, '#6366F1'::color_hex),
    ('ci-orden:svc:opt', 'Panorámica (OPT)', 'ci-orden:cat:RX-EXTRA', 'Radiografías extraorales',
     0::numeric(10,2), 10::int, 'UYU', NULL, '#0EA5E9'::color_hex),
    ('ci-orden:svc:telerradio-frontal', 'Telerradiografía Frontal', 'ci-orden:cat:RX-EXTRA', 'Radiografías extraorales',
     0::numeric(10,2), 10::int, 'UYU', NULL, '#0EA5E9'::color_hex),
    ('ci-orden:svc:telerradio-perfil', 'Telerradiografía Perfil', 'ci-orden:cat:RX-EXTRA', 'Radiografías extraorales',
     0::numeric(10,2), 10::int, 'UYU', NULL, '#0EA5E9'::color_hex),
    ('ci-orden:svc:bjork', 'Bjork Jarabak', 'ci-orden:cat:CEFALO', 'Estudios cefalométricos computarizados',
     0::numeric(10,2), 15::int, 'UYU', NULL, '#8B5CF6'::color_hex),
    ('ci-orden:svc:funcacion-gnathos', 'Fundación Gnathos', 'ci-orden:cat:CEFALO', 'Estudios cefalométricos computarizados',
     0::numeric(10,2), 15::int, 'UYU', NULL, '#8B5CF6'::color_hex),
    ('ci-orden:svc:mcnamara', 'Mcnamara', 'ci-orden:cat:CEFALO', 'Estudios cefalométricos computarizados',
     0::numeric(10,2), 15::int, 'UYU', NULL, '#8B5CF6'::color_hex),
    ('ci-orden:svc:ricketts', 'Ricketts', 'ci-orden:cat:CEFALO', 'Estudios cefalométricos computarizados',
     0::numeric(10,2), 15::int, 'UYU', NULL, '#8B5CF6'::color_hex),
    ('ci-orden:svc:ricketts-resumido', 'Ricketts Resumido', 'ci-orden:cat:CEFALO', 'Estudios cefalométricos computarizados',
     0::numeric(10,2), 15::int, 'UYU', NULL, '#8B5CF6'::color_hex),
    ('ci-orden:svc:roth-jarabak', 'Roth Jarabak', 'ci-orden:cat:CEFALO', 'Estudios cefalométricos computarizados',
     0::numeric(10,2), 15::int, 'UYU', NULL, '#8B5CF6'::color_hex),
    ('ci-orden:svc:steiner', 'Steiner Tweed', 'ci-orden:cat:CEFALO', 'Estudios cefalométricos computarizados',
     0::numeric(10,2), 15::int, 'UYU', NULL, '#8B5CF6'::color_hex),
    ('ci-orden:svc:trevis', 'Trevis', 'ci-orden:cat:CEFALO', 'Estudios cefalométricos computarizados',
     0::numeric(10,2), 15::int, 'UYU', NULL, '#8B5CF6'::color_hex),
    ('ci-orden:svc:vto', 'VTO', 'ci-orden:cat:CEFALO', 'Estudios cefalométricos computarizados',
     0::numeric(10,2), 20::int, 'UYU', NULL, '#8B5CF6'::color_hex),
    ('ci-orden:svc:ft-oclusion', '1 anterior en inoclusión', 'ci-orden:cat:FOTO', 'Fotografías',
     0::numeric(10,2), 10::int, 'UYU', NULL, '#EC4899'::color_hex),
    ('ci-orden:svc:ft-oclusion-frente', '1 oclusión frente', 'ci-orden:cat:FOTO', 'Fotografías',
     0::numeric(10,2), 10::int, 'UYU', NULL, '#EC4899'::color_hex),
    ('ci-orden:svc:ft-llave-oclusion', '2 llaves de oclusión', 'ci-orden:cat:FOTO', 'Fotografías',
     0::numeric(10,2), 10::int, 'UYU', NULL, '#EC4899'::color_hex),
    ('ci-orden:svc:ft-oclusal-2', '2 oclusales', 'ci-orden:cat:FOTO', 'Fotografías',
     0::numeric(10,2), 10::int, 'UYU', NULL, '#EC4899'::color_hex),
    ('ci-orden:svc:ft-overjet', '2 overjet/overbite', 'ci-orden:cat:FOTO', 'Fotografías',
     0::numeric(10,2), 10::int, 'UYU', NULL, '#EC4899'::color_hex),
    ('ci-orden:svc:ft-tres-cuartos', '3/4 perfil', 'ci-orden:cat:FOTO', 'Fotografías',
     0::numeric(10,2), 10::int, 'UYU', NULL, '#EC4899'::color_hex),
    ('ci-orden:svc:contacto-oclusal', 'con contacto oclusales', 'ci-orden:cat:FOTO', 'Fotografías',
     0::numeric(10,2), 10::int, 'UYU', NULL, '#EC4899'::color_hex),
    ('ci-orden:svc:ft-dinamica', 'foto en dinámica', 'ci-orden:cat:FOTO', 'Fotografías',
     0::numeric(10,2), 15::int, 'UYU', NULL, '#EC4899'::color_hex),
    ('ci-orden:svc:ft-perfil', 'Perfil', 'ci-orden:cat:FOTO', 'Fotografías',
     0::numeric(10,2), 10::int, 'UYU', NULL, '#EC4899'::color_hex),
    ('ci-orden:svc:ft-rostro-frente', 'Rostro frente', 'ci-orden:cat:FOTO', 'Fotografías',
     0::numeric(10,2), 10::int, 'UYU', NULL, '#EC4899'::color_hex),
    ('ci-orden:svc:ft-rostro-sonrisa', 'Rostro sonrisa', 'ci-orden:cat:FOTO', 'Fotografías',
     0::numeric(10,2), 10::int, 'UYU', NULL, '#EC4899'::color_hex),
    ('ci-orden:svc:fotografias-todas', 'Todas las fotografías', 'ci-orden:cat:FOTO', 'Fotografías',
     0::numeric(10,2), 30::int, 'UYU', NULL, '#EC4899'::color_hex),
    ('ci-orden:svc:diagnosticobolton', 'Diagnóstico bolton', 'ci-orden:cat:MOD-DIG', 'Modelos digitales',
     0::numeric(10,2), 15::int, 'UYU', NULL, '#14B8A6'::color_hex),
    ('ci-orden:svc:diagnosticodentarias', 'Diagnóstico Medidas dentarias', 'ci-orden:cat:MOD-DIG', 'Modelos digitales',
     0::numeric(10,2), 15::int, 'UYU', NULL, '#14B8A6'::color_hex),
    ('ci-orden:svc:diagnosticomoyers', 'Diagnóstico Moyers', 'ci-orden:cat:MOD-DIG', 'Modelos digitales',
     0::numeric(10,2), 15::int, 'UYU', NULL, '#14B8A6'::color_hex),
    ('ci-orden:svc:duplicado-yeso', 'Duplicado en yeso', 'ci-orden:cat:MOD-DIG', 'Modelos digitales',
     0::numeric(10,2), 30::int, 'UYU', NULL, '#14B8A6'::color_hex),
    ('ci-orden:svc:modelos-trabajo', 'Impresión de modelos de trabajo', 'ci-orden:cat:MOD-DIG', 'Modelos digitales',
     0::numeric(10,2), 30::int, 'UYU', NULL, '#14B8A6'::color_hex),
    ('ci-orden:svc:modelo-zocalados', 'Impresión de modelos zocalados', 'ci-orden:cat:MOD-DIG', 'Modelos digitales',
     0::numeric(10,2), 30::int, 'UYU', NULL, '#14B8A6'::color_hex),
    ('ci-orden:svc:modelo-articulado', 'Modelos articulados con bisagra posterior', 'ci-orden:cat:MOD-DIG', 'Modelos digitales',
     0::numeric(10,2), 40::int, 'UYU', NULL, '#14B8A6'::color_hex),
    ('ci-orden:svc:Ortodoncia', 'Ortodoncia', 'ci-orden:cat:MOD-DIG', 'Modelos digitales',
     0::numeric(10,2), 30::int, 'UYU', NULL, '#14B8A6'::color_hex),
    ('ci-orden:svc:Ortopedia', 'Ortopedia', 'ci-orden:cat:MOD-DIG', 'Modelos digitales',
     0::numeric(10,2), 30::int, 'UYU', NULL, '#14B8A6'::color_hex),
    ('ci-orden:svc:ortodoncia-bimaxilar', 'Bimaxilar', 'ci-orden:cat:ALINEA', 'Ortodoncia invisible (alineadores)',
     0::numeric(10,2), 45::int, 'UYU', NULL, '#10B981'::color_hex),
    ('ci-orden:svc:ortodoncia-mandibula', 'Mandíbula', 'ci-orden:cat:ALINEA', 'Ortodoncia invisible (alineadores)',
     0::numeric(10,2), 40::int, 'UYU', NULL, '#10B981'::color_hex),
    ('ci-orden:svc:ortodoncia-maxilar', 'Maxilar', 'ci-orden:cat:ALINEA', 'Ortodoncia invisible (alineadores)',
     0::numeric(10,2), 40::int, 'UYU', NULL, '#10B981'::color_hex),
    ('ci-orden:svc:tomo-piezas', '1 a 3 piezas', 'ci-orden:cat:CONEBEAM', 'Tomografía computarizada volumétrica Cone Beam',
     0::numeric(10,2), 15::int, 'UYU', NULL, '#F59E0B'::color_hex),
    ('ci-orden:svc:hemiarco', 'Hemiarco', 'ci-orden:cat:CONEBEAM', 'Tomografía computarizada volumétrica Cone Beam',
     0::numeric(10,2), 20::int, 'UYU', NULL, '#F59E0B'::color_hex),
    ('ci-orden:svc:mandibula-completa', 'Mandíbula completa', 'ci-orden:cat:CONEBEAM', 'Tomografía computarizada volumétrica Cone Beam',
     0::numeric(10,2), 20::int, 'UYU', NULL, '#F59E0B'::color_hex),
    ('ci-orden:svc:maxilar-completo', 'Maxilar completo', 'ci-orden:cat:CONEBEAM', 'Tomografía computarizada volumétrica Cone Beam',
     0::numeric(10,2), 20::int, 'UYU', NULL, '#F59E0B'::color_hex),
    ('ci-orden:svc:servicio-escaneo', 'Escaneo', 'ci-orden:cat:CIR-GUIA', 'Cirugía guiada para implantes',
     0::numeric(10,2), 30::int, 'UYU', NULL, '#EF4444'::color_hex),
    ('ci-orden:svc:guia-fresa', 'Guía de fresa iniciadora', 'ci-orden:cat:CIR-GUIA', 'Cirugía guiada para implantes',
     0::numeric(10,2), 45::int, 'UYU', NULL, '#EF4444'::color_hex),
    ('ci-orden:svc:guia-precision', 'Guía de precisión', 'ci-orden:cat:CIR-GUIA', 'Cirugía guiada para implantes',
     0::numeric(10,2), 60::int, 'UYU', NULL, '#EF4444'::color_hex),
    ('ci-orden:svc:servicio-planeamiento', 'Planeamiento', 'ci-orden:cat:CIR-GUIA', 'Cirugía guiada para implantes',
     0::numeric(10,2), 60::int, 'UYU', 'Trabajo de laboratorio: no ocupa sillón.', '#EF4444'::color_hex),
    ('ci-orden:svc:servicio-tomografia', 'Tomografía', 'ci-orden:cat:CIR-GUIA', 'Cirugía guiada para implantes',
     0::numeric(10,2), 20::int, 'UYU', NULL, '#EF4444'::color_hex),
    ('ci-orden:svc:m3dmix-maxilares-implantes', 'Maxilares e implantes', 'ci-orden:cat:M3DMIX', 'Realidad virtual M3DMIX',
     0::numeric(10,2), 30::int, 'UYU', NULL, '#A855F7'::color_hex),
    ('ci-orden:svc:m3dmix-mandibular', 'Nervio mandibular', 'ci-orden:cat:M3DMIX', 'Realidad virtual M3DMIX',
     0::numeric(10,2), 30::int, 'UYU', NULL, '#A855F7'::color_hex),
    ('ci-orden:svc:m3dmix-patologia', 'Patología', 'ci-orden:cat:M3DMIX', 'Realidad virtual M3DMIX',
     0::numeric(10,2), 30::int, 'UYU', NULL, '#A855F7'::color_hex),
    ('ci-orden:svc:m3dmix-tercer-molar', 'Tercer molar', 'ci-orden:cat:M3DMIX', 'Realidad virtual M3DMIX',
     0::numeric(10,2), 30::int, 'UYU', NULL, '#A855F7'::color_hex),
    ('ci-orden:svc:eco-atm', 'ATM', 'ci-orden:cat:ECO', 'Ecografías',
     0::numeric(10,2), 20::int, 'UYU', NULL, '#06B6D4'::color_hex),
    ('ci-orden:svc:eco-partes-blandas', 'Partes blandas', 'ci-orden:cat:ECO', 'Ecografías',
     0::numeric(10,2), 20::int, 'UYU', NULL, '#06B6D4'::color_hex),
    ('ci-orden:svc:diseno-sonrisa', 'Diseño sonrisa e impresión en resina mockup', 'ci-orden:cat:OTROS-SRV', 'Otros servicios',
     0::numeric(10,2), 60::int, 'UYU', 'Fotografías + Escaneo bucal + Diseño + Impresión modelo', '#64748B'::color_hex),
    ('ci-orden:svc:DAM', 'Dispositivo avance mandibular (DAM)', 'ci-orden:cat:OTROS-SRV', 'Otros servicios',
     0::numeric(10,2), 45::int, 'UYU', NULL, '#64748B'::color_hex),
    ('ci-orden:svc:endoguide', 'Endoguide', 'ci-orden:cat:OTROS-SRV', 'Otros servicios',
     0::numeric(10,2), 60::int, 'UYU', 'Tomografía + escaneo + planeamiento + guía impresa', '#64748B'::color_hex),
    ('ci-orden:svc:escaneo-ortodoncia-placas', 'Escaneo final de ortodoncia + placas de contención', 'ci-orden:cat:OTROS-SRV', 'Otros servicios',
     0::numeric(10,2), 45::int, 'UYU', NULL, '#64748B'::color_hex),
    ('ci-orden:svc:perioguide', 'Perioguide para cirugía gingival', 'ci-orden:cat:OTROS-SRV', 'Otros servicios',
     0::numeric(10,2), 60::int, 'UYU', 'Escaneo bucal + Impresión de modelo + guías', '#64748B'::color_hex),
    ('ci-orden:svc:DOE', 'Placa neuromiorelajante/DOE', 'ci-orden:cat:OTROS-SRV', 'Otros servicios',
     0::numeric(10,2), 45::int, 'UYU', 'Escaneado bucal + Planeamiento + Placa impresa', '#64748B'::color_hex),
    ('ci-orden:svc:placas-blanqueamiento', 'Placas de blanqueamiento', 'ci-orden:cat:OTROS-SRV', 'Otros servicios',
     0::numeric(10,2), 40::int, 'UYU', 'Escaneo bucal + Impresión de modelo + placas', '#64748B'::color_hex),
    ('ci-orden:svc:cirugia-ortognatica', 'Planeamiento cirugía ortognática', 'ci-orden:cat:OTROS-SRV', 'Otros servicios',
     0::numeric(10,2), 90::int, 'UYU', 'Escaneo bucal + tomografía + planeamiento + Splits', '#64748B'::color_hex),
    ('ci-orden:svc:protector-bucal', 'Protector bucal', 'ci-orden:cat:OTROS-SRV', 'Otros servicios',
     0::numeric(10,2), 40::int, 'UYU', 'Escaneo + modelo + protector bucal', '#64748B'::color_hex),
    ('ci-orden:svc:solo-escaneo', 'Sólo escaneo', 'ci-orden:cat:OTROS-SRV', 'Otros servicios',
     0::numeric(10,2), 30::int, 'UYU', NULL, '#64748B'::color_hex)
)
INSERT INTO public.service_catalog
       (name, description, category, category_id, duration_minutes, price,
        currency, is_active, is_sales, color, service_type, external_id)
SELECT n.name, n.description, n.cat_name, mc.id, n.duration_minutes, n.price,
       n.currency, true, true, n.color, 'single', n.external_id
  FROM nuevos n
  JOIN LATERAL (
    SELECT m.id FROM public.miscellaneous_categories m
     WHERE m.external_id = n.cat_external_id OR LOWER(m.name) = LOWER(n.cat_name)
     ORDER BY (m.external_id = n.cat_external_id) DESC NULLS LAST, m.id
     LIMIT 1
  ) mc ON true
 WHERE NOT EXISTS (
   SELECT 1 FROM public.service_catalog s
    WHERE LOWER(s.name) = LOWER(n.name) OR s.external_id = n.external_id
 );

-- ── PASO 4 · Verificación ──────────────────────────────────────────────────
-- (a) Qué quedó cargado y cuánto falta tarifar.
SELECT m.code, m.name AS categoria,
       COUNT(s.id)                            AS servicios,
       COUNT(*) FILTER (WHERE s.price = 0)    AS sin_precio
  FROM public.miscellaneous_categories m
  LEFT JOIN public.service_catalog s ON s.category_id = m.id
 WHERE m.external_id IN ('ci-orden:cat:RX-INTRA', 'ci-orden:cat:EST-EXTRA', 'ci-orden:cat:RX-EXTRA', 'ci-orden:cat:CEFALO', 'ci-orden:cat:FOTO', 'ci-orden:cat:MOD-DIG', 'ci-orden:cat:ALINEA', 'ci-orden:cat:CONEBEAM', 'ci-orden:cat:CIR-GUIA', 'ci-orden:cat:M3DMIX', 'ci-orden:cat:ECO', 'ci-orden:cat:OTROS-SRV')
 GROUP BY m.code, m.name
 ORDER BY m.code;

-- (b) Servicios del formulario que NO se insertaron porque el nombre ya
--     existía en el catálogo (service_catalog.name es UNIQUE). Nombres como
--     "Perfil", "Ortodoncia", "Tomografía" o "Escaneo" son propensos a chocar.
--     Si aparecen filas, revisá si son el mismo servicio o hay que renombrar.
WITH esperados (external_id, name) AS (
  VALUES
    ('ci-orden:svc:bitewing', 'Bitewing'),
    ('ci-orden:svc:conductimetria', 'Con conductimetría'),
    ('ci-orden:svc:oclusal', 'Oclusal'),
    ('ci-orden:svc:periapical', 'Periapical'),
    ('ci-orden:svc:periapical-completo', 'Relevamiento periapical completo'),
    ('ci-orden:svc:ATM', 'ATM (Boca abierta y cerrada) (LAMINOGRAFÍA)'),
    ('ci-orden:svc:mano-puno', 'Mano y puño (Carpal)'),
    ('ci-orden:svc:sub-m-vertex', 'Sub mentón Vertex'),
    ('ci-orden:svc:opt', 'Panorámica (OPT)'),
    ('ci-orden:svc:telerradio-frontal', 'Telerradiografía Frontal'),
    ('ci-orden:svc:telerradio-perfil', 'Telerradiografía Perfil'),
    ('ci-orden:svc:bjork', 'Bjork Jarabak'),
    ('ci-orden:svc:funcacion-gnathos', 'Fundación Gnathos'),
    ('ci-orden:svc:mcnamara', 'Mcnamara'),
    ('ci-orden:svc:ricketts', 'Ricketts'),
    ('ci-orden:svc:ricketts-resumido', 'Ricketts Resumido'),
    ('ci-orden:svc:roth-jarabak', 'Roth Jarabak'),
    ('ci-orden:svc:steiner', 'Steiner Tweed'),
    ('ci-orden:svc:trevis', 'Trevis'),
    ('ci-orden:svc:vto', 'VTO'),
    ('ci-orden:svc:ft-oclusion', '1 anterior en inoclusión'),
    ('ci-orden:svc:ft-oclusion-frente', '1 oclusión frente'),
    ('ci-orden:svc:ft-llave-oclusion', '2 llaves de oclusión'),
    ('ci-orden:svc:ft-oclusal-2', '2 oclusales'),
    ('ci-orden:svc:ft-overjet', '2 overjet/overbite'),
    ('ci-orden:svc:ft-tres-cuartos', '3/4 perfil'),
    ('ci-orden:svc:contacto-oclusal', 'con contacto oclusales'),
    ('ci-orden:svc:ft-dinamica', 'foto en dinámica'),
    ('ci-orden:svc:ft-perfil', 'Perfil'),
    ('ci-orden:svc:ft-rostro-frente', 'Rostro frente'),
    ('ci-orden:svc:ft-rostro-sonrisa', 'Rostro sonrisa'),
    ('ci-orden:svc:fotografias-todas', 'Todas las fotografías'),
    ('ci-orden:svc:diagnosticobolton', 'Diagnóstico bolton'),
    ('ci-orden:svc:diagnosticodentarias', 'Diagnóstico Medidas dentarias'),
    ('ci-orden:svc:diagnosticomoyers', 'Diagnóstico Moyers'),
    ('ci-orden:svc:duplicado-yeso', 'Duplicado en yeso'),
    ('ci-orden:svc:modelos-trabajo', 'Impresión de modelos de trabajo'),
    ('ci-orden:svc:modelo-zocalados', 'Impresión de modelos zocalados'),
    ('ci-orden:svc:modelo-articulado', 'Modelos articulados con bisagra posterior'),
    ('ci-orden:svc:Ortodoncia', 'Ortodoncia'),
    ('ci-orden:svc:Ortopedia', 'Ortopedia'),
    ('ci-orden:svc:ortodoncia-bimaxilar', 'Bimaxilar'),
    ('ci-orden:svc:ortodoncia-mandibula', 'Mandíbula'),
    ('ci-orden:svc:ortodoncia-maxilar', 'Maxilar'),
    ('ci-orden:svc:tomo-piezas', '1 a 3 piezas'),
    ('ci-orden:svc:hemiarco', 'Hemiarco'),
    ('ci-orden:svc:mandibula-completa', 'Mandíbula completa'),
    ('ci-orden:svc:maxilar-completo', 'Maxilar completo'),
    ('ci-orden:svc:servicio-escaneo', 'Escaneo'),
    ('ci-orden:svc:guia-fresa', 'Guía de fresa iniciadora'),
    ('ci-orden:svc:guia-precision', 'Guía de precisión'),
    ('ci-orden:svc:servicio-planeamiento', 'Planeamiento'),
    ('ci-orden:svc:servicio-tomografia', 'Tomografía'),
    ('ci-orden:svc:m3dmix-maxilares-implantes', 'Maxilares e implantes'),
    ('ci-orden:svc:m3dmix-mandibular', 'Nervio mandibular'),
    ('ci-orden:svc:m3dmix-patologia', 'Patología'),
    ('ci-orden:svc:m3dmix-tercer-molar', 'Tercer molar'),
    ('ci-orden:svc:eco-atm', 'ATM'),
    ('ci-orden:svc:eco-partes-blandas', 'Partes blandas'),
    ('ci-orden:svc:diseno-sonrisa', 'Diseño sonrisa e impresión en resina mockup'),
    ('ci-orden:svc:DAM', 'Dispositivo avance mandibular (DAM)'),
    ('ci-orden:svc:endoguide', 'Endoguide'),
    ('ci-orden:svc:escaneo-ortodoncia-placas', 'Escaneo final de ortodoncia + placas de contención'),
    ('ci-orden:svc:perioguide', 'Perioguide para cirugía gingival'),
    ('ci-orden:svc:DOE', 'Placa neuromiorelajante/DOE'),
    ('ci-orden:svc:placas-blanqueamiento', 'Placas de blanqueamiento'),
    ('ci-orden:svc:cirugia-ortognatica', 'Planeamiento cirugía ortognática'),
    ('ci-orden:svc:protector-bucal', 'Protector bucal'),
    ('ci-orden:svc:solo-escaneo', 'Sólo escaneo')
)
SELECT e.name AS no_insertado, s.id AS id_existente, s.category AS categoria_existente
  FROM esperados e
  JOIN public.service_catalog s ON LOWER(s.name) = LOWER(e.name)
 WHERE s.external_id IS DISTINCT FROM e.external_id
 ORDER BY e.name;

-- (c) Control de totales.
SELECT COUNT(*) AS servicios_de_la_orden FROM public.service_catalog
 WHERE external_id LIKE 'ci-orden:svc:%';

COMMIT;
-- ROLLBACK;  -- usar en lugar de COMMIT si (b) trae sorpresas o (c) no cuadra

-- ── Deshacer ───────────────────────────────────────────────────────────────
-- Borra exactamente lo que insertó este script y nada más (se apoya en
-- external_id). Las categorías sólo caen si no quedó ningún servicio colgado.
/*
BEGIN;
DELETE FROM public.service_catalog WHERE external_id LIKE 'ci-orden:svc:%';
DELETE FROM public.miscellaneous_categories m
 WHERE m.external_id LIKE 'ci-orden:cat:%'
   AND NOT EXISTS (SELECT 1 FROM public.service_catalog s WHERE s.category_id = m.id);
COMMIT;
*/

-- ── Opcional: re-sincronizar filas ya existentes ───────────────────────────
-- Refresca categoría, duración y color sin tocar price ni is_active.
/*
BEGIN;
WITH v (external_id, cat_external_id, duration_minutes, color) AS (
  VALUES
    ('ci-orden:svc:bitewing', 'ci-orden:cat:RX-INTRA', 10::int, '#3B82F6'::color_hex),
    ('ci-orden:svc:conductimetria', 'ci-orden:cat:RX-INTRA', 15::int, '#3B82F6'::color_hex),
    ('ci-orden:svc:oclusal', 'ci-orden:cat:RX-INTRA', 10::int, '#3B82F6'::color_hex),
    ('ci-orden:svc:periapical', 'ci-orden:cat:RX-INTRA', 10::int, '#3B82F6'::color_hex),
    ('ci-orden:svc:periapical-completo', 'ci-orden:cat:RX-INTRA', 30::int, '#3B82F6'::color_hex),
    ('ci-orden:svc:ATM', 'ci-orden:cat:EST-EXTRA', 20::int, '#6366F1'::color_hex),
    ('ci-orden:svc:mano-puno', 'ci-orden:cat:EST-EXTRA', 15::int, '#6366F1'::color_hex),
    ('ci-orden:svc:sub-m-vertex', 'ci-orden:cat:EST-EXTRA', 15::int, '#6366F1'::color_hex),
    ('ci-orden:svc:opt', 'ci-orden:cat:RX-EXTRA', 10::int, '#0EA5E9'::color_hex),
    ('ci-orden:svc:telerradio-frontal', 'ci-orden:cat:RX-EXTRA', 10::int, '#0EA5E9'::color_hex),
    ('ci-orden:svc:telerradio-perfil', 'ci-orden:cat:RX-EXTRA', 10::int, '#0EA5E9'::color_hex),
    ('ci-orden:svc:bjork', 'ci-orden:cat:CEFALO', 15::int, '#8B5CF6'::color_hex),
    ('ci-orden:svc:funcacion-gnathos', 'ci-orden:cat:CEFALO', 15::int, '#8B5CF6'::color_hex),
    ('ci-orden:svc:mcnamara', 'ci-orden:cat:CEFALO', 15::int, '#8B5CF6'::color_hex),
    ('ci-orden:svc:ricketts', 'ci-orden:cat:CEFALO', 15::int, '#8B5CF6'::color_hex),
    ('ci-orden:svc:ricketts-resumido', 'ci-orden:cat:CEFALO', 15::int, '#8B5CF6'::color_hex),
    ('ci-orden:svc:roth-jarabak', 'ci-orden:cat:CEFALO', 15::int, '#8B5CF6'::color_hex),
    ('ci-orden:svc:steiner', 'ci-orden:cat:CEFALO', 15::int, '#8B5CF6'::color_hex),
    ('ci-orden:svc:trevis', 'ci-orden:cat:CEFALO', 15::int, '#8B5CF6'::color_hex),
    ('ci-orden:svc:vto', 'ci-orden:cat:CEFALO', 20::int, '#8B5CF6'::color_hex),
    ('ci-orden:svc:ft-oclusion', 'ci-orden:cat:FOTO', 10::int, '#EC4899'::color_hex),
    ('ci-orden:svc:ft-oclusion-frente', 'ci-orden:cat:FOTO', 10::int, '#EC4899'::color_hex),
    ('ci-orden:svc:ft-llave-oclusion', 'ci-orden:cat:FOTO', 10::int, '#EC4899'::color_hex),
    ('ci-orden:svc:ft-oclusal-2', 'ci-orden:cat:FOTO', 10::int, '#EC4899'::color_hex),
    ('ci-orden:svc:ft-overjet', 'ci-orden:cat:FOTO', 10::int, '#EC4899'::color_hex),
    ('ci-orden:svc:ft-tres-cuartos', 'ci-orden:cat:FOTO', 10::int, '#EC4899'::color_hex),
    ('ci-orden:svc:contacto-oclusal', 'ci-orden:cat:FOTO', 10::int, '#EC4899'::color_hex),
    ('ci-orden:svc:ft-dinamica', 'ci-orden:cat:FOTO', 15::int, '#EC4899'::color_hex),
    ('ci-orden:svc:ft-perfil', 'ci-orden:cat:FOTO', 10::int, '#EC4899'::color_hex),
    ('ci-orden:svc:ft-rostro-frente', 'ci-orden:cat:FOTO', 10::int, '#EC4899'::color_hex),
    ('ci-orden:svc:ft-rostro-sonrisa', 'ci-orden:cat:FOTO', 10::int, '#EC4899'::color_hex),
    ('ci-orden:svc:fotografias-todas', 'ci-orden:cat:FOTO', 30::int, '#EC4899'::color_hex),
    ('ci-orden:svc:diagnosticobolton', 'ci-orden:cat:MOD-DIG', 15::int, '#14B8A6'::color_hex),
    ('ci-orden:svc:diagnosticodentarias', 'ci-orden:cat:MOD-DIG', 15::int, '#14B8A6'::color_hex),
    ('ci-orden:svc:diagnosticomoyers', 'ci-orden:cat:MOD-DIG', 15::int, '#14B8A6'::color_hex),
    ('ci-orden:svc:duplicado-yeso', 'ci-orden:cat:MOD-DIG', 30::int, '#14B8A6'::color_hex),
    ('ci-orden:svc:modelos-trabajo', 'ci-orden:cat:MOD-DIG', 30::int, '#14B8A6'::color_hex),
    ('ci-orden:svc:modelo-zocalados', 'ci-orden:cat:MOD-DIG', 30::int, '#14B8A6'::color_hex),
    ('ci-orden:svc:modelo-articulado', 'ci-orden:cat:MOD-DIG', 40::int, '#14B8A6'::color_hex),
    ('ci-orden:svc:Ortodoncia', 'ci-orden:cat:MOD-DIG', 30::int, '#14B8A6'::color_hex),
    ('ci-orden:svc:Ortopedia', 'ci-orden:cat:MOD-DIG', 30::int, '#14B8A6'::color_hex),
    ('ci-orden:svc:ortodoncia-bimaxilar', 'ci-orden:cat:ALINEA', 45::int, '#10B981'::color_hex),
    ('ci-orden:svc:ortodoncia-mandibula', 'ci-orden:cat:ALINEA', 40::int, '#10B981'::color_hex),
    ('ci-orden:svc:ortodoncia-maxilar', 'ci-orden:cat:ALINEA', 40::int, '#10B981'::color_hex),
    ('ci-orden:svc:tomo-piezas', 'ci-orden:cat:CONEBEAM', 15::int, '#F59E0B'::color_hex),
    ('ci-orden:svc:hemiarco', 'ci-orden:cat:CONEBEAM', 20::int, '#F59E0B'::color_hex),
    ('ci-orden:svc:mandibula-completa', 'ci-orden:cat:CONEBEAM', 20::int, '#F59E0B'::color_hex),
    ('ci-orden:svc:maxilar-completo', 'ci-orden:cat:CONEBEAM', 20::int, '#F59E0B'::color_hex),
    ('ci-orden:svc:servicio-escaneo', 'ci-orden:cat:CIR-GUIA', 30::int, '#EF4444'::color_hex),
    ('ci-orden:svc:guia-fresa', 'ci-orden:cat:CIR-GUIA', 45::int, '#EF4444'::color_hex),
    ('ci-orden:svc:guia-precision', 'ci-orden:cat:CIR-GUIA', 60::int, '#EF4444'::color_hex),
    ('ci-orden:svc:servicio-planeamiento', 'ci-orden:cat:CIR-GUIA', 60::int, '#EF4444'::color_hex),
    ('ci-orden:svc:servicio-tomografia', 'ci-orden:cat:CIR-GUIA', 20::int, '#EF4444'::color_hex),
    ('ci-orden:svc:m3dmix-maxilares-implantes', 'ci-orden:cat:M3DMIX', 30::int, '#A855F7'::color_hex),
    ('ci-orden:svc:m3dmix-mandibular', 'ci-orden:cat:M3DMIX', 30::int, '#A855F7'::color_hex),
    ('ci-orden:svc:m3dmix-patologia', 'ci-orden:cat:M3DMIX', 30::int, '#A855F7'::color_hex),
    ('ci-orden:svc:m3dmix-tercer-molar', 'ci-orden:cat:M3DMIX', 30::int, '#A855F7'::color_hex),
    ('ci-orden:svc:eco-atm', 'ci-orden:cat:ECO', 20::int, '#06B6D4'::color_hex),
    ('ci-orden:svc:eco-partes-blandas', 'ci-orden:cat:ECO', 20::int, '#06B6D4'::color_hex),
    ('ci-orden:svc:diseno-sonrisa', 'ci-orden:cat:OTROS-SRV', 60::int, '#64748B'::color_hex),
    ('ci-orden:svc:DAM', 'ci-orden:cat:OTROS-SRV', 45::int, '#64748B'::color_hex),
    ('ci-orden:svc:endoguide', 'ci-orden:cat:OTROS-SRV', 60::int, '#64748B'::color_hex),
    ('ci-orden:svc:escaneo-ortodoncia-placas', 'ci-orden:cat:OTROS-SRV', 45::int, '#64748B'::color_hex),
    ('ci-orden:svc:perioguide', 'ci-orden:cat:OTROS-SRV', 60::int, '#64748B'::color_hex),
    ('ci-orden:svc:DOE', 'ci-orden:cat:OTROS-SRV', 45::int, '#64748B'::color_hex),
    ('ci-orden:svc:placas-blanqueamiento', 'ci-orden:cat:OTROS-SRV', 40::int, '#64748B'::color_hex),
    ('ci-orden:svc:cirugia-ortognatica', 'ci-orden:cat:OTROS-SRV', 90::int, '#64748B'::color_hex),
    ('ci-orden:svc:protector-bucal', 'ci-orden:cat:OTROS-SRV', 40::int, '#64748B'::color_hex),
    ('ci-orden:svc:solo-escaneo', 'ci-orden:cat:OTROS-SRV', 30::int, '#64748B'::color_hex)
)
UPDATE public.service_catalog s
   SET category_id = m.id, category = m.name,
       duration_minutes = v.duration_minutes, color = v.color
  FROM v JOIN public.miscellaneous_categories m ON m.external_id = v.cat_external_id
 WHERE s.external_id = v.external_id;
COMMIT;
*/
