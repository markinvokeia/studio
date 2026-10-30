#!/usr/bin/env node
/**
 * Genera el workflow n8n de la ficha estética (docs/n8n-flows/flow-aesthetic-record.json).
 * No editar el JSON a mano: se pisa en la próxima generación.
 *
 *   node scripts/n8n/generate-aesthetic-record-workflow.mjs
 *
 * Es un flujo NUEVO: no modifica ningún endpoint existente. La lógica vive en
 * las funciones SQL de database/scripts/151_20261030_aesthetic-record.sql; acá
 * sólo hay webhooks, Drive y respuestas.
 *
 * Endpoints (API_ROUTES.AESTHETIC_RECORD en src/constants/routes.ts):
 *   GET  measurement-units                 catálogo de unidades
 *   POST measurement-units/save            { unit }
 *   POST measurement-units/delete          { id } → borra o desactiva si está en uso
 *   GET  services/aesthetic-config         servicios estéticos con unidad y herramienta
 *   POST services/aesthetic-config/save    { service_id, enabled, unit_id, marking_tool, … }
 *   GET  aesthetic/sessions?patient_id=    sesiones completas del paciente
 *   POST aesthetic/sessions/save           { session } (capas y marcas; sin fotos)
 *   POST aesthetic/sessions/delete         { id } (borrado lógico)
 *   POST aesthetic/photos/upload           multipart: session_id, kind, view, alignment?, data
 *   POST aesthetic/photos/delete           { id }
 *   POST aesthetic/photos/alignment        { id, alignment | null }
 *   POST aesthetic/consent/sign            multipart: session_id, consent (JSON), data (firma)
 *   GET  aesthetic/file?id=                binario de 'photo_<id>' o 'signature_<session_id>'
 *
 * Errores: las funciones lanzan 'AESTHETIC:<CODIGO>|<detalle>' ⇒ 400 { success:false, code, detail, message }.
 */

import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT_FILE = join(ROOT, 'docs/n8n-flows/flow-aesthetic-record.json');

// Credenciales compartidas por los workflows de Invoke (mismas que docs/n8n-flows).
const PG_CREDENTIALS = { postgres: { id: '6b7Sjdnppbfve8ka', name: 'Postgres account' } };
const JWT_CREDENTIALS = { jwtAuth: { id: 'C6sB1r7ab5H5EmJj', name: 'JWT Auth account' } };
const DRIVE_CREDENTIALS = { googleDriveOAuth2Api: { id: 'k3vQaAkau21se8nC', name: 'Google Drive account 2' } };

const nodes = [];
const connections = {};

function add(node, position) {
  nodes.push({ ...node, id: randomUUID(), position });
  return node.name;
}

function link(from, to, output = 0) {
  connections[from] ??= { main: [] };
  while (connections[from].main.length <= output) connections[from].main.push([]);
  connections[from].main[output].push({ node: to, type: 'main', index: 0 });
}

function chain(...names) {
  for (let i = 0; i < names.length - 1; i++) link(names[i], names[i + 1]);
}

const webhook = (name, path, method, extraOptions = {}) => ({
  name,
  type: 'n8n-nodes-base.webhook',
  typeVersion: 2.1,
  webhookId: randomUUID(),
  parameters: {
    ...(method === 'GET' ? {} : { httpMethod: method }),
    path,
    authentication: 'jwtAuth',
    responseMode: 'responseNode',
    options: { allowedOrigins: '*', ...extraOptions },
  },
  credentials: JWT_CREDENTIALS,
});

// n8n lee los parámetros ($1, $2…) de `options.queryReplacement` (Postgres v2.x).
// onError: la rama 1 lleva a "Map error" (400 con el código de la función).
const pg = (name, query, queryReplacement) => ({
  name,
  type: 'n8n-nodes-base.postgres',
  typeVersion: 2.6,
  parameters: { operation: 'executeQuery', query, options: queryReplacement ? { queryReplacement } : {} },
  credentials: PG_CREDENTIALS,
  alwaysOutputData: true,
  onError: 'continueErrorOutput',
});

