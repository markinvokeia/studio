import type { PerioFurcationEntry, PerioSide } from '@/lib/types';

import type { PerioSiteIndex } from './teeth';

// Voice commands of the periodontogram, in Spanish and in English (both always understood). The
// browser transcribes; this turns the text into commands and runs in the browser, with no request.
// The list a person reads is in docs/periodontograma/comandos-de-voz.md and in
// PerioRecord.voice.help. Keep the three in step.
//
//   "3 2 4"                       values on the current line, one site after the other
//   "SS 23", "PS 23 vest"         go to a line (SS · PS · MG · placa) of a tooth; inner face by default
//   "38 lingual 3 2 4"            tooth and face, then values
//   "sangra", "sangra 16 distal"  mark bleeding (supura, placa) on the last site or on the one said
//   "anterior" / "siguiente"      previous / next tooth
//   "arcada inferior", "ambas"    what the chart shows
//   "margen gingival", "furcas y movilidad", "profundidad"   change pass

export type VoicePass = 'ps' | 'mg' | 'fm';
export type VoiceFocus = 'auto' | 'U' | 'L' | 'both';
export type VoiceFlag = 'bop' | 'sup' | 'plaque';
/** A line of the chart: a pass's values or a row of marks */
export type VoiceLine = 'ps' | 'mg' | VoiceFlag;

export type VoiceCommand =
  | { kind: 'values'; values: number[] }
  | { kind: 'answer'; on: boolean }
  | { kind: 'same' }
  | { kind: 'goto'; tooth?: number; side?: PerioSide; sites?: PerioSiteIndex[]; line?: VoiceLine }
  | { kind: 'neighbour'; delta: 1 | -1 }
  | { kind: 'flag'; flag: VoiceFlag; on: boolean; tooth?: number; side?: PerioSide; sites?: PerioSiteIndex[] }
  | { kind: 'pass'; pass: VoicePass }
  | { kind: 'focus'; focus: VoiceFocus }
  | { kind: 'mobility'; tooth?: number; value: number }
  | { kind: 'furcation'; tooth?: number; entry?: PerioFurcationEntry; grade: number }
  | { kind: 'undo' }
  | { kind: 'redo' }
  | { kind: 'delete' }
  | { kind: 'confirm' }
  | { kind: 'discard' }
  | { kind: 'stop' };

export interface VoiceParse {
  commands: VoiceCommand[];
  /** Words that were not understood, in order */
  unknown: string[];
}

const UNITS: Record<string, number> = {
  cero: 0, uno: 1, un: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
  veinte: 20, veintiuno: 21, veintiun: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28,
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
};
const TENS: Record<string, number> = { treinta: 30, cuarenta: 40, thirty: 30, forty: 40, twenty: 20 };

/** Words that carry nothing ("38 en lingual", "and", "please") */
const FILLER = new Set(['y', 'e', 'en', 'el', 'la', 'lo', 'los', 'las', 'de', 'del', 'al', 'a', 'por', 'favor', 'ok', 'okay', 'eh', 'este', 'bueno', 'cara', 'sitio', 'sitios', 'and', 'the', 'of', 'on', 'in', 'at', 'to', 'please', 'face', 'site', 'sites', 'um', 'uh']);

