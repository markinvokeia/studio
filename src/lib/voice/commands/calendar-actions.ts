import { addMinutes, differenceInMinutes, parseISO, set, startOfToday } from 'date-fns';

import { getCalendarVoice, waitForCalendar, type CalendarVoiceState } from '@/lib/voice/calendar-bridge';
import {
  appointmentStart,
  bestByName,
  CALENDAR_VOICE_DOMAIN,
  dayKeyOf,
  dayText,
  nameScore,
  needCalendar,
  parseDayKey,
  showDay,
  tc,
  timeText,
} from '@/lib/voice/commands/calendar';
import {
  appointmentRows,
  asOptions,
  deny,
  pickOne,
  resolveAppointment,
  whenOf,
} from '@/lib/voice/commands/calendar-manage';
import {
  parseCalendarAssignDoctor,
  parseCalendarColor,
  parseCalendarDelete,
  parseCalendarDuration,
  parseCalendarMove,
  parseCalendarOpen,
  parseCalendarReminder,
  parseCalendarReminderAction,
  parseCalendarSlot,
  parseCalendarToolbar,
  parseTimeAnswer,
  parseTimeKey,
  rawPhrase,
  type CalendarAppointmentRef,
  type CalendarOpenTarget,
  type CalendarReminderActionParsed,
  type CalendarSlotParsed,
  type CalendarToolbarParsed,
  type SpokenTime,
} from '@/lib/voice/commands/calendar-parse';
import { normalizeSpeech, parseYesNo } from '@/lib/voice/parse';
import { registerVoiceCommand } from '@/lib/voice/registry';
import { isRecurringReminder } from '@/lib/reminders';

import { canReschedule, normalizeAppointmentStatus } from '@/constants/appointment-status';
import { BUSINESS_CONFIG_PERMISSIONS } from '@/constants/permissions';
import type { Appointment, CalendarReminder, CalendarVoiceAiResult, VoiceCard, VoiceCardRow, VoiceCommandContext } from '@/lib/types';

/**
 * Calendario por voz — todo lo que el clic derecho, los diálogos de horario y la barra hacen a
 * mano. Cada cambio se confirma leyendo la cita (o la franja) y usa la misma función de la
 * pantalla, con sus permisos, avisos y errores:
 *   "poné la cita de Ana en rojo", "pasá la de las 10 al consultorio 2", "asignale la cita de
 *   Juan al doctor Pérez", "que la cita de Ana dure 45 minutos", "borrá la cita de las 3"
 *   "abrí la historia clínica de Ana", "cobrale a Juan Pérez"
 *   "bloqueá el lunes de 14 a 16 por reunión", "habilitá el sábado de 9 a 13"
 *   "recordame mañana a las 9 llamar al laboratorio", "marcá como hecho el recordatorio de las 10"
 *   "imprimí la agenda", "actualizá el calendario"
 */

const MAX_UNCLEAR = 2;
const INACTIVE = ['cancelled', 'deleted'];

async function finishInfo(ctx: VoiceCommandContext, card: VoiceCard, message: string, tone: VoiceCard['tone'] = 'info') {
  await ctx.finish({ ...card, message, tone }, message);
}

/** "¿Lo hago?": sí → true; no → avisa que no cambió nada y false. */
async function confirmChange(ctx: VoiceCommandContext, card: VoiceCard, speech: string, danger = false): Promise<boolean> {
  const ok = await ctx.confirm({ ...card, message: tc(ctx, danger ? 'confirmDangerHint' : 'actionConfirmHint'), tone: danger ? 'danger' : 'confirm' }, speech);
  if (!ok) await finishInfo(ctx, card, ctx.t('VoiceCommands.nothingChanged'));
  return ok;
}

/** Guarda con la función de la pantalla y dice cómo salió. */
async function applyChange(ctx: VoiceCommandContext, card: VoiceCard, run: () => Promise<boolean>, done: string) {
  ctx.show({ ...card, message: tc(ctx, 'saving'), tone: 'info' });
  const ok = await run();
  if (ctx.signal.aborted) return;
  await finishInfo(ctx, card, ok ? done : tc(ctx, 'actionFailed'), ok ? 'success' : 'error');
}

const colorName = (ctx: VoiceCommandContext, id: string | null | undefined) => tc(ctx, `colors.${id || 'none'}`);

/** La referencia a la cita que trae la IA (paciente y/o día y hora actuales). */
const aiRef = (r: CalendarVoiceAiResult): CalendarAppointmentRef => ({
  patient: r.patient ? normalizeSpeech(r.patient).trim() : null,
  time: parseTimeKey(r.from_time),
  date: r.from_date,
});
const hasAiRef = (r: CalendarVoiceAiResult) => !!(r.patient || r.from_time);

// ── Color ─────────────────────────────────────────────────────────────────────

interface ColorParsed extends CalendarAppointmentRef { colorId: string }

