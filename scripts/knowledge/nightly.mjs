#!/usr/bin/env node
/**
 * Job nocturno del mapa del producto (Fases 1 y 4):
 *   1. cobertura estricta: toda pantalla del menú con ficha y ninguna guía rota;
 *   2. regresión de guías (e2e/tests/help) contra el entorno de E2E_BASE_URL;
 *   3. los casos de uso cuya guía falló marcan su video como desactualizado
 *      (help_videos.status = 'stale') para regenerarlo.
 *
 *   node scripts/knowledge/nightly.mjs   (cron en el servidor de QA)
 */

import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { helpApi, helpApiConfigured } from '../videos/help-api.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const REPORT = join(ROOT, 'test-results', 'help-guides.json');

let failures = 0;

const coverage = spawnSync('node', ['scripts/knowledge/build-catalog.mjs', '--check', '--strict'], { cwd: ROOT, stdio: 'inherit' });
if (coverage.status !== 0) failures += 1;

const e2e = spawnSync('pnpm', ['exec', 'playwright', 'test', 'e2e/tests/help', '--project=chromium', '--reporter=json'], {
  cwd: ROOT,
  env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: REPORT },
  stdio: ['ignore', 'inherit', 'inherit'],
});

const broken = new Set();
if (existsSync(REPORT)) {
  const walk = (suite) => {
    for (const spec of suite.specs ?? []) {
      const failed = spec.tests?.some((t) => t.results?.some((r) => r.status === 'failed' || r.status === 'timedOut'));
      const id = spec.title.split(' — ')[0];
      if (failed && id) broken.add(id);
    }
    for (const child of suite.suites ?? []) walk(child);
  };
  for (const suite of JSON.parse(readFileSync(REPORT, 'utf8')).suites ?? []) walk(suite);
}
if (e2e.status !== 0 || broken.size) failures += 1;

for (const id of broken) {
  console.error(`[nightly] guía rota: ${id}`);
  if (helpApiConfigured()) {
    await helpApi('help/videos/register', { use_case_id: id, locale: 'es', stale: true }).catch((e) => console.error(`[nightly] ${id}: ${e.message}`));
  }
}
console.log(`[nightly] ${broken.size ? `${broken.size} guía(s) rota(s)` : 'guías OK'} · cobertura ${coverage.status === 0 ? 'OK' : 'con faltantes'}`);
process.exit(failures ? 1 : 0);
