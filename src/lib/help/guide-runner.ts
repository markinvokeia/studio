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
  findHelpTarget,
  helpSleep,
  isTypingIn,
  pressElement,
  readTargetValue,
  resolveStepValue,
  waitForHelpTarget,
  waitForHumanClick,
  waitForPath,
} from '@/lib/help/guide-engine';
import { useHelpAssistant, type GuideRun, type GuideStepStatus, type HelpSpotlight } from '@/stores/help-assistant-store';

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

/**
 * Esperas generosas: en desarrollo Next compila cada pantalla la primera vez
 * (decenas de segundos), y después la pantalla todavía carga sus datos. En
 * producción no se llega a esperar tanto; sólo tarda más en reportar un fallo real.
 */
const NAVIGATION_TIMEOUT_MS = 90_000;
/** Si a los 12 s la ruta no cambió, se vuelve a pedir la navegación (un push perdido). */
const NAVIGATION_RETRY_MS = 12_000;
const TARGET_TIMEOUT_MS = 30_000;
const WAIT_TIMEOUT_MS = 45_000;
/** Un paso opcional se salta rápido sólo cuando la pantalla ya está asentada. */
const OPTIONAL_TIMEOUT_MS = 2500;
const SETTLE_AFTER_NAVIGATION_MS = 6000;
/** A partir de cuánto se avisa "puede tardar". */
const SLOW_NOTICE_MS = 2000;

let lastNavigationAt = 0;

function setNotice(notice: GuideRun['notice']) {
  store().setGuide((g) => (g && g.notice !== notice ? { ...g, notice } : g));
}

/** Corre `task` y, si tarda, muestra el aviso mientras dura. */
async function withNotice<T>(notice: NonNullable<GuideRun['notice']>, task: () => Promise<T>): Promise<T> {
  const timer = setTimeout(() => setNotice(notice), SLOW_NOTICE_MS);
  try {
    return await task();
  } finally {
    clearTimeout(timer);
    setNotice(undefined);
  }
}

async function navigateTo(route: string, signal: AbortSignal): Promise<boolean> {
  const { navigate, currentPath } = deps!;
  const deadline = Date.now() + NAVIGATION_TIMEOUT_MS;
  navigate(route);
  while (Date.now() < deadline) {
    const slice = Math.min(NAVIGATION_RETRY_MS, deadline - Date.now());
    if (await waitForPath(route, currentPath, { signal, timeoutMs: slice })) return true;
    navigate(route);
  }
  return currentPath() === route;
}

