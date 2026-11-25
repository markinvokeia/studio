#!/usr/bin/env node
/**
 * Genera los flujos del frente y el dorso de una orden cargada a mano (C09.1a):
 *
 *   POST /study-orders/images/upload   multipart: order_id, side (front | back), file
 *   POST /study-orders/images/delete   { order_id, side }
 *   GET  /study-orders/images/file?order_id=<uuid>&id=<attachments.id>
 *
 * Los archivos van a Drive con Attachements CRUD (source_name = study_order_front | study_order_back,
 * source_id = la orden). El navegador nunca habla con Drive. El SQL está en study-orders-sql.mjs.
 *
 *   node scripts/n8n/generate-study-order-image-workflows.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { IMAGE_FILE_SQL, IMAGE_GATE_SQL, IMAGE_RESULT_SQL } from './study-orders-sql.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT_DIR = join(ROOT, 'n8n-workflows');

const JWT = { jwtAuth: { id: 'C6sB1r7ab5H5EmJj', name: 'JWT Auth account' } };
const PG = { postgres: { id: '6b7Sjdnppbfve8ka', name: 'Postgres account' } };
const GDRIVE = { googleDriveOAuth2Api: { id: 'k3vQaAkau21se8nC', name: 'Google Drive account 2' } };
const ATTACHMENTS_WORKFLOW_ID = 'TTwyLGp8Gg9qDKdn';

/** El mismo límite que el front (STUDY_ORDER_IMAGE_LIMITS en src/services/study-orders.ts). */
const MAX_BYTES = 10 * 1024 * 1024;

const RESPOND_OK = '={{ { code: 200, message: $json.__message || "OK", data: $json.__data } }}';
const RESPOND_ERR = '={{ { code: $json.__code || 500, message: $json.__message || "No se pudo completar la operación", data: null } }}';
const UUID_RE = '/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i';

/** Arma un workflow con `add` (nodos) y `link` (conexiones), como el de la importación. */
function builder(prefix) {
    const nodes = [];
    const connections = {};
    const add = (name, type, typeVersion, parameters, position, extra = {}) => {
        nodes.push({ parameters, type, typeVersion, position, id: `${prefix}-${nodes.length + 1}`, name, ...extra });
    };
    const link = (from, to, out = 0) => {
        const c = (connections[from] ||= { main: [] });
        while (c.main.length <= out) c.main.push([]);
        c.main[out].push({ node: to, type: 'main', index: 0 });
    };
    const ifNode = (name, expr, position) => add(name, 'n8n-nodes-base.if', 2.2, {
        conditions: {
            options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
            conditions: [{ id: `${prefix}-${nodes.length + 1}-cond`, leftValue: expr, rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }],
            combinator: 'and',
        },
        options: {},
    }, position);
    const pg = (name, query, queryReplacement, position, extra = {}) => add(name, 'n8n-nodes-base.postgres', 2.6, {
        operation: 'executeQuery', query, options: { queryReplacement },
    }, position, { credentials: PG, ...extra });
    const code = (name, jsCode, position) => add(name, 'n8n-nodes-base.code', 2, { jsCode }, position);
    const respond = (name, body, responseCode, position) => add(name, 'n8n-nodes-base.respondToWebhook', 1.4, {
        respondWith: 'json', responseBody: body, options: { responseCode },
    }, position);
    return { nodes, connections, add, link, ifNode, pg, code, respond };
}

const x = (i) => i * 240;

const NOT_EDITABLE = '={{ { code: 409, message: "No se pueden cambiar las imágenes: la orden ya no es un borrador o no tenés permiso", data: null } }}';

/** Llamada a Attachements CRUD, un item a la vez. */
const attachmentsNode = (value) => ({
    workflowId: { __rl: true, value: ATTACHMENTS_WORKFLOW_ID, mode: 'list', cachedResultName: 'Attachements CRUD' },
    mode: 'each',
    workflowInputs: {
        mappingMode: 'defineBelow',
        value,
        matchingColumns: [],
        schema: ['action', 'source_name', 'source_id', 'attachment_id'].map((id) => ({
            id, displayName: id, required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string', removed: !(id in value),
        })),
        attemptToConvertTypes: false,
        convertFieldsToString: true,
    },
    options: {},
});

