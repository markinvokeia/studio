-- =============================================================================
-- Órdenes de estudio — carga del catálogo que faltaba
-- =============================================================================
-- Diagnóstico (verificado en DEV el 2026-09-06):
--   miscellaneous_categories con 'ci-orden:cat:%' → 0
--   service_catalog          con 'ci-orden:svc:%' → 0
--   study_order_options                           → 27 de 42
--
-- La 071 se aplicó SIN haber cargado antes el catálogo de Clínica Imagen. Su
-- seed resuelve los modificadores de servicio con
--   INSERT ... SELECT FROM service_catalog WHERE external_id = 'ci-orden:svc:...'
-- y al no existir los servicios, esas 15 filas insertaron 0. Por eso quedaron
-- 27 opciones (4 medios de entrega + 7 modificadores de sección + 2 odontogramas
-- + 14 textos) y el formulario sale sin secciones ni estudios.
--
-- Este script:
--   1. Crea las 12 categorías de la orden.
--   2. Carga los servicios del formulario.
--   3. Adopta PROTECTOR BUCAL, que ya existía en el catálogo de la clínica.
--   4. Siembra los 15 modificadores que faltaron.
--   5. Verifica el resultado.
--
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.
-- No toca precios, is_active ni ningún servicio ajeno a las 12 categorías.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Las 12 categorías = las 12 secciones del formulario
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 2. Servicios del formulario, colgados de su categoría
-- -----------------------------------------------------------------------------
-- Deduplica por LOWER(name): un servicio que la clínica ya tenga NO se duplica,
-- se saltea. El único caso hoy es PROTECTOR BUCAL, que resuelve el paso 3.
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


-- -----------------------------------------------------------------------------
-- 3. PROTECTOR BUCAL — adoptar en vez de duplicar
-- -----------------------------------------------------------------------------
-- El paso 2 saltea este servicio: `service_catalog.name` es UNIQUE y la clínica
-- ya lo tiene cargado como 'PROTECTOR BUCAL' (id 986), con precio 3500 UYU, un
-- presupuesto y una factura asociados.
--
-- Es el MISMO servicio con otro nombre, así que se lo adopta en la sección
-- "Otros servicios" en lugar de crear un duplicado que dividiría el histórico.
--
-- Deliberadamente NO se toca:
--   · external_id  — ya vale '01.9.5', de una importación anterior, y la columna
--                    es única: pisarlo rompería esa correspondencia. Por eso el
--                    endpoint /study-orders/options lista los servicios por
--                    category_id y no por external_id.
--   · price, name, is_active — son datos vivos de la clínica.
--
-- duration_minutes y color sólo se completan si están vacíos.
UPDATE public.service_catalog sc
   SET category_id      = mc.id,
       category         = mc.name,
       duration_minutes = COALESCE(sc.duration_minutes, 40),
       color            = COALESCE(sc.color, '#64748B'::color_hex)
  FROM public.miscellaneous_categories mc
 WHERE mc.external_id = 'ci-orden:cat:OTROS-SRV'
   AND lower(sc.name) = lower('Protector bucal')
   AND sc.category_id IS DISTINCT FROM mc.id;

-- -----------------------------------------------------------------------------
-- 4. Los 15 modificadores que la 071 no pudo sembrar
-- -----------------------------------------------------------------------------
-- Ahora sí encuentran su servicio. ON CONFLICT (external_id) los hace idempotentes.
INSERT INTO public.study_order_options
       (option_kind, code, label, section_code, service_id, group_code, input_type, sort_order, external_id)
SELECT 'modifier', 'telerradio-frontal-analisis', 'Con analisis', 'RX-EXTRA', sc.id, NULL, 'checkbox', 0, 'ci-orden:opt:telerradio-frontal-analisis'
  FROM public.service_catalog sc WHERE sc.external_id = 'ci-orden:svc:telerradio-frontal'
ON CONFLICT (external_id) DO NOTHING;
INSERT INTO public.study_order_options
       (option_kind, code, label, section_code, service_id, group_code, input_type, sort_order, external_id)
SELECT 'modifier', 'frankfort', 'Plano de Frankfort', 'RX-EXTRA', sc.id, 'tecnica', 'checkbox', 1, 'ci-orden:opt:frankfort'
  FROM public.service_catalog sc WHERE sc.external_id = 'ci-orden:svc:telerradio-perfil'
ON CONFLICT (external_id) DO NOTHING;
INSERT INTO public.study_order_options
       (option_kind, code, label, section_code, service_id, group_code, input_type, sort_order, external_id)
SELECT 'modifier', 'horizontal-verdadero', 'Horizontal verdadero', 'RX-EXTRA', sc.id, 'tecnica', 'checkbox', 2, 'ci-orden:opt:horizontal-verdadero'
  FROM public.service_catalog sc WHERE sc.external_id = 'ci-orden:svc:telerradio-perfil'
