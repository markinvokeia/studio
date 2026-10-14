# Órdenes de estudio — chatter (mensajes, notas y seguidores)

La orden de estudio suma un panel al estilo del chatter de Odoo. Ahí los usuarios que siguen la orden conversan sobre ella y, en el mismo hilo, ven el registro de todo lo que le pasó.

## Dónde aparece

- **Asistente de edición** (`StudyOrderWizard`, al editar una orden ya guardada): columna a la derecha, que se abre y se cierra con el botón **Chatter** de la cabecera. Desde `xl` va al lado del formulario. En pantallas más angostas se abre como cajón sobre el formulario. Cada navegador recuerda si lo dejaste abierto (`localStorage`, clave `study-order-wizard-chatter`).
- **Detalle de la orden** (`StudyOrderDetailPanel`): la pestaña **Actividad** pasa a ser el chatter. Así también se usa en órdenes enviadas, que ya no se editan. Abierto desde la ficha de un paciente o de un doctor (`readOnly`), el hilo se puede leer pero no escribir.

Componente: `src/components/study-orders/study-order-chatter.tsx`.

## Qué hace

| Acción | Quién | Efecto |
|---|---|---|
| **Enviar mensaje** | El doctor de la orden o la clínica (`STUDY_ORDERS_VIEW_ALL`), con `STUDY_ORDERS_MESSAGE` | Lo ven todos los que pueden abrir la orden. Cada seguidor recibe una notificación `study_order_message`, salvo quien lo escribió. |
| **Registrar nota** | Solo la clínica (`VIEW_ALL` + `MESSAGE`) | Es interna: el derivador no la ve y no se avisa a nadie. |
| **Seguir / Dejar de seguir** | Cualquiera que pueda escribir | Seguir = recibir un aviso por cada mensaje nuevo. |
| **Agregar / quitar seguidores** | Solo la clínica | Se puede sumar a quien puede abrir la orden: staff con `VIEW_ALL` o el doctor de la orden. Nunca al agente de WhatsApp. |

Seguidores automáticos:

- Al crear la orden se suman el doctor derivador y quien la creó.
- Cuando cambia el doctor o se asigna un responsable, se suma el nuevo. Lo hace el trigger `trg_study_order_auto_follow`.
- Quien escribe un mensaje o una nota pasa a seguir la orden.

Si alguien deja de seguir una orden, no vuelve a quedar suscrito solo.

**Registro (log):** el hilo mezcla los mensajes con la bitácora `study_order_events` (enviada, tomada, agendada, asignada…), del más nuevo al más viejo y separado por día. Al editar un borrador, el evento `updated` ahora también guarda qué campos cambiaron, al estilo del tracking de Odoo, por ejemplo **Teléfono: 099… → 098…**. Los campos que registra son:

- Paciente, documento, teléfono y email
- Sede preferida
- Doctor según la orden
- Entrega
- Notas clínicas
- Estudios agregados y estudios quitados

Las piezas, los modificadores y los textos de sección no se detallan, pero el evento igual registra que la orden se editó.

**En vivo:** cuando llega por SSE un `study_order_message` de la orden abierta, el hilo se recarga solo. Ese aviso solo les llega a los seguidores. La notificación también aparece en el panel de notificaciones (como tarjeta, o como alerta o toast según la preferencia) y lleva a la orden en la bandeja que corresponde: la de la clínica o **Mis órdenes**.

## Modos: demo, real o apagado

La variable `NEXT_PUBLIC_STUDY_ORDER_CHATTER` decide de dónde salen los datos. Se lee en runtime: alcanza con reiniciar el contenedor, sin rebuild.

| Valor | Qué pasa | Cuándo |
|---|---|---|
| `mock` (por defecto) | Demo en el navegador. No usa los endpoints nuevos ni toca la base. | Mientras no se despliegue el backend. |
| `live` | Usa los endpoints de n8n. | Después de aplicar el script 131 e importar los workflows. |
| `off` | Sin chatter: la pestaña **Actividad** muestra la línea de tiempo de antes y el asistente no tiene el botón **Chatter**. | Para mostrar la app sin la funcionalidad. |

**Qué hace la demo** (`src/services/study-order-chatter-mock.ts`):

