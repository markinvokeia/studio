# Plan — Razones de cancelación + Reagendar

Fecha: 2026-05-08
Autor: Luis Rodríguez

## Objetivo

Refinar el estado **cancelled** para conocer **bajo qué circunstancia** se canceló la cita, y añadir una acción nueva **Reagendar** que cancela la cita actual y crea una nueva en una sola transacción del backend.

### Razones de cancelación

- **Cancelado tarde** (`late`)
- **Cancelado con tiempo** (`in_time`)
- **Cancelado sin aviso** (`no_notice`)
- **Cancelado por el doctor** (`by_doctor`)
- **Cancelado por la clínica** (`by_clinic`)
- **Otro motivo** (`other`) — abre un campo de texto opcional para capturar la causa concreta. Sólo aparece este input cuando el usuario elige "Otro"; los 5 motivos rápidos no requieren escribir nada (un solo click).
- **Cancelado** (`reschedule`) — reservado para el flujo de reagendar; el frontend nunca lo expone como opción manual.

---

## 1. Decisión de modelo: status + reason vs split del enum

**Recomendación: mantener un único status `cancelled` y añadir una columna `cancellation_reason`.**

### Por qué

- El status sigue siendo una pequeña enumeración del ciclo de vida. Las razones son metadata; pueden crecer sin obligarte a tocar el `CHECK` del enum cada vez.
- Reportes y filtros simples: "todas las canceladas" = `WHERE status='cancelled'`. Si fueran 6 status, cada query tendría que listar 6 valores con `IN(...)` y olvidar uno = bug silencioso.
- El frontend ya tiene un `AppointmentStatus` union pequeño y un mapa de transiciones manejable. Dividirlo en 6 estados de cancelación dispara la complejidad sin aportar nada.
- La razón `reschedule` queda automática: la pone el backend cuando entra por el endpoint de reagendar, nunca el usuario.

### Consecuencias

- `appointments.cancellation_reason` es un `VARCHAR` **sin CHECK de dominio** ni de coherencia. La validación de valores y de la regla "si está cancelada debe tener razón" vive sólo en frontend + workflow de n8n. Esto evita romper datos legacy y deja flexibilidad para añadir motivos sin migrar la BD.
- Por convención: `NULL` cuando `status <> 'cancelled'`. Cuando `status = 'cancelled'` el frontend siempre exige razón, pero la BD acepta `NULL` (filas legacy de antes del cambio).

---

## 2. Cambios de base de datos (PostgreSQL — sin Liquibase)

> Nota: como pediste, no actualizo Liquibase. Cuando hagas el siguiente `db:snapshot`, Liquibase capturará estos cambios automáticamente — o puedes meterlos a mano en un changelog cuando estabilice. Hasta entonces, ejecuta este SQL directo en cada entorno.

```sql
-- =====================================================================
-- Appointments: cancellation reason + reschedule audit
-- Run on: dev / staging / prod
-- =====================================================================

BEGIN;

-- 1. Columna de razón de cancelación (texto libre, sin CHECK de dominio).
--    La lista de valores válidos vive sólo en frontend + workflow n8n.
ALTER TABLE appointments
    ADD COLUMN IF NOT EXISTS cancellation_reason VARCHAR(20);

-- 2. Texto libre asociado al motivo. Se llena cuando el motivo es "other";
--    en los motivos rápidos queda NULL.
ALTER TABLE appointments
    ADD COLUMN IF NOT EXISTS cancellation_note TEXT;

-- 3. (Sin CHECK de coherencia ni de dominio) — intencionalmente no se exige
--    "status='cancelled' ⇒ cancellation_reason IS NOT NULL" para no
--    invalidar filas legacy. La obligatoriedad la enforza la UI/backend.
--    No se hace backfill; las filas canceladas previas quedan con NULL.

-- 4. Log de estados: capturar también la razón y el texto libre.
--    No se persisten links entre la cita reagendada y la nueva — basta con
--    que la vieja quede `cancelled` con `cancellation_reason='reschedule'`.
ALTER TABLE appointment_status_log
    ADD COLUMN IF NOT EXISTS cancellation_reason VARCHAR(20),
    ADD COLUMN IF NOT EXISTS cancellation_note   TEXT;

COMMIT;
```

