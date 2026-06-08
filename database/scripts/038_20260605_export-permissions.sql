-- =====================================================================
-- Export — permisos de exportación CSV/Excel para Presupuestos,
--          Facturas y Pagos (ventas y compras)
--
-- Roles que reciben estos permisos (todos excepto Médico id=2):
--   id=4   Administrador
--   id=37  Gerente
--   id=8   Recepcionista
--   Cajero (ID resuelto por subquery)
--
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.
-- =====================================================================

BEGIN;

-- -----------------------------------------------------------------------
-- 1. Insertar permisos de exportación — Ventas
-- -----------------------------------------------------------------------
INSERT INTO permissions (name, description, code, module, submenu, permission_type)
VALUES
    ('Exportar Presupuestos de Ventas',
     'Exportar el listado de presupuestos de ventas a CSV o Excel por rango de fechas',
     'SALES_QUOTES_EXPORT', 'sales', 'quotes', 'read'),

    ('Exportar Facturas de Ventas',
     'Exportar el listado de facturas de ventas a CSV o Excel por rango de fechas',
     'SALES_INVOICES_EXPORT', 'sales', 'invoices', 'read'),

    ('Exportar Pagos de Ventas',
     'Exportar el listado de pagos de ventas a CSV o Excel por rango de fechas',
     'SALES_PAYMENTS_EXPORT', 'sales', 'payments', 'read')
ON CONFLICT (code) DO NOTHING;

-- -----------------------------------------------------------------------
-- 2. Insertar permisos de exportación — Compras
-- -----------------------------------------------------------------------
INSERT INTO permissions (name, description, code, module, submenu, permission_type)
VALUES
    ('Exportar Presupuestos de Compras',
     'Exportar el listado de presupuestos de compras a CSV o Excel por rango de fechas',
     'PURCHASE_QUOTES_EXPORT', 'purchases', 'quotes', 'read'),

    ('Exportar Facturas de Compras',
     'Exportar el listado de facturas de compras a CSV o Excel por rango de fechas',
     'PURCHASE_INVOICES_EXPORT', 'purchases', 'invoices', 'read'),

    ('Exportar Pagos de Compras',
     'Exportar el listado de pagos de compras a CSV o Excel por rango de fechas',
     'PURCHASE_PAYMENTS_EXPORT', 'purchases', 'payments', 'read')
ON CONFLICT (code) DO NOTHING;

-- -----------------------------------------------------------------------
-- 3. Asignar a Administrador (4), Gerente (37) y Recepcionista (8)
-- -----------------------------------------------------------------------
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.id
FROM (VALUES (4), (37), (8)) AS r(role_id)
CROSS JOIN permissions p
WHERE p.code IN (
    'SALES_QUOTES_EXPORT',
    'SALES_INVOICES_EXPORT',
    'SALES_PAYMENTS_EXPORT',
    'PURCHASE_QUOTES_EXPORT',
    'PURCHASE_INVOICES_EXPORT',
    'PURCHASE_PAYMENTS_EXPORT'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- -----------------------------------------------------------------------
-- 4. Asignar a Cajero (ID resuelto por nombre)
-- -----------------------------------------------------------------------
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'Cajero'
  AND p.code IN (
    'SALES_QUOTES_EXPORT',
    'SALES_INVOICES_EXPORT',
    'SALES_PAYMENTS_EXPORT',
    'PURCHASE_QUOTES_EXPORT',
    'PURCHASE_INVOICES_EXPORT',
    'PURCHASE_PAYMENTS_EXPORT'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- -----------------------------------------------------------------------
-- 5. Registro de migración
-- -----------------------------------------------------------------------
INSERT INTO db_migrations (script_name, version_tag, notes)
VALUES (
    '038_20260605_export-permissions.sql',
    'v1',
    'Export — permisos CSV/Excel para presupuestos, facturas y pagos (ventas y compras); asignados a todos los roles excepto Médico'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;
