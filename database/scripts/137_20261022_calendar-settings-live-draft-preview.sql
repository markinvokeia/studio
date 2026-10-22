-- =====================================================================
-- calendar_settings — columna inline_draft_live_preview
-- Run on: dev / staging / prod
-- Idempotente: se puede correr varias veces sin efectos secundarios.
-- =====================================================================
--
-- Cambios:
--   1. Agrega columna `inline_draft_live_preview` (boolean, NOT NULL,
--      default false) a calendar_settings. Preferencia POR USUARIO: cuando
--      está activa, la tarjeta inline de cita flota al lado de la cita
--      (estilo Google Calendar, sin backdrop) y la cita se previsualiza en
--      vivo en el calendario mientras se completa: duración, fecha, hora,
--      agenda.
--      Al cambiar la fecha el calendario navega a ese día y centra la cita.
--      Solo tablet/desktop; en mobile se mantiene la tarjeta centrada.
--      Puramente visual — no cambia cuándo se abre la tarjeta inline
--      (eso sigue siendo `inline_appointment_creation` / modo custom).
-- =====================================================================

BEGIN;

ALTER TABLE public.calendar_settings
    ADD COLUMN IF NOT EXISTS inline_draft_live_preview boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.calendar_settings.inline_draft_live_preview
    IS 'Tarjeta inline de cita flotando al lado de la cita, con previsualización en vivo de la cita en la grilla (y navegación/centrado al cambiar fecha u hora). Preferencia por usuario, puramente visual. Default false.';

-- ─── Registro de migración ────────────────────────────────────────────────────

INSERT INTO db_migrations (script_name, version_tag, notes)
VALUES (
    '137_20261022_calendar-settings-live-draft-preview.sql',
    'v1',
    'calendar_settings: agrega columna inline_draft_live_preview (tarjeta flotante junto a la cita + previsualización en vivo de la cita inline; preferencia por usuario, default false)'
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
-- ALTER TABLE public.calendar_settings DROP COLUMN IF EXISTS inline_draft_live_preview;
-- DELETE FROM public.db_migrations WHERE script_name = '137_20261022_calendar-settings-live-draft-preview.sql';
-- COMMIT;
