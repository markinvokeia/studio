import { CORE_VOICE_DOMAIN, type CoreVoiceAiResult } from '@/lib/voice/commands/core';
import { currentRoute, expectedDomainsFor, isOnRoute, listNavTargets, matchNavTarget, type NavTarget } from '@/lib/voice/nav-targets';
import { normalizeSpeech } from '@/lib/voice/parse';
import { registerVoiceCommand } from '@/lib/voice/registry';

import type { VoiceCommandContext } from '@/lib/types';

/**
 * Navegar por el menú principal con la voz, desde cualquier página: «andá a pacientes», «llevame a
 * reportes de deudores», «abrí la caja», «go to the cashier», «take me to lab orders». Si la frase
 * sigue («andá a pacientes y buscá a Juan»), primero se va a la página y lo que sigue se interpreta
 * allá, con el contexto de la página nueva.
 */

export interface NavigateParsed {
  /** Claves del menú candidatas (más de una: hay que elegir). */
  keys: string[];
  /** Lo que se dijo como destino. */
  spoken: string;
  /** Lo que sigue del pedido para la página nueva (texto original). */
  rest: string | null;
}

const LEAD = '(?:(?:quiero|quisiera|necesito|me gustaria|podes|puedes|podrias|por favor|i want to|i need to|i would like to|i d like to|can you|could you|please|now|ahora)\\s+)*';
/** Verbos de ir a un lugar: alcanzan con que el destino esté en el menú. */
const STRONG_RE = new RegExp(`^${LEAD}(?:anda(?:te|mos)?|ve|vete|vaya|ir|vamos|vayamos|volve(?:r|mos)?|vuelve|vuelvo|regresa(?:r|mos)?|llevame|lleva|llevarme|navega(?:r)?|entra(?:r|me)?|pasa(?:me|r)?|cambia(?:me|r)?|salta(?:r)?|dirigite|dirigete|go(?: back)?|navigate|take me|bring me|head(?: over)?|jump|switch|get me)\\s+(?:(a|al|para|hacia|en|to|over to|back to|into|on)\\s+)?(.+)$`);
/** Abrir o mostrar: puede ser algo de la pantalla («abrí la cuenta»), así que se prueba al final. */
const WEAK_RE = new RegExp(`^${LEAD}(?:abri(?:me|r)?|abre(?:me)?|abrir|mostra(?:me|r)?|muestra(?:me)?|ensename|vamos a ver|quiero ver|ver|open(?: up)?|show(?: me)?|display|pull up|bring up|let me see|see|view)\\s+(.+)$`);
/** «centro de alertas», «mi consultorio»: el nombre solo, si es de varias palabras y no empieza con artículo. */
const ARTICLE_START = /^(?:el|la|los|las|lo|un|una|the|a|an|de|del|al|y|and|si|no|yes)\b/;

/** Partir en el destino y lo que sigue: «andá a pacientes y buscá a Juan». */
const CONNECTOR_RE = /\s*[,;]\s*|\s+(?:y\s+(?:despu[eé]s|luego|ah[ií])|y|e|despu[eé]s|luego|and then|then|and)\s+/gi;

let cachedTargets: Array<NavTarget & { allowed: boolean }> | null = null;
/** Para reconocer la frase alcanzan los sinónimos (es y en); el permiso se mira al hacerlo. */
const matchTargets = () => (cachedTargets ??= listNavTargets({ t: null, hasPermission: () => true }));

function heads(raw: string): Array<{ head: string; rest: string | null }> {
  const out: Array<{ head: string; rest: string | null }> = [];
  for (const m of raw.matchAll(CONNECTOR_RE)) {
    const index = m.index ?? 0;
    const rest = raw.slice(index + m[0].length).replace(/^(?:(?:y|e|and)\s+)?(?:then|despu[eé]s|luego|ah[ií])\s+/i, '').trim();
    if (index > 0 && rest) out.push({ head: raw.slice(0, index), rest });
  }
  // Del más largo al más corto: «facturación y cobranza» es un destino, no «facturación» y algo más.
  return [{ head: raw, rest: null }, ...out.reverse()];
}

function parseWith(normalized: string, raw: string, mode: 'strong' | 'weak'): NavigateParsed | null {
  const source = raw && normalizeSpeech(raw) === normalized ? raw : normalized;
  const found: Array<NavigateParsed & { score: number }> = [];
  for (const { head, rest } of heads(source)) {
    const text = normalizeSpeech(head);
    let spoken: string | null = null;
    const strong = text.match(STRONG_RE);
    const weak = text.match(WEAK_RE);
    // «cambiá de agenda» no es ir a la agenda: el destino va con «a», «al», «to» («go home» aparte).
    if (mode === 'strong' && strong && (strong[1] || /^(?:home|inicio)$/.test(strong[2]))) spoken = strong[2];
    else if (mode === 'weak' && weak) spoken = weak[1];
    else if (mode === 'weak' && !strong && !ARTICLE_START.test(text) && text.split(' ').length >= 2) spoken = text;
    // «la pestaña pagos», «the payments tab»: es una pestaña de la pantalla, no el menú.
    if (!spoken || /\b(?:pestana|pestanas|solapa|tab|tabs)\b/.test(spoken)) continue;
    const match = matchNavTarget(spoken, matchTargets());
    if (!match) continue;
    // Lo dicho sin verbo tiene que ser el nombre entero.
    if (spoken === text && match.score < 3) continue;
    if (mode === 'weak' && match.score < 2) continue;
    const keys = 'target' in match ? [match.target.key] : match.ambiguous.map((a) => a.key);
    found.push({ keys, spoken, rest, score: match.score });
  }
  if (!found.length) return null;
  // El que coincide mejor; a igual coincidencia, el destino más largo (lo dicho entero).
  const best = found.reduce((a, b) => (b.score > a.score + 1e-6 ? b : a));
  return { keys: best.keys, spoken: best.spoken, rest: best.rest };
}