### Rollback (si algo va mal)

```sql
BEGIN;
ALTER TABLE appointment_status_log DROP COLUMN IF EXISTS cancellation_note;
ALTER TABLE appointment_status_log DROP COLUMN IF EXISTS cancellation_reason;
ALTER TABLE appointments DROP COLUMN IF EXISTS cancellation_note;
ALTER TABLE appointments DROP COLUMN IF EXISTS cancellation_reason;
COMMIT;
```

---

## 3. Cambios en n8n

### 3.1 Actualizar `flow-appointment-update-status.json`

El workflow que ya existe (creado en la fase anterior) debe aceptar `cancellation_reason` cuando el target es `cancelled`.

**Cambios concretos:**

1. **Node `Parse Input`** (sección JS):
   - Añadir `cancellation_reason` y `cancellation_note` al destructuring del body.
   - Validar `cancellation_reason` contra la lista cerrada `['late','in_time','no_notice','by_doctor','by_clinic','other']` (sin `reschedule`, ese sólo lo pone el workflow de reagendar; si llega aquí → 400).
   - **Si `status === 'cancelled'` y no hay `cancellation_reason`** → 400 (motivo requerido).
   - **Si `cancellation_reason === 'other'` y `cancellation_note` está vacío/blanco** → 400 (texto requerido cuando es "Otro").
   - **Si `cancellation_reason !== 'other'`** → forzar `cancellation_note = null` antes de guardar (no permitir basura colgante).
   - **Si `status !== 'cancelled'`** → forzar `cancellation_reason = null` y `cancellation_note = null`.

2. **Node `Apply Update + Log`** (SQL):
   - Cambiar el `UPDATE` para set también `cancellation_reason` y `cancellation_note`:
     ```sql
     UPDATE appointments
     SET status              = '{{ $json.to_status }}',
         cancellation_reason = NULLIF('{{ $json.cancellation_reason }}', ''),
         cancellation_note   = NULLIF('{{ $json.cancellation_note }}', ''),
         updated_at          = NOW()
     WHERE id::text = '{{ $json.appointment_id }}'
     ```
   - El `INSERT` en `appointment_status_log` debe incluir `cancellation_reason` y `cancellation_note`.

3. **Contrato del request** (lo que envía el frontend):
   ```json
   // Caso 1 — motivo rápido (sin texto)
   {
     "appointment_id": "abc-123",
     "status": "cancelled",
     "cancellation_reason": "by_doctor"
   }

   // Caso 2 — motivo "Otro" con texto libre
   {
     "appointment_id": "abc-123",
     "status": "cancelled",
     "cancellation_reason": "other",
     "cancellation_note": "Paciente viajó de emergencia"
   }
   ```

### 3.2 Workflow nuevo: `flow-appointment-reschedule.json`

Endpoint nuevo: `POST /webhook/appointments/reschedule`.

**Body que envía el frontend:**

```json
{
  "original_appointment_id": "abc-123",
  "patient_id": "pid",
  "doctor_id": "did",
  "calendar_source_id": "cs-id",
  "service_ids": ["svc1", "svc2"],
  "summary": "Limpieza dental",
  "description": "...",
  "notes": "...",
  "start_time": "2026-05-12T10:00:00",
  "end_time":   "2026-05-12T10:30:00",
  "color_id": "9",
  "changed_by": "user-id",
  "note": "Cliente pidió cambiar al jueves"
}
```

**Pipeline (mismo patrón que los demás):**

