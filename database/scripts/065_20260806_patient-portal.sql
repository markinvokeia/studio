-- =====================================================================
-- Portal del Paciente (/my-profile) — esquema, rol y permisos
--
-- Objetivos:
--   1. Columnas del código de acceso de un solo uso (OTP) en public.users.
--      NO se reutiliza password_setup_token: tiene UNIQUE constraint y dos
--      pacientes con el mismo código de 6 dígitos colisionarían.
--   2. Rol "Paciente" — acceso de solo lectura al portal.
--   3. Permisos PATIENT_PORTAL_* y su asignación al rol Paciente.
--
-- Notas de seguridad:
--   · users.login_code guarda el HASH del código (sha256(code || user_id)),
--     nunca el código en claro. El hash lo calcula n8n.
--   · Expiración 10 min, máx. 5 intentos, reenvío mínimo cada 60 s
--     (se controla en n8n con login_code_sent_at).
--
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.
-- =====================================================================

BEGIN;

-- -----------------------------------------------------------------------
-- 0. pgcrypto — necesario para digest(...,'sha256'), que es como n8n
--    hashea el código de acceso antes de guardarlo.
-- -----------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------
-- 1. Columnas del código de acceso en public.users
-- -----------------------------------------------------------------------
ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS login_code            varchar(128);

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS login_code_expires_at timestamp without time zone;

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS login_code_attempts   smallint NOT NULL DEFAULT 0;

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS login_code_sent_at    timestamp without time zone;

-- Marca a los pacientes que activaron el portal, sin tocar is_active.
ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS is_portal_user        boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.users.login_code            IS 'Hash sha256(code||user_id) del código de acceso de un solo uso del portal del paciente. Nunca el código en claro.';
COMMENT ON COLUMN public.users.login_code_expires_at IS 'Vencimiento del código de acceso (10 minutos desde el envío).';
COMMENT ON COLUMN public.users.login_code_attempts   IS 'Intentos fallidos de verificación del código actual. Máximo 5.';
COMMENT ON COLUMN public.users.login_code_sent_at    IS 'Último envío del código. Se usa para limitar reenvíos (mínimo 60 s).';
COMMENT ON COLUMN public.users.is_portal_user        IS 'TRUE si el paciente ya se autenticó alguna vez en el portal /my-profile.';

-- Índice para la limpieza periódica de códigos vencidos.
-- (email ya tiene idx_users_email; phone_number e identity_document son UNIQUE)
CREATE INDEX IF NOT EXISTS idx_users_login_code_expires
    ON public.users (login_code_expires_at)
    WHERE login_code IS NOT NULL;

-- -----------------------------------------------------------------------
-- 2. Rol Paciente
-- -----------------------------------------------------------------------
INSERT INTO public.roles (name, description)
VALUES ('paciente', 'Acceso de solo lectura al portal del paciente (/my-profile)')
ON CONFLICT (name) DO NOTHING;

-- -----------------------------------------------------------------------
-- 3. Permisos del portal
-- -----------------------------------------------------------------------
INSERT INTO public.permissions (name, description, code, module, submenu, permission_type)
VALUES
    ('Acceder al Portal del Paciente',
     'Permite entrar a /my-profile. Es el permiso raíz del portal.',
     'PATIENT_PORTAL_ACCESS',              'patient_portal', 'my-profile', 'view'),

    ('Ver Mi Información',
     'Ver los datos personales propios en el portal, en modo solo lectura.',
     'PATIENT_PORTAL_VIEW_INFO',           'patient_portal', 'my-profile', 'view'),

    ('Ver Mi Historial Clínico',
     'Ver anamnesis, sesiones clínicas, planes de tratamiento, indicaciones y documentos propios.',
     'PATIENT_PORTAL_VIEW_HISTORY',        'patient_portal', 'my-profile', 'view'),

    ('Ver Mis Finanzas',
     'Ver presupuestos, facturas, pagos y saldo propios, en modo solo lectura.',
     'PATIENT_PORTAL_VIEW_FINANCE',        'patient_portal', 'my-profile', 'view'),

    ('Gestionar Mis Citas',
     'Reservar, reagendar y cancelar las citas futuras propias.',
     'PATIENT_PORTAL_MANAGE_APPOINTMENTS', 'patient_portal', 'my-profile', 'update'),

    ('Usar el Asistente Virtual',
     'Consultar al asistente virtual sobre la clínica y sobre los datos propios.',
     'PATIENT_PORTAL_USE_ASSISTANT',       'patient_portal', 'my-profile', 'view')
ON CONFLICT (code) DO NOTHING;

-- -----------------------------------------------------------------------
-- 4. Asignar todos los permisos PATIENT_PORTAL_* al rol Paciente
-- -----------------------------------------------------------------------
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'paciente'
  AND p.code LIKE 'PATIENT_PORTAL_%'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- -----------------------------------------------------------------------
-- 5. Registro de migración
-- -----------------------------------------------------------------------
INSERT INTO public.db_migrations (script_name, version_tag, notes)
VALUES (
    '065_20260806_patient-portal.sql',
    'v1',
    'Portal del Paciente — columnas OTP en users, rol Paciente y permisos PATIENT_PORTAL_*'
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
--   WHERE rp.permission_id = p.id AND p.code LIKE 'PATIENT_PORTAL_%';
-- DELETE FROM public.permissions WHERE code LIKE 'PATIENT_PORTAL_%';
-- DELETE FROM public.user_roles ur USING public.roles r
--   WHERE ur.role_id = r.id AND r.name = 'Paciente';
-- DELETE FROM public.roles WHERE name = 'Paciente';
-- ALTER TABLE public.users
--   DROP COLUMN IF EXISTS login_code,
--   DROP COLUMN IF EXISTS login_code_expires_at,
--   DROP COLUMN IF EXISTS login_code_attempts,
--   DROP COLUMN IF EXISTS login_code_sent_at,
--   DROP COLUMN IF EXISTS is_portal_user;
-- DELETE FROM public.db_migrations WHERE script_name = '065_20260806_patient-portal.sql';
-- COMMIT;
