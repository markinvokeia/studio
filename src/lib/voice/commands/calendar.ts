import { addDays, addMonths, addWeeks, addYears, differenceInCalendarDays, format, isValid, parseISO, startOfToday } from 'date-fns';
import { enUS, es } from 'date-fns/locale';

import { getCalendarVoice, isDayLoaded, waitForCalendar, type CalendarVoiceState } from '@/lib/voice/calendar-bridge';
import { sanitizeCalendarAiResult, type CalendarAiContext } from '@/lib/voice/commands/calendar-ai';
import {
  parseCalendarFilter,
  parseCalendarGroup,
  parseCalendarNavigate,
  parseCalendarPanel,
  parseCalendarView,
  type CalendarFilterParsed,
  type CalendarGroupParsed,
  type CalendarNavParsed,
  type CalendarPanelParsed,
  type CalendarViewParsed,
} from '@/lib/voice/commands/calendar-parse';
import { isDialogOpen } from '@/lib/voice/dom-dialog';
import { getAppointmentFocus, hasAppointmentFocus } from '@/lib/voice/focus';
import { bestNameMatchScored, normalizeSpeech } from '@/lib/voice/parse';
import { registerVoiceCommand, registerVoiceDomain } from '@/lib/voice/registry';

import type { Appointment, CalendarVoiceAiResult, CalendarVoiceView, VoiceCommandContext } from '@/lib/types';

/** Módulo de voz del calendario (lo activa la pantalla de citas con VoiceCommandHost). */
export const CALENDAR_VOICE_DOMAIN = 'calendar';

/**
 * Calendario por voz — mirar y moverse (no cambia ninguna cita):
 *   "andá al jueves", "mañana", "el 3 de diciembre", "siguiente", "semana anterior", "hoy"
 *   "vista semanal", "vista de 3 días", "mostrame el día de mañana"
 *   "solo el doctor Pérez", "agregá el sillón 2", "sacá la sede Centro", "todos los doctores"
 *   "agrupá por doctor", "sin agrupar"
 *   "buscá a Ana Gómez", "cerrá la búsqueda", "ocultá los huecos"
 * Consultas en calendar-query.ts; estados, nueva cita y reprogramar en calendar-manage.ts.
 */

// ── Comunes a los comandos del calendario ─────────────────────────────────────

export const tc = (ctx: VoiceCommandContext, key: string, values?: Record<string, string | number>) => ctx.t(`VoiceCommands.calendar.${key}`, values);

/** El puente con la pantalla; sin él (no estamos en el calendario) lo dice y devuelve null. */
export async function needCalendar(ctx: VoiceCommandContext, title: string) {
  let bridge = getCalendarVoice();
  if (bridge?.state.ready) return bridge;
  if (!bridge) {
    // Recién montada (cambio de idioma, navegación): se espera un momento a que publique.
    await waitForCalendar(() => true, { signal: ctx.signal, timeoutMs: 3000 });
    bridge = getCalendarVoice();
    if (bridge?.state.ready) return bridge;
  }
  if (bridge) {
    ctx.show({ title, message: tc(ctx, 'loading'), tone: 'info' });
    const ready = await waitForCalendar((s) => s.ready, { signal: ctx.signal, timeoutMs: 10000 });
    if (ready) return getCalendarVoice();
  }
  if (ctx.signal.aborted) return null;
  const message = tc(ctx, 'notOnScreen');
  await ctx.finish({ title, message, tone: 'error' }, message);
  return null;
}

export const dayKeyOf = (date: Date) => format(date, 'yyyy-MM-dd');
export const parseDayKey = (key: string) => parseISO(key);

/** Inicio de la cita (las fechas vienen en hora local, a veces con una Z que no corresponde). */
export function appointmentStart(appt: Appointment): Date | null {
  const raw = appt.start?.dateTime ?? (appt.date && appt.time ? `${appt.date}T${appt.time}` : null);
  if (!raw) return null;
  const date = parseISO(String(raw).replace(/Z$/, ''));
  return isValid(date) ? date : null;
}

export const timeText = (date: Date) => format(date, 'HH:mm');