1. **Webhook** POST `/appointments/reschedule`.
2. **Parse Input** — valida shape, exige `original_appointment_id` y los campos mínimos para crear la nueva cita.
3. **Load Original** — `SELECT id, status FROM appointments WHERE id = $orig`. Si no existe → 404. Si ya está `cancelled` → 409 (`Cannot reschedule a cancelled appointment`). Si está `completed` → 409.
4. **Apply Reschedule (transacción única en un solo nodo Postgres)**:
   ```sql
   WITH new_appt AS (
     INSERT INTO appointments (
       id, patient_id, doctor_id, calendar_source_id, summary,
       description, notes, start_time, end_time, color_id,
       status, created_at, updated_at
     ) VALUES (
       gen_random_uuid()::text,  -- o el método que uses para IDs
       $patient_id, $doctor_id, $calendar_source_id, $summary,
       $description, $notes, $start_time, $end_time, $color_id,
       'scheduled', NOW(), NOW()
     )
     RETURNING id
   ),
   cancelled_orig AS (
     UPDATE appointments
     SET status = 'cancelled',
         cancellation_reason = 'reschedule',
         updated_at = NOW()
     WHERE id = $original_appointment_id
     RETURNING id
   ),
   log_old AS (
     INSERT INTO appointment_status_log
       (appointment_id, from_status, to_status, cancellation_reason, changed_by, note)
     SELECT id, 'scheduled', 'cancelled', 'reschedule', $changed_by, 'Reagendada'
     FROM cancelled_orig
   ),
   log_new AS (
     INSERT INTO appointment_status_log
       (appointment_id, from_status, to_status, changed_by, note)
     SELECT id, NULL, 'scheduled', $changed_by, 'Creada por reagendamiento'
     FROM new_appt
   ),
   service_links AS (
     INSERT INTO appointment_services (appointment_id, service_id)
     SELECT (SELECT id FROM new_appt), unnest($service_ids::text[])
   )
   SELECT id FROM new_appt;
   ```
   *(Ajustar al esquema real de la tabla `appointments` y a cómo se vinculan servicios — la query anterior es esquemática.)*
5. **Fetch New Appointment** — recargar la cita nueva con joins (doctor name, calendar name, services, etc.) para devolverla al frontend con el shape que ya espera.
6. **Build Response** → `{ success: true, code: 200, original_appointment_id, new_appointment: { ...full Appointment } }`.
7. **Respond 200**.

**Side-effects** — igual que en Fase 1: ninguno por ahora. No se toca Google Calendar, no se notifica.

---

## 4. Cambios en frontend

### 4.1 Types & constantes

**`src/lib/types.ts`:**

```ts
export type CancellationReason =
  | 'late'
  | 'in_time'
  | 'no_notice'
  | 'by_doctor'
  | 'by_clinic'
  | 'other'
  | 'reschedule';

export type Appointment = {
  // ... existente
  cancellation_reason?: CancellationReason | null;
  cancellation_note?: string | null;
};
```

**`src/constants/appointment-status.ts`:**

```ts
// Motivos seleccionables manualmente desde la UI (en orden de aparición).
// 'reschedule' lo pone el backend cuando el usuario hace Reagendar; nunca se elige.
export const CANCELLATION_REASONS_QUICK: CancellationReason[] = [
  'late', 'in_time', 'no_notice', 'by_doctor', 'by_clinic',
];

export const CANCELLATION_REASON_OTHER: CancellationReason = 'other';

export const CANCELLATION_REASON_ICON: Record<CancellationReason, LucideIcon> = { ... };
```

**`src/constants/routes.ts`:**

```ts
APPOINTMENTS_RESCHEDULE: '/appointments/reschedule',
```

### 4.2 i18n

**`src/messages/{en,es}.json`** — bloque nuevo `CancellationReason`:

```json
"CancellationReason": {
  "late": "Cancelada tarde",
  "in_time": "Cancelada con tiempo",
  "no_notice": "Cancelada sin aviso",
  "by_doctor": "Cancelada por el doctor",
  "by_clinic": "Cancelada por la clínica",
  "other": "Otro motivo",
  "reschedule": "Reagendada"
},
"CancellationDialog": {
  "title": "Motivo de la cancelación",
  "description": "Describe brevemente por qué se cancela la cita.",
  "placeholder": "Escribe el motivo…",
  "save": "Cancelar cita",
  "cancel": "Volver"
}
```

Y en `AppointmentsPage.contextMenu` añadir `"reschedule": "Reagendar"` y los toasts de éxito/error.

### 4.3 `AppointmentStatusMenu` — flujo de cancelación rápido

UX clave: **un solo click** para los 5 motivos rápidos. El input de texto sólo aparece si el usuario elige "Otro motivo".

