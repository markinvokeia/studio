#!/usr/bin/env node
/**
 * generate-study-order-workflows.mjs
 * ---------------------------------------------------------------------------
 * Genera los workflows n8n de órdenes de estudio en n8n-workflows/, uno por
 * endpoint, listos para importar.
 *
 * Escribirlos a mano serían ocho JSON de ~200 líneas con la misma estructura
 * repetida; generarlos garantiza que el webhook, la autenticación, el manejo de
 * errores y el sobre de respuesta sean idénticos en todos.
 *
 * Anatomía de cada flujo (la del repo, ver n8n-workflows/dashboard/):
 *   webhook (jwtAuth) → code "Validar Datos" → postgres → code "Formatear" → respond
 *
 * Sobre de respuesta, único para todo lo nuevo:
 *   { code: 200, message: 'OK', data: <payload>, meta?: { total, page, limit } }
 *
 *   node scripts/n8n/generate-study-order-workflows.mjs
 * ---------------------------------------------------------------------------
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    ACKNOWLEDGE_SQL, CANCEL_SQL, DELETE_SQL, DETAIL_SQL,
    BY_APPOINTMENT_SQL, LINK_APPOINTMENT_SQL, LIST_SQL, NOTIFY_DOCTOR_SQL, NOTIFY_RECEPTION_SQL, OPTIONS_SQL,
    APPOINTMENT_TECHNICIANS_SQL, ASSIGN_TECHNICIAN_SQL, BOOKING_TOKEN_SQL, LOG_EVENT_SQL, TECHNICIAN_TASKS_SQL, PUBLIC_BOOK_SQL, PUBLIC_DETAIL_SQL, RECONCILE_SQL,
    RECOMPUTE_SQL, RESCHEDULE_SQL, SUBMIT_SQL, UPSERT_SQL,
} from './study-orders-sql.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT_DIR = join(ROOT, 'n8n-workflows');

const JWT_CREDENTIAL = { jwtAuth: { id: 'C6sB1r7ab5H5EmJj', name: 'JWT Auth account' } };
const PG_CREDENTIAL  = { postgres: { id: 'POSTGRES_CREDENTIAL_ID', name: 'Postgres' } };

/**
 * Nodo webhook. `authentication: jwtAuth` hace que n8n verifique la firma.
 *
 * Los flujos `_noauth` van sin credencial a propósito: el paciente llega con el
 * link y no tiene cuenta. Lo que hace de autenticación ahí es el token del
 * link, que se valida dentro del SQL contra study_order_booking_tokens.
 */
const webhookNode = (method, path, id, isPublic = false) => ({
    parameters: {
        httpMethod: method,
        path,
        ...(isPublic ? {} : { authentication: 'jwtAuth' }),
        responseMode: 'responseNode',
        options: { allowedOrigins: '*' },
    },
    type: 'n8n-nodes-base.webhook',
    typeVersion: 2.1,
    position: [0, 0],
    id: `${id}-wh`,
    name: 'Webhook',
    webhookId: `study-orders-${id}`,
    ...(isPublic ? {} : { credentials: JWT_CREDENTIAL }),
});

const codeNode = (name, id, jsCode, position) => ({
    parameters: { jsCode },
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position,
    id,
    name,
});

const postgresNode = (id, query, queryReplacement, position) => ({
    parameters: {
        operation: 'executeQuery',
        query,
        options: { queryReplacement },
    },
    type: 'n8n-nodes-base.postgres',
    typeVersion: 2.6,
    position,
    id,
    name: 'Consulta',
    credentials: PG_CREDENTIAL,
    onError: 'continueErrorOutput',
});

const respondNode = (id, name, position, body, code) => ({
    parameters: {
        respondWith: 'json',
        responseBody: body,
        options: { responseCode: code },
    },
    type: 'n8n-nodes-base.respondToWebhook',
    typeVersion: 1.4,
    position,
    id,
    name,
});

const stickyNode = (id, content, position, height = 420) => ({
    parameters: { content, height, width: 460, color: 4 },
    type: 'n8n-nodes-base.stickyNote',
    typeVersion: 1,
    position,
    id,
    name: 'Contrato',
});

/**
 * `throw` en un Code node corta la ejecución y devuelve 500 sin cuerpo útil.
 * Por eso los errores de negocio viajan como `__error` y se responden con el
 * mismo sobre que los casos felices.
 */
const RESPOND_OK = '={{ { code: 200, message: $json.__message || "OK", data: $json.__data, meta: $json.__meta } }}';
const RESPOND_ERR = '={{ { code: $json.__code || 400, message: $json.__message || "Error", data: null } }}';

/** Envuelve el resultado de Postgres en el sobre común. */
const formatCode = (body) => `
// Arma el sobre { code, message, data, meta }. Un resultado vacío en una
// operación de escritura significa que el WHERE de guarda no dejó pasar:
// es un 409/404, no un 500.
const rows = $input.all().map((i) => i.json);
${body}
`.trim();

/** `notify` admite un destinatario o varios. Normaliza a lista. */
const notifyList = (wf) => (wf.notify ? (Array.isArray(wf.notify) ? wf.notify : [wf.notify]) : []);

const workflows = [];

// ── 1. GET /study-orders/options ─────────────────────────────────────────────
workflows.push({
    file: 'study-orders-options.json',
    name: 'Study Orders - Options',
    sticky: `## GET /study-orders/options\n\nCatálogo del formulario de orden.\n\n**Request:** sin parámetros (requiere JWT).\n\n**Response 200**\n\`\`\`json\n{ "code": 200, "message": "OK", "data": {\n  "sections": [{ "code": "RX-INTRA", "name": "...", "color": "#3B82F6",\n                 "services": [{ "id": "48", "name": "Periapical", "duration_minutes": 10 }] }],\n  "modifiers": [], "texts": [], "region_groups": [], "delivery": []\n} }\n\`\`\`\n\nLas secciones son las 12 categorías \`ci-orden:cat:*\`. Los servicios se listan por \`category_id\`, NO por external_id: hay servicios de la clínica que ya traían su propio external_id de una importación anterior (p.ej. PROTECTOR BUCAL, \`01.9.5\`) y filtrar por \`ci-orden:svc:%\` los dejaría fuera.`,
    method: 'GET',
    path: 'study-orders/options',
    id: 'opts',
    validate: `
// Este endpoint no toma parámetros: sólo se verifica que haya sujeto.
const userId = $json.jwtPayload?.userId;
if (!userId) return [{ json: { __error: true, __code: 401, __message: 'Token sin userId' } }];
return [{ json: { user_id: String(userId) } }];`.trim(),
    sql: OPTIONS_SQL,
    replacement: '={{ [] }}',
    format: formatCode(`
const data = rows[0]?.data ?? { sections: [], modifiers: [], texts: [], region_groups: [], delivery: [] };
return [{ json: { __data: data } }];`),
});

