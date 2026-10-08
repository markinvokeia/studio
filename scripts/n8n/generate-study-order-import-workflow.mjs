#!/usr/bin/env node
/**
 * generate-study-order-import-workflow.mjs
 * ---------------------------------------------------------------------------
 * Genera n8n-workflows/study-orders-import.json: importar una orden de estudio
 * desde Invoke subiendo sus fotos o el PDF (docs/whatsapp-ordenes-estudio-plan.md, §24).
 *
 *   node scripts/n8n/generate-study-order-import-workflow.mjs
 *
 * Dos webhooks en el mismo flujo:
 *
 *   POST /study-orders/import         multipart: file0, file1, ... (frente, dorso, hojas de UNA orden)
 *     → abre un intake (channel = 'import'), guarda los originales en Drive (Attachements CRUD,
 *       source_name = 'whatsapp_order_intake', como los de WhatsApp) y RESPONDE 202 con el id.
 *     → después, ya sin el navegador esperando: lee la orden con el subflujo
 *       "WhatsApp - Study Order Intake" en modo 'import', crea el BORRADOR (mismo SQL que
 *       /study-orders/upsert, sin doctor y con source_intake_id), le guarda los puntos a revisar
 *       (bloqueantes) y cierra el intake (order_created, o failed si no se pudo crear).
 *
 *   GET /study-orders/import/status?intake_id=<uuid>
 *     → { status: processing | done | failed, order_id, order_number, ... } para que la pantalla
 *       espere la lectura (tarda lo que tarde el modelo de visión).
 *
 * Requiere STUDY_ORDERS_CREATE_FOR_DOCTOR y STUDY_ORDERS_VIEW_ALL (lo valida el SQL).
 * ---------------------------------------------------------------------------
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    IMPORT_CLOSE_SQL, IMPORT_CREATE_INTAKE_SQL, IMPORT_SAVE_MEDIA_SQL, IMPORT_STATUS_SQL,
    LOG_EVENT_SQL, REVIEW_ITEMS_INSERT_SQL, UPSERT_SQL,
} from './study-orders-sql.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'n8n-workflows', 'study-orders-import.json');

const JWT = { jwtAuth: { id: 'C6sB1r7ab5H5EmJj', name: 'JWT Auth account' } };
const PG = { postgres: { id: '6b7Sjdnppbfve8ka', name: 'Postgres account' } };
/** Ids de la instancia (los mismos que usa WhatsApp - Order Agent). */
const ATTACHMENTS_WORKFLOW_ID = 'TTwyLGp8Gg9qDKdn';
const INTAKE_WORKFLOW_ID = '4xw9aaT2yX021WW1';

const MAX_FILES = 6;
const MAX_BYTES = 10 * 1024 * 1024;

const nodes = [];
const connections = {};
const add = (name, type, typeVersion, parameters, position, extra = {}) => {
    nodes.push({ parameters, type, typeVersion, position, id: `so-import-${nodes.length + 1}`, name, ...extra });
};
const link = (from, to, out = 0) => {
    const c = (connections[from] ||= { main: [] });
    while (c.main.length <= out) c.main.push([]);
    c.main[out].push({ node: to, type: 'main', index: 0 });
};
const x = (i) => i * 240;

const ifNode = (name, id, expr, position) => add(name, 'n8n-nodes-base.if', 2.2, {
    conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [{ id, leftValue: expr, rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }],
        combinator: 'and',
    },
    options: {},
}, position);

const pg = (name, query, queryReplacement, position, extra = {}) => add(name, 'n8n-nodes-base.postgres', 2.6, {
    operation: 'executeQuery', query, options: { queryReplacement },
}, position, { credentials: PG, alwaysOutputData: true, ...extra });

const respond = (name, body, code, position) => add(name, 'n8n-nodes-base.respondToWebhook', 1.4, {
    respondWith: 'json', responseBody: body, options: { responseCode: code },
}, position);

const RESPOND_ERR = '={{ { code: $json.__code || 400, message: $json.__message || "Error", data: null } }}';

// ════════════════════════════════════════════════════════════════════════════
// POST /study-orders/import
// ════════════════════════════════════════════════════════════════════════════
add('Import: Webhook', 'n8n-nodes-base.webhook', 2.1, {
    httpMethod: 'POST',
    path: 'study-orders/import',
    authentication: 'jwtAuth',
    responseMode: 'responseNode',
    options: { allowedOrigins: '*' },
}, [x(0), 0], { webhookId: 'study-orders-import', credentials: JWT });

