import { addDays, addMonths, addWeeks, getDay, startOfToday, subDays, subMonths, subWeeks } from 'date-fns';

import { hasAppointmentFocus } from '@/lib/voice/focus';
import { dateKey, normalizeSpeech } from '@/lib/voice/parse';

import type { AppointmentStatus, CalendarVoiceView, CancellationReason } from '@/lib/types';

/**
 * Intérprete local del calendario por voz: sin IA, sobre el texto normalizado (normalizeSpeech:
 * minúsculas, sin tildes ni puntuación, números en dígitos). Solo entiende la forma de la frase;
 * qué doctor, agenda, servicio o cita es se resuelve después con lo que hay en pantalla.
 *
 * Orden de lectura de una frase: primero la hora ("a las 10 de la mañana", que si no se leería
 * como "mañana"), después la parte del día ("a la tarde") y por último la fecha.
 */

export interface SpokenTime {
  hour: number;
  minute: number;
}

export type DayPeriod = 'morning' | 'afternoon';

/** Cancelaciones que se pueden pedir por voz ('other' necesita una nota escrita). */
export type VoiceCancellationReason = Exclude<CancellationReason, 'other' | 'reschedule'>;
export const VOICE_CANCELLATION_REASONS: VoiceCancellationReason[] = ['in_time', 'late', 'no_notice', 'by_doctor', 'by_clinic'];

const pad = (n: number) => String(n).padStart(2, '0');
export const timeKey = (t: SpokenTime) => `${pad(t.hour)}:${pad(t.minute)}`;

export function parseTimeKey(value: string | null | undefined): SpokenTime | null {
  const m = typeof value === 'string' ? value.match(/^(\d{1,2}):(\d{2})$/) : null;
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  return hour <= 23 && minute <= 59 ? { hour, minute } : null;
}

/** Saca el tramo [start, end) y deja espacios simples. */
function cut(text: string, start: number, end: number): string {
  return `${text.slice(0, start)} ${text.slice(end)}`.replace(/\s+/g, ' ').trim();
}

/** Busca `re` en ` text ` (con espacios a los lados) y devuelve el match y el resto sin él. */
function take(text: string, re: RegExp): { m: RegExpMatchArray; rest: string } | null {
  const padded = ` ${text} `;
  const m = padded.match(re);
  if (!m || m.index === undefined) return null;
  return { m, rest: cut(padded, m.index, m.index + m[0].length) };
}

// ── Hora ──────────────────────────────────────────────────────────────────────

const QUALIFIER = '(?<q>de la manana|a la manana|de la madrugada|de la tarde|a la tarde|de la noche|a la noche|am|pm|a m|p m|hs|horas|hrs|o clock)';
const FRACTION = '(?<frac>y media|y cuarto|menos cuarto|y (?<fm>\\d{1,2})|en punto)';
const TIME_PATTERNS: RegExp[] = [
  // "a las 10", "a las 10 30", "a las 10 y media", "a la una", "desde las 3 de la tarde", "at 10 30 am"
  new RegExp(`\\s(?:a las|a la|desde las|desde la|para las|para la|tipo|las|at|around|by)\\s(?<h>\\d{1,2}|una)(?:\\s(?<m>\\d{2}))?(?:\\s${FRACTION})?(?:\\s${QUALIFIER})?(?=\\s)`),
  // "10 30 hs", "3 pm", "10 de la mañana"
  new RegExp(`\\s(?<h>\\d{1,2})(?:\\s(?<m>\\d{2}))?(?:\\s${FRACTION})?\\s${QUALIFIER}(?=\\s)`),
];

/**
 * La hora dicha y el resto de la frase sin ella. Sin "de la tarde"/"pm", de 1 a 6 se toma como
 * de la tarde (una clínica no atiende a las 3 de la madrugada).
 */
export function extractSpokenTime(text: string): { time: SpokenTime; rest: string } | null {
  const noon = take(text, /\s(?:al |a el |a )?(?:mediodia|noon)(?=\s)/);
  if (noon) return { time: { hour: 12, minute: 0 }, rest: noon.rest };
  for (const re of TIME_PATTERNS) {
    const found = take(text, re);
    if (!found) continue;
    const g = found.m.groups ?? {};
    let hour = g.h === 'una' ? 1 : Number(g.h);
    let minute = g.m ? Number(g.m) : 0;
    if (g.frac === 'y media') minute = 30;
    else if (g.frac === 'y cuarto') minute = 15;
    else if (g.frac === 'menos cuarto') { hour -= 1; minute = 45; }
    else if (g.fm) minute = Number(g.fm);
    const q = g.q ?? '';
    if (/tarde|noche|pm|p m/.test(q)) { if (hour < 12) hour += 12; }
    else if (/manana|madrugada|am|a m/.test(q)) { if (hour === 12) hour = 0; }
    else if (hour >= 1 && hour <= 6) hour += 12;
    if (!Number.isInteger(hour) || hour < 0 || hour > 23 || minute < 0 || minute > 59) continue;
    return { time: { hour, minute }, rest: found.rest };
  }
  return null;
}

/** Una respuesta que es solo una hora: "a las 10", "10 y media", "las 3", "diez". */
export function parseTimeAnswer(normalized: string): SpokenTime | null {
  const found = extractSpokenTime(normalized) ?? extractSpokenTime(`a las ${normalized.replace(/^(a las|las|a la)\s+/, '')}`);
  return found ? found.time : null;
}

// ── Parte del día ─────────────────────────────────────────────────────────────

export function extractPeriod(text: string): { period: DayPeriod; rest: string } | null {
  const found = take(text, new RegExp(String.raw`\s(?:(?:a|por|en|durante|de) la (?<es>manana|tarde)(?: del)?|de (?<es2>tarde)|(?:in the|this) (?<en>morning|afternoon))(?=\s)`));
  if (!found) return null;
  const g = found.m.groups ?? {};
  const word = g.es ?? g.es2 ?? g.en;
  return { period: word === 'manana' || word === 'morning' ? 'morning' : 'afternoon', rest: found.rest };
}

// ── Fecha ─────────────────────────────────────────────────────────────────────

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
const WEEKDAY_ALT = Object.keys(WEEKDAYS).join('|');
const MONTH_ALT = Object.keys(MONTHS).join('|');

/**
 * 'nearest': el más cercano a hoy, hacia atrás o adelante (para ir a ver un día: "el 14").
 * 'future': hoy o después (para dar o mover una cita: "el 14" ya pasado es el del mes que viene).
 */
export type DatePreference = 'nearest' | 'future';

export interface SpokenDate {
  date: string;
  /** Se habló de una semana o un mes entero ("la semana que viene", "diciembre"). */
  unit?: 'week' | 'month';
  rest: string;
}

function build(year: number, month0: number, day: number): Date | null {
  const d = new Date(year, month0, day);
  return d.getMonth() === ((month0 % 12) + 12) % 12 && d.getDate() === day ? d : null;
}

function resolveDayMonth(day: number, month: number | null, year: number | null, today: Date, prefer: DatePreference): Date | null {
  if (day < 1 || day > 31) return null;
  if (month && year) return build(year, month - 1, day);
  if (month) {
    const candidates = [-1, 0, 1].map((dy) => build(today.getFullYear() + dy, month - 1, day)).filter((d): d is Date => !!d);
    return pick(candidates, today, prefer);
  }
  const candidates = [-1, 0, 1].map((dm) => {
    const base = addMonths(new Date(today.getFullYear(), today.getMonth(), 1), dm);
    return build(base.getFullYear(), base.getMonth(), day);
  }).filter((d): d is Date => !!d);
  return pick(candidates, today, prefer);
}

function pick(candidates: Date[], today: Date, prefer: DatePreference): Date | null {
  const pool = prefer === 'future' ? candidates.filter((d) => d >= today) : candidates;
  if (!pool.length) return null;
  return pool.reduce((best, d) => (Math.abs(d.getTime() - today.getTime()) < Math.abs(best.getTime() - today.getTime()) ? d : best));
}

