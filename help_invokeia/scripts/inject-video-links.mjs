#!/usr/bin/env node
/**
 * Produce una copia del manual con el enlace al video bajo cada pregunta filmada.
 *
 *   node help_invokeia/scripts/inject-video-links.mjs
 *   node help_invokeia/scripts/inject-video-links.mjs --out ~/Downloads/manual-rol.md
 *
 * Nunca edita el original: siempre regenera desde `manual-rol.source.md`, así que
 * es idempotente por construcción — correrlo dos veces da el mismo resultado y no
 * acumula enlaces duplicados.
 *
 * No toca la línea del encabezado, sólo inserta una línea debajo. Eso mantiene
 * intactas las anclas `{#qNNN}`, que pandoc convierte en bookmarks del DOCX y de
 * las que dependen tanto la Referencia A como los «Ver también» del manual.
 *
 * La salida por defecto se llama `manual-rol.md` porque es el nombre exacto que
 * espera `generar-manual-rol-docx.py`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(ROOT, 'manual-rol.source.md');
const REGISTRY = path.join(ROOT, 'questions.json');
const LINKS = path.join(ROOT, 'video-links.json');
const VIDEO_MAP = path.join(ROOT, 'video-map.json');
const VIDEOS = path.join(ROOT, 'videos');

const outArg = process.argv.indexOf('--out');
const OUT =
  outArg !== -1 && process.argv[outArg + 1]
    ? path.resolve(process.argv[outArg + 1].replace(/^~/, process.env.HOME ?? '~'))
    : path.join(ROOT, 'build', 'manual-rol.md');

// ── entradas ────────────────────────────────────────────────────────────────
const { questions } = JSON.parse(fs.readFileSync(REGISTRY, 'utf8'));
const byId = new Map(questions.map((q) => [q.id, q]));

/** { "q014": "https://drive.google.com/file/d/…/view" } */
const links = fs.existsSync(LINKS) ? JSON.parse(fs.readFileSync(LINKS, 'utf8')) : {};
if (!fs.existsSync(LINKS)) {
  console.warn(`⚠  No existe ${path.relative(process.cwd(), LINKS)}.`);
  console.warn('   Creá ese archivo con { "q001": "https://drive.google.com/...", ... }');
  console.warn('   tras subir los videos. Por ahora no se inserta ningún enlace.\n');
}

/**
 * pregunta → archivo de video, generado por la auditoría a partir de los specs.
 * Es lo que permite que dos preguntas agrupadas compartan el mismo enlace.
 * Si no existe todavía, se cae al nombre por defecto del registro (1 por pregunta).
 */
const videoMap = fs.existsSync(VIDEO_MAP) ? JSON.parse(fs.readFileSync(VIDEO_MAP, 'utf8')) : {};
const videoOf = (q) => videoMap[q.id] ?? q.video;
const hasLocalVideo = (q) => fs.existsSync(path.join(VIDEOS, videoOf(q)));

// ── transformación ──────────────────────────────────────────────────────────
const H3 = /^### (.+?)\s*\{#(q\d{3})\}\s*$/;

const lines = fs.readFileSync(SOURCE, 'utf8').split('\n');
const out = [];
let injected = 0;
let missingLink = 0;

for (let i = 0; i < lines.length; i += 1) {
  const line = lines[i];
  out.push(line); // el encabezado se emite intacto: el ancla no se toca

  const m = H3.exec(line);
  if (!m) continue;

  const q = byId.get(m[2]);
  if (!q) continue;

  // El enlace se busca por nombre de archivo, no por id: así las dos preguntas
  // que comparten un video comparten también su URL de Drive, y alcanza con
  // anotarla una sola vez.
  const url = links[videoOf(q)] ?? links[q.id];
  if (!url) {
    if (hasLocalVideo(q)) missingLink += 1;
    continue;
  }

  // Se salta la línea en blanco que sigue al encabezado para insertar después
  // de ella y no pegar el enlace al título.
  if (lines[i + 1] === '') {
    out.push('');
    i += 1;
  }
  // Cursiva con enlace: pandoc la convierte en un hyperlink real del DOCX y
  // combina con las convenciones que el manual ya usa (*Permiso: …*).
  // La línea en blanco posterior es obligatoria: sin ella markdown fusiona el
  // enlace con el primer párrafo del cuerpo.
  out.push(`*Video: [Ver la demostración](${url})*`);
  out.push('');
  injected += 1;
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, out.join('\n'));

// ── informe ─────────────────────────────────────────────────────────────────
const filmable = questions.filter((q) => ['ui', 'ui-mutating', 'setup-heavy'].includes(q.filmability));
const recorded = filmable.filter(hasLocalVideo);

console.log(`✓ ${path.relative(process.cwd(), OUT)}`);
console.log(`  ${injected} enlaces insertados`);
const distinctVideos = new Set(recorded.map(videoOf));
console.log(`  ${recorded.length}/${filmable.length} preguntas filmables ya grabadas localmente`);
console.log(`  ${distinctVideos.size} archivos de video distintos`);
if (missingLink) {
  console.log(`  ${missingLink} tienen video grabado pero todavía no tienen URL en video-links.json`);
}
console.log(`\n  Para regenerar el .docx:`);
console.log(`    python3 ~/Downloads/generar-manual-rol-docx.py`);
console.log(`  (ese script lee un archivo llamado manual-rol.md en su propio directorio)`);
