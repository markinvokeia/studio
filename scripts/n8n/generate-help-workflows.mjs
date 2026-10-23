#!/usr/bin/env node
/**
 * Genera los workflows n8n del asistente guiado (n8n-workflows/help-*.json).
 * No editar los JSON a mano: se pisan en la próxima generación.
 *
 *   node scripts/n8n/generate-help-workflows.mjs
 *
 * Endpoints (API_ROUTES.HELP en src/constants/routes.ts):
 *   GET  help/onboarding/status    estado de cada paso, derivado de los datos
 *   POST help/onboarding/progress  omitir / reactivar un paso (HELP_ONBOARDING_MANAGE)
 *   GET  help/catalog/version      versión del catálogo publicado
 *   POST help/catalog/sync         publica el catálogo del frontend (HELP_CATALOG_SYNC)
 *   POST help/assistant/chat       RAG sobre el catálogo + OpenAI, respuesta validada
 *   POST help/assistant/feedback   👍/👎 de una respuesta
 *
 * Tablas: database/scripts/140_20261023_help-assistant-and-onboarding.sql.
 */

import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT_DIR = join(ROOT, 'n8n-workflows');

// Credenciales compartidas por los workflows de Invoke (mismas que docs/n8n-flows).
const PG_CREDENTIALS = { postgres: { id: '6b7Sjdnppbfve8ka', name: 'Postgres account' } };
const JWT_CREDENTIALS = { jwtAuth: { id: 'C6sB1r7ab5H5EmJj', name: 'JWT Auth account' } };
const OPENAI_CREDENTIALS = { openAiApi: { id: '5Crz2RwSV99AIItb', name: 'OpenAi account 2' } };
/** Modelo del asistente. Cambiarlo acá y regenerar (`pnpm n8n:help`). */
const OPENAI_MODEL = 'gpt-6-luna';

// ─── nodos ───────────────────────────────────────────────────────────────────

// El Webhook valida el token (JWT Auth) y deja el payload en `jwtPayload`.
const JWT_DECODE = `// Usuario autenticado: el Webhook ya verificó el JWT (credencial JWT Auth account)
const input = $input.first().json;
const userId = input.jwtPayload?.userId ?? input.jwtPayload?.sub;
if (!userId) throw new Error('userId no encontrado en el token');
`;

/** SQL: ¿el usuario $n tiene el permiso `code`? */
const hasPermissionSql = (param, code) => `EXISTS (
    SELECT 1
      FROM public.user_roles ur
      JOIN public.role_permissions rp ON rp.role_id = ur.role_id
      JOIN public.permissions p ON p.id = rp.permission_id
     WHERE ur.user_id = ${param}::uuid
       AND COALESCE((to_jsonb(ur) ->> 'is_active')::boolean, true)
       AND p.code = '${code}'
  )`;

function webhook(path, method) {
  return {
    id: 'node-webhook',
    name: 'Webhook',
    type: 'n8n-nodes-base.webhook',
    typeVersion: 2.1,
    parameters: {
      httpMethod: method,
      path,
      authentication: 'jwtAuth',
      responseMode: 'responseNode',
      options: { allowedOrigins: '*' },
    },
    credentials: JWT_CREDENTIALS,
  };
}

function code(id, name, jsCode) {
  return { id, name, type: 'n8n-nodes-base.code', typeVersion: 2, parameters: { jsCode } };
}

function pg(id, name, query, queryParams, { executeOnce = false } = {}) {
  // n8n lee los parámetros ($1, $2…) de `options.queryReplacement` (Postgres v2.x),
  // como en los workflows exportados de docs/n8n-flows. `additionalFields.queryParams`
  // es de la v1 y la importación lo descarta.
  const options = queryParams && queryParams !== '={{ [] }}' ? { queryReplacement: queryParams } : {};
  return {
    id,
    name,
    type: 'n8n-nodes-base.postgres',
    typeVersion: 2.6,
    parameters: { operation: 'executeQuery', query, options },
    credentials: PG_CREDENTIALS,
    alwaysOutputData: true,
    // El nodo anterior puede devolver varias filas: esta consulta corre una sola vez.
    ...(executeOnce ? { executeOnce: true } : {}),
  };
}

function respond(responseCodeExpr = 200) {
  return {
    id: 'node-respond',
    name: 'Responder',
    type: 'n8n-nodes-base.respondToWebhook',
    typeVersion: 1.1,
    parameters: { respondWith: 'json', responseBody: '={{ $json.body }}', options: { responseCode: responseCodeExpr } },
  };
}