add('Import: Validate', 'n8n-nodes-base.code', 2, {
    jsCode: `// Los archivos llegan como binarios del webhook (uno por campo del multipart). Se valida
// cantidad, tipo y tamaño antes de abrir nada: un archivo que el modelo no puede leer (HEIC,
// Word...) se rechaza acá con un mensaje claro en lugar de terminar en un borrador vacío.
const userId = $json.jwtPayload?.userId;
if (!userId) return [{ json: { __error: true, __code: 401, __message: 'Token sin userId' } }];

const MAX_FILES = ${MAX_FILES};
const MAX_BYTES = ${MAX_BYTES};
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const bin = $input.first().binary || {};
const keys = Object.keys(bin).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
if (keys.length === 0) return [{ json: { __error: true, __code: 400, __message: 'Subí al menos una foto o PDF de la orden.' } }];
if (keys.length > MAX_FILES) return [{ json: { __error: true, __code: 400, __message: 'Una orden admite hasta ' + MAX_FILES + ' archivos.' } }];

const files = [];
for (let i = 0; i < keys.length; i++) {
  const b = bin[keys[i]];
  const mime = String(b.mimeType || '').toLowerCase().split(';')[0].trim();
  const name = String(b.fileName || keys[i]);
  if (!ALLOWED.includes(mime)) {
    return [{ json: { __error: true, __code: 400, __message: 'Formato no admitido: ' + name + '. Usá JPG, PNG, WEBP o PDF.' } }];
  }
  const buf = await this.helpers.getBinaryDataBuffer(0, keys[i]);
  if (buf.length === 0) return [{ json: { __error: true, __code: 400, __message: 'El archivo ' + name + ' está vacío.' } }];
  if (buf.length > MAX_BYTES) return [{ json: { __error: true, __code: 400, __message: 'El archivo ' + name + ' supera los 10 MB.' } }];
  files.push({ key: keys[i], file_name: name, mime, size: buf.length });
}
return [{ json: { user_id: String(userId), files }, binary: bin }];`,
}, [x(1), 0]);
link('Import: Webhook', 'Import: Validate');

ifNode('Import: Input OK?', 'so-import-input-ok', '={{ !$json.__error }}', [x(2), 0]);
link('Import: Validate', 'Import: Input OK?');
respond('Import: Respond Error', RESPOND_ERR, '={{ $json.__code || 400 }}', [x(3), 220]);
link('Import: Input OK?', 'Import: Respond Error', 1);

pg('Import: Create Intake', IMPORT_CREATE_INTAKE_SQL, '={{ [ $json.user_id ] }}', [x(3), 0]);
link('Import: Input OK?', 'Import: Create Intake', 0);

ifNode('Import: Allowed?', 'so-import-allowed', '={{ !!$json.id }}', [x(4), 0]);
link('Import: Create Intake', 'Import: Allowed?');
respond('Import: Respond Forbidden',
    '={{ { code: 403, message: "No tenés permiso para importar órdenes", data: null } }}', 403, [x(5), 220]);
link('Import: Allowed?', 'Import: Respond Forbidden', 1);

add('Import: Split Files', 'n8n-nodes-base.code', 2, {
    jsCode: `// Un item por archivo, con el binario en 'data' (lo que espera Attachements CRUD) y un nombre
// que identifica la importación: el original queda reconocible en Drive.
const intakeId = $('Import: Allowed?').first().json.id;
const v = $('Import: Validate').first();
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };
return v.json.files.map((f, idx) => {
  const fileName = 'orden-importada-' + intakeId.slice(0, 8) + '-' + (idx + 1) + '.' + (EXT[f.mime] || 'bin');
  return {
    json: { intake_id: intakeId, seq: idx, file_name: fileName, original_name: f.file_name, mime: f.mime, size: f.size },
    binary: { data: { ...v.binary[f.key], fileName, mimeType: f.mime } },
  };
});`,
}, [x(5), 0]);
link('Import: Allowed?', 'Import: Split Files', 0);

add("Import: Store Original", 'n8n-nodes-base.executeWorkflow', 1.2, {
    workflowId: { __rl: true, value: ATTACHMENTS_WORKFLOW_ID, mode: 'list', cachedResultName: 'Attachements CRUD' },
    workflowInputs: {
        mappingMode: 'defineBelow',
        value: { action: 'UPLOAD', source_name: 'whatsapp_order_intake', source_id: '={{ $json.intake_id }}' },
        matchingColumns: [],
        schema: ['action', 'source_name', 'source_id'].map((id) => ({
            id, displayName: id, required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string', removed: false,
        })),
        attemptToConvertTypes: false,
        convertFieldsToString: true,
    },
    options: {},
}, [x(6), 0], { onError: 'continueRegularOutput' });
link('Import: Split Files', 'Import: Store Original');

