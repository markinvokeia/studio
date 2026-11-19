import { addMinutes, startOfToday } from 'date-fns';

import { getCalendarVoice, waitForCalendar } from '@/lib/voice/calendar-bridge';
import {
  appointmentStart,
  bestByName,
  byStart,
  CALENDAR_VOICE_DOMAIN,
  dayKeyOf,
  dayText,
  nameScore,
  needCalendar,
  parseDayKey,
  sameDay,
  showDay,
  tc,
  timeText,
} from '@/lib/voice/commands/calendar';
import { parseCalendarQuery, type CalendarQueryParsed } from '@/lib/voice/commands/calendar-parse';
import { registerVoiceCommand } from '@/lib/voice/registry';

import type { Appointment, AppointmentStatus, CalendarVoiceAiResult, VoiceCardRow, VoiceCommandContext } from '@/lib/types';

/**
 * Calendario por voz — preguntas (no cambian nada; responden en la tarjeta y en voz alta):
 *   "¿qué tengo mañana?", "¿cuántas citas hay hoy?", "¿qué tiene el doctor Pérez el lunes?"
 *   "¿quién sigue?"                    → la próxima cita de hoy (la marca en el calendario)
 *   "¿cuándo viene Ana Gómez?"         → su próxima cita (la marca en el calendario)
 *   "¿hay huecos el jueves a la tarde?" → enciende Buscar huecos en ese día y los dice
 */

const MAX_ROWS = 8;
const MAX_SPOKEN = 3;
/** Estados que ya no "vienen": no cuentan para "quién sigue" ni "cuándo viene". */
const DONE: AppointmentStatus[] = ['cancelled', 'no_show', 'completed', 'attended_late'];

const statusLabel = (ctx: VoiceCommandContext, status: AppointmentStatus) => ctx.t(`AppointmentStatus.${status}`);

function rowFor(ctx: VoiceCommandContext, appt: Appointment): VoiceCardRow {
  const start = appointmentStart(appt);
  const service = appt.services?.map((s) => s.name).filter(Boolean).join(', ');
  const parts = [appt.patientName, service].filter(Boolean);
  const cancelled = appt.status === 'cancelled' || appt.status === 'no_show';
  if (cancelled) parts.push(statusLabel(ctx, appt.status));
  return { label: start ? timeText(start) : '—', value: parts.join(' · '), tone: cancelled ? 'warning' : 'default' };
}

// ── Agenda de un día ──────────────────────────────────────────────────────────

async function runAgenda(parsed: Extract<CalendarQueryParsed, { kind: 'agenda' }>, ctx: VoiceCommandContext) {
  const when = dayText(ctx, parsed.date);
  const title = tc(ctx, 'agendaTitle', { date: when.card });
  if (!(await needCalendar(ctx, title))) return;
  ctx.show({ title, message: tc(ctx, 'loadingDay'), tone: 'info' });
  const state = await showDay(ctx, parseDayKey(parsed.date));
  if (!state) {
    const message = tc(ctx, 'dayNotLoaded');
    await ctx.finish({ title, message, tone: 'error' }, message);
    return;
  }
  let doctorName: string | null = null;
  let list = state.visibleAppointments.filter((a) => sameDay(a, parsed.date));
  const total = state.appointments.filter((a) => sameDay(a, parsed.date)).length;
  if (parsed.doctor) {
    const doctor = bestByName(parsed.doctor, state.doctors, (d) => d.name);
    if (!doctor) {
      const message = tc(ctx, 'doctorNotFound', { name: parsed.doctor });
      await ctx.finish({ title, message, tone: 'error' }, message);
      return;
    }
    doctorName = doctor.item.name;
    list = state.appointments.filter((a) => sameDay(a, parsed.date) && String(a.doctorId) === String(doctor.item.id));
  }
  list = [...list].sort(byStart);
  const active = list.filter((a) => a.status !== 'cancelled');
  const cancelled = list.length - active.length;

  const head = doctorName
    ? tc(ctx, 'agendaCountDoctor', { count: active.length, doctor: doctorName, date: when.speech })
    : tc(ctx, 'agendaCount', { count: active.length, date: when.speech });
  const spoken = active.slice(0, MAX_SPOKEN).map((a) => {
    const start = appointmentStart(a);
    return tc(ctx, 'agendaItem', { time: start ? timeText(start) : '', patient: a.patientName || '—' });
  });
  const more = active.length > MAX_SPOKEN ? tc(ctx, 'agendaMore', { count: active.length - MAX_SPOKEN }) : '';
  const notes = [
    cancelled ? tc(ctx, 'agendaCancelled', { count: cancelled }) : '',
    !doctorName && total > list.length ? tc(ctx, 'agendaFiltered', { total }) : '',
  ].filter(Boolean).join(' ');
  const rows = list.slice(0, MAX_ROWS).map((a) => rowFor(ctx, a));
  if (list.length > MAX_ROWS) rows.push({ label: '…', value: tc(ctx, 'agendaMore', { count: list.length - MAX_ROWS }) });
  await ctx.finish(
    { title, subtitle: doctorName ?? undefined, rows, message: [head, notes].filter(Boolean).join(' '), tone: 'info' },
    [head, spoken.join(', '), more, notes].filter(Boolean).join(' '),
  );
}