/** La fecha dicha y el resto de la frase sin ella. null si no se nombró ningún día. */
export function extractSpokenDate(text: string, prefer: DatePreference = 'nearest', today: Date = startOfToday()): SpokenDate | null {
  const at = (re: RegExp) => take(text, re);
  const done = (date: Date | null, rest: string, unit?: SpokenDate['unit']): SpokenDate | null => (date ? { date: dateKey(date), rest, unit } : null);

  // Semana / mes enteros.
  let f = at(/\s(?:la )?(?:semana (?:que viene|proxima|siguiente)|proxima semana|next week)(?=\s)/);
  if (f) return done(addWeeks(today, 1), f.rest, 'week');
  f = at(/\s(?:la )?(?:semana (?:pasada|anterior)|last week)(?=\s)/);
  if (f) return done(subWeeks(today, 1), f.rest, 'week');
  f = at(/\s(?:esta semana|this week)(?=\s)/);
  if (f) return done(today, f.rest, 'week');
  f = at(/\s(?:el )?(?:mes (?:que viene|proximo|siguiente)|proximo mes|next month)(?=\s)/);
  if (f) return done(addMonths(today, 1), f.rest, 'month');
  f = at(/\s(?:el )?(?:mes (?:pasado|anterior)|last month)(?=\s)/);
  if (f) return done(subMonths(today, 1), f.rest, 'month');
  f = at(/\s(?:este mes|this month)(?=\s)/);
  if (f) return done(today, f.rest, 'month');

  // Fechas con número: "14/11", "el 14 de noviembre", "november 14", "el jueves 21", "el 21".
  const weekdayBefore = `(?:(?:el |este |next |this )?(?:${WEEKDAY_ALT}) )?`;
  f = at(new RegExp(`\\s${weekdayBefore}(?<d>\\d{1,2})\\/(?<mo>\\d{1,2})(?:\\/(?<y>\\d{2,4}))?(?=\\s)`));
  if (f) {
    const g = f.m.groups!;
    const y = g.y ? (g.y.length === 2 ? 2000 + Number(g.y) : Number(g.y)) : null;
    return done(resolveDayMonth(Number(g.d), Number(g.mo), y, today, prefer), f.rest);
  }
  f = at(new RegExp(`\\s(?:el |the )?${weekdayBefore}(?<d>\\d{1,2})(?:st|nd|rd|th)? (?:de |of )?(?<mo>${MONTH_ALT})(?: (?:de |del )?(?<y>\\d{4}))?(?=\\s)`));
  if (f) {
    const g = f.m.groups!;
    return done(resolveDayMonth(Number(g.d), MONTHS[g.mo], g.y ? Number(g.y) : null, today, prefer), f.rest);
  }
  f = at(new RegExp(`\\s(?<mo>${MONTH_ALT}) (?<d>\\d{1,2})(?:st|nd|rd|th)?(?: (?<y>\\d{4}))?(?=\\s)`));
  if (f) {
    const g = f.m.groups!;
    return done(resolveDayMonth(Number(g.d), MONTHS[g.mo], g.y ? Number(g.y) : null, today, prefer), f.rest);
  }
  f = at(new RegExp(`\\s(?:(?:el|the) ${weekdayBefore}|(?:el |este |next |this )?(?:${WEEKDAY_ALT}) )(?<d>\\d{1,2})(?:st|nd|rd|th)?(?=\\s)`));
  if (f) return done(resolveDayMonth(Number(f.m.groups!.d), null, null, today, prefer), f.rest);

  // Palabras: hoy, mañana, pasado mañana, ayer, en 3 días, hace 2 días.
  f = at(/\s(?:pasado manana|day after tomorrow)(?=\s)/);
  if (f) return done(addDays(today, 2), f.rest);
  f = at(/\s(?:anteayer|antier|antes de ayer|day before yesterday)(?=\s)/);
  if (f) return done(subDays(today, 2), f.rest);
  f = at(/\s(?:manana|tomorrow)(?=\s)/);
  if (f) return done(addDays(today, 1), f.rest);
  f = at(/\s(?:hoy|today)(?=\s)/);
  if (f) return done(today, f.rest);
  f = at(/\s(?:ayer|yesterday)(?=\s)/);
  if (f) return done(subDays(today, 1), f.rest);
  f = at(new RegExp(String.raw`\s(?:en|dentro de|in) (?<n>\d{1,3}) (?<u>dias?|semanas?|days?|weeks?)(?=\s)`));
  if (f) {
    const n = Number(f.m.groups!.n);
    return done(/^(semana|week)/.test(f.m.groups!.u) ? addWeeks(today, n) : addDays(today, n), f.rest);
  }
  f = at(new RegExp(String.raw`\s(?:hace (?<a>\d{1,3}) dias?|(?<b>\d{1,3}) days? ago)(?=\s)`));
  if (f) return done(subDays(today, Number(f.m.groups!.a ?? f.m.groups!.b)), f.rest);

  // Día de la semana: "el jueves" (hoy si es jueves), "el jueves que viene", "el lunes pasado".
  f = at(new RegExp(`\\s(?:el |este |(?<pre>el proximo|proximo|next|last|this) )?(?<w>${WEEKDAY_ALT})(?: (?<post>que viene|proximo|siguiente|pasado|anterior))?(?=\\s)`));
  if (f) {
    const g = f.m.groups!;
    const dow = WEEKDAYS[g.w];
    const diff = (dow - getDay(today) + 7) % 7;
    if (g.pre === 'last' || g.post === 'pasado' || g.post === 'anterior') return done(subDays(today, diff === 0 ? 7 : 7 - diff), f.rest);
    const strictlyNext = !!g.post || (g.pre && g.pre !== 'this');
    return done(addDays(today, strictlyNext && diff === 0 ? 7 : diff), f.rest);
  }

  // Un mes solo: "diciembre" → el 1 (o hoy si es este mes).
  f = at(new RegExp(`\\s(?:en |a |de )?(?<mo>${MONTH_ALT})(?: (?:de |del )?(?<y>\\d{4}))?(?=\\s)`));
  if (f) {
    const g = f.m.groups!;
    const month = MONTHS[g.mo];
    let year = g.y ? Number(g.y) : today.getFullYear();
    if (!g.y && prefer === 'future' && month - 1 < today.getMonth()) year += 1;
    const sameMonth = year === today.getFullYear() && month - 1 === today.getMonth();
    return done(sameMonth ? today : new Date(year, month - 1, 1), f.rest, 'month');
  }
  return null;
}

// ── Relleno ──────────────────────────────────────────────────────────────────

const FILLER = new Set([
  'el', 'la', 'los', 'las', 'lo', 'le', 'les', 'un', 'una', 'de', 'del', 'a', 'al', 'y', 'e', 'que', 'en', 'para', 'por', 'con',
  'ya', 'me', 'mi', 'su', 'se', 'te', 'favor', 'porfa', 'porfavor', 'please', 'the', 'of', 'to', 'for', 'and', 'is', 'on', 'at', 'with', 'by',
  'cita', 'citas', 'turno', 'turnos', 'consulta', 'paciente', 'pacientes', 'appointment', 'appointments', 'patient',
]);

/** Lo que queda de la frase sin relleno ("la cita de" → ""). */
export function stripFiller(text: string): string {
  return text.split(' ').filter((w) => w && !FILLER.has(w)).join(' ');
}

/** Un nombre de persona o lugar dicho: al menos una palabra de 2+ letras y nada de números. */
function asName(text: string): string | null {
  const name = stripFiller(text).replace(/\b\d+\b/g, ' ').replace(/\s+/g, ' ').trim();
  return /[a-z]{2,}/.test(name) ? name : null;
}

// ── Ir a una fecha / avanzar ──────────────────────────────────────────────────

export type CalendarNavParsed =
  | { kind: 'date'; date: string; unit?: 'week' | 'month' }
  | { kind: 'step'; dir: 1 | -1; unit?: 'day' | 'week' | 'month' };

const NAV_VERB = /^(?:anda|andate|ve|vete|ir|vamos|volve|vuelve|volvamos|salta|saltar|llevame|lleva|mostrame|muestrame|mostra|muestra|abri|abre|pasa|pasate|go back|back|go|jump|show me|show|open|take me|navigate|what about|how about|and)(?: (?:a|al|hasta|para|to|me))?(?=\s|$)/;
const STEP_UNIT: Record<string, 'day' | 'week' | 'month'> = { dia: 'day', semana: 'week', mes: 'month', day: 'day', week: 'week', month: 'month' };

export function parseCalendarNavigate(normalized: string, today: Date = startOfToday()): CalendarNavParsed | null {
  const step = normalized.replace(/^(?:volve|vuelve|anda|segui|sigue|move|go)\s(?=(?:para|hacia) )/, '').replace(/^move (?=ahead|forward|back)/, '').replace(/ one$/, '').replace(/^(?:el |la )(?=proxim)/, '').match(new RegExp(String.raw`^(?:(?:anda|ir|pasa|ve|go)(?: a la| al| a| to)? )?(?:(?:la |el )?(?<u1>dia|semana|mes|day|week|month|pagina|page) )?(?:(?:para|hacia|mas) )?(?<w>siguiente|adelante|avanza|proximo|proxima|next|forward|ahead|anterior|atras|retrocede|previous|back|backward)(?: (?<u2>dia|semana|mes|day|week|month|pagina|page))?$`));
  if (step?.groups) {
    const forward = /siguiente|adelante|avanza|proxim|next|forward|ahead/.test(step.groups.w);
    return { kind: 'step', dir: forward ? 1 : -1, unit: STEP_UNIT[step.groups.u1 ?? step.groups.u2 ?? ''] };
  }
  const verb = normalized.match(NAV_VERB);
  // «el día de hoy», «el día de mañana»: es el día nombrado.
  const body = (verb ? normalized.slice(verb[0].length).trim() : normalized).replace(/^(?:el )?dia de (?=hoy|manana|ayer)/, '');
  const found = extractSpokenDate(body, 'nearest', today);
  if (!found) return null;
  // Sin verbo, la frase tiene que ser solo la fecha ("mañana", "el jueves"): si no, es otra cosa.
  if (!verb && stripFiller(found.rest)) return null;
  if (verb && stripFiller(found.rest).split(' ').filter(Boolean).length > 2) return null;
  return { kind: 'date', date: found.date, unit: found.unit };
}

// ── Vista ─────────────────────────────────────────────────────────────────────

export interface CalendarViewParsed {
  view: CalendarVoiceView;
  /** "mostrame la semana que viene": además, ir a esa fecha. */
  date?: string;
}

const VIEW_TRIGGER = /(?:^|\s)(?:vista|ver|modo|view|mode)(?=\s|$)|^(?:cambia|cambiar|cambiame|pone|pon|poneme|ponme|pasa|pasame|mostra|mostrame|muestra|muestrame|switch|show)(?=\s|$)/;

export function parseCalendarView(normalized: string, today: Date = startOfToday()): CalendarViewParsed | null {
  const bare = normalized.match(/^(?:la |el )?(dia|diaria|semana|semanal|mes|mensual|ano|anual|agenda|lista|day|week|month|year|daily|weekly|monthly|agenda view)$/);
  if (!VIEW_TRIGGER.test(normalized) && !bare) return null;
  let view: CalendarVoiceView | null = null;
  const days = normalized.match(/\b([2-6]) (?:dias|days|day)\b/);
  if (days && (/(?:vista|ver|view|modo|mode) (?:de |por |en )?[2-6] (?:dias|days)/.test(normalized) || /\b[2-6] days? (?:view|mode)\b/.test(normalized))) view = `${days[1]}-day` as CalendarVoiceView;
  else if (/\b(agenda|lista|listado|schedule|list)\b/.test(normalized)) view = 'schedule';
  else if (/\b(ano|anual|year|yearly)\b/.test(normalized)) view = 'year';
  else if (/\b(mes|mensual|month|monthly)\b/.test(normalized)) view = 'month';
  else if (/\b(semana|semanal|week|weekly)\b/.test(normalized)) view = 'week';
  else if (/\b(dia|diaria|diario|day|daily)\b/.test(normalized)) view = 'day';
  if (!view) return null;
  const withoutViewWords = normalized.replace(/\b(vista|ver|modo|view|mode|diaria|diario|semanal|mensual|anual|daily|weekly|monthly)\b/g, ' ').replace(/\s+/g, ' ').trim();
  const found = extractSpokenDate(withoutViewWords, 'nearest', today);
  return found ? { view, date: found.date } : { view };
}

// ── Filtros, agrupar, buscar y huecos ─────────────────────────────────────────

export type CalendarFilterTarget = 'doctor' | 'calendar' | 'sede' | 'any';

export interface CalendarFilterParsed {
  op: 'only' | 'add' | 'remove' | 'all';
  target: CalendarFilterTarget;
  /** Nombre dicho (se busca en doctores, agendas o sedes); null con op 'all'. */
  name: string | null;
  /** Ya resueltos (los trae la IA). */
  ids?: string[];
}

const TARGET_WORDS: Array<[RegExp, CalendarFilterTarget]> = [
  [/\b(doctor(es)?|doctora(s)?|dr|dra|profesional(es)?|odontolog[oa]s?|medic[oa]s?|doctors?)\b/, 'doctor'],
  [/\b(sedes?|sucursal(es)?|clinicas?|locales?|branch(es)?|sites?)\b/, 'sede'],
  [/\b(agendas?|consultorios?|sillon(es)?|box(es)?|gabinetes?|calendarios?|calendars?|rooms?)\b/, 'calendar'],
];
const TARGET_STRIP = /\b(doctor(es)?|doctora(s)?|dr|dra|profesional(es)?|odontolog[oa]s?|medic[oa]s?|doctors?|sedes?|sucursal(es)?|branch(es)?|sites?|agendas?|calendarios?|calendars?)\b/g;

function targetOf(text: string): CalendarFilterTarget {
  return TARGET_WORDS.find(([re]) => re.test(text))?.[1] ?? 'any';
}

