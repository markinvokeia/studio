import { speakAssistant, stopAssistantSpeech, useAssistantVoice } from '@/hooks/use-assistant-voice';
import { useVoiceCommand } from '@/stores/voice-command-store';
import { parseChoice, parseChoiceDetailed, parseYesNo, normalizeSpeech } from '@/lib/voice/parse';
import { interpretWithAi } from '@/lib/voice/ai';
import { suggestActions } from '@/lib/voice/suggest';
import { closeTopOverlay, hasOpenOverlay, voiceEscape, isDialogOpen, pickDialogButton, pickOverlayButton, pickOverlayField, readOpenDialog, readTopOverlay, setFieldValue, watchDialogs, watchOverlays, type OpenDialog, type OpenOverlay } from '@/lib/voice/dom-dialog';
import { controlsOf, isScreenLoading, readSurface, waitScreenReady } from '@/lib/voice/dom-ui';
import { valueForField } from '@/lib/voice/field-values';
import { setAppointmentFocus } from '@/lib/voice/focus';
import { getVoiceDomain, listVoiceAiDomains, matchVoiceAiResult, matchVoiceCommand } from '@/lib/voice/registry';
import {
  listenOnce,
  startContinuousListening,
  startHoldListening,
  type ContinuousListening,
  type HoldListening,
} from '@/lib/voice/speech-recognition';
import { extractWake, isCancelPhrase, isCompoundRequest, isForgetFocusPhrase, isResumePhrase, isStopListeningPhrase, looksLikeCommand, wordCount } from '@/lib/voice/wake';

import type { VoiceAiPlan, VoiceAskOptions, VoiceCard, VoiceCommand, VoiceCommandContext, VoiceRelation } from '@/lib/types';

/**
 * Sesión de voz. Dos formas de hablar:
 * - Ctrl+Espacio mantenido: una frase, sin palabra de activación.
 * - Botón Voz («siempre escuchando»): el micrófono queda abierto; solo actúa con «Invoke …» o
 *   con la conversación abierta (atento). Sin hablar un rato se duerme guardando la tarea.
 *
 * Cada pedido es una tarea. Las preguntas que hace (¿cuál?, ¿confirmo?) forman una pila: una
 * herramienta en el medio (moverse, vista, zoom, huecos…) se hace sin cancelar la tarea y después
 * se repite la pregunta; un pedido que no tiene nada que ver pregunta si se deja la tarea; la IA
 * puede devolver varios pasos que se hacen en orden. Las reglas están en docs/voz-agenda.md.
 *
 * Es un módulo (como el runner de guías), no un componente: el host (VoiceCommandHost) le pasa
 * el locale, el traductor, los permisos y la navegación con configureVoiceSession.
 */

export interface VoiceSessionDeps {
  locale: string;
  t: VoiceCommandContext['t'];
  hasPermission: (code: string) => boolean;
  navigate: (route: string) => void;
  /** Módulos activos en la pantalla (VoiceDomain.id), en orden: solo esos comandos y esa IA. */
  domains: readonly string[];
}

/** Tiempo para empezar a responder después de una pregunta (Ctrl+Espacio). */
const ANSWER_WINDOW_MS = 6000;
/** La tarjeta del resultado se va sola. */
const RESULT_VISIBLE_MS = 12000;
/** Cerrar la tarjeta con un resultado (la del agente clínico no se esconde sola). */
const DISMISS_RE = /^(?:(?:ok|okay|bueno|listo|dale|ya)\s)?(?:cerra\w*|cierra\w*|cerrar|oculta\w*|esconde\w*|saca\w* (?:eso|la tarjeta)|listo|entendido|gracias|muchas gracias|perfecto|ok|okay|ya (?:lo )?lei|close(?: it| that| the card)?|dismiss|hide(?: it)?|got it|thanks|thank you|perfect)(?:\s(?:la tarjeta|eso|gracias|por favor|please|thanks))*$/;
/** Cuánto queda a la vista un resultado: lo justo para leerlo (más largo, más tiempo; hasta 30 s). */
function visibleMs(card: VoiceCard): number {
  const chars = (card.message?.length ?? 0) + (card.rows ?? []).reduce((n, r) => n + r.label.length + r.value.length, 0);
  return Math.min(30000, Math.max(RESULT_VISIBLE_MS, 3000 + chars * 70));
}
/** Respuestas que no se entienden antes de dejarlo sin hacer. */
const MAX_UNCLEAR = 2;
/** Por debajo de esto la IA "adivinó": se dice que no se entendió (igual siempre se confirma). */
const MIN_AI_CONFIDENCE = 0.5;
/** Tiempos de la conversación (las pruebas los acortan con configureVoiceTiming). */
const timing = {
  /** Micrófono prendido: sin hablarle este tiempo se duerme (se apaga). */
  awakeIdleMs: 90000,
  /** …y con una pregunta abierta se espera más antes de dormirse (la tarea queda guardada). */
  awakePendingMs: 180000,
  /** Después de una herramienta en el medio, cuánto se ve su resultado antes de volver a preguntar. */
  auxReturnMs: 1200,
  /**
   * Micrófono prendido: el navegador cierra una frase en cualquier pausa corta. Los pedazos se
   * juntan hasta que pase este tiempo sin oír nada, así una pausa no parte el pedido en dos.
   */
  phraseGapMs: 1200,
  /** Después de que habla el asistente, cuánto más se descarta lo que se oye (su propio eco). */
  echoGraceMs: 350,
};

export function configureVoiceTiming(next: Partial<typeof timing>) {
  Object.assign(timing, next);
}
/** Respuestas con más palabras que esto se le preguntan a la IA (¿es respuesta o algo nuevo?). */
const ANSWER_MAX_WORDS = 4;
/** Pasos máximos de un plan. */
const MAX_PLAN_STEPS = 6;
/** Entre MIN_AI_CONFIDENCE y esto la IA duda (dos lecturas parejas): se pregunta antes de hacerlo. */
const SURE_AI_CONFIDENCE = 0.8;

let deps: VoiceSessionDeps | null = null;
/** La tarea en curso: se corta con Escape, "cancelar" o al cambiar de tema. */
let controller: AbortController | null = null;
/** Escucha automática después de una pregunta (Ctrl+Espacio). */
let listenController: AbortController | null = null;
let hold: HoldListening | null = null;
let continuous: ContinuousListening | null = null;
let awakeTimer: ReturnType<typeof setTimeout> | undefined;
let hideTimer: ReturnType<typeof setTimeout> | undefined;
let speaking = false;
/** Interpretaciones de la IA en vuelo y la vuelta a la pregunta después de una herramienta. */
let inflight = 0;
let returnTimer: ReturnType<typeof setTimeout> | undefined;
/** Lo que se va diciendo con el micrófono prendido, hasta la pausa (ver timing.phraseGapMs). */
let phraseBuffer = '';
let phraseTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * La sesión terminó de procesar lo último que se dijo: no habla, no piensa, no corre nada (o lo
 * que corre está esperando una respuesta). Lo usan las pruebas para esperar entre frase y frase.
 */
export function isVoiceSettled(): boolean {
  return !speaking && inflight === 0 && !auxController && returnTimer === undefined && phraseTimer === undefined && !hold && (pendingStack.length > 0 || !controller);
}

