# UI Navigation Mapping — Invoke IA

This document maps every page, tab, subtab, and action reachable via the
deep-link URL parameter system. It is the authoritative reference for the
**InvokeIAHelpTool** n8n agent so it can generate URLs that navigate users
directly to the right screen.

It also documents **AI features** (magic wand text enhancement, voice
transcription), **calendar subsystem**, **sticky notes**, and all **reports**
so the AI agent can accurately answer user questions about the interface.

---

## Query parameters

| Param | Type | Description |
|-------|------|-------------|
| `f`   | string | Filter value — applied to the main table's search field |
| `t`   | string | Tab slug — navigate to this tab in the detail panel |
| `st`  | string | Subtab slug — navigate to this subtab within tab `t` |
| `act` | string | Action slug — execute this UI action |

All parameters are **optional**. Execution order: filter → auto-select first
result → tab → subtab → action. The UI waits for each step to render before
proceeding.

---

## Hook implementation

The feature is implemented via `src/hooks/use-deep-link.ts`. Each page calls
`useDeepLink({ tabMap, subtabMap, onFilter, items, isLoading, onAutoSelect,
onTabChange, onSubtabChange, actionMap })` to participate.

---

## Pages

---

### `/[locale]/users` — Pacientes

**Filter column:** `email` (searches name, email, phone, document)

**Tabs (`t=`)**

| URL slug | Internal ID | Label |
|----------|-------------|-------|
| `Historia-Clinica` | `clinical-history` | Historia Clínica |
| `Servicios` | `services` | Servicios (solo médicos) |
| `Presupuestos` | `quotes` | Presupuestos |
| `Ordenes` | `orders` | Órdenes |
| `Facturas` | `invoices` | Facturas |
| `Pagos` | `payments` | Pagos |
| `Citas` | `appointments` | Citas |
| `Mensajes` | `messages` | Mensajes |
| `Historial` | `logs` | Historial de actividad |
| `Notas` | `notes` | Notas |

**Subtabs of `Historia-Clinica` (`st=`)**

| URL slug | Internal ID | Label |
|----------|-------------|-------|
| `Anamnesis` | `anamnesis` | Anamnesis (antecedentes, alergias) |
| `Timeline` | `timeline` | Línea de tiempo de sesiones |
| `Linea-de-Tiempo` | `timeline` | Alias de Timeline |
| `Odontograma` | `odontogram` | Odontograma |
| `Documentos` | `documents` | Documentos clínicos |

**Actions (`act=`)**

| URL slug | Context | Description |
|----------|---------|-------------|
| `Crear` | `t=Historia-Clinica, st=Timeline` (default) | Crear sesión clínica |
| `Crear` | `t=Historia-Clinica, st=Documentos` | Subir documento clínico |
| `Crear` | `t=Citas` | Abrir diálogo crear cita |
| `Crear` | `t=Presupuestos` | Abrir diálogo crear presupuesto |
| `Crear` | `t=Facturas` | Abrir diálogo crear factura |
| `Crear` | (sin `t`) | Abrir diálogo crear paciente |
| `Sesion` | `t=Historia-Clinica` | Crear sesión clínica |
| `Documento` | `t=Historia-Clinica` | Subir documento clínico |
| `Cita` | cualquier | Abrir diálogo crear cita |
| `Presupuesto` | cualquier | Abrir diálogo crear presupuesto |
| `Factura` | cualquier | Abrir diálogo crear factura |
| `Prepago` | cualquier | Abrir diálogo crear prepago |

**Ejemplos**

```
# Abrir historial clínico del paciente Zahari
/es/users?f=Zahari&t=Historia-Clinica

# Ir a Timeline y crear sesión clínica para Zahari
/es/users?f=Zahari&t=Historia-Clinica&st=Timeline&act=Crear

# Abrir odontograma de Zahari
/es/users?f=Zahari&t=Historia-Clinica&st=Odontograma

# Crear una cita para Zahari
/es/users?f=Zahari&act=Cita

# Ver facturas de Zahari
/es/users?f=Zahari&t=Facturas

# Ver documentos clínicos y subir uno nuevo
/es/users?f=Zahari&t=Historia-Clinica&st=Documentos&act=Crear
```

