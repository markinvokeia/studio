/**
 * Reconocimiento de voz del navegador (Web Speech API: Chrome y Edge). No está en lib.dom de
 * TypeScript, así que los tipos van acá. Lo usan el dictado del chat del asistente y los
 * comandos de voz.
 */

interface ISpeechRecognitionAlternative { readonly transcript: string }
interface ISpeechRecognitionResult { readonly isFinal: boolean; readonly 0: ISpeechRecognitionAlternative }
export interface ISpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: { readonly length: number; readonly [index: number]: ISpeechRecognitionResult };
}
export interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((ev: ISpeechRecognitionEvent) => void) | null;
  onerror: ((ev: Event) => void) | null;
  onend: ((ev: Event) => void) | null;
  onspeechstart?: ((ev: Event) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SpeechRecognitionCtor = new () => ISpeechRecognition;

const SPEECH_LANG: Record<string, string> = { es: 'es-UY', 'es-ES': 'es-ES', en: 'en-US' };

export function speechLang(locale: string): string {
  return SPEECH_LANG[locale] ?? locale;
}

export function getSpeechRecognitionCtor(): SpeechRecognitionCtor | undefined {
  if (typeof window === 'undefined') return undefined;
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export function isSpeechRecognitionSupported(): boolean {
  return Boolean(getSpeechRecognitionCtor());
}

/** Junta lo reconocido: lo final acumulado + lo que se está diciendo. */
function collect(event: ISpeechRecognitionEvent, finalRef: { text: string }): string {
  let live = '';
  for (let i = event.resultIndex; i < event.results.length; i++) {
    const result = event.results[i];
    if (result.isFinal) finalRef.text += `${result[0].transcript} `;
    else live += result[0].transcript;
  }
  return `${finalRef.text}${live}`.trim();
}

export interface HoldListening {
  /** Deja de escuchar y resuelve con todo lo dicho ('' si nada). */
  stop: () => Promise<string>;
  /** Corta sin entregar nada. */
  abort: () => void;
}

/**
 * Escucha mientras se mantiene apretado (push-to-talk): sigue aunque haya pausas, hasta `stop`.
 * Devuelve null si el navegador no tiene reconocimiento de voz.
 */
export function startHoldListening(locale: string, onInterim: (text: string) => void): HoldListening | null {
  const Ctor = getSpeechRecognitionCtor();
  if (!Ctor) return null;
  const recognition = new Ctor();
  recognition.lang = speechLang(locale);
  recognition.continuous = true;
  recognition.interimResults = true;
  const finalRef = { text: '' };
  let latest = '';
  let ended = false;
  let resolveEnd: ((text: string) => void) | null = null;
  const ends = new Promise<string>((resolve) => { resolveEnd = resolve; });

  recognition.onresult = (event) => {
    latest = collect(event, finalRef);
    onInterim(latest);
  };
  recognition.onerror = () => { try { recognition.stop(); } catch { /* ya terminó */ } };
  recognition.onend = () => {
    ended = true;
    // Lo último que se estaba diciendo cuenta aunque el navegador no lo haya cerrado como final.
    resolveEnd?.((finalRef.text.trim() || latest).trim());
  };
  try {
    recognition.start();
  } catch {
    return null;
  }

  return {
    stop: () => {
      if (!ended) { try { recognition.stop(); } catch { /* ya terminó */ } }
      return ends;
    },
    abort: () => {
      resolveEnd = null;
      try { recognition.abort(); } catch { /* ya terminó */ }
    },
  };
}

export interface ListenOnceOptions {
  onInterim?: (text: string) => void;
  /** Si en este tiempo no empieza a hablar, se deja de escuchar y resuelve ''. */
  timeoutMs: number;
  signal?: AbortSignal;
}

/**
 * Escucha una frase (para responder una pregunta: "sí", "el dos", "Dental Sur"). Termina sola
 * cuando la persona hace una pausa. Resuelve '' si no dijo nada a tiempo o se canceló.
 */
export function listenOnce(locale: string, { onInterim, timeoutMs, signal }: ListenOnceOptions): Promise<string> {
  const Ctor = getSpeechRecognitionCtor();
  if (!Ctor || signal?.aborted) return Promise.resolve('');
  return new Promise<string>((resolve) => {
    const recognition = new Ctor();
    recognition.lang = speechLang(locale);
    recognition.continuous = false;
    recognition.interimResults = true;
    const finalRef = { text: '' };
    let latest = '';
    let heard = false;
    let done = false;

    const finish = (text: string) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      resolve(text.trim());
    };
    const onAbort = () => {
      try { recognition.abort(); } catch { /* ya terminó */ }
      finish('');
    };
    const timer = setTimeout(() => {
      if (heard) return;
      try { recognition.abort(); } catch { /* ya terminó */ }
      finish('');
    }, timeoutMs);

    recognition.onresult = (event) => {
      heard = true;
      latest = collect(event, finalRef);
      onInterim?.(latest);
    };
    recognition.onspeechstart = () => { heard = true; };
    recognition.onerror = () => { try { recognition.stop(); } catch { /* ya terminó */ } };
    recognition.onend = () => finish(finalRef.text.trim() || latest);
    signal?.addEventListener('abort', onAbort);
    try {
      recognition.start();
    } catch {
      finish('');
    }
  });
}