/** Una pregunta abierta: la de arriba de la pila recibe la próxima frase. */
interface PendingAsk {
  owner: AbortSignal;
  card: VoiceCard;
  speech: string;
  awaiting: 'answer' | 'confirm' | 'choice';
  options?: VoiceAskOptions;
  resolve: (text: string) => void;
}
const pendingStack: PendingAsk[] = [];
const topPending = () => pendingStack[pendingStack.length - 1] ?? null;

const store = () => useVoiceCommand.getState();

let stopWatchingDialogs: (() => void) | null = null;

/** La pantalla cambió (otra página): otros módulos activos, sin apagar el micrófono ni cortar nada. */
export function updateVoiceDomains(domains: readonly string[]) {
  if (deps) deps = { ...deps, domains };
}

/** Los módulos de voz activos ahora (los de la página abierta más `core`). */
export function activeVoiceDomains(): readonly string[] {
  return deps?.domains ?? [];
}

/**
 * Lo que queda del pedido para después de la tarea («andá a pacientes y buscá a Juan»: «buscá a
 * Juan» en la página nueva). Lo pone un paso con ctx.followUp y lo toma runFound al terminar.
 */
let followUpText: string | null = null;

export function configureVoiceSession(next: VoiceSessionDeps | null) {
  deps = next;
  stopWatchingDialogs?.();
  stopWatchingDialogs = null;
  stopWatchingOverlays?.();
  stopWatchingOverlays = null;
  if (!next) {
    stopAlwaysOn();
    cancelVoice();
    return;
  }
  stopWatchingDialogs = watchDialogs(onDialogOpen, onDialogClose);
  stopWatchingOverlays = watchOverlays(onOverlayOpen, () => { overlayDuringTask = null; });
}

// ── Ventanas que se abren ─────────────────────────────────────────────────────

let stopWatchingOverlays: (() => void) | null = null;
/** La ventana que se abrió mientras corría una tarea (se ofrece al terminar). */
let overlayDuringTask: OpenOverlay | null = null;

const CLOSE_LABEL = /^(?:x|cerrar|close|×)$/i;

/** Los botones que hacen algo con la ventana van primero (guardar, cancelar…), después el resto. */
const PRIMARY_BUTTON = /^(?:guardar|grabar|crear|confirmar|aceptar|aplicar|cobrar|facturar|enviar|continuar|siguiente|finalizar|cancelar|cerrar|eliminar|borrar|descartar|save|create|confirm|accept|apply|charge|invoice|collect|pay|send|continue|next|finish|cancel|close|delete|discard)\b/i;
/** Lo que no sirve ofrecer: fechas sueltas, números, «Ampliar ventana». */
const NOT_OFFERED = /^(?:\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d+|ampliar ventana|expand window|reducir ventana)$/i;

/** «Se abrió «Nueva sede». Podés completar Nombre, Dirección… o decir Guardar o Cancelar.» */
function overlayPrompt(overlay: OpenOverlay): { message: string; choices: Array<{ label: string }> } | null {
  if (!deps) return null;
  const or = deps.t('VoiceCommands.or');
  // Los nombres como los entiende la voz (la etiqueta del campo, no su ejemplo); si no, los del DOM.
  const surface = readSurface();
  const own = surface?.isOverlay ? surface : null;
  const surfaceFields = own ? controlsOf(own, 'field', 'select').map((c) => c.label) : [];
  const surfaceButtons = own ? controlsOf(own, 'button').map((c) => c.label) : [];
  const fieldLabels = surfaceFields.length ? surfaceFields : overlay.fields.map((f) => f.label);
  const buttonLabels = surfaceButtons.length ? surfaceButtons : overlay.buttons.map((b) => b.label);
  const cleanButtons = Array.from(new Set(buttonLabels.filter((l) => l.length <= 40 && !CLOSE_LABEL.test(l) && !NOT_OFFERED.test(l.trim()))));
  const buttons = [...cleanButtons.filter((l) => PRIMARY_BUTTON.test(l)), ...cleanButtons.filter((l) => !PRIMARY_BUTTON.test(l))].slice(0, 6);
  const fields = Array.from(new Set(fieldLabels.filter((l) => l.length <= 40 && !/\.\.\.|…$/.test(l)))).slice(0, 4);
  if (!buttons.length && !fields.length) return null;
  const message = fields.length
    ? deps.t('VoiceCommands.overlayAskFields', { title: overlay.title, fields: fields.join(', '), options: buttons.join(or) || '—' })
    : deps.t('VoiceCommands.overlayAsk', { title: overlay.title, options: buttons.join(or) });
  return { message, choices: buttons.map((label) => ({ label })) };
}

/**
 * Se abrió una ventana o un panel (a mano o por voz) con la voz prendida: se dice cuál y qué se le
 * puede pedir (sus botones y sus campos). No es una pregunta que trabe: lo que se diga después va
 * primero a esa ventana (pressOrFillOverlay) y cualquier otro pedido sigue normal.
 */
function onOverlayOpen(overlay: OpenOverlay) {
  if (!deps || !store().alwaysOn) return;
  // Abierta por una tarea en curso: se ofrece cuando termine (si sigue abierta).
  if (controller || inflight > 0) { overlayDuringTask = overlay; return; }
  if (pendingStack.length) return;
  const prompt = overlayPrompt(overlay);
  if (!prompt) return;
  const card: VoiceCard = { title: overlay.title, message: prompt.message, choices: prompt.choices, tone: 'info', soft: true };
  clearTimeout(hideTimer);
  store().set({ card, awaiting: null });
  hideTimer = setTimeout(() => { if (store().card === card && !pendingStack.length) store().reset(); }, visibleMs(card));
}

/** Al terminar una tarea que abrió una ventana: el resultado más lo que se le puede pedir a la ventana. */
function offerOverlayAfterTask() {
  const overlay = overlayDuringTask;
  overlayDuringTask = null;
  if (!overlay || !deps || pendingStack.length) return;
  const top = readTopOverlay();
  if (!top || top.element !== overlay.element) return;
  const card = store().card;
  if (card && (card.sticky || card.tone === 'error' || store().awaiting)) return;
  const prompt = overlayPrompt(top);
  if (!prompt) return;
  const next: VoiceCard = {
    ...(card ?? { title: top.title, tone: 'info' as const }),
    message: [card?.message, prompt.message].filter(Boolean).join(' '),
    choices: card?.choices?.length ? card.choices : prompt.choices,
    soft: true,
  };
  clearTimeout(hideTimer);
  store().set({ card: next });
  hideTimer = setTimeout(() => { if (store().card === next && !pendingStack.length) store().reset(); }, visibleMs(next));
}

// ── Avisos de la pantalla ─────────────────────────────────────────────────────

/** La pregunta abierta por el aviso de arriba (si la voz la hizo). */
let dialogEntry: PendingAsk | null = null;
let dialogOwner: AbortController | null = null;

/**
 * Se abrió un aviso («¿Seguro que querés borrar…?», «Ya tiene citas futuras…») y la voz está en
 * uso: se lee, se dicen sus botones y se pregunta cuál apretar. Lo que se conteste aprieta ese
 * botón (por su texto, su posición o sí/no).
 */
