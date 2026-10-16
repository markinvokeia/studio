#!/usr/bin/env node
/**
 * generate-study-order-message-workflows.mjs
 * ---------------------------------------------------------------------------
 * Genera los dos flujos del chatter que mueven archivos (docs/ordenes-estudio-chatter.md):
 *
 *   POST /study-orders/messages/post   multipart: order_id, kind, body, file0, file1, ...
 *     → valida (texto o archivos, tipo, tamaño), crea el mensaje, sube cada archivo a Drive con
 *       Attachements CRUD (source_name = 'study_order_message', source_id = id del mensaje),
 *       responde con el mensaje y sus adjuntos y, ya respondido, avisa a los seguidores.
 *     → n8n-workflows/study-orders-message-post.json
 *
 *   GET /study-orders/messages/file?message_id=<uuid>&id=<attachments.id>
 *     → el archivo, bajado de Drive. El navegador nunca habla con Drive.
 *     → n8n-workflows/study-orders-message-file.json
 *
 * No entran en el molde de generate-study-order-workflows.mjs (una consulta y responder): la
 * subida va entre la consulta y la respuesta. El SQL está en study-orders-sql.mjs.
 *
 *   node scripts/n8n/generate-study-order-message-workflows.mjs
 * ---------------------------------------------------------------------------
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    MESSAGE_FILE_SQL, MESSAGE_POST_SQL, MESSAGE_RESULT_SQL, NOTIFY_FOLLOWERS_SQL,
} from './study-orders-sql.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT_DIR = join(ROOT, 'n8n-workflows');

const JWT = { jwtAuth: { id: 'C6sB1r7ab5H5EmJj', name: 'JWT Auth account' } };
const PG = { postgres: { id: '6b7Sjdnppbfve8ka', name: 'Postgres account' } };
const GDRIVE = { googleDriveOAuth2Api: { id: 'k3vQaAkau21se8nC', name: 'Google Drive account 2' } };
/** Ids de la instancia (los mismos que usan la importación de órdenes y los avisos). */
const ATTACHMENTS_WORKFLOW_ID = 'TTwyLGp8Gg9qDKdn';
const EVENTS_WORKFLOW_ID = 'W5SZnwkaTigFrHO6';

/** Los mismos límites que el front (STUDY_ORDER_MESSAGE_LIMITS en src/services/study-orders.ts). */
const MAX_FILES = 5;
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_BODY = 5000;

const RESPOND_OK = '={{ { code: 200, message: $json.__message || "OK", data: $json.__data, meta: $json.__meta } }}';
const RESPOND_ERR = '={{ { code: $json.__code || 400, message: $json.__message || "Error", data: null } }}';
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

