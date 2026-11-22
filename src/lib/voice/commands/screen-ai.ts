import { runScreen, type ScreenParsed } from '@/lib/voice/commands/screen';
import { controlsOf, readSurface, waitScreenReady, type UiControl } from '@/lib/voice/dom-ui';
import { normalizeSpeech } from '@/lib/voice/parse';
import { registerVoiceCommand, registerVoiceDomain } from '@/lib/voice/registry';
import { searchTerm } from '@/lib/voice/search-term';
import { looksLikeCommand } from '@/lib/voice/wake';

import type { VoiceCommandContext } from '@/lib/types';

/**
 * La IA de la pantalla (módulo `screen` del flujo «Voz - Interpretar»): lo que el intérprete local
 * no entendió se le pregunta con lo que está a la vista (los nombres de los botones, pestañas,
 * interruptores, campos y listas de lo que está arriba; nunca valores ni filas: pueden ser datos de
 * pacientes). Contesta con los pasos para hacerlo («press Guardar», «fill Nombre = …») o, si no
 * está claro, con hasta tres propuestas («¿Te referís a…?»). La pantalla lo hace con la voz
 * genérica (runScreen), paso a paso, mirando de nuevo lo que hay después de cada uno.
 */
export const SCREEN_AI_DOMAIN = 'screen';

export type ScreenStepOp = 'press' | 'fill' | 'toggle' | 'select' | 'tab' | 'search';
export interface ScreenStep { op: ScreenStepOp; target: string; value?: string | null; on?: boolean | null }
export interface ScreenAiResult {
  relation: 'new' | 'ignore' | 'cancel' | 'resume';
  intent: 'steps' | 'suggest' | 'unknown';
  /** Los pasos sobre la pantalla (no se llama «steps»: eso es un plan de varios pedidos para la sesión). */
  actions: ScreenStep[];
  suggestions: Array<ScreenStep & { label: string }>;
}

const OPS: ScreenStepOp[] = ['press', 'fill', 'toggle', 'select', 'tab', 'search'];
const KIND_OF: Record<string, string> = { button: 'button', link: 'button', tab: 'tab', toggle: 'toggle', field: 'field', search: 'search', select: 'select' };

/** Los controles de lo que está arriba, sin los de las filas (pueden nombrar pacientes). */
function visibleControls(): UiControl[] {
  const surface = readSurface();
  if (!surface) return [];
  return controlsOf(surface, 'button', 'link', 'tab', 'toggle', 'field', 'search', 'select')
    .filter((c) => !(typeof c.element.closest === 'function' && c.element.closest('tbody, [data-row-id], [data-voice-row]')))
    .filter((c) => c.label.length >= 2 && c.label.length <= 60);
}

/** Hay una palabra de un control de la pantalla en lo dicho (vale la pena preguntarle a la IA). */
function mentionsScreen(normalized: string): boolean {
  const said = new Set(normalized.split(' ').filter((w) => w.length >= 4));
  if (!said.size) return false;
  return visibleControls().some((c) => normalizeSpeech(c.label).split(' ').some((w) => w.length >= 4 && said.has(w)));
}

function cleanStep(raw: unknown, labels: Set<string>): ScreenStep | null {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const op = OPS.find((o) => o === s.op);
  const target = typeof s.target === 'string' ? s.target.trim() : '';
  if (!op || !target || !labels.has(normalizeSpeech(target))) return null;
  const value = typeof s.value === 'string' && s.value.trim() ? s.value.trim().slice(0, 200) : null;
  if ((op === 'fill' || op === 'search') && !value) return null;
  return { op, target, value, on: typeof s.on === 'boolean' ? s.on : null };
}

