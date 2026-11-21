import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * El flujo «Voz - Interpretar» tal como se genera (n8n-workflows/help-voice-interpret.json): se
 * corren sus nodos Code reales (Preparar Consulta y Validar Respuesta). Lo único simulado es el
 * modelo: la prueba dice qué habría contestado y el resto es el código que corre en n8n.
 */

interface WorkflowNode { name: string; parameters: { jsCode?: string } }
const workflow = JSON.parse(readFileSync(join(process.cwd(), 'n8n-workflows/help-voice-interpret.json'), 'utf8')) as { nodes: WorkflowNode[] };
const code = (name: string) => {
  const node = workflow.nodes.find((n) => n.name === name);
  if (!node?.parameters.jsCode) throw new Error(`Falta el nodo ${name} en help-voice-interpret.json`);
  return node.parameters.jsCode;
};
const prepareNode = new Function('$input', '$', code('Preparar Consulta')) as (input: unknown, $: unknown) => Array<{ json: Record<string, unknown> }>;
const validateNode = new Function('$input', '$', code('Validar Respuesta')) as (input: unknown, $: unknown) => Array<{ json: { body: unknown } }>;

export interface PreparedQuery {
  prompt: string;
  systemPrompt: string;
  text: string;
  domain: string;
  meta: Record<string, unknown>;
  today: string;
}

/** Nodo «Preparar Consulta» con el body que mandó el navegador. */
export function prepare(body: Record<string, unknown>): PreparedQuery {
  const input = { first: () => ({ json: { body, jwtPayload: { userId: 'voice-sim-user' } } }) };
  return prepareNode(input, () => ({ first: () => ({ json: {} }) }))[0].json as unknown as PreparedQuery;
}

/** Nodo «Validar Respuesta» con lo que contestó el modelo (texto, como lo devuelve el agente). */
export function validate(prepared: PreparedQuery, modelOutput: string): unknown {
  const input = { first: () => ({ json: { output: modelOutput } }) };
  return validateNode(input, () => ({ first: () => ({ json: prepared }) }))[0].json.body;
}