// ════════════════════════════════════════════════════════════════════════════
// POST /study-orders/messages/post
// ════════════════════════════════════════════════════════════════════════════
function messagePostWorkflow() {
    const { nodes, connections, add, link, ifNode, pg, code, respond } = builder('msg-post');

    add('Contrato', 'n8n-nodes-base.stickyNote', 1, {
        content: `## POST /study-orders/messages/post (generado)

Escribe en el chatter de la orden. **multipart/form-data** (también acepta JSON sin archivos).

**Campos:** \`order_id\`, \`kind\` (\`message\` | \`note\`), \`body\` (0-${MAX_BODY}), \`file0\`, \`file1\`, … (hasta ${MAX_FILES}: JPG, PNG, WEBP o PDF de 10 MB como máximo). Hace falta texto o al menos un archivo.

- **message**: lo ven todos los que pueden abrir la orden y avisa a cada seguidor con acceso, menos al autor (\`study_order_message\`, por SSE).
- **note**: interna de la clínica, requiere STUDY_ORDERS_VIEW_ALL y no avisa a nadie.

Requiere STUDY_ORDERS_MESSAGE y ser el doctor de la orden o tener VIEW_ALL. Quien escribe pasa a seguir la orden.

Los archivos van a Drive con **Attachements CRUD** (\`source_name = 'study_order_message'\`, \`source_id\` = id del mensaje). Si alguno falla, el mensaje queda y \`data.failed_attachments\` dice cuántos; si no tenía texto y no se guardó ninguno, se borra y responde **502**.

**409** sin permiso o sin acceso a la orden.

No editar a mano: \`scripts/n8n/generate-study-order-message-workflows.mjs\`.`,
        height: 520, width: 520, color: 4,
    }, [-600, -260]);

    add('Webhook', 'n8n-nodes-base.webhook', 2.1, {
        httpMethod: 'POST',
        path: 'study-orders/messages/post',
        authentication: 'jwtAuth',
        responseMode: 'responseNode',
        options: { allowedOrigins: '*' },
    }, [x(0), 0], { webhookId: 'study-orders-msg-post', credentials: JWT });

    code('Validar Datos', `// Los campos de texto llegan en body (multipart o JSON) y los archivos como binarios, uno por
// campo. Todo se valida antes de tocar la base: un archivo que no se puede mostrar se rechaza acá.
const userId = $json.jwtPayload?.userId;
if (!userId) return [{ json: { __error: true, __code: 401, __message: 'Token sin userId' } }];

const b = $json.body || {};
const orderId = (b.order_id || '').toString().trim();
if (!${UUID_RE}.test(orderId)) return [{ json: { __error: true, __code: 400, __message: 'order_id es requerido' } }];
const kind = (b.kind || '').toString().trim();
if (!['message', 'note'].includes(kind)) {
  return [{ json: { __error: true, __code: 400, __message: 'kind debe ser message o note' } }];
}
const text = (b.body ?? '').toString().trim();
if (text.length > ${MAX_BODY}) return [{ json: { __error: true, __code: 400, __message: 'El mensaje no puede superar los ${MAX_BODY} caracteres' } }];

const MAX_FILES = ${MAX_FILES};
const MAX_BYTES = ${MAX_BYTES};
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const bin = $input.first().binary || {};
const keys = Object.keys(bin).sort((a, c) => a.localeCompare(c, undefined, { numeric: true }));
if (keys.length > MAX_FILES) return [{ json: { __error: true, __code: 400, __message: 'Un mensaje admite hasta ' + MAX_FILES + ' archivos.' } }];

const files = [];
for (const key of keys) {
  const f = bin[key];
  const mime = String(f.mimeType || '').toLowerCase().split(';')[0].trim();
  const name = String(f.fileName || key);
  if (!ALLOWED.includes(mime)) {
    return [{ json: { __error: true, __code: 400, __message: 'Formato no admitido: ' + name + '. Usá JPG, PNG, WEBP o PDF.' } }];
  }
  const buf = await this.helpers.getBinaryDataBuffer(0, key);
  if (buf.length === 0) return [{ json: { __error: true, __code: 400, __message: 'El archivo ' + name + ' está vacío.' } }];
  if (buf.length > MAX_BYTES) return [{ json: { __error: true, __code: 400, __message: 'El archivo ' + name + ' supera los 10 MB.' } }];
  files.push({ key, file_name: name, mime, size: buf.length });
}
if (!text && files.length === 0) return [{ json: { __error: true, __code: 400, __message: 'El mensaje está vacío' } }];

return [{
  json: {
    user_id: String(userId),
    payload: JSON.stringify({ order_id: orderId, kind, body: text, attachment_count: files.length }),
    files,
  },
  binary: bin,
}];`, [x(1), 0]);
    link('Webhook', 'Validar Datos');

    ifNode('¿Datos OK?', '={{ !$json.__error }}', [x(2), 0]);
    link('Validar Datos', '¿Datos OK?');
    respond('Responder Error', RESPOND_ERR, '={{ $json.__code || 400 }}', [x(3), 260]);
    link('¿Datos OK?', 'Responder Error', 1);

    // alwaysOutputData: cero filas (sin permiso) tiene que llegar al IF y responder 409.
    pg('Publicar', MESSAGE_POST_SQL, '={{ [ $json.user_id, $json.payload ] }}', [x(3), 0],
        { alwaysOutputData: true, onError: 'continueErrorOutput' });
    link('¿Datos OK?', 'Publicar', 0);
    link('Publicar', 'Responder Error', 1);

    ifNode('¿Publicado?', '={{ !!$json.id }}', [x(4), 0]);
    link('Publicar', '¿Publicado?', 0);
    respond('Responder Sin Permiso',
        '={{ { code: 409, message: "No se pudo publicar: no tenés acceso a la orden o permiso para escribir", data: null } }}',
        409, [x(5), 260]);
    link('¿Publicado?', 'Responder Sin Permiso', 1);

    ifNode('¿Trae archivos?', `={{ $('Validar Datos').first().json.files.length > 0 }}`, [x(5), 0]);
    link('¿Publicado?', '¿Trae archivos?', 0);

    code('Separar Archivos', `// Un item por archivo, con el binario en 'data' (lo que espera Attachements CRUD). Se conserva
// el nombre original: es el que ve quien abre el adjunto en el chatter.
const messageId = $('Publicar').first().json.id;
const v = $('Validar Datos').first();
return v.json.files.map((f) => {
  const fileName = f.file_name.replace(/[\\\\/:*?"<>|]+/g, '_').slice(0, 180) || 'adjunto';
  return {
    json: { message_id: messageId, file_name: fileName, mime: f.mime, size: f.size },
    binary: { data: { ...v.binary[f.key], fileName, mimeType: f.mime } },
  };
});`, [x(6), -140]);
    link('¿Trae archivos?', 'Separar Archivos', 0);

    add('Guardar Adjunto', 'n8n-nodes-base.executeWorkflow', 1.2, {
        workflowId: { __rl: true, value: ATTACHMENTS_WORKFLOW_ID, mode: 'list', cachedResultName: 'Attachements CRUD' },
        workflowInputs: {
            mappingMode: 'defineBelow',
            value: { action: 'UPLOAD', source_name: 'study_order_message', source_id: '={{ $json.message_id }}' },
            matchingColumns: [],
            schema: ['action', 'source_name', 'source_id'].map((id) => ({
                id, displayName: id, required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string', removed: false,
            })),
            attemptToConvertTypes: false,
            convertFieldsToString: true,
        },
        options: {},
    }, [x(7), -140], { onError: 'continueRegularOutput' });
    link('Separar Archivos', 'Guardar Adjunto');

    // Lo que se guardó lo cuenta MESSAGE_RESULT_SQL contra la base: acá solo se junta en un item.
    code('Juntar', `return [{ json: { message_id: $('Publicar').first().json.id } }];`, [x(8), -140]);
    link('Guardar Adjunto', 'Juntar');

    pg('Resultado', MESSAGE_RESULT_SQL,
        `={{ [ $('Publicar').first().json.id, $('Validar Datos').first().json.files.length ] }}`,
        [x(9), 0], { alwaysOutputData: true, onError: 'continueErrorOutput' });
    link('Juntar', 'Resultado');
    link('¿Trae archivos?', 'Resultado', 1);
    link('Resultado', 'Responder Error', 1);

    code('Formatear Respuesta', `const row = $input.all().map((i) => i.json).find((r) => r && r.id) || null;
if (!row) {
  return [{ json: { __error: true, __code: 500, __message: 'No se pudo leer el mensaje publicado' } }];
}
if (row.deleted === true) {
  return [{ json: { __error: true, __code: 502, __message: 'No se pudieron guardar los archivos. Probá de nuevo.' } }];
}
const failed = Number(row.failed_attachments) || 0;
const { deleted, ...message } = row;
const done = row.kind === 'note' ? 'Nota registrada' : 'Mensaje enviado';
return [{ json: {
  __data: { ...message, attachments: Array.isArray(row.attachments) ? row.attachments : [], failed_attachments: failed },
  __message: failed > 0 ? done + ', pero ' + failed + (failed === 1 ? ' archivo no se pudo guardar' : ' archivos no se pudieron guardar') : done,
} }];`, [x(10), 0]);
    link('Resultado', 'Formatear Respuesta', 0);

    ifNode('¿Error de negocio?', '={{ !!$json.__error }}', [x(11), 0]);
    link('Formatear Respuesta', '¿Error de negocio?');
    link('¿Error de negocio?', 'Responder Error', 0);
    respond('Responder OK', RESPOND_OK, 200, [x(12), 120]);
    link('¿Error de negocio?', 'Responder OK', 1);

    // ── Ya respondido: aviso a los seguidores (n8n sigue ejecutando, el cliente no espera) ──
    pg('Notificar', NOTIFY_FOLLOWERS_SQL, `={{ [ $('Publicar').first().json.id ] }}`, [x(13), 120],
        { onError: 'continueRegularOutput' });
    link('Responder OK', 'Notificar');

    // Sin filas (nota, o nadie más con acceso) Postgres igual emite { success: true }: sin este
    // filtro Events recibe user_ids [undefined] y responde 422.
    ifNode('¿Hay a quién avisar?', '={{ !!$json.user_id }}', [x(14), 120]);
    link('Notificar', '¿Hay a quién avisar?');

    add('Empujar por SSE', 'n8n-nodes-base.executeWorkflow', 1.2, {
        workflowId: { __rl: true, value: EVENTS_WORKFLOW_ID, mode: 'list', cachedResultName: 'Events' },
        mode: 'each',
        workflowInputs: {
            mappingMode: 'defineBelow',
            value: {
                event_type: 'study_order_message',
                user_ids: '={{ [$json.user_id] }}',
                channels: '={{ [] }}',
                payload: '={{ $json }}',
            },
        },
    }, [x(15), 120], { onError: 'continueRegularOutput' });
    link('¿Hay a quién avisar?', 'Empujar por SSE', 0);

    return { name: 'Study Orders - Message Post', nodes, connections, settings: { executionOrder: 'v1' }, tags: ['study-orders', 'clinic'] };
}

