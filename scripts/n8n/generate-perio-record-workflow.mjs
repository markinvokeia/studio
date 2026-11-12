#!/usr/bin/env node
/**
 * Genera el workflow n8n del periodontograma (docs/n8n-flows/flow-perio-record.json).
 * No editar el JSON a mano: se pisa en la próxima generación.
 *
 *   node scripts/n8n/generate-perio-record-workflow.mjs
 *
 * Es un flujo NUEVO: no modifica ningún endpoint existente. La lógica vive en las
 * funciones SQL de database/scripts/163_20261105_perio-record.sql; acá sólo hay
 * webhooks y respuestas.
 *
 * Endpoints (API_ROUTES.PERIO_RECORD en src/constants/routes.ts):
 *   GET  perio/exams?patient_id=   periodontogramas completos del paciente
 *   POST perio/exams/save          { exam } (piezas y sitios se reemplazan enteros)
 *   POST perio/exams/close         { id } → sólo con PS y MG completos
 *   POST perio/exams/delete        { id } (borrado lógico, sólo sin cerrar)
 *
 * Errores: las funciones lanzan 'PERIO:<CODIGO>|<detalle>' ⇒ 400 { success:false, code, detail, message }.
 */

import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT_FILE = join(ROOT, 'docs/n8n-flows/flow-perio-record.json');

// Credenciales compartidas por los workflows de Invoke (mismas que docs/n8n-flows).
const PG_CREDENTIALS = { postgres: { id: '6b7Sjdnppbfve8ka', name: 'Postgres account' } };
const JWT_CREDENTIALS = { jwtAuth: { id: 'C6sB1r7ab5H5EmJj', name: 'JWT Auth account' } };

