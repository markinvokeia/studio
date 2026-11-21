#!/usr/bin/env node
/**
 * Publica en n8n el código de los nodos Code de un flujo generado (n8n-workflows/<archivo>.json) sobre
 * el flujo que ya existe en el servidor: reemplaza solo el jsCode de los nodos con el mismo nombre y
 * deja todo lo demás como está (credenciales, modelo, posiciones). Guarda una copia del flujo anterior.
 *
 *   N8N_API_KEY=… node scripts/n8n/deploy-workflow.mjs help-voice-interpret.json 7yTmcJ03YYw3RL6J
 *
 * N8N_BASE_URL por defecto https://n8n-project-n8n.7ig1i3.easypanel.host. La key nunca va al repo.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const [file, id] = process.argv.slice(2);
const key = process.env.N8N_API_KEY;
const base = (process.env.N8N_BASE_URL ?? 'https://n8n-project-n8n.7ig1i3.easypanel.host').replace(/\/$/, '');
if (!file || !id || !key) {
  console.error('Uso: N8N_API_KEY=… node scripts/n8n/deploy-workflow.mjs <archivo.json> <workflowId>');
  process.exit(1);
}
const url = `${base}/api/v1/workflows/${id}`;
const call = async (method, path = '', body) => {
  const res = await fetch(url + path, { method, headers: { 'X-N8N-API-KEY': key, 'Content-Type': 'application/json', Accept: 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new Error(`${method} ${path || '/'} → HTTP ${res.status}: ${await res.text()}`);
  return res.json();
};

const live = await call('GET');
const backupDir = join(tmpdir(), 'n8n-backups');
mkdirSync(backupDir, { recursive: true });
const backup = join(backupDir, `${id}-${Date.now()}.json`);
writeFileSync(backup, JSON.stringify(live, null, 2));

const generated = JSON.parse(readFileSync(join(process.cwd(), 'n8n-workflows', file), 'utf8'));
const code = Object.fromEntries(generated.nodes.filter((n) => n.type === 'n8n-nodes-base.code').map((n) => [n.name, n.parameters.jsCode]));
const changed = [];
for (const node of live.nodes) {
  if (code[node.name] !== undefined && node.parameters.jsCode !== code[node.name]) {
    node.parameters.jsCode = code[node.name];
    changed.push(node.name);
  }
}
if (!changed.length) { console.log(`[n8n] ${live.name}: ya estaba al día`); process.exit(0); }

const allowed = ['executionOrder', 'saveManualExecutions', 'callerPolicy', 'errorWorkflow', 'timezone', 'saveExecutionProgress', 'saveDataErrorExecution', 'saveDataSuccessExecution', 'executionTimeout'];
const settings = Object.fromEntries(Object.entries(live.settings ?? {}).filter(([k]) => allowed.includes(k)));
const saved = await call('PUT', '', { name: live.name, nodes: live.nodes, connections: live.connections, settings });
const active = await call('POST', '/activate').catch((e) => ({ error: e.message }));
console.log(`[n8n] ${live.name}: actualizados ${changed.join(', ')} · versión ${saved.versionId} · activo ${active.active ?? active.error} · copia ${backup}`);