// ════════════════════════════════════════════════════════════════════════════
// GET /study-orders/messages/file
// ════════════════════════════════════════════════════════════════════════════
function messageFileWorkflow() {
    const { nodes, connections, add, link, ifNode, pg, code, respond } = builder('msg-file');

    add('Contrato', 'n8n-nodes-base.stickyNote', 1, {
        content: `## GET /study-orders/messages/file (generado)

Un adjunto del chatter (foto o PDF), bajado de Drive. El navegador nunca habla con Drive.

**Query:** \`message_id\` (uuid), \`id\` (attachments.id).

El SQL exige todo a la vez: que el archivo sea de ese mensaje, que el usuario pueda leer el hilo de la orden (misma regla que el detalle) y, si el mensaje es una nota, STUDY_ORDERS_VIEW_ALL. **404** si falta cualquiera.

No editar a mano: \`scripts/n8n/generate-study-order-message-workflows.mjs\`.`,
        height: 300, width: 520, color: 4,
    }, [-600, -260]);

    add('Webhook', 'n8n-nodes-base.webhook', 2.1, {
        httpMethod: 'GET',
        path: 'study-orders/messages/file',
        authentication: 'jwtAuth',
        responseMode: 'responseNode',
        options: { allowedOrigins: '*' },
    }, [x(0), 0], { webhookId: 'study-orders-msg-file', credentials: JWT });

    code('Validar Datos', `const userId = $json.jwtPayload?.userId;
if (!userId) return [{ json: { __error: true, __code: 401, __message: 'Token sin userId' } }];
const q = $json.query || {};
const messageId = (q.message_id || '').toString().trim();
const fileId = parseInt(q.id, 10);
if (!${UUID_RE}.test(messageId) || !Number.isFinite(fileId)) {
  return [{ json: { __error: true, __code: 400, __message: 'message_id e id son requeridos' } }];
}
return [{ json: { user_id: String(userId), message_id: messageId, file_id: fileId } }];`, [x(1), 0]);
    link('Webhook', 'Validar Datos');

    ifNode('¿Datos OK?', '={{ !$json.__error }}', [x(2), 0]);
    link('Validar Datos', '¿Datos OK?');
    respond('Responder Error', RESPOND_ERR, '={{ $json.__code || 400 }}', [x(3), 220]);
    link('¿Datos OK?', 'Responder Error', 1);

    pg('Buscar Archivo', MESSAGE_FILE_SQL, '={{ [ $json.user_id, $json.message_id, $json.file_id ] }}', [x(3), 0],
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

    return { name: 'Study Orders - Message File', nodes, connections, settings: { executionOrder: 'v1' }, tags: ['study-orders', 'clinic'] };
}

mkdirSync(OUT_DIR, { recursive: true });
for (const [file, wf] of [
    ['study-orders-message-post.json', messagePostWorkflow()],
    ['study-orders-message-file.json', messageFileWorkflow()],
]) {
    writeFileSync(join(OUT_DIR, file), JSON.stringify(wf, null, 2) + '\n', 'utf8');
    console.log(`  ${file} (${wf.nodes.length} nodos)`);
}
