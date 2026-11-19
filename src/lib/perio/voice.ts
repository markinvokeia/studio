import type { PerioFurcationEntry, PerioSide, PerioToothStatus } from '@/lib/types';

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
//   "18 ausente", "46 implante"   tooth status (asks before: missing and pontic wipe the values)
//   "copiar del examen anterior"  fills what is empty from the previous exam (asks before)
//   "¿cuánto tenía el 16?", "leé el 16", "¿qué me falta?"   questions: nothing is written

export type VoicePass = 'ps' | 'mg' | 'fm';
export type VoiceFocus = 'auto' | 'U' | 'L' | 'both';
export type VoiceFlag = 'bop' | 'sup' | 'plaque';
/** A line of the chart: a pass's values or a row of marks */
export type VoiceLine = 'ps' | 'mg' | VoiceFlag;
/** What "copiar del examen anterior" fills: one pass or all */
export type VoiceCopy = VoicePass | 'all';
/** previous: the values of the previous exam · current: what the chart has · missing: how much is left */
export type VoiceQuery = 'previous' | 'current' | 'missing';

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
  | { kind: 'status'; tooth: number; status: PerioToothStatus }
  | { kind: 'copy'; what: VoiceCopy }
  | { kind: 'query'; what: VoiceQuery; tooth?: number }
  | { kind: 'confirm' }
  | { kind: 'discard' }
  | { kind: 'stop' };

/** Commands that change much at once or cannot be seen underlined: the screen asks "sí / no" first */
export const isWeightyCommand = (c: VoiceCommand) => c.kind === 'status' || c.kind === 'copy' || c.kind === 'discard';

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
const STATUS_WORDS: [RegExp, PerioToothStatus][] = [
  [/^(ausente|ausentes|perdid[oa]|extraid[oa]|missing|absent|extracted)$/, 'missing'],
  [/^(implante|implant)$/, 'implant'],
  [/^(pontico|pontic)$/, 'pontic'],
  [/^(presente|present)$/, 'present'],
];
/** Words between a tooth and its status ("el 18 está ausente", "46 es un implante": "un" arrives as 1) */
const STATUS_LINK = /^(esta|es|is|un|una|an|como|1)$/;
const COPY_PASS: [RegExp, VoiceCopy][] = [
  [/^(profundidad(es)?|sondaje|probing|depths?)$/, 'ps'],
  [/^(margen|margenes|recesion(es)?|margins?|recession)$/, 'mg'],
  [/^(furcas|movilidad|furcations|mobility)$/, 'fm'],
];