- La bitácora, el doctor, el responsable y la lista de candidatos a seguidor son **reales**. Salen de `study-orders/detail` y `study-orders/assignees`, que ya están desplegados.
- Mensajes, notas y seguidores se guardan en el `localStorage` del navegador, una clave por orden (`study-order-chatter-demo:v1:<id>`).
  - Sobreviven a recargar la página y a cambiar de usuario. Así se puede mostrar la conversación: entrar como doctor, escribir, salir y entrar como la clínica.
  - Nadie más los ve y no llegan a la base.
- La primera vez que se abre una orden, el hilo arranca con un mensaje del doctor y una nota interna de ejemplo. Los seguidores iniciales son el doctor y el responsable, como hace el trigger.
- Aplica las mismas reglas que el SQL:
  - las notas solo las ve la clínica;
  - el doctor solo escribe en sus órdenes;
  - solo la clínica suma o quita seguidores;
  - quien escribe pasa a seguir la orden.

  Como el permiso `STUDY_ORDERS_MESSAGE` todavía no existe, alcanza con `STUDY_ORDERS_VIEW_MINE` o `VIEW_ALL`.
- Una franja ámbar avisa que son datos de prueba. Su botón **Reiniciar** borra los datos de esa orden y la vuelve a sembrar.
- Lo escrito en otra pestaña del mismo navegador aparece solo, por el evento `storage`.
- Lo que **no** muestra la demo:
  - las notificaciones a los seguidores, que necesitan el backend;
  - el detalle "anterior → nuevo" de las ediciones, que lo graba el upsert nuevo.

## Despliegue

1. **Base de datos:** aplicar `database/scripts/131_20261014_study-order-chatter.sql`. Es idempotente y hace lo siguiente:
   - Crea `study_order_followers` (PK orden + usuario) y `study_order_messages` (`kind` = `message` o `note`, texto de 1 a 5000 caracteres). Las dos tablas se borran en cascada con la orden.
   - Crea la función y el trigger `study_order_auto_follow`, y hace el backfill de seguidores de las órdenes existentes: doctor, creador y responsable, sin inactivos ni el usuario `agente_ia`.
   - Crea el permiso `STUDY_ORDERS_MESSAGE` y se lo da a los roles que ya tienen `STUDY_ORDERS_VIEW_MINE` o `STUDY_ORDERS_VIEW_ALL`, menos `agente_ia`.
   - Amplía el CHECK de `notifications.type` con `study_order_message`.

   Los permisos se leen al cargar la página: después de aplicar el script alcanza con recargar.
2. **n8n:** importar los cuatro workflows nuevos:
   - `study-orders-chatter.json`
   - `study-orders-message-post.json`
   - `study-orders-followers.json`
   - `study-orders-follower-candidates.json`

   También hay que importar el regenerado `study-orders-upsert.json`, que ahora guarda los cambios de campos en el evento `updated` y llena `updated_by`. Todos salen de `node scripts/n8n/generate-study-order-workflows.mjs`, con el SQL en `scripts/n8n/study-orders-sql.mjs`. Hay que editar el generador, no los JSON. El aviso a los seguidores usa el mismo sub-workflow **Events** (SSE) que el resto de los avisos de órdenes.
3. **Frontend:** poner `NEXT_PUBLIC_STUDY_ORDER_CHATTER=live` y reiniciar. Los mensajes de la demo quedan en el navegador y no se migran.

## Endpoints nuevos

| Método y ruta | Body / query | Respuesta |
|---|---|---|
| `GET /study-orders/chatter?id=` | — | `{ order_id, is_following, can_post_message, can_post_note, can_manage_followers, followers[], messages[], events[] }`. Misma regla de acceso que el detalle (404 sin acceso). |
| `POST /study-orders/messages/post` | `{ order_id, kind: 'message' \| 'note', body }` | El mensaje creado. Avisa a los seguidores (solo `message`). |
| `POST /study-orders/followers` | `{ order_id, action: 'follow' \| 'unfollow' \| 'add' \| 'remove', user_id? }` | `{ followers[], is_following }` |
| `GET /study-orders/followers/candidates?id=` | — | Usuarios que se pueden sumar como seguidores. |

## Fuera de alcance (posibles siguientes pasos)

- Adjuntos en los mensajes (el clip de Odoo).
- Menciones con `@` que avisen al mencionado aunque no siga la orden.
- Editar o borrar un mensaje propio.
- "Actividades planificadas" (tareas con vencimiento, la sección *Planned Activities* de Odoo).
