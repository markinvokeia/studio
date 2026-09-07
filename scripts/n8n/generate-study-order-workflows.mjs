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
    LIST_SQL, NOTIFY_DOCTOR_SQL, NOTIFY_RECEPTION_SQL, OPTIONS_SQL,
    RESCHEDULE_SQL, SUBMIT_SQL, UPSERT_SQL,
} from './study-orders-sql.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT_DIR = join(ROOT, 'n8n-workflows');

const JWT_CREDENTIAL = { jwtAuth: { id: 'C6sB1r7ab5H5EmJj', name: 'JWT Auth account' } };
const PG_CREDENTIAL  = { postgres: { id: 'POSTGRES_CREDENTIAL_ID', name: 'Postgres' } };

/** Nodo webhook. `authentication: jwtAuth` hace que n8n verifique la firma. */
const webhookNode = (method, path, id) => ({
    parameters: {
        httpMethod: method,
        path,
        authentication: 'jwtAuth',
        responseMode: 'responseNode',
        options: { allowedOrigins: '*' },
    },
    type: 'n8n-nodes-base.webhook',
    typeVersion: 2.1,
    position: [0, 0],
    id: `${id}-wh`,
    name: 'Webhook',
    webhookId: `study-orders-${id}`,
    credentials: JWT_CREDENTIAL,
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
    sql: SUBMIT_SQL,
    replacement: '={{ [ $json.user_id, $json.id ] }}',
    notify: {
        sql: NOTIFY_RECEPTION_SQL,
        replacement: "={{ [ $('Validar Datos').first().json.id ] }}",
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
    sql: ACKNOWLEDGE_SQL,
    replacement: '={{ [ $json.user_id, $json.id ] }}',
    notify: {
        sql: NOTIFY_DOCTOR_SQL,
        replacement: "={{ [ $('Validar Datos').first().json.id, 'acknowledged' ] }}",
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
    sql: CANCEL_SQL,
    replacement: '={{ [ $json.user_id, $json.id, $json.reason ] }}',
    notify: {
        sql: NOTIFY_DOCTOR_SQL,
        replacement: "={{ [ $('Validar Datos').first().json.id, 'cancelled' ] }}",
        eventType: 'study_order_status_changed',
    },
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
    sql: RESCHEDULE_SQL,
    replacement: '={{ [ $json.user_id, $json.payload ] }}',
    notify: {
        sql: NOTIFY_DOCTOR_SQL,
        replacement: "={{ [ JSON.parse($('Validar Datos').first().json.payload).order_id, 'rescheduled' ] }}",
        eventType: 'study_order_status_changed',
    },
    format: formatCode(`
if (!rows.length) {
  return [{ json: { __error: true, __code: 409,
    __message: 'No se pudo mover la cita: no pertenece a esta orden, ya fue atendida o cancelada, o no tenés permiso' } }];
}
return [{ json: { __data: rows[0], __message: 'Cita reprogramada' } }];`),
});

/**
 * Nodos de notificación. Se cuelgan de "Responder OK": n8n sigue ejecutando
 * después de responder al webhook, así que el cliente no espera por esto.
 *
 * El id del workflow `Events` sale de los exports de la instancia; es el que
 * usan los flujos de citas para empujar por SSE.
 */
const EVENTS_WORKFLOW_ID = 'W5SZnwkaTigFrHO6';

function notifyNodes(id, sql, replacement, eventType) {
    return [
        {
            parameters: { operation: 'executeQuery', query: sql, options: { queryReplacement: replacement } },
            type: 'n8n-nodes-base.postgres',
            typeVersion: 2.6,
            position: [1540, 220],
            id: `${id}-notify`,
            name: 'Notificar',
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
                        event_type: eventType,
                        user_ids: '={{ [$json.user_id] }}',
                        channels: '={{ [] }}',
                        payload: '={{ $json }}',
                    },
                },
            },
            type: 'n8n-nodes-base.executeWorkflow',
            typeVersion: 1.2,
            position: [1760, 220],
            id: `${id}-push`,
            name: 'Empujar por SSE',
            onError: 'continueRegularOutput',
        },
    ];
}

// ── Ensamblado ───────────────────────────────────────────────────────────────
mkdirSync(OUT_DIR, { recursive: true });

for (const wf of workflows) {
    const nodes = [
        stickyNode(`${wf.id}-doc`, wf.sticky, [-560, -180]),
        webhookNode(wf.method, wf.path, wf.id),
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
        ...(wf.notify ? notifyNodes(wf.id, wf.notify.sql, wf.notify.replacement, wf.notify.eventType) : []),
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
        ...(wf.notify
            ? {
                'Responder OK': { main: [[{ node: 'Notificar', type: 'main', index: 0 }]] },
                Notificar: { main: [[{ node: 'Empujar por SSE', type: 'main', index: 0 }]] },
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

console.log(`\n${workflows.length} workflows escritos en n8n-workflows/`);