- En el dropdown del badge de status, "Cancelar" pasa a ser un `DropdownMenuSub`.
- `DropdownMenuSubContent` lista:
  1. **Cancelada tarde** (click → cancela con `late`, sin diálogo)
  2. **Cancelada con tiempo** (click → cancela con `in_time`)
  3. **Cancelada sin aviso** (click → cancela con `no_notice`)
  4. **Cancelada por el doctor** (click → cancela con `by_doctor`)
  5. **Cancelada por la clínica** (click → cancela con `by_clinic`)
  6. `<separator>`
  7. **Otro motivo…** (click → abre `CancellationNoteDialog` con un textarea; al confirmar cancela con `other` + texto)

- Al elegir uno de los 5 rápidos: `onChange('cancelled', { cancellation_reason: 'late' | ... })` directo, sin dialog.
- Al elegir "Otro motivo…": el dropdown se cierra y se abre el dialog. Si el usuario confirma → `onChange('cancelled', { cancellation_reason: 'other', cancellation_note: text })`. Si cancela el dialog → no pasa nada.

Misma estructura en `AppointmentStatusContextItems` (calendario): `ContextMenuSub` con los mismos 6 items + separador. El "Otro motivo…" abre el mismo dialog reutilizado.

**Componente nuevo `CancellationNoteDialog`** (`src/components/appointments/CancellationNoteDialog.tsx`):
- Sheet/Dialog mínimo con `<Textarea>` requerido (validación inline: vacío bloquea el botón).
- Botones: "Cancelar" (vuelve sin acción) / "Cancelar cita" (confirma).
- Se monta a nivel de página (`AppointmentsPage`) y de `user-appointments`, controlado por estado local.

### 4.4 Hook `useAppointmentStatus`

Extender la firma:

```ts
updateStatus({
  appointment,
  newStatus,
  cancellation_reason?,  // requerido si newStatus === 'cancelled'
  cancellation_note?,    // requerido si cancellation_reason === 'other'
  note?,                 // nota libre genérica para el log (independiente de la cancelación)
});
```

Validar en el cliente como guard defensivo:
- Si `newStatus === 'cancelled'` y no hay `cancellation_reason` → no llamar al backend.
- Si `cancellation_reason === 'other'` y no hay `cancellation_note` (trim vacío) → no llamar al backend.

### 4.5 Hook nuevo `useAppointmentReschedule`

```ts
reschedule(originalAppointment: Appointment, newAppointmentData: AppointmentFormValues): Promise<Appointment | null>
```

- POST a `APPOINTMENTS_RESCHEDULE`.
- En `onSuccess`: refrescar lista, hacer toast `Cita reagendada`.
- Devuelve la nueva cita (con id nuevo) para que la UI haga foco/abra el panel sobre ella.

### 4.6 Acción "Reagendar" en cuatro puntos

Mismo patrón que los cambios de status:

1. **`AppointmentPanel.tsx`** — botón "Reagendar" junto a Edit y Cancel. Al hacer click abre el `AppointmentFormDialog` en modo `reschedule`.
2. **`columns.tsx`** (tabla principal de citas) — añadir botón con icono `CalendarSync`.
3. **`page.tsx` → `renderEventContextMenu`** (calendario) — añadir `<ContextMenuItem>` "Reagendar".
4. **`user-appointments.tsx`** — botón en la tabla y en el panel expandido.

### 4.7 `AppointmentFormDialog`

El formulario ya existe para crear/editar. Añadir un modo `reschedule`:

- Prop nueva `mode?: 'create' | 'edit' | 'reschedule'`.
- Cuando `mode='reschedule'`:
  - El título cambia a "Reagendar cita" + sub-título mostrando la fecha/hora original.
  - El botón de submit dice "Reagendar" en lugar de "Guardar".
  - Al submit, en vez de llamar al `upsert` habitual, llama a `useAppointmentReschedule.reschedule()`.
  - Por defecto pre-rellena los campos con los valores de la cita original (igual que edit), pero el `id` no se reutiliza.

**Validación de elegibilidad antes de abrir el formulario:**
Reagendar sólo se permite cuando `status` es uno de: `pending | scheduled | confirmed | arrived | in_progress`. Para `completed | cancelled | no_show` el botón "Reagendar" se muestra deshabilitado con tooltip explicativo. Esta misma lista vive en una constante `RESCHEDULABLE_STATUSES` exportada desde `appointment-status.ts`. El backend revalida.

### 4.8 Visual indicators

