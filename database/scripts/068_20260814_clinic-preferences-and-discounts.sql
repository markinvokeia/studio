-- =====================================================================
-- Preferencias de Clínica y Descuentos manuales
--
--   1. public.clinic_preferences → tabla nueva, una fila por clínica, con los
--      ajustes de producto que NO son datos fiscales ni de contacto. Hoy sólo
--      guarda la política de descuentos; está pensada para crecer.
--   2. Campos de descuento en quotes / quote_items / orders / order_items /
--      invoices / invoice_items.
--   3. Permisos CLINIC_PREFS_* (página Configuración → Preferencias de Clínica)
--      y SALES_APPLY_DISCOUNT (aplicar descuentos en una venta).
--
-- CONVENIO DE IMPORTES — importante para quien toque los flujos n8n:
--   `total` de una línea es SIEMPRE el importe NETO (con el descuento ya
--   aplicado), y `gross_total` el bruto (unit_price × quantity). Así el
--   recálculo que ya hacen los flujos —`UPDATE quotes SET total = SUM(qi.total)`
--   y su equivalente en facturas— sigue siendo correcto sin cambios.
--   Un descuento "al total" se prorratea entre las líneas antes de guardar;
--   la cabecera conserva el valor original tecleado sólo para mostrarlo e
--   imprimirlo.
--
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.
-- Depende de: 067_20260806_patient-portal-booking-mode.sql
-- =====================================================================

BEGIN;

