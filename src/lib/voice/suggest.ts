import { controlsOf, readSurface, type UiControl } from '@/lib/voice/dom-ui';
import { actionRoot } from '@/lib/voice/dom-dialog';
import { listNavTargets, stemWord } from '@/lib/voice/nav-targets';
import { normalizeSpeech } from '@/lib/voice/parse';

/**
 * Lo que no se entendió se compara con lo que se puede hacer (los botones, pestañas, interruptores
 * y campos de lo que está arriba en pantalla, y los destinos del menú) para proponer lo más
 * parecido: «¿Te referís a apretar «Guardar sede» o a ir a «Sedes»?». Cada propuesta trae la frase
 * que la hace (la que se ejecuta si se elige).
 */
export interface VoiceSuggestion {
  /** Lo que se muestra («Apretar «Guardar»», «Ir a Sedes»). */
  label: string;
  /** La frase que la ejecuta, como si se dijera. */
  phrase: string;
  score: number;
}

export interface SuggestLookup {
  locale: string;
  t: (key: string, values?: Record<string, string | number>) => string;
  hasPermission: (code: string) => boolean;
}

/** Palabras que no dicen qué (artículos, cortesía, muletillas). */
const STOP = new Set(['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'lo', 'de', 'del', 'al', 'a', 'en', 'y', 'o', 'que', 'por', 'para', 'con', 'me', 'mi', 'te', 'se', 'le', 'su', 'eso', 'esto', 'este', 'esta', 'aca', 'aqui', 'ahi', 'quiero', 'queria', 'necesito', 'podes', 'puedes', 'podrias', 'favor', 'porfa', 'che', 'dale', 'bueno', 'ver', 'the', 'an', 'of', 'to', 'in', 'on', 'and', 'or', 'for', 'with', 'my', 'me', 'it', 'this', 'that', 'please', 'want', 'need', 'can', 'you', 'could', 'i', 'some']);

const words = (text: string) => normalizeSpeech(text).split(' ').filter((w) => w.length > 1 && !STOP.has(w));

/** Dos palabras son la misma (plural, conjugación, una letra mal oída en una palabra larga). */
function sameWord(a: string, b: string): boolean {
  if (a === b) return true;
  if (stemWord(a) === stemWord(b)) return true;
  const ra = actionRoot(a);
  const rb = actionRoot(b);
  if (ra.length >= 4 && ra === rb) return true;
  if (a.length >= 5 && b.length >= 5 && (a.startsWith(b.slice(0, 5)) || b.startsWith(a.slice(0, 5)))) return true;
  return a.length >= 6 && b.length >= 6 && editDistance(a, b) <= 1;
}

function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 1) return 2;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

/** Cuánto de lo nombrado (`label`) está en lo dicho: 0 a 1. */
function overlap(said: string[], label: string): number {
  const target = words(label);
  if (!target.length) return 0;
  const hit = target.filter((w) => said.some((s) => sameWord(s, w))).length;
  // Lo que se dijo de más baja un poco la confianza.
  const extra = said.filter((s) => !target.some((w) => sameWord(s, w))).length;
  return hit / target.length - Math.min(0.3, extra * 0.08);
}

const quote = (locale: string, text: string) => (locale.startsWith('en') ? `“${text}”` : `«${text}»`);

function fromControl(control: UiControl, said: string[], lookup: SuggestLookup): VoiceSuggestion | null {
  const score = overlap(said, control.label);
  if (score < 0.5) return null;
  const T = (key: string, values: Record<string, string>) => lookup.t(`VoiceCommands.suggest.${key}`, values);
  const label = control.label.slice(0, 60);
  switch (control.kind) {
    case 'button':
    case 'link':
      return { label: T('press', { label: quote(lookup.locale, label) }), phrase: label, score };
    case 'tab':
      return { label: T('tab', { label: quote(lookup.locale, label) }), phrase: lookup.locale.startsWith('en') ? `${label} tab` : `pestaña ${label}`, score };
    case 'toggle': {
      const on = !control.checked;
      const verb = lookup.locale.startsWith('en') ? (on ? 'turn on' : 'turn off') : lookup.locale === 'es-ES' ? (on ? 'activa' : 'desactiva') : (on ? 'activá' : 'desactivá');
      return { label: T(on ? 'turnOn' : 'turnOff', { label: quote(lookup.locale, label) }), phrase: `${verb} ${label}`, score };
    }
    case 'select': {
      const verb = lookup.locale.startsWith('en') ? 'open' : lookup.locale === 'es-ES' ? 'abre' : 'abrí';
      return { label: T('select', { label: quote(lookup.locale, label) }), phrase: `${verb} ${label}`, score: score - 0.05 };
    }
    default:
      return null;
  }
}

/**
 * Hasta `max` propuestas para lo dicho, de la más parecida a la menos; vacío si nada se parece lo
 * suficiente (mejor decir «no entendí» que proponer cualquier cosa).
 */
export function suggestActions(normalized: string, lookup: SuggestLookup, max = 3): VoiceSuggestion[] {
  const said = words(normalized);
  if (!said.length || said.length > 12) return [];
  const out: VoiceSuggestion[] = [];
  const surface = readSurface();
  if (surface) {
    for (const control of controlsOf(surface, 'button', 'tab', 'link', 'toggle', 'select')) {
      const s = fromControl(control, said, lookup);
      if (s) out.push(s);
    }
  }
  const go = lookup.locale.startsWith('en') ? 'go to' : lookup.locale === 'es-ES' ? 've a' : 'andá a';
  for (const target of listNavTargets({ t: (key) => lookup.t(key), hasPermission: lookup.hasPermission })) {
    if (!target.allowed) continue;
    const score = Math.max(overlap(said, target.label), ...target.names.map((n) => overlap(said, n) - 0.02));
    if (score < 0.6) continue;
    out.push({ label: lookup.t('VoiceCommands.suggest.navigate', { label: quote(lookup.locale, target.parent ? `${target.parent} › ${target.label}` : target.label) }), phrase: `${go} ${target.parent ? `${target.parent} ${target.label}` : target.label}`, score: score - 0.05 });
  }
  const seen = new Set<string>();
  return out
    .sort((a, b) => b.score - a.score)
    .filter((s) => { const k = normalizeSpeech(s.phrase); if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, max);
}
