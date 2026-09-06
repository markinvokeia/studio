#!/usr/bin/env node
/**
 * generate-study-order-options.mjs
 * ---------------------------------------------------------------------------
 * Emite el bloque SQL que siembra `public.study_order_options` — el catálogo de
 * modificadores, textos, odontogramas y medios de entrega del formulario de
 * orden de estudio.
 *
 * La fuente es scripts/sql/orden-mapping.json, que a su vez sale del formulario
 * real (scripts/generate-service-catalog.mjs). Nada se escribe a mano: si el
 * formulario cambia, se regenera el mapping y se vuelve a correr esto.
 *
 * Las 104 piezas dentarias NO se siembran: son ISO 3950, un estándar, y se
 * generan en el front. Sembrarlas sería inventar un catálogo.
 *
 *   node scripts/generate-study-order-options.mjs > /tmp/options.sql
 * ---------------------------------------------------------------------------
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const map = JSON.parse(readFileSync(join(ROOT, 'scripts/sql/orden-mapping.json'), 'utf8'));

const lit = (v) => (v === null || v === undefined || v === '' ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);

/** La nota del mapping ya dice a qué grupo pertenece cada modificador. */
const GROUP_BY_NOTE = {
  'técnica de toma': 'tecnica',
  'arcada': 'arcada',
  'espesor': 'espesor',
  'borde': 'borde',
  'indicación clínica': 'indicacion_clinica',
};
const groupOf = (note) => GROUP_BY_NOTE[note] ?? null;

/** Sección (código de miscellaneous_categories) por nombre de categoría. */
const SECTION_BY_CATEGORY = Object.fromEntries(
  map.categories.map((c) => [c.name, c.code]),
);

const rows = [];
let order = 0;

// ── Modificadores atados a un servicio ───────────────────────────────────────
for (const svc of map.services) {
  for (const m of svc.modifiers ?? []) {
    rows.push({
      kind: 'modifier', code: m.field, label: m.label,
      section: svc.category_code, serviceExt: `ci-orden:svc:${svc.field}`,
      group: groupOf(m.note), input: 'checkbox', order: order++,
    });
  }
}

// ── Modificadores de sección (Cone Beam) ─────────────────────────────────────
for (const sec of map.section_modifiers ?? []) {
  const sectionCode = SECTION_BY_CATEGORY[sec.applies_to_section]
    ?? map.categories.find((c) => c.name.includes('Cone Beam'))?.code;
  for (const m of sec.modifiers ?? []) {
    rows.push({
      kind: 'modifier', code: m.field, label: m.label,
      section: sectionCode, serviceExt: null,
      group: groupOf(m.note), input: 'checkbox', order: order++,
    });
  }
}

// ── Campos de texto libre ────────────────────────────────────────────────────
const LONG_TEXT = new Set(['ortodoncia-info-clinica', 'interes-estudio-tomo', 'aclaracion']);
const DATE_FIELD = new Set(['implante-fecha-cirugia']);
for (const t of map.text_options ?? []) {
  rows.push({
    // La sección sale de la posición del campo en el formulario, resuelta por
    // generate-service-catalog.mjs. `null` = campo de cabecera (la aclaración).
    kind: 'text', code: t.field, label: t.label,
    section: t.section_code ?? null, serviceExt: null, group: null,
    input: DATE_FIELD.has(t.field) ? 'date' : LONG_TEXT.has(t.field) ? 'textarea' : 'text',
    order: order++,
  });
}

// ── Medio de entrega ─────────────────────────────────────────────────────────
for (const d of map.delivery ?? []) {
  rows.push({
    kind: 'delivery', code: d.field, label: d.label,
    section: null, serviceExt: null, group: null, input: 'checkbox', order: order++,
  });
}

// ── Odontogramas ─────────────────────────────────────────────────────────────
const intra = map.categories.find((c) => c.name.includes('intrabucales'))?.code;
const cone  = map.categories.find((c) => c.name.includes('Cone Beam'))?.code;
rows.push({ kind: 'region_group', code: 'intraoral_odontogram', label: 'Indique región de interés',
            section: intra, serviceExt: null, group: null, input: 'checkbox', order: order++ });
rows.push({ kind: 'region_group', code: 'conebeam_odontogram', label: 'Indique región de interés',
            section: cone, serviceExt: null, group: null, input: 'checkbox', order: order++ });

// ── Emisión ──────────────────────────────────────────────────────────────────
const out = [];
out.push('-- Generado por scripts/generate-study-order-options.mjs');
out.push(`-- Fuente: scripts/sql/orden-mapping.json (${map._meta.source})`);
out.push(`-- ${rows.length} opciones: ` + ['modifier', 'text', 'delivery', 'region_group']
  .map((k) => `${rows.filter((r) => r.kind === k).length} ${k}`).join(' · '));
out.push('');

for (const r of rows) {
  const ext = lit(`ci-orden:opt:${r.code}`);
  if (r.serviceExt) {
    out.push(`INSERT INTO public.study_order_options`);
    out.push(`       (option_kind, code, label, section_code, service_id, group_code, input_type, sort_order, external_id)`);
    out.push(`SELECT ${lit(r.kind)}, ${lit(r.code)}, ${lit(r.label)}, ${lit(r.section)}, sc.id, ${lit(r.group)}, ${lit(r.input)}, ${r.order}, ${ext}`);
    out.push(`  FROM public.service_catalog sc WHERE sc.external_id = ${lit(r.serviceExt)}`);
    out.push(`ON CONFLICT (external_id) DO NOTHING;`);
  } else {
    out.push(`INSERT INTO public.study_order_options`);
    out.push(`       (option_kind, code, label, section_code, service_id, group_code, input_type, sort_order, external_id)`);
    out.push(`VALUES (${lit(r.kind)}, ${lit(r.code)}, ${lit(r.label)}, ${lit(r.section)}, NULL, ${lit(r.group)}, ${lit(r.input)}, ${r.order}, ${ext})`);
    out.push(`ON CONFLICT (external_id) DO NOTHING;`);
  }
}
console.log(out.join('\n'));
