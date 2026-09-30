-- =============================================================================
-- Órdenes de estudio por WhatsApp — Fase 1: datos
-- =============================================================================
-- Contexto (docs/whatsapp-ordenes-estudio-plan.md):
--
--   1. study_orders.doctor_id pasa a ser OPCIONAL, y se agregan
--      `source`, `referring_doctor_name` y `source_intake_id`.
--      El doctor que crea la orden y el técnico que la ejecuta no son
--      obligatorios: la orden que llega por WhatsApp se crea sin doctor
--      derivador. El nombre que figura en el papel queda como texto.
--   2. whatsapp_inbound_buffer y whatsapp_conversation_messages guardan los
--      datos del adjunto (imagen / PDF) que acompaña al mensaje.
--   3. whatsapp_order_intakes: estado de cada orden que entra por WhatsApp —
--      originales, extracción, validación, derivación y resultado. Es lo que
--      hace auditable el proceso y lo que permite retomar la conversación
--      aunque pasen horas (la memoria del chat guarda sólo 10 mensajes).
--   4. Cinco claves en system_configurations (feature flag, umbrales, modelo de visión y calendarios elegibles).
--
-- LOS ORIGINALES (las fotos) NO VAN EN ESTA TABLA
--   Se suben con el subflujo `Attachements CRUD` a Google Drive y quedan en
--   public.attachments con source_name = 'whatsapp_order_intake' y
--   source_id = <whatsapp_order_intakes.id>. El intake guarda en `media` una
--   referencia por archivo (attachment_id, sha256, mime, tamaño, wamid).
--
-- DERIVACIÓN A UN HUMANO
--   No requiere tipo de notificación nuevo: se reutiliza
--   `whatsapp_handoff_requested` (ya admitido por notifications_type_check) con
--   el intake en la metadata.
--
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.
-- Depende de: 071_20260906_study-orders.sql, 091_20260921_whatsapp-conversation-
--             messages-and-lock.sql, función update_updated_at_column() (029).
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. study_orders: doctor opcional, origen y trazabilidad
-- -----------------------------------------------------------------------------
ALTER TABLE public.study_orders
    ALTER COLUMN doctor_id DROP NOT NULL;

COMMENT ON COLUMN public.study_orders.doctor_id IS
    'Odontólogo derivador (users.id), OPCIONAL. Cuando existe es el mismo valor que va a appointments.assignee_id de las citas que genere: en Clínica Imagen el doctor de la cita es quien derivó, no el técnico que ejecuta. Nulo en las órdenes creadas por el agente de WhatsApp: no se vincula a ningún doctor; el nombre del papel queda en referring_doctor_name.';

ALTER TABLE public.study_orders
    ADD COLUMN IF NOT EXISTS source varchar(20) NOT NULL DEFAULT 'portal',
    ADD COLUMN IF NOT EXISTS referring_doctor_name varchar(255),
    ADD COLUMN IF NOT EXISTS source_intake_id uuid;

ALTER TABLE public.study_orders
    DROP CONSTRAINT IF EXISTS study_orders_source_check;
ALTER TABLE public.study_orders
    ADD CONSTRAINT study_orders_source_check CHECK (source IN ('portal', 'whatsapp'));

COMMENT ON COLUMN public.study_orders.source IS
    'Canal por el que entró la orden: portal (la crea un usuario en Invoke) o whatsapp (la crea el agente a partir de una foto o PDF).';
COMMENT ON COLUMN public.study_orders.referring_doctor_name IS
    'Nombre del doctor tal como figura en la orden en papel. Sólo referencia: NO está vinculado a ningún usuario. Lo completa el agente de WhatsApp.';
COMMENT ON COLUMN public.study_orders.source_intake_id IS
    'whatsapp_order_intakes de donde salió la orden (fotos originales, extracción y validación). Nulo para las órdenes del portal.';

