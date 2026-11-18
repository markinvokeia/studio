import { speakAssistant, stopAssistantSpeech } from '@/hooks/use-assistant-voice';
import { useVoiceCommand } from '@/stores/voice-command-store';
import { parseChoice, parseYesNo, normalizeSpeech } from '@/lib/voice/parse';
import { interpretWithAi } from '@/lib/voice/ai';
import { matchVoiceAiResult, matchVoiceCommand } from '@/lib/voice/registry';
import { listenOnce, startHoldListening, type HoldListening } from '@/lib/voice/speech-recognition';

import type { VoiceCard, VoiceCommandContext } from '@/lib/types';

/**
 * Sesión de voz: push-to-talk (Ctrl+Espacio mantenido o el micrófono de la mascota) → se
 * interpreta lo dicho → el comando conversa (pregunta, confirma) → ejecuta. Después de cada
 * pregunta el micrófono se abre solo unos segundos, así se responde sin tocar nada.
 *
 * Es un módulo (como el runner de guías), no un componente: el host (VoiceCommandHost) le pasa
 * el locale, el traductor, los permisos y la navegación con configureVoiceSession.
 */

export interface VoiceSessionDeps {
  locale: string;
  t: VoiceCommandContext['t'];
  hasPermission: (code: string) => boolean;
  navigate: (route: string) => void;
}

/** Tiempo para empezar a responder después de una pregunta. */
const ANSWER_WINDOW_MS = 6000;
/** Micrófono por clic: tiempo para empezar a hablar. */
const CLICK_WINDOW_MS = 8000;
/** La tarjeta del resultado se va sola. */
const RESULT_VISIBLE_MS = 7000;
/** Respuestas que no se entienden antes de dejarlo sin hacer. */
const MAX_UNCLEAR = 2;
/** Por debajo de esto la IA "adivinó": se dice que no se entendió (igual siempre se confirma). */
const MIN_AI_CONFIDENCE = 0.5;

let deps: VoiceSessionDeps | null = null;
/** El comando en curso: se corta con Escape, "cancelar" u otro comando. */
let controller: AbortController | null = null;
/** Escucha automática después de una pregunta (o por clic). */
let listenController: AbortController | null = null;
let hold: HoldListening | null = null;
let pending: ((text: string) => void) | null = null;
let hideTimer: ReturnType<typeof setTimeout> | undefined;

const store = () => useVoiceCommand.getState();

