# Reconciliación de allocations al editar tratamientos y pagos

**Estado:** Implementado — flujos de n8n en producción, frontend ya los usa
**Fuente:** `docs/n8n-flows/All Sales Quote endpoints.json`, `docs/n8n-flows/Payment.json`
**Alcance:** `invoices`, `payments`, `payment_allocations`, `invoice_allocations`,
`src/components/users/patient-ledger.tsx`

Dos flujos nuevos para permitir editar un tratamiento o un pago que ya tienen cobros
aplicados, liberando y re-aplicando sus allocations en vez de dejarlos desincronizados o
bloquear la edición por completo.

## 0. Estado actual

Los dos flujos (`docs/n8n-flows/flow-invoice-edit-with-reallocation.json` y
`docs/n8n-flows/flow-payment-edit-with-reallocation.json`) ya se pegaron en n8n. El frontend
en `patient-ledger.tsx` ya los usa:

- **Tratamientos con pagos aplicados** (`parcial`/`pagado`) ahora se pueden editar in-line
  igual que uno sin pagos — `QuoteInvoiceInlineEditor` detecta ese caso por `editRow.status`
  y llama a `INVOICE_ITEMS_EDIT_WITH_REALLOCATION` en vez de `INVOICES_UPSERT`. Como ese
  endpoint solo toca la línea (no el documento completo), fecha/doctor/notas del tratamiento
  no se ofrecen para editar en ese caso — igual que ya pasaba con la línea de presupuesto.
- **Pagos con allocations** ahora también se pueden editar — `PaymentInlineEditor` reemplazó
  por completo el enfoque de deshacer+recrear por una llamada a
  `PAYMENT_EDIT_WITH_REALLOCATION` (para todos los pagos, tengan o no allocations). El panel
  de "seleccionar tratamientos pendientes" se oculta en modo edición porque ya no aplica: la
  reasignación es automática (FIFO) contra las allocations que el pago ya tenía.
- Ambos toasts de éxito muestran cuánto quedó liberado como crédito del paciente cuando
  corresponde (`toasts.releasedCredit`).

Sigue pendiente: probar en la app real ambos casos (edición de tratamiento con pagos mixtos,
edición de pago con allocations a más de una factura) antes de considerar esto cerrado.

## 1. El problema

Hoy el ledger del paciente (`src/components/users/patient-ledger.tsx`) permite editar
in-line presupuestos, tratamientos, pagos y notas de crédito. Pero cuando un tratamiento ya
tiene pagos aplicados, bajar su precio deja los `payment_allocations`/`invoice_allocations`
existentes apuntando a un monto que ya no existe — la factura queda mostrando más cobrado
que su propio total. Lo mismo pasa al revés: editar un pago que ya está repartido entre una
o más facturas.

El criterio actual es evitar el problema restringiendo cuándo se puede editar (solo
tratamientos sin pagos, solo pagos sin allocations). Esta spec reemplaza esa restricción por
una reconciliación real: soltar lo ya aplicado y volver a aplicarlo contra los valores
nuevos, hasta donde alcance.

## 2. El concepto compartido: pool FIFO

> Se junta todo lo ya aplicado (ordenado por fecha de aplicación, más antiguo primero), se
> borra, y se vuelve a aplicar contra el nuevo límite hasta agotarlo. Lo que no entra no es
> un error: simplemente no se reinserta, y automáticamente vuelve a quedar disponible en su
> origen (el pago o la nota de crédito), sin tocar esas tablas.

- **Orden:** FIFO por `created_at` de la allocation original; empate se desempata por `id`
  ascendente.
- **Moneda:** cada allocation reaplicada preserva su `exchange_rate` / `allocated_currency` /
  `target_amount` original — no se recalcula el tipo de cambio de nuevo, para que no haya
  drift entre lo cobrado en su momento y lo reasignado ahora.
- **Atomicidad:** todo el ciclo (editar, soltar, reasignar) corre en una sola transacción —
  un fallo a mitad de camino no debe dejar allocations borradas sin haber reasignado nada.

## 3. Flujo A — editar tratamiento con cobros aplicados

**Sin impacto en caja.** Reemplaza a `invoices/upsert` específicamente cuando la factura ya
tiene algo cobrado. El dinero ya entró — esto solo reacomoda a qué factura está imputado.