async function runColor(parsed: ColorParsed, ctx: VoiceCommandContext) {
  const title = tc(ctx, 'colorTitle');
  if (!ctx.hasPermission(BUSINESS_CONFIG_PERMISSIONS.APPOINTMENT_UPDATE)) return deny(ctx, title);
  const bridge = await needCalendar(ctx, title);
  if (!bridge) return;
  const appt = await resolveAppointment(ctx, parsed, title, (a) => !INACTIVE.includes(a.status as string));
  if (!appt) return;
  const current = appt.colorSource === 'appointment' ? appt.colorId ?? '' : '';
  const target = colorName(ctx, parsed.colorId);
  const card: VoiceCard = {
    title,
    subtitle: appt.patientName,
    rows: [...appointmentRows(ctx, appt), { label: tc(ctx, 'color'), value: `${colorName(ctx, current)} → ${target}`, tone: 'warning' }],
  };
  if (current === parsed.colorId) return finishInfo(ctx, card, tc(ctx, 'colorAlready', { patient: appt.patientName, color: target }));
  if (!(await confirmChange(ctx, card, tc(ctx, 'confirmColor', { patient: appt.patientName, when: whenOf(ctx, appt).speech, color: target })))) return;
  await applyChange(ctx, card, () => getCalendarVoice()!.actions.changeColor(appt, parsed.colorId), tc(ctx, 'colorDone', { patient: appt.patientName, color: target }));
}

registerVoiceCommand<ColorParsed, CalendarVoiceAiResult>({
  id: 'calendar.color',
  domain: CALENDAR_VOICE_DOMAIN,
  priority: 32,
  match: (normalized) => parseCalendarColor(normalized),
  run: runColor,
  ai: {
    from: (r) => (r.intent === 'calendar.color' && r.color && hasAiRef(r) ? { colorId: r.color === 'none' ? '' : r.color, ...aiRef(r) } : null),
  },
});

// ── Agenda (consultorio) ──────────────────────────────────────────────────────

interface MoveParsed extends CalendarAppointmentRef {
  calendarSaid: string | null;
  calendarId: string | null;
}

/** La agenda dicha entre las de la pantalla ("consultorio 2", "agenda Centro" → "Centro"). */
function findCalendar(state: CalendarVoiceState, said: string) {
  const plain = said.replace(/^(?:la |el )?(?:agenda|calendario|calendar)\s+/, '');
  const options = [said, plain].map((s) => bestByName(s, state.calendars, (c) => c.name)).filter((m) => !!m && m.score > 0);
  options.sort((a, b) => b!.score - a!.score);
  return options[0]?.item ?? null;
}

async function runMove(parsed: MoveParsed, ctx: VoiceCommandContext) {
  const title = tc(ctx, 'moveCalendarTitle');
  if (!ctx.hasPermission(BUSINESS_CONFIG_PERMISSIONS.APPOINTMENT_UPDATE)) return deny(ctx, title);
  const bridge = await needCalendar(ctx, title);
  if (!bridge) return;
  const { state } = bridge;
  const calendar = parsed.calendarId
    ? state.calendars.find((c) => String(c.id) === parsed.calendarId) ?? null
    : parsed.calendarSaid ? findCalendar(state, parsed.calendarSaid) : null;
  if (!calendar) {
    const message = tc(ctx, 'calendarNotFound', { name: parsed.calendarSaid ?? '' });
    await ctx.finish({ title, message, tone: 'error' }, message);
    return;
  }
  const appt = await resolveAppointment(ctx, parsed, title, (a) => !INACTIVE.includes(a.status as string));
  if (!appt) return;
  const before = state.calendars.find((c) => String(c.id) === String(appt.calendar_source_id))?.name ?? '—';
  const card: VoiceCard = {
    title,
    subtitle: appt.patientName,
    rows: [...appointmentRows(ctx, appt), { label: tc(ctx, 'calendar'), value: `${before} → ${calendar.name}`, tone: 'warning' }],
  };
  if (String(appt.calendar_source_id) === String(calendar.id)) return finishInfo(ctx, card, tc(ctx, 'calendarAlready', { patient: appt.patientName, calendar: calendar.name }));
  if (!(await confirmChange(ctx, card, tc(ctx, 'confirmMoveCalendar', { patient: appt.patientName, when: whenOf(ctx, appt).speech, calendar: calendar.name })))) return;
  await applyChange(ctx, card, () => getCalendarVoice()!.actions.reassign(appt, { calendar }), tc(ctx, 'moveCalendarDone', { patient: appt.patientName, calendar: calendar.name }));
}

registerVoiceCommand<MoveParsed, CalendarVoiceAiResult>({
  id: 'calendar.move_calendar',
  domain: CALENDAR_VOICE_DOMAIN,
  priority: 33,
  match: (normalized) => {
    const parsed = parseCalendarMove(normalized);
    return parsed ? { ...parsed, calendarId: null } : null;
  },
  run: runMove,
  ai: {
    from: (r) => (r.intent === 'calendar.move_calendar' && r.calendar_id && hasAiRef(r) ? { calendarSaid: null, calendarId: r.calendar_id, ...aiRef(r) } : null),
  },
});