add('Import: Collect Media', 'n8n-nodes-base.code', 2, {
    jsCode: `// Referencias de los originales (como las del agente en whatsapp_order_intakes.media). La salida
// de Attachements CRUD viene en el mismo orden que los archivos.
const metas = $('Import: Split Files').all().map((i) => i.json);
const res = $input.all();
const media = metas.map((m, k) => {
  const up = (res[k] && res[k].json) || {};
  const attachmentId = up.success === true && up.data ? (up.data.id ?? null) : null;
  return {
    kind: m.mime === 'application/pdf' ? 'document' : 'image', mime: m.mime, size: m.size,
    file_name: m.file_name, original_name: m.original_name, received_at: new Date().toISOString(),
    attachment_id: attachmentId, status: attachmentId ? 'stored' : 'upload_failed',
  };
});
return [{ json: { intake_id: $('Import: Allowed?').first().json.id, media: JSON.stringify(media),
                  stored: media.filter((m) => m.attachment_id).length } }];`,
}, [x(7), 0]);
link('Import: Store Original', 'Import: Collect Media');

pg('Import: Save Media', IMPORT_SAVE_MEDIA_SQL, '={{ [ $json.intake_id, $json.media ] }}', [x(8), 0]);
link('Import: Collect Media', 'Import: Save Media');

respond('Import: Respond Accepted',
    `={{ { code: 202, message: "Leyendo la orden", data: { intake_id: $('Import: Allowed?').first().json.id, files: $('Import: Collect Media').first().json.stored } } }}`,
    202, [x(9), 0]);
link('Import: Save Media', 'Import: Respond Accepted');

// ── Después de responder: leer, crear el borrador y cerrar el intake ────────
add('Import: Read Order', 'n8n-nodes-base.executeWorkflow', 1.2, {
    workflowId: { __rl: true, value: INTAKE_WORKFLOW_ID, mode: 'list', cachedResultName: 'WhatsApp - Study Order Intake' },
    workflowInputs: {
        mappingMode: 'defineBelow',
        value: { intake_id: `={{ $('Import: Allowed?').first().json.id }}`, mode: 'import', answers: '' },
        matchingColumns: [],
        schema: ['intake_id', 'mode', 'answers'].map((id) => ({
            id, displayName: id, required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string', removed: false,
        })),
        attemptToConvertTypes: false,
        convertFieldsToString: true,
    },
    options: {},
}, [x(10), 0], { onError: 'continueRegularOutput' });
link('Import: Respond Accepted', 'Import: Read Order');

add('Import: Build Draft', 'n8n-nodes-base.code', 2, {
    jsCode: `// El subflujo devuelve el cuerpo del borrador y los puntos a revisar. Si falló (error de n8n,
// del modelo o de Drive) el borrador se crea igual, vacío y con el motivo: recepción la carga
// mirando los originales, que ya están guardados.
const r = $input.first().json || {};
const intakeId = $('Import: Allowed?').first().json.id;
const userId = $('Import: Validate').first().json.user_id;
const ok = r.saved === true && r.order_payload && typeof r.order_payload === 'object';
const payload = ok ? r.order_payload : {
  without_doctor: true, source_intake_id: intakeId, referring_doctor_name: '', patient_id: '',
  patient_name: 'Paciente sin identificar (orden importada)', patient_document: '',
  regions: {}, section_modifiers: {}, texts: {}, delivery_methods: [], clinical_notes: '', items: [],
};
const review = ok ? (r.review_items || []) : [{
  code: 'read_failed', field: 'extraction', label: 'No se pudo leer la orden',
  detail: String(r.error && (r.error.message || r.error) || 'Error al procesar los archivos.').slice(0, 300),
}];
return [{ json: {
  user_id: userId, intake_id: intakeId,
  patient_id: payload.patient_id || '',
  payload: JSON.stringify(payload), review_items: JSON.stringify(review),
} }];`,
}, [x(11), 0]);
link('Import: Read Order', 'Import: Build Draft');

pg('Import: Create Draft', UPSERT_SQL, '={{ [ $json.user_id, $json.payload ] }}', [x(12), 0], { onError: 'continueRegularOutput' });
link('Import: Build Draft', 'Import: Create Draft');

ifNode('Import: Draft Created?', 'so-import-draft-created', '={{ !!$json.id }}', [x(13), 0]);
link('Import: Create Draft', 'Import: Draft Created?');

pg('Import: Save Review Items', REVIEW_ITEMS_INSERT_SQL,
    `={{ [ $('Import: Create Draft').first().json.id, $('Import: Build Draft').first().json.review_items, 'true' ] }}`,
    [x(14), -120], { onError: 'continueRegularOutput' });
link('Import: Draft Created?', 'Import: Save Review Items', 0);

