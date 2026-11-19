import { addDays, addMonths, format, getDay, startOfToday, subDays, subMonths } from 'date-fns';

/**
 * Interpretación local de lo dicho: sin IA, al instante. Cubre lo que se dice siempre igual
 * (números, sí/no, "ayer", "el lunes", "el 14", "la primera"). Todo trabaja sobre el texto
 * normalizado: minúsculas, sin tildes ni puntuación y con los números escritos como dígitos.
 */

/** Minúsculas, sin tildes ni puntuación ("¿Confirmá?" → "confirma"), números en dígitos. */
export function normalizeSpeech(text: string): string {
  const plain = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    // "45." / "#45" / "14/11" quedan; el resto de la puntuación separa palabras.
    .replace(/[^a-z0-9#/\s-]/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return wordsToDigits(plain);
}

// ── Números dichos en palabras ────────────────────────────────────────────────

const UNITS: Record<string, number> = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17,
  dieciocho: 18, diecinueve: 19, veinte: 20, veintiun: 21, veintiuno: 21, veintiuna: 21, veintidos: 22,
  veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28,
  veintinueve: 29,
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = {
  treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const HUNDREDS: Record<string, number> = {
  cien: 100, ciento: 100, doscientos: 200, doscientas: 200, trescientos: 300, trescientas: 300,
  cuatrocientos: 400, cuatrocientas: 400, quinientos: 500, quinientas: 500, seiscientos: 600,
  seiscientas: 600, setecientos: 700, setecientas: 700, ochocientos: 800, ochocientas: 800,
  novecientos: 900, novecientas: 900,
};
/** "uno"/"una" sueltos son artículos o pronombres ("una corona", "la una"): solo cuentan dentro de un número. */
const ARTICLE_LIKE = new Set(['un', 'una', 'uno', 'one']);

function wordsToDigits(text: string): string {
  const words = text.split(' ');
  const out: string[] = [];
  let i = 0;
  while (i < words.length) {
    let value = 0;
    let used = 0;
    let j = i;
    // [centenas] [decenas [y unidades] | unidades]  — también "one hundred twenty three".
    if (HUNDREDS[words[j]] !== undefined) { value += HUNDREDS[words[j]]; j++; used++; }
    else if (UNITS[words[j]] !== undefined && words[j + 1] === 'hundred') { value += UNITS[words[j]] * 100; j += 2; used += 2; }
    if (TENS[words[j]] !== undefined) {
      value += TENS[words[j]]; j++; used++;
      if (words[j] === 'y' && UNITS[words[j + 1]] !== undefined && UNITS[words[j + 1]] < 10) { value += UNITS[words[j + 1]]; j += 2; used += 2; }
      else if (UNITS[words[j]] !== undefined && UNITS[words[j]] < 10) { value += UNITS[words[j]]; j++; used++; }
    } else if (UNITS[words[j]] !== undefined && !(used === 0 && ARTICLE_LIKE.has(words[j]))) {
      value += UNITS[words[j]]; j++; used++;
    }
    if (used > 0) {
      out.push(String(value));
      i = j;
    } else {
      out.push(words[i]);
      i++;
    }
  }
  return out.join(' ');
}

// ── Sí / no ───────────────────────────────────────────────────────────────────

const YES = /^(si|sii+|dale|ok|okay|okey|vale|claro|correcto|exacto|perfecto|confirmo|confirma|confirmar|confirmalo|confirmala|hacelo|hazlo|adelante|de una|yes|yeah|yep|sure|confirm|go ahead|do it|correct|right)\b/;
const NO = /^(no|nop|nope|cancela|cancelar|cancelalo|cancelala|cancel|para|pare|deja|dejalo|olvidalo|olvidate|mejor no|ni loco|stop|never mind|nevermind)\b/;

/** "sí, dale" → 'yes'; "no, cancelá" → 'no'; otra cosa → null. */
export function parseYesNo(normalized: string): 'yes' | 'no' | null {
  const text = normalized.replace(/^(eh|em|mm+|bueno|y|este|pues|well|uh|um)\s+/, '');
  if (YES.test(text)) return 'yes';
  if (NO.test(text)) return 'no';
  return null;
}

// ── Elegir una opción ("el dos", "la primera", "Dental Sur") ─────────────────

const ORDINALS: Record<string, number> = {
  primero: 1, primera: 1, primer: 1, segundo: 2, segunda: 2, tercero: 3, tercera: 3, tercer: 3,
  cuarto: 4, cuarta: 4, quinto: 5, quinta: 5, first: 1, second: 2, third: 3, fourth: 4, fifth: 5,
  ultimo: -1, ultima: -1, last: -1,
};

/**
 * Índice (0..count-1) de la opción elegida por número u ordinal, o por nombre si se pasan
 * `labels`. null si no se reconoce.
 */
export function parseChoice(normalized: string, count: number, labels: string[] = []): number | null {
  const words = normalized.split(' ');
  for (const word of words) {
    const ordinal = ORDINALS[word];
    if (ordinal !== undefined) return ordinal === -1 ? count - 1 : ordinal <= count ? ordinal - 1 : null;
  }
  // "el 2", "la opción 2", "número 2" (no un número largo, que sería parte de un nombre).
  const numeric = normalized.match(/(?:^|\b(?:el|la|opcion|numero|number|option)\s+)(\d{1,2})\b/) ?? normalized.match(/^(\d{1,2})$/);
  if (numeric) {
    const n = Number(numeric[1]);
    if (n >= 1 && n <= count) return n - 1;
  }
  if (normalized === 'uno' || normalized === 'una' || normalized === 'el uno' || normalized === 'la una') return count >= 1 ? 0 : null;
  if (labels.length) return bestNameMatch(normalized, labels);
  return null;
}

/**
 * La etiqueta que mejor coincide con lo dicho: todas las palabras de una dentro del texto (la
 * más larga gana) o, si no, la que comparte más palabras significativas. null si ninguna.
 */
export function bestNameMatch(normalizedText: string, labels: string[]): number | null {
  return bestNameMatchScored(normalizedText, labels)?.index ?? null;
}

/**
 * Lo mismo que bestNameMatch, con el puntaje: > 100 = el nombre entero está en lo dicho; si no,
 * hasta 50 + palabras según la parte del nombre que se dijo. Sirve para comparar entre listas
 * (¿"Pérez" es un doctor o una agenda?).
 */
export function bestNameMatchScored(normalizedText: string, labels: string[]): { index: number; score: number } | null {
  const textWords = new Set(normalizedText.split(' ').filter((w) => w.length > 2));
  let best: { index: number; score: number } | null = null;
  labels.forEach((label, index) => {
    const norm = normalizeSpeech(label);
    if (!norm) return;
    let score = 0;
    if (` ${normalizedText} `.includes(` ${norm} `)) score = 100 + norm.length;
    else {
      const words = norm.split(' ').filter((w) => w.length > 2);
      const shared = words.filter((w) => textWords.has(w) || [...textWords].some((t) => t.length > 4 && (t.startsWith(w) || w.startsWith(t))));
      if (shared.length) score = (shared.length / words.length) * 50 + shared.length;
    }
    if (score > 0 && (!best || score > best.score)) best = { index, score };
  });
  return best as { index: number; score: number } | null;
}

// ── Fechas ────────────────────────────────────────────────────────────────────

export const dateKey = (date: Date) => format(date, 'yyyy-MM-dd');

const WEEKDAYS: Record<string, number> = {
  domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6,
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
};
const MONTHS: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9,
  setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9,
  october: 10, november: 11, december: 12,
};

/** Día `day` (y mes) más cercano hacia atrás (`past`) o hacia adelante desde hoy. */
function dayOfMonth(day: number, month: number | null, today: Date, past: boolean): Date | null {
  if (day < 1 || day > 31) return null;
  const build = (y: number, m: number) => {
    const d = new Date(y, m, day);
    return d.getDate() === day ? d : null;
  };
  if (month) {
    let d = build(today.getFullYear(), month - 1);
    if (d && past && d > today) d = build(today.getFullYear() - 1, month - 1);
    if (d && !past && d < today) d = build(today.getFullYear() + 1, month - 1);
    return d;
  }
  let d = build(today.getFullYear(), today.getMonth());
  if (past && (!d || d > today)) {
    const prev = subMonths(today, 1);
    d = build(prev.getFullYear(), prev.getMonth());
  }
  if (!past && (!d || d < today)) {
    const next = addMonths(today, 1);
    d = build(next.getFullYear(), next.getMonth());
  }
  return d;
}

/**
 * Un día dicho de forma relativa, hacia atrás ("se envió ayer") o hacia adelante ("entrega el
 * viernes"). Devuelve 'YYYY-MM-DD' o null si no hay ninguna fecha en el texto.
 */
export function parseSpokenDate(normalized: string, direction: 'past' | 'future', today: Date = startOfToday()): string | null {
  const t = ` ${normalized} `;
  if (direction === 'past') {
    if (/ (anteayer|antier|antes de ayer|day before yesterday) /.test(t)) return dateKey(subDays(today, 2));
    if (/ (ayer|yesterday) /.test(t)) return dateKey(subDays(today, 1));
    const ago = t.match(/ hace (\d{1,3}) (dia|dias) /) ?? t.match(/ (\d{1,3}) days? ago /);
    if (ago) return dateKey(subDays(today, Number(ago[1])));
    if (/ (hoy|today|recien|ahora|now) /.test(t)) return dateKey(today);
  } else {
    if (/ (pasado manana|day after tomorrow) /.test(t)) return dateKey(addDays(today, 2));
    if (/ (manana|tomorrow) /.test(t)) return dateKey(addDays(today, 1));
    const weeks = t.match(/ en (\d{1,2}) semanas? /) ?? t.match(/ in (\d{1,2}) weeks? /);
    if (weeks) return dateKey(addDays(today, Number(weeks[1]) * 7));
    const days = t.match(/ en (\d{1,3}) dias? /) ?? t.match(/ in (\d{1,3}) days? /);
    if (days) return dateKey(addDays(today, Number(days[1])));
    if (/ (en una semana|in a week|in one week) /.test(t)) return dateKey(addDays(today, 7));
    if (/ (hoy|today) /.test(t)) return dateKey(today);
  }
  for (const [name, dow] of Object.entries(WEEKDAYS)) {
    if (!t.includes(` ${name} `)) continue;
    const diff = getDay(today) - dow;
    // Hacia atrás: el último que pasó (el mismo día de la semana = hace una semana); hacia adelante, el próximo.
    if (direction === 'past') return dateKey(subDays(today, diff > 0 ? diff : diff + 7));
    return dateKey(addDays(today, diff < 0 ? -diff : 7 - diff));
  }
  // "el 14", "el 14 de noviembre", "14/11", "november 14".
  const slash = t.match(/ (\d{1,2})\/(\d{1,2}) /);
  if (slash) {
    const d = dayOfMonth(Number(slash[1]), Number(slash[2]), today, direction === 'past');
    if (d) return dateKey(d);
  }
  const named = t.match(/ (?:el |the )?(\d{1,2}) (?:de )?([a-z]+) /);
  if (named && MONTHS[named[2]]) {
    const d = dayOfMonth(Number(named[1]), MONTHS[named[2]], today, direction === 'past');
    if (d) return dateKey(d);
  }
  const monthFirst = t.match(/ ([a-z]+) (\d{1,2}) /);
  if (monthFirst && MONTHS[monthFirst[1]]) {
    const d = dayOfMonth(Number(monthFirst[2]), MONTHS[monthFirst[1]], today, direction === 'past');
    if (d) return dateKey(d);
  }
  const plain = t.match(/ (?:el|the) (\d{1,2})(?:st|nd|rd|th)? /);
  if (plain) {
    const d = dayOfMonth(Number(plain[1]), null, today, direction === 'past');
    if (d) return dateKey(d);
  }
  return null;
}
