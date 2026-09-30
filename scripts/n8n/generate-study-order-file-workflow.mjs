#!/usr/bin/env node
/**
 * generate-study-order-file-workflow.mjs
 * ---------------------------------------------------------------------------
 * Genera n8n-workflows/study-orders-whatsapp-file.json:
 *
 *   GET /study-orders/whatsapp-intakes/file?intake_id=<uuid>&id=<attachments.id>
 *
 * Devuelve el ORIGINAL (foto o PDF) que un usuario mandó por WhatsApp junto con
 * su orden, para verlo en Invoke. Requiere STUDY_ORDERS_VIEW_ALL.
 *
 * Los archivos viven en Google Drive (subflujo `Attachements CRUD`) y la tabla
 * `attachments` los referencia con source_name = 'whatsapp_order_intake' y
 * source_id = <whatsapp_order_intakes.id>. Es el mismo camino que usa
 * /sesiones/attachment para las sesiones clínicas: el navegador nunca habla con
 * Drive, pide el archivo a n8n con su JWT y n8n lo baja.
 *
 * El SQL exige las TRES cosas a la vez (archivo, intake y permiso): con el id de
 * cualquier adjunto de otro módulo no se baja nada.
 *
 *   node scripts/n8n/generate-study-order-file-workflow.mjs
 * ---------------------------------------------------------------------------
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'n8n-workflows', 'study-orders-whatsapp-file.json');

const JWT = { jwtAuth: { id: 'C6sB1r7ab5H5EmJj', name: 'JWT Auth account' } };
const PG = { postgres: { id: '6b7Sjdnppbfve8ka', name: 'Postgres account' } };
const GDRIVE = { googleDriveOAuth2Api: { id: 'k3vQaAkau21se8nC', name: 'Google Drive account 2' } };

const nodes = [
    {
        parameters: { httpMethod: 'GET', path: 'study-orders/whatsapp-intakes/file', authentication: 'jwtAuth', responseMode: 'responseNode', options: { allowedOrigins: '*' } },
        type: 'n8n-nodes-base.webhook', typeVersion: 2.1, position: [0, 0], id: 'wa-file-wh', name: 'Webhook',
        webhookId: 'study-orders-wa-file', credentials: JWT,
    },
    {
        parameters: {
            jsCode: `const userId = $json.jwtPayload?.userId;
if (!userId) return [{ json: { __error: true, __code: 401, __message: 'Token sin userId' } }];
const q = $json.query || {};
const intakeId = (q.intake_id || '').toString().trim();
const fileId = parseInt(q.id, 10);
if (!/^[0-9a-f-]{36}$/i.test(intakeId) || !Number.isFinite(fileId)) {
  return [{ json: { __error: true, __code: 400, __message: 'intake_id e id son requeridos' } }];
}
return [{ json: { user_id: String(userId), intake_id: intakeId, file_id: fileId } }];`,
        },
        type: 'n8n-nodes-base.code', typeVersion: 2, position: [260, 0], id: 'wa-file-validate', name: 'Validar Datos',
    },
    {
        parameters: {
            conditions: {
                options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
                conditions: [{ id: 'wa-file-ok', leftValue: '={{ !$json.__error }}', rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }],
                combinator: 'and',
            },
            options: {},
        },
        type: 'n8n-nodes-base.if', typeVersion: 2.2, position: [520, 0], id: 'wa-file-gate', name: 'Datos OK?',
    },
    {
        parameters: {
            operation: 'executeQuery',
            query: `-- $1 userId (token)  $2 id del intake  $3 id del adjunto.
-- Archivo + intake + permiso, los tres a la vez.
SELECT a.drive_file_id, a.file_name, a.mime_type
  FROM public.attachments a
 WHERE a.id = $3::int
   AND a.source_name = 'whatsapp_order_intake'
   AND a.source_id = $2
   AND EXISTS (
       SELECT 1
         FROM public.user_roles ur
         JOIN public.role_permissions rp ON rp.role_id = ur.role_id
         JOIN public.permissions p       ON p.id = rp.permission_id
        WHERE ur.user_id = $1::uuid
          AND ur.is_active IS NOT FALSE
          AND p.code = 'STUDY_ORDERS_VIEW_ALL');`,
            options: { queryReplacement: '={{ [ $json.user_id, $json.intake_id, $json.file_id ] }}' },
        },
        type: 'n8n-nodes-base.postgres', typeVersion: 2.6, position: [780, 0], id: 'wa-file-load', name: 'Buscar Archivo',
        alwaysOutputData: true, credentials: PG,
    },
    {
        parameters: {
            conditions: {
                options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
                conditions: [{ id: 'wa-file-found', leftValue: '={{ !!$json.drive_file_id }}', rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }],
                combinator: 'and',
            },
            options: {},
        },
        type: 'n8n-nodes-base.if', typeVersion: 2.2, position: [1040, 0], id: 'wa-file-found', name: 'Encontrado?',
    },
    {
        parameters: { operation: 'download', fileId: { __rl: true, value: '={{ $json.drive_file_id }}', mode: 'id' }, options: {} },
        type: 'n8n-nodes-base.googleDrive', typeVersion: 3, position: [1300, -80], id: 'wa-file-download', name: 'Descargar de Drive',
        credentials: GDRIVE,
    },
    {
        parameters: { respondWith: 'binary', options: { responseCode: 200 } },
        type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, position: [1560, -80], id: 'wa-file-ok', name: 'Responder Archivo',
    },
    {
        parameters: {
            respondWith: 'json',
            responseBody: '={{ JSON.stringify({ code: 404, message: "Archivo no encontrado o sin permiso" }) }}',
            options: { responseCode: 404 },
        },
        type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, position: [1300, 100], id: 'wa-file-404', name: 'Responder 404',
    },
    {
        parameters: {
            respondWith: 'json',
            responseBody: '={{ JSON.stringify({ code: $json.__code || 400, message: $json.__message || "Solicitud inválida" }) }}',
            options: { responseCode: '={{ $json.__code || 400 }}' },
        },
        type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, position: [780, 200], id: 'wa-file-err', name: 'Responder Error',
    },
    {
        parameters: {
            width: 560, height: 200, color: 4,
            content: '## GET /study-orders/whatsapp-intakes/file (generado)\n\nOriginal (foto o PDF) de una orden recibida por WhatsApp, para verlo en Invoke.\n\n**Query:** `intake_id`, `id` (attachments.id). Requiere STUDY_ORDERS_VIEW_ALL.\n\nNo editar a mano: `scripts/n8n/generate-study-order-file-workflow.mjs`.',
        },
        type: 'n8n-nodes-base.stickyNote', typeVersion: 1, position: [0, -260], id: 'wa-file-note', name: 'Notas',
    },
];

const c = (from, to, out = 0) => ({ from, to, out });
const links = [
    c('Webhook', 'Validar Datos'),
    c('Validar Datos', 'Datos OK?'),
    c('Datos OK?', 'Buscar Archivo', 0),
    c('Datos OK?', 'Responder Error', 1),
    c('Buscar Archivo', 'Encontrado?'),
    c('Encontrado?', 'Descargar de Drive', 0),
    c('Encontrado?', 'Responder 404', 1),
    c('Descargar de Drive', 'Responder Archivo'),
];
const connections = {};
for (const l of links) {
    const e = (connections[l.from] ||= { main: [] });
    while (e.main.length <= l.out) e.main.push([]);
    e.main[l.out].push({ node: l.to, type: 'main', index: 0 });
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({
    name: 'Study Orders - WhatsApp File',
    nodes, connections, settings: { executionOrder: 'v1' }, tags: [],
}, null, 2) + '\n');
console.log(`Escrito ${OUT} (${nodes.length} nodos)`);