export function configureVoiceSession(next: VoiceSessionDeps | null) {
  deps = next;
  if (!next) cancelVoice();
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

/** Ctrl+Espacio apretado: corta lo que se esté diciendo o escuchando y empieza a escuchar. */
export function startPushToTalk() {
  if (!deps || hold) return;
  clearTimeout(hideTimer);
  stopAutoListen();
  stopAssistantSpeech();
  const next = startHoldListening(deps.locale, (interim) => store().set({ interim }));
  if (!next) return;
  hold = next;
  store().set({ phase: 'listening', interim: '' });
}

/** Ctrl+Espacio suelto: lo dicho va a la pregunta pendiente o es un comando nuevo. */
export async function endPushToTalk() {
  const current = hold;
  if (!current) return;
  hold = null;
  const text = await current.stop();
  handleText(text);
}

/** Micrófono de la mascota: escucha una frase (termina sola en la pausa). */
export async function listenByClick() {
  if (!deps || hold) return;
  clearTimeout(hideTimer);
  stopAssistantSpeech();
  await autoListen(CLICK_WINDOW_MS);
}

/** Escape o "Cancelar": corta todo y cierra la tarjeta. */
export function cancelVoice() {
  controller?.abort();
  controller = null;
  stopAutoListen();
  hold?.abort();
  hold = null;
  pending = null;
  clearTimeout(hideTimer);
  stopAssistantSpeech();
  store().reset();
}

/** Respuesta desde un botón de la tarjeta (Confirmar, una opción). */
export function answerFromCard(text: string) {
  if (!pending) return;
  stopAutoListen();
  stopAssistantSpeech();
  handleText(text);
}

async function autoListen(windowMs: number) {
  if (!deps) return;
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
  handleText(text);
}

function handleText(text: string) {
  const heard = text.trim();
  if (!heard) {
    // Nada a tiempo: la pregunta queda en la tarjeta (se responde con Ctrl+Espacio o los botones).
    store().set({ phase: pending ? 'waiting' : 'idle', interim: '' });
    if (!pending && store().card === null) store().reset();
    return;
  }
  store().set({ heard, interim: '' });
  if (pending) {
    const resolve = pending;
    pending = null;
    resolve(heard);
    return;
  }
  void runCommand(heard);
}

async function runCommand(text: string) {
  if (!deps) return;
  controller?.abort();
  const own = new AbortController();
  controller = own;
  clearTimeout(hideTimer);
  const ctx = createContext(deps, own.signal);
  let found = matchVoiceCommand(normalizeSpeech(text), text);
  try {
    store().set({ phase: 'thinking' });
    if (!found) {
      // El intérprete local no lo entendió: se le pregunta a la IA (solo interpreta, no escribe).
      ctx.show({ title: deps.t('VoiceCommands.label'), message: deps.t('VoiceCommands.interpreting'), tone: 'info' });
      const result = await interpretWithAi(text, ctx).catch((error) => {
        if (own.signal.aborted) throw error;
        console.warn('[voice] AI interpretation failed', error);
        return null;
      });
      found = result && result.intent !== 'unknown' && result.confidence >= MIN_AI_CONFIDENCE ? matchVoiceAiResult(result, text) : null;
    }
    if (!found) {
      await ctx.finish({ title: deps.t('VoiceCommands.notUnderstoodTitle'), message: deps.t('VoiceCommands.notUnderstood'), tone: 'error' }, deps.t('VoiceCommands.notUnderstood'));
      return;
    }
    await found.command.run(found.parsed, ctx);
  } catch (error) {
    if (isAbortError(error) || own.signal.aborted) return;
    console.error('[voice] command failed', error);
    await ctx.finish({ title: deps.t('VoiceCommands.errorTitle'), message: deps.t('VoiceCommands.genericError'), tone: 'error' }, deps.t('VoiceCommands.genericError')).catch(() => {});
  } finally {
    if (controller === own) controller = null;
  }
}

function createContext(d: VoiceSessionDeps, signal: AbortSignal): VoiceCommandContext {
  const check = () => { if (signal.aborted) throw abortError(); };

  const say = async (speech: string) => {
    check();
    store().set({ phase: 'speaking' });
    await speakAssistant('voice-command', speech, d.locale, { evenIfHidden: true });
    check();
  };

  /** Muestra la pregunta, la dice y espera la respuesta (voz o botón). */
  const ask = async (card: VoiceCard, speech: string, awaiting: 'answer' | 'confirm' | 'choice' = 'answer'): Promise<string> => {
    check();
    clearTimeout(hideTimer);
    store().set({ card, awaiting });
    await say(speech);
    return new Promise<string>((resolve, reject) => {
      const onAbort = () => { pending = null; reject(abortError()); };
      signal.addEventListener('abort', onAbort, { once: true });
      pending = (text) => {
        signal.removeEventListener('abort', onAbort);
        store().set({ awaiting: null, phase: 'thinking' });
        resolve(text);
      };
      store().set({ phase: 'waiting' });
      void autoListen(ANSWER_WINDOW_MS);
    });
  };

  const ctx: VoiceCommandContext = {
    locale: d.locale,
    signal,
    t: d.t,
    hasPermission: d.hasPermission,
    navigate: d.navigate,
    show: (card) => {
      check();
      store().set({ card, awaiting: null });
    },
    update: (card) => {
      if (!signal.aborted) store().set({ card });
    },
    ask: (card, speech, awaiting = 'answer') => ask(card, speech, awaiting),
    choose: async (card, speech) => {
      const labels = (card.choices ?? []).map((c) => c.label);
      let prompt = speech;
      for (let attempt = 0; ; attempt++) {
        const answer = await ask(card, prompt, 'choice');
        const index = parseChoice(normalizeSpeech(answer), labels.length, labels);
        if (index !== null) return index;
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
      store().set({ card, awaiting: null });
      await say(speech);
      store().set({ phase: 'idle' });
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        // Solo si nadie empezó otro comando mientras tanto.
        if (store().card === card && store().phase === 'idle') store().reset();
      }, RESULT_VISIBLE_MS);
    },
  };
  return ctx;
}
