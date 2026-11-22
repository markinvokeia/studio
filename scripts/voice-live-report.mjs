#!/usr/bin/env node
/**
 * Galería de las pruebas en vivo por pantalla (e2e/tests/voice-live/page-matrix.live.ts): arma
 * docs/voz-pruebas-vivo.md con lo que se dijo en cada pantalla y cómo salió, a partir de
 * test-results/voice-matrix/*.json (la última corrida de cada pantalla y cada idioma).
 *
 *   pnpm test:voice:live -g matrix && pnpm test:voice:matrix:report
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'test-results', 'voice-matrix');
const OUT = join(ROOT, 'docs', 'voz-pruebas-vivo.md');
if (!existsSync(DIR)) throw new Error('No hay resultados: corré primero pnpm test:voice:live -g matrix');

const runs = readdirSync(DIR).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join(DIR, f), 'utf8')));
runs.sort((a, b) => a.route.localeCompare(b.route) || a.locale.localeCompare(b.locale));
const total = runs.reduce((n, r) => n + r.steps.length, 0);
const ok = runs.reduce((n, r) => n + r.steps.filter((s) => s.ok).length, 0);
const esc = (t) => String(t ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');

const lines = [
  '# Voz · Pruebas en la app real, pantalla por pantalla',
  '',
  'Generado por `scripts/voice-live-report.mjs` a partir de la última corrida de `e2e/tests/voice-live/page-matrix.live.ts` (app en modo producción, reconocimiento falso, sin guardar). En cada pantalla se descubre lo que hay y se prueba por voz: ayuda, tabla (ordenar, ocultar y mostrar columnas, filtrar con la palabra clave, elegir y cerrar el detalle), alta (se abre y avisa qué se le puede pedir; campos con tres sinónimos; interruptores y casillas; listas; opciones), cerrar lo último que se abrió y cambio de contexto con la ventana abierta.',
  '',
  `**${ok} de ${total} pasos bien** en ${runs.length} pantallas.`,
  '',
  '| Pantalla | Idioma | Bien | Falló |',
  '| --- | --- | --- | --- |',
  ...runs.map((r) => `| \`${r.route}\` | ${r.locale} | ${r.steps.filter((s) => s.ok).length}/${r.steps.length} | ${r.steps.filter((s) => !s.ok).map((s) => esc(s.step)).join('; ') || '—'} |`),
  '',
];
for (const r of runs) {
  lines.push(`## \`${r.route}\` (${r.locale})`, '', '| Paso | Se dijo | Resultado | Qué pasó |', '| --- | --- | --- | --- |');
  for (const s of r.steps) lines.push(`| ${esc(s.step)} | «${esc(s.said)}» | ${s.ok ? '✅' : '❌'} | ${esc(s.note).slice(0, 160)} |`);
  lines.push('');
}
writeFileSync(OUT, `${lines.join('\n')}\n`);
console.log(`[voz] ${OUT}: ${ok}/${total} en ${runs.length} pantallas`);
