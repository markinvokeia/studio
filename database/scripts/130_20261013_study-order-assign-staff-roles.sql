-- =============================================================================
-- Órdenes de estudio — STUDY_ORDERS_ASSIGN también para los roles de staff
-- =============================================================================
-- Contexto:
--
--   La 129 dio STUDY_ORDERS_ASSIGN solo a los roles que ya tenían STUDY_ORDERS_ACKNOWLEDGE. La
--   revisión de una orden se asigna al staff (rol recepcionista, gerente o administrador, el
--   criterio de get_users_filtered(p_only_staff)), y son esos mismos roles los que tienen que
--   poder asignarla. En entornos donde alguno no tenía ACKNOWLEDGE (o cuyos ids de rol difieren
--   de los de la 071) la acción "Asignar" no aparecía.
--
--   Se busca el rol por nombre, sin importar mayúsculas ni espacios. Para que la vista funcione
--   también hacen falta STUDY_ORDERS_VIEW_MENU y STUDY_ORDERS_VIEW_ALL (la bandeja de la clínica):
--   se agregan a esos roles si les faltan.
--
-- Requiere la 129. Idempotente.
-- =============================================================================

BEGIN;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM roles r
 CROSS JOIN permissions p
 WHERE lower(trim(r.name)) IN ('recepcionista', 'gerente', 'administrador')
   AND p.code IN ('STUDY_ORDERS_ASSIGN', 'STUDY_ORDERS_VIEW_MENU', 'STUDY_ORDERS_VIEW_ALL')
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO public.db_migrations (script_name, version_tag, notes)
VALUES (
    '130_20261013_study-order-assign-staff-roles.sql',
    'v2',
    'Órdenes de estudio — STUDY_ORDERS_ASSIGN (y la bandeja de la clínica) para recepcionista, gerente y administrador'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;

-- =============================================================================
-- Verificación: qué roles tienen ahora el permiso
-- =============================================================================
-- SELECT r.id, r.name
--   FROM role_permissions rp
--   JOIN roles r       ON r.id = rp.role_id
--   JOIN permissions p ON p.id = rp.permission_id
--  WHERE p.code = 'STUDY_ORDERS_ASSIGN'
--  ORDER BY r.name;

-- =============================================================================
-- Rollback manual (solo lo que agregó este script no se puede distinguir de lo previo:
-- quitar STUDY_ORDERS_ASSIGN de estos roles; VIEW_MENU/VIEW_ALL se dejan)
-- =============================================================================
-- BEGIN;
-- DELETE FROM role_permissions rp
--  USING roles r, permissions p
--  WHERE rp.role_id = r.id AND rp.permission_id = p.id
--    AND p.code = 'STUDY_ORDERS_ASSIGN'
--    AND lower(trim(r.name)) IN ('recepcionista', 'gerente', 'administrador');
-- DELETE FROM public.db_migrations WHERE script_name = '130_20261013_study-order-assign-staff-roles.sql';
-- COMMIT;