-- -----------------------------------------------------------------------
-- 1. Preferencias de la clínica
--    Tabla propia (no columnas en `clinic`) porque se carga y se cachea
--    aparte: el frontend la pide una sola vez tras el login.
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clinic_preferences (
    id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id            INTEGER      NOT NULL UNIQUE
                         REFERENCES public.clinic (id) ON DELETE CASCADE,

    -- Descuentos
    discounts_enabled    BOOLEAN      NOT NULL DEFAULT false,
    discount_scope       VARCHAR(10)  NOT NULL DEFAULT 'line'
                         CHECK (discount_scope IN ('line', 'total')),
    default_discount_pct NUMERIC(5,2) NOT NULL DEFAULT 0
                         CHECK (default_discount_pct >= 0 AND default_discount_pct <= 100),
    max_discount_pct     NUMERIC(5,2) NOT NULL DEFAULT 100
                         CHECK (max_discount_pct >= 0 AND max_discount_pct <= 100),

    created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.clinic_preferences                      IS 'Ajustes de producto por clínica (Configuración → Preferencias de Clínica). Una fila por clínica.';
COMMENT ON COLUMN public.clinic_preferences.discounts_enabled    IS 'Habilita los descuentos manuales en presupuestos y facturas. FALSE ⇒ las pantallas de venta no muestran ningún campo de descuento.';
COMMENT ON COLUMN public.clinic_preferences.discount_scope       IS 'Dónde se aplica el descuento: ''line'' por servicio, ''total'' sobre el documento. Excluyente.';
COMMENT ON COLUMN public.clinic_preferences.default_discount_pct IS 'Porcentaje precargado en el campo de descuento. 0 ⇒ el campo arranca vacío.';
COMMENT ON COLUMN public.clinic_preferences.max_discount_pct     IS 'Tope de descuento que el formulario deja guardar, en porcentaje sobre la base. 100 ⇒ sin tope.';

-- La función ya existe en la BD (creada por 029_...print-templates).
DROP TRIGGER IF EXISTS set_updated_at ON public.clinic_preferences;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.clinic_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Fila inicial para la clínica activa, con los descuentos apagados.
INSERT INTO public.clinic_preferences (clinic_id)
SELECT id FROM public.clinic
ON CONFLICT (clinic_id) DO NOTHING;

-- -----------------------------------------------------------------------
-- 2. Campos de descuento en las líneas
--    Todos NULLABLE: las filas históricas se leen con `gross_total ?? total`
--    y `discount_mode IS NULL` ⇒ sin descuento.
-- -----------------------------------------------------------------------
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY['quote_items', 'order_items', 'invoice_items']
    LOOP
        EXECUTE format(
            'ALTER TABLE public.%I
                 ADD COLUMN IF NOT EXISTS gross_total     numeric(12,2),
                 ADD COLUMN IF NOT EXISTS discount_mode   varchar(10),
                 ADD COLUMN IF NOT EXISTS discount_value  numeric(12,2),
                 ADD COLUMN IF NOT EXISTS discount_amount numeric(12,2)', tbl);

        EXECUTE format(
            'ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', tbl, tbl || '_discount_mode_check');
        EXECUTE format(
            'ALTER TABLE public.%I ADD CONSTRAINT %I
                 CHECK (discount_mode IS NULL OR discount_mode IN (''percent'', ''amount''))',
            tbl, tbl || '_discount_mode_check');
    END LOOP;
END $$;

COMMENT ON COLUMN public.quote_items.gross_total     IS 'unit_price × quantity, SIN descuento. NULL en filas anteriores a los descuentos ⇒ leer como = total.';
COMMENT ON COLUMN public.quote_items.discount_mode   IS '''percent'' o ''amount''. NULL ⇒ la línea no lleva descuento.';
COMMENT ON COLUMN public.quote_items.discount_value  IS 'El valor tal cual lo tecleó el usuario: 10 significa 10 % o 10 unidades de moneda según discount_mode.';
COMMENT ON COLUMN public.quote_items.discount_amount IS 'Dinero efectivamente descontado en esta línea. Siempre total = gross_total - discount_amount.';

COMMENT ON COLUMN public.invoice_items.gross_total     IS 'unit_price × quantity, SIN descuento. NULL ⇒ leer como = total.';
COMMENT ON COLUMN public.invoice_items.discount_mode   IS '''percent'' o ''amount''. NULL ⇒ sin descuento.';
COMMENT ON COLUMN public.invoice_items.discount_value  IS 'Valor tecleado por el usuario (% o importe según discount_mode).';
COMMENT ON COLUMN public.invoice_items.discount_amount IS 'Dinero descontado en esta línea. total = gross_total - discount_amount.';

-- `order_items` no guarda precios propios (los hereda de quote_items vía
-- quote_item_id); estos campos se copian al confirmar el presupuesto y existen
-- sólo por trazabilidad de la orden.
COMMENT ON COLUMN public.order_items.gross_total     IS 'Copia del gross_total de la quote_item de origen. Sólo trazabilidad: la orden no tiene precios propios.';
COMMENT ON COLUMN public.order_items.discount_mode   IS 'Copia del discount_mode de la quote_item de origen.';
COMMENT ON COLUMN public.order_items.discount_value  IS 'Copia del discount_value de la quote_item de origen.';
COMMENT ON COLUMN public.order_items.discount_amount IS 'Copia del discount_amount de la quote_item de origen.';

-- -----------------------------------------------------------------------
-- 3. Campos de descuento en las cabeceras
--    `total` NO cambia de semántica: sigue siendo el neto y sigue cuadrando
--    con SUM(items.total).
-- -----------------------------------------------------------------------
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY['quotes', 'orders', 'invoices']
    LOOP
        EXECUTE format(
            'ALTER TABLE public.%I
                 ADD COLUMN IF NOT EXISTS gross_total     numeric(12,2),
                 ADD COLUMN IF NOT EXISTS discount_scope  varchar(10),
                 ADD COLUMN IF NOT EXISTS discount_mode   varchar(10),
                 ADD COLUMN IF NOT EXISTS discount_value  numeric(12,2),
                 ADD COLUMN IF NOT EXISTS discount_amount numeric(12,2)', tbl);

        EXECUTE format(
            'ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', tbl, tbl || '_discount_mode_check');
        EXECUTE format(
            'ALTER TABLE public.%I ADD CONSTRAINT %I
                 CHECK (discount_mode IS NULL OR discount_mode IN (''percent'', ''amount''))',
            tbl, tbl || '_discount_mode_check');

        EXECUTE format(
            'ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', tbl, tbl || '_discount_scope_check');
        EXECUTE format(
            'ALTER TABLE public.%I ADD CONSTRAINT %I
                 CHECK (discount_scope IS NULL OR discount_scope IN (''line'', ''total''))',
            tbl, tbl || '_discount_scope_check');
    END LOOP;
END $$;

COMMENT ON COLUMN public.quotes.gross_total     IS 'Suma de gross_total de las líneas (bruto del documento). NULL ⇒ leer como = total.';
COMMENT ON COLUMN public.quotes.discount_scope  IS 'Cómo se aplicó el descuento en ESTE documento: ''line'' o ''total''. Foto del ajuste vigente al crearlo.';
COMMENT ON COLUMN public.quotes.discount_mode   IS 'Sólo con discount_scope = ''total'': ''percent'' o ''amount''.';
COMMENT ON COLUMN public.quotes.discount_value  IS 'Sólo con discount_scope = ''total'': el valor tecleado por el usuario.';
COMMENT ON COLUMN public.quotes.discount_amount IS 'Descuento total del documento. Con scope ''line'' es la suma de las líneas. El importe ya está repartido en items.total.';

COMMENT ON COLUMN public.invoices.gross_total     IS 'Suma de gross_total de las líneas. NULL ⇒ leer como = total.';
COMMENT ON COLUMN public.invoices.discount_scope  IS '''line'' o ''total'' — cómo se aplicó el descuento en esta factura.';
COMMENT ON COLUMN public.invoices.discount_mode   IS 'Sólo con scope ''total''.';
COMMENT ON COLUMN public.invoices.discount_value  IS 'Sólo con scope ''total'': valor tecleado.';
COMMENT ON COLUMN public.invoices.discount_amount IS 'Descuento total de la factura, ya repartido en invoice_items.total.';

COMMENT ON COLUMN public.orders.gross_total     IS 'Copia del bruto del presupuesto de origen. Trazabilidad.';
COMMENT ON COLUMN public.orders.discount_scope  IS 'Copia del discount_scope del presupuesto de origen.';
COMMENT ON COLUMN public.orders.discount_mode   IS 'Copia del discount_mode del presupuesto de origen.';
COMMENT ON COLUMN public.orders.discount_value  IS 'Copia del discount_value del presupuesto de origen.';
COMMENT ON COLUMN public.orders.discount_amount IS 'Copia del discount_amount del presupuesto de origen.';

-- -----------------------------------------------------------------------
-- 4. Permisos
-- -----------------------------------------------------------------------
INSERT INTO public.permissions (name, description, code, module, submenu, permission_type)
VALUES
    ('Ver Preferencias de Clínica',
     'Acceder a Configuración → Preferencias de Clínica',
     'CLINIC_PREFS_VIEW',    'config', 'clinic-prefs', 'view'),
    ('Editar Preferencias de Clínica',
     'Modificar las preferencias de la clínica, incluida la política de descuentos',
     'CLINIC_PREFS_UPDATE',  'config', 'clinic-prefs', 'update'),
    ('Aplicar Descuentos',
     'Introducir descuentos manuales en presupuestos y facturas. Sin este permiso el campo se muestra en solo lectura',
     'SALES_APPLY_DISCOUNT', 'sales',  'discounts',    'update')
ON CONFLICT (code) DO NOTHING;

-- Mismos roles que gestionan los Datos de la Clínica: Administrador (4) y Gerente (37).
-- SALES_APPLY_DISCOUNT se concede deliberadamente sólo a esos dos: rebajar un
-- precio es una decisión de gestión. Si la clínica quiere que recepción o caja
-- también puedan, se otorga desde la pantalla de permisos por rol.
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.role_id, p.id
FROM (VALUES (4), (37)) AS r(role_id)
CROSS JOIN public.permissions p
WHERE p.code IN ('CLINIC_PREFS_VIEW', 'CLINIC_PREFS_UPDATE', 'SALES_APPLY_DISCOUNT')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- -----------------------------------------------------------------------
-- 5. Registro de migración
-- -----------------------------------------------------------------------
INSERT INTO public.db_migrations (script_name, version_tag, notes)
VALUES (
    '068_20260814_clinic-preferences-and-discounts.sql',
    'v1',
    'Preferencias de Clínica (tabla clinic_preferences), campos de descuento en quotes/orders/invoices y sus líneas, permisos CLINIC_PREFS_* y SALES_APPLY_DISCOUNT'
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
--   WHERE rp.permission_id = p.id
--     AND (p.code LIKE 'CLINIC_PREFS_%' OR p.code = 'SALES_APPLY_DISCOUNT');
-- DELETE FROM public.permissions
--   WHERE code LIKE 'CLINIC_PREFS_%' OR code = 'SALES_APPLY_DISCOUNT';
--
-- ALTER TABLE public.quote_items   DROP COLUMN IF EXISTS gross_total, DROP COLUMN IF EXISTS discount_mode, DROP COLUMN IF EXISTS discount_value, DROP COLUMN IF EXISTS discount_amount;
-- ALTER TABLE public.order_items   DROP COLUMN IF EXISTS gross_total, DROP COLUMN IF EXISTS discount_mode, DROP COLUMN IF EXISTS discount_value, DROP COLUMN IF EXISTS discount_amount;
-- ALTER TABLE public.invoice_items DROP COLUMN IF EXISTS gross_total, DROP COLUMN IF EXISTS discount_mode, DROP COLUMN IF EXISTS discount_value, DROP COLUMN IF EXISTS discount_amount;
-- ALTER TABLE public.quotes   DROP COLUMN IF EXISTS gross_total, DROP COLUMN IF EXISTS discount_scope, DROP COLUMN IF EXISTS discount_mode, DROP COLUMN IF EXISTS discount_value, DROP COLUMN IF EXISTS discount_amount;
-- ALTER TABLE public.orders   DROP COLUMN IF EXISTS gross_total, DROP COLUMN IF EXISTS discount_scope, DROP COLUMN IF EXISTS discount_mode, DROP COLUMN IF EXISTS discount_value, DROP COLUMN IF EXISTS discount_amount;
-- ALTER TABLE public.invoices DROP COLUMN IF EXISTS gross_total, DROP COLUMN IF EXISTS discount_scope, DROP COLUMN IF EXISTS discount_mode, DROP COLUMN IF EXISTS discount_value, DROP COLUMN IF EXISTS discount_amount;
--
-- DROP TABLE IF EXISTS public.clinic_preferences;
-- DELETE FROM public.db_migrations WHERE script_name = '068_20260814_clinic-preferences-and-discounts.sql';
-- COMMIT;