/** Encadena los nodos en orden y les da posición. Los nodos `ai_*` se conectan aparte. */
function workflow(name, notes, chain, extra = { nodes: [], connections: {} }) {
  const nodes = chain.map((n, i) => ({ ...n, position: [100 + i * 230, 300] }));
  const connections = {};
  for (let i = 0; i < nodes.length - 1; i++) {
    connections[nodes[i].name] = { main: [[{ node: nodes[i + 1].name, type: 'main', index: 0 }]] };
  }
  return {
    name,
    nodes: [...nodes, ...extra.nodes],
    connections: { ...connections, ...extra.connections },
    active: false,
    settings: { executionOrder: 'v1' },
    meta: { templateCredsSetupCompleted: false, notes },
  };
}

const REQUIRED_SETUP = (extra = '') => `CONFIGURACIÓN:
1. Credenciales ya asignadas: "JWT Auth account" en el Webhook y "Postgres account" en los nodos Postgres.${extra}
2. Activar el workflow.

GENERADO por scripts/n8n/generate-help-workflows.mjs — no editar a mano.
Tablas: database/scripts/140_20261023_help-assistant-and-onboarding.sql`;

// ─── GET help/onboarding/status ──────────────────────────────────────────────

const onboardingStatus = workflow(
  'Help - Onboarding Estado',
  `${REQUIRED_SETUP()}

RUTA: GET /webhook/help/onboarding/status (Authorization: Bearer <JWT>)

Calcula cada paso con help_onboarding_compute() y registra la primera vez que
se cumple (onboarding_progress.completed_at). Un paso omitido sigue como
'skipped' hasta que se cumple de verdad.

RESPUESTA: { steps: [{ step_id, status: done|pending|skipped, count, completed_at, notes }] }`,
  [
    webhook('help/onboarding/status', 'GET'),
    code('node-auth', 'Extraer User ID', `${JWT_DECODE}
return [{ json: { user_id: String(userId) } }];`),
    pg('node-pg-status', 'Calcular Estado', `WITH s AS (
    SELECT * FROM public.help_onboarding_compute()
), marked AS (
    INSERT INTO public.onboarding_progress (step_id, status, completed_at, updated_at)
    SELECT step_id, 'done', now(), now() FROM s WHERE done
    ON CONFLICT (step_id) DO UPDATE
        SET status       = 'done',
            completed_at = COALESCE(public.onboarding_progress.completed_at, now()),
            updated_at   = now()
      WHERE public.onboarding_progress.status <> 'done'
    RETURNING step_id
)
SELECT s.step_id,
       CASE WHEN s.done THEN 'done'
            WHEN p.status = 'skipped' THEN 'skipped'
            ELSE 'pending' END AS status,
       s.item_count AS count,
       COALESCE(p.completed_at, CASE WHEN s.done THEN now() END) AS completed_at,
       p.notes
  FROM s
  LEFT JOIN public.onboarding_progress p ON p.step_id = s.step_id;`, '={{ [] }}'),
    code('node-format', 'Formatear Respuesta', `const items = $input.all();
if (items.length === 1 && items[0].json.error) {
  throw new Error('Error en base de datos: ' + (items[0].json.error?.message || String(items[0].json.error)));
}
const steps = items.map(i => i.json).filter(s => s.step_id).map(s => ({
  step_id: s.step_id,
  status: s.status,
  count: Number(s.count ?? 0),
  completed_at: s.completed_at ?? null,
  notes: s.notes ?? null,
}));
return [{ json: { body: { steps } } }];`),
    respond(),
  ],
);

// ─── POST help/onboarding/progress ───────────────────────────────────────────