```
POST /invoice/items/edit-with-reallocation   (nuevo)
```

**Request**

```json
{
  "invoice_id": 1234,
  "item_id": 5678,
  "service_id": 42,
  "quantity": 1,
  "unit_price": 3500,
  "tooth_number": 16,
  "total": 3500
}
```

**Response 200**

```json
{
  "success": true,
  "invoice_id": 1234,
  "new_total": 3500,
  "reallocated": [
    { "origin_type": "payment", "origin_id": 91, "amount": 3500 }
  ],
  "released_amount": 1200
}
```

**Pasos**

1. `UPDATE invoice_items` con los valores editados de la línea.
2. Recalcular `invoices.total` como `SUM(invoice_items.total)` de esa factura.
3. Traer lo ya aplicado desde **las dos fuentes**: `payment_allocations WHERE invoice_id = $1`
   (pagos/crédito prepago) y `invoice_allocations WHERE target_id = $1` (crédito de notas de
   crédito). Si solo se mira la primera, se escapa lo pagado con nota de crédito.
4. Unir ambas listas y ordenarlas FIFO por fecha de aplicación.
5. Borrar esas filas de ambas tablas.
6. Recorrer la lista aplicando cada monto contra el `new_total` hasta agotarlo; reinsertar en
   la tabla de origen correspondiente, preservando moneda/tipo de cambio original.
7. Lo que no entró simplemente no se reinserta — queda disponible en el pago o la nota de
   crédito de origen, sin update adicional ahí.

## 4. Flujo B — editar pago con allocations

**Impacta caja si cambia el monto o el método.** Reemplaza el enfoque actual de "deshacer y
recrear" (`payment/undo` + `invoice/payment`), que no valida sesión de caja y reenvía el
email de "Pago Recibido" en cada edición. Este flujo hace un `UPDATE` en el lugar, sobre el
mismo `id`.

```
POST /payment/edit-with-reallocation   (nuevo)
```

**Request**

```json
{
  "payment_id": 91,
  "payment_date": "2026-07-10T14:30:00-03:00",
  "amount": 2000,
  "payment_method_id": 3,
  "notes": "Corregido monto",
  "is_historical": false
}
```

**Response 200**

```json
{
  "success": true,
  "payment_id": 91,
  "new_amount": 2000,
  "reallocated": [
    { "invoice_id": 1234, "amount": 2000 }
  ],
  "released_amount": 1500
}
```

400 si el pago pertenece a una sesión de caja ya cerrada (misma regla que `payments/edit`
hoy).

**Pasos**

1. Si cambia `payment_method_id` y/o `amount`: reusar el chequeo de "misma sesión de caja
   activa" que ya tiene `payments/edit` — bloquear con 400 si la sesión original ya cerró.
2. Si cambió el monto y el pago tiene un `cash_movements` asociado (método efectivo):
   `UPDATE cash_movements.amount` para que el cuadre de caja siga cerrando.
3. `UPDATE payments` en el lugar — mismo id, sin pasar por el sub-flujo de creación (evita el
   email duplicado).
4. Traer `payment_allocations WHERE payment_id = $1`, ordenadas FIFO por fecha, y borrarlas.
5. Reaplicar FIFO contra el `new_amount`, reinsertando una fila por cada factura que llegue a
   cubrirse (total o parcialmente, en el orden original).
6. Lo que no entra queda como crédito disponible del pago — no hace falta tocarlo aparte.

## 5. A confirmar antes de implementar

Al armar el flujo de n8n para el Flujo A (`docs/n8n-flows/flow-invoice-edit-with-reallocation.json`)
se pudieron confirmar dos de los tres puntos que habían quedado pendientes:

- ~~**Esquema exacto de `invoice_allocations`**~~ — **Confirmado.** El nodo `Insert invoice
  allocations` en `Payment.json` muestra el esquema completo:
  `id, source_id, target_id, amount, created_at, created_by, allocated_currency,
  target_amount, exchange_rate`. `source_id` es el origen del crédito (la nota de crédito),
  `target_id` es la factura acreditada — tal como se había asumido.
- ~~**`invoices.paid_amount`**~~ — **Confirmado que se deriva, no se guarda.** El `INSERT INTO
  public.invoices` de `invoices/upsert` no incluye una columna `paid_amount` — se calcula al
  leer, vía `SUM(payments...)` (como hace `Obtener Info Factura` en `Payment.json`). El Flujo A
  no necesita tocar ninguna columna de "monto pagado" en `invoices`, solo `total`.
