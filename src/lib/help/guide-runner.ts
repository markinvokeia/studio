/**
 * Runner de guías paso a paso.
 *
 * - Al arrancar ejecuta el primer paso (o todo hasta el primer `confirm` si la
 *   guía viene con datos dictados) y deja la lista visible para avanzar con
 *   "Siguiente".
 * - `confirm` nunca se ejecuta solo: se resalta el botón y se espera el clic de
 *   la persona. Es la regla "siempre confirma el humano".
 * - Un único lock evita dos secuencias a la vez (doble clic en "Siguiente").
 *
 * El componente GuideController registra `navigate` y `currentPath` (necesitan
 * el router de Next y el locale).
 */

import {
  fillHelpTarget,
  helpSleep,
  resolveStepValue,
  waitForHelpTarget,
  waitForHumanClick,
  waitForPath,
} from '@/lib/help/guide-engine';
import { useHelpAssistant, type GuideStepStatus, type HelpSpotlight } from '@/stores/help-assistant-store';

import type { HelpGuideStep } from '@/lib/types';

export type GuideErrorCode = 'targetNotFound' | 'navigationFailed';

interface GuideRunnerDeps {
  navigate: (route: string) => void;
  currentPath: () => string;
}

let deps: GuideRunnerDeps | null = null;
let controller: AbortController | null = null;
let busy = false;
let guideKey = 0;

export function configureGuideRunner(next: GuideRunnerDeps | null) {
  deps = next;
}

const store = () => useHelpAssistant.getState();

function setStatus(index: number, status: GuideStepStatus, patch: { error?: string } = {}) {
  store().setGuide((g) => {
    if (!g) return g;
    const statuses = [...g.statuses];
    statuses[index] = status;
    return { ...g, statuses, current: index, error: patch.error };
  });
}

function spotlightFor(step: HelpGuideStep, mode: HelpSpotlight['mode']) {
  if (!step.target) return;
  // Obligatorio/opcional sólo tiene sentido para datos que completa la persona.
  const isField = step.action === 'fill' || (step.action === 'highlight' && step.target.includes('.field.'));
  store().setSpotlight({
    targetId: step.target,
    title: step.title,
    description: step.description,
    details: step.details,
    required: isField ? !step.optional : undefined,
    mode,
  });
}

type StepResult = { status: 'done' | 'waiting' | 'skipped' } | { status: 'failed'; error: GuideErrorCode };

async function execute(step: HelpGuideStep, signal: AbortSignal): Promise<StepResult> {
  if (!deps) return { status: 'failed', error: 'navigationFailed' };
  const values = store().guide?.values ?? {};

  if (step.action === 'navigate') {
    store().setSpotlight(null);
    const route = step.route ?? '/';
    if (deps.currentPath() !== route) {
      deps.navigate(route);
      const ok = await waitForPath(route, deps.currentPath, { signal });
      if (!ok) return { status: 'failed', error: 'navigationFailed' };
    }
    await helpSleep(400, signal);
    return { status: 'done' };
  }

  if (!step.target) return { status: 'failed', error: 'targetNotFound' };
  const canSkip = step.skipIfMissing || step.optional;
  const target = await waitForHelpTarget(step.target, { signal, timeoutMs: step.action === 'wait' ? 15000 : canSkip ? 2500 : 8000 });
  if (!target) return canSkip ? { status: 'skipped' } : { status: 'failed', error: 'targetNotFound' };

  switch (step.action) {
    case 'click':
      spotlightFor(step, 'action');
      await helpSleep(700, signal);
      target.control.click();
      await helpSleep(450, signal);
      return { status: 'done' };

    case 'fill': {
      const value = resolveStepValue(step.value, values);
      if (value === undefined || value === null || value === '') {
        if (step.optional) return { status: 'skipped' };
        spotlightFor(step, 'input');
        return { status: 'waiting' };
      }
      spotlightFor(step, 'action');
      await helpSleep(250, signal);
      if (!(await fillHelpTarget(target, value, signal, step.target))) {
        spotlightFor(step, 'input');
        return { status: 'waiting' };
      }
      await helpSleep(350, signal);
      return { status: 'done' };
    }

    case 'confirm':
      spotlightFor(step, 'confirm');
      return { status: 'waiting' };

    case 'highlight':
      spotlightFor(step, 'info');
      return { status: 'waiting' };

    case 'wait':
    default:
      return { status: 'done' };
  }
}

