import { scrollScreen, type ScrollAmount, type ScrollDirection } from '@/lib/voice/dom-scroll';
import { listNavTargets } from '@/lib/voice/nav-targets';
import { registerVoiceCommand, registerVoiceDomain } from '@/lib/voice/registry';

import type { VoiceCommandContext } from '@/lib/types';

/**
 * Módulo de voz general: lo que sirve en cualquier pantalla (desplazarse por lo que se ve). Está
 * siempre activo; cada pantalla suma el suyo (calendar, lab_orders…). Base para navegar por el
 * menú y el panel derecho desde cualquier lugar.
 */
export const CORE_VOICE_DOMAIN = 'core';

/** «llevame donde…», «quiero ir a…», «where do I see…»: vale la pena preguntarle a la IA adónde. */
const NAV_HINT = /\b(?:anda\w*|ve|vete|ir|vamos|volve\w*|regresa\w*|lleva\w*|navega\w*|entra\w*|pasa(?:me)?|abri\w*|abre\w*|mostra\w*|muestra\w*|donde|adonde|pantalla|seccion|pagina|menu|modulo|go|take me|bring me|navigate|head|open|show me|where|screen|page|section|menu)\b/;
export const soundsLikeNavigation = (normalized: string) => NAV_HINT.test(normalized);

export interface CoreVoiceAiResult {
  relation?: 'new' | 'ignore' | 'cancel' | 'resume';
  intent: 'navigate' | 'unknown';
  target_key: string | null;
  rest: string | null;
  confidence?: number;
}

registerVoiceDomain<CoreVoiceAiResult>({
  id: CORE_VOICE_DOMAIN,
  // La IA del módulo general: a qué sección de la app se quiere ir cuando no se nombró tal cual
  // («llevame donde veo quién nos debe»). Solo conoce los destinos a los que el usuario puede entrar.
  ai: {
    accepts: soundsLikeNavigation,
    context: async (ctx) => ({
      targets: listNavTargets({ t: ctx.t, hasPermission: ctx.hasPermission })
        .filter((target) => target.allowed)
        .map((target) => ({ key: target.key, label: target.label, section: target.parent ?? '' })),
    }),
    sanitize: (raw, context) => {
      const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
      const keys = new Set(((context.targets as Array<{ key: string }> | undefined) ?? []).map((t) => t.key));
      const key = typeof r.target_key === 'string' && keys.has(r.target_key) ? r.target_key : null;
      const relation = ['new', 'ignore', 'cancel', 'resume'].includes(String(r.relation)) ? (r.relation as CoreVoiceAiResult['relation']) : 'new';
      const intent = r.intent === 'navigate' && key ? 'navigate' : 'unknown';
      return { relation, intent, target_key: intent === 'navigate' ? key : null, rest: intent === 'navigate' && typeof r.rest === 'string' && r.rest.trim() ? r.rest.trim() : null };
    },
  },
});

// ── Desplazarse ───────────────────────────────────────────────────────────────

export interface ScrollParsed {
  direction: ScrollDirection;
  amount: ScrollAmount;
}

const VERB = '(?:(?:hace\\w* |haz |dale |pega\\w* )?(?:scroll\\w*|scrollea\\w*|desplaza\\w*|movete|muevete|move|anda|ve|go|ir|baja\\w*|bajar|subi\\w*|sube|subir|corre\\w*|tira\\w*|lleva\\w*|pasa\\w*|navega\\w*|scroll)\\s)?';
const DIRECTIONS: Array<[RegExp, ScrollDirection]> = [
  [/\b(?:arriba|para arriba|hacia arriba|up|upwards|top|subi\w*|sube|subir|principio|inicio|beginning)\b/, 'up'],
  [/\b(?:abajo|para abajo|hacia abajo|down|downwards|bottom|baja\w*|bajar|final|fondo|end)\b/, 'down'],
  [/\b(?:izquierda|a la izquierda|hacia la izquierda|left)\b/, 'left'],
  [/\b(?:derecha|a la derecha|hacia la derecha|right)\b/, 'right'],
];
const EDGE = /\b(?:hasta (?:arriba|abajo|el final|el principio|el fondo|el tope|el inicio|la izquierda|la derecha)|al (?:principio|final|fondo|tope|inicio)|del todo|todo para (?:arriba|abajo)|de todo|all the way|to the (?:top|bottom|end|beginning|start)|top of|bottom of)\b/;
const LITTLE = /\b(?:un poco|un poquito|un pelin|apenas|despacito|poquito|a bit|a little|a little bit|slightly)\b/;
const MORE = /\b(?:mucho|bastante|mas rapido|rapido|un monton|una pagina|a lot|faster|a page|much)\b/;
/** Lo que no es desplazarse aunque diga «subí» o «bajá» (el zoom, la altura de las horas, un archivo…). */
const NOT_SCROLL = /\b(?:zoom|hora|horas|altura|volumen|volume|archivo|archivos|file|files|precio|price|cita|turno|appointment|paciente|patient|el panel|la barra|configuracion|settings|agenda|calendario|nivel)\b/;