- **Garantía de unicidad/orden de `created_at`** en ambas tablas de allocations — sigue sin
  confirmar. El flujo ya generado ordena por `created_at ASC, id ASC` para que el FIFO sea
  determinístico incluso si hay timestamps repetidos, así que no bloquea la implementación,
  pero vale la pena confirmar que `id` efectivamente refleja el orden real de inserción.

## 5.1 Flujo A ya generado

`docs/n8n-flows/flow-invoice-edit-with-reallocation.json` contiene el flujo completo y listo
para copiar-pegar en el canvas de la workflow "All Sales Quote endpoints" en n8n — 20 nodos:
validación de datos requeridos, chequeo de que la factura exista, actualización de la línea
y recálculo del total, lectura + borrado de ambas fuentes de allocations, el cálculo FIFO
(nodo de código `Merge & Reallocate FIFO`), y un loop que reinserta cada allocation en la
tabla que corresponda (`payment_allocations` o `invoice_allocations`) antes de responder.

## 5.2 Flujo B ya generado

`docs/n8n-flows/flow-payment-edit-with-reallocation.json` — 27 nodos, construido reusando
la estructura exacta de `payments/edit` (mismo sub-flujo `Is Cash session active workflow`,
mismo patrón de `Remove cash movement` + reinsertar si el método final es efectivo), con
tres extensiones sobre el endpoint original:

- **Detección de cambios** (`Detectar cambios`, nodo de código): el chequeo de sesión de
  caja solo se dispara si realmente cambia el método o el monto — si el pago solo cambia de
  fecha/notas, se saltea por completo y va directo a `Update Payment In Place`.
- **Pagos históricos:** `payments/edit` bloquea con "old cash session" a cualquier pago sin
  `cash_session_id` (porque su única condición exige que la sesión activa coincida con la
  del pago). Como el Flujo B sí necesita poder editar pagos históricos (`is_historical` es
  parte del payload), `Evaluar sesion de caja` trata "nunca tuvo sesión" como válido, y solo
  bloquea cuando el pago sí tenía una sesión y ya no es la activa.
- **`Get payment description` con `alwaysOutputData: true`:** el nodo original no lo tiene,
  y con un pago sin factura (prepago) la consulta no matchea ninguna fila — sin ese flag el
  nodo no emite ningún item y la cadena hacia `Registrar Movimiento Caja` se corta en seco.
  Vale la pena confirmar si `payments/edit` tiene este mismo problema latente.

Después de actualizar el pago en el lugar, reaplica FIFO las `payment_allocations`
existentes contra el nuevo monto (mismo algoritmo y mismo criterio de desempate que el
Flujo A), reinsertando solo lo que entra y dejando el resto como crédito disponible del pago.

## 6. Referencia — endpoints existentes revisados

Para contexto de quien implemente esto: lo que ya existe hoy en
`All Sales Quote endpoints.json` y cómo se relaciona.

| Endpoint | Uso actual | Relevancia acá |
|---|---|---|
| `quote/lines/upsert` | Upsert de una línea de presupuesto por id; recalcula el total del quote. | Ya en uso desde el frontend para editar una línea de presupuesto sin facturar. |
| `invoices/upsert` | Reenvía la factura completa; preserva ids de ítems no tocados. | Se sigue usando para facturas **sin** pagos aplicados; el Flujo A lo reemplaza cuando sí los hay. |
| `invoices/items/upsert` | Upsert de una línea de factura; solo permitido si `status = 'draft'`. | No se usa hoy — el gate a `draft` no está confirmado contra el estado real de una factura recién facturada. |
| `payments/edit` | Cambia solo `payment_method_id`; valida misma sesión de caja activa. | El Flujo B reusa exactamente esa validación, extendida a monto/fecha/notas. |
| `payment/undo` | Borra pago + `cash_movements` + `payment_allocations`. Sin chequeo de sesión. | Es lo que usa hoy el frontend para "editar" un pago (deshacer + recrear) — el Flujo B lo reemplaza. |
| `credit_note/undo` | Borra la nota de crédito + sus `invoice_allocations`. Sin gates. | Confirma que `invoice_allocations` se referencia por `source_id` = la nota de crédito. |
