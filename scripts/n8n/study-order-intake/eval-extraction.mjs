#!/usr/bin/env node
/**
 * eval-extraction.mjs
 * ---------------------------------------------------------------------------
 * Mide qué tan bien lee órdenes el modelo de visión, SIN n8n ni WhatsApp: es la
 * compuerta de la Fase 3 (docs/whatsapp-ordenes-estudio-plan.md). Usa el mismo
 * esquema, prompt y validador que el subflujo (intake-lib.mjs).
 *
 *   OPENAI_API_KEY=... node scripts/n8n/study-order-intake/eval-extraction.mjs \
 *       --catalog catalog.json --dir ./muestras [--model gpt-5.6-luna] [--min-confidence 0.85] \
 *       [--overlay revision.html]
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
 *       "patient_document": "12345672",                         // normalizado
 *       "missing_other_side": true,                             // opcional: falta el dorso u otra hoja
 *       "locations": {                                          // opcional: dónde está cada dato (v4)
 *         "patient.document": { "file": "orden01.jpg", "page": 1,
 *                               "box": { "top": 120, "left": 80, "bottom": 170, "right": 520 } },
 *         "items.ci-orden:svc:opt": { "file": "orden01.jpg", "box": { ... } }
 *       }
 *     }
 *   Los campos de "locations" son los de `collectFieldConfidence` (patient.name, items.<id>,
 *   regions.<sección>.<pieza>, texts.<código>...). El recuadro va de 0 a 1000 sobre la imagen.
 *   Un dato está bien ubicado si el centro del recuadro del modelo cae dentro del esperado
 *   (agrandado un 3 % por lado): es lo que necesita quien revisa, que el zoom caiga sobre el dato.
 *
 * --overlay revision.html: arma una página con cada imagen y los recuadros que dio el modelo
 * encima, para mirar la ubicación a ojo sin haber marcado "locations". Las imágenes van dentro del
 * HTML: es tan sensible como las muestras, no subirlo ni compartirlo.
 *   Para medir la detección del dorso faltante, armar muestras con SOLO el frente
 *   de una orden de dos caras y "missing_other_side": true.
 *
 * Reporta por línea (precisión y cobertura), por orden (coincidencia exacta) y si
 * la decisión de derivar coincide con la esperada. Lo más importante de mirar:
 *   - falsos positivos de estudios (se agendaría algo que no se pidió),
 *   - órdenes que debían derivarse y salieron "ready".
 * ---------------------------------------------------------------------------
 */
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { join, extname, basename } from 'node:path';

import { buildExtractionSchema, buildSystemPrompt, collectFieldConfidence, normalizeDocument, validateExtraction } from './intake-lib.mjs';

const args = Object.fromEntries(
    process.argv.slice(2).reduce((acc, a, i, arr) => (a.startsWith('--') ? [...acc, [a.slice(2), arr[i + 1]]] : acc), []),
);
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey || !args.catalog || !args.dir) {
    console.error('Uso: OPENAI_API_KEY=... node eval-extraction.mjs --catalog catalog.json --dir ./muestras [--model M] [--min-confidence 0.85] [--overlay revision.html]');
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
    // Igual que el subflujo: cada archivo precedido de su id (acá, el nombre del archivo).
    for (const f of pages) {
        const mime = MIME[extname(f).toLowerCase()];
        const dataUrl = `data:${mime};base64,${readFileSync(join(args.dir, f)).toString('base64')}`;
        parts.push({ type: 'text', text: `ARCHIVO ${f}${mime === 'application/pdf' ? ' (PDF, varias páginas posibles)' : ' (imagen)'}` });
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
            response_format: { type: 'json_schema', json_schema: { name: 'study_order_extraction', strict: true, schema: buildExtractionSchema(catalog, options, pages.map((f) => ({ attachment_id: f }))) } },
        }),
    });
    const json = await res.json();
    if (json.error) return { error: json.error.message };
    const msg = json.choices?.[0]?.message;
    if (!msg || msg.refusal) return { error: msg?.refusal || 'sin contenido' };
    try { return { extraction: JSON.parse(msg.content), usage: json.usage }; } catch { return { error: 'JSON inválido' }; }
}

const tot = {
    orders: 0, exact: 0, tp: 0, fp: 0, fn: 0, decisionOk: 0, docOk: 0, docN: 0, sideOk: 0, sideN: 0, mustHandoffMissed: 0, errors: 0,
    fields: 0, withFile: 0, withBox: 0, locN: 0, locOk: 0, locFileOk: 0,
};
const rows = [];
const overlays = [];

