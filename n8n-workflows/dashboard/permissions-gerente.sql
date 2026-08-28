-- Rol `gerente` (id 37) — permisos base del Panel de Control.
--
-- Por qué hace falta: `gerente` es el destinatario natural del panel gerencial, pero hoy
-- no tiene NINGÚN permiso del módulo Panel de Control — ni siquiera DASHBOARD_VIEW_MENU,
-- así que el ítem no le aparece en el menú y la ruta `/` le queda vacía. Darle solo
-- DASHBOARD_VIEW_EXECUTIVE_SUMMARY y DASHBOARD_VIEW_BY_BRANCH no alcanza.
--
-- Se otorga exactamente lo que el panel nuevo necesita y nada más:
--   · VIEW_MENU               → el ítem "Panel de Control" en el menú lateral
--   · APPLY_FILTERS           → la barra de sucursal / período / moneda
--   · VIEW_EXECUTIVE_SUMMARY  → la banda de HOY y las tarjetas del mes
--   · VIEW_CHARTS             → Pacientes por día y Ventas por servicio
--   · VIEW_BY_BRANCH          → filtro de sucursal y tarjeta de Sucursales
--
-- Deliberadamente NO se otorgan:
--   · DOCTOR_WORKSPACE_ACCESS → es el consultorio clínico, no gestión
--   · VIEW_KPIS / VIEW_OPERATIONAL_KPIS / VIEW_RECENT_QUOTES / VIEW_RECENT_ORDERS /
--     VIEW_NEW_PATIENTS       → protegen bloques que el panel nuevo ya no renderiza
--
-- Idempotente: se puede correr más de una vez sin duplicar.

BEGIN;

INSERT INTO role_permissions (role_id, permission_id)
SELECT 37, p.id
FROM permissions p
WHERE p.code IN (
  'DASHBOARD_VIEW_MENU',
  'DASHBOARD_APPLY_FILTERS',
  'DASHBOARD_VIEW_EXECUTIVE_SUMMARY',
  'DASHBOARD_VIEW_CHARTS',
  'DASHBOARD_VIEW_BY_BRANCH'
)
AND NOT EXISTS (
  SELECT 1 FROM role_permissions rp WHERE rp.role_id = 37 AND rp.permission_id = p.id
);

COMMIT;

-- Verificación:
-- SELECT p.code, p.name FROM role_permissions rp
--   JOIN permissions p ON p.id = rp.permission_id
--  WHERE rp.role_id = 37 AND p.module = 'Panel de Control'
--  ORDER BY p.code;