function onDialogOpen(dialog: OpenDialog) {
  if (!deps || (!store().alwaysOn && !controller && !hold)) return;
  removeDialogEntry();
  const labels = dialog.buttons.map((b) => b.label);
  const or = deps.t('VoiceCommands.or');
  const question = deps.t('VoiceCommands.dialogAsk', { options: labels.join(or) });
  const card: VoiceCard = {
    title: dialog.title || deps.t('VoiceCommands.dialogTitle'),
    message: [dialog.description, question].filter(Boolean).join(' '),
    choices: labels.map((label) => ({ label })),
    tone: dialog.buttons.some((b) => /eliminar|borrar|delete|remove|descartar|discard/i.test(b.label)) ? 'danger' : 'confirm',
  };
  const own = new AbortController();
  dialogOwner = own;
  let unclear = 0;
  const entry: PendingAsk = {
    owner: own.signal,
    card,
    speech: [dialog.title, question].filter(Boolean).join('. '),
    awaiting: 'choice',
    resolve: (text) => {
      const current = readOpenDialog();
      const button = current ? pickDialogButton(normalizeSpeech(text), current.buttons) : null;
      if (button) {
        dialogEntry = null;
        button.element.click();
        // Algunos avisos piden elegir y después confirmar: si sigue abierto, se vuelve a preguntar.
        setTimeout(() => {
          const again = readOpenDialog();
          if (again && again.element === dialog.element && !dialogEntry) onDialogOpen(again);
        }, 200);
        store().set({ card: { title: card.title, message: deps!.t('VoiceCommands.dialogPressed', { label: button.label }), tone: 'success' }, awaiting: null, phase: controller ? 'running' : 'idle' });
        return;
      }
      if (!current) { dialogEntry = null; return; }
      // Otro pedido (otra pantalla, otro tema): cambio de contexto. Se cierra el aviso sin elegir
      // (como Escape) y se hace lo nuevo.
      const normalizedText = normalizeSpeech(text);
      const other = deps ? matchVoiceCommand(deps.domains, normalizedText, text, (c) => c.id === 'core.screen' || c.id === 'core.close') : null;
      if (other && parseYesNo(normalizedText) === null) {
        dialogEntry = null;
        voiceEscape(current.element);
        setTimeout(() => { if (deps) void handleText(text, { conversational: false }); }, 250);
        return;
      }
      if (++unclear > MAX_UNCLEAR) { dialogEntry = null; store().set({ awaiting: null }); return; }
      pendingStack.push(entry);
      store().set({ card: { ...card, message: deps!.t('VoiceCommands.dialogAskAgain', { options: labels.join(or) }) }, awaiting: 'choice', phase: 'waiting' });
      void speak(deps!.locale, deps!.t('VoiceCommands.dialogAskAgain', { options: labels.join(or) }));
    },
  };
  dialogEntry = entry;
  pendingStack.push(entry);
  clearTimeout(hideTimer);
  store().set({ card, awaiting: 'choice' });
  void speak(deps.locale, entry.speech).then(() => {
    if (topPending() === entry) store().set({ phase: 'waiting' });
  });
}

function removeDialogEntry() {
  if (!dialogEntry) return;
  const index = pendingStack.indexOf(dialogEntry);
  if (index >= 0) pendingStack.splice(index, 1);
  dialogEntry = null;
  dialogOwner?.abort();
  dialogOwner = null;
}

/** El aviso se cerró (con el mouse o por voz): se saca su pregunta y se vuelve a la anterior. */
function onDialogClose() {
  if (!dialogEntry) return;
  const wasTop = topPending() === dialogEntry;
  removeDialogEntry();
  if (wasTop && pendingStack.length) representPending();
  else if (wasTop) store().set({ awaiting: null, phase: controller ? 'running' : 'idle' });
}

