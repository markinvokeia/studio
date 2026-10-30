-- =====================================================================
-- Moneda configurable por clínica: moneda secundaria opcional
--
--   clinic.secondary_currency → nueva columna, código ISO 4217 de 3 letras
--   o NULL. Es la segunda moneda en la que la clínica también acepta
--   operar; cuando está configurada, el frontend ofrece las dos monedas en
--   los formularios y muestra el tipo de cambio. NULL (el default, y el
--   valor de todas las filas existentes) ⇒ la clínica trabaja en moneda
--   única y toda esa UI desaparece.
--
--   `clinic.currency` ya existía y no se toca: pasa a ser la moneda
--   PRINCIPAL. Las instalaciones actuales de Uruguay deben quedar con
--   currency='UYU' y secondary_currency='USD' para conservar exactamente
--   el comportamiento de hoy — ver el UPDATE opcional al final.
--
-- Nada de esto cambia el formato de los datos ya guardados: las columnas
-- `currency` de facturas, presupuestos, cobros y movimientos de caja ya son
-- VARCHAR(3) y siguen admitiendo cualquier código ISO. Los registros
-- históricos guardados en otra moneda se siguen mostrando en la suya.
--
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.
-- =====================================================================

BEGIN;

-- -----------------------------------------------------------------------
-- 1. Nueva columna
-- -----------------------------------------------------------------------
ALTER TABLE public.clinic
    ADD COLUMN IF NOT EXISTS secondary_currency VARCHAR(3);

COMMENT ON COLUMN public.clinic.secondary_currency IS
    'Segunda moneda opcional (ISO 4217, 3 letras) en la que la clínica también opera. NULL ⇒ moneda única: el frontend oculta el selector de moneda, el tipo de cambio y las vistas de doble moneda.';

COMMENT ON COLUMN public.clinic.currency IS
    'Moneda de trabajo principal (ISO 4217, 3 letras). Es la que usa toda la UI por defecto.';

-- -----------------------------------------------------------------------
-- 2. Validación de formato
--    Se admite cualquier ISO de 3 letras mayúsculas, no una lista cerrada:
--    el catálogo de monedas que la UI ofrece vive en el frontend
--    (src/constants/currencies.ts) y no se duplica aquí.
-- -----------------------------------------------------------------------
ALTER TABLE public.clinic
    DROP CONSTRAINT IF EXISTS clinic_secondary_currency_check;
ALTER TABLE public.clinic
    ADD CONSTRAINT clinic_secondary_currency_check
    CHECK (secondary_currency IS NULL OR secondary_currency ~ '^[A-Z]{3}$');

-- La principal se valida igual, pero sin romper filas que ya la tengan mal.
ALTER TABLE public.clinic
    DROP CONSTRAINT IF EXISTS clinic_currency_check;
ALTER TABLE public.clinic
    ADD CONSTRAINT clinic_currency_check
    CHECK (currency IS NULL OR currency ~ '^[A-Z]{3}$')
    NOT VALID;

-- -----------------------------------------------------------------------
-- 3. Preservar el comportamiento actual en las instalaciones de Uruguay
--
--    Solo para las clínicas que hoy trabajan en UYU: se les marca USD como
--    secundaria, que es lo que el producto asumía cableado hasta ahora. El
--    resto se quedan en moneda única, que es el comportamiento correcto
--    para ellas.
-- -----------------------------------------------------------------------
UPDATE public.clinic
   SET secondary_currency = 'USD'
 WHERE currency = 'UYU'
   AND secondary_currency IS NULL;

   INSERT INTO db_migrations (script_name, version_tag, notes)
VALUES (
    '118_20260923_clinic-secondary-currency.sql',
    'v1',
    'Se adiciona el campo de moneda secundaria a la clínica'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;

-- =====================================================================
-- PENDIENTE — cambios de n8n que acompañan a esta migración
--
-- El flujo `clinic/update` (workflow "Web APIs") tiene DOS nodos Postgres
-- de upsert sobre `public.clinic` — "Update Clinic Info" (sin logo) y
-- "Update Clinic Info1" (con logo). Ambos mapean las columnas una a una,
-- así que hay que añadir en LOS DOS:
--
--     secondary_currency = {{ $('clinic/update').item.json.body.secondary_currency }}
--
-- y la entrada correspondiente en su array `schema` (tipo string, no
-- requerida). El frontend ya envía el campo siempre, y vacío cuando se
-- quiere volver a moneda única — conviene normalizar '' → NULL en el nodo.
--
-- El GET de `/clinic` devuelve la fila completa, así que la lectura no
-- necesita cambios.
-- =====================================================================
