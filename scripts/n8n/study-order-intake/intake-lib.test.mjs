/**
 * Pruebas del validador y del esquema de extracción.
 *   node --test scripts/n8n/study-order-intake/
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    buildExtractionSchema, buildSystemPrompt, isValidCedulaUY, normalizeDocument,
    similarNames, validateExtraction, compareLateFiles, buildOrderDraft, collectFieldConfidence, buildReviewItems,
    validateImport, buildImportOrderPayload, sourceOf,
} from './intake-lib.mjs';

// Un recorte del catálogo real (ids y códigos de ci-orden:*).
const catalog = [
    { id: 1566, external_id: 'ci-orden:svc:opt', name: 'Panorámica (OPT)', section_code: 'RX-EXTRA', duration_minutes: 10 },
    { id: 1568, external_id: 'ci-orden:svc:telerradio-perfil', name: 'Telerradiografía Perfil', section_code: 'RX-EXTRA', duration_minutes: 10 },
    { id: 1603, external_id: 'ci-orden:svc:hemiarco', name: 'Hemiarco', section_code: 'CONEBEAM', duration_minutes: 20 },
    { id: 1561, external_id: 'ci-orden:svc:periapical', name: 'Periapical', section_code: 'RX-INTRA', duration_minutes: 10 },
];
const options = [
    { option_kind: 'modifier', code: 'frankfort', group_code: 'tecnica', section_code: 'RX-EXTRA', service_external_id: 'ci-orden:svc:telerradio-perfil', label: 'Plano de Frankfort' },
    { option_kind: 'modifier', code: 'est-tipo-implante', group_code: 'indicacion_clinica', section_code: 'CONEBEAM', service_external_id: null, label: 'Implante' },
    { option_kind: 'region_group', code: 'conebeam_odontogram', section_code: 'CONEBEAM', label: 'Región' },
    { option_kind: 'text', code: 'aclaracion', section_code: null, label: 'Aclaración' },
    { option_kind: 'delivery', code: 'imagencloud', label: 'Imagen Cloud' },
];

const VALID_CI = '1.234.567-2';

const extraction = (over = {}) => ({
    is_study_order: true,
    document_quality: 'good',
    doctor: { name: 'Dra. Ana Pérez', license: '12345', confidence: 0.9 },
    patient: { name: 'Juan Gómez', document: VALID_CI, document_type: 'cedula', birth_date: null, phone: null, confidence: 0.95 },
    order_date: '2026-09-28',
    items: [
        { external_id: 'ci-orden:svc:opt', notes: null, confidence: 0.97 },
        { external_id: 'ci-orden:svc:hemiarco', notes: null, confidence: 0.92 },
    ],
    modifiers: [],
    regions: [],
    texts: [],
    delivery_methods: [],
    unmatched_text_lines: [],
    has_signature: true,
    unreadable_fields: [],
    missing_other_side: false,
    ...over,
});

const runRaw = (over = {}, inputOver = {}) =>
    validateExtraction({
        extraction: extraction(over), has_files: true, catalog, options,
        sender: null, phone: '+59891234567', phone_ambiguous: false,
        doc_matches: [], open_orders: [], config: { min_confidence: 0.85 }, prior: {},
        ...inputOver,
    });

/**
 * Como runRaw, pero quien escribe sin estar registrado ya contestó que la orden es suya (lo que
 * hace la mayoría de las pruebas, que miran otra cosa). La pregunta tiene sus pruebas con runRaw.
 */
const run = (over = {}, inputOver = {}) => {
    const priorIn = inputOver.prior || {};
    const doc = runRaw(over, inputOver).questions.find((q) => q.code === 'confirm_sender_is_patient')?.document;
    if (doc === undefined || priorIn.overrides?.sender_patient_document !== undefined) return runRaw(over, inputOver);
    return runRaw(over, {
        ...inputOver,
        prior: { ...priorIn, overrides: { ...(priorIn.overrides || {}), sender_patient_document: doc } },
    });
};

// ---------------------------------------------------------------------------
test('cédula uruguaya: verificador', () => {
    assert.equal(isValidCedulaUY('12345672'), true);
    assert.equal(isValidCedulaUY('12345673'), false);
    assert.equal(isValidCedulaUY('1234'), false);
    assert.equal(normalizeDocument('1.234.567-2'), '12345672');
});

test('nombres parecidos', () => {
    assert.equal(similarNames('Juan Gómez', 'GOMEZ, Juan Carlos'), true);
    assert.equal(similarNames('Juan Gómez', 'María López'), false);
    assert.equal(similarNames('', 'Juan'), false);
});

test('camino feliz con remitente sin registrar: se registra y queda listo', () => {
    const r = run();
    assert.equal(r.outcome, 'ready');
    assert.equal(r.patient.status, 'register');
    assert.equal(r.resolved.items.length, 2);
    assert.equal(r.resolved.total_duration_minutes, 30);
    assert.equal(r.resolved.referring_doctor_name, 'Dra. Ana Pérez');
    assert.match(r.resolved.clinical_notes, /Doctor según la orden/);
});

test('un estudio fuera del catálogo deriva la orden COMPLETA (no se agenda parcial)', () => {
    const r = run({ unmatched_text_lines: ['Resonancia de ATM'] });
    assert.equal(r.outcome, 'handoff');
    assert.equal(r.handoff_reason, 'service_not_found');
    assert.equal(r.resolved, null);
    assert.match(r.handoff_detail, /Resonancia/);
});

test('un id que no existe en el catálogo también deriva', () => {
    const r = run({ items: [{ external_id: 'ci-orden:svc:inventado', notes: null, confidence: 0.99 }] });
    assert.equal(r.handoff_reason, 'service_not_found');
});

test('línea de baja confianza: se pregunta una vez y, si sigue dudosa, se deriva', () => {
    const low = { items: [{ external_id: 'ci-orden:svc:opt', notes: null, confidence: 0.97 }, { external_id: 'ci-orden:svc:hemiarco', notes: null, confidence: 0.5 }] };
    const first = run(low);
    assert.equal(first.outcome, 'needs_input');
    assert.deepEqual(first.questions.map((q) => q.code), ['confirm_line']);

    const second = run(low, { prior: first.prior });
    assert.equal(second.outcome, 'handoff');
    assert.equal(second.handoff_reason, 'low_confidence');

    const confirmed = run(low, { prior: { ...first.prior, confirmed: ['ci-orden:svc:hemiarco'] } });
    assert.equal(confirmed.outcome, 'ready');
});

