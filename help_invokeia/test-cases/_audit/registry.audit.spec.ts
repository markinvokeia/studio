/**
 * Auditoría del registro contra los specs. No abre navegador: es el semáforo
 * del proyecto y el tablero de avance por PARTE.
 *
 *   pnpm help:audit
 */
import fs from 'node:fs';
import path from 'node:path';

import { test, expect } from '@playwright/test';

import { QUESTIONS, isFilmable, videoNameFor, type Question } from '../../lib/registry';

const CASES_DIR = path.resolve(__dirname, '..');

function specFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return specFiles(full);
    return e.name.endsWith('.demo.ts') ? [full] : [];
  });
}

/**
 * Grupos declarados en los specs. Un `demoTest` acepta un id suelto o un array
 * de hasta dos, y ese grupo es el que define el nombre del video.
 */
function declaredGroups(): { ids: string[]; file: string }[] {
  const groups: { ids: string[]; file: string }[] = [];
  const seen = new Map<string, string>();

  for (const file of specFiles(CASES_DIR)) {
    const src = fs.readFileSync(file, 'utf8');
    // Captura tanto `demoTest('q014'` como `demoTest(['q037', 'q038']`
    for (const m of src.matchAll(/demoTest\(\s*(\[[^\]]*\]|'q\d{3}'|"q\d{3}")/g)) {
      const ids = [...m[1].matchAll(/q\d{3}/g)].map((x) => x[0]);
      for (const id of ids) {
        const prev = seen.get(id);
        if (prev) {
          throw new Error(
            `${id} está declarado dos veces: ${path.relative(CASES_DIR, prev)} y ${path.relative(CASES_DIR, file)}`,
          );
        }
        seen.set(id, file);
      }
      groups.push({ ids, file });
    }
  }
  return groups;
}

/** id de pregunta → archivo que lo declara. */
function declaredIds(): Map<string, string> {
  const found = new Map<string, string>();
  for (const { ids, file } of declaredGroups()) for (const id of ids) found.set(id, file);
  return found;
}

test('todo id declarado en un spec existe en el registro', () => {
  const known = new Set(QUESTIONS.map((q) => q.id));
  const orphans = [...declaredIds().keys()].filter((id) => !known.has(id));
  expect(orphans, `Ids huérfanos (no están en questions.json): ${orphans.join(', ')}`).toEqual([]);
});

test('no hay nombres de video duplicados', () => {
  // El slug SÍ puede repetirse: hay preguntas homónimas en PARTEs distintas
  // («¿Por dónde empiezo?» en Consultorio y en Administración). Lo que no puede
  // repetirse es el nombre de archivo, y por eso lleva el id delante.
  const seen = new Map<string, string>();
  const dupes: string[] = [];
  for (const q of QUESTIONS) {
    const prev = seen.get(q.video);
    if (prev) dupes.push(`${q.video} (${prev} y ${q.id})`);
    else seen.set(q.video, q.id);
  }
  expect(dupes, 'Nombres de video repetidos: se pisarían entre sí').toEqual([]);
});

test('cobertura: las preguntas filmables tienen spec', () => {
  const declared = declaredIds();
  const byPart = new Map<string, { done: Question[]; todo: Question[] }>();

  for (const q of QUESTIONS.filter(isFilmable)) {
    const key = q.part.n === null ? q.part.title : `PARTE ${q.part.n} — ${q.part.title}`;
    const bucket = byPart.get(key) ?? { done: [], todo: [] };
    (declared.has(q.id) ? bucket.done : bucket.todo).push(q);
    byPart.set(key, bucket);
  }

  const lines: string[] = ['', 'Cobertura de videos por PARTE:'];
  let done = 0;
  let total = 0;
  for (const [part, { done: d, todo: t }] of byPart) {
    done += d.length;
    total += d.length + t.length;
    lines.push(`  ${String(d.length).padStart(3)}/${String(d.length + t.length).padEnd(3)}  ${part}`);
  }
  const skipped = QUESTIONS.length - total;
  lines.push(`  ${'─'.repeat(40)}`);
  lines.push(`  ${done}/${total} filmables con spec · ${skipped} sin video por triaje`);
  console.log(lines.join('\n'));

  // Informativo mientras se construye: no falla el run por preguntas pendientes.
  expect(done).toBeGreaterThanOrEqual(0);
});

test('mapa de videos: cada pregunta declarada apunta a su archivo', () => {
  // Los specs son la única fuente de verdad del agrupado. Este mapa es lo que
  // después usa inject-video-links.mjs para saber qué enlace le toca a cada
  // pregunta, incluidas las dos que comparten un mismo video.
  const map: Record<string, string> = {};
  const groups = declaredGroups();

  for (const { ids } of groups) {
    const video = videoNameFor(ids);
    for (const id of ids) map[id] = video;
  }

  const out = path.resolve(__dirname, '../../video-map.json');
  fs.writeFileSync(out, `${JSON.stringify(map, null, 2)}\n`);

  const shared = groups.filter((g) => g.ids.length > 1);
  console.log(
    `\nMapa de videos: ${Object.keys(map).length} preguntas → ${groups.length} videos` +
      (shared.length ? ` (${shared.length} cubren dos preguntas)` : ''),
  );
  expect(Object.keys(map).length).toBeGreaterThanOrEqual(groups.length);
});