// ── 2. GET /study-orders ─────────────────────────────────────────────────────
workflows.push({
    file: 'study-orders-list.json',
    name: 'Study Orders - List',
    sticky: `## GET /study-orders\n\nBandeja de órdenes.\n\n**Query**\n- \`scope\`: \`mine\` | \`clinic\` (default \`mine\`)\n- \`board_status\`: all | new | pending | overdue | scheduled | completed | drafts\n- \`q\`: busca por paciente, documento o número de orden (prefijo)\n- \`sede_id\`, \`date_from\`, \`date_to\`, \`sla_hours\` (default 48)\n- \`sort\`: \`campo:asc|desc\`, \`page\`, \`limit\`\n\n**SEGURIDAD:** el \`doctor_id\` NO se acepta por query. Con \`scope=mine\` el SQL filtra por \`jwtPayload.userId\`; con \`scope=clinic\` exige STUDY_ORDERS_VIEW_ALL y, si no lo tiene, devuelve igual sólo lo propio.\n\n**Response 200**\n\`\`\`json\n{ "code": 200, "data": [ { "id": "...", "board_status": "partially_scheduled",\n   "items_total": 3, "items_scheduled": 1, "is_overdue": false } ],\n  "meta": { "total": 42, "page": 1, "limit": 25 } }\n\`\`\``,
    method: 'GET',
    path: 'study-orders',
    id: 'list',
    validate: `
const userId = $json.jwtPayload?.userId;
if (!userId) return [{ json: { __error: true, __code: 401, __message: 'Token sin userId' } }];

const q = $json.query || {};
const page  = Math.max(1, parseInt(q.page, 10) || 1);
const limit = Math.min(200, Math.max(1, parseInt(q.limit, 10) || 25));

// Lista blanca: 'sort' entra en el SQL como valor, pero se acota igual para que
// un valor raro no cambie silenciosamente el orden.
const SORTS = ['submitted_at:desc', 'submitted_at:asc', 'patient_name:asc',
               'patient_name:desc', 'order_number:asc', 'order_number:desc'];
const sort = SORTS.includes(q.sort) ? q.sort : 'submitted_at:desc';

// Un solo objeto de filtros: el SQL los lee por nombre.
const filters = {
  scope: q.scope === 'clinic' ? 'clinic' : 'mine',
  board_status: q.board_status || 'all',
  search: (q.q || '').trim(),
  sede_id: q.sede_id || '',
  patient_id: q.patient_id || '',
  sla_hours: Number(q.sla_hours) > 0 ? Number(q.sla_hours) : 48,
  date_from: q.date_from || '',
  date_to: q.date_to || '',
  sort,
  limit,
  offset: (page - 1) * limit,
};

return [{ json: { user_id: String(userId), filters: JSON.stringify(filters), page, limit } }];`.trim(),
    sql: LIST_SQL,
    replacement: '={{ [ $json.user_id, $json.filters ] }}',
    format: formatCode(`
const row = rows[0] ?? { total: 0, items: [] };
const input = $('Validar Datos').first().json;
return [{ json: {
  __data: row.items ?? [],
  __meta: { total: Number(row.total ?? 0), page: input.page, limit: input.limit },
} }];`),
});

// ── 3. GET /study-orders/detail ──────────────────────────────────────────────
workflows.push({
    file: 'study-orders-detail.json',
    name: 'Study Orders - Detail',
    sticky: `## GET /study-orders/detail?id=<uuid>\n\nOrden completa: cabecera, líneas (con \`is_scheduled\`/\`is_completed\` derivados) y citas.\n\n**SEGURIDAD:** el WHERE exige \`doctor_id = jwtPayload.userId\` **o** STUDY_ORDERS_VIEW_ALL. Un derivador no puede abrir la orden de un colega aunque conozca el id.\n\n**404** si no existe o no le pertenece — a propósito no se distingue un caso del otro.`,
    method: 'GET',
    path: 'study-orders/detail',
    id: 'detail',
    validate: `
const userId = $json.jwtPayload?.userId;
if (!userId) return [{ json: { __error: true, __code: 401, __message: 'Token sin userId' } }];
const id = ($json.query?.id || '').trim();
if (!id) return [{ json: { __error: true, __code: 400, __message: 'El parámetro id es requerido' } }];
return [{ json: { user_id: String(userId), id } }];`.trim(),
    sql: DETAIL_SQL,
    replacement: '={{ [ $json.user_id, $json.id ] }}',
    format: formatCode(`
if (!rows.length || !rows[0].data) {
  return [{ json: { __error: true, __code: 404, __message: 'Orden no encontrada' } }];
}
return [{ json: { __data: rows[0].data } }];`),
});

// ── 4. POST /study-orders/upsert ─────────────────────────────────────────────
workflows.push({
    file: 'study-orders-upsert.json',
    name: 'Study Orders - Upsert',
    sticky: `## POST /study-orders/upsert\n\nCrea (sin \`id\`) o actualiza (con \`id\`) una orden **en borrador**.\n\n**Body**\n\`\`\`json\n{ "id": "uuid opcional", "doctor_id": "sólo con CREATE_FOR_DOCTOR",\n  "patient_id": null, "patient_name": "Juan Pérez", "patient_document": "4123456",\n  "patient_email": "", "patient_phone": "099...",\n  "regions": { "RX-INTRA": ["16","17"] },\n  "section_modifiers": { "CONEBEAM": { "indicacion_clinica": ["est-tipo-implante"] } },\n  "texts": { "aclaracion": "..." }, "delivery_methods": ["impreso"],\n  "clinical_notes": "", "preferred_sede_id": "3",\n  "items": [{ "service_id": "48", "service_name": "Periapical",\n              "section_code": "RX-INTRA", "sort_order": 0, "modifiers": {} }] }\n\`\`\`\n\nLas líneas se **reemplazan enteras** en cada guardado: eso hace idempotente al upsert.\n\n**409** si la orden ya no está en borrador o no le pertenece al sujeto.`,
    method: 'POST',
    path: 'study-orders/upsert',
    id: 'upsert',
    validate: `
const userId = $json.jwtPayload?.userId;
if (!userId) return [{ json: { __error: true, __code: 401, __message: 'Token sin userId' } }];

const b = $json.body || {};
const name = (b.patient_name || '').toString().trim();
if (!name) return [{ json: { __error: true, __code: 400, __message: 'patient_name es requerido' } }];

const items = Array.isArray(b.items) ? b.items : [];
if (items.length === 0) {
  return [{ json: { __error: true, __code: 400, __message: 'La orden necesita al menos un estudio' } }];
}
for (const it of items) {
  if (!it.service_id || !it.section_code) {
    return [{ json: { __error: true, __code: 400, __message: 'Cada línea necesita service_id y section_code' } }];
  }
}

const str = (v) => (v ?? '').toString().trim();

// Un solo objeto: el SQL lee cada campo por nombre, así que no hay orden que
// mantener sincronizado entre este nodo y la consulta.
const payload = {
  id: str(b.id),
  doctor_id: str(b.doctor_id),
  patient_id: str(b.patient_id),
  patient_name: name,
  patient_document: str(b.patient_document),
  patient_email: str(b.patient_email),
  patient_phone: str(b.patient_phone),
  regions: b.regions ?? {},
  section_modifiers: b.section_modifiers ?? {},
  texts: b.texts ?? {},
  delivery_methods: b.delivery_methods ?? [],
  clinical_notes: (b.clinical_notes ?? '').toString(),
  preferred_sede_id: str(b.preferred_sede_id),
  items: items.map((it) => ({
    service_id: str(it.service_id),
    service_name: str(it.service_name),
    section_code: str(it.section_code),
    sort_order: Number(it.sort_order) || 0,
    quantity: Number(it.quantity) || 1,
    modifiers: it.modifiers ?? {},
    notes: str(it.notes),
  })),
};

return [{ json: { user_id: String(userId), payload: JSON.stringify(payload) } }];`.trim(),
    event: { replacement: `={{ JSON.stringify({ order_id: $('Formatear Respuesta').first().json.__data?.id || '', event_type: JSON.parse($('Validar Datos').first().json.payload).id ? 'updated' : 'created', actor_id: $('Validar Datos').first().json.user_id }) }}` },
    sql: UPSERT_SQL,
    replacement: '={{ [ $json.user_id, $json.payload ] }}',
    format: formatCode(`
const id = rows[0]?.id;
if (!id) {
  return [{ json: { __error: true, __code: 409,
    __message: 'La orden no se puede modificar: ya fue enviada o no te pertenece' } }];
}
return [{ json: { __data: { id }, __message: 'Orden guardada' } }];`),
});