export function parseCalendarFilter(normalized: string): CalendarFilterParsed | null {
  // «pasá al sillón 2», «cambiá a la agenda ortodoncia», «ver el consultorio 3»: mostrar esa agenda.
  const switchTo = normalized.match(/^(?:pasa(?:te|me)?|cambia(?:te|me)?|ve|ver|anda|mostra(?:me)?|muestra(?:me)?|abri(?:me)?|switch|go|show(?: me)?|open)\s(?:a |al |a la |para |to |de )?(?:la |el |the )?(?=(?:agenda|consultorio|sillon|box|gabinete|calendario|calendar|chair|room)\b)/);
  if (switchTo) {
    const name = normalized.slice(switchTo[0].length).replace(/^(?:agenda|calendario|calendar)\s(?:de |del |of )?/, '').trim();
    if (name) return { op: 'only', target: 'calendar', name };
  }
  const all = normalized.match(/^(?:mostra(?:me)? |muestra(?:me)? |show )?(?:todos los (?:doctores|profesionales|odontologos|medicos)|todas las (?:agendas|sedes|consultorios|sucursales)|todo|(?:saca|sacame|quita|quitame|borra|limpia) (?:los |el |todos los )?filtros?|sin filtros?|all (?:doctors|calendars|sites)|show all|everything|clear (?:the )?filters?)$/);
  if (all) return { op: 'all', target: targetOf(normalized), name: null };
  const ops: Array<[RegExp, CalendarFilterParsed['op']]> = [
    [/^(?:(?:mostra(?:me)?|muestra(?:me)?|deja(?:me)?|ver|filtra(?: por)?|show(?: me)?|only show) )?(?:solo|solamente|nada mas|unicamente|only|just)(?= )/, 'only'],
    [/^filtra(?:me)? (?:por )?(?=\S)/, 'only'],
    [/^(?:agrega(?:me)?|suma(?:me)?|anade|anademe|mostra(?:me)? tambien|muestra(?:me)? tambien|tambien|add|include|also show)(?= )/, 'add'],
    [/^(?:saca(?:me)?|quita(?:me)?|oculta(?:me)?|esconde(?:me)?|remove|hide)(?= )/, 'remove'],
  ];
  for (const [re, op] of ops) {
    const m = normalized.match(re);
    if (!m) continue;
    const body = normalized.slice(m[0].length).trim();
    // "sacá los huecos", "ocultá la búsqueda", «remove Carlos's appointment»: son de otros comandos.
    if (/\b(huecos?|busqueda|buscador|filtros?|cita|citas|turno|turnos|appointment|appointments|color|colou?r)\b/.test(body)) return null;
    const target = targetOf(body);
    // "Sillón 2", "Consultorio 1": en las agendas el número y el tipo son parte del nombre.
    const name = stripFiller(body.replace(TARGET_STRIP, ' ')).trim();
    if (!/[a-z0-9]/.test(name)) return null;
    return { op, target, name };
  }
  return null;
}

export interface CalendarGroupParsed {
  groupBy: 'none' | 'doctor' | 'calendar';
}

export function parseCalendarGroup(normalized: string): CalendarGroupParsed | null {
  if (/^(?:sin agrupar|desagrupa(?:r|me)?|no agrupar|ungroup|no grouping)$/.test(normalized)) return { groupBy: 'none' };
  const m = normalized.match(/^(?:agrupa(?:r|me|lo|la)?|agrupado|agrupada|columnas|group(?: it)?)(?: por| by)? (?:el |la |los |las )?(\w+)/);
  if (!m) return null;
  if (/^(doctor|doctores|doctora|profesional|profesionales|odontolog|doctors?)/.test(m[1])) return { groupBy: 'doctor' };
  if (/^(agenda|agendas|consultorio|consultorios|sillon|sillones|box|calendario|calendarios|calendars?|rooms?)/.test(m[1])) return { groupBy: 'calendar' };
  if (/^(nada|ninguno|none|nothing)$/.test(m[1])) return { groupBy: 'none' };
  return null;
}

export type CalendarPanelParsed =
  | { kind: 'search'; query: string }
  | { kind: 'closeSearch' }
  | { kind: 'hideGaps' };

export function parseCalendarPanel(normalized: string): CalendarPanelParsed | null {
  if (/^(?:cerra|cierra|cerrar|close|oculta|saca|quita|hide)(?: la| el)? (?:busqueda|buscador|search)$/.test(normalized)) return { kind: 'closeSearch' };
  if (/^(?:oculta|ocultar|saca|sacar|cerra|cierra|cerrar|quita|quitar|apaga|hide|close)(?: los)? (?:huecos|horarios libres|espacios libres|gaps)$/.test(normalized)) return { kind: 'hideGaps' };
  const search = normalized.match(/^(?:busca|buscame|buscar|buscale|encontra|encontrame|encuentra|search(?: for)?|find|look for|look up)(?: (?:la|las) citas? de| (?:el|los) turnos? de| (?:la|las) citas?| (?:el|los) turnos?| a| al| el| la| por| for)? (.{2,})$/);
  if (search) {
    const query = search[1].trim();
    // "buscá huecos" es la consulta de huecos.
    if (/^(?:los |unos |un |una |el |la |algun |alguna |some |the |any |a |an |free |open |available |empty )*(?:huecos?|horarios? (?:libres?|disponibles?)|espacios? libres?|lugar|lugares|turnos? (?:libres?|disponibles?)|slots?|gaps?|openings?|free time|times?|availability|time slots?)\b/.test(query)) return null;
    return { kind: 'search', query };
  }
  return null;
}

// ── Consultas ─────────────────────────────────────────────────────────────────

export type CalendarQueryParsed =
  | { kind: 'agenda'; date: string; doctor: string | null }
  | { kind: 'next' }
  | { kind: 'patient_next'; patient: string }
  | { kind: 'gaps'; date: string; period: DayPeriod | null };

const GAPS_RE = /\b(huecos?|horarios? (?:libres?|disponibles?)|horas? libres?|espacios? libres?|lugares? libres?|turnos? (?:libres?|disponibles?)|disponibilidad|hay (?:lugar|espacio|hueco)|free (?:slots?|time)|(?:open|available|empty) (?:slots?|times?)|(?:find|search for|search|look for|show me|show|any|get me) (?:the |some |me |free |open |available |empty )*(?:slots?|times?)|time slots|gaps?|openings?|availability)\b/;
const DOCTOR_REF = new RegExp(String.raw`\s(?:del|de la|con el|con la|para el|para la|de|con)? ?(?:el |la )?(?:doctor|doctora|dr|dra|odontolog[oa])\s(?<name>[a-z]+(?: [a-z]+)?)(?=\s)`);

const AGENDA_WORDS = new Set([
  'y', 'que', 'cuantas', 'cuantos', 'como', 'quien', 'quienes', 'tengo', 'tenemos', 'hay', 'tiene', 'viene', 'vienen', 'esta', 'estamos', 'agenda', 'cita', 'citas',
  'turno', 'turnos', 'paciente', 'pacientes', 'el', 'la', 'los', 'las', 'de', 'del', 'para', 'a', 'al', 'en', 'mi', 'nuestra', 'hoy', 'dia', 'mostrame', 'muestrame', 'leeme',
  'decime', 'dime', 'programadas', 'agendadas', 'what', 'how', 'many', 'who', 'whos', 'do', 'i', 'we', 'have', 'has', 'is', 'are', 'there', 'appointment', 'appointments',
  'scheduled', 'coming', 'on', 'for', 'my', 'our', 'the', 'today', 's', 'me', 'it', 'looking', 'look', 'like', 'does', 'schedule',
]);

export function parseCalendarQuery(normalized: string, today: Date = startOfToday()): CalendarQueryParsed | null {
  if (GAPS_RE.test(normalized) && !/^(?:oculta|saca|cerra|cierra|quita|hide|close)\b/.test(normalized)) {
    const period = extractPeriod(normalized);
    const text = period ? period.rest : normalized;
    const time = extractSpokenTime(text);
    const found = extractSpokenDate(time ? time.rest : text, 'future', today);
    return { kind: 'gaps', date: found?.date ?? dateKey(today), period: period?.period ?? null };
  }

  if (/^(?:y )?(?:quien|cual|who)(?: es)?(?: el| la)? (?:sigue|siguiente|proxim[oa]|viene ahora|is next|s next)\b/.test(normalized)
    || /^(?:el |la )?(?:proxim[oa]|siguiente) (?:paciente|cita|turno)(?: de hoy)?$/.test(normalized)
    || /^(?:next patient|next appointment|who s next)$/.test(normalized)) {
    return { kind: 'next' };
  }

  const patientNext = normalized.match(/^(?:cuando|que dia|para cuando|when)(?: es| tiene| viene| le toca| vuelve| esta| is| does| has| comes)? (.+)$/)
    ?? normalized.match(/^(?:la |el )?(?:proxima cita|proximo turno|siguiente cita|siguiente turno|next appointment)(?: de| del| for| of) (.+)$/);
  if (patientNext) {
    const body = patientNext[1]
      .replace(/\b(la proxima cita|el proximo turno|proxima cita|proximo turno|su proxima cita|su proximo turno|next appointment|his|her|next|viene|tiene|vuelve|le toca|is|does|has|come|comes|coming|back|de nuevo|otra vez)\b/g, ' ');
    const patient = asName(body);
    if (patient) return { kind: 'patient_next', patient };
  }

  const isAgenda = (/^(?:y )?(?:que|cuantas|cuantos|como|quien|quienes|what|how many|who|whos)\b/.test(normalized)
      && /\b(tengo|tenemos|hay|tiene|viene|vienen|esta|estamos|agenda|citas?|turnos?|pacientes?|appointments?|scheduled|have|coming)\b/.test(normalized))
    || /^(?:la |mi |nuestra )?agenda (?:de|del|para) /.test(normalized)
    || /^(?:mostrame |muestrame |leeme |decime |dime )?(?:las |los )?(?:citas|turnos|pacientes) (?:de|del|para) /.test(normalized);
  if (!isAgenda) return null;
  const found = extractSpokenDate(normalized, 'nearest', today);
  const rest = found ? found.rest : normalized;
  const doctorTake = take(rest, DOCTOR_REF);
  const doctor = doctorTake?.m.groups?.name ?? null;
  // «cómo viene Juan con la guita» no es la agenda: sobran palabras que no son de una consulta.
  const leftover = (doctorTake ? doctorTake.rest : rest).split(' ').filter((w) => w && !AGENDA_WORDS.has(w));
  if (leftover.length > 1) return null;
  return { kind: 'agenda', date: found?.date ?? dateKey(today), doctor };
}

// ── Estados ───────────────────────────────────────────────────────────────────

/** A qué cita se refiere la frase: paciente, hora y/o día. Al menos uno. */
export interface CalendarAppointmentRef {
  patient: string | null;
  time: SpokenTime | null;
  date: string | null;
}

export interface CalendarStatusParsed extends CalendarAppointmentRef {
  status: AppointmentStatus;
  reason: VoiceCancellationReason | null;
}

