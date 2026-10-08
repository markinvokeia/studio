-- =============================================================================
-- Órdenes de estudio — importar la orden desde Invoke (fotos o PDF)
-- =============================================================================
-- Contexto (docs/whatsapp-ordenes-estudio-plan.md, §24):
--
--   Recepción sube las fotos o el PDF de una orden en papel y la lee el mismo subflujo que las de
--   WhatsApp (WhatsApp - Study Order Intake, modo 'import'). La lectura se registra en la misma
--   tabla: un intake es "la lectura de una orden a partir de sus originales", venga de donde venga.
--   Así los originales (attachments con source_name = 'whatsapp_order_intake'), el visor de
--   archivos y study_orders.source_intake_id sirven igual para las dos.
--
--   1. `channel`: 'whatsapp' (lo de siempre) o 'import' (subido desde Invoke).
--   2. `created_by`: quién importó. Solo en 'import'.
--   3. `phone` deja de ser obligatorio: una importación no tiene teléfono. Sigue siéndolo en
--      WhatsApp (CHECK). El índice único de intake activo por teléfono no se toca: los NULL no
--      chocan entre sí, y las consultas del agente filtran por teléfono, así que nunca ven una
--      importación.
--
-- Requiere la 123. Idempotente.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Canal
-- -----------------------------------------------------------------------------
ALTER TABLE public.whatsapp_order_intakes
    ADD COLUMN IF NOT EXISTS channel varchar(20) NOT NULL DEFAULT 'whatsapp';

ALTER TABLE public.whatsapp_order_intakes
    DROP CONSTRAINT IF EXISTS whatsapp_order_intakes_channel_check;
ALTER TABLE public.whatsapp_order_intakes
    ADD CONSTRAINT whatsapp_order_intakes_channel_check
        CHECK (channel IN ('whatsapp', 'import'));

COMMENT ON COLUMN public.whatsapp_order_intakes.channel IS
    'Origen de los originales: whatsapp (agente) o import (subidos desde Invoke por recepción).';

-- -----------------------------------------------------------------------------
-- 2. Quién importó
-- -----------------------------------------------------------------------------
ALTER TABLE public.whatsapp_order_intakes
    ADD COLUMN IF NOT EXISTS created_by uuid;

ALTER TABLE public.whatsapp_order_intakes
    DROP CONSTRAINT IF EXISTS fk_whatsapp_order_intakes_created_by;
ALTER TABLE public.whatsapp_order_intakes
    ADD CONSTRAINT fk_whatsapp_order_intakes_created_by
        FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- -----------------------------------------------------------------------------
-- 3. Teléfono: obligatorio solo en WhatsApp
-- -----------------------------------------------------------------------------
ALTER TABLE public.whatsapp_order_intakes
    ALTER COLUMN phone DROP NOT NULL;

ALTER TABLE public.whatsapp_order_intakes
    DROP CONSTRAINT IF EXISTS whatsapp_order_intakes_phone_check;
ALTER TABLE public.whatsapp_order_intakes
    ADD CONSTRAINT whatsapp_order_intakes_phone_check
        CHECK (channel <> 'whatsapp' OR phone IS NOT NULL);

-- -----------------------------------------------------------------------------
-- 4. Registro de migración
-- -----------------------------------------------------------------------------
INSERT INTO public.db_migrations (script_name, version_tag, notes)
VALUES (
    '127_20261008_study-order-import.sql',
    'v1',
    'Órdenes de estudio — importar desde Invoke: whatsapp_order_intakes.channel, created_by y phone opcional'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;

-- =============================================================================
-- Rollback manual
-- =============================================================================
-- Ojo: falla si ya hay intakes importados (sin teléfono).
-- BEGIN;
-- ALTER TABLE public.whatsapp_order_intakes DROP CONSTRAINT IF EXISTS whatsapp_order_intakes_phone_check;
-- ALTER TABLE public.whatsapp_order_intakes ALTER COLUMN phone SET NOT NULL;
-- ALTER TABLE public.whatsapp_order_intakes DROP CONSTRAINT IF EXISTS fk_whatsapp_order_intakes_created_by;
-- ALTER TABLE public.whatsapp_order_intakes DROP COLUMN IF EXISTS created_by;
-- ALTER TABLE public.whatsapp_order_intakes DROP CONSTRAINT IF EXISTS whatsapp_order_intakes_channel_check;
-- ALTER TABLE public.whatsapp_order_intakes DROP COLUMN IF EXISTS channel;
-- DELETE FROM public.db_migrations WHERE script_name = '127_20261008_study-order-import.sql';
-- COMMIT;
