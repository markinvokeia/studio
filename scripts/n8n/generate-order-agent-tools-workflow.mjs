#!/usr/bin/env node
/**
 * generate-order-agent-tools-workflow.mjs
 * ---------------------------------------------------------------------------
 * Genera n8n-workflows/whatsapp-order-agent-tools.json: los webhooks que usa el
 * AGENTE DE ÓRDENES de WhatsApp (Fase 4 de docs/whatsapp-ordenes-estudio-plan.md).
 *
 *   node scripts/n8n/generate-order-agent-tools-workflow.mjs
 *
 * Webhooks (todos POST, con Header Auth como el resto de agent-tools/*):
 *   agent-tools/order-get-intake        estado de la orden en curso de ese teléfono
 *   agent-tools/order-answer            respuesta del usuario a una pregunta (revalida)
 *   agent-tools/order-list-sedes        sedes entre las que puede elegir
 *   agent-tools/order-list-slots        horarios libres de una sede (duración total)
 *   agent-tools/order-confirm-and-book  alta del paciente + orden + cita (idempotente). Crea, envía
 *                                       y agenda la orden con SQL directo (el MISMO de los endpoints
 *                                       /study-orders/*, importado de study-orders-sql.mjs) y como
 *                                       actor el usuario de servicio "Agente WhatsApp": no llama a
 *                                       endpoints protegidos por JWT.
 *   agent-tools/order-handoff           deriva a recepción con motivo y fotos
 *
 * El LLM nunca maneja ids: todo se resuelve por el TELÉFONO (que sale del
 * contexto del agente, no de lo que diga el usuario) y por números de lista
 * (sede 1, horario 2) guardados en whatsapp_order_intakes.slots_offered.
 *
 * Los errores de negocio responden 200 con { ok: false, error_code, message }:
 * así el modelo los lee como cualquier otro resultado (un 4xx lo recibiría
 * como una excepción de la herramienta).
 *
 * La lógica de horarios (slots-lib.mjs) y del validador viven en archivos con
 * pruebas y se incrustan tal cual en los nodos Code.
 * ---------------------------------------------------------------------------
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Mismo SQL que los endpoints /study-orders/*: un cambio ahí llega al agente al regenerar.
import {
    BOOKING_TOKEN_SQL, LOG_EVENT_SQL, NOTIFY_RECEPTION_SQL, PUBLIC_BOOK_SQL, REVIEW_ITEMS_INSERT_SQL, SUBMIT_SQL, UPSERT_SQL,
} from './study-orders-sql.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const OUT = join(ROOT, 'n8n-workflows', 'whatsapp-order-agent-tools.json');

const stripLib = (file) =>
    readFileSync(join(HERE, 'study-order-intake', file), 'utf8')
        .replace(/^export\s+/gm, '')
        .replace(/^\/\*\*[\s\S]*?\*\/\n/, '');
const SLOTS_LIB = stripLib('slots-lib.mjs');

const PG = { postgres: { id: '6b7Sjdnppbfve8ka', name: 'Postgres account' } };
const AGENT_KEY = { httpHeaderAuth: { id: 'REPLACE_WITH_AGENT_TOOLS_HEADER_AUTH_ID', name: 'WhatsApp Agent Tools Header Auth' } };
/**
 * Usuario de servicio "Agente WhatsApp" (migración 122, rol agente_ia). Es el actor ($1 de los SQL de
 * órdenes) de todo lo que el agente hace con la orden: los permisos se siguen resolviendo contra su rol.
 */
const AGENT_EMAIL = 'agente-whatsapp@sistema.invokeia.invalid';
/** Workflow `Events` (push por SSE), el mismo que usan generate-study-order-workflows.mjs y las citas. */
const EVENTS_WORKFLOW_ID = 'W5SZnwkaTigFrHO6';
const BASE = `{{ $env.N8N_URL || 'https://n8n-project-n8n.7ig1i3.easypanel.host' }}`;
const INTAKE_WF = {
    __rl: true, value: 'REPLACE_WITH_STUDY_ORDER_INTAKE_WORKFLOW_ID', mode: 'list',
    cachedResultName: 'WhatsApp - Study Order Intake',
};

const nodes = [];
const connections = {};
let flowRow = 0;
let cur = { x: 0, y: 0 };

const add = (name, type, typeVersion, parameters, col, extra = {}) => {
    nodes.push({ parameters, type, typeVersion, position: [240 + col * 260, cur.y], id: `oa-${nodes.length + 1}`, name, ...extra });
};
const link = (from, to, out = 0) => {
    const c = (connections[from] ||= { main: [] });
    while (c.main.length <= out) c.main.push([]);
    c.main[out].push({ node: to, type: 'main', index: 0 });
};
const startFlow = (title) => {
    cur = { x: 0, y: flowRow * 420 };
    flowRow += 1;
    nodes.push({
        parameters: { width: 420, height: 60, content: `### ${title}`, color: 5 },
        type: 'n8n-nodes-base.stickyNote', typeVersion: 1, position: [200, cur.y - 70], id: `oa-note-${flowRow}`, name: `Nota ${flowRow}`,
    });
};

const webhook = (name, path) =>
    add(name, 'n8n-nodes-base.webhook', 2, {
        httpMethod: 'POST', path, authentication: 'headerAuth', responseMode: 'responseNode', options: {},
    }, 0, { credentials: AGENT_KEY, webhookId: `oa-${path.replace(/[^a-z]/gi, '-')}` });

const code = (name, jsCode, col) => add(name, 'n8n-nodes-base.code', 2, { jsCode }, col);

const pg = (name, query, replacement, col, extra = {}) =>
    add(name, 'n8n-nodes-base.postgres', 2.6, { operation: 'executeQuery', query, options: { queryReplacement: replacement } },
        col, { credentials: PG, alwaysOutputData: true, ...extra });

/** Un error de SQL sigue al nodo de chequeo (que responde ok:false) en lugar de cortar la ejecución sin responder. */
const SAFE = { onError: 'continueRegularOutput' };

/** Bitácora y avisos: como en los endpoints, que fallen nunca tumba la operación. */
const pgSide = (name, query, replacement, col, extra = {}) =>
    add(name, 'n8n-nodes-base.postgres', 2.6, { operation: 'executeQuery', query, options: { queryReplacement: replacement } },
        col, { credentials: PG, onError: 'continueRegularOutput', ...extra });

/** Push por SSE de los avisos, igual que "Empujar por SSE" de los endpoints de órdenes. */
const ssePush = (name, eventType, col) =>
    add(name, 'n8n-nodes-base.executeWorkflow', 1.2, {
        workflowId: { __rl: true, value: EVENTS_WORKFLOW_ID, mode: 'list', cachedResultName: 'Events' },
        mode: 'each',
        workflowInputs: {
            mappingMode: 'defineBelow',
            value: { event_type: eventType, user_ids: '={{ [$json.user_id] }}', channels: '={{ [] }}', payload: '={{ $json }}' },
        },
    }, col, { onError: 'continueRegularOutput' });

const gate = (name, col) =>
    add(name, 'n8n-nodes-base.if', 2.2, {
        conditions: {
            options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
            conditions: [{ id: `${name}-c1`, leftValue: '={{ !$json.__fail }}', rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }],
            combinator: 'and',
        },
        options: {},
    }, col);

const ifExpr = (name, expr, col) =>
    add(name, 'n8n-nodes-base.if', 2.2, {
        conditions: {
            options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
            conditions: [{ id: `${name}-c1`, leftValue: expr, rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }],
            combinator: 'and',
        },
        options: {},
    }, col);

const respond = (name, body, col) =>
    add(name, 'n8n-nodes-base.respondToWebhook', 1.1, {
        respondWith: 'json', responseBody: body, options: { responseCode: 200 },
    }, col);

const RESPOND_JSON = '={{ JSON.stringify($json) }}';
const RESPOND_FAIL = '={{ JSON.stringify({ ok: false, ...$json.__fail }) }}';

