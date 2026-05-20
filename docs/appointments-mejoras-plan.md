# Plan de mejoras — Módulo de Citas

Fecha: 2026-05-06
Autor: Luis Rodríguez

## Objetivo

Incorporar tres mejoras al módulo de citas (frontend Next.js + backend n8n):

1. **Recordatorios internos** — eventos en el calendario que no son citas (sin paciente / doctor / servicio) y que opcionalmente generan una alerta del sistema.
2. **Gestión completa de estados** — marcar asistencia, ver y cambiar estado desde la cita, el calendario y el tab “Citas” del paciente. Hoy lo único posible es cancelar.
3. **Mejoras al panel de detalles** — hipervínculos a paciente, doctor y servicios; rediseño general más legible.

---

## 1. Estado actual del código

| Pieza | Ubicación | Lo que hace hoy |
|---|---|---|
| Tipo `Appointment` | `src/lib/types.ts:465` | status: `confirmed \| completed \| cancelled \| pending \| scheduled`. No existe `arrived` ni `no_show`. |
| Columnas de tabla | `src/app/[locale]/appointments/columns.tsx:20` | Sólo expone acciones `edit` y `cancel`. El status se muestra como `Badge` no interactivo. |
| Panel lateral | `src/components/appointments/AppointmentPanel.tsx` | Header en texto plano; tabs `info / patient / doctor / session / quote / invoices / payments`. Patient/Doctor son tabs casi vacíos que sólo abren la sub-sheet. Status como `Badge`. Botones únicos: Edit, Cancel. |
| Tab “Citas” del paciente | `src/components/users/user-appointments.tsx` | Lista con `Badge` de status. **No** ofrece cambio de estado. |
| Calendario | `src/components/calendar/Calendar.tsx`, `calendar-types.ts` | `CalendarEvent.data: any`. Los eventos se asumen citas. No hay tipo “recordatorio”. Existe `onEventContextMenu` reutilizable. |
| Sistema de alertas | `src/context/alert-notifications-context.tsx` + `API_ROUTES.SYSTEM.ALERT_INSTANCES` | Las alertas se generan en backend por reglas. La campana lee `alert_instances` con `status=PENDING`. |
| Endpoints n8n | `src/constants/routes.ts` | `APPOINTMENTS_UPSERT`, `APPOINTMENTS_UPDATE_COLOR`, `APPOINTMENTS_DELETE`, `APPOINTMENTS_AVAILABILITY`, `APPOINTMENTS`. |

---

## 2. Decisión: ¿recordatorios en tabla aparte o en `appointments` con campo `type`?

**Recomendación: tabla `reminders` separada.**

### Argumentos a favor de separar

- **No degrada constraints existentes.** Hoy `appointments` exige (al menos a nivel lógico/UX) `patient_id`, `doctor_id`, `calendar_id`, `service`. Meter recordatorios obligaría a hacer todo eso `NULLABLE` y a añadir `CHECK (type='reminder' OR patient_id IS NOT NULL)` en cada FK — más superficie para bugs silenciosos.
- **Consultas existentes no se contaminan.** El modelo de citas alimenta muchísimas vistas y agregaciones: `AppointmentAttendanceRate`, dashboards de doctor, KPIs por servicio, tab “Citas” del paciente, `quote_appointments`, vinculación con `treatment_seq_steps`, facturación, sincronización con Google Calendar. Cada una tendría que añadir `WHERE type='appointment'` o devolverá basura. Olvidar el filtro en una sola query es un bug que tarda meses en notarse.
- **Ciclo de vida totalmente distinto.** Una cita tiene status flow, asistencia, sincronización con Google Calendar, link a quote/factura, link a sesión clínica, link a treatment plan. Un recordatorio no tiene nada de eso: tiene título, fecha, hora, prioridad, color, autor. Compartir tabla acopla dos modelos que no comparten reglas.
- **Permisos más limpios.** Recordatorios pueden ser internos del staff (recepción, asistente). Permisos `REMINDER_*` separados de `APPOINTMENT_*` evitan tener que reescribir las reglas de filtrado.
- **El “problema” de tener dos endpoints es trivial.** El frontend ya hace varias llamadas en paralelo cuando carga el calendario. Mergear dos arrays para pintar eventos es una línea de código.

