import { addDays, endOfMonth, endOfWeek, endOfYear, startOfMonth, startOfToday, startOfWeek, startOfYear, subDays, subMonths, subWeeks, subYears } from 'date-fns';

/**
 * Períodos dichos («hoy», «el mes pasado», «esta semana», «los últimos 30 días», «marzo», «marzo
 * del año pasado», «del 1 al 15», «this month», «last week», «last 7 days»), para los filtros de
 * fecha del panel de control y de los reportes. Devuelve el rango y una clave para decirlo.
 */
export interface SpokenPeriod {
  from: Date;
  to: Date;
  /** Para el mensaje: 'today' | 'yesterday' | 'thisWeek' | … | 'month' | 'lastDays' | 'range'. */
  kind: 'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth' | 'thisYear' | 'lastYear' | 'lastDays' | 'month' | 'range';
  /** lastDays: cuántos; month: el número de mes (1–12). */
  n?: number;
}

const MONTHS: Array<[RegExp, number]> = [
  [/^(?:enero|january|jan)$/, 1], [/^(?:febrero|february|feb)$/, 2], [/^(?:marzo|march|mar)$/, 3], [/^(?:abril|april|apr)$/, 4],
  [/^(?:mayo|may)$/, 5], [/^(?:junio|june|jun)$/, 6], [/^(?:julio|july|jul)$/, 7], [/^(?:agosto|august|aug)$/, 8],
  [/^(?:septiembre|setiembre|september|sep|sept)$/, 9], [/^(?:octubre|october|oct)$/, 10], [/^(?:noviembre|november|nov)$/, 11], [/^(?:diciembre|december|dec)$/, 12],
];
const monthOf = (word: string) => MONTHS.find(([re]) => re.test(word))?.[1] ?? null;
const MONTH_WORD = '(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|january|february|march|april|may|june|july|august|september|october|november|december)';

/** El período nombrado en la frase (normalizada), o null. `today` para probar. */
export function parsePeriod(normalized: string, today: Date = startOfToday()): SpokenPeriod | null {
  const t = normalized;
  const week = { weekStartsOn: 1 as const };
  if (/\b(?:hoy|today|del dia|de hoy)\b/.test(t) && !/\b(?:mes|month|semana|week|ano|year)\b/.test(t)) return { from: today, to: today, kind: 'today' };
  if (/\b(?:ayer|yesterday)\b/.test(t)) { const d = subDays(today, 1); return { from: d, to: d, kind: 'yesterday' }; }
  const last = t.match(/\b(?:(?:los |las )?ultim[oa]s|(?:the )?last|(?:the )?past)\s+(\d+)\s+(dias|days|semanas|weeks|meses|months)\b/);
  if (last) {
    const n = Number(last[1]);
    const unit = last[2];
    const from = /^(?:dias|days)$/.test(unit) ? subDays(today, n - 1) : /^(?:semanas|weeks)$/.test(unit) ? subDays(today, n * 7 - 1) : addDays(subMonths(today, n), 1);
    return { from, to: today, kind: 'lastDays', n: /^(?:dias|days)$/.test(unit) ? n : Math.round((today.getTime() - from.getTime()) / 86400000) + 1 };
  }
  if (/\b(?:esta semana|this week|la semana actual|current week)\b/.test(t)) return { from: startOfWeek(today, week), to: endOfWeek(today, week), kind: 'thisWeek' };
  if (/\b(?:(?:la )?semana pasada|last week|previous week|la semana anterior)\b/.test(t)) { const d = subWeeks(today, 1); return { from: startOfWeek(d, week), to: endOfWeek(d, week), kind: 'lastWeek' }; }
  if (/\b(?:(?:el )?mes pasado|last month|previous month|(?:el )?mes anterior)\b/.test(t)) { const d = subMonths(today, 1); return { from: startOfMonth(d), to: endOfMonth(d), kind: 'lastMonth' }; }
  if (/\b(?:(?:el )?ano pasado|last year|previous year|(?:el )?ano anterior)\b/.test(t) && !new RegExp(MONTH_WORD).test(t)) { const d = subYears(today, 1); return { from: startOfYear(d), to: endOfYear(d), kind: 'lastYear' }; }
  if (/\b(?:este ano|this year|(?:el )?ano actual|en el ano|year to date|ytd)\b/.test(t)) return { from: startOfYear(today), to: endOfYear(today), kind: 'thisYear' };
  if (/\b(?:este mes|this month|(?:el )?mes actual|current month|del mes|en el mes)\b/.test(t)) return { from: startOfMonth(today), to: endOfMonth(today), kind: 'thisMonth' };
  // «del 1 al 15 (de marzo)», «from the 1st to the 15th».
  const range = t.match(new RegExp(`\\b(?:del|desde el|from(?: the)?)\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\s+(?:de\\s+)?${MONTH_WORD})?\\s+(?:al|hasta el|to(?: the)?)\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\s+(?:de\\s+)?${MONTH_WORD})?`));
  if (range) {
    const m2 = range[4] ? monthOf(range[4]) : null;
    const m1 = range[2] ? monthOf(range[2]) : m2;
    const month = (m1 ?? today.getMonth() + 1) - 1;
    const from = new Date(today.getFullYear(), month, Number(range[1]));
    const to = new Date(today.getFullYear(), (m2 ?? m1 ?? today.getMonth() + 1) - 1, Number(range[3]));
    if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()) && from <= to) return { from, to, kind: 'range' };
  }
  // «marzo», «en marzo», «marzo del año pasado», «march 2025».
  const month = t.match(new RegExp(`\\b${MONTH_WORD}\\b(?:\\s+(?:de |del )?(?:(ano pasado|last year)|(\\d{4})))?`));
  if (month) {
    const n = monthOf(month[1])!;
    let year = month[3] ? Number(month[3]) : month[2] ? today.getFullYear() - 1 : today.getFullYear();
    // Un mes que todavía no llegó este año es el del año pasado.
    if (!month[2] && !month[3] && n > today.getMonth() + 1) year -= 1;
    const from = new Date(year, n - 1, 1);
    return { from, to: endOfMonth(from), kind: 'month', n };
  }
  return null;
}