function normalize(text: string): string[] {
  let s = text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  s = s.replace(/[−–—]/g, '-').replace(/(^|\s)-\s*(\d)/g, '$1menos $2');
  s = s.replace(/[,.;:!?¿¡()"'«»]/g, ' ').replace(/-/g, ' ');
  // "treinta y siete", "thirty seven"
  s = s.replace(/\b(treinta|cuarenta)\s+y\s+(uno|un|dos|tres|cuatro|cinco|seis|siete|ocho)\b/g, (_m, a: string, b: string) => String(TENS[a] + UNITS[b]));
  s = s.replace(/\b(twenty|thirty|forty)\s+(one|two|three|four|five|six|seven|eight)\b/g, (_m, a: string, b: string) => String(TENS[a] + UNITS[b]));
  return s.split(/\s+/).filter(Boolean).map((w) => (w in UNITS ? String(UNITS[w]) : w in TENS ? String(TENS[w]) : w));
}

const isNumber = (w: string | undefined) => w != null && /^\d+$/.test(w);
export const isValidTooth = (n: number) => Math.floor(n / 10) >= 1 && Math.floor(n / 10) <= 4 && n % 10 >= 1 && n % 10 <= 8;

const SIDE_WORDS: [RegExp, PerioSide][] = [
  [/^(vestibular(es)?|vest|vestibulo|bucal|buccal|buc)$/, 'v'],
  [/^(lingual(es)?|ling|lin|palatin[oa]s?|palatal|pal|palat)$/, 'i'],
];
const SITE_WORDS: [RegExp, PerioSiteIndex][] = [
  [/^(distal|dist|d)$/, 0],
  [/^(centro|central|centr\w*|medio|media|mid|middle|center|centre)$/, 1],
  [/^(mesial|mes|m)$/, 2],
];
const ENTRY_WORDS: [RegExp, PerioFurcationEntry][] = [
  [/^(vestibular|bucal|buccal|vest)$/, 'v'],
  [/^(mesiopalatina|mesiopalatal|mesio|mesial)$/, 'mp'],
  [/^(distopalatina|distopalatal|disto|distal)$/, 'dp'],
  [/^(lingual|ling)$/, 'l'],
];
const NEGATIONS = /^(no|sin|quitar|quita|sacar|saca|remove|without|clear)$/;

/** Multi-word phrases, tried before single words. The longest that matches wins. */
const PHRASES: [RegExp, (m: RegExpMatchArray) => VoiceCommand | 'line-ss' | 'line-ps' | 'line-mg'][] = [
  [/^(parar|detener|terminar|stop)( el)?( dictado| dictation| listening)?$/, () => ({ kind: 'stop' })],
  [/^(confirmar|confirmo|confirma|confirm)( dictado| dictation| todo| all)?$/, () => ({ kind: 'confirm' })],
  [/^(descartar|descarta|discard)( dictado| dictation| todo| all)?$/, () => ({ kind: 'discard' })],
  [/^(deshacer|deshace|undo)$/, () => ({ kind: 'undo' })],
  [/^(rehacer|rehace|redo)$/, () => ({ kind: 'redo' })],
  [/^(borrar|borra|delete|clear|backspace)$/, () => ({ kind: 'delete' })],
  [/^(igual( que antes)?|lo mismo|same( as before)?)$/, () => ({ kind: 'same' })],
  [/^(siguiente|proxim[oa]|next)( pieza| diente| tooth)?$/, () => ({ kind: 'neighbour', delta: 1 })],
  [/^((pieza |diente )?anterior|previous( tooth)?|back)$/, () => ({ kind: 'neighbour', delta: -1 })],
  [/^((ver )?(la )?(sonda|arcada) superior|(upper|top) (arch|probe)|superior|upper)$/, () => ({ kind: 'focus', focus: 'U' })],
  [/^((ver )?(la )?(sonda|arcada) inferior|(lower|bottom) (arch|probe)|inferior|lower)$/, () => ({ kind: 'focus', focus: 'L' })],
  [/^((ver )?ambas( sondas| arcadas)?|(show )?both( arches| probes)?)$/, () => ({ kind: 'focus', focus: 'both' })],
  [/^(sigue a la sonda|seguir (a )?la sonda|automatico|follow( the)? probe)$/, () => ({ kind: 'focus', focus: 'auto' })],
  [/^((definir |ir a(l)? |pasar a(l)? )?(el )?margen( gingival)?|(go to )?(the )?(gingival )?margin|recesion(es)?|recession)$/, () => ({ kind: 'pass', pass: 'mg' })],
  [/^((ir a |volver a(l)? |pasar a )?(la )?(profundidad(es)?( de sondaje)?|sondaje)|(go to )?(probing( depths?)?|depths?))$/, () => ({ kind: 'pass', pass: 'ps' })],
  [/^((ir a |pasar a )?(las )?furcas y movilidad|furcations and mobility)$/, () => ({ kind: 'pass', pass: 'fm' })],
  [/^(s s|ss|ese ese|eses|bop|sangrado al sondaje|bleeding on probing)$/, () => 'line-ss'],
  [/^(p s|ps|pe ese|pd|p d|pe de)$/, () => 'line-ps'],
  [/^(m g|mg|eme ge|gm|g m|ge eme)$/, () => 'line-mg'],
];
/** Longest phrase tried, in words */
const MAX_PHRASE = 5;

export function parseVoice(text: string): VoiceParse {
  const w = normalize(text);
  const commands: VoiceCommand[] = [];
  const unknown: string[] = [];
  let i = 0;

  const sideAt = (j: number) => SIDE_WORDS.find(([re]) => re.test(w[j] ?? ''))?.[1];
  const siteAt = (j: number) => SITE_WORDS.find(([re]) => re.test(w[j] ?? ''))?.[1];
  /** A tooth at j: "23", or "2 3" (FDI said digit by digit) */
  const toothAt = (j: number): { tooth: number; used: number } | null => {
    if (isNumber(w[j]) && isValidTooth(Number(w[j])) && w[j].length === 2) return { tooth: Number(w[j]), used: 1 };
    if (isNumber(w[j]) && isNumber(w[j + 1]) && w[j].length === 1 && w[j + 1].length === 1) {
      const n = Number(w[j]) * 10 + Number(w[j + 1]);
      if (isValidTooth(n)) return { tooth: n, used: 2 };
    }
    return null;
  };
  /** Sites listed after a mark: "distal", "distal y mesial", "todos" */
  const sitesFrom = (j: number): { sites?: PerioSiteIndex[]; used: number } => {
    const sites: PerioSiteIndex[] = [];
    let k = j;
    for (;;) {
      if (/^(todos|todo|todas|all|toda)$/.test(w[k] ?? '')) return { sites: [0, 1, 2], used: k - j + 1 };
      const s = siteAt(k);
      if (s != null) { if (!sites.includes(s)) sites.push(s); k++; continue; }
      if (sites.length && /^(y|e|and)$/.test(w[k] ?? '') && siteAt(k + 1) != null) { k++; continue; }
      break;
    }
    return { sites: sites.length ? sites : undefined, used: k - j };
  };
  /** Optional tooth, face and sites after a line or a mark */
  const target = (j: number) => {
    let k = j;
    const t = toothAt(k);
    if (t) k += t.used;
    const side = sideAt(k);
    if (side) k++;
    const s = sitesFrom(k);
    k += s.used;
    return { tooth: t?.tooth, side, sites: s.sites, used: k - j };
  };
  const pushValue = (v: number) => {
    const prev = commands[commands.length - 1];
    if (prev?.kind === 'values') prev.values.push(v);
    else commands.push({ kind: 'values', values: [v] });
  };
  const pushDigits = (digits: string, negative: boolean) => {
    const n = Number(digits);
    // "10" to "15" are values; "324" or "32" said quickly are three or two sites
    if (digits.length === 1 || (digits.length === 2 && n <= 15)) pushValue(negative ? -n : n);
    else digits.split('').forEach((d, k) => pushValue(negative && k === 0 ? -Number(d) : Number(d)));
  };

  while (i < w.length) {
    // Phrases
    let matched = false;
    for (let len = Math.min(MAX_PHRASE, w.length - i); len >= 1 && !matched; len--) {
      const phrase = w.slice(i, i + len).join(' ');
      for (const [re, build] of PHRASES) {
        const m = phrase.match(re);
        if (!m) continue;
        const out = build(m);
        i += len;
        if (out === 'line-ss' || out === 'line-ps' || out === 'line-mg') {
          const line: VoiceLine = out === 'line-ss' ? 'bop' : out === 'line-ps' ? 'ps' : 'mg';
          const tg = target(i);
          i += tg.used;
          commands.push({ kind: 'goto', line, tooth: tg.tooth, side: tg.side, sites: tg.sites });
        } else {
          commands.push(out);
        }
        matched = true;
        break;
      }
    }
    if (matched) continue;

    const word = w[i];

    // Marks: "sangra", "no sangra", "sangra 16 distal", "placa", "SS"-like lines for plaque and pus
    const negated = NEGATIONS.test(word) && /^(sangr|supur|pus|placa|plaque|bleed)/.test(w[i + 1] ?? '');
    const markWord = negated ? w[i + 1] : word;
    const flag: VoiceFlag | null = /^(sangra|sangrado|sangrante|sangran|bleeds?|bleeding)$/.test(markWord) ? 'bop'
      : /^(supura|supuracion|supurante|pus|suppurates?|suppuration)$/.test(markWord) ? 'sup'
        : /^(placa|plaque)$/.test(markWord) ? 'plaque' : null;
    if (flag) {
      i += negated ? 2 : 1;
      const tg = target(i);
      i += tg.used;
      // "placa 23" / "supuración 23" go to that row, like "SS 23"; "sangra 23" marks the tooth
      const isRowName = !negated && (flag === 'plaque' || /^(supuracion|suppuration)$/.test(markWord));
      if (isRowName && tg.tooth != null && !tg.sites) commands.push({ kind: 'goto', line: flag, tooth: tg.tooth, side: tg.side });
      else commands.push({ kind: 'flag', flag, on: !negated, tooth: tg.tooth, side: tg.side, sites: tg.sites });
      continue;
    }

    // "con placa"
    if (word === 'con' && /^(placa|sangrado|supuracion)$/.test(w[i + 1] ?? '')) { i++; continue; }

    // Mobility: "movilidad 2", "46 movilidad 1", "movilidad del 46 2"; alone, the pass
    if (/^(movilidad|mobility|movil)$/.test(word)) {
      i++;
      const t = toothAt(i);
      if (t && isNumber(w[i + t.used]) && Number(w[i + t.used]) <= 3) {
        commands.push({ kind: 'mobility', tooth: t.tooth, value: Number(w[i + t.used]) });
        i += t.used + 1;
      } else if (isNumber(w[i]) && Number(w[i]) <= 9) {
        commands.push({ kind: 'mobility', value: Number(w[i]) });
        i++;
      } else {
        commands.push({ kind: 'pass', pass: 'fm' });
      }
      continue;
    }

    // Furcation: "furca vestibular 2", "furca 2"; alone, the pass
    if (/^(furca|furcas|furcacion|furcation|furcations)$/.test(word)) {
      i++;
      const t = toothAt(i);
      let k = i + (t?.used ?? 0);
      const entry = ENTRY_WORDS.find(([re]) => re.test(w[k] ?? ''))?.[1];
      if (entry) k++;
      if (isNumber(w[k]) && Number(w[k]) <= 9) {
        commands.push({ kind: 'furcation', tooth: t?.tooth, entry, grade: Number(w[k]) });
        i = k + 1;
      } else {
        commands.push({ kind: 'pass', pass: 'fm' });
        if (t) commands.push({ kind: 'goto', tooth: t.tooth });
        i = k;
      }
      continue;
    }

    // "diente 23", "pieza 2 3", "tooth 23"
    if (/^(diente|pieza|tooth|numero|number|elemento)$/.test(word)) {
      const t = toothAt(i + 1);
      if (t) {
        i += 1 + t.used;
        const side = sideAt(i);
        if (side) i++;
        commands.push({ kind: 'goto', tooth: t.tooth, side });
        continue;
      }
    }

    // "38 lingual …": a tooth followed by a face
    {
      const t = toothAt(i);
      if (t && sideAt(i + t.used)) {
        commands.push({ kind: 'goto', tooth: t.tooth, side: sideAt(i + t.used) });
        i += t.used + 1;
        continue;
      }
      if (t && /^(movilidad|mobility)$/.test(w[i + t.used] ?? '') && isNumber(w[i + t.used + 1])) {
        commands.push({ kind: 'mobility', tooth: t.tooth, value: Number(w[i + t.used + 1]) });
        i += t.used + 2;
        continue;
      }
    }

    // A face alone: change face on the current tooth
    {
      const side = sideAt(i);
      if (side) { commands.push({ kind: 'goto', side }); i++; continue; }
    }

    // Values: "3", "menos 2", "minus 1"
    if (/^(menos|minus|negativo|negative)$/.test(word) && isNumber(w[i + 1])) {
      pushDigits(w[i + 1], true);
      i += 2;
      continue;
    }
    if (isNumber(word)) { pushDigits(word, false); i++; continue; }

    // Answers on a row of marks
    if (/^(si|yes|positivo|positive|yep)$/.test(word)) { commands.push({ kind: 'answer', on: true }); i++; continue; }
    if (/^(no|negativo|limpio|clean|nada|nope)$/.test(word)) { commands.push({ kind: 'answer', on: false }); i++; continue; }

    if (!FILLER.has(word)) unknown.push(word);
    i++;
  }

  return { commands, unknown };
}
