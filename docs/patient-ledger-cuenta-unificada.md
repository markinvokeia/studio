# Cuenta unificada del paciente (Patient Ledger)

Documenta el trabajo realizado en el commit `db9f1045` ("feat: replace account
statement with patient ledger and smart payment form") y los cambios posteriores
aún sin commitear sobre la rama `bracketsup`.

## 1. Contexto y motivación

La ficha del paciente mostraba el estado de cuenta ("Cuentas por cobrar") en un
`AccountStatementSheet` separado, con su propio store y sus propios hooks de
datos (`account-statement-store.ts`, `use-account-statement-data.ts`,
`account-statement-cobrar.ts`, `account-statement-filters.tsx`,
`account-statement-timeline.tsx`). Ese flujo convivía con las pestañas clásicas
de **Presupuestos / Facturas / Pagos**, obligando al usuario a saltar entre
vistas para entender el estado real de la cuenta de un paciente (qué está
presupuestado, qué ya se facturó, qué está pago, qué falta cobrar).

El objetivo del cambio fue reemplazar ese estado de cuenta por un **libro
mayor (ledger) unificado**: una sola tabla tipo "Debe / Haber / Saldo" con una
fila por línea de servicio (presupuestada o facturada) y una fila por pago,
ordenada cronológicamente, con saldo corriente — igual a como se lee un estado
de cuenta contable clásico.

## 2. Qué se eliminó

- `src/components/financial/AccountStatementSheet.tsx`
- `src/components/financial/account-statement-cobrar.ts`
- `src/components/financial/account-statement-filters.tsx`
- `src/components/financial/account-statement-timeline.tsx`
- `src/components/financial/use-account-statement-data.ts`
- `src/stores/account-statement-store.ts`

Estos archivos implementaban el estado de cuenta viejo. Se decidió borrarlos
en vez de mantenerlos en paralelo porque duplicaban lógica de negocio (cálculo
de saldos, filtros, cobro rápido) que ahora vive en el ledger nuevo, y
mantener dos implementaciones del mismo concepto es una fuente segura de
inconsistencias.

## 3. Qué se agregó

### 3.1 `src/lib/patient-ledger.ts` — construcción del ledger

`buildPatientLedger()` arma las filas del ledger a partir de presupuestos
(`Quote` + `QuoteItem`), facturas (`Invoice` + `InvoiceItem`) y pagos
(`Payment`). Decisiones clave:

- **Un item de presupuesto se cruza contra su factura vía `quote_item_id`.**
  Si una línea de presupuesto ya fue facturada, se muestra como fila de
  factura (no como fila de presupuesto duplicada) — se resuelve con un `Map`
  `invoiceItemByQuoteItemId` construido antes de recorrer los presupuestos.
- **Facturas sin presupuesto detrás** (creadas directamente, sin orden ni
  presupuesto) se listan aparte, recorriendo las facturas y filtrando los
  ítems que no fueron reclamados por el cruce anterior (`billedInvoiceItemIds`).
- Las filas se agrupan **por moneda** (`Record<string, LedgerRow[]>`) porque un
  paciente puede tener presupuestos/facturas en USD y en UYU simultáneamente;
  no tiene sentido un saldo corriente que mezcle monedas.
- El **saldo corriente** (`runningBalance`) se calcula por fila dentro de cada
  moneda, en orden cronológico.
- `LedgerRowStatus` (`presupuestado | facturado | parcial | pagado |
  notaCredito`) determina tanto el badge visual como qué acciones aplican a
  esa fila (ver §3.3).

### 3.2 `src/services/patient-ledger-data.ts` — capa de datos

- **2 requests en vez de N**: trae presupuestos+facturas anidados con sus
  ítems en una sola llamada (`API_ROUTES.USER_QUOTES_INVOICES`) y los pagos en
  otra (`API_ROUTES.USER_PAYMENTS`), en paralelo con `Promise.all`. Antes el
  estado de cuenta viejo hacía llamadas más granulares por sección.
- **Cache en memoria de 30s por paciente** (`CACHE_TTL_MS = 30_000`), para que
  cambiar de sub-tab y volver no dispare un refetch. Se invalida pasando
  `forceRefresh: true`, que el componente usa después de cualquier
  creación/edición/borrado (confirmar presupuesto, facturar, cobrar, nota de
  crédito, revertir, eliminar).
- Normaliza la respuesta cruda del backend (nombres de campo en español/inglés
  mezclados, ej. `monto_facturado` vs `amount_invoiced`) a los tipos
  compartidos de `src/lib/types.ts`.

### 3.3 `src/components/users/patient-ledger.tsx` — tabla y acciones

Componente principal, con una fila por línea del ledger. Cada fila puede
disparar (según su `kind`/`status` y los permisos del usuario):

| Acción | Cuándo aplica |
|---|---|
| Editar | ítem de presupuesto aún no facturado |
| Confirmar presupuesto | presupuesto en `draft/pending/sent` |
| Facturar | presupuesto en `accepted/confirmed` |
| Cobrar | factura no pagada totalmente |
| Nota de crédito | factura con saldo acreditable > 0 |
| Revertir a presupuesto | cualquier ítem ya facturado |
| Eliminar presupuesto / pago / nota de crédito | según el tipo de fila |

Los permisos se resuelven con `usePermissions()` contra los códigos de
`SALES_PERMISSIONS` (ver skill `permissions-protection`).

**Cambio posterior (sin commitear): menú de acciones por clic derecho → botón
"⋮".** La primera versión disparaba el menú de acciones con un
`ContextMenu` (clic derecho) envolviendo cada celda de la fila. Se cambió a un
`DropdownMenu` está
estándar con un botón de 3 puntos (`MoreHorizontal`) en una
columna dedicada `actions` al final de la tabla, igual al patrón ya usado en
`invoices-table.tsx` y otras tablas del proyecto (`quote-items-table.tsx`,
`payments-table.tsx`, etc.).

- **Motivo:** el clic derecho no es descubrible ni funciona siempre (se
  reportó que "no funciona siempre" — puede chocar con el menú contextual del
  navegador/SO en ciertas condiciones, o simplemente no ser un gesto que el
  usuario intente). Un botón visible es la convención ya establecida en el
  resto de las tablas de la app.
- Se agregó la traducción `PatientLedger.actions.openMenu` (`en.json` /
  `es.json`) para el `sr-only` del botón.
- Si una fila no tiene ninguna acción disponible (por permisos o por su
  estado), el botón no se renderiza — se deja un placeholder vacío del mismo
  ancho (`h-8 w-8`) para no romper la alineación de la columna.

### 3.4 `src/components/sales/payments/SmartPaymentFormDialog.tsx`

Diálogo de cobro nuevo, más simple que el flujo de cobro viejo
(`account-statement-cobrar.ts`), pensado para cobrar directamente desde una
fila del ledger sin tener que navegar a la pestaña de Pagos.

### 3.5 `src/components/users/patient-finance-section.tsx` + preferencia de vista

Como cambiar de golpe la UI de "Cuentas" a "Ledger" para todos los usuarios es
un cambio de hábito grande, se decidió **no forzarlo**: se agregó una
preferencia por usuario (`finance_view: 'unified' | 'tabs'`), persistida en
backend (`API_ROUTES.USER_PREFERENCES`) y cacheada en `localStorage` por
`useFinanceViewPreference()` para que el toggle sea instantáneo sin esperar la
respuesta del servidor. El default es `'unified'` (el ledger nuevo).

`PatientFinanceSection` es el switch entre:

- `viewMode === 'tabs'` → las pestañas clásicas Presupuestos/Facturas/Pagos
  (`ClassicFinanceTabs`, código preexistente reutilizado tal cual).
- cualquier otro valor → `PatientLedger` (el ledger unificado).

La preferencia se configura desde `/preferences` (nueva tarjeta "Vista de
cuenta del paciente" con dos opciones ilustradas con íconos `Rows3` /
`Columns3`).

### 3.6 Otros cambios de soporte

- `src/constants/routes.ts` — nuevas rutas usadas por el ledger.
- `src/lib/types.ts` — tipo `PatientFinanceView` y campos nuevos en
  `UserPreferences`.
- `src/stores/patient-ledger-sheet-store.ts` + `PatientLedgerSheet.tsx` —
  variante del ledger en un `Sheet` lateral, reemplazando el uso puntual que
  antes tenía `AccountStatementSheet` (ej. desde el calendario / lista de
  pacientes, donde no conviene navegar a la ficha completa).
- `src/components/tables/invoices-table.tsx`,
  `src/components/sales/quotes/QuoteFormDialog.tsx`,
  `src/components/sales/quotes/quote-billing-dialog.tsx` — ajustes menores
  para soportar el flujo de facturar/cobrar disparado desde el ledger (por
  ejemplo, facturar una sola línea de un presupuesto en vez del presupuesto
  completo, vía `onlyQuoteItemId`).
- `src/messages/en.json` / `es.json` — namespace `PatientLedger` completo
  (columnas, estados, acciones, diálogos, toasts) más las nuevas cadenas de
  `/preferences`.

## 4. Decisiones de diseño a tener en cuenta a futuro

- **No mezclar monedas en un mismo saldo.** Si se agrega una nueva moneda,
  debe seguir agrupándose aparte; no promediar ni convertir en el ledger.
- **El cruce presupuesto↔factura es por `quote_item_id`,** no por servicio ni
  por monto. Si el backend deja de mandar ese campo en `invoice_items`, el
  ledger empezaría a mostrar líneas facturadas como si siguieran
  "presupuestadas".
- **Cache de 30s en `fetchPatientLedgerData`.** Cualquier acción que modifique
  presupuestos/facturas/pagos del paciente debe llamar con
  `forceRefresh: true` después de tener éxito, o el usuario verá datos
  stale hasta que expire el cache.
- **La vista "tabs" se mantiene como código vivo**, no deprecado — es la
  preferencia de quienes todavía no migraron el hábito al ledger. No borrar
  `UserQuotes` / `UserInvoices` / `UserPayments` ni su lógica.
- **Acciones de fila siempre en un menú explícito (botón "⋮"), nunca sólo por
  clic derecho.** Fue la razón del cambio de `ContextMenu` a `DropdownMenu`
  documentado en §3.3; si se agrega una tabla nueva con acciones por fila,
  seguir ese mismo patrón (columna `id: 'actions'`, `MoreHorizontal`, alineada
  a la derecha).
