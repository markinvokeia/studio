#!/usr/bin/env node
/**
 * generate-study-order-intake-workflow.mjs
 * ---------------------------------------------------------------------------
 * Genera n8n-workflows/whatsapp-study-order-intake.json: el subflujo que lee
 * una orden de estudio recibida por WhatsApp (Fase 3 de docs/whatsapp-ordenes-
 * estudio-plan.md).
 *
 *   node scripts/n8n/generate-study-order-intake-workflow.mjs
 *
 * La lógica (esquema, prompt y validador) está en
 * study-order-intake/intake-lib.mjs, con pruebas (`node --test`). Este script
 * la incrusta tal cual en los nodos Code: no se edita a mano en n8n.
 *
 * Se invoca con Execute Workflow:
 *   { intake_id, mode: 'extract' | 'revalidate' | 'compare' | 'import', answers?: '<json>' }
 *
 *   extract     descarga los originales, llama al modelo de visión y valida.
 *   revalidate  NO vuelve a llamar al modelo: revalida la extracción guardada
 *               con lo que el usuario respondió (answers: { confirmed:[ids],
 *               removed:[ids], overrides:{ patient_name, patient_document } }).
 *   compare     la orden ya está creada (order_created) o agendada (booked) y llegaron más
 *               archivos: lee todos juntos y los compara con la orden sin tocarla
 *               (compareLateFiles). Devuelve outcome unchanged|handoff; la lectura
 *               nueva queda en extraction_meta.late_files.
 *   import      la orden la subió recepción desde Invoke (intake con channel = 'import'):
 *               lee los originales y valida SIN conversación (validateImport). No cambia
 *               el estado del intake: devuelve el cuerpo del borrador (order_payload) y
 *               los puntos a revisar, y quien llamó crea la orden.
 *
 * Devuelve { intake_id, outcome: ready|needs_input|handoff, status, ... } y deja
 * el intake actualizado (status, extraction, validation, extraction_meta).
 * ---------------------------------------------------------------------------
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Las versiones que quedan en extraction_meta salen de la misma lib que arma el prompt y el esquema.
import { PROMPT_VERSION, SCHEMA_VERSION } from './study-order-intake/intake-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const OUT = join(ROOT, 'n8n-workflows', 'whatsapp-study-order-intake.json');

// Sin imports ni `export`: el código se pega dentro de un nodo Code.
const LIB = readFileSync(join(HERE, 'study-order-intake', 'intake-lib.mjs'), 'utf8')
    .replace(/^export\s+/gm, '')
    .replace(/^\/\*\*[\s\S]*?\*\/\n/, ''); // la cabecera del archivo no hace falta en n8n

const PG = { postgres: { id: '6b7Sjdnppbfve8ka', name: 'Postgres account' } };
const OPENAI = { openAiApi: { id: '5Crz2RwSV99AIItb', name: 'OpenAi account 2' } };
const GDRIVE = { googleDriveOAuth2Api: { id: 'k3vQaAkau21se8nC', name: 'Google Drive account 2' } };

const nodes = [];
const connections = {};
const add = (name, type, typeVersion, parameters, position, extra = {}) => {
    nodes.push({ parameters, type, typeVersion, position, id: `so-intake-${nodes.length + 1}`, name, ...extra });
};
const link = (from, to, out = 0) => {
    const c = (connections[from] ||= { main: [] });
    while (c.main.length <= out) c.main.push([]);
    c.main[out].push({ node: to, type: 'main', index: 0 });
};
const x = (i) => 240 + i * 260;

// ── 1. Trigger ───────────────────────────────────────────────────────────────
add('When Executed by Another Workflow', 'n8n-nodes-base.executeWorkflowTrigger', 1.1, {
    workflowInputs: { values: [{ name: 'intake_id' }, { name: 'mode' }, { name: 'answers' }] },
}, [x(0), 300]);

// ── 2. Contexto: intake, originales, catálogo, opciones y configuración ─────
add('Load Intake Context', 'n8n-nodes-base.postgres', 2.6, {
    operation: 'executeQuery',
    query: `-- $1 = id del intake.
-- Todo lo que el subflujo necesita en UNA fila: el intake, sus originales guardados,
-- el catalogo vigente de estudios, las opciones del formulario y la config.
-- El catalogo es lo que muestra el asistente de ordenes: los servicios ACTIVOS de las categorias
-- ci-orden:cat:* (no se filtra por external_id del servicio: hay servicios de la clinica con el
-- suyo propio, p. ej. PROTECTOR BUCAL 01.9.5, o sin ninguno). La clave que ve el modelo es el
-- external_id o, si no tiene, 'id:<id>'.
SELECT i.id::text AS id,
       i.phone,
       i.status,
       i.channel,
       i.extraction,
       i.validation,
       i.sender_user_id::text AS sender_user_id,
       (SELECT o.order_number FROM study_orders o WHERE o.id = i.study_order_id) AS order_number,
       (SELECT to_char(a.start_datetime, 'YYYY-MM-DD HH24:MI') FROM appointments a WHERE a.id = i.appointment_id) AS appointment_start,
       (SELECT s.name FROM sedes s WHERE s.id = i.chosen_sede_id) AS sede_name,
       (SELECT row_to_json(u) FROM (
           SELECT us.id::text AS id, us.name, us.phone_number AS phone, us.identity_document
             FROM users us WHERE us.id = i.sender_user_id) u) AS sender,
       (SELECT count(*) > 1 FROM users us
         WHERE us.phone_number = i.phone AND COALESCE(us.is_active, true)) AS phone_ambiguous,
       (SELECT coalesce(json_agg(json_build_object(
                   'attachment_id', a.id, 'drive_file_id', a.drive_file_id,
                   'file_name', a.file_name, 'mime_type', a.mime_type) ORDER BY a.id), '[]'::json)
          FROM attachments a
         WHERE a.source_name = 'whatsapp_order_intake' AND a.source_id = i.id::text) AS files,
       (SELECT coalesce(json_agg(json_build_object(
                   'id', s.id, 'external_id', COALESCE(s.external_id, 'id:' || s.id), 'name', s.name,
                   'section_code', c.code, 'duration_minutes', s.duration_minutes)
                   ORDER BY c.code, s.id), '[]'::json)
          FROM service_catalog s
          JOIN miscellaneous_categories c ON c.id = s.category_id
         WHERE c.external_id LIKE 'ci-orden:cat:%' AND s.is_active) AS catalog,
       (SELECT coalesce(json_agg(json_build_object(
                   'option_kind', o.option_kind, 'code', o.code, 'label', o.label,
                   'section_code', o.section_code, 'group_code', o.group_code,
                   'input_type', o.input_type, 'service_external_id', COALESCE(sv.external_id, 'id:' || sv.id))
                   ORDER BY o.sort_order), '[]'::json)
          FROM study_order_options o
          LEFT JOIN service_catalog sv ON sv.id = o.service_id
         WHERE o.is_active) AS options,
       json_build_object(
         'min_confidence', COALESCE((SELECT value::numeric FROM system_configurations
                                      WHERE key = 'whatsapp_orders_min_confidence'), 0.85),
         'vision_model', COALESCE((SELECT value FROM system_configurations
                                    WHERE key = 'whatsapp_orders_vision_model'), 'gpt-5.6-luna')
       ) AS config
  FROM whatsapp_order_intakes i
 WHERE i.id = $1::uuid;`,
    options: { queryReplacement: '={{ [ $json.intake_id ] }}' },
}, [x(1), 300], { credentials: PG, alwaysOutputData: true });
link('When Executed by Another Workflow', 'Load Intake Context');

// ── 3. ¿Hay que llamar al modelo? ────────────────────────────────────────────
add('Needs Extraction?', 'n8n-nodes-base.if', 2.2, {
    conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [{
            id: 'so-intake-needs-extraction',
            leftValue: `={{ ['extract', 'compare', 'import'].includes($('When Executed by Another Workflow').first().json.mode || 'extract') && ($json.files || []).length > 0 }}`,
            rightValue: true,
            operator: { type: 'boolean', operation: 'true', singleValue: true },
        }],
        combinator: 'and',
    },
    options: {},
}, [x(2), 300]);
link('Load Intake Context', 'Needs Extraction?');

// ── 4. Originales → modelo de visión ─────────────────────────────────────────
add('Split Files', 'n8n-nodes-base.code', 2, {
    jsCode: `// Un item por original guardado (attachments). Se descarga de Drive: es la copia de auditoria.
const ctx = $input.first().json;
return (ctx.files || []).map((f) => ({ json: { ...f, intake_id: ctx.id } }));`,
}, [x(3), 180]);
link('Needs Extraction?', 'Split Files', 0);

add('Drive Download', 'n8n-nodes-base.googleDrive', 3, {
    operation: 'download',
    fileId: { __rl: true, value: '={{ $json.drive_file_id }}', mode: 'id' },
    options: {},
}, [x(4), 180], { credentials: GDRIVE });
link('Split Files', 'Drive Download');

add('Build Vision Request', 'n8n-nodes-base.code', 2, {
    jsCode: `${LIB}

// ---- Arma el pedido al modelo: imagenes y PDF como partes del mensaje --------
const ctx = $('Load Intake Context').first().json;
const metas = $('Split Files').all().map((i) => i.json);
const items = $input.all();

const parts = [{ type: 'text', text: 'Transcribí la orden de estudios que figura en los archivos adjuntos (pueden ser el frente y el dorso o varias hojas de la misma orden).' }];
for (let i = 0; i < items.length; i++) {
  const bin = items[i].binary && items[i].binary.data;
  if (!bin) continue;
  const buf = await this.helpers.getBinaryDataBuffer(i, 'data');
  const mime = String((metas[i] && metas[i].mime_type) || bin.mimeType || 'application/octet-stream').split(';')[0];
  const dataUrl = 'data:' + mime + ';base64,' + buf.toString('base64');
  if (mime === 'application/pdf') {
    parts.push({ type: 'file', file: { filename: (metas[i] && metas[i].file_name) || ('orden-' + i + '.pdf'), file_data: dataUrl } });
  } else {
    parts.push({ type: 'image_url', image_url: { url: dataUrl, detail: 'high' } });
  }
}

const body = {
  model: ctx.config.vision_model,
  messages: [
    { role: 'system', content: buildSystemPrompt(ctx.catalog, ctx.options) },
    { role: 'user', content: parts },
  ],
  response_format: {
    type: 'json_schema',
    json_schema: { name: 'study_order_extraction', strict: true, schema: buildExtractionSchema(ctx.catalog, ctx.options) },
  },
};
return [{ json: { body, model: ctx.config.vision_model, files_sent: parts.length - 1, started_at: Date.now() } }];`,
}, [x(5), 180]);
link('Drive Download', 'Build Vision Request');

add('Vision Request', 'n8n-nodes-base.httpRequest', 4.2, {
    method: 'POST',
    url: 'https://api.openai.com/v1/chat/completions',
    authentication: 'predefinedCredentialType',
    nodeCredentialType: 'openAiApi',
    sendBody: true,
    specifyBody: 'json',
    jsonBody: '={{ JSON.stringify($json.body) }}',
    options: { timeout: 180000, response: { response: { neverError: true, responseFormat: 'json' } } },
}, [x(6), 180], { credentials: OPENAI, retryOnFail: true, maxTries: 2, waitBetweenTries: 3000 });
link('Build Vision Request', 'Vision Request');

add('Parse Extraction', 'n8n-nodes-base.code', 2, {
    jsCode: `// Convierte la respuesta del modelo en { extraction } o { extraction_error }.
const req = $('Build Vision Request').first().json;
const res = $input.first().json || {};
const meta = {
  model: req.model,
  files_sent: req.files_sent,
  latency_ms: Date.now() - req.started_at,
  usage: res.usage || null,
  prompt_version: '${PROMPT_VERSION}',
  schema_version: '${SCHEMA_VERSION}',
  extracted_at: new Date().toISOString(),
};
let extraction = null, error = null;
if (res.error) {
  error = 'El modelo devolvió un error: ' + String(res.error.message || res.error.type || 'desconocido');
} else {
  const msg = res.choices && res.choices[0] && res.choices[0].message;
  if (!msg) error = 'Respuesta del modelo sin contenido.';
  else if (msg.refusal) error = 'El modelo se negó a procesar el documento.';
  else {
    try { extraction = JSON.parse(msg.content); }
    catch (e) { error = 'La respuesta del modelo no es JSON válido.'; }
  }
}
return [{ json: { extraction, extraction_error: error, extraction_meta: meta, fresh: extraction !== null } }];`,
}, [x(7), 180]);
link('Vision Request', 'Parse Extraction');

// ── 5. Sin llamada al modelo: se reutiliza lo guardado ──────────────────────
add('Reuse Saved Extraction', 'n8n-nodes-base.code', 2, {
    jsCode: `// 'revalidate' (o intake sin archivos): no se vuelve a pagar ni a depender del modelo.
const ctx = $input.first().json;
return [{ json: { extraction: ctx.extraction || null, extraction_error: null, extraction_meta: null, fresh: false } }];`,
}, [x(3), 440]);
link('Needs Extraction?', 'Reuse Saved Extraction', 1);

// ── 6. Consultas de paciente y duplicados ───────────────────────────────────
const PREPARE = `// Documento del paciente (el que se corrigió por chat, si lo hubo) normalizado para buscarlo.
const ctx = $('Load Intake Context').first().json;
const inp = $('When Executed by Another Workflow').first().json;
let answers = {};
try { answers = inp.answers ? JSON.parse(inp.answers) : {}; } catch (e) { answers = {}; }
const ex = $input.first().json.extraction;
const raw = String((answers.overrides && answers.overrides.patient_document) || (ex && ex.patient && ex.patient.document) || '');
const doc = raw.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toUpperCase().replace(/[^0-9A-Z]/g, '');
return [{ json: { doc, extraction: ex, extraction_error: $input.first().json.extraction_error, extraction_meta: $input.first().json.extraction_meta, fresh: $input.first().json.fresh, answers } }];`;
add('Prepare Lookups', 'n8n-nodes-base.code', 2, { jsCode: PREPARE }, [x(8), 300]);
link('Parse Extraction', 'Prepare Lookups');
link('Reuse Saved Extraction', 'Prepare Lookups');

add('Lookup Patient Data', 'n8n-nodes-base.postgres', 2.6, {
    operation: 'executeQuery',
    query: `-- $1 = documento normalizado (vacio si no se pudo leer).
-- Devuelve SOLO los usuarios con ese documento y las ordenes abiertas (ultimos 30 dias)
-- de esos usuarios, para detectar una orden repetida. Nada mas del padron.
WITH matches AS (
  SELECT u.id, u.name, u.phone_number, u.identity_document
    FROM users u
   WHERE $1 <> ''
     AND regexp_replace(upper(coalesce(u.identity_document, '')), '[^0-9A-Z]', '', 'g') = $1
)
SELECT (SELECT coalesce(json_agg(json_build_object(
                'id', m.id::text, 'name', m.name, 'phone', m.phone_number,
                'identity_document', m.identity_document)), '[]'::json) FROM matches m) AS doc_matches,
       (SELECT coalesce(json_agg(json_build_object(
                'id', o.id::text, 'order_number', o.order_number,
                'service_ids', (SELECT coalesce(json_agg(i.service_id), '[]'::json)
                                  FROM study_order_items i
                                 WHERE i.study_order_id = o.id AND i.is_cancelled = false))), '[]'::json)
          FROM study_orders o
         WHERE o.status = 'submitted'
           AND o.created_at > now() - interval '30 days'
           AND o.patient_id IN (SELECT id FROM matches)) AS open_orders;`,
    options: { queryReplacement: '={{ [ $json.doc ] }}' },
}, [x(9), 300], { credentials: PG, alwaysOutputData: true });
link('Prepare Lookups', 'Lookup Patient Data');

// ── 7. Validación determinista ──────────────────────────────────────────────
add('Validate', 'n8n-nodes-base.code', 2, {
    jsCode: `${LIB}

// ---- Glue: junta el contexto y corre el validador ---------------------------
const ctx = $('Load Intake Context').first().json;
const prep = $('Prepare Lookups').first().json;
const lk = $input.first().json || {};
const answers = prep.answers || {};
const mode = $('When Executed by Another Workflow').first().json.mode || 'extract';

// 'compare': llegaron archivos con la orden ya creada (order_created) o ya agendada (booked). No se
// revalida ni se toca la orden: se compara la lectura nueva (de todos los archivos) con lo que ya
// tiene, y queda para auditoría.
if (mode === 'compare') {
  const v = ctx.validation || {};
  const minConf = Number((ctx.config && ctx.config.min_confidence) || 0.85);
  // Borrador con TODOS los archivos (incluido el nuevo): si se deriva por "la orden cambió",
  // recepción arma la orden de reemplazo desde acá.
  const lateDraft = buildOrderDraft({ extraction: prep.extraction, catalog: ctx.catalog, options: ctx.options, prior: v.prior || {}, min_confidence: minConf });
  const r = compareLateFiles({
    extraction: prep.extraction,
    extraction_error: prep.extraction_error,
    catalog: ctx.catalog,
    order: {
      order_number: ctx.order_number || null,
      booked: ctx.status === 'booked',
      items: (v.resolved && v.resolved.items) || [],
      documents: [v.patient && v.patient.document, ctx.extraction && ctx.extraction.patient && ctx.extraction.patient.document],
    },
    prior: v.prior || {},
  });
  return [{ json: {
    mode,
    intake_id: ctx.id,
    outcome: r.outcome,
    status: null,
    handoff_reason: r.handoff_reason,
    handoff_detail: r.handoff_detail,
    added: r.added,
    // Para que el agente pueda decirle al usuario qué queda igual.
    late_context: {
      status: ctx.status,
      order_number: ctx.order_number || null,
      appointment_start: ctx.appointment_start || null,
      sede_name: ctx.sede_name || null,
    },
    questions: [],
    warnings: [],
    patient: v.patient || null,
    resolved: v.resolved || null,
    duplicate_of: null,
    validation: null,
    extraction_to_save: null,
    extraction_meta: {},
    late_check: {
      checked_at: new Date().toISOString(),
      outcome: r.outcome,
      handoff_reason: r.handoff_reason,
      handoff_detail: r.handoff_detail,
      extraction: prep.extraction,
      extraction_meta: prep.extraction_meta || {},
      draft: lateDraft,
      // Lo que hay que revisar en esa orden de reemplazo (solo si se deriva).
      review_items: r.outcome === 'handoff'
        ? buildReviewItems({
            extraction: prep.extraction, draft: lateDraft,
            fields: collectFieldConfidence(prep.extraction, ctx.catalog, ctx.options),
            min_confidence: minConf, handoff_reason: r.handoff_reason, handoff_detail: r.handoff_detail,
            prior: v.prior || {},
          })
        : [],
    },
  } }];
}

// 'import': recepción subió la orden desde Invoke. No hay conversación: siempre sale un borrador
// con todo lo dudoso como puntos a revisar. El estado del intake lo cierra quien llamó, al crear
// la orden.
if (mode === 'import') {
  const result = validateImport({
    extraction: prep.extraction,
    extraction_error: prep.extraction_error,
    has_files: (ctx.files || []).some((f) => f && f.attachment_id),
    catalog: ctx.catalog,
    options: ctx.options,
    doc_matches: lk.doc_matches || [],
    open_orders: lk.open_orders || [],
    config: { min_confidence: ctx.config && ctx.config.min_confidence },
  });
  return [{ json: {
    mode,
    intake_id: ctx.id,
    outcome: result.outcome,
    status: ctx.status,
    handoff_reason: null,
    handoff_detail: null,
    questions: [],
    warnings: result.warnings,
    patient: result.patient,
    resolved: null,
    duplicate_of: result.duplicate_of,
    review_items: result.review_items,
    order_payload: buildImportOrderPayload({
      validation: result, intake_id: ctx.id, fallback_name: 'Paciente sin identificar (orden importada)',
    }),
    validation: { ...result, mode, validated_at: new Date().toISOString() },
    extraction_to_save: prep.fresh ? prep.extraction : null,
    extraction_meta: prep.extraction_meta || {},
  } }];
}

// Lo ocurrido antes en este intake (se guarda dentro de validation.prior).
const before = (ctx.validation && ctx.validation.prior) || {};
const prior = {
  resend_count: before.resend_count || 0,
  asked_confirm: before.asked_confirm || [],
  asked_fields: before.asked_fields || [],
  confirmed: [...(before.confirmed || []), ...(answers.confirmed || [])],
  removed: [...(before.removed || []), ...(answers.removed || [])],
  overrides: { ...(before.overrides || {}), ...(answers.overrides || {}) },
};

const result = validateExtraction({
  extraction: prep.extraction,
  extraction_error: prep.extraction_error,
  has_files: (ctx.files || []).some((f) => f && f.attachment_id),
  catalog: ctx.catalog,
  options: ctx.options,
  sender: ctx.sender || null,
  phone: ctx.phone,
  phone_ambiguous: ctx.phone_ambiguous === true,
  doc_matches: lk.doc_matches || [],
  open_orders: lk.open_orders || [],
  config: { min_confidence: ctx.config && ctx.config.min_confidence },
  prior,
});

const STATUS = { ready: 'awaiting_confirmation', needs_input: 'needs_input', handoff: 'handed_off' };
return [{ json: {
  mode,
  intake_id: ctx.id,
  outcome: result.outcome,
  status: STATUS[result.outcome],
  handoff_reason: result.handoff_reason,
  handoff_detail: result.handoff_detail,
  questions: result.questions,
  warnings: result.warnings,
  patient: result.patient,
  resolved: result.resolved,
  duplicate_of: result.duplicate_of,
  validation: { ...result, validated_at: new Date().toISOString() },
  extraction_to_save: prep.fresh ? prep.extraction : null,
  extraction_meta: prep.extraction_meta || {},
} }];`,
}, [x(10), 300]);
link('Lookup Patient Data', 'Validate');

// ── 8. Guardar y devolver ───────────────────────────────────────────────────
add('Save Result', 'n8n-nodes-base.postgres', 2.6, {
    operation: 'executeQuery',
    query: `-- extract / revalidate: solo actualiza un intake que sigue en curso; nunca pisa uno ya agendado o derivado.
-- compare (archivos que llegan con la orden ya creada o agendada): no toca el estado, la extraccion ni la validacion
-- de la orden; solo agrega la lectura nueva a extraction_meta.late_files para auditoria.
-- import solo toca intakes importados (y extract/revalidate solo los de WhatsApp): el estado no cambia.
WITH v AS (
  UPDATE whatsapp_order_intakes
     SET status          = $2,
         handoff_reason  = $3,
         handoff_detail  = $4,
         extraction      = COALESCE($5::jsonb, extraction),
         validation      = $6::jsonb,
         extraction_meta = extraction_meta || $7::jsonb,
         patient_id      = COALESCE($8::uuid, patient_id)
   WHERE id = $1::uuid
     AND $9::text <> 'compare'
     AND ($9::text = 'import') = (channel = 'import')
     AND status IN ('extracting', 'needs_input', 'awaiting_confirmation')
  RETURNING id, status, handoff_reason
),
c AS (
  UPDATE whatsapp_order_intakes
     SET extraction_meta = extraction_meta || jsonb_build_object('late_files',
           COALESCE(extraction_meta -> 'late_files', '[]'::jsonb) || jsonb_build_array($10::jsonb))
   WHERE id = $1::uuid
     AND $9::text = 'compare'
     AND status IN ('order_created', 'booked')
  RETURNING id, status, handoff_reason
)
SELECT id::text AS id, status, handoff_reason FROM v
UNION ALL
SELECT id::text AS id, status, handoff_reason FROM c;`,
    options: {
        queryReplacement: `={{ [
  $json.intake_id,
  $json.status,
  $json.handoff_reason,
  $json.handoff_detail,
  $json.extraction_to_save ? JSON.stringify($json.extraction_to_save) : null,
  $json.validation ? JSON.stringify($json.validation) : null,
  JSON.stringify($json.extraction_meta || {}),
  ($json.patient && $json.patient.patient_id) || null,
  $json.mode || 'extract',
  $json.late_check ? JSON.stringify($json.late_check) : null
] }}`,
    },
}, [x(11), 300], { credentials: PG, alwaysOutputData: true });
link('Validate', 'Save Result');

add('Format Result', 'n8n-nodes-base.code', 2, {
    jsCode: `// Lo que recibe quien llamo al subflujo (el agente de ordenes). 'saved' false = el intake
// ya no estaba en curso (por ejemplo ya se habia derivado): el llamador no debe seguir ni derivar.
// mode 'compare': outcome es 'unchanged' (la orden ya creada queda igual) o 'handoff'.
const v = $('Validate').first().json;
const saved = $input.first().json || {};
return [{ json: {
  saved: !!saved.id,
  mode: v.mode,
  added: v.added || [],
  late_context: v.late_context || null,
  intake_id: v.intake_id,
  outcome: v.outcome,
  status: v.status,
  handoff_reason: v.handoff_reason,
  handoff_detail: v.handoff_detail,
  questions: v.questions,
  warnings: v.warnings,
  patient: v.patient,
  resolved: v.resolved,
  duplicate_of: v.duplicate_of,
  // Solo en 'import': el cuerpo del borrador para /study-orders/upsert y lo que hay que revisar.
  order_payload: v.order_payload || null,
  review_items: v.mode === 'import' ? (v.review_items || []) : null,
} }];`,
}, [x(12), 300]);
link('Save Result', 'Format Result');

// ── Notas ────────────────────────────────────────────────────────────────────
nodes.push({
    parameters: {
        width: 560, height: 380, color: 4,
        content: [
            '## WhatsApp - Study Order Intake (generado)',
            '',
            '**No editar a mano**: lo genera `scripts/n8n/generate-study-order-intake-workflow.mjs` a partir de `study-order-intake/intake-lib.mjs` (con pruebas).',
            '',
            '**Entrada:** `intake_id`, `mode` (`extract` | `revalidate` | `compare` | `import`), `answers` (JSON).',
            '',
            '**extract:** descarga los originales de Drive → modelo de visión con salida estructurada (ids de servicio = enum del catálogo) → validador determinista → guarda en `whatsapp_order_intakes`.',
            '**revalidate:** no llama al modelo; revalida la extracción guardada con las respuestas del usuario.',
            '**compare:** la orden ya está creada y llegaron más archivos: los lee todos y los compara con la orden sin modificarla (`unchanged` o derivación); la lectura queda en `extraction_meta.late_files`.',
            '**import:** orden subida desde Invoke (`channel = import`): lee y valida sin conversación; devuelve `order_payload` y `review_items` para el borrador (lo crea `Study Orders - Import`).',
            '',
            '**El modelo solo transcribe.** Quién es el paciente, si el estudio existe y si hay que derivar lo decide el validador.',
            '',
            'Modelo: `system_configurations.whatsapp_orders_vision_model`. Debe aceptar imágenes y PDF.',
        ].join('\n'),
    },
    type: 'n8n-nodes-base.stickyNote', typeVersion: 1, position: [x(0), 20], id: 'so-intake-note', name: 'Notas',
});

const workflow = {
    name: 'WhatsApp - Study Order Intake',
    nodes,
    connections,
    settings: { executionOrder: 'v1' },
    tags: [],
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(workflow, null, 2) + '\n');
console.log(`Escrito ${OUT} (${nodes.length} nodos)`);
