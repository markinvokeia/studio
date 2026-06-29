-- =====================================================================
-- Calendar users — tabla puente N:M entre calendar_sources y users
-- (doctores con acceso a un calendario), permiso y asignación a roles.
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.
-- =====================================================================

BEGIN;

-- -----------------------------------------------------------------------
-- 1. Tabla calendar_users (acceso de usuarios/doctores a calendarios)
--    Nombre genérico (users) para futuros usos más allá de doctores.
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.calendar_users (
    calendar_source_id bigint    NOT NULL REFERENCES public.calendar_sources(id) ON DELETE CASCADE,
    user_id            uuid      NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at         timestamp NOT NULL DEFAULT now(),
    CONSTRAINT calendar_users_pkey PRIMARY KEY (calendar_source_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_calendar_users_user
    ON public.calendar_users (user_id);

-- -----------------------------------------------------------------------
-- 2. Permiso para gestionar el acceso de doctores a calendarios
-- -----------------------------------------------------------------------
INSERT INTO permissions (name, description, code, module, submenu, permission_type)
VALUES
    ('Gestionar Doctores de Calendario',
     'Asignar o quitar doctores con acceso a un calendario',
     'CALENDARS_MANAGE_USERS', 'config', 'calendars', 'write')
ON CONFLICT (code) DO NOTHING;

-- -----------------------------------------------------------------------
-- 3. Otorgar a Administrador (id=4) y Gerente (id=37)
-- -----------------------------------------------------------------------
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.id
FROM (VALUES (4), (37)) AS r(role_id)
CROSS JOIN permissions p
WHERE p.code IN ('CALENDARS_MANAGE_USERS')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- -----------------------------------------------------------------------
-- 4. Registro de migración
-- -----------------------------------------------------------------------
INSERT INTO db_migrations (script_name, version_tag, notes)
VALUES (
    '052_20260625_calendar-users-access.sql',
    'v1',
    'Calendar users — tabla calendar_users (acceso de doctores a calendarios), permiso y asignación a roles'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;