const COMMON_VALIDATION = `const userId = $json.jwtPayload?.userId;
if (!userId) return [{ json: { __error: true, __code: 401, __message: 'Token sin userId' } }];
const b = $json.body || {};
const orderId = (b.order_id || '').toString().trim();
const side = (b.side || '').toString().trim();
if (!${UUID_RE}.test(orderId)) return [{ json: { __error: true, __code: 400, __message: 'order_id es requerido' } }];
if (!['front', 'back'].includes(side)) return [{ json: { __error: true, __code: 400, __message: 'side debe ser front o back' } }];
`;

/** Webhook, validación y permiso: lo que comparten subir y quitar. */
function start(b, { path, webhookId, sticky, validate }) {
    b.add('Contrato', 'n8n-nodes-base.stickyNote', 1, {
        content: sticky + '\n\nNo editar a mano: `scripts/n8n/generate-study-order-image-workflows.mjs`.', height: 320, width: 520, color: 4,
    }, [-600, -260]);
    b.add('Webhook', 'n8n-nodes-base.webhook', 2.1, {
        httpMethod: 'POST', path, authentication: 'jwtAuth', responseMode: 'responseNode', options: { allowedOrigins: '*' },
    }, [x(0), 0], { webhookId, credentials: JWT });
    b.code('Validar Datos', validate, [x(1), 0]);
    b.link('Webhook', 'Validar Datos');
    b.ifNode('¿Datos OK?', '={{ !$json.__error }}', [x(2), 0]);
    b.link('Validar Datos', '¿Datos OK?');
    b.respond('Responder Error', RESPOND_ERR, '={{ $json.__code || 500 }}', [x(3), 260]);
    b.link('¿Datos OK?', 'Responder Error', 1);
    // Sin filas igual llega al IF (alwaysOutputData) y responde 409. Un error de SQL corta el flujo: 500.
    b.pg('Permiso', IMAGE_GATE_SQL, '={{ [ $json.user_id, $json.order_id, $json.side ] }}', [x(3), 0], { alwaysOutputData: true });
    b.link('¿Datos OK?', 'Permiso', 0);
    b.ifNode('¿Editable?', '={{ !!$json.order_id }}', [x(4), 0]);
    b.link('Permiso', '¿Editable?');
    b.respond('Responder 409', NOT_EDITABLE, 409, [x(5), 260]);
    b.link('¿Editable?', 'Responder 409', 1);
}

/** Resultado contra la base, respuesta y, si corresponde, el error. */
function finish(b, { action, from, col, okMessage, errorMessage }) {
    b.pg('Resultado', IMAGE_RESULT_SQL,
        `={{ [ $('Validar Datos').first().json.user_id, $('Permiso').first().json.order_id, $('Validar Datos').first().json.side, '${action}', JSON.stringify($('Permiso').first().json.previous || []) ] }}`,
        [x(col), 0]);
    b.link(from, 'Resultado');
    b.code('Formatear Respuesta', `const row = $input.first().json;
if (row.ok !== true) return [{ json: { __error: true, __code: 502, __message: '${errorMessage}' } }];
return [{ json: { __data: { images: row.images || [] }, __message: '${okMessage}' } }];`, [x(col + 1), 0]);
    b.link('Resultado', 'Formatear Respuesta');
    b.ifNode('¿Guardado?', '={{ !$json.__error }}', [x(col + 2), 0]);
    b.link('Formatear Respuesta', '¿Guardado?');
    b.respond('Responder OK', RESPOND_OK, 200, [x(col + 3), 0]);
    b.link('¿Guardado?', 'Responder OK', 0);
    b.link('¿Guardado?', 'Responder Error', 1);
}

