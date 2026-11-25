-- =====================================================================
-- Permiso para ver el aviso de licencia por vencer / vencida
--
--   LICENSING_VIEW_EXPIRATION_NOTICE. Quien lo tiene ve la barra "Su licencia
--   vence en N días" y, con la licencia vencida, la pantalla con el motivo y el
--   contacto para renovar. Quien no lo tiene no ve la barra y, con la licencia
--   vencida, ve una pantalla neutra de "sistema no disponible" (el bloqueo se
--   mantiene para todos).
--
--   Se asigna por NOMBRE de rol (los ids cambian entre clínicas), sin distinguir
--   mayúsculas, tildes ni guiones: administración, gerencia, Super Admin y
--   recepción/secretaría. Los nombres que no existan se ignoran. Una clínica
--   con roles propios puede asignarlo desde Sistema > Roles.
--
-- IMPORTANTE: aplicar ANTES de desplegar el frontend; sin el permiso nadie ve
-- el aviso.
--
-- Idempotente. Depende de: 030_20260529_licensing-tables-and-permissions.sql
-- =====================================================================

BEGIN;

INSERT INTO public.permissions (name, description, code, module, submenu, permission_type)
VALUES (
    'Ver aviso de vencimiento de licencia',
    'Ver el aviso de licencia próxima a vencer o vencida',
    'LICENSING_VIEW_EXPIRATION_NOTICE', 'Sistema', 'Licencias', 'LECTURA'
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE p.code = 'LICENSING_VIEW_EXPIRATION_NOTICE'
  AND regexp_replace(
          translate(lower(trim(r.name)), 'áéíóúÁÉÍÓÚ', 'aeiouaeiou'),
          '[[:space:]_-]+', ' ', 'g'
      ) IN (
          -- Administración y gerencia
          'administrador', 'administradora', 'administracion',
          'administrador/a', 'admin', 'administrator',
          'super admin', 'superadmin', 'super administrador', 'superadministrador',
          'gerente', 'gerencia', 'manager',
          -- Recepción y secretaría
          'recepcionista', 'recepcion', 'receptionist',
          'secretaria', 'secretario', 'secretario/a', 'secretaria/o', 'secretary'
      )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ─── Registro de migración ───────────────────────────────────────────

INSERT INTO db_migrations (script_name, version_tag, notes)
VALUES (
    '178_20261125_license-notice-permission.sql',
    'v1',
    'Permiso LICENSING_VIEW_EXPIRATION_NOTICE para administración, gerencia, Super Admin y recepción/secretaría'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;