function abortError() {
  return new DOMException('Voice command cancelled', 'AbortError');
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function stopAutoListen() {
  listenController?.abort();
  listenController = null;
}

// ── Siempre escuchando ────────────────────────────────────────────────────────

const ALWAYS_ON_KEY = 'voice-always-on';

/** Se recuerda por navegador: al volver a la pantalla, el micrófono sigue como se dejó. */
export function wasAlwaysOn(): boolean {
  try { return window.localStorage.getItem(ALWAYS_ON_KEY) === 'true'; } catch { return false; }
}

function rememberAlwaysOn(on: boolean) {
  try { window.localStorage.setItem(ALWAYS_ON_KEY, String(on)); } catch { /* bloqueado: no se recuerda */ }
}

/** Botón Voz: prende o apaga el micrófono. */
export function toggleAlwaysOn() {
  if (store().alwaysOn) {
    stopAlwaysOn();
    rememberAlwaysOn(false);
  } else {
    startAlwaysOn();
  }
}

/** Mientras suena cualquier voz del asistente (comandos o la mascota leyendo una guía) el micrófono
 *  no escucha: si no, lo que dice se tomaría como un pedido. */
let unsubscribeAssistantVoice: (() => void) | null = null;
function watchAssistantVoice(on: boolean) {
  unsubscribeAssistantVoice?.();
  unsubscribeAssistantVoice = null;
  if (!on) return;
  unsubscribeAssistantVoice = useAssistantVoice.subscribe((state, prev) => {
    if (state.speakingId === prev.speakingId || speaking) return;
    if (state.speakingId) continuous?.pause();
    else continuous?.resume();
  });
}

/**
 * Prende el micrófono: desde ahí escucha y procesa todo lo que se dice (no hace falta ninguna
 * palabra de activación). Sigue prendido hasta apagarlo o hasta un rato sin hablarle, y ahí se
 * duerme (se apaga) guardando la tarea; al prenderlo de nuevo retoma la pregunta abierta.
 */
export function startAlwaysOn(): boolean {
  if (!deps || continuous) return !!continuous;
  stopAutoListen();
  const next = startContinuousListening(deps.locale, {
    softPause: true,
    echoGraceMs: timing.echoGraceMs,
    onPhrase: (text) => {
      phraseBuffer = phraseBuffer ? `${phraseBuffer} ${text}` : text;
      store().set({ interim: phraseBuffer });
      schedulePhrase();
    },
    onInterim: (interim) => {
      if (store().hearing !== !!interim) store().set({ hearing: !!interim });
      if (interim) {
        // Sigue hablando: todavía no se procesa lo juntado.
        clearTimeout(phraseTimer);
        phraseTimer = undefined;
        store().set({ interim: phraseBuffer ? `${phraseBuffer} ${interim}` : interim });
        keepAwake();
      } else if (phraseBuffer) schedulePhrase();
    },
    onError: () => {
      stopAlwaysOn();
      rememberAlwaysOn(false);
      store().set({ card: { title: deps?.t('VoiceCommands.label') ?? '', message: deps?.t('VoiceCommands.micError') ?? '', tone: 'error' } });
    },
  });
  if (!next) return false;
  continuous = next;
  rememberAlwaysOn(true);
  watchAssistantVoice(true);
  store().set({ alwaysOn: true, awake: true });
  keepAwake();
  // Se había dormido con una pregunta abierta: se retoma.
  if (pendingStack.length) representPending();
  else if (!store().card) store().set({ card: { title: deps.t('VoiceCommands.label'), message: deps.t('VoiceCommands.listeningAwake'), tone: 'info' } });
  return true;
}

function schedulePhrase() {
  clearTimeout(phraseTimer);
  phraseTimer = setTimeout(() => {
    phraseTimer = undefined;
    const text = phraseBuffer;
    phraseBuffer = '';
    if (text) onAlwaysPhrase(text);
  }, timing.phraseGapMs);
}

/** El botón Voz está escuchando ahora (el micrófono permanente prendido). */
export function isVoiceListeningAlways(): boolean {
  return continuous !== null;
}

export function stopAlwaysOn() {
  clearTimeout(phraseTimer);
  phraseTimer = undefined;
  phraseBuffer = '';
  clearTimeout(awakeTimer);
  watchAssistantVoice(false);
  continuous?.abort();
  continuous = null;
  store().set({ alwaysOn: false, awake: false, interim: '', hearing: false });
}

/** Cada vez que se le habla, el micrófono sigue prendido otro rato. */
function keepAwake() {
  if (!continuous) return;
  clearTimeout(awakeTimer);
  const wait = pendingStack.length ? timing.awakePendingMs : timing.awakeIdleMs;
  awakeTimer = setTimeout(fallAsleep, wait);
}

/** Un rato sin hablarle: se duerme (apaga el micrófono). Con una pregunta abierta la guarda. */
function fallAsleep() {
  if (!continuous) return;
  // Mientras trabaja (buscando, guardando) no se duerme: vuelve a mirar en un rato.
  if (store().phase === 'thinking' || store().phase === 'running' || speaking || controller && !pendingStack.length) {
    awakeTimer = setTimeout(fallAsleep, timing.awakeIdleMs);
    return;
  }
  const suspended = pendingStack.length > 0;
  stopAlwaysOn();
  rememberAlwaysOn(false);
  store().set({ suspended });
  if (!suspended && store().phase === 'idle') store().reset();
}

function onAlwaysPhrase(raw: string) {
  store().set({ hearing: false });
  if (!deps || speaking) return;
  keepAwake();
  // «Invoke …» no hace falta, pero si se dice se saca (y lo que sigue sí es para el asistente).
  const wake = extractWake(raw);
  if (wake.woke && !wake.rest) {
    if (pendingStack.length) { representPending(); return; }
    store().set({ heard: raw, interim: '', card: { title: deps.t('VoiceCommands.label'), message: deps.t('VoiceCommands.listeningAwake'), tone: 'info' }, phase: 'idle' });
    return;
  }
  handleText(wake.woke ? wake.restRaw : raw, { conversational: !wake.woke });
}

// ── Mantener para hablar ──────────────────────────────────────────────────────

/** Ctrl+Espacio apretado: corta lo que se esté diciendo o escuchando y empieza a escuchar. */
export function startPushToTalk() {
  if (!deps || hold) return;
  clearTimeout(hideTimer);
  stopAutoListen();
  stopAssistantSpeech();
  continuous?.pause();
  const next = startHoldListening(deps.locale, (interim) => store().set({ interim }));
  if (!next) { continuous?.resume(); return; }
  hold = next;
  store().set({ phase: 'listening', interim: '' });
}

/** Ctrl+Espacio suelto: lo dicho va a la pregunta pendiente o es un pedido nuevo. */
export async function endPushToTalk() {
  const current = hold;
  if (!current) return;
  hold = null;
  const text = await current.stop();
  continuous?.resume();
  if (continuous) keepAwake();
  // La palabra de activación también vale acá («Invoke, andá al jueves»).
  const wake = extractWake(text);
  handleText(wake.woke ? wake.restRaw : text, { conversational: false });
}

/** Micrófono de la pantalla: con «siempre escuchando» lo apaga o prende; si no, una frase. */
export async function listenByClick() {
  toggleAlwaysOn();
}

/** Escape o "Cancelar": corta todo y cierra la tarjeta (el micrófono permanente sigue). */
export function cancelVoice() {
  controller?.abort();
  controller = null;
  auxController?.abort();
  auxController = null;
  stopAutoListen();
  hold?.abort();
  hold = null;
  pendingStack.length = 0;
  clearTimeout(hideTimer);
  stopAssistantSpeech();
  speaking = false;
  continuous?.resume();
  store().reset();
}

/** Respuesta desde un botón de la tarjeta (Confirmar, una opción). */
export function answerFromCard(text: string) {
  if (!pendingStack.length) return;
  stopAutoListen();
  stopAssistantSpeech();
  resolveTop(text);
}

async function autoListen(windowMs: number) {
  if (!deps || continuous) return; // Con el micrófono permanente la respuesta llega sola.
  stopAutoListen();
  const listening = new AbortController();
  listenController = listening;
  store().set({ phase: 'listening', interim: '' });
  const text = await listenOnce(deps.locale, {
    timeoutMs: windowMs,
    signal: listening.signal,
    onInterim: (interim) => store().set({ interim }),
  });
  if (listening.signal.aborted || listenController !== listening) return;
  listenController = null;
  handleText(text, { conversational: false });
}

// ── Qué hacer con una frase ───────────────────────────────────────────────────

interface HandleOptions {
  /** Dicha sin «Invoke» con la conversación abierta: si no se entiende, no era para el asistente. */
  conversational: boolean;
}

function resolveTop(text: string) {
  const top = pendingStack.pop();
  if (!top) return;
  store().set({ awaiting: null, phase: 'thinking', suspended: false });
  top.resolve(text);
}

/** Vuelve a mostrar y decir la pregunta abierta (después de una herramienta o al retomar). */
function representPending() {
  const top = topPending();
  if (!top || !deps) return;
  store().set({ card: top.card, awaiting: top.awaiting, suspended: false });
  void (async () => {
    await speak(deps!.locale, top.speech);
    if (topPending() === top) {
      store().set({ phase: 'waiting' });
      void autoListen(ANSWER_WINDOW_MS);
    }
  })();
}

function handleText(text: string, opts: HandleOptions) {
  const heard = text.trim();
  if (!heard) {
    // Nada a tiempo: la pregunta queda en la tarjeta (se responde con la voz o los botones).
    store().set({ phase: pendingStack.length ? 'waiting' : 'idle', interim: '' });
    if (!pendingStack.length && store().card === null) store().reset();
    return;
  }
  const normalized = normalizeSpeech(heard);
  store().set({ heard, interim: '' });

  // «dejá de escuchar», «pausá el dictado», «stop listening»: se apaga el micrófono (la tarea queda guardada).
  if (isStopListeningPhrase(normalized)) {
    const suspended = pendingStack.length > 0;
    stopAlwaysOn();
    rememberAlwaysOn(false);
    store().set({ suspended });
    void quickFinish(deps!.t('VoiceCommands.listeningStopped'));
    return;
  }

  // Un aviso abierto preguntando: lo dicho es para sus botones («Cancelar» es su botón, no cortar la tarea).
  if (dialogEntry && topPending() === dialogEntry) {
    resolveTop(heard);
    return;
  }
  // El formulario (o el exportar) en manos de la voz recibe todo, también «cancelar» (lo cierra).
  const first = topPending();
  if (first?.options?.corrections && !isResumePhrase(normalized)) {
    resolveTop(heard);
    return;
  }
  if (isCancelPhrase(normalized) && (pendingStack.length || controller)) {
    void cancelTask();
    return;
  }
  // «cerrá», «listo», «gracias»: con un resultado a la vista (y nada abierto ni pendiente), se cierra la tarjeta.
  // Si un comando de la pantalla lo entiende («cerrá» cierra la búsqueda o los paneles de la agenda), es de él.
  if (!pendingStack.length && !controller && store().card && !hasOpenOverlay() && DISMISS_RE.test(normalized)
    && (store().card!.sticky || !(deps && matchVoiceCommand(deps.domains, normalized, heard)))) {
    clearTimeout(hideTimer);
    store().reset();
    return;
  }
  if (isForgetFocusPhrase(normalized)) {
    setAppointmentFocus(null);
    void quickFinish(deps!.t('VoiceCommands.focusCleared'));
    return;
  }
  const top = topPending();
  if (top) {
    void routeToPending(top, heard, normalized, opts);
    return;
  }
  if (isResumePhrase(normalized)) {
    void quickFinish(deps!.t('VoiceCommands.nothingToResume'));
    return;
  }
  // Un aviso de la pantalla abierto (sin pregunta de la voz): se aprieta el botón nombrado.
  const open = isDialogOpen() ? readOpenDialog() : null;
  const button = open ? pickDialogButton(normalized, open.buttons) : null;
  if (button) {
    button.element.click();
    store().set({ phase: controller ? 'running' : 'idle' });
    return;
  }
  void runRequest(heard, normalized, opts);
}

/** Hay una pregunta abierta: ¿esto la contesta, es una herramienta, algo nuevo o nada? */
async function routeToPending(top: PendingAsk, heard: string, normalized: string, opts: HandleOptions) {
  if (isResumePhrase(normalized)) { representPending(); return; }
  // El formulario abierto acepta correcciones libres: decide el comando (y si no, ctx.handOff).
  if (top.options?.corrections) { resolveTop(heard); return; }
  if (parseYesNo(normalized)) { resolveTop(heard); return; }
  // Una opción dicha tal cual es la respuesta aunque parezca un pedido («nuevo paciente»).
  if (top.awaiting === 'choice' && (top.card.choices ?? []).some((c) => normalizeSpeech(c.label) === normalized)) { resolveTop(heard); return; }
  // Un pedido («poneme un recordatorio a las 9…») no se lee como elección aunque nombre una hora.
  if (top.awaiting === 'choice' && !looksLikeCommand(normalized) && parseChoice(normalized, top.card.choices?.length ?? 0, (top.card.choices ?? []).map((c) => c.label)) !== null) {
    resolveTop(heard);
    return;
  }
  // Eligiendo o confirmando, una herramienta («más zoom», «vista día») se hace y se vuelve a preguntar.
  if (top.awaiting !== 'answer' && deps) {
    const tool = matchVoiceCommand(deps.domains, normalized, heard);
    if (tool?.command.aux) { await runAux([tool], heard); return; }
  }
  // Pregunta liviana (el menú de ayuda): si un comando entiende lo dicho, es un pedido nuevo.
  if (top.card.soft && deps) {
    const soft = matchVoiceCommand(deps.domains, normalized, heard);
    if (soft) { await switchTask(heard, () => runFound([soft], heard, opts)); return; }
  }
  const short = wordCount(normalized) <= ANSWER_MAX_WORDS && !looksLikeCommand(normalized);
  if (short) { resolveTop(heard); return; }

  const local = deps && !isCompoundRequest(heard) ? matchVoiceCommand(deps.domains, normalized, heard) : null;
  if (local?.command.aux) { await runAux([local], heard); return; }
  if (local) { await switchTask(heard, () => runFound([local], heard, opts)); return; }

  // Sin intérprete local: la IA decide qué relación tiene con la pregunta.
  const plan = await interpretPlan(heard, opts);
  if (topPending() !== top) return; // Mientras tanto se contestó con un botón.
  if (!plan) { resolveTop(heard); return; }
  switch (plan.relation) {
    case 'answer': resolveTop(plan.answer || heard); return;
    case 'cancel': await cancelTask(); return;
    case 'resume': representPending(); return;
    case 'ignore':
      if (opts.conversational) { store().set({ heard: '', phase: 'waiting' }); return; }
      resolveTop(heard);
      return;
    case 'aux': await runAux(plan.found, heard, 'ai'); return;
    default:
      if (!plan.found.length) { resolveTop(heard); return; }
      if (plan.found.every((f) => f.command.aux)) { await runAux(plan.found, heard, 'ai'); return; }
      await switchTask(heard, () => runFound(plan.found, heard, opts, 'ai'));
  }
}

/** Aprieta un botón o completa un campo de la ventana abierta si lo dicho es eso. true = hecho. */
/**
 * El botón de la ventana o panel de arriba cuyo texto es lo dicho (o empieza con lo dicho y sigue
 * con un número o una etiqueta corta: «Cobro Rápido 1 precargados»). El primero (el más reciente
 * en una bandeja). null si no hay.
 */
function overlayButtonNamed(normalized: string): { label: string; element: HTMLElement } | null {
  const overlay = readTopOverlay();
  if (!overlay || normalized.split(' ').length > 6) return null;
  const said = normalized.replace(/^(?:(?:apreta\w*|toca\w*|dale(?: a)?|press|tap|click(?: on)?)\s+)?(?:(?:el|la|the)\s+)?(?:(?:boton|button)\s+(?:de\s+)?)?/, '');
  if (said.length < 3) return null;
  for (const b of overlay.buttons) {
    const label = normalizeSpeech(b.label).replace(/(\D)(\d)/g, '$1 $2');
    if (label === said) return { label: b.label, element: b.element };
    if (label.startsWith(`${said} `)) {
      const rest = label.slice(said.length + 1).split(' ');
      if (/^\d/.test(rest[0]) && rest.length <= 3) return { label: b.label.replace(/\d.*$/, '').trim(), element: b.element };
    }
  }
  return null;
}

function pressOrFillOverlay(heard: string, normalized: string): boolean {
  if (!deps) return false;
  const overlay = readTopOverlay();
  if (!overlay) return false;
  let button = pickOverlayButton(normalized, overlay);
  // «cancelar», «cerrar», «salir», «volver»: el botón de la ventana que hace eso (Cancelar / Cerrar).
  if (!button && /^(?:cancela\w*|cerra\w*|cierra\w*|sali\w*|volve\w*|cancel|close|exit|go back)(?:\s+(?:la ventana|esto|eso|it|this))?$/.test(normalized)) {
    button = overlay.buttons.find((b) => /^(?:cancelar|cerrar|close|cancel|volver|salir)$/i.test(normalizeSpeech(b.label))) ?? null;
  }
  if (button) {
    button.element.click();
    void quickFinish(deps.t('VoiceCommands.dialogPressed', { label: button.label }));
    return true;
  }
  const fill = pickOverlayField(heard, normalized, overlay);
  if (fill) {
    // Como lo espera el campo: hora («las 9 y media» → 09:30), fecha, número, color.
    const value = valueForField(fill.field.element, fill.value);
    setFieldValue(fill.field, value);
    void quickFinish(deps.t('VoiceCommands.fieldFilled', { field: fill.field.label, value }));
    return true;
  }
  return false;
}

/** Nombre corto de lo que hace un comando («cambiar el zoom»), para preguntar si se entendió bien. */
function commandLabel(found: Found): string {
  if (!deps) return '';
  const id = found.command.id.replace(/\./g, '_');
  const key = `VoiceCommands.commandLabels.${id}`;
  const label = deps.t(key);
  return !label || label === key || label.endsWith(id) ? deps.t('VoiceCommands.commandLabels.other') : label;
}

/** La IA no está segura: «No estoy seguro: ¿querés cambiar el zoom?». true = hacerlo. */
async function confirmUnsure(plan: Plan): Promise<boolean> {
  if (!deps) return false;
  const what = plan.found.map(commandLabel).filter((v, i, all) => all.indexOf(v) === i).join(deps.t('VoiceCommands.and'));
  const question = deps.t('VoiceCommands.aiUnsureQuestion', { action: what });
  const yes = await askOnTop({ title: deps.t('VoiceCommands.label'), message: question, tone: 'confirm' }, question);
  if (!yes) await quickFinish(deps.t('VoiceCommands.nothingChanged'));
  return yes;
}

/** «¿Dejo X para hacer lo nuevo?»: sí → se cancela y se hace lo nuevo; no → se repite la pregunta. */
async function switchTask(heard: string, start: () => Promise<void>): Promise<boolean> {
  if (!deps) return false;
  const top = topPending();
  const current = store().task;
  // Una pregunta liviana (el menú de ayuda) o una sin tarea con nombre se deja sin preguntar:
  // lo nuevo es lo que se quiere (y no hay nada que nombrar en «Estábamos con…»).
  const yes = top?.card.soft || !current?.trim() ? true : await askOnTop(
    {
      title: deps.t('VoiceCommands.switchTitle'),
      message: deps.t('VoiceCommands.switchQuestion', { current: current!, next: heard }),
      tone: 'confirm',
    },
    deps.t('VoiceCommands.switchSpeech', { current: current! }),
  );
  if (!yes) {
    if (top) representPending();
    return false;
  }
  controller?.abort();
  controller = null;
  pendingStack.length = 0;
  void start();
  return true;
}

/** Pregunta sí/no por encima de todo (para cambiar de tarea), sin pertenecer a ninguna. */
function askOnTop(card: VoiceCard, speech: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const own = new AbortController();
    let unclear = 0;
    const entry: PendingAsk = {
      owner: own.signal,
      card,
      speech,
      awaiting: 'confirm',
      resolve: (text) => {
        const yesNo = parseYesNo(normalizeSpeech(text));
        if (yesNo || ++unclear > MAX_UNCLEAR) { resolve(yesNo === 'yes'); return; }
        pendingStack.push(entry);
        store().set({ card: { ...card, message: deps?.t('VoiceCommands.sayYesOrNo') }, awaiting: 'confirm', phase: 'waiting' });
      },
    };
    pendingStack.push(entry);
    clearTimeout(hideTimer);
    store().set({ card, awaiting: 'confirm' });
    void speak(deps?.locale ?? 'es', speech).then(() => {
      store().set({ phase: 'waiting' });
      void autoListen(ANSWER_WINDOW_MS);
    });
  });
}

