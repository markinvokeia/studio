-- =====================================================================
-- calendar_color_source — columna view_highlight
--
--   1. Agrega `view_highlight` (varchar(10), NOT NULL, default 'off') a
--      calendar_color_source. Define cuánto refleja la vista del calendario el
--      color del calendario que se está viendo, para distinguir de un vistazo
--      entre sedes (con un calendario por sede, el color del calendario
--      identifica la sede):
--          'off'    → sin resaltado (comportamiento actual)
--          'subtle' → franja superior con el color del calendario
--          'strong' → marco alrededor de la vista + etiqueta con el nombre
--          'full'   → toda la vista teñida con el color (marco, panel de agendas,
--                     encabezado y grilla); solo la barra de navegación no
--      Vive en la misma fila que el origen del color, así que sigue sus mismas
--      reglas: la fila general (calendar_id NULL) es el valor por defecto de la
--      clínica y un override de un calendario lo REEMPLAZA por completo.
--      Solo se aplica cuando hay UN calendario visible. Independiente del tema.
--   2. CHECK que limita los valores a los cuatro anteriores.
--
-- No requiere permisos nuevos: se edita en Configuración → Colores de
-- Calendario con CALENDAR_DISPLAY_UPDATE.
--
-- Idempotente. Depende de: 119_20260929_calendar-color-source.sql
-- =====================================================================

BEGIN;

ALTER TABLE public.calendar_color_source
    ADD COLUMN IF NOT EXISTS view_highlight varchar(10) NOT NULL DEFAULT 'off';

ALTER TABLE public.calendar_color_source
    DROP CONSTRAINT IF EXISTS check_calendar_color_source_view_highlight;
ALTER TABLE public.calendar_color_source
    ADD CONSTRAINT check_calendar_color_source_view_highlight
        CHECK (view_highlight IN ('off', 'subtle', 'strong', 'full'));

COMMENT ON COLUMN public.calendar_color_source.view_highlight IS
    'Resaltado de la vista con el color del calendario visible: off (default), subtle (franja superior), strong (marco + etiqueta) o full (toda la vista teñida). Solo aplica con un único calendario visible.';

INSERT INTO public.db_migrations (script_name, version_tag, notes)
VALUES (
    '120_20260929_calendar-color-source-highlight.sql',
    'v1',
    'calendar_color_source: agrega view_highlight (off/subtle/strong/full) para reflejar el color del calendario visible en la vista del calendario'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;

-- =====================================================================
-- ROLLBACK (manual, si hiciera falta)
-- =====================================================================
-- BEGIN;
-- ALTER TABLE public.calendar_color_source DROP CONSTRAINT IF EXISTS check_calendar_color_source_view_highlight;
-- ALTER TABLE public.calendar_color_source DROP COLUMN IF EXISTS view_highlight;
-- DELETE FROM public.db_migrations WHERE script_name = '120_20260929_calendar-color-source-highlight.sql';
-- COMMIT;