const onboardingProgress = workflow(
  'Help - Onboarding Progreso',
  `${REQUIRED_SETUP()}

RUTA: POST /webhook/help/onboarding/progress (Authorization: Bearer <JWT>)
BODY: { step_id, status: 'skipped' | 'pending', notes? }
PERMISO: HELP_ONBOARDING_MANAGE (si no lo tiene, 403).

Un paso ya cumplido ('done') no vuelve atrás por esta vía.`,
  [
    webhook('help/onboarding/progress', 'POST'),
    code('node-auth', 'Validar Entrada', `${JWT_DECODE}
const body = input.body || {};
const stepId = String(body.step_id || '').trim();
const status = String(body.status || '');
if (!/^[a-z_]{2,40}$/.test(stepId)) throw new Error('step_id inválido');
if (!['skipped', 'pending'].includes(status)) throw new Error('status inválido');
const notes = typeof body.notes === 'string' ? body.notes.slice(0, 2000) : null;
return [{ json: { user_id: String(userId), step_id: stepId, status, notes } }];`),
    pg('node-pg-upsert', 'Guardar Progreso', `INSERT INTO public.onboarding_progress (step_id, status, notes, updated_by, updated_at)
SELECT $1, $2, $3, $4::uuid, now()
 WHERE ${hasPermissionSql('$4', 'HELP_ONBOARDING_MANAGE')}
ON CONFLICT (step_id) DO UPDATE
    SET status     = CASE WHEN public.onboarding_progress.status = 'done' THEN 'done' ELSE EXCLUDED.status END,
        notes      = COALESCE(EXCLUDED.notes, public.onboarding_progress.notes),
        updated_by = EXCLUDED.updated_by,
        updated_at = now()
RETURNING step_id, status, notes, completed_at;`, '={{ [ $json.step_id, $json.status, $json.notes, $json.user_id ] }}'),
    code('node-format', 'Formatear Respuesta', `const row = $input.first().json;
if (row.error) throw new Error('Error en base de datos: ' + (row.error?.message || String(row.error)));
if (!row.step_id) return [{ json: { status: 403, body: { error: 'forbidden', message: 'Falta el permiso HELP_ONBOARDING_MANAGE' } } }];
return [{ json: { status: 200, body: row } }];`),
    respond('={{ $json.status }}'),
  ],
);

// ─── GET help/catalog/version ────────────────────────────────────────────────

const catalogVersion = workflow(
  'Help - Catálogo Versión',
  `${REQUIRED_SETUP()}

RUTA: GET /webhook/help/catalog/version (Authorization: Bearer <JWT>)
RESPUESTA: { version: string | null, synced_at }`,
  [
    webhook('help/catalog/version', 'GET'),
    code('node-auth', 'Extraer User ID', `${JWT_DECODE}
return [{ json: { user_id: String(userId) } }];`),
    pg('node-pg-version', 'Última Publicación', `SELECT catalog_version AS version, synced_at
  FROM public.help_catalog_syncs
 ORDER BY synced_at DESC
 LIMIT 1;`, '={{ [] }}'),
    code('node-format', 'Formatear Respuesta', `const row = $input.first()?.json || {};
if (row.error) throw new Error('Error en base de datos: ' + (row.error?.message || String(row.error)));
return [{ json: { body: { version: row.version ?? null, synced_at: row.synced_at ?? null } } }];`),
    respond(),
  ],
);

// ─── POST help/catalog/sync ──────────────────────────────────────────────────

