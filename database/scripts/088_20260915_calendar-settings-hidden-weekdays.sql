-- =====================================================================
-- calendar_settings — columna hidden_weekdays
-- Run on: dev / staging / prod
-- Idempotente: se puede correr varias veces sin efectos secundarios.
-- =====================================================================
--
-- Cambios:
--   1. Agrega columna `hidden_weekdays` (integer[], NOT NULL, default '{}')
--      a calendar_settings. Preferencia POR USUARIO: qué días de la semana
--      se ocultan como columna en las vistas de día/semana del calendario
--      (0=domingo…6=sábado, misma convención que clinic_schedules.day_of_week).
--      Puramente visual — no afecta disponibilidad ni el rango de fechas
--      que se pide al backend.
--   2. CHECK que limita los valores a 0-6, igual criterio que el resto de
--      los CHECK de esta migración (discount_mode, discount_scope, etc.
--      en 068_20260814_clinic-preferences-and-discounts.sql).
-- =====================================================================

BEGIN;

ALTER TABLE public.calendar_settings
    ADD COLUMN IF NOT EXISTS hidden_weekdays integer[] NOT NULL DEFAULT '{}';

ALTER TABLE public.calendar_settings
    DROP CONSTRAINT IF EXISTS check_hidden_weekdays_values;
ALTER TABLE public.calendar_settings
    ADD CONSTRAINT check_hidden_weekdays_values
        CHECK (hidden_weekdays <@ ARRAY[0,1,2,3,4,5,6]::integer[]);

COMMENT ON COLUMN public.calendar_settings.hidden_weekdays
    IS 'Días de la semana ocultos como columna en las vistas de día/semana (0=domingo…6=sábado, igual convención que clinic_schedules.day_of_week). Preferencia por usuario, puramente visual: no afecta disponibilidad ni el rango de fechas pedido al backend.';

-- ─── Registro de migración ────────────────────────────────────────────────────

INSERT INTO db_migrations (script_name, version_tag, notes)
VALUES (
    '083_20260915_calendar-settings-hidden-weekdays.sql',
    'v1',
    'calendar_settings: agrega columna hidden_weekdays para ocultar días de la semana en las vistas de día/semana del calendario (preferencia por usuario)'
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
-- ALTER TABLE public.calendar_settings DROP CONSTRAINT IF EXISTS check_hidden_weekdays_values;
-- ALTER TABLE public.calendar_settings DROP COLUMN IF EXISTS hidden_weekdays;
-- DELETE FROM public.db_migrations WHERE script_name = '083_20260915_calendar-settings-hidden-weekdays.sql';
-- COMMIT;