ON CONFLICT (external_id) DO NOTHING;
INSERT INTO public.study_order_options
       (option_kind, code, label, section_code, service_id, group_code, input_type, sort_order, external_id)
SELECT 'modifier', 'labios-reposo', 'Labios en reposo', 'RX-EXTRA', sc.id, 'tecnica', 'checkbox', 3, 'ci-orden:opt:labios-reposo'
  FROM public.service_catalog sc WHERE sc.external_id = 'ci-orden:svc:telerradio-perfil'
ON CONFLICT (external_id) DO NOTHING;
INSERT INTO public.study_order_options
       (option_kind, code, label, section_code, service_id, group_code, input_type, sort_order, external_id)
SELECT 'modifier', 'labios-contacto', 'Labios en contacto', 'RX-EXTRA', sc.id, 'tecnica', 'checkbox', 4, 'ci-orden:opt:labios-contacto'
  FROM public.service_catalog sc WHERE sc.external_id = 'ci-orden:svc:telerradio-perfil'
ON CONFLICT (external_id) DO NOTHING;
INSERT INTO public.study_order_options
       (option_kind, code, label, section_code, service_id, group_code, input_type, sort_order, external_id)
SELECT 'modifier', 'mordida-constructiva', 'Mordida constructiva', 'MOD-DIG', sc.id, NULL, 'checkbox', 5, 'ci-orden:opt:mordida-constructiva'
  FROM public.service_catalog sc WHERE sc.external_id = 'ci-orden:svc:modelos-trabajo'
ON CONFLICT (external_id) DO NOTHING;
INSERT INTO public.study_order_options
       (option_kind, code, label, section_code, service_id, group_code, input_type, sort_order, external_id)
SELECT 'modifier', 'escaneo-superior', 'SUPERIOR', 'OTROS-SRV', sc.id, 'arcada', 'checkbox', 6, 'ci-orden:opt:escaneo-superior'
  FROM public.service_catalog sc WHERE sc.external_id = 'ci-orden:svc:escaneo-ortodoncia-placas'
ON CONFLICT (external_id) DO NOTHING;
INSERT INTO public.study_order_options
       (option_kind, code, label, section_code, service_id, group_code, input_type, sort_order, external_id)
SELECT 'modifier', 'escaneo-inferior', 'INFERIOR', 'OTROS-SRV', sc.id, 'arcada', 'checkbox', 7, 'ci-orden:opt:escaneo-inferior'
  FROM public.service_catalog sc WHERE sc.external_id = 'ci-orden:svc:escaneo-ortodoncia-placas'
ON CONFLICT (external_id) DO NOTHING;
INSERT INTO public.study_order_options
       (option_kind, code, label, section_code, service_id, group_code, input_type, sort_order, external_id)
SELECT 'modifier', 'escaneo-placa-75', '0.75mm', 'OTROS-SRV', sc.id, 'espesor', 'checkbox', 8, 'ci-orden:opt:escaneo-placa-75'
  FROM public.service_catalog sc WHERE sc.external_id = 'ci-orden:svc:escaneo-ortodoncia-placas'
ON CONFLICT (external_id) DO NOTHING;
INSERT INTO public.study_order_options
       (option_kind, code, label, section_code, service_id, group_code, input_type, sort_order, external_id)
SELECT 'modifier', 'escaneo-placa-1', '1mm', 'OTROS-SRV', sc.id, 'espesor', 'checkbox', 9, 'ci-orden:opt:escaneo-placa-1'
  FROM public.service_catalog sc WHERE sc.external_id = 'ci-orden:svc:escaneo-ortodoncia-placas'
ON CONFLICT (external_id) DO NOTHING;
INSERT INTO public.study_order_options
       (option_kind, code, label, section_code, service_id, group_code, input_type, sort_order, external_id)
SELECT 'modifier', 'escaneo-placa-15', '1.5mm', 'OTROS-SRV', sc.id, 'espesor', 'checkbox', 10, 'ci-orden:opt:escaneo-placa-15'
  FROM public.service_catalog sc WHERE sc.external_id = 'ci-orden:svc:escaneo-ortodoncia-placas'
ON CONFLICT (external_id) DO NOTHING;
INSERT INTO public.study_order_options
       (option_kind, code, label, section_code, service_id, group_code, input_type, sort_order, external_id)
SELECT 'modifier', 'escaneo-recto', 'RECTO', 'OTROS-SRV', sc.id, 'borde', 'checkbox', 11, 'ci-orden:opt:escaneo-recto'
  FROM public.service_catalog sc WHERE sc.external_id = 'ci-orden:svc:escaneo-ortodoncia-placas'
ON CONFLICT (external_id) DO NOTHING;
INSERT INTO public.study_order_options
       (option_kind, code, label, section_code, service_id, group_code, input_type, sort_order, external_id)
