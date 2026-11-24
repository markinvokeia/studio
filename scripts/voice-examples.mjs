#!/usr/bin/env node
/**
 * Catálogo de ejemplos de voz probados (docs/voz-ejemplos/): corre la batería del simulador
 * (e2e/tests/voice-agent, `pnpm test:voice`) registrando cada frase que se dice en cada prueba —en
 * qué pantalla, en qué idioma, si la contestó la IA (simulada) y qué respondió la voz— y deja solo
 * las de las pruebas que pasaron. Un archivo por área y un índice con todas las pantallas.
 *
 *   pnpm test:voice:examples                       # corre la batería (~7 min) y escribe los archivos
 *   node scripts/voice-examples.mjs --reuse        # vuelve a escribir con la última corrida guardada
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { VOICE_TEST_AREAS } from './voice-test-areas.mjs';

const root = process.cwd();
const OUT_DIR = join(root, 'docs', 'voz-ejemplos');
const WORK = join(tmpdir(), 'invoke-voice-examples');
const RECORDS = join(WORK, 'examples.jsonl');
const RESULTS = join(WORK, 'results.json');

// ── Correr la batería ─────────────────────────────────────────────────────────

if (!process.argv.includes('--reuse')) {
  rmSync(WORK, { recursive: true, force: true });
  mkdirSync(WORK, { recursive: true });
  try {
    execFileSync('npx', ['playwright', 'test', '-c', 'playwright.voice.config.ts', '--reporter=json'], {
      cwd: root,
      stdio: ['ignore', 'ignore', 'inherit'],
      env: { ...process.env, VOICE_EXAMPLES: RECORDS, PLAYWRIGHT_JSON_OUTPUT_NAME: RESULTS },
      maxBuffer: 256 * 1024 * 1024,
    });
  } catch {
    // Alguna prueba falló: igual se escribe el catálogo, solo con las que pasaron (y se avisa abajo).
  }
}
if (!existsSync(RECORDS) || !existsSync(RESULTS)) throw new Error('No hay corrida guardada: corré sin --reuse');

// ── Qué pruebas pasaron ───────────────────────────────────────────────────────

const report = JSON.parse(readFileSync(RESULTS, 'utf8'));
const key = (file, titles) => `${file}::${titles.join(' › ')}`;
const passed = new Set();
const allTests = []; // { file, titles, ok }
const walk = (suite, file, titles) => {
  for (const spec of suite.specs ?? []) {
    const ok = (spec.tests ?? []).every((t) => (t.results ?? []).some((r) => r.status === 'passed'));
    const path = [...titles, spec.title];
    allTests.push({ file, titles: path, ok });
    if (ok) passed.add(key(file, path));
  }
  for (const child of suite.suites ?? []) walk(child, file, [...titles, child.title]);
};
for (const fileSuite of report.suites ?? []) walk(fileSuite, fileSuite.title.split('/').pop(), []);
const failed = allTests.filter((t) => !t.ok);

// ── Las frases ────────────────────────────────────────────────────────────────

const records = readFileSync(RECORDS, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
  .filter((r) => passed.has(key(r.file, r.titlePath)));

const esc = (t) => String(t ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
const cut = (t, n) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);
const replyText = (r) => {
  if (!r) return '—';
  const parts = [r.title && r.message && !r.message.startsWith(r.title) ? `**${r.title}** · ${r.message}` : (r.message || r.title)];
  if (r.choices?.length) parts.push(`[${r.choices.slice(0, 6).join(' / ')}]`);
  return cut(esc(parts.filter(Boolean).join(' ')), 260) || '—';
};
const LOCALE_LABEL = { es: 'es', 'es-ES': 'es-ES', en: 'en' };

// Agrupar: área → grupo (describe) → prueba → frases en orden.
const byArea = new Map();
for (const r of records) {
  const area = byArea.get(r.file) ?? new Map();
  byArea.set(r.file, area);
  const group = r.titlePath.length > 1 ? r.titlePath.slice(0, -1).join(' › ') : '';
  const tests = area.get(group) ?? new Map();
  area.set(group, tests);
  const title = r.titlePath[r.titlePath.length - 1];
  const list = tests.get(title) ?? [];
  tests.set(title, list);
  list.push(r);
}

// Pruebas que pasaron sin decir nada por el micrófono: el intérprete de una frase solo (el título trae la frase),
// el micrófono (pedazos, eco, pausas) o piezas sueltas. También son lo probado de su área.
const saidKeys = new Set(records.map((r) => key(r.file, r.titlePath)));
const parserOnly = allTests.filter((t) => t.ok && !saidKeys.has(key(t.file, t.titles)));

// ── Un archivo por área ───────────────────────────────────────────────────────

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });
const areaFiles = Object.keys(VOICE_TEST_AREAS).filter((f) => byArea.has(f) || parserOnly.some((t) => t.file === f));
const summary = [];
for (const file of areaFiles) {
  const area = VOICE_TEST_AREAS[file];
  const groups = byArea.get(file) ?? new Map();
  const phrases = [...groups.values()].flatMap((t) => [...t.values()].flat());
  const tests = [...groups.values()].reduce((n, t) => n + t.size, 0);
  const locales = (l) => phrases.filter((p) => p.locale === l).length;
  const ai = phrases.filter((p) => p.ai).length;
  const routes = [...new Set(phrases.map((p) => p.route))].sort();
  const solo = parserOnly.filter((t) => t.file === file);
  summary.push({ file, area, tests, phrases: phrases.length, es: locales('es'), esES: locales('es-ES'), en: locales('en'), ai, routes, solo: solo.length });

  const lines = [
    `# ${area.title}`,
    '',
    `[← Índice de ejemplos](README.md) · Pruebas: \`e2e/tests/voice-agent/${file}\``,
    '',
    area.intro,
    '',
    `**${phrases.length} frases** en **${tests} pruebas que pasan** (es ${locales('es')} · es-ES ${locales('es-ES')} · en ${locales('en')}${ai ? ` · ${ai} contestadas por la IA simulada` : ''}). Pantallas: ${routes.map((r) => `\`${r}\``).join(', ') || '—'}.`,
    '',
    'Cada fila es una frase dicha por el micrófono, en orden. **Prueba** es lo que se verifica; **Respondió** es lo que mostró la tarjeta de voz después de esa frase. «IA» marca las frases que entendió la IA (en la prueba su respuesta está simulada; el resto lo entiende el navegador solo).',
    '',
  ];
  for (const [group, tests] of groups) {
    lines.push(`## ${esc(group) || 'Sin grupo'}`, '', '| Prueba | Idioma | Pantalla | Se dijo | Respondió |', '| --- | --- | --- | --- | --- |');
    for (const [title, list] of tests) {
      list.forEach((r, i) => {
        lines.push(`| ${i === 0 ? esc(title) : '〃'} | ${LOCALE_LABEL[r.locale] ?? r.locale} | \`${r.route}\` | «${esc(r.said)}»${r.ai ? ' · IA' : ''} | ${replyText(r.reply)} |`);
      });
    }
    lines.push('');
  }
  if (solo.length) {
    lines.push('## Pruebas sin frase por el micrófono', '', 'Estas pruebas pasan sin decir una frase por el micrófono: le dan la frase directo al intérprete y verifican qué entendió (el título la trae; «no:» quiere decir que ese intérprete no la toma porque es de otro comando, y eso también es lo probado), o prueban el micrófono y piezas sueltas.', '');
    for (const t of solo) lines.push(`- ${esc(t.titles.join(' › '))}`);
    lines.push('');
  }
  writeFileSync(join(OUT_DIR, `${area.slug}.md`), `${lines.join('\n')}\n`);
}

// ── Índice ────────────────────────────────────────────────────────────────────

const totalPhrases = records.length;
const uniquePhrases = new Set(records.map((r) => `${r.locale}|${r.said.toLowerCase()}`)).size;
const totalTests = allTests.filter((t) => t.ok).length;
const byRoute = new Map();
for (const r of records) {
  const e = byRoute.get(r.route) ?? { count: 0, files: new Set(), locales: new Set() };
  e.count++;
  e.files.add(r.file);
  e.locales.add(r.locale);
  byRoute.set(r.route, e);
}
const index = [
  '# Voz · Ejemplos probados',
  '',
  'Generado por `pnpm test:voice:examples` (`scripts/voice-examples.mjs`) — no editar a mano. Cómo funciona la voz: [voz-gestion.md](../voz-gestion.md).',
  '',
  `Cada frase de este catálogo se dijo en una prueba de la batería del simulador (\`e2e/tests/voice-agent/\`, \`pnpm test:voice\`) **que pasa**: **${totalPhrases} frases dichas** (${uniquePhrases} distintas) en **${totalTests} pruebas en verde**${failed.length ? ` (**${failed.length} fallaron en esta corrida y se dejaron afuera**)` : ' (todas las de la batería)'}. Por idioma: es ${records.filter((r) => r.locale === 'es').length} · es-ES ${records.filter((r) => r.locale === 'es-ES').length} · en ${records.filter((r) => r.locale === 'en').length}.`,
  '',
  '**Cómo leerlo.** El simulador corre la sesión de voz, los comandos y los textos reales de cada idioma; las pantallas son simuladas (publican lo mismo que la pantalla real) y la IA es el flujo de n8n con el modelo reemplazado por la respuesta que da la prueba. Lo que no lleva la marca «IA» lo entiende el navegador solo, siempre igual. Lo que lleva «IA» depende en la app real de lo que conteste el modelo. Lo probado en la app real, pantalla por pantalla, está en [voz-pruebas-vivo.md](../voz-pruebas-vivo.md).',
  '',
  '## Por área',
  '',
  '| Área | Pruebas con frases | Frases | es | es-ES | en | IA | Pruebas sin frase |',
  '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ...summary.map((s) => `| [${s.area.title}](${s.area.slug}.md) | ${s.tests} | ${s.phrases} | ${s.es} | ${s.esES} | ${s.en} | ${s.ai} | ${s.solo} |`),
  '',
  '## Por pantalla',
  '',
  'La pantalla en la que estaba la voz cuando se dijo la frase. Las áreas generales (cualquier pantalla, avisos, tablas) usan una pantalla de ejemplo: valen igual en todas.',
  '',
  '| Pantalla | Frases | Idiomas | Áreas |',
  '| --- | --- | --- | --- |',
  ...[...byRoute.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([route, e]) => `| \`${route}\` | ${e.count} | ${[...e.locales].sort().join(', ')} | ${[...e.files].map((f) => `[${VOICE_TEST_AREAS[f]?.title ?? f}](${VOICE_TEST_AREAS[f]?.slug ?? f}.md)`).join(', ')} |`),
  '',
];
if (failed.length) {
  index.push('## Fallaron en esta corrida (no están en el catálogo)', '', ...failed.map((t) => `- \`${t.file}\` · ${esc(t.titles.join(' › '))}`), '');
}
writeFileSync(join(OUT_DIR, 'README.md'), `${index.join('\n')}\n`);
const stale = readdirSync(OUT_DIR).length;
console.log(`[voz] docs/voz-ejemplos/: ${totalPhrases} frases (${uniquePhrases} distintas) en ${totalTests} pruebas en verde, ${summary.length} áreas, ${byRoute.size} pantallas, ${stale} archivos${failed.length ? ` · ${failed.length} pruebas fallaron (afuera)` : ''}`);

// ── Tabla de páginas de docs/voz-gestion.md ──────────────────────────────────
// Cada ruta del menú (src/config/nav.ts) con la voz propia que monta su página, si tiene frases en
// el simulador y qué pruebas en vivo la recorrieron. Se reescribe entre los marcadores PAGES_TABLE.

const GUIDE = join(root, 'docs', 'voz-gestion.md');
if (existsSync(GUIDE)) {
  const nav = readFileSync(join(root, 'src', 'config', 'nav.ts'), 'utf8');
  const esNav = JSON.parse(readFileSync(join(root, 'src', 'messages', 'es.json'), 'utf8')).Navigation ?? {};
  const routes = new Map();
  for (const m of nav.matchAll(/title:\s*'([A-Za-z0-9]+)',\s*href:\s*'([^']+)'/g)) routes.set(m[2], m[1]);

  // La voz propia: lo que monta la página (módulo de la pantalla o componentes con voz).
  const OWN = [
    ['/', 'Panel de control (`dashboard`)'],
    ['/workspace', 'Mi consultorio (`workspace`) + agente clínico + periodontograma, estado de cuenta'],
    ['/alerts', 'Centro de alertas (`alerts`)'],
    ['/cashier', 'Caja (`cashier`)'],
    ['/appointments', 'Agenda (`calendar`)'],
    ['/patients', 'Pacientes (`patients`) + estado de cuenta (`ledger`) + documentos de la ficha + periodontograma'],
    ['/lab-orders', 'Órdenes de laboratorio (`lab_orders`)'],
  ];
  const ownFor = (href) => OWN.find(([r]) => r === href)?.[1] ?? null;
  const componentsOf = (href) => {
    const dir = join(root, 'src', 'app', '[locale]', ...href.split('/').filter(Boolean));
    if (!existsSync(dir)) return '';
    return readdirSync(dir).filter((f) => f.endsWith('.tsx')).map((f) => readFileSync(join(dir, f), 'utf8')).join('\n');
  };
  const voiceOf = (href) => {
    const src = componentsOf(href);
    const parts = [];
    const own = ownFor(href);
    if (own) parts.push(own);
    if (/<ReportShell\b/.test(src) || href.startsWith('/reports/')) parts.push('Reportes (`reports`)');
    if (/<(InvoicesTable|PaymentsTable|RecentQuotesTable)\b/.test(src)) parts.push('Documentos (`documents`)');
    // La tabla común: en los archivos de la página o vista por la matriz en vivo (la monta un componente).
    if (/DataTable/.test(src) || tableLive.has(href)) parts.push('Tablas (`crud`)');
    return parts.join(' + ');
  };

  // En vivo: la galería de la matriz (en el repo), el humo, el barrido y la auditoría.
  const read = (p) => (existsSync(join(root, p)) ? readFileSync(join(root, p), 'utf8') : '');
  const matrix = new Set([...read('docs/voz-pruebas-vivo.md').matchAll(/^\| `([^`]+)` \| (?:es|en) \|/gm)].map((m) => m[1]));
  const tableLive = new Set();
  for (const sec of read('docs/voz-pruebas-vivo.md').split(/^## /m).slice(1)) {
    const route = sec.match(/^`([^`]+)`/)?.[1];
    if (route && /\| tabla · /.test(sec)) tableLive.add(route);
  }
  const smokeSrc = read('e2e/tests/voice-live/voice-smoke.live.ts');
  const smoke = new Set([
    ...[...smokeSrc.matchAll(/path: '\/(?:es|en)(\/[^']*)?'/g)].map((m) => m[1] || '/'),
    ...[...smokeSrc.matchAll(/url: \/\\\/(?:es|en)\\\/([a-z-]+(?:\\\/[a-z-]+)?)/g)].map((m) => `/${m[1].replace(/\\\//g, '/')}`),
  ]);
  const sweep = new Set([...read('e2e/tests/voice-live/config-sweep.live.ts').matchAll(/'(\/(?:config|system)\/[a-z-]+)'/g)].map((m) => m[1]));
  // Lo que el humo alcanza navegando por voz (la URL de destino no está escrita entera en la prueba).
  const LIVE_EXTRA = { '/workspace': ['auditoría', 'grabación'], '/appointments': ['grabación'], '/reports/cobros-dia': ['humo'] };
  const simCount = (href) => records.filter((r) => r.route === href || (href !== '/' && r.route.startsWith(`${href}/`))).length;

  const rows = [...routes.entries()].map(([href, key]) => {
    const live = [...new Set([matrix.has(href) && 'matriz', smoke.has(href) && 'humo', sweep.has(href) && 'barrido', ...(LIVE_EXTRA[href] ?? [])].filter(Boolean))];
    const sim = simCount(href);
    return `| ${esNav[key] ?? key} | \`${href}\` | ${voiceOf(href) || 'Solo la general'} | ${sim ? `${sim} ${sim === 1 ? 'frase' : 'frases'}` : '—'} | ${live.join(', ') || '**—**'} |`;
  });
  const own = [...routes.keys()].filter((h) => voiceOf(h)).length;
  const anyLive = [...routes.keys()].filter((h) => matrix.has(h) || smoke.has(h) || sweep.has(h) || LIVE_EXTRA[h]).length;
  const table = [
    '<!-- PAGES_TABLE:START (generado por pnpm test:voice:examples) -->',
    `**${routes.size} páginas del menú**: ${own} con voz propia o la de sus tablas, documentos o reportes; ${routes.size - own} solo con la general. **${anyLive} recorridas en la app real**; ${routes.size - anyLive} todavía no (marcadas **—**).`,
    '',
    '| Página | Ruta | Voz propia | Simulador | En vivo |',
    '| --- | --- | --- | --- | --- |',
    ...rows,
    '<!-- PAGES_TABLE:END -->',
  ].join('\n');
  const guide = readFileSync(GUIDE, 'utf8');
  const next = /<!-- PAGES_TABLE:START[\s\S]*?PAGES_TABLE:END -->/.test(guide)
    ? guide.replace(/<!-- PAGES_TABLE:START[\s\S]*?PAGES_TABLE:END -->/, table)
    : guide.replace('<!-- PAGES_TABLE -->', table);
  writeFileSync(GUIDE, next);
  console.log(`[voz] docs/voz-gestion.md: ${routes.size} páginas (${own} con voz propia, ${anyLive} en vivo)`);
}
