-- =============================================================================
-- Órdenes de estudio — sección de los campos de texto libre
-- =============================================================================
-- La 071 sembró los 14 campos de texto del formulario con section_code NULL, y
-- por eso la UI los mostraba todos juntos al final en vez de dentro de su
-- sección (la indicación debajo de la OPT, la marca del implante en cirugía
-- guiada, etc.).
--
-- La sección de cada campo se deriva ahora de su posición en el formulario
-- (scripts/generate-service-catalog.mjs). Este script pone al día las
-- instalaciones donde la 071 ya está aplicada: el seed de la 071 usa
-- ON CONFLICT DO NOTHING, así que re-correrla no actualizaría estas filas.
--
-- Sólo toca filas del origen 'ci-orden:opt:' y de tipo 'text'.
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.
-- =============================================================================

BEGIN;

UPDATE public.study_order_options o
   SET section_code = v.section_code
  FROM (VALUES
        ('indiacion-opt',              'RX-EXTRA'),
        ('estudio-cefalo-compu-otros', 'CEFALO'),
        ('fotografia-interes',         'FOTO'),
        ('ortodoncia-marca',           'ALINEA'),
        ('ortodoncia-info-clinica',    'ALINEA'),
        ('tomo-elementos-sueltos',     'CONEBEAM'),
        ('interes-estudio-tomo',       'CONEBEAM'),
        ('implante-marca',             'CIR-GUIA'),
        ('implante-ubicacion',         'CIR-GUIA'),
        ('implante-fecha-cirugia',     'CIR-GUIA'),
        ('eco-interes',                'ECO'),
        ('solo-escaneo-interes',       'OTROS-SRV'),
        ('color-protector',            'OTROS-SRV')
       ) AS v(code, section_code)
 WHERE o.code = v.code
   AND o.option_kind = 'text'
   AND o.external_id LIKE 'ci-orden:opt:%'
   AND o.section_code IS DISTINCT FROM v.section_code;

-- `aclaracion` queda deliberadamente sin sección: en la orden impresa está en la
-- cabecera, junto a los datos del profesional solicitante, no dentro de un estudio.

INSERT INTO db_migrations (script_name, version_tag, notes)
VALUES (
    '072_20260906_study-order-text-sections.sql',
    'v1',
    'Órdenes de estudio — asigna section_code a los 13 campos de texto que pertenecen a una sección'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;

-- =============================================================================
-- Rollback manual
-- =============================================================================
-- BEGIN;
-- UPDATE public.study_order_options SET section_code = NULL
--  WHERE option_kind = 'text' AND external_id LIKE 'ci-orden:opt:%';
-- DELETE FROM public.db_migrations WHERE script_name = '072_20260906_study-order-text-sections.sql';
-- COMMIT;
