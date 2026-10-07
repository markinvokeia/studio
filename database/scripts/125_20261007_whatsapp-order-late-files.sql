-- =============================================================================
-- Órdenes de estudio por WhatsApp — archivos que llegan tarde (frente y dorso)
-- =============================================================================
-- Contexto (docs/whatsapp-ordenes-estudio-plan.md, §18):
--
--   1. Nuevo motivo de derivación `order_changed`: la orden ya estaba creada en
--      Invoke (intake en order_created, falta la cita) y llegó otro archivo,
--      típicamente el dorso, que agrega estudios. La orden no se modifica sola:
--      se deriva a recepción con los estudios que agrega.
--   2. Clave `whatsapp_orders_media_debounce_seconds` (60): cuánto espera el
--      agente tras el último mensaje cuando el lote trae una foto o PDF, para
--      que el frente y el dorso caigan en el mismo lote. El flujo ya usa 60 si
--      falta; se crea para que se vea y se pueda cambiar desde Sistema.
--
-- Requiere la 123 (whatsapp_order_intakes). Idempotente.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Motivo de derivación order_changed
-- -----------------------------------------------------------------------------
ALTER TABLE public.whatsapp_order_intakes
    DROP CONSTRAINT IF EXISTS whatsapp_order_intakes_handoff_reason_check;
ALTER TABLE public.whatsapp_order_intakes
    ADD CONSTRAINT whatsapp_order_intakes_handoff_reason_check
        CHECK (handoff_reason IS NULL OR handoff_reason IN
               ('service_not_found', 'unreadable', 'low_confidence', 'patient_mismatch',
                'booking_failed', 'user_request', 'system_error', 'order_changed'));

-- -----------------------------------------------------------------------------
-- 2. Espera del debounce para lotes con archivos
-- -----------------------------------------------------------------------------
INSERT INTO public.system_configurations (key, value, description, data_type, is_public)
SELECT 'whatsapp_orders_media_debounce_seconds', '60',
       'Segundos que el asistente espera tras el último mensaje cuando llegó una foto o PDF, para juntar frente y dorso de la orden.',
       'number', false
 WHERE NOT EXISTS (SELECT 1 FROM public.system_configurations WHERE key = 'whatsapp_orders_media_debounce_seconds');

-- -----------------------------------------------------------------------------
-- 3. Registro de migración
-- -----------------------------------------------------------------------------
INSERT INTO public.db_migrations (script_name, version_tag, notes)
VALUES (
    '125_20261007_whatsapp-order-late-files.sql',
    'v1',
    'Órdenes por WhatsApp — motivo de derivación order_changed y clave whatsapp_orders_media_debounce_seconds'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;

-- =============================================================================
-- Rollback manual
-- =============================================================================
-- Ojo: falla si ya hay intakes derivados con order_changed.
-- BEGIN;
-- DELETE FROM public.system_configurations WHERE key = 'whatsapp_orders_media_debounce_seconds';
-- ALTER TABLE public.whatsapp_order_intakes DROP CONSTRAINT IF EXISTS whatsapp_order_intakes_handoff_reason_check;
-- ALTER TABLE public.whatsapp_order_intakes ADD CONSTRAINT whatsapp_order_intakes_handoff_reason_check
--     CHECK (handoff_reason IS NULL OR handoff_reason IN
--            ('service_not_found', 'unreadable', 'low_confidence', 'patient_mismatch',
--             'booking_failed', 'user_request', 'system_error'));
-- DELETE FROM public.db_migrations WHERE script_name = '125_20261007_whatsapp-order-late-files.sql';
-- COMMIT;