/** Frases de cada estado (sin \b: se buscan entre espacios). El orden importa: "llegó tarde" antes que "llegó". */
const STATUS_PATTERNS: Array<[string, AppointmentStatus]> = [
  ['llego tarde|vino tarde|arrived late|came late', 'arrived_late'],
  ['atendid[oa] tarde|se atendio tarde|attended late', 'attended_late'],
  ['no vino|no se presento|no llego|no asistio|no aparecio|falto|ausente|no show|didn t show(?: up)?|did not show(?: up)?|didn t come|did not come', 'no_show'],
  ['ya llego|llego|llegaron|esta aca|esta aqui|esta en (?:la )?sala(?: de espera)?|en sala de espera|llegad[oa]|arrived|is here|checked in|check in|(?:is )?in the waiting room|is waiting', 'arrived'],
  ['paso a consulta|pasa a consulta|entro a consulta|entro al consultorio|entro|ya entro|esta adentro|esta en atencion|en atencion|en consulta|empezo|empeza|empezamos|inicia|iniciamos|inicio|comenza|comenzamos|comenzo|en curso|in progress|started|start', 'in_progress'],
  ['termino|terminamos|termina|terminala|finaliza|finalizala|finalizo|finalizamos|completa|completala|completada|completado|terminada|terminado|finalizada|finalizado|ya se atendio|se atendio|done|finished|completed|complete', 'completed'],
  ['cancela|cancelala|cancelalo|cancelar|cancelo|cancelamos|cancelada|cancelado|anula|anulala|anular|anulo|suspende|suspendela|suspendio|cancel|cancelled|canceled', 'cancelled'],
  ['confirma|confirmala|confirmalo|confirmar|confirmo|confirmada|confirmado|confirmamos|confirmed|confirm', 'confirmed'],
  ['pendiente|pending', 'pending'],
];

const REASON_PATTERNS: Array<[string, VoiceCancellationReason]> = [
  ['sin aviso|sin avisar|no aviso|without notice|no notice', 'no_notice'],
  ['con (?:tiempo|aviso|anticipacion)|aviso con tiempo|avisando|en tiempo|in time|with notice', 'in_time'],
  ['aviso tarde|tarde|late', 'late'],
  ['por (?:el|la) (?:doctor|doctora|profesional)|(?:el|la) (?:doctor|doctora) (?:cancelo|no puede)|by the doctor', 'by_doctor'],
  ['por la clinica|la clinica (?:cancelo|cierra)|by the clinic', 'by_clinic'],
];

const between = (alternatives: string) => new RegExp(`\\s(?:${alternatives})(?=\\s)`);

const STATUS_STRIP = /\b(marca(?:la|lo|r)?|pone(?:le|la|lo)?|pasa(?:la|lo)?|cambia(?:la|lo)?|deja(?:la|lo)?|como|estado|mark|set|as|status|ya|esta|is|it|him|her|them|he|she|they|this one|that one|this|that|just|has|have)\b/g;

/** La cita de la que se habla: paciente (lo que sobra), hora y día. */
export function extractAppointmentRef(text: string, prefer: DatePreference, today: Date): CalendarAppointmentRef {
  const time = extractSpokenTime(text);
  const afterTime = time ? time.rest : text;
  const date = extractSpokenDate(afterTime, prefer, today);
  const afterDate = date ? date.rest : afterTime;
  return { patient: asName(afterDate.replace(STATUS_STRIP, ' ')), time: time?.time ?? null, date: date?.date ?? null };
}

/** Preguntas sobre la cuenta o el paciente («¿tiene algo pendiente de pagar?»): no son un estado. */
const PATIENT_QUESTION = /\b(?:tiene|debe|deuda|deudas|saldo|pagar|pago|pagos|adeuda|cuanto|owe|owes|balance|pay|paid)\b/;

export function parseCalendarStatus(normalized: string, today: Date = startOfToday()): CalendarStatusParsed | null {
  if (PATIENT_QUESTION.test(normalized)) return null;
  for (const [re, status] of STATUS_PATTERNS) {
    const found = take(normalized, between(re));
    if (!found) continue;
    let text = found.rest;
    let reason: VoiceCancellationReason | null = null;
    if (status === 'cancelled') {
      for (const [reasonRe, value] of REASON_PATTERNS) {
        const r = take(text, between(reasonRe));
        if (r) { reason = value; text = r.rest; break; }
      }
    }
    const ref = extractAppointmentRef(text, 'nearest', today);
    // Sin paciente ni hora no se sabe de qué cita se habla ("llegó" solo), salvo que haya una
    // cita en foco (la última elegida por voz): entonces es esa.
    if (!ref.patient && !ref.time && !hasAppointmentFocus()) return null;
    return { status, reason, ...ref };
  }
  return null;
}

// ── Reprogramar ───────────────────────────────────────────────────────────────

export interface CalendarRescheduleParsed {
  from: CalendarAppointmentRef;
  date: string | null;
  time: SpokenTime | null;
}

const RESCHEDULE_VERB = /^(?:reprograma(?:r|me|la|le|lo)?|reagenda(?:r|me|la|le|lo)?|cambia(?:r|me|la|le|lo)?|pasa(?:r|me|la|le|lo)?|move|mueve|movela|movelo|mover|corre(?:r|me|la|le|lo)?|adelanta(?:r|me|la|le|lo)?|atrasa(?:r|me|la|le|lo)?|posterga(?:r|me|la|le|lo)?|reschedule|postpone)(?=\s)/;
const TARGET_START = new RegExp(`^(?:el|la|las|hoy|manana|pasado|proxim[oa]|semana|mes|dentro|en \\d|mediodia|\\d|next|tomorrow|today|the|day after|in \\d|noon|${WEEKDAY_ALT}|${MONTH_ALT})\\b`);

export function parseCalendarReschedule(normalized: string, today: Date = startOfToday()): CalendarRescheduleParsed | null {
  const verb = normalized.match(RESCHEDULE_VERB);
  if (!verb) return null;
  const body = normalized.slice(verb[0].length).trim();
  // «pasala al jueves a las 10» (la cita en foco): todo lo que sigue es el destino.
  const direct = body.match(/^(?:al|a la|a las|a|para el|para la|para|hasta el|to|to the|until)\s/);
  if (direct && TARGET_START.test(body.slice(direct[0].length)) && hasAppointmentFocus()) {
    const time = extractSpokenTime(` ${body} `);
    const date = extractSpokenDate(time ? time.rest : ` ${body} `, 'future', today);
    if (time || date) return { from: { patient: null, time: null, date: null }, date: date?.date ?? null, time: time?.time ?? null };
  }
  const words = body.split(' ');
  // El primer "para / al / a / to" desde la izquierda cuyo lado derecho es un día u hora.
  for (let i = 1; i < words.length; i++) {
    if (!['para', 'al', 'a', 'to', 'hasta', 'for', 'on', 'until'].includes(words[i])) continue;
    const right = words.slice(i + 1).join(' ');
    if (!TARGET_START.test(right)) continue;
    const time = extractSpokenTime(words[i] === 'a' || words[i] === 'para' ? `${words[i]} ${right}` : right)
      ?? (/^\d{1,2}(?:\s\d{2})?$/.test(right) ? extractSpokenTime(`a las ${right}`) : null);
    const afterTime = time ? time.rest.replace(/^(?:a|para)\s/, '') : right;
    const date = extractSpokenDate(afterTime, 'future', today);
    if (!time && !date) continue;
    const from = extractAppointmentRef(words.slice(0, i).join(' '), 'nearest', today);
    if (!from.patient && !from.time && !hasAppointmentFocus()) return null;
    return { from, date: date?.date ?? null, time: time?.time ?? null };
  }
  return null;
}

// ── Nueva cita ────────────────────────────────────────────────────────────────

export interface CalendarCreateParsed {
  date: string | null;
  time: SpokenTime | null;
  /** Lo que queda: paciente, doctor, servicios y agenda, que se separan con las listas. */
  rest: string;
}

const CREATE_VERB = /^(?:(?:una |un )?(?:nueva cita|nuevo turno|nueva consulta|new appointment)|(?:una |un )?(?:cita|turno|consulta) para|(?:crea|creame|crear|crea|agenda|agendame|agendale|agendar|reserva|reservame|reservale|reservar|da|dale|dame|anota|anotame|anotale|programa|programame|programale|programar|book|schedule|create|add|make)(?: (?:una|un|an|a|nueva|nuevo|new))? (?:cita|turno|consulta|hora|appointment)|agenda(?:me|le|r)? (?:a|al|para)|agendale|reservale|anotale|book)(?=\s|$)/;

export function parseCalendarCreate(normalized: string, today: Date = startOfToday()): CalendarCreateParsed | null {
  const verb = normalized.match(CREATE_VERB);
  if (!verb) return null;
  const body = normalized.slice(verb[0].length).trim();
  const time = extractSpokenTime(body);
  const afterTime = time ? time.rest : body;
  const date = extractSpokenDate(afterTime, 'future', today);
  return { date: date?.date ?? null, time: time?.time ?? null, rest: (date ? date.rest : afterTime).trim() };
}

/**
 * Separa lo que queda de "nueva cita para Ana Gómez con el doctor Pérez de limpieza": las partes
 * que empiezan con "con / para / de / en" se prueban contra doctores, servicios y agendas; la
 * primera que no es nada de eso es el paciente.
 */
export interface CreateRestPart {
  /** Con qué se introdujo ("con Pérez", "para una limpieza"); null al principio de la frase. */
  via: string | null;
  text: string;
}

export function splitCreateRest(rest: string): { doctor: string | null; calendar: string | null; parts: CreateRestPart[] } {
  let text = ` ${rest} `;
  let doctor: string | null = null;
  let calendar: string | null = null;
  const doc = text.match(new RegExp(String.raw`\s(?:con|del|de la|de|para)? ?(?:el |la )?(?:doctor|doctora|dr|dra|odontolog[oa]|profesional)\s(?<name>.+?)(?=\s(?:para|de|en|con|por)\s|\s$)`));
  if (doc?.groups && doc.index !== undefined) {
    doctor = doc.groups.name.trim();
    text = ` ${cut(text, doc.index, doc.index + doc[0].length)} `;
  }
  const cal = text.match(new RegExp(String.raw`\s(?:en|para|de)? ?(?:el |la )?(?:consultorio|agenda|sillon|box|gabinete|sede|sucursal)\s(?<name>.+?)(?=\s(?:para|de|en|con|por)\s|\s$)`));
  if (cal?.groups && cal.index !== undefined) {
    calendar = cal.groups.name.trim();
    text = ` ${cut(text, cal.index, cal.index + cal[0].length)} `;
  }
  const parts = text.trim().split(/\s(?=(?:para|con|de|por|a)\s)/)
    .map((p) => {
      const via = p.match(/^(para|con|de|por|a)\s/)?.[1] ?? null;
      return { via, text: stripFiller(via ? p.slice(via.length + 1) : p) };
    })
    .filter((p) => p.text);
  return { doctor, calendar, parts };
}

// ── Doctor y tratamientos nombrados (contra las listas de la pantalla) ───────

export interface NamedOption {
  id: string;
  name: string;
}

