# Cobro Rápido — Documentación Funcional y Técnica Completa

> **Última actualización:** 2026-05-22  
> **Archivos principales:**  
> `src/stores/billing-wizard-store.ts`  
> `src/components/billing-wizard/billing-wizard-modal.tsx`  
> `src/components/billing-wizard/steps/step-patient-select.tsx`  
> `src/components/billing-wizard/steps/step-treatment.tsx`  
> `src/components/billing-wizard/steps/step-items-editor.tsx`  
> `src/components/billing-wizard/steps/step-invoice-select.tsx`  
> `src/components/billing-wizard/steps/step-payment.tsx`  
> `src/components/billing-wizard/steps/step-confirmation.tsx`  
> `src/components/billing-wizard/wizard-stepper.tsx`  
> `src/services/billing-links.ts`  
> `src/services/quote-financials.ts`

---

## Índice

1. [Qué es el Cobro Rápido](#1-qué-es-el-cobro-rápido)
2. [Arquitectura global](#2-arquitectura-global)
3. [El Store Zustand](#3-el-store-zustand)
4. [Puntos de entrada en la UI](#4-puntos-de-entrada-en-la-ui)
5. [Determinación del flujo según contexto](#5-determinación-del-flujo-según-contexto)
6. [Flujo A — Desde Factura](#6-flujo-a--desde-factura-invoiceid-o-invoice)
7. [Flujo B — Desde Presupuesto](#7-flujo-b--desde-presupuesto-quoteid-sin-invoiceid)
8. [Flujo C — Freeform con Paciente Conocido](#8-flujo-c--freeform-con-paciente-conocido)
9. [Flujo D — Freeform sin Paciente](#9-flujo-d--freeform-sin-paciente-contexto-vacío)
10. [Paso de Pago — Detalle Completo](#10-paso-de-pago--detalle-completo-steppayment)
11. [Paso de Confirmación — Detalle Completo](#11-paso-de-confirmación--detalle-completo-stepconfirmation)
12. [Vinculación con Citas y Sesiones Clínicas](#12-vinculación-con-citas-y-sesiones-clínicas)
13. [Resumen de Flujos por Parámetro](#13-resumen-de-flujos-por-parámetro)
14. [Comportamiento UX del Modal](#14-comportamiento-ux-del-modal)
15. [Helpers y Servicios Internos](#15-helpers-y-servicios-internos)
16. [Permisos](#16-permisos)

---

## 1. Qué es el Cobro Rápido

El **Cobro Rápido** es un wizard modal global de 2 a 4 pasos que ejecuta la cadena completa de facturación y cobro desde cualquier punto de la aplicación. Está diseñado para unificar en un solo lugar lo que antes requería navegar por múltiples módulos: Presupuestos → Confirmar → Facturar → Ir a Facturas → Registrar Pago.

Dependiendo del contexto desde el que se abre, puede:

- Confirmar automáticamente un presupuesto draft, crear la orden/factura correspondiente y luego cobrar.
- Cobrar una factura ya existente sin crear nada nuevo.
- Seleccionar cuáles facturas cobrar cuando un presupuesto está completamente facturado pero tiene saldo pendiente.
- Crear una factura libre (sin presupuesto previo) eligiendo servicios manualmente, con o sin paciente preseleccionado.

El wizard es **no-bloqueante para el panel que lo invoca**: cualquier hoja de detalles o panel abierto en background permanece abierto durante todo el flujo del wizard y vuelve a ser visible al cerrarlo, sin animaciones de cierre/apertura ni pérdida de estado.

---

## 2. Arquitectura Global

```
src/
├── stores/
│   └── billing-wizard-store.ts          ← Zustand store global (open/close/context)
│
├── components/billing-wizard/
│   ├── billing-wizard-modal.tsx          ← Contenedor principal: orquesta pasos, estado y llamadas API
│   ├── wizard-stepper.tsx                ← Indicador visual de pasos
│   ├── index.ts                          ← Re-exporta para importación limpia
│   └── steps/
│       ├── step-patient-select.tsx       ← Paso 0 (Flujo D): selección/creación de paciente
│       ├── step-treatment.tsx            ← Paso 0 (Flujo B estándar): resumen del presupuesto
│       ├── step-items-editor.tsx         ← Paso 0/1 (Flujos C/D): editor de servicios libre
│       ├── step-invoice-select.tsx       ← Paso 0 (Flujo B selection mode): selector de facturas
│       ├── step-payment.tsx              ← Paso de pago: formulario, multi-método, multi-moneda
│       └── step-confirmation.tsx         ← Paso final: resumen, impresión de docs
│
└── services/
    ├── billing-links.ts                  ← Vincula factura a cita/sesión (fire-and-forget)
    └── quote-financials.ts               ← Calcula resumen financiero del presupuesto
```

### Montaje global

El `BillingWizardModal` se monta **una sola vez** en el layout raíz:

```tsx
// src/app/[locale]/layout.tsx
<PrivateRoute>
  <BillingWizardModal />   {/* ← siempre presente, invisible hasta que isOpen=true */}
  {children}
</PrivateRoute>
```

Esto permite que cualquier componente de la app lo abra sin prop-drilling, importando solo el hook `useBillingWizard`.

---

## 3. El Store Zustand

**Archivo:** `src/stores/billing-wizard-store.ts`

### 3.1 Tipos

```ts
export type BillingTriggerContext = {
  // Identificadores de documentos (definen el flujo)
  quoteId?: string;           // ID del presupuesto origen
  invoiceId?: string;         // ID de una factura ya existente
  appointmentId?: string;     // Para vincular la nueva factura a una cita
  sessionId?: string;         // Para vincular la nueva factura a una sesión clínica/odontograma
  sessionType?: 'clinica' | 'odontograma';  // Tipo de sesión (afecta el endpoint de vinculación)

  // Identificación del paciente
  patientId?: string;         // ID del paciente
  patientName?: string;       // Nombre del paciente para mostrar en UI

  // Configuración
  isSales?: boolean;          // true = módulo ventas, false = módulo compras (default: true)
  currency?: string;          // Moneda inicial para el editor freeform

  // Objetos preloaded (evitan fetches extra cuando el caller ya los tiene)
  quote?: Quote;              // Objeto Quote completo
  invoice?: Invoice;          // Objeto Invoice completo (usado como optimistic state)
  preloadedItems?: Array<{    // Ítems prellenados para el editor freeform
    tempId: string;
    service_id: string;
    service_name: string;
    unit_price: number;
    quantity: number;
    total: number;
  }>;
};

type BillingWizardStore = {
  isOpen: boolean;
  context: BillingTriggerContext | null;
  onSuccess?: () => void;
  open: (ctx: BillingTriggerContext, onSuccess?: () => void) => void;
  close: () => void;
};
```

### 3.2 Implementación

```ts
export const useBillingWizard = create<BillingWizardStore>((set) => ({
  isOpen: false,
  context: null,
  onSuccess: undefined,
  open: (ctx, onSuccess) =>
    set({ isOpen: true, context: { isSales: true, ...ctx }, onSuccess }),
  close: () => set({ isOpen: false, context: null, onSuccess: undefined }),
}));
```

**Nota clave sobre `isSales`:** El `open` aplica `{ isSales: true, ...ctx }`, por lo que si no se pasa `isSales`, se asume modo ventas automáticamente. Solo los puntos de entrada que pasan explícitamente `isSales: false` activarán el modo compras.

### 3.3 Métodos del Store

| Método | Signature | Qué hace |
|--------|-----------|----------|
| `open` | `(ctx, onSuccess?) => void` | Abre el wizard, guarda el contexto y el callback de éxito. Aplica `isSales: true` como default. |
| `close` | `() => void` | Cierra el wizard y limpia `isOpen`, `context` y `onSuccess`. El estado interno del modal se resetea por el efecto en `billing-wizard-modal.tsx`. |

### 3.4 El callback `onSuccess`

`onSuccess` se llama en **dos momentos distintos**:

1. **Durante el flujo**, cuando se crea la factura o el pago (antes de que el wizard llegue al paso de confirmación). Permite refrescar tablas en background mientras el wizard sigue visible.
2. **Al cerrar el wizard** desde el paso de confirmación (si `confirmationData` existe).

**Regla importante:** `onSuccess` siempre debe ejecutar el refresco en modo silencioso para no mostrar skeleton mientras el wizard está en pantalla:

```ts
// ✅ Correcto
openBillingWizard({ quoteId }, () => loadQuotes(true))

// ❌ Incorrecto — muestra skeleton completo mientras el wizard sigue abierto
openBillingWizard({ quoteId }, loadQuotes)
```

### 3.5 Cómo usar desde cualquier componente

```tsx
import { useBillingWizard } from '@/stores/billing-wizard-store';

function MiComponente() {
  const { open } = useBillingWizard();

  // Flujo A: desde una factura ya existente
  const cobrarFactura = () => open(
    {
      invoiceId: '456',
      invoice: invoiceObj,       // opcional pero recomendado para optimistic state
      patientId: 'p1',
      patientName: 'Ana García',
      isSales: true,
    },
    () => loadInvoices(true),
  );

  // Flujo B: desde un presupuesto
  const facturarPresupuesto = () => open(
    {
      quoteId: '123',
      patientId: 'p1',
      patientName: 'Ana García',
      isSales: true,
      quote: quoteObj,           // opcional pero evita un fetch extra
    },
    () => loadQuotes(true),
  );

  // Flujo B con cita vinculada
  const facturarDesdeCita = () => open(
    {
      quoteId: '123',
      appointmentId: 'apt-789',
      patientId: 'p1',
      patientName: 'Ana García',
    },
    () => refreshAppointment(),
  );

  // Flujo B con sesión odontograma
  const facturarDesdeSesion = () => open(
    {
      quoteId: '123',
      sessionId: 'ses-456',
      sessionType: 'odontograma',
      patientId: 'p1',
      patientName: 'Ana García',
    },
  );

  // Flujo C: freeform con paciente conocido
  const cobrarLibreConPaciente = () => open(
    {
      patientId: 'p1',
      patientName: 'Ana García',
      currency: 'UYU',
    },
    () => refreshPatientData(),
  );

  // Flujo D: freeform sin paciente (abre selector de paciente primero)
  const cobrarDesdeWidget = () => open({});

  // Flujo D con ítems prellenados
  const cobrarConItemsPrellenados = () => open(
    {
      preloadedItems: [
        { tempId: 'i1', service_id: '10', service_name: 'Consulta', unit_price: 50, quantity: 1, total: 50 }
      ],
      currency: 'USD',
    },
  );
}
```

---

## 4. Puntos de Entrada en la UI

### 4.1 Widget de la App — Header

**Archivo:** `src/components/header.tsx`

```tsx
const { open: openBillingWizard } = useBillingWizard();

// Botón en el panel lateral (desktop) y barra horizontal (mobile)
<Button
  onClick={() => openBillingWizard({})}
  className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
>
  <Zap className="h-5 w-5" />
</Button>
```

**Contexto enviado:** `{}` (vacío)  
**Resultado:** Flujo D — Freeform con selección de paciente (4 pasos)  
**Requiere permiso:** `SALES_PERMISSIONS.INVOICES_CREATE`  
**Ubicaciones:** Panel lateral desktop (entre ítem TV y primer separador) + barra de widgets mobile

---

### 4.2 Tab Presupuestos del Paciente

**Archivo:** `src/components/users/user-quotes.tsx:1061`

```tsx
openBillingWizard(
  {
    quoteId: selectedQuote.id,
    patientId: selectedQuote.user_id,
    patientName: selectedQuote.user_name,
    isSales,
    quote: selectedQuote,         // objeto preloaded para evitar fetch
  },
  () => loadQuotes(true),         // refresco silencioso al completar
)
```

**Contexto enviado:** `quoteId` + `patientId` + `patientName` + objeto `quote` preloaded  
**Resultado:** Flujo B — Desde Presupuesto (2 o 3 pasos)  
**Botón visible solo si `showQuickBillButton = true`**, que requiere:
- `isQuoteReadyToInvoice` (estado del presupuesto listo para facturar)
- `pendingInvoiceAmount > 0.009` OR `pendingPaymentAmount > 0.009` (hay algo por hacer)
- Permiso `canInvoiceQuote` OR `canCreatePayment`

---

### 4.3 Tab Facturas del Paciente — Toolbar principal

**Archivo:** `src/components/users/user-invoices.tsx:669`

```tsx
openBillingWizard(
  {
    invoiceId: selectedInvoice.id,
    invoice: selectedInvoice,
    patientId: selectedInvoice.user_id,
    patientName: selectedInvoice.user_name,
    isSales,
  },
  () => { loadInvoices(true); onDataChange?.(); },
)
```

**Contexto enviado:** `invoiceId` + objeto `invoice` preloaded + `patientId` + `patientName`  
**Resultado:** Flujo A — Desde Factura (2 pasos)  
**Botón visible solo si:** `isBookedUnpaid && canCreatePayment`

---

### 4.4 Tab Facturas del Paciente — Panel de Detalles (Sheet)

**Archivo:** `src/components/users/user-invoices.tsx:869`

Idéntico al 4.3 pero ubicado dentro del `ResizableSheet` de detalles de la factura. Al abrirse, el sheet permanece visible detrás del wizard.

---

### 4.5 Integraciones soportadas por el store pero sin botón UI implementado aún

El store acepta `appointmentId`, `sessionId` y `sessionType`. El wizard los procesa correctamente para vincular la factura creada a la cita o sesión. La UI de entrada (botón en vistas de citas, notificaciones, sesiones clínicas) está pendiente de implementar.

---

## 5. Determinación del Flujo según Contexto

El `billing-wizard-modal.tsx` evalúa los parámetros del contexto en este orden de prioridad al renderizar:

```
¿context.invoiceId  OR  context.invoice?
  └─ SÍ  →  startFromInvoice = true
             Flujo A: "Desde Factura"
             Pasos: Pago → Listo  [2 pasos]

  └─ NO  →  ¿context.quoteId?
              └─ SÍ  →  Flujo B: "Desde Presupuesto"
                         (sub-flujo se determina en la inicialización)
                         Pasos: Tratamiento → Pago → Listo  [3 pasos]
                           O    Facturas → Pago → Listo     [3 pasos]

              └─ NO  →  isFreeformFlow = true
                         ¿context.patientId?
                          └─ SÍ  →  needsPatientStep = false
                                     Flujo C: Freeform con paciente
                                     Pasos: Servicios → Pago → Listo  [3 pasos]

                          └─ NO  →  needsPatientStep = true
                                     Flujo D: Freeform sin paciente
                                     Pasos: Paciente → Servicios → Pago → Listo  [4 pasos]
```

### Variables booleanas calculadas en el modal

```ts
const startFromInvoice = !!(context?.invoiceId || context?.invoice);
const isFreeformFlow   = !startFromInvoice && !context?.quoteId;
const needsPatientStep = isFreeformFlow && !context?.patientId;

const isInvoiceSelectionMode =    // sub-flujo B especial
  !startFromInvoice &&
  financialSummary !== null &&
  financialSummary.amount_pending_invoice === 0 &&  // todo ya facturado
  availableInvoices.length > 0;                      // pero hay facturas sin pagar
```

### Steppers por flujo

```ts
const STEPS_FROM_INVOICE:          [{ title: 'Pago' },       { title: 'Listo' }]
const STEPS_FROM_QUOTE:            [{ title: 'Tratamiento' }, { title: 'Pago' }, { title: 'Listo' }]
const STEPS_INVOICE_SELECT:        [{ title: 'Facturas' },    { title: 'Pago' }, { title: 'Listo' }]
const STEPS_FREEFORM:              [{ title: 'Servicios' },   { title: 'Pago' }, { title: 'Listo' }]
const STEPS_FREEFORM_WITH_PATIENT: [{ title: 'Paciente' }, { title: 'Servicios' }, { title: 'Pago' }, { title: 'Listo' }]
```

El array `steps` activo se computa así:

```ts
const steps = startFromInvoice
  ? STEPS_FROM_INVOICE
  : isFreeformFlow
    ? (needsPatientStep ? STEPS_FREEFORM_WITH_PATIENT : STEPS_FREEFORM)
    : isInvoiceSelectionMode
      ? STEPS_INVOICE_SELECT
      : STEPS_FROM_QUOTE;
```

### Booleans de navegación (para la barra de acciones)

```ts
const isConfirmationStep = currentStep === steps.length - 1;
const isPaymentStep      = steps.length >= 2 && currentStep === steps.length - 2;
const isPatientStep      = needsPatientStep && currentStep === 0;
const isItemsEditorStep  = isFreeformFlow && !isConfirmationStep && !isPaymentStep && !isPatientStep;
```

---

## 6. Flujo A — Desde Factura (`invoiceId` o `invoice`)

**Stepper:** `Pago → Listo` (2 pasos)  
**Se activa cuando:** `context.invoiceId` o `context.invoice` están presentes

### 6.1 Inicialización (efecto cuando `isOpen` cambia a `true`)

1. Si viene `context.invoice` → `setResolvedInvoice(context.invoice)` como estado optimista inmediato.
2. Si además viene `context.invoiceId` y `context.patientId` → lanza `fetchInvoiceById(invoiceId, patientId)` en background.
   - Este fetch consulta `API_ROUTES.USER_INVOICES` y busca la factura por ID.
   - Cuando resuelve, sobreescribe el estado optimista con datos frescos, especialmente el `paid_amount` actualizado.
   - Si el fetch falla, se mantiene el estado optimista.

### 6.2 Paso 0 — Pago

Se renderiza `StepPayment` con:
- `invoice={resolvedInvoice}`
- `paymentOnly={true}` → oculta el botón "Solo facturar" en la barra de acciones inferior
- `invoiceJustCreated={false}` → el banner de resumen usa estilo neutro (no verde)

**Si `pendingAmount <= 0`** (factura ya completamente pagada):
- `StepPayment` muestra el banner verde "Ya ha sido completamente facturado y pagado."
- El form de pago sigue visible pero no tiene sentido rellenarlo.
- En la barra de acciones aparece únicamente el botón **"Ver factura y pagos"** en lugar del botón "Cobrar".

**Botones de acción según estado:**

| Condición | Botones visibles |
|-----------|-----------------|
| `pendingAmount > 0` | Cancelar + **Cobrar** (submit del form `#billing-payment-form`) |
| `pendingAmount <= 0` | Cancelar + **Ver factura y pagos** |

### 6.3 `handleSkipPayment` — Navegación a Confirmación sin nuevo pago

Se llama cuando la factura ya está pagada o el usuario selecciona "Ver factura y pagos".

Flujo interno:

```
1. Si isInvoiceSelectionMode → close() y return (no aplica en Flujo A)
2. targetId = resolvedInvoice?.id
3. targetCurrency = resolvedInvoice?.currency || 'USD'
4. payments = []
5. Si targetId existe:
   → fetchInvoicePaymentsForConfirmation(targetId, isSales, targetCurrency)
   → Mapea todos los pagos con isNew: false (ninguno es nuevo)
6. setConfirmationData({
     invoiceId: targetId,
     invoiceDocNo: resolvedInvoice?.doc_no,
     payments,                        // lista completa de pagos históricos
     total: resolvedInvoice?.total,
     pendingAfter: max(0, total - paid_amount),
     currency: targetCurrency,
   })
7. setCurrentStep(steps.length - 1)   // avanza al paso final
8. onSuccess?.()
```

### 6.4 Paso 1 — Listo

`StepConfirmation` muestra:
- Factura con número y botón de imprimir PDF
- Lista de todos los pagos existentes (sin badge "Nuevo" ya que `isNew = false`)
- Total facturado, total pagado, pendiente restante

---

## 7. Flujo B — Desde Presupuesto (`quoteId`, sin `invoiceId`)

**Sub-flujos posibles:**
- **Estándar:** `Tratamiento → Pago → Listo` cuando `amount_pending_invoice > 0`
- **Selección de facturas:** `Facturas → Pago → Listo` cuando el presupuesto está completamente facturado pero tiene facturas sin pagar

### 7.1 Inicialización (efecto cuando `isOpen` cambia a `true`)

Se lanzan **en paralelo**:

```ts
Promise.all([
  loadQuoteItems(quoteId, isSales),
  loadOrderId(quoteId, isSales),
  fetchQuoteInvoicesForFinancials(quoteId, isSales),
])
```

| Llamada | Endpoint | Resultado |
|---------|----------|-----------|
| `loadQuoteItems` | `QUOTES_ITEMS` con `{ quote_id, is_sales }` | Array de `QuoteItem[]` ordenados |
| `loadOrderId` | `QUOTES_ORDERS` con `{ quote_id, is_sales }` | `orderId: string \| null` |
| `fetchQuoteInvoicesForFinancials` | `QUOTES_INVOICES` con `{ quote_id, is_sales }` | `Invoice[]` existentes del presupuesto |

Con los resultados:

1. **`setQuoteItems(items)`** — lista de servicios del presupuesto
2. **`setOrderId(oid)`** — ID de la orden (necesario para crear la factura vía `ORDER_INVOICE`)
3. **Calcula `financialSummary`** usando `calculateQuoteFinancialSummary(quoteTotal, fetchedInvoices)`:
   ```ts
   {
     amount_invoiced:         Σ total de facturas existentes (excluye notas de crédito negadas)
     amount_pending_invoice:  max(quoteTotal - amount_invoiced, 0)
     amount_paid:             Σ paid_amount de facturas existentes
     amount_pending_payment:  max(amount_invoiced - amount_paid, 0)
   }
   ```
4. **`setAvailableInvoices`** — facturas no pagadas: `fetchedInvoices.filter(inv => inv.payment_status !== 'paid')`
5. Si `context.quote` vino preloaded → `setQuote(existingQuote)` sin fetch adicional

#### Determinación del sub-flujo post-inicialización

```ts
isInvoiceSelectionMode = (
  financialSummary.amount_pending_invoice === 0  // todo ya facturado
  && availableInvoices.length > 0                // pero hay facturas sin pagar
)
```

### 7.2 Sub-flujo Estándar: Paso 0 — Tratamiento

Se renderiza `StepTreatment`:

**Muestra:**
- **Header informativo:**
  - Nombre del paciente (de `context.patientName`)
  - Número y estado del presupuesto con badge de color:
    - Verde: `confirmed` / `accepted`
    - Naranja: `draft` / `pending` / `sent`
- **Lista de servicios a facturar** (`pendingItems = items.filter(item => item.total > 0)`):
  - Nombre del servicio
  - Número de diente si `item.tooth_number` existe
  - Total del ítem formateado en la moneda del presupuesto
- **Resumen financiero** (si `financialSummary` disponible):
  - Total presupuesto
  - Ya facturado (visible solo si `amount_invoiced > 0`)
  - Pendiente de facturar (siempre visible, en color primario)
- **Alerta** si `amount_pending_invoice === 0`: "Este presupuesto ya está completamente facturado."

**Estados de carga y error:**
- Mientras carga: muestra 5 `Skeleton` de distintos tamaños
- Si error de fetch: `Alert` destructivo con el mensaje de error

**Validaciones del botón "Siguiente":**
- `!isLoadingTreatment` — carga completada
- `!treatmentLoadError` — sin error de carga
- `quoteItems.length > 0` — hay ítems para facturar

**Al presionar "Siguiente" → `handleTreatmentNext`:**

```
1. Validar context.quoteId y quote existen
2. Validar orderId no es null
   → Error: "No se encontró la orden del presupuesto. Verifique que el presupuesto esté confirmado."
3. Filtrar pendingItems = quoteItems.filter(item => item.total > 0)
   → Error si pendingItems.length === 0: "No hay servicios pendientes de facturación."
4. setIsProcessing(true)
5. Si quote.status no es 'confirmed' ni 'accepted':
   → await confirmQuote(quoteId, isSales)
   → Endpoint: QUOTE_CONFIRM con { quote_id, is_sales }
6. await createInvoiceFromOrder(orderId, quote, pendingItems, isSales)
   → Endpoint: ORDER_INVOICE
   → Payload:
     {
       order_id: orderId,
       is_sales: isSales,
       query: JSON.stringify({
         quote_id, user_id, currency, invoice_date: hoy,
         notes: '',
         items: pendingItems.map(item => ({
           quote_item_id: Number(item.id),
           service_id: Number(item.service_id),
           step_names: [],
           amount: Number(item.total),
         }))
       })
     }
   → Valida que response no sea error (code >= 400)
7. await fetchLatestUnpaidInvoice(quoteId, isSales)
   → Busca en QUOTES_INVOICES la factura no pagada más reciente
   → Error si no se encuentra: "No se encontró la factura creada."
8. setResolvedInvoice(invoice)
9. linkInvoiceToContext(invoice.id)  ← fire-and-forget
10. setCurrentStep(1)  ← avanza a Pago
```

### 7.3 Sub-flujo Selección de Facturas: Paso 0 — StepInvoiceSelect

Se activa cuando `isInvoiceSelectionMode = true`.

**Muestra:**
- Nombre del paciente
- Mensaje: "Este presupuesto ya está completamente facturado. Selecciona las facturas que deseas cobrar."
- Lista de facturas con checkbox por cada una:
  - Número de factura (doc_no o invoice_doc_no o id)
  - Fecha de creación
  - Monto pendiente (`total - paid_amount`)
  - Badge naranja "Pago parcial" si `payment_status === 'partial'` o `'partially_paid'`
  - Línea secundaria "Ya pagado: X — Total: Y" si `paid_amount > 0`
- Resumen total seleccionado (visible cuando `selectedIds.size > 0`)

**Validación del botón "Siguiente":** `selectedInvoiceIds.size === 0` → disabled

**Al presionar "Siguiente" → `handleInvoiceSelectNext`:**

```
1. Si selectedInvoiceIds.size === 0 → error "Selecciona al menos una factura para continuar."
2. setCurrentStep(1)  ← avanza a Pago
```

En el paso de Pago, se pasan `invoice={selectedInvoices[0]}` e `invoices={selectedInvoices}` para activar el modo multi-factura.

### 7.4 Paso 1 — Pago (ambos sub-flujos B)

**Flujo estándar:** `StepPayment` con `invoice={resolvedInvoice}` (sin `paymentOnly` → "Solo facturar" visible)

**Flujo selección de facturas:** `StepPayment` con `invoice={selectedInvoices[0]}` e `invoices={selectedInvoices}` → activa distribución automática del pago entre múltiples facturas

**Botones de acción:**

| Flujo | Botones visibles |
|-------|-----------------|
| Estándar, `pendingAmount > 0` | Cancelar + **Solo facturar** + **Cobrar** |
| Estándar, `pendingAmount <= 0` | Cancelar + **Ver factura y pagos** |
| Selección, `pendingAmount > 0` | Cancelar + **Cobrar** (sin "Solo facturar") |

**"Solo facturar"** → llama `handleSkipPayment(resolvedInvoice?.doc_no)` → igual que Flujo A §6.3

### 7.5 Paso 2 — Listo

---

## 8. Flujo C — Freeform con Paciente Conocido

**Condición:** `!startFromInvoice && !context?.quoteId && context?.patientId`  
**Stepper:** `Servicios → Pago → Listo` (3 pasos)

### 8.1 Inicialización

```ts
setEditableItems(context.preloadedItems || [])   // puede venir con ítems prellenados
setFreeformCurrency(context.currency || 'UYU')   // moneda inicial UYU por default
```

### 8.2 Paso 0 — Editor de Servicios (`StepItemsEditor`)

**Muestra:**
- **Selector de moneda:** toggle inline UYU / USD (botones adyacentes con estilo activo/inactivo)
- **Tabla editable de servicios** (si hay ítems):
  - Cabecera: Servicio | Cant. | Precio unit. | Total | (acciones)
  - Por cada ítem: nombre del servicio (no editable, viene del catálogo), input numérico cantidad (min 1), input numérico precio unitario (min 0, step 0.01), total calculado automáticamente, botón eliminar (Trash2)
  - Total general al pie
- **Placeholder** si no hay ítems: "No hay servicios. Agrega al menos uno para continuar."
- **Botón "+ Agregar servicio"** → abre `ServiceSelector` inline
  - Al seleccionar un servicio del catálogo: pre-rellena `service_id`, `service_name` y `unit_price` del catálogo, `quantity = 1`, `total = unit_price`
  - Botón "Cancelar" para cerrar el selector sin agregar

**Comportamiento del cálculo en tiempo real:**
- Al cambiar cantidad: `total = qty * unit_price`
- Al cambiar precio unitario: `total = quantity * price`

**Botones de acción:**

| Botón | Habilitado cuando |
|-------|-------------------|
| **Solo facturar** | `editableItems.length > 0` && todos con `service_id` válido && `effectivePatientId` existe |
| **Facturar y Cobrar** | ídem |

**Al presionar cualquier acción → `handleItemsEditorNext(action)`:**

```
1. Validar effectivePatientId existe
2. Validar editableItems.length > 0 && !editableItems.some(i => !i.service_id)
   → Error: "Agrega al menos un servicio con ID válido."
3. setIsProcessing(true)
4. await createDirectInvoice(effectivePatientId, editableItems, isSales, freeformCurrency)
   → Endpoint: INVOICES_UPSERT
   → Payload:
     {
       user_id: patientId,
       type: 'invoice',
       currency: freeformCurrency,
       total: Σ item.total,
       is_sales: isSales,
       is_historical: false,
       created_at: toLocalISOString(new Date()),
       due_date: toLocalISOString(hoy + 30 días),
       notes: '',
       items: editableItems.map(i => ({
         service_id: i.service_id,
         quantity: i.quantity,
         unit_price: i.unit_price,
         total: i.total,
       }))
     }
   → Extrae invoiceId de: response.invoice_id ?? response.id
   → Si no hay ID: fallback a fetchLatestInvoiceIdForUser(patientId)
     → Consulta USER_INVOICES, reduce al de mayor ID numérico (o más reciente por timestamp)
   → Construye objeto Invoice con los datos conocidos
5. setResolvedInvoice(invoice)
6. linkInvoiceToContext(invoice.id)  ← fire-and-forget
7. Si action === 'invoice-only':
   → setConfirmationData({ invoiceId, invoiceDocNo, payments: [], total, currency })
   → setCurrentStep(steps.length - 1)  ← salta al paso final
   → onSuccess?.()
8. Si action === 'invoice-and-pay':
   → setCurrentStep(needsPatientStep ? 2 : 1)  ← avanza a Pago
```

### 8.3 Paso 1 — Pago

`StepPayment` con:
- `paymentOnly={true}` — oculta "Solo facturar"
- `invoiceJustCreated={true}` — banner de resumen con fondo verde y ícono ✓ "Factura creada"

### 8.4 Paso 2 — Listo

---

## 9. Flujo D — Freeform sin Paciente (Contexto Vacío)

**Condición:** `isFreeformFlow && !context?.patientId` → `needsPatientStep = true`  
**Stepper:** `Paciente → Servicios → Pago → Listo` (4 pasos)

### 9.1 Offset de índices de pasos

Al insertar el paso de paciente al inicio, todos los índices se desplazan:

| Paso lógico | Índice sin paso paciente | Índice con paso paciente |
|-------------|--------------------------|--------------------------|
| Paciente    | —                        | **0**                    |
| Servicios   | 0 (`itemsStep`)          | **1** (`itemsStep`)      |
| Pago        | 1 (`paymentStep`)        | **2** (`paymentStep`)    |
| Listo       | 2                        | **3**                    |

Computados en `renderStep`:
```ts
const itemsStep  = needsPatientStep ? 1 : 0;
const paymentStep = needsPatientStep ? 2 : 1;
```

Y en `handleItemsEditorNext`:
```ts
setCurrentStep(needsPatientStep ? 2 : 1);  // navega al paso de pago correcto
```

### 9.2 Effective Patient — flujo de datos

```ts
const effectivePatientId   = selectedPatient?.id   || context?.patientId
const effectivePatientName = selectedPatient?.name || context?.patientName
```

`selectedPatient` se setea en el Paso 0. `context.patientId` aplica en Flujo C (donde no hay paso de paciente pero sí hay ID en contexto). En Flujo D, solo `selectedPatient` puede tener valor ya que `context.patientId` es `undefined`.

### 9.3 Paso 0 — Selección de Paciente (`StepPatientSelect`)

**Dos modos del componente:**

**Modo selector** (cuando `readonlyPatient` no viene, que es siempre en este flujo):
- Texto informativo: "Selecciona el paciente al que deseas facturar. Si no existe, puedes crearlo directamente desde el selector."
- `UserSelector` configurado con `filterType="PACIENTE"` e `isSales={true}`
  - Permite buscar pacientes existentes por nombre, teléfono o email
  - Permite **crear paciente on-the-fly** desde el mismo dropdown: ingresa nombre, teléfono y/o email → se crea inmediatamente en el backend sin salir del wizard
  - Al seleccionar o crear, el callback `onPatientChange(user)` setea `selectedPatient`
- Si `selectedPatient` existe: muestra card de confirmación con ícono de usuario, nombre en bold, teléfono y email (si disponibles)

**Modo solo lectura** (cuando se pasa `readonlyPatient` — futuro, para cuando el paciente ya viene en contexto pero se quiere mostrar):
- Muestra directamente el card del paciente sin selector

**Botón "Siguiente":** `disabled={!selectedPatient}`

**Al presionar "Siguiente":**
```ts
setCurrentStep(1)  // ← siempre a índice 1 (el itemsStep en Flujo D)
```

### 9.4 Pasos 1, 2, 3

Idénticos al Flujo C (§8.2, §8.3, §8.4), con la diferencia de que `effectivePatientId` y `effectivePatientName` provienen de `selectedPatient`.

`StepConfirmation` usa `patientName={effectivePatientName}` para mostrar el nombre del paciente seleccionado/creado.

### 9.5 Reset al cerrar

En el efecto que resetea el estado al cerrar (`isOpen = false`):
```ts
setSelectedPatient(null)
setEditableItems([])
setFreeformCurrency('UYU')
```

---

## 10. Paso de Pago — Detalle Completo (`StepPayment`)

**Archivo:** `src/components/billing-wizard/steps/step-payment.tsx`

### 10.1 Props

```ts
interface StepPaymentProps {
  invoice: Invoice;        // Factura principal (siempre requerida)
  invoices?: Invoice[];    // Array de facturas para modo multi-factura (selección de facturas)
  isSales: boolean;
  onPaymentSuccess: (result: PaymentResult) => void;
  onSkipPayment: (invoiceDocNo?: string) => void;
  isSubmitting: boolean;
  setIsSubmitting: (v: boolean) => void;
  paymentOnly?: boolean;          // Oculta "Solo facturar", default false
  invoiceJustCreated?: boolean;   // Muestra banner verde, default false
}
```

### 10.2 Estado inicial del formulario

```ts
defaultValues: {
  entries: [{
    method: '',                   // método de pago (ID del PaymentMethod)
    amount: pendingAmount,        // pendiente calculado al montar
    payment_currency: invoiceCurrency,
    created_at: new Date(),
  }],
  exchange_rate: sessionExchangeRate,   // tasa de la sesión de caja activa
  notes: '',
  is_historical: false,
}
```

`pendingAmount` se calcula al montar:
- Modo single: `max(0, invoice.total - invoice.paid_amount)`
- Modo multi: `Σ max(0, inv.total - inv.paid_amount)` para todas las facturas

**Sincronización automática:** Cuando `pendingAmount` cambia (por actualización de `invoice`), el campo `entries.0.amount` se resetea:
```ts
React.useEffect(() => {
  form.setValue('entries.0.amount', pendingAmount);
}, [pendingAmount]);
```

### 10.3 Carga de métodos de pago

Al montar, hace `GET API_ROUTES.PAYMENT_METHODS` y popula el select de método de pago.

### 10.4 Tipo de cambio

- Se inicializa con la tasa de la sesión de caja activa: `activeCashSession?.data?.opening_details?.date_rate`
- Si la sesión cambia, se sincroniza: `form.setValue('exchange_rate', sessionExchangeRate)`
- Solo se muestra el campo cuando `hasCrossCurrency = true` (alguna entry usa moneda distinta a la de la factura)

### 10.5 Multi-método de pago

El usuario puede agregar múltiples entries al formulario:
- Botón "+ Agregar otro método de pago" → `append` con `amount = remainingAfterPayment`, `payment_currency = invoiceCurrency`
- Cada entry tiene campo de fecha, moneda, método de pago y monto
- Si hay más de una entry, aparece botón X por entry para eliminarla
- Al agregar: el monto inicial es el `remainingAfterPayment` calculado en tiempo real

### 10.6 Cálculo en tiempo real

```ts
// Convierte cada entry a moneda de la factura y suma
totalInInvoiceCurrency = Σ calcEquivalent(amount, paymentCurrency, invoiceCurrency, rate)

// Función de conversión
calcEquivalent(amount, from, to, rate):
  if (from === to) return amount
  if (to === 'USD' && from === 'UYU') return amount / rate
  if (to === 'UYU' && from === 'USD') return amount * rate

// Pendiente tras el cobro
remainingAfterPayment = max(0, round((pendingAmount - totalInInvoiceCurrency) * 100) / 100)
```

Se muestra en tiempo real en el resumen inferior. Color: ámbar si > 0, verde si = 0.

### 10.7 Validaciones de sesión de caja

Al hacer submit:

```
1. Si is_historical = false:
   → await validateActiveSession()
   → Si !isValid: setIsNoSessionAlertOpen(true) → return (no continúa)
   → Si isValid: sessionId = sessionValidation.sessionId
2. Si is_historical = true:
   → sessionId = null (se omite la sesión)
```

**AlertDialog de sesión inexistente:**
- Título y descripción desde i18n `InvoicesPage.noSessionDialog.*`
- Botón "Cancelar" — cierra el alert
- Botón "Abrir sesión de caja" (visible solo si `canAccessCashier`) → navega a `/<locale>/cashier`

### 10.8 Submit — Modo Single Invoice

Por cada entry en `values.entries`:

```ts
payload = {
  cash_session_id: sessionId,
  user: currentUser,
  client_user: { id: invoice.user_id, name: invoice.user_name, email: invoice.userEmail },
  credit_payment: [],
  query: {
    invoice_id: parseInt(invoice.id, 10),
    payment_date: toLocalISOString(entry.created_at),
    amount: Number(entry.amount),
    converted_amount: calcEquivalent(amount, paymentCurrency, invoiceCurrency, rate),
    method: selectedMethod?.name || '',
    payment_method_id: entry.method,
    status: 'completed',
    user_id: invoice.user_id,
    invoice_currency: invoiceCurrency,
    payment_currency: entry.payment_currency,
    exchange_rate: entry.payment_currency !== invoiceCurrency ? rate : 1,
    is_sales: isSales,
    total_paid: convertedAmount,
    notes: values.notes || '',
    is_historical: values.is_historical || false,
  }
}
```

**Endpoint:** `SALES.INVOICE_PAYMENT` o `PURCHASES.INVOICE_PAYMENT`

Se hace **un POST por cada entry**. Si alguna falla, se interrumpe y se muestra error.

**Extracción del pago creado** (`extractRawPayment`):
```ts
if (Array.isArray(response))           → response[0]
if (response.data es Array)            → response.data[0]
if (response.result es Array)          → response.result[0]
if (response.payment)                  → response.payment
else                                   → response.data ?? response
```

### 10.9 Submit — Modo Multi-Invoice

Cuando `invoices` array está presente:

1. Calcula `totalConverted = Σ calcEquivalent(entry.amount, entry.payment_currency, invoiceCurrency, rate)` para todas las entries
2. `distributePayment(invoices, totalConverted)` — distribuye en orden:
   ```ts
   // Llena cada factura hasta su pendiente, en orden del array
   for (const inv of invoices) {
     if (remaining <= 0.001) break;
     const pending = max(0, inv.total - inv.paid_amount);
     const allocated = min(pending, remaining);
     if (allocated > 0.001) { result.push({ invoice: inv, amount: allocated }); remaining -= allocated; }
   }
   ```
3. Usa solo la primera entry (`values.entries[0]`) para método de pago y fecha — aplica el mismo método a todas las facturas
4. Un POST por cada factura de la distribución, usando `allocatedAmount` (ya en moneda de la factura)
5. Los pagos de facturas con `inv.currency` diferente usan `exchange_rate: 1` (la conversión ya se hizo al calcular `allocatedAmount`)

**Tabla de distribución visible en UI:** Se muestra cuando `isMultiInvoice && invoiceDistribution.length > 0` — lista cada factura con su monto asignado.

### 10.10 Después del Submit Exitoso

```ts
await checkActiveSession()  // refresca estado de la sesión de caja en AuthContext

onPaymentSuccess({
  payments: createdPayments,       // array de CreatedPayment con docNo, transactionId, etc.
  invoiceDocNo,
  invoiceId,
  totalPaid,                       // suma total pagada (en moneda de la factura)
  remainingAfterPayment,           // max(0, pendingAmount - totalPaid)
  currency: invoiceCurrency,
})
```

### 10.11 Banner de factura ya pagada

Visible cuando `pendingAmount <= 0`:
```tsx
<div className="rounded-md bg-emerald-50 border-emerald-200 ...">
  <CheckCircle2 />
  <span>Ya ha sido completamente facturado y pagado.</span>
</div>
```

---

## 11. Paso de Confirmación — Detalle Completo (`StepConfirmation`)

**Archivo:** `src/components/billing-wizard/steps/step-confirmation.tsx`

### 11.1 Props

```ts
interface StepConfirmationProps {
  invoiceId?: string;        // ID de factura única
  invoiceDocNo?: string;     // Número de factura única
  invoices?: Invoice[];      // Array para multi-factura
  payments: CreatedPayment[];
  patientName?: string;
  total?: number;            // Total facturado
  totalPaid?: number;        // Total pagado en esta sesión
  pendingAfter?: number;     // Pendiente tras los pagos
  currency?: string;
  isSales: boolean;
  onClose: () => void;
}
```

### 11.2 Cómo llega `confirmationData` al paso final

Desde `handlePaymentSuccess` (pago exitoso):

```ts
// Obtiene lista completa de pagos del invoice
const sessionIds = new Set(result.payments.map(p => p.transactionId).filter(Boolean))
const fetched = await fetchInvoicePaymentsForConfirmation(targetInvoiceId, isSales, targetCurrency)
const payments = fetched.map(p => ({
  ...p,
  isNew: !!p.transactionId && sessionIds.has(p.transactionId)  // marca los nuevos
}))

setConfirmationData({
  invoiceId:     targetInvoiceId,
  invoiceDocNo:  result.invoiceDocNo || resolvedInvoice?.doc_no,
  payments,
  total:         resolvedInvoice?.total,
  totalPaid:     result.totalPaid,
  pendingAfter:  result.remainingAfterPayment,
  currency:      targetCurrency,
})
```

Desde `handleSkipPayment` (sin nuevo pago):

```ts
const fetched = await fetchInvoicePaymentsForConfirmation(targetId, isSales, targetCurrency)
const payments = fetched.map(p => ({ ...p, isNew: false }))  // ninguno es nuevo

setConfirmationData({
  invoiceId:    targetId,
  invoiceDocNo: resolvedInvoice?.doc_no,
  payments,
  total:        resolvedInvoice?.total,
  pendingAfter: max(0, resolvedInvoice.total - resolvedInvoice.paid_amount),
  currency:     targetCurrency,
})
```

### 11.3 `fetchInvoicePaymentsForConfirmation`

**Endpoint:** `SALES.INVOICE_PAYMENTS` o `PURCHASES.INVOICE_PAYMENTS` con `{ invoice_id, is_sales }`

```ts
// Mapeo de campos de la API (formato nuevo)
p.amount_applied ?? p.amount          // monto — el campo correcto es amount_applied
p.invoice_currency || p.source_currency || p.currency  // moneda correcta
p.payment_method_name || p.method     // nombre del método

// Filtrado: excluye pagos fallidos o sin ID
.filter(p => p?.status !== 'failed' && (p?.transaction_id || p?.id))
```

### 11.4 Qué muestra el paso de confirmación

**Ícono y título:**
- Ícono ✓ verde en círculo
- "¡Cobro registrado!" si `payments.length > 0`
- "¡Factura creada!" si `payments.length === 0`
- Nombre del paciente (`patientName`) si disponible

**Tabla de documentos:**

*Facturas:*
- Multi: una fila por cada invoice del array `invoices`
- Single: fila con `invoiceDocNo` (o nada si no hay doc_no)
- Cada fila: etiqueta "Factura" + número + botón imprimir PDF

*Pagos (solo si `payment.docNo` existe):*
- Etiqueta "Pago 1", "Pago 2"... (o "Pago" si solo hay uno)
- Badge verde **"Nuevo"** si `payment.isNew === true`
- Número de documento + monto + moneda en la misma línea
- Fecha (`dd/MM/yyyy HH:mm`) + método de pago en segunda línea
- Botón imprimir recibo (visible si `payment.transactionId` existe)

*Totales:*
- "Total facturado" (si `total !== undefined`) — color primario
- "Total pagado (en esta sesión)" (si `totalPaid !== undefined && totalPaid > 0`) — color verde
- "Total pendiente" (si `pendingAfter !== undefined`) — ámbar si > 0, verde si = 0

### 11.5 Impresión de documentos

**Factura PDF:**
```ts
blob = await api.getBlob(
  isSales ? API_ROUTES.SALES.API_INVOICE_PRINT : API_ROUTES.PURCHASES.API_INVOICE_PRINT,
  { id: invoiceId }
)
// Descarga automática como <nombre>.pdf
```

**Recibo de pago PDF:**
```ts
blob = await api.getBlob(
  isSales ? API_ROUTES.SALES.API_PAYMENT_PRINT : API_ROUTES.PURCHASES.API_PAYMENT_PRINT,
  {
    transaction_id:   payment.transactionId,
    transaction_type: payment.transactionType || 'direct_payment',
  }
)
```

Cada botón tiene su propio indicador de carga (`Loader2` spinner) por ID, para que múltiples impresiones simultáneas no se bloqueen entre sí.

---

## 12. Vinculación con Citas y Sesiones Clínicas

**Archivo:** `src/services/billing-links.ts`

Después de crear una factura nueva (Flujos B, C y D), `billing-wizard-modal.tsx` llama:

```ts
linkInvoiceToContext(invoiceId)
```

Que evalúa el contexto y lanza las vinculaciones correspondientes:

```ts
if (context?.appointmentId) {
  linkInvoiceToAppointment(invoiceId, context.appointmentId)
  // POST API_ROUTES.APPOINTMENTS_LINK_INVOICE
  // Body: { appointment_id, invoice_id }
}

if (context?.sessionId) {
  if (context.sessionType === 'odontograma') {
    linkInvoiceToOdontogramSession(invoiceId, context.sessionId)
    // POST API_ROUTES.SESSIONS_LINK_INVOICE
    // Body: { sesion_id, invoice_id }
  } else {
    linkInvoiceToClinicSession(invoiceId, context.sessionId)
    // POST API_ROUTES.CLINIC_SESSIONS_LINK_INVOICE
    // Body: { sesion_id, invoice_id }
  }
}
```

**Comportamiento:** Es completamente **fire-and-forget**. Si el POST falla, solo registra `console.warn('[billing-links] Failed to link...')`. El error no llega al usuario y no interrumpe el wizard bajo ninguna circunstancia.

**Cuándo NO se vincula:** En el Flujo A (desde factura existente), porque la factura ya existe y ya debería estar vinculada previamente. `linkInvoiceToContext` solo se llama cuando se crea una factura nueva.

---

## 13. Resumen de Flujos por Parámetro

| Parámetros recibidos | Flujo | Stepper | Creación automática |
|---|---|---|---|
| `invoiceId` y/o `invoice` | **A — Desde Factura** | Pago → Listo | Ninguna. Usa factura existente. |
| `quoteId` + presupuesto con pendiente de facturar | **B estándar** | Tratamiento → Pago → Listo | Confirma presupuesto (si draft) + crea factura desde orden. |
| `quoteId` + presupuesto completamente facturado + facturas sin pagar | **B selection mode** | Facturas → Pago → Listo | Ninguna. Selecciona facturas existentes. |
| `patientId` (sin quoteId ni invoiceId) | **C — Freeform con paciente** | Servicios → Pago → Listo | Crea factura directa con ítems elegidos libremente. |
| `{}` vacío o sin `patientId` | **D — Freeform sin paciente** | Paciente → Servicios → Pago → Listo | Igual que C + paciente seleccionado/creado on-the-fly. |
| Cualquiera + `appointmentId` | El que corresponda | igual | Vincula la factura creada a la cita (fire-and-forget). |
| Cualquiera + `sessionId` + `sessionType:'clinica'` | El que corresponda | igual | Vincula a sesión clínica (`CLINIC_SESSIONS_LINK_INVOICE`). |
| Cualquiera + `sessionId` + `sessionType:'odontograma'` | El que corresponda | igual | Vincula a sesión odontograma (`SESSIONS_LINK_INVOICE`). |

---

## 14. Comportamiento UX del Modal

### 14.1 No se cierra al hacer clic fuera

El `DialogContent` del wizard tiene prevenidos `onPointerDownOutside` y `onInteractOutside`:

```tsx
// src/components/ui/dialog.tsx
onPointerDownOutside={(event) => { event.preventDefault(); }}
onInteractOutside={(event) => { event.preventDefault(); }}
```

El wizard **solo se cierra** con:
- El botón X (esquina superior derecha)
- El botón "Cancelar" (barra inferior de acciones)
- El botón "Cerrar" (en el paso de confirmación)

### 14.2 Panel de fondo permanece abierto

Los `ResizableSheet` (paneles de detalle) tienen prevenidas sus interacciones externas:

```tsx
// src/components/ui/sheet.tsx — SheetContent
onPointerDownOutside={(e) => e.preventDefault()}
onInteractOutside={(e) => e.preventDefault()}
```

Esto evita que Radix UI cierre el Sheet cuando el Dialog del wizard abre encima y su overlay dispara eventos "fuera del sheet". El panel permanece exactamente en el estado en que estaba al abrir el wizard. Al cerrar el wizard, el panel vuelve a estar en primer plano sin ninguna animación de reapertura.

### 14.3 Layering (z-index)

Ambos (Dialog y Sheet) usan `z-50`. Como el Dialog del wizard se monta después en el DOM (se abre después que el sheet), sus elementos aparecen sobre el sheet visualmente. Al cerrar el wizard, el sheet sigue en el DOM y vuelve a ser el modal activo sin transiciones adicionales.

### 14.4 Refresco de datos en background

Los callbacks `onSuccess` siempre se ejecutan en modo silencioso para no mostrar skeleton mientras el wizard está abierto:

```ts
// user-quotes.tsx
openBillingWizard({ quoteId, ... }, () => loadQuotes(true))   // ✅ silent=true

// user-invoices.tsx
openBillingWizard({ invoiceId, ... }, () => { loadInvoices(true); onDataChange?.(); })
```

### 14.5 Reset de estado al cerrar

Cuando `isOpen` cambia a `false`, el efecto de inicialización del modal resetea:

```ts
setCurrentStep(0)
setQuote(null)
setQuoteItems([])
setFinancialSummary(null)
setOrderId(null)
setResolvedInvoice(null)
setAvailableInvoices([])
setSelectedInvoiceIds(new Set())
setConfirmationData({ payments: [] })
setError(null)
setTreatmentLoadError(null)
setEditableItems([])
setFreeformCurrency('UYU')
setSelectedPatient(null)
```

---

## 15. Helpers y Servicios Internos

### 15.1 `createDirectInvoice` (freeform)

Crea una factura directamente sin presupuesto ni orden. Usada en Flujos C y D.

- **Endpoint:** `INVOICES_UPSERT`
- **Fecha vencimiento:** hoy + 30 días
- **Extracción del ID:**
  1. `response.invoice_id ?? response.id`
  2. Si ninguno: `fetchLatestInvoiceIdForUser(patientId)` — toma el invoice de mayor ID numérico (o más reciente por timestamp si IDs no son numéricos)

### 15.2 `fetchLatestUnpaidInvoice` (desde presupuesto)

Consulta `fetchQuoteInvoicesForFinancials` y filtra:
- `type !== 'credit_note'`
- `payment_status !== 'paid'`
- Ordena por fecha de creación descendente → toma el primero

### 15.3 `fetchInvoiceById`

Consulta `USER_INVOICES` con `{ user_id }` y busca por `String(inv.id) === invoiceId`. Mapea campos incluyendo `payment_state || payment_status` y `invoice_doc_no || doc_no`.

### 15.4 `calculateQuoteFinancialSummary`

```ts
// Trata notas de crédito como negativas
sign = invoice.type?.includes('credit') ? -1 : 1

amount_invoiced         = Σ (sign * invoice.total)
amount_paid             = Σ (sign * invoice.paid_amount)
amount_pending_invoice  = max(quoteTotal - amount_invoiced, 0)
amount_pending_payment  = max(amount_invoiced - amount_paid, 0)
```

### 15.5 `distributePayment`

```ts
function distributePayment(invoices: Invoice[], total: number): InvoiceAllocation[] {
  let remaining = total;
  for (const inv of invoices) {
    if (remaining <= 0.001) break;
    const pending = max(0, inv.total - inv.paid_amount);
    const allocated = min(pending, remaining);
    if (allocated > 0.001) {
      result.push({ invoice: inv, amount: allocated });
      remaining -= allocated;
    }
  }
  return result;
}
```

Distribuye en orden del array, llenando cada factura hasta su pendiente antes de pasar a la siguiente. Umbral mínimo de 0.001 para evitar distribuciones de montos insignificantes.

---

## 16. Permisos

| Punto de entrada | Permiso requerido |
|---|---|
| Botón "Cobrar" en Header widget | `SALES_PERMISSIONS.INVOICES_CREATE` |
| Botón "Cobrar" en tab Presupuestos | `canInvoiceQuote` (`INVOICES_INVOICE_ORDER`) OR `canCreatePayment` (`PAYMENTS_CREATE`) |
| Botón "Cobrar" en tab Facturas | `SALES_PERMISSIONS.PAYMENTS_CREATE` (o `PURCHASES_PERMISSIONS.PAYMENTS_CREATE`) |
| Botón "Cobrar" en sheet Facturas | ídem tab Facturas |
| Registrar pago (submit Step Payment) | Sesión de caja activa (si `is_historical = false`) |
| Imprimir en Step Confirmation | Solo requiere que la API devuelva el blob (sin permiso adicional en UI) |
| Enlace "Abrir sesión de caja" (no-session alert) | `CASHIER_PERMISSIONS.VIEW_MENU` |

---

*Fin del documento.*
