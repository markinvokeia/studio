# Órdenes de estudio — vista "Estados" (tablero) y asignación

La bandeja de órdenes de estudio suma una segunda vista, **Estados**: un tablero con una columna por estado de la orden, en el orden en que avanza. Recepción ve las órdenes agrupadas, las mueve arrastrándolas y las asigna a un responsable para que las revise.

## Columnas

`Borrador → Nueva → Sin agendar → Parcial → Agendada → En curso → Completada → Anulada`

Es el `board_status` **derivado** de `v_study_orders_board`: las citas mandan, no `study_orders.status`. Cada columna muestra su total. Las tarjetas por columna se eligen en la barra (10, 25, 50 o 100), y "Cargar más" trae las siguientes. La columna Anulada arranca plegada; el plegado se recuerda por navegador.

## Arrastrar y soltar = la acción real

Soltar una tarjeta no escribe un estado: dispara la misma acción que el menú Acciones, con sus confirmaciones y permisos.

| De → a | Acción | Permiso |
|---|---|---|
| Borrador → Nueva | Enviar (pide confirmación) | `STUDY_ORDERS_SUBMIT` |
| Nueva → Sin agendar | Tomar | `STUDY_ORDERS_ACKNOWLEDGE` |
| Nueva / Sin agendar / Parcial → Parcial / Agendada | Abre el agendado en la agenda | `STUDY_ORDERS_SCHEDULE` |
| Enviada (cualquier estado) → Anulada | Anular (pide motivo) | `STUDY_ORDERS_CANCEL` (el derivador, solo si nadie la tomó) |

**En curso** y **Completada** no aceptan tarjetas: se llenan solas cuando se atienden las citas. Tampoco se puede volver a un estado anterior. Mientras se arrastra, las columnas válidas se resaltan y las demás se atenúan; si se suelta donde no corresponde, un aviso explica por qué.

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
