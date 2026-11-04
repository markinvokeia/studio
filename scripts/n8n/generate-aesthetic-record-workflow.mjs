#!/usr/bin/env node
/**
 * Genera el workflow n8n de la ficha estética (docs/n8n-flows/flow-aesthetic-record.json).
 * No editar el JSON a mano: se pisa en la próxima generación.
 *
 *   node scripts/n8n/generate-aesthetic-record-workflow.mjs
 *
 * Es un flujo NUEVO: no modifica ningún endpoint existente. La lógica vive en
 * las funciones SQL de database/scripts/151_20261030_aesthetic-record.sql (y 154
 * para el consentimiento por servicio); acá
 * sólo hay webhooks, Drive y respuestas.
 *
 * Endpoints (API_ROUTES.AESTHETIC_RECORD en src/constants/routes.ts):
 *   GET  measurement-units                 catálogo de unidades
 *   POST measurement-units/save            { unit }
 *   POST measurement-units/delete          { id } → borra o desactiva si está en uso
 *   GET  services/units                    unidad de medida de cada servicio (156)
 *   POST services/unit/save                { service_id, unit_id | null } (156)
 *   GET  services/aesthetic-config         servicios estéticos con unidad y herramienta
 *   POST services/aesthetic-config/save    { service_id, enabled, unit_id, marking_tool, … }
 *   GET  aesthetic/sessions?patient_id=    sesiones completas del paciente
 *   POST aesthetic/sessions/save           { session } (capas y marcas; sin fotos)
 *   POST aesthetic/sessions/delete         { id } (borrado lógico)
 *   POST aesthetic/photos/upload           multipart: session_id, kind, view, source?, alignment?, data
 *   POST aesthetic/photos/delete           { id }
 *   POST aesthetic/photos/alignment        { id, alignment | null }
 *   GET  services/consent-templates        plantilla de consentimiento de cada servicio (154)
 *   POST services/consent-templates/save   { service_id, title, body } (body vacío ⇒ se borra)
 *   POST aesthetic/consents/sign           multipart: session_id, signing (JSON), data (firma dibujada)
 *   POST aesthetic/consents/reuse          { session_id, signing } con signing.reuseSignatureId
 *   POST aesthetic/sessions/close          { id, notes? } → sólo desde "Por cerrar" (155)
 *   POST aesthetic/sessions/void           { id, reason } (155)
 *   POST aesthetic/notes/add               { session_id, body, kind: note|amendment } (155)
 *   GET  aesthetic/file?id=                binario de 'photo_<id>', 'consentsig_<id>' o 'signature_<session_id>' (151)
 *
 * Errores: las funciones lanzan 'AESTHETIC:<CODIGO>|<detalle>' ⇒ 400 { success:false, code, detail, message }.
 */

import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT_FILE = join(ROOT, 'docs/n8n-flows/flow-aesthetic-record.json');

// Credenciales compartidas por los workflows de Invoke (mismas que docs/n8n-flows).
const PG_CREDENTIALS = { postgres: { id: '6b7Sjdnppbfve8ka', name: 'Postgres account' } };
const JWT_CREDENTIALS = { jwtAuth: { id: 'C6sB1r7ab5H5EmJj', name: 'JWT Auth account' } };
const DRIVE_CREDENTIALS = { googleDriveOAuth2Api: { id: 'k3vQaAkau21se8nC', name: 'Google Drive account 2' } };