const code = (name, jsCode, extra = {}) => ({ name, type: 'n8n-nodes-base.code', typeVersion: 2, parameters: { jsCode }, ...extra });

const respond = (name, responseBody, responseCode = 200) => ({
  name,
  type: 'n8n-nodes-base.respondToWebhook',
  typeVersion: 1.4,
  parameters: { respondWith: 'json', responseBody, options: { responseCode } },
});

const ifNotEmpty = (name, leftValue) => ({
  name,
  type: 'n8n-nodes-base.if',
  typeVersion: 2.2,
  parameters: {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
      conditions: [{ id: randomUUID(), operator: { type: 'string', operation: 'notEmpty', singleValue: true }, leftValue, rightValue: '' }],
      combinator: 'and',
    },
    options: {},
  },
});

const driveUpload = (name, fileNameExpr) => ({
  name,
  type: 'n8n-nodes-base.googleDrive',
  typeVersion: 3,
  parameters: {
    inputDataFieldName: 'file',
    name: fileNameExpr,
    driveId: { __rl: true, mode: 'list', value: 'My Drive' },
    folderId: { __rl: true, value: 'root', mode: 'list', cachedResultName: '/ (Root folder)', cachedResultUrl: 'https://drive.google.com/drive' },
    options: {},
  },
  credentials: DRIVE_CREDENTIALS,
});

// Best-effort: si Drive falla el archivo queda huérfano, la BD ya está bien.
const driveDelete = (name, fileIdExpr) => ({
  name,
  type: 'n8n-nodes-base.googleDrive',
  typeVersion: 3,
  parameters: { operation: 'deleteFile', fileId: { __rl: true, mode: 'id', value: fileIdExpr }, options: {} },
  credentials: DRIVE_CREDENTIALS,
  onError: 'continueRegularOutput',
});

const USER = `$('%WEBHOOK%').first().json.jwtPayload?.userId ?? ''`;
const user = (webhookName) => USER.replace('%WEBHOOK%', webhookName);

// ─── Errores compartidos ─────────────────────────────────────────────────────

const MAP_ERROR = add(code('Map error', `// Las funciones lanzan 'AESTHETIC:<CODIGO>|<detalle>'. Cualquier otro error
// (conexión, constraint inesperada) sale como UNKNOWN con el mensaje crudo.
const raw = $json.error?.message ?? $json.error ?? $json.message ?? '';
const text = String(raw);
const match = text.match(/AESTHETIC:([A-Z_]+)(?:\\|(.*))?/);
return [{ json: {
  success: false,
  code: match ? match[1] : 'UNKNOWN',
  detail: match && match[2] ? match[2].trim() : null,
  message: text || 'Error',
} }];`), [1400, 1400]);
const ERROR = add(respond('Error', '={{ $json }}', 400), [1640, 1400]);
link(MAP_ERROR, ERROR);

let row = 0;
const y = () => row++ * 220;

/** Endpoint de una sola consulta: webhook → SQL → respuesta */
function simple({ webhookName, path, method, query, params, body }) {
  const top = y();
  const wh = add(webhook(webhookName, path, method), [0, top]);
  const q = add(pg(`${webhookName} · SQL`, query, params), [240, top]);
  const ok = add(respond(`${webhookName} · OK`, body), [480, top]);
  chain(wh, q);
  link(q, ok, 0);
  link(q, MAP_ERROR, 1);
}

// ─── Unidades de medida ──────────────────────────────────────────────────────

simple({
  webhookName: 'GET measurement-units',
  path: 'measurement-units',
  method: 'GET',
  query: 'SELECT * FROM public.measurement_units_list();',
  body: "={{ { success: true, units: $input.all().map(i => i.json).filter(u => u.id != null) } }}",
});

