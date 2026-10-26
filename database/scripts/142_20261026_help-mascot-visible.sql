-- =====================================================================
-- Asistente guiado — "Mascota visible" por clínica
-- Run on: dev / staging / prod
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.
-- Depende de: 141_20261023_help-schema-videos-support.sql
-- =====================================================================
--
-- Cambios:
--   1. system_configurations.help_mascot_visible (boolean, default TRUE).
--      Se edita en Configuración → Preferencias de Clínica → Asistente.
--      TRUE  ⇒ la mascota se ve, guía y se esconde detrás del riel (como hasta ahora).
--      FALSE ⇒ las guías siguen igual (resaltado, globo con la descripción, barra
--              de navegación y lista de pasos) pero sin la mascota; al asistente se
--              entra por el ícono de ayuda del riel.
--      Lo lee GET /help/settings (n8n-workflows/help-settings.json), que puede
--      llamar cualquier usuario con el asistente (system_configurations no).
--
-- Orden de despliegue: este script → importar n8n-workflows/help-settings.json → frontend.
-- =====================================================================

BEGIN;

INSERT INTO public.system_configurations (key, value, data_type, description, is_public)
VALUES ('help_mascot_visible', 'true', 'boolean',
        'Asistente guiado: si la mascota se ve en pantalla. Con false las guías funcionan igual (resaltado, globo, barra y lista de pasos) pero sin la mascota, y al asistente se entra por el ícono de ayuda.',
        false)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.db_migrations (script_name, version_tag, notes)
VALUES (
    '142_20261026_help-mascot-visible.sql',
    'v1',
    'Asistente: system_configurations.help_mascot_visible (default true), lo lee GET /help/settings'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;

-- =====================================================================
-- ROLLBACK (manual)
-- =====================================================================
-- BEGIN;
-- DELETE FROM public.system_configurations WHERE key = 'help_mascot_visible';
-- DELETE FROM public.db_migrations WHERE script_name = '142_20261026_help-mascot-visible.sql';
-- COMMIT;
