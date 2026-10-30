-- =====================================================================
-- Origen del color de las citas configurable por cliente
--
--   1. public.calendar_color_source → tabla nueva, una fila por
--      (clinic_id, calendar_id). `calendar_id` NULL es la configuración
--      GENERAL de la clínica; no-NULL es un override de ese calendario que
--      REEMPLAZA por completo a la general (no hay herencia campo a campo).
--      Define qué niveles de la cadena de color cuentan al pintar una cita:
--          etiqueta propia de la cita > servicio > doctor > calendario
--      La etiqueta propia no se configura (es una elección explícita del
--      usuario y siempre gana), por eso solo hay tres columnas.
--   2. Seed de la configuración general por clínica con todos los niveles
--      activos: el corte no cambia nada visualmente (es el comportamiento
--      previo, cuando la cadena estaba cableada en el frontend).
--
-- No requiere permisos nuevos: la pantalla vive en Configuración → Colores
-- de Calendario y reutiliza CALENDAR_DISPLAY_VIEW / CALENDAR_DISPLAY_UPDATE
-- (ver 087_20260916_calendar-status-display.sql).
--
-- `calendar_id` referencia `calendar_sources.id` (bigint), NO `calendars`.
--
-- Idempotente. Depende de: 118_20260923_clinic-secondary-currency.sql
-- =====================================================================

BEGIN;

-- -----------------------------------------------------------------------
-- 1. Tabla
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.calendar_color_source (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id     INTEGER     NOT NULL REFERENCES public.clinic (id) ON DELETE CASCADE,
    -- NULL = configuración GENERAL del cliente. No NULL = override de ese calendario.
    calendar_id   BIGINT      REFERENCES public.calendar_sources (id) ON DELETE CASCADE,
    use_service   BOOLEAN     NOT NULL DEFAULT TRUE,
    use_doctor    BOOLEAN     NOT NULL DEFAULT TRUE,
    use_calendar  BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- UNIQUE con calendar_id NULL: dos índices parciales (no depende de PG15).
CREATE UNIQUE INDEX IF NOT EXISTS calendar_color_source_general_uq
    ON public.calendar_color_source (clinic_id) WHERE calendar_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS calendar_color_source_per_calendar_uq
    ON public.calendar_color_source (clinic_id, calendar_id) WHERE calendar_id IS NOT NULL;

COMMENT ON TABLE  public.calendar_color_source              IS 'Qué niveles de la cadena de color de una cita (servicio > doctor > calendario) cuentan al pintarla (Configuración → Colores de calendario → Origen del color). Fila por (clinic_id, calendar_id).';
COMMENT ON COLUMN public.calendar_color_source.calendar_id  IS 'NULL = configuración general de la clínica. No-NULL = override de ese calendario (calendar_sources.id), que reemplaza por completo a la general.';
COMMENT ON COLUMN public.calendar_color_source.use_service  IS 'TRUE: el color del servicio de la cita cuenta en la cadena.';
COMMENT ON COLUMN public.calendar_color_source.use_doctor   IS 'TRUE: el color del doctor asignado cuenta en la cadena.';
COMMENT ON COLUMN public.calendar_color_source.use_calendar IS 'TRUE: el color del calendario (calendar_sources.color) cuenta en la cadena.';

DROP TRIGGER IF EXISTS set_updated_at ON public.calendar_color_source;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.calendar_color_source
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------
-- 2. Seed: configuración general por clínica, todos los niveles activos.
-- -----------------------------------------------------------------------
INSERT INTO public.calendar_color_source (clinic_id, calendar_id, use_service, use_doctor, use_calendar)
SELECT c.id, NULL, TRUE, TRUE, TRUE
FROM public.clinic c
WHERE NOT EXISTS (
    SELECT 1 FROM public.calendar_color_source s
    WHERE s.clinic_id = c.id AND s.calendar_id IS NULL
);

-- -----------------------------------------------------------------------
-- 3. Registro de migración
-- -----------------------------------------------------------------------
INSERT INTO public.db_migrations (script_name, version_tag, notes)
VALUES (
    '119_20260929_calendar-color-source.sql',
    'v1',
    'Origen del color de las citas configurable por cliente y por calendario (tabla calendar_color_source) con seed general con todos los niveles activos'
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
-- DROP TABLE IF EXISTS public.calendar_color_source;
-- DELETE FROM public.db_migrations WHERE script_name = '119_20260929_calendar-color-source.sql';
-- COMMIT;