test('una línea que el usuario descarta sale de la orden', () => {
    const low = { items: [{ external_id: 'ci-orden:svc:opt', notes: null, confidence: 0.97 }, { external_id: 'ci-orden:svc:hemiarco', notes: null, confidence: 0.5 }] };
    const r = run(low, { prior: { removed: ['ci-orden:svc:hemiarco'] } });
    assert.equal(r.outcome, 'ready');
    assert.equal(r.resolved.items.length, 1);
});

test('paciente: remitente registrado sin cédula y con nombre parecido → es él', () => {
    const r = run({}, { sender: { id: 'u1', name: 'Juan Carlos Gómez', phone: '+59891234567', identity_document: null } });
    assert.equal(r.outcome, 'ready');
    assert.equal(r.patient.patient_id, 'u1');
    assert.equal(r.patient.set_document, true);
});

test('paciente: remitente con OTRA cédula → deriva (orden de otra persona)', () => {
    const r = run({}, { sender: { id: 'u1', name: 'Juan Gómez', phone: '+59891234567', identity_document: '4.123.456-7' } });
    assert.equal(r.handoff_reason, 'patient_mismatch');
});

test('paciente: remitente sin cédula y nombre distinto → deriva', () => {
    const r = run({}, { sender: { id: 'u1', name: 'María López', phone: '+59891234567', identity_document: null } });
    assert.equal(r.handoff_reason, 'patient_mismatch');
});

test('paciente: la cédula ya existe con otro teléfono → deriva', () => {
    const r = run({}, { doc_matches: [{ id: 'u9', name: 'Juan Gómez', phone: '+59899999999', identity_document: '12345672' }] });
    assert.equal(r.handoff_reason, 'patient_mismatch');
});

test('paciente: la cédula existe con el teléfono de quien escribe → es él', () => {
    const r = run({}, { doc_matches: [{ id: 'u9', name: 'Juan Gómez', phone: '+59891234567', identity_document: '12345672' }] });
    assert.equal(r.outcome, 'ready');
    assert.equal(r.patient.patient_id, 'u9');
});

test('paciente registrado sin teléfono y remitente desconocido: se asocia el teléfono', () => {
    const r = run({}, { doc_matches: [{ id: 'u9', name: 'Juan Gómez', phone: null, identity_document: '12345672' }] });
    assert.equal(r.patient.attach_phone, true);
});

test('remitente sin registrar: antes de registrar al paciente pregunta si la orden es suya', () => {
    const r = runRaw();
    assert.equal(r.outcome, 'needs_input');
    assert.deepEqual(r.questions.map((q) => q.code), ['confirm_sender_is_patient']);
    assert.equal(r.questions[0].document, '12345672');
    assert.match(r.questions[0].hint, /Juan Gómez/);
    assert.equal(r.resolved, null);
});

test('remitente sin registrar y paciente registrado sin teléfono: también pregunta antes de asociárselo', () => {
    const r = runRaw({}, { doc_matches: [{ id: 'u9', name: 'Juan Gómez', phone: null, identity_document: '12345672' }] });
    assert.equal(r.outcome, 'needs_input');
    assert.equal(r.questions[0].code, 'confirm_sender_is_patient');
});

test('remitente sin registrar dice que la orden es de otra persona → deriva', () => {
    const first = runRaw();
    const r = runRaw({}, { prior: { ...first.prior, overrides: { sender_not_patient: true } } });
    assert.equal(r.outcome, 'handoff');
    assert.equal(r.handoff_reason, 'patient_mismatch');
    assert.ok(r.draft, 'recepción arranca de lo leído');
});

test('remitente sin registrar confirma: sigue al registro', () => {
    const first = runRaw();
    const r = runRaw({}, { prior: { ...first.prior, overrides: { sender_patient_document: '12345672' } } });
    assert.equal(r.outcome, 'ready');
    assert.equal(r.patient.status, 'register');
});

test('remitente sin registrar: sin respuesta la pregunta sigue pendiente, junto con las demás y primero', () => {
    const low = { items: [{ external_id: 'ci-orden:svc:opt', notes: null, confidence: 0.97 }, { external_id: 'ci-orden:svc:hemiarco', notes: null, confidence: 0.5 }] };
    const first = runRaw(low);
    assert.deepEqual(first.questions.map((q) => q.code), ['confirm_sender_is_patient', 'confirm_line']);
    // Contestó solo la línea: no deriva por la pregunta sin contestar, la vuelve a hacer.
    const second = runRaw(low, { prior: { ...first.prior, confirmed: ['ci-orden:svc:hemiarco'] } });
    assert.equal(second.outcome, 'needs_input');
    assert.deepEqual(second.questions.map((q) => q.code), ['confirm_sender_is_patient']);
});

test('remitente sin registrar: el "sí" vale para ese documento; si cambia el paciente, vuelve a preguntar', () => {
    const r = runRaw({ patient: { name: 'Ana Ruiz', document: '4.567.890-5', document_type: 'cedula', confidence: 0.95 } },
        { prior: { overrides: { sender_patient_document: '12345672' } } });
    assert.equal(r.questions[0]?.code, 'confirm_sender_is_patient');
});

test('remitente registrado: no se pregunta (se compara con sus datos)', () => {
    const r = runRaw({}, { sender: { id: 'u1', name: 'Juan Gómez', phone: '+59891234567', identity_document: VALID_CI } });
    assert.equal(r.outcome, 'ready');
    assert.equal(r.questions.length, 0);
});

test('teléfono asociado a más de un usuario → deriva', () => {
    const r = run({}, { phone_ambiguous: true });
    assert.equal(r.handoff_reason, 'patient_mismatch');
});

