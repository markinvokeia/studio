-- =====================================================================
-- Motor de alertas — vistas como origen de reglas + vista de facturas con
-- saldo real del paciente (prepagos / notas de crédito sin asignar)
--
-- Problema: la regla "Factura próxima a vencer" (INV_DUE_SOON) filtraba por
-- invoices.payment_state != 'paid'. Si el paciente tenía un PREPAGO (pago sin
-- factura, payments.invoice_id IS NULL) que nunca se asignó a la factura, ésta
-- seguía 'unpaid' y se le enviaba el recordatorio de cobro aunque ya hubiera
-- pagado.
--
-- Solución:
--   1. Las reglas de alerta ahora pueden usar como origen, además de tablas,
--      las vistas cuyo nombre empieza con "v_alert_" (flujo Alert Rules →
--      GET /system/tables). Cada vista declara en su COMMENT un JSON con
--      "reference_table": la tabla real a la que apuntan las alert_instances
--      (reference_table/reference_id), de modo que el envío de WhatsApp, el
--      panel de alertas y el anti-duplicado siguen funcionando igual que con
--      la tabla base.
--   2. public.v_alert_invoices: una fila por factura (type = 'invoice') con
--      TODAS las columnas de invoices más el saldo real:
--
--        applied_amount            pagos directos + asignaciones de pagos +
--                                  asignaciones de notas de crédito (en la
--                                  moneda de la factura)
--        residual_amount           total - applied_amount (>= 0)
--        patient_available_credit  saldo a favor del paciente SIN asignar, en
--                                  la misma moneda: prepagos no asignados +
--                                  notas de crédito no asignadas
--        patient_open_balance      suma de residual_amount de las facturas
--                                  abiertas del paciente en esa moneda
--        patient_net_balance       patient_open_balance - patient_available_credit
--        credit_covered_amount     parte del residual que el saldo a favor
--                                  cubre (FIFO por due_date, created_at, id:
--                                  el crédito se consume primero en las
--                                  facturas que vencen antes)
--        effective_residual        residual_amount - credit_covered_amount
--        effective_payment_state   'paid' | 'covered_by_credit' |
--                                  'partially_paid' | 'unpaid'
--        is_collectible            effective_residual > 0.01 → hay algo que
--                                  cobrar de verdad
--
-- Reglas de cálculo / supuestos (validados en DEV 2026-10-02):
--   · Sin conversión de moneda: un prepago en USD no cubre una factura en UYU
--     (mismo criterio que el estado de cuenta del paciente).
--   · Los pagos con invoice_id se aplican completos a esa factura
--     (converted_amount): Payment.json ya separa el excedente de un pago como
--     prepago aparte (invoice_id NULL), así que no hay remanente que contar.
--   · Pagos parciales y pagos grandes distribuidos entre varias facturas
--     (un payments por factura + sobrante como prepago) quedan reflejados en
--     applied_amount / patient_available_credit sin tratamiento especial.
--   · Ventas y compras se separan (is_sales en la partición).
--   · Facturas con total 0 quedan 'paid' (hoy figuran 'unpaid' en invoices).
--
-- Rendimiento: la vista calcula todo de forma agregada (hash aggregates sobre
-- payments / allocations, ventana sólo sobre facturas con residual > 0). Se
-- agrega el índice que faltaba en payments.invoice_id (la vista existente
-- view_invoice_status hace scans completos por cada factura).
--
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.
-- Despliegue: aplicar ESTE script ANTES de reimportar "Alert Rules" y
-- "Alert Scheduler" en n8n, y luego cambiar la regla INV_DUE_SOON a la vista
-- (ver bloque opcional al final).
-- =====================================================================

BEGIN;

CREATE INDEX IF NOT EXISTS idx_payments_invoice_id
    ON public.payments USING btree (invoice_id)
    WHERE invoice_id IS NOT NULL;