async function cancelTask() {
  if (!deps) return;
  const message = deps.t('VoiceCommands.taskCancelled');
  cancelVoice();
  await quickFinish(message);
}

/** Un aviso corto que se dice y se va (sin tarea). */
async function quickFinish(message: string) {
  if (!deps) return;
  const card: VoiceCard = { title: deps.t('VoiceCommands.label'), message, tone: 'info' };
  store().set({ card, awaiting: null });
  await speak(deps.locale, message);
  if (store().card === card) {
    store().set({ phase: 'idle' });
    clearTimeout(hideTimer);
    if (!card.sticky) hideTimer = setTimeout(() => { if (store().card === card && !pendingStack.length) store().reset(); }, visibleMs(card));
  }
}

// ── Interpretar ───────────────────────────────────────────────────────────────

type Found = { command: VoiceCommand<any>; parsed: unknown };

interface Plan {
  relation: VoiceRelation;
  answer: string | null;
  found: Found[];
  confidence: number;
}

/**
 * Le pregunta a la IA de cada módulo activo (en orden) qué se pidió. Devuelve la relación con lo
 * que se venía haciendo y los pasos ya convertidos en comandos, o null si nadie lo entendió.
 */
async function interpretPlan(text: string, opts: HandleOptions, signal?: AbortSignal): Promise<Plan | null> {
  if (!deps) return null;
  const own = new AbortController();
  const onAbort = () => own.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  const ctx = createContext(deps, own.signal, { midPlan: false });
  const top = topPending();
  const conversation = {
    task: store().task,
    pending: top ? { question: top.card.message ?? top.speech, awaiting: top.awaiting, choices: (top.card.choices ?? []).map((c) => c.label).slice(0, 8) } : null,
    conversational: opts.conversational,
  };
  inflight++;
  try {
    store().set({ phase: 'thinking' });
    const normalized = normalizeSpeech(text);
    for (const domain of listVoiceAiDomains(deps.domains)) {
      if (domain.ai?.accepts && !domain.ai.accepts(normalized)) continue;
      const answer = await interpretWithAi<VoiceAiPlan & Record<string, unknown>>(domain.id, text, ctx, { conversation }).catch((error) => {
        if (own.signal.aborted) throw error;
        console.warn('[voice] AI interpretation failed', domain.id, error);
        return null;
      });
      if (!answer || answer.confidence < MIN_AI_CONFIDENCE) continue;
      const result = answer.result;
      const relation: VoiceRelation = result.relation ?? 'new';
      const steps = Array.isArray(result.steps) && result.steps.length ? result.steps.slice(0, MAX_PLAN_STEPS) : [result];
      const found = steps.map((step) => matchVoiceAiResult(domain.id, step, text)).filter((f): f is Found => !!f);
      if (found.length || relation === 'answer' || relation === 'ignore' || relation === 'cancel' || relation === 'resume') {
        return { relation, answer: typeof result.answer === 'string' ? result.answer : null, found, confidence: answer.confidence };
      }
    }
    return null;
  } catch (error) {
    if (isAbortError(error)) return null;
    throw error;
  } finally {
    inflight--;
    signal?.removeEventListener('abort', onAbort);
  }
}