test('cédula con verificador inválido: se consulta una vez; si sigue mal, se deriva', () => {
    const bad = { patient: { name: 'Juan Gómez', document: '1.234.567-3', document_type: 'cedula', birth_date: null, phone: null, confidence: 0.95 } };
    const first = run(bad);
    assert.equal(first.outcome, 'needs_input');
    assert.equal(first.questions[0].code, 'invalid_patient_document');
    const second = run(bad, { prior: first.prior });
    assert.equal(second.handoff_reason, 'unreadable');
    const fixed = run(bad, { prior: first.prior.asked_fields ? { ...first.prior, overrides: { patient_document: '1.234.567-2' } } : {} });
    assert.equal(fixed.outcome, 'ready');
});

test('pasaporte: no se valida el verificador uruguayo', () => {
    const r = run({ patient: { name: 'John Smith', document: 'X1234567', document_type: 'passport', birth_date: null, phone: null, confidence: 0.95 } });
    assert.equal(r.outcome, 'ready');
});

test('falta el nombre: se pregunta', () => {
    const r = run({ patient: { name: null, document: VALID_CI, document_type: 'cedula', birth_date: null, phone: null, confidence: 0.9 } });
    assert.equal(r.outcome, 'needs_input');
    assert.equal(r.questions[0].code, 'missing_patient_name');
});

test('no es una orden: se pide reenvío y, la segunda vez, se deriva', () => {
    const first = run({ is_study_order: false, items: [] });
    assert.equal(first.outcome, 'needs_input');
    assert.equal(first.questions[0].code, 'resend');
    const second = run({ is_study_order: false, items: [] }, { prior: first.prior });
    assert.equal(second.handoff_reason, 'unreadable');
});

test('sin archivos utilizables se pide reenvío', () => {
    const r = validateExtraction({ extraction: null, has_files: false, catalog, options, prior: {} });
    assert.equal(r.outcome, 'needs_input');
});

test('fallo del modelo → derivación por error del sistema', () => {
    const r = validateExtraction({ extraction: null, extraction_error: 'HTTP 500', has_files: true, catalog, options, prior: {} });
    assert.equal(r.handoff_reason, 'system_error');
});

test('opciones y regiones: se ubican; lo que no encaja queda en las notas, no se pierde', () => {
    const r = run({
        items: [
            { external_id: 'ci-orden:svc:telerradio-perfil', notes: 'con análisis', confidence: 0.95 },
            { external_id: 'ci-orden:svc:hemiarco', notes: null, confidence: 0.95 },
        ],
        modifiers: [
            { service_external_id: 'ci-orden:svc:telerradio-perfil', section_code: 'RX-EXTRA', group_code: 'tecnica', option_code: 'frankfort' },
            { service_external_id: null, section_code: 'CONEBEAM', group_code: 'indicacion_clinica', option_code: 'est-tipo-implante' },
        ],
        regions: [{ section_code: 'CONEBEAM', teeth: ['3.6', '37', '99'] }],
        texts: [{ code: 'aclaracion', value: 'Evaluar reabsorción' }],
        delivery_methods: ['imagencloud', 'paloma'],
    });
    assert.equal(r.outcome, 'ready');
    const perfil = r.resolved.items.find((i) => i.external_id === 'ci-orden:svc:telerradio-perfil');
    assert.deepEqual(perfil.modifiers, { tecnica: ['frankfort'] });
    assert.equal(perfil.notes, 'con análisis');
    assert.deepEqual(r.resolved.section_modifiers, { CONEBEAM: { indicacion_clinica: ['est-tipo-implante'] } });
    assert.deepEqual(r.resolved.regions, { CONEBEAM: ['36', '37'] });
    assert.deepEqual(r.resolved.texts, { aclaracion: 'Evaluar reabsorción' });
    assert.deepEqual(r.resolved.delivery_methods, ['imagencloud']);
    assert.match(r.resolved.clinical_notes, /pieza "99"/);
    assert.ok(r.warnings.some((w) => w.code === 'unplaced_details'));
});

test('sin firma: es una advertencia, no una derivación', () => {
    const r = run({ has_signature: false });
    assert.equal(r.outcome, 'ready');
    assert.ok(r.warnings.some((w) => w.code === 'no_signature'));
});

test('detecta una orden abierta con los mismos estudios', () => {
    const r = run({}, { open_orders: [{ id: 'o1', order_number: 'OE-2026-000001', service_ids: [1603, 1566] }] });
    assert.deepEqual(r.duplicate_of, { id: 'o1', order_number: 'OE-2026-000001' });
});

test('esquema de extracción: estricto y con los ids del catálogo', () => {
    const schema = buildExtractionSchema(catalog, options);
    const check = (node, path = 'root') => {
        if (node && node.type === 'object' && node.properties) {
            assert.equal(node.additionalProperties, false, path);
            assert.deepEqual([...node.required].sort(), Object.keys(node.properties).sort(), path);
            for (const [k, v] of Object.entries(node.properties)) check(v, `${path}.${k}`);
        }
        if (node && node.type === 'array' && node.items) check(node.items, `${path}[]`);
        for (const [i, alt] of ((node && node.anyOf) || []).entries()) check(alt, `${path}|${i}`);
    };
    check(schema);
    for (const [k, def] of Object.entries(schema.$defs || {})) check(def, `$defs.${k}`);
    assert.deepEqual(schema.properties.items.items.properties.external_id.enum, catalog.map((s) => s.external_id));
});

test('prompt: incluye el catálogo y la defensa contra instrucciones dentro del documento', () => {
    const p = buildSystemPrompt(catalog, options);
    assert.match(p, /ci-orden:svc:opt \| RX-EXTRA \| Panorámica/);
    assert.match(p, /nunca instrucciones/i);
});

test('falta la otra cara: se pide antes que nada y sin gastar el reenvío', () => {
    // Frente sin estudios (están en el dorso): no se pide "reenvío", se pide la otra cara.
    const r = run({ missing_other_side: true, items: [] });
    assert.equal(r.outcome, 'needs_input');
    assert.deepEqual(r.questions.map((q) => q.code), ['missing_other_side']);
    assert.equal(r.prior.resend_count, 0);
    assert.deepEqual(r.prior.asked_fields, ['other_side']);
});

test('falta la otra cara y llega: con las dos caras se valida normal', () => {
    const r = run({ missing_other_side: false }, { prior: { asked_fields: ['other_side'] } });
    assert.equal(r.outcome, 'ready');
    assert.equal(r.warnings.some((w) => w.code === 'possibly_incomplete'), false);
});

