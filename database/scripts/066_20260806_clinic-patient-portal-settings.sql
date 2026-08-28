-- =====================================================================
-- Portal del Paciente — configuración por clínica
--
-- Campos que la clínica administra desde Configuración → Datos de la Clínica
-- y que consume la landing pública /patient-login:
--   1. patient_portal_enabled → habilita/deshabilita el acceso de pacientes.
--   2. welcome_video_url      → video de bienvenida. NULL ⇒ se usa el genérico
--                               de Invoke IA (/videos/login_promo.mp4).
--   3. welcome_message        → texto de bienvenida del hero. NULL ⇒ copy por defecto.
--
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.
-- Depende de: 065_20260806_patient-portal.sql
-- =====================================================================

BEGIN;

-- -----------------------------------------------------------------------
-- 1. Columnas nuevas en public.clinic (singular — confirmado contra la BD real.
--    El baseline de Liquibase declara "clinics", pero está desactualizado:
--    los flujos n8n en producción consultan public.clinic)
-- -----------------------------------------------------------------------
ALTER TABLE public.clinic
    ADD COLUMN IF NOT EXISTS patient_portal_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.clinic
    ADD COLUMN IF NOT EXISTS welcome_video_url      text;

ALTER TABLE public.clinic
    ADD COLUMN IF NOT EXISTS welcome_message        text;

COMMENT ON COLUMN public.clinic.patient_portal_enabled IS 'Habilita el portal de auto-servicio de pacientes (/patient-login y /my-profile). Por defecto FALSE: cada clínica lo activa explícitamente.';
COMMENT ON COLUMN public.clinic.welcome_video_url      IS 'URL del video de bienvenida de la landing pública. NULL ⇒ se usa el video genérico de Invoke IA.';
COMMENT ON COLUMN public.clinic.welcome_message        IS 'Texto de bienvenida del hero de la landing. NULL ⇒ copy por defecto del sistema.';

-- -----------------------------------------------------------------------
-- 2. Registro de migración
-- -----------------------------------------------------------------------
INSERT INTO public.db_migrations (script_name, version_tag, notes)
VALUES (
    '066_20260806_clinic-patient-portal-settings.sql',
    'v1',
    'Portal del Paciente — patient_portal_enabled, welcome_video_url y welcome_message en clinic'
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
-- ALTER TABLE public.clinic
--   DROP COLUMN IF EXISTS patient_portal_enabled,
--   DROP COLUMN IF EXISTS welcome_video_url,
--   DROP COLUMN IF EXISTS welcome_message;
-- DELETE FROM public.db_migrations WHERE script_name = '066_20260806_clinic-patient-portal-settings.sql';
-- COMMIT;
