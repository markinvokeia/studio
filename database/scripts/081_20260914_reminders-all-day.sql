-- =====================================================================
-- reminders: notas y recordatorios de todo el día
-- Run on: dev / staging / prod
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.
-- =====================================================================
--
-- Contexto:
--   Hasta ahora una nota o un recordatorio siempre ocupa una franja
--   horaria concreta. Se agrega la posibilidad de marcarlo como "todo el
--   día", para que el calendario lo muestre fijo arriba, debajo del
--   nombre del día, en vez de dibujarlo dentro de la rejilla de horas.
--
--   El nombre `is_all_day` no es nuevo: ya estaba en el diseño original
--   de la tabla (docs/appointments-mejoras-plan.md), y se perdió cuando
--   el modelo pasó de date + start_time + end_time a los timestamps que
--   quedaron. Se recupera tal cual.
--
-- Convención:
--   Con is_all_day = true, start_datetime es el día a las 00:00:00 y
--   end_datetime el MISMO día a las 23:59:59.
--
--   No se usan las 00:00 del día siguiente porque todas las vistas del
--   calendario filtran con isSameDay(event.start, day) y el cron de
--   notificaciones compara end_datetime > ahora: con el día siguiente el
--   ítem se escaparía de su propio día. La columna sigue siendo
--   timestamp without time zone — hora de pared de la clínica, sin UTC
--   ni offsets, igual que el resto del módulo.
--
-- Cambios:
--   1. reminders.is_all_day (boolean NOT NULL DEFAULT false)
--   2. CHECK reminders_all_day_range_check, que ata la convención
--
-- Nota: no hace falta backfill. Las 32 filas existentes son todas de
--   franja horaria y quedan con is_all_day = false por el DEFAULT, que
--   es exactamente lo que representan.
-- =====================================================================

BEGIN;

-- ─── 1. La columna ────────────────────────────────────────────────────────────

ALTER TABLE public.reminders
    ADD COLUMN IF NOT EXISTS is_all_day boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.reminders.is_all_day IS
    'Ítem de todo el día: start_datetime = día 00:00:00 y end_datetime = mismo día 23:59:59. '
    'Se muestra en la banda fija del calendario, no dentro de la rejilla de horas.';

-- ─── 2. La convención, atada en la base ───────────────────────────────────────
--
-- El CHECK existe para que ninguna vía de escritura pueda dejar una fila de
-- "todo el día" a medias. El flujo de n8n normaliza las horas en el servidor, pero
-- eso es una promesa del flujo; esto es la garantía.

ALTER TABLE public.reminders
    DROP CONSTRAINT IF EXISTS reminders_all_day_range_check;

ALTER TABLE public.reminders
    ADD CONSTRAINT reminders_all_day_range_check
    CHECK (
        is_all_day = false
        OR (
            start_datetime::time = '00:00:00'
            AND end_datetime IS NOT NULL
            AND end_datetime::time = '23:59:59'
            AND start_datetime::date = end_datetime::date
        )
    );

-- ─── Registro de migración ────────────────────────────────────────────────────

INSERT INTO db_migrations (script_name, version_tag, notes)
VALUES (
    '081_20260914_reminders-all-day.sql',
    'v1',
    'reminders: columna is_all_day + CHECK reminders_all_day_range_check (00:00:00–23:59:59 del mismo día)'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;