test('falta la otra cara: si ya se pidió y sigue faltando, se sigue con advertencia', () => {
    const r = run({ missing_other_side: true }, { prior: { asked_fields: ['other_side'] } });
    assert.equal(r.outcome, 'ready');
    assert.equal(r.warnings.some((w) => w.code === 'possibly_incomplete'), true);
});

test('falta la otra cara: si el usuario dice que no hay, no se vuelve a preguntar', () => {
    const r = run({ missing_other_side: true }, { prior: { asked_fields: ['other_side'], overrides: { no_other_side: true } } });
    assert.equal(r.outcome, 'ready');
    assert.equal(r.warnings.some((w) => w.code === 'possibly_incomplete'), false);
});

test('falta la otra cara: una extracción vieja sin el campo no pregunta', () => {
    const e = extraction();
    delete e.missing_other_side;
    const r = validateExtraction({
        extraction: e, has_files: true, catalog, options,
        sender: { id: 'u1', name: 'Juan Gómez', phone: '+59891234567', identity_document: VALID_CI }, phone: '+59891234567',
        phone_ambiguous: false, doc_matches: [], open_orders: [], config: { min_confidence: 0.85 }, prior: {},
    });
    assert.equal(r.outcome, 'ready');
});

test('esquema: incluye missing_other_side como booleano obligatorio', () => {
    const schema = buildExtractionSchema(catalog, options);
    assert.equal(schema.properties.missing_other_side.type, 'boolean');
    assert.ok(schema.required.includes('missing_other_side'));
});

// ---- Archivos que llegan con la orden ya creada ----------------------------
// La orden creada tiene Panorámica (1566) y Hemiarco (1603), como extraction().
const order = { order_number: 'OE-2026-000123', items: [{ service_id: 1566 }, { service_id: 1603 }], documents: ['12345672'] };
const compare = (over = {}, inputOver = {}) =>
    compareLateFiles({ extraction: extraction(over), catalog, order, prior: {}, ...inputOver });

test('orden ya creada: un archivo que no agrega estudios deja la orden igual', () => {
    const r = compare();
    assert.equal(r.outcome, 'unchanged');
    assert.equal(r.handoff_reason, null);
});

test('orden ya creada: si a la lectura nueva le falta un estudio, no cuenta (la orden ya lo tiene)', () => {
    assert.equal(compare({ items: [{ external_id: 'ci-orden:svc:opt', notes: null, confidence: 0.9 }] }).outcome, 'unchanged');
});

test('orden ya creada: el dorso agrega un estudio → deriva con order_changed y el número de orden', () => {
    const r = compare({ items: [
        { external_id: 'ci-orden:svc:opt', notes: null, confidence: 0.9 },
        { external_id: 'ci-orden:svc:hemiarco', notes: null, confidence: 0.9 },
        { external_id: 'ci-orden:svc:periapical', notes: null, confidence: 0.6 },
    ] });
    assert.equal(r.outcome, 'handoff');
    assert.equal(r.handoff_reason, 'order_changed');
    assert.deepEqual(r.added, ['Periapical']);
    assert.match(r.handoff_detail, /OE-2026-000123/);
});

test('orden ya creada: un estudio que el usuario ya descartó no cuenta como agregado', () => {
    const r = compare(
        { items: [{ external_id: 'ci-orden:svc:periapical', notes: null, confidence: 0.9 }] },
        { prior: { removed: ['ci-orden:svc:periapical'] } },
    );
    assert.equal(r.outcome, 'unchanged');
});

test('orden ya creada: estudio fuera del catálogo → service_not_found', () => {
    assert.equal(compare({ unmatched_text_lines: ['Resonancia de ATM'] }).handoff_reason, 'service_not_found');
});

test('orden ya creada: documento de otro paciente → patient_mismatch; el corregido por chat vale', () => {
    assert.equal(compare({ patient: { ...extraction().patient, document: '4.567.890-1' } }).handoff_reason, 'patient_mismatch');
    // La cédula se leyó mal la primera vez y el usuario la corrigió: las dos son conocidas.
    const r = compare({ patient: { ...extraction().patient, document: '1.234.567-9' } },
        { order: { ...order, documents: ['12345672', '12345679'] } });
    assert.equal(r.outcome, 'unchanged');
});

test('cita ya agendada: el dorso que agrega un estudio deriva y el detalle dice que estaba agendada', () => {
    const r = compare({ items: [{ external_id: 'ci-orden:svc:periapical', notes: null, confidence: 0.9 }] },
        { order: { ...order, booked: true } });
    assert.equal(r.handoff_reason, 'order_changed');
    assert.match(r.handoff_detail, /OE-2026-000123 ya estaba agendada/);
    assert.equal(compare({}, { order: { ...order, booked: true } }).outcome, 'unchanged');
});

test('orden ya creada: ilegible o fallo del modelo → deriva', () => {
    assert.equal(compare({ document_quality: 'unreadable' }).handoff_reason, 'unreadable');
    assert.equal(compareLateFiles({ extraction: null, extraction_error: 'timeout', catalog, order }).handoff_reason, 'system_error');
});

// ---- Borrador de la orden (lo que recepción recibe al derivar) -------------
test('derivación: guarda el borrador con lo que sí se pudo ubicar', () => {
    const r = run({ unmatched_text_lines: ['Resonancia de ATM'] });
    assert.equal(r.outcome, 'handoff');
    assert.equal(r.handoff_reason, 'service_not_found');
    assert.equal(r.resolved, null);
    assert.deepEqual(r.draft.items.map((i) => i.service_id), [1566, 1603]);
    assert.deepEqual(r.draft.unmatched, ['Resonancia de ATM']);
    assert.equal(r.draft.patient.name, 'Juan Gómez');
    assert.equal(r.draft.patient.document, '12345672');
    assert.equal(r.draft.referring_doctor_name, 'Dra. Ana Pérez');
});

test('derivación por paciente distinto: el borrador también llega', () => {
    const r = run({}, { sender: { id: 'u1', name: 'Otra Persona', phone: '+59891234567', identity_document: '4.567.890-1' } });
    assert.equal(r.handoff_reason, 'patient_mismatch');
    assert.equal(r.draft.items.length, 2);
});