// Ids derivados del nombre: la misma entrada genera siempre el mismo JSON.
const stableId = (seed) => {
  const hex = createHash('sha1').update(`aesthetic-record:${seed}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
};

const nodes = [];
const connections = {};

function add(node, position) {
  nodes.push({ ...node, id: stableId(`node:${node.name}`), position });
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
  webhookId: stableId(`webhook:${name}`),
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
//
// alwaysOutputData sólo en lecturas que pueden dar 0 filas (sin él, un SELECT vacío corta el flujo y
// el webhook no responde). Con él, un error emite TAMBIÉN un ítem {} por la salida 0, así que corren
// las dos ramas y gana la del nodo más arriba en el lienzo (executionOrder v1). Las escrituras
// devuelven una fila o lanzan, y no lo llevan: era lo que convertía un error en
// 200 { success: true, unit: {} }.
const pg = (name, query, queryReplacement, { mayBeEmpty = false } = {}) => ({
  name,
  type: 'n8n-nodes-base.postgres',
  typeVersion: 2.6,
  parameters: { operation: 'executeQuery', query, options: queryReplacement ? { queryReplacement } : {} },
  credentials: PG_CREDENTIALS,
  ...(mayBeEmpty ? { alwaysOutputData: true } : {}),
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
      conditions: [{ id: stableId(`condition:${name}`), operator: { type: 'string', operation: 'notEmpty', singleValue: true }, leftValue, rightValue: '' }],
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

// Por encima de todos los nodos a propósito: una lectura con alwaysOutputData (ver pg) ejecuta las dos
// ramas al fallar, y este 400 tiene que responder antes que su OK. El segundo Respond se ignora.
const MAP_ERROR = add(code('Map error', `// Las funciones lanzan 'AESTHETIC:<CODIGO>|<detalle>'. Cualquier otro error
// (conexión, constraint inesperada) sale como UNKNOWN con el mensaje crudo.
// El texto no viene siempre en el mismo sitio: Postgres da { message, error: {...} } con el texto en
// la raíz (error es una copia sin message), y Code da error como string. Sólo se miran estos campos:
// la salida de error trae también el ítem de entrada, con el body que mandó el usuario.
const texts = [];
const seen = new Set();
const walk = (value) => {
  if (typeof value === 'string') { if (value.trim()) texts.push(value); return; }
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  for (const key of ['message', 'description', 'cause', 'error']) walk(value[key]);
  for (const child of Object.values(value)) walk(child);
};
for (const key of ['message', 'error', 'description', 'cause', 'details']) walk($json[key]);
const serialize = (value) => { try { return JSON.stringify(value) ?? ''; } catch { return ''; } };
const text = texts.find((t) => t.includes('AESTHETIC:')) ?? texts[0] ?? serialize($json.error);
const match = text.match(/AESTHETIC:([A-Z_]+)(?:\\|(.*))?/);
return [{ json: {
  success: false,
  code: match ? match[1] : 'UNKNOWN',
  detail: match && match[2] ? match[2].trim() : null,
  message: text || 'Error',
} }];`), [1400, -300]);
const ERROR = add(respond('Error', '={{ $json }}', 400), [1640, -300]);
link(MAP_ERROR, ERROR);

let row = 0;
const y = () => row++ * 220;

/** Endpoint de una sola consulta: webhook → SQL → respuesta */
function simple({ webhookName, path, method, query, params, body, mayBeEmpty }) {
  const top = y();
  const wh = add(webhook(webhookName, path, method), [0, top]);
  const q = add(pg(`${webhookName} · SQL`, query, params, { mayBeEmpty }), [240, top]);
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
  mayBeEmpty: true,
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

// ─── Unidad de medida del servicio (156) ────────────────────────────────────

simple({
  webhookName: 'GET services/units',
  path: 'services/units',
  method: 'GET',
  query: 'SELECT * FROM public.service_units_list();',
  mayBeEmpty: true,
  body: '={{ { success: true, units: $input.all().map(i => i.json).filter(u => u.service_id != null) } }}',
});

simple({
  webhookName: 'POST services/unit/save',
  path: 'services/unit/save',
  method: 'POST',
  query: "SELECT * FROM public.service_unit_save(NULLIF($1, '')::integer, NULLIF($2, '')::integer);",
  params: '={{ [String($json.body.service_id ?? ""), $json.body.unit_id == null ? "" : String($json.body.unit_id)] }}',
  body: '={{ { success: true, ...$json } }}',
});

// ─── Configuración estética del servicio ────────────────────────────────────

simple({
  webhookName: 'GET services/aesthetic-config',
  path: 'services/aesthetic-config',
  method: 'GET',
  query: 'SELECT * FROM public.service_aesthetic_config_list();',
  mayBeEmpty: true,
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

// ─── Plantilla de consentimiento del servicio (154) ─────────────────────────

simple({
  webhookName: 'GET services/consent-templates',
  path: 'services/consent-templates',
  method: 'GET',
  query: 'SELECT * FROM public.service_consent_templates_list();',
  mayBeEmpty: true,
  body: '={{ { success: true, templates: $input.all().map(i => i.json).filter(t => t.service_id != null) } }}',
});

simple({
  webhookName: 'POST services/consent-templates/save',
  path: 'services/consent-templates/save',
  method: 'POST',
  query: "SELECT * FROM public.service_consent_template_save($1::jsonb, NULLIF($2, '')::uuid);",
  params: `={{ [JSON.stringify($json.body ?? {}), ${user('POST services/consent-templates/save')}] }}`,
  body: '={{ { success: true, template: $json } }}',
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

// Sesión guiada (155): cierre, anulación y notas con hora
simple({
  webhookName: 'POST aesthetic/sessions/close',
  path: 'aesthetic/sessions/close',
  method: 'POST',
  query: "SELECT public.aesthetic_session_close(NULLIF($1, '')::bigint, $2::jsonb, NULLIF($3, '')::uuid) AS session;",
  params: `={{ [String($json.body.id ?? ""), JSON.stringify($json.body.notes != null ? { notes: String($json.body.notes) } : {}), ${user('POST aesthetic/sessions/close')}] }}`,
  body: '={{ { success: true, session: $json.session } }}',
});

simple({
  webhookName: 'POST aesthetic/sessions/void',
  path: 'aesthetic/sessions/void',
  method: 'POST',
  query: "SELECT public.aesthetic_session_void(NULLIF($1, '')::bigint, $2, NULLIF($3, '')::uuid) AS session;",
  params: `={{ [String($json.body.id ?? ""), String($json.body.reason ?? ""), ${user('POST aesthetic/sessions/void')}] }}`,
  body: '={{ { success: true, session: $json.session } }}',
});

simple({
  webhookName: 'POST aesthetic/notes/add',
  path: 'aesthetic/notes/add',
  method: 'POST',
  query: "SELECT public.aesthetic_note_add(NULLIF($1, '')::bigint, $2::jsonb, NULLIF($3, '')::uuid) AS session;",
  params: `={{ [String($json.body.session_id ?? ""), JSON.stringify({ body: String($json.body.body ?? ""), kind: String($json.body.kind ?? "note") }), ${user('POST aesthetic/notes/add')}] }}`,
  body: '={{ { success: true, session: $json.session } }}',
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
    source: ['camera', 'upload', 'qr'].includes(String(body.source ?? '')) ? String(body.source) : 'upload',
    alignment: body.alignment ? String(body.alignment) : '',
    file_name: binary.fileName ?? 'foto',
    mime_type: binary.mimeType,
  },
  binary: { file: binary },
}];`), { onError: 'continueErrorOutput' }), [240, top]);
  const up = add(driveUpload('Photo · subir a Drive', "={{ 'aesthetic_' + $json.session_id + '_' + $json.file_name }}"), [480, top]);
  const save = add(pg('Photo · guardar', "SELECT public.aesthetic_photo_add($1::bigint, $2, $3, $4, $5, $6, $7, NULLIF($8, '')::jsonb, NULLIF($9, '')::uuid, $10) AS photo;",
    `={{ (() => { const v = $('Photo · validar').first().json; return [v.session_id, v.kind, v.view, v.file_name, v.mime_type, $json.id, $json.webViewLink ?? '', v.alignment, ${user(WH)}, v.source]; })() }}`), [720, top]);
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