// ── Doctor ────────────────────────────────────────────────────────────────────

interface AssignDoctorParsed {
  ref: CalendarAppointmentRef;
  doctorIds: string[];
  doctorSaid: string | null;
}

async function runAssignDoctor(parsed: AssignDoctorParsed, ctx: VoiceCommandContext) {
  const title = tc(ctx, 'assignDoctorTitle');
  if (!ctx.hasPermission(BUSINESS_CONFIG_PERMISSIONS.APPOINTMENT_UPDATE)) return deny(ctx, title);
  const bridge = await needCalendar(ctx, title);
  if (!bridge) return;
  if (!parsed.doctorIds.length) {
    const message = tc(ctx, 'doctorNotFound', { name: parsed.doctorSaid ?? '' });
    await ctx.finish({ title, message, tone: 'error' }, message);
    return;
  }
  const doctor = await pickOne(ctx, title, parsed.doctorIds, bridge.state.doctors, tc(ctx, 'whichDoctorOf'));
  if (!doctor) return;
  const appt = await resolveAppointment(ctx, parsed.ref, title, (a) => !INACTIVE.includes(a.status as string));
  if (!appt) return;
  const card: VoiceCard = {
    title,
    subtitle: appt.patientName,
    rows: [
      { label: tc(ctx, 'when'), value: whenOf(ctx, appt).card },
      { label: tc(ctx, 'doctor'), value: `${appt.doctorName || '—'} → ${doctor.name}`, tone: 'warning' },
    ],
  };
  if (String(appt.doctorId) === String(doctor.id)) return finishInfo(ctx, card, tc(ctx, 'doctorAlready', { patient: appt.patientName, doctor: doctor.name }));
  if (!(await confirmChange(ctx, card, tc(ctx, 'confirmAssignDoctor', { patient: appt.patientName, when: whenOf(ctx, appt).speech, doctor: doctor.name })))) return;
  await applyChange(ctx, card, () => getCalendarVoice()!.actions.reassign(appt, { doctor }), tc(ctx, 'assignDoctorDone', { patient: appt.patientName, doctor: doctor.name }));
}

registerVoiceCommand<AssignDoctorParsed, CalendarVoiceAiResult>({
  id: 'calendar.assign_doctor',
  domain: CALENDAR_VOICE_DOMAIN,
  priority: 31,
  match: (normalized) => {
    const state = getCalendarVoice()?.state;
    if (!state) return null;
    return parseCalendarAssignDoctor(normalized, asOptions(state.doctors), asOptions(state.services));
  },
  run: runAssignDoctor,
  ai: {
    from: (r) => (r.intent === 'calendar.assign_doctor' && r.doctor_id && hasAiRef(r) ? { ref: aiRef(r), doctorIds: [r.doctor_id], doctorSaid: null } : null),
  },
});

// ── Duración ──────────────────────────────────────────────────────────────────

interface DurationParsed extends CalendarAppointmentRef { minutes: number }

async function runDuration(parsed: DurationParsed, ctx: VoiceCommandContext) {
  const title = tc(ctx, 'durationTitle');
  if (!ctx.hasPermission(BUSINESS_CONFIG_PERMISSIONS.APPOINTMENT_UPDATE)) return deny(ctx, title);
  const bridge = await needCalendar(ctx, title);
  if (!bridge) return;
  const appt = await resolveAppointment(ctx, parsed, title, (a) => canReschedule(normalizeAppointmentStatus(a.status)));
  if (!appt) return;
  const start = appointmentStart(appt);
  const end = appt.end?.dateTime ? parseISO(appt.end.dateTime.replace(/Z$/, '')) : null;
  if (!start || !end) {
    await finishInfo(ctx, { title }, ctx.t('VoiceCommands.genericError'), 'error');
    return;
  }
  const current = differenceInMinutes(end, start);
  const nextEnd = addMinutes(start, parsed.minutes);
  const card: VoiceCard = {
    title,
    subtitle: appt.patientName,
    rows: [
      { label: tc(ctx, 'when'), value: whenOf(ctx, appt).card },
      { label: tc(ctx, 'duration'), value: `${tc(ctx, 'minutes', { minutes: current })} → ${tc(ctx, 'minutes', { minutes: parsed.minutes })}`, tone: 'warning' },
      { label: tc(ctx, 'endsAt'), value: timeText(nextEnd) },
    ],
  };
  if (current === parsed.minutes) return finishInfo(ctx, card, tc(ctx, 'durationAlready', { patient: appt.patientName, minutes: parsed.minutes }));
  const speech = tc(ctx, 'confirmDuration', { patient: appt.patientName, when: whenOf(ctx, appt).speech, minutes: parsed.minutes, end: timeText(nextEnd) });
  if (!(await confirmChange(ctx, card, speech))) return;
  await applyChange(ctx, card, () => getCalendarVoice()!.actions.retime(appt, start, nextEnd), tc(ctx, 'durationDone', { patient: appt.patientName, end: timeText(nextEnd) }));
}