/** Palabras dichas que ocupa una mención y las opciones que le calzan (varias = preguntar). */
export interface SpanMatch {
  ids: string[];
  start: number;
  end: number;
}

const DOCTOR_TITLES = new Set(['doctor', 'doctora', 'dr', 'dra', 'doc', 'odontologo', 'odontologa', 'profesional', 'licenciado', 'licenciada', 'lic']);
const MENTION_LEAD = new Set(['con', 'del', 'de', 'la', 'el', 'para', 'al', 'a', 'por', 'with', 'for', 'the', 'to', 'by', 'and']);
const SERVICE_WORDS = new Set(['servicio', 'servicios', 'tratamiento', 'tratamientos', 'service', 'services', 'treatment', 'treatments']);

/** "limpieza" ≈ "limpiezas", "blanqueamiento" ≈ "blanqueamientos" (palabras largas). */
const sameWord = (a: string, b: string) => a === b || (a.length > 4 && b.length > 4 && (a.startsWith(b) || b.startsWith(a)));
const doctorWords = (name: string) => normalizeSpeech(name).split(' ').filter((w) => w.length >= 3 && !DOCTOR_TITLES.has(w));
const splitWords = (text: string) => text.trim().split(' ').filter(Boolean);

/**
 * El doctor nombrado: "doctor/a, dr, odontólogo…" o "con" seguidos de palabras de su nombre
 * ("con el doctor Pérez", "con Juan Pérez"). Con `bare` vale el nombre solo (respuesta a "¿con
 * qué doctor?"). Si se dijo "doctor X" y X no es nadie, devuelve `said` sin ids.
 */
export function findDoctorMention(
  text: string,
  doctors: NamedOption[],
  { bare = false, skip = new Set<number>() }: { bare?: boolean; skip?: Set<number> } = {},
): (SpanMatch & { said?: string }) | null {
  const list = splitWords(text);
  const tokens = doctors.map((d) => ({ id: d.id, words: doctorWords(d.name) }));
  let unknown: (SpanMatch & { said: string }) | null = null;
  for (let i = 0; i < list.length; i++) {
    const titled = DOCTOR_TITLES.has(list[i]);
    const viaCon = list[i] === 'con';
    if (skip.has(i) || (!titled && !viaCon && !bare)) continue;
    let j = titled || viaCon ? i + 1 : i;
    while (j < list.length && ['el', 'la', 'a', 'por', 'al'].includes(list[j])) j++;
    if (!titled && j < list.length && DOCTOR_TITLES.has(list[j])) continue; // "con el doctor…": lo toma el título
    let best = 0;
    let ids: string[] = [];
    for (const doctor of tokens) {
      const used = new Set<number>();
      let k = 0;
      while (j + k < list.length && !skip.has(j + k)) {
        const at = doctor.words.findIndex((w, index) => !used.has(index) && sameWord(w, list[j + k]));
        if (at < 0) break;
        used.add(at);
        k++;
      }
      if (k > best) { best = k; ids = [doctor.id]; } else if (k && k === best) ids.push(doctor.id);
    }
    let start = i;
    while (start > 0 && i - start < 2 && MENTION_LEAD.has(list[start - 1]) && (titled || list[start - 1] !== 'con')) start--;
    if (best > 0) return { ids, start, end: j + best };
    if (titled && !unknown && j < list.length) {
      let end = j;
      while (end < list.length && end - j < 3 && !skip.has(end) && !MENTION_LEAD.has(list[end]) && !SERVICE_WORDS.has(list[end])) end++;
      if (end > j) unknown = { ids: [], start, end, said: list.slice(j, end).join(' ') };
    }
  }
  return unknown;
}

/**
 * Los tratamientos nombrados: el comienzo de su nombre dicho entero ("limpieza" → "Limpieza dental").
 * Un nombre completo gana a los que solo empiezan igual ("consulta" → "Consulta", no "Consulta de
 * urgencia"); si varios empatan, vuelven todos para preguntar. `skip`: palabras ya usadas.
 */
/**
 * Los términos dentales dichos en inglés con un catálogo en español («cleaning» = «Limpieza»): la
 * app en inglés y los servicios cargados en español es lo común en una clínica de acá.
 */
const SERVICE_TERMS_EN: Record<string, string> = {
  cleaning: 'limpieza', cleanup: 'limpieza', prophylaxis: 'profilaxis', filling: 'obturacion', fillings: 'obturacion',
  extraction: 'extraccion', extractions: 'extraccion', crown: 'corona', crowns: 'corona', implant: 'implante', implants: 'implante',
  whitening: 'blanqueamiento', bleaching: 'blanqueamiento', consultation: 'consulta', checkup: 'control', control: 'control',
  orthodontics: 'ortodoncia', braces: 'ortodoncia', endodontics: 'endodoncia', bridge: 'puente', veneer: 'carilla', veneers: 'carillas',
  resin: 'resina', sealant: 'sellante', sealants: 'sellantes', denture: 'protesis', dentures: 'protesis', periodontics: 'periodoncia',
};

export function findServiceMentions(text: string, services: NamedOption[], skip: Set<number> = new Set()): SpanMatch[] {
  const list = splitWords(text);
  const names = services
    .map((s) => ({ id: s.id, words: normalizeSpeech(s.name).split(' ').filter(Boolean) }))
    .filter((s) => s.words.length && s.words[0].length >= 4);
  const found: SpanMatch[] = [];
  for (let i = 0; i < list.length; i++) {
    if (skip.has(i) || list[i].length < 4 || (FILLER.has(list[i]) && list[i] !== 'consulta')) continue;
    let best = 0;
    let bestLen = 0;
    let ids: string[] = [];
    for (const service of names) {
      let k = 0;
      while (k < service.words.length && i + k < list.length && !skip.has(i + k) && (sameWord(service.words[k], list[i + k]) || sameWord(service.words[k], SERVICE_TERMS_EN[list[i + k]] ?? ''))) k++;
      if (!k) continue;
      // Entero = +0.5: "consulta" es "Consulta" antes que "Consulta de urgencia".
      const score = k + (k === service.words.length ? 0.5 : 0);
      if (score > best) { best = score; bestLen = k; ids = [service.id]; } else if (score === best) ids.push(service.id);
    }
    if (best > 0) {
      found.push({ ids, start: i, end: i + bestLen });
      i += bestLen - 1;
    }
  }
  return found;
}

export interface CreateEntities {
  /** Doctores que calzan con lo dicho (uno = ese; varios = preguntar). */
  doctorIds: string[];
  /** "doctor X" que no es ningún doctor de la lista. */
  doctorSaid: string | null;
  /** Un grupo por tratamiento nombrado (varios ids = preguntar cuál). */
  serviceGroups: string[][];
  calendarSaid: string | null;
  patient: string | null;
}

/**
 * Lo que queda de "nueva cita para Ana Gómez con el doctor Pérez, limpieza y blanqueamiento"
 * después de la fecha y la hora: doctor y tratamientos contra las listas de la pantalla, la
 * agenda por su palabra ("consultorio 2") y el resto, el paciente.
 */
export function extractCreateEntities(rest: string, doctors: NamedOption[], services: NamedOption[]): CreateEntities {
  const list = splitWords(rest);
  const skip = new Set<number>();
  // Primero los tratamientos: un "doctor X" desconocido no se come lo que sigue.
  const serviceMatches = findServiceMentions(rest, services);
  for (const match of serviceMatches) for (let i = match.start; i < match.end; i++) skip.add(i);
  const doctor = findDoctorMention(rest, doctors, { skip: new Set(skip) });
  if (doctor) for (let i = doctor.start; i < doctor.end; i++) skip.add(i);
  // Las menciones cortan la frase: "Ana Gómez [doctor] [servicio]" deja "Ana Gómez" solo.
  const chunks: string[] = [];
  let current: string[] = [];
  list.forEach((w, i) => {
    if (skip.has(i) || SERVICE_WORDS.has(w)) {
      if (current.length) chunks.push(current.join(' '));
      current = [];
    } else current.push(w);
  });
  if (current.length) chunks.push(current.join(' '));
  let calendarSaid: string | null = null;
  let patient: string | null = null;
  for (const chunk of chunks) {
    const { calendar, parts } = splitCreateRest(chunk);
    calendarSaid ??= calendar;
    if (patient) continue;
    const part = parts.find((p) => p.via !== 'con' && asName(p.text));
    if (part) patient = asName(part.text);
  }
  return {
    doctorIds: doctor?.ids ?? [],
    doctorSaid: doctor && !doctor.ids.length ? doctor.said ?? null : null,
    serviceGroups: serviceMatches.map((m) => m.ids),
    calendarSaid,
    patient,
  };
}

/** Respuesta "ninguno / sin doctor / da igual / después lo pongo". */
export function isNoneAnswer(normalized: string): boolean {
  return /^(?:no|ninguno|ninguna|nada|nadie|sin|da igual|cualquiera|despues|mas tarde|none|no one|nobody|any|skip|later)(?:\s.*)?$/.test(normalized.trim());
}

export type ServiceEditMode = 'add' | 'remove' | 'replace';

/** "sacale la limpieza" → remove; "cambiá el tratamiento a …", "solo …" → replace; si no, add. */
export function serviceEditMode(normalized: string): ServiceEditMode {
  if (/\b(?:saca|sacale|quita|quitale|borra|borrale|elimina|eliminale|remove|delete|drop)\b/.test(normalized)) return 'remove';
  if (/\b(?:cambia|cambiale|reemplaza|vez|lugar|solo|solamente|change|replace|instead|only)\b/.test(normalized)) return 'replace';
  return 'add';
}

// ── Editar una cita ──────────────────────────────────────────────────────────

const EDIT_VERB = /^(?:edita(?:r|me|la|le|lo)?|modifica(?:r|me|la|le|lo)?|abri(?:r|me|la|le|lo)?|abre(?:me|la|le|lo)?|corregi(?:r|la|le|lo)?|corrige(?:la|le|lo)?|actualiza(?:r|la|le|lo)?|cambia(?:r|me|la|le|lo)?|pone(?:le|la|lo)?|ponle|agrega(?:r|le)?|anadi(?:r|le)?|anade(?:le)?|saca(?:r|le)?|quita(?:r|le)?|edit|open|modify|change|update)(?=\s)/;
const APPOINTMENT_WORD = /\s(?:cita|turno|consulta|appointment)\s/;
/** Lo que no es el paciente: verbos de edición y palabras de lo que se cambia. */
const EDIT_STRIP = /\b(?:edita\w*|modifica\w*|abri\w*|abre\w*|corregi\w*|corrige\w*|actualiza\w*|cambia\w*|pone\w*|ponle|agrega\w*|anadi\w*|anade\w*|saca\w*|quita\w*|y|tambien|doctor|doctora|tratamiento\w*|servicio\w*|edit|open|modify|change|update|also|and)\b/g;

export interface CalendarEditParsed {
  /** La frase sin el verbo: la cita y, si se dijo, qué cambiarle. */
  body: string;
}