/** "hoy", "mañana", "el jueves 26 de noviembre" para decir; "26/11" para la tarjeta. */
export function dayText(ctx: VoiceCommandContext, key: string): { card: string; speech: string } {
  const date = parseDayKey(key);
  const diff = differenceInCalendarDays(date, startOfToday());
  const card = format(date, 'EEE dd/MM', { locale: ctx.locale.startsWith('en') ? enUS : es });
  if (diff === 0) return { card, speech: ctx.t('VoiceCommands.today') };
  if (diff === 1) return { card, speech: tc(ctx, 'tomorrow') };
  if (diff === -1) return { card, speech: ctx.t('VoiceCommands.yesterday') };
  const speech = ctx.locale.startsWith('en')
    ? format(date, 'EEEE, MMMM d', { locale: enUS })
    : format(date, "EEEE d 'de' MMMM", { locale: es });
  return { card, speech };
}

/** Lleva el calendario a ese día y espera a que estén sus citas. null si no cargó a tiempo. */
export async function showDay(ctx: VoiceCommandContext, day: Date): Promise<CalendarVoiceState | null> {
  const bridge = getCalendarVoice();
  if (!bridge) return null;
  if (!isDayLoaded(bridge.state, day)) bridge.actions.goToDate(day);
  return waitForCalendar((s) => isDayLoaded(s, day), { signal: ctx.signal, timeoutMs: 15000, settleMs: 250 });
}

export const sameDay = (appt: Appointment, key: string) => {
  const start = appointmentStart(appt);
  return !!start && dayKeyOf(start) === key;
};

export const byStart = (a: Appointment, b: Appointment) => (appointmentStart(a)?.getTime() ?? 0) - (appointmentStart(b)?.getTime() ?? 0);

/** Qué tan bien coincide lo dicho con un nombre (0–1): parte de las palabras dichas que están en él. */
export function nameScore(said: string, label: string): number {
  const words = normalizeSpeech(said).split(' ').filter((w) => w.length >= 2);
  const labelWords = normalizeSpeech(label).split(' ').filter(Boolean);
  if (!words.length || !labelWords.length) return 0;
  const hits = words.filter((w) => labelWords.some((l) => l === w || (w.length >= 3 && l.startsWith(w)) || (l.length >= 4 && w.startsWith(l))));
  return hits.length / words.length;
}

/** El nombre (doctor, agenda, sede, servicio) que mejor coincide con lo dicho, con su puntaje. */
export function bestByName<T>(said: string, items: T[], label: (item: T) => string): { item: T; score: number } | null {
  const found = bestNameMatchScored(normalizeSpeech(said), items.map(label));
  return found ? { item: items[found.index], score: found.score } : null;
}

// ── IA ────────────────────────────────────────────────────────────────────────

/** Lo que la IA necesita saber: listas cerradas y lo que se ve. Sin pacientes. */
async function calendarAiContext(): Promise<Record<string, unknown>> {
  const state = getCalendarVoice()?.state;
  if (!state) return {};
  const sedeName = new Map(state.sedes.map((s) => [String(s.id), s.name]));
  const context: CalendarAiContext & Record<string, unknown> = {
    doctors: state.doctors.slice(0, 80).map((d) => ({ id: String(d.id), name: d.name })),
    calendars: state.calendars.slice(0, 80).map((c) => ({ id: String(c.id), name: c.name, sede: c.sede_name ?? (c.sede_id ? sedeName.get(String(c.sede_id)) ?? null : null) })),
    sedes: state.sedes.slice(0, 40).map((s) => ({ id: String(s.id), name: s.name })),
    services: state.services.filter((s) => s?.id && s?.name).slice(0, 150).map((s) => ({ id: String(s.id), name: s.name })),
    view: state.view,
    visible_from: state.range ? dayKeyOf(state.range.start) : null,
    visible_to: state.range ? dayKeyOf(state.range.end) : null,
    custom_mode: state.customMode,
    // Sin datos del paciente: solo que hay una cita en foco y cuándo es.
    has_focus: hasAppointmentFocus(),
    focus_when: (() => {
      const focused = hasAppointmentFocus() ? getAppointmentFocus() : null;
      const start = focused ? appointmentStart(focused) : null;
      return start ? format(start, "yyyy-MM-dd'T'HH:mm") : null;
    })(),
    zoom: Math.round((state.zoom || 1) * 100),
    agendas_panel: state.agendasPanel,
    form_open: !!state.form.kind,
    dialog_open: isDialogOpen(),
    export_open: !!state.exportDialog,
    settings: state.settings ? {
      mode: state.settings.mode,
      default_view: state.settings.default_view,
      grouped_by: state.settings.grouped_by,
      hour_height: state.settings.hour_height,
      slot_duration: state.settings.slot_duration,
      default_sede: state.settings.default_sede || 'all',
      event_label_format: state.settings.event_label_format,
      hidden_weekdays: state.settings.hidden_weekdays ?? [],
      visible_hours_mode: state.settings.visible_hours_mode,
    } : null,
  };
  return context;
}