registerVoiceCommand<DurationParsed, CalendarVoiceAiResult>({
  id: 'calendar.duration',
  domain: CALENDAR_VOICE_DOMAIN,
  priority: 32,
  match: (normalized) => parseCalendarDuration(normalized),
  run: runDuration,
  ai: {
    from: (r) => (r.intent === 'calendar.duration' && r.minutes && hasAiRef(r) ? { minutes: r.minutes, ...aiRef(r) } : null),
  },
});

// ── Borrar ────────────────────────────────────────────────────────────────────

async function runDelete(parsed: CalendarAppointmentRef, ctx: VoiceCommandContext) {
  const title = tc(ctx, 'deleteTitle');
  if (!ctx.hasPermission(BUSINESS_CONFIG_PERMISSIONS.APPOINTMENT_DELETE)) return deny(ctx, title);
  const bridge = await needCalendar(ctx, title);
  if (!bridge) return;
  const appt = await resolveAppointment(ctx, parsed, title);
  if (!appt) return;
  const card: VoiceCard = { title, subtitle: appt.patientName, rows: appointmentRows(ctx, appt) };
  if (!(await confirmChange(ctx, card, tc(ctx, 'confirmDelete', { patient: appt.patientName, when: whenOf(ctx, appt).speech }), true))) return;
  await applyChange(ctx, card, () => getCalendarVoice()!.actions.deleteAppointment(appt), tc(ctx, 'deleteDone', { patient: appt.patientName }));
}

registerVoiceCommand<CalendarAppointmentRef, CalendarVoiceAiResult>({
  id: 'calendar.delete',
  domain: CALENDAR_VOICE_DOMAIN,
  priority: 32,
  match: (normalized) => parseCalendarDelete(normalized),
  run: runDelete,
  ai: { from: (r) => (r.intent === 'calendar.delete' && hasAiRef(r) ? aiRef(r) : null) },
});

// ── Abrir lo del paciente, la sesión clínica o el cobro rápido ────────────────

interface OpenParsed extends CalendarAppointmentRef { target: CalendarOpenTarget }

async function runOpen(parsed: OpenParsed, ctx: VoiceCommandContext) {
  const title = tc(ctx, `open_${parsed.target}`);
  const bridge = await needCalendar(ctx, title);
  if (!bridge) return;
  const appt = await resolveAppointment(ctx, parsed, title, (a) => !INACTIVE.includes(a.status as string) || parsed.target !== 'session');
  if (!appt) return;
  const card: VoiceCard = { title, subtitle: appt.patientName, rows: appointmentRows(ctx, appt) };
  const result = getCalendarVoice()?.actions.openAppointmentTool(appt, parsed.target);
  if (result === 'denied') return deny(ctx, title);
  if (result === 'noPatient') return finishInfo(ctx, card, tc(ctx, 'noPatientLinked'), 'error');
  await finishInfo(ctx, card, tc(ctx, 'opened', { what: title, patient: appt.patientName }), 'success');
}

registerVoiceCommand<OpenParsed, CalendarVoiceAiResult>({
  id: 'calendar.open',
  domain: CALENDAR_VOICE_DOMAIN,
  priority: 27,
  match: (normalized) => parseCalendarOpen(normalized),
  run: runOpen,
  ai: { from: (r) => (r.intent === 'calendar.open' && r.target && hasAiRef(r) ? { target: r.target, ...aiRef(r) } : null) },
});

// ── Bloquear / habilitar horario ──────────────────────────────────────────────

interface SlotParsed extends CalendarSlotParsed {
  /** El motivo con tildes, de la frase original. */
  noteRaw: string | null;
  sedeId: string | null;
}

const hm = (min: number) => (min >= 24 * 60 ? '24:00' : `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`);

/** Lo dicho como franja ("de 15 a 17", "desde las 10", "todo el día"), o null. */
function readWindow(answer: string): { startMin: number | null; endMin: number | null } | null {
  const parsed = parseCalendarSlot(`bloquea ${normalizeSpeech(answer)}`);
  return parsed && (parsed.startMin !== null || parsed.endMin !== null) ? { startMin: parsed.startMin, endMin: parsed.endMin } : null;
}

/** Completa la franja: con solo el inicio dura una hora; con solo el fin, empieza una hora antes. */
function fullWindow(startMin: number | null, endMin: number | null): { startMin: number; endMin: number } | null {
  if (startMin === null && endMin === null) return null;
  const start = startMin ?? Math.max(0, (endMin as number) - 60);
  const end = endMin ?? Math.min(24 * 60, start + 60);
  return end > start ? { startMin: start, endMin: end } : null;
}