test('fallo del modelo: no hay borrador', () => {
    const r = validateExtraction({ extraction: null, extraction_error: 'timeout', catalog, options, prior: {} });
    assert.equal(r.handoff_reason, 'system_error');
    assert.equal(r.draft, null);
});

test('borrador: respeta lo descartado y lo corregido por chat', () => {
    const d = buildOrderDraft({
        extraction: extraction(), catalog, options,
        prior: { removed: ['ci-orden:svc:hemiarco'], overrides: { patient_name: 'Juan Pablo Gómez', patient_document: '1.234.567-2' } },
    });
    assert.deepEqual(d.items.map((i) => i.service_id), [1566]);
    assert.equal(d.patient.name, 'Juan Pablo Gómez');
    assert.equal(d.total_duration_minutes, 10);
});

test('orden lista: lo resuelto coincide con el borrador', () => {
    const r = run();
    const d = buildOrderDraft({ extraction: extraction(), catalog, options, prior: {} });
    assert.equal(r.outcome, 'ready');
    assert.deepEqual(r.resolved.items.map((i) => i.service_id), d.items.map((i) => i.service_id));
    assert.equal(r.resolved.clinical_notes, d.clinical_notes);
    assert.equal(r.draft, undefined);
});

// ---- Confianza por dato (so-extraction-v3) ---------------------------------
// Lectura v3: cada dato con su confianza y las listas como objetos.
const extractionV3 = (over = {}) => {
    const base = extraction({
        is_study_order_confidence: 0.99,
        doctor: { name: 'Dra. Ana Pérez', name_confidence: 0.9, license: '12345', license_confidence: 0.9 },
        patient: {
            name: 'Juan Gómez', name_confidence: 0.97, document: VALID_CI, document_confidence: 0.96,
            document_type: 'cedula', birth_date: null, birth_date_confidence: 1, phone: null, phone_confidence: 1,
        },
        order_date_confidence: 0.95,
        has_signature_confidence: 0.9,
        missing_other_side_confidence: 0.95,
    });
    return { ...base, ...over };
};
const runV3 = (over = {}, inputOver = {}) => run({}, { extraction: extractionV3(over), ...inputOver });

test('esquema v3: cada dato lleva su confianza', () => {
    const s = buildExtractionSchema(catalog, options).properties;
    for (const k of ['name_confidence', 'document_confidence', 'birth_date_confidence', 'phone_confidence']) {
        assert.equal(s.patient.properties[k].type, 'number', `patient.${k}`);
    }
    for (const k of ['name_confidence', 'license_confidence']) assert.equal(s.doctor.properties[k].type, 'number', `doctor.${k}`);
    for (const k of ['is_study_order_confidence', 'order_date_confidence', 'has_signature_confidence', 'missing_other_side_confidence']) {
        assert.equal(s[k].type, 'number', k);
    }
    assert.equal(s.modifiers.items.properties.confidence.type, 'number');
    assert.equal(s.texts.items.properties.confidence.type, 'number');
    assert.equal(s.delivery_methods.items.properties.confidence.type, 'number');
    assert.equal(s.unmatched_text_lines.items.properties.confidence.type, 'number');
    assert.equal(s.regions.items.properties.teeth.items.properties.confidence.type, 'number');
    assert.match(buildSystemPrompt(catalog, options), /_confidence/);
});

test('v3: la validación guarda la confianza de cada dato, también al derivar', () => {
    const r = runV3();
    assert.equal(r.outcome, 'ready');
    const byField = Object.fromEntries(r.confidence.fields.map((f) => [f.field, f.confidence]));
    assert.equal(byField['patient.document'], 0.96);
    assert.equal(byField['doctor.license'], 0.9);
    assert.equal(byField['items.ci-orden:svc:opt'], 0.97);
    assert.equal(byField['patient.birth_date'], undefined); // null en la orden: no es un dato leído
    assert.deepEqual(r.confidence.low, []);

    const h = runV3({ unmatched_text_lines: [{ text: 'Cefalometría de Ricketts', confidence: 0.7 }] });
    assert.equal(h.handoff_reason, 'service_not_found');
    assert.match(h.handoff_detail, /Cefalometría de Ricketts/);
    assert.ok(h.confidence.low.includes('unmatched_text_lines'));
});

test('v3: documento dudoso con nombre claro → se confirma solo el documento', () => {
    const r = runV3({ patient: { ...extractionV3().patient, document_confidence: 0.6 } });
    assert.equal(r.outcome, 'needs_input');
    assert.deepEqual(r.questions.map((q) => q.code), ['confirm_patient']);
    assert.match(r.questions[0].hint, /documento/);
    assert.doesNotMatch(r.questions[0].hint, /nombre/);
});

test('v3: un documento corregido por chat no se vuelve a confirmar aunque la lectura fuera dudosa', () => {
    const r = runV3({ patient: { ...extractionV3().patient, document_confidence: 0.4 } },
        { prior: { overrides: { patient_document: VALID_CI } } });
    assert.equal(r.outcome, 'ready');
});

test('v2: sin confianza por campo se usa la del bloque del paciente', () => {
    const r = run({ patient: { name: 'Juan Gómez', document: VALID_CI, document_type: 'cedula', birth_date: null, phone: null, confidence: 0.5 } });
    assert.deepEqual(r.questions.map((q) => q.code), ['confirm_patient']);
    assert.match(r.questions[0].hint, /nombre .* y documento/);
});

test('v3: detalles dudosos no frenan la orden, pero quedan en advertencias y en las notas', () => {
    const r = runV3({
        items: [
            { external_id: 'ci-orden:svc:telerradio-perfil', notes: null, confidence: 0.95 },
            { external_id: 'ci-orden:svc:hemiarco', notes: null, confidence: 0.95 },
        ],
        modifiers: [{ service_external_id: 'ci-orden:svc:telerradio-perfil', section_code: 'RX-EXTRA', group_code: 'tecnica', option_code: 'frankfort', confidence: 0.5 }],
        regions: [{ section_code: 'CONEBEAM', teeth: [{ tooth: '36', confidence: 0.95 }, { tooth: '3.7', confidence: 0.4 }] }],
        texts: [{ code: 'aclaracion', value: 'Evaluar reabsorción', confidence: 0.9 }],
        delivery_methods: [{ code: 'imagencloud', confidence: 0.99 }],
    });
    assert.equal(r.outcome, 'ready');
    assert.deepEqual(r.resolved.regions, { CONEBEAM: ['36', '37'] });
    assert.deepEqual(r.resolved.delivery_methods, ['imagencloud']);
    const w = r.warnings.find((x) => x.code === 'low_confidence_fields');
    assert.ok(w);
    assert.deepEqual(w.fields.sort(), ['modifiers.frankfort', 'regions.CONEBEAM.3.7']);
    assert.match(r.resolved.clinical_notes, /Lectura dudosa, verificar con el original: .*Plano de Frankfort/);
});