SELECT 'modifier', 'escaneo-festoneado', 'FESTONEADO', 'OTROS-SRV', sc.id, 'borde', 'checkbox', 12, 'ci-orden:opt:escaneo-festoneado'
  FROM public.service_catalog sc WHERE sc.external_id = 'ci-orden:svc:escaneo-ortodoncia-placas'
ON CONFLICT (external_id) DO NOTHING;
INSERT INTO public.study_order_options
       (option_kind, code, label, section_code, service_id, group_code, input_type, sort_order, external_id)
SELECT 'modifier', 'placas-superior', 'SUPERIOR', 'OTROS-SRV', sc.id, 'arcada', 'checkbox', 13, 'ci-orden:opt:placas-superior'
  FROM public.service_catalog sc WHERE sc.external_id = 'ci-orden:svc:placas-blanqueamiento'
ON CONFLICT (external_id) DO NOTHING;
INSERT INTO public.study_order_options
       (option_kind, code, label, section_code, service_id, group_code, input_type, sort_order, external_id)
SELECT 'modifier', 'placas-inferior', 'INFERIOR', 'OTROS-SRV', sc.id, 'arcada', 'checkbox', 14, 'ci-orden:opt:placas-inferior'
  FROM public.service_catalog sc WHERE sc.external_id = 'ci-orden:svc:placas-blanqueamiento'
ON CONFLICT (external_id) DO NOTHING;
-- -----------------------------------------------------------------------------
-- 5. Verificación
-- -----------------------------------------------------------------------------
-- (a) Estas cifras tienen que dar 12 categorías, 69 servicios y 42 opciones.
--     Si los servicios dan menos de 69, hay más colisiones de nombre: la
--     consulta (b) las lista.
SELECT (SELECT count(*) FROM public.miscellaneous_categories
         WHERE external_id LIKE 'ci-orden:cat:%')                    AS categorias,
       (SELECT count(*) FROM public.service_catalog sc
          JOIN public.miscellaneous_categories mc ON mc.id = sc.category_id
         WHERE mc.external_id LIKE 'ci-orden:cat:%')                 AS servicios_en_secciones,
       (SELECT count(*) FROM public.study_order_options)             AS opciones,
       (SELECT count(*) FROM public.study_order_options
         WHERE service_id IS NOT NULL)                               AS modificadores_de_servicio;

-- (b) Servicios del formulario que NO quedaron colgados de una sección.
--     Vacío = todo bien. Con filas = ese nombre ya existía en el catálogo de la
--     clínica y hay que decidir si adoptarlo (como PROTECTOR BUCAL) o renombrar.
SELECT sc.id, sc.name, sc.category AS categoria_actual, sc.external_id
  FROM public.service_catalog sc
 WHERE sc.external_id LIKE 'ci-orden:svc:%'
   AND sc.category_id IS NULL
 ORDER BY sc.name;

-- (c) Servicios por sección, tal como los va a mostrar el formulario.
SELECT mc.code, mc.name, count(sc.id) AS servicios
  FROM public.miscellaneous_categories mc
  LEFT JOIN public.service_catalog sc ON sc.category_id = mc.id AND sc.is_active
 WHERE mc.external_id LIKE 'ci-orden:cat:%'
 GROUP BY mc.code, mc.name
 ORDER BY mc.code;

-- -----------------------------------------------------------------------------
-- 6. Registro de migración
-- -----------------------------------------------------------------------------
INSERT INTO db_migrations (script_name, version_tag, notes)
VALUES (
    '073_20260906_study-orders-catalog-backfill.sql',
    'v1',
    'Órdenes de estudio — carga las 12 categorías y los servicios del formulario que faltaban, adopta PROTECTOR BUCAL y siembra los 15 modificadores de servicio que la 071 no pudo insertar'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;
-- ROLLBACK;  -- usar en lugar de COMMIT si la verificación no cuadra

-- =============================================================================
-- Rollback manual
-- =============================================================================
-- Ojo: sólo borra lo que creó este script. PROTECTOR BUCAL se devuelve a estar
-- sin categoría, que es como estaba antes; no se toca su precio ni su nombre.
-- BEGIN;
-- UPDATE public.service_catalog SET category_id = NULL, category = NULL
--  WHERE lower(name) = lower('Protector bucal');
-- DELETE FROM public.study_order_options WHERE service_id IS NOT NULL;
-- DELETE FROM public.service_catalog WHERE external_id LIKE 'ci-orden:svc:%';
-- DELETE FROM public.miscellaneous_categories WHERE external_id LIKE 'ci-orden:cat:%';
-- DELETE FROM public.db_migrations WHERE script_name = '073_20260906_study-orders-catalog-backfill.sql';
-- COMMIT;