// ── 5. POST /study-orders/submit ─────────────────────────────────────────────
workflows.push({
    file: 'study-orders-submit.json',
    name: 'Study Orders - Submit',
    sticky: `## POST /study-orders/submit\n\nEnvía la orden a la clínica. A partir de acá es **inmutable**.\n\n**Body:** \`{ "id": "uuid" }\`\n\n**409** si ya fue enviada, si no le pertenece al sujeto, o si no tiene ninguna línea.\n\n**Fase 2:** enganchar acá el sub-workflow \`Create Bulk Notification\` con \`type: study_order_submitted\` y los canales \`recepcionista\` y \`administrador\`, para que la recepción se entere en el momento.`,
    method: 'POST',
    path: 'study-orders/submit',
    id: 'submit',
    validate: `
const userId = $json.jwtPayload?.userId;
if (!userId) return [{ json: { __error: true, __code: 401, __message: 'Token sin userId' } }];
const id = ($json.body?.id || '').toString().trim();
if (!id) return [{ json: { __error: true, __code: 400, __message: 'id es requerido' } }];
return [{ json: { user_id: String(userId), id } }];`.trim(),
    event: { replacement: `={{ JSON.stringify({ order_id: $('Validar Datos').first().json.id, event_type: 'submitted', actor_id: $('Validar Datos').first().json.user_id }) }}` },
    sql: SUBMIT_SQL,
    replacement: '={{ [ $json.user_id, $json.id ] }}',
    notify: {
        sql: NOTIFY_RECEPTION_SQL,
        to: 'recepción',
        replacement: `={{ [ $('Validar Datos').first().json.id, '', $('Validar Datos').first().json.user_id ] }}`,
        eventType: 'study_order_submitted',
    },
    format: formatCode(`
if (!rows.length || !rows[0].id) {
  return [{ json: { __error: true, __code: 409,
    __message: 'La orden no se puede enviar: ya fue enviada, no te pertenece o no tiene estudios' } }];
}
return [{ json: { __data: rows[0], __message: 'Orden enviada' } }];`),
});

// ── 6. DELETE /study-orders/delete ───────────────────────────────────────────
workflows.push({
    file: 'study-orders-delete.json',
    name: 'Study Orders - Delete',
    sticky: `## DELETE /study-orders/delete\n\nElimina un borrador. Las líneas caen por CASCADE.\n\n**Body:** \`{ "id": "uuid" }\`\n\n**409** si la orden ya fue enviada: una orden enviada se **anula** (\`/study-orders/cancel\`), no se borra, porque la clínica ya la vio.`,
    method: 'DELETE',
    path: 'study-orders/delete',
    id: 'del',
    validate: `
const userId = $json.jwtPayload?.userId;
if (!userId) return [{ json: { __error: true, __code: 401, __message: 'Token sin userId' } }];
const id = ($json.body?.id || $json.query?.id || '').toString().trim();
if (!id) return [{ json: { __error: true, __code: 400, __message: 'id es requerido' } }];
return [{ json: { user_id: String(userId), id } }];`.trim(),
    sql: DELETE_SQL,
    replacement: '={{ [ $json.user_id, $json.id ] }}',
    format: formatCode(`
if (!rows.length) {
  return [{ json: { __error: true, __code: 409,
    __message: 'Sólo se pueden eliminar borradores propios' } }];
}
return [{ json: { __data: { id: rows[0].id }, __message: 'Borrador eliminado' } }];`),
});

// ── 7. POST /study-orders/acknowledge ────────────────────────────────────────
workflows.push({
    file: 'study-orders-acknowledge.json',
    name: 'Study Orders - Acknowledge',
    sticky: `## POST /study-orders/acknowledge\n\nLa clínica "toma" la orden: la saca del bucket **nuevas** y la pasa a **sin agendar**.\n\nEs el paso de revisión previa. No es un estado persistido: se guarda \`acknowledged_at\` y la vista \`v_study_orders_board\` deriva el resto.\n\n**Body:** \`{ "id": "uuid" }\` · Requiere STUDY_ORDERS_ACKNOWLEDGE.`,
    method: 'POST',
    path: 'study-orders/acknowledge',
    id: 'ack',
    validate: `
const userId = $json.jwtPayload?.userId;
if (!userId) return [{ json: { __error: true, __code: 401, __message: 'Token sin userId' } }];
const id = ($json.body?.id || '').toString().trim();
if (!id) return [{ json: { __error: true, __code: 400, __message: 'id es requerido' } }];
return [{ json: { user_id: String(userId), id } }];`.trim(),
    event: { replacement: `={{ JSON.stringify({ order_id: $('Validar Datos').first().json.id, event_type: 'acknowledged', actor_id: $('Validar Datos').first().json.user_id }) }}` },
    sql: ACKNOWLEDGE_SQL,
    replacement: '={{ [ $json.user_id, $json.id ] }}',
    notify: {
        sql: NOTIFY_DOCTOR_SQL,
        replacement: `={{ [ $('Validar Datos').first().json.id, 'acknowledged', $('Validar Datos').first().json.user_id ] }}`,
        eventType: 'study_order_status_changed',
    },
    format: formatCode(`
if (!rows.length) {
  return [{ json: { __error: true, __code: 409,
    __message: 'La orden ya fue tomada, no está enviada, o no tenés permiso' } }];
}
return [{ json: { __data: rows[0], __message: 'Orden tomada' } }];`),
});

// ── 8. POST /study-orders/cancel ─────────────────────────────────────────────
workflows.push({
    file: 'study-orders-cancel.json',
    name: 'Study Orders - Cancel',
    sticky: `## POST /study-orders/cancel\n\nAnula la orden con motivo obligatorio.\n\n**Body:** \`{ "id": "uuid", "reason": "texto" }\`\n\nDos caminos: con STUDY_ORDERS_CANCEL (la clínica) se anula en cualquier momento; el derivador anula lo suyo **sólo mientras no haya sido tomada** (\`acknowledged_at IS NULL\`). Después de eso la baja pasa por la clínica.`,
    method: 'POST',
    path: 'study-orders/cancel',
    id: 'cancel',
    validate: `
const userId = $json.jwtPayload?.userId;
if (!userId) return [{ json: { __error: true, __code: 401, __message: 'Token sin userId' } }];
const b = $json.body || {};
const id = (b.id || '').toString().trim();
const reason = (b.reason || '').toString().trim();
if (!id) return [{ json: { __error: true, __code: 400, __message: 'id es requerido' } }];
if (!reason) return [{ json: { __error: true, __code: 400, __message: 'El motivo de anulación es requerido' } }];
return [{ json: { user_id: String(userId), id, reason } }];`.trim(),
    event: { replacement: `={{ JSON.stringify({ order_id: $('Validar Datos').first().json.id, event_type: 'cancelled', actor_id: $('Validar Datos').first().json.user_id, metadata: { reason: $('Validar Datos').first().json.reason || '' } }) }}` },
    sql: CANCEL_SQL,
    replacement: '={{ [ $json.user_id, $json.id, $json.reason ] }}',
    // Dos destinatarios: el derivador —salvo que haya sido él quien anuló— y la
    // clínica, que puede haber empezado a trabajar la orden. Cada SQL descarta al
    // actor, así que nadie recibe el aviso de su propia acción.
    notify: [
        {
            to: 'derivador',
            sql: NOTIFY_DOCTOR_SQL,
            replacement: `={{ [ $('Validar Datos').first().json.id, 'cancelled', $('Validar Datos').first().json.user_id ] }}`,
            eventType: 'study_order_status_changed',
        },
        {
            to: 'recepción',
            sql: NOTIFY_RECEPTION_SQL,
            replacement: `={{ [ $('Validar Datos').first().json.id, 'cancelled', $('Validar Datos').first().json.user_id ] }}`,
            eventType: 'study_order_submitted',
        },
    ],
    format: formatCode(`
if (!rows.length) {
  return [{ json: { __error: true, __code: 409,
    __message: 'La orden no se puede anular: ya fue tomada por la clínica, no está en un estado anulable, o no tenés permiso' } }];
}
return [{ json: { __data: rows[0], __message: 'Orden anulada' } }];`),
});