registerVoiceDomain<CalendarVoiceAiResult>({
  id: CALENDAR_VOICE_DOMAIN,
  notUnderstoodKey: 'VoiceCommands.calendar.notUnderstood',
  ai: {
    context: calendarAiContext,
    sanitize: (raw, context) => sanitizeCalendarAiResult(raw, context),
  },
});

// ── Ir a una fecha / avanzar ──────────────────────────────────────────────────

const TIME_GRID: CalendarVoiceView[] = ['day', '2-day', '3-day', '4-day', '5-day', '6-day', 'week'];

/** Siguiente / anterior: lo que avanzan las flechas en la vista actual (o la unidad dicha). */
function stepTarget(state: CalendarVoiceState, dir: 1 | -1, unit?: 'day' | 'week' | 'month'): Date {
  const range = state.range ?? { start: startOfToday(), end: startOfToday() };
  const middle = new Date((range.start.getTime() + range.end.getTime()) / 2);
  if (unit === 'day') return addDays(range.start, dir);
  if (unit === 'week') return addWeeks(range.start, dir);
  if (unit === 'month') return addMonths(middle, dir);
  const days = state.view.match(/^(\d)-day$/);
  if (days) return addDays(range.start, dir * Number(days[1]));
  switch (state.view) {
    case 'day': return addDays(range.start, dir);
    case 'week': return addWeeks(range.start, dir);
    case 'year': return addYears(middle, dir);
    case 'schedule': return addDays(range.start, dir * Math.max(1, differenceInCalendarDays(range.end, range.start) + 1));
    default: return addMonths(middle, dir);
  }
}

async function runNavigate(parsed: CalendarNavParsed, ctx: VoiceCommandContext) {
  const title = tc(ctx, 'title');
  const bridge = await needCalendar(ctx, title);
  if (!bridge) return;
  const { state, actions } = bridge;
  let target: Date;
  if (parsed.kind === 'date') {
    target = parseDayKey(parsed.date);
    // "la semana que viene" desde la vista día se ve mejor en semana; "diciembre", en mes.
    if (parsed.unit === 'week' && (state.view === 'day' || /^\d-day$/.test(state.view))) actions.setView('week');
    if (parsed.unit === 'month' && (TIME_GRID.includes(state.view))) actions.setView('month');
  } else {
    target = stepTarget(state, parsed.dir, parsed.unit);
  }
  actions.goToDate(target);
  const when = dayText(ctx, dayKeyOf(target));
  await ctx.finish({ title, message: tc(ctx, 'wentTo', { date: when.card }), tone: 'success' }, when.speech);
}

registerVoiceCommand<CalendarNavParsed, CalendarVoiceAiResult>({
  id: 'calendar.navigate',
  domain: CALENDAR_VOICE_DOMAIN,
  aux: true,
  priority: 5,
  match: (normalized) => parseCalendarNavigate(normalized),
  run: runNavigate,
  ai: {
    from: (r) => {
      if (r.intent === 'calendar.today') return { kind: 'date', date: dayKeyOf(startOfToday()) };
      if (r.intent !== 'calendar.navigate') return null;
      if (r.date) return { kind: 'date', date: r.date };
      return r.step ? { kind: 'step', dir: r.step } : null;
    },
  },
});

// ── Vista ─────────────────────────────────────────────────────────────────────

async function runView(parsed: CalendarViewParsed, ctx: VoiceCommandContext) {
  const title = tc(ctx, 'title');
  const bridge = await needCalendar(ctx, title);
  if (!bridge) return;
  bridge.actions.setView(parsed.view);
  if (parsed.date) bridge.actions.goToDate(parseDayKey(parsed.date));
  const name = tc(ctx, `views.${parsed.view.replace('-', '_')}`);
  const message = tc(ctx, 'viewChanged', { view: name });
  await ctx.finish({ title, message, tone: 'success' }, message);
}