test('collectFieldConfidence acepta listas v2 (strings) sin confianza', () => {
    const f = collectFieldConfidence(extraction({ delivery_methods: ['imagencloud'], unmatched_text_lines: ['Algo'] }), catalog, options);
    assert.equal(f.find((x) => x.field === 'delivery_methods.imagencloud').confidence, null);
    assert.equal(f.find((x) => x.field === 'unmatched_text_lines').value, 'Algo');
});

test('reenvío: si el usuario dice que no tiene otra foto, se deriva sin volver a pedirla', () => {
    const first = run({ items: [] });
    assert.deepEqual(first.questions.map((q) => q.code), ['resend']);
    const r = run({ items: [] }, { prior: { ...first.prior, overrides: { no_better_file: true } } });
    assert.equal(r.outcome, 'handoff');
    assert.equal(r.handoff_reason, 'unreadable');
    assert.match(r.handoff_detail, /no tiene otra foto/);
});

test('orden ya creada: estudios fuera del catálogo en formato v3 se leen como texto', () => {
    const r = compare({ unmatched_text_lines: [{ text: 'Modelos de estudio', confidence: 0.9 }] });
    assert.equal(r.handoff_reason, 'service_not_found');
    assert.match(r.handoff_detail, /Modelos de estudio/);
});

// ---- Puntos a revisar ------------------------------------------------------
const codes = (r) => r.review_items.map((i) => `${i.code}:${i.field}`).sort();

test('derivación: el motivo y todo lo dudoso quedan como puntos a revisar', () => {
    const r = runV3({
        patient: { ...extractionV3().patient, document_confidence: 0.6 },
        unmatched_text_lines: [{ text: 'Cefalometría de Ricketts', confidence: 0.9 }],
        regions: [{ section_code: 'CONEBEAM', teeth: [{ tooth: '99', confidence: 0.9 }] }],
        unreadable_fields: ['fecha de nacimiento'],
        has_signature: false,
    });
    assert.equal(r.handoff_reason, 'service_not_found');
    assert.deepEqual(codes(r), [
        'handoff_reason:service_not_found',
        'low_confidence:patient.document',
        'no_signature:has_signature',
        'not_in_catalog:unmatched:Cefalometría de Ricketts',
        'unplaced:unplaced:pieza "99"',
        'unreadable:unreadable:fecha de nacimiento',
    ]);
    const doc = r.review_items.find((i) => i.field === 'patient.document');
    assert.equal(doc.confidence, 0.6);
    assert.equal(doc.value, VALID_CI);
});

test('orden lista: los detalles dudosos se registran; lo confirmado por chat lo aclara', () => {
    const r = runV3({
        items: [
            { external_id: 'ci-orden:svc:opt', notes: null, confidence: 0.6 },
            { external_id: 'ci-orden:svc:telerradio-perfil', notes: null, confidence: 0.95 },
        ],
        modifiers: [{ service_external_id: 'ci-orden:svc:telerradio-perfil', section_code: 'RX-EXTRA', group_code: 'tecnica', option_code: 'frankfort', confidence: 0.5 }],
    }, { prior: { asked_confirm: ['ci-orden:svc:opt'], confirmed: ['ci-orden:svc:opt'] } });
    assert.equal(r.outcome, 'ready');
    assert.deepEqual(codes(r), ['low_confidence:items.ci-orden:svc:opt', 'low_confidence:modifiers.frankfort']);
    assert.match(r.review_items.find((i) => i.field === 'items.ci-orden:svc:opt').detail, /confirmó por chat/);
});

test('puntos a revisar: lo descartado o escrito por el paciente no se registra; una orden limpia no tiene ninguno', () => {
    assert.deepEqual(runV3().review_items, []);
    const r = runV3({
        items: [
            { external_id: 'ci-orden:svc:opt', notes: null, confidence: 0.97 },
            { external_id: 'ci-orden:svc:hemiarco', notes: null, confidence: 0.4 },
        ],
        patient: { ...extractionV3().patient, name_confidence: 0.3 },
    }, { prior: { removed: ['ci-orden:svc:hemiarco'], overrides: { patient_name: 'Juan Gómez' } } });
    assert.equal(r.outcome, 'ready');
    assert.deepEqual(r.review_items, []);
});

test('fallo del modelo: solo el motivo de la derivación', () => {
    const r = validateExtraction({ extraction: null, extraction_error: 'HTTP 500', has_files: true, catalog, options, prior: {} });
    assert.deepEqual(r.review_items.map((i) => i.code), ['handoff_reason']);
});

test('buildReviewItems: falta el dorso solo si el paciente no dijo que no hay', () => {
    const e = extraction({ missing_other_side: true });
    assert.ok(buildReviewItems({ extraction: e }).some((i) => i.code === 'possibly_incomplete'));
    assert.equal(buildReviewItems({ extraction: e, prior: { overrides: { no_other_side: true } } }).length, 0);
});

test('con preguntas pendientes también se guardan el borrador y lo dudoso (por si termina derivada)', () => {
    const r = runV3({ patient: { ...extractionV3().patient, document_confidence: 0.6 } });
    assert.equal(r.outcome, 'needs_input');
    assert.deepEqual(r.draft.items.map((i) => i.service_id), [1566, 1603]);
    assert.deepEqual(r.review_items.map((i) => i.field), ['patient.document']);
});