export const parseNavigation = (normalized: string, raw = '') => parseWith(normalized, raw, 'strong') ?? parseWith(normalized, raw, 'weak');

const sleep = (ms: number, signal: AbortSignal) => new Promise<void>((resolve) => {
  const timer = setTimeout(resolve, ms);
  signal.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true });
});

/** Espera a que la página nueva esté puesta y haya registrado su voz (y se fue la de la anterior). */
async function waitForPage(href: string, from: string, ctx: VoiceCommandContext) {
  const want = expectedDomainsFor(href);
  const stale = expectedDomainsFor(from).filter((d) => !want.includes(d));
  const ready = () => {
    const active = ctx.activeDomains();
    return isOnRoute(href) && want.every((d) => active.includes(d)) && !stale.some((d) => active.includes(d));
  };
  const start = Date.now();
  while (!ctx.signal.aborted && Date.now() - start < 6000 && !ready()) await sleep(40, ctx.signal);
  // Un momento para que la pantalla publique su estado (la agenda, la lista).
  await sleep(want.length ? 120 : 250, ctx.signal);
}

async function runNavigate(parsed: NavigateParsed, ctx: VoiceCommandContext) {
  const { t } = ctx;
  const title = t('VoiceCommands.nav.title');
  const all = listNavTargets({ t, hasPermission: ctx.hasPermission });
  const candidates = parsed.keys.map((k) => all.find((a) => a.key === k)).filter((a): a is (typeof all)[number] => !!a);
  if (!candidates.length) {
    const message = t('VoiceCommands.nav.notFound', { name: parsed.spoken });
    await ctx.finish({ title, message, tone: 'info' }, message);
    return;
  }
  const allowed = candidates.filter((c) => c.allowed);
  if (!allowed.length) {
    const message = t('VoiceCommands.nav.noPermission', { page: candidates[0].label });
    await ctx.finish({ title, message, tone: 'error' }, message);
    return;
  }
  let target = allowed[0];
  if (allowed.length > 1) {
    const question = t('VoiceCommands.nav.which');
    const index = await ctx.choose(
      { title, message: question, tone: 'info', choices: allowed.map((a) => ({ label: a.label, detail: a.parent })) },
      `${question} ${allowed.map((a, i) => `${i + 1}: ${a.parent ? `${a.label} (${a.parent})` : a.label}`).join('. ')}.`,
    );
    target = allowed[index];
  }
  const page = target.label;
  const from = currentRoute();
  if (isOnRoute(target.href, from) && (target.href !== '/' || from === '/')) {
    if (parsed.rest) {
      ctx.followUp(parsed.rest);
      await ctx.finish({ title, message: t('VoiceCommands.nav.here', { page }), tone: 'success' }, '');
      return;
    }
    const message = t('VoiceCommands.nav.here', { page });
    await ctx.finish({ title, message, tone: 'success' }, message);
    return;
  }
  const message = t('VoiceCommands.nav.going', { page });
  ctx.show({ title, message, tone: 'info' });
  ctx.navigate(target.href);
  await waitForPage(target.href, from, ctx);
  if (parsed.rest) {
    ctx.followUp(parsed.rest);
    await ctx.finish({ title, message, tone: 'success' }, '');
    return;
  }
  await ctx.finish({ title, message, tone: 'success' }, message);
}

registerVoiceCommand<NavigateParsed, CoreVoiceAiResult>({
  id: 'core.navigate',
  domain: CORE_VOICE_DOMAIN,
  // «andá a…», «llevame a…»: le gana a lo de la pantalla (que no tiene destinos del menú).
  priority: 50,
  handlesCompound: true,
  match: (normalized, raw) => parseWith(normalized, raw, 'strong'),
  run: runNavigate,
  ai: {
    from: (result, raw) => (result.intent === 'navigate' && result.target_key ? { keys: [result.target_key], spoken: raw, rest: result.rest } : null),
  },
});

registerVoiceCommand<NavigateParsed>({
  id: 'core.navigate_open',
  domain: CORE_VOICE_DOMAIN,
  // «abrí la caja», «mostrame los reportes»: después de todo lo de la pantalla («abrí la cuenta»).
  priority: 1,
  handlesCompound: true,
  match: (normalized, raw) => parseWith(normalized, raw, 'weak'),
  run: runNavigate,
});
