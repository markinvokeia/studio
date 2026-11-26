# Órdenes de estudio — vista "Estados" (tablero) y asignación

La bandeja de órdenes de estudio suma una segunda vista, **Estados**: un tablero con una columna por estado de la orden, en el orden en que avanza. Recepción ve las órdenes agrupadas, las mueve arrastrándolas y las asigna a un responsable para que las revise.

## Los nueve estados

`Borrador → Confirmada → Agenda pendiente → Agendada → Paciente presente → En ejecución → Estudio completado → Entregada`, más `Cancelada`.

Se guardan en `study_orders.status` (migración 179). `board_status` es el mismo valor. Cada columna muestra su total. Las tarjetas por columna se eligen en la barra (10, 25, 50 o 100), y "Cargar más" trae las siguientes. La columna Cancelada arranca plegada; el plegado se recuerda por navegador.

| Desde | Puede pasar a |
|---|---|
| Borrador | Confirmada, Cancelada |
| Confirmada | Agenda pendiente, Agendada, Cancelada |
| Agenda pendiente | Agendada, Cancelada |
| Agendada | Paciente presente, Agenda pendiente, Cancelada |
| Paciente presente | En ejecución, Agendada, Agenda pendiente, Cancelada |
| En ejecución | Estudio completado, Paciente presente, Agenda pendiente |
| Estudio completado | Entregada, En ejecución, Agenda pendiente |
| Entregada, Cancelada | finales |

- **Toda orden nace en Borrador** (RF-04) y la clínica ve todos los borradores para revisarlos y confirmarlos. Confirmar es siempre un paso aparte.
- **Única definición:** la función `study_order_transition_allowed(from, to)`. Un trigger rechaza cualquier otro cambio (`SO409`); la API responde 409.
- **Las citas mandan** de Agendada a Estudio completado: `study_order_sync` recalcula cuando cambia una cita. Si la cita saltea pasos, el historial los registra con `automatic: true`. Una inasistencia no cancela: vuelve a Agenda pendiente.
- **Historial:** cada cambio deja un evento `status_changed` en `study_order_events` con `from`, `to` y quién lo hizo. Se ve en la pestaña Orden (pasos) y en la actividad.
- **Tomar** (`acknowledge`) ya no cambia el estado.

## Línea de etapas

La pestaña Orden muestra las ocho etapas en una línea; la cabecera del detalle, un botón con el **siguiente paso**. El desplegable de al lado trae las alternativas y volver atrás. De Agendada en adelante el botón cambia el estado de la **cita** (`APPOINTMENTS_UPDATE`) y la orden la sigue; si la cita no es de hoy, pide confirmación.

## Arrastrar y soltar = la acción real

Soltar una tarjeta dispara la misma acción que el menú Acciones, con sus confirmaciones y permisos.

| De → a | Acción | Permiso |
|---|---|---|
| Borrador → Confirmada | Confirmar (pide confirmación) | `STUDY_ORDERS_SUBMIT` |
| Confirmada → Agenda pendiente | Pasar a agenda pendiente | `STUDY_ORDERS_SCHEDULE` o `STUDY_ORDERS_ACKNOWLEDGE` |
| Confirmada / Agenda pendiente → Agendada | Abre el agendado en la agenda | `STUDY_ORDERS_SCHEDULE` |
| Estudio completado → Entregada | Entregar (pide confirmación) | `STUDY_ORDERS_DELIVER` |
| Confirmada … Paciente presente → Cancelada | Anular (pide motivo) | `STUDY_ORDERS_CANCEL` (el derivador, solo si nadie la tomó) |

**Paciente presente**, **En ejecución** y **Estudio completado** no aceptan tarjetas: se llenan solas con las citas. Mientras se arrastra, las columnas válidas se resaltan; si se suelta donde no corresponde, un aviso explica por qué.

Accesible con teclado: barra espaciadora para tomar y soltar, flechas para mover, Escape cancela y Enter abre la orden. En pantallas táctiles se arrastra con una pulsación larga.

Cada tarjeta tiene un botón **Ver resumen** (ícono de ojo) con los datos principales de la orden. El clic en la tarjeta abre el detalle a pantalla completa.

## Asignación

