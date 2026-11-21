import { FakeRecognition, setFetchHandler } from './globals';
import { resetDom } from './dom';
import { createTranslator } from 'next-intl';

import '@/lib/voice/commands';
import { publishCalendarVoice } from '@/lib/voice/calendar-bridge';
import { resetUiSelection, setAppointmentFocus } from '@/lib/voice/focus';
import { expectedDomainsFor } from '@/lib/voice/nav-targets';
import { resetVoiceBridges } from '@/lib/voice/screen-bridge';
import { activeVoiceDomains, cancelVoice, configureVoiceSession, configureVoiceTiming, isVoiceSettled, startAlwaysOn, stopAlwaysOn, toggleAlwaysOn, updateVoiceDomains } from '@/lib/voice/session';
import { useVoiceCommand } from '@/stores/voice-command-store';

import { createSimCalendar, PATIENTS, type SimCalendar } from './calendar';
import { createSimRail, disposeSimRail, type SimRail } from './rail';
import { clearSimDashboard, publishSimDashboard, type SimDashboard } from './dashboard';
import { clearSimWorkspace, publishSimWorkspace, type SimWorkspace } from './workspace';
import { clearSimAlerts, publishSimAlerts, type SimAlerts } from './alerts';
import { clearSimCashier, publishSimCashier, type SimCashier } from './cashier';
import { clearSimPatients, publishSimPatients, type SimPatients } from './patients';
import { clearSimLab, createSimLab, type SimLab } from './lab';
import { prepare, validate, type PreparedQuery } from './n8n';

import en from '@/messages/en.json';
import es from '@/messages/es.json';
import esES from '@/messages/es-ES.json';

/**
 * Simulador de conversación con el agente de voz de la agenda. «Se habla» por el micrófono
 * permanente (el botón Voz prendido): cada frase pasa por la palabra de activación, la sesión, los
 * comandos y los textos reales. La agenda es la simulada (calendar.ts) y la IA, el flujo de n8n con
 * el modelo reemplazado por lo que la prueba dice que contestaría (`ai.reply`).
 */

export type ModelReply = Record<string, unknown> | ((q: PreparedQuery) => Record<string, unknown> | null);

export interface AiCall {
  text: string;
  context: Record<string, unknown>;
  prompt: string;
}

export interface VoiceSim {
  cal: SimCalendar;
  /** El riel derecho (paciente, sede, caja, TV, cobrar, alertas, notas…). */
  rail: SimRail;
  /** El panel de control (se publica al estar en «/»). */
  dashboard: () => SimDashboard | null;
  /** Mi consultorio (se publica al estar en «/workspace»). */
  workspace: () => SimWorkspace | null;
  /** El Centro de alertas (se publica al estar en «/alerts»). */
  alerts: () => SimAlerts | null;
  /** La Caja (se publica al estar en «/cashier»). */
  cashier: () => SimCashier | null;
  /** Pacientes (se publica al estar en «/patients»). */
  patients: () => SimPatients | null;
  /** Órdenes de laboratorio (backend y pantalla, al estar en «/lab-orders»). */
  lab: () => SimLab | null;
  /** Dice una frase (llega como frase terminada del reconocedor) y espera a que la sesión termine. */
  say: (text: string) => Promise<void>;
  /** Toca el botón Voz (prende o apaga el micrófono). */
  toggle: () => Promise<void>;
  /** Espera (tiempo real) y deja que la sesión termine. */
  wait: (ms: number) => Promise<void>;
  /** Dice varias, una tras otra. */
  sayAll: (...texts: string[]) => Promise<void>;
  /** Lo que muestra la tarjeta. */
  card: () => { title: string; message: string; choices: string[]; awaiting: string | null; tone: string | null; rows: string[] };
  store: () => ReturnType<typeof useVoiceCommand.getState>;
  /** Llamadas a la IA (POST voice/interpret) desde el comienzo de la prueba. */
  aiCalls: AiCall[];
  ai: {
    /** Lo que contestaría el modelo cuando la frase coincide con `match` (se prueba en orden). */
    reply: (match: RegExp, reply: ModelReply) => void;
  };
  /** Permisos que el usuario NO tiene. */
  deny: (...codes: string[]) => void;
  navigations: string[];
  /** La ruta en la que está (sin locale). */
  route: () => string;
  /** Los módulos de voz activos (los de la página más `core`). */
  domains: () => readonly string[];
  dispose: () => void;
}

const MESSAGES: Record<string, unknown> = { es, 'es-ES': esES, en };

async function settle(timeoutMs = 6000) {
  const start = Date.now();
  let stable = 0;
  await new Promise((r) => setTimeout(r, 5));
  while (Date.now() - start < timeoutMs) {
    if (isVoiceSettled()) {
      if (++stable >= 4) return;
    } else stable = 0;
    await new Promise((r) => setTimeout(r, 8));
  }
  throw new Error(`La sesión de voz no terminó en ${timeoutMs} ms (fase ${useVoiceCommand.getState().phase})`);
}

/** Como la app: cada página registra sus módulos (ROUTE_VOICE_DOMAINS) y `core` está siempre. */
const domainsFor = (route: string) => [...expectedDomainsFor(route), 'core'];

function setRoute(locale: string, route: string) {
  const path = `/${locale}${route === '/' ? '' : route.split('?')[0]}`;
  const g = globalThis as unknown as { location: { pathname: string; href: string } };
  g.location.pathname = path;
  g.location.href = `http://voice-sim.test${path}`;
}

