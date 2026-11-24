#!/usr/bin/env node
/**
 * Verifica que las traducciones estén completas en todos los locales.
 *
 *   node scripts/i18n/check-translations.mjs            # working tree vs HEAD
 *   node scripts/i18n/check-translations.mjs --staged   # lo que está en el index (pre-commit)
 *   node scripts/i18n/check-translations.mjs --all      # además audita placeholders de TODAS las claves
 *
 * Errores (bloquean):
 *   - Algún src/messages/*.json no es JSON válido.
 *   - Los archivos base no tienen exactamente el mismo set de claves
 *     (clave agregada/borrada en uno y no en los otros).
 *   - Una clave agregada o modificada usa distintos placeholders ICU ({name},
 *     {count, plural, ...}) o distintas etiquetas rich-text (<b>…</b>) entre locales.
 *   - Un override de cliente define una clave que no existe en la base.
 *
 * Avisos (no bloquean):
 *   - Una clave cambió de valor en un locale pero no en los demás.
 *   - Cambió una clave base que un cliente sobreescribe y el override no se tocó.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const args = new Set(process.argv.slice(2));
const STAGED = args.has('--staged');
const ALL = args.has('--all');

const ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const MESSAGES = 'src/messages';
const OVERRIDES = `${MESSAGES}/overrides`;

// ── lectura de archivos (index / working tree / HEAD) ─────────────────────────

function gitShow(spec) {
  try {
    return execFileSync('git', ['show', spec], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
}

function listFiles(dir) {
  if (STAGED) {
    const out = execFileSync('git', ['ls-files', '--cached', '--', dir], { cwd: ROOT, encoding: 'utf8' });
    return out.split('\n').filter(Boolean);
  }
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  const res = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else res.push(path.relative(ROOT, p).split(path.sep).join('/'));
    }
  };
  walk(abs);
  return res;
}

function readCurrent(rel) {
  if (STAGED) return gitShow(`:${rel}`);
  const abs = path.join(ROOT, rel);
  return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
}

const readHead = (rel) => gitShow(`HEAD:${rel}`);

// ── utilidades ────────────────────────────────────────────────────────────────

function flatten(obj, prefix = '', out = new Map()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else out.set(key, v);
  }
  return out;
}

const errors = [];
const warnings = [];

function parse(rel, text) {
  if (text == null) return null;
  try {
    return flatten(JSON.parse(text.replace(/^﻿/, '')));
  } catch (e) {
    errors.push(`${rel}: JSON inválido (${e.message})`);
    return null;
  }
}

/**
 * Devuelve los nombres de argumentos ICU y las etiquetas rich-text de un mensaje.
 * Parser mínimo: entiende {arg}, {arg, type}, {arg, plural|select|selectordinal, x {…} y {…}},
 * el escape con apóstrofos de ICU y <tag>…</tag>.
 */
