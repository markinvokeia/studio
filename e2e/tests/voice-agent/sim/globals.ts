/**
 * Lo mínimo de un navegador para correr la voz en Node: window, localStorage, un reconocimiento
 * de voz falso (lo que "se dice" lo entrega el simulador) y fetch interceptado (la IA de n8n y el
 * buscador de pacientes). Se importa ANTES que cualquier módulo de la app.
 */

type Listener = ((e: unknown) => void) | null;

export class FakeRecognition {
  static instances: FakeRecognition[] = [];
  continuous = false;
  interimResults = false;
  lang = '';
  onresult: Listener = null;
  onerror: Listener = null;
  onend: Listener = null;
  onspeechstart: Listener = null;
  started = false;
  ended = false;
  start() {
    this.started = true;
    FakeRecognition.instances.push(this);
  }
  stop() { this.end(); }
  abort() { this.end(); }
  /** El reconocedor da por terminada una frase. */
  deliver(text: string) {
    this.onspeechstart?.({});
    this.onresult?.({ resultIndex: 0, results: { length: 1, 0: { isFinal: true, 0: { transcript: text } } } });
  }
  private end() {
    if (this.ended) return;
    this.ended = true;
    this.onend?.({});
  }
  /** El reconocedor permanente que está escuchando ahora (el último que se abrió). */
  static active(): FakeRecognition | null {
    for (let i = FakeRecognition.instances.length - 1; i >= 0; i--) {
      const r = FakeRecognition.instances[i];
      if (r.continuous && r.started && !r.ended) return r;
    }
    return null;
  }
}

const memory = new Map<string, string>();
const localStorageShim = {
  getItem: (k: string) => (memory.has(k) ? memory.get(k)! : null),
  setItem: (k: string, v: string) => { memory.set(k, String(v)); },
  removeItem: (k: string) => { memory.delete(k); },
  clear: () => memory.clear(),
  key: (i: number) => [...memory.keys()][i] ?? null,
  get length() { return memory.size; },
};

export type FetchHandler = (url: string, init: RequestInit) => Promise<Response | null> | Response | null;
let handler: FetchHandler | null = null;
export function setFetchHandler(next: FetchHandler | null) { handler = next; }

const g = globalThis as unknown as Record<string, unknown>;
g.window = globalThis;
g.location = { pathname: '/es/appointments', href: 'http://voice-sim.test/es/appointments' };
g.localStorage = localStorageShim;
g.webkitSpeechRecognition = FakeRecognition;
g.__INVOKEIA_RUNTIME_CONFIG__ = { apiUrl: 'http://voice-sim.test' };
// La voz del asistente va silenciada (speakAssistant resuelve al instante).
localStorageShim.setItem('invoke-help-voice-muted', '1');
localStorageShim.setItem('token', 'test-token');
g.fetch = async (input: unknown, init: RequestInit = {}) => {
  const url = typeof input === 'string' ? input : String((input as { url?: string }).url ?? input);
  const res = handler ? await handler(url, init) : null;
  return res ?? new Response(JSON.stringify({ error: 'not mocked', url }), { status: 404, headers: { 'content-type': 'application/json' } });
};