/** Un pedido sin pregunta abierta: local primero, si no la IA; uno o varios pasos. */
async function runRequest(heard: string, normalized: string, opts: HandleOptions) {
  if (!deps) return;
  // Recién abierta la página (o recargando): lo pedido se entiende con lo que va a estar en pantalla.
  if (isScreenLoading()) {
    store().set({ phase: 'thinking' });
    await waitScreenReady();
    if (!deps) return;
  }
  const local = matchVoiceCommand(deps.domains, normalized, heard);
  // Varios pedidos en una frase: primero la IA arma el plan completo; si no, lo local. La
  // navegación se encarga sola («andá a pacientes y buscá a Juan»: va y deja el resto para allá).
  if (isCompoundRequest(heard) && !local?.command.handlesCompound) {
    const plan = await interpretPlan(heard, opts);
    if (plan?.found.length && plan.relation !== 'ignore') {
      if (plan.found.every((f) => f.command.aux) && controller) { await runAux(plan.found, heard, 'ai'); return; }
      await runFound(plan.found, heard, opts, 'ai');
      return;
    }
  }
  // Con una ventana abierta, lo que se dice es primero para ella: sus botones y sus campos (salvo
  // que el comando sea el de esa ventana, como el formulario de la cita).
  // Un botón de lo de arriba que se llama así («Cobro rápido» en la bandeja abierta) gana siempre:
  // lo abierto es el contexto, aunque otro comando conozca la frase (el cobro rápido del riel).
  // (Salvo un comando que maneja él mismo la ventana abierta: el dictado del periodontograma.)
  if (local?.command.id !== 'calendar.form' && !local?.command.keepsOverlay) {
    const named = overlayButtonNamed(normalized);
    if (named) {
      named.element.click();
      void quickFinish(deps.t('VoiceCommands.dialogPressed', { label: named.label }));
      return;
    }
  }
  if (local?.command.id !== 'calendar.form' && !local?.command.keepsOverlay && pressOrFillOverlay(heard, normalized)) return;
  if (local) {
    if (local.command.aux && controller) { await runAux([local], heard, 'local'); return; }
    await runFound([local], heard, opts, 'local');
    return;
  }
  const plan = await interpretPlan(heard, opts);
  if (plan?.relation === 'ignore' && opts.conversational) { store().set({ phase: 'idle', heard: '' }); return; }
  if (plan?.found.length && plan.confidence < SURE_AI_CONFIDENCE && !(await confirmUnsure(plan))) return;
  if (plan?.relation === 'cancel') { await cancelTask(); return; }
  if (!plan?.found.length) {
    // Lo más parecido a lo que se puede hacer: «¿Te referís a…?».
    if (await offerSuggestions(heard, normalized, opts)) return;
    // Con el micrófono prendido se oye todo: lo que no se entiende se muestra sin decirlo en voz
    // alta (puede ser una charla de la sala, no un pedido).
    if (opts.conversational) {
      const key = deps.domains.map((id) => getVoiceDomain(id)?.notUnderstoodKey).find(Boolean) ?? 'VoiceCommands.notUnderstood';
      const card: VoiceCard = { title: deps.t('VoiceCommands.notUnderstoodTitle'), message: deps.t(key), tone: 'info' };
      store().set({ card, awaiting: null, phase: 'idle' });
      clearTimeout(hideTimer);
      if (!card.sticky) hideTimer = setTimeout(() => { if (store().card === card && !pendingStack.length) store().reset(); }, visibleMs(card));
      return;
    }
    const key = deps.domains.map((id) => getVoiceDomain(id)?.notUnderstoodKey).find(Boolean) ?? 'VoiceCommands.notUnderstood';
    await quickFinishError(deps.t('VoiceCommands.notUnderstoodTitle'), deps.t(key));
    return;
  }
  await runFound(plan.found, heard, opts, 'ai');
}