CREATE OR REPLACE VIEW public.v_alert_invoices AS
-- Montos en valor absoluto: el flujo Payment guarda en negativo los pagos de
-- compras (is_sales = false) y los de notas de crédito de venta (reembolsos).
WITH applied AS (
    -- Todo lo aplicado a cada factura. Cubre los tres modos de cobro:
    --   · pago parcial            → payments con invoice_id (monto < saldo)
    --   · pago grande distribuido → un payments con invoice_id POR factura
    --                               (SmartPaymentFormDialog) + el sobrante
    --                               como prepago (invoice_id NULL)
    --   · uso de saldo a favor    → payment_allocations / invoice_allocations
    -- Un pago mayor al saldo de su factura se parte en Payment.json: la parte
    -- que cubre la factura queda con invoice_id y el excedente como prepago.
    SELECT x.invoice_id, SUM(x.amount) AS amount
    FROM (
        SELECT p.invoice_id, ABS(COALESCE(p.converted_amount, p.amount)) AS amount
        FROM public.payments p
        WHERE p.invoice_id IS NOT NULL
        UNION ALL
        SELECT pa.invoice_id, ABS(COALESCE(pa.target_amount, pa.amount))
        FROM public.payment_allocations pa
        UNION ALL
        SELECT ia.target_id, ABS(COALESCE(ia.target_amount, ia.amount))
        FROM public.invoice_allocations ia
    ) x
    GROUP BY x.invoice_id
),
payment_alloc AS (
    SELECT pa.payment_id, SUM(ABS(pa.amount)) AS amount
    FROM public.payment_allocations pa
    GROUP BY pa.payment_id
),
credit_note_alloc AS (
    SELECT ia.source_id, SUM(ABS(ia.amount)) AS amount
    FROM public.invoice_allocations ia
    GROUP BY ia.source_id
),
credit_note_refund AS (
    -- Nota de crédito devuelta en dinero: pago con invoice_id = la nota
    SELECT p.invoice_id, SUM(ABS(COALESCE(p.converted_amount, p.amount))) AS amount
    FROM public.payments p
    JOIN public.invoices nc ON nc.id = p.invoice_id AND nc.type = 'credit_note'
    GROUP BY p.invoice_id
),
available_credit AS (
    SELECT s.user_id, s.currency, s.is_sales, SUM(s.remaining) AS amount
    FROM (
        -- Prepagos / pagos a cuenta: lo que todavía no se asignó a ninguna factura
        SELECT p.user_id, p.currency, p.is_sales,
               ABS(p.amount) - COALESCE(pa.amount, 0) AS remaining
        FROM public.payments p
        LEFT JOIN payment_alloc pa ON pa.payment_id = p.id
        WHERE p.invoice_id IS NULL
        UNION ALL
        -- Notas de crédito emitidas que todavía no se aplicaron a una factura
        -- ni se devolvieron en dinero
        SELECT nc.user_id, nc.currency, nc.is_sales,
               ABS(nc.total) - COALESCE(ca.amount, 0) - COALESCE(cr.amount, 0)
        FROM public.invoices nc
        LEFT JOIN credit_note_alloc ca ON ca.source_id = nc.id
        LEFT JOIN credit_note_refund cr ON cr.invoice_id = nc.id
        WHERE nc.type = 'credit_note'
          AND nc.status = 'booked'
    ) s
    WHERE s.remaining > 0
    GROUP BY s.user_id, s.currency, s.is_sales
),
base AS (
    SELECT i.*,
           COALESCE(a.amount, 0)::numeric                      AS applied_amount,
           GREATEST(ABS(i.total) - COALESCE(a.amount, 0), 0)::numeric AS residual_amount
    FROM public.invoices i
    LEFT JOIN applied a ON a.invoice_id = i.id
    WHERE i.type = 'invoice'
),
fifo AS (
    SELECT b.id,
           COALESCE(c.amount, 0) AS available_credit,
           SUM(b.residual_amount) OVER (
               PARTITION BY b.user_id, b.currency, b.is_sales
           ) AS open_balance,
           SUM(b.residual_amount) OVER (
               PARTITION BY b.user_id, b.currency, b.is_sales
               ORDER BY b.due_date NULLS LAST, b.created_at, b.id
           ) - b.residual_amount AS prior_open
    FROM base b
    LEFT JOIN available_credit c
           ON c.user_id = b.user_id
          AND c.currency = b.currency
          AND c.is_sales = b.is_sales
    WHERE b.status = 'booked'
      AND b.residual_amount > 0
),
calc AS (
    SELECT b.*,
           COALESCE(f.available_credit, ac.amount, 0)::numeric AS patient_available_credit,
           COALESCE(f.open_balance, 0)::numeric                 AS patient_open_balance,
           LEAST(
               b.residual_amount,
               GREATEST(COALESCE(f.available_credit, 0) - COALESCE(f.prior_open, 0), 0)
           )::numeric                                           AS credit_covered_amount
    FROM base b
    LEFT JOIN fifo f ON f.id = b.id
    LEFT JOIN available_credit ac
           ON f.id IS NULL
          AND ac.user_id = b.user_id
          AND ac.currency = b.currency
          AND ac.is_sales = b.is_sales
)
SELECT c.*,
       (c.patient_open_balance - c.patient_available_credit)::numeric AS patient_net_balance,
       (c.residual_amount - c.credit_covered_amount)::numeric         AS effective_residual,
       (CASE
           WHEN c.residual_amount <= 0.01 THEN 'paid'
           WHEN c.residual_amount - c.credit_covered_amount <= 0.01 THEN 'covered_by_credit'
           WHEN c.residual_amount - c.credit_covered_amount < ABS(c.total) THEN 'partially_paid'
           ELSE 'unpaid'
       END)::varchar                                                   AS effective_payment_state,
       (c.residual_amount - c.credit_covered_amount > 0.01)            AS is_collectible
FROM calc c;

COMMENT ON VIEW public.v_alert_invoices IS
    '{"reference_table":"invoices","label":"Facturas con saldo real (incluye prepagos y notas de crédito sin asignar)"}';

COMMIT;

-- ---------------------------------------------------------------------
-- OPCIONAL (después de reimportar los flujos): pasar la regla de facturas a
-- la vista. También se puede hacer desde Sistema → Reglas de alerta
-- eligiendo "v_alert_invoices" y la condición is_collectible = true.
--
-- UPDATE public.alert_rules
-- SET source_table = 'v_alert_invoices',
--     condition_config = jsonb_set(
--         jsonb_set(
--             condition_config,
--             '{conditions}',
--             '[{"value":"{{TODAY}}","column":"due_date","operator":"BETWEEN"},
--               {"logic":"AND","value":"true","column":"is_sales","operator":"="},
--               {"logic":"AND","value":"true","column":"is_collectible","operator":"="}]'::jsonb
--         ),
--         '{reference_table}', '"invoices"'
--     ),
--     updated_at = CURRENT_TIMESTAMP
-- WHERE code = 'INV_DUE_SOON';
--
-- ---------------------------------------------------------------------
-- ROLLBACK
-- (primero devolver INV_DUE_SOON a source_table = 'invoices' / payment_state)
--
-- BEGIN;
-- DROP VIEW IF EXISTS public.v_alert_invoices;
-- DROP INDEX IF EXISTS public.idx_payments_invoice_id;
-- COMMIT;
-- =====================================================================
