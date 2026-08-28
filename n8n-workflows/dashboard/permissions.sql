-- Panel de Control Gerencial — alta de los permisos nuevos.
-- Requerido para que se rendericen el bloque HOY, las tarjetas del mes y la tarjeta de
-- Sucursales: el componente <Can> los exige y hoy no existen en la tabla `permissions`.
--
-- Idempotente: se puede correr más de una vez sin duplicar.

BEGIN;

-- 1. Los dos permisos, con los mismos metadatos que usan los del módulo Dashboard.
INSERT INTO permissions (name, description, resource, casl_action, code, module, submenu, permission_type)
SELECT v.name, v.description, 'Dashboard', 'read', v.code, 'Panel de Control', 'Dashboard', 'LECTURA'
FROM (VALUES
  ('Ver resumen ejecutivo',
   'Ver la banda de HOY y las tarjetas del mes acumulado del panel gerencial',
   'DASHBOARD_VIEW_EXECUTIVE_SUMMARY'),
  ('Ver corte por sucursal',
   'Usar el filtro de sucursal y ver la tarjeta de producción por sede',
   'DASHBOARD_VIEW_BY_BRANCH')
) AS v(name, description, code)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.code = v.code);

-- 2. Asignarlos a Super Admin (97), administrador (4) y gerente (37).
--    Nota: el rol `gerente` hoy no tiene NINGÚN permiso de Dashboard, ni siquiera
--    DASHBOARD_VIEW_MENU, así que no ve el panel aunque se le den estos dos.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE p.code IN ('DASHBOARD_VIEW_EXECUTIVE_SUMMARY', 'DASHBOARD_VIEW_BY_BRANCH')
  AND r.id IN (97, 4, 37)
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

COMMIT;

-- Verificación:
-- SELECT r.name, p.code FROM role_permissions rp
--   JOIN roles r ON r.id = rp.role_id
--   JOIN permissions p ON p.id = rp.permission_id
--  WHERE p.code LIKE 'DASHBOARD_VIEW_%' AND p.code IN
--    ('DASHBOARD_VIEW_EXECUTIVE_SUMMARY','DASHBOARD_VIEW_BY_BRANCH')
--  ORDER BY r.name, p.code;
