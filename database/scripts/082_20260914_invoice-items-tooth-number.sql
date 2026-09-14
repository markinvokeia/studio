-- =====================================================================
-- invoice_items — columna tooth_number
-- Run on: dev / staging / prod
-- Idempotente: se puede correr varias veces sin efectos secundarios.
-- =====================================================================
--
-- Cambios:
--   1. Agrega columna `tooth_number` (integer, nullable) a invoice_items.
--      Permite mostrar la pieza dental trabajada en una factura, igual
--      que ya existe en quote_items y order_items.
-- =====================================================================

BEGIN;

ALTER TABLE public.invoice_items
    ADD COLUMN IF NOT EXISTS tooth_number integer;

COMMENT ON COLUMN public.invoice_items.tooth_number
    IS 'Pieza dental asociada al ítem de factura. Copiada de quote_items.tooth_number al facturar, o editable directamente en ítems de factura ad-hoc.';

-- ─── Registro de migración ────────────────────────────────────────────────────

INSERT INTO db_migrations (script_name, version_tag, notes)
VALUES (
    '082_20260914_invoice-items-tooth-number.sql',
    'v1',
    'invoice_items: agrega columna tooth_number para mostrar la pieza dental en facturas/estado de cuenta'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;