// Ids derivados del nombre: la misma entrada genera siempre el mismo JSON.
const stableId = (seed) => {
  const hex = createHash('sha1').update(`perio-record:${seed}`).digest('hex');
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

const webhook = (name, path, method) => ({
  name,
  type: 'n8n-nodes-base.webhook',
  typeVersion: 2.1,
  webhookId: stableId(`webhook:${name}`),
  parameters: {
    ...(method === 'GET' ? {} : { httpMethod: method }),
    path,
    authentication: 'jwtAuth',
    responseMode: 'responseNode',
    options: { allowedOrigins: '*' },
  },
  credentials: JWT_CREDENTIALS,
});

// n8n lee los parámetros ($1, $2…) de `options.queryReplacement` (Postgres v2.x).
// onError: la rama 1 lleva a "Map error" (400 con el código de la función). Todas las
// consultas devuelven una fila (las funciones de lista devuelven '[]'), así que ninguna
// necesita alwaysOutputData (ver el generador de estética: con él un error corre las dos ramas).
const pg = (name, query, queryReplacement) => ({
  name,
  type: 'n8n-nodes-base.postgres',
  typeVersion: 2.6,
  parameters: { operation: 'executeQuery', query, options: { queryReplacement } },
  credentials: PG_CREDENTIALS,
  onError: 'continueErrorOutput',
});

const respond = (name, responseBody, responseCode = 200) => ({
  name,
  type: 'n8n-nodes-base.respondToWebhook',
  typeVersion: 1.4,
  parameters: { respondWith: 'json', responseBody, options: { responseCode } },
});

const user = (webhookName) => `$('${webhookName}').first().json.jwtPayload?.userId ?? ''`;

// ─── Errores compartidos ─────────────────────────────────────────────────────

const MAP_ERROR = add({
  name: 'Map error',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  parameters: {
    jsCode: `// Las funciones lanzan 'PERIO:<CODIGO>|<detalle>'. Cualquier otro error
// (conexión, constraint inesperada) sale como UNKNOWN con el mensaje crudo.
// Postgres da { message, error: {...} } con el texto en la raíz y Code da error como string:
// sólo se miran estos campos (la salida de error trae también el body que mandó el usuario).
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
const text = texts.find((t) => t.includes('PERIO:')) ?? texts[0] ?? serialize($json.error);
const match = text.match(/PERIO:([A-Z_]+)(?:\\|(.*))?/);
return [{ json: {
  success: false,
  code: match ? match[1] : 'UNKNOWN',
  detail: match && match[2] ? match[2].trim() : null,
  message: text || 'Error',
} }];`,
  },
}, [1000, -300]);
const ERROR = add(respond('Error', '={{ $json }}', 400), [1240, -300]);
link(MAP_ERROR, ERROR);

let row = 0;

/** Endpoint de una sola consulta: webhook → SQL → respuesta */
function simple({ webhookName, path, method, query, params, body }) {
  const top = row++ * 220;
  const wh = add(webhook(webhookName, path, method), [0, top]);
  const q = add(pg(`${webhookName} · SQL`, query, params), [240, top]);
  const ok = add(respond(`${webhookName} · OK`, body), [480, top]);
  link(wh, q);
  link(q, ok, 0);
  link(q, MAP_ERROR, 1);
}

simple({
  webhookName: 'GET perio/exams',
  path: 'perio/exams',
  method: 'GET',
  query: "SELECT public.perio_exams_list(NULLIF($1, '')::uuid) AS exams;",
  params: '={{ [String($json.query.patient_id ?? "")] }}',
  body: '={{ { success: true, exams: $json.exams ?? [] } }}',
});

simple({
  webhookName: 'POST perio/exams/save',
  path: 'perio/exams/save',
  method: 'POST',
  query: "SELECT public.perio_exam_save($1::jsonb, NULLIF($2, '')::uuid) AS exam;",
  params: `={{ [JSON.stringify($json.body.exam ?? {}), ${user('POST perio/exams/save')}] }}`,
  body: '={{ { success: true, exam: $json.exam } }}',
});

simple({
  webhookName: 'POST perio/exams/close',
  path: 'perio/exams/close',
  method: 'POST',
  query: "SELECT public.perio_exam_close(NULLIF($1, '')::bigint, NULLIF($2, '')::uuid) AS exam;",
  params: `={{ [String($json.body.id ?? ""), ${user('POST perio/exams/close')}] }}`,
  body: '={{ { success: true, exam: $json.exam } }}',
});

simple({
  webhookName: 'POST perio/exams/delete',
  path: 'perio/exams/delete',
  method: 'POST',
  query: "SELECT * FROM public.perio_exam_delete(NULLIF($1, '')::bigint, NULLIF($2, '')::uuid);",
  params: `={{ [String($json.body.id ?? ""), ${user('POST perio/exams/delete')}] }}`,
  body: '={{ { success: true, id: $json.id, deleted: $json.deleted } }}',
});

simple({
  webhookName: 'POST perio/exams/link-invoice',
  path: 'perio/exams/link-invoice',
  method: 'POST',
  query: "SELECT public.perio_exam_link_invoice(NULLIF($1, '')::bigint, NULLIF($2, '')::integer, NULLIF($3, '')::uuid) AS exam;",
  params: `={{ [String($json.body.id ?? ""), String($json.body.invoice_id ?? ""), ${user('POST perio/exams/link-invoice')}] }}`,
  body: '={{ { success: true, exam: $json.exam } }}',
});

simple({
  webhookName: 'POST perio/exams/amend',
  path: 'perio/exams/amend',
  method: 'POST',
  query: "SELECT public.perio_exam_amend(NULLIF($1, '')::bigint, $2, NULLIF($3, '')::uuid) AS exam;",
  params: `={{ [String($json.body.id ?? ""), String($json.body.body ?? ""), ${user('POST perio/exams/amend')}] }}`,
  body: '={{ { success: true, exam: $json.exam } }}',
});

nodes.unshift({
  id: stableId('node:Nota'),
  name: 'Nota',
  type: 'n8n-nodes-base.stickyNote',
  typeVersion: 1,
  position: [-480, -40],
  parameters: {
    width: 420,
    height: 340,
    content: `## Perio Record — periodontograma

Flujo NUEVO (no reemplaza nada). Requiere database/scripts/163 (periodontograma), 164 (diagnóstico) y 165 (cierre: factura y enmiendas).

Periodontogramas del paciente: piezas (estado, movilidad, furcas) y seis sitios por pieza (PS, MG, sangrado, supuración, placa). El estado, la completitud y los índices los calcula la base.

Errores: 'PERIO:<CODIGO>|<detalle>' ⇒ 400 { success:false, code, detail }.

Generado por scripts/n8n/generate-perio-record-workflow.mjs — no editar a mano.`,
  },
});

const workflow = { name: 'Perio Record', nodes, connections, settings: { executionOrder: 'v1' }, staticData: null };
writeFileSync(OUT_FILE, `${JSON.stringify(workflow, null, 2)}\n`);
console.log(`✓ ${OUT_FILE} (${nodes.length} nodos)`);