test('puntos a revisar: cada uno dice en qué sección del formulario está', () => {
    const r = runV3({
        items: [
            { external_id: 'ci-orden:svc:telerradio-perfil', notes: null, confidence: 0.5 },
            { external_id: 'ci-orden:svc:hemiarco', notes: null, confidence: 0.95 },
        ],
        modifiers: [{ service_external_id: 'ci-orden:svc:telerradio-perfil', section_code: null, group_code: 'tecnica', option_code: 'frankfort', confidence: 0.4 }],
        regions: [{ section_code: 'CONEBEAM', teeth: [{ tooth: '36', confidence: 0.3 }] }],
        texts: [{ code: 'aclaracion', value: 'algo', confidence: 0.2 }],
        patient: { ...extractionV3().patient, document_confidence: 0.5 },
    }, { prior: { asked_confirm: ['ci-orden:svc:telerradio-perfil'], confirmed: ['ci-orden:svc:telerradio-perfil'], asked_fields: ['confirm_patient'] } });
    const bySection = Object.fromEntries(r.review_items.map((i) => [i.field, i.section_code]));
    assert.equal(bySection['items.ci-orden:svc:telerradio-perfil'], 'RX-EXTRA');
    assert.equal(bySection['modifiers.frankfort'], 'RX-EXTRA');
    assert.equal(bySection['regions.CONEBEAM.36'], 'CONEBEAM');
    assert.equal(bySection['texts.aclaracion'], null); // texto general: va con los datos del paciente
    assert.equal(bySection['patient.document'], null);
});

// ---------------------------------------------------------------------------
// Importación desde Invoke: sin conversación, siempre en borrador
// ---------------------------------------------------------------------------
const runImport = (over = {}, inputOver = {}) =>
    validateImport({
        extraction: extraction(over), has_files: true, catalog, options,
        doc_matches: [], open_orders: [], config: { min_confidence: 0.85 },
        ...inputOver,
    });
const reviewKeys = (r) => r.review_items.map((i) => `${i.code}|${i.field}`);

test('importación: orden limpia → borrador sin puntos a revisar y paciente a registrar', () => {
    const r = runImport();
    assert.equal(r.outcome, 'draft');
    assert.deepEqual(r.review_items, []);
    assert.equal(r.patient.status, 'register');
    assert.equal(r.patient.document, '12345672');
    assert.deepEqual(r.draft.items.map((i) => i.service_id), [1566, 1603]);
});

test('importación: nunca pregunta ni deriva; lo dudoso queda como punto a revisar', () => {
    const r = runImport({
        items: [{ external_id: 'ci-orden:svc:opt', notes: null, confidence: 0.4 }],
        missing_other_side: true,
        unmatched_text_lines: [{ text: 'Cefalometría de Ricketts', confidence: 0.9 }],
    });
    assert.equal(r.outcome, 'draft');
    assert.equal(r.questions, undefined);
    assert.ok(reviewKeys(r).includes('low_confidence|items.ci-orden:svc:opt'));
    assert.ok(reviewKeys(r).includes('possibly_incomplete|missing_other_side'));
    assert.ok(reviewKeys(r).includes('not_in_catalog|unmatched:Cefalometría de Ricketts'));
    // Lo que sí se pudo ubicar está en el borrador.
    assert.deepEqual(r.draft.items.map((i) => i.service_id), [1566]);
});

test('importación: el paciente se busca solo por documento', () => {
    const one = runImport({}, { doc_matches: [{ id: 'u1', identity_document: '1234567-2' }] });
    assert.equal(one.patient.status, 'existing');
    assert.equal(one.patient.patient_id, 'u1');

    const many = runImport({}, { doc_matches: [
        { id: 'u1', identity_document: '1234567-2' }, { id: 'u2', identity_document: '1.234.567-2' },
    ] });
    assert.equal(many.patient.patient_id, null);
    assert.ok(reviewKeys(many).includes('patient_match|patient.document'));
});

test('importación: falta el nombre o la cédula es inválida → punto a revisar, sin duplicar la lectura dudosa', () => {
    const r = runImport({ patient: { name: null, document: '1.234.567-3', document_type: 'cedula', document_confidence: 0.5, name_confidence: 0.9 } });
    assert.ok(reviewKeys(r).includes('unreadable|patient.name'));
    assert.ok(reviewKeys(r).includes('invalid_document|patient.document'));
    assert.ok(!reviewKeys(r).includes('low_confidence|patient.document'));
    assert.equal(r.patient.status, 'unresolved');
});

test('importación: fallo del modelo o archivo que no es una orden → borrador con el motivo', () => {
    const failed = runImport({}, { extraction: null, extraction_error: 'timeout' });
    assert.equal(failed.outcome, 'draft');
    assert.equal(failed.draft, null);
    assert.deepEqual(reviewKeys(failed), ['read_failed|extraction']);

    const notOrder = runImport({ is_study_order: false, items: [] });
    assert.ok(reviewKeys(notOrder).includes('read_failed|is_study_order'));
    assert.ok(reviewKeys(notOrder).includes('unreadable|items'));
});

test('importación: orden abierta con los mismos estudios se marca como posible duplicado', () => {
    const r = runImport({}, {
        doc_matches: [{ id: 'u1', identity_document: '12345672' }],
        open_orders: [{ id: 'o1', order_number: 'OE-2026-000010', service_ids: [1603, 1566] }],
    });
    assert.deepEqual(r.duplicate_of, { id: 'o1', order_number: 'OE-2026-000010' });
    assert.ok(reviewKeys(r).includes('duplicate|duplicate_of'));
});

test('importación: el cuerpo del borrador lleva el intake, el paciente y los estudios', () => {
    const v = runImport({}, { doc_matches: [{ id: 'u1', identity_document: '12345672' }] });
    const p = buildImportOrderPayload({ validation: v, intake_id: 'i-1', fallback_name: 'Sin nombre' });
    assert.equal(p.without_doctor, true);
    assert.equal(p.source_intake_id, 'i-1');
    assert.equal(p.patient_id, 'u1');
    assert.equal(p.patient_name, 'Juan Gómez');
    assert.equal(p.referring_doctor_name, 'Dra. Ana Pérez');
    assert.deepEqual(p.items.map((i) => i.service_id), ['1566', '1603']);

    const empty = buildImportOrderPayload({
        validation: runImport({}, { extraction: null, extraction_error: 'x' }), intake_id: 'i-2', fallback_name: 'Sin nombre',
    });
    assert.equal(empty.patient_name, 'Sin nombre');
    assert.deepEqual(empty.items, []);
});