const http = (name, url, bodyExpr, cred, col, auth = true) =>
    add(name, 'n8n-nodes-base.httpRequest', 4.2, {
        method: 'POST', url: `=${BASE}${url}`,
        ...(auth ? { authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth' } : {}),
        sendBody: true, specifyBody: 'json', jsonBody: bodyExpr,
        options: { timeout: 60000, response: { response: { neverError: true, responseFormat: 'json' } } },
    }, col, auth ? { credentials: cred } : {});

// ---- fragmentos de código compartidos ---------------------------------------
const PARSE_PHONE = `const b = $json.body || {};
const phone = '+' + String(b.phone || '').replace(/\\D/g, '');
if (phone.length < 9) return [{ json: { __fail: { error_code: 'bad_phone', message: 'Falta el teléfono.' } } }];`;

const ACTIVE = `('extracting', 'needs_input', 'awaiting_confirmation', 'order_created')`;

const LOAD_INTAKE = `-- $1 = teléfono. La orden en curso de ese número (una sola por teléfono).
SELECT i.id::text AS id, i.phone, i.status, i.validation, i.slots_offered,
       i.study_order_id::text AS study_order_id, i.patient_id::text AS patient_id,
       i.chosen_sede_id, i.booking_attempts,
       (SELECT o.order_number FROM study_orders o WHERE o.id = i.study_order_id) AS order_number
  FROM whatsapp_order_intakes i
 WHERE i.phone = $1
   AND i.status IN ${ACTIVE}
   AND i.expires_at > now()
 ORDER BY i.created_at DESC
 LIMIT 1;`;

/** Resumen de una validación para el LLM (sin ids internos). */
const SUMMARIZE = `function summarize(v, status, orderNumber) {
  v = v || {};
  const r = v.resolved || null;
  const questions = (v.questions || []).map((q, i) => ({ number: i + 1, code: q.code, text: q.hint }));
  const NEXT = { extracting: 'wait', needs_input: 'answer_questions', awaiting_confirmation: 'ask_sede_date_time', order_created: 'book_slot' };
  return {
    has_intake: true,
    status,
    next_step: questions.length ? 'answer_questions' : (NEXT[status] || 'none'),
    order_number: orderNumber || null,
    patient: v.patient ? { name: v.patient.name, document: v.patient.document, will_be_registered: v.patient.status === 'register' } : null,
    studies: r ? r.items.map((i) => ({ name: i.service_name, duration_minutes: i.duration_minutes })) : [],
    total_duration_minutes: r ? r.total_duration_minutes : null,
    referring_doctor_as_written: r ? r.referring_doctor_name : null,
    questions,
    already_has_open_order: v.duplicate_of ? v.duplicate_of.order_number : null,
    warnings: (v.warnings || []).map((w) => w.code),
  };
}`;

const WEEKDAYS = `const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const weekday = (date) => WEEKDAYS[new Date(date + 'T12:00:00Z').getUTCDay()];`;

// =============================================================================
// 1. order-get-intake
// =============================================================================
startFlow('1 · agent-tools/order-get-intake');
webhook('GetIntake: Webhook', 'agent-tools/order-get-intake');
code('GetIntake: Parse', `${PARSE_PHONE}
return [{ json: { phone } }];`, 1);
gate('GetIntake: Phone OK?', 2);
pg('GetIntake: Load', LOAD_INTAKE, '={{ [ $json.phone ] }}', 3);
code('GetIntake: Format', `${SUMMARIZE}
const row = $input.first().json || {};
if (!row.id) return [{ json: { has_intake: false, message: 'No hay una orden de estudio en curso para este número.' } }];
return [{ json: summarize(row.validation, row.status, row.order_number) }];`, 4);
respond('GetIntake: Respond', RESPOND_JSON, 5);
respond('GetIntake: Respond Fail', RESPOND_FAIL, 3);
link('GetIntake: Webhook', 'GetIntake: Parse');
link('GetIntake: Parse', 'GetIntake: Phone OK?');
link('GetIntake: Phone OK?', 'GetIntake: Load', 0);
link('GetIntake: Phone OK?', 'GetIntake: Respond Fail', 1);
link('GetIntake: Load', 'GetIntake: Format');
link('GetIntake: Format', 'GetIntake: Respond');

// =============================================================================
// 2. order-answer
// =============================================================================
startFlow('2 · agent-tools/order-answer');
webhook('Answer: Webhook', 'agent-tools/order-answer');
code('Answer: Parse', `${PARSE_PHONE}
const n = parseInt(b.question_number, 10);
const answer = String(b.answer || '').trim().slice(0, 200);
if (!Number.isFinite(n) || n < 1) return [{ json: { __fail: { error_code: 'bad_question', message: 'Falta el número de la pregunta que se está respondiendo.' } } }];
if (!answer) return [{ json: { __fail: { error_code: 'empty_answer', message: 'Falta la respuesta del usuario.' } } }];
return [{ json: { phone, n, answer } }];`, 1);
gate('Answer: Input OK?', 2);
pg('Answer: Load', LOAD_INTAKE, '={{ [ $json.phone ] }}', 3);
code('Answer: Build Answers', `// Traduce la respuesta del usuario a lo que entiende el validador. Las preguntas se identifican por
// su número; el modelo nunca maneja ids de servicio.
const inp = $('Answer: Parse').first().json;
const row = $input.first().json || {};
if (!row.id) return [{ json: { __fail: { error_code: 'no_intake', message: 'No hay una orden en curso.' } } }];
const q = ((row.validation && row.validation.questions) || [])[inp.n - 1];
if (!q) return [{ json: { __fail: { error_code: 'bad_question', message: 'Esa pregunta no existe: llamá a get_order_intake.' } } }];
const a = inp.answer;
// Sin \b: en JavaScript la "í" de "sí" no es carácter de palabra y no marcaría el límite.
const yes = /^\\s*(s[ií]|sip|claro|correcto|exacto|as[ií] es|ok|dale|confirmo|esta bien|está bien)(?![a-záéíóúñ])/i.test(a);
const no = /^\\s*(no|nop|incorrecto|no es|no est[aá])(?![a-záéíóúñ])/i.test(a);
// "Ya está", "esas son", "no tengo otra", "ya te la mandé": no tiene nada más para mandar.
const noMore = /(^|[^a-záéíóúñ])(no (la |lo |las |los )?(tengo|tiene|hay)|ya est[aá]|es todo|esas? son|son esas?|ya (te )?(la |las |lo |los )?(mand[eé]|envi[eé])|ya tiene todo|est[aá] complet[ao]|complet[ao]|s[oó]lo (esa|esas|eso|una)|una sola|no se puede|no puedo|mejor no)(?![a-záéíóúñ])/i.test(a);
// "Ahora te la mando", "ahí va": todavía va a mandar el archivo.
const willSend = /((te )?(la|las|lo|los) )?(mando|env[ií]o|paso|saco)(?![a-záéíóúñ])|ah[ií] va|un momento|esper[aá]/i.test(a) && !noMore;
const answers = { confirmed: [], removed: [], overrides: {} };
switch (q.code) {
  case 'confirm_line':
    if (yes) answers.confirmed.push(q.external_id);
    else if (no) answers.removed.push(q.external_id);
    else return [{ json: { __fail: { error_code: 'need_yes_no', message: 'Respondé sí o no: ¿ese estudio está en la orden?' } } }];
    break;
  case 'missing_patient_document':
  case 'invalid_patient_document':
    answers.overrides.patient_document = a;
    break;
  case 'missing_patient_name':
    answers.overrides.patient_name = a;
    break;
  case 'missing_other_side':
    // Si la orden tiene otra cara, la respuesta es la foto. Solo se espera la foto cuando dice que
    // la va a mandar; cualquier otra respuesta en texto ("no", "ya está", "esas son", algo que no se
    // entiende) cuenta como que no hay otra cara y se sigue con la advertencia: nunca se repregunta.
    if ((yes || willSend) && !no && !noMore) {
      return [{ json: { __fail: { error_code: 'send_other_side', message: 'Pedile que mande la otra cara por este chat como foto o PDF. Si después dice que no tiene, llamá de nuevo con su respuesta.' } } }];
    }
    answers.overrides.no_other_side = true;
    break;
  case 'resend':
    // Se le pidió reenviar la orden y contestó con texto. Si dice que la va a mandar, se espera la
    // foto. Si dice que eso es todo lo que tiene ("ya está", "esas son", "no tengo otra"), no hay
    // nada más que pedirle: se revalida con no_better_file y el validador deriva a una persona.
    if ((yes || willSend) && !no && !noMore) {
      return [{ json: { __fail: { error_code: 'send_file', message: 'Pedile que mande la foto o el PDF por este chat. Si después dice que no tiene otra, llamá de nuevo con su respuesta: no le vuelvas a pedir la foto.' } } }];
    }
    answers.overrides.no_better_file = true;
    break;
  case 'confirm_patient':
    if (!yes) return [{ json: { __fail: { error_code: 'needs_human', message: 'El usuario no confirma sus datos: derivá a recepción con handoff_order.' } } }];
    break;
  default:
    return [{ json: { __fail: { error_code: 'not_answerable', message: 'Esa pregunta se resuelve enviando de nuevo la foto o el PDF de la orden.' } } }];
}
return [{ json: { intake_id: row.id, phone: inp.phone, answers: JSON.stringify(answers) } }];`, 4);
gate('Answer: Mapped OK?', 5);
add('Answer: Run Intake Subflow', 'n8n-nodes-base.executeWorkflow', 1.3, {
    workflowId: INTAKE_WF,
    workflowInputs: {
        mappingMode: 'defineBelow',
        value: { intake_id: '={{ $json.intake_id }}', mode: 'revalidate', answers: '={{ $json.answers }}' },
        matchingColumns: [],
        schema: ['intake_id', 'mode', 'answers'].map((id) => ({ id, displayName: id, required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string', removed: false })),
        attemptToConvertTypes: false, convertFieldsToString: true,
    },
    options: {},
}, 6);
code('Answer: Format', `${SUMMARIZE}
const phone = $('Answer: Parse').first().json.phone;
const r = $input.first().json || {};
if (r.outcome === 'handoff') {
  return [{ json: { outcome: 'handoff', phone, intake_id: $('Answer: Build Answers').first().json.intake_id,
    reason_code: r.handoff_reason, detail: r.handoff_detail || '' } }];
}
const v = { questions: r.questions, resolved: r.resolved, patient: r.patient, warnings: r.warnings, duplicate_of: r.duplicate_of };
return [{ json: { outcome: r.outcome, phone, summary: summarize(v, r.status, null) } }];`, 7);
ifExpr('Answer: Handoff?', '={{ $json.outcome === \'handoff\' }}', 8);
http('Answer: Call Handoff', '/webhook/agent-tools/order-handoff',
    '={{ JSON.stringify({ phone: $json.phone, intake_id: $json.intake_id, reason_code: $json.reason_code, detail: $json.detail }) }}', AGENT_KEY, 9);
code('Answer: Handoff Result', `return [{ json: { ok: true, outcome: 'handoff', message: 'La orden pasa a revisión de una persona del equipo. Avisale al usuario y no sigas con la orden.' } }];`, 10);
respond('Answer: Respond', '={{ JSON.stringify({ ok: true, ...$json.summary, outcome: $json.outcome }) }}', 9);
respond('Answer: Respond Handoff', RESPOND_JSON, 11);
respond('Answer: Respond Fail', RESPOND_FAIL, 3);
link('Answer: Webhook', 'Answer: Parse');
link('Answer: Parse', 'Answer: Input OK?');
link('Answer: Input OK?', 'Answer: Load', 0);
link('Answer: Input OK?', 'Answer: Respond Fail', 1);
link('Answer: Load', 'Answer: Build Answers');
link('Answer: Build Answers', 'Answer: Mapped OK?');
link('Answer: Mapped OK?', 'Answer: Run Intake Subflow', 0);
link('Answer: Mapped OK?', 'Answer: Respond Fail', 1);
link('Answer: Run Intake Subflow', 'Answer: Format');
link('Answer: Format', 'Answer: Handoff?');
link('Answer: Handoff?', 'Answer: Call Handoff', 0);
link('Answer: Handoff?', 'Answer: Respond', 1);
link('Answer: Call Handoff', 'Answer: Handoff Result');
link('Answer: Handoff Result', 'Answer: Respond Handoff');

// =============================================================================
// 3. order-list-sedes
// =============================================================================
startFlow('3 · agent-tools/order-list-sedes');
webhook('Sedes: Webhook', 'agent-tools/order-list-sedes');
code('Sedes: Parse', `${PARSE_PHONE}
return [{ json: { phone } }];`, 1);
gate('Sedes: Phone OK?', 2);
pg('Sedes: Load', `-- $1 = teléfono. Orden en curso + sedes con horario de atención y calendarios activos
-- (y elegibles: system_configurations.whatsapp_orders_calendar_ids, vacío = todos).
WITH cfg AS (
  SELECT COALESCE((SELECT value FROM system_configurations WHERE key = 'whatsapp_orders_calendar_ids'), '') AS ids
),
intake AS (
  SELECT i.id::text AS id, i.status, i.validation
    FROM whatsapp_order_intakes i
   WHERE i.phone = $1 AND i.status IN ('awaiting_confirmation', 'order_created') AND i.expires_at > now()
   ORDER BY i.created_at DESC LIMIT 1
)
SELECT (SELECT id FROM intake) AS intake_id,
       (SELECT status FROM intake) AS status,
       (SELECT (validation -> 'resolved' ->> 'total_duration_minutes')::int FROM intake) AS duration,
       (SELECT coalesce(json_agg(json_build_object('id', s.id, 'name', s.name, 'address', s.address) ORDER BY s.id), '[]'::json)
          FROM sedes s
         WHERE s.is_active
           AND EXISTS (SELECT 1 FROM clinic_schedules cs WHERE cs.sede_id = s.id)
           AND EXISTS (SELECT 1 FROM calendar_sources c, cfg
                        WHERE c.sede_id = s.id AND c.is_active
                          AND (cfg.ids = '' OR c.id = ANY (string_to_array(cfg.ids, ',')::bigint[])))) AS sedes;`,
    '={{ [ $json.phone ] }}', 3);
code('Sedes: Number', `const row = $input.first().json || {};
if (!row.intake_id) return [{ json: { __fail: { error_code: 'not_ready', message: 'No hay una orden lista para agendar (primero hay que resolver las preguntas pendientes de get_order_intake).' } } }];
const sedes = (row.sedes || []).map((s, i) => ({ n: i + 1, id: s.id, name: s.name, address: s.address || null }));
if (sedes.length === 0) return [{ json: { __fail: { error_code: 'no_sedes', message: 'No hay sedes con agenda disponible para órdenes.' } } }];
return [{ json: { intake_id: row.intake_id, sedes, duration: row.duration } }];`, 4);
gate('Sedes: Ready?', 5);
pg('Sedes: Save Offered', `-- Guarda la lista ofrecida: "la 2" se resuelve contra esto, no contra ids que maneje el modelo.
UPDATE whatsapp_order_intakes
   SET slots_offered = jsonb_build_object('sedes', $2::jsonb, 'slots', '[]'::jsonb, 'chosen_sede_id', NULL)
 WHERE id = $1::uuid
RETURNING id::text AS id;`,
    '={{ [ $json.intake_id, JSON.stringify($json.sedes) ] }}', 6);
code('Sedes: Format', `const r = $('Sedes: Number').first().json;
return [{ json: { ok: true, total_duration_minutes: r.duration,
  sedes: r.sedes.map((s) => ({ number: s.n, name: s.name, address: s.address })),
  hint: 'Mostrale las sedes numeradas con su dirección. Que elija la que quiera o la que le quede más cerca; después llamá a list_order_slots.' } }];`, 7);
respond('Sedes: Respond', RESPOND_JSON, 8);
respond('Sedes: Respond Fail', RESPOND_FAIL, 3);
link('Sedes: Webhook', 'Sedes: Parse');
link('Sedes: Parse', 'Sedes: Phone OK?');
link('Sedes: Phone OK?', 'Sedes: Load', 0);
link('Sedes: Phone OK?', 'Sedes: Respond Fail', 1);
link('Sedes: Load', 'Sedes: Number');
link('Sedes: Number', 'Sedes: Ready?');
link('Sedes: Ready?', 'Sedes: Save Offered', 0);
link('Sedes: Ready?', 'Sedes: Respond Fail', 1);
link('Sedes: Save Offered', 'Sedes: Format');
link('Sedes: Format', 'Sedes: Respond');

// =============================================================================
// 4. order-list-slots
// =============================================================================
startFlow('4 · agent-tools/order-list-slots');
webhook('Slots: Webhook', 'agent-tools/order-list-slots');
code('Slots: Parse', `${PARSE_PHONE}
const n = parseInt(b.sede_number, 10);
if (!Number.isFinite(n) || n < 1) return [{ json: { __fail: { error_code: 'bad_sede', message: 'Falta el número de la sede elegida (list_order_sedes).' } } }];
const date = String(b.desired_date || '').trim();
const time = String(b.desired_time || '').trim();
if (date && !/^\\d{4}-\\d{2}-\\d{2}$/.test(date)) return [{ json: { __fail: { error_code: 'bad_date', message: 'La fecha debe ser AAAA-MM-DD.' } } }];
if (time && !/^\\d{2}:\\d{2}$/.test(time)) return [{ json: { __fail: { error_code: 'bad_time', message: 'La hora debe ser HH:mm.' } } }];
return [{ json: { phone, n, date: date || null, time: time || null } }];`, 1);
gate('Slots: Input OK?', 2);
pg('Slots: Load Intake', LOAD_INTAKE, '={{ [ $json.phone ] }}', 3);
code('Slots: Resolve Sede', `const inp = $('Slots: Parse').first().json;
const row = $input.first().json || {};
if (!row.id || !['awaiting_confirmation', 'order_created'].includes(row.status)) {
  return [{ json: { __fail: { error_code: 'not_ready', message: 'No hay una orden lista para agendar.' } } }];
}
const sede = ((row.slots_offered && row.slots_offered.sedes) || []).find((s) => s.n === inp.n);
if (!sede) return [{ json: { __fail: { error_code: 'bad_sede', message: 'Esa sede no está en la lista ofrecida: llamá a list_order_sedes.' } } }];
const duration = Number(row.validation && row.validation.resolved && row.validation.resolved.total_duration_minutes);
if (!duration) return [{ json: { __fail: { error_code: 'no_duration', message: 'La orden no tiene duración calculada.' } } }];
return [{ json: { intake_id: row.id, sede, duration, date: inp.date, time: inp.time } }];`, 4);
gate('Slots: Sede OK?', 5);
pg('Slots: Load Calendar Data', `-- $1 = sede. Horario de atención, calendarios elegibles y citas vigentes (16 días).
-- Las horas van como texto en hora de pared de Montevideo, sin zona.
WITH cfg AS (
  SELECT COALESCE((SELECT value FROM system_configurations WHERE key = 'whatsapp_orders_calendar_ids'), '') AS ids
),
cals AS (
  SELECT c.id FROM calendar_sources c, cfg
   WHERE c.sede_id = $1::int AND c.is_active
     AND (cfg.ids = '' OR c.id = ANY (string_to_array(cfg.ids, ',')::bigint[]))
),
nowl AS (SELECT (now() AT TIME ZONE 'America/Montevideo') AS t)
SELECT to_char((SELECT t FROM nowl), 'YYYY-MM-DD"T"HH24:MI:SS') AS now_local,
       (SELECT coalesce(json_agg(json_build_object('day_of_week', cs.day_of_week,
                'start_time', to_char(cs.start_time, 'HH24:MI'), 'end_time', to_char(cs.end_time, 'HH24:MI'))), '[]'::json)
          FROM clinic_schedules cs WHERE cs.sede_id = $1::int) AS schedules,
       (SELECT coalesce(json_agg(json_build_object('id', id)), '[]'::json) FROM cals) AS calendars,
       (SELECT coalesce(json_agg(json_build_object('calendar_source_id', a.calendar_source_id,
                'start', to_char(a.start_datetime, 'YYYY-MM-DD"T"HH24:MI:SS'),
                'end', to_char(a.end_datetime, 'YYYY-MM-DD"T"HH24:MI:SS'))), '[]'::json)
          FROM appointments a
         WHERE a.calendar_source_id IN (SELECT id FROM cals)
           AND a.end_datetime > (SELECT t FROM nowl)
           AND a.start_datetime < (SELECT t FROM nowl) + interval '16 days'
           AND a.status NOT IN ('canceled', 'cancelled', 'deleted')) AS appointments;`,
    '={{ [ $json.sede.id ] }}', 6);
code('Slots: Compute', `${SLOTS_LIB}

${WEEKDAYS}
const ctx = $('Slots: Resolve Sede').first().json;
const d = $input.first().json || {};
const all = computeSlots({
  now: d.now_local, schedules: d.schedules || [], calendars: d.calendars || [],
  appointments: d.appointments || [], durationMinutes: ctx.duration, leadHours: 4, horizonDays: 14,
});
const picked = pickSlots(all, { desiredDate: ctx.date, desiredTime: ctx.time, limit: 6 })
  .map((s, i) => ({ n: i + 1, ...s }));
return [{ json: { intake_id: ctx.intake_id, sede: ctx.sede, duration: ctx.duration, slots: picked,
  shown: picked.map((s) => ({ number: s.n, date: s.date, weekday: weekday(s.date), time: s.time })) } }];`, 7);
pg('Slots: Save Offered', `UPDATE whatsapp_order_intakes
   SET chosen_sede_id = $2::int,
       slots_offered = coalesce(slots_offered, '{}'::jsonb)
                       || jsonb_build_object('slots', $3::jsonb, 'chosen_sede_id', $2::int)
 WHERE id = $1::uuid
RETURNING id::text AS id;`,
    '={{ [ $json.intake_id, $json.sede.id, JSON.stringify($json.slots) ] }}', 8);
code('Slots: Format', `const r = $('Slots: Compute').first().json;
if (r.slots.length === 0) {
  return [{ json: { ok: true, sede: r.sede.name, slots: [], hint: 'No hay horarios libres en esta sede en los próximos 14 días para la duración de la orden. Ofrecele otra sede o derivá a una persona.' } }];
}
return [{ json: { ok: true, sede: r.sede.name, sede_address: r.sede.address, duration_minutes: r.duration, slots: r.shown,
  hint: 'Mostrale los horarios numerados. Cuando elija uno, llamá a confirm_order_and_book con su número.' } }];`, 9);
respond('Slots: Respond', RESPOND_JSON, 10);
respond('Slots: Respond Fail', RESPOND_FAIL, 3);
link('Slots: Webhook', 'Slots: Parse');
link('Slots: Parse', 'Slots: Input OK?');
link('Slots: Input OK?', 'Slots: Load Intake', 0);
link('Slots: Input OK?', 'Slots: Respond Fail', 1);
link('Slots: Load Intake', 'Slots: Resolve Sede');
link('Slots: Resolve Sede', 'Slots: Sede OK?');
link('Slots: Sede OK?', 'Slots: Load Calendar Data', 0);
link('Slots: Sede OK?', 'Slots: Respond Fail', 1);
link('Slots: Load Calendar Data', 'Slots: Compute');
link('Slots: Compute', 'Slots: Save Offered');
link('Slots: Save Offered', 'Slots: Format');
link('Slots: Format', 'Slots: Respond');

// =============================================================================
// 5. order-confirm-and-book
// =============================================================================
startFlow('5 · agent-tools/order-confirm-and-book');
webhook('Book: Webhook', 'agent-tools/order-confirm-and-book');
code('Book: Parse', `${PARSE_PHONE}
const n = parseInt(b.slot_number, 10);
if (!Number.isFinite(n) || n < 1) return [{ json: { __fail: { error_code: 'bad_slot', message: 'Falta el número del horario elegido (list_order_slots).' } } }];
return [{ json: { phone, n } }];`, 1);
gate('Book: Input OK?', 2);
const BOOK_LOAD = LOAD_INTAKE
    .replace('-- $1 = teléfono. La orden en curso de ese número (una sola por teléfono).',
        `-- $1 = teléfono. Estado para reservar y el usuario de servicio "Agente WhatsApp" (migración 122),
-- que es el actor con el que se crea, envía y agenda la orden.`)
    .replace('       i.chosen_sede_id, i.booking_attempts,\n',
        `       i.chosen_sede_id, i.booking_attempts,
       (SELECT min(u.id::text) FROM users u
         WHERE u.email = '${AGENT_EMAIL}' AND u.is_active IS NOT FALSE) AS agent_user_id,\n`);
if (!BOOK_LOAD.includes('agent_user_id')) throw new Error('BOOK_LOAD: no se pudo agregar agent_user_id');
pg('Book: Load', BOOK_LOAD, '={{ [ $json.phone ] }}', 3);
code('Book: Check State', `const inp = $('Book: Parse').first().json;
const row = $input.first().json || {};
const fail = (error_code, message, bump = false) => [{ json: { __fail: { error_code, message, bump } } }];
if (!row.id) return fail('no_intake', 'No hay una orden en curso.');
if (!['awaiting_confirmation', 'order_created'].includes(row.status)) return fail('not_ready', 'La orden todavía tiene preguntas pendientes (get_order_intake).');
if ((row.booking_attempts || 0) >= 2) return fail('too_many_failures', 'Ya falló dos veces: derivá a una persona con handoff_order (motivo booking_failed).');
// Sin el usuario de servicio no hay con quién crear la orden. Es configuración, no algo del usuario.
if (!row.agent_user_id) return fail('agent_user_missing', 'Falta el usuario de servicio "Agente WhatsApp" (migración 122). No es un problema del usuario: derivá a una persona con handoff_order (motivo system_error).');
const v = row.validation || {};
if (!v.resolved || !v.patient) return fail('not_ready', 'La orden no está validada.');
const slot = ((row.slots_offered && row.slots_offered.slots) || []).find((s) => s.n === inp.n);
if (!slot) return fail('bad_slot', 'Ese horario no está en la lista ofrecida: llamá a list_order_slots de nuevo.');
const sede = ((row.slots_offered && row.slots_offered.sedes) || []).find((s) => s.id === row.slots_offered.chosen_sede_id);
const p = v.patient;
// Tipo de documento: cédula uruguaya si el dígito verificador cierra; pasaporte; si no, cédula extranjera.
const doc = String(p.document || '');
function uy(d) {
  if (!/^\\d{7,8}$/.test(d)) return false;
  const body = d.slice(0, -1).padStart(7, '0'); const w = [2, 9, 8, 7, 6, 3, 4];
  return (10 - (body.split('').reduce((a, c, i) => a + Number(c) * w[i], 0) % 10)) % 10 === Number(d.slice(-1));
}
const docType = p.document_type === 'passport' ? 'pasaporte_ext' : (uy(doc) ? 'cedula_uy' : 'cedula_ext');
return [{ json: {
  intake_id: row.id, phone: row.phone, study_order_id: row.study_order_id || '', order_number: row.order_number || null,
  agent_user_id: row.agent_user_id,
  patient: { ...p, document_type: docType }, resolved: v.resolved, slot, sede: sede || null,
} }];`, 4);
gate('Book: State OK?', 5);
pg('Book: Ensure Patient', `-- Idempotente: si el paciente ya existe no inserta; si hay que asociarle el teléfono o la cédula, se hace
-- sólo donde estaban vacíos. $1 tipo, $2 id, $3 nombre, $4 teléfono, $5 cédula, $6 tipo de documento,
-- $7 asociar teléfono, $8 guardar cédula.
WITH input AS (
  SELECT $1::text AS kind, NULLIF($2, '')::uuid AS pid, $3::text AS name, $4::text AS phone,
         NULLIF($5, '') AS doc, $6::text AS doc_type, $7::boolean AS attach_phone, $8::boolean AS set_doc
),
ins AS (
  INSERT INTO users (name, phone_number, identity_document, identity_document_type, is_active)
  SELECT name, phone, doc, doc_type, true FROM input WHERE kind = 'register' AND pid IS NULL
  RETURNING id
),
role AS (
  INSERT INTO user_roles (user_id, role_id)
  SELECT ins.id, r.id FROM ins, roles r WHERE r.name = 'paciente'
  ON CONFLICT (user_id, role_id) DO NOTHING
  RETURNING user_id
),
upd AS (
  UPDATE users u
     SET phone_number = COALESCE(NULLIF(u.phone_number, ''), i.phone),
         identity_document = CASE WHEN i.set_doc THEN COALESCE(NULLIF(u.identity_document, ''), i.doc) ELSE u.identity_document END
    FROM input i
   WHERE u.id = i.pid AND (i.attach_phone OR i.set_doc)
  RETURNING u.id
)
SELECT COALESCE((SELECT pid FROM input), (SELECT id FROM ins))::text AS patient_id,
       (SELECT count(*) FROM role) AS role_rows,
       (SELECT count(*) FROM upd) AS updated;`,
    `={{ [ $json.patient.status, $json.patient.patient_id || '', $json.patient.name, $json.phone, $json.patient.document || '', $json.patient.document_type, !!$json.patient.attach_phone, !!$json.patient.set_document ] }}`, 6);
code('Book: Patient Ready', `const ctx = $('Book: Check State').first().json;
const r = $input.first().json || {};
if (!r.patient_id) return [{ json: { __fail: { error_code: 'patient_error', message: 'No se pudo registrar al paciente.', bump: true } } }];
return [{ json: { ...ctx, patient_id: r.patient_id } }];`, 7);
gate('Book: Patient OK?', 8);
ifExpr('Book: Order Exists?', `={{ !!$json.study_order_id }}`, 9);
code('Book: Build Order Payload', `// Mismo payload y mismas validaciones que "Validar Datos" de POST /study-orders/upsert: el SQL
// (UPSERT_SQL) es el mismo, así que tiene que recibir lo mismo.
const c = $input.first().json;
const r = c.resolved || {};
const str = (v) => (v ?? '').toString().trim();
const fail = (message) => [{ json: { __fail: { error_code: 'order_create_failed', message, bump: true } } }];
const name = str(c.patient && c.patient.name);
if (!name) return fail('No se pudo crear la orden: falta el nombre del paciente.');
const items = Array.isArray(r.items) ? r.items : [];
if (items.length === 0) return fail('No se pudo crear la orden: no tiene estudios.');
if (items.some((i) => !i.service_id || !i.section_code)) return fail('No se pudo crear la orden: hay un estudio sin servicio o sección.');
const payload = {
  id: '',
  doctor_id: '',
  // La orden de WhatsApp no se vincula a ningún doctor: el del papel queda como texto.
  without_doctor: true,
  source: 'whatsapp',
  referring_doctor_name: str(r.referring_doctor_name),
  source_intake_id: str(c.intake_id),
  patient_id: str(c.patient_id),
  patient_name: name,
  patient_document: str(c.patient.document),
  patient_email: '',
  patient_phone: str(c.phone),
  regions: r.regions ?? {},
  section_modifiers: r.section_modifiers ?? {},
  texts: r.texts ?? {},
  delivery_methods: r.delivery_methods ?? [],
  clinical_notes: (r.clinical_notes ?? '').toString(),
  preferred_sede_id: c.sede ? str(c.sede.id) : '',
  items: items.map((i) => ({
    service_id: str(i.service_id), service_name: str(i.service_name), section_code: str(i.section_code),
    sort_order: Number(i.sort_order) || 0, quantity: 1, modifiers: i.modifiers ?? {}, notes: str(i.notes),
  })),
};
return [{ json: { ...c, order_payload: JSON.stringify(payload) } }];`, 10);
// $1 = el usuario de servicio: el SQL decide con sus permisos (CREATE_FOR_DOCTOR habilita without_doctor y source).
pg('Book: Upsert Order', UPSERT_SQL, '={{ [ $json.agent_user_id, $json.order_payload ] }}', 11, SAFE);
code('Book: Check Upsert', `const c = $('Book: Build Order Payload').first().json;
const r = $input.first().json || {};
// Sin id: error de SQL o el rol agente_ia no alcanza para crear la orden.
if (!r.id) return [{ json: { __fail: { error_code: 'order_create_failed', message: 'No se pudo crear la orden' + (r.error ? ' (' + String(r.error.message || r.error).slice(0, 200) + ')' : '') + '.', bump: true } } }];
return [{ json: { ...c, new_order_id: r.id } }];`, 12);
gate('Book: Upsert OK?', 13);
pg('Book: Submit Order', SUBMIT_SQL, '={{ [ $json.agent_user_id, $json.new_order_id ] }}', 14, SAFE);
code('Book: Check Submit', `const c = $('Book: Check Upsert').first().json;
const r = $input.first().json || {};
if (!r.id) return [{ json: { __fail: { error_code: 'order_submit_failed', message: 'No se pudo enviar la orden a la clínica' + (r.error ? ' (' + String(r.error.message || r.error).slice(0, 200) + ')' : '') + '.', bump: true } } }];
return [{ json: { ...c, order_number: r.order_number || c.order_number } }];`, 15);
gate('Book: Submit OK?', 16);

// Lo que hacen /upsert y /submit después de responder: bitácora ('created', 'submitted') y aviso a
// recepción con su push por SSE. Va en una rama aparte, más ARRIBA que la principal: en n8n (orden
// v1) las ramas corren de arriba hacia abajo, así la bitácora queda en orden (creada, enviada,
// agendada) y el aviso sale aunque después falle la reserva.
code('Book: New Order Events', `const c = $('Book: Check Submit').first().json;
return ['created', 'submitted'].map((event_type) => ({ json: {
  payload: JSON.stringify({ order_id: c.new_order_id, event_type, actor_id: c.agent_user_id }),
} }));`, 17);
pgSide('Book: Log New Order', LOG_EVENT_SQL, '={{ [ $json.payload ] }}', 18);
pgSide('Book: Notify New Order', NOTIFY_RECEPTION_SQL,
    `={{ [ $('Book: Check Submit').first().json.new_order_id, '', $('Book: Check Submit').first().json.agent_user_id ] }}`, 18,
    { executeOnce: true });
// Sin destinatarios, Postgres igual emite un ítem vacío: sin este filtro el push iría con user_ids [null].
ifExpr('Book: New Order Recipient?', '={{ !!$json.user_id }}', 19);
ssePush('Book: Push New Order', 'study_order_submitted', 20);
// Lo que el agente no tuvo claro al leer la orden queda registrado en la orden enviada, como lista de
// verificación para recepción: NO bloqueante (la orden ya salió y la cita sigue su curso).
pgSide('Book: Save Review Items', REVIEW_ITEMS_INSERT_SQL,
    `={{ [ $('Book: Check Submit').first().json.new_order_id, JSON.stringify((($('Book: Load').first().json.validation) || {}).review_items || []), 'false' ] }}`, 17,
    { executeOnce: true });

pg('Book: Save Order', `UPDATE whatsapp_order_intakes
   SET study_order_id = $2::uuid, patient_id = $3::uuid, status = 'order_created', chosen_sede_id = $4::int
 WHERE id = $1::uuid
RETURNING study_order_id::text AS study_order_id,
          (SELECT order_number FROM study_orders WHERE id = $2::uuid) AS order_number;`,
    `={{ [ $json.intake_id, $json.new_order_id, $json.patient_id, $json.sede ? $json.sede.id : null ] }}`, 17);
code('Book: Order Ready', `// Une las dos ramas (orden nueva / orden ya creada en un intento anterior).
let ctx;
try { ctx = $('Book: Check Submit').first().json; } catch (e) { ctx = null; }
const saved = $input.first().json || {};
if (ctx && ctx.new_order_id) {
  return [{ json: { ...ctx, study_order_id: ctx.new_order_id, order_number: saved.order_number || ctx.order_number } }];
}
return [{ json: $('Book: Patient Ready').first().json }];`, 18);
pg('Book: Recheck Slot', `-- Justo antes de reservar: el horario sigue libre y sigue siendo futuro.
-- (PUBLIC_BOOK_SQL también lo valida, pero no elimina la carrera: ver docs, Fase 0.)
SELECT NOT EXISTS (
         SELECT 1 FROM appointments a
          WHERE a.calendar_source_id = $1::bigint
            AND a.start_datetime < $3::timestamp AND a.end_datetime > $2::timestamp
            AND a.status NOT IN ('canceled', 'cancelled', 'deleted')) AS free;`,
    `={{ [ $json.slot.calendar_source_id, $json.slot.start, $json.slot.end ] }}`, 19);
code('Book: Check Slot', `const c = $('Book: Order Ready').first().json;
const r = $input.first().json || {};
if (r.free !== true) return [{ json: { __fail: { error_code: 'slot_taken', message: 'Ese horario se ocupó justo antes de confirmarlo. Llamá a list_order_slots y ofrecele otros (la orden ya está creada, no se duplica).', bump: false } } }];
return [{ json: c }];`, 20);
gate('Book: Slot Free?', 21);
code('Book: Make Token', `// La reserva usa el SQL del link público (PUBLIC_BOOK_SQL): superposición, estudios de la cita y
// bloqueo del token en una sola sentencia. Para eso se genera un token de UN uso (BOOKING_TOKEN_SQL,
// como /study-orders/booking-token) y se gasta en el acto. El token en claro no sale de esta ejecución.
const crypto = require('crypto');
const c = $input.first().json;
const clear = crypto.randomBytes(32).toString('base64url');
const hash = crypto.createHash('sha256').update(clear).digest('hex');
// Hora de pared de la clínica: expires_at no lleva zona y el SQL la compara contra la hora de Montevideo.
const expiresAt = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'America/Montevideo', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
}).format(new Date(Date.now() + 2 * 86400000));
return [{ json: {
  ...c,
  token_hash: hash,
  token_payload: JSON.stringify({ order_id: c.study_order_id, token_hash: hash, expires_at: expiresAt, max_uses: 1 }),
  book_payload: JSON.stringify({ calendar_source_id: String(c.slot.calendar_source_id), start: c.slot.start, end: c.slot.end, summary: 'Estudios' }),
} }];`, 22);
pg('Book: Booking Token', BOOKING_TOKEN_SQL, '={{ [ $json.agent_user_id, $json.token_payload ] }}', 23, SAFE);
code('Book: Check Token', `const c = $('Book: Make Token').first().json;
const r = $input.first().json || {};
// Sin fila: la orden no está enviada, no tiene paciente o el rol agente_ia no tiene STUDY_ORDERS_SCHEDULE.
if (!r.id) return [{ json: { __fail: { error_code: 'token_failed', message: 'No se pudo preparar la reserva' + (r.error ? ' (' + String(r.error.message || r.error).slice(0, 200) + ')' : '') + '.', bump: true } } }];
return [{ json: c }];`, 24);
gate('Book: Token OK?', 25);
pg('Book: Public Book', PUBLIC_BOOK_SQL, '={{ [ $json.token_hash, $json.book_payload ] }}', 26, SAFE);
code('Book: Check Booking', `const c = $('Book: Check Token').first().json;
const r = $input.first().json || {};
if (!r.appointment_id) return [{ json: { __fail: { error_code: 'booking_failed', message: 'No se pudo reservar: el horario ya no está disponible. Probá con otro horario.', bump: true } } }];
return [{ json: { ...c, appointment_id: r.appointment_id, order_number: r.order_number || c.order_number } }];`, 27);
gate('Book: Booked OK?', 28);

// Lo que hace /public-book después de responder: bitácora y aviso a recepción ("el paciente agendó").
// La bitácora usa 'scheduled' con el usuario de servicio como actor: agendó el agente, no el paciente.
// No se avisa al derivador: las órdenes de WhatsApp no tienen doctor.
code('Book: Booking Events', `const c = $('Book: Check Booking').first().json;
return [{ json: { payload: JSON.stringify({
  order_id: c.study_order_id, event_type: 'scheduled', actor_id: c.agent_user_id,
  appointment_id: String(c.appointment_id), metadata: { channel: 'whatsapp' },
}) } }];`, 29);
pgSide('Book: Log Booking', LOG_EVENT_SQL, '={{ [ $json.payload ] }}', 30);
pgSide('Book: Notify Booking', NOTIFY_RECEPTION_SQL,
    `={{ [ $('Book: Check Booking').first().json.study_order_id, 'patient_booked', '' ] }}`, 30);
ifExpr('Book: Booking Recipient?', '={{ !!$json.user_id }}', 31);
ssePush('Book: Push Booking', 'study_order_submitted', 32);

pg('Book: Save Booking', `UPDATE whatsapp_order_intakes
   SET status = 'booked', appointment_id = $2::int, booking_attempts = 0
 WHERE id = $1::uuid
RETURNING id::text AS id;`, `={{ [ $json.intake_id, $json.appointment_id ] }}`, 29);
code('Book: Format', `${WEEKDAYS}
const c = $('Book: Check Booking').first().json;
return [{ json: { ok: true, booked: true, order_number: c.order_number,
  date: c.slot.date, weekday: weekday(c.slot.date), time: c.slot.time, duration_minutes: c.resolved.total_duration_minutes,
  sede: c.sede ? c.sede.name : null, sede_address: c.sede ? c.sede.address : null,
  studies: c.resolved.items.map((i) => i.service_name),
  hint: 'Confirmale al usuario el número de orden, los estudios, el día, la hora y la sede con su dirección.' } }];`, 30);
respond('Book: Respond', RESPOND_JSON, 31);

// Ramas de bitácora y avisos: una fila más arriba que el camino principal (corren primero, ver arriba).
const SIDE = ['Book: New Order Events', 'Book: Log New Order', 'Book: Notify New Order', 'Book: New Order Recipient?', 'Book: Push New Order',
    'Book: Booking Events', 'Book: Log Booking', 'Book: Notify Booking', 'Book: Booking Recipient?', 'Book: Push Booking'];
for (const n of nodes) {
    if (!SIDE.includes(n.name)) continue;
    n.position[1] = cur.y - 180;
    // Las dos ramas que salen del mismo nodo: la bitácora arriba de la del aviso.
    if (n.name.startsWith('Book: Log ')) n.position[1] -= 100;
}

// Fallas: las que dejan la orden a medias suman un intento (con dos, se deriva).
ifExpr('Book: Count Attempt?', '={{ !!$json.__fail.bump }}', 6);
pg('Book: Bump Attempts', `UPDATE whatsapp_order_intakes SET booking_attempts = booking_attempts + 1
 WHERE phone = $1 AND status IN ${ACTIVE}
RETURNING booking_attempts;`, `={{ [ $('Book: Parse').first().json.phone ] }}`, 7);
code('Book: Attach Attempts', `const f = $('Book: Count Attempt?').first().json.__fail;
const n = ($input.first().json || {}).booking_attempts || 0;
return [{ json: { __fail: { ...f, attempts: n, message: f.message + (n >= 2 ? ' Ya son dos fallas seguidas: derivá a una persona con handoff_order (motivo booking_failed).' : '') } } }];`, 8);
respond('Book: Respond Fail', RESPOND_FAIL, 9);
// (los tres nodos de falla viven en la fila de abajo para no pisar el camino feliz)
for (const n of nodes) {
    if (['Book: Count Attempt?', 'Book: Bump Attempts', 'Book: Attach Attempts', 'Book: Respond Fail'].includes(n.name)) n.position[1] = cur.y + 260;
}

link('Book: Webhook', 'Book: Parse');
link('Book: Parse', 'Book: Input OK?');
link('Book: Input OK?', 'Book: Load', 0);
link('Book: Input OK?', 'Book: Respond Fail', 1);
link('Book: Load', 'Book: Check State');
link('Book: Check State', 'Book: State OK?');
link('Book: State OK?', 'Book: Ensure Patient', 0);
link('Book: State OK?', 'Book: Count Attempt?', 1);
link('Book: Ensure Patient', 'Book: Patient Ready');
link('Book: Patient Ready', 'Book: Patient OK?');
link('Book: Patient OK?', 'Book: Order Exists?', 0);
link('Book: Patient OK?', 'Book: Count Attempt?', 1);
link('Book: Order Exists?', 'Book: Order Ready', 0); // ya había orden de un intento anterior
link('Book: Order Exists?', 'Book: Build Order Payload', 1);
link('Book: Build Order Payload', 'Book: Upsert Order');
link('Book: Upsert Order', 'Book: Check Upsert');
link('Book: Check Upsert', 'Book: Upsert OK?');
link('Book: Upsert OK?', 'Book: Submit Order', 0);
link('Book: Upsert OK?', 'Book: Count Attempt?', 1);
link('Book: Submit Order', 'Book: Check Submit');
link('Book: Check Submit', 'Book: Submit OK?');
link('Book: Submit OK?', 'Book: New Order Events', 0); // rama de bitácora y aviso (arriba: corre primero)
link('Book: Submit OK?', 'Book: Save Review Items', 0);
link('Book: Submit OK?', 'Book: Save Order', 0);
link('Book: Submit OK?', 'Book: Count Attempt?', 1);
link('Book: New Order Events', 'Book: Log New Order');
link('Book: New Order Events', 'Book: Notify New Order');
link('Book: Notify New Order', 'Book: New Order Recipient?');
link('Book: New Order Recipient?', 'Book: Push New Order', 0);
link('Book: Save Order', 'Book: Order Ready');
link('Book: Order Ready', 'Book: Recheck Slot');
link('Book: Recheck Slot', 'Book: Check Slot');
link('Book: Check Slot', 'Book: Slot Free?');
link('Book: Slot Free?', 'Book: Make Token', 0);
link('Book: Slot Free?', 'Book: Count Attempt?', 1);
link('Book: Make Token', 'Book: Booking Token');
link('Book: Booking Token', 'Book: Check Token');
link('Book: Check Token', 'Book: Token OK?');
link('Book: Token OK?', 'Book: Public Book', 0);
link('Book: Token OK?', 'Book: Count Attempt?', 1);
link('Book: Public Book', 'Book: Check Booking');
link('Book: Check Booking', 'Book: Booked OK?');
link('Book: Booked OK?', 'Book: Booking Events', 0); // rama de bitácora y aviso (arriba: corre primero)
link('Book: Booked OK?', 'Book: Save Booking', 0);
link('Book: Booked OK?', 'Book: Count Attempt?', 1);
link('Book: Booking Events', 'Book: Log Booking');
link('Book: Booking Events', 'Book: Notify Booking');
link('Book: Notify Booking', 'Book: Booking Recipient?');
link('Book: Booking Recipient?', 'Book: Push Booking', 0);
link('Book: Save Booking', 'Book: Format');
link('Book: Format', 'Book: Respond');
link('Book: Count Attempt?', 'Book: Bump Attempts', 0);
link('Book: Count Attempt?', 'Book: Respond Fail', 1);
link('Book: Bump Attempts', 'Book: Attach Attempts');
link('Book: Attach Attempts', 'Book: Respond Fail');

// =============================================================================
// 6. order-handoff
// =============================================================================
startFlow('6 · agent-tools/order-handoff');
webhook('Handoff: Webhook', 'agent-tools/order-handoff');
code('Handoff: Parse', `${PARSE_PHONE}
const ALLOWED = ['service_not_found', 'unreadable', 'low_confidence', 'patient_mismatch', 'booking_failed', 'user_request', 'system_error', 'order_changed'];
const reason = ALLOWED.includes(b.reason_code) ? b.reason_code : 'user_request';
// Cuando deriva el validador (extracción o revalidación), 'Save Result' ya dejó el intake en
// handed_off y el UPDATE de 'Handoff: Mark Intake' no lo encuentra: quien llama manda su id para
// que el aviso igual lleve el paciente y el original.
const intakeId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(b.intake_id || '')) ? String(b.intake_id) : '';
return [{ json: { phone, reason, detail: String(b.detail || '').trim().slice(0, 300), intake_id: intakeId } }];`, 1);
gate('Handoff: Input OK?', 2);
pg('Handoff: Mark Intake', `-- $1 teléfono, $2 motivo, $3 detalle, $4 id de un intake que el validador ya derivó (o vacío).
-- Marca como derivado el intake en curso (si hay uno) y trae el primer original para que recepción
-- lo abra desde el aviso. Si no hay uno en curso y vino $4:
--   - si ese intake está agendado (booked: llegó otro archivo que cambia una orden con cita), también
--     se marca como derivado, para que recepción lo vea en "Derivadas" (la cita y la orden no se tocan);
--   - si ya está derivado y sin resolver, solo se usa para leer el paciente y el original.
WITH upd AS (
  UPDATE whatsapp_order_intakes
     SET status = 'handed_off', handoff_reason = $2, handoff_detail = NULLIF($3, '')
   WHERE phone = $1
     AND (status IN ${ACTIVE}
          OR ($4::text <> '' AND id = NULLIF($4::text, '')::uuid AND status = 'booked'
              AND NOT EXISTS (SELECT 1 FROM whatsapp_order_intakes x
                               WHERE x.phone = $1 AND x.status IN ${ACTIVE})))
  RETURNING id, validation, extraction_meta, study_order_id
),
prev AS (
  SELECT i.id, i.validation, i.extraction_meta, i.study_order_id
    FROM whatsapp_order_intakes i
   WHERE $4::text <> '' AND i.id = NULLIF($4::text, '')::uuid AND i.phone = $1
     AND i.status = 'handed_off' AND i.resolved_at IS NULL
     AND NOT EXISTS (SELECT 1 FROM upd)
),
target AS (
  SELECT id, validation, extraction_meta, study_order_id FROM upd
  UNION ALL
  SELECT id, validation, extraction_meta, study_order_id FROM prev
)
-- Para el borrador que se crea al derivar: lo que se alcanzó a armar (el de la última lectura con la
-- orden ya creada, el que guardó el validador o la orden lista), lo que hay que revisar, el paciente
-- validado, si ya hay un borrador de esta derivación y el usuario de servicio que lo crea.
SELECT (SELECT id::text FROM target) AS intake_id,
       (SELECT validation -> 'patient' ->> 'name' FROM target) AS patient_name,
       (SELECT a.web_view_link FROM attachments a, target
         WHERE a.source_name = 'whatsapp_order_intake' AND a.source_id = target.id::text
         ORDER BY a.id LIMIT 1) AS first_file,
       (SELECT min(u.id::text) FROM users u
         WHERE u.phone_number = $1 AND COALESCE(u.is_active, true) HAVING count(*) = 1) AS patient_id,
       (SELECT coalesce(extraction_meta -> 'late_files' -> -1 -> 'draft',
                        validation -> 'draft', validation -> 'resolved') FROM target) AS draft,
       (SELECT coalesce(extraction_meta -> 'late_files' -> -1 -> 'review_items',
                        validation -> 'review_items', '[]'::jsonb) FROM target) AS review_items,
       (SELECT validation -> 'patient' FROM target) AS validated_patient,
       (SELECT study_order_id::text FROM target) AS study_order_id,
       (SELECT o.id::text FROM study_orders o, target
         WHERE o.source_intake_id = target.id AND o.status = 'draft' LIMIT 1) AS existing_draft_id,
       (SELECT id::text FROM users WHERE email = '${AGENT_EMAIL}' LIMIT 1) AS agent_user_id;`,
    '={{ [ $json.phone, $json.reason, $json.detail, $json.intake_id ] }}', 3);
code('Handoff: Build Draft', `// Cuando el agente pide una persona, la orden queda en BORRADOR y de origen WhatsApp (docs §21-22):
// recepción la encuentra en la bandeja con WhatsApp + Borradores, la corrige y la envía.
//   create  borrador nuevo con lo que el agente alcanzó a leer (vacío si no leyó nada: quedan los
//           originales), sin doctor. Sus puntos a revisar frenan el envío.
//   attach  ya hay un borrador de esta derivación (un aviso anterior): se le agregan los puntos nuevos.
//   skip    el agente ya había creado y enviado la orden (p. ej. falló la reserva): no se toca, sale
//           solo el aviso. La orden ya está en la bandeja como pendiente de agendar.
// Con "la orden cambió" la orden del agente se reemplaza: se crea el borrador de reemplazo.
const inp = $('Handoff: Parse').first().json;
const r = $input.first().json || {};
const skip = (why) => [{ json: { mode: 'skip', why } }];
if (!r.intake_id) return skip('no_intake');
if (!r.agent_user_id) return skip('agent_user_missing');
const LABEL = ${JSON.stringify({
    service_not_found: 'Hay estudios que no figuran en el sistema',
    unreadable: 'La orden no se pudo leer completa',
    low_confidence: 'Lectura dudosa que el paciente no pudo aclarar',
    patient_mismatch: 'El paciente de la orden no coincide con quien escribe',
    booking_failed: 'No se pudo agendar',
    user_request: 'El paciente pidió hablar con una persona',
    system_error: 'Error del sistema al procesar la orden',
    order_changed: 'Llegó otro archivo que cambia la orden ya creada',
})};
// El motivo de la derivación siempre es un punto a revisar: es lo que la persona tiene que resolver.
const review = [{ code: 'handoff_reason', field: inp.reason, label: LABEL[inp.reason] || inp.reason, detail: inp.detail || null }]
  .concat(Array.isArray(r.review_items) ? r.review_items : []);
if (r.existing_draft_id) {
  return [{ json: { mode: 'attach', order_id: r.existing_draft_id, blocking: 'true', agent_user_id: r.agent_user_id, review_items: JSON.stringify(review) } }];
}
if (r.study_order_id && inp.reason !== 'order_changed') return skip('has_order');
const d = (r.draft && typeof r.draft === 'object') ? r.draft : { items: [] };
const vp = r.validated_patient || {};
const dp = d.patient || {};
const name = String(dp.name || vp.name || '').trim();
const items = (d.items || []).filter((i) => i && i.service_id).map((i, idx) => ({
  service_id: String(i.service_id), service_name: i.service_name || '', section_code: i.section_code || '',
  sort_order: Number.isFinite(Number(i.sort_order)) ? Number(i.sort_order) : idx, quantity: 1,
  modifiers: i.modifiers || {}, notes: i.notes || '',
}));
if (!name) review.push({ code: 'unreadable', field: 'patient.name', label: 'No se pudo leer el nombre del paciente', detail: 'El borrador quedó con un nombre provisorio.' });
if (items.length === 0) review.push({ code: 'unreadable', field: 'items', label: 'No se pudo ubicar ningún estudio', detail: 'Cargá los estudios mirando el original.' });
const payload = {
  without_doctor: true,
  source: 'whatsapp',
  source_intake_id: r.intake_id,
  referring_doctor_name: d.referring_doctor_name || '',
  patient_id: vp.status === 'existing' && vp.patient_id ? String(vp.patient_id) : '',
  patient_name: name || ('Paciente sin identificar (WhatsApp ' + inp.phone + ')'),
  patient_document: String(dp.document || vp.document || ''),
  patient_phone: inp.phone,
  regions: d.regions || {},
  section_modifiers: d.section_modifiers || {},
  texts: d.texts || {},
  delivery_methods: d.delivery_methods || [],
  clinical_notes: d.clinical_notes || '',
  items,
};
return [{ json: { mode: 'create', blocking: 'true', agent_user_id: r.agent_user_id, payload: JSON.stringify(payload), review_items: JSON.stringify(review) } }];`, 4);
ifExpr('Handoff: Create Draft?', `={{ $json.mode === 'create' }}`, 5);
// $1 = el usuario de servicio: con CREATE_FOR_DOCTOR el SQL acepta without_doctor, source y source_intake_id.
pg('Handoff: Upsert Draft', UPSERT_SQL, '={{ [ $json.agent_user_id, $json.payload ] }}', 6, SAFE);
ifExpr('Handoff: Draft Created?', '={{ !!$json.id }}', 7);
ifExpr('Handoff: Attach To Order?', `={{ $json.mode === 'attach' }}`, 6);
code('Handoff: Target Order', `// Orden a la que van los puntos a revisar: la recién creada o la que ya existía.
const b = $('Handoff: Build Draft').first().json;
const created = b.mode === 'create';
return [{ json: {
  order_id: created ? $('Handoff: Upsert Draft').first().json.id : b.order_id,
  created, blocking: b.blocking, review_items: b.review_items, agent_user_id: b.agent_user_id,
} }];`, 8);
pg('Handoff: Save Review Items', REVIEW_ITEMS_INSERT_SQL,
    '={{ [ $json.order_id, $json.review_items, $json.blocking ] }}', 9, SAFE);
ifExpr('Handoff: Was Created?', `={{ $('Handoff: Target Order').first().json.created === true }}`, 10);
pgSide('Handoff: Log Draft', LOG_EVENT_SQL,
    `={{ [ JSON.stringify({ order_id: $('Handoff: Target Order').first().json.order_id, event_type: 'created', actor_id: $('Handoff: Target Order').first().json.agent_user_id }) ] }}`, 11, { alwaysOutputData: true });
code('Handoff: Build Request', `const inp = $('Handoff: Parse').first().json;
const r = $('Handoff: Mark Intake').first().json || {};
// Número del borrador de la derivación (el nuevo o uno anterior): el aviso lo nombra
// para que recepción la abra desde la bandeja.
let draftNumber = null;
try {
  if ($('Handoff: Save Review Items').isExecuted) draftNumber = $('Handoff: Save Review Items').first().json.order_number || null;
} catch (e) { draftNumber = null; }
const LABEL = { service_not_found: 'estudio que no figura en el sistema', unreadable: 'orden ilegible o con datos faltantes',
  low_confidence: 'lectura dudosa', patient_mismatch: 'paciente distinto de quien escribe', booking_failed: 'no se pudo agendar',
  user_request: 'el usuario pidió hablar con una persona', system_error: 'error del sistema',
  order_changed: 'la orden ya creada recibió otro archivo que la cambia' };
const reason = ('Orden de estudio: ' + (LABEL[inp.reason] || inp.reason) + (inp.detail ? ' — ' + inp.detail : '')
  + (draftNumber ? ' | Borrador ' + draftNumber + ' para revisar' : '')
  + (r.first_file ? ' | Original: ' + r.first_file : '')).slice(0, 490);
return [{ json: { phone: inp.phone, patient_id: r.patient_id || '', patient_name: r.patient_name || '',
  last_message: inp.detail || LABEL[inp.reason] || '', reason, draft_order_number: draftNumber } }];`, 12);
http('Handoff: Call Existing Handoff', '/webhook/agent-tools/handoff', '={{ JSON.stringify({ phone: $json.phone, patient_id: $json.patient_id, patient_name: $json.patient_name, last_message: $json.last_message, reason: $json.reason }) }}', AGENT_KEY, 13);
code('Handoff: Format', `return [{ json: { ok: true, handed_off: true, draft_order_number: $('Handoff: Build Request').first().json.draft_order_number || null } }];`, 14);
respond('Handoff: Respond', RESPOND_JSON, 15);
respond('Handoff: Respond Fail', RESPOND_FAIL, 3);
link('Handoff: Webhook', 'Handoff: Parse');
link('Handoff: Parse', 'Handoff: Input OK?');
link('Handoff: Input OK?', 'Handoff: Mark Intake', 0);
link('Handoff: Input OK?', 'Handoff: Respond Fail', 1);
link('Handoff: Mark Intake', 'Handoff: Build Draft');
link('Handoff: Build Draft', 'Handoff: Create Draft?');
link('Handoff: Create Draft?', 'Handoff: Upsert Draft', 0);
link('Handoff: Create Draft?', 'Handoff: Attach To Order?', 1);
link('Handoff: Upsert Draft', 'Handoff: Draft Created?');
link('Handoff: Draft Created?', 'Handoff: Target Order', 0);
link('Handoff: Draft Created?', 'Handoff: Build Request', 1);
link('Handoff: Attach To Order?', 'Handoff: Target Order', 0);
link('Handoff: Attach To Order?', 'Handoff: Build Request', 1);
link('Handoff: Target Order', 'Handoff: Save Review Items');
link('Handoff: Save Review Items', 'Handoff: Was Created?');
link('Handoff: Was Created?', 'Handoff: Log Draft', 0);
link('Handoff: Was Created?', 'Handoff: Build Request', 1);
link('Handoff: Log Draft', 'Handoff: Build Request');
link('Handoff: Build Request', 'Handoff: Call Existing Handoff');
link('Handoff: Call Existing Handoff', 'Handoff: Format');
link('Handoff: Format', 'Handoff: Respond');

// ---------------------------------------------------------------------------
const workflow = {
    name: 'WhatsApp - Order Agent Tools',
    nodes,
    connections,
    settings: { executionOrder: 'v1' },
    tags: [],
};
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(workflow, null, 2) + '\n');
console.log(`Escrito ${OUT} (${nodes.length} nodos)`);
