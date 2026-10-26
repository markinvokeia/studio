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

// ─── GET help/settings ───────────────────────────────────────────────────────

const settings = workflow(
  'Help - Ajustes',
  `${REQUIRED_SETUP()}

RUTA: GET /webhook/help/settings (Authorization: Bearer <JWT>)
RESPUESTA: { mascot_visible: boolean }
Ajustes del asistente que fija la clínica (Configuración → Preferencias de Clínica).
Los lee cualquier usuario con el asistente: system_configurations no está a su alcance.
Clave: system_configurations.help_mascot_visible (database/scripts/142), default true.`,
  [
    webhook('help/settings', 'GET'),
    code('node-auth', 'Extraer User ID', `${JWT_DECODE}
return [{ json: { user_id: String(userId) } }];`),
    pg('node-pg-settings', 'Leer Ajustes', `SELECT (SELECT value FROM public.system_configurations WHERE key = 'help_mascot_visible' LIMIT 1) AS mascot_visible;`, '={{ [] }}'),
    code('node-format', 'Formatear Respuesta', `const row = $input.first()?.json || {};
if (row.error) throw new Error('Error en base de datos: ' + (row.error?.message || String(row.error)));
// Sin la clave (script 142 sin aplicar) la mascota se ve, como hasta ahora.
const raw = row.mascot_visible;
const mascot_visible = raw === null || raw === undefined ? true : String(raw).trim().toLowerCase() !== 'false';
return [{ json: { body: { mascot_visible } } }];`),
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
const seen = new Set();
// Un mismo componente (p. ej. el diálogo de citas) aparece en varias pantallas: un ítem por id.
const push = (item) => {
  if (seen.has(item.id)) return;
  seen.add(item.id);
  items.push({ ...item, search_text: norm(join(item.title, item.body)) });
};

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
       AND kind <> 'table'
       AND id NOT IN (SELECT id FROM input)
    RETURNING id
), schema_items AS (
    -- Esquema de la BD (tablas, columnas, FKs, comentarios): se arma acá, nunca viaja al navegador.
    SELECT public.help_refresh_schema_items($1) AS n
     WHERE (SELECT ok FROM allowed)
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
       (SELECT n FROM schema_items) AS tables,
       (SELECT count(*) FROM logged) AS logged;`, '={{ [ $json.version, $json.items, $json.user_id ] }}'),
    code('node-format', 'Formatear Respuesta', `const row = $input.first().json;
if (row.error) throw new Error('Error en base de datos: ' + (row.error?.message || String(row.error)));
if (!row.allowed) return [{ json: { status: 403, body: { error: 'forbidden', message: 'Falta el permiso HELP_CATALOG_SYNC' } } }];
return [{ json: { status: 200, body: { version: row.version, items: Number(row.items), stale: Number(row.stale), tables: Number(row.tables ?? 0) } } }];`),
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
4. Las guías están PREDEFINIDAS y probadas: NUNCA armes una guía ni pasos propios. En "useCaseIds" devolvé hasta 3 ids de CASOS DE USO, del más parecido al pedido al menos parecido. Preferí los de la PANTALLA ACTUAL y los de la pantalla del link. "useCaseId" es el primero (o null). La persona ve "Guiarme" en cada uno y "Llevarme" en el link.
5. Si ningún caso de uso aplica, "useCaseIds": [] y explicá en "answer" qué hacer y dónde (con el link).
6. Si el usuario dictó datos (nombres, teléfonos, horarios, precios…), extraelos en "values" con las claves de "inputs" del caso de uso. Días de la semana como lista de números según indique el input. Horas como HH:MM. Montos y minutos como número.
7. "autoStart": true cuando el usuario pide que lo guíes o que lo hagas ("guiame", "hacelo", "cargalo", "llevame paso a paso") o cuando dictó datos para completar.
8. Si es un error del sistema, algo que no podés resolver o pide hablar con una persona: "escalate": true (se abre un ticket para el equipo de soporte). Si es un error del sistema, además "systemError": true.

FORMATO: respondé ÚNICAMENTE un JSON válido, sin texto alrededor:
{"answer": "markdown breve", "confidence": 0.0-1.0, "links": [{"route": "/config/sedes", "label": "Sedes"}], "useCaseIds": ["id más parecido", "otro"], "useCaseId": "el primero o null", "values": {}, "autoStart": false, "escalate": false, "systemError": false}`;

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
{ answer, confidence, links, useCaseId, useCaseIds, values, autoStart, videoUrl, questionId, escalated }`,
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
   AND kind IN ('screen', 'element', 'use_case', 'journey', 'table')
   AND (($1 <> '' AND search @@ to_tsquery('spanish', $1))
        OR (kind = 'screen' AND screen_id = $2))
 ORDER BY (kind = 'screen' AND screen_id = $2) DESC, rank DESC
 LIMIT 14;`, "={{ [ $('Preparar Consulta').first().json.tsquery, $('Preparar Consulta').first().json.screen_id ] }}"),
    pg('node-pg-allowed', 'Lista Cerrada', `SELECT
  (SELECT COALESCE(jsonb_agg(DISTINCT route), '[]'::jsonb)
     FROM public.help_catalog_items WHERE kind = 'screen' AND status <> 'stale') AS routes,
  (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', data ->> 'id', 'title', title, 'summary', data ->> 'summary', 'inputs', data -> 'inputs', 'screens', data -> 'screens', 'group', data ->> 'group')), '[]'::jsonb)
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
  if (r.kind === 'table') return '[tabla de la BD ' + r.title + ']\\n' + String(r.body || '').slice(0, 1500);
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
  (allowed.use_cases || []).map(u => '- ' + u.id + (Array.isArray(u.screens) && u.screens.length ? ' [pantallas: ' + u.screens.join(', ') + ']' : '') + (u.group ? ' [' + u.group + ']' : '') + ': ' + u.title + (u.summary ? ' — ' + u.summary : '') + (u.inputs ? ' · inputs ' + JSON.stringify(u.inputs) : '')).join('\\n'),
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
const cleanRoute = (r) => String(r || '').replace(/^\\/(es-ES|es|en)(?=\\/|$)/, '') || '/';

const links = (Array.isArray(parsed.links) ? parsed.links : [])
  .map(l => ({ route: cleanRoute(l?.route).split('?')[0], label: String(l?.label || '').slice(0, 60) }))
  .filter(l => routes.has(l.route) && l.label)
  .slice(0, 3);

// Sólo guías predefinidas del catálogo (nunca pasos armados por el modelo).
const suggested = [...(Array.isArray(parsed.useCaseIds) ? parsed.useCaseIds : []), parsed.useCaseId]
  .map(id => String(id || ''))
  .filter((id, i, all) => id && useCases.has(id) && all.indexOf(id) === i)
  .slice(0, 3);
const useCaseId = suggested[0] || null;

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
    useCaseIds: suggested,
    values,
    autoStart: parsed.autoStart === true && Boolean(useCaseId),
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
    // El agente lo marca como error del sistema: el ticket sale con prioridad alta.
    system_error: parsed.systemError === true,
    catalog_version: allowed.catalog_version || null,
  },
} }];`),
    pg('node-pg-log', 'Registrar Pregunta', `WITH q AS (
    INSERT INTO public.help_questions
           (user_id, channel, question, answer, route, screen_id, use_case_id, matched_items,
            confidence, escalated, resolution_status, catalog_version)
    VALUES ($1::uuid, 'app', $2, $3, $4, NULLIF($5, ''), NULLIF($6, ''),
            ARRAY(SELECT jsonb_array_elements_text($7::jsonb)),
            $8::numeric, $9::boolean, CASE WHEN $9::boolean THEN 'open' ELSE 'answered' END, NULLIF($10, ''))
    RETURNING id
), ticket AS (
    -- Escalado: ticket para el equipo de soporte con la pantalla y la pregunta.
    INSERT INTO public.help_support_tickets (question_id, user_id, channel, subject, route, screen_id, context, priority)
    SELECT q.id, $1::uuid, 'app', left($2, 200), $4, NULLIF($5, ''),
           jsonb_build_object('question', $2, 'answer', $3, 'confidence', $8::numeric, 'catalog_version', NULLIF($10, '')),
           CASE WHEN $11::boolean THEN 'high' ELSE 'normal' END
      FROM q
     WHERE $9::boolean
    RETURNING id
)
SELECT (SELECT id FROM q) AS id, (SELECT id FROM ticket) AS ticket_id;`, "={{ [ $json.log.user_id, $json.log.question, $json.log.answer, $json.log.route, $json.log.screen_id || '', $json.log.use_case_id || '', JSON.stringify($json.log.matched), $json.log.confidence, $json.log.escalated, $json.log.catalog_version || '', $json.log.system_error ] }}"),
    code('node-format', 'Formatear Respuesta', `const reply = $('Validar Respuesta').first().json.reply;
const row = $input.first()?.json || {};
return [{ json: { body: { ...reply, questionId: row.id || null, ticketId: row.ticket_id ? String(row.ticket_id) : null } } }];`),
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

// ─── POST help/videos/request ────────────────────────────────────────────────

const videoRequest = workflow(
  'Help - Video Pedido',
  `${REQUIRED_SETUP()}

RUTA: POST /webhook/help/videos/request (Authorization: Bearer <JWT>)
BODY: { use_case_id, locale?, question_id? }

Encola el pedido de video de un caso de uso (uno abierto por caso e idioma).
Lo toma el worker de scripts/videos (pnpm videos:worker).`,
  [
    webhook('help/videos/request', 'POST'),
    code('node-auth', 'Validar Entrada', `${JWT_DECODE}
const body = input.body || {};
const useCaseId = String(body.use_case_id || '');
if (!/^[a-z0-9_.-]{3,80}$/.test(useCaseId)) throw new Error('use_case_id inválido');
const locale = ['es', 'es-ES', 'en'].includes(body.locale) ? body.locale : 'es';
const questionId = /^[0-9a-f-]{36}$/i.test(String(body.question_id || '')) ? body.question_id : '';
return [{ json: { user_id: String(userId), use_case_id: useCaseId, locale, question_id: questionId } }];`),
    pg('node-pg-request', 'Encolar Pedido', `WITH existing AS (
    SELECT id, status FROM public.help_video_requests
     WHERE use_case_id = $1 AND locale = $2 AND status IN ('pending', 'processing')
), inserted AS (
    INSERT INTO public.help_video_requests (use_case_id, locale, requested_by, question_id)
    SELECT $1, $2, $3::uuid, NULLIF($4, '')::uuid
     WHERE NOT EXISTS (SELECT 1 FROM existing)
       AND EXISTS (SELECT 1 FROM public.help_catalog_items WHERE id = 'use_case:' || $1 AND status <> 'stale')
    ON CONFLICT DO NOTHING
    RETURNING id, status
)
SELECT COALESCE((SELECT id FROM inserted), (SELECT id FROM existing)) AS id,
       COALESCE((SELECT status FROM inserted), (SELECT status FROM existing)) AS status;`, '={{ [ $json.use_case_id, $json.locale, $json.user_id, $json.question_id ] }}'),
    code('node-format', 'Formatear Respuesta', `const row = $input.first()?.json || {};
if (row.error) throw new Error('Error en base de datos: ' + (row.error?.message || String(row.error)));
if (!row.id) return [{ json: { status: 404, body: { error: 'not_found', message: 'Caso de uso desconocido' } } }];
return [{ json: { status: 200, body: { id: row.id, status: row.status } } }];`),
    respond('={{ $json.status }}'),
  ],
);

// ─── POST help/videos/queue ──────────────────────────────────────────────────

const videoQueue = workflow(
  'Help - Video Cola',
  `${REQUIRED_SETUP()}

RUTA: POST /webhook/help/videos/queue (Authorization: Bearer <JWT>)
BODY: { limit? }
PERMISO: HELP_CATALOG_SYNC (lo usa el worker de videos con un usuario técnico).

Toma hasta \`limit\` pedidos pendientes y los marca 'processing' (SKIP LOCKED:
dos workers no toman el mismo).`,
  [
    webhook('help/videos/queue', 'POST'),
    code('node-auth', 'Validar Entrada', `${JWT_DECODE}
const limit = Math.max(1, Math.min(10, Number(input.body?.limit) || 3));
return [{ json: { user_id: String(userId), limit } }];`),
    pg('node-pg-queue', 'Tomar Pedidos', `WITH allowed AS (
    SELECT ${hasPermissionSql('$1', 'HELP_CATALOG_SYNC')} AS ok
), picked AS (
    SELECT id FROM public.help_video_requests
     WHERE status = 'pending' AND (SELECT ok FROM allowed)
     ORDER BY created_at
     LIMIT $2::int
     FOR UPDATE SKIP LOCKED
)
UPDATE public.help_video_requests r
   SET status = 'processing', updated_at = now()
  FROM picked
 WHERE r.id = picked.id
RETURNING r.id, r.use_case_id, r.locale, (SELECT ok FROM allowed) AS allowed;`, '={{ [ $json.user_id, $json.limit ] }}'),
    code('node-format', 'Formatear Respuesta', `const rows = $input.all().map(i => i.json).filter(r => r.id);
return [{ json: { body: { requests: rows.map(r => ({ id: r.id, use_case_id: r.use_case_id, locale: r.locale })) } } }];`),
    respond(),
  ],
);

// ─── POST help/videos/register ───────────────────────────────────────────────

const videoRegister = workflow(
  'Help - Video Registrar',
  `${REQUIRED_SETUP()}

RUTA: POST /webhook/help/videos/register (Authorization: Bearer <JWT>)
BODY: { use_case_id, locale, title, url, duration_seconds, catalog_version, request_id?, error?, stale? }
PERMISO: HELP_CATALOG_SYNC.

Publica (o reemplaza) el video de un caso de uso y cierra el pedido. Con
\`error\` sólo marca el pedido como fallido. Con \`stale: true\` marca el video
como desactualizado (lo usa el job nocturno cuando falla la guía).`,
  [
    webhook('help/videos/register', 'POST'),
    code('node-auth', 'Validar Entrada', `${JWT_DECODE}
const b = input.body || {};
const useCaseId = String(b.use_case_id || '');
if (!/^[a-z0-9_.-]{3,80}$/.test(useCaseId)) throw new Error('use_case_id inválido');
const locale = ['es', 'es-ES', 'en'].includes(b.locale) ? b.locale : 'es';
const error = b.error ? String(b.error).slice(0, 2000) : '';
const stale = b.stale === true ? '1' : '';
const url = String(b.url || '');
if (!error && !stale && !/^(https:\\/\\/|\\/)[^\\s]{3,500}$/.test(url)) throw new Error('url inválida');
return [{ json: {
  user_id: String(userId), use_case_id: useCaseId, locale, error, url,
  title: String(b.title || useCaseId).slice(0, 200),
  duration: Number.isFinite(Number(b.duration_seconds)) ? Math.round(Number(b.duration_seconds)) : null,
  catalog_version: String(b.catalog_version || ''),
  request_id: /^[0-9a-f-]{36}$/i.test(String(b.request_id || '')) ? b.request_id : '',
  stale,
} }];`),
    pg('node-pg-register', 'Publicar Video', `WITH allowed AS (
    SELECT ${hasPermissionSql('$1', 'HELP_CATALOG_SYNC')} AS ok
), video AS (
    INSERT INTO public.help_videos (id, use_case_id, title, url, locale, duration_seconds, status, catalog_version, recorded_at)
    SELECT $2 || '-' || $3, $2, $4, $5, $3, $6::int, 'ready', NULLIF($7, ''), now()
     WHERE (SELECT ok FROM allowed) AND $8 = '' AND $10 = ''
    ON CONFLICT (id) DO UPDATE
        SET title = EXCLUDED.title, url = EXCLUDED.url, duration_seconds = EXCLUDED.duration_seconds,
            status = 'ready', catalog_version = EXCLUDED.catalog_version, recorded_at = now()
    RETURNING id
), staled AS (
    UPDATE public.help_videos SET status = 'stale'
     WHERE (SELECT ok FROM allowed) AND $10 = '1' AND use_case_id = $2 AND status = 'ready'
    RETURNING id
), closed AS (
    UPDATE public.help_video_requests
       SET status = CASE WHEN $8 = '' THEN 'done' ELSE 'failed' END,
           error = NULLIF($8, ''),
           video_id = (SELECT id FROM video),
           updated_at = now()
     WHERE (SELECT ok FROM allowed)
       AND $10 = ''
       AND status IN ('pending', 'processing')
       AND (id::text = $9 OR ($9 = '' AND use_case_id = $2 AND locale = $3))
    RETURNING id
)
SELECT (SELECT ok FROM allowed) AS allowed, (SELECT id FROM video) AS video_id,
       (SELECT count(*) FROM closed) AS closed, (SELECT count(*) FROM staled) AS staled;`,
      '={{ [ $json.user_id, $json.use_case_id, $json.locale, $json.title, $json.url, $json.duration, $json.catalog_version, $json.error, $json.request_id, $json.stale ] }}'),
    code('node-format', 'Formatear Respuesta', `const row = $input.first()?.json || {};
if (row.error) throw new Error('Error en base de datos: ' + (row.error?.message || String(row.error)));
if (!row.allowed) return [{ json: { status: 403, body: { error: 'forbidden', message: 'Falta el permiso HELP_CATALOG_SYNC' } } }];
return [{ json: { status: 200, body: { video_id: row.video_id ?? null, closed: Number(row.closed), staled: Number(row.staled) } } }];`),
    respond('={{ $json.status }}'),
  ],
);

// ─── GET help/insights ───────────────────────────────────────────────────────

const insights = workflow(
  'Help - Métricas',
  `${REQUIRED_SETUP()}

RUTA: GET /webhook/help/insights?days=30 (Authorization: Bearer <JWT>)
PERMISO: HELP_INSIGHTS_VIEW.

Totales y evolución de preguntas, pantallas con más dudas, cola de preguntas
sin resolver, tickets abiertos, videos y avance del onboarding.`,
  [
    webhook('help/insights', 'GET'),
    code('node-auth', 'Validar Entrada', `${JWT_DECODE}
const days = Math.max(1, Math.min(365, Number(input.query?.days) || 30));
return [{ json: { user_id: String(userId), days } }];`),
    pg('node-pg-insights', 'Calcular Métricas', `WITH allowed AS (
    SELECT ${hasPermissionSql('$1', 'HELP_INSIGHTS_VIEW')} AS ok
), qs AS (
    SELECT * FROM public.help_questions
     WHERE created_at >= now() - make_interval(days => $2::int)
       AND (SELECT ok FROM allowed)
)
SELECT
  (SELECT ok FROM allowed) AS allowed,
  (SELECT jsonb_build_object(
      'total', count(*),
      'resolved', count(*) FILTER (WHERE NOT escalated AND COALESCE(rating, 1) <> -1),
      'escalated', count(*) FILTER (WHERE escalated),
      'positive', count(*) FILTER (WHERE rating = 1),
      'negative', count(*) FILTER (WHERE rating = -1),
      'avg_confidence', round(avg(confidence), 3),
      'weekend_human', count(*) FILTER (WHERE escalated AND extract(isodow FROM created_at) IN (6, 7))
   ) FROM qs) AS totals,
  (SELECT COALESCE(jsonb_agg(w ORDER BY w.week), '[]'::jsonb) FROM (
      SELECT to_char(date_trunc('week', created_at), 'YYYY-MM-DD') AS week,
             count(*) AS total,
             count(*) FILTER (WHERE escalated) AS escalated
        FROM qs GROUP BY 1) w) AS by_week,
  (SELECT COALESCE(jsonb_agg(s ORDER BY s.total DESC), '[]'::jsonb) FROM (
      SELECT COALESCE(screen_id, '') AS screen_id, count(*) AS total,
             count(*) FILTER (WHERE escalated OR rating = -1) AS unresolved
        FROM qs GROUP BY 1 ORDER BY 2 DESC LIMIT 10) s) AS by_screen,
  (SELECT COALESCE(jsonb_agg(o ORDER BY o.created_at DESC), '[]'::jsonb) FROM (
      SELECT q.id, q.question, q.answer, q.confidence, q.rating, q.route, q.screen_id, q.created_at, u.name AS user_name
        FROM public.help_questions q
        LEFT JOIN public.users u ON u.id = q.user_id
       WHERE q.resolution_status = 'open' AND (SELECT ok FROM allowed)
       ORDER BY q.created_at DESC LIMIT 50) o) AS open_questions,
  (SELECT COALESCE(jsonb_agg(t ORDER BY t.created_at DESC), '[]'::jsonb) FROM (
      SELECT t.id, t.subject, t.route, t.status, t.priority, t.channel, t.created_at, u.name AS user_name
        FROM public.help_support_tickets t
        LEFT JOIN public.users u ON u.id = t.user_id
       WHERE t.status IN ('open', 'in_progress') AND (SELECT ok FROM allowed)
       ORDER BY t.created_at DESC LIMIT 50) t) AS tickets,
  (SELECT COALESCE(jsonb_agg(jsonb_build_object('step_id', p.step_id, 'status', p.status, 'completed_at', p.completed_at) ORDER BY p.completed_at NULLS LAST), '[]'::jsonb)
     FROM public.onboarding_progress p WHERE (SELECT ok FROM allowed)) AS onboarding,
  (SELECT jsonb_build_object(
      'ready', (SELECT count(*) FROM public.help_videos WHERE status = 'ready'),
      'stale', (SELECT count(*) FROM public.help_videos WHERE status = 'stale'),
      'requests_open', (SELECT count(*) FROM public.help_video_requests WHERE status IN ('pending', 'processing')),
      'requests_failed', (SELECT count(*) FROM public.help_video_requests WHERE status = 'failed')
   ) WHERE (SELECT ok FROM allowed)) AS videos,
  (SELECT jsonb_build_object(
      'version', (SELECT catalog_version FROM public.help_catalog_syncs ORDER BY synced_at DESC LIMIT 1),
      'synced_at', (SELECT synced_at FROM public.help_catalog_syncs ORDER BY synced_at DESC LIMIT 1),
      'screens', count(*) FILTER (WHERE kind = 'screen' AND status <> 'stale'),
      'validated', count(*) FILTER (WHERE kind = 'screen' AND status = 'validated'),
      'tables', count(*) FILTER (WHERE kind = 'table' AND status <> 'stale')
   ) FROM public.help_catalog_items WHERE (SELECT ok FROM allowed)) AS catalog;`, '={{ [ $json.user_id, $json.days ] }}'),
    code('node-format', 'Formatear Respuesta', `const row = $input.first()?.json || {};
if (row.error) throw new Error('Error en base de datos: ' + (row.error?.message || String(row.error)));
if (!row.allowed) return [{ json: { status: 403, body: { error: 'forbidden', message: 'Falta el permiso HELP_INSIGHTS_VIEW' } } }];
const { allowed, ...data } = row;
return [{ json: { status: 200, body: data } }];`),
    respond('={{ $json.status }}'),
  ],
);

// ─── POST help/support/update ────────────────────────────────────────────────

const supportUpdate = workflow(
  'Help - Soporte Actualizar',
  `${REQUIRED_SETUP()}

RUTA: POST /webhook/help/support/update (Authorization: Bearer <JWT>)
BODY: { type: 'question' | 'ticket', id, status, note? }
  question: status resolved | ignored | open
  ticket:   status open | in_progress | resolved | closed
PERMISO: HELP_INSIGHTS_VIEW.`,
  [
    webhook('help/support/update', 'POST'),
    code('node-auth', 'Validar Entrada', `${JWT_DECODE}
const b = input.body || {};
const type = b.type === 'ticket' ? 'ticket' : b.type === 'question' ? 'question' : null;
if (!type) throw new Error('type inválido');
const id = String(b.id || '');
if (!(type === 'ticket' ? /^\\d{1,12}$/ : /^[0-9a-f-]{36}$/i).test(id)) throw new Error('id inválido');
const STATUSES = { question: ['resolved', 'ignored', 'open'], ticket: ['open', 'in_progress', 'resolved', 'closed'] };
const status = String(b.status || '');
if (!STATUSES[type].includes(status)) throw new Error('status inválido');
const note = typeof b.note === 'string' ? b.note.slice(0, 2000) : '';
return [{ json: { user_id: String(userId), type, id, status, note } }];`),
    pg('node-pg-update', 'Actualizar', `WITH allowed AS (
    SELECT ${hasPermissionSql('$1', 'HELP_INSIGHTS_VIEW')} AS ok
), q AS (
    UPDATE public.help_questions
       SET resolution_status = $4,
           feedback = CASE WHEN $5 = '' THEN feedback ELSE concat_ws(E'\\n', feedback, $5) END
     WHERE $2 = 'question' AND id::text = $3 AND (SELECT ok FROM allowed)
    RETURNING id::text
), t AS (
    UPDATE public.help_support_tickets
       SET status = $4,
           resolution = COALESCE(NULLIF($5, ''), resolution),
           assigned_to = COALESCE(assigned_to, $1::uuid),
           updated_at = now()
     WHERE $2 = 'ticket' AND id::text = $3 AND (SELECT ok FROM allowed)
    RETURNING id::text
)
SELECT (SELECT ok FROM allowed) AS allowed, COALESCE((SELECT id FROM q), (SELECT id FROM t)) AS id;`,
      '={{ [ $json.user_id, $json.type, $json.id, $json.status, $json.note ] }}'),
    code('node-format', 'Formatear Respuesta', `const row = $input.first()?.json || {};
if (row.error) throw new Error('Error en base de datos: ' + (row.error?.message || String(row.error)));
if (!row.allowed) return [{ json: { status: 403, body: { error: 'forbidden', message: 'Falta el permiso HELP_INSIGHTS_VIEW' } } }];
return [{ json: { status: row.id ? 200 : 404, body: { id: row.id ?? null } } }];`),
    respond('={{ $json.status }}'),
  ],
);

// ─── escribir ────────────────────────────────────────────────────────────────

const files = {
  'help-onboarding-status.json': onboardingStatus,
  'help-onboarding-progress.json': onboardingProgress,
  'help-catalog-version.json': catalogVersion,
  'help-settings.json': settings,
  'help-catalog-sync.json': catalogSync,
  'help-assistant-chat.json': assistantChat,
  'help-assistant-feedback.json': assistantFeedback,
  'help-video-request.json': videoRequest,
  'help-video-queue.json': videoQueue,
  'help-video-register.json': videoRegister,
  'help-insights.json': insights,
  'help-support-update.json': supportUpdate,
};

for (const [file, wf] of Object.entries(files)) {
  writeFileSync(join(OUT_DIR, file), JSON.stringify(wf, null, 2) + '\n');
  console.log(`[n8n] ${file}`);
}