// ── ¿Quién sigue? ─────────────────────────────────────────────────────────────

async function runNext(ctx: VoiceCommandContext) {
  const title = tc(ctx, 'nextTitle');
  if (!(await needCalendar(ctx, title))) return;
  const today = dayKeyOf(startOfToday());
  const state = await showDay(ctx, startOfToday());
  if (!state) {
    const message = tc(ctx, 'dayNotLoaded');
    await ctx.finish({ title, message, tone: 'error' }, message);
    return;
  }
  // Lo que empezó hace un rato todavía puede estar esperando.
  const from = addMinutes(new Date(), -10);
  const next = state.visibleAppointments
    .filter((a) => sameDay(a, today) && !DONE.includes(a.status) && a.status !== 'in_progress' && (appointmentStart(a)?.getTime() ?? 0) >= from.getTime())
    .sort(byStart)[0];
  if (!next) {
    const message = tc(ctx, 'noNext');
    await ctx.finish({ title, message, tone: 'info' }, message);
    return;
  }
  getCalendarVoice()?.actions.focusAppointment(next);
  const start = appointmentStart(next)!;
  const message = tc(ctx, next.doctorName ? 'nextIsWithDoctor' : 'nextIs', { patient: next.patientName, time: timeText(start), doctor: next.doctorName ?? '' });
  await ctx.finish({ title, rows: [rowFor(ctx, next)], message, tone: 'info' }, message);
}

// ── ¿Cuándo viene Ana Gómez? ──────────────────────────────────────────────────

async function runPatientNext(parsed: Extract<CalendarQueryParsed, { kind: 'patient_next' }>, ctx: VoiceCommandContext) {
  const title = tc(ctx, 'patientNextTitle');
  const bridge = await needCalendar(ctx, title);
  if (!bridge) return;
  ctx.show({ title, message: tc(ctx, 'lookingFor', { name: parsed.patient }), tone: 'info' });
  const results = (await bridge.actions.searchAppointments(parsed.patient))
    .filter((a) => a.patientId && nameScore(parsed.patient, a.patientName) >= 0.5);
  if (ctx.signal.aborted) return;
  if (!results.length) {
    const message = tc(ctx, 'patientNoAppointments', { name: parsed.patient });
    await ctx.finish({ title, message, tone: 'info' }, message);
    return;
  }
  // Varios pacientes con ese nombre: se pregunta cuál.
  const patients = [...new Map(results.map((a) => [a.patientId, a.patientName])).entries()]
    .map(([id, name]) => ({ id, name, score: nameScore(parsed.patient, name) }))
    .sort((a, b) => b.score - a.score);
  const top = patients.filter((p) => p.score === patients[0].score);
  let patient = top[0];
  if (top.length > 1) {
    const choices = top.slice(0, 6);
    const index = await ctx.choose(
      { title, message: tc(ctx, 'whichPatient'), choices: choices.map((p) => ({ label: p.name })), tone: 'confirm' },
      tc(ctx, 'whichPatientSpeech', { count: choices.length }),
    );
    patient = choices[index];
  }
  const own = results.filter((a) => a.patientId === patient.id).sort(byStart);
  const now = Date.now();
  const upcoming = own.filter((a) => !DONE.includes(a.status) && (appointmentStart(a)?.getTime() ?? 0) >= now - 30 * 60000);
  const next = upcoming[0];
  if (!next) {
    const last = [...own].reverse().find((a) => a.status !== 'cancelled');
    const lastStart = last ? appointmentStart(last) : null;
    const message = lastStart
      ? tc(ctx, 'patientNoNextLast', { name: patient.name, date: dayText(ctx, dayKeyOf(lastStart)).speech })
      : tc(ctx, 'patientNoNext', { name: patient.name });
    await ctx.finish({ title, subtitle: patient.name, message, tone: 'info' }, message);
    return;
  }
  bridge.actions.focusAppointment(next);
  const start = appointmentStart(next)!;
  const when = dayText(ctx, dayKeyOf(start));
  const message = tc(ctx, next.doctorName ? 'patientNextWithDoctor' : 'patientNext', {
    name: patient.name, date: when.speech, time: timeText(start), doctor: next.doctorName ?? '',
  });
  const rows: VoiceCardRow[] = [
    { label: tc(ctx, 'when'), value: `${when.card} ${timeText(start)}` },
    ...(next.doctorName ? [{ label: tc(ctx, 'doctor'), value: next.doctorName }] : []),
    { label: tc(ctx, 'status'), value: statusLabel(ctx, next.status) },
  ];
  if (upcoming.length > 1) rows.push({ label: tc(ctx, 'alsoUpcoming'), value: String(upcoming.length - 1) });
  await ctx.finish({ title, subtitle: patient.name, rows, message, tone: 'info' }, message);
}