registerVoiceCommand<CalendarViewParsed, CalendarVoiceAiResult>({
  id: 'calendar.view',
  domain: CALENDAR_VOICE_DOMAIN,
  aux: true,
  priority: 10,
  match: (normalized) => parseCalendarView(normalized),
  run: runView,
  ai: { from: (r) => (r.intent === 'calendar.view' && r.view ? { view: r.view, date: r.date ?? undefined } : null) },
});

// ── Filtros ───────────────────────────────────────────────────────────────────

type FilterTarget = 'doctor' | 'calendar' | 'sede';
interface Resolved { target: FilterTarget; ids: string[]; label: string }

/** Doctor, agenda o sede nombrados; con target 'any', el que mejor coincide de los tres. */
function resolveFilter(parsed: CalendarFilterParsed, state: CalendarVoiceState): Resolved | null {
  const lists: Record<FilterTarget, Array<{ id: string; name: string }>> = {
    doctor: state.doctors.map((d) => ({ id: String(d.id), name: d.name })),
    calendar: state.calendars.map((c) => ({ id: String(c.id), name: c.name })),
    sede: state.sedes.map((s) => ({ id: String(s.id), name: s.name })),
  };
  if (parsed.ids?.length) {
    const target = parsed.target === 'any' ? 'doctor' : parsed.target;
    const items = lists[target].filter((i) => parsed.ids!.includes(i.id));
    return items.length ? { target, ids: items.map((i) => i.id), label: items.map((i) => i.name).join(', ') } : null;
  }
  if (!parsed.name) return null;
  // «chair 2», «consultorio 3» con agendas que se llaman distinto: por el número, si hay una sola.
  const number = parsed.name.match(/\b(\d{1,3})\b/)?.[1];
  if (number && parsed.target !== 'doctor' && parsed.target !== 'sede') {
    const byNumber = lists.calendar.filter((c) => new RegExp(`\\b${number}\\b`).test(normalizeSpeech(c.name)));
    const direct = bestByName(parsed.name, lists.calendar, (i) => i.name);
    if (byNumber.length === 1 && (!direct || direct.score < 0.5)) return { target: 'calendar', ids: [byNumber[0].id], label: byNumber[0].name };
  }
  const targets: FilterTarget[] = parsed.target === 'any' ? ['doctor', 'calendar', 'sede'] : [parsed.target];
  let best: { target: FilterTarget; id: string; name: string; score: number } | null = null;
  for (const target of targets) {
    const found = bestByName(parsed.name, lists[target], (i) => i.name);
    if (found && (!best || found.score > best.score)) best = { target, id: found.item.id, name: found.item.name, score: found.score };
  }
  return best ? { target: best.target, ids: [best.id], label: best.name } : null;
}

async function runFilter(parsed: CalendarFilterParsed, ctx: VoiceCommandContext) {
  const title = tc(ctx, 'filterTitle');
  const bridge = await needCalendar(ctx, title);
  if (!bridge) return;
  const { state, actions } = bridge;

  if (parsed.op === 'all') {
    if (parsed.target !== 'calendar' && parsed.target !== 'sede') actions.setSelectedDoctorIds(state.doctors.map((d) => String(d.id)));
    if (parsed.target !== 'doctor' && !state.customMode) actions.setSelectedCalendarIds(state.calendars.map((c) => String(c.id)));
    const message = tc(ctx, 'filterAll');
    await ctx.finish({ title, message, tone: 'success' }, message);
    return;
  }

  const resolved = resolveFilter(parsed, state);
  // «solo cuando atendemos» no es un doctor ni una agenda: quizás la IA lo entiende.
  if (!resolved && await ctx.tryAi()) return;
  if (!resolved) {
    const message = tc(ctx, 'filterNotFound', { name: parsed.name ?? '' });
    await ctx.finish({ title, message, tone: 'error' }, message);
    return;
  }
  // Una sede son sus agendas.
  const calendarIds = resolved.target === 'sede'
    ? state.calendars.filter((c) => resolved.ids.includes(String(c.sede_id ?? ''))).map((c) => String(c.id))
    : resolved.ids;
  if (resolved.target !== 'doctor' && !calendarIds.length) {
    const message = tc(ctx, 'sedeWithoutCalendars', { name: resolved.label });
    await ctx.finish({ title, message, tone: 'error' }, message);
    return;
  }

  if (resolved.target === 'doctor') {
    const current = state.selectedDoctorIds.map(String);
    const next = parsed.op === 'only' ? resolved.ids
      : parsed.op === 'add' ? [...new Set([...current, ...resolved.ids])]
        : current.filter((id) => !resolved.ids.includes(id));
    actions.setSelectedDoctorIds(next);
  } else if (state.customMode && parsed.op !== 'remove') {
    // Modo personalizado: se ve una agenda por vez.
    actions.setActiveCalendar(calendarIds[0]);
  } else {
    const current = state.selectedCalendarIds.map(String);
    const next = parsed.op === 'only' ? calendarIds
      : parsed.op === 'add' ? [...new Set([...current, ...calendarIds])]
        : current.filter((id) => !calendarIds.includes(id));
    actions.setSelectedCalendarIds(next);
  }
  const message = tc(ctx, `filter_${parsed.op}`, { name: resolved.label });
  await ctx.finish({ title, message, tone: 'success' }, message);
}