function signature(value) {
  const argNames = new Set();
  const tags = new Set();
  if (typeof value !== 'string') {
    if (Array.isArray(value)) value.forEach((v) => mergeSig(signature(v)));
    return { args: argNames, tags };
  }
  function mergeSig(s) {
    s.args.forEach((a) => argNames.add(a));
    s.tags.forEach((t) => tags.add(t));
  }

  const s = value;
  let i = 0;

  // Lee texto de mensaje hasta el '}' que cierra (o fin de string).
  function message(inPlural) {
    while (i < s.length) {
      const c = s[i];
      if (c === "'") {
        // '' → apóstrofo literal; '{…}' → texto literal
        if (s[i + 1] === "'") { i += 2; continue; }
        if (s[i + 1] === '{' || s[i + 1] === '}' || s[i + 1] === '<' || (inPlural && s[i + 1] === '#')) {
          const end = s.indexOf("'", i + 1);
          i = end === -1 ? s.length : end + 1;
          continue;
        }
        i++;
        continue;
      }
      if (c === '}') return;
      if (c === '{') { i++; argument(); continue; }
      if (c === '<') {
        const m = /^<\/?([A-Za-z][\w-]*)\s*\/?>/.exec(s.slice(i));
        if (m) { tags.add(m[1]); i += m[0].length; continue; }
      }
      i++;
    }
  }

  function argument() {
    const m = /^\s*([^\s,{}]+)\s*/.exec(s.slice(i));
    if (!m) { skipBlock(); return; }
    argNames.add(m[1]);
    i += m[0].length;
    if (s[i] === '}') { i++; return; }
    if (s[i] !== ',') { skipBlock(); return; }
    i++;
    const t = /^\s*(\w+)\s*/.exec(s.slice(i));
    const type = t ? t[1] : '';
    if (t) i += t[0].length;
    if (s[i] === '}') { i++; return; }
    if (s[i] !== ',') { skipBlock(); return; }
    i++;
    if (type === 'plural' || type === 'select' || type === 'selectordinal') {
      // selectores:  offset:1 one {…} other {…}
      while (i < s.length) {
        const sel = /^\s*([^\s{}]+)?\s*/.exec(s.slice(i));
        i += sel[0].length;
        if (s[i] === '{') { i++; message(true); i++; continue; }
        if (s[i] === '}') { i++; return; }
        if (!sel[1]) { i++; }
      }
      return;
    }
    // number/date/time con estilo: saltar hasta el cierre
    skipBlock();
  }

  function skipBlock() {
    let depth = 1;
    while (i < s.length && depth > 0) {
      if (s[i] === '{') depth++;
      else if (s[i] === '}') depth--;
      i++;
    }
  }

  message(false);
  return { args: argNames, tags };
}

const fmt = (set) => (set.size ? [...set].sort().join(', ') : '—');
const sameSet = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function listShort(keys, max = 15) {
  const shown = keys.slice(0, max).map((k) => `      ${k}`).join('\n');
  return keys.length > max ? `${shown}\n      … y ${keys.length - max} más` : shown;
}

// ── archivos base ─────────────────────────────────────────────────────────────

const baseFiles = listFiles(MESSAGES)
  .filter((f) => /^src\/messages\/[^/]+\.json$/.test(f))
  .sort();

if (baseFiles.length === 0) {
  console.log('i18n: no hay archivos en src/messages, nada que revisar.');
  process.exit(0);
}

const locale = (f) => path.basename(f, '.json');
const base = new Map(); // locale -> { cur, head }
for (const f of baseFiles) {
  base.set(locale(f), { file: f, cur: parse(f, readCurrent(f)), head: parse(`HEAD:${f}`, readHead(f)) || new Map() });
}

const locales = [...base.keys()];
const valid = locales.every((l) => base.get(l).cur);

// Claves tocadas en este cambio (en cualquier locale)
const added = new Set();
const removed = new Set();
const modified = new Map(); // key -> Set(locales que la cambiaron)

