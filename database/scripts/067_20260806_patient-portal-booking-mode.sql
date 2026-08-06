-- =====================================================================
-- Portal del Paciente — modos de acceso, reserva online y control de rebotes
--
--   1. clinic.patient_portal_online_booking   → habilita reservar desde el portal.
--   2. clinic.patient_portal_appointments_only → el portal es SÓLO para reservar:
--      nunca se pide OTP ni se entra al perfil.
--   3. users.email_bounced / email_bounced_at → el registro público crea al
--      paciente sin verificar el email; si el correo rebota se marca acá y sus
--      citas quedan para revisión de recepción.
--   4. Permisos PATIENT_PORTAL_CONFIG_* para la nueva página
--      Configuración → Portal del Paciente.
--
-- Idempotente. Depende de: 065 y 066.
-- =====================================================================

BEGIN;

-- -----------------------------------------------------------------------
-- 1. Modos del portal (tabla `clinic`, en singular)
-- -----------------------------------------------------------------------
ALTER TABLE public.clinic
    ADD COLUMN IF NOT EXISTS patient_portal_online_booking   boolean NOT NULL DEFAULT true;

ALTER TABLE public.clinic
    ADD COLUMN IF NOT EXISTS patient_portal_appointments_only boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.clinic.patient_portal_online_booking    IS 'Permite que los pacientes reserven citas desde el portal. FALSE ⇒ sólo consultan.';
COMMENT ON COLUMN public.clinic.patient_portal_appointments_only IS 'El portal es exclusivamente para reservar: se pide el identificador y se pasa a la agenda, sin OTP ni perfil.';

-- -----------------------------------------------------------------------
-- 2. Control de rebotes del correo
--    El auto-registro público crea al paciente sin verificar el email. Si el
--    correo rebota, el flujo n8n `patient-email-bounce` marca estas columnas
--    y recepción puede filtrar las citas de contactos inexistentes.
-- -----------------------------------------------------------------------
ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS email_bounced    boolean NOT NULL DEFAULT false;

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS email_bounced_at timestamp without time zone;

COMMENT ON COLUMN public.users.email_bounced    IS 'TRUE si un correo enviado a este usuario rebotó. Señala un contacto probablemente falso creado por el registro público.';
COMMENT ON COLUMN public.users.email_bounced_at IS 'Momento del último rebote registrado.';

CREATE INDEX IF NOT EXISTS idx_users_email_bounced
    ON public.users (email_bounced)
    WHERE email_bounced;

-- -----------------------------------------------------------------------
-- 3. Permisos de la página Configuración → Portal del Paciente
-- -----------------------------------------------------------------------
INSERT INTO public.permissions (name, description, code, module, submenu, permission_type)
VALUES
    ('Ver Configuración del Portal del Paciente',
     'Acceder a Configuración → Portal del Paciente',
     'PATIENT_PORTAL_CONFIG_VIEW',   'config', 'patients-portal', 'view'),
    ('Editar Configuración del Portal del Paciente',
     'Modificar los ajustes del portal de auto-servicio de pacientes',
     'PATIENT_PORTAL_CONFIG_UPDATE', 'config', 'patients-portal', 'update')
ON CONFLICT (code) DO NOTHING;

-- Mismos roles que gestionan los Datos de la Clínica: Administrador (4) y Gerente (37).
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.role_id, p.id
FROM (VALUES (4), (37)) AS r(role_id)
CROSS JOIN public.permissions p
WHERE p.code IN ('PATIENT_PORTAL_CONFIG_VIEW', 'PATIENT_PORTAL_CONFIG_UPDATE')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- -----------------------------------------------------------------------
-- 4. Registro de migración
-- -----------------------------------------------------------------------
INSERT INTO public.db_migrations (script_name, version_tag, notes)
VALUES (
    '067_20260806_patient-portal-booking-mode.sql',
    'v1',
    'Portal del Paciente — online_booking, appointments_only, control de rebotes y permisos PATIENT_PORTAL_CONFIG_*'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;

-- =====================================================================
-- ROLLBACK (manual)
-- =====================================================================
-- BEGIN;
-- DELETE FROM public.role_permissions rp USING public.permissions p
--   WHERE rp.permission_id = p.id AND p.code LIKE 'PATIENT_PORTAL_CONFIG_%';
-- DELETE FROM public.permissions WHERE code LIKE 'PATIENT_PORTAL_CONFIG_%';
-- ALTER TABLE public.clinic
--   DROP COLUMN IF EXISTS patient_portal_online_booking,
--   DROP COLUMN IF EXISTS patient_portal_appointments_only;
-- ALTER TABLE public.users
--   DROP COLUMN IF EXISTS email_bounced,
--   DROP COLUMN IF EXISTS email_bounced_at;
-- DELETE FROM public.db_migrations WHERE script_name = '067_20260806_patient-portal-booking-mode.sql';
-- COMMIT;