registerVoiceDomain<ScreenAiResult>({
  id: SCREEN_AI_DOMAIN,
  ai: {
    accepts: (normalized) => looksLikeCommand(normalized) || mentionsScreen(normalized),
    context: async () => {
      const surface = readSurface();
      const controls = visibleControls();
      const seen = new Set<string>();
      return {
        screen: {
          title: (surface?.title ?? '').slice(0, 80),
          overlay: !!surface?.isOverlay,
          controls: controls
            .filter((c) => { const k = `${c.kind}|${normalizeSpeech(c.label)}`; if (seen.has(k)) return false; seen.add(k); return true; })
            .slice(0, 80)
            .map((c) => ({ kind: KIND_OF[c.kind] ?? c.kind, label: c.label, ...(c.kind === 'toggle' ? { on: !!c.checked } : {}) })),
        },
      };
    },
    sanitize: (raw, context) => {
      const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
      const screen = (context.screen ?? {}) as { controls?: Array<{ label: string }> };
      const labels = new Set((screen.controls ?? []).map((c) => normalizeSpeech(c.label)));
      const steps = (Array.isArray(r.actions) ? r.actions : []).map((s) => cleanStep(s, labels)).filter((s): s is ScreenStep => !!s).slice(0, 6);
      const suggestions = (Array.isArray(r.suggestions) ? r.suggestions : [])
        .map((s) => {
          const step = cleanStep(s, labels);
          const label = s && typeof (s as { label?: unknown }).label === 'string' ? String((s as { label: string }).label).trim().slice(0, 80) : '';
          return step && label ? { ...step, label } : null;
        })
        .filter((s): s is ScreenStep & { label: string } => !!s)
        .slice(0, 3);
      const relation = ['new', 'ignore', 'cancel', 'resume'].includes(String(r.relation)) ? (r.relation as ScreenAiResult['relation']) : 'new';
      const intent = r.intent === 'steps' && steps.length ? 'steps' : r.intent === 'suggest' && suggestions.length ? 'suggest' : 'unknown';
      return { relation, intent, actions: intent === 'steps' ? steps : [], suggestions: intent === 'suggest' ? suggestions : [] };
    },
  },
});

/** Un paso de la IA sobre lo que está a la vista ahora (después del paso anterior puede haber otra ventana). */
function toParsed(step: ScreenStep): ScreenParsed | null {
  const controls = visibleControls();
  const want = normalizeSpeech(step.target);
  const pick = (...kinds: string[]) => controls.find((c) => kinds.includes(c.kind) && normalizeSpeech(c.label) === want) ?? null;
  switch (step.op) {
    case 'press': { const c = pick('button', 'link', 'tab'); return c ? { op: 'press', control: c } : null; }
    case 'tab': { const c = pick('tab', 'button'); return c ? { op: 'press', control: c } : null; }
    case 'toggle': { const c = pick('toggle'); return c ? { op: 'toggle', control: c, on: step.on ?? !c.checked } : null; }
    case 'fill': { const c = pick('field', 'search'); return c ? { op: 'fill', control: c, value: step.value ?? null } : null; }
    case 'select': { const c = pick('select'); return c ? { op: 'select', control: c, option: step.value ?? null } : null; }
    case 'search': {
      const c = pick('search', 'field');
      const value = step.value ? searchTerm(normalizeSpeech(step.value), step.value) : '';
      return c && value ? { op: 'search', control: c, value } : null;
    }
    default: return null;
  }
}

async function runSteps(steps: ScreenStep[], ctx: VoiceCommandContext) {
  for (const step of steps) {
    if (ctx.signal.aborted) return;
    await waitScreenReady(ctx.signal, 3000);
    const parsed = toParsed(step);
    if (!parsed) {
      const message = ctx.t('VoiceCommands.screenAi.stepMissing', { target: step.target });
      await ctx.finish({ title: ctx.t('VoiceCommands.label'), message, tone: 'info' }, message);
      return;
    }
    await runScreen(parsed, ctx);
    if ((ctx as { failed?: () => boolean }).failed?.()) return;
    // Lo que abrió un paso (una ventana, una lista) tiene que estar antes del siguiente.
    await new Promise((r) => setTimeout(r, 200));
  }
}

registerVoiceCommand<{ steps: ScreenStep[] }, ScreenAiResult>({
  id: 'screen.steps',
  domain: SCREEN_AI_DOMAIN,
  keepsOverlay: true,
  match: () => null,
  run: ({ steps }, ctx) => runSteps(steps, ctx),
  ai: { from: (r) => (r.intent === 'steps' && r.actions?.length ? { steps: r.actions } : null) },
});

registerVoiceCommand<{ suggestions: ScreenAiResult['suggestions'] }, ScreenAiResult>({
  id: 'screen.suggest',
  domain: SCREEN_AI_DOMAIN,
  keepsOverlay: true,
  match: () => null,
  run: async ({ suggestions }, ctx) => {
    const options = suggestions.map((s) => s.label).join(ctx.t('VoiceCommands.or'));
    const message = ctx.t('VoiceCommands.suggest.askAi', { options });
    const index = await ctx.choose({ title: ctx.t('VoiceCommands.suggest.title'), message, choices: suggestions.map((s) => ({ label: s.label })), tone: 'info', soft: true }, message);
    await runSteps([suggestions[index]], ctx);
  },
  ai: { from: (r) => (r.intent === 'suggest' && r.suggestions.length ? { suggestions: r.suggestions } : null) },
});
