-- =====================================================================
-- Portal del Paciente — selección de servicios en la reserva online
--
--   1. service_catalog.bookable_online → separa el catálogo que la clínica
--      brinda del subconjunto que el paciente puede auto-agendar. Una cirugía
--      está en el catálogo pero no es algo que un paciente reserve solo, así
--      que el default es FALSE: ningún servicio se vuelve agendable por migrar.
--   2. service_catalog.image_* → imagen del servicio para las tarjetas del
--      portal. Mismo mecanismo que el logo de la clínica y que la firma del
--      doctor: el archivo vive en Google Drive y acá quedan sus metadatos.
--   3. clinic.patient_portal_service_selection → el paciente elige servicios
--      en un paso previo a la fecha y hora. Deshabilitado por defecto.
--   4. clinic.patient_portal_default_service_id → con qué servicio se crea la
--      reserva cuando el paciente no elige (o no puede elegir).
--   5. clinic.patient_portal_show_pricing → muestra duración y precios en el
--      portal. Sólo presentación.
--
-- Notas:
--   · No hay permisos nuevos y no es un olvido: la configuración ya está
--     detrás de PATIENT_PORTAL_CONFIG_VIEW/UPDATE (script 067) y la edición
--     del catálogo detrás de los permisos de servicios que ya existen.
--   · La duración de los servicios dimensiona el hueco de la agenda SIEMPRE,
--     con patient_portal_show_pricing en TRUE o en FALSE. Ese flag decide
--     únicamente si el paciente ve los números, no cómo se reserva.
--
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.
-- Depende de: 067_20260806_patient-portal-booking-mode.sql
-- =====================================================================

BEGIN;

-- -----------------------------------------------------------------------
-- 1. Servicios agendables online (tabla `service_catalog`, en singular)
-- -----------------------------------------------------------------------
ALTER TABLE public.service_catalog
    ADD COLUMN IF NOT EXISTS bookable_online boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.service_catalog.bookable_online IS 'TRUE ⇒ el paciente puede elegir este servicio al reservar desde el portal. FALSE (default) ⇒ sólo lo agenda el staff.';

-- Parcial: las consultas del portal siempre filtran por bookable_online, y el
-- subconjunto agendable es chico frente al catálogo completo.
CREATE INDEX IF NOT EXISTS idx_service_catalog_bookable_online
    ON public.service_catalog (id)
    WHERE bookable_online;

-- -----------------------------------------------------------------------
-- 2. Imagen del servicio
--    El binario no se guarda en la BD: se sube a Google Drive (flujo n8n
--    `service-image-upload`) y acá queda sólo la referencia, igual que
--    clinic.logo_* y users.signature_*.
-- -----------------------------------------------------------------------
ALTER TABLE public.service_catalog
    ADD COLUMN IF NOT EXISTS image_filename varchar(255);

ALTER TABLE public.service_catalog
    ADD COLUMN IF NOT EXISTS image_mimetype varchar(100);

ALTER TABLE public.service_catalog
    ADD COLUMN IF NOT EXISTS image_drive_file_id varchar(255);

ALTER TABLE public.service_catalog
    ADD COLUMN IF NOT EXISTS image_web_view_link text;

ALTER TABLE public.service_catalog
    ADD COLUMN IF NOT EXISTS image_updated_at timestamp without time zone;

COMMENT ON COLUMN public.service_catalog.image_filename      IS 'Nombre original del archivo de imagen subido.';
COMMENT ON COLUMN public.service_catalog.image_mimetype      IS 'Tipo MIME de la imagen (image/png, image/jpeg, image/webp). Máx. 1 MB, validado en el front y en n8n.';
COMMENT ON COLUMN public.service_catalog.image_drive_file_id IS 'Id del archivo en Google Drive. La imagen se sirve por GET /services/image?service_id=, nunca por una URL de Drive directa.';
COMMENT ON COLUMN public.service_catalog.image_web_view_link IS 'Enlace de Drive para inspección manual. La UI no lo usa.';
COMMENT ON COLUMN public.service_catalog.image_updated_at    IS 'Última vez que se reemplazó la imagen. La UI lo manda como query param para invalidar la caché del navegador.';

-- -----------------------------------------------------------------------
-- 3. Configuración del portal (tabla `clinic`, en singular)
-- -----------------------------------------------------------------------
ALTER TABLE public.clinic
    ADD COLUMN IF NOT EXISTS patient_portal_service_selection boolean NOT NULL DEFAULT false;

ALTER TABLE public.clinic
    ADD COLUMN IF NOT EXISTS patient_portal_default_service_id integer;

ALTER TABLE public.clinic
    ADD COLUMN IF NOT EXISTS patient_portal_show_pricing boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.clinic.patient_portal_service_selection  IS 'TRUE ⇒ el paciente elige servicios en un paso previo a la fecha y hora. FALSE (default) ⇒ toda reserva usa patient_portal_default_service_id.';
COMMENT ON COLUMN public.clinic.patient_portal_default_service_id IS 'Servicio con el que se crea la reserva cuando el paciente no elige ninguno. Permite que todas las citas del portal entren como, por ejemplo, Consulta general.';
COMMENT ON COLUMN public.clinic.patient_portal_show_pricing       IS 'TRUE ⇒ el portal muestra el precio de cada servicio y los totales de tiempo y dinero. Sólo presentación: la duración dimensiona el hueco de la agenda en cualquier caso.';

-- ON DELETE SET NULL: borrar un servicio no puede bloquearse por ser el
-- default del portal; la reserva cae a la duración genérica hasta que la
-- clínica elija otro.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'clinic_patient_portal_default_service_id_fkey'
    ) THEN
        ALTER TABLE public.clinic
            ADD CONSTRAINT clinic_patient_portal_default_service_id_fkey
            FOREIGN KEY (patient_portal_default_service_id)
            REFERENCES public.service_catalog (id)
            ON DELETE SET NULL;
    END IF;
END $$;

-- -----------------------------------------------------------------------
-- 4. Registro de migración
-- -----------------------------------------------------------------------
INSERT INTO public.db_migrations (script_name, version_tag, notes)
VALUES (
    '122_20260930_service-booking-and-images.sql',
    'v1',
    'Portal del Paciente — bookable_online e imagen en service_catalog; selección de servicios, servicio por defecto y visibilidad de precios en clinic'
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
-- ALTER TABLE public.clinic DROP CONSTRAINT IF EXISTS clinic_patient_portal_default_service_id_fkey;
-- ALTER TABLE public.clinic
--   DROP COLUMN IF EXISTS patient_portal_service_selection,
--   DROP COLUMN IF EXISTS patient_portal_default_service_id,
--   DROP COLUMN IF EXISTS patient_portal_show_pricing;
-- DROP INDEX IF EXISTS public.idx_service_catalog_bookable_online;
-- ALTER TABLE public.service_catalog
--   DROP COLUMN IF EXISTS bookable_online,
--   DROP COLUMN IF EXISTS image_filename,
--   DROP COLUMN IF EXISTS image_mimetype,
--   DROP COLUMN IF EXISTS image_drive_file_id,
--   DROP COLUMN IF EXISTS image_web_view_link,
--   DROP COLUMN IF EXISTS image_updated_at;
-- DELETE FROM public.db_migrations WHERE script_name = '122_20260930_service-booking-and-images.sql';
-- COMMIT;