simple({
  webhookName: 'POST measurement-units/save',
  path: 'measurement-units/save',
  method: 'POST',
  query: 'SELECT * FROM public.measurement_unit_save($1::jsonb);',
  params: "={{ [JSON.stringify($json.body.unit ?? {})] }}",
  body: '={{ { success: true, unit: $json } }}',
});

simple({
  webhookName: 'POST measurement-units/delete',
  path: 'measurement-units/delete',
  method: 'POST',
  query: 'SELECT * FROM public.measurement_unit_delete($1::integer);',
  params: '={{ [String($json.body.id ?? "")] }}',
  body: '={{ { success: true, ...$json } }}',
});

// ─── Configuración estética del servicio ────────────────────────────────────

simple({
  webhookName: 'GET services/aesthetic-config',
  path: 'services/aesthetic-config',
  method: 'GET',
  query: 'SELECT * FROM public.service_aesthetic_config_list();',
  body: '={{ { success: true, configs: $input.all().map(i => i.json).filter(c => c.service_id != null) } }}',
});

simple({
  webhookName: 'POST services/aesthetic-config/save',
  path: 'services/aesthetic-config/save',
  method: 'POST',
  query: "SELECT * FROM public.service_aesthetic_config_save($1::jsonb, NULLIF($2, '')::uuid);",
  params: `={{ [JSON.stringify($json.body ?? {}), ${user('POST services/aesthetic-config/save')}] }}`,
  body: '={{ { success: true, ...$json } }}',
});

// ─── Sesiones ────────────────────────────────────────────────────────────────

simple({
  webhookName: 'GET aesthetic/sessions',
  path: 'aesthetic/sessions',
  method: 'GET',
  query: 'SELECT public.aesthetic_sessions_list($1::uuid) AS sessions;',
  params: '={{ [String($json.query.patient_id ?? "")] }}',
  body: '={{ { success: true, sessions: $json.sessions ?? [] } }}',
});

simple({
  webhookName: 'POST aesthetic/sessions/save',
  path: 'aesthetic/sessions/save',
  method: 'POST',
  query: "SELECT public.aesthetic_session_save($1::jsonb, NULLIF($2, '')::uuid) AS session;",
  params: `={{ [JSON.stringify($json.body.session ?? {}), ${user('POST aesthetic/sessions/save')}] }}`,
  body: '={{ { success: true, session: $json.session } }}',
});

simple({
  webhookName: 'POST aesthetic/sessions/delete',
  path: 'aesthetic/sessions/delete',
  method: 'POST',
  query: "SELECT * FROM public.aesthetic_session_delete($1::bigint, NULLIF($2, '')::uuid);",
  params: `={{ [String($json.body.id ?? ""), ${user('POST aesthetic/sessions/delete')}] }}`,
  body: '={{ { success: true, ...$json } }}',
});

simple({
  webhookName: 'POST aesthetic/photos/alignment',
  path: 'aesthetic/photos/alignment',
  method: 'POST',
  query: "SELECT * FROM public.aesthetic_photo_set_alignment($1, NULLIF($2, '')::jsonb);",
  params: '={{ [String($json.body.id ?? ""), $json.body.alignment ? JSON.stringify($json.body.alignment) : ""] }}',
  body: '={{ { success: true, ...$json } }}',
});

// ─── Subidas (multipart) ─────────────────────────────────────────────────────

// El front hace formData.append('data', file); n8n lo deja en `data` o `data0`.
// Se renombra a `file` para que los nodos de Drive no dependan de eso.
const takeUpload = (webhookName, extra) => `const item = $('${webhookName}').first();
const body = item.json.body ?? {};
const binary = item.binary?.data0 ?? item.binary?.data;
if (!binary) throw new Error('AESTHETIC:FILE_REQUIRED|');
const sessionId = String(body.session_id ?? '').trim();
if (!/^[0-9]+$/.test(sessionId)) throw new Error('AESTHETIC:SESSION_NOT_FOUND|' + sessionId);
${extra}`;