const slotOpen = (s: CalendarVoiceState) => !!s.slotDialog?.status && !s.slotDialog.status.checking;

async function runSlot(parsed: SlotParsed, ctx: VoiceCommandContext) {
  const block = parsed.kind === 'block';
  const title = tc(ctx, block ? 'blockTitle' : 'enableTitle');
  const may = block
    ? ctx.hasPermission(BUSINESS_CONFIG_PERMISSIONS.HOLIDAYS_CREATE)
    : [BUSINESS_CONFIG_PERMISSIONS.HOLIDAYS_CREATE, BUSINESS_CONFIG_PERMISSIONS.HOLIDAYS_UPDATE, BUSINESS_CONFIG_PERMISSIONS.HOLIDAYS_DELETE].some((p) => ctx.hasPermission(p));
  if (!may) return deny(ctx, title);
  const bridge = await needCalendar(ctx, title);
  if (!bridge) return;

  const dayKey = parsed.date ?? dayKeyOf(startOfToday());
  let sedeId: string | undefined = parsed.sedeId ?? undefined;
  if (!sedeId && parsed.sedeSaid) {
    const sede = bestByName(parsed.sedeSaid, bridge.state.sedes, (s) => s.name);
    if (!sede || sede.score <= 0) {
      const message = tc(ctx, 'sedeNotFound', { name: parsed.sedeSaid });
      await ctx.finish({ title, message, tone: 'error' }, message);
      return;
    }
    sedeId = String(sede.item.id);
  }

  let window = fullWindow(parsed.startMin, parsed.endMin);
  for (let attempt = 0; !window && attempt < MAX_UNCLEAR; attempt++) {
    const question = tc(ctx, attempt ? 'whichHoursAgain' : 'whichHours');
    const answer = await ctx.ask({ title, subtitle: dayText(ctx, dayKey).card, message: question, tone: 'confirm' }, question);
    const read = readWindow(answer);
    window = read ? fullWindow(read.startMin, read.endMin) : null;
  }
  if (!window) return finishInfo(ctx, { title }, ctx.t('VoiceCommands.nothingChanged'));

  const opened = getCalendarVoice()?.actions.openSlotDialog({ kind: parsed.kind, day: parseDayKey(dayKey), sedeId, ...window });
  if (opened !== 'opened') return finishInfo(ctx, { title }, tc(ctx, 'slotUnavailable'), 'error');
  if (parsed.noteRaw) getCalendarVoice()?.actions.controlSlotDialog({ notes: parsed.noteRaw });
  ctx.show({ title, message: tc(ctx, 'slotChecking'), tone: 'info' });
  let state = await waitForCalendar(slotOpen, { signal: ctx.signal, timeoutMs: 15000, settleMs: 150 });
  const scopeName = () => {
    const sid = sedeId ?? getCalendarVoice()?.state.timelineSedeId;
    return sid ? getCalendarVoice()?.state.sedes.find((s) => String(s.id) === sid)?.name ?? '' : tc(ctx, 'allBranches');
  };
  const close = () => getCalendarVoice()?.actions.closeSlotDialog();

  let unclear = 0;
  for (;;) {
    if (ctx.signal.aborted) return;
    const status = state?.slotDialog?.status;
    if (!status) return finishInfo(ctx, { title }, ctx.t('VoiceCommands.genericError'), 'error');
    const from = hm(status.startMin ?? window.startMin);
    const to = hm(status.endMin ?? window.endMin);
    const rows: VoiceCardRow[] = [
      { label: tc(ctx, 'when'), value: `${dayText(ctx, dayKey).card} ${from}–${to}`, tone: 'warning' },
      { label: tc(ctx, 'scope'), value: scopeName() },
    ];
    if (parsed.noteRaw) rows.push({ label: tc(ctx, 'reason'), value: parsed.noteRaw });
    if (status.affected) rows.push({ label: tc(ctx, 'affected'), value: String(status.affected), tone: 'danger' });
    const card: VoiceCard = { title, rows };
    if (status.missingPermission) { close(); return deny(ctx, title); }
    if (status.noChange) { close(); return finishInfo(ctx, card, tc(ctx, block ? 'slotAlreadyBlocked' : 'slotAlreadyOpen')); }
    // Aperturas que no se pueden recortar desde acá: el diálogo explica cuáles, queda abierto.
    if (status.locked) return finishInfo(ctx, card, tc(ctx, 'slotLocked'), 'error');
    if (!status.canSubmit) return finishInfo(ctx, card, tc(ctx, 'slotCannot'), 'error');

    const speech = `${tc(ctx, block ? 'confirmBlock' : 'confirmEnable', { date: dayText(ctx, dayKey).speech, from, to, scope: scopeName() })}${status.affected ? ` ${tc(ctx, 'slotAffected', { count: status.affected })}` : ''}`;
    const answer = await ctx.ask({ ...card, message: unclear ? tc(ctx, 'sayYesNoOrHours') : tc(ctx, 'slotConfirmHint'), tone: status.affected ? 'danger' : 'confirm' }, unclear ? tc(ctx, 'sayYesNoOrHours') : speech, 'confirm');
    const normalized = normalizeSpeech(answer);
    const corrected = readWindow(answer);
    if (corrected) {
      const next = fullWindow(corrected.startMin ?? status.startMin, corrected.endMin ?? status.endMin);
      if (next) {
        getCalendarVoice()?.actions.controlSlotDialog(next);
        state = await waitForCalendar(
          (s) => slotOpen(s) && s.slotDialog!.status!.startMin === next.startMin && Math.min(s.slotDialog!.status!.endMin ?? 0, 24 * 60) >= Math.min(next.endMin, 24 * 60 - 1),
          { signal: ctx.signal, timeoutMs: 10000, settleMs: 150 },
        ) ?? getCalendarVoice()?.state ?? null;
        unclear = 0;
        continue;
      }
    }
    const yesNo = parseYesNo(normalized);
    if (yesNo === 'no') { close(); return finishInfo(ctx, card, ctx.t('VoiceCommands.nothingChanged')); }
    if (yesNo !== 'yes') {
      if (++unclear > MAX_UNCLEAR) { close(); return finishInfo(ctx, card, ctx.t('VoiceCommands.nothingChanged')); }
      continue;
    }

    ctx.show({ ...card, message: tc(ctx, 'saving'), tone: 'info' });
    getCalendarVoice()?.actions.controlSlotDialog({ submit: true });
    const after = await waitForCalendar(
      (s) => !s.slotDialog || (!!s.slotDialog.status?.error && !s.slotDialog.status.saving),
      { signal: ctx.signal, timeoutMs: 30000 },
    );
    if (ctx.signal.aborted) return;
    if (after && !after.slotDialog) {
      return finishInfo(ctx, card, tc(ctx, block ? 'blockDone' : 'enableDone', { date: dayText(ctx, dayKey).speech, from, to }), 'success');
    }
    return finishInfo(ctx, card, after?.slotDialog?.status?.error || tc(ctx, 'actionFailed'), 'error');
  }
}