// Consentimiento por servicio (154): una firma dibujada cubre uno o más servicios de la
// sesión. Las firmas no se borran de Drive: pueden estar reutilizadas.
{
  const top = y();
  const WH = 'POST aesthetic/consents/sign';
  const wh = add(webhook(WH, 'aesthetic/consents/sign', 'POST', { binaryPropertyName: 'data', rawBody: false }), [0, top]);
  const check = add(code('Consents · validar', takeUpload(WH, `let signing;
try { signing = JSON.parse(body.signing ?? '{}'); } catch { throw new Error('AESTHETIC:INVALID_CONSENT|'); }
if (!/^image\\/(png|jpeg|webp)$/.test(binary.mimeType ?? '')) throw new Error('AESTHETIC:INVALID_FILE_TYPE|' + binary.mimeType);
delete signing.reuseSignatureId;
return [{
  json: { session_id: sessionId, signing: JSON.stringify(signing), mime_type: binary.mimeType },
  binary: { file: binary },
}];`), { onError: 'continueErrorOutput' }), [240, top]);
  const up = add(driveUpload('Consents · subir firma', "={{ 'aesthetic_signature_' + $json.session_id + '_' + Date.now() + '.png' }}"), [480, top]);
  const save = add(pg('Consents · guardar', "SELECT public.aesthetic_consents_sign($1::bigint, $2::jsonb, $3, $4, NULLIF($5, '')::uuid) AS session;",
    `={{ (() => { const v = $('Consents · validar').first().json; return [v.session_id, v.signing, $json.id, v.mime_type, ${user(WH)}]; })() }}`), [720, top]);
  const ok = add(respond('Consents · OK', '={{ { success: true, session: $json.session } }}'), [960, top]);
  chain(wh, check);
  link(check, up, 0);
  link(check, MAP_ERROR, 1);
  link(up, save);
  link(save, ok, 0);
  link(save, MAP_ERROR, 1);
}