// ── Huecos ────────────────────────────────────────────────────────────────────

const minutesText = (min: number) => (min >= 60 ? `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ''}` : `${min} min`);

async function runGaps(parsed: Extract<CalendarQueryParsed, { kind: 'gaps' }>, ctx: VoiceCommandContext) {
  const when = dayText(ctx, parsed.date);
  const title = tc(ctx, 'gapsTitle', { date: when.card });
  const bridge = await needCalendar(ctx, title);
  if (!bridge) return;
  ctx.show({ title, message: tc(ctx, 'loadingDay'), tone: 'info' });
  const day = parseDayKey(parsed.date);
  const loaded = await showDay(ctx, day);
  if (loaded && !loaded.gapsActive) bridge.actions.setGapsActive(true);
  const state = loaded ? await waitForCalendar((s) => s.gapsActive, { signal: ctx.signal, timeoutMs: 4000, settleMs: 300 }) : null;
  if (!state) {
    const message = tc(ctx, 'dayNotLoaded');
    await ctx.finish({ title, message, tone: 'error' }, message);
    return;
  }
  const noon = 13 * 60;
  const gaps = state.gaps
    .filter((g) => g.dayKey === parsed.date)
    .filter((g) => {
      if (!parsed.period) return true;
      const startMin = g.start.getHours() * 60 + g.start.getMinutes();
      const endMin = g.end.getHours() * 60 + g.end.getMinutes();
      return parsed.period === 'morning' ? startMin < noon : endMin > noon;
    })
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  const periodText = parsed.period ? tc(ctx, `period_${parsed.period}`) : '';
  if (!gaps.length) {
    const message = tc(ctx, 'noGaps', { date: when.speech, period: periodText });
    await ctx.finish({ title, message, tone: 'info' }, message);
    return;
  }
  const rows: VoiceCardRow[] = gaps.slice(0, MAX_ROWS).map((g) => ({
    label: `${timeText(g.start)}–${timeText(g.end)}`,
    value: [minutesText(g.minutes), g.groupLabel].filter(Boolean).join(' · '),
  }));
  const head = tc(ctx, 'gapsCount', { count: gaps.length, date: when.speech, period: periodText });
  const spoken = gaps.slice(0, MAX_SPOKEN).map((g) => tc(ctx, g.groupLabel ? 'gapItemGroup' : 'gapItem', { from: timeText(g.start), to: timeText(g.end), group: g.groupLabel ?? '' }));
  const more = gaps.length > MAX_SPOKEN ? tc(ctx, 'agendaMore', { count: gaps.length - MAX_SPOKEN }) : '';
  await ctx.finish({ title, rows, message: `${head} ${tc(ctx, 'gapsHint')}`, tone: 'info' }, [head, spoken.join(', '), more].filter(Boolean).join(' '));
}

// ── Registro ──────────────────────────────────────────────────────────────────

async function runQuery(parsed: CalendarQueryParsed, ctx: VoiceCommandContext) {
  switch (parsed.kind) {
    case 'agenda': return runAgenda(parsed, ctx);
    case 'next': return runNext(ctx);
    case 'patient_next': return runPatientNext(parsed, ctx);
    case 'gaps': return runGaps(parsed, ctx);
  }
}

registerVoiceCommand<CalendarQueryParsed, CalendarVoiceAiResult>({
  id: 'calendar.query',
  domain: CALENDAR_VOICE_DOMAIN,
  priority: 24,
  match: (normalized) => parseCalendarQuery(normalized),
  run: runQuery,
  ai: {
    from: (r) => {
      const today = dayKeyOf(startOfToday());
      switch (r.intent) {
        case 'calendar.agenda': {
          const doctor = r.doctor_id ? getCalendarVoice()?.state.doctors.find((d) => String(d.id) === r.doctor_id)?.name ?? null : null;
          return { kind: 'agenda', date: r.date ?? today, doctor };
        }
        case 'calendar.next': return { kind: 'next' };
        case 'calendar.patient_next': return r.patient ? { kind: 'patient_next', patient: r.patient } : null;
        case 'calendar.gaps': return { kind: 'gaps', date: r.date ?? today, period: r.period };
        default: return null;
      }
    },
  },
});