/** «bajá», «subí un poco», «más abajo», «hasta arriba», «movete a la derecha», «scroll down a lot». */
export function parseScroll(normalized: string): ScrollParsed | null {
  if (NOT_SCROLL.test(normalized)) return null;
  const text = normalized.replace(/\b(?:por favor|please|che|dale)\b/g, ' ').replace(/\s+/g, ' ').trim();
  // La frase tiene que ser solo de desplazarse: verbo, dirección, cuánto y nada más.
  const words = text.split(' ').filter((w) => !/^(?:mas|un|una|poco|poquito|pelin|apenas|despacito|mucho|bastante|rapido|monton|pagina|hasta|al|el|la|lo|todo|de|del|para|hacia|a|the|to|of|bit|little|lot|much|faster|slightly|page|all|way|me|te|se|y|e|un poco|scroll\w*|scrollea\w*|desplaza\w*|movete|muevete|move|anda|ve|go|ir|corre\w*|tira\w*|lleva\w*|pasa\w*|navega\w*|hace\w*|haz|pega\w*|arriba|abajo|up|down|left|right|izquierda|derecha|top|bottom|subi\w*|sube|subir|baja\w*|bajar|principio|inicio|final|fondo|end|start|beginning|tope|upwards|downwards|more|again|otra|vez|mas)$/.test(w));
  if (words.length) return null;
  if (!new RegExp(`^${VERB}`).test(text) && !/^(?:mas|un poco|un poquito|hasta|al|todo|scroll|all|a bit|a little|more)\b/.test(text) && !DIRECTIONS.some(([re]) => re.test(text.split(' ')[0]))) return null;
  const direction = DIRECTIONS.find(([re]) => re.test(text))?.[1];
  if (!direction) return null;
  const faster = /\b(?:mas rapido|rapido|faster|quicker)\b/.test(text);
  const amount: ScrollAmount = EDGE.test(text) || /\b(?:principio|inicio|final|fondo|tope|top|bottom|end|beginning|start)\b/.test(text) ? 'edge' : faster ? 'more' : LITTLE.test(text) ? 'little' : MORE.test(text) ? 'more' : 'normal';
  return { direction, amount };
}

async function runScroll(parsed: ScrollParsed, ctx: VoiceCommandContext) {
  const moved = scrollScreen(parsed.direction, parsed.amount);
  // Se ve el resultado en la pantalla: no hace falta decir nada si se movió.
  if (moved) {
    ctx.show({ title: ctx.t('VoiceCommands.scroll.title'), message: ctx.t(`VoiceCommands.scroll.${parsed.direction}`), tone: 'success' });
    await ctx.finish({ title: ctx.t('VoiceCommands.scroll.title'), message: ctx.t(`VoiceCommands.scroll.${parsed.direction}`), tone: 'success' }, '');
    return;
  }
  const message = ctx.t('VoiceCommands.scroll.nothing');
  await ctx.finish({ title: ctx.t('VoiceCommands.scroll.title'), message, tone: 'info' }, message);
}

registerVoiceCommand<ScrollParsed>({
  id: 'core.scroll',
  domain: CORE_VOICE_DOMAIN,
  priority: 2,
  aux: true,
  match: (normalized) => parseScroll(normalized),
  run: runScroll,
});