if (valid) {
  for (const l of locales) {
    const { cur, head } = base.get(l);
    for (const [k, v] of cur) {
      if (!head.has(k)) added.add(k);
      else if (!eq(head.get(k), v)) {
        if (!modified.has(k)) modified.set(k, new Set());
        modified.get(k).add(l);
      }
    }
    for (const k of head.keys()) if (!cur.has(k)) removed.add(k);
  }

  // 1. Mismo set de claves en todos los locales base
  const union = new Set();
  for (const l of locales) for (const k of base.get(l).cur.keys()) union.add(k);
  for (const l of locales) {
    const cur = base.get(l).cur;
    const missing = [...union].filter((k) => !cur.has(k)).sort();
    if (missing.length) {
      errors.push(`${base.get(l).file}: faltan ${missing.length} clave(s) que sí están en otros locales:\n${listShort(missing)}`);
    }
  }

  // 2. Placeholders / etiquetas consistentes
  const toCheck = ALL ? union : new Set([...added, ...modified.keys()]);
  const placeholderErrors = [];
  for (const k of [...toCheck].sort()) {
    const sigs = locales.filter((l) => base.get(l).cur.has(k)).map((l) => [l, signature(base.get(l).cur.get(k))]);
    if (sigs.length < 2) continue;
    const [, ref] = sigs[0];
    const argsDiffer = sigs.some(([, sg]) => !sameSet(sg.args, ref.args));
    const tagsDiffer = sigs.some(([, sg]) => !sameSet(sg.tags, ref.tags));
    if (argsDiffer || tagsDiffer) {
      const detail = sigs
        .map(([l, sg]) => `        ${l.padEnd(6)} args: ${fmt(sg.args)}${tagsDiffer ? `   tags: ${fmt(sg.tags)}` : ''}`)
        .join('\n');
      placeholderErrors.push(`      ${k}\n${detail}`);
    }
  }
  if (placeholderErrors.length) {
    errors.push(`Placeholders ICU / etiquetas distintos entre locales:\n${placeholderErrors.join('\n')}`);
  }

  // 3. Aviso: modificada en un locale pero no en los demás
  const partial = [...modified]
    .filter(([k, ls]) => !added.has(k) && ls.size < locales.length)
    .map(([k, ls]) => `      ${k}  (cambió en ${[...ls].join(', ')}; sin cambios en ${locales.filter((l) => !ls.has(l)).join(', ')})`);
  if (partial.length) {
    warnings.push(
      `Claves modificadas solo en algunos locales (ok si fue una corrección puntual, ej. typo):\n${partial.slice(0, 20).join('\n')}${partial.length > 20 ? `\n      … y ${partial.length - 20} más` : ''}`,
    );
  }
}

// ── overrides por cliente ─────────────────────────────────────────────────────

const overrideFiles = listFiles(OVERRIDES).filter((f) => /^src\/messages\/overrides\/[^/]+\/[^/]+\.json$/.test(f));
const changedBase = new Set([...added, ...removed, ...modified.keys()]);

for (const f of overrideFiles.sort()) {
  const [, , , client, file] = f.split('/');
  const l = path.basename(file, '.json');
  const cur = parse(f, readCurrent(f));
  if (!cur) continue;
  const head = parse(`HEAD:${f}`, readHead(f)) || new Map();
  const baseCur = base.get(l)?.cur;
  if (!base.has(l)) {
    errors.push(`${f}: el locale "${l}" no existe en src/messages (locales: ${locales.join(', ')}).`);
    continue;
  }
  if (!baseCur) continue;

  const orphan = [...cur.keys()].filter((k) => !baseCur.has(k)).sort();
  if (orphan.length) {
    errors.push(`${f}: el override de "${client}" define clave(s) que ya no existen en ${l}.json:\n${listShort(orphan)}`);
  }

  for (const k of cur.keys()) {
    if (!baseCur.has(k)) continue;
    const s1 = signature(cur.get(k));
    const s2 = signature(baseCur.get(k));
    if (!sameSet(s1.args, s2.args) && (ALL || changedBase.has(k) || !eq(head.get(k), cur.get(k)))) {
      errors.push(`${f}: "${k}" usa args {${fmt(s1.args)}} pero la base ${l}.json usa {${fmt(s2.args)}}.`);
    }
  }

  const stale = [...cur.keys()].filter((k) => modified.has(k) && eq(head.get(k), cur.get(k))).sort();
  if (stale.length) {
    warnings.push(`${f}: cambiaste en la base clave(s) que "${client}" sobreescribe y el override no se tocó:\n${listShort(stale)}`);
  }
}

// ── salida ────────────────────────────────────────────────────────────────────

if (warnings.length) {
  console.log('\n⚠ i18n — avisos:');
  for (const w of warnings) console.log(`  • ${w}`);
}

if (errors.length) {
  console.error('\n✖ i18n — traducciones inconsistentes:');
  for (const e of errors) console.error(`  • ${e}`);
  console.error(`\nLocales base: ${locales.join(', ')}. Cada clave tiene que existir en todos, con los mismos placeholders.`);
  process.exit(1);
}

const touched = added.size + modified.size + removed.size;
console.log(
  `✔ i18n OK — ${locales.length} locales${touched ? ` (${added.size} agregada(s), ${modified.size} modificada(s), ${removed.size} borrada(s))` : ''}.`,
);
