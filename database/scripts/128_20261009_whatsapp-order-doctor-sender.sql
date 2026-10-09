-- =============================================================================
-- Órdenes de estudio por WhatsApp — el doctor agenda la orden de un paciente
-- =============================================================================
-- Contexto (docs/whatsapp-ordenes-estudio-plan.md, §27):
--
--   Hasta ahora quien escribe era siempre el paciente (o alguien que se derivaba). Con esto un
--   doctor puede mandar la orden de un paciente suyo. Quién es doctor se decide UNA vez, al abrir
--   el intake, y queda guardado: así el validador, las herramientas y la auditoría ven lo mismo
--   aunque después cambien los roles o el flag.
--
--   1. `sender_kind`: 'patient' (lo de siempre) o 'doctor'. Lo calcula `Get Or Create Intake`
--      (WhatsApp - Order Agent): el teléfono identifica a UN usuario activo con rol de doctor
--      ('medico' / 'odontologo', el mismo criterio que Config → Doctores) y con
--      STUDY_ORDERS_CREATE, y el flag está encendido. Las importaciones quedan en 'patient'
--      (no lo usan).
--   2. Clave `whatsapp_orders_doctor_enabled` (nace en false).
--   3. `normalize_phone_uy(text)`: los teléfonos del padrón están escritos de muchas formas
--      ('098-530863', '59895751736', '099 123 456', '+598 2 908 5500') y WhatsApp llega como
--      '+59898530863'. Comparar el texto tal cual no encontraba al paciente por su teléfono. La función
--      deja '+<dígitos>' (sin código de país asume Uruguay) o NULL si no parece un teléfono
--      ('SIN_TELEFONO3', '123'), con un índice para buscar por ella. Mismo criterio que
--      normalizePhone de scripts/n8n/study-order-intake/intake-lib.mjs.
--   4. Motivo de derivación `missing_patient_data`: un doctor manda la orden de un paciente nuevo y
--      no tiene los datos obligatorios para registrarlo (nombre, documento y teléfono).
--
-- Requiere la 123, la 125 y la 127. Idempotente.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Tipo de remitente
-- -----------------------------------------------------------------------------
ALTER TABLE public.whatsapp_order_intakes
    ADD COLUMN IF NOT EXISTS sender_kind varchar(20) NOT NULL DEFAULT 'patient';

ALTER TABLE public.whatsapp_order_intakes
    DROP CONSTRAINT IF EXISTS whatsapp_order_intakes_sender_kind_check;
ALTER TABLE public.whatsapp_order_intakes
    ADD CONSTRAINT whatsapp_order_intakes_sender_kind_check
        CHECK (sender_kind IN ('patient', 'doctor'));

-- Un doctor siempre está identificado: sin usuario no hay a quién poner como derivador.
ALTER TABLE public.whatsapp_order_intakes
    DROP CONSTRAINT IF EXISTS whatsapp_order_intakes_doctor_sender_check;
ALTER TABLE public.whatsapp_order_intakes
    ADD CONSTRAINT whatsapp_order_intakes_doctor_sender_check
        CHECK (sender_kind <> 'doctor' OR sender_user_id IS NOT NULL);

COMMENT ON COLUMN public.whatsapp_order_intakes.sender_kind IS
    'Quién escribe: patient (el paciente o alguien a confirmar) o doctor (manda la orden de un paciente; queda como derivador). Se fija al abrir el intake.';

-- -----------------------------------------------------------------------------
-- 2. Flag
-- -----------------------------------------------------------------------------
INSERT INTO public.system_configurations (key, value, description, data_type, is_public)
SELECT 'whatsapp_orders_doctor_enabled', 'false',
       'Si es true, un doctor (con su teléfono cargado) puede mandar por WhatsApp la orden de un paciente y agendarla o recibir el link para el paciente.',
       'boolean', false
 WHERE NOT EXISTS (SELECT 1 FROM public.system_configurations c WHERE c.key = 'whatsapp_orders_doctor_enabled');

-- -----------------------------------------------------------------------------
-- 3. Teléfono normalizado
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.normalize_phone_uy(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
    SELECT CASE WHEN length(n) BETWEEN 10 AND 15 THEN '+' || n END
      FROM (
        SELECT CASE
                 WHEN d ~ '^0[0-9]{8}$'     THEN '598' || substr(d, 2)
                 WHEN d ~ '^[2-9][0-9]{7}$' THEN '598' || d
                 ELSE d
               END AS n
          FROM (SELECT regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g') AS d) s
      ) t;
$$;

COMMENT ON FUNCTION public.normalize_phone_uy(text) IS
    'Teléfono escrito de cualquier forma → ''+<dígitos>'' (sin código de país asume Uruguay) o NULL. Para buscar usuarios por el teléfono de WhatsApp.';

CREATE INDEX IF NOT EXISTS idx_users_phone_normalized
    ON public.users (public.normalize_phone_uy(phone_number));

-- -----------------------------------------------------------------------------
-- 4. Motivo de derivación: faltan datos del paciente
-- -----------------------------------------------------------------------------
ALTER TABLE public.whatsapp_order_intakes
    DROP CONSTRAINT IF EXISTS whatsapp_order_intakes_handoff_reason_check;
ALTER TABLE public.whatsapp_order_intakes
    ADD CONSTRAINT whatsapp_order_intakes_handoff_reason_check
        CHECK (handoff_reason IS NULL OR handoff_reason IN
               ('service_not_found', 'unreadable', 'low_confidence', 'patient_mismatch',
                'booking_failed', 'user_request', 'system_error', 'order_changed',
                'missing_patient_data'));

-- -----------------------------------------------------------------------------
-- 5. Registro de migración
-- -----------------------------------------------------------------------------
INSERT INTO public.db_migrations (script_name, version_tag, notes)
VALUES (
    '128_20261009_whatsapp-order-doctor-sender.sql',
    'v1',
    'Órdenes de estudio por WhatsApp — doctor como remitente: sender_kind, whatsapp_orders_doctor_enabled, normalize_phone_uy y motivo missing_patient_data'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;

-- =============================================================================
-- Rollback manual
-- =============================================================================
-- BEGIN;
-- DROP INDEX IF EXISTS public.idx_users_phone_normalized;
-- DROP FUNCTION IF EXISTS public.normalize_phone_uy(text);
-- (motivo: volver al CHECK de la 125, sin missing_patient_data, tras pasar esas derivaciones a otro motivo)
-- ALTER TABLE public.whatsapp_order_intakes DROP CONSTRAINT IF EXISTS whatsapp_order_intakes_doctor_sender_check;
-- ALTER TABLE public.whatsapp_order_intakes DROP CONSTRAINT IF EXISTS whatsapp_order_intakes_sender_kind_check;
-- ALTER TABLE public.whatsapp_order_intakes DROP COLUMN IF EXISTS sender_kind;
-- DELETE FROM public.system_configurations WHERE key = 'whatsapp_orders_doctor_enabled';
-- DELETE FROM public.db_migrations WHERE script_name = '128_20261009_whatsapp-order-doctor-sender.sql';
-- COMMIT;
