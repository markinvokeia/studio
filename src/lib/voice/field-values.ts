import { format, parseISO } from 'date-fns';

import { parseTimeAnswer, timeKey } from '@/lib/voice/commands/calendar-parse';
import { normalizeSpeech, parseSpokenDate } from '@/lib/voice/parse';

/**
 * Lo dicho, como lo espera el campo: una hora («las 9 y media» → 09:30), una fecha («el 15 de
 * diciembre» → 2026-12-15, o 15/12/2026 si el campo es de texto con dd/mm/aaaa), un número
 * («veinte» → 20, «mil quinientos» → 1500, «3 coma 5» → 3.5) o un color («rojo» → #ef4444).
 * Si no se entiende, va lo dicho tal cual.
 */

const UNITS: Record<string, number> = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
  once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
  veinte: 20, veintiuno: 21, veintiun: 21, veintiuna: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29,
  treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90,
  cien: 100, ciento: 100, doscientos: 200, doscientas: 200, trescientos: 300, trescientas: 300, cuatrocientos: 400, cuatrocientas: 400, quinientos: 500, quinientas: 500,
  seiscientos: 600, seiscientas: 600, setecientos: 700, setecientas: 700, ochocientos: 800, ochocientas: 800, novecientos: 900, novecientas: 900,
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
  fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

/** «mil quinientos» → 1500; «twenty five» → 25; «1.500» → 1500; «3 coma 5» → 3.5. null si no es un número. */
export function spokenNumber(text: string): number | null {
  // Los dígitos sobre lo dicho tal cual (la normalización saca las comas: «12,5»).
  const plain = text.replace(/%|\bpor\s*(?:ciento|100)\b|\bpercent\b/gi, '').trim();
  const digits = plain.replace(/\s/g, '');
  const t = normalizeSpeech(plain).replace(/\b(?:por ciento|por 100|porciento|percent)\b/g, '').trim();
  if (!t) return null;
  if (/^-?\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(digits)) return Number(digits.replace(/\./g, '').replace(',', '.'));
  if (/^-?\d+(?:[.,]\d+)?$/.test(digits)) return Number(digits.replace(',', '.'));
  const decimal = t.match(/^(.+?)\s+(?:coma|punto|point)\s+(.+)$/);
  if (decimal) {
    const a = spokenNumber(decimal[1]);
    const b = decimal[2].replace(/\s/g, '');
    const bn = /^\d+$/.test(b) ? b : String(spokenNumber(decimal[2]) ?? '');
    return a !== null && bn ? Number(`${a}.${bn}`) : null;
  }
  let total = 0;
  let current = 0;
  let any = false;
  for (const word of t.split(' ')) {
    if (word === 'y' || word === 'and') continue;
    if (/^\d+$/.test(word)) { current += Number(word); any = true; continue; }
    if (word === 'mil' || word === 'thousand') { total += (current || 1) * 1000; current = 0; any = true; continue; }
    if (word === 'millon' || word === 'millones' || word === 'million') { total += (current || 1) * 1_000_000; current = 0; any = true; continue; }
    if (word === 'hundred') { current = (current || 1) * 100; any = true; continue; }
    if (word in UNITS) { current += UNITS[word]; any = true; continue; }
    return null;
  }
  return any ? total + current : null;
}

const COLORS: Record<string, string> = {
  rojo: '#ef4444', roja: '#ef4444', red: '#ef4444', azul: '#3b82f6', blue: '#3b82f6', celeste: '#38bdf8', 'light blue': '#38bdf8', 'sky blue': '#38bdf8',
  verde: '#22c55e', green: '#22c55e', amarillo: '#eab308', yellow: '#eab308', naranja: '#f97316', anaranjado: '#f97316', orange: '#f97316',
  violeta: '#8b5cf6', morado: '#8b5cf6', lila: '#a78bfa', purple: '#8b5cf6', violet: '#8b5cf6', rosa: '#ec4899', rosado: '#ec4899', pink: '#ec4899',
  negro: '#000000', black: '#000000', blanco: '#ffffff', white: '#ffffff', gris: '#6b7280', gray: '#6b7280', grey: '#6b7280',
  marron: '#92400e', cafe: '#92400e', brown: '#92400e', turquesa: '#14b8a6', teal: '#14b8a6', fucsia: '#d946ef', magenta: '#d946ef', dorado: '#ca8a04', gold: '#ca8a04',
};

/** «rojo» → #ef4444; «#3366ff» o «3366ff» → #3366ff. null si no es un color. */
export function spokenColor(text: string): string | null {
  const t = normalizeSpeech(text).replace(/\b(?:color|el|la|the|en|de)\b/g, ' ').replace(/\s+/g, ' ').trim();
  const hex = text.replace(/\s/g, '').match(/^#?([0-9a-f]{6}|[0-9a-f]{3})$/i);
  if (hex) return `#${hex[1].toLowerCase()}`;
  if (COLORS[t]) return COLORS[t];
  // «azul oscuro», «verde claro»: el color base.
  const base = t.split(' ').find((w) => COLORS[w]);
  return base ? COLORS[base] : null;
}

/** Lo que va en el campo para lo dicho. */
export function valueForField(el: HTMLElement | null | undefined, spoken: string): string {
  const input = el as HTMLInputElement | null | undefined;
  const type = (input?.type ?? '').toLowerCase();
  const placeholder = normalizeSpeech(input?.getAttribute?.('placeholder') ?? '');
  const n = normalizeSpeech(spoken);
  if (type === 'time') {
    const time = parseTimeAnswer(n);
    return time ? timeKey(time) : spoken;
  }
  if (type === 'date' || /dd\s*\/?\s*mm/.test(placeholder)) {
    const past = /\b(?:pasad[oa]|anterior|ayer|hace|last|ago|yesterday)\b/.test(n) ? 'past' : 'future';
    const iso = parseSpokenDate(n, past);
    if (!iso) return spoken;
    return type === 'date' ? iso : format(parseISO(iso), 'dd/MM/yyyy');
  }
  if (type === 'color') return spokenColor(spoken) ?? spoken;
  if (type === 'number' || input?.getAttribute?.('inputmode') === 'numeric' || input?.getAttribute?.('inputmode') === 'decimal') {
    // «5 días», «400 mg», «2 comprimidos»: el número, sin la unidad dicha después.
    let num = spokenNumber(spoken);
    const words = normalizeSpeech(spoken).split(' ');
    for (let n = words.length - 1; num === null && n >= 1; n--) num = spokenNumber(words.slice(0, n).join(' '));
    return num === null ? spoken : String(num);
  }
  return spoken;
}