// ── 9. POST /study-orders/reschedule ─────────────────────────────────────────
workflows.push({
    file: 'study-orders-reschedule.json',
    name: 'Study Orders - Reschedule',
    sticky: `## POST /study-orders/reschedule\n\nMueve una cita de la orden: cambia **sólo** fecha y hora.\n\n**Body:** \`{ "order_id": "uuid", "appointment_id": "123", "start": "2026-09-10T14:00:00", "end": "2026-09-10T14:10:00" }\`\n\n**Por qué no usa /appointments/reschedule:** ese flujo inserta una cita nueva y cancela la vieja, y su INSERT no incluye \`study_order_id\` — la cita quedaría desprendida de la orden. Acá se edita la fila existente.\n\n**LIMITACIÓN CONOCIDA:** no empuja el cambio a Google Calendar. La sincronización de salida vive en \`/appointments/upsert\`. Si la sede usa Google, hay que reagendar desde la agenda o extender este flujo.\n\n**409** si la cita no es de esa orden, ya fue atendida o cancelada, o el rango es inválido.`,
    method: 'POST',
    path: 'study-orders/reschedule',
    id: 'resched',
    validate: `
const userId = $json.jwtPayload?.userId;
if (!userId) return [{ json: { __error: true, __code: 401, __message: 'Token sin userId' } }];

const b = $json.body || {};
const orderId = (b.order_id || '').toString().trim();
const apptId = (b.appointment_id || '').toString().trim();
const start = (b.start || '').toString().trim();
const end = (b.end || '').toString().trim();

if (!orderId || !apptId) {
  return [{ json: { __error: true, __code: 400, __message: 'order_id y appointment_id son requeridos' } }];
}
if (!start || !end) {
  return [{ json: { __error: true, __code: 400, __message: 'start y end son requeridos' } }];
}
if (new Date(end) <= new Date(start)) {
  return [{ json: { __error: true, __code: 400, __message: 'El fin tiene que ser posterior al inicio' } }];
}

return [{ json: {
  user_id: String(userId),
  payload: JSON.stringify({ order_id: orderId, appointment_id: apptId, start, end }),
} }];`.trim(),
    event: { replacement: `={{ JSON.stringify({ order_id: JSON.parse($('Validar Datos').first().json.payload).order_id, event_type: 'rescheduled', actor_id: $('Validar Datos').first().json.user_id, appointment_id: JSON.parse($('Validar Datos').first().json.payload).appointment_id, metadata: { to_start: JSON.parse($('Validar Datos').first().json.payload).start, to_end: JSON.parse($('Validar Datos').first().json.payload).end } }) }}` },
    sql: RESCHEDULE_SQL,
    replacement: '={{ [ $json.user_id, $json.payload ] }}',
    notify: {
        sql: NOTIFY_DOCTOR_SQL,
        replacement: `={{ [ JSON.parse($('Validar Datos').first().json.payload).order_id, 'rescheduled', $('Validar Datos').first().json.user_id ] }}`,
        eventType: 'study_order_status_changed',
    },
    format: formatCode(`
if (!rows.length) {
  return [{ json: { __error: true, __code: 409,
    __message: 'No se pudo mover la cita: no pertenece a esta orden, ya fue atendida o cancelada, o no tenés permiso' } }];
}
return [{ json: { __data: rows[0], __message: 'Cita reprogramada' } }];`),
});

// ── 10. POST /study-orders/link-appointment ──────────────────────────────────
workflows.push({
    file: 'study-orders-link-appointment.json',
    name: 'Study Orders - Link Appointment',
    sticky: `## POST /study-orders/link-appointment\n\nAta una cita a su orden, **después** de crearla con /appointments/upsert.\n\n**Body:** \`{ "order_id": "uuid", "appointment_id": "123" }\`\n\n**Por qué en dos pasos:** /appointments/upsert es un monolito compartido, con sync a Google Calendar y notificaciones adentro; agregarle una columna para esto arriesga la agenda entera. El repo ya usa este patrón con las facturas (\`/appointments/link_invoice\`, desde \`services/billing-links.ts\`).\n\nEs idempotente y no le roba una cita a otra orden. Se llama fire-and-forget: si falla, la cita queda creada igual y la orden se puede atar después.`,
    method: 'POST',
    path: 'study-orders/link-appointment',
    id: 'link',
    validate: `
const userId = $json.jwtPayload?.userId;
if (!userId) return [{ json: { __error: true, __code: 401, __message: 'Token sin userId' } }];
const b = $json.body || {};
const orderId = (b.order_id || '').toString().trim();
const apptId = (b.appointment_id || '').toString().trim();
if (!orderId || !apptId) {
  return [{ json: { __error: true, __code: 400, __message: 'order_id y appointment_id son requeridos' } }];
}
// Lista cerrada: el tipo de evento termina en la línea de tiempo del derivador
// y no puede ser lo que el cliente quiera. 'scheduled' cuando la cita se ata por
// primera vez; 'appointment_updated' cuando se editó una que ya estaba atada.
const EVENTS = ['scheduled', 'appointment_updated'];
const evt = EVENTS.includes((b.event_type || '').toString()) ? b.event_type : 'scheduled';

return [{ json: {
  user_id: String(userId),
  event_type: evt,
  payload: JSON.stringify({ order_id: orderId, appointment_id: apptId }),
} }];`.trim(),
    event: { replacement: `={{ JSON.stringify({ order_id: JSON.parse($('Validar Datos').first().json.payload).order_id, event_type: $('Validar Datos').first().json.event_type, actor_id: $('Validar Datos').first().json.user_id, appointment_id: JSON.parse($('Validar Datos').first().json.payload).appointment_id }) }}` },
    sql: LINK_APPOINTMENT_SQL,
    replacement: '={{ [ $json.user_id, $json.payload ] }}',
    format: formatCode(`
if (!rows.length) {
  return [{ json: { __error: true, __code: 409,
    __message: 'No se pudo atar la cita: ya pertenece a otra orden, o no tenés permiso sobre esta' } }];
}
return [{ json: { __data: rows[0], __message: 'Cita vinculada a la orden' } }];`),
    notify: {
        sql: NOTIFY_DOCTOR_SQL,
        replacement: `={{ [ JSON.parse($('Validar Datos').first().json.payload).order_id, 'scheduled', $('Validar Datos').first().json.user_id ] }}`,
        eventType: 'study_order_status_changed',
    },
});

// ── 11. GET /study-orders/by-appointment ─────────────────────────────────────
workflows.push({
    file: 'study-orders-by-appointment.json',
    name: 'Study Orders - By Appointment',
    sticky: `## GET /study-orders/by-appointment?appointment_id=123\n\nA qué orden pertenece una cita.\n\n**Por qué existe:** \`study_order_id\` no viaja con los datos de la cita — \`Get_Appointments\` es parte del monolito de la agenda y no se toca para esto. Al abrir una cita, el selector de orden consulta acá para mostrar la que tiene asociada.\n\n**Response 200** con \`data: null\` si la cita no tiene orden. No es un error: la mayoría de las citas no vienen de una orden.`,
    method: 'GET',
    path: 'study-orders/by-appointment',
    id: 'byappt',
    validate: `
const userId = $json.jwtPayload?.userId;
if (!userId) return [{ json: { __error: true, __code: 401, __message: 'Token sin userId' } }];
const id = ($json.query?.appointment_id || '').toString().trim();
if (!id) return [{ json: { __error: true, __code: 400, __message: 'appointment_id es requerido' } }];
return [{ json: { user_id: String(userId), appointment_id: id } }];`.trim(),
    sql: BY_APPOINTMENT_SQL,
    replacement: '={{ [ $json.user_id, $json.appointment_id ] }}',
    format: formatCode(`
// Sin orden asociada no es un error: la mayoría de las citas no vienen de una.
return [{ json: { __data: rows[0] ?? null } }];`),
});

