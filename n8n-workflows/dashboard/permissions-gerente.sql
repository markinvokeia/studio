-- Rol `gerente` — permisos base del Panel de Control.
--
-- Por qué hace falta: `gerente` es el destinatario natural del panel gerencial, pero puede
-- no tener NINGÚN permiso del módulo Panel de Control — ni siquiera DASHBOARD_VIEW_MENU,
-- así que el ítem no le aparece en el menú y la ruta `/` le queda vacía. Darle solo
-- DASHBOARD_VIEW_EXECUTIVE_SUMMARY y DASHBOARD_VIEW_BY_BRANCH no alcanza.
--
-- El rol se referencia **por nombre y no por id**: los ids cambian entre instalaciones y
-- fijarlos haría que este script otorgue los permisos a otro rol —o a ninguno— fuera del
-- entorno donde se escribió. `roles.name` tiene restricción UNIQUE. La comparación va en
-- minúsculas y sin espacios para tolerar "Gerente" o "gerente ".
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

-- Fallar fuerte si el rol no existe con ese nombre. Sin esto el INSERT afectaría 0 filas
-- en silencio y el gerente seguiría sin ver el panel, sin ninguna señal de por qué.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM roles WHERE lower(trim(name)) = 'gerente') THEN
    RAISE EXCEPTION 'No existe un rol llamado "gerente"; ajustar el nombre en este script antes de correrlo';
  END IF;
END $$;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE lower(trim(r.name)) = 'gerente'
  AND p.code IN (
    'DASHBOARD_VIEW_MENU',
    'DASHBOARD_APPLY_FILTERS',
    'DASHBOARD_VIEW_EXECUTIVE_SUMMARY',
    'DASHBOARD_VIEW_CHARTS',
    'DASHBOARD_VIEW_BY_BRANCH'
  )
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

COMMIT;

-- Verificación:
-- SELECT p.code, p.name FROM role_permissions rp
--   JOIN roles r ON r.id = rp.role_id
--   JOIN permissions p ON p.id = rp.permission_id
--  WHERE lower(trim(r.name)) = 'gerente' AND p.module = 'Panel de Control'
--  ORDER BY p.code;