-- -----------------------------------------------------------------------------
-- 2. Adjuntos en las tablas de WhatsApp
-- -----------------------------------------------------------------------------
-- message_text es NOT NULL: un mensaje que sólo trae archivo guarda '' (o el
-- pie de foto). El filtro del workflow deja de exigir texto en la Fase 2.
ALTER TABLE public.whatsapp_inbound_buffer
    ADD COLUMN IF NOT EXISTS media_kind     text,
    ADD COLUMN IF NOT EXISTS media_id       text,
    ADD COLUMN IF NOT EXISTS media_url      text,
    ADD COLUMN IF NOT EXISTS media_mime     text,
    ADD COLUMN IF NOT EXISTS media_sha256   text,
    ADD COLUMN IF NOT EXISTS media_filename text,
    ADD COLUMN IF NOT EXISTS media_caption  text;

ALTER TABLE public.whatsapp_inbound_buffer
    DROP CONSTRAINT IF EXISTS whatsapp_inbound_buffer_media_kind_check;
ALTER TABLE public.whatsapp_inbound_buffer
    ADD CONSTRAINT whatsapp_inbound_buffer_media_kind_check
    CHECK (media_kind IS NULL OR media_kind IN ('image', 'document', 'audio', 'video', 'other'));

COMMENT ON COLUMN public.whatsapp_inbound_buffer.media_url IS
    'Link de descarga que entrega YCloud. Se puede abrir unos minutos sin credenciales y hasta 30 dias con el header X-API-Key; igual se baja al procesar el lote y se guarda el original.';
COMMENT ON COLUMN public.whatsapp_inbound_buffer.media_sha256 IS
    'sha256 (base64) del archivo segun YCloud. Se compara con el de la descarga para detectar archivos corruptos.';

ALTER TABLE public.whatsapp_conversation_messages
    ADD COLUMN IF NOT EXISTS media_kind          text,
    ADD COLUMN IF NOT EXISTS media_attachment_id integer;

COMMENT ON COLUMN public.whatsapp_conversation_messages.media_attachment_id IS
    'attachments.id del archivo guardado, si el mensaje traía uno.';

-- -----------------------------------------------------------------------------
-- 3. Intake de órdenes por WhatsApp
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.whatsapp_order_intakes (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    phone            text        NOT NULL,
    sender_user_id   uuid,
    patient_id       uuid,
    status           varchar(30) NOT NULL DEFAULT 'extracting',
    handoff_reason   varchar(30),
    handoff_detail   text,
    media            jsonb       NOT NULL DEFAULT '[]'::jsonb,
    extraction       jsonb,
    validation       jsonb,
    extraction_meta  jsonb       NOT NULL DEFAULT '{}'::jsonb,
    study_order_id   uuid,
    chosen_sede_id   integer,
    slots_offered    jsonb,
    appointment_id   integer,
    booking_attempts smallint    NOT NULL DEFAULT 0,
    resolved_at      timestamptz,
    resolved_by      uuid,
    resolution_note  text,
    expires_at       timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT whatsapp_order_intakes_status_check
        CHECK (status IN ('extracting', 'needs_input', 'awaiting_confirmation',
                          'order_created', 'booked', 'handed_off', 'abandoned', 'failed')),
    CONSTRAINT whatsapp_order_intakes_handoff_reason_check
        CHECK (handoff_reason IS NULL OR handoff_reason IN
               ('service_not_found', 'unreadable', 'low_confidence', 'patient_mismatch',
                'booking_failed', 'user_request', 'system_error')),
    CONSTRAINT whatsapp_order_intakes_handoff_check
        CHECK ((status = 'handed_off') = (handoff_reason IS NOT NULL))
);

COMMENT ON TABLE public.whatsapp_order_intakes IS
    'Una orden de estudio que entra por WhatsApp, de la foto a la cita. Conserva todo lo necesario para auditarla: referencias a los originales, la extracción cruda, la validación y el resultado. Las filas no se borran.';
COMMENT ON COLUMN public.whatsapp_order_intakes.sender_user_id IS
    'users.id resuelto por el teléfono del remitente; nulo si no está registrado o el número coincide con más de un usuario.';
COMMENT ON COLUMN public.whatsapp_order_intakes.patient_id IS
    'Paciente de la orden (resuelto por CI, o dado de alta por el agente). En el primer corte coincide siempre con el remitente; si no, se deriva (patient_mismatch).';