// ── 12. POST /study-orders/recompute ─────────────────────────────────────────
workflows.push({
    file: 'study-orders-recompute.json',
    name: 'Study Orders - Recompute',
    sticky: `## POST /study-orders/recompute\n\nRecalcula el estado de la orden contra sus citas y avisa al derivador.\n\n**Body:** \`{ "id": "uuid", "change": "appointment_cancelled" }\` — \`change\` es opcional.\n\n**Qué persiste:** sólo el cierre. Todas las líneas atendidas → \`completed\`; y su reverso, si la cita de una orden cerrada se cancela vuelve a \`submitted\`. El estado operativo (sin agendar / parcial / agendada) lo deriva \`v_study_orders_board\` y se corrige solo.\n\n**Por qué \`change\` lo manda el cliente:** al cancelar una cita no hay transición persistida que detectar — la orden sigue \`submitted\` — y aun así el derivador tiene que enterarse. Si el recálculo sí produjo una transición, esa gana.\n\n**Idempotente y fire-and-forget:** llamarlo de más no cambia nada y, sin cambio que contar, no notifica.`,
    method: 'POST',
    path: 'study-orders/recompute',
    id: 'recomp',
    validate: `
const userId = $json.jwtPayload?.userId;
if (!userId) return [{ json: { __error: true, __code: 401, __message: 'Token sin userId' } }];
const b = $json.body || {};
const id = (b.id || '').toString().trim();
if (!id) return [{ json: { __error: true, __code: 400, __message: 'id es requerido' } }];

// Lista cerrada: el 'change' termina en la bitácora y en la tarjeta del doctor,
// y no puede ser lo que el cliente quiera.
//
// 'session_saved' es LOG-ONLY: se anota en el historial pero no notifica. Una
// orden de cinco estudios se atiende en varias sesiones y de las cuatro primeras
// el derivador no tiene nada que saber; se entera cuando la última cierra la
// orden, y ahí el recálculo devuelve 'completed' por su cuenta.
const ALLOWED = ['appointment_cancelled', 'session_saved'];
const LOG_ONLY = ['session_saved'];
const hint = (b.change || '').toString().trim();
const change = ALLOWED.includes(hint) ? hint : '';

// El id de la cita viaja aparte del payload SQL: la consulta no lo usa, pero
// la bitácora sí, para poder decir "se canceló la cita del 10 a las 14".
const apptId = (b.appointment_id || '').toString().trim();

return [{ json: {
  user_id: String(userId),
  appointment_id: apptId,
  // Lo que se anota y lo que se avisa son dos cosas distintas: el nodo de
  // bitacora usa change, y el de aviso usa notify_change, que va vacio en los
  // eventos log-only.
  notify_change: LOG_ONLY.includes(change) ? '' : change,
  payload: JSON.stringify({ id, change }),
} }];`.trim(),
    event: { replacement: `={{ JSON.stringify({ order_id: $('Formatear Respuesta').first().json.__data?.id || '', event_type: $('Formatear Respuesta').first().json.__data?.change || '', actor_id: $('Validar Datos').first().json.user_id, appointment_id: $('Validar Datos').first().json.appointment_id || '' }) }}` },
    sql: RECOMPUTE_SQL,
    replacement: '={{ [ $json.user_id, $json.payload ] }}',
    format: formatCode(`
// Sin filas: la orden no existe, es un borrador o está anulada, o el sujeto no
// tiene nada que ver con ella. Como se llama fire-and-forget, no es un error
// que valga la pena propagar: se responde OK con data null.
return [{ json: { __data: rows[0] ?? null } }];`),
    notify: {
        sql: NOTIFY_DOCTOR_SQL,
        replacement: `={{ [ $('Formatear Respuesta').first().json.__data?.id || '', ($('Formatear Respuesta').first().json.__data?.changed ? $('Formatear Respuesta').first().json.__data?.change : $('Validar Datos').first().json.notify_change) || '', $('Validar Datos').first().json.user_id ] }}`,
        eventType: 'study_order_status_changed',
    },
});

// ── 13. POST /study-orders/booking-token ─────────────────────────────────────
workflows.push({
    file: 'study-orders-booking-token.json',
    name: 'Study Orders - Booking Token',
    sticky: `## POST /study-orders/booking-token\n\nGenera el link con el que el paciente elige horario, sin cuenta.\n\n**Body:** \`{ "order_id": "uuid", "days_valid": 7, "max_uses": 1 }\`\n\n**Devuelve el token en claro UNA sola vez.** En la base se guarda sólo el sha256, igual que \`users.login_code\` del portal de pacientes: si alguien lee la tabla, no puede usar los links.\n\n**Generar uno nuevo revoca los anteriores** de esa orden — un link viejo circulando por WhatsApp es una puerta que nadie recuerda cerrar.\n\n**409** si la orden no está enviada o todavía no tiene ficha de paciente.`,
    method: 'POST',
    path: 'study-orders/booking-token',
    id: 'btok',
    validate: `
const crypto = require('crypto');

const userId = $json.jwtPayload?.userId;
if (!userId) return [{ json: { __error: true, __code: 401, __message: 'Token sin userId' } }];
const b = $json.body || {};
const orderId = (b.order_id || '').toString().trim();
if (!orderId) return [{ json: { __error: true, __code: 400, __message: 'order_id es requerido' } }];

const days = Math.min(Math.max(parseInt(b.days_valid, 10) || 7, 1), 90);
const maxUses = Math.min(Math.max(parseInt(b.max_uses, 10) || 1, 1), 10);

// 32 bytes en base64url: suficiente para que no se adivine y corto para un
// WhatsApp. El claro se devuelve y se olvida; a la base va sólo el hash.
const clear = crypto.randomBytes(32).toString('base64url');
const hash = crypto.createHash('sha256').update(clear).digest('hex');

const expires = new Date(Date.now() + days * 86400000);
const expiresAt = expires.toISOString().slice(0, 19).replace('T', ' ');

return [{ json: {
  user_id: String(userId),
  token_clear: clear,
  payload: JSON.stringify({ order_id: orderId, token_hash: hash, expires_at: expiresAt, max_uses: maxUses }),
} }];`.trim(),
    event: { replacement: `={{ JSON.stringify({ order_id: JSON.parse($('Validar Datos').first().json.payload).order_id, event_type: 'link_created', actor_id: $('Validar Datos').first().json.user_id }) }}` },
    sql: BOOKING_TOKEN_SQL,
    replacement: '={{ [ $json.user_id, $json.payload ] }}',
    format: formatCode(`
if (!rows.length) {
  return [{ json: { __error: true, __code: 409,
    __message: 'No se pudo generar el link: la orden no está enviada, no tiene ficha de paciente, o no tenés permiso' } }];
}
// El token en claro se devuelve acá y no vuelve a existir en ningún lado.
return [{ json: { __data: { ...rows[0], token: $('Validar Datos').first().json.token_clear },
                  __message: 'Link generado' } }];`),
});