function finish() {
  store().setSpotlight(null);
  store().setGuide((g) => (g ? { ...g, finished: true, current: g.steps.length - 1 } : g));
  store().refreshOnboarding();
}

/** Tras un `confirm`, sigue sola cuando la persona pulsa el botón. */
function armConfirm(index: number, step: HelpGuideStep, signal: AbortSignal) {
  if (!step.target) return;
  waitForHumanClick(step.target, signal)
    .then(async () => {
      // "Ya lo hice" en la burbuja pudo haber avanzado la guía antes del clic.
      const guide = store().guide;
      if (!guide || guide.current !== index || guide.statuses[index] !== 'waiting') return;
      store().setSpotlight(null);
      setStatus(index, 'done');
      // Deja que el guardado termine (toast, cierre del diálogo) antes de seguir.
      await helpSleep(1200, signal);
      await runFrom(index + 1, 'single');
    })
    .catch(() => { /* guía cancelada */ });
}

async function runFrom(start: number, mode: 'single' | 'untilConfirm') {
  const guide = store().guide;
  if (!guide || busy || !controller) return;
  const signal = controller.signal;
  busy = true;
  try {
    for (let i = start; i < guide.steps.length; i++) {
      const step = guide.steps[i];
      setStatus(i, 'running');
      const result = await execute(step, signal);
      if (result.status === 'failed') {
        setStatus(i, 'failed', { error: result.error });
        return;
      }
      setStatus(i, result.status);
      if (result.status === 'waiting') {
        if (step.action === 'confirm') armConfirm(i, step, signal);
        return;
      }
      // Pasos que sólo preparan la pantalla (navegar, abrir el diálogo, esperar)
      // siguen solos hasta el primero que la persona tiene que mirar.
      const preparatory = step.action === 'navigate' || step.action === 'wait' || step.action === 'click' || result.status === 'skipped';
      if (mode === 'single' && !preparatory && i + 1 < guide.steps.length) {
        // Campo completado por el asistente: queda señalado con su detalle hasta "Siguiente".
        spotlightFor(step, 'filled');
        store().setGuide((g) => (g ? { ...g, current: i + 1 } : g));
        return;
      }
      store().setSpotlight(null);
    }
    finish();
  } catch {
    // AbortError: la guía se cerró a mitad de un paso.
  } finally {
    busy = false;
  }
}

export interface StartGuideOptions {
  values?: Record<string, unknown>;
  /** `untilConfirm`: con datos dictados, completa todo y se detiene en el OK. */
  autoRun?: 'first' | 'untilConfirm';
  useCaseId?: string;
}

export function startGuide(guide: { title: string; steps: HelpGuideStep[] }, options: StartGuideOptions = {}) {
  stopGuide();
  if (!guide.steps.length) return;
  controller = new AbortController();
  guideKey += 1;
  store().setGuide(() => ({
    key: guideKey,
    title: guide.title,
    useCaseId: options.useCaseId,
    steps: guide.steps,
    statuses: guide.steps.map(() => 'pending'),
    current: 0,
    values: options.values ?? {},
    finished: false,
  }));
  void runFrom(0, options.autoRun === 'untilConfirm' ? 'untilConfirm' : 'single');
}

/** "Siguiente": da por hecho el paso que espera a la persona y ejecuta el próximo. */
export function nextStep(mode: 'single' | 'untilConfirm' = 'single') {
  const guide = store().guide;
  if (!guide || guide.finished || busy) return;
  const status = guide.statuses[guide.current];
  if (status === 'running') return;
  const step = guide.steps[guide.current];
  if (status === 'waiting' && step.action === 'confirm' && mode === 'untilConfirm') return;
  if (status === 'waiting' || status === 'done' || status === 'skipped' || status === 'failed') {
    if (status === 'waiting') setStatus(guide.current, 'done');
    // Un paso que no se pudo ejecutar se salta: la persona decide seguir sin él.
    if (status === 'failed') setStatus(guide.current, 'skipped');
    store().setSpotlight(null);
    if (guide.current + 1 >= guide.steps.length) { finish(); return; }
    void runFrom(guide.current + 1, mode);
    return;
  }
  void runFrom(guide.current, mode);
}

export function retryStep() {
  const guide = store().guide;
  if (!guide || busy) return;
  void runFrom(guide.current, 'single');
}

export function stopGuide() {
  controller?.abort();
  controller = null;
  busy = false;
  store().setSpotlight(null);
  store().setGuide(() => null);
}