/** Multi-word phrases, tried before single words. The longest that matches wins. */
type PhraseMarker = 'line-ss' | 'line-ps' | 'line-mg' | 'query-previous' | 'query-current';
const PHRASES: [RegExp, (m: RegExpMatchArray) => VoiceCommand | PhraseMarker][] = [
  // From the previous exam: "copiar del examen anterior", "copiar la profundidad del examen anterior"
  [/^(copiar|copia|copiame|iniciar|empezar|arrancar)( todo)?( con| del| desde)( el)? examen anterior$/, () => ({ kind: 'copy', what: 'all' })],
  [/^(copiar|copia|copiame)( la| el| las| los)? (\S+)( gingival| y movilidad)?( del| desde)( el)? examen anterior$/, (m) => ({ kind: 'copy', what: COPY_PASS.find(([re]) => re.test(m[3]))?.[1] ?? 'all' })],
  [/^(copy|start)( all| everything)?( from| with)( the)? (previous|last) exam$/, () => ({ kind: 'copy', what: 'all' })],
  [/^copy( the)? (\S+)( depths?| margin| and mobility)? from( the)? (previous|last) exam$/, (m) => ({ kind: 'copy', what: COPY_PASS.find(([re]) => re.test(m[2]))?.[1] ?? 'all' })],
  // Questions: nothing is written
  [/^((que|cuanto|cuantos|cuantas) (me )?(falta|faltan)( sondar| medir)?|(what is|whats|what s) (missing|left)|how many (are )?left)$/, () => ({ kind: 'query', what: 'missing' })],
  [/^((cuanto|que|como) (tenia|estaba)( antes)?|(what|how much) (was it|did it have)( before)?|(what was|previous values)( of)?)$/, () => 'query-previous'],
  [/^(lee|leeme|leer|leelo|repeti|repetime|repite|repetir|(que|cuanto) tiene|como esta|read( back)?|repeat|what does it have)$/, () => 'query-current'],
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
const MAX_PHRASE = 8;

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
  /** A tooth after a few fillers ("cuánto tenía el 16", "falta la pieza 18") */
  const toothAfter = (j: number): { tooth: number; used: number } | null => {
    let k = j;
    while (k < w.length && /^(el|la|del|de|pieza|diente|tooth|of|the|en)$/.test(w[k])) k++;
    const t = toothAt(k);
    return t ? { tooth: t.tooth, used: k - j + t.used } : null;
  };
  /** A status after a tooth, skipping "está", "es un" */
  const statusAfter = (j: number): { status: PerioToothStatus; used: number } | null => {
    let k = j;
    while (k < w.length && STATUS_LINK.test(w[k])) k++;
    const status = STATUS_WORDS.find(([re]) => re.test(w[k] ?? ''))?.[1];
    return status ? { status, used: k - j + 1 } : null;
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
        if (out === 'query-previous' || out === 'query-current') {
          const t = toothAfter(i);
          if (t) i += t.used;
          // "what was 16 before?", "¿cuánto tenía el 16 antes?"
          if (/^(before|antes|previously)$/.test(w[i] ?? '')) i++;
          commands.push({ kind: 'query', what: out === 'query-previous' ? 'previous' : 'current', tooth: t?.tooth });
        } else if (out === 'line-ss' || out === 'line-ps' || out === 'line-mg') {
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

    // Status, word first: "ausente 18", "falta el 18", "implante en la 46"
    {
      const status = word === 'falta' || word === 'faltan' ? 'missing' : STATUS_WORDS.find(([re]) => re.test(word))?.[1];
      const t = status ? toothAfter(i + 1) : null;
      if (status && t) {
        commands.push({ kind: 'status', tooth: t.tooth, status });
        i += 1 + t.used;
        continue;
      }
    }

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
      const st = t ? statusAfter(i + 1 + t.used) : null;
      if (t && st) {
        commands.push({ kind: 'status', tooth: t.tooth, status: st.status });
        i += 1 + t.used + st.used;
        continue;
      }
      if (t) {
        i += 1 + t.used;
        const side = sideAt(i);
        if (side) i++;
        commands.push({ kind: 'goto', tooth: t.tooth, side });
        continue;
      }
    }

    // "38 lingual …": a tooth followed by a face (or by a status: "18 ausente")
    {
      const t = toothAt(i);
      const st = t ? statusAfter(i + t.used) : null;
      if (t && st) {
        commands.push({ kind: 'status', tooth: t.tooth, status: st.status });
        i += t.used + st.used;
        continue;
      }
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

// ── What the AI understood (POST voice/interpret, domain 'perio') ────────────────────────────────
// The AI returns the same commands the parser builds. Before they are written, two checks that do
// not use AI: every number it wrote must have been said, and the commands are read back as a phrase
// of this language (what the bar shows, and what is asked when there is a doubt).

/** Every number said in the phrase: "3 2 4", "324" (3, 2, 4), "2 3" (the tooth 23), "menos 2" (2) */
export function spokenNumbers(text: string): Set<number> {
  const w = normalize(text);
  const out = new Set<number>();
  for (let i = 0; i < w.length; i++) {
    const word = w[i];
    if (!isNumber(word)) continue;
    out.add(Number(word));
    if (word.length > 1) {
      for (let k = 0; k < word.length; k++) {
        out.add(Number(word[k]));
        if (k + 1 < word.length) out.add(Number(word.slice(k, k + 2)));
      }
    }
    // A tooth said digit by digit
    if (word.length === 1 && isNumber(w[i + 1]) && w[i + 1].length === 1) out.add(Number(word + w[i + 1]));
  }
  return out;
}

/** Numbers in the commands that were not said (a value, a tooth or a grade the AI made up) */
export function inventedNumbers(commands: VoiceCommand[], text: string): number[] {
  const said = spokenNumbers(text);
  const used: number[] = [];
  for (const c of commands) {
    if (c.kind === 'values') used.push(...c.values.map(Math.abs));
    if ((c.kind === 'goto' || c.kind === 'flag' || c.kind === 'mobility' || c.kind === 'furcation' || c.kind === 'status' || c.kind === 'query') && c.tooth != null) used.push(c.tooth);
    if (c.kind === 'mobility') used.push(c.value);
    if (c.kind === 'furcation') used.push(c.grade);
  }
  return [...new Set(used.filter((n) => !said.has(n)))];
}

const PHRASE_WORDS = {
  es: {
    minus: 'menos', sides: { v: 'vestibular', i: 'lingual', p: 'palatino' }, sites: ['distal', 'centro', 'mesial'],
    lines: { ps: 'PS', mg: 'MG', bop: 'SS', sup: 'supuración', plaque: 'placa' }, tooth: 'diente',
    flags: { bop: 'sangra', sup: 'supura', plaque: 'placa' }, not: { bop: 'no sangra', sup: 'no supura', plaque: 'sin placa' },
    next: 'siguiente', previous: 'anterior', passes: { ps: 'profundidad', mg: 'margen gingival', fm: 'furcas y movilidad' },
    focus: { U: 'arcada superior', L: 'arcada inferior', both: 'ver ambas', auto: 'sigue a la sonda' },
    mobility: 'movilidad', furcation: 'furca', entries: { v: 'vestibular', mp: 'mesiopalatina', dp: 'distopalatina', l: 'lingual' },
    same: 'igual', yes: 'sí', no: 'no', undo: 'deshacer', redo: 'rehacer', delete: 'borrar', confirm: 'confirmar', discard: 'descartar', stop: 'parar dictado',
    status: { present: 'presente', missing: 'ausente', implant: 'implante', pontic: 'póntico' },
    copy: { all: 'copiar del examen anterior', ps: 'copiar la profundidad del examen anterior', mg: 'copiar el margen del examen anterior', fm: 'copiar las furcas del examen anterior' },
    query: { previous: '¿cuánto tenía?', current: 'leé', missing: '¿qué me falta?' },
  },
  en: {
    minus: 'minus', sides: { v: 'buccal', i: 'lingual', p: 'palatal' }, sites: ['distal', 'center', 'mesial'],
    lines: { ps: 'PD', mg: 'GM', bop: 'BOP', sup: 'suppuration', plaque: 'plaque' }, tooth: 'tooth',
    flags: { bop: 'bleeds', sup: 'suppurates', plaque: 'plaque' }, not: { bop: 'no bleeding', sup: 'no suppuration', plaque: 'no plaque' },
    next: 'next', previous: 'previous', passes: { ps: 'probing depth', mg: 'gingival margin', fm: 'furcations and mobility' },
    focus: { U: 'upper arch', L: 'lower arch', both: 'show both', auto: 'follow the probe' },
    mobility: 'mobility', furcation: 'furcation', entries: { v: 'buccal', mp: 'mesiopalatal', dp: 'distopalatal', l: 'lingual' },
    same: 'same', yes: 'yes', no: 'no', undo: 'undo', redo: 'redo', delete: 'delete', confirm: 'confirm', discard: 'discard', stop: 'stop dictation',
    status: { present: 'present', missing: 'missing', implant: 'implant', pontic: 'pontic' },
    copy: { all: 'copy from the previous exam', ps: 'copy the depths from the previous exam', mg: 'copy the margin from the previous exam', fm: 'copy the furcations from the previous exam' },
    query: { previous: 'what was it before?', current: 'read', missing: 'what is missing?' },
  },
};

/** The commands as a phrase of the dictation language ("38 lingual 3 2 4, sangra distal") */
export function voiceCommandsToPhrase(commands: VoiceCommand[], locale: string): string {
  const w = locale.startsWith('es') ? PHRASE_WORDS.es : PHRASE_WORDS.en;
  const side = (s: PerioSide | undefined, tooth?: number) => (!s ? '' : s === 'v' ? w.sides.v : tooth != null && Math.floor(tooth / 10) <= 2 ? w.sides.p : w.sides.i);
  const sites = (list?: PerioSiteIndex[]) => (list ?? []).map((i) => w.sites[i]).join(' ');
  const join = (...parts: (string | number | undefined | null)[]) => parts.filter((p) => p !== '' && p != null).join(' ');
  return commands.map((c) => {
    switch (c.kind) {
      case 'values': return c.values.map((v) => (v < 0 ? `${w.minus} ${-v}` : String(v))).join(' ');
      case 'answer': return c.on ? w.yes : w.no;
      case 'same': return w.same;
      case 'goto': return c.line
        ? join(w.lines[c.line], c.tooth, side(c.side, c.tooth), sites(c.sites))
        : join(c.tooth != null ? `${w.tooth} ${c.tooth}` : '', side(c.side, c.tooth), sites(c.sites));
      case 'neighbour': return c.delta === 1 ? w.next : w.previous;
      case 'flag': return join(c.on ? w.flags[c.flag] : w.not[c.flag], c.tooth, side(c.side, c.tooth), sites(c.sites));
      case 'pass': return w.passes[c.pass];
      case 'focus': return w.focus[c.focus];
      case 'mobility': return join(c.tooth, w.mobility, c.value);
      case 'furcation': return join(w.furcation, c.tooth, c.entry ? w.entries[c.entry] : '', c.grade);
      case 'status': return join(c.tooth, w.status[c.status]);
      case 'copy': return w.copy[c.what];
      case 'query': return join(w.query[c.what], c.tooth);
      default: return w[c.kind];
    }
  }).filter(Boolean).join(', ');
}

/** Words that name a tooth or a place the parser does not know: what was understood may be on the wrong tooth */
const PLACE_WORDS = /^(molar(es)?|premolar(es)?|canin[oa]s?|incisiv[oa]s?|cordal|muela|muelas|colmillo|vecin[oa]|lado|otr[oa]|izquierd[oa]|derech[oa]|arriba|abajo|adentro|afuera|molars?|premolars?|canines?|incisors?|wisdom|neighbou?r|left|right|other|upper|lower)$/;

/**
 * The phrase was understood only in part and what is left looks like content (two words or more,
 * or a word that names a tooth or a place): the AI reads it whole before anything is written.
 * Control words (confirmar, deshacer, parar…) never wait for the AI.
 */
export function shouldAskAiFirst({ commands, unknown }: VoiceParse): boolean {
  if (!commands.length || !unknown.length) return false;
  if (commands.some((c) => c.kind === 'confirm' || c.kind === 'discard' || c.kind === 'stop' || c.kind === 'undo' || c.kind === 'redo')) return false;
  return unknown.length >= 2 || unknown.some((w) => PLACE_WORDS.test(w));
}