/**
 * No se entendió, pero se parece a algo que se puede hacer (un botón, una pestaña, un destino del
 * menú): se proponen hasta tres y lo elegido se hace como si se hubiera dicho. «No» / «ninguna»
 * deja todo como estaba; otro pedido sigue sin preguntar (la tarjeta es liviana).
 */
async function offerSuggestions(heard: string, normalized: string, opts: HandleOptions): Promise<boolean> {
  if (!deps) return false;
  const d = deps;
  const list = suggestActions(normalized, { locale: d.locale, t: d.t, hasPermission: d.hasPermission });
  // Con el micrófono siempre prendido se oye la charla de la sala: solo lo que se parece mucho.
  if (!list.length || (opts.conversational && list[0].score < 0.75)) return false;
  const command: VoiceCommand<null> = {
    id: 'core.suggest',
    domain: 'core',
    keepsOverlay: true,
    match: () => null,
    run: async (_parsed, ctx) => {
      const options = list.map((s) => s.label).join(d.t('VoiceCommands.or'));
      const message = d.t('VoiceCommands.suggest.ask', { heard: heard.trim().slice(0, 80), options });
      const card: VoiceCard = { title: d.t('VoiceCommands.suggest.title'), message, choices: list.map((s) => ({ label: s.label })), tone: 'info', soft: true };
      const index = await ctx.choose(card, message);
      ctx.followUp(list[index].phrase);
    },
  };
  await runFound([{ command, parsed: null }], heard, opts, 'local');
  return true;
}

async function quickFinishError(title: string, message: string) {
  if (!deps) return;
  const card: VoiceCard = { title, message, tone: 'error' };
  store().set({ card, awaiting: null });
  await speak(deps.locale, message);
  store().set({ phase: 'idle' });
  clearTimeout(hideTimer);
  if (!card.sticky) hideTimer = setTimeout(() => { if (store().card === card && !pendingStack.length) store().reset(); }, visibleMs(card));
}

// ── Ejecutar ──────────────────────────────────────────────────────────────────

/** Una tarea: los pasos en orden, con la misma señal (cancelar corta todos). */
async function runFound(found: Found[], heard: string, _opts: HandleOptions, source: 'local' | 'ai' = 'local') {
  if (!deps) return;
  controller?.abort();
  pendingStack.length = 0;
  const own = new AbortController();
  controller = own;
  followUpText = null;
  let next: string | null = null;
  clearTimeout(hideTimer);
  store().set({ task: heard, step: found.length > 1 ? { index: 1, total: found.length } : null, suspended: false });
  // Cambio de contexto: un pedido que no tiene nada que ver con la cita en foco la suelta, y lo que
  // estaba abierto (una ventana, un panel lateral) se cierra antes para que se vea lo nuevo.
  if (!found.some((f) => f.command.usesFocus)) {
    setAppointmentFocus(null);
    const keepsScreen = found.every((f) => f.command.keepsOverlay || ['calendar.close', 'calendar.dialog', 'core.scroll', 'core.screen', 'calendar.form'].includes(f.command.id));
    for (let guard = 0; !keepsScreen && guard < 4 && hasOpenOverlay(); guard++) closeTopOverlay();
  }
  try {
    for (let i = 0; i < found.length; i++) {
      if (own.signal.aborted) return;
      if (found.length > 1) store().set({ step: { index: i + 1, total: found.length } });
      const run = createContext(deps, own.signal, { midPlan: i < found.length - 1, source, heard });
      store().set({ phase: 'running' });
      await found[i].command.run(found[i].parsed, run);
      // Si un paso no se pudo hacer, los que dependen de él no siguen (y se dice dónde se frenó).
      if (run.failed()) {
        followUpText = null;
        if (i < found.length - 1) {
          const message = deps.t('VoiceCommands.planStopped', { step: `${i + 1}/${found.length}` });
          const last = createContext(deps, own.signal, { midPlan: false });
          await last.finish({ title: deps.t('VoiceCommands.label'), message, tone: 'info' }, message).catch(() => {});
        }
        break;
      }
    }
  } catch (error) {
    if (isAbortError(error) || own.signal.aborted) return;
    console.error('[voice] command failed', error);
    const ctx = createContext(deps, own.signal, { midPlan: false });
    await ctx.finish({ title: deps.t('VoiceCommands.errorTitle'), message: deps.t('VoiceCommands.genericError'), tone: 'error' }, deps.t('VoiceCommands.genericError')).catch(() => {});
  } finally {
    if (controller === own) {
      controller = null;
      store().set({ task: null, step: null });
      if (!own.signal.aborted) next = followUpText;
      followUpText = null;
    }
  }
  // Lo que queda del pedido, ya en la pantalla nueva y con sus módulos de voz.
  if (next && deps) { overlayDuringTask = null; handleText(next, { conversational: false }); return; }
  if (!own.signal.aborted && controller === null) setTimeout(offerOverlayAfterTask, 60);
}

let auxController: AbortController | null = null;

/** Herramientas en el medio de una tarea: se hacen y se vuelve a la pregunta abierta. */
async function runAux(found: Found[], heard: string, source: 'local' | 'ai' = 'local') {
  if (!deps) return;
  auxController?.abort();
  const own = new AbortController();
  auxController = own;
  // Si se cancela la tarea, también la herramienta.
  const parent = controller?.signal;
  const onParentAbort = () => own.abort();
  parent?.addEventListener('abort', onParentAbort, { once: true });
  const waitingFor = topPending();
  try {
    for (let i = 0; i < found.length; i++) {
      if (own.signal.aborted) return;
      const run = createContext(deps, own.signal, { midPlan: i < found.length - 1 || !!waitingFor, aux: true, source, heard });
      await found[i].command.run(found[i].parsed, run);
      if (run.failed()) break;
    }
  } catch (error) {
    if (!isAbortError(error)) console.error('[voice] aux command failed', error);
  } finally {
    parent?.removeEventListener('abort', onParentAbort);
    if (auxController === own) auxController = null;
    if (!own.signal.aborted && waitingFor && topPending() === waitingFor) {
      // Que se vea lo que hizo la herramienta un momento y se vuelve a la pregunta.
      returnTimer = setTimeout(() => {
        returnTimer = undefined;
        if (topPending() === waitingFor) representPending();
      }, timing.auxReturnMs);
    }
  }
}