// ── 14. GET /study-orders/public_noauth ──────────────────────────────────────
workflows.push({
    file: 'study-orders-public.json',
    name: 'Study Orders - Public Detail (noauth)',
    isPublic: true,
    sticky: `## GET /study-orders/public_noauth?token=...\n\nQué ve el paciente al abrir el link. **Sin autenticación.**\n\nDevuelve lo mínimo para que reconozca su orden y sepa qué le van a hacer: primer nombre, número de orden, estudios pendientes y sede sugerida. **No** viajan documento, teléfono, mail ni las notas clínicas del derivador — cualquiera con el link ve esta respuesta.\n\nEl token se valida en el SQL: vencido, revocado o agotado → **404**, sin distinguir cuál de los tres, para no confirmarle a un curioso que el token existió.`,
    method: 'GET',
    path: 'study-orders/public_noauth',
    id: 'pubdet',
    validate: `
const crypto = require('crypto');
const token = ($json.query?.token || '').toString().trim();
if (!token) return [{ json: { __error: true, __code: 400, __message: 'token es requerido' } }];
return [{ json: { token_hash: crypto.createHash('sha256').update(token).digest('hex') } }];`.trim(),
    sql: PUBLIC_DETAIL_SQL,
    replacement: '={{ [ $json.token_hash ] }}',
    format: formatCode(`
if (!rows.length) {
  // Un solo mensaje para vencido, revocado, agotado e inexistente: distinguirlos
  // le confirmaría a un curioso que el token existió alguna vez.
  return [{ json: { __error: true, __code: 404, __message: 'El link no es válido o ya venció' } }];
}
return [{ json: { __data: rows[0] } }];`),
});

// ── 15. POST /study-orders/public-book_noauth ────────────────────────────────
workflows.push({
    file: 'study-orders-public-book.json',
    name: 'Study Orders - Public Book (noauth)',
    isPublic: true,
    sticky: `## POST /study-orders/public-book_noauth\n\nEl paciente confirma el horario. **Sin autenticación**: lo que autoriza es el token del link.\n\n**Body:** \`{ "token": "...", "calendar_source_id": 12, "start": "2026-09-10T14:00:00", "end": "2026-09-10T14:30:00" }\`\n\nCrea la cita, la ata a la orden, le carga los estudios pendientes y consume un uso del token — todo en una sentencia, con \`FOR UPDATE\` sobre el token para que dos clics no gasten el mismo uso.\n\n**LIMITACIÓN CONOCIDA:** no empuja la cita a Google Calendar (la sincronización vive en \`/appointments/upsert\`). Si la sede sincroniza, la cita aparece en InvokeIA pero no en Google hasta que alguien la edite desde la agenda.\n\n**409** si el token venció entre que abrió el link y confirmó, o si el horario ya no sirve.`,
    method: 'POST',
    path: 'study-orders/public-book_noauth',
    id: 'pubbook',
    validate: `
const crypto = require('crypto');
const b = $json.body || {};
const token = (b.token || '').toString().trim();
if (!token) return [{ json: { __error: true, __code: 400, __message: 'token es requerido' } }];

const cal = (b.calendar_source_id || '').toString().trim();
const start = (b.start || '').toString().trim();
const end = (b.end || '').toString().trim();
if (!cal || !start || !end) {
  return [{ json: { __error: true, __code: 400, __message: 'calendar_source_id, start y end son requeridos' } }];
}
if (new Date(end) <= new Date(start)) {
  return [{ json: { __error: true, __code: 400, __message: 'El fin tiene que ser posterior al inicio' } }];
}
if (new Date(start) <= new Date()) {
  return [{ json: { __error: true, __code: 400, __message: 'No se puede agendar en el pasado' } }];
}

return [{ json: {
  token_hash: crypto.createHash('sha256').update(token).digest('hex'),
  payload: JSON.stringify({ calendar_source_id: cal, start, end, summary: (b.summary || '').toString().trim() }),
} }];`.trim(),
    event: { replacement: `={{ JSON.stringify({ order_id: $('Formatear Respuesta').first().json.__data?.order_id || '', event_type: 'patient_booked', actor_kind: 'patient', appointment_id: $('Formatear Respuesta').first().json.__data?.appointment_id || '' }) }}` },
    sql: PUBLIC_BOOK_SQL,
    replacement: '={{ [ $json.token_hash, $json.payload ] }}',
    format: formatCode(`
if (!rows.length) {
  return [{ json: { __error: true, __code: 409,
    __message: 'No se pudo reservar: el link venció o ya se usó, o el horario elegido no está disponible' } }];
}
return [{ json: { __data: rows[0], __message: 'Cita reservada' } }];`),
    // El paciente reservó por su cuenta: se enteran el derivador y la clínica.
    // Sin el segundo aviso, una cita aparece en la agenda y nadie sabe de dónde
    // salió. No hay actor que descartar: quien reservó no tiene cuenta.
    notify: [
        {
            to: 'derivador',
            sql: NOTIFY_DOCTOR_SQL,
            replacement: `={{ [ $('Formatear Respuesta').first().json.__data?.order_id || '', 'scheduled', '' ] }}`,
            eventType: 'study_order_status_changed',
        },
        {
            to: 'recepción',
            sql: NOTIFY_RECEPTION_SQL,
            replacement: `={{ [ $('Formatear Respuesta').first().json.__data?.order_id || '', 'patient_booked', '' ] }}`,
            eventType: 'study_order_submitted',
        },
    ],
});

// ── 16. POST /appointments/assign-technician ─────────────────────────────────
workflows.push({
    file: 'appointments-assign-technician.json',
    name: 'Appointments - Assign Technician',
    sticky: `## POST /appointments/assign-technician\n\nQuién ejecuta la cita. **No** es el derivador: \`assignee_id\` sigue siendo el odontólogo que mandó al paciente, y esta columna (\`technician_id\`) es el técnico que toma el estudio.\n\n**Body:** \`{ "appointment_id": "123", "technician_id": "uuid" }\` — \`technician_id\` vacío desasigna.\n\n**Dos caminos:** con \`APPOINTMENTS_ASSIGN_TECHNICIAN\` se asigna a cualquiera (recepción repartiendo el día). Sin el permiso, uno puede tomar para sí una cita libre, pero no robarle una ya tomada a otro.\n\nEl destinatario tiene que tener rol \`operador\`: si no, la cita le aparecería en un panel que no le toca.\n\n**Endpoint aparte** de /appointments/upsert por lo mismo que link_invoice: ese flujo es el monolito de la agenda.\n\n**409** si la cita está cancelada, el destinatario no es operador, o no hay permiso.`,
    method: 'POST',
    path: 'appointments/assign-technician',
    id: 'asgtec',
    validate: `
const userId = $json.jwtPayload?.userId;
if (!userId) return [{ json: { __error: true, __code: 401, __message: 'Token sin userId' } }];
const b = $json.body || {};
const apptId = (b.appointment_id || '').toString().trim();
if (!apptId) return [{ json: { __error: true, __code: 400, __message: 'appointment_id es requerido' } }];
// Vacío es válido: significa desasignar.
const techId = (b.technician_id || '').toString().trim();
return [{ json: {
  user_id: String(userId),
  appointment_id: apptId,
  payload: JSON.stringify({ appointment_id: apptId, technician_id: techId }),
} }];`.trim(),
    sql: ASSIGN_TECHNICIAN_SQL,
    replacement: '={{ [ $json.user_id, $json.payload ] }}',
    format: formatCode(`
if (!rows.length) {
  return [{ json: { __error: true, __code: 409,
    __message: 'No se pudo asignar: la cita está cancelada, el destinatario no es un operador, o no tenés permiso' } }];
}
return [{ json: { __data: rows[0], __message: 'Técnico asignado' } }];`),
});