---

### `/[locale]/roles` — Roles

**Filter column:** `name`

**Tabs (`t=`)**

| URL slug | Internal ID | Label |
|----------|-------------|-------|
| `Detalles` | `details` | Detalles del rol |
| `Usuarios` | `users` | Usuarios con este rol |
| `Permisos` | `permissions` | Permisos asignados |

**Actions (`act=`)**

| URL slug | Context | Description |
|----------|---------|-------------|
| `Crear` | (sin `f`) | Abrir diálogo crear rol |
| `Eliminar` | con `f` | Eliminar rol seleccionado |

**Ejemplos**

```
# Ver permisos del rol Admin
/es/roles?f=Admin&t=Permisos

# Crear nuevo rol
/es/roles?act=Crear
```

---

### `/[locale]/permissions` — Permisos

**Filter column:** `name`

**Tabs (`t=`)**

| URL slug | Internal ID | Label |
|----------|-------------|-------|
| `Detalles` | `details` | Detalles del permiso |
| `Usuarios` | `users` | Usuarios con este permiso |

**Actions (`act=`)**

| URL slug | Context | Description |
|----------|---------|-------------|
| `Crear` | — | Abrir diálogo crear permiso |

---

### `/[locale]/config/doctors` — Doctores

**Filter column:** `email`

**Tabs (`t=`)**

| URL slug | Internal ID | Label |
|----------|-------------|-------|
| `Detalles` | `details` | Detalles del doctor |
| `Servicios` | `services` | Servicios que ofrece |
| `Mensajes` | `messages` | Mensajes |
| `Historial` | `logs` | Historial de actividad |

**Actions (`act=`)**

| URL slug | Context | Description |
|----------|---------|-------------|
| `Crear` | — | Abrir diálogo crear doctor |

**Ejemplos**

```
# Ver servicios del doctor García
/es/config/doctors?f=Garcia&t=Servicios
```

---

### `/[locale]/system/users` — Usuarios del sistema

**Filter column:** `email`

**Tabs (`t=`)**

| URL slug | Internal ID | Label |
|----------|-------------|-------|
| `Detalles` | `details` | Detalles del usuario |
| `Roles` | `roles` | Roles asignados |
| `Historial` | `logs` | Historial de actividad |

**Actions (`act=`)**

| URL slug | Context | Description |
|----------|---------|-------------|
| `Crear` | — | Abrir diálogo crear usuario |

---

### `/[locale]/sales/services` — Servicios de venta

**Filter column:** `name`

**Tabs (`t=`)**

| URL slug | Internal ID | Label |
|----------|-------------|-------|
| `Detalles` | `details` | Detalles del servicio |
| `Info` | `info` | Información adicional |

**Actions (`act=`)**

| URL slug | Description |
|----------|-------------|
| `Crear` | Abrir diálogo crear servicio |

---

### `/[locale]/purchases/services` — Servicios de compra

**Filter column:** `name`

**Tabs (`t=`)**

| URL slug | Internal ID | Label |
|----------|-------------|-------|
| `Detalles` | `details` | Detalles del servicio |
| `Info` | `info` | Información adicional |

**Actions (`act=`)**

| URL slug | Description |
|----------|-------------|
| `Crear` | Abrir diálogo crear servicio de compra |

---

### `/[locale]/purchases/providers` — Proveedores

**Filter column:** `email`

**Tabs (`t=`)**

| URL slug | Internal ID | Label |
|----------|-------------|-------|
| `Detalles` | `details` | Detalles del proveedor |
| `Resumen` | `summary` | Resumen financiero |
| `Servicios` | `services` | Servicios del proveedor |
| `Presupuestos` | `quotes` | Presupuestos de compra |
| `Ordenes` | `orders` | Órdenes de compra |
| `Facturas` | `invoices` | Facturas de compra |
| `Pagos` | `payments` | Pagos realizados |
| `Notas` | `notes` | Notas internas |

**Actions (`act=`)**