COMMENT ON COLUMN public.whatsapp_order_intakes.media IS
    'Archivos recibidos: [{wamid, kind, mime, size, sha256, file_name, caption, received_at, attachment_id, status, reject_reason?}]. status: stored, upload_failed o rejected (download_failed, empty_file, too_large, unexpected_mime, hash_mismatch). Los originales están en attachments (source_name = whatsapp_order_intake, source_id = id de este registro).';
COMMENT ON COLUMN public.whatsapp_order_intakes.extraction IS
    'Salida cruda del modelo de visión, sin modificar. Es lo que permite reconstruir por qué se leyó lo que se leyó.';
COMMENT ON COLUMN public.whatsapp_order_intakes.validation IS
    'Resultado del validador determinista: líneas resueltas contra service_catalog, faltantes, dudas y motivo de derivación si lo hubo.';
COMMENT ON COLUMN public.whatsapp_order_intakes.extraction_meta IS
    'Modelo, versión del prompt y del esquema usados en la extracción.';
COMMENT ON COLUMN public.whatsapp_order_intakes.slots_offered IS
    'Última lista de horarios ofrecida al usuario. Los números que el usuario elige ("el 2") se resuelven contra esta lista, así el LLM nunca maneja ids internos.';
COMMENT ON COLUMN public.whatsapp_order_intakes.resolved_at IS
    'Cuándo recepción marcó como resuelta una derivación (status = handed_off). Nulo = pendiente. No modifica los originales ni la extracción.';
COMMENT ON COLUMN public.whatsapp_order_intakes.booking_attempts IS
    'Reservas fallidas seguidas. Con dos se deriva a un humano (booking_failed).';

-- Un teléfono sólo puede tener un intake en curso a la vez.
CREATE UNIQUE INDEX IF NOT EXISTS uq_whatsapp_order_intakes_active_phone
    ON public.whatsapp_order_intakes (phone)
    WHERE status IN ('extracting', 'needs_input', 'awaiting_confirmation', 'order_created');

CREATE INDEX IF NOT EXISTS idx_whatsapp_order_intakes_handed_off
    ON public.whatsapp_order_intakes (created_at DESC)
    WHERE status = 'handed_off';
CREATE INDEX IF NOT EXISTS idx_whatsapp_order_intakes_pending_handoff
    ON public.whatsapp_order_intakes (created_at DESC)
    WHERE status = 'handed_off' AND resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_order_intakes_study_order
    ON public.whatsapp_order_intakes (study_order_id)
    WHERE study_order_id IS NOT NULL;

