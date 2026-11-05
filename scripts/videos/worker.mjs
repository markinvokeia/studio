#!/usr/bin/env node
/**
 * Fase 3 — video a demanda. Toma los pedidos del chat (POST help/videos/queue),
 * graba la guía en el tenant demo, la arma y la publica; si algo falla, cierra
 * el pedido con el error para que se vea en el panel de métricas.
 *
 *   pnpm videos:worker           corre cada HELP_VIDEO_WORKER_INTERVAL s (60)
 *   pnpm videos:worker -- --once procesa la cola una vez y sale
 *
 * Requiere lo mismo que record/build/publish, más HELP_VIDEO_DEMO_TENANT=1.
 */

import { spawnSync } from 'node:child_process';

import { helpApi } from './help-api.mjs';

const ONCE = process.argv.includes('--once');
const INTERVAL_S = Number(process.env.HELP_VIDEO_WORKER_INTERVAL ?? 60);

function step(cmd, args, env) {
  const res = spawnSync(cmd, args, { stdio: 'inherit', env: { ...process.env, ...env } });
  if (res.status !== 0) throw new Error(`${cmd} ${args.join(' ')} terminó con ${res.status}`);
}

async function processRequest(request) {
  const env = { HELP_VIDEO_USE_CASES: request.use_case_id, HELP_VIDEO_REQUEST_ID: request.id };
  console.log(`[worker] ${request.use_case_id} (${request.locale})`);
  try {
    step('pnpm', ['exec', 'playwright', 'test', '--project=help-videos'], env);
    step('node', ['scripts/videos/build-videos.mjs'], env);
    step('node', ['scripts/videos/publish-videos.mjs'], env);
  } catch (error) {
    await helpApi('help/videos/register', { use_case_id: request.use_case_id, locale: request.locale, request_id: request.id, error: error.message });
    console.error(`[worker] falló ${request.use_case_id}: ${error.message}`);
  }
}

async function tick() {
  const { requests = [] } = (await helpApi('help/videos/queue', { limit: 3 })) ?? {};
  for (const request of requests) await processRequest(request);
  return requests.length;
}

do {
  try {
    const n = await tick();
    if (n) console.log(`[worker] ${n} pedido(s) procesado(s)`);
  } catch (error) {
    console.error(`[worker] ${error.message}`);
  }
  if (!ONCE) await new Promise((r) => setTimeout(r, INTERVAL_S * 1000));
} while (!ONCE);