{
  const top = y();
  const WH = 'POST aesthetic/photos/upload';
  const wh = add(webhook(WH, 'aesthetic/photos/upload', 'POST', { binaryPropertyName: 'data', rawBody: false }), [0, top]);
  const check = add(code('Photo · validar', takeUpload(WH, `const kind = String(body.kind ?? '');
if (!['before', 'after'].includes(kind)) throw new Error('AESTHETIC:INVALID_PHOTO_KIND|' + kind);
if (!/^image\\/(jpeg|png|webp|heic|heif)$/.test(binary.mimeType ?? '')) throw new Error('AESTHETIC:INVALID_FILE_TYPE|' + binary.mimeType);
return [{
  json: {
    session_id: sessionId,
    kind,
    view: String(body.view ?? 'front'),
    alignment: body.alignment ? String(body.alignment) : '',
    file_name: binary.fileName ?? 'foto',
    mime_type: binary.mimeType,
  },
  binary: { file: binary },
}];`), { onError: 'continueErrorOutput' }), [240, top]);
  const up = add(driveUpload('Photo · subir a Drive', "={{ 'aesthetic_' + $json.session_id + '_' + $json.file_name }}"), [480, top]);
  const save = add(pg('Photo · guardar', "SELECT public.aesthetic_photo_add($1::bigint, $2, $3, $4, $5, $6, $7, NULLIF($8, '')::jsonb, NULLIF($9, '')::uuid) AS photo;",
    `={{ (() => { const v = $('Photo · validar').first().json; return [v.session_id, v.kind, v.view, v.file_name, v.mime_type, $json.id, $json.webViewLink ?? '', v.alignment, ${user(WH)}]; })() }}`), [720, top]);
  const ok = add(respond('Photo · OK', '={{ { success: true, photo: $json.photo } }}'), [960, top]);
  chain(wh, check);
  link(check, up, 0);
  link(check, MAP_ERROR, 1);
  link(up, save);
  link(save, ok, 0);
  link(save, MAP_ERROR, 1);
}

{
  const top = y();
  const WH = 'POST aesthetic/photos/delete';
  const wh = add(webhook(WH, 'aesthetic/photos/delete', 'POST'), [0, top]);
  const del = add(pg('Photo delete · SQL', 'SELECT * FROM public.aesthetic_photo_delete($1);', '={{ [String($json.body.id ?? "")] }}'), [240, top]);
  const has = add(ifNotEmpty('Photo delete · ¿hay archivo?', '={{ $json.previous_drive_file_id }}'), [480, top]);
  const drive = add(driveDelete('Photo delete · borrar de Drive', '={{ $json.previous_drive_file_id }}'), [720, top]);
  const ok = add(respond('Photo delete · OK', "={{ { success: true, id: $('Photo delete · SQL').first().json.id } }}"), [960, top]);
  chain(wh, del);
  link(del, has, 0);
  link(del, MAP_ERROR, 1);
  link(has, drive, 0);
  link(has, ok, 1);
  link(drive, ok);
}