// ---------------------------------------------------------------------------
// Ubicación de cada dato en los originales (v4)
// ---------------------------------------------------------------------------
const at = (file, box = { top: 100, left: 200, bottom: 150, right: 600 }, extra = {}) =>
    ({ file, page: 1, box, zone: 'Datos del paciente', quote: 'C.I. 1.234.567-2', ...extra });

test('esquema v4: cada dato lleva su ubicación y los archivos son un enum', () => {
    const schema = buildExtractionSchema(catalog, options, [{ attachment_id: 41 }, { attachment_id: 42 }]);
    const def = schema.$defs.source.anyOf[0];
    assert.deepEqual(def.properties.file.enum, ['41', '42']);
    assert.deepEqual(schema.$defs.source.anyOf[1], { type: 'null' });
    const ref = { $ref: '#/$defs/source' };
    assert.deepEqual(schema.properties.patient.properties.document_source, ref);
    assert.deepEqual(schema.properties.doctor.properties.name_source, ref);
    assert.deepEqual(schema.properties.order_date_source, ref);
    for (const list of ['items', 'modifiers', 'regions', 'texts', 'delivery_methods', 'unmatched_text_lines', 'unreadable_fields']) {
        assert.deepEqual(schema.properties[list].items.properties.source, ref, list);
    }
    // Sin archivos conocidos (p. ej. la medición offline) el id es texto libre.
    assert.equal(buildExtractionSchema(catalog, options).$defs.source.anyOf[0].properties.file.enum, undefined);
});

test('prompt v4: explica cómo ubicar cada dato', () => {
    const p = buildSystemPrompt(catalog, options);
    assert.match(p, /UBICACIÓN DE CADA DATO/);
    assert.match(p, /0 a 1000/);
});

test('sourceOf: normaliza, descarta recuadros inválidos y es idempotente', () => {
    const s = sourceOf(at(41, { top: 120.4, left: -5, bottom: 1200, right: 600 }));
    assert.deepEqual(s, { attachment_id: '41', page: 1, box: { top: 120, left: 0, bottom: 1000, right: 600 }, zone: 'Datos del paciente', quote: 'C.I. 1.234.567-2' });
    assert.deepEqual(sourceOf(s), s);
    // Al revés o incompleto: sin recuadro, pero se conservan archivo, zona y cita.
    assert.equal(sourceOf(at(41, { top: 500, left: 0, bottom: 400, right: 100 })).box, null);
    assert.equal(sourceOf(at(41, { top: 1, left: 2, bottom: null, right: 4 })).box, null);
    assert.equal(sourceOf(at(41, null, { page: 0 })).page, 1);
    assert.equal(sourceOf(null), null);
    assert.equal(sourceOf({ file: '', page: 1, box: null, zone: '', quote: '' }), null);
});

test('confianza por dato: cada campo lleva dónde se leyó', () => {
    const fields = collectFieldConfidence(extraction({
        patient: { name: 'Juan Gómez', name_confidence: 0.9, name_source: at(41), document: VALID_CI, document_confidence: 0.6, document_source: at(41), document_type: 'cedula', birth_date: null, phone: null },
        items: [{ external_id: 'ci-orden:svc:opt', notes: null, confidence: 0.5, source: at(42, null, { zone: 'Extraorales', quote: 'Panorámica' }) }],
        regions: [{ section_code: 'CONEBEAM', teeth: [{ tooth: '36', confidence: 0.6 }, { tooth: '37', confidence: 0.9 }], source: at(42) }],
        unmatched_text_lines: [{ text: 'Estudio raro', confidence: 0.8, source: at(42) }],
    }), catalog, options);
    const byField = Object.fromEntries(fields.map((f) => [f.field, f.source]));
    assert.equal(byField['patient.document'].attachment_id, '41');
    assert.equal(byField['items.ci-orden:svc:opt'].box, null);
    assert.equal(byField['items.ci-orden:svc:opt'].quote, 'Panorámica');
    assert.equal(byField['regions.CONEBEAM.36'].attachment_id, '42');
    assert.equal(byField['regions.CONEBEAM.37'].attachment_id, '42');
    assert.equal(byField.unmatched_text_lines.attachment_id, '42');
    assert.equal(byField.is_study_order, null);
});

test('puntos a revisar: la lectura dudosa, el dato ilegible y el estudio fuera del catálogo llevan su ubicación', () => {
    const r = run({
        items: [{ external_id: 'ci-orden:svc:opt', notes: null, confidence: 0.5, source: at(42) }],
        unmatched_text_lines: [{ text: 'Estudio raro', confidence: 0.8, source: at(41, null, { quote: 'Estudio raro' }) }],
        unreadable_fields: [{ field: 'teléfono', source: at(41) }],
    });
    const bySrc = Object.fromEntries(r.review_items.map((i) => [`${i.code}|${i.field}`, i.source]));
    assert.equal(bySrc['low_confidence|items.ci-orden:svc:opt'].attachment_id, '42');
    assert.equal(bySrc['not_in_catalog|unmatched:Estudio raro'].quote, 'Estudio raro');
    assert.equal(bySrc['unreadable|unreadable:teléfono'].attachment_id, '41');
    assert.equal(bySrc['handoff_reason|service_not_found'], null);
});

test('ilegibles: se aceptan los strings de v3 y los objetos de v4', () => {
    const v3 = run({ unreadable_fields: ['firma'] }, { prior: {} });
    const v4 = run({ unreadable_fields: [{ field: 'firma', source: at(41) }] });
    for (const r of [v3, v4]) assert.ok(r.warnings.some((w) => w.code === 'unreadable_fields' && w.detail === 'firma'));
});

test('importación: la cédula inválida apunta a dónde está escrita', () => {
    const r = runImport({
        patient: { name: 'Juan Gómez', name_confidence: 0.95, document: '1.234.567-3', document_confidence: 0.95, document_source: at(41), document_type: 'cedula', birth_date: null, phone: null },
    });
    const item = r.review_items.find((i) => i.code === 'invalid_document');
    assert.equal(item.source.attachment_id, '41');
    assert.equal(item.source.box.top, 100);
});