/**
 * "editá la cita de Luis Rodríguez", "abrí el turno de las 10", "a la cita de Ana ponele el doctor
 * Pérez". Tiene que nombrar una cita ("cita/turno") o una hora; si es un cambio de estado
 * ("poné la cita de Ana como confirmada") lo toma el comando de estados.
 */
export function parseCalendarEdit(normalized: string, today: Date = startOfToday()): CalendarEditParsed | null {
  // «editala», «abrila para editar» con una cita en foco.
  if ((/^(?:edita|modifica|corregi|corrige|abri|abre)(?:la|lo)(?: (?:para editar|para modificar|de nuevo))?$/.test(normalized)
    || /^(?:edit|modify|change|open) (?:it|this|that|this one|that one|this appointment|that appointment)(?: please)?$/.test(normalized)) && hasAppointmentFocus()) return { body: ' ' };
  const text = normalized.replace(/^(?:a|en) (?=(?:la|el) (?:cita|turno))/, '');
  const verb = text.match(EDIT_VERB);
  const body = verb ? text.slice(verb[0].length) : APPOINTMENT_WORD.test(` ${text} `) && /\b(?:pone\w*|agrega\w*|saca\w*|quita\w*|cambia\w*)\b/.test(text) ? text : null;
  if (body === null) return null;
  // "agregá una cita para…" es una cita nueva.
  if (/^\s*(?:una|un|otra|otro|nueva|nuevo|an?|new) (?:cita|turno|consulta|appointment)\b/.test(body)) return null;
  if (!APPOINTMENT_WORD.test(` ${body} `) && !extractSpokenTime(` ${body} `) && !(verb && /^(?:edita|modifica|abri|abre|corregi|corrige)(?:la|lo)\b/.test(text) && hasAppointmentFocus())) return null;
  if (parseCalendarStatus(normalized, today)) return null;
  return { body: ` ${body.trim()} ` };
}

/** La cita nombrada en lo que quedó de la frase (sin doctor ni tratamientos ya reconocidos). */
export function editAppointmentRef(rest: string, today: Date = startOfToday()): CalendarAppointmentRef {
  return extractAppointmentRef(` ${rest.replace(EDIT_STRIP, ' ').replace(/\s+/g, ' ').trim()} `, 'nearest', today);
}

/** Palabras "cita / turno / consulta" que nombran la cita (no el tratamiento "Consulta"). */
export function appointmentWordIndexes(text: string): Set<number> {
  const list = splitWords(text);
  const out = new Set<number>();
  list.forEach((w, i) => {
    if (['cita', 'turno', 'consulta', 'appointment'].includes(w) && ['la', 'el', 'esa', 'ese', 'una', 'un', 'the', 'this'].includes(list[i - 1] ?? '')) out.add(i);
  });
  return out;
}

// ── Acciones del menú de la cita ──────────────────────────────────────────────

/** Verbos de las acciones, con sus pronombres pegados ("pasala", "movele"). Nunca prefijos sueltos: "marca" no es "Marcela". */
const VERB_FORMS = '(?:la|lo|le|las|los|me|r)?';
const ACTION_VERBS = [
  'cambia', 'pone', 'pon', 'deja', 'marca', 'pinta', 'colorea', 'pasa', 'mueve', 'move', 'lleva', 'manda', 'asigna', 'reasigna',
  'alarga', 'acorta', 'extiende', 'borra', 'elimina', 'suprimi', 'abri', 'abre', 'mostra', 'muestra', 'cobra', 'factura',
];
const ACTION_STRIP = new RegExp(String.raw`\b(?:(?:${ACTION_VERBS.join('|')})${VERB_FORMS}|ponle|movela|movelo|set|change|make|turn|paint|assign|reassign|put|switch|delete|remove|erase|open|show|charge|bill|ver|veamos|quiero|dure|duren|duracion|duration|lasts?|que|tenga|nuevo|nueva)\b`, 'g');

/**
 * La cita que nombra lo que queda de la frase (sin verbos de acción). null si no hay paciente
 * ni hora: "poné en rojo" solo no dice cuál.
 */
function actionRef(text: string, today: Date): CalendarAppointmentRef | null {
  const ref = extractAppointmentRef(` ${text.replace(ACTION_STRIP, ' ').replace(/\s+/g, ' ').trim()} `, 'nearest', today);
  return ref.patient || ref.time || hasAppointmentFocus() ? ref : null;
}

// Color

/** Colores del menú (ids de Google Calendar) y cómo se dicen. Los de dos palabras van antes. */
export const VOICE_COLORS: Array<[string, string]> = [
  ['2', 'verde claro|verde agua|verde menta|salvia|sage|light green|mint'],
  ['7', 'celeste|turquesa|cian|pavo real|azul claro|light blue|cyan|turquoise|peacock'],
  ['11', 'rojo|roja|tomate|red|tomato'],
  ['4', 'rosa|rosado|rosada|salmon|flamenco|pink|flamingo'],
  ['6', 'naranja|anaranjado|anaranjada|mandarina|orange|tangerine'],
  ['5', 'amarillo|amarilla|banana|yellow'],
  ['10', 'verde|albahaca|green|basil'],
  ['1', 'lavanda|lila|lavender|lilac'],
  ['3', 'violeta|morado|morada|purpura|uva|purple|violet|grape'],
  ['9', 'azul|arandano|blue|blueberry'],
  ['8', 'gris|grafito|gray|grey|graphite'],
];
const CLEAR_COLOR = /\s(?:sin colou?r|sin fondo|(?:quita|saca|borra)(?:le|r)? (?:el )?colou?r|colou?r (?:por defecto|original|normal|default)|no colou?r|(?:remove|clear) (?:the )?colou?r|default colou?r)(?=\s)/;
const COLOR_WORD = /\s(?:colou?r|pinta(?:la|lo|r)?|colorea(?:la|lo|r)?|paint)(?=\s)/;
const COLOR_VERB = /^(?:pone|pon|ponle|poneme|cambia|deja|marca|pinta|colorea|set|make|turn|paint|change)(?:la|lo|le|me|r)?(?=\s)/;

export interface CalendarColorParsed extends CalendarAppointmentRef {
  /** Id del color del menú; '' = sin color propio (vuelve a heredar el de la agenda). */
  colorId: string;
}

/** "poné la cita de Ana en rojo", "pintá de verde la de las 10", "sacale el color a la cita de Juan". */
export function parseCalendarColor(normalized: string, today: Date = startOfToday()): CalendarColorParsed | null {
  const padded = ` ${normalized} `;
  // «la cita de Juan en azul»: un color al final de una cita nombrada, sin verbo.
  const trailingColor = APPOINTMENT_WORD.test(padded) && VOICE_COLORS.some(([, alts]) => new RegExp(String.raw`\s(?:en|de|in) (?:${alts})\s*$`).test(padded));
  if (!COLOR_WORD.test(padded) && !COLOR_VERB.test(normalized) && !trailingColor) return null;
  // "poné la cita de Rosa como confirmada" es un estado (Rosa es la paciente).
  if (parseCalendarStatus(normalized, today)) return null;
  let colorId: string | null = null;
  let rest = normalized;
  const clear = take(normalized, CLEAR_COLOR);
  if (clear) {
    colorId = '';
    rest = clear.rest;
  } else {
    // El color dicho más a la derecha: "la cita de Rosa en azul" es azul.
    let best: { id: string; index: number; rest: string } | null = null;
    for (const [id, alts] of VOICE_COLORS) {
      const found = take(normalized, new RegExp(String.raw`\s(?:(?:en|de|a|al|in|to|con|with) )?(?:(?:el|the|colou?r) )*(?:${alts})(?=\s)`));
      if (found && found.m.index !== undefined && (!best || found.m.index > best.index)) best = { id, index: found.m.index, rest: found.rest };
    }
    if (best) {
      colorId = best.id;
      rest = best.rest;
    }
  }
  if (colorId === null) return null;
  const ref = actionRef(rest.replace(/\b(?:colou?r|el|del)\b/g, ' '), today);
  return ref ? { colorId, ...ref } : null;
}

// Agenda (consultorio)

const CALENDAR_WORD = '(?:agenda|consultorio|calendario|sillon|box|gabinete|sala|calendar|room|chair|office)';
const MOVE_VERB = /^(?:pasa|mueve|move|lleva|manda|cambia|asigna|reasigna|pone|pon|deja|put|assign|reassign|switch)(?:la|lo|le|me|r)?(?=\s)/;
const APPOINTMENT_TAIL = /\s(?:(?:de )?(?:la|el|the) (?:cita|turno|appointment)\s.*)$/;

export interface CalendarMoveParsed extends CalendarAppointmentRef {
  /** La agenda dicha, con su palabra ("consultorio 2", "agenda centro"). */
  calendarSaid: string;
}

/**
 * "pasá la cita de Ana al consultorio 2", "mové la de las 10 a la agenda Centro",
 * "cambiá la agenda de la cita de Juan a Box 3". Si además hay día u hora de destino es un
 * reprogramar, no esto.
 */
export function parseCalendarMove(normalized: string, today: Date = startOfToday()): CalendarMoveParsed | null {
  const verb = normalized.match(MOVE_VERB);
  if (!verb) return null;
  const body = ` ${normalized.slice(verb[0].length).trim()} `;
  // "cambiá la agenda de la cita de Juan a Box 3": la palabra va antes y el nombre al final.
  const named = body.match(new RegExp(String.raw`^\s(?:la |el |the )?${CALENDAR_WORD} (?:de |del |of )(?<ref>.+?)\s(?:a|al|por|para|to)\s(?:la |el |the )?(?<said>.+?)\s$`));
  if (named?.groups) {
    const ref = actionRef(named.groups.ref, today);
    return ref ? { calendarSaid: named.groups.said.trim(), ...ref } : null;
  }
  const target = body.match(new RegExp(String.raw`\s(?:a|al|para|en|to|into|hacia)\s(?:la |el |the )?(?<said>${CALENDAR_WORD}(?:\s.+?)?)\s$`));
  if (!target?.groups || target.index === undefined) return null;
  let said = target.groups.said;
  let refText = body.slice(0, target.index);
  // "pasá al consultorio 2 la cita de Ana": la cita quedó después del nombre.
  const tail = ` ${said} `.match(APPOINTMENT_TAIL);
  if (tail?.index !== undefined) {
    refText = `${refText} ${tail[0]}`;
    said = ` ${said} `.slice(0, tail.index).trim();
  }
  if (extractSpokenDate(said, 'future', today) || extractSpokenTime(` ${said} `)) return null;
  const ref = actionRef(refText, today);
  // «pasá al sillón 2» sin cita nombrada ni en foco: es cambiar de agenda, no mover una cita.
  if (ref && !ref.patient && !ref.time && !hasAppointmentFocus()) return null;
  return ref ? { calendarSaid: said.trim(), ...ref } : null;
}

// Doctor

const DOCTOR_WORD = '(?:doctor|doctora|dr|dra|odontologo|odontologa|profesional)';

export interface CalendarAssignDoctorParsed {
  ref: CalendarAppointmentRef;
  doctorIds: string[];
  /** "doctor X" que no es nadie de la lista. */
  doctorSaid: string | null;
}