const catalogSync = workflow(
  'Help - Catálogo Sync',
  `${REQUIRED_SETUP()}

RUTA: POST /webhook/help/catalog/sync (Authorization: Bearer <JWT>)
BODY: el catálogo completo (src/generated/help-catalog.json del frontend).
PERMISO: HELP_CATALOG_SYNC (si no lo tiene, 403).

El frontend lo llama solo cuando su versión difiere de GET help/catalog/version:
así cada deploy del frontend actualiza la base de conocimiento de su cliente.
Lo que ya no viene en el catálogo queda status='stale' (no se borra).`,
  [
    webhook('help/catalog/sync', 'POST'),
    code('node-items', 'Armar Ítems', `${JWT_DECODE}
const catalog = input.body || {};
const version = String(catalog.version || '');
if (!/^[a-f0-9]{8,64}$/.test(version)) throw new Error('Catálogo sin versión válida');

const norm = (v) => String(v || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().replace(/\\s+/g, ' ').trim();
const join = (...parts) => parts.flat().filter(Boolean).join('\\n');
const items = [];
const push = (item) => items.push({ ...item, search_text: norm(join(item.title, item.body)) });

for (const s of catalog.screens || []) {
  push({
    id: 'screen:' + s.id, kind: 'screen', screen_id: s.id, route: s.route, title: s.title,
    body: join(s.module, s.summary, s.purpose, (s.tips || []).map(t => '- ' + t)),
    data: { id: s.id, route: s.route, module: s.module, prerequisites: s.prerequisites || [], useCases: s.useCases || [], inMenu: s.inMenu },
    permissions: s.permissions || [], status: s.status || 'auto',
  });
  for (const e of s.elements || []) {
    push({
      id: 'element:' + e.id, kind: 'element', screen_id: s.id, route: s.route,
      title: e.label || e.id, body: join(s.title, e.description),
      data: { id: e.id, kind: e.kind }, permissions: s.permissions || [], status: s.status || 'auto',
    });
  }
}
for (const u of catalog.useCases || []) {
  push({
    id: 'use_case:' + u.id, kind: 'use_case', screen_id: (u.screens || [])[0] || null, route: null,
    title: u.title, body: join(u.module, u.summary, (u.keywords || []).join(', '), (u.steps || []).map((st, i) => (i + 1) + '. ' + st.title + (st.description ? ': ' + st.description : ''))),
    data: u, permissions: [], status: 'draft',
  });
}
for (const j of catalog.journey || []) {
  push({ id: 'journey:' + j.id, kind: 'journey', screen_id: null, route: j.route, title: j.title, body: j.description, data: j, permissions: [], status: 'draft' });
}
for (const p of catalog.permissions || []) {
  push({ id: 'permission:' + p.code, kind: 'permission', screen_id: null, route: null, title: p.code, body: join(p.constant, p.description), data: p, permissions: [], status: 'auto' });
}
return [{ json: { user_id: String(userId), version, items: JSON.stringify(items) } }];`),
    pg('node-pg-sync', 'Publicar Catálogo', `WITH allowed AS (
    SELECT ${hasPermissionSql('$3', 'HELP_CATALOG_SYNC')} AS ok
), input AS (
    SELECT x.*
      FROM jsonb_to_recordset($2::jsonb) AS x(
               id text, kind text, screen_id text, route text, title text, body text,
               search_text text, data jsonb, permissions text[], status text)
     WHERE (SELECT ok FROM allowed)
), upserted AS (
    INSERT INTO public.help_catalog_items
           (id, kind, screen_id, route, title, body, search_text, data, permissions, status, catalog_version, updated_at)
    SELECT id, kind, screen_id, route, title, COALESCE(body, ''), COALESCE(search_text, ''),
           COALESCE(data, '{}'::jsonb), COALESCE(permissions, '{}'), COALESCE(status, 'auto'), $1, now()
      FROM input
    ON CONFLICT (id) DO UPDATE
        SET kind = EXCLUDED.kind, screen_id = EXCLUDED.screen_id, route = EXCLUDED.route,
            title = EXCLUDED.title, body = EXCLUDED.body, search_text = EXCLUDED.search_text,
            data = EXCLUDED.data, permissions = EXCLUDED.permissions, status = EXCLUDED.status,
            catalog_version = EXCLUDED.catalog_version, updated_at = now()
    RETURNING id
), staled AS (
    UPDATE public.help_catalog_items
       SET status = 'stale', updated_at = now()
     WHERE (SELECT ok FROM allowed)
       AND status <> 'stale'
       AND id NOT IN (SELECT id FROM input)
    RETURNING id
), logged AS (
    INSERT INTO public.help_catalog_syncs (catalog_version, items_count, stale_count, synced_by)
    SELECT $1, (SELECT count(*) FROM upserted), (SELECT count(*) FROM staled), $3::uuid
     WHERE (SELECT ok FROM allowed)
    RETURNING id
)
SELECT (SELECT ok FROM allowed) AS allowed,
       $1 AS version,
       (SELECT count(*) FROM upserted) AS items,
       (SELECT count(*) FROM staled) AS stale,
       (SELECT count(*) FROM logged) AS logged;`, '={{ [ $json.version, $json.items, $json.user_id ] }}'),
    code('node-format', 'Formatear Respuesta', `const row = $input.first().json;
if (row.error) throw new Error('Error en base de datos: ' + (row.error?.message || String(row.error)));
if (!row.allowed) return [{ json: { status: 403, body: { error: 'forbidden', message: 'Falta el permiso HELP_CATALOG_SYNC' } } }];
return [{ json: { status: 200, body: { version: row.version, items: Number(row.items), stale: Number(row.stale) } } }];`),
    respond('={{ $json.status }}'),
  ],
);

// ─── POST help/assistant/chat ────────────────────────────────────────────────

const STOPWORDS = ['como', 'cómo', 'para', 'que', 'qué', 'con', 'una', 'uno', 'unos', 'unas', 'los', 'las', 'del', 'por', 'donde', 'dónde', 'cuando', 'quiero', 'puedo', 'hago', 'hacer', 'tengo', 'necesito', 'esta', 'este', 'esto', 'ese', 'esa', 'son', 'hay', 'mis', 'tus', 'sus', 'the', 'and', 'how', 'what', 'where', 'can', 'guiame', 'guíame', 'ayudame', 'ayúdame', 'llevame', 'llévame', 'invoke'];