### Argumentos a favor de unir (y por qué no pesan tanto)

- *“Una sola tabla simplifica el calendario”* → se resuelve creando una **vista** `calendar_events` en Postgres que haga `UNION ALL` de ambas, exponiendo un endpoint `GET /calendar_events` opcional. La fuente de la verdad sigue siendo dos tablas; el frontend obtiene un solo stream si quiere. Lo mejor de los dos mundos.
- *“Menos código duplicado en CRUD”* → el CRUD es minúsculo (tabla con ~10 campos). El costo de duplicar un workflow simple es muchísimo menor que el costo de meter `nullable` en columnas core.

### Conclusión

Tabla separada `reminders` + opcional vista `calendar_events` para lectura unificada. El frontend pinta los dos en el calendario y diferencia visualmente por icono/estilo. La opción de `type` en `appointments` se descarta por costo de mantenimiento, no por preferencia estética.

---

## 3. Plan de implementación

### Fase 1 — Estados de cita end-to-end (mayor impacto, menor riesgo)

#### Frontend

1. **Ampliar union de status** en `src/lib/types.ts`:
   ```ts
   status: 'scheduled' | 'confirmed' | 'arrived' | 'in_progress'
         | 'completed' | 'no_show' | 'cancelled' | 'pending';
   ```
2. **Componente nuevo** `src/components/appointments/AppointmentStatusMenu.tsx`:
   - Recibe `appointment` y `onChange(status)`.
   - Renderiza un `DropdownMenu` con todos los estados, cada uno con icono y color.
   - Deshabilita transiciones inválidas según una constante exportada `ALLOWED_STATUS_TRANSITIONS`.
3. **Hook nuevo** `src/hooks/use-appointment-status.ts`:
   - `updateStatus(appointment, newStatus, note?)` → llama al endpoint nuevo, hace toast, dispara callback de refresh.
4. **Integrar el menú en cuatro puntos**:
   - `columns.tsx`: reemplazar la celda de status (badge actual) por `AppointmentStatusMenu` clicable.
   - `AppointmentPanel.tsx:135-137`: reemplazar `<Badge>` por el menú. Añadir botones rápidos contextuales (“Marcar llegada”, “Marcar completada”) según estado actual.
   - Calendario (`Calendar.tsx` → `onEventContextMenu`): submenú “Cambiar estado” que reusa el componente.
   - `user-appointments.tsx`: tabla y vista expandida (≈ línea 454) con el mismo menú.
5. **Permiso nuevo** `APPOINTMENT_STATUS_UPDATE` en `src/constants/permissions.ts` (separado de `APPOINTMENT_UPDATE` para que recepción pueda marcar asistencia sin poder reagendar).
6. **i18n**: añadir `arrived`, `in_progress`, `no_show` al bloque `AppointmentStatus` en `messages/{en,es}.json`.

#### Backend (n8n)

1. **Migración**: ampliar el `CHECK` de `appointments.status` (o relajar a varchar) para aceptar los nuevos valores.
2. **Tabla nueva** `appointment_status_log`:
   ```
   id, appointment_id, from_status, to_status, changed_by, changed_at, note
   ```
3. **Webhook nuevo** `POST /appointments/update_status`:
   - Body: `{ appointment_id, status, changed_by, note? }`.
   - Workflow: valida transición permitida (mismo mapa que el frontend, pero la verdad vive aquí), actualiza `appointments.status`, inserta auditoría, dispara nodos según target (`no_show` → notificar doctor, `arrived` → notificar al consultorio, etc.).
4. Decidir contigo si `APPOINTMENTS_DELETE` se mantiene (para borrado físico del evento de Google Calendar) o si toda cancelación pasa por `update_status`.
5. Añadir `APPOINTMENTS_UPDATE_STATUS` a `src/constants/routes.ts`.

### Fase 2 — Mejoras al panel de detalles (frontend puro)

Cambios localizados a `src/components/appointments/AppointmentPanel.tsx`:

- **Header** (líneas 102-111): nombre del paciente como link → abre `PatientDetailSheet`. Avatar del paciente. Chip de estado clicable (menú de Fase 1).
- **Sub-info bar nueva** bajo el título: tres chips hipervinculados con icono:
  - Doctor → `DoctorDetailSheet`.
  - Servicios → si hay 1, abre detalle directo; si hay >1, popover con lista clicable.
  - Quote → `QuoteDetailSheet`.
- **Tab Info**: convertir la `<dl>` plana en cards densas. Añadir “quick action bar” con cambios de estado más usados según estado actual. Edit/Cancel a un menú overflow.
- **Eliminar** los tabs Patient y Doctor (hoy casi vacíos, sólo abren la sub-sheet) — los chips del header ya cubren esa función.
- **Notas**: ocultar si vacío; resaltar si hay contenido.
- **Treatment plan link** (líneas 156-170): añadir botón “Ir al plan”.

Sin cambios de backend.

### Fase 3 — Recordatorios internos

#### Frontend

1. **Tipo nuevo** en `src/lib/types.ts`:
   ```ts
   export type CalendarReminder = {
     id: string;
     title: string;
     description?: string;
     date: string;        // YYYY-MM-DD
     start_time: string;  // HH:mm
     end_time?: string;
     color?: string;
     created_by: string;
     is_all_day?: boolean;
     alert_priority?: 'LOW' | 'MEDIUM' | 'HIGH';
     raise_alert?: boolean;  // si true, genera alert_instance
   };
   ```
2. **Dialog nuevo** `src/components/appointments/ReminderFormDialog.tsx` (no reutilizar `AppointmentFormDialog` — los campos divergen demasiado).
3. **Panel nuevo** `src/components/appointments/ReminderPanel.tsx` (versión simplificada de `AppointmentPanel`).
4. **FAB del calendario** (`calendar-fab.tsx`): añadir opción “Crear recordatorio” junto a “Crear cita”.
5. En `src/app/[locale]/appointments/page.tsx`:
   - Cargar recordatorios en paralelo con citas.
   - Fusionar en el array de `events` para `<Calendar>`. Marcarlos visualmente: icono `Bell`, borde punteado o color distintivo.
   - En `onEventClick`, ramificar por `kind` (`appointment` vs `reminder`).
6. **Permisos**: `REMINDER_VIEW`, `REMINDER_CREATE`, `REMINDER_UPDATE`, `REMINDER_DELETE`.
7. **i18n**: bloque nuevo `Reminders` en `messages/{en,es}.json`.

#### Backend (n8n)

1. **Tabla nueva** `reminders`:
   ```
   id, title, description, date, start_time, end_time, color,
   is_all_day, alert_priority, raise_alert, created_by, created_at
   ```
   Sin FKs a paciente/doctor/calendar.
2. **Webhooks nuevos**:
   - `GET /reminders` (filtros `from`, `to`).
   - `POST /reminders/upsert`.
   - `POST /reminders/delete`.
3. **Si `raise_alert=true`**: el workflow inserta una fila en `alert_instances` con `type='REMINDER'`, `due_at = date + start_time`, `status='PENDING'`. Reusa la cadena que alimenta la campana.
4. **Opcional**: vista Postgres `calendar_events` que haga `UNION ALL` de citas y recordatorios para servir un endpoint único `GET /calendar_events` (decidir si lo añadimos en esta fase o después).
5. Añadir grupo `REMINDERS` a `src/constants/routes.ts`.

---

## 4. Orden de entrega

1. **Fase 1** (estados) — desbloquea operación clínica diaria; bien acotado.
2. **Fase 2** (panel) — capitaliza el menú de estados; sin tocar backend.
3. **Fase 3** (recordatorios) — la pieza más grande por backend nuevo y merge en calendario.

---

## 5. Decisiones pendientes (necesito tu visto bueno)

- [ ] Lista exacta de estados y la tabla de transiciones permitidas.
- [ ] ¿`APPOINTMENTS_DELETE` se mantiene o todo pasa por `update_status`?
- [ ] ¿La vista `calendar_events` se hace en Fase 3 o queda como mejora futura?
- [ ] ¿Los recordatorios pueden ser “para todos” o tienen un campo `assigned_to` (usuarios destinatarios)?
- [ ] ¿Recordatorios recurrentes (diarios/semanales) entran en el alcance v1, o más adelante?
