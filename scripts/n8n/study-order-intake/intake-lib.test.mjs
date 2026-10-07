/**
 * Pruebas del validador y del esquema de extracción.
 *   node --test scripts/n8n/study-order-intake/
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    buildExtractionSchema, buildSystemPrompt, isValidCedulaUY, normalizeDocument,
    similarNames, validateExtraction, compareLateFiles,
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

const run = (over = {}, inputOver = {}) =>
    validateExtraction({
        extraction: extraction(over), has_files: true, catalog, options,
        sender: null, phone: '+59891234567', phone_ambiguous: false,
        doc_matches: [], open_orders: [], config: { min_confidence: 0.85 }, prior: {},
        ...inputOver,
    });

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
    };
    check(schema);
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
        extraction: e, has_files: true, catalog, options, sender: null, phone: '+59891234567',
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
