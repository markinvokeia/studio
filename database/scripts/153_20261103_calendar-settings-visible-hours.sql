-- =====================================================================
-- calendar_settings — franja horaria visible en la agenda
-- Run on: dev / staging / prod
-- Idempotente: se puede correr varias veces sin efectos secundarios.
-- =====================================================================
--
-- Cambios:
--   1. Agrega `visible_hours_mode` (varchar, NOT NULL, default 'full'):
--        'full'   → vista completa (todas las horas del día).
--        'custom' → rango personalizado [visible_hours_start, visible_hours_end).
--        'clinic' → horario laboral de la clínica para el día consultado
--                   (horarios + excepciones, calculado en el frontend).
--   2. Agrega `visible_hours_start` / `visible_hours_end` (time, NULL): el
--      último rango personalizado del usuario. Se conservan aunque el modo
--      cambie, para recuperarlos al volver a 'custom'.
--   3. CHECKs: modo válido y fin posterior al inicio cuando ambos existen.
--      '24:00' es un `time` válido en Postgres y se usa como "fin del día".
--
-- Preferencia POR USUARIO, puramente visual: no toca citas ni horarios.
-- =====================================================================

BEGIN;

ALTER TABLE public.calendar_settings
    ADD COLUMN IF NOT EXISTS visible_hours_mode varchar(10) NOT NULL DEFAULT 'full',
    ADD COLUMN IF NOT EXISTS visible_hours_start time,
    ADD COLUMN IF NOT EXISTS visible_hours_end time;

ALTER TABLE public.calendar_settings
    DROP CONSTRAINT IF EXISTS calendar_settings_visible_hours_mode_check;
ALTER TABLE public.calendar_settings
    ADD CONSTRAINT calendar_settings_visible_hours_mode_check
    CHECK (visible_hours_mode IN ('full', 'custom', 'clinic'));

ALTER TABLE public.calendar_settings
    DROP CONSTRAINT IF EXISTS calendar_settings_visible_hours_range_check;
ALTER TABLE public.calendar_settings
    ADD CONSTRAINT calendar_settings_visible_hours_range_check
    CHECK (
        visible_hours_start IS NULL
        OR visible_hours_end IS NULL
        OR visible_hours_end > visible_hours_start
    );

COMMENT ON COLUMN public.calendar_settings.visible_hours_mode
    IS 'Franja horaria visible en la agenda: full (todas las horas), custom (visible_hours_start..end) o clinic (horario laboral de la clínica del día). Preferencia por usuario, puramente visual. Default full.';
COMMENT ON COLUMN public.calendar_settings.visible_hours_start
    IS 'Inicio del último rango personalizado de la franja visible. Se conserva aunque visible_hours_mode no sea custom.';
COMMENT ON COLUMN public.calendar_settings.visible_hours_end
    IS 'Fin del último rango personalizado de la franja visible (24:00 = fin del día). Debe ser posterior a visible_hours_start.';

-- ─── Registro de migración ────────────────────────────────────────────────────

INSERT INTO db_migrations (script_name, version_tag, notes)
VALUES (
    '153_20261103_calendar-settings-visible-hours.sql',
    'v1',
    'calendar_settings: agrega visible_hours_mode (full/custom/clinic) + visible_hours_start/end (último rango personalizado); preferencia por usuario, default full'
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
-- ALTER TABLE public.calendar_settings
--     DROP CONSTRAINT IF EXISTS calendar_settings_visible_hours_range_check,
--     DROP CONSTRAINT IF EXISTS calendar_settings_visible_hours_mode_check,
--     DROP COLUMN IF EXISTS visible_hours_end,
--     DROP COLUMN IF EXISTS visible_hours_start,
--     DROP COLUMN IF EXISTS visible_hours_mode;
-- DELETE FROM public.db_migrations WHERE script_name = '153_20261103_calendar-settings-visible-hours.sql';
-- COMMIT;