export async function createVoiceSim({ locale = 'es', customMode = true, route = '/appointments' }: { locale?: 'es' | 'es-ES' | 'en'; customMode?: boolean; route?: string } = {}): Promise<VoiceSim> {
  const translator = createTranslator({ locale, messages: MESSAGES[locale] as Record<string, unknown> });
  const denied = new Set<string>();
  const replies: Array<{ match: RegExp; reply: ModelReply }> = [];
  const aiCalls: AiCall[] = [];
  const navigations: string[] = [];

  setFetchHandler(async (url, init) => {
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
    if (url.includes('/voice/interpret')) {
      const body = JSON.parse(String(init.body ?? '{}')) as Record<string, unknown>;
      const prepared = prepare(body);
      aiCalls.push({ text: String(body.text), context: (body.context ?? {}) as Record<string, unknown>, prompt: prepared.prompt });
      const found = replies.find((r) => r.match.test(String(body.text)));
      const raw = found ? (typeof found.reply === 'function' ? found.reply(prepared) : found.reply) : null;
      const output = JSON.stringify(raw ?? { relation: 'new', confidence: 0.1, steps: [] });
      return json(validate(prepared, output));
    }
    if (url.includes('/users?')) {
      const search = new URL(url).searchParams.get('search') ?? '';
      const q = search.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      // Como el buscador real: el texto entero en el nombre, o el documento / teléfono / email exactos.
      const rows = PATIENTS.filter((p) => p.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q) || p.document === q.replace(/\s/g, '') || p.phone === q.replace(/\s/g, '') || p.email === q)
        .map((p) => ({ id: p.id, name: p.name, phone_number: p.phone, email: p.email, identity_document: p.document }));
      return json([{ data: rows }]);
    }
    // El backend de laboratorio simulado (solo en la pantalla de órdenes).
    return lab?.handle(url, init) ?? null;
  });

  let lab: SimLab | null = null;
  setRoute(locale, route);
  const cal = createSimCalendar({ customMode });
  const rail = createSimRail();
  // Cada página simulada publica lo suyo al montarse (como en la app).
  let dashboard: SimDashboard | null = null;
  let workspace: SimWorkspace | null = null;
  let alerts: SimAlerts | null = null;
  let cashier: SimCashier | null = null;
  let patients: SimPatients | null = null;
  const mountPage = (to: string) => {
    clearSimLab();
    lab = to === '/lab-orders' ? createSimLab() : null;
    clearSimPatients();
    patients = to === '/patients' ? publishSimPatients() : null;
    clearSimCashier();
    cashier = to === '/cashier' ? publishSimCashier() : null;
    clearSimDashboard();
    clearSimWorkspace();
    clearSimAlerts();
    alerts = to === '/alerts' ? publishSimAlerts() : null;
    dashboard = to === '/' ? publishSimDashboard() : null;
    workspace = to === '/workspace' ? publishSimWorkspace() : null;
  };
  mountPage(route);
  configureVoiceTiming({ auxReturnMs: 10, awakeIdleMs: 60_000, awakePendingMs: 60_000, phraseGapMs: 0, echoGraceMs: 0 });
  configureVoiceSession({
    locale,
    t: (key, values) => translator(key as never, values as never) as string,
    hasPermission: (code) => !denied.has(code),
    navigate: (to) => {
      navigations.push(to);
      // Como el router: la ruta cambia enseguida y la página nueva registra su voz al montarse.
      setRoute(locale, to);
      setTimeout(() => { mountPage(to.split('?')[0]); updateVoiceDomains(domainsFor(to.split('?')[0])); }, 15);
    },
    domains: domainsFor(route),
  });
  startAlwaysOn();

  const say = async (text: string) => {
    const rec = FakeRecognition.active();
    if (!rec) throw new Error('El micrófono permanente no está escuchando');
    rec.deliver(text);
    await settle();
  };

  const store = () => useVoiceCommand.getState();
  return {
    cal,
    rail,
    dashboard: () => dashboard,
    workspace: () => workspace,
    alerts: () => alerts,
    cashier: () => cashier,
    patients: () => patients,
    lab: () => lab,
    say,
    sayAll: async (...texts) => { for (const t of texts) await say(t); },
    toggle: async () => { toggleAlwaysOn(); await settle(); },
    wait: async (ms) => { await new Promise((r) => setTimeout(r, ms)); await settle(); },
    card: () => {
      const s = store();
      return {
        title: s.card?.title ?? '',
        message: s.card?.message ?? '',
        choices: (s.card?.choices ?? []).map((c) => c.label),
        awaiting: s.awaiting,
        tone: s.card?.tone ?? null,
        rows: (s.card?.rows ?? []).map((r) => `${r.label}: ${r.value}`),
      };
    },
    store,
    aiCalls,
    ai: { reply: (match, reply) => { replies.push({ match, reply }); } },
    deny: (...codes) => codes.forEach((c) => denied.add(c)),
    navigations,
    route: () => (globalThis as unknown as { location: { pathname: string } }).location.pathname.replace(/^\/(es-ES|es|en)(?=\/|$)/, '') || '/',
    domains: () => activeVoiceDomains(),
    dispose: () => {
      setRoute('es', '/appointments');
      cancelVoice();
      stopAlwaysOn();
      configureVoiceSession(null);
      setAppointmentFocus(null);
      resetUiSelection();
      publishCalendarVoice(null);
      disposeSimRail();
      clearSimDashboard();
      clearSimWorkspace();
      clearSimAlerts();
      clearSimCashier();
      clearSimPatients();
      clearSimLab();
      resetVoiceBridges();
      setFetchHandler(null);
      FakeRecognition.instances.length = 0;
      resetDom();
      useVoiceCommand.getState().reset();
      useVoiceCommand.getState().set({ alwaysOn: false, awake: false, focusLabel: null, hearing: false });
      try { localStorage.removeItem('voice-always-on'); } catch { /* */ }
    },
  };
}
