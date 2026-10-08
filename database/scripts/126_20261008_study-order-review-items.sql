-- =============================================================================
-- Órdenes de estudio — puntos a revisar (lo que el agente de WhatsApp no tuvo claro)
-- =============================================================================
-- Contexto (docs/whatsapp-ordenes-estudio-plan.md, §21-22):
--
--   1. Columna `study_orders.review_items` (jsonb, arreglo): un elemento por cada dato que el
--      agente no tuvo claro al leer la orden (lectura dudosa, estudio fuera del catálogo, dato
--      ilegible, detalle que no encaja en el formulario, falta el dorso, motivo de la derivación...).
--      Cada uno se revisa contra el original y queda confirmado, corregido o descartado, con quién
--      y cuándo:
--        { id, code, field, label, value_read, confidence, detail, blocking, status,
--          resolution_note, reviewed_by, reviewed_by_name, reviewed_at, created_at }
--        - blocking = true  → borrador creado al derivar: no se puede enviar la orden mientras
--                              quede alguno pendiente (SUBMIT_SQL).
--        - blocking = false → orden que el agente agendó solo: lista de verificación.
--      Va en la misma tabla de órdenes: no hace falta otra entidad para esto.
--   2. Tipo de evento `review_updated` en la línea de tiempo de la orden.
--
-- Requiere la 122 (study_orders con source/source_intake_id). Idempotente.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Puntos a revisar
-- -----------------------------------------------------------------------------
ALTER TABLE public.study_orders
    ADD COLUMN IF NOT EXISTS review_items jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.study_orders
    DROP CONSTRAINT IF EXISTS study_orders_review_items_array_check;
ALTER TABLE public.study_orders
    ADD CONSTRAINT study_orders_review_items_array_check
        CHECK (jsonb_typeof(review_items) = 'array');

COMMENT ON COLUMN public.study_orders.review_items IS
    'Datos que el agente de WhatsApp no tuvo claros al leer la orden; recepción los revisa contra el original.';

-- -----------------------------------------------------------------------------
-- 2. Evento review_updated
-- -----------------------------------------------------------------------------
ALTER TABLE public.study_order_events
    DROP CONSTRAINT IF EXISTS study_order_events_type_check;
ALTER TABLE public.study_order_events
    ADD CONSTRAINT study_order_events_type_check
        CHECK (event_type IN ('created', 'updated', 'submitted', 'acknowledged', 'scheduled',
                              'rescheduled', 'appointment_updated', 'appointment_cancelled',
                              'session_saved', 'completed', 'reopened', 'cancelled',
                              'link_created', 'patient_booked', 'review_updated'));

-- -----------------------------------------------------------------------------
-- 3. Registro de migración
-- -----------------------------------------------------------------------------
INSERT INTO public.db_migrations (script_name, version_tag, notes)
VALUES (
    '126_20261008_study-order-review-items.sql',
    'v2',
    'Órdenes de estudio — columna study_orders.review_items y evento review_updated'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;

-- =============================================================================
-- Rollback manual
-- =============================================================================
-- Ojo: falla si ya hay eventos review_updated.
-- BEGIN;
-- ALTER TABLE public.study_orders DROP CONSTRAINT IF EXISTS study_orders_review_items_array_check;
-- ALTER TABLE public.study_orders DROP COLUMN IF EXISTS review_items;
-- ALTER TABLE public.study_order_events DROP CONSTRAINT IF EXISTS study_order_events_type_check;
-- ALTER TABLE public.study_order_events ADD CONSTRAINT study_order_events_type_check
--     CHECK (event_type IN ('created', 'updated', 'submitted', 'acknowledged', 'scheduled',
--                           'rescheduled', 'appointment_updated', 'appointment_cancelled',
--                           'session_saved', 'completed', 'reopened', 'cancelled',
--                           'link_created', 'patient_booked'));
-- DELETE FROM public.db_migrations WHERE script_name = '126_20261008_study-order-review-items.sql';
-- COMMIT;