async function speak(locale: string, speech: string) {
  if (!speech) return;
  // Con la voz del asistente silenciada no suena nada: no hay eco que descartar y el micrófono
  // sigue oyendo (si no, lo que se dice justo después de un resultado se perdía).
  if (useAssistantVoice.getState().muted) return;
  speaking = true;
  continuous?.pause();
  store().set({ phase: 'speaking' });
  try {
    await speakAssistant('voice-command', speech, locale, { evenIfHidden: true });
  } finally {
    speaking = false;
    if (!useAssistantVoice.getState().speakingId) continuous?.resume();
    if (continuous) keepAwake();
  }
}

interface RunContext extends VoiceCommandContext {
  failed: () => boolean;
}

function createContext(
  d: VoiceSessionDeps,
  signal: AbortSignal,
  { midPlan, aux = false, source = 'ai', heard = '' }: { midPlan: boolean; aux?: boolean; source?: 'local' | 'ai'; heard?: string },
): RunContext {
  const check = () => { if (signal.aborted) throw abortError(); };
  let failed = false;

  const say = async (speech: string) => {
    check();
    await speak(d.locale, speech);
    check();
  };

  /** Muestra la pregunta, la dice y espera la respuesta (voz o botón). */
  const ask = async (card: VoiceCard, speech: string, awaiting: 'answer' | 'confirm' | 'choice' = 'answer', options?: VoiceAskOptions): Promise<string> => {
    check();
    clearTimeout(hideTimer);
    store().set({ card, awaiting });
    await say(speech);
    return new Promise<string>((resolve, reject) => {
      const entry: PendingAsk = {
        owner: signal,
        card,
        speech,
        awaiting,
        options,
        resolve: (text) => {
          signal.removeEventListener('abort', onAbort);
          resolve(text);
        },
      };
      const onAbort = () => {
        const index = pendingStack.indexOf(entry);
        if (index >= 0) pendingStack.splice(index, 1);
        reject(abortError());
      };
      signal.addEventListener('abort', onAbort, { once: true });
      pendingStack.push(entry);
      store().set({ phase: 'waiting' });
      if (continuous) keepAwake();
      void autoListen(ANSWER_WINDOW_MS);
    });
  };

  const ctx: RunContext = {
    locale: d.locale,
    signal,
    t: d.t,
    hasPermission: d.hasPermission,
    navigate: d.navigate,
    midPlan,
    source,
    failed: () => failed,
    followUp: (text) => { if (!aux && !signal.aborted) followUpText = text.trim() || null; },
    activeDomains: () => deps?.domains ?? d.domains,
    tryAi: async () => {
      if (source !== 'local' || !heard) return false;
      const plan = await interpretPlan(heard, { conversational: false }, signal);
      if (signal.aborted || !plan?.found.length) return false;
      if (plan.confidence < SURE_AI_CONFIDENCE && !(await confirmUnsure(plan))) return true;
      if (aux) void runAux(plan.found, heard, 'ai');
      else void runFound(plan.found, heard, { conversational: false }, 'ai');
      return true;
    },
    show: (card) => {
      check();
      store().set({ card, awaiting: null });
    },
    update: (card) => {
      if (!signal.aborted) store().set({ card });
    },
    ask: (card, speech, awaiting = 'answer', options) => ask(card, speech, awaiting, options),
    choose: async (card, speech) => {
      // Lo dicho se compara también con el detalle (doctor, sede) de cada opción.
      const all = (card.choices ?? []).map((c, i) => ({ i, label: c.detail ? `${c.label} ${c.detail}` : c.label }));
      let pool = all;
      let shown = card;
      let prompt = speech;
      for (let attempt = 0; ; attempt++) {
        const answer = await ask(shown, prompt, 'choice');
        const found = parseChoiceDetailed(normalizeSpeech(answer), pool.length, pool.map((p) => p.label));
        if (found && 'index' in found) return pool[found.index].i;
        if (found && 'ambiguous' in found && found.ambiguous.length < pool.length) {
          // Dos (o más) igual de probables: se pregunta solo entre esas.
          pool = found.ambiguous.map((k) => pool[k]);
          shown = { ...card, choices: pool.map((p) => card.choices![p.i]) };
          prompt = d.t('VoiceCommands.chooseBetween', { options: pool.map((p) => card.choices![p.i].label).join(d.t('VoiceCommands.or')) });
          continue;
        }
        if (parseYesNo(normalizeSpeech(answer)) === 'no' || attempt >= MAX_UNCLEAR) {
          await ctx.finish({ title: card.title, message: d.t('VoiceCommands.nothingChanged'), tone: 'info' }, d.t('VoiceCommands.nothingChanged'));
          throw abortError();
        }
        prompt = d.t('VoiceCommands.chooseAgain');
      }
    },
    confirm: async (card, speech) => {
      let prompt = speech;
      for (let attempt = 0; ; attempt++) {
        const answer = await ask(card, prompt, 'confirm');
        const yesNo = parseYesNo(normalizeSpeech(answer));
        if (yesNo) return yesNo === 'yes';
        if (attempt >= MAX_UNCLEAR) return false;
        prompt = d.t('VoiceCommands.sayYesOrNo');
      }
    },
    finish: async (card, speech) => {
      check();
      if (card.tone === 'error') failed = true;
      store().set({ card, awaiting: null });
      // En medio de un plan (o de una herramienta con una pregunta esperando) solo se muestra.
      if (!(midPlan && card.tone !== 'error')) await say(speech);
      if (aux || midPlan) return;
      store().set({ phase: 'idle' });
      clearTimeout(hideTimer);
      if (card.sticky) return;
      hideTimer = setTimeout(() => {
        // Solo si nadie empezó otro pedido mientras tanto.
        if (store().card === card && store().phase === 'idle' && !pendingStack.length) store().reset();
      }, visibleMs(card));
    },
    handOff: async (text) => {
      const normalized = normalizeSpeech(text);
      // El formulario abierto se queda con todo lo suyo: acá solo cuentan los otros comandos.
      const foreign = matchVoiceCommand(d.domains, normalized, text, (c) => c.id === 'calendar.form');
      if (foreign?.command.aux) {
        await runAux([foreign], text);
        return 'handled';
      }
      const plan = foreign ? { relation: 'new' as VoiceRelation, answer: null, found: [foreign], confidence: 1 } : await interpretPlan(text, { conversational: false }, signal);
      const found = (plan?.found ?? []).filter((f) => f.command.id !== 'calendar.form');
      if (!found.length) return 'none';
      if (found.every((f) => f.command.aux)) {
        await runAux(found, text, foreign ? 'local' : 'ai');
        return 'handled';
      }
      return (await switchTask(text, () => runFound(found, text, { conversational: false }, foreign ? 'local' : 'ai'))) ? 'switched' : 'handled';
    },
  };
  return ctx;
}