/**
 * "pasá la cita de Ana al doctor Pérez", "asignale la de las 10 a la doctora López",
 * "cambiá el doctor de la cita de Juan a Gómez". Con tratamientos en la frase lo toma Editar.
 */
export function parseCalendarAssignDoctor(
  normalized: string,
  doctors: NamedOption[],
  services: NamedOption[],
  today: Date = startOfToday(),
): CalendarAssignDoctorParsed | null {
  // «que a Juan lo atienda el doctor Gómez»: mismo pedido con otro orden.
  const attend = normalized.match(new RegExp(String.raw`^(?:que )?(?:a )?(.+?) (?:lo|la|le) (?:atienda|vea|tome) (?:el |la )?(${DOCTOR_WORD} .+)$`));
  if (attend) normalized = `pasa la cita de ${attend[1]} al ${attend[2]}`;
  const verb = normalized.match(MOVE_VERB);
  if (!verb || !new RegExp(String.raw`\b${DOCTOR_WORD}\b`).test(normalized)) return null;
  const body = ` ${normalized.slice(verb[0].length).trim()} `;
  if (findServiceMentions(body, services, appointmentWordIndexes(body)).length) return null;
  const named = body.match(new RegExp(String.raw`^\s(?:al |el |la |the )?${DOCTOR_WORD} (?:de |del |of )(?<ref>.+?)\s(?:a|al|por|para|to)\s(?<said>.+?)\s$`));
  if (named?.groups) {
    const ref = actionRef(named.groups.ref, today);
    if (!ref) return null;
    const doctor = findDoctorMention(` ${named.groups.said} `, doctors, { bare: true });
    const said = named.groups.said.replace(new RegExp(String.raw`\b(?:el|la|${DOCTOR_WORD})\b`, 'g'), ' ').replace(/\s+/g, ' ').trim();
    return { ref, doctorIds: doctor?.ids ?? [], doctorSaid: doctor?.ids.length ? null : said || null };
  }
  const doctor = findDoctorMention(body, doctors, { skip: appointmentWordIndexes(body) });
  if (!doctor) return null;
  const rest = splitWords(body).filter((_, i) => i < doctor.start || i >= doctor.end).join(' ');
  if (extractSpokenDate(rest, 'future', today) && /\s(?:para|al|a)\s(?:el |la )?(?:\d|hoy|manana|lunes|martes|miercoles|jueves|viernes|sabado|domingo)/.test(` ${rest} `)) return null;
  const ref = actionRef(rest, today);
  return ref ? { ref, doctorIds: doctor.ids, doctorSaid: doctor.ids.length ? null : doctor.said ?? null } : null;
}

// Duración

const DURATION_TRIGGER = /\s(?:dure|duren|durar|dura|duracion|alarga\w*|acorta\w*|extiende\w*|extend\w*|shorten\w*|lasts?|duration|length)(?=\s)/g;
const DURATION_PATTERNS: Array<[string, (g: Record<string, string>) => number]> = [
  [String.raw`\s(?<h>\d{1,2}|una|un) horas? y media(?=\s)`, (g) => (g.h === 'una' || g.h === 'un' ? 1 : Number(g.h)) * 60 + 30],
  [String.raw`\s(?<h>\d{1,2}|una|un) horas? (?:y )?(?<m>\d{1,2}) (?:minutos|min|mins|minutes)(?=\s)`, (g) => (g.h === 'una' || g.h === 'un' ? 1 : Number(g.h)) * 60 + Number(g.m)],
  [String.raw`\s(?:una |la )?hora y media(?=\s)`, () => 90],
  [String.raw`\s(?:media hora|half (?:an )?hour)(?=\s)`, () => 30],
  [String.raw`\s(?<m>\d{1,3}) (?:minutos|min|mins|minutes)(?=\s)`, (g) => Number(g.m)],
  [String.raw`\s(?<h>\d{1,2}|una|un|an|one) (?:horas?|hours?)(?=\s)`, (g) => (['una', 'un', 'an', 'one'].includes(g.h) ? 1 : Number(g.h)) * 60],
];

export interface CalendarDurationParsed extends CalendarAppointmentRef {
  minutes: number;
}

/** Minutos dichos ("45 minutos", "una hora y media", "media hora") y el resto de la frase. */
export function extractDuration(text: string): { minutes: number; rest: string } | null {
  for (const [re, toMinutes] of DURATION_PATTERNS) {
    const found = take(text, new RegExp(String.raw`(?:\s(?:a|de|en|por|for|to))?` + re));
    if (!found) continue;
    const minutes = toMinutes(found.m.groups ?? {});
    if (Number.isFinite(minutes) && minutes >= 5 && minutes <= 12 * 60) return { minutes, rest: found.rest };
  }
  return null;
}

/** "que la cita de Ana dure 45 minutos", "alargá la de las 10 a una hora", "la cita de Juan, duración media hora". */
export function parseCalendarDuration(normalized: string, today: Date = startOfToday()): CalendarDurationParsed | null {
  // «make the appointment of Juan 45 minutes», «dejá la cita de Juan en 30 minutos».
  if (/^(?:make|set|deja\w*|pone\w*|pon)\s/.test(normalized) && /\b\d+ (?:minutes|minutos|mins?|hours?|horas?)\b/.test(normalized) && APPOINTMENT_WORD.test(` ${normalized} `)) {
    normalized = normalized.replace(/^(?:make|set|deja\w*|pone\w*|pon)\s/, 'que dure ');
  }
  if (!new RegExp(DURATION_TRIGGER.source).test(` ${normalized} `)) return null;
  const duration = extractDuration(normalized);
  if (!duration) return null;
  const ref = actionRef(` ${duration.rest} `.replace(DURATION_TRIGGER, ' '), today);
  return ref ? { minutes: duration.minutes, ...ref } : null;
}

// Borrar

const DELETE_APPOINTMENT = /^(?:borra|elimina|suprimi|delete|remove|erase)(?:la|lo|me|r)? (?:(?:la|el|esa|ese|the|this) )?(?:(?:cita|turno|appointment)\b|de\s)/;

/** "borrá la cita de Ana", "eliminá el turno de las 10", "borrá la de las 3". */
export function parseCalendarDelete(normalized: string, today: Date = startOfToday()): CalendarAppointmentRef | null {
  // «borrala», «eliminala» con una cita en foco.
  if (/^(?:borra|elimina|suprimi|delete|remove|erase)(?:la|lo| it| esa| la cita| esa cita)$/.test(normalized) && hasAppointmentFocus()) return { patient: null, time: null, date: null };
  if (!DELETE_APPOINTMENT.test(normalized)) return null;
  if (/\b(?:recordatorio|nota|reminder|note|colou?r|doctor|doctora)\b/.test(normalized)) return null;
  return actionRef(normalized.replace(/^\S+/, ' '), today);
}

// Abrir lo del paciente / la sesión / cobrar

export type CalendarOpenTarget = 'history' | 'documents' | 'accounts' | 'appointments' | 'patient' | 'session' | 'bill';

export interface CalendarOpenParsed extends CalendarAppointmentRef {
  target: CalendarOpenTarget;
}

/** El orden importa: "historial de citas" antes que "historia". */
const OPEN_TARGETS: Array<[string, CalendarOpenTarget]> = [
  ['historial de (?:citas|turnos)|citas anteriores|turnos anteriores|appointments? history|past appointments', 'appointments'],
  ['historia clinica|historial clinico|historia|historial|ficha clinica|clinical (?:history|record)|medical (?:history|record)|chart', 'history'],
  ['imagenes y archivos|imagenes|archivos|documentos|radiografias|fotos|documents|files|images|x rays', 'documents'],
  ['estado de cuenta|cuenta corriente|cuentas|cuenta|saldo|deuda|account statement|accounts?|balance|ledger', 'accounts'],
  ['datos del paciente|datos de contacto|datos|ficha del paciente|ficha|perfil|patient (?:data|details|profile)|profile|details', 'patient'],
  ['sesion clinica|sesion|evolucion|clinical session|session', 'session'],
];
const OPEN_VERB = /^(?:abri|abre|abrir|mostra|muestra|mostrar|ver|veamos|quiero ver|dame|anda a|ir a|open|show|see|view|go to)(?:me|la|lo|le)?(?=\s)/;
const BILL_VERB = /^(?:cobra(?:le|la|r)?|factura(?:le|la|r)?|cobro rapido(?: de| a)?|charge|bill)(?=\s)/;

/** "abrí la historia clínica de Ana", "mostrame la cuenta de la de las 10", "cobrale a Juan Pérez". */
export function parseCalendarOpen(normalized: string, today: Date = startOfToday()): CalendarOpenParsed | null {
  const bill = normalized.match(BILL_VERB);
  if (bill) {
    const ref = actionRef(normalized.slice(bill[0].length), today);
    return ref ? { target: 'bill', ...ref } : null;
  }
  const verb = normalized.match(OPEN_VERB);
  if (!verb) return null;
  const body = normalized.slice(verb[0].length);
  for (const [alts, target] of OPEN_TARGETS) {
    const found = take(body, new RegExp(String.raw`\s(?:(?:la|el|las|los|su|sus|the|his|her) )?(?:${alts})(?=\s)`));
    if (!found) continue;
    const ref = actionRef(found.rest, today);
    return ref ? { target, ...ref } : null;
  }
  return null;
}

// ── Bloquear / habilitar horario ──────────────────────────────────────────────

export interface CalendarSlotParsed {
  kind: 'block' | 'enable';
  date: string | null;
  /** Minutos desde las 00:00 (null = lo que sugiera la pantalla). */
  startMin: number | null;
  endMin: number | null;
  /** Lo que se dijo de la sede ("sede Centro"). */
  sedeSaid: string | null;
  /** "por reunión": el motivo (texto normalizado). */
  note: string | null;
}

const BLOCK_VERB = /^(?:bloquea|bloquear|bloqueame|bloquealo|bloqueala|cerra|cierra|cerrar|cerrame|block|close)(?=\s)/;
const ENABLE_VERB = /^(?:habilita|habilitar|habilitame|desbloquea|desbloquear|desbloqueame|libera|liberar|liberame|abri|abre|abrir|abrime|enable|unblock|open)(?=\s)/;
/** "abrí"/"cerrá" solos también abren citas o paneles: necesitan decir que es un horario. */
const SLOT_WORD = /\s(?:horario|horarios|franja|hueco|agenda|clinica|consultorio|sede|dia|todo el dia|slot|hours?|schedule|time|day)(?=\s)/;
const CLOCK = String.raw`(?:las |la )?(\d{1,2}|una)(?: (\d{2}))?(?: (y media|y cuarto))?(?: (hs|horas|de la manana|de la tarde|de la noche|am|pm))?`;
const RANGE = new RegExp(String.raw`\s(?:de|desde|entre|from)\s${CLOCK}\s(?:a|hasta|y|to|until|till)\s${CLOCK}(?=\s)`);
const FROM_ONLY = new RegExp(String.raw`\s(?:desde|a partir de|from)\s${CLOCK}(?=\s)`);
const UNTIL_ONLY = new RegExp(String.raw`\s(?:hasta|until|till)\s${CLOCK}(?=\s)`);