// ── 17. GET /appointments/technician-tasks ───────────────────────────────────
workflows.push({
    file: 'appointments-technician-tasks.json',
    name: 'Appointments - Technician Tasks',
    sticky: `## GET /appointments/technician-tasks?from=...&to=...\n\nLas citas que le tocan a un técnico. Alimenta el panel de Tareas, que es Mi Consultorio con otra fuente.\n\n**Dos caminos que se suman:** lo asignado directamente (\`technician_id\`) **y** lo que caiga en un calendario al que tenga acceso (\`calendar_users\`, la misma tabla que ya usa Mi Consultorio). Un técnico sin calendarios ve sólo lo suyo; uno con acceso a la sala ve todo lo de esa sala.\n\n**\`technician_id\` en el query sólo lo respeta quien puede asignar** (recepción mirando la carga de otro). Sin ese permiso se ignora y se usa el sujeto del token: el panel de uno nunca puede pedir el de otro.\n\nEl formato de salida espeja el de \`/users/appointments\`, que es lo que el workspace ya sabe leer.`,
    method: 'GET',
    path: 'appointments/technician-tasks',
    id: 'tectask',
    validate: `
const userId = $json.jwtPayload?.userId;
if (!userId) return [{ json: { __error: true, __code: 401, __message: 'Token sin userId' } }];
const q = $json.query || {};
const from = (q.from || q.startingDateAndTime || '').toString().trim();
const to = (q.to || q.endingDateAndTime || '').toString().trim();
if (!from || !to) {
  return [{ json: { __error: true, __code: 400, __message: 'from y to son requeridos' } }];
}
return [{ json: {
  user_id: String(userId),
  payload: JSON.stringify({ from, to, technician_id: (q.technician_id || '').toString().trim() }),
} }];`.trim(),
    sql: TECHNICIAN_TASKS_SQL,
    replacement: '={{ [ $json.user_id, $json.payload ] }}',
    format: formatCode(`
// Sin tareas no es un error: el técnico puede tener el día libre.
return [{ json: { __data: rows } }];`),
});

// ── 18. GET /appointments/technicians ────────────────────────────────────────
workflows.push({
    file: 'appointments-technicians.json',
    name: 'Appointments - Technicians By Ids',
    sticky: `## GET /appointments/technicians?appointment_ids=1,2,3\n\nQué técnico tiene asignado cada cita de una lista.\n\n**Por qué existe:** \`technician_id\` no viaja con los datos de la cita — \`Get_Appointments\` es el monolito compartido de la agenda y no se toca para esto. El calendario carga sus citas y pregunta acá de una sola vez por todas las visibles, para poder marcar el técnico actual en el menú contextual y en los diálogos.\n\n**Sólo devuelve las que tienen técnico.** Las demás se leen por ausencia, así la respuesta no crece con la agenda entera.\n\nMismo patrón que \`/study-orders/by-appointment\`.`,
    method: 'GET',
    path: 'appointments/technicians',
    id: 'apptec',
    validate: `
const userId = $json.jwtPayload?.userId;
if (!userId) return [{ json: { __error: true, __code: 401, __message: 'Token sin userId' } }];

// Se aceptan separados por coma (lo natural en un query) y se limpian: un id no
// numerico rompe el cast a int del SQL.
const raw = ($json.query?.appointment_ids || '').toString();
const ids = raw.split(',').map((v) => v.trim()).filter((v) => /^\d+$/.test(v)).slice(0, 500);

// Una lista vacia sigue igual y devuelve cero filas: un calendario sin citas no
// es un error, y cortar aca con 400 obligaria al cliente a decidir si llamar.
return [{ json: { user_id: String(userId), payload: JSON.stringify({ appointment_ids: ids }) } }];`.trim(),
    sql: APPOINTMENT_TECHNICIANS_SQL,
    replacement: '={{ [ $json.user_id, $json.payload ] }}',
    format: formatCode(`
// Sin asignaciones no es un error: lo normal es que la mayoria de las citas no
// tengan tecnico.
return [{ json: { __data: rows } }];`),
});

/**
 * Nodos de notificación. Se cuelgan de "Responder OK": n8n sigue ejecutando
 * después de responder al webhook, así que el cliente no espera por esto.
 *
 * El id del workflow `Events` sale de los exports de la instancia; es el que
 * usan los flujos de citas para empujar por SSE.
 */
const EVENTS_WORKFLOW_ID = 'W5SZnwkaTigFrHO6';

/**
 * Nodo de bitácora. Va colgado de "Responder OK", antes del aviso: el historial
 * se escribe aunque la notificación falle, y en ese orden porque el renglón
 * tiene que existir cuando el doctor abra la tarjeta.
 *
 * `replacement` arma el payload leyendo los nodos anteriores. El actor sale
 * siempre del token, nunca del cuerpo del request.
 */
function eventNode(id, replacement) {
    return {
        parameters: { operation: 'executeQuery', query: LOG_EVENT_SQL, options: { queryReplacement: replacement } },
        type: 'n8n-nodes-base.postgres',
        typeVersion: 2.6,
        position: [1540, 400],
        id: `${id}-event`,
        name: 'Registrar evento',
        credentials: PG_CREDENTIAL,
        // Perder un renglón del historial es malo; tumbar la operación, peor.
        onError: 'continueRegularOutput',
    };
}

function notifyNodes(id, list) {
    return list.flatMap((n, i) => {
        // Nombres únicos y descriptivos: en el editor de n8n se ve a quién le
        // avisa cada rama sin tener que abrir el nodo.
        const notifyName = list.length > 1 ? `Notificar ${n.to}` : 'Notificar';
        const pushName = list.length > 1 ? `Empujar por SSE ${n.to}` : 'Empujar por SSE';
        const y = 220 + i * 180;
        return [
            {
                parameters: { operation: 'executeQuery', query: n.sql, options: { queryReplacement: n.replacement } },
                type: 'n8n-nodes-base.postgres',
                typeVersion: 2.6,
                position: [1540, y],
                id: `${id}-notify-${i}`,
                name: notifyName,
                credentials: PG_CREDENTIAL,
                // Que falle el aviso no puede tumbar la operación, que ya respondió OK.
                onError: 'continueRegularOutput',
            },
            {
                parameters: {
                    workflowId: { __rl: true, value: EVENTS_WORKFLOW_ID, mode: 'list', cachedResultName: 'Events' },
                    mode: 'each',
                    workflowInputs: {
                        mappingMode: 'defineBelow',
                        value: {
                            event_type: n.eventType,
                            user_ids: '={{ [$json.user_id] }}',
                            channels: '={{ [] }}',
                            payload: '={{ $json }}',
                        },
                    },
                },
                type: 'n8n-nodes-base.executeWorkflow',
                typeVersion: 1.2,
                position: [1760, y],
                id: `${id}-push-${i}`,
                name: pushName,
                onError: 'continueRegularOutput',
            },
        ];
    });
}

/**
 * El cron de reconciliación no entra en el molde de arriba: no tiene webhook ni
 * responde nada. Se arma aparte.
 */