registerVoiceCommand<SlotParsed, CalendarVoiceAiResult>({
  id: 'calendar.slot',
  domain: CALENDAR_VOICE_DOMAIN,
  priority: 35,
  match: (normalized, raw) => {
    const parsed = parseCalendarSlot(normalized);
    return parsed ? { ...parsed, noteRaw: parsed.note ? rawPhrase(raw, parsed.note) : null, sedeId: null } : null;
  },
  run: runSlot,
  ai: {
    from: (r) => {
      if (r.intent !== 'calendar.block' && r.intent !== 'calendar.enable') return null;
      const start = parseTimeKey(r.time);
      const end = parseTimeKey(r.end_time);
      return {
        kind: r.intent === 'calendar.block' ? 'block' : 'enable',
        date: r.date,
        startMin: start ? start.hour * 60 + start.minute : null,
        endMin: end ? (end.hour === 23 && end.minute === 59 ? 24 * 60 : end.hour * 60 + end.minute) : null,
        sedeSaid: null,
        sedeId: r.sede_ids[0] ?? null,
        note: r.title,
        noteRaw: r.title,
      };
    },
  },
});

// ── Recordatorios y notas ─────────────────────────────────────────────────────

interface ReminderParsed {
  type: 'reminder' | 'note';
  date: string | null;
  time: SpokenTime | null;
  /** Título con tildes y mayúsculas (de la frase original). */
  title: string | null;
}

const capitalize = (text: string) => (text ? text.charAt(0).toUpperCase() + text.slice(1) : text);
const TITLE_ANSWER = /^(?:que diga|que dice|el titulo|titulo|el texto|texto|poner|pone|pon)\s+/i;

