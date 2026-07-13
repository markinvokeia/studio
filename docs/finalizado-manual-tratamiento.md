# Forzar "Finalizado" manualmente en un tratamiento

**Estado:** Implementado — `handleMarkFinalized` en `patient-ledger.tsx` ya llama al endpoint
**Fuente:** análisis de `docs/n8n-flows/All Sales Quote endpoints.json` (columna `payment_state`)
**Alcance:** `invoices.payment_state`, `src/components/users/patient-ledger.tsx`

## El problema

El estado que se ve en el ledger del paciente ("Presupuesto" / "En curso" / "Finalizado") para
un tratamiento facturado sale de `invoice.payment_status`, que en el frontend es en realidad
la columna `payment_state` de la tabla `invoices` (confirmado revisando el esquema cacheado de
un nodo Postgres en el JSON exportado — ver `invoiceRowStatus` en `src/lib/patient-ledger.ts`).

Hoy, hacer click en "Finalizado" (`handleMarkFinalized`) no toca esa columna directamente:
aplica crédito real del paciente contra la factura vía `INVOICE_PAYMENT`, y `payment_state`
cambia como efecto secundario de que el monto pagado ahora cubre el total. Si el crédito no
alcanza, el tratamiento queda "parcial" (ver el cambio anterior que permite aplicar crédito
parcial en vez de no hacer nada).

Lo que se pide ahora es distinto: un botón/acción que fuerce el estado a "Finalizado"
**independientemente** de si el monto realmente cobrado cubre el total — porque fue una
decisión manual del staff, no algo que deba depender de la reconciliación de pagos.

## Decisión de alcance

Se decidió que este forzado **solo cambia el badge de estado** (`payment_state`) — no toca
`paid_amount` (el monto realmente cobrado, columna separada que también existe en `invoices`
y que usa `pendingInvoices` en `patient-ledger.tsx` para armar el selector de facturas
pendientes en "Nuevo Pago"). Esto es una simplificación consciente: después de forzar
"Finalizado" manualmente, la factura puede seguir apareciendo como pendiente de cobro en el
selector de "Nuevo Pago" aunque el ledger ya la muestre como Finalizada — son dos cosas
independientes a propósito.

## Endpoint nuevo

```
POST /invoice/payment-state/set
```

**Request**

```json
{
  "invoice_id": 1234,
  "payment_state": "paid"
}
```

`payment_state` acepta `"paid" | "partial" | "unpaid"` — no solo `"paid"`, porque el mismo
endpoint también sirve para el caso inverso: revertir un "Finalizado" forzado manualmente de
vuelta a "En curso" recalculando cuál sería el estado real según `paid_amount` vs `total`
(sin la fuerza manual encima).

**Response 200**

```json
{
  "success": true,
  "invoice_id": 1234,
  "payment_state": "paid",
  "code": 200
}
```

400 si `invoice_id` o `payment_state` faltan, o si `payment_state` no es uno de los tres
valores permitidos. 404 si la factura no existe.

## Pasos

1. Validar que `invoice_id` exista y que `payment_state` sea uno de `paid`/`partial`/`unpaid`.
2. Verificar que la factura exista (`SELECT id FROM invoices WHERE id = $1`).
3. `UPDATE invoices SET payment_state = $1 WHERE id = $2 RETURNING id, payment_state`.
4. Responder con el nuevo estado.

Sin transacciones ni reasignación de por medio — es el flujo más simple de los tres que
tocan esta área (comparado con los Flujos A y B de
`docs/reconciliacion-allocations-edicion.md`), porque no hay ninguna otra tabla que
reconciliar: solo se cambia una etiqueta.

## Flujo de n8n

`docs/n8n-flows/flow-invoice-payment-state-set.json` — listo para copiar-pegar en el canvas
de "All Sales Quote endpoints".

## Ya implementado en el frontend

`handleMarkFinalized` ahora: aplica el crédito disponible que exista (total, parcial, o
ninguno) igual que antes, y **siempre** termina llamando a `INVOICE_PAYMENT_STATE_SET` con
`payment_state: "paid"` — el estado se fuerza sí o sí, sin importar si el crédito alcanzó a
cubrir todo. El toast de éxito avisa cuánto quedó sin cobrar cuando corresponde
(`toasts.itemFinalizedManualDesc`), ya que ese monto no queda reflejado en `paid_amount`.

`handleUnmarkFinalized` (Finalizado → En curso) ahora deshace los pagos reales que existan
(si hay — un "Finalizado" forzado sin crédito no tiene ninguno) y **siempre** fuerza
`payment_state: "unpaid"` al final, sin importar si había algo que deshacer. Antes fallaba
con "No hay pagos para revertir" cuando el Finalizado había sido puramente forzado; ese
mensaje/llave (`toasts.noPaymentsToUndo`) se eliminó porque ese caso ya no es un error.

## Pendiente

- Decidir en la UI cómo distinguir un tratamiento "Finalizado de verdad" (con `paid_amount`
  cubriendo el total) de uno "Finalizado a mano" (forzado) — hoy el badge se ve idéntico en
  ambos casos, ya que la decisión de alcance fue no tocar nada más que el estado.
