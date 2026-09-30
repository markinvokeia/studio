#!/usr/bin/env node
/**
 * eval-extraction.mjs
 * ---------------------------------------------------------------------------
 * Mide qué tan bien lee órdenes el modelo de visión, SIN n8n ni WhatsApp: es la
 * compuerta de la Fase 3 (docs/whatsapp-ordenes-estudio-plan.md). Usa el mismo
 * esquema, prompt y validador que el subflujo (intake-lib.mjs).
 *
 *   OPENAI_API_KEY=... node scripts/n8n/study-order-intake/eval-extraction.mjs \
 *       --catalog catalog.json --dir ./muestras [--model gpt-5.6-luna] [--min-confidence 0.85]
 *
 * catalog.json  { "catalog": [...], "options": [...] }  (consultas en docs/whatsapp-ordenes-estudio-plan.md, sección 14)
 *
 * Carpeta de muestras (órdenes REALES ANONIMIZADAS; no subirlas al repo):
 *   orden01.jpg            una página (jpg, png, webp o pdf)
 *   orden01__2.jpg         páginas siguientes de la misma orden
 *   orden01.expected.json  la respuesta correcta:
 *     {
 *       "outcome": "ready" | "needs_input" | "handoff",        // lo que DEBERÍA pasar
 *       "handoff_reason": "service_not_found",                  // si outcome = handoff
 *       "items": ["ci-orden:svc:opt", "ci-orden:svc:hemiarco"], // estudios que figuran
 *       "patient_document": "12345672"                          // normalizado
 *     }
 *
 * Reporta por línea (precisión y cobertura), por orden (coincidencia exacta) y si
 * la decisión de derivar coincide con la esperada. Lo más importante de mirar:
 *   - falsos positivos de estudios (se agendaría algo que no se pidió),
 *   - órdenes que debían derivarse y salieron "ready".
 * ---------------------------------------------------------------------------
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, extname, basename } from 'node:path';

import { buildExtractionSchema, buildSystemPrompt, normalizeDocument, validateExtraction } from './intake-lib.mjs';

const args = Object.fromEntries(
    process.argv.slice(2).reduce((acc, a, i, arr) => (a.startsWith('--') ? [...acc, [a.slice(2), arr[i + 1]]] : acc), []),
);
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey || !args.catalog || !args.dir) {
    console.error('Uso: OPENAI_API_KEY=... node eval-extraction.mjs --catalog catalog.json --dir ./muestras [--model M] [--min-confidence 0.85]');
    process.exit(1);
}
const model = args.model || 'gpt-5.6-luna';
const minConfidence = Number(args['min-confidence'] || 0.85);
const { catalog, options } = JSON.parse(readFileSync(args.catalog, 'utf8'));

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.pdf': 'application/pdf' };

// Agrupa "orden01.jpg", "orden01__2.jpg" bajo la clave "orden01".
const files = readdirSync(args.dir).filter((f) => MIME[extname(f).toLowerCase()]);
const groups = new Map();
for (const f of files.sort()) {
    const key = basename(f, extname(f)).replace(/__\d+$/, '');
    groups.set(key, [...(groups.get(key) || []), f]);
}

async function extract(pages) {
    const parts = [{ type: 'text', text: 'Transcribí la orden de estudios que figura en los archivos adjuntos (pueden ser varias páginas de la misma orden).' }];
    for (const f of pages) {
        const mime = MIME[extname(f).toLowerCase()];
        const dataUrl = `data:${mime};base64,${readFileSync(join(args.dir, f)).toString('base64')}`;
        parts.push(mime === 'application/pdf'
            ? { type: 'file', file: { filename: f, file_data: dataUrl } }
            : { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } });
    }
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
            model,
            messages: [{ role: 'system', content: buildSystemPrompt(catalog, options) }, { role: 'user', content: parts }],
            response_format: { type: 'json_schema', json_schema: { name: 'study_order_extraction', strict: true, schema: buildExtractionSchema(catalog, options) } },
        }),
    });
    const json = await res.json();
    if (json.error) return { error: json.error.message };
    const msg = json.choices?.[0]?.message;
    if (!msg || msg.refusal) return { error: msg?.refusal || 'sin contenido' };
    try { return { extraction: JSON.parse(msg.content), usage: json.usage }; } catch { return { error: 'JSON inválido' }; }
}

const tot = { orders: 0, exact: 0, tp: 0, fp: 0, fn: 0, decisionOk: 0, docOk: 0, docN: 0, mustHandoffMissed: 0, errors: 0 };
const rows = [];

for (const [key, pages] of groups) {
    const expectedPath = join(args.dir, `${key}.expected.json`);
    if (!existsSync(expectedPath)) { console.warn(`(sin .expected.json) ${key}`); continue; }
    const expected = JSON.parse(readFileSync(expectedPath, 'utf8'));
    tot.orders += 1;

    const r = await extract(pages);
    if (r.error) { tot.errors += 1; rows.push({ orden: key, resultado: `ERROR: ${r.error}` }); continue; }

    const v = validateExtraction({
        extraction: r.extraction, has_files: true, catalog, options,
        sender: null, phone: '', phone_ambiguous: false, doc_matches: [], open_orders: [],
        config: { min_confidence: minConfidence }, prior: {},
    });

    // Lo que el modelo leyó (antes de la validación), para medir la lectura y no la regla.
    const got = new Set((r.extraction.items || []).map((i) => i.external_id));
    const want = new Set(expected.items || []);
    const tp = [...got].filter((i) => want.has(i)).length;
    const fp = [...got].filter((i) => !want.has(i));
    const fn = [...want].filter((i) => !got.has(i));
    tot.tp += tp; tot.fp += fp.length; tot.fn += fn.length;
    const exact = fp.length === 0 && fn.length === 0;
    if (exact) tot.exact += 1;

    let docNote = '-';
    if (expected.patient_document) {
        tot.docN += 1;
        const ok = normalizeDocument(r.extraction.patient?.document) === normalizeDocument(expected.patient_document);
        if (ok) tot.docOk += 1;
        docNote = ok ? 'ok' : `MAL (${normalizeDocument(r.extraction.patient?.document) || 'vacío'})`;
    }

    // ¿La decisión del validador coincide con la esperada? (needs_input y ready cuentan como "no deriva")
    const decision = v.outcome === 'handoff' ? `handoff:${v.handoff_reason}` : v.outcome;
    const expectedDecision = expected.outcome === 'handoff' ? `handoff:${expected.handoff_reason}` : expected.outcome;
    const decisionOk = expected.outcome === 'handoff' ? decision === expectedDecision : v.outcome === expected.outcome;
    if (decisionOk) tot.decisionOk += 1;
    if (expected.outcome === 'handoff' && v.outcome === 'ready') tot.mustHandoffMissed += 1;

    rows.push({
        orden: key,
        'estudios (ok/sobran/faltan)': `${tp}/${fp.length}/${fn.length}`,
        exacta: exact ? 'sí' : 'NO',
        cédula: docNote,
        decisión: `${decision}${decisionOk ? '' : `  ← esperado ${expectedDecision}`}`,
        sobran: fp.join(', ') || '-',
        faltan: fn.join(', ') || '-',
    });
}

console.table(rows);
const pct = (a, b) => (b ? `${((100 * a) / b).toFixed(1)} %` : 'n/d');
console.log(`
Modelo: ${model}  ·  Confianza mínima: ${minConfidence}  ·  Órdenes evaluadas: ${tot.orders}  ·  Errores del modelo: ${tot.errors}
Líneas   precisión ${pct(tot.tp, tot.tp + tot.fp)}   cobertura ${pct(tot.tp, tot.tp + tot.fn)}
Órdenes  lectura exacta ${pct(tot.exact, tot.orders - tot.errors)}
Cédula   correcta ${pct(tot.docOk, tot.docN)}
Decisión coincide con la esperada ${pct(tot.decisionOk, tot.orders - tot.errors)}
*** Órdenes que debían derivarse y salieron "ready": ${tot.mustHandoffMissed} (debe ser 0) ***
`);