| URL slug | Context | Description |
|----------|---------|-------------|
| `Crear` | — | Abrir diálogo crear proveedor |
| `Presupuesto` | cualquier | Abrir diálogo crear presupuesto de compra |
| `Factura` | cualquier | Abrir diálogo crear factura de compra |
| `Prepago` | cualquier | Abrir diálogo crear prepago |

**Ejemplos**

```
# Ver facturas del proveedor Acme
/es/purchases/providers?f=Acme&t=Facturas

# Crear presupuesto para el proveedor Acme
/es/purchases/providers?f=Acme&act=Presupuesto
```

---

### `/[locale]/appointments` — Citas / Calendario

**No left-panel filter table** — el calendario es la vista principal.

**Vistas disponibles:** `day` (día), `2-day` (2 días), `3-day` (3 días), `week` (semana), `month` (mes), `schedule` (agenda)

**Agrupación:** por ninguno, por doctor, por calendario

**Actions (`act=`)**

| URL slug | Description |
|----------|-------------|
| `Crear` | Abrir diálogo crear nueva cita |

**Ejemplos**

```
# Abrir diálogo de nueva cita
/es/appointments?act=Crear
```

---

## Estados de citas (Appointment States)

El calendario muestra los eventos con un ícono de estado en la esquina y un color de acento diferente según su estado:

| Estado | Color de acento | Descripción |
|--------|-----------------|-------------|
| `pending` | Gris (#9ca3af) | Solicitud pendiente de confirmación |
| `scheduled` | Azul (#3b82f6) | Programada, pendiente de confirmar por el paciente |
| `confirmed` | Verde esmeralda (#10b981) | Confirmada por el paciente o la clínica |
| `arrived` | Ámbar (#f59e0b) | Paciente llegó a la clínica |
| `in_progress` | Naranja (#f97316) | Consulta en curso |
| `completed` | Verde (#16a34a) | Consulta finalizada |
| `no_show` | Rojo (#ef4444) | Paciente no se presentó |
| `cancelled` | Gris rayado (#6b7280) | Cita cancelada — se muestra con texto tachado en el calendario |

**Transiciones de estado permitidas desde el calendario:** Se puede cambiar el estado directamente haciendo clic sobre la cita. Los estados `cancelled` y `completed` son terminales.

**Razones de cancelación (`cancellation_reason`)**

| Código | Descripción |
|--------|-------------|
| `late` | Cancelación tardía (fuera del plazo) |
| `in_time` | Cancelación a tiempo |
| `no_notice` | Sin aviso previo |
| `by_doctor` | Cancelada por el doctor |
| `by_clinic` | Cancelada por la clínica |
| `other` | Otro motivo (requiere nota de texto libre) |
| `reschedule` | Reagendada — asignado automáticamente al reagendar |

**Sistema de colores de calendarios**

Los calendarios (salas/consultorios) pueden tener uno de los 11 colores de Google Calendar: Lavanda, Salvia, Uva, Flamenco, Banana, Mandarina, Pavo Real, Grafito, Arándano, Albahaca, Tomate. El color se muestra en los eventos y en los encabezados de columna cuando se agrupa por calendario.

---

## Notas Rápidas (Sticky Notes)

Panel flotante global accesible desde el header. Permite tomar notas rápidas visibles para todos los usuarios con el permiso correspondiente.

### Acceso

- **Header (escritorio y móvil):** ícono de nota adhesiva en la barra flotante superior derecha
- **Atajo de teclado:** `Escape` cierra el panel

### CRUD

| Operación | Endpoint | Payload |
|-----------|----------|---------|
| Listar | `GET /sticky-notes` | — |
| Crear | `POST /sticky-notes/upsert` | `{ text, color, created_by }` |
| Editar | `POST /sticky-notes/upsert` | `{ id, text, color }` |
| Eliminar | `POST /sticky-notes/delete` | `{ id }` |

### Colores disponibles

`yellow`, `pink`, `blue`, `green`, `purple`, `orange`

### Entrada por voz

El panel incluye reconocimiento de voz (Web Speech API, `es-ES`, continuo) con stop words:

| Palabra | Comportamiento |
|---------|----------------|
| `enviar` / `listo` / `done` / `send` | Detiene el reconocimiento → nota queda lista para guardar manualmente |
| `guardar` | Detiene el reconocimiento **y guarda la nota automáticamente** |

Al activar el micrófono en sticky notes, el VoiceAssistant del header pausa la escucha de wake word. Al cerrar el panel, el VoiceAssistant retoma.

### Varita mágica (IA local — Chrome Nano)

El botón `Wand2` aparece en el toolbar inferior de las notas cuando Chrome Nano está disponible en el navegador:

- Posición: entre el selector de color y el botón de micrófono (en nueva nota); junto al selector de color (en edición)
- Visibilidad: 30% de opacidad por defecto; 100% al hover; se muestra tooltip explicativo en desktop
- Acción: envía el texto al modelo local con system prompt clínico odontológico en español; reemplaza el contenido con el texto mejorado
- Fallback: si Chrome Nano no está disponible, el botón no se renderiza

**Disponibilidad Chrome Nano:** requiere Chrome 127+ con `chrome://flags/#prompt-api-for-gemini-nano` habilitada, o disponibilidad general del Prompt API.

---

## Reportes

Todos los reportes viven bajo `/[locale]/reports/[slug]`. No soportan deep links de tab ni filtro — son páginas de generación bajo demanda. Linkear siempre a la URL base del reporte.

| Slug | Nombre | Para qué sirve |
|------|--------|----------------|
| `cierre-caja` | Cierre de Caja | Ver el resumen de ingresos y egresos de una o varias sesiones de caja; útil al cerrar el día |
| `cobros-dia` | Cobros del Día | Ver todos los pagos recibidos en un período; útil para controlar la cobranza diaria |
| `cuentas-corrientes` | Cuentas Corrientes | Ver el estado de cuenta de pacientes — cuánto fue facturado, cuánto cobrado y el saldo pendiente |
| `estado-presupuestos` | Estado de Presupuestos | Analizar el embudo de presupuestos — cuántos están en borrador, confirmados, rechazados |
| `produccion-doctor` | Producción por Doctor | Comparar la producción (facturado y cobrado) entre doctores en un período |
| `tratamientos` | Tratamientos Realizados | Ver qué procedimientos se realizaron más, con frecuencia y monto |
| `comparativo-produccion` | Comparativo de Producción | Ver la evolución mensual de la producción en los últimos 12 meses |
| `honorarios` | Honorarios | Calcular las comisiones a doctores según base (cobrado o facturado) en el período |
| `nuevos-pacientes` | Nuevos Pacientes | Ver cuántos pacientes nuevos ingresaron y cuántos tienen cita programada |
| `pacientes-inactivos` | Pacientes Inactivos | Identificar pacientes sin actividad clínica para campañas de reactivación |
| `tratamientos-en-curso` | Tratamientos en Curso | Ver el estado de los planes de tratamiento activos |
| `ocupacion-agenda` | Análisis de Citas | Ver estadísticas de ocupación de la agenda: citas por estado, doctor, y período |
| `cancelaciones` | Cancelaciones | Analizar las citas canceladas por motivo, doctor, y paciente |
| `ingresos-periodo` | Ingresos por Período | Ver el total cobrado agrupado por período de tiempo y método de pago |
| `facturacion-cobranza` | Facturación vs Cobranza | Comparar lo facturado contra lo efectivamente cobrado — identifica la brecha |
| `deudores` | Deudores | Ver la cartera de deuda clasificada por antigüedad — herramienta de cobranza |
| `servicios` | Rendimiento de Servicios | Ver la actividad y facturación del catálogo de servicios |
| `gastos-operativos` | Gastos Operativos | Ver el panorama completo de gastos: misceláneas y facturas a proveedores |
| `estado-resultados` | Estado de Resultados | Ver ingresos − gastos = resultado del período (P&L básico) |
| `kpis` | KPIs Clínica | Ver los indicadores clave de rendimiento de la clínica en un dashboard |

**Ejemplos**

```
# Ver reporte de cancelaciones
/es/reports/cancelaciones

# Ver KPIs de la clínica
/es/reports/kpis

# Ver producción por doctor
/es/reports/produccion-doctor

# Ver deudores (cobranza)
/es/reports/deudores
```

---

## Presupuestos y Facturación — Selección de Servicios

Al crear un presupuesto desde el panel del paciente (`t=Presupuestos`, `act=Crear`), el diálogo permite agregar líneas del catálogo de servicios con precio personalizable, cantidad y descuento.

Al facturar un presupuesto confirmado, la pantalla de facturación muestra los servicios del presupuesto pre-seleccionados. El usuario puede ajustar qué servicios incluir, cantidades y descuentos adicionales antes de confirmar la factura.

---

## Características de IA

### Varita Mágica — Mejora de Texto Local

Botón `Wand2` (lucide-react) que aparece en campos de texto editables cuando Chrome Nano está disponible. Fase 1: implementado en sticky notes (nueva nota y modo edición).

**Uso del patrón para extender a nuevos campos:**
```tsx
// En cualquier componente con useState para texto:
const { enhanceText, isReady, isAvailable } = useLocalAI();

{isReady && isAvailable && (
  <MagicWandButton
    onEnhance={async () => {
      const enhanced = await enhanceText(text, 'sticky-notes-clinical');
      setText(enhanced);
    }}
    disabled={!text.trim()}
    tooltipText={t('enhanceTooltip')}
  />
)}
```

**Componentes:**
- `src/hooks/use-local-ai.ts` — detección de Chrome Nano, `enhanceText`, `classifyIntent`
- `src/components/ai/magic-wand-button.tsx` — botón genérico reutilizable
- `src/types/chrome-ai.d.ts` — declaraciones TypeScript para `window.ai`

### Transcripción de Voz (Voice Transcription)

El VoiceAssistant corre una instancia de Web Speech API (`transcriptRecognitionRef`) en paralelo con el MediaRecorder. Al finalizar la grabación:

- Si el transcript capturado supera 10 caracteres y el padre provee `onTranscriptReady`, se llama `onTranscriptReady(transcript, blob)`
- Si no, se cae al comportamiento original: `onAudioReady(blob)`

Esto permite al header (Fase 2) clasificar la intención del texto antes de enviarlo al backend.

**Nueva prop de VoiceAssistant:**
```ts
onTranscriptReady?: (text: string, blob: Blob) => void;
```

---

## Adding deep-link support to a new page

1. Import the hook:
   ```ts
   import { useDeepLink } from '@/hooks/use-deep-link';
   ```

2. Call it inside the page component:
   ```ts
   useDeepLink({
     tabMap: { 'Mi-Tab': 'my-tab' },
     onFilter: (v) => setColumnFilters([{ id: 'name', value: v }]),
     items: myItems,
     isLoading: isRefreshing,
     onAutoSelect: (item) => handleRowSelectionChange([item]),
     onTabChange: (id) => setActiveTab(id),
     actionMap: { 'Crear': () => setIsCreateDialogOpen(true) },
   });
   ```

3. Add the page to this document with its `tabMap`, `subtabMap`, and `actionMap`.

4. Update the **InvokeIAHelpTool** n8n workflow with the new URL examples.

---

## Notes for InvokeIAHelpTool

- Always use the locale prefix: `/es/` for Spanish, `/en/` for English.
- URL slugs are **case-sensitive** — use the exact values from the tables above.
- Spaces in values should be replaced with `-` (e.g., `Historia-Clinica`).
- All parameters are optional — only include what you need.
- The `act=Crear` action is the most common; use it to pre-open creation forms.
- When answering "how do I…" questions, provide both a text explanation AND a direct URL the user can click.
- **Report pages** do not support deep links beyond their base URL — always link to the page itself, never add `?t=` or `?f=` params.
- For voice navigation intent: the backend agent receives the recognized text and uses this document to generate the target URL, then returns it as `redirect` in the webhook response.
- When answering questions about reports, use the "Para qué sirve" column to explain what each report is used for.