const SYSTEM_PROMPT = `Sos el asistente de Invoke IA, el sistema de gestión de clínicas de salud y odontológicas. Ayudás al equipo de la clínica a configurarlo y a usarlo.

REGLAS
1. Respondé SOLO con lo que está en el CONTEXTO (fichas del catálogo). Si no alcanza, decilo, poné confidence bajo (< 0.4) y no inventes pantallas, campos, botones ni pasos.
2. Respondé en el idioma del usuario (locale indicado), breve y práctico: pasos concretos, nombres de menú tal como aparecen.
3. "links": SIEMPRE al menos uno, la pantalla más relevante para la pregunta, sólo con rutas de RUTAS PERMITIDAS. Nunca inventes una ruta ni agregues el locale.
4. Si un caso de uso de CASOS DE USO resuelve el pedido o está relacionado con la pantalla del link, devolvé su id en "useCaseId" y NO armes "guide". La persona siempre ve "Llevarme" y "Guiarme".
5. Sólo si no hay caso de uso y el pedido requiere varios pasos en la pantalla actual, armá "guide" usando EXCLUSIVAMENTE help ids de ELEMENTOS VISIBLES o del CONTEXTO. Acciones: navigate (route), click (target), fill (target, value), highlight (target), confirm (target). El botón que guarda SIEMPRE va como "confirm": la persona confirma, nunca vos.
6. Si el usuario dictó datos (nombres, teléfonos, horarios, precios…), extraelos en "values" con las claves de "inputs" del caso de uso. Días de la semana como lista de números según indique el input. Horas como HH:MM. Montos y minutos como número.
7. "autoStart": true cuando el usuario pide que lo guíes o que lo hagas ("guiame", "hacelo", "cargalo", "llevame paso a paso") o cuando dictó datos para completar.
8. Si es un error del sistema, algo que no podés resolver o pide hablar con una persona: "escalate": true.

FORMATO: respondé ÚNICAMENTE un JSON válido, sin texto alrededor:
{"answer": "markdown breve", "confidence": 0.0-1.0, "links": [{"route": "/config/sedes", "label": "Sedes"}], "useCaseId": "id o null", "guide": null o {"title": "...", "steps": [{"id": "s1", "action": "click", "target": "help.id", "title": "...", "description": "..."}]}, "values": {}, "autoStart": false, "escalate": false}`;