function uploadWorkflow() {
    const b = builder('img-up');
    start(b, {
        path: 'study-orders/images/upload', webhookId: 'study-orders-img-upload',
        sticky: `## POST /study-orders/images/upload (generado)

Guarda el frente o el dorso de una orden **en borrador**. Reemplaza al que hubiera.

**multipart:** \`order_id\`, \`side\` (front | back), \`file\` (JPG, PNG, WEBP o PDF, hasta 10 MB).

**409** si no es un borrador o no se puede editar. **502** si Drive no guardó el archivo (la imagen anterior queda).`,
        validate: COMMON_VALIDATION + `
const bin = $input.first().binary || {};
const key = Object.keys(bin)[0];
if (!key) return [{ json: { __error: true, __code: 400, __message: 'Falta el archivo' } }];
const f = bin[key];
const mime = String(f.mimeType || '').toLowerCase().split(';')[0].trim();
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };
if (!EXT[mime]) return [{ json: { __error: true, __code: 400, __message: 'Formato no admitido. Usá JPG, PNG, WEBP o PDF.' } }];
const buf = await this.helpers.getBinaryDataBuffer(0, key);
if (buf.length === 0) return [{ json: { __error: true, __code: 400, __message: 'El archivo está vacío' } }];
if (buf.length > ${MAX_BYTES}) return [{ json: { __error: true, __code: 400, __message: 'El archivo supera los 10 MB' } }];
return [{
  json: { user_id: String(userId), order_id: orderId, side, mime, ext: EXT[mime] },
  binary: { data: f },
}];`,
    });
    b.code('Preparar Archivo', `// El binario va en 'data' (lo que espera Attachements CRUD), con un nombre que se reconoce en Drive.
const gate = $('Permiso').first().json;
const v = $('Validar Datos').first();
const fileName = gate.order_number + '-' + (v.json.side === 'front' ? 'frente' : 'dorso') + '.' + v.json.ext;
return [{
  json: { order_id: gate.order_id, side: v.json.side },
  binary: { data: { ...v.binary.data, fileName, mimeType: v.json.mime } },
}];`, [x(5), 0]);
    b.link('¿Editable?', 'Preparar Archivo', 0);
    b.add('Guardar Adjunto', 'n8n-nodes-base.executeWorkflow', 1.2, attachmentsNode({
        action: 'UPLOAD', source_name: "={{ 'study_order_' + $json.side }}", source_id: '={{ $json.order_id }}',
    }), [x(6), 0], { onError: 'continueRegularOutput', alwaysOutputData: true });
    b.link('Preparar Archivo', 'Guardar Adjunto');
    finish(b, {
        action: 'upload', from: 'Guardar Adjunto', col: 7,
        okMessage: 'Imagen guardada', errorMessage: 'No se pudo guardar la imagen. Probá de nuevo.',
    });
    // Ya respondido: se borran las anteriores de ese lado. Si falla, la que vale sigue siendo la última.
    b.code('Anteriores', `return ($('Permiso').first().json.previous || []).map((p) => ({ json: { attachment_id: String(p.id) } }));`, [x(11), 0]);
    b.link('Responder OK', 'Anteriores');
    b.add('Borrar Anteriores', 'n8n-nodes-base.executeWorkflow', 1.2, attachmentsNode({
        action: 'DELETE', attachment_id: '={{ $json.attachment_id }}',
    }), [x(12), 0], { onError: 'continueRegularOutput' });
    b.link('Anteriores', 'Borrar Anteriores');
    return { name: 'Study Orders - Image Upload', nodes: b.nodes, connections: b.connections, settings: { executionOrder: 'v1' }, tags: ['study-orders', 'clinic'] };
}

function deleteWorkflow() {
    const b = builder('img-del');
    start(b, {
        path: 'study-orders/images/delete', webhookId: 'study-orders-img-delete',
        sticky: `## POST /study-orders/images/delete (generado)

Quita el frente o el dorso de una orden **en borrador** (también de Drive).

**Body:** \`{ "order_id": "uuid", "side": "front" | "back" }\`

**409** si no es un borrador o no se puede editar.`,
        validate: COMMON_VALIDATION + `return [{ json: { user_id: String(userId), order_id: orderId, side } }];`,
    });
    b.ifNode('¿Hay imagen?', '={{ ($json.previous || []).length > 0 }}', [x(5), 0]);
    b.link('¿Editable?', '¿Hay imagen?', 0);
    b.code('Separar', `return $json.previous.map((p) => ({ json: { attachment_id: String(p.id) } }));`, [x(6), -120]);
    b.link('¿Hay imagen?', 'Separar', 0);
    b.add('Borrar Adjunto', 'n8n-nodes-base.executeWorkflow', 1.2, attachmentsNode({
        action: 'DELETE', attachment_id: '={{ $json.attachment_id }}',
    }), [x(7), -120], { onError: 'continueRegularOutput', alwaysOutputData: true });
    b.link('Separar', 'Borrar Adjunto');
    b.code('Juntar', `return [{ json: {} }];`, [x(8), 0]);
    b.link('Borrar Adjunto', 'Juntar');
    b.link('¿Hay imagen?', 'Juntar', 1);
    finish(b, {
        action: 'delete', from: 'Juntar', col: 9,
        okMessage: 'Imagen quitada', errorMessage: 'No se pudo quitar la imagen. Probá de nuevo.',
    });
    return { name: 'Study Orders - Image Delete', nodes: b.nodes, connections: b.connections, settings: { executionOrder: 'v1' }, tags: ['study-orders', 'clinic'] };
}

