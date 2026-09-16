-- =====================================================================
-- Matriz de colores de estado configurable por cliente
--
--   1. public.calendar_status_display → tabla nueva, una fila por
--      (clinic_id, calendar_id, status). `calendar_id` NULL es la
--      configuración GENERAL de la clínica; no-NULL es un override de ese
--      calendario. Fila por estado (no JSONB) porque es literalmente la
--      matriz, permite override parcial y "replicar a N calendarios" es un
--      INSERT … SELECT en vez de duplicar un blob.
--   2. Permisos CALENDAR_DISPLAY_VIEW / CALENDAR_DISPLAY_UPDATE (módulo
--      config, submenú calendar-colors), otorgados a administrador/gerente.
--   3. Seed de la configuración general por clínica con los valores hoy
--      cableados en el frontend (`clinica_imagen`: scheduled lila y
--      no_show gris, ambos 'always'): el corte no cambia nada visualmente.
--
-- `calendar_id` referencia `calendar_sources.id` (bigint), NO `calendars`:
-- la tabla real de calendarios en esta base es `calendar_sources`.
--
-- Idempotente. Depende de: 086_20260916_identity-document-type.sql
-- =====================================================================

BEGIN;

-- -----------------------------------------------------------------------
-- 1. Tabla
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.calendar_status_display (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id     INTEGER     NOT NULL REFERENCES public.clinic (id) ON DELETE CASCADE,
    -- NULL = configuración GENERAL del cliente. No NULL = override de ese calendario.
    calendar_id   BIGINT      REFERENCES public.calendar_sources (id) ON DELETE CASCADE,
    status        VARCHAR(20) NOT NULL
                  CHECK (status IN ('scheduled','confirmed','arrived','arrived_late',
                                    'in_progress','completed','attended_late',
                                    'no_show','cancelled','pending')),
    color         VARCHAR(7)  NOT NULL CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
    calendar_mode VARCHAR(12) NOT NULL DEFAULT 'preference'
                  CHECK (calendar_mode IN ('always','preference','never')),
    badge_style   VARCHAR(8)  NOT NULL DEFAULT 'solid'
                  CHECK (badge_style IN ('solid','soft','outline')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- UNIQUE con calendar_id NULL: dos índices parciales (no depende de PG15).
CREATE UNIQUE INDEX IF NOT EXISTS calendar_status_display_general_uq
    ON public.calendar_status_display (clinic_id, status) WHERE calendar_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS calendar_status_display_per_calendar_uq
    ON public.calendar_status_display (clinic_id, calendar_id, status) WHERE calendar_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS calendar_status_display_clinic_idx
    ON public.calendar_status_display (clinic_id);

COMMENT ON TABLE  public.calendar_status_display              IS 'Matriz de color/modo-calendario/estilo-badge por estado de cita (Configuración → Colores de calendario). Fila por (clinic_id, calendar_id, status).';
COMMENT ON COLUMN public.calendar_status_display.calendar_id  IS 'NULL = matriz general de la clínica. No-NULL = override de ese calendario (calendar_sources.id).';
COMMENT ON COLUMN public.calendar_status_display.color        IS 'Hex #rrggbb.';
COMMENT ON COLUMN public.calendar_status_display.calendar_mode IS '''always'': pinta la card entera sin importar la preferencia del usuario ni el color de servicio/doctor/consultorio (salvo etiqueta manual). ''preference'': respeta el switch "colorear por estado". ''never'': nunca aporta color al calendario.';
COMMENT ON COLUMN public.calendar_status_display.badge_style  IS 'Cómo se pinta fuera del calendario (badges, chips, notificaciones): ''solid'' fondo+texto legible, ''soft'' fondo 15%+texto del color, ''outline'' borde del color.';

DROP TRIGGER IF EXISTS set_updated_at ON public.calendar_status_display;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.calendar_status_display
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------
-- 2. Seed: configuración general por clínica, valores de `clinica_imagen`.
-- -----------------------------------------------------------------------
INSERT INTO public.calendar_status_display (clinic_id, calendar_id, status, color, calendar_mode, badge_style)
SELECT c.id, NULL, v.status, v.color, v.mode, 'solid'
FROM public.clinic c
CROSS JOIN (VALUES
    ('pending',       '#9ca3af', 'preference'),
    ('scheduled',     '#a78bfa', 'always'),
    ('confirmed',     '#0284c7', 'preference'),
    ('arrived',       '#f59e0b', 'preference'),
    ('arrived_late',  '#d97706', 'preference'),
    ('in_progress',   '#f97316', 'preference'),
    ('completed',     '#16a34a', 'preference'),
    ('attended_late', '#0d9488', 'preference'),
    ('no_show',       '#4b5563', 'always'),
    ('cancelled',     '#6b7280', 'preference')
) AS v(status, color, mode)
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------
-- 3. Permisos
-- -----------------------------------------------------------------------
INSERT INTO public.permissions (name, description, code, module, submenu, permission_type)
VALUES
    ('Ver Colores de Calendario',
     'Acceder a Configuración → Colores de Calendario',
     'CALENDAR_DISPLAY_VIEW',   'config', 'calendar-colors', 'view'),
    ('Editar Colores de Calendario',
     'Modificar la matriz de color/modo/badge por estado de cita',
     'CALENDAR_DISPLAY_UPDATE', 'config', 'calendar-colors', 'update')
ON CONFLICT (code) DO NOTHING;

-- Los roles se resuelven por nombre (case-insensitive): los ids difieren
-- entre BDs de cliente. Mismos roles que gestionan Preferencias de Clínica.
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE lower(r.name) IN ('administrador', 'gerente')
  AND p.code IN ('CALENDAR_DISPLAY_VIEW', 'CALENDAR_DISPLAY_UPDATE')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- -----------------------------------------------------------------------
-- 4. Registro de migración
-- -----------------------------------------------------------------------
INSERT INTO public.db_migrations (script_name, version_tag, notes)
VALUES (
    '087_20260916_calendar-status-display.sql',
    'v1',
    'Matriz de colores de estado configurable por cliente (tabla calendar_status_display), permisos CALENDAR_DISPLAY_* y seed general por clínica con los valores de clinica_imagen'
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
-- DELETE FROM public.role_permissions rp USING public.permissions p
--   WHERE rp.permission_id = p.id AND p.code LIKE 'CALENDAR_DISPLAY_%';
-- DELETE FROM public.permissions WHERE code LIKE 'CALENDAR_DISPLAY_%';
-- DROP TABLE IF EXISTS public.calendar_status_display;
-- DELETE FROM public.db_migrations WHERE script_name = '087_20260916_calendar-status-display.sql';
-- COMMIT;