const assistantChat = workflow(
  'Help - Asistente Chat',
  `${REQUIRED_SETUP(`
   "OpenAi account 2" en el nodo "OpenAI".`)}

RUTA: POST /webhook/help/assistant/chat (Authorization: Bearer <JWT>)
BODY: { message, locale, route, screenId, visibleTargets: [{id, kind, label}], history: [{role, content}] }

Flujo: búsqueda full-text en help_catalog_items → prompt con fichas, pantalla
actual, elementos visibles, casos de uso y pasos de onboarding pendientes →
OpenAI (${OPENAI_MODEL}) → validación contra la lista cerrada (rutas, casos de uso, help ids
del catálogo o visibles) → registro en help_questions.

RESPUESTA (HelpAssistantReply en src/lib/types.ts):
{ answer, confidence, links, useCaseId, guide, values, autoStart, videoUrl, questionId, escalated }`,
  [
    webhook('help/assistant/chat', 'POST'),
    code('node-prepare', 'Preparar Consulta', `${JWT_DECODE}
const body = input.body || {};
const message = String(body.message || '').trim().slice(0, 2000);
if (!message) throw new Error('message requerido');

const STOP = new Set(${JSON.stringify(STOPWORDS)});
const norm = (v) => String(v || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase();
const words = [...new Set(norm(message).split(/[^a-z0-9]+/).filter(w => w.length >= 3 && !STOP.has(w)))].slice(0, 12);
const tsquery = words.length ? words.map(w => w + ':*').join(' | ') : '';

const visible = Array.isArray(body.visibleTargets) ? body.visibleTargets.slice(0, 80)
  .filter(t => t && typeof t.id === 'string' && /^[a-zA-Z0-9_.-]{3,160}$/.test(t.id))
  .map(t => ({ id: t.id, kind: String(t.kind || ''), label: String(t.label || '').slice(0, 80) })) : [];
const history = Array.isArray(body.history) ? body.history.slice(-6)
  .map(h => ({ role: h.role === 'assistant' ? 'assistant' : 'user', content: String(h.content || '').slice(0, 600) })) : [];

return [{ json: {
  user_id: String(userId),
  message,
  tsquery,
  locale: String(body.locale || 'es').slice(0, 10),
  route: String(body.route || '/').slice(0, 200),
  screen_id: String(body.screenId || '').slice(0, 120),
  visible,
  history,
} }];`),
    pg('node-pg-search', 'Buscar en Catálogo', `SELECT id, kind, screen_id, route, title, body, data,
       CASE WHEN $1 = '' THEN 0 ELSE ts_rank(search, to_tsquery('spanish', $1)) END AS rank
  FROM public.help_catalog_items
 WHERE status <> 'stale'
   AND kind IN ('screen', 'element', 'use_case', 'journey')
   AND (($1 <> '' AND search @@ to_tsquery('spanish', $1))
        OR (kind = 'screen' AND screen_id = $2))
 ORDER BY (kind = 'screen' AND screen_id = $2) DESC, rank DESC
 LIMIT 14;`, "={{ [ $('Preparar Consulta').first().json.tsquery, $('Preparar Consulta').first().json.screen_id ] }}"),
    pg('node-pg-allowed', 'Lista Cerrada', `SELECT
  (SELECT COALESCE(jsonb_agg(DISTINCT route), '[]'::jsonb)
     FROM public.help_catalog_items WHERE kind = 'screen' AND status <> 'stale') AS routes,
  (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', data ->> 'id', 'title', title, 'summary', data ->> 'summary', 'inputs', data -> 'inputs')), '[]'::jsonb)
     FROM public.help_catalog_items WHERE kind = 'use_case' AND status <> 'stale') AS use_cases,
  (SELECT COALESCE(jsonb_agg(data ->> 'id'), '[]'::jsonb)
     FROM public.help_catalog_items WHERE kind = 'element' AND status <> 'stale') AS element_ids,
  (SELECT COALESCE(jsonb_object_agg(use_case_id, url), '{}'::jsonb)
     FROM (SELECT DISTINCT ON (use_case_id) use_case_id, url FROM public.help_videos
            WHERE status = 'ready' ORDER BY use_case_id, recorded_at DESC) v) AS videos,
  (SELECT COALESCE(jsonb_agg(step_id), '[]'::jsonb)
     FROM public.help_onboarding_compute() WHERE NOT done) AS pending_steps,
  (SELECT catalog_version FROM public.help_catalog_syncs ORDER BY synced_at DESC LIMIT 1) AS catalog_version;`, '={{ [] }}', { executeOnce: true }),
    code('node-prompt', 'Armar Prompt', `const q = $('Preparar Consulta').first().json;
const found = $('Buscar en Catálogo').all().map(i => i.json).filter(r => r.id);
const allowed = $input.first().json;

const context = found.map(r => {
  if (r.kind === 'use_case') return '[caso de uso ' + (r.data?.id || r.id) + '] ' + r.title + '\\n' + r.body;
  if (r.kind === 'element') return '[elemento ' + (r.data?.id || r.id) + ' en ' + r.route + '] ' + r.title + (r.body ? ' — ' + r.body : '');
  if (r.kind === 'journey') return '[onboarding ' + (r.data?.id || r.id) + ' → ' + r.route + '] ' + r.title + ': ' + r.body;
  return '[pantalla ' + r.route + '] ' + r.title + '\\n' + r.body;
}).join('\\n\\n');

const prompt = [
  'LOCALE: ' + q.locale,
  'PANTALLA ACTUAL: ' + q.route + (q.screen_id ? ' (' + q.screen_id + ')' : ''),
  'PASOS DE ONBOARDING PENDIENTES: ' + ((allowed.pending_steps || []).join(', ') || 'ninguno'),
  '',
  'CONTEXTO:',
  context || '(sin coincidencias en el catálogo)',
  '',
  'CASOS DE USO:',
  (allowed.use_cases || []).map(u => '- ' + u.id + ': ' + u.title + (u.inputs ? ' · inputs ' + JSON.stringify(u.inputs) : '')).join('\\n'),
  '',
  'RUTAS PERMITIDAS: ' + (allowed.routes || []).join(', '),
  '',
  'ELEMENTOS VISIBLES:',
  q.visible.map(v => '- ' + v.id + (v.label ? ' (' + v.label + ')' : '')).join('\\n') || '(ninguno)',
  '',
  'CONVERSACIÓN PREVIA:',
  q.history.map(h => h.role + ': ' + h.content).join('\\n') || '(ninguna)',
  '',
  'PREGUNTA: ' + q.message,
].join('\\n');

return [{ json: { prompt, matched: found.map(r => r.id) } }];`),
    {
      id: 'node-agent',
      name: 'Asistente',
      type: '@n8n/n8n-nodes-langchain.agent',
      typeVersion: 1.7,
      parameters: { promptType: 'define', text: '={{ $json.prompt }}', options: { systemMessage: SYSTEM_PROMPT } },
    },
    code('node-validate', 'Validar Respuesta', `const q = $('Preparar Consulta').first().json;
const allowed = $('Lista Cerrada').first().json;
const raw = String($input.first().json.output ?? '');

let parsed = {};
try {
  parsed = JSON.parse(raw.replace(/^\`\`\`(json)?\\s*/i, '').replace(/\`\`\`\\s*$/, '').trim());
} catch (_) {
  parsed = { answer: raw, confidence: 0.3 };
}

// Lista cerrada: nada que no exista en el catálogo publicado o en pantalla.
const routes = new Set(allowed.routes || []);
const useCases = new Set((allowed.use_cases || []).map(u => u.id));
const targets = new Set([...(allowed.element_ids || []), ...q.visible.map(v => v.id)]);
const ACTIONS = new Set(['navigate', 'click', 'fill', 'highlight', 'confirm', 'wait']);
const cleanRoute = (r) => String(r || '').replace(/^\\/(es-ES|es|en)(?=\\/|$)/, '') || '/';

const links = (Array.isArray(parsed.links) ? parsed.links : [])
  .map(l => ({ route: cleanRoute(l?.route).split('?')[0], label: String(l?.label || '').slice(0, 60) }))
  .filter(l => routes.has(l.route) && l.label)
  .slice(0, 3);

const useCaseId = useCases.has(parsed.useCaseId) ? parsed.useCaseId : null;

let guide = null;
if (!useCaseId && parsed.guide && Array.isArray(parsed.guide.steps)) {
  const steps = parsed.guide.steps.slice(0, 15).map((s, i) => ({
    id: String(s?.id || 's' + (i + 1)).slice(0, 40),
    action: String(s?.action || ''),
    title: String(s?.title || '').slice(0, 120),
    description: s?.description ? String(s.description).slice(0, 300) : undefined,
    target: s?.target ? String(s.target) : undefined,
    route: s?.route ? cleanRoute(s.route).split('?')[0] : undefined,
    value: ['string', 'number', 'boolean'].includes(typeof s?.value) ? s.value : undefined,
  })).filter(s => ACTIONS.has(s.action) && s.title && (s.action === 'navigate' ? routes.has(s.route) : targets.has(s.target)));
  if (steps.length) guide = { title: String(parsed.guide.title || 'Guía').slice(0, 120), steps };
}

const values = {};
if (parsed.values && typeof parsed.values === 'object') {
  for (const [k, v] of Object.entries(parsed.values).slice(0, 20)) {
    if (!/^[a-zA-Z0-9_]{1,40}$/.test(k)) continue;
    if (['string', 'number', 'boolean'].includes(typeof v)) values[k] = typeof v === 'string' ? v.slice(0, 300) : v;
    else if (Array.isArray(v)) values[k] = v.filter(x => ['string', 'number'].includes(typeof x)).slice(0, 10);
  }
}

let confidence = Number(parsed.confidence);
if (!Number.isFinite(confidence)) confidence = 0.5;
confidence = Math.max(0, Math.min(1, confidence));
const escalated = parsed.escalate === true || confidence < 0.4;

return [{ json: {
  reply: {
    answer: String(parsed.answer || '').slice(0, 4000),
    confidence,
    links,
    useCaseId,
    guide,
    values,
    autoStart: parsed.autoStart === true && Boolean(useCaseId || guide),
    videoUrl: (useCaseId && (allowed.videos || {})[useCaseId]) || null,
    escalated,
  },
  log: {
    user_id: q.user_id,
    question: q.message,
    answer: String(parsed.answer || '').slice(0, 4000),
    route: q.route,
    screen_id: q.screen_id || null,
    use_case_id: useCaseId,
    matched: $('Armar Prompt').first().json.matched || [],
    confidence,
    escalated,
    catalog_version: allowed.catalog_version || null,
  },
} }];`),
    pg('node-pg-log', 'Registrar Pregunta', `INSERT INTO public.help_questions
       (user_id, channel, question, answer, route, screen_id, use_case_id, matched_items,
        confidence, escalated, resolution_status, catalog_version)
VALUES ($1::uuid, 'app', $2, $3, $4, NULLIF($5, ''), NULLIF($6, ''),
        ARRAY(SELECT jsonb_array_elements_text($7::jsonb)),
        $8::numeric, $9::boolean, CASE WHEN $9::boolean THEN 'open' ELSE 'answered' END, NULLIF($10, ''))
RETURNING id;`, "={{ [ $json.log.user_id, $json.log.question, $json.log.answer, $json.log.route, $json.log.screen_id || '', $json.log.use_case_id || '', JSON.stringify($json.log.matched), $json.log.confidence, $json.log.escalated, $json.log.catalog_version || '' ] }}"),
    code('node-format', 'Formatear Respuesta', `const reply = $('Validar Respuesta').first().json.reply;
const row = $input.first()?.json || {};
return [{ json: { body: { ...reply, questionId: row.id || null } } }];`),
    respond(),
  ],
  {
    nodes: [{
      id: 'node-openai',
      name: 'OpenAI',
      type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
      typeVersion: 1.3,
      position: [1250, 520],
      // Mismo nodo que "BROU USD-UYU Exchange Rate". Sin temperature: los modelos de
      // razonamiento sólo aceptan el valor por defecto.
      parameters: { model: { __rl: true, value: OPENAI_MODEL, mode: 'id' }, builtInTools: {}, options: {} },
      credentials: OPENAI_CREDENTIALS,
    }],
    connections: { OpenAI: { ai_languageModel: [[{ node: 'Asistente', type: 'ai_languageModel', index: 0 }]] } },
  },
);