async function execute(step: HelpGuideStep, signal: AbortSignal): Promise<StepResult> {
  if (!deps) return { status: 'failed', error: 'navigationFailed' };
  const values = store().guide?.values ?? {};

  if (step.action === 'navigate') {
    store().setSpotlight(null);
    const route = step.route ?? '/';
    if (deps.currentPath() !== route) {
      const ok = await withNotice('loadingScreen', () => navigateTo(route, signal));
      if (!ok) return { status: 'failed', error: 'navigationFailed' };
      lastNavigationAt = Date.now();
    }
    await helpSleep(400, signal);
    return { status: 'done' };
  }

  if (!step.target) return { status: 'failed', error: 'targetNotFound' };
  const canSkip = step.skipIfMissing || step.optional;
  const settled = Date.now() - lastNavigationAt > SETTLE_AFTER_NAVIGATION_MS;
  const timeoutMs = step.action === 'wait' ? WAIT_TIMEOUT_MS : canSkip && settled ? OPTIONAL_TIMEOUT_MS : TARGET_TIMEOUT_MS;
  const target = await withNotice('loadingElement', () => waitForHelpTarget(step.target!, { signal, timeoutMs }));
  if (!target) return canSkip ? { status: 'skipped' } : { status: 'failed', error: 'targetNotFound' };

  switch (step.action) {
    case 'click':
      // La mascota señala un momento antes de pulsar, para que se vea qué hace.
      spotlightFor(step, 'action');
      await helpSleep(1000, signal);
      pressElement(target.control);
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

/** Da por hecho un paso que esperaba a la persona y sigue con el próximo. */
async function completeWaitingStep(index: number, signal: AbortSignal, pauseMs: number) {
  const guide = store().guide;
  if (!guide || guide.current !== index || guide.statuses[index] !== 'waiting' || busy) return;
  store().setSpotlight(null);
  setStatus(index, 'done');
  await helpSleep(pauseMs, signal);
  if (index + 1 >= guide.steps.length) { finish(); return; }
  await runFrom(index + 1, 'single');
}

const VALUE_POLL_MS = 300;
/** `doneOnClose`: cuánto tiene que estar cerrado el menú para darlo por hecho. */
const GONE_SETTLE_MS = 600;
/** Tras elegir una opción o marcar un check, cuánto se espera antes de avanzar. */
const SETTLE_CHOICE_MS = 700;
/** Si la persona sigue escribiendo, se espera a que haga una pausa. */
const SETTLE_TYPING_MS = 1800;

/**
 * Mientras la guía espera a la persona, mira el elemento señalado: un campo
 * avanza cuando cambia su valor; un botón, tab o sección, cuando lo pulsa.
 */
function armAutoAdvance(index: number, step: HelpGuideStep, signal: AbortSignal) {
  if (!step.target) return;
  if (step.until) {
    // Gestos que no se pueden hacer por la persona (clic derecho, arrastrar): sigue
    // cuando aparece lo que ese gesto abre (el menú del turno, la tarjeta).
    const ids = Array.isArray(step.until) ? step.until : [step.until];
    const timer = setInterval(() => {
      const guide = store().guide;
      if (signal.aborted || !guide || guide.current !== index || guide.statuses[index] !== 'waiting') {
        clearInterval(timer);
        return;
      }
      if (ids.some((id) => findHelpTarget(id))) {
        clearInterval(timer);
        void completeWaitingStep(index, signal, 250);
      }
    }, VALUE_POLL_MS);
    signal.addEventListener('abort', () => clearInterval(timer), { once: true });
    return;
  }
  if (!step.target.includes('.field.')) {
    waitForHumanClick(step.target, signal)
      .then(() => completeWaitingStep(index, signal, 900))
      .catch(() => { /* guía cancelada */ });
    if (step.doneOnClose) {
      // Eligió otra opción del menú (o lo cerró): el elemento señalado ya no está.
      let goneSince = 0;
      const timer = setInterval(() => {
        const guide = store().guide;
        if (signal.aborted || !guide || guide.current !== index || guide.statuses[index] !== 'waiting') {
          clearInterval(timer);
          return;
        }
        if (findHelpTarget(step.target!)) { goneSince = 0; return; }
        if (!goneSince) goneSince = Date.now();
        else if (Date.now() - goneSince >= GONE_SETTLE_MS) {
          clearInterval(timer);
          void completeWaitingStep(index, signal, 300);
        }
      }, VALUE_POLL_MS);
      signal.addEventListener('abort', () => clearInterval(timer), { once: true });
    }
    return;
  }
  const first = findHelpTarget(step.target);
  if (!first) return;
  const initial = readTargetValue(first);
  let last = initial;
  let changedAt = 0;
  const timer = setInterval(() => {
    const guide = store().guide;
    if (signal.aborted || !guide || guide.current !== index || guide.statuses[index] !== 'waiting') {
      clearInterval(timer);
      return;
    }
    const target = findHelpTarget(step.target!);
    if (!target) return;
    const value = readTargetValue(target);
    if (value !== last) { last = value; changedAt = Date.now(); return; }
    const settle = isTypingIn(target) ? SETTLE_TYPING_MS : SETTLE_CHOICE_MS;
    if (value !== initial && changedAt && Date.now() - changedAt >= settle) {
      clearInterval(timer);
      void completeWaitingStep(index, signal, 300);
    }
  }, VALUE_POLL_MS);
  signal.addEventListener('abort', () => clearInterval(timer), { once: true });
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
        else armAutoAdvance(i, step, signal);
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
  // Mientras guía, lo principal es la navegación y la mascota: el chat se cierra.
  store().close();
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

/** Pasos que la persona ve (no los que sólo preparan la pantalla). */
const isVisibleStep = (step: HelpGuideStep) => step.action === 'fill' || step.action === 'highlight' || step.action === 'confirm';

/**
 * Salta a un paso. Hacia atrás, ese paso y los siguientes vuelven a pendiente;
 * hacia adelante, los intermedios quedan saltados. Primero (0) reinicia la guía,
 * incluida la navegación.
 */
export function goToStep(target: number) {
  const guide = store().guide;
  if (!guide || busy) return;
  const index = Math.max(0, Math.min(guide.steps.length - 1, target));
  const statuses = guide.statuses.map((status, i): GuideStepStatus => {
    if (i >= index) return 'pending';
    return status === 'done' || status === 'skipped' ? status : 'skipped';
  });
  store().setSpotlight(null);
  store().setGuide((g) => (g ? { ...g, statuses, current: index, finished: false, error: undefined } : g));
  void runFrom(index, 'single');
}

/** Paso visible anterior al que se está mostrando (un campo completado se muestra aunque `current` ya avanzó). */
export function previousStep() {
  const guide = store().guide;
  if (!guide || busy) return;
  const shown = store().spotlight?.mode === 'filled' ? guide.current - 1 : guide.current;
  for (let i = shown - 1; i >= 0; i--) {
    if (isVisibleStep(guide.steps[i])) { goToStep(i); return; }
  }
  goToStep(0);
}

/** "Saltar": deja el paso actual sin hacer y sigue con el próximo. */
export function skipStep() {
  const guide = store().guide;
  if (!guide || guide.finished || busy) return;
  setStatus(guide.current, 'skipped');
  store().setSpotlight(null);
  if (guide.current + 1 >= guide.steps.length) { finish(); return; }
  void runFrom(guide.current + 1, 'single');
}

export function lastStep() {
  const guide = store().guide;
  if (guide) goToStep(guide.steps.length - 1);
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