pg('Import: Log Created', LOG_EVENT_SQL,
    `={{ JSON.stringify({ order_id: $('Import: Create Draft').first().json.id, event_type: 'created', actor_id: $('Import: Build Draft').first().json.user_id, metadata: { source: 'import', intake_id: $('Import: Build Draft').first().json.intake_id } }) }}`,
    [x(15), -120], { onError: 'continueRegularOutput' });
link('Import: Save Review Items', 'Import: Log Created');

pg('Import: Close Intake', IMPORT_CLOSE_SQL,
    `={{ [ $('Import: Build Draft').first().json.intake_id, $('Import: Create Draft').first().json.id || '', $('Import: Build Draft').first().json.patient_id ] }}`,
    [x(16), 0]);
link('Import: Log Created', 'Import: Close Intake');
link('Import: Draft Created?', 'Import: Close Intake', 1);

// ════════════════════════════════════════════════════════════════════════════
// GET /study-orders/import/status
// ════════════════════════════════════════════════════════════════════════════
const Y = 520;
add('Status: Webhook', 'n8n-nodes-base.webhook', 2.1, {
    httpMethod: 'GET',
    path: 'study-orders/import/status',
    authentication: 'jwtAuth',
    responseMode: 'responseNode',
    options: { allowedOrigins: '*' },
}, [x(0), Y], { webhookId: 'study-orders-import-status', credentials: JWT });

add('Status: Validate', 'n8n-nodes-base.code', 2, {
    jsCode: `const userId = $json.jwtPayload?.userId;
if (!userId) return [{ json: { __error: true, __code: 401, __message: 'Token sin userId' } }];
const intakeId = String(($json.query || {}).intake_id || '').trim();
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(intakeId)) {
  return [{ json: { __error: true, __code: 400, __message: 'intake_id es requerido' } }];
}
return [{ json: { user_id: String(userId), intake_id: intakeId } }];`,
}, [x(1), Y]);
link('Status: Webhook', 'Status: Validate');

ifNode('Status: Input OK?', 'so-import-status-ok', '={{ !$json.__error }}', [x(2), Y]);
link('Status: Validate', 'Status: Input OK?');
respond('Status: Respond Error', RESPOND_ERR, '={{ $json.__code || 400 }}', [x(3), Y + 200]);
link('Status: Input OK?', 'Status: Respond Error', 1);

pg('Status: Load', IMPORT_STATUS_SQL, '={{ [ $json.user_id, $json.intake_id ] }}', [x(3), Y]);
link('Status: Input OK?', 'Status: Load', 0);

ifNode('Status: Found?', 'so-import-status-found', '={{ !!$json.data }}', [x(4), Y]);
link('Status: Load', 'Status: Found?');
respond('Status: Respond', '={{ { code: 200, message: "OK", data: $json.data } }}', 200, [x(5), Y - 80]);
link('Status: Found?', 'Status: Respond', 0);
respond('Status: Respond Not Found', '={{ { code: 404, message: "Importación no encontrada", data: null } }}', 404, [x(5), Y + 100]);
link('Status: Found?', 'Status: Respond Not Found', 1);

// ── Notas ────────────────────────────────────────────────────────────────────
nodes.push({
    parameters: {
        width: 620, height: 400, color: 4,
        content: [
            '## Study Orders - Import (generado)',
            '',
            '**No editar a mano**: `scripts/n8n/generate-study-order-import-workflow.mjs`.',
            '',
            '**POST /study-orders/import** (multipart `file0`, `file1`, …; hasta ' + MAX_FILES + ' archivos JPG/PNG/WEBP/PDF de 10 MB): abre el intake (`channel = import`), guarda los originales en Drive y responde **202** `{ intake_id }`. Después lee la orden con `WhatsApp - Study Order Intake` (modo `import`), crea el **borrador** (sin doctor, `source_intake_id`) con los puntos a revisar bloqueantes y cierra el intake (`order_created` / `failed`).',
            '',
            '**GET /study-orders/import/status?intake_id=** → `{ status: processing | done | failed, order_id, order_number, items_total, review_pending }`.',
            '',
            'Permisos: STUDY_ORDERS_CREATE_FOR_DOCTOR + STUDY_ORDERS_VIEW_ALL. Requiere la migración 127.',
        ].join('\n'),
    },
    type: 'n8n-nodes-base.stickyNote', typeVersion: 1, position: [x(0), -300], id: 'so-import-note', name: 'Notas',
});

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({
    name: 'Study Orders - Import',
    nodes, connections, settings: { executionOrder: 'v1' }, tags: [],
}, null, 2) + '\n');
console.log(`Escrito ${OUT} (${nodes.length} nodos)`);