async function runReminder(parsed: ReminderParsed, ctx: VoiceCommandContext) {
  const title = tc(ctx, parsed.type === 'note' ? 'noteTitle' : 'reminderTitle');
  const bridge = await needCalendar(ctx, title);
  if (!bridge) return;
  const dayKey = parsed.date ?? dayKeyOf(startOfToday());
  let time = parsed.time;
  for (let attempt = 0; !time && attempt < MAX_UNCLEAR; attempt++) {
    const question = tc(ctx, attempt ? 'whatTimeAgain' : 'reminderWhatTime');
    time = parseTimeAnswer(normalizeSpeech(await ctx.ask({ title, subtitle: dayText(ctx, dayKey).card, message: question, tone: 'confirm' }, question)));
  }
  if (!time) return finishInfo(ctx, { title }, ctx.t('VoiceCommands.nothingChanged'));
  let text = parsed.title;
  if (!text) {
    const question = tc(ctx, 'reminderWhatTitle');
    text = (await ctx.ask({ title, subtitle: dayText(ctx, dayKey).card, message: question, tone: 'confirm' }, question)).trim().replace(TITLE_ANSWER, '');
    if (!normalizeSpeech(text)) return finishInfo(ctx, { title }, ctx.t('VoiceCommands.nothingChanged'));
  }
  text = capitalize(text);

  let start = set(parseDayKey(dayKey), { hours: time.hour, minutes: time.minute, seconds: 0, milliseconds: 0 });
  const open = () => getCalendarVoice()?.actions.openReminderForm({ type: parsed.type, start, title: text });
  open();
  if (!(await waitForCalendar((s) => !!s.reminderForm, { signal: ctx.signal, timeoutMs: 3000, settleMs: 200 }))) {
    return finishInfo(ctx, { title }, tc(ctx, 'reminderFormNotOpened'), 'error');
  }

  let unclear = 0;
  for (;;) {
    const card: VoiceCard = {
      title,
      rows: [
        { label: tc(ctx, 'when'), value: `${dayText(ctx, dayKeyOf(start)).card} ${timeText(start)}` },
        { label: tc(ctx, 'text'), value: text },
      ],
    };
    const speech = tc(ctx, 'confirmReminder', { date: dayText(ctx, dayKeyOf(start)).speech, time: timeText(start), title: text });
    const answer = await ctx.ask({ ...card, message: unclear ? tc(ctx, 'reminderSayYesNoOrChange') : tc(ctx, 'reminderConfirmHint'), tone: 'confirm' }, unclear ? tc(ctx, 'reminderSayYesNoOrChange') : speech, 'confirm');
    const normalized = normalizeSpeech(answer);
    const yesNo = parseYesNo(normalized);
    if (yesNo === 'yes' && normalized.split(' ').length <= 3) break;
    if (yesNo === 'no' && normalized.split(' ').length <= 2) {
      getCalendarVoice()?.actions.closeReminderForm();
      return finishInfo(ctx, card, ctx.t('VoiceCommands.nothingChanged'));
    }
    // Correcciones: otra hora ("a las 11") o otro texto ("que diga …").
    const newTime = parseTimeAnswer(normalized);
    if (TITLE_ANSWER.test(normalized)) {
      text = capitalize(answer.trim().replace(TITLE_ANSWER, ''));
      open();
      unclear = 0;
      continue;
    }
    if (newTime) {
      start = set(start, { hours: newTime.hour, minutes: newTime.minute });
      open();
      unclear = 0;
      continue;
    }
    if (++unclear > MAX_UNCLEAR) {
      getCalendarVoice()?.actions.closeReminderForm();
      return finishInfo(ctx, card, ctx.t('VoiceCommands.nothingChanged'));
    }
  }

  const card: VoiceCard = { title, rows: [{ label: tc(ctx, 'when'), value: `${dayText(ctx, dayKeyOf(start)).card} ${timeText(start)}` }, { label: tc(ctx, 'text'), value: text }] };
  ctx.show({ ...card, message: tc(ctx, 'saving'), tone: 'info' });
  getCalendarVoice()?.actions.submitReminderForm();
  const after = await waitForCalendar(
    (s) => !s.reminderForm || (!!s.reminderForm.error && !s.reminderForm.saving),
    { signal: ctx.signal, timeoutMs: 20000, settleMs: 100 },
  );
  if (ctx.signal.aborted) return;
  if (after && !after.reminderForm) return finishInfo(ctx, card, tc(ctx, parsed.type === 'note' ? 'noteDone' : 'reminderDone'), 'success');
  await finishInfo(ctx, card, after?.reminderForm?.error || tc(ctx, 'formLeftOpen'), 'error');
}

registerVoiceCommand<ReminderParsed, CalendarVoiceAiResult>({
  id: 'calendar.reminder',
  domain: CALENDAR_VOICE_DOMAIN,
  priority: 36,
  match: (normalized, raw) => {
    const parsed = parseCalendarReminder(normalized);
    return parsed ? { ...parsed, title: parsed.title ? rawPhrase(raw, parsed.title) : null } : null;
  },
  run: runReminder,
  ai: {
    from: (r) => (r.intent === 'calendar.reminder'
      ? { type: r.reminder_type ?? 'reminder', date: r.date, time: parseTimeKey(r.time), title: r.title }
      : null),
  },
});

/** Los recordatorios del día que calzan con la hora y/o las palabras dichas. */
function findReminders(state: CalendarVoiceState, parsed: CalendarReminderActionParsed, dayKey: string): CalendarReminder[] {
  let list = state.reminders.filter((r) => r.start_datetime?.slice(0, 10) === dayKey);
  if (parsed.time) {
    const hhmm = `${String(parsed.time.hour).padStart(2, '0')}:${String(parsed.time.minute).padStart(2, '0')}`;
    const exact = list.filter((r) => r.start_datetime.slice(11, 16) === hhmm);
    list = exact.length ? exact : list.filter((r) => Number(r.start_datetime.slice(11, 13)) === parsed.time!.hour);
  }
  if (parsed.text) {
    const scored = list.map((r) => ({ r, score: nameScore(parsed.text!, r.title) })).filter((x) => x.score >= 0.5);
    const best = Math.max(0, ...scored.map((x) => x.score));
    list = scored.filter((x) => x.score === best).map((x) => x.r);
  }
  return list.sort((a, b) => a.start_datetime.localeCompare(b.start_datetime));
}