function clockMinutes(h?: string, m?: string, frac?: string, q?: string): number | null {
  if (!h) return null;
  let hour = h === 'una' ? 1 : Number(h);
  let minute = m ? Number(m) : 0;
  if (frac === 'y media') minute = 30;
  else if (frac === 'y cuarto') minute = 15;
  if (q && /tarde|noche|pm/.test(q)) { if (hour < 12) hour += 12; }
  // "12 de la mañana" es mediodía al cerrar una franja; solo "12 am" es medianoche.
  else if (q && /^(?:am|a m)$/.test(q)) { if (hour === 12) hour = 0; }
  else if ((!q || q === 'hs' || q === 'horas') && hour >= 1 && hour <= 6) hour += 12;
  if (hour === 24 && minute === 0) return 24 * 60;
  if (hour < 0 || hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

/**
 * "bloqueá el lunes de 14 a 16", "cerrá mañana desde las 15 por reunión", "bloqueá todo el día
 * del 24 en la sede Centro", "habilitá el sábado de 9 a 13". Escribe en horarios de excepción
 * con el mismo diálogo que el clic derecho.
 */
export function parseCalendarSlot(normalized: string, today: Date = startOfToday()): CalendarSlotParsed | null {
  const block = normalized.match(BLOCK_VERB);
  const enable = block ? null : normalized.match(ENABLE_VERB);
  const verb = block ?? enable;
  if (!verb) return null;
  let rest = ` ${normalized.slice(verb[0].length).trim()} `;
  if (/\s(?:cita|turno|recordatorio|nota|appointment|reminder|note|buscador|huecos|search|panel|historia|ficha|cuenta|sesion)\s/.test(rest)) return null;
  const soft = /^(?:abri|abre|abrir|abrime|cerra|cierra|cerrar|cerrame|open|close)$/.test(verb[0]);

  let note: string | null = null;
  const reason = rest.match(new RegExp(String.raw`\s(?:por|porque|motivo|because|for)\s(?!la (?:manana|tarde))(?<note>.+?)\s$`));
  if (reason?.groups && !/^\d/.test(reason.groups.note)) {
    note = reason.groups.note.trim();
    rest = ` ${rest.slice(0, reason.index)} `;
  }
  let startMin: number | null = null;
  let endMin: number | null = null;
  const allDayRe = /\s(?:todo el dia|el dia entero|todo|all day|whole day|entire day)(?=\s)/;
  const allDay = allDayRe.test(rest);
  // "todo el día del 24" → "el 24".
  if (allDay) rest = ` ${rest.replace(allDayRe, ' ').replace(/^\s*del\s/, ' el ')} `;
  const range = take(rest, RANGE);
  if (range) {
    const g = range.m;
    startMin = clockMinutes(g[1], g[2], g[3], g[4] ?? g[8]);
    endMin = clockMinutes(g[5], g[6], g[7], g[8]);
    // "de 9 a 12 de la mañana" ya usa el del final; "de 11 a 1" es 11 a 13.
    if (startMin !== null && endMin !== null && endMin <= startMin && !g[4] && startMin >= 12 * 60) startMin -= 12 * 60;
    rest = ` ${range.rest} `;
  } else {
    const from = take(rest, FROM_ONLY);
    if (from) { startMin = clockMinutes(from.m[1], from.m[2], from.m[3], from.m[4]); rest = ` ${from.rest} `; }
    const until = take(rest, UNTIL_ONLY);
    if (until) { endMin = clockMinutes(until.m[1], until.m[2], until.m[3], until.m[4]); rest = ` ${until.rest} `; }
    if (!from && !until) {
      const at = extractSpokenTime(rest);
      if (at) { startMin = at.time.hour * 60 + at.time.minute; rest = ` ${at.rest} `; }
    }
  }
  if (allDay) { startMin = 0; endMin = 24 * 60; }
  const date = extractSpokenDate(rest, 'future', today);
  if (date) rest = ` ${date.rest} `;
  const hasSlotWord = SLOT_WORD.test(` ${normalized} `);
  // "abrí la agenda de Pérez" es un filtro: "abrí/cerrá" necesitan horas o decir "horario".
  if (soft && startMin === null && endMin === null && !/\s(?:horario|horarios|franja|slot|hours)\s/.test(` ${normalized} `)) return null;
  if (!date && startMin === null && endMin === null && !hasSlotWord) return null;
  const sede = rest.match(new RegExp(String.raw`\s(?:sede|sucursal|branch)\s(?<name>.+?)\s$`));
  return {
    kind: block ? 'block' : 'enable',
    date: date?.date ?? null,
    startMin,
    endMin,
    sedeSaid: sede?.groups ? stripFiller(sede.groups.name) || null : null,
    note,
  };
}

// ── Recordatorios y notas ─────────────────────────────────────────────────────

export interface CalendarReminderParsed {
  type: 'reminder' | 'note';
  date: string | null;
  time: SpokenTime | null;
  /** Lo que hay que anotar (normalizado; el texto con tildes sale de la frase original). */
  title: string | null;
}

const REMINDER_CREATE = new RegExp(String.raw`^(?:(?:crea|creame|crear|agrega|agregame|agregar|anade|anademe|pone|poneme|pon|ponme|anota|anotame|anotar|deja|dejame|add|create|make|set|new)\s(?:un |una |a |an )?(?:nuevo |nueva |new )?)?(?<kind>recordatorio|nota|reminder|note)(?=\s|$)|^(?<new>nuevo recordatorio|nueva nota|new reminder|new note)(?=\s|$)|^(?<rec>recordame|recuerdame|remind me)(?=\s|$)`);
const TITLE_LEAD = /^(?:(?:para|que diga|que dice|diciendo|de|sobre|con|que|to|that|about|saying|for|el|la)\s)+/;

/** "recordame el lunes a las 9 pagar la luz", "nota para hoy a las 15 revisar stock", "nuevo recordatorio mañana". */
export function parseCalendarReminder(normalized: string, today: Date = startOfToday()): CalendarReminderParsed | null {
  const m = normalized.match(REMINDER_CREATE);
  if (!m?.groups) return null;
  const kind = m.groups.kind ?? m.groups.new ?? '';
  const type: 'reminder' | 'note' = /nota|note/.test(kind) ? 'note' : 'reminder';
  let rest = ` ${normalized.slice(m[0].length).trim()} `;
  const time = extractSpokenTime(rest);
  if (time) rest = ` ${time.rest} `;
  const date = extractSpokenDate(rest, 'future', today);
  if (date) rest = ` ${date.rest} `;
  const title = rest.trim().replace(TITLE_LEAD, '').trim();
  return { type, date: date?.date ?? null, time: time?.time ?? null, title: title || null };
}

export interface CalendarReminderActionParsed {
  action: 'done' | 'delete';
  date: string | null;
  time: SpokenTime | null;
  /** Palabras del título dichas ("el de llamar al laboratorio"). */
  text: string | null;
}

const REMINDER_WORD = /\s(?:el |la |ese |esa |the |this |mi |my )?(?:recordatorio|nota|reminder|note)(?=\s)/;
const DONE_WORDS = /\s(?:como )?(?:hecho|hecha|listo|lista|completo|completado|completada|realizado|realizada|terminado|terminada|done|complete|completed|finished)(?=\s)/;
const DONE_VERB = /^(?:marca(?:lo|la|r)?|completa(?:lo|la|r)?|termina(?:lo|la|r)?|tacha(?:lo|la|r)?|check|mark|complete|finish)(?=\s)/;
const DELETE_VERB = /^(?:borra|elimina|quita|saca|suprimi|delete|remove|erase)(?:lo|la|me|r)?(?=\s)/;

/** "marcá como hecho el recordatorio de las 10", "borrá la nota de mañana de llamar al laboratorio". */
export function parseCalendarReminderAction(normalized: string, today: Date = startOfToday()): CalendarReminderActionParsed | null {
  const padded = ` ${normalized} `;
  if (!REMINDER_WORD.test(padded)) return null;
  let action: 'done' | 'delete' | null = null;
  let rest = padded;
  if (DELETE_VERB.test(normalized)) {
    action = 'delete';
    rest = ` ${normalized.replace(DELETE_VERB, '')} `;
  } else if (DONE_VERB.test(normalized) || DONE_WORDS.test(padded)) {
    action = 'done';
    rest = ` ${normalized.replace(DONE_VERB, '')} `.replace(DONE_WORDS, ' ');
  }
  if (!action) return null;
  rest = ` ${rest.replace(REMINDER_WORD, ' ')} `;
  const time = extractSpokenTime(rest);
  if (time) rest = ` ${time.rest} `;
  const date = extractSpokenDate(rest, 'nearest', today);
  if (date) rest = ` ${date.rest} `;
  const text = stripFiller(rest.trim().replace(/\b(?:como|as|sobre|about|dice|diga|esta|is|ya)\b/g, ' ').replace(/\s+/g, ' ')).trim();
  return { action, date: date?.date ?? null, time: time?.time ?? null, text: text || null };
}

// ── Barra de herramientas ─────────────────────────────────────────────────────

export type CalendarToolbarParsed = { action: 'print' } | { action: 'refresh' };

/** "imprimí la agenda", "exportá la agenda a Excel", "actualizá el calendario". */
export function parseCalendarToolbar(normalized: string): CalendarToolbarParsed | null {
  if (/^(?:imprimi|imprime|imprimir|imprimime|exporta|exportar|exportame|descarga|descargar|bajame|print|export|download)(?=\s|$)/.test(normalized)
    && /\s(?:agenda|calendario|citas|turnos|planilla|excel|pdf|schedule|calendar|appointments)\s/.test(` ${normalized} `)) {
    return { action: 'print' };
  }
  if (/^(?:actualiza|actualizar|refresca|refrescar|recarga|recargar|refresh|reload|update)(?:me|lo|la)?(?:\s(?:el |la |the )?(?:calendario|agenda|citas|pantalla|calendar|schedule|screen|page))?$/.test(normalized)) {
    return { action: 'refresh' };
  }
  return null;
}

/**
 * El tramo de la frase original que corresponde a `phrase` (normalizada): así un título dictado
 * conserva tildes y mayúsculas. Si no se puede alinear, devuelve `phrase`.
 */
export function rawPhrase(raw: string, phrase: string): string {
  const target = phrase.trim();
  if (!target) return '';
  const tokens = raw.split(/\s+/).filter(Boolean);
  const norms = tokens.map((t) => normalizeSpeech(t));
  for (let i = 0; i < tokens.length; i++) {
    let acc = '';
    for (let j = i; j < tokens.length; j++) {
      if (!norms[j]) continue;
      acc = acc ? `${acc} ${norms[j]}` : norms[j];
      if (acc === target) return tokens.slice(i, j + 1).join(' ').replace(/^[^a-z0-9À-ɏ]+|[^a-z0-9À-ɏ)]+$/gi, '');
      if (!target.startsWith(acc)) break;
    }
  }
  return target;
}