DROP TRIGGER IF EXISTS set_updated_at ON public.whatsapp_order_intakes;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.whatsapp_order_intakes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_whatsapp_order_intakes_sender') THEN
        ALTER TABLE public.whatsapp_order_intakes
            ADD CONSTRAINT fk_whatsapp_order_intakes_sender
            FOREIGN KEY (sender_user_id) REFERENCES public.users (id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_whatsapp_order_intakes_patient') THEN
        ALTER TABLE public.whatsapp_order_intakes
            ADD CONSTRAINT fk_whatsapp_order_intakes_patient
            FOREIGN KEY (patient_id) REFERENCES public.users (id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_whatsapp_order_intakes_resolver') THEN
        ALTER TABLE public.whatsapp_order_intakes
            ADD CONSTRAINT fk_whatsapp_order_intakes_resolver
            FOREIGN KEY (resolved_by) REFERENCES public.users (id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_whatsapp_order_intakes_order') THEN
        ALTER TABLE public.whatsapp_order_intakes
            ADD CONSTRAINT fk_whatsapp_order_intakes_order
            FOREIGN KEY (study_order_id) REFERENCES public.study_orders (id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_whatsapp_order_intakes_sede') THEN
        ALTER TABLE public.whatsapp_order_intakes
            ADD CONSTRAINT fk_whatsapp_order_intakes_sede
            FOREIGN KEY (chosen_sede_id) REFERENCES public.sedes (id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_study_orders_source_intake') THEN
        ALTER TABLE public.study_orders
            ADD CONSTRAINT fk_study_orders_source_intake
            FOREIGN KEY (source_intake_id) REFERENCES public.whatsapp_order_intakes (id) ON DELETE SET NULL;
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 4. Configuración
-- -----------------------------------------------------------------------------
-- El flag nace apagado: activar las órdenes por WhatsApp es decisión de cada
-- clínica, después de las pruebas (modo test + lista blanca).
INSERT INTO public.system_configurations (key, value, description, data_type, is_public)
SELECT v.key, v.value, v.description, v.data_type, false
  FROM (VALUES
    ('whatsapp_orders_enabled', 'false',
     'Si es true, el agente de WhatsApp procesa órdenes de estudio recibidas como foto o PDF.',
     'boolean'),
    ('whatsapp_orders_min_confidence', '0.85',
     'Confianza mínima (0 a 1) con la que se acepta una línea leída de la orden sin repreguntar al usuario.',
     'number'),
    ('whatsapp_orders_vision_model', 'gpt-5.6-luna',
     'Modelo de OpenAI que lee las órdenes (imagen y PDF). Debe admitir entrada de imágenes y salida estructurada. Por defecto el mismo que usa el agente: confirmar que admite visión antes de activar las órdenes.',
     'string'),
    ('whatsapp_orders_calendar_ids', '',
     'Ids de calendar_sources (separados por coma) donde el agente puede agendar órdenes de estudio. Vacío = cualquier calendario activo de la sede elegida.',
     'string'),
    ('whatsapp_orders_intake_ttl_hours', '24',
     'Horas de inactividad tras las cuales un intake en curso se marca como abandonado.',
     'number')
  ) AS v(key, value, description, data_type)
 WHERE NOT EXISTS (SELECT 1 FROM public.system_configurations c WHERE c.key = v.key);

-- -----------------------------------------------------------------------------
-- 5. Registro de migración
-- -----------------------------------------------------------------------------
INSERT INTO public.db_migrations (script_name, version_tag, notes)
VALUES (
    '123_20260930_whatsapp-study-order-intake.sql',
    'v1',
    'Órdenes por WhatsApp (fase 1) — study_orders.doctor_id opcional + source/referring_doctor_name/source_intake_id, columnas de adjunto en las tablas de WhatsApp, whatsapp_order_intakes y claves whatsapp_orders_*'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;

-- =============================================================================
-- Rollback manual
-- =============================================================================
-- Ojo: volver doctor_id a NOT NULL falla si ya hay órdenes sin doctor.
-- BEGIN;
-- DELETE FROM public.system_configurations WHERE key IN
--   ('whatsapp_orders_enabled', 'whatsapp_orders_min_confidence', 'whatsapp_orders_vision_model', 'whatsapp_orders_calendar_ids', 'whatsapp_orders_intake_ttl_hours');
-- ALTER TABLE public.study_orders DROP CONSTRAINT IF EXISTS fk_study_orders_source_intake;
-- ALTER TABLE public.study_orders DROP CONSTRAINT IF EXISTS study_orders_source_check;
-- ALTER TABLE public.study_orders DROP COLUMN IF EXISTS source_intake_id;
-- ALTER TABLE public.study_orders DROP COLUMN IF EXISTS referring_doctor_name;
-- ALTER TABLE public.study_orders DROP COLUMN IF EXISTS source;
-- DROP TABLE IF EXISTS public.whatsapp_order_intakes;
-- ALTER TABLE public.whatsapp_conversation_messages
--   DROP COLUMN IF EXISTS media_kind, DROP COLUMN IF EXISTS media_attachment_id;
-- ALTER TABLE public.whatsapp_inbound_buffer DROP CONSTRAINT IF EXISTS whatsapp_inbound_buffer_media_kind_check;
-- ALTER TABLE public.whatsapp_inbound_buffer
--   DROP COLUMN IF EXISTS media_kind, DROP COLUMN IF EXISTS media_id, DROP COLUMN IF EXISTS media_url,
--   DROP COLUMN IF EXISTS media_mime, DROP COLUMN IF EXISTS media_sha256, DROP COLUMN IF EXISTS media_filename, DROP COLUMN IF EXISTS media_caption;
-- -- ALTER TABLE public.study_orders ALTER COLUMN doctor_id SET NOT NULL;   -- sólo si no hay nulos
-- DELETE FROM public.db_migrations WHERE script_name = '123_20260930_whatsapp-study-order-intake.sql';
-- COMMIT;
