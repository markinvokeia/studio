#!/usr/bin/env node
/**
 * Parsea el Manual de Trabajo por Rol y genera help_invokeia/questions.json.
 *
 * El manual es la fuente de verdad de QUÉ preguntas existen; este script nunca
 * inventa preguntas ni decide por su cuenta cuáles se filman: la clasificación
 * heurística que propone se sobreescribe a mano en filmability.overrides.json.
 *
 *   node help_invokeia/scripts/parse-manual.mjs
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(ROOT, 'manual-rol.source.md');
const OUT = path.join(ROOT, 'questions.json');
const OVERRIDES = path.join(ROOT, 'filmability.overrides.json');

// ── slug ────────────────────────────────────────────────────────────────────
/** Título → slug estable. Se congela tras la primera generación (ver slug drift). */
function slugify(title) {
  return title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[¿?¡!.,:;«»"'()]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
}

// ── heurísticas de filmabilidad ─────────────────────────────────────────────
// Proponen una categoría; la decisión final vive en filmability.overrides.json.
// Criterio: ser generoso con `ui`. Un falso positivo se corrige mirando el video;
// un falso negativo (marcar conceptual algo filmable) se pierde en silencio.

/** Canal realmente fuera del navegador: el paso clave no ocurre en la app. */
const OUT_OF_BAND =
  /correo con un enlace|enlace de un solo uso|enlace de restablecimiento|c[óo]digo de (6|seis) d[íi]gitos|c[óo]digo de acceso|c[óo]digo de verificaci[óo]n/i;

/** Verbos que implican escritura en la base. Imprimir/exportar NO son mutación. */
const MUTATING =
  /\b(cre[aá]r?|agreg[aá]r?|elimin[aá]r?|borr[aá]r?|registr[aá]r?|emit[ií]r?|guard[aá]r?|anul[aá]r?|confirm[aá]r?|factur[aá]r?|cobr[aá]r?|asign[aá]r?|reagend[aá]r?|cancel[aá]r?|dar de alta|abr[ií]r? (la|una) (caja|sesi[óo]n)|cerr[aá]r? (la|una) (caja|sesi[óo]n))\b/i;

/**
 * Señales de que hay algo concreto que mostrar en pantalla. El manual marca en
 * negrita los nombres literales de botones, pestañas y menús, así que `**X**`
 * es el indicador más fiable de que existe un recorrido filmable.
 */
const UI_AFFORDANCE =
  /\*\*[^*]+\*\*|→|`\/[a-z0-9-]|\b(bot[óo]n|pesta[ñn]a|men[úu]|pantalla|conmutador|[íi]cono|campo|casilla|di[áa]logo|panel|columna|filtro|listado|formulario|selector|interruptor)\b/i;

function classify({ partN, title, body }) {
  if (partN === 7) {
    return ['diagnostic', 'PARTE 7 es diagnóstico: hay que reproducir un estado roto para filmarlo'];
  }
  if (partN === 6) {
    return [
      'setup-heavy',
      'Portal del Paciente: filmable solo si se activa «El portal es sólo para reservar citas», que saltea el código por email',
    ];
  }
  if (OUT_OF_BAND.test(body)) {
    return ['out-of-band', 'el paso clave llega por email (enlace o código); solo se filma el tramo in-app'];
  }
  if (MUTATING.test(body)) return ['ui-mutating', 'el flujo escribe en la base de datos de DEV'];
  if (UI_AFFORDANCE.test(body)) return ['ui', 'recorrido de solo lectura sobre la interfaz'];
  return ['conceptual', 'la respuesta es una explicación: no hay recorrido que mostrar'];
}

// ── extracción de metadatos del cuerpo ──────────────────────────────────────
const rePermission = /`([A-Z][A-Z0-9_]{3,})`/g;
const reRoute = /`(\/[a-z0-9\-/[\]]*)`/g;

function extract(body) {
  const permissions = [...new Set([...body.matchAll(rePermission)].map((m) => m[1]))];
  const routes = [...new Set([...body.matchAll(reRoute)].map((m) => m[1]))];
  const seeAlso = [...body.matchAll(/\*Ver también: (.+?)\*/g)].map((m) => m[1].trim());
  return {
    permissions,
    routes,
    seeAlso,
    hasImagePlaceholder: /> \*\*IMAGEN/.test(body),
  };
}

// ── parseo ──────────────────────────────────────────────────────────────────
function parse(md) {
  const lines = md.split('\n');
  const questions = [];
  let part = { n: null, title: 'SIN PARTE' };
  let section = null;
  let current = null;
  const bodyOf = [];

  const flush = () => {
    if (!current) return;
    const body = bodyOf.join('\n').trim();
    const [filmability, reason] = classify({ partN: part.n, title: current.title, body });
    questions.push({ ...current, ...extract(body), filmability, filmabilityReason: reason });
    bodyOf.length = 0;
  };

  lines.forEach((line, i) => {
    const h1 = /^# (.+)$/.exec(line);
    if (h1) {
      flush();
      current = null;
      const p = /^PARTE (\d+) — (.+)$/.exec(h1[1].trim());
      part = p ? { n: Number(p[1]), title: p[2].trim() } : { n: null, title: h1[1].trim() };
      section = null;
      return;
    }
    const h2 = /^## (.+)$/.exec(line);
    if (h2) {
      flush();
      current = null;
      section = h2[1].trim();
      return;
    }
    const h3 = /^### (.+?)\s*\{#(q\d{3})\}\s*$/.exec(line);
    if (h3) {
      flush();
      current = {
        id: h3[2],
        slug: slugify(h3[1]),
        title: h3[1].trim(),
        part: { ...part },
        section: section ?? '(sin subsección)',
        sourceLine: i + 1,
      };
      return;
    }
    if (current) bodyOf.push(line);
  });
  flush();
  return questions;
}

// ── main ────────────────────────────────────────────────────────────────────
const md = fs.readFileSync(SOURCE, 'utf8');
const parsed = parse(md);

const overrides = fs.existsSync(OVERRIDES) ? JSON.parse(fs.readFileSync(OVERRIDES, 'utf8')) : {};
const previous = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : null;
const prevById = new Map((previous?.questions ?? []).map((q) => [q.id, q]));

const drift = [];
const questions = parsed.map((q) => {
  const prev = prevById.get(q.id);
  // El slug se congela: renombrarlo rompería los enlaces de Drive ya publicados.
  if (prev && prev.slug !== q.slug) {
    drift.push(`${q.id}: "${prev.slug}" → "${q.slug}" (se conserva el anterior)`);
  }
  const slug = prev?.slug ?? q.slug;
  const ov = overrides[q.id];
  return {
    ...q,
    slug,
    filmability: ov?.filmability ?? q.filmability,
    filmabilityReason: ov?.reason ?? q.filmabilityReason,
    filmabilitySource: ov ? 'override' : 'heuristic',
    status: prev?.status ?? 'pending',
    video: `${q.id}-${slug}.webm`,
  };
});

const ids = questions.map((q) => q.id);
const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
if (dupes.length) throw new Error(`Ids duplicados en el manual: ${[...new Set(dupes)].join(', ')}`);

fs.writeFileSync(
  OUT,
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      source: path.basename(SOURCE),
      sourceSha256: crypto.createHash('sha256').update(md).digest('hex'),
      questions,
    },
    null,
    2,
  )}\n`,
);

// ── informe ─────────────────────────────────────────────────────────────────
const byCategory = questions.reduce((acc, q) => {
  acc[q.filmability] = (acc[q.filmability] || 0) + 1;
  return acc;
}, {});

console.log(`✓ ${questions.length} preguntas → ${path.relative(process.cwd(), OUT)}\n`);
console.log('Clasificación propuesta (heurística + overrides):');
for (const [k, v] of Object.entries(byCategory).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(v).padStart(4)}  ${k}`);
}
const filmable = questions.filter((q) => ['ui', 'ui-mutating', 'setup-heavy'].includes(q.filmability));
console.log(`\n  ${filmable.length} filmables · ${questions.length - filmable.length} sin video`);
console.log(`  ${questions.filter((q) => q.filmabilitySource === 'override').length} con override manual`);
if (drift.length) {
  console.log(`\n⚠ slug drift (títulos cambiados en el manual):`);
  drift.forEach((d) => console.log(`   ${d}`));
}