async function runReminderAction(parsed: CalendarReminderActionParsed, ctx: VoiceCommandContext) {
  const title = tc(ctx, parsed.action === 'done' ? 'reminderDoneTitle' : 'reminderDeleteTitle');
  const bridge = await needCalendar(ctx, title);
  if (!bridge) return;
  const dayKey = parsed.date ?? dayKeyOf(startOfToday());
  ctx.show({ title, message: tc(ctx, 'lookingReminder'), tone: 'info' });
  const state = await showDay(ctx, parseDayKey(dayKey));
  if (!state) return;
  const found = findReminders(state, parsed, dayKey).filter((r) => parsed.action === 'delete' || r.status !== 'done');
  if (!found.length) {
    const message = tc(ctx, 'reminderNotFound', { date: dayText(ctx, dayKey).speech });
    await ctx.finish({ title, message, tone: 'error' }, message);
    return;
  }
  let reminder = found[0];
  if (found.length > 1) {
    const choices = found.slice(0, 6);
    const index = await ctx.choose(
      { title, message: tc(ctx, 'whichReminder'), choices: choices.map((r) => ({ label: `${r.start_datetime.slice(11, 16)} · ${r.title}` })), tone: 'confirm' },
      tc(ctx, 'whichReminderSpeech', { count: choices.length }),
    );
    reminder = choices[index];
  }
  const when = reminder.start_datetime.slice(11, 16);
  const card: VoiceCard = { title, subtitle: reminder.title, rows: [{ label: tc(ctx, 'when'), value: `${dayText(ctx, dayKey).card} ${when}` }] };
  const actions = getCalendarVoice()!.actions;
  if (parsed.action === 'done') {
    if (!(await confirmChange(ctx, card, tc(ctx, 'confirmReminderDone', { title: reminder.title, time: when })))) return;
    await applyChange(ctx, card, () => actions.markReminderDone(reminder), tc(ctx, 'reminderMarkedDone', { title: reminder.title }));
    return;
  }
  let scope: 'occurrence' | 'series' = 'occurrence';
  if (isRecurringReminder(reminder)) {
    const labels = [tc(ctx, 'scopeOccurrence'), tc(ctx, 'scopeSeries')];
    const index = await ctx.choose({ ...card, message: tc(ctx, 'whichScope'), choices: labels.map((label) => ({ label })), tone: 'danger' }, tc(ctx, 'whichScope'));
    scope = index === 1 ? 'series' : 'occurrence';
  }
  if (!(await confirmChange(ctx, card, tc(ctx, 'confirmReminderDelete', { title: reminder.title, time: when }), true))) return;
  await applyChange(ctx, card, () => actions.deleteReminder(reminder, scope), tc(ctx, 'reminderDeleted', { title: reminder.title }));
}

registerVoiceCommand<CalendarReminderActionParsed, CalendarVoiceAiResult>({
  id: 'calendar.reminder_action',
  domain: CALENDAR_VOICE_DOMAIN,
  priority: 36,
  match: (normalized) => parseCalendarReminderAction(normalized),
  run: runReminderAction,
  ai: {
    from: (r) => (r.intent === 'calendar.reminder_done' || r.intent === 'calendar.reminder_delete'
      ? {
        action: r.intent === 'calendar.reminder_done' ? 'done' : 'delete',
        date: r.date,
        time: parseTimeKey(r.time),
        text: r.title ? normalizeSpeech(r.title) : null,
      }
      : null),
  },
});

// ── Barra: imprimir / actualizar ──────────────────────────────────────────────

async function runToolbar(parsed: CalendarToolbarParsed, ctx: VoiceCommandContext) {
  const title = tc(ctx, parsed.action === 'print' ? 'printTitle' : 'refreshTitle');
  const bridge = await needCalendar(ctx, title);
  if (!bridge) return;
  if (parsed.action === 'print') bridge.actions.print();
  else bridge.actions.refresh();
  await finishInfo(ctx, { title }, tc(ctx, parsed.action === 'print' ? 'printOpened' : 'refreshed'), 'success');
}

registerVoiceCommand<CalendarToolbarParsed, CalendarVoiceAiResult>({
  id: 'calendar.toolbar',
  domain: CALENDAR_VOICE_DOMAIN,
  priority: 6,
  match: (normalized) => parseCalendarToolbar(normalized),
  run: runToolbar,
  ai: {
    from: (r) => (r.intent === 'calendar.print' ? { action: 'print' } : r.intent === 'calendar.refresh' ? { action: 'refresh' } : null),
  },
});