function reconcileWorkflow() {
    return {
        name: 'Study Orders - Reconcile (cron)',
        nodes: [
            stickyNode('recon-doc', `## Cron de reconciliación\n\nCorre cada 2 horas y corrige las órdenes cuyo estado persistido no refleja sus citas.\n\n**Por qué existe:** \`/study-orders/recompute\` lo llama el front al guardar una sesión clínica y al cancelar una cita, pero el front no siempre llega — la pestaña se cierra, la red se corta, o el estado de la cita cambia por un camino que no lo invoca. Sin esto, una orden puede quedarse en "en curso" para siempre y el derivador nunca se entera de que sus estudios están listos.\n\nSin nada que corregir devuelve cero filas y la ejecución se corta ahí: no notifica de más.`, [-560, -180], 380),
            {
                parameters: { rule: { interval: [{ field: 'hours', hoursInterval: 2 }] } },
                type: 'n8n-nodes-base.scheduleTrigger',
                typeVersion: 1.2,
                position: [0, 0],
                id: 'recon-cron',
                name: 'Cada 2 horas',
            },
            {
                parameters: { operation: 'executeQuery', query: RECONCILE_SQL, options: {} },
                type: 'n8n-nodes-base.postgres',
                typeVersion: 2.6,
                position: [240, 0],
                id: 'recon-sql',
                name: 'Reconciliar',
                credentials: PG_CREDENTIAL,
                onError: 'continueRegularOutput',
            },
            {
                // El cron también deja su renglón en la bitácora, con actor
                // 'system': en la línea de tiempo se distingue de una corrección
                // hecha por una persona.
                parameters: {
                    operation: 'executeQuery',
                    query: LOG_EVENT_SQL,
                    options: {
                        queryReplacement: "={{ JSON.stringify({ order_id: $json.order_id, event_type: $json.change, actor_kind: 'system' }) }}",
                    },
                },
                type: 'n8n-nodes-base.postgres',
                typeVersion: 2.6,
                position: [480, 180],
                id: 'recon-event',
                name: 'Registrar evento',
                credentials: PG_CREDENTIAL,
                onError: 'continueRegularOutput',
            },
            {
                // Corre una vez por orden corregida. Se reusa el mismo SQL de
                // aviso que los demás flujos, así el doctor recibe la tarjeta
                // idéntica venga de donde venga.
                parameters: {
                    operation: 'executeQuery',
                    query: NOTIFY_DOCTOR_SQL,
                    options: { queryReplacement: '={{ [ $json.order_id, $json.change, \'\' ] }}' },
                },
                type: 'n8n-nodes-base.postgres',
                typeVersion: 2.6,
                position: [480, 0],
                id: 'recon-notify',
                name: 'Notificar',
                credentials: PG_CREDENTIAL,
                onError: 'continueRegularOutput',
            },
            {
                parameters: {
                    workflowId: { __rl: true, value: EVENTS_WORKFLOW_ID, mode: 'list', cachedResultName: 'Events' },
                    mode: 'each',
                    workflowInputs: {
                        mappingMode: 'defineBelow',
                        value: {
                            event_type: 'study_order_status_changed',
                            user_ids: '={{ [$json.user_id] }}',
                            channels: '={{ [] }}',
                            payload: '={{ $json }}',
                        },
                    },
                },
                type: 'n8n-nodes-base.executeWorkflow',
                typeVersion: 1.2,
                position: [720, 0],
                id: 'recon-push',
                name: 'Empujar por SSE',
                onError: 'continueRegularOutput',
            },
        ],
        connections: {
            'Cada 2 horas': { main: [[{ node: 'Reconciliar', type: 'main', index: 0 }]] },
            Reconciliar:    { main: [[
                { node: 'Registrar evento', type: 'main', index: 0 },
                { node: 'Notificar', type: 'main', index: 0 },
            ]] },
            Notificar:      { main: [[{ node: 'Empujar por SSE', type: 'main', index: 0 }]] },
        },
        settings: { executionOrder: 'v1' },
        tags: ['study-orders', 'clinic'],
    };
}

// ── Ensamblado ───────────────────────────────────────────────────────────────
mkdirSync(OUT_DIR, { recursive: true });

for (const wf of workflows) {
    const nodes = [
        stickyNode(`${wf.id}-doc`, wf.sticky, [-560, -180]),
        webhookNode(wf.method, wf.path, wf.id, wf.isPublic === true),
        codeNode('Validar Datos', `${wf.id}-val`, wf.validate, [220, 0]),
        {
            // Los errores de validación cortan antes de tocar la base.
            parameters: {
                conditions: {
                    options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
                    conditions: [{
                        id: `${wf.id}-cond`,
                        leftValue: '={{ $json.__error }}',
                        rightValue: true,
                        operator: { type: 'boolean', operation: 'true', singleValue: true },
                    }],
                    combinator: 'and',
                },
                options: {},
            },
            type: 'n8n-nodes-base.if',
            typeVersion: 2.2,
            position: [440, 0],
            id: `${wf.id}-if`,
            name: '¿Hubo error?',
        },
        postgresNode(`${wf.id}-sql`, wf.sql, wf.replacement, [660, 120]),
        codeNode('Formatear Respuesta', `${wf.id}-fmt`, wf.format, [880, 120]),
        {
            parameters: {
                conditions: {
                    options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
                    conditions: [{
                        id: `${wf.id}-cond2`,
                        leftValue: '={{ $json.__error }}',
                        rightValue: true,
                        operator: { type: 'boolean', operation: 'true', singleValue: true },
                    }],
                    combinator: 'and',
                },
                options: {},
            },
            type: 'n8n-nodes-base.if',
            typeVersion: 2.2,
            position: [1100, 120],
            id: `${wf.id}-if2`,
            name: '¿Error de negocio?',
        },
        respondNode(`${wf.id}-ok`, 'Responder OK', [1320, 220], RESPOND_OK, 200),
        respondNode(`${wf.id}-err`, 'Responder Error', [1320, -60], RESPOND_ERR, '={{ $json.__code || 400 }}'),
        ...(wf.event ? [eventNode(wf.id, wf.event.replacement)] : []),
        ...(notifyList(wf).length ? notifyNodes(wf.id, notifyList(wf)) : []),
    ];

    const connections = {
        Webhook: { main: [[{ node: 'Validar Datos', type: 'main', index: 0 }]] },
        'Validar Datos': { main: [[{ node: '¿Hubo error?', type: 'main', index: 0 }]] },
        '¿Hubo error?': {
            main: [
                [{ node: 'Responder Error', type: 'main', index: 0 }],   // true  → error
                [{ node: 'Consulta', type: 'main', index: 0 }],          // false → sigue
            ],
        },
        Consulta: {
            main: [
                [{ node: 'Formatear Respuesta', type: 'main', index: 0 }],
                [{ node: 'Responder Error', type: 'main', index: 0 }],   // salida de error de Postgres
            ],
        },
        'Formatear Respuesta': { main: [[{ node: '¿Error de negocio?', type: 'main', index: 0 }]] },
        // "Responder OK" dispara en paralelo la bitácora y el aviso: n8n sigue
        // ejecutando después de responder al webhook, así que el cliente no
        // espera por ninguno de los dos, y que uno falle no afecta al otro.
        ...((notifyList(wf).length || wf.event)
            ? {
                'Responder OK': {
                    main: [[
                        ...(wf.event ? [{ node: 'Registrar evento', type: 'main', index: 0 }] : []),
                        ...notifyList(wf).map((n) => ({
                            node: notifyList(wf).length > 1 ? `Notificar ${n.to}` : 'Notificar',
                            type: 'main', index: 0,
                        })),
                    ]],
                },
                ...Object.fromEntries(notifyList(wf).map((n) => {
                    const many = notifyList(wf).length > 1;
                    return [
                        many ? `Notificar ${n.to}` : 'Notificar',
                        { main: [[{ node: many ? `Empujar por SSE ${n.to}` : 'Empujar por SSE', type: 'main', index: 0 }]] },
                    ];
                })),
            }
            : {}),
        '¿Error de negocio?': {
            main: [
                [{ node: 'Responder Error', type: 'main', index: 0 }],
                [{ node: 'Responder OK', type: 'main', index: 0 }],
            ],
        },
    };

    const workflow = {
        name: wf.name,
        nodes,
        connections,
        settings: { executionOrder: 'v1' },
        tags: ['study-orders', 'clinic'],
    };

    writeFileSync(join(OUT_DIR, wf.file), JSON.stringify(workflow, null, 2) + '\n', 'utf8');
    console.log(`  ${wf.method.padEnd(6)} /${wf.path.padEnd(28)} → ${wf.file}`);
}

writeFileSync(join(OUT_DIR, 'study-orders-reconcile.json'),
    JSON.stringify(reconcileWorkflow(), null, 2) + '\n');
console.log('  CRON   cada 2 horas               → study-orders-reconcile.json');

console.log(`\n${workflows.length + 1} workflows escritos en n8n-workflows/`);