- Se asigna quién **revisa** la orden, y se muestra como **Revisada por: …**. Solo se puede asignar a **staff**: usuarios activos con rol recepcionista, gerente o administrador, el mismo criterio que `get_users_filtered(p_only_staff)`.
- Se asigna con la acción **Asignar**, que está en las acciones de la fila de la lista, en la tarjeta del Dashboard de Estados (en "Revisada por" o "Asignar"), en su resumen y en el menú Acciones del detalle. Hace falta el permiso nuevo `STUDY_ORDERS_ASSIGN`.
- El responsable recibe la notificación `study_order_assigned`, salvo que se la haya asignado él mismo.
- Queda en la línea de tiempo como evento `assigned` o `unassigned`, con quién la tenía antes.
- Filtro **Responsable** (todos, asignadas a mí, sin asignar) en la lista y en el tablero. También se puede abrir con `?assigned=me`.

## Despliegue

1. **Base de datos:** aplicar `database/scripts/129_20261013_study-order-assignment.sql`. Es idempotente y hace lo siguiente:
   - Agrega `study_orders.assigned_to`, `assigned_at` y `assigned_by`, con su índice.
   - Suma los eventos `assigned` y `unassigned` al CHECK de `study_order_events`.
   - Crea el permiso `STUDY_ORDERS_ASSIGN` y se lo da a los roles que ya tienen `STUDY_ORDERS_ACKNOWLEDGE`.
   - Amplía el CHECK de `notifications.type` con `study_order_assigned`.
   Después aplicar `database/scripts/130_20261013_study-order-assign-staff-roles.sql`, que le da `STUDY_ORDERS_ASSIGN` (y la bandeja de la clínica) a los roles recepcionista, gerente y administrador buscándolos por nombre. Los permisos se leen al cargar la página: después de aplicarla alcanza con recargar.
2. **n8n:** importar los workflows nuevos `study-orders-board.json`, `study-orders-assign.json` y `study-orders-assignees.json`, y los regenerados `study-orders-list.json` y `study-orders-detail.json`. Los cinco salen de `node scripts/n8n/generate-study-order-workflows.mjs` (SQL en `scripts/n8n/study-orders-sql.mjs`). Hay que editar el generador, no los JSON.
3. **Frontend:** nada extra. Usa la dependencia nueva `@dnd-kit/core`.

Endpoints nuevos: `GET /study-orders/board`, `POST /study-orders/assign` y `GET /study-orders/assignees`. `GET /study-orders` acepta `assigned=me|none|<uuid>`, y la lista y el detalle devuelven `assigned_to`, `assigned_to_name` y `assigned_at`.

### Nueve estados (C02.1)

1. Aplicar `database/scripts/179_20261125_study-order-nine-states.sql` (después de la 132).
2. Importar todos los `n8n-workflows/study-orders-*.json` (incluye el nuevo `study-orders-status.json`) y `docs/n8n-flows/All Appointment Workflows.json`.
3. Publicar el frontend. Los tres pasos van juntos.
4. Aplicar `database/scripts/180_20261126_study-orders-clinic-time.sql`. Pasa a hora de la clínica las fechas automáticas del módulo (`created_at`/`updated_at`). Donde nunca corrió la 077, corrige además las fechas ya guardadas en UTC. Sin la 180, en la Actividad «Se creó la orden» y «Se agendó una cita» aparecen tres horas después de los cambios de estado. **No correr la 077 a esta altura**: recrea la vista del tablero con los estados viejos.

«All Appointment Workflows» fija `settings.timezone = America/Montevideo`. Sin eso, `$now` sale con la zona de la instancia de n8n y la hora de creación de citas y notificaciones queda corrida.

Los flujos del agente de WhatsApp todavía usan el estado `submitted`: no activarlos hasta adaptarlos.

### Orden manual con frente y dorso (C09.1a)

- **Requisitos de la orden que carga la clínica:** paciente con ficha, sede y frente desde el borrador. Estudios y odontólogo pueden quedar para después; se exigen al confirmar (o se acepta confirmar sin odontólogo). No aplica a las órdenes de WhatsApp, importadas o cargadas por el odontólogo para sí mismo.
- **Imágenes:** `attachments` con `source_name` `study_order_front` / `study_order_back` y `source_id` = la orden. Solo se cambian en Borrador; cada cambio deja un evento `updated` en la actividad. Generador: `scripts/n8n/generate-study-order-image-workflows.mjs`.
- **Ficha del paciente:** pestaña Órdenes de estudio. Los borradores los ve quien tiene `STUDY_ORDERS_VIEW_ALL` o el odontólogo de la orden, y desde ahí se pueden editar.
- **Despliegue, sin migración:** importar los nuevos `study-orders-image-upload`, `-image-delete` y `-image-file`, reimportar `study-orders-list`, `-board`, `-detail`, `-upsert` y `-submit`, y publicar el frontend.