/** Centro del recuadro del modelo dentro del esperado (con 3 % de margen por lado). */
const centerInside = (got, want) => {
    const m = 30;
    const cy = (got.top + got.bottom) / 2;
    const cx = (got.left + got.right) / 2;
    return cy >= want.top - m && cy <= want.bottom + m && cx >= want.left - m && cx <= want.right + m;
};
const DOC_JUDGEMENTS = new Set(['is_study_order', 'has_signature', 'missing_other_side']);

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

    let sideNote = '-';
    if (typeof expected.missing_other_side === 'boolean') {
        tot.sideN += 1;
        const ok = (r.extraction.missing_other_side === true) === expected.missing_other_side;
        if (ok) tot.sideOk += 1;
        sideNote = ok ? 'ok' : `MAL (${r.extraction.missing_other_side === true ? 'dijo que falta' : 'no lo notó'})`;
    }

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

    // Ubicación (v4): cuántos datos traen archivo y recuadro y, si hay "locations", si caen bien.
    const fields = collectFieldConfidence(r.extraction, catalog, options).filter((f) => !DOC_JUDGEMENTS.has(f.field));
    tot.fields += fields.length;
    tot.withFile += fields.filter((f) => f.source && f.source.attachment_id).length;
    tot.withBox += fields.filter((f) => f.source && f.source.box).length;
    let locNote = '-';
    if (expected.locations && typeof expected.locations === 'object') {
        let n = 0;
        let ok = 0;
        for (const [field, want] of Object.entries(expected.locations)) {
            const got = fields.find((f) => f.field === field);
            if (!got || !want || !want.box) continue;
            n += 1;
            const src = got.source;
            const fileOk = !!src && src.attachment_id === want.file && (src.page || 1) === (want.page || 1);
            if (fileOk) tot.locFileOk += 1;
            if (fileOk && src.box && centerInside(src.box, want.box)) ok += 1;
        }
        tot.locN += n;
        tot.locOk += ok;
        locNote = n ? `${ok}/${n}` : '-';
    }
    overlays.push({ key, pages, fields });

    rows.push({
        orden: key,
        ubicación: locNote,
        'estudios (ok/sobran/faltan)': `${tp}/${fp.length}/${fn.length}`,
        exacta: exact ? 'sí' : 'NO',
        cédula: docNote,
        'otra cara': sideNote,
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
Otra cara detectada bien ${pct(tot.sideOk, tot.sideN)}
Decisión coincide con la esperada ${pct(tot.decisionOk, tot.orders - tot.errors)}
*** Órdenes que debían derivarse y salieron "ready": ${tot.mustHandoffMissed} (debe ser 0) ***
Ubicación  datos con archivo ${pct(tot.withFile, tot.fields)}   con recuadro ${pct(tot.withBox, tot.fields)}
           bien ubicados (centro dentro del esperado) ${pct(tot.locOk, tot.locN)}   archivo y página correctos ${pct(tot.locFileOk, tot.locN)}
`);

if (args.overlay) {
    const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const sections = overlays.map(({ key, pages, fields }) => {
        const imgs = pages.filter((f) => MIME[extname(f).toLowerCase()] !== 'application/pdf').map((f) => {
            const mime = MIME[extname(f).toLowerCase()];
            const boxes = fields.filter((x) => x.source && x.source.attachment_id === f && x.source.box).map((x) => {
                const b = x.source.box;
                const low = x.confidence !== null && x.confidence < minConfidence;
                return `<div class="box${low ? ' low' : ''}" style="top:${b.top / 10}%;left:${b.left / 10}%;height:${(b.bottom - b.top) / 10}%;width:${(b.right - b.left) / 10}%"><span>${esc(x.label)}</span></div>`;
            }).join('');
            return `<figure><figcaption>${esc(f)}</figcaption><div class="img"><img src="data:${mime};base64,${readFileSync(join(args.dir, f)).toString('base64')}">${boxes}</div></figure>`;
        }).join('');
        const list = fields.map((x) => `<li>${esc(x.label)}: <b>${esc(x.value)}</b> · ${x.confidence ?? '-'} · ${esc(x.source?.attachment_id ?? 'sin archivo')} p${x.source?.page ?? '-'} · ${x.source?.box ? 'recuadro' : 'SIN recuadro'} · ${esc(x.source?.zone ?? '')} · “${esc(x.source?.quote ?? '')}”</li>`).join('');
        return `<section><h2>${esc(key)}</h2>${imgs}<ul>${list}</ul></section>`;
    }).join('');
    writeFileSync(args.overlay, `<!doctype html><meta charset="utf-8"><title>Ubicación por dato · ${esc(model)}</title>
<style>body{font:14px system-ui;margin:16px}figure{margin:0 0 12px}.img{position:relative;display:inline-block;max-width:100%}.img img{display:block;max-width:100%}
.box{position:absolute;border:2px solid #2563eb;background:#2563eb22}.box.low{border-color:#d97706;background:#d9770633}.box span{position:absolute;top:-18px;left:0;font-size:11px;background:#fff;padding:0 3px;white-space:nowrap}
li{margin:2px 0}</style><h1>Ubicación por dato · ${esc(model)}</h1>${sections}`);
    console.log(`Recuadros dibujados en ${args.overlay} (contiene las imágenes: no compartirlo).`);
}