- En el calendario, una cita cancelada se sigue mostrando con el patrón rayado gris (no cambia). Si la razón es `reschedule`, opcionalmente podemos añadir un icono pequeño de "↗" para indicar "reagendada" — pero **dejémoslo fuera de v1** para no escalar el scope.
- En `AppointmentPanel`, cuando `appointment.status === 'cancelled'`:
  - Mostrar el badge con `CancellationReason` debajo del status.
  - Si la razón es `reschedule`, mostrar un texto neutro tipo "Cita reagendada" sin link (no se persiste el id de la nueva cita).
- En la tabla, columna nueva o tooltip sobre el badge mostrando la razón.

### 4.9 Permisos

- **Reagendar usa `APPOINTMENT_UPDATE`** (mismo permiso que editar). No se crea uno nuevo.
- Las razones de cancelación **no tienen restricciones por rol** — cualquier usuario con `APPOINTMENT_STATUS_UPDATE` puede elegir cualquiera de los 6 motivos (incluyendo "Otro").

---

## 5. Orden de entrega sugerido

1. **DB**: ejecutar el SQL de la sección 2 en dev → verificar con `\d appointments` que las columnas/CHECKs están.
2. **Backend**: actualizar `flow-appointment-update-status.json` con el manejo de `cancellation_reason`. Crear y desplegar `flow-appointment-reschedule.json`. Probar ambos con `curl`.
3. **Frontend types/i18n**: añadir tipos, constantes y traducciones (sin tocar UI todavía — se compila aislado).
4. **Frontend status menu**: convertir "Cancelled" en submenu con motivos. Validar que tabla, panel, calendario y user-appointments siguen funcionando.
5. **Frontend reschedule**: hook + integración del modo `reschedule` en `AppointmentFormDialog` + botones en los cuatro puntos de UI.
6. **Frontend visual**: razón en panel + links a la cita opuesta cuando hay reagendamiento.

Cada paso es testable en aislamiento.

---

## 6. Decisiones

### Resueltas
- [x] **Cancelar es de un solo click** — los 5 motivos rápidos no piden texto. Se añade un 6º motivo `other` que sí abre un dialog con textarea cuando se elige.
- [x] **Reagendar usa el permiso `APPOINTMENT_UPDATE`** (mismo que editar). Sin permiso nuevo.
- [x] **Sin restricciones por rol** al elegir motivo de cancelación.
- [x] **Reagendar bloqueado para estados terminales** (`completed`, `cancelled`, `no_show`). Permitido en `pending | scheduled | confirmed | arrived | in_progress`.
- [x] **Sin side-effects** en v1 (no Google Calendar, no notificaciones).
- [x] **`cancellation_reason` como `VARCHAR(20)` sin CHECK** — sin enum ni constraint de dominio en BD; la validación vive en frontend + workflow n8n. Filas legacy canceladas quedan con `NULL`.

---

## 7. Diff de archivos previstos

**Nuevos**
- `src/hooks/use-appointment-reschedule.ts`
- `src/components/appointments/CancellationNoteDialog.tsx`
- `docs/n8n-flows/flow-appointment-reschedule.json`

**Modificados**
- `src/lib/types.ts` (CancellationReason + columnas nuevas en Appointment)
- `src/constants/appointment-status.ts` (CANCELLATION_REASONS, mapas)
- `src/constants/routes.ts` (APPOINTMENTS_RESCHEDULE)
- `src/constants/permissions.ts` (APPOINTMENT_RESCHEDULE, opcional)
- `src/messages/{en,es}.json` (bloque CancellationReason + textos)
- `src/components/appointments/AppointmentStatusMenu.tsx` (submenú de motivos)
- `src/components/appointments/AppointmentPanel.tsx` (botón Reagendar + visual de razón + links a cita opuesta)
- `src/components/appointments/AppointmentFormDialog.tsx` (modo `reschedule`)
- `src/app/[locale]/appointments/columns.tsx` (acción Reagendar)
- `src/app/[locale]/appointments/page.tsx` (handler reschedule + item del context menu)
- `src/components/users/user-appointments.tsx` (Reagendar)
- `src/hooks/use-appointment-status.ts` (forward `cancellation_reason`)
- `docs/n8n-flows/flow-appointment-update-status.json` (aceptar `cancellation_reason`)