// ─── POST help/assistant/feedback ────────────────────────────────────────────

const assistantFeedback = workflow(
  'Help - Asistente Feedback',
  `${REQUIRED_SETUP()}

RUTA: POST /webhook/help/assistant/feedback (Authorization: Bearer <JWT>)
BODY: { question_id, rating: 1 | -1, feedback? }

Un 👎 deja la pregunta en resolution_status='open': entra a la cola de
preguntas sin buena respuesta para completar el catálogo.`,
  [
    webhook('help/assistant/feedback', 'POST'),
    code('node-auth', 'Validar Entrada', `${JWT_DECODE}
const body = input.body || {};
const questionId = String(body.question_id || '');
if (!/^[0-9a-f-]{36}$/i.test(questionId)) throw new Error('question_id inválido');
const rating = Number(body.rating);
if (rating !== 1 && rating !== -1) throw new Error('rating inválido');
const feedback = typeof body.feedback === 'string' ? body.feedback.slice(0, 2000) : null;
return [{ json: { user_id: String(userId), question_id: questionId, rating, feedback } }];`),
    pg('node-pg-feedback', 'Guardar Feedback', `UPDATE public.help_questions
   SET rating            = $2::smallint,
       feedback          = COALESCE($3, feedback),
       resolution_status = CASE WHEN $2::smallint = -1 THEN 'open' ELSE resolution_status END
 WHERE id = $1::uuid
   AND (user_id IS NULL OR user_id = $4::uuid)
RETURNING id, rating;`, '={{ [ $json.question_id, $json.rating, $json.feedback, $json.user_id ] }}'),
    code('node-format', 'Formatear Respuesta', `const row = $input.first()?.json || {};
if (row.error) throw new Error('Error en base de datos: ' + (row.error?.message || String(row.error)));
return [{ json: { body: { ok: Boolean(row.id) } } }];`),
    respond(),
  ],
);

// ─── escribir ────────────────────────────────────────────────────────────────

const files = {
  'help-onboarding-status.json': onboardingStatus,
  'help-onboarding-progress.json': onboardingProgress,
  'help-catalog-version.json': catalogVersion,
  'help-catalog-sync.json': catalogSync,
  'help-assistant-chat.json': assistantChat,
  'help-assistant-feedback.json': assistantFeedback,
};

for (const [file, wf] of Object.entries(files)) {
  writeFileSync(join(OUT_DIR, file), JSON.stringify(wf, null, 2) + '\n');
  console.log(`[n8n] ${file}`);
}