{
  const top = y();
  const WH = 'POST aesthetic/consent/sign';
  const wh = add(webhook(WH, 'aesthetic/consent/sign', 'POST', { binaryPropertyName: 'data', rawBody: false }), [0, top]);
  const check = add(code('Consent · validar', takeUpload(WH, `let consent;
try { consent = JSON.parse(body.consent ?? '{}'); } catch { throw new Error('AESTHETIC:INVALID_CONSENT|'); }
return [{
  json: { session_id: sessionId, consent: JSON.stringify(consent), mime_type: binary.mimeType ?? 'image/png' },
  binary: { file: binary },
}];`), { onError: 'continueErrorOutput' }), [240, top]);
  const up = add(driveUpload('Consent · subir firma', "={{ 'aesthetic_signature_' + $json.session_id + '.png' }}"), [480, top]);
  const save = add(pg('Consent · guardar', "SELECT * FROM public.aesthetic_consent_save($1::bigint, $2::jsonb, $3, $4, NULLIF($5, '')::uuid);",
    `={{ (() => { const v = $('Consent · validar').first().json; return [v.session_id, v.consent, $json.id, v.mime_type, ${user(WH)}]; })() }}`), [720, top]);
  const has = add(ifNotEmpty('Consent · ¿firma anterior?', '={{ $json.previous_drive_file_id }}'), [960, top]);
  const drive = add(driveDelete('Consent · borrar firma anterior', '={{ $json.previous_drive_file_id }}'), [1200, top]);
  const ok = add(respond('Consent · OK', "={{ { success: true, consent: $('Consent · guardar').first().json.consent } }}"), [1440, top]);
  chain(wh, check);
  link(check, up, 0);
  link(check, MAP_ERROR, 1);
  link(up, save);
  link(save, has, 0);
  link(save, MAP_ERROR, 1);
  link(has, drive, 0);
  link(has, ok, 1);
  link(drive, ok);
}

// ─── Descarga de archivos ────────────────────────────────────────────────────

{
  const top = y();
  const wh = add(webhook('GET aesthetic/file', 'aesthetic/file', 'GET'), [0, top]);
  const read = add(pg('File · buscar', 'SELECT * FROM public.aesthetic_file_get($1);', '={{ [String($json.query.id ?? "")] }}'), [240, top]);
  const has = add(ifNotEmpty('File · ¿existe?', '={{ $json.drive_file_id }}'), [480, top]);
  const download = add({
    name: 'File · descargar de Drive',
    type: 'n8n-nodes-base.googleDrive',
    typeVersion: 3,
    parameters: { operation: 'download', fileId: { __rl: true, mode: 'id', value: '={{ $json.drive_file_id }}' }, options: { binaryPropertyName: 'data' } },
    credentials: DRIVE_CREDENTIALS,
  }, [720, top]);
  const binary = add({
    name: 'File · responder binario',
    type: 'n8n-nodes-base.respondToWebhook',
    typeVersion: 1.4,
    parameters: { respondWith: 'binary', responseDataSource: 'set', inputFieldName: 'data', options: { responseCode: 200 } },
  }, [960, top]);
  const missing = add(respond('File · no existe', '={{ { success: false, code: "FILE_NOT_FOUND" } }}', 404), [720, top + 120]);
  chain(wh, read);
  link(read, has, 0);
  link(read, MAP_ERROR, 1);
  link(has, download, 0);
  link(has, missing, 1);
  link(download, binary);
}

// ─── Nota ────────────────────────────────────────────────────────────────────

nodes.unshift({
  id: randomUUID(),
  name: 'Nota',
  type: 'n8n-nodes-base.stickyNote',
  typeVersion: 1,
  position: [-480, -40],
  parameters: {
    width: 420,
    height: 420,
    content: `## Aesthetic Record — ficha estética

Flujo NUEVO (no reemplaza nada). Requiere database/scripts/151_20261030_aesthetic-record.sql.

Unidades de medida, configuración estética del servicio (unidad + herramienta punto/área), sesiones con capas por servicio y marcas, fotos y consentimiento (binarios en Drive).

Errores: 'AESTHETIC:<CODIGO>|<detalle>' ⇒ 400 { success:false, code, detail }.

Generado por scripts/n8n/generate-aesthetic-record-workflow.mjs — no editar a mano.`,
  },
});

const workflow = { name: 'Aesthetic Record', nodes, connections, settings: { executionOrder: 'v1' }, staticData: null };
writeFileSync(OUT_FILE, `${JSON.stringify(workflow, null, 2)}\n`);
console.log(`✓ ${OUT_FILE} (${nodes.length} nodos)`);
