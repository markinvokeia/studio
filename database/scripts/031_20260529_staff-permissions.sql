-- =====================================================================
-- Staff — permiso STAFF_VIEW_MENU y ajuste de acceso a Usuarios del Sistema
--
-- Objetivos:
--   1. Crear el permiso STAFF_VIEW_MENU para el nuevo menú
--      "Secretarias y Administración" (/system/staff).
--   2. Asignar STAFF_VIEW_MENU a Administrador (id=4) y Gerente (id=37).
--   3. Revocar USERS_VIEW_MENU de Administrador (id=4) para que el menú
--      general "Usuarios del Sistema" quede accesible solo a Gerente (id=37)
--      y al usuario especial system@invokeia.com (vía rol Gerente o acceso
--      directo gestionado en la aplicación).
--
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.
-- =====================================================================

BEGIN;

-- -----------------------------------------------------------------------
-- 1. Permiso STAFF_VIEW_MENU
-- -----------------------------------------------------------------------
INSERT INTO permissions (name, description, code, module, submenu, permission_type)
VALUES (
    'Ver Menú de Secretarias y Administración',
    'Acceder al menú de gestión de usuarios con roles de secretaria y administración',
    'STAFF_VIEW_MENU', 'config', 'staff', 'view'
)
ON CONFLICT (code) DO NOTHING;

-- -----------------------------------------------------------------------
-- 2. Asignar STAFF_VIEW_MENU a Administrador (4) y Gerente (37)
-- -----------------------------------------------------------------------
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.id
FROM (VALUES (4), (37)) AS r(role_id)
CROSS JOIN permissions p
WHERE p.code = 'STAFF_VIEW_MENU'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- -----------------------------------------------------------------------
-- 3. Revocar USERS_VIEW_MENU de Administrador (id=4)
--    El menú general de Usuarios queda solo para Gerente (id=37).
-- -----------------------------------------------------------------------
DELETE FROM role_permissions rp
USING permissions p
WHERE rp.permission_id = p.id
  AND p.code           = 'USERS_VIEW_MENU'
  AND rp.role_id       = 4;

-- -----------------------------------------------------------------------
-- 4. Garantizar que Gerente (37) tiene USERS_VIEW_MENU
--    (por si acaso no estaba asignado previamente)
-- -----------------------------------------------------------------------
INSERT INTO role_permissions (role_id, permission_id)
SELECT 37, p.id
FROM permissions p
WHERE p.code = 'USERS_VIEW_MENU'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- -----------------------------------------------------------------------
-- 5. Registro de migración
-- -----------------------------------------------------------------------
INSERT INTO db_migrations (script_name, version_tag, notes)
VALUES (
    '031_20260529_staff-permissions.sql',
    'v1',
    'Staff — STAFF_VIEW_MENU para Administrador y Gerente; USERS_VIEW_MENU restringido a Gerente únicamente'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;