function fileWorkflow() {
    const { nodes, connections, add, link, ifNode, pg, code, respond } = builder('img-file');

    add('Contrato', 'n8n-nodes-base.stickyNote', 1, {
        content: `## GET /study-orders/images/file (generado)

El frente o el dorso de una orden, bajado de Drive. El navegador nunca habla con Drive.

**Query:** \`order_id\` (uuid), \`id\` (attachments.id).

El SQL exige todo a la vez: que el archivo sea de esa orden y que el usuario pueda abrirla (misma regla que el detalle). **404** si falta cualquiera.

No editar a mano: \`scripts/n8n/generate-study-order-image-workflows.mjs\`.`,
        height: 300, width: 520, color: 4,
    }, [-600, -260]);

    add('Webhook', 'n8n-nodes-base.webhook', 2.1, {
        httpMethod: 'GET',
        path: 'study-orders/images/file',
        authentication: 'jwtAuth',
        responseMode: 'responseNode',
        options: { allowedOrigins: '*' },
    }, [x(0), 0], { webhookId: 'study-orders-img-file', credentials: JWT });

    code('Validar Datos', `const userId = $json.jwtPayload?.userId;
if (!userId) return [{ json: { __error: true, __code: 401, __message: 'Token sin userId' } }];
const q = $json.query || {};
const orderId = (q.order_id || '').toString().trim();
const fileId = parseInt(q.id, 10);
if (!${UUID_RE}.test(orderId) || !Number.isFinite(fileId)) {
  return [{ json: { __error: true, __code: 400, __message: 'order_id e id son requeridos' } }];
}
return [{ json: { user_id: String(userId), order_id: orderId, file_id: fileId } }];`, [x(1), 0]);
    link('Webhook', 'Validar Datos');

    ifNode('¿Datos OK?', '={{ !$json.__error }}', [x(2), 0]);
    link('Validar Datos', '¿Datos OK?');
    respond('Responder Error', RESPOND_ERR, '={{ $json.__code || 400 }}', [x(3), 220]);
    link('¿Datos OK?', 'Responder Error', 1);

    pg('Buscar Archivo', IMAGE_FILE_SQL, '={{ [ $json.user_id, $json.order_id, $json.file_id ] }}', [x(3), 0],
        { alwaysOutputData: true });
    link('¿Datos OK?', 'Buscar Archivo', 0);

    ifNode('¿Encontrado?', '={{ !!$json.drive_file_id }}', [x(4), 0]);
    link('Buscar Archivo', '¿Encontrado?');

    add('Descargar de Drive', 'n8n-nodes-base.googleDrive', 3, {
        operation: 'download', fileId: { __rl: true, value: '={{ $json.drive_file_id }}', mode: 'id' }, options: {},
    }, [x(5), -80], { credentials: GDRIVE });
    link('¿Encontrado?', 'Descargar de Drive', 0);

    add('Responder Archivo', 'n8n-nodes-base.respondToWebhook', 1.4, {
        respondWith: 'binary', options: { responseCode: 200 },
    }, [x(6), -80]);
    link('Descargar de Drive', 'Responder Archivo');

    respond('Responder 404', '={{ { code: 404, message: "Archivo no encontrado o sin permiso", data: null } }}', 404, [x(5), 120]);
    link('¿Encontrado?', 'Responder 404', 1);

    return { name: 'Study Orders - Image File', nodes, connections, settings: { executionOrder: 'v1' }, tags: ['study-orders', 'clinic'] };
}

mkdirSync(OUT_DIR, { recursive: true });
for (const [file, wf] of [
    ['study-orders-image-upload.json', uploadWorkflow()],
    ['study-orders-image-delete.json', deleteWorkflow()],
    ['study-orders-image-file.json', fileWorkflow()],
]) {
    writeFileSync(join(OUT_DIR, file), JSON.stringify(wf, null, 2) + '\n', 'utf8');
    console.log(`  ${file} (${wf.nodes.length} nodos)`);
}