registerVoiceCommand<CalendarFilterParsed, CalendarVoiceAiResult>({
  id: 'calendar.filter',
  domain: CALENDAR_VOICE_DOMAIN,
  aux: true,
  priority: 12,
  match: (normalized) => parseCalendarFilter(normalized),
  run: runFilter,
  ai: {
    from: (r) => {
      if (r.intent !== 'calendar.filter' || !r.filter_op) return null;
      if (r.filter_op === 'all') return { op: 'all', target: r.filter_target ?? 'any', name: null };
      const [target, ids] = r.doctor_ids.length ? ['doctor', r.doctor_ids] as const
        : r.sede_ids.length ? ['sede', r.sede_ids] as const
          : ['calendar', r.calendar_ids] as const;
      return ids.length ? { op: r.filter_op, target, name: null, ids } : null;
    },
  },
});

// ── Agrupar ───────────────────────────────────────────────────────────────────

async function runGroup(parsed: CalendarGroupParsed, ctx: VoiceCommandContext) {
  const title = tc(ctx, 'title');
  const bridge = await needCalendar(ctx, title);
  if (!bridge) return;
  if (bridge.state.customMode) {
    const message = tc(ctx, 'groupCustomMode');
    await ctx.finish({ title, message, tone: 'info' }, message);
    return;
  }
  bridge.actions.setGroupBy(parsed.groupBy);
  const message = tc(ctx, `group_${parsed.groupBy}`);
  await ctx.finish({ title, message, tone: 'success' }, message);
}

registerVoiceCommand<CalendarGroupParsed, CalendarVoiceAiResult>({
  id: 'calendar.group',
  domain: CALENDAR_VOICE_DOMAIN,
  aux: true,
  priority: 15,
  match: (normalized) => parseCalendarGroup(normalized),
  run: runGroup,
  ai: { from: (r) => (r.intent === 'calendar.group' && r.group_by ? { groupBy: r.group_by } : null) },
});

// ── Buscador y huecos ─────────────────────────────────────────────────────────

async function runPanel(parsed: CalendarPanelParsed, ctx: VoiceCommandContext) {
  const title = tc(ctx, 'title');
  const bridge = await needCalendar(ctx, title);
  if (!bridge) return;
  if (parsed.kind === 'search') {
    bridge.actions.openSearch(parsed.query);
    const message = tc(ctx, 'searching', { query: parsed.query });
    await ctx.finish({ title: tc(ctx, 'searchTitle'), message, tone: 'success' }, message);
    return;
  }
  if (parsed.kind === 'closeSearch') bridge.actions.closeSearch();
  else bridge.actions.setGapsActive(false);
  const message = tc(ctx, parsed.kind === 'closeSearch' ? 'searchClosed' : 'gapsHidden');
  await ctx.finish({ title, message, tone: 'success' }, message);
}

registerVoiceCommand<CalendarPanelParsed, CalendarVoiceAiResult>({
  id: 'calendar.panel',
  domain: CALENDAR_VOICE_DOMAIN,
  priority: 26,
  match: (normalized) => parseCalendarPanel(normalized),
  run: runPanel,
  aux: true,
  ai: {
    from: (r) => (r.intent === 'calendar.search' && r.query ? { kind: 'search', query: r.query }
      : r.intent === 'calendar.close_search' ? { kind: 'closeSearch' }
        : r.intent === 'calendar.hide_gaps' ? { kind: 'hideGaps' }
          : null),
  },
});