// Misma firma que una anterior del paciente: no se sube nada, apunta al mismo archivo
simple({
  webhookName: 'POST aesthetic/consents/reuse',
  path: 'aesthetic/consents/reuse',
  method: 'POST',
  query: "SELECT public.aesthetic_consents_sign(NULLIF($1, '')::bigint, $2::jsonb, NULL, NULL, NULLIF($3, '')::uuid) AS session;",
  params: `={{ [String($json.body.session_id ?? ""), JSON.stringify($json.body.signing ?? {}), ${user('POST aesthetic/consents/reuse')}] }}`,
  body: '={{ { success: true, session: $json.session } }}',
});

// ─── Descarga de archivos ────────────────────────────────────────────────────

{
  const top = y();
  const wh = add(webhook('GET aesthetic/file', 'aesthetic/file', 'GET'), [0, top]);
  const read = add(pg('File · buscar', 'SELECT * FROM public.aesthetic_file_get($1);', '={{ [String($json.query.id ?? "")] }}', { mayBeEmpty: true }), [240, top]);
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
  id: stableId('node:Nota'),
  name: 'Nota',
  type: 'n8n-nodes-base.stickyNote',
  typeVersion: 1,
  position: [-480, -40],
  parameters: {
    width: 420,
    height: 420,
    content: `## Aesthetic Record — ficha estética

Flujo NUEVO (no reemplaza nada). Requiere database/scripts/151, 152, 154, 155 y 156.

Unidades de medida, configuración estética del servicio (unidad + herramienta punto/área), plantilla de consentimiento por servicio, sesiones con capas por servicio y marcas, fotos y un consentimiento firmado por servicio (binarios en Drive; una firma se puede reutilizar).

Errores: 'AESTHETIC:<CODIGO>|<detalle>' ⇒ 400 { success:false, code, detail }.

Generado por scripts/n8n/generate-aesthetic-record-workflow.mjs — no editar a mano.`,
  },
});

const workflow = { name: 'Aesthetic Record', nodes, connections, settings: { executionOrder: 'v1' }, staticData: null };
writeFileSync(OUT_FILE, `${JSON.stringify(workflow, null, 2)}\n`);
console.log(`✓ ${OUT_FILE} (${nodes.length} nodos)`);
