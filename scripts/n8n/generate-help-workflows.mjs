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
 *   POST voice/interpret           comando de voz de un módulo → OpenAI → JSON validado (no escribe)
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

// ─── GET help/videos ─────────────────────────────────────────────────────────

const videosList = workflow(
  'Help - Videos',
  `${REQUIRED_SETUP()}

RUTA: GET /webhook/help/videos?locale=es|es-ES|en (Authorization: Bearer <JWT>)
RESPUESTA: { videos: [{ useCaseId, url, title, durationSeconds, locale }] }
Un video por guía (o recorrido tour.<pantalla>): el del idioma pedido y, si no hay,
el español. Lo usa la ficha de la pantalla ("Guías de esta pantalla") para ofrecer
"Ver video" junto a "Guiarme" sin pasar por el chat.`,
  [
    webhook('help/videos', 'GET'),
    code('node-auth', 'Extraer User ID', `${JWT_DECODE}
const locale = ['es', 'es-ES', 'en'].includes(input.query?.locale) ? input.query.locale : 'es';
return [{ json: { user_id: String(userId), locale } }];`),
    pg('node-pg-videos', 'Leer Videos', `SELECT COALESCE(jsonb_agg(jsonb_build_object('useCaseId', use_case_id, 'url', url, 'title', title, 'durationSeconds', duration_seconds, 'locale', locale) ORDER BY use_case_id), '[]'::jsonb) AS videos
  FROM (SELECT DISTINCT ON (use_case_id) use_case_id, url, title, duration_seconds, locale FROM public.help_videos
         WHERE status = 'ready'
         ORDER BY use_case_id, (locale = $1) DESC, (left(locale, 2) = left($1, 2)) DESC, (locale = 'es') DESC, recorded_at DESC) v;`, "={{ [ $json.locale ] }}"),
    code('node-format', 'Formatear Respuesta', `const row = $input.first()?.json || {};
if (row.error) throw new Error('Error en base de datos: ' + (row.error?.message || String(row.error)));
return [{ json: { body: { videos: Array.isArray(row.videos) ? row.videos : [] } } }];`),
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
{ answer, confidence, links, useCaseId, useCaseIds, values, autoStart, videoUrl, videos, questionId, escalated }

videos: los videos publicados (help_videos, en el idioma del usuario si hay; si no, en
el que exista) de las guías propuestas, de las guías de la pantalla actual y de su
recorrido (tour.<pantalla>): [{ useCaseId, url, title, durationSeconds, locale }].`,
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
  (SELECT COALESCE(jsonb_object_agg(use_case_id, jsonb_build_object('url', url, 'title', title, 'duration', duration_seconds, 'locale', locale)), '{}'::jsonb)
     FROM (SELECT DISTINCT ON (use_case_id) use_case_id, url, title, duration_seconds, locale FROM public.help_videos
            WHERE status = 'ready'
            ORDER BY use_case_id, (locale = $1) DESC, (left(locale, 2) = left($1, 2)) DESC, recorded_at DESC) v) AS videos,
  (SELECT COALESCE(jsonb_agg(step_id), '[]'::jsonb)
     FROM public.help_onboarding_compute() WHERE NOT done) AS pending_steps,
  (SELECT catalog_version FROM public.help_catalog_syncs ORDER BY synced_at DESC LIMIT 1) AS catalog_version;`, "={{ [ $('Preparar Consulta').first().json.locale ] }}", { executeOnce: true }),
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

// Videos grabados: de las guías propuestas, de las de esta pantalla y de su recorrido
// (el chat ofrece "Ver video" debajo de cada guía que tenga uno).
const videosById = allowed.videos || {};
const screenUseCases = (allowed.use_cases || []).filter(u => Array.isArray(u.screens) && q.screen_id && u.screens.includes(q.screen_id)).map(u => u.id);
const videos = [...suggested, ...screenUseCases, q.screen_id ? 'tour.' + q.screen_id : '']
  .filter((id, i, all) => id && all.indexOf(id) === i && videosById[id] && videosById[id].url)
  .slice(0, 12)
  .map(id => ({ useCaseId: id, url: videosById[id].url, title: videosById[id].title || id, durationSeconds: videosById[id].duration ?? null, locale: videosById[id].locale || null }));

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
    videoUrl: (useCaseId && videosById[useCaseId] && videosById[useCaseId].url) || null,
    videos,
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
if (!/^[a-zA-Z0-9_.-]{3,80}$/.test(useCaseId)) throw new Error('use_case_id inválido');
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
if (!/^[a-zA-Z0-9_.-]{3,80}$/.test(useCaseId)) throw new Error('use_case_id inválido');
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

// ─── POST voice/interpret ────────────────────────────────────────────────────
//
// Un solo endpoint para los comandos de voz de todos los módulos. Cada módulo (VOICE_DOMAINS) pone
// su prompt de sistema, la parte del prompt que arma con su contexto (prepare) y la validación de
// lo que devuelve el modelo contra ese mismo contexto (validate). El frontend vuelve a validar con
// su VoiceDomain.ai.sanitize. Módulo nuevo = una entrada acá + su VoiceDomain en el frontend.

const LAB_ORDERS_VOICE_PROMPT = `Interpretás comandos de voz del equipo de una clínica odontológica dentro de Invoke IA.
Recibís una frase dictada (puede venir con errores del reconocimiento de voz) y devolvés SOLO un objeto JSON, sin texto alrededor ni bloques de código.

INTENTS
- "lab_order.move": mover una orden de laboratorio existente (se nombra su número) a otra etapa. Ej.: "la 45 ya la mandamos ayer", "la orden cuarenta y cinco volvió del laboratorio".
- "lab_order.open": abrir / mostrar una orden existente por su número.
- "lab_order.create": crear una orden de laboratorio nueva para un paciente.
- "lab_order.update": cambiar algo de una orden existente (con número): la fecha de entrega (due_date), marcarla o desmarcarla urgente (urgent_change) o agregarle una nota (note_add). Ej.: "la 45 la entregan el lunes", "la 45 ya no es urgente", "anotale a la 45 color A2".
- "lab_order.status": preguntar cómo está una orden existente (con número): etapa, entrega. Ej.: "¿en qué anda la 45?".
- "lab_order.list": ver un grupo de órdenes en la pantalla. Ej.: "mostrame las atrasadas", "¿cuántas urgentes hay?", "las de Ana Pérez", "las de Dental Sur", "en el tablero", "sacá los filtros".
- "lab_order.edit": editar una orden existente (con número) en otra cosa que la entrega, lo urgente o una nota: sus trabajos, piezas, cantidad, descripción, laboratorio o paciente, o pedir abrirla para editarla. Lo que se pide cambiar va en draft_edit (regla 9; vacío si solo se pidió editarla). Ej.: "editá la 45", "a la 45 agregale un perno en la 21", "a la 45 sacale la corona", "la 45 es para María López", "la 45 va al laboratorio Dental Sur".
- "lab_order.draft_edit": SOLO cuando viene ORDEN EN CREACIÓN u ORDEN EN EDICIÓN: la frase corrige esa orden. Ej.: "que sea urgente", "agregá un perno en la 21", "sacá la corona", "la corona es en la 46", "que sean dos", "es para María López", "al laboratorio Dental Sur", "no la envíes", "entrega el viernes".
- "unknown": cualquier otra cosa, o si no estás seguro.

Si viene ORDEN EN CREACIÓN u ORDEN EN EDICIÓN, el intent es "lab_order.draft_edit" o "unknown" (nunca otro).

REGLAS
1. Usá SOLO ids de ETAPAS y LABORATORIOS que estén en las listas. Si no coincide con ninguno, null. Nunca inventes ids.
2. Fechas en formato YYYY-MM-DD calculadas desde FECHA DE HOY ("ayer", "el lunes" pasado, "el viernes" próximo, "en una semana").
   - effective_date: cuándo PASÓ el movimiento ("se envió ayer"). Nunca futura. null si no se dijo.
   - due_date: la entrega prometida por el laboratorio ("entrega el viernes"). null si no se dijo.
3. move_kind: "send" (se envió/mandó al laboratorio), "received" (llegó/volvió a la clínica), "complete" (se terminó/entregó/colocó al paciente), "cancel" (se canceló/anuló), "next" (siguiente etapa) o null. Si se nombra una etapa, poné su id en stage_id.
4. Para crear: patient = el nombre del paciente tal como se dijo (sin inventar apellidos); items = cada trabajo con service (nombre del trabajo como se dijo, ej. "corona de zirconio"), quantity (1 si no se dijo) y teeth (piezas en notación FDI: 11–48, 51–85; "la treinta y seis" = 36). teeth (afuera de items) = piezas generales si no se asocian a un trabajo. send = true solo si se pidió enviarla ya al laboratorio. is_urgent = true solo si se dijo urgente. notes = indicaciones extra (color, observaciones) o null.
5. order_id = el número de orden dicho (los números pueden venir en palabras). Para crear, null.
6. lab_order.update: urgent_change = true (marcar urgente), false (quitar urgente) o null; note_add = el texto de la nota tal como se dictó o null; due_date si cambia la entrega. Lo que no se pidió, en null.
7. lab_order.list: filter = {"overdue":bool,"urgent":bool,"due_today":bool,"view":"list"|"board"|null,"clear":bool,"count":bool}. count = true si se preguntó cuántas. Si se nombra un paciente va en patient; un laboratorio, su id en laboratory_id. En los demás intents filter = null.
8. confidence entre 0 y 1: qué tan seguro estás del intent y los datos. Si la frase es ambigua, confidence < 0.5.
9. lab_order.draft_edit y lab_order.edit: draft_edit = {"patient":null,"add_items":[],"remove_items":[],"update_items":[],"work_description":null,"laboratory_id":null,"clear_laboratory":false,"send":null,"due_date":null,"urgent":null,"note_add":null} con SOLO lo que se pidió cambiar:
   - patient: otro paciente (nombre tal como se dijo).
   - add_items: trabajos nuevos [{service, quantity, teeth}] como en la regla 4.
   - remove_items: nombres de los trabajos a quitar, tal como figuran en la orden.
   - update_items: [{service, quantity, teeth}] para cambiar cantidad o piezas de un trabajo que ya está (service = su nombre en la orden; null si hay uno solo o si son las piezas generales). Lo que no cambia, null.
   - work_description: nueva descripción libre del trabajo (reemplaza la anterior).
   - laboratory_id: id del laboratorio nombrado; clear_laboratory = true si se pidió sacarlo.
   - send: true (enviarla al crearla), false (no enviarla) o null. due_date: nueva entrega (en la creación implica enviarla).
   - En una ORDEN EN EDICIÓN (o con lab_order.edit) la orden ya existe: send siempre null; due_date solo cambia la entrega.
   - urgent: true / false / null. note_add: texto a agregar a las notas.
   En los demás intents draft_edit = null.

FORMATO (todas las claves siempre):
{"intent":"...","order_id":null,"stage_id":null,"move_kind":null,"effective_date":null,"due_date":null,"laboratory_id":null,"patient":null,"items":[],"work_description":null,"teeth":[],"is_urgent":false,"send":false,"notes":null,"urgent_change":null,"note_add":null,"filter":null,"draft_edit":null,"confidence":0.0}`;

const PERIO_VOICE_PROMPT = `Interpretás lo que dicta un profesional mientras sondea un periodontograma en Invoke IA.
Recibís una frase (puede venir con errores del reconocimiento de voz, en español o inglés) y el estado de la sonda, y devolvés SOLO un objeto JSON, sin texto alrededor ni bloques de código.

Traducís la frase a COMANDOS, en el orden en que se dijeron. Solo reformulás: nunca agregues valores, piezas ni marcas que no estén en la frase. Si no hay nada que se pueda expresar, commands = [].

COMANDOS
- {"kind":"values","values":[3,2,4]}: valores en la línea activa, un sitio tras otro (la sonda avanza sola). Enteros de -10 a 15, tal como se dijeron ("menos 2" = -2). Los tres sitios de una cara van distal, centro, mesial.
- {"kind":"goto","tooth":38,"side":"i","sites":[0],"line":"ps"}: ir a una pieza, cara, sitios y/o línea; todas las claves son opcionales pero al menos una. side: "v" (vestibular/bucal) o "i" (lingual/palatino). sites: 0 distal, 1 centro, 2 mesial. line: "ps" (profundidad), "mg" (margen gingival / recesión), "bop" (sangrado, SS), "sup" (supuración), "plaque" (placa).
- {"kind":"flag","flag":"bop","on":true,"tooth":16,"side":"v","sites":[2]}: marcar (on true) o quitar (on false) sangrado ("bop"), supuración ("sup") o placa ("plaque"). Sin pieza va al último sitio medido; sin sitios, a ese sitio o a los tres de la pieza dicha.
- {"kind":"neighbour","delta":1}: pieza siguiente (1) o anterior (-1).
- {"kind":"pass","pass":"mg"}: cambiar de pasada: "ps" profundidad, "mg" margen gingival, "fm" furcas y movilidad.
- {"kind":"focus","focus":"L"}: qué arcada mostrar: "U" superior, "L" inferior, "both" ambas, "auto" seguir a la sonda.
- {"kind":"mobility","tooth":46,"value":1}: movilidad 0 a 3 (pieza opcional: sin ella, la actual).
- {"kind":"furcation","tooth":36,"entry":"v","grade":2}: furca 0 a 3; entry "v" vestibular, "l" lingual, "mp" mesiopalatina, "dp" distopalatina (opcionales).
- {"kind":"answer","on":true}: "sí" / "no" en una línea de marcas (marca o deja limpio el sitio y avanza).
- {"kind":"same"}: "igual que antes" (el valor del examen anterior).
- {"kind":"undo"}, {"kind":"redo"}, {"kind":"delete"}: deshacer, rehacer, borrar el último valor.
- {"kind":"status","tooth":18,"status":"missing"}: estado de una pieza: "present", "missing" (ausente, extraída), "implant" o "pontic". La pantalla pregunta antes de cambiarlo.
- {"kind":"copy","what":"all"}: llenar lo vacío con el examen anterior: "all", "ps" (profundidad), "mg" (margen), "fm" (furcas y movilidad). La pantalla pregunta antes.
- {"kind":"query","what":"previous","tooth":16}: una pregunta, no escribe nada: "previous" (qué tenía en el examen anterior), "current" (qué tiene ahora, "leeme el 16"), "missing" (qué falta sondar). tooth opcional (sin ella, la pieza de la sonda).
Confirmar, descartar o parar el dictado NO son comandos que puedas devolver.

REGLAS
1. Piezas en notación FDI de dos dígitos (11 a 48). Si se nombra la pieza por su nombre ("primer molar inferior izquierdo"), convertila (36), pero bajá confidence a 0.7 o menos.
2. Usá el ESTADO DE LA SONDA: "el de al lado" = neighbour; "por palatino" / "del otro lado" = goto con side; "ahora el margen" = pass mg. No muevas la sonda si la frase no lo pide.
3. Valores en la línea activa salvo que la frase nombre otra pieza, cara o línea (entonces primero un goto).
4. Recesión: si "RECESIÓN NEGATIVA" es sí, la clínica dice la recesión como "menos N"; copiá los valores tal como se dijeron, el sistema los convierte.
5. confidence entre 0 y 1: qué tan seguro estás de los comandos. Si la frase es ambigua o no es un dictado del periodontograma, confidence < 0.5 y commands = [].

EJEMPLOS
"en el treinta y ocho por lingual tengo tres, dos y cuatro y le sangra el distal" → {"commands":[{"kind":"goto","tooth":38,"side":"i"},{"kind":"values","values":[3,2,4]},{"kind":"flag","flag":"bop","on":true,"sites":[0]}],"confidence":0.95}
"the lower left first molar buccal is four three five" → {"commands":[{"kind":"goto","tooth":36,"side":"v"},{"kind":"values","values":[4,3,5]}],"confidence":0.7}
"bueno, ahora pasemos al margen" → {"commands":[{"kind":"pass","pass":"mg"}],"confidence":0.9}
"esperá que atiendo el teléfono" → {"commands":[],"confidence":0.1}

FORMATO: {"commands":[...],"confidence":0.0}`;

const CALENDAR_VOICE_PROMPT = `Interpretás lo que dice el equipo de una clínica (recepción, doctores) sobre el CALENDARIO DE CITAS de Invoke IA. Es un asistente de voz: la frase viene del reconocimiento de voz (con errores, sin puntuación), en español o en inglés, y puede usar sinónimos o adjetivos ("más grande", "achicá", "que no se esconda", "poné lindo el título").
Devolvés SOLO un objeto JSON (sin texto alrededor ni bloques de código) con un PLAN: la relación con lo que se venía haciendo y los PASOS a ejecutar en orden. Vos no ejecutás nada.

RELACIÓN (relation) con la CONVERSACIÓN (tarea en curso y pregunta abierta, si las hay):
- "new": un pedido nuevo (o no hay tarea en curso).
- "answer": contesta la pregunta abierta. Poné en "answer" la respuesta corta y clara ("sí", "no", "2", el nombre elegido, la hora "10:30"). Sin steps.
- "aux": una herramienta en el medio de la tarea (moverse de día, cambiar vista, zoom, filtrar, ver huecos, buscar citas, ver una agenda) para después seguir con la pregunta abierta.
- "cancel": quiere cancelar lo que se está haciendo ("dejalo", "olvidate", "no, nada").
- "resume": quiere seguir con lo que estaba ("sigamos", "¿en qué estábamos?").
- "ignore": la frase NO es para el asistente (está hablando con un paciente o un compañero: "pasá, sentate", "¿cómo está tu mamá?"). Solo si "conversational" es true; si dudás entre ignore y un pedido, es el pedido.

PASOS (steps): lista de 1 a 6 objetos, cada uno con "intent" y sus campos. Si para cumplir el pedido hace falta primero ubicar una cita, el primer paso la ubica (calendar.select o el mismo paso con patient) y los siguientes NO repiten el paciente (actúan sobre la cita en foco).

INTENTS — mirar y moverse
- "calendar.today": volver a hoy.
- "calendar.navigate": ir a un día → date; o avanzar/retroceder lo que muestra la pantalla según la vista ("siguiente", "para atrás", "adelante") → step 1 / -1.
- "calendar.view": cambiar la vista → view: "day", "2-day" … "6-day", "week", "month", "schedule" (lista/agenda), "year". Si además se nombra un día, date.
- "calendar.options": quiere ver las opciones para elegir ("¿cómo puedo ver?", "cambiá la vista" sin decir cuál, "¿qué agendas hay?", "cambiá de agenda") → options_of: "views" | "calendars" | "doctors" | "sedes".
- "calendar.filter": mostrar u ocultar doctores, agendas (consultorios, sillones, boxes) o sedes. filter_op "only" | "add" | "remove" | "all"; ids en doctor_ids, calendar_ids o sede_ids; filter_target.
- "calendar.group": agrupar las columnas (ahora) → group_by "doctor" | "calendar" | "none".
- "calendar.zoom": zoom de la grilla → zoom_op "in" (más zoom, acercar, agrandar, más grande) | "out" (menos, alejar, achicar, más chico) | "max" | "min" | "reset" (normal, 100) | "set" (zoom_level 30–250). amount = cuántos pasos de 10 % (1 por defecto; "mucho" = 3).
- "calendar.panel": panel de agendas de la izquierda → panel_op "open" | "close" | "pin" (dejarlo fijo, que no se esconda) | "unpin" (que se esconda solo, soltarlo).
- "calendar.search": buscar citas por texto → query. "calendar.close_search": cerrar la búsqueda.
- "calendar.gaps": huecos / horarios libres / disponibilidad → date y period ("morning" | "afternoon" | null). "calendar.hide_gaps": ocultarlos.
- "calendar.agenda": qué citas hay un día → date (doctor_id si se nombra). "calendar.next": quién sigue hoy. "calendar.patient_next": cuándo viene un paciente → patient.
- "calendar.refresh": actualizar / recargar.
- "calendar.export": exportar / descargar / imprimir la agenda a Excel → export_range "day" | "week" | "month" | "custom"; date (día de referencia, o desde con custom), end_date (hasta con custom); calendar_ids y/o sede_ids si se nombraron; filter_op "all" si dijo todas las agendas.

INTENTS — configuración de la agenda (engranaje; preferencias del usuario que se guardan)
- "calendar.settings_open": abrir o cerrar la configuración → panel_op "open" | "close".
- "calendar.settings": UN cambio por paso (varios cambios = varios pasos) → setting y setting_value:
  "mode": "invoke" | "custom" (vista personalizada). "default_view": "day" | "2_days" | "3_days" | "week" | "month" | "agenda" (vista predeterminada, con la que arranca). "grouped_by": "none" | "doctor" | "calendar" (agrupar por defecto).
  "hour_height": número 60–200 (px) o "up" | "down" | "max" | "min" (altura de la hora). "slot_duration": 5 | 10 | 15 | 20 | 30 | 60 (minutos del slot).
  "default_sede": id de SEDES o "all" (todas). "event_label_format": "time_patient_notes" | "patient_treatment_time" | "time_patient_notes_treatment" | "time_treatment_patient_notes" (título de la cita).
  "hidden_weekdays": weekdays [0=domingo … 6=sábado] y weekday_op "hide" | "show" | "set" (fin de semana = [6,0]; "mostrá todos los días" = set []).
  "visible_hours": setting_value "full" | "clinic" | "custom"; con custom, time (inicio) y end_time (fin).
  Interruptores (setting_value true/false): "color_by_status", "check_availability", "block_unavailable" (bloquear fuera de horario), "filter_doctors_by_service", "inline_appointment_creation" (crear citas en el calendario sin modal), "inline_draft_live_preview".

INTENTS — la cita (LA CITA se dice con patient y/o from_time, from_date; si no se nombra y has_focus es true, es la que está en foco)
- "calendar.select": ir a / seleccionar una cita ("la cita de Ana", "mostrame la de las 10").
- "calendar.status": cambiar el estado → status: "scheduled" (agendada), "confirmed" (confirmó), "arrived" (llegó, en sala), "arrived_late" (llegó tarde), "in_progress" (en curso, pasó a consulta), "completed" (terminó, completada, se atendió), "attended_late" (atendida tarde), "no_show" (no vino, no asistió, faltó), "cancelled" (cancelar/anular), "pending". Con cancelar: cancellation_reason "in_time" (avisó con tiempo) | "late" (canceló tarde) | "no_notice" | "by_doctor" | "by_clinic" | null.
- "calendar.create": dar una cita nueva → patient, date, time, doctor_id, calendar_id, service_ids.
- "calendar.reschedule": mover a otro día u hora → la cita (patient/from_time/from_date) y el destino date y/o time.
- "calendar.edit": abrir el editor de la cita (opcional: doctor_id, service_ids, date, time nuevos).
- "calendar.color": color → "1" lavanda, "2" verde claro/salvia, "3" violeta/uva, "4" rosa/flamenco, "5" amarillo/banana, "6" naranja/mandarina, "7" celeste/turquesa, "8" gris/grafito, "9" azul/arándano, "10" verde/albahaca, "11" rojo/tomate, "none" sin color.
- "calendar.move_calendar": pasar a otra agenda/consultorio → calendar_id. "calendar.assign_doctor": cambiar el doctor → doctor_id. "calendar.duration": cuánto dura → minutes.
- "calendar.delete": borrar la cita (no es un estado).
- "calendar.open": abrir del paciente → target "history" | "documents" (imágenes y archivos) | "accounts" (estado de cuenta) | "appointments" (historial de citas) | "patient" (datos) | "session" (sesión clínica) | "bill" (cobrar).
- "calendar.patient_find": buscar un paciente → patient (nombre), o document / email / phone si los dijo.
- "calendar.patient_info": pedir INFORMACIÓN del paciente que sale de sus registros, sin elegir una cita (cuántas veces vino, canceló o faltó, la última falta o visita, si debe, el último pago, cuánto pagó, presupuestos, facturas, tratamientos en curso, o un resumen de todo) → info_topics: ["summary" | "visits" | "cancellations" | "no_shows" | "last_no_show" | "last_visit" | "debt" | "last_payment" | "payments" | "quotes" | "invoices" | "treatments"] y patient (si se nombró; si no, el de la cita en foco).
- "calendar.patient_action": hacer algo del paciente → patient_action: "quote" (nuevo presupuesto) | "invoice" (nueva factura) | "treatment" (nuevo tratamiento) | "session" (registrar sesión clínica) | "bill" (cobro rápido); patient si se nombró.
- "calendar.patient_ask": pregunta CLÍNICA o libre sobre el paciente que no está en los temas de patient_info (alergias, medicación, antecedentes, cómo evoluciona, qué le hicimos) → question (la pregunta tal como se dijo) y la cita si nombró a alguien.

INTENTS — formulario de la cita ABIERTO (FORMULARIO en el contexto)
- "calendar.form_set": cambiar campos → date, time (inicio), end_time (fin), doctor_id, calendar_id, service_ids (agregar), remove_service_ids (sacar), patient (cambiar el paciente), notes_op "append" | "replace" | "clear" con el texto de la nota en title.
- "calendar.form_save": guardar / actualizar / listo. "calendar.form_cancel": cancelar / cerrar sin guardar.

OTROS
- "calendar.dialog": contestar un aviso abierto de la pantalla → dialog_op "confirm" (continuar, aceptar) | "cancel".
- "calendar.close_panels": cerrar / esconder / sacar de la vista lo que está abierto (una ventana, un panel lateral como el estado de cuenta o la historia, la búsqueda, los huecos, la configuración, exportar, lotes): "cerrá eso", "que no se vea", "no lo quiero ver más", "get rid of that". filter_op "all" si dice todo.
- "calendar.block" / "calendar.enable": bloquear / habilitar una franja → date, time, end_time, sede_ids, title (motivo).
- "calendar.reminder": recordatorio o nota → reminder_type, date, time, title. "calendar.reminder_done" / "calendar.reminder_delete": date, time y/o title.
- "unknown": si no es nada de esto.

ADJETIVOS, SINÓNIMOS Y FORMAS INDIRECTAS (entendé la intención y llevala a lo que existe)
- Tamaño de lo que se ve: "más grande", "enorme", "no veo nada", "está todo apretado/chiquito", "agrandá la letra" → calendar.zoom in (mucho/enorme = amount 3; "lo más grande" = max). "achicá", "muy grande", "no entra" → zoom out. Si habla de LAS HORAS o LAS FILAS ("horas más altas", "más espacio entre horas") → calendar.settings hour_height up/down.
- "que no se esconda / que quede ahí / que no desaparezca" (el costado, la lista de agendas) → calendar.panel pin. "que se vaya / que no moleste" → panel close o unpin.
- "mostrame menos horas / solo cuando atendemos" → visible_hours "clinic" (o custom si dice horas). "todo el día" → "full".
- "más finito / más detallado / de a 10" (los slots) → slot_duration. "que arranque en…" → default_view.
- Estados dichos de otra forma: "ya está en la sala / sentado afuera" = arrived; "lo hicimos pasar / está en el sillón" = in_progress; "ya se fue / terminamos" = completed; "nos dejó plantados / no apareció" = no_show; "avisó que no viene" = cancelled.
- Plata: "cómo viene de plata / está al día / tiene algo pendiente / cuánto nos debe" → patient_info debt (o last_payment / payments según lo que pregunte). "cuántas veces vino / es un paciente frecuente" → visits; "falta mucho / es de faltar" → no_shows; "cómo va su tratamiento" → treatments; "contame de / qué sabemos de" → summary.
- Colores por cómo se dicen: "rojito", "colorado" = 11; "verdecito" = 10; "celeste" = 7; "violeta/morado/lila" = 3; "naranja" = 6; "gris" = 8; "rosado" = 4; "amarillo" = 5; "azul" = 9.
- AMBIGÜEDAD: si la frase puede ser dos cosas muy distintas y las dos son igual de probables (p. ej. "más grande" sin decir si es el zoom o la altura de las horas cuando la pantalla no ayuda), devolvé la más probable con confidence 0.55–0.7: la pantalla pregunta. Si una es claramente más probable, devolvé esa con confidence ≥ 0.8 (no hace falta preguntar).

REGLAS
1. Usá SOLO ids de DOCTORES, AGENDAS, SEDES y TRATAMIENTOS de las listas. Si no coincide, null o []. Nunca inventes ids.
2. Fechas YYYY-MM-DD desde FECHA DE HOY ("mañana", "el lunes" = el próximo, "el 14" = el más cercano). Para dar o mover una cita nunca una fecha pasada. Horas HH:mm en 24 h; sin "de la mañana/tarde", de 1 a 6 es de la tarde.
3. patient: el nombre tal como se dijo, sin inventar. Nunca devuelvas datos del paciente que no estén en la frase.
4. Si hay dos interpretaciones muy parecidas y las dos muy probables, confidence entre 0.5 y 0.7 (la pantalla pregunta). Si la frase no se entiende, confidence < 0.5.
5. Varios pedidos en una frase = varios pasos en el orden dicho.
6. Ir a OTRA sección de la app (pacientes, caja, reportes, ventas, configuración del negocio, el inicio…): no es del calendario. Devolvé confidence 0 y steps []; lo resuelve la navegación general.

FORMATO: {"relation":"new","answer":null,"confidence":0.0,"steps":[{"intent":"...", ...solo los campos que usa}]}
Ejemplo: "editá la cita de Ana del jueves y ponele el doctor Pérez" → {"relation":"new","answer":null,"confidence":0.9,"steps":[{"intent":"calendar.edit","patient":"Ana","from_date":"2026-11-26","doctor_id":"<id de Pérez>"}]}
Ejemplo: "la cita de Juan, marcala como llegó y abrí su cuenta" → steps: [{"intent":"calendar.select","patient":"Juan"},{"intent":"calendar.status","status":"arrived"},{"intent":"calendar.open","target":"accounts"}]`;

const CORE_VOICE_PROMPT = `Interpretás pedidos de voz del equipo de una clínica dentro de Invoke IA para MOVERSE por la app (el menú principal), desde cualquier pantalla. La frase viene del reconocimiento de voz (con errores, sin puntuación), en español o en inglés, y puede ser indirecta ("llevame donde veo quién nos debe plata", "quiero cobrarle a alguien", "where do I see today's income").

Devolvé SOLO JSON con:
- relation: "new" (un pedido), "ignore" (no es para el asistente: charla de la sala), "cancel" (cancelar lo que se hacía), "resume" (seguir con lo de antes).
- intent: "navigate" (ir a una sección) o "unknown".
- target_key: la clave de DESTINOS (solo una de la lista; nunca inventes). La pantalla mira el permiso.
- rest: lo que se pide hacer DESPUÉS de llegar, tal como se dijo ("andá a pacientes y buscá a Juan" → "buscá a Juan"), o null.
- confidence: 0–1.

REGLAS
1. Elegí el destino por lo que se quiere ver o hacer: deudas de pacientes → ReportDeudores; lo cobrado hoy → ReportCobrosDia; el dinero de la caja → Cashier; turnos/agenda → Appointments; lo del laboratorio → LabOrders; radiografías → Studies; configurar sedes/horarios/doctores → el destino de esa configuración.
2. Si la frase pide algo de la pantalla actual (no ir a otro lado) → intent "unknown", confidence < 0.5.
3. Si dos destinos son igual de probables, el más probable con confidence 0.55–0.7 (la pantalla pregunta). Si uno es claramente el pedido, confidence ≥ 0.8.

FORMATO: {"relation":"new","intent":"navigate","target_key":"ReportDeudores","rest":null,"confidence":0.9}`;

const SCREEN_VOICE_PROMPT = `Interpretás un pedido de voz del equipo de una clínica sobre la PANTALLA ABIERTA de Invoke IA (lo que está arriba: una ventana, un panel o la página). La frase viene del reconocimiento de voz (con errores, sin puntuación), en español o en inglés, y puede ser indirecta ("dejame esto guardado", "que no se mande el recordatorio", "poné que es particular"). El intérprete local no la entendió.

Recibís CONTROLES: lo que se puede tocar, con su tipo y su nombre tal cual (button, tab, toggle con on true/false, field, search, select).

Devolvé SOLO JSON con:
- relation: "new" (un pedido), "ignore" (no es para el asistente: charla de la sala), "cancel" (cancelar lo que se hacía), "resume" (seguir con lo de antes).
- intent: "steps" (se hace con los controles), "suggest" (no está claro cuál: proponé lo más parecido) o "unknown".
- steps: lista ordenada (máximo 6) de { op, target, value, on }:
  · op "press" (button), "tab" (tab), "toggle" (toggle; on = true para activar, false para desactivar), "fill" (field; value = el valor tal como se dijo), "select" (select; value = la opción dicha), "search" (search o field de búsqueda; value = SOLO la palabra clave: un nombre, un número, un código, nunca la frase entera).
  · target: el NOMBRE EXACTO de uno de CONTROLES. Nunca inventes uno.
- suggestions (solo con intent "suggest"): hasta 3 { label, op, target, value, on }; label es lo que se le muestra a la persona, corto y en su idioma ("apretar «Guardar»", "desactivar «Enviar recordatorio»").
- confidence: 0–1.

REGLAS
1. Lo que se pide es para lo que está a la vista; si pide ir a otra sección del menú → intent "unknown" (otro módulo lo resuelve).
2. Varias cosas en una frase → varios steps en el orden dicho ("poné el nombre Sede Pocitos y guardá" → fill Nombre, press Guardar).
3. Sinónimos: guardar = grabar = confirmar = aceptar = listo si no hay otro; eliminar = borrar = quitar; activar = prender = habilitar = marcar; desactivar = apagar = deshabilitar = desmarcar; agregar = añadir = sumar = crear = nuevo.
4. Si dos controles son igual de probables → intent "suggest" con esas opciones (confidence ≥ 0.6). Si es claro → "steps" con confidence ≥ 0.8.
5. Nunca pongas datos que no se dijeron. Fechas, horas y montos van en value tal como se dijeron.

FORMATO: {"relation":"new","intent":"steps","steps":[{"op":"fill","target":"Nombre","value":"Sede Pocitos"},{"op":"press","target":"Guardar"}],"suggestions":[],"confidence":0.9}`;

/**
 * Código JS de cada módulo, que se pega en los nodos Code:
 * - prepare(ctx, body): { lines, meta }: líneas del prompt con el contexto (listas cerradas) y lo
 *   que validate necesita después (meta).
 * - validate(p, meta, today): el `result` validado, siempre con `confidence` (0–1).
 */
const VOICE_DOMAINS = {
  core: {
    system: CORE_VOICE_PROMPT,
    prepare: `(ctx, body) => {
  // Solo los destinos a los que el usuario puede entrar (los manda el frontend).
  const targets = (Array.isArray(ctx.targets) ? ctx.targets : []).slice(0, 150)
    .map(t => ({ key: String((t && t.key) || '').slice(0, 60), label: String((t && t.label) || '').slice(0, 80), section: String((t && t.section) || '').slice(0, 60) }))
    .filter(t => /^[A-Za-z0-9]+$/.test(t.key) && t.label);
  const c = ctx.conversation && typeof ctx.conversation === 'object' ? ctx.conversation : null;
  return {
    lines: [
      '',
      'DESTINOS (clave · nombre · sección):',
      targets.map(t => '- ' + t.key + ' · ' + t.label + (t.section ? ' · ' + t.section : '')).join('\\n') || '(ninguno)',
      ...(c && c.task ? ['', 'TAREA EN CURSO: ' + String(c.task).slice(0, 200)] : []),
    ],
    meta: { keys: targets.map(t => t.key) },
  };
}`,
    validate: `(p, m) => {
  const keys = new Set(m.keys);
  const RELATIONS = ['new', 'ignore', 'cancel', 'resume'];
  const confidence = Number(p.confidence);
  const key = typeof p.target_key === 'string' && keys.has(p.target_key) ? p.target_key : null;
  const rest = typeof p.rest === 'string' && p.rest.trim() ? p.rest.trim().slice(0, 300) : null;
  const intent = p.intent === 'navigate' && key ? 'navigate' : 'unknown';
  return {
    relation: RELATIONS.includes(p.relation) ? p.relation : 'new',
    intent,
    target_key: intent === 'navigate' ? key : null,
    rest: intent === 'navigate' ? rest : null,
    confidence: intent === 'unknown' && !['ignore', 'cancel', 'resume'].includes(p.relation) ? Math.min(0.3, Number.isFinite(confidence) ? confidence : 0) : (Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0),
  };
}`,
  },
  lab_orders: {
    system: LAB_ORDERS_VOICE_PROMPT,
    prepare: `(ctx, body) => {
  const stages = (Array.isArray(ctx.stages) ? ctx.stages : []).slice(0, 40)
    .map(s => ({ id: Number(s && s.id), name: String((s && s.name) || '').slice(0, 80), kind: String((s && s.kind) || '') }))
    .filter(s => Number.isInteger(s.id) && s.name);
  const laboratories = (Array.isArray(ctx.laboratories) ? ctx.laboratories : []).slice(0, 80)
    .map(l => ({ id: String((l && l.id) || ''), name: String((l && l.name) || '').slice(0, 80) }))
    .filter(l => l.id && l.name);
  // Orden abierta por voz, nueva o en edición (sin el paciente): la frase es una corrección.
  const d = ctx.draft && typeof ctx.draft === 'object' ? ctx.draft : null;
  const editing = Boolean(d && d.mode === 'edit');
  const short = (v, max) => String(v == null ? '' : v).slice(0, max);
  const draftLines = d ? [
    '',
    editing
      ? 'ORDEN EN EDICIÓN n.º ' + (Number(d.order_id) || '?') + ', etapa ' + (short(d.stage, 80) || '?') + ' (ya existe; la frase la corrige):'
      : 'ORDEN EN CREACIÓN (la frase la corrige):',
    '- Trabajos: ' + ((Array.isArray(d.items) ? d.items : []).slice(0, 10)
      .map(i => short(i && i.service, 80) + ' x' + (Number(i && i.quantity) || 1) + (Array.isArray(i && i.teeth) && i.teeth.length ? ' (piezas ' + i.teeth.slice(0, 32).join(', ') + ')' : ''))
      .join('; ') || '(ninguno)'),
    '- Piezas generales: ' + ((Array.isArray(d.teeth) ? d.teeth.slice(0, 32).join(', ') : '') || '(ninguna)'),
    '- Descripción: ' + (short(d.work_description, 300) || '(ninguna)'),
    '- Laboratorio: ' + (short(d.laboratory, 80) || '(ninguno)'),
    editing
      ? '- Entrega: ' + (short(d.due_date, 10) || '(sin fecha)')
      : '- Enviar al crear: ' + (d.send === true ? 'sí, entrega ' + short(d.due_date, 10) : 'no'),
    '- Urgente: ' + (d.is_urgent === true ? 'sí' : 'no'),
    '- Notas: ' + (short(d.notes, 300) || '(ninguna)'),
  ] : [];
  return {
    lines: [
      '',
      'ETAPAS (id · nombre · tipo):',
      stages.map(s => '- ' + s.id + ' · ' + s.name + ' · ' + s.kind).join('\\n') || '(ninguna)',
      '',
      'LABORATORIOS (id · nombre):',
      laboratories.map(l => '- ' + l.id + ' · ' + l.name).join('\\n') || '(ninguno)',
      ...draftLines,
    ],
    meta: { stages, laboratories, hasDraft: Boolean(d), editing },
  };
}`,
    validate: `(p, m, today) => {
  // Lista cerrada: solo ids que mandó el frontend, fechas válidas y piezas FDI.
  const INTENTS = ['lab_order.move', 'lab_order.create', 'lab_order.open', 'lab_order.update', 'lab_order.status', 'lab_order.list', 'lab_order.draft_edit', 'lab_order.edit', 'unknown'];
  const KINDS = ['send', 'received', 'complete', 'cancel', 'next'];
  const stageIds = new Set(m.stages.map(s => s.id));
  const labIds = new Set(m.laboratories.map(l => l.id));
  const isDate = v => typeof v === 'string' && /^\\d{4}-\\d{2}-\\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
  const str = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
  const isTooth = n => Number.isInteger(n) && ((n >= 11 && n <= 48 && n % 10 >= 1 && n % 10 <= 8) || (n >= 51 && n <= 85 && n % 10 >= 1 && n % 10 <= 5));
  const teeth = v => [...new Set((Array.isArray(v) ? v : []).map(Number).filter(isTooth))].slice(0, 32);

  const intent = INTENTS.includes(p.intent) ? p.intent : 'unknown';
  const orderId = Number(p.order_id);
  const stageId = Number(p.stage_id);
  const effective = isDate(p.effective_date) && p.effective_date <= today ? p.effective_date : null;
  const toItems = v => (Array.isArray(v) ? v : []).slice(0, 10)
    .map(i => ({ service: str(i && i.service, 80), quantity: Math.min(99, Math.max(1, Math.round(Number(i && i.quantity)) || 1)), teeth: teeth(i && i.teeth) }))
    .filter(i => i.service);
  const items = toItems(p.items);
  const confidence = Number(p.confidence);
  const bool = v => (typeof v === 'boolean' ? v : null);
  const de = p.draft_edit && typeof p.draft_edit === 'object' ? p.draft_edit : null;
  const draftEdit = de ? {
    patient: str(de.patient, 80),
    add_items: toItems(de.add_items),
    remove_items: (Array.isArray(de.remove_items) ? de.remove_items : []).map(v => str(v, 80)).filter(Boolean).slice(0, 10),
    update_items: (Array.isArray(de.update_items) ? de.update_items : []).slice(0, 10).map(i => {
      const qty = Math.round(Number(i && i.quantity));
      return {
        service: str(i && i.service, 80),
        quantity: i && i.quantity != null && Number.isFinite(qty) ? Math.min(99, Math.max(1, qty)) : null,
        teeth: i && Array.isArray(i.teeth) ? teeth(i.teeth) : null,
      };
    }).filter(i => i.quantity !== null || i.teeth !== null),
    work_description: str(de.work_description, 500),
    laboratory_id: typeof de.laboratory_id === 'string' && labIds.has(de.laboratory_id) ? de.laboratory_id : null,
    clear_laboratory: de.clear_laboratory === true,
    // Una orden que ya existe no se envía desde acá (se mueve de etapa).
    send: m.editing || intent === 'lab_order.edit' ? null : bool(de.send),
    due_date: isDate(de.due_date) && de.due_date >= today ? de.due_date : null,
    urgent: bool(de.urgent),
    note_add: str(de.note_add, 500),
  } : null;

  const result = {
    intent,
    order_id: Number.isInteger(orderId) && orderId > 0 ? orderId : null,
    stage_id: stageIds.has(stageId) ? stageId : null,
    move_kind: KINDS.includes(p.move_kind) ? p.move_kind : null,
    effective_date: effective,
    due_date: isDate(p.due_date) ? p.due_date : null,
    laboratory_id: typeof p.laboratory_id === 'string' && labIds.has(p.laboratory_id) ? p.laboratory_id : null,
    patient: str(p.patient, 80),
    items,
    work_description: str(p.work_description, 500),
    teeth: teeth(p.teeth),
    is_urgent: p.is_urgent === true,
    send: p.send === true,
    notes: str(p.notes, 500),
    urgent_change: typeof p.urgent_change === 'boolean' ? p.urgent_change : null,
    note_add: str(p.note_add, 500),
    filter: p.filter && typeof p.filter === 'object' ? {
      overdue: p.filter.overdue === true,
      urgent: p.filter.urgent === true,
      due_today: p.filter.due_today === true,
      view: p.filter.view === 'list' || p.filter.view === 'board' ? p.filter.view : null,
      clear: p.filter.clear === true,
      count: p.filter.count === true,
    } : null,
    draft_edit: intent === 'lab_order.draft_edit' || intent === 'lab_order.edit' ? draftEdit : null,
    confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0,
  };
  // Lo que actúa sobre una orden existente necesita su número.
  if (['lab_order.move', 'lab_order.open', 'lab_order.update', 'lab_order.status', 'lab_order.edit'].includes(intent) && !result.order_id) result.intent = 'unknown';
  // Con una orden en creación solo vale corregirla; sin ella, draft_edit no tiene sentido.
  if (m.hasDraft ? !['lab_order.draft_edit', 'unknown'].includes(result.intent) : result.intent === 'lab_order.draft_edit') result.intent = 'unknown';
  if (result.intent === 'lab_order.draft_edit' && !result.draft_edit) result.intent = 'unknown';
  return result;
}`,
  },
  calendar: {
    system: CALENDAR_VOICE_PROMPT,
    prepare: `(ctx) => {
  const rows = (v, max) => (Array.isArray(v) ? v : []).slice(0, max);
  const doctors = rows(ctx.doctors, 80).map(d => ({ id: String((d && d.id) || ''), name: String((d && d.name) || '').slice(0, 80) })).filter(d => d.id && d.name);
  const calendars = rows(ctx.calendars, 80).map(c => ({ id: String((c && c.id) || ''), name: String((c && c.name) || '').slice(0, 80), sede: String((c && c.sede) || '').slice(0, 80) })).filter(c => c.id && c.name);
  const sedes = rows(ctx.sedes, 40).map(s => ({ id: String((s && s.id) || ''), name: String((s && s.name) || '').slice(0, 80) })).filter(s => s.id && s.name);
  const services = rows(ctx.services, 150).map(s => ({ id: String((s && s.id) || ''), name: String((s && s.name) || '').slice(0, 80) })).filter(s => s.id && s.name);
  const day = v => (/^\\d{4}-\\d{2}-\\d{2}$/.test(String(v)) ? String(v) : '?');
  const clip = (v, n) => String(v == null ? '' : v).slice(0, n);
  const conv = ctx.conversation && typeof ctx.conversation === 'object' ? ctx.conversation : null;
  const pending = conv && conv.pending && typeof conv.pending === 'object' ? conv.pending : null;
  const form = ctx.form && typeof ctx.form === 'object' ? ctx.form : null;
  const st = ctx.settings && typeof ctx.settings === 'object' ? ctx.settings : null;
  const panel = ctx.agendas_panel && typeof ctx.agendas_panel === 'object' ? ctx.agendas_panel : {};
  return {
    lines: [
      '',
      'PANTALLA: vista ' + clip(ctx.view || '?', 12) + ', del ' + day(ctx.visible_from) + ' al ' + day(ctx.visible_to) + (ctx.custom_mode === true ? ' (modo personalizado: una agenda por vez)' : ' (modo Invoke)'),
      'ZOOM: ' + clip(ctx.zoom, 4) + ' % · PANEL DE AGENDAS: ' + (panel.open === true ? 'abierto' : 'cerrado') + (panel.pinned === true ? ', fijo' : '') + (ctx.dialog_open === true ? ' · HAY UN AVISO ABIERTO' : '') + (ctx.export_open === true ? ' · EXPORTAR ABIERTO' : '') + (ctx.form_open === true ? ' · FORMULARIO DE CITA ABIERTO' : ''),
      'CITA EN FOCO (has_focus): ' + (ctx.has_focus === true ? 'sí' + (ctx.focus_when ? ' (' + clip(ctx.focus_when, 16) + ')' : '') : 'no'),
      st ? 'CONFIGURACIÓN: modo ' + clip(st.mode, 10) + ', vista predeterminada ' + clip(st.default_view, 10) + ', agrupar ' + clip(st.grouped_by, 10) + ', altura hora ' + clip(st.hour_height, 4) + ', slot ' + clip(st.slot_duration, 3) + ' min, sede ' + clip(st.default_sede, 20) + ', título ' + clip(st.event_label_format, 40) + ', días ocultos ' + JSON.stringify(Array.isArray(st.hidden_weekdays) ? st.hidden_weekdays.slice(0, 7) : []) + ', franja ' + clip(st.visible_hours_mode, 8) : 'CONFIGURACIÓN: (cargando)',
      form ? 'FORMULARIO: inicio ' + clip(form.start, 16) + ', fin ' + clip(form.end_time, 5) + ', doctor ' + clip(form.doctor_id, 20) + ', agenda ' + clip(form.calendar_id, 20) + ', tratamientos ' + JSON.stringify(rows(form.service_ids, 10).map(String)) + (form.has_notes === true ? ', con notas' : '') : '',
      'CONVERSACIÓN: ' + (conv ? 'tarea en curso ' + JSON.stringify(clip(conv.task, 160)) + (pending ? '; pregunta abierta ' + JSON.stringify(clip(pending.question, 200)) + ' (espera ' + clip(pending.awaiting, 10) + ')' + (Array.isArray(pending.choices) && pending.choices.length ? ', opciones: ' + pending.choices.slice(0, 8).map((c, i) => (i + 1) + ') ' + clip(c, 60)).join(' ') : '') : '') + '; conversational: ' + (conv.conversational === true) : 'ninguna'),
      '',
      'DOCTORES (id · nombre):',
      doctors.map(d => '- ' + d.id + ' · ' + d.name).join('\\n') || '(ninguno)',
      '',
      'AGENDAS (id · nombre · sede):',
      calendars.map(c => '- ' + c.id + ' · ' + c.name + (c.sede ? ' · ' + c.sede : '')).join('\\n') || '(ninguna)',
      '',
      'SEDES (id · nombre):',
      sedes.map(s => '- ' + s.id + ' · ' + s.name).join('\\n') || '(ninguna)',
      '',
      'TRATAMIENTOS (id · nombre):',
      services.map(s => '- ' + s.id + ' · ' + s.name).join('\\n') || '(ninguno)',
    ].filter(l => l !== null),
    meta: { doctors: doctors.map(d => d.id), calendars: calendars.map(c => c.id), sedes: sedes.map(s => s.id), services: services.map(s => s.id), has_focus: ctx.has_focus === true },
  };
}`,
    validate: `(p, m, today) => {
  // Lista cerrada: ids que mandó el frontend, fechas y horas reales, intents, estados y preferencias conocidos.
  const INTENTS = ['calendar.navigate', 'calendar.view', 'calendar.filter', 'calendar.group', 'calendar.search', 'calendar.agenda', 'calendar.next', 'calendar.patient_next', 'calendar.gaps', 'calendar.status', 'calendar.create', 'calendar.reschedule', 'calendar.edit',
    'calendar.color', 'calendar.move_calendar', 'calendar.assign_doctor', 'calendar.duration', 'calendar.delete', 'calendar.open', 'calendar.block', 'calendar.enable',
    'calendar.reminder', 'calendar.reminder_done', 'calendar.reminder_delete', 'calendar.print', 'calendar.refresh', 'calendar.today', 'calendar.zoom', 'calendar.panel',
    'calendar.options', 'calendar.close_search', 'calendar.hide_gaps', 'calendar.export', 'calendar.settings', 'calendar.settings_open', 'calendar.select',
    'calendar.form_set', 'calendar.form_save', 'calendar.form_cancel', 'calendar.dialog', 'calendar.patient_find', 'calendar.patient_ask', 'calendar.patient_info', 'calendar.patient_action', 'calendar.close_panels', 'unknown'];
  const INFO_TOPICS = ['summary', 'visits', 'cancellations', 'no_shows', 'last_no_show', 'last_visit', 'debt', 'last_payment', 'payments', 'quotes', 'invoices', 'treatments'];
  const RELATIONS = ['new', 'answer', 'aux', 'ignore', 'cancel', 'resume'];
  const COLORS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', 'none'];
  const TARGETS = ['history', 'documents', 'accounts', 'appointments', 'patient', 'session', 'bill'];
  const VIEWS = ['day', 'week', 'month', 'year', '2-day', '3-day', '4-day', '5-day', '6-day', 'schedule'];
  const STATUSES = ['scheduled', 'confirmed', 'arrived', 'arrived_late', 'in_progress', 'completed', 'attended_late', 'no_show', 'cancelled', 'pending'];
  const REASONS = ['in_time', 'late', 'no_notice', 'by_doctor', 'by_clinic'];
  const SETTINGS = ['mode', 'default_view', 'grouped_by', 'hour_height', 'slot_duration', 'default_sede', 'event_label_format', 'hidden_weekdays', 'visible_hours',
    'color_by_status', 'check_availability', 'block_unavailable', 'filter_doctors_by_service', 'inline_appointment_creation', 'inline_draft_live_preview'];
  const isDate = v => typeof v === 'string' && /^\\d{4}-\\d{2}-\\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
  const isTime = v => typeof v === 'string' && /^([01]\\d|2[0-3]):[0-5]\\d$/.test(v);
  const str = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
  const oneOf = (list, v) => (list.includes(v) ? v : null);
  const ids = (v, allowed, max) => [...new Set((Array.isArray(v) ? v : []).map(String).filter(x => allowed.includes(x)))].slice(0, max || 20);
  const one = (v, allowed) => (v != null && allowed.includes(String(v)) ? String(v) : null);
  const int = (v, min, max) => { const n = Number(v); return v != null && v !== '' && Number.isInteger(n) && n >= min && n <= max ? n : null; };
  const settingValue = (key, v) => {
    if (!key || v == null) return null;
    if (key === 'mode') return oneOf(['invoke', 'custom'], v);
    if (key === 'default_view') return oneOf(['day', '2_days', '3_days', 'week', 'month', 'agenda'], v);
    if (key === 'grouped_by') return oneOf(['none', 'doctor', 'calendar'], v);
    if (key === 'hour_height') return oneOf(['up', 'down', 'max', 'min'], v) || int(v, 60, 200);
    if (key === 'slot_duration') return [5, 10, 15, 20, 30, 60].includes(Number(v)) ? Number(v) : null;
    if (key === 'default_sede') return v === 'all' || v === '' ? 'all' : one(v, m.sedes);
    if (key === 'event_label_format') return oneOf(['time_patient_notes', 'patient_treatment_time', 'time_patient_notes_treatment', 'time_treatment_patient_notes'], v);
    if (key === 'visible_hours') return oneOf(['full', 'clinic', 'custom'], v);
    if (key === 'hidden_weekdays') return null;
    return typeof v === 'boolean' ? v : v === 'true' ? true : v === 'false' ? false : null;
  };
  const step = (s, focus) => {
    s = s && typeof s === 'object' ? s : {};
    const intent = oneOf(INTENTS, s.intent) || 'unknown';
    const future = ['calendar.create', 'calendar.reschedule', 'calendar.edit', 'calendar.block', 'calendar.enable', 'calendar.reminder', 'calendar.form_set'].includes(intent);
    const setting = oneOf(SETTINGS, s.setting);
    const r = {
      intent,
      date: isDate(s.date) && (!future || s.date >= today) ? s.date : null,
      time: isTime(s.time) ? s.time : null,
      from_date: isDate(s.from_date) ? s.from_date : null,
      from_time: isTime(s.from_time) ? s.from_time : null,
      step: s.step === 1 || s.step === -1 ? s.step : null,
      view: oneOf(VIEWS, s.view),
      filter_op: oneOf(['only', 'add', 'remove', 'all'], s.filter_op),
      filter_target: oneOf(['doctor', 'calendar', 'sede'], s.filter_target),
      doctor_ids: ids(s.doctor_ids, m.doctors),
      calendar_ids: ids(s.calendar_ids, m.calendars),
      sede_ids: ids(s.sede_ids, m.sedes),
      group_by: oneOf(['none', 'doctor', 'calendar'], s.group_by),
      patient: str(s.patient, 80),
      query: str(s.query, 80),
      doctor_id: one(s.doctor_id, m.doctors),
      calendar_id: one(s.calendar_id, m.calendars),
      service_ids: ids(s.service_ids, m.services, 10),
      status: oneOf(STATUSES, s.status),
      cancellation_reason: oneOf(REASONS, s.cancellation_reason),
      period: oneOf(['morning', 'afternoon'], s.period),
      color: oneOf(COLORS, s.color == null ? null : String(s.color)),
      minutes: int(s.minutes, 5, 720),
      end_time: isTime(s.end_time) ? s.end_time : null,
      title: str(s.title, 240),
      reminder_type: oneOf(['reminder', 'note'], s.reminder_type),
      target: oneOf(TARGETS, s.target),
      zoom_op: oneOf(['in', 'out', 'max', 'min', 'reset', 'set'], s.zoom_op),
      zoom_level: int(s.zoom_level, 30, 250),
      amount: int(s.amount, 1, 10),
      panel_op: oneOf(['open', 'close', 'pin', 'unpin'], s.panel_op),
      options_of: oneOf(['views', 'calendars', 'doctors', 'sedes'], s.options_of),
      export_range: oneOf(['day', 'week', 'month', 'custom'], s.export_range),
      end_date: isDate(s.end_date) ? s.end_date : null,
      export_now: s.export_now === true,
      setting,
      setting_value: settingValue(setting, s.setting_value),
      weekdays: [...new Set((Array.isArray(s.weekdays) ? s.weekdays : []).map(Number).filter(d => Number.isInteger(d) && d >= 0 && d <= 6))],
      weekday_op: oneOf(['hide', 'show', 'set'], s.weekday_op),
      remove_service_ids: ids(s.remove_service_ids, m.services, 10),
      notes_op: oneOf(['append', 'replace', 'clear'], s.notes_op),
      dialog_op: oneOf(['confirm', 'cancel'], s.dialog_op),
      document: str(s.document, 40),
      email: str(s.email, 120),
      phone: str(s.phone, 40),
      question: str(s.question, 300),
      info_topics: [...new Set((Array.isArray(s.info_topics) ? s.info_topics : []).map(String).filter(x => INFO_TOPICS.includes(x)))].slice(0, 8),
      patient_action: oneOf(['quote', 'invoice', 'treatment', 'session', 'bill'], s.patient_action),
    };
    // La cita: nombrada o la que está en foco (la elegida antes o la del paso anterior).
    const ref = !!(r.patient || r.from_time || r.time) || focus;
    const refFrom = !!(r.patient || r.from_time) || focus;
    const missing = {
      'calendar.navigate': !r.date && !r.step,
      'calendar.view': !r.view,
      'calendar.filter': !r.filter_op || (r.filter_op !== 'all' && !r.doctor_ids.length && !r.calendar_ids.length && !r.sede_ids.length),
      'calendar.group': !r.group_by,
      'calendar.search': !r.query,
      'calendar.patient_next': !r.patient,
      'calendar.status': !r.status || !ref,
      'calendar.create': !r.patient && !r.date && !r.time,
      'calendar.reschedule': !refFrom || (!r.date && !r.time),
      'calendar.edit': !refFrom,
      'calendar.select': !r.patient && !r.from_time && !r.time,
      'calendar.color': !r.color || !refFrom,
      'calendar.move_calendar': !r.calendar_id || !refFrom,
      'calendar.assign_doctor': !r.doctor_id || !refFrom,
      'calendar.duration': !r.minutes || !refFrom,
      'calendar.delete': !refFrom,
      'calendar.open': !r.target || !refFrom,
      'calendar.block': !r.date && !r.time,
      'calendar.enable': !r.date && !r.time,
      'calendar.reminder_done': !r.title && !r.time,
      'calendar.reminder_delete': !r.title && !r.time,
      'calendar.zoom': !r.zoom_op || (r.zoom_op === 'set' && !r.zoom_level),
      'calendar.panel': !r.panel_op,
      'calendar.settings_open': !r.panel_op,
      'calendar.options': !r.options_of,
      'calendar.settings': !r.setting || (r.setting === 'hidden_weekdays' ? !r.weekday_op || (r.weekday_op !== 'show' && !r.weekdays.length) : r.setting === 'visible_hours' ? !r.setting_value && !(r.time && r.end_time) : r.setting_value === null),
      'calendar.dialog': !r.dialog_op,
      'calendar.patient_find': !r.patient && !r.document && !r.email && !r.phone,
      'calendar.patient_ask': !r.question,
      'calendar.patient_info': !r.info_topics.length,
      'calendar.patient_action': !r.patient_action,
    };
    if (missing[r.intent]) r.intent = 'unknown';
    return r;
  };
  const raw = Array.isArray(p.steps) && p.steps.length ? p.steps.slice(0, 6) : [p];
  let focus = m.has_focus === true;
  const steps = [];
  for (const s of raw) {
    const r = step(s, focus);
    if (r.intent === 'unknown') continue;
    steps.push(r);
    if (r.patient || r.from_time || r.intent === 'calendar.select') focus = true;
  }
  const confidence = Number(p.confidence);
  const first = steps[0] || step({}, false);
  return Object.assign({}, first, {
    relation: oneOf(RELATIONS, p.relation) || 'new',
    answer: str(p.answer, 120),
    steps,
    confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0,
  });
}`,
  },
  screen: {
    system: SCREEN_VOICE_PROMPT,
    prepare: `(ctx) => {
  // Lo que está a la vista (los nombres; nunca valores ni filas: los manda el frontend así).
  const s = ctx.screen && typeof ctx.screen === 'object' ? ctx.screen : {};
  const KINDS = ['button', 'tab', 'toggle', 'field', 'search', 'select'];
  const controls = (Array.isArray(s.controls) ? s.controls : []).slice(0, 80)
    .map(c => ({ kind: String((c && c.kind) || ''), label: String((c && c.label) || '').replace(/\\s+/g, ' ').trim().slice(0, 60), on: c && typeof c.on === 'boolean' ? c.on : undefined }))
    .filter(c => KINDS.includes(c.kind) && c.label.length >= 2);
  const c = ctx.conversation && typeof ctx.conversation === 'object' ? ctx.conversation : null;
  return {
    lines: [
      '',
      'ARRIBA: ' + (s.overlay ? 'una ventana' : 'la página') + (s.title ? ' «' + String(s.title).slice(0, 80) + '»' : ''),
      'CONTROLES (tipo · nombre):',
      controls.map(x => '- ' + x.kind + ' · ' + x.label + (x.on === undefined ? '' : ' (on: ' + x.on + ')')).join('\\n') || '(ninguno)',
      ...(c && c.task ? ['', 'TAREA EN CURSO: ' + String(c.task).slice(0, 200)] : []),
    ],
    meta: { controls: controls.map(x => ({ kind: x.kind, label: x.label })) },
  };
}`,
    validate: `(p, m) => {
  const norm = t => String(t || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/\\s+/g, ' ').trim();
  const byLabel = new Map((m.controls || []).map(c => [norm(c.label), c]));
  const KIND_OF = { press: ['button', 'tab'], tab: ['tab', 'button'], toggle: ['toggle'], fill: ['field', 'search'], select: ['select'], search: ['search', 'field'] };
  const RELATIONS = ['new', 'ignore', 'cancel', 'resume'];
  const step = x => {
    if (!x || typeof x !== 'object' || !KIND_OF[x.op]) return null;
    const c = byLabel.get(norm(x.target));
    if (!c || !KIND_OF[x.op].includes(c.kind)) return null;
    const value = typeof x.value === 'string' && x.value.trim() ? x.value.trim().slice(0, 200) : null;
    if ((x.op === 'fill' || x.op === 'search' || x.op === 'select') && !value) return null;
    return { op: x.op, target: c.label, value, on: typeof x.on === 'boolean' ? x.on : null };
  };
  const steps = (Array.isArray(p.steps) ? p.steps : []).map(step).filter(Boolean).slice(0, 6);
  const suggestions = (Array.isArray(p.suggestions) ? p.suggestions : [])
    .map(x => { const s = step(x); const label = x && typeof x.label === 'string' ? x.label.trim().slice(0, 80) : ''; return s && label ? Object.assign(s, { label }) : null; })
    .filter(Boolean).slice(0, 3);
  const relation = RELATIONS.includes(p.relation) ? p.relation : 'new';
  const intent = p.intent === 'steps' && steps.length ? 'steps' : p.intent === 'suggest' && suggestions.length ? 'suggest' : 'unknown';
  const confidence = Number(p.confidence);
  const c = Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0;
  return {
    relation,
    intent,
    // «actions» (no «steps»: la sesión toma «steps» como un plan de varios pedidos).
    actions: intent === 'steps' ? steps : [],
    suggestions: intent === 'suggest' ? suggestions : [],
    // Las propuestas ya son una pregunta: no se vuelve a confirmar.
    confidence: intent === 'suggest' ? Math.max(c, 0.85) : intent === 'unknown' && !['ignore', 'cancel', 'resume'].includes(relation) ? Math.min(0.3, c) : c,
  };
}`,
  },
  perio: {
    system: PERIO_VOICE_PROMPT,
    prepare: `(ctx) => {
  const list = v => (Array.isArray(v) ? v : []).map(Number).filter(n => Number.isInteger(n) && n >= 11 && n <= 48).slice(0, 32);
  const teeth = ctx.teeth && typeof ctx.teeth === 'object' ? ctx.teeth : {};
  const c = ctx.cursor && typeof ctx.cursor === 'object' ? ctx.cursor : null;
  const pass = ['ps', 'mg', 'fm'].includes(ctx.pass) ? ctx.pass : 'ps';
  const line = ['value', 'bop', 'sup', 'plaque'].includes(ctx.line) ? ctx.line : 'value';
  const PASS = { ps: 'profundidad', mg: 'margen gingival', fm: 'furcas y movilidad' };
  const LINE = { value: pass === 'mg' ? 'valores de margen gingival' : 'valores de profundidad', bop: 'marcas de sangrado (SS)', sup: 'marcas de supuración', plaque: 'marcas de placa' };
  const where = c && Number.isInteger(Number(c.tooth))
    ? 'pieza ' + Number(c.tooth) + ', cara ' + (c.side === 'v' ? 'vestibular' : 'lingual/palatina') + ', sitio ' + String(c.site || '').slice(0, 10)
    : '(sin sonda)';
  return {
    lines: [
      '',
      'ESTADO DE LA SONDA:',
      '- Pasada: ' + PASS[pass],
      '- Línea activa: ' + (pass === 'fm' ? 'movilidad de la pieza ' + (Number(ctx.fm_tooth) || '?') : LINE[line]),
      '- Sonda en: ' + where,
      '- Vista: ' + String(ctx.focus || 'auto').slice(0, 6),
      '- Piezas presentes: ' + (list(teeth.present).join(', ') || '(ninguna)'),
      '- Implantes: ' + (list(teeth.implants).join(', ') || '(ninguno)'),
      '- Ausentes: ' + (list(teeth.missing).join(', ') || '(ninguna)'),
      '- Pónticos: ' + (list(teeth.pontics).join(', ') || '(ninguno)'),
      '- Solo implantes: ' + (ctx.implants_only === true ? 'sí' : 'no'),
      '- RECESIÓN NEGATIVA: ' + (ctx.margin_negative === true ? 'sí' : 'no'),
    ],
    meta: {},
  };
}`,
    validate: `(p) => {
  // Solo comandos que el motor sabe correr, en rango. Confirmar, descartar y parar no.
  const int = (v, min, max) => { const n = Number(v); return v != null && v !== '' && Number.isInteger(n) && n >= min && n <= max ? n : undefined; };
  const tooth = v => { const n = int(v, 11, 48); return n != null && n % 10 >= 1 && n % 10 <= 8 ? n : undefined; };
  const oneOf = (list, v) => (list.includes(v) ? v : undefined);
  const sites = v => { if (!Array.isArray(v)) return undefined; const s = [...new Set(v.map(x => int(x, 0, 2)).filter(x => x != null))]; return s.length ? s : undefined; };
  const clean = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
  const one = c => {
    if (!c || typeof c !== 'object') return null;
    switch (c.kind) {
      case 'values': { const values = (Array.isArray(c.values) ? c.values : []).slice(0, 48).map(v => int(v, -10, 15)).filter(v => v != null); return values.length ? { kind: 'values', values } : null; }
      case 'answer': return typeof c.on === 'boolean' ? { kind: 'answer', on: c.on } : null;
      case 'same': case 'undo': case 'redo': case 'delete': return { kind: c.kind };
      case 'goto': { const g = clean({ kind: 'goto', tooth: tooth(c.tooth), side: oneOf(['v', 'i'], c.side), sites: sites(c.sites), line: oneOf(['ps', 'mg', 'bop', 'sup', 'plaque'], c.line) }); return g.tooth != null || g.side || g.line ? g : null; }
      case 'neighbour': return c.delta === 1 || c.delta === -1 ? { kind: 'neighbour', delta: c.delta } : null;
      case 'flag': { const flag = oneOf(['bop', 'sup', 'plaque'], c.flag); return flag ? clean({ kind: 'flag', flag, on: c.on !== false, tooth: tooth(c.tooth), side: oneOf(['v', 'i'], c.side), sites: sites(c.sites) }) : null; }
      case 'pass': { const pass = oneOf(['ps', 'mg', 'fm'], c.pass); return pass ? { kind: 'pass', pass } : null; }
      case 'focus': { const focus = oneOf(['auto', 'U', 'L', 'both'], c.focus); return focus ? { kind: 'focus', focus } : null; }
      case 'mobility': { const value = int(c.value, 0, 3); return value != null ? clean({ kind: 'mobility', tooth: tooth(c.tooth), value }) : null; }
      case 'furcation': { const grade = int(c.grade, 0, 3); return grade != null ? clean({ kind: 'furcation', tooth: tooth(c.tooth), entry: oneOf(['v', 'mp', 'dp', 'l'], c.entry), grade }) : null; }
      case 'status': { const t = tooth(c.tooth); const status = oneOf(['present', 'missing', 'implant', 'pontic'], c.status); return t != null && status ? { kind: 'status', tooth: t, status } : null; }
      case 'copy': { const what = oneOf(['ps', 'mg', 'fm', 'all'], c.what); return what ? { kind: 'copy', what } : null; }
      case 'query': { const what = oneOf(['previous', 'current', 'missing'], c.what); return what ? clean({ kind: 'query', what, tooth: tooth(c.tooth) }) : null; }
      default: return null;
    }
  };
  const commands = (Array.isArray(p.commands) ? p.commands : []).slice(0, 20).map(one).filter(Boolean);
  const confidence = Number(p.confidence);
  return { commands, confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0 };
}`,
  },
};

const voiceInterpret = workflow(
  'Voz - Interpretar',
  `${REQUIRED_SETUP('\n   "OpenAi account 2" en el nodo OpenAI.')}

RUTA: POST /webhook/voice/interpret (Authorization: Bearer <JWT>)

Interpreta una frase que el intérprete local de voz de un módulo no entendió. NO escribe nada ni
lee la base: solo devuelve qué se pidió. El frontend busca lo que haga falta, pregunta lo que
falte y pide confirmación antes de guardar. No se registra la frase (puede llevar nombres de
pacientes).

ENTRADA: { domain, text, locale, today: 'YYYY-MM-DD', weekday, timezone, route, context }
RESPUESTA: { domain, confidence, result }  (result: el de cada módulo, validado)
Un domain desconocido es un error.

MÓDULOS (domain):
- lab_orders
  context = { stages: [{ id, name, kind }], laboratories: [{ id, name }],
              draft?: { mode: 'create'|'edit', order_id, stage, items, teeth,
                        work_description, laboratory, send, due_date, is_urgent, notes } }
            (draft = la orden abierta por voz, nueva o en edición, sin el paciente: la frase la corrige)
  result  = { intent, order_id, stage_id, move_kind, effective_date, due_date, laboratory_id, patient,
              items: [{ service, quantity, teeth }], work_description, teeth, is_urgent, send, notes,
              urgent_change, note_add, filter: { overdue, urgent, due_today, view, clear, count },
              draft_edit: { patient, add_items, remove_items, update_items, work_description,
                            laboratory_id, clear_laboratory, send, due_date, urgent, note_add },
              confidence }
  intent: lab_order.move | create | open | update | status | list | edit | draft_edit | unknown
  Ids y fechas validados contra la lista cerrada que mandó el frontend (que además revalida).
- calendar (pantalla de citas; reglas en docs/voz-agenda.md)
  context = { doctors, calendars, sedes, services (listas cerradas), view, visible_from, visible_to,
              custom_mode, zoom, agendas_panel, settings, has_focus, focus_when, form_open,
              dialog_open, export_open, form?: { start, end_time, doctor_id, calendar_id,
              service_ids, has_notes }, conversation?: { task, pending: { question, awaiting,
              choices }, conversational } }
            (sin datos de pacientes: el nombre dicho viaja solo dentro de la frase)
  result  = un PLAN: { relation: new|answer|aux|ignore|cancel|resume, answer, confidence,
              steps: [ { intent, ...campos } ] } y el primer paso también arriba (compatibilidad)
  intent: navigate | today | view | options | filter | group | zoom | panel | search | close_search |
          gaps | hide_gaps | agenda | next | patient_next | refresh | export | settings |
          settings_open | select | status | create | reschedule | edit | color | move_calendar |
          assign_doctor | duration | delete | open | patient_find | patient_ask | form_set |
          form_save | form_cancel | dialog | patient_info | patient_action | block | enable |
          reminder | reminder_done |
          reminder_delete | unknown
  Lo que cambia algo se confirma en la pantalla; dar, editar y mover abren el formulario de siempre.
- perio (dictado del periodontograma, cuando el intérprete local no entendió la frase)
  context = { pass: 'ps'|'mg'|'fm', line: 'value'|'bop'|'sup'|'plaque',
              cursor: { tooth, side: 'v'|'i', site: 'distal'|'center'|'mesial' } | null, fm_tooth,
              focus, teeth: { present, implants, missing, pontics }, implants_only, margin_negative }
            (sin datos del paciente: solo dónde está la sonda y qué piezas hay)
  result  = { commands: [ los comandos de src/lib/perio/voice.ts: values, goto, flag, neighbour, pass,
              focus, mobility, furcation, answer, same, undo, redo, delete, status, copy, query ], confidence }
  Confirmar, descartar y parar el dictado nunca vienen de la IA. El frontend además pregunta antes
  de escribir si la confianza es baja o si aparece un número que no se dijo, y siempre antes de
  cambiar el estado de una pieza o copiar del examen anterior.`,
  [
    webhook('voice/interpret', 'POST'),
    code('node-prepare', 'Preparar Consulta', `${JWT_DECODE}
const body = input.body || {};
const domain = String(body.domain || '');
const DOMAINS = {
${Object.entries(VOICE_DOMAINS).map(([id, d]) => `  ${id}: { system: ${JSON.stringify(d.system)}, prepare: ${d.prepare} },`).join('\n')}
};
const mod = Object.prototype.hasOwnProperty.call(DOMAINS, domain) ? DOMAINS[domain] : null;
if (!mod) throw new Error('Módulo de voz desconocido: ' + domain);
const text = String(body.text || '').trim().slice(0, 500);
if (!text) throw new Error('Falta la frase (text)');
const today = /^\\d{4}-\\d{2}-\\d{2}$/.test(String(body.today)) ? String(body.today) : new Date().toISOString().slice(0, 10);
const ctx = body.context && typeof body.context === 'object' ? body.context : {};
const built = mod.prepare(ctx, body);

const prompt = [
  'FECHA DE HOY: ' + today + ' (' + String(body.weekday || '').slice(0, 20) + '), zona horaria ' + String(body.timezone || '').slice(0, 60),
  'IDIOMA: ' + String(body.locale || 'es').slice(0, 10),
  'PANTALLA: ' + String(body.route || '/').slice(0, 120),
  ...built.lines,
  '',
  'FRASE: ' + JSON.stringify(text),
].join('\\n');

return [{ json: { userId, domain, text, today, meta: built.meta, systemPrompt: mod.system, prompt } }];`),
    {
      id: 'node-agent',
      name: 'Interpretar',
      type: '@n8n/n8n-nodes-langchain.agent',
      typeVersion: 1.7,
      // El prompt de sistema es el del módulo: lo elige Preparar Consulta.
      parameters: { promptType: 'define', text: '={{ $json.prompt }}', options: { systemMessage: '={{ $json.systemPrompt }}' } },
    },
    code('node-validate', 'Validar Respuesta', `const q = $('Preparar Consulta').first().json;
const raw = String($input.first().json.output ?? '');
let p = {};
try {
  p = JSON.parse(raw.replace(/^\\s*\`\`\`(json)?\\s*/i, '').replace(/\`\`\`\\s*$/, '').trim());
} catch (_) {
  p = {};
}
if (!p || typeof p !== 'object') p = {};

const VALIDATE = {
${Object.entries(VOICE_DOMAINS).map(([id, d]) => `  ${id}: ${d.validate},`).join('\n')}
};
const result = VALIDATE[q.domain](p, q.meta, q.today);
const confidence = Number(result && result.confidence);

return [{ json: { body: { domain: q.domain, confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0, result } } }];`),
    respond(),
  ],
  {
    nodes: [{
      id: 'node-openai',
      name: 'OpenAI',
      type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
      typeVersion: 1.3,
      position: [560, 520],
      parameters: { model: { __rl: true, value: OPENAI_MODEL, mode: 'id' }, builtInTools: {}, options: {} },
      credentials: OPENAI_CREDENTIALS,
    }],
    connections: { OpenAI: { ai_languageModel: [[{ node: 'Interpretar', type: 'ai_languageModel', index: 0 }]] } },
  },
);

// ─── escribir ────────────────────────────────────────────────────────────────

const files = {
  'help-voice-interpret.json': voiceInterpret,
  'help-onboarding-status.json': onboardingStatus,
  'help-onboarding-progress.json': onboardingProgress,
  'help-catalog-version.json': catalogVersion,
  'help-settings.json': settings,
  'help-videos.json': videosList,
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
