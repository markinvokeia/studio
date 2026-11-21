import { format, set, startOfToday } from 'date-fns';

import { getCalendarVoice, waitForCalendar, type CalendarVoiceFormPatch, type CalendarVoiceFormRequest } from '@/lib/voice/calendar-bridge';
import { getAppointmentFocus, hasAppointmentFocus, setAppointmentFocus } from '@/lib/voice/focus';
import { interpretWithAi } from '@/lib/voice/ai';
import { extractFormCalendar, extractFormEndTime, isFormCancel, isFormSave, parseFormNotes, parseFormPatient, type FormNotesParsed } from '@/lib/voice/commands/calendar-form-parse';
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
import {
  appointmentWordIndexes,
  editAppointmentRef,
  extractCreateEntities,
  extractSpokenDate,
  extractSpokenTime,
  findDoctorMention,
  findServiceMentions,
  isNoneAnswer,
  parseCalendarCreate,
  parseCalendarEdit,
  parseCalendarReschedule,
  parseCalendarStatus,
  parseTimeAnswer,
  parseTimeKey,
  serviceEditMode,
  stripFiller,
  timeKey,
  VOICE_CANCELLATION_REASONS,
  type CalendarAppointmentRef,
  type CalendarCreateParsed,
  type CalendarEditParsed,
  type CalendarRescheduleParsed,
  type CalendarStatusParsed,
  type NamedOption,
  type ServiceEditMode,
  type SpokenTime,
} from '@/lib/voice/commands/calendar-parse';
import { normalizeSpeech, parseYesNo } from '@/lib/voice/parse';
import { registerVoiceCommand } from '@/lib/voice/registry';
import { REQUEST_TIMEOUT_MS } from '@/services/api';
import { searchPatients } from '@/services/users';

import { canReschedule } from '@/constants/appointment-status';
import { BUSINESS_CONFIG_PERMISSIONS } from '@/constants/permissions';
import type { Appointment, AppointmentStatus, Calendar, CalendarVoiceAiPlanResult, CalendarVoiceAiResult, Service, User, VoiceCard, VoiceCardRow, VoiceCommandContext } from '@/lib/types';

/**
 * Calendario por voz — lo que cambia citas. Siempre se confirma antes, leyendo paciente, día y
 * hora (así se nota si entendió otra cita):
 *   "Ana Gómez llegó", "la de las 10 no vino", "confirmá la cita de Juan del lunes"
 *   "cancelá la de las 3 sin aviso"     → cancelar pide el motivo si no se dijo
 *   "nueva cita para Ana Gómez el lunes a las 10 con el doctor Pérez, limpieza"
 *                                        → abre el formulario de siempre completo; «sí» lo guarda
 *   "pasá la cita de Ana al viernes a las 11"
 *                                        → abre Reprogramar completo; «sí» lo guarda
 * Los permisos y las validaciones son los de la pantalla (el formulario hace las suyas).
 */

const MAX_CHOICES = 6;
const DANGER: AppointmentStatus[] = ['cancelled', 'no_show'];

const statusLabel = (ctx: VoiceCommandContext, status: AppointmentStatus) => ctx.t(`AppointmentStatus.${status}`);

export function whenOf(ctx: VoiceCommandContext, appt: Appointment) {
  const start = appointmentStart(appt);
  if (!start) return { card: '—', speech: '' };
  const day = dayText(ctx, dayKeyOf(start));
  return { card: `${day.card} ${timeText(start)}`, speech: tc(ctx, 'dayAtTime', { date: day.speech, time: timeText(start) }) };
}

export function appointmentRows(ctx: VoiceCommandContext, appt: Appointment): VoiceCardRow[] {
  return [
    { label: tc(ctx, 'when'), value: whenOf(ctx, appt).card },
    ...(appt.doctorName ? [{ label: tc(ctx, 'doctor'), value: appt.doctorName }] : []),
  ];
}

export async function deny(ctx: VoiceCommandContext, title: string) {
  await ctx.finish({ title, message: ctx.t('VoiceCommands.noPermission'), tone: 'error' }, ctx.t('VoiceCommands.noPermission'));
}

// ── ¿De qué cita se habla? ────────────────────────────────────────────────────

const matchesTime = (appt: Appointment, time: SpokenTime) => {
  const start = appointmentStart(appt);
  return !!start && start.getHours() === time.hour && start.getMinutes() === time.minute;
};
const matchesHour = (appt: Appointment, time: SpokenTime) => appointmentStart(appt)?.getHours() === time.hour;

/** Filtra por hora (exacta, o si no la misma hora) y por nombre (los que mejor coinciden). */
function narrow(pool: Appointment[], ref: CalendarAppointmentRef): Appointment[] {
  let list = pool;
  if (ref.time) {
    const exact = list.filter((a) => matchesTime(a, ref.time!));
    list = exact.length ? exact : list.filter((a) => matchesHour(a, ref.time!));
  }
  if (ref.patient) {
    const scored = list.map((a) => ({ a, score: nameScore(ref.patient!, a.patientName || '') })).filter((x) => x.score >= 0.5);
    const best = Math.max(0, ...scored.map((x) => x.score));
    list = scored.filter((x) => x.score === best).map((x) => x.a);
  }
  return list;
}

/**
 * La cita a la que se refiere la frase: primero entre las del día (el dicho, u hoy), con los
 * filtros de la pantalla y si no sin ellos; si se dijo un paciente y no está, con el buscador
 * (la más cercana a hoy). Si hay varias, pregunta. null si no la encontró (ya lo dijo).
 */
export async function resolveAppointment(
  ctx: VoiceCommandContext,
  ref: CalendarAppointmentRef,
  title: string,
  accept: (appt: Appointment) => boolean = () => true,
): Promise<Appointment | null> {
  const bridge = getCalendarVoice();
  if (!bridge) return null;
  // Sin nombrar ninguna: la que está en foco (la última elegida por voz).
  if (!ref.patient && !ref.time && !ref.date) {
    const focused = getAppointmentFocus();
    if (focused && (focused.status as string) !== 'deleted' && accept(focused)) {
      const fresh = bridge.state.appointments.find((a) => String(a.id) === String(focused.id)) ?? focused;
      return fresh;
    }
  }
  const dayKey = ref.date ?? dayKeyOf(startOfToday());
  ctx.show({ title, message: tc(ctx, 'lookingAppointment'), tone: 'info' });
  const state = await showDay(ctx, parseDayKey(dayKey));
  const usable = (list: Appointment[]) => list.filter((a) => (a.status as string) !== 'deleted' && accept(a));
  let candidates: Appointment[] = [];
  if (state) {
    const visible = usable(state.visibleAppointments.filter((a) => sameDay(a, dayKey)));
    candidates = narrow(visible, ref);
    if (!candidates.length) candidates = narrow(usable(state.appointments.filter((a) => sameDay(a, dayKey))), ref);
  }
  // Un paciente que no está ese día (y no se dijo el día): el buscador, la próxima o la última.
  if (!candidates.length && ref.patient && !ref.date) {
    const found = usable(await bridge.actions.searchAppointments(ref.patient));
    if (ctx.signal.aborted) return null;
    const now = Date.now();
    const narrowed = narrow(found, ref);
    const upcoming = narrowed.filter((a) => (appointmentStart(a)?.getTime() ?? 0) >= now - 60 * 60000).sort(byStart);
    candidates = upcoming.length ? upcoming : narrowed.sort(byStart).reverse();
  }
  if (!candidates.length && ref.patient && await ctx.tryAi()) return null;
  if (!candidates.length) {
    const who = ref.patient ?? (ref.time ? tc(ctx, 'atTime', { time: timeKey(ref.time) }) : '');
    const message = tc(ctx, 'appointmentNotFound', { who, date: dayText(ctx, dayKey).speech });
    await ctx.finish({ title, message, tone: 'error' }, message);
    return null;
  }
  candidates = [...candidates].sort(byStart);
  if (candidates.length === 1) {
    setAppointmentFocus(candidates[0]);
    return candidates[0];
  }
  const choices = candidates.slice(0, MAX_CHOICES);
  const index = await ctx.choose(
    {
      title,
      message: tc(ctx, 'whichAppointment'),
      choices: choices.map((a) => ({ label: `${whenOf(ctx, a).card} · ${a.patientName}`, detail: a.doctorName })),
      tone: 'confirm',
    },
    tc(ctx, 'whichAppointmentSpeech', { count: choices.length }),
  );
  setAppointmentFocus(choices[index]);
  return choices[index];
}

// ── Estados ───────────────────────────────────────────────────────────────────

async function runStatus(parsed: CalendarStatusParsed, ctx: VoiceCommandContext) {
  const title = tc(ctx, 'statusTitle');
  if (!ctx.hasPermission(BUSINESS_CONFIG_PERMISSIONS.APPOINTMENT_STATUS_UPDATE)) return deny(ctx, title);
  const bridge = await needCalendar(ctx, title);
  if (!bridge) return;
  const appt = await resolveAppointment(ctx, parsed, title);
  if (!appt) return;
  const base: VoiceCard = { title, subtitle: appt.patientName, rows: appointmentRows(ctx, appt) };
  const target = statusLabel(ctx, parsed.status);
  if (appt.status === parsed.status) {
    const message = tc(ctx, 'alreadyStatus', { patient: appt.patientName, status: target });
    await ctx.finish({ ...base, message, tone: 'info' }, message);
    return;
  }

  let reason = parsed.reason;
  if (parsed.status === 'cancelled' && !reason) {
    const labels = VOICE_CANCELLATION_REASONS.map((r) => ctx.t(`CancellationReason.${r}`));
    const index = await ctx.choose(
      { ...base, message: tc(ctx, 'whichReason'), choices: labels.map((label) => ({ label })), tone: 'danger' },
      tc(ctx, 'whichReasonSpeech', { reasons: labels.join(', ') }),
    );
    reason = VOICE_CANCELLATION_REASONS[index];
  }

  const rows: VoiceCardRow[] = [
    ...base.rows!,
    { label: tc(ctx, 'status'), value: `${statusLabel(ctx, appt.status)} → ${target}`, tone: DANGER.includes(parsed.status) ? 'danger' : 'warning' },
  ];
  if (reason) rows.push({ label: tc(ctx, 'reason'), value: ctx.t(`CancellationReason.${reason}`) });
  const danger = DANGER.includes(parsed.status);
  const speech = tc(ctx, 'confirmStatus', { patient: appt.patientName, when: whenOf(ctx, appt).speech, status: target });
  const ok = await ctx.confirm({ ...base, rows, message: tc(ctx, danger ? 'confirmDangerHint' : 'confirmHint'), tone: danger ? 'danger' : 'confirm' }, speech);
  if (!ok) {
    await ctx.finish({ ...base, rows, message: ctx.t('VoiceCommands.nothingChanged'), tone: 'info' }, ctx.t('VoiceCommands.nothingChanged'));
    return;
  }
  ctx.show({ ...base, rows, message: tc(ctx, 'saving'), tone: 'info' });
  const applied = await bridge.actions.changeStatus(appt, parsed.status, reason ? { cancellation_reason: reason } : undefined);
  if (ctx.signal.aborted) return;
  if (!applied) {
    const message = tc(ctx, 'statusFailed');
    await ctx.finish({ ...base, rows, message, tone: 'error' }, message);
    return;
  }
  const message = tc(ctx, 'statusDone', { patient: appt.patientName, status: target });
  await ctx.finish({ ...base, rows, message, tone: 'success' }, message);
}

registerVoiceCommand<CalendarStatusParsed, CalendarVoiceAiResult>({
  id: 'calendar.status',
  domain: CALENDAR_VOICE_DOMAIN,
  usesFocus: true,
  priority: 20,
  match: (normalized) => parseCalendarStatus(normalized),
  run: runStatus,
  ai: {
    from: (r) => (r.intent === 'calendar.status' && r.status
      ? { status: r.status, reason: r.cancellation_reason, patient: r.patient ? normalizeSpeech(r.patient) : null, time: parseTimeKey(r.time ?? r.from_time), date: r.date ?? r.from_date }
      : null),
  },
});

// ── Elegir doctor y tratamientos ──────────────────────────────────────────────

export const asOptions = (items: { id?: string | number | null; name?: string | null }[]): NamedOption[] =>
  items.flatMap((i) => (i?.id != null && i.name ? [{ id: String(i.id), name: i.name }] : []));

/** El de la lista con ese id; si son varios, pregunta cuál. null si ninguno. */
export async function pickOne<T extends { id: string | number; name: string }>(
  ctx: VoiceCommandContext,
  title: string,
  ids: string[],
  pool: T[],
  question: string,
): Promise<T | null> {
  const items = ids.map((id) => pool.find((p) => String(p.id) === id)).filter((p): p is T => !!p);
  if (items.length <= 1) return items[0] ?? null;
  const choices = items.slice(0, MAX_CHOICES);
  const index = await ctx.choose(
    { title, message: question, choices: choices.map((c) => ({ label: c.name })), tone: 'confirm' },
    `${question} ${choices.map((c, i) => `${i + 1}, ${c.name}`).join('. ')}.`,
  );
  return choices[index];
}

async function pickServices(ctx: VoiceCommandContext, title: string, groups: string[][], pool: Service[]): Promise<Service[]> {
  const picked: Service[] = [];
  for (const group of groups) {
    const service = await pickOne(ctx, title, group, pool, tc(ctx, 'whichService'));
    if (service && !picked.some((s) => String(s.id) === String(service.id))) picked.push(service);
  }
  return picked;
}

/** "¿Con qué doctor?" — por nombre o apellido; «sin doctor» lo deja vacío. */
async function askDoctor(ctx: VoiceCommandContext, title: string, doctors: User[], prefix?: string): Promise<User | null> {
  if (doctors.length === 1) return doctors[0];
  const options = asOptions(doctors);
  let prompt = `${prefix ? `${prefix} ` : ''}${tc(ctx, 'whichDoctor')}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    const answer = normalizeSpeech(await ctx.ask({ title, message: prompt, tone: 'confirm' }, prompt));
    if (isNoneAnswer(answer)) return null;
    const mention = findDoctorMention(answer, options, { bare: true });
    if (mention?.ids.length) return pickOne(ctx, title, mention.ids, doctors, tc(ctx, 'whichDoctorOf'));
    prompt = tc(ctx, 'doctorNotUnderstood');
  }
  return null;
}

/** "¿Qué tratamiento?" — uno o varios por nombre; «ninguno» sigue sin tratamiento. */
async function askServices(ctx: VoiceCommandContext, title: string, services: Service[]): Promise<Service[]> {
  const options = asOptions(services);
  if (!options.length) return [];
  let prompt = tc(ctx, 'whichServices');
  for (let attempt = 0; attempt < 2; attempt++) {
    const answer = normalizeSpeech(await ctx.ask({ title, message: prompt, tone: 'confirm' }, prompt));
    if (isNoneAnswer(answer)) return [];
    const groups = findServiceMentions(answer, options).map((m) => m.ids);
    if (groups.length) return pickServices(ctx, title, groups, services);
    prompt = tc(ctx, 'serviceNotUnderstood');
  }
  return [];
}

// ── Confirmar (o corregir) y guardar el formulario abierto ────────────────────

/** Lo que la voz sabe del formulario abierto (undefined = no se tocó, queda lo que tenía). */
interface FormDraft {
  start: Date;
  doctor?: User | null;
  services?: Service[];
  endTime?: string;
  calendar?: Calendar | null;
  patient?: User | null;
  notes?: string;
}

type FormEdit = { draft: FormDraft; patch: CalendarVoiceFormPatch; changes: string[] } | { notFound: string } | null;

/** Notas nuevas: agregadas a las que tenía el formulario, reemplazadas o borradas. */
function mergeNotes(current: string, notes: FormNotesParsed): string {
  if (notes.op === 'clear') return '';
  if (notes.op === 'replace' || !current.trim()) return notes.text;
  return `${current.trim()}\n${notes.text}`;
}

/**
 * Una corrección dicha con el formulario abierto: "con el doctor Pérez", "agregá limpieza",
 * "sacale el blanqueamiento", "mejor a las 11", "el viernes", "que termine a las 12",
 * "en el sillón 2", "nota: viene con la madre", "el paciente es Juan Pérez". null si no dice nada
 * de eso.
 */
async function readFormEdit(
  ctx: VoiceCommandContext,
  title: string,
  rawAnswer: string,
  draft: FormDraft,
): Promise<FormEdit> {
  const bridge = getCalendarVoice();
  const state = bridge?.state;
  if (!state) return null;
  const answer = normalizeSpeech(rawAnswer);

  // Notas: todo lo que sigue es el texto (puede tener horas o nombres que no son cambios).
  const notes = parseFormNotes(answer, rawAnswer);
  if (notes) {
    const current = bridge.actions.readAppointmentForm()?.notes ?? draft.notes ?? '';
    const merged = mergeNotes(current, notes);
    return {
      draft: { ...draft, notes: merged },
      patch: { notes: merged },
      changes: [notes.op === 'clear' ? tc(ctx, 'changeNotesCleared') : tc(ctx, 'changeNotes', { text: notes.text })],
    };
  }

  // Paciente: «el paciente es …».
  const patientSaid = parseFormPatient(answer);
  if (patientSaid) {
    const patient = await askPatient(ctx, title, patientSaid);
    if (!patient) return { notFound: tc(ctx, 'patientNotFound', { name: patientSaid }) };
    return { draft: { ...draft, patient }, patch: { patient }, changes: [tc(ctx, 'changePatient', { name: patient.name })] };
  }

  let text = answer;
  const next: FormDraft = { ...draft };
  const patch: CalendarVoiceFormPatch = {};
  const changes: string[] = [];

  // Hora de fin antes que la de inicio («hasta las 12» no es la hora de la cita).
  const end = extractFormEndTime(text);
  if (end) {
    const endTime = timeKey(end.time);
    next.endTime = endTime;
    patch.endTime = endTime;
    changes.push(tc(ctx, 'changeEndTime', { time: endTime }));
    text = end.rest;
  }

  // Consultorio / agenda.
  const calendarMention = extractFormCalendar(text);
  if (calendarMention) {
    let found = bestByName(calendarMention.said, state.calendars, (c) => c.name);
    // «chair 1» / «consultorio 2» con agendas que se llaman distinto: por el número, si hay una sola.
    const number = calendarMention.said.match(/\b(\d{1,3})\b/)?.[1];
    if ((!found || found.score < 0.5) && number) {
      const byNumber = state.calendars.filter((c) => new RegExp(`\\b${number}\\b`).test(c.name));
      if (byNumber.length === 1) found = { item: byNumber[0], score: 1 };
    }
    if (!found || found.score < 0.5) {
      if (!changes.length) return { notFound: tc(ctx, 'calendarNotFound', { name: calendarMention.said }) };
    } else {
      next.calendar = found.item;
      patch.calendar = found.item;
      changes.push(tc(ctx, 'changeCalendar', { name: found.item.name }));
      text = calendarMention.rest;
    }
  }

  const serviceMatches = findServiceMentions(text, asOptions(state.services));
  const skip = new Set(serviceMatches.flatMap((m) => Array.from({ length: m.end - m.start }, (_, i) => m.start + i)));
  const doctorMention = findDoctorMention(text, asOptions(state.doctors), { skip });
  const dropDoctor = !doctorMention?.ids.length && /\b(?:sin|saca\w*|quita\w*|borra\w*|remove|without)\b.*\b(?:doctor|doctora|profesional)\b/.test(text);
  const time = extractSpokenTime(` ${text} `);
  const date = extractSpokenDate(time ? time.rest : ` ${text} `, 'future');

  if (doctorMention && !doctorMention.ids.length && doctorMention.said && !serviceMatches.length && !time && !date && !changes.length) {
    return { notFound: tc(ctx, 'doctorNotFound', { name: doctorMention.said }) };
  }

  if (doctorMention?.ids.length) {
    const doctor = await pickOne(ctx, title, doctorMention.ids, state.doctors, tc(ctx, 'whichDoctorOf'));
    if (doctor) {
      next.doctor = doctor;
      patch.doctor = doctor;
      changes.push(tc(ctx, 'changeDoctor', { name: doctor.name }));
    }
  } else if (dropDoctor) {
    next.doctor = null;
    patch.doctor = null;
    changes.push(tc(ctx, 'changeNoDoctor'));
  }
  if (serviceMatches.length) {
    const named = await pickServices(ctx, title, serviceMatches.map((m) => m.ids), state.services);
    const current = bridge.actions.readAppointmentForm()?.services ?? draft.services ?? [];
    const mode = serviceEditMode(text);
    const services = mode === 'replace'
      ? named
      : mode === 'remove'
        ? current.filter((s) => !named.some((n) => String(n.id) === String(s.id)))
        : [...current, ...named.filter((n) => !current.some((s) => String(s.id) === String(n.id)))];
    next.services = services;
    patch.services = services;
    changes.push(services.length ? tc(ctx, 'changeServices', { names: services.map((s) => s.name).join(', ') }) : tc(ctx, 'changeNoServices'));
  }
  if (time || date) {
    const day = date ? parseDayKey(date.date) : draft.start;
    const start = set(day, {
      hours: time ? time.time.hour : draft.start.getHours(),
      minutes: time ? time.time.minute : draft.start.getMinutes(),
      seconds: 0,
      milliseconds: 0,
    });
    next.start = start;
    patch.start = start;
    changes.push(tc(ctx, 'dayAtTime', { date: dayText(ctx, dayKeyOf(start)).speech, time: format(start, 'HH:mm') }));
  }
  return changes.length ? { draft: next, patch, changes } : null;
}

/** Lo que la IA entendió como cambio al formulario (intent calendar.form_set). */
async function readFormEditWithAi(ctx: VoiceCommandContext, rawAnswer: string, draft: FormDraft): Promise<FormEdit | 'save' | 'cancel' | 'other'> {
  const bridge = getCalendarVoice();
  if (!bridge) return null;
  const snapshot = bridge.actions.readAppointmentForm();
  const answer = await interpretWithAi<CalendarVoiceAiPlanResult>(CALENDAR_VOICE_DOMAIN, rawAnswer, ctx, {
    form: {
      open: true,
      start: format(draft.start, "yyyy-MM-dd'T'HH:mm"),
      end_time: snapshot?.endTime ?? null,
      doctor_id: snapshot?.doctor?.id ? String(snapshot.doctor.id) : null,
      calendar_id: snapshot?.calendar?.id ? String(snapshot.calendar.id) : null,
      service_ids: (snapshot?.services ?? []).map((s) => String(s.id)),
      has_notes: !!snapshot?.notes?.trim(),
    },
  }).catch(() => null);
  if (!answer || answer.confidence < 0.5) return null;
  const step = answer.result.steps?.[0] ?? answer.result;
  if (step.intent === 'calendar.form_save') return 'save';
  if (step.intent === 'calendar.form_cancel') return 'cancel';
  if (step.intent !== 'calendar.form_set') return step.intent === 'unknown' ? null : 'other';
  const state = bridge.state;
  const next: FormDraft = { ...draft };
  const patch: CalendarVoiceFormPatch = {};
  const changes: string[] = [];
  if (step.doctor_id) {
    const doctor = state.doctors.find((d) => String(d.id) === step.doctor_id);
    if (doctor) { next.doctor = doctor; patch.doctor = doctor; changes.push(tc(ctx, 'changeDoctor', { name: doctor.name })); }
  }
  if (step.calendar_id) {
    const calendar = state.calendars.find((c) => String(c.id) === step.calendar_id);
    if (calendar) { next.calendar = calendar; patch.calendar = calendar; changes.push(tc(ctx, 'changeCalendar', { name: calendar.name })); }
  }
  if (step.service_ids.length || step.remove_service_ids.length) {
    const current = snapshot?.services ?? draft.services ?? [];
    const added = state.services.filter((s) => step.service_ids.includes(String(s.id)));
    const services = [...current.filter((s) => !step.remove_service_ids.includes(String(s.id))), ...added.filter((a) => !current.some((s) => String(s.id) === String(a.id)))];
    next.services = services;
    patch.services = services;
    changes.push(services.length ? tc(ctx, 'changeServices', { names: services.map((s) => s.name).join(', ') }) : tc(ctx, 'changeNoServices'));
  }
  if (step.date || step.time) {
    const day = step.date ? parseDayKey(step.date) : draft.start;
    const t = parseTimeKey(step.time);
    const start = set(day, { hours: t ? t.hour : draft.start.getHours(), minutes: t ? t.minute : draft.start.getMinutes(), seconds: 0, milliseconds: 0 });
    next.start = start;
    patch.start = start;
    changes.push(tc(ctx, 'dayAtTime', { date: dayText(ctx, dayKeyOf(start)).speech, time: format(start, 'HH:mm') }));
  }
  if (step.end_time) {
    next.endTime = step.end_time;
    patch.endTime = step.end_time;
    changes.push(tc(ctx, 'changeEndTime', { time: step.end_time }));
  }
  if (step.notes_op) {
    const merged = mergeNotes(snapshot?.notes ?? '', { op: step.notes_op, text: step.title ?? '' });
    next.notes = merged;
    patch.notes = merged;
    changes.push(step.notes_op === 'clear' ? tc(ctx, 'changeNotesCleared') : tc(ctx, 'changeNotes', { text: step.title ?? '' }));
  }
  if (step.patient) {
    const patient = await askPatient(ctx, tc(ctx, 'title'), normalizeSpeech(step.patient));
    if (patient) { next.patient = patient; patch.patient = patient; changes.push(tc(ctx, 'changePatient', { name: patient.name })); }
  }
  return changes.length ? { draft: next, patch, changes } : null;
}

/**
 * El formulario abierto queda «en manos de la voz»: cada frase cambia campos y vuelve a preguntar.
 * «Guardar / actualizar / sí» lo guarda (el mismo botón Guardar, con sus validaciones);
 * «cancelar» lo cierra sin guardar; «no» lo deja abierto (para seguir con el mouse). Lo que no es
 * del formulario pasa a ser un pedido nuevo (se pregunta si se deja este).
 */
async function confirmAndSave(
  ctx: VoiceCommandContext,
  card: (draft: FormDraft) => VoiceCard,
  speech: string,
  kind: 'create' | 'reschedule' | 'edit' | 'form',
  initial: FormDraft,
  /** Lo primero ya se dijo (el formulario se abrió a mano y se le habló): se aplica sin preguntar. */
  firstAnswer?: string,
) {
  let draft = initial;
  let pendingFirst = firstAnswer;
  const opened = await waitForCalendar((s) => s.form.kind !== null, { signal: ctx.signal, timeoutMs: 3000 });
  if (!opened) {
    const message = tc(ctx, 'formNotOpened');
    await ctx.finish({ ...card(draft), message, tone: 'error' }, message);
    return;
  }
  let prompt = speech;
  for (let unclear = 0; ;) {
    // La primera vez, cómo responder; después, lo que cambió o qué se espera (lo mismo que dice).
    const message = prompt === speech ? tc(ctx, 'formConfirmHint') : prompt;
    const raw = pendingFirst ?? await ctx.ask({ ...card(draft), message, tone: 'confirm' }, prompt, 'confirm', { corrections: true });
    pendingFirst = undefined;
    const answer = normalizeSpeech(raw);
    const bridge = getCalendarVoice();
    if (!bridge || !bridge.state.form.kind) {
      const message = tc(ctx, 'formClosed');
      await ctx.finish({ ...card(draft), message, tone: 'info' }, message);
      return;
    }
    if (isFormCancel(answer)) {
      bridge.actions.closeAppointmentForm();
      const message = tc(ctx, 'formCancelled');
      await ctx.finish({ ...card(draft), message, tone: 'info' }, message);
      return;
    }
    if (isFormSave(answer)) break;
    const yesNo = parseYesNo(answer);
    if (yesNo === 'yes') break;
    if (yesNo === 'no') {
      const message = tc(ctx, 'formLeftOpen');
      await ctx.finish({ ...card(draft), message, tone: 'info' }, message);
      return;
    }
    // Un verbo que no es de edición («exportá…», «andá a…», «buscá…»): primero es otro pedido.
    if (FOREIGN_TO_FORM.test(answer)) {
      const outcome = await ctx.handOff(raw);
      if (outcome === 'switched') return;
      if (outcome === 'handled') { prompt = tc(ctx, 'sayYesNoOrChange'); continue; }
    }
    let edit: FormEdit | 'save' | 'cancel' | 'other' = await readFormEdit(ctx, card(draft).title, raw, draft);
    // Lo local no lo entendió: la IA (con lo que tiene el formulario).
    if (!edit) edit = await readFormEditWithAi(ctx, raw, draft);
    if (edit === 'save') break;
    if (edit === 'cancel') {
      bridge.actions.closeAppointmentForm();
      const message = tc(ctx, 'formCancelled');
      await ctx.finish({ ...card(draft), message, tone: 'info' }, message);
      return;
    }
    if (edit && edit !== 'other' && 'notFound' in edit) {
      prompt = `${edit.notFound} ${tc(ctx, 'sayYesNoOrChange')}`;
      continue;
    }
    if (edit && edit !== 'other') {
      bridge.actions.patchAppointmentForm(edit.patch);
      draft = edit.draft;
      unclear = 0;
      prompt = tc(ctx, 'formUpdated', { changes: edit.changes.join(', ') });
      continue;
    }
    // No es del formulario: ¿un pedido nuevo? (la sesión pregunta si se deja este).
    const outcome = await ctx.handOff(raw);
    if (outcome === 'switched') return;
    if (outcome === 'handled') { prompt = tc(ctx, 'sayYesNoOrChange'); continue; }
    if (++unclear >= 3) {
      const message = tc(ctx, 'formLeftOpen');
      await ctx.finish({ ...card(draft), message, tone: 'info' }, message);
      return;
    }
    prompt = tc(ctx, 'sayYesNoOrChange');
  }

  const bridge = getCalendarVoice()!;
  ctx.show({ ...card(draft), message: tc(ctx, 'saving'), tone: 'info' });
  bridge.actions.submitAppointmentForm();
  // Empieza a guardar (o la validación lo frena enseguida)…
  await waitForCalendar((s) => s.form.saving || s.form.kind === null, { signal: ctx.signal, timeoutMs: 1500 });
  // …y termina: cerrado = guardado; abierto = falta algo o hay un aviso que responder.
  const done = await waitForCalendar((s) => !s.form.saving, { signal: ctx.signal, timeoutMs: REQUEST_TIMEOUT_MS.mutation + 5000, settleMs: 400 });
  if (ctx.signal.aborted) return;
  if (done && done.form.kind === null) {
    const message = tc(ctx, kind === 'create' ? 'createDone' : kind === 'edit' ? 'editDone' : kind === 'form' ? 'formSaved' : 'rescheduleDone');
    await ctx.finish({ ...card(draft), message, tone: 'success' }, message);
    return;
  }
  const message = tc(ctx, 'formNotSaved');
  await ctx.finish({ ...card(draft), message, tone: 'error' }, message);
}

// ── Nueva cita ────────────────────────────────────────────────────────────────

interface CreateResolved {
  date: string | null;
  time: SpokenTime | null;
  /** Paciente dicho (se busca). */
  patientName: string | null;
  /** Doctores que calzan con lo dicho (varios = preguntar). */
  doctorIds: string[];
  /** "doctor X" que no está en la lista. */
  doctorSaid: string | null;
  calendarId?: string | null;
  calendarName?: string | null;
  /** Un grupo por tratamiento nombrado (varios ids = preguntar). */
  serviceGroups: string[][];
}

/** Paciente, doctor, agenda y tratamientos de lo dicho, contra las listas de la pantalla. */
function resolveCreateRest(parsed: CalendarCreateParsed): CreateResolved {
  const state = getCalendarVoice()?.state;
  const found = extractCreateEntities(parsed.rest, asOptions(state?.doctors ?? []), asOptions(state?.services ?? []));
  return {
    date: parsed.date,
    time: parsed.time,
    patientName: found.patient,
    doctorIds: found.doctorIds,
    doctorSaid: found.doctorSaid,
    calendarName: found.calendarSaid,
    serviceGroups: found.serviceGroups,
  };
}

async function askPatient(ctx: VoiceCommandContext, title: string, said: string | null): Promise<User | null> {
  let name = said;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (!name) {
      const answer = await ctx.ask({ title, message: tc(ctx, 'whichPatientName'), tone: 'confirm' }, tc(ctx, 'whichPatientName'));
      name = stripFiller(normalizeSpeech(answer)) || null;
      if (!name) continue;
    }
    ctx.show({ title, message: tc(ctx, 'lookingFor', { name }), tone: 'info' });
    const found = await searchPatients(name, { signal: ctx.signal, timeoutMs: REQUEST_TIMEOUT_MS.mutation });
    if (found.length) {
      const exact = found.filter((p) => normalizeSpeech(p.name) === normalizeSpeech(name!));
      const pool = exact.length === 1 ? exact : found;
      let patient = pool[0];
      if (pool.length > 1) {
        const choices = pool.slice(0, MAX_CHOICES);
        const index = await ctx.choose(
          { title, message: tc(ctx, 'whichPatient'), choices: choices.map((p) => ({ label: p.name, detail: p.phone_number || undefined })), tone: 'confirm' },
          tc(ctx, 'whichPatientSpeech', { count: choices.length }),
        );
        patient = choices[index];
      }
      return { id: patient.id, name: patient.name, email: '', phone_number: patient.phone_number, is_active: true, avatar: '', doctor_id: patient.doctor_id } as User;
    }
    const message = tc(ctx, 'patientNotFound', { name });
    if (attempt === 1 || said === null) {
      await ctx.finish({ title, message, tone: 'error' }, message);
      return null;
    }
    // Lo dicho no estaba: se pregunta una vez el nombre.
    const answer = await ctx.ask({ title, message: `${message} ${tc(ctx, 'whichPatientName')}`, tone: 'confirm' }, `${message} ${tc(ctx, 'whichPatientName')}`);
    name = stripFiller(normalizeSpeech(answer)) || null;
    if (!name) break;
  }
  const message = tc(ctx, 'noPatient');
  await ctx.finish({ title, message, tone: 'error' }, message);
  return null;
}

async function askTime(ctx: VoiceCommandContext, title: string): Promise<SpokenTime | null> {
  let prompt = tc(ctx, 'whatTime');
  for (let attempt = 0; attempt < 2; attempt++) {
    const answer = await ctx.ask({ title, message: prompt, tone: 'confirm' }, prompt);
    const time = parseTimeAnswer(normalizeSpeech(answer));
    if (time) return time;
    prompt = tc(ctx, 'whatTimeAgain');
  }
  const message = ctx.t('VoiceCommands.nothingChanged');
  await ctx.finish({ title, message, tone: 'info' }, message);
  return null;
}

async function runCreate(resolved: CreateResolved, ctx: VoiceCommandContext) {
  const title = tc(ctx, 'createTitle');
  if (!ctx.hasPermission(BUSINESS_CONFIG_PERMISSIONS.APPOINTMENT_CREATE)) return deny(ctx, title);
  const bridge = await needCalendar(ctx, title);
  if (!bridge) return;
  const { state } = bridge;

  // Lo nombrado en la frase (si calza con varios, pregunta cuál).
  let doctor: User | null | undefined = resolved.doctorIds.length
    ? await pickOne(ctx, title, resolved.doctorIds, state.doctors, tc(ctx, 'whichDoctorOf')) ?? undefined
    : undefined;
  let services = await pickServices(ctx, title, resolved.serviceGroups, state.services);

  const patient = await askPatient(ctx, title, resolved.patientName);
  if (!patient) return;
  const time = resolved.time ?? await askTime(ctx, title);
  if (!time) return;

  // Lo que falta se pregunta: el doctor (o el de cabecera del paciente) y el tratamiento.
  if (doctor === undefined && !resolved.doctorSaid && patient.doctor_id) {
    doctor = state.doctors.find((d) => String(d.id) === String(patient.doctor_id));
  }
  if (doctor === undefined) {
    doctor = await askDoctor(ctx, title, state.doctors, resolved.doctorSaid ? tc(ctx, 'doctorNotFound', { name: resolved.doctorSaid }) : undefined);
  }
  if (!services.length) services = await askServices(ctx, title, state.services);

  let calendar: Calendar | null = resolved.calendarId ? state.calendars.find((c) => String(c.id) === resolved.calendarId) ?? null : null;
  if (!calendar && resolved.calendarName) {
    calendar = bestByName(resolved.calendarName, state.calendars, (c) => c.name)?.item ?? null;
    if (!calendar) {
      const sede = bestByName(resolved.calendarName, state.sedes, (s) => s.name)?.item;
      calendar = sede ? state.calendars.find((c) => String(c.sede_id) === String(sede.id)) ?? null : null;
    }
  }
  // Sin agenda dicha: la del doctor, la que se está viendo o la única visible.
  if (!calendar && doctor?.calendar_source_id) calendar = state.calendars.find((c) => String(c.id) === String(doctor!.calendar_source_id)) ?? null;
  if (!calendar && state.customMode && state.activeCalendarId) calendar = state.calendars.find((c) => String(c.id) === String(state.activeCalendarId)) ?? null;
  if (!calendar && state.selectedCalendarIds.length === 1) calendar = state.calendars.find((c) => String(c.id) === String(state.selectedCalendarIds[0])) ?? null;

  const day = resolved.date ?? dayKeyOf(startOfToday());
  const start = set(parseDayKey(day), { hours: time.hour, minutes: time.minute, seconds: 0, milliseconds: 0 });

  const request: CalendarVoiceFormRequest = { mode: 'create', start, patient, doctor: doctor ?? null, calendar, services };
  getCalendarVoice()?.actions.goToDate(start);
  getCalendarVoice()?.actions.openAppointmentForm(request);

  const card = (draft: FormDraft): VoiceCard => {
    const rows: VoiceCardRow[] = [
      { label: tc(ctx, 'when'), value: `${dayText(ctx, dayKeyOf(draft.start)).card} ${format(draft.start, 'HH:mm')}` },
      { label: tc(ctx, 'doctor'), value: draft.doctor?.name ?? '—', ...(draft.doctor ? {} : { tone: 'warning' as const }) },
      { label: tc(ctx, 'services'), value: draft.services?.length ? draft.services.map((s) => s.name).join(', ') : '—' },
      ...(calendar ? [{ label: tc(ctx, 'calendar'), value: calendar.name }] : []),
    ];
    if (draft.start.getTime() < Date.now()) rows.push({ label: tc(ctx, 'warning'), value: tc(ctx, 'inThePast'), tone: 'warning' });
    return { title, subtitle: patient.name, rows };
  };
  const when = tc(ctx, 'dayAtTime', { date: dayText(ctx, day).speech, time: format(start, 'HH:mm') });
  const speech = tc(ctx, doctor ? 'confirmCreateDoctor' : 'confirmCreate', { patient: patient.name, when, doctor: doctor?.name ?? '' });
  await confirmAndSave(ctx, card, speech, 'create', { start, doctor: doctor ?? null, services });
}

registerVoiceCommand<CreateResolved, CalendarVoiceAiResult>({
  id: 'calendar.create',
  domain: CALENDAR_VOICE_DOMAIN,
  priority: 28,
  match: (normalized) => {
    const parsed = parseCalendarCreate(normalized);
    return parsed ? resolveCreateRest(parsed) : null;
  },
  run: runCreate,
  ai: {
    from: (r) => (r.intent === 'calendar.create'
      ? {
        date: r.date,
        time: parseTimeKey(r.time),
        patientName: r.patient ? normalizeSpeech(r.patient).trim() : null,
        doctorIds: r.doctor_id ? [r.doctor_id] : [],
        doctorSaid: null,
        calendarId: r.calendar_id,
        serviceGroups: r.service_ids.map((id) => [id]),
      }
      : null),
  },
});

// ── Editar una cita ───────────────────────────────────────────────────────────

interface EditResolved {
  ref: CalendarAppointmentRef;
  doctorIds: string[];
  doctorSaid: string | null;
  serviceGroups: string[][];
  serviceMode: ServiceEditMode;
  /** Día y hora nuevos (solo los trae la IA; en la frase local, día y hora dicen qué cita es). */
  date?: string | null;
  time?: SpokenTime | null;
}

/** La cita nombrada y lo que se le quiere cambiar, con las listas de la pantalla. */
function resolveEdit(parsed: CalendarEditParsed): EditResolved {
  const state = getCalendarVoice()?.state;
  const skip = appointmentWordIndexes(parsed.body);
  const serviceMatches = findServiceMentions(parsed.body, asOptions(state?.services ?? []), skip);
  for (const m of serviceMatches) for (let i = m.start; i < m.end; i++) skip.add(i);
  const doctor = findDoctorMention(parsed.body, asOptions(state?.doctors ?? []), { skip: new Set(skip) });
  const used = new Set<number>();
  for (const m of serviceMatches) for (let i = m.start; i < m.end; i++) used.add(i);
  if (doctor) for (let i = doctor.start; i < doctor.end; i++) used.add(i);
  const rest = parsed.body.trim().split(' ').filter((_, i) => !used.has(i)).join(' ');
  return {
    ref: editAppointmentRef(rest),
    doctorIds: doctor?.ids ?? [],
    doctorSaid: doctor && !doctor.ids.length ? doctor.said ?? null : null,
    serviceGroups: serviceMatches.map((m) => m.ids),
    serviceMode: serviceEditMode(parsed.body),
  };
}

async function runEdit(parsed: EditResolved, ctx: VoiceCommandContext) {
  const title = tc(ctx, 'editTitle');
  if (!ctx.hasPermission(BUSINESS_CONFIG_PERMISSIONS.APPOINTMENT_UPDATE)) return deny(ctx, title);
  const bridge = await needCalendar(ctx, title);
  if (!bridge) return;
  let ref = parsed.ref;
  // Sin nombrarla y sin una cita en foco: ¿cuál?
  if (!ref.patient && !ref.time && !hasAppointmentFocus()) {
    const answer = normalizeSpeech(await ctx.ask({ title, message: tc(ctx, 'whichAppointmentName'), tone: 'confirm' }, tc(ctx, 'whichAppointmentName')));
    ref = editAppointmentRef(` ${answer} `);
    if (!ref.patient && !ref.time) {
      const message = ctx.t('VoiceCommands.nothingChanged');
      await ctx.finish({ title, message, tone: 'info' }, message);
      return;
    }
  }
  const appt = await resolveAppointment(ctx, ref, title, (a) => !['cancelled', 'deleted'].includes(a.status as string));
  if (!appt) return;
  const current = appointmentStart(appt);
  if (!current) {
    const message = ctx.t('VoiceCommands.genericError');
    await ctx.finish({ title, message, tone: 'error' }, message);
    return;
  }
  const { state } = getCalendarVoice()!;

  // Lo que se pidió cambiar en la misma frase (si calza con varios, pregunta cuál).
  const changes: string[] = [];
  const patch: CalendarVoiceFormPatch = {};
  const draft: FormDraft = { start: current, services: (appt.services ?? []) as Service[] };
  if (parsed.doctorIds.length) {
    const doctor = await pickOne(ctx, title, parsed.doctorIds, state.doctors, tc(ctx, 'whichDoctorOf'));
    if (doctor) {
      draft.doctor = doctor;
      patch.doctor = doctor;
      changes.push(tc(ctx, 'changeDoctor', { name: doctor.name }));
    }
  }
  if (parsed.serviceGroups.length) {
    const named = await pickServices(ctx, title, parsed.serviceGroups, state.services);
    const before = draft.services ?? [];
    const services = parsed.serviceMode === 'replace'
      ? named
      : parsed.serviceMode === 'remove'
        ? before.filter((s) => !named.some((n) => String(n.id) === String(s.id)))
        : [...before, ...named.filter((n) => !before.some((s) => String(s.id) === String(n.id)))];
    draft.services = services;
    patch.services = services;
    changes.push(services.length ? tc(ctx, 'changeServices', { names: services.map((s) => s.name).join(', ') }) : tc(ctx, 'changeNoServices'));
  }
  if (parsed.date || parsed.time) {
    const start = set(parsed.date ? parseDayKey(parsed.date) : current, {
      hours: parsed.time ? parsed.time.hour : current.getHours(),
      minutes: parsed.time ? parsed.time.minute : current.getMinutes(),
      seconds: 0,
      milliseconds: 0,
    });
    draft.start = start;
    patch.start = start;
    changes.push(tc(ctx, 'dayAtTime', { date: dayText(ctx, dayKeyOf(start)).speech, time: format(start, 'HH:mm') }));
  }

  // El formulario de siempre con la cita; los cambios dichos, una vez que cargó.
  getCalendarVoice()?.actions.goToDate(current);
  getCalendarVoice()?.actions.openAppointmentForm({ mode: 'edit', appointment: appt, start: current });
  const opened = await waitForCalendar((s) => s.form.kind !== null, { signal: ctx.signal, timeoutMs: 3000, settleMs: 400 });
  if (opened && changes.length) getCalendarVoice()?.actions.patchAppointmentForm(patch);

  const before = whenOf(ctx, appt);
  const card = (d: FormDraft): VoiceCard => {
    const rows: VoiceCardRow[] = [
      { label: tc(ctx, 'when'), value: `${dayText(ctx, dayKeyOf(d.start)).card} ${format(d.start, 'HH:mm')}`, ...(d.start.getTime() !== current.getTime() ? { tone: 'warning' as const } : {}) },
    ];
    const doctorName = d.doctor !== undefined ? d.doctor?.name : appt.doctorName;
    rows.push({ label: tc(ctx, 'doctor'), value: doctorName || '—' });
    rows.push({ label: tc(ctx, 'services'), value: d.services?.map((s) => s.name).join(', ') || '—' });
    return { title, subtitle: appt.patientName, rows };
  };
  const doctorSaid = parsed.doctorSaid ? `${tc(ctx, 'doctorNotFound', { name: parsed.doctorSaid })} ` : '';
  const speech = changes.length
    ? `${doctorSaid}${tc(ctx, 'editConfirm', { patient: appt.patientName, changes: changes.join(', ') })}`
    : `${doctorSaid}${tc(ctx, 'editOpened', { patient: appt.patientName, when: before.speech })}`;
  await confirmAndSave(ctx, card, speech, 'edit', draft);
}

registerVoiceCommand<EditResolved, CalendarVoiceAiResult>({
  id: 'calendar.edit',
  domain: CALENDAR_VOICE_DOMAIN,
  usesFocus: true,
  priority: 29,
  match: (normalized) => {
    const parsed = parseCalendarEdit(normalized);
    return parsed ? resolveEdit(parsed) : null;
  },
  run: runEdit,
  ai: {
    from: (r) => (r.intent === 'calendar.edit'
      ? {
        ref: { patient: r.patient ? normalizeSpeech(r.patient).trim() : null, time: parseTimeKey(r.from_time), date: r.from_date },
        doctorIds: r.doctor_id ? [r.doctor_id] : [],
        doctorSaid: null,
        serviceGroups: r.service_ids.map((id) => [id]),
        serviceMode: 'add',
        date: r.date,
        time: parseTimeKey(r.time),
      }
      : null),
  },
});

// ── Reprogramar ───────────────────────────────────────────────────────────────

async function runReschedule(parsed: CalendarRescheduleParsed, ctx: VoiceCommandContext) {
  const title = tc(ctx, 'rescheduleTitle');
  if (!ctx.hasPermission(BUSINESS_CONFIG_PERMISSIONS.APPOINTMENT_UPDATE)) return deny(ctx, title);
  const bridge = await needCalendar(ctx, title);
  if (!bridge) return;
  const appt = await resolveAppointment(ctx, parsed.from, title, (a) => canReschedule(a.status));
  if (!appt) return;
  const current = appointmentStart(appt);
  if (!current) {
    const message = ctx.t('VoiceCommands.genericError');
    await ctx.finish({ title, message, tone: 'error' }, message);
    return;
  }
  const day = parsed.date ?? dayKeyOf(current);
  const time = parsed.time ?? { hour: current.getHours(), minute: current.getMinutes() };
  const start = set(parseDayKey(day), { hours: time.hour, minutes: time.minute, seconds: 0, milliseconds: 0 });
  const base: VoiceCard = { title, subtitle: appt.patientName };
  if (start.getTime() === current.getTime()) {
    const message = tc(ctx, 'rescheduleSame');
    await ctx.finish({ ...base, message, tone: 'info' }, message);
    return;
  }
  getCalendarVoice()?.actions.openAppointmentForm({ mode: 'reschedule', appointment: appt, start });
  const before = whenOf(ctx, appt);
  const after = dayText(ctx, day);
  const afterText = tc(ctx, 'dayAtTime', { date: after.speech, time: format(start, 'HH:mm') });
  const card = (draft: FormDraft): VoiceCard => {
    const rows: VoiceCardRow[] = [
      { label: tc(ctx, 'before'), value: before.card },
      { label: tc(ctx, 'after'), value: `${dayText(ctx, dayKeyOf(draft.start)).card} ${format(draft.start, 'HH:mm')}`, tone: 'warning' },
    ];
    const doctorName = draft.doctor !== undefined ? draft.doctor?.name : appt.doctorName;
    if (doctorName) rows.push({ label: tc(ctx, 'doctor'), value: doctorName });
    if (draft.services) rows.push({ label: tc(ctx, 'services'), value: draft.services.map((s) => s.name).join(', ') || '—' });
    if (draft.start.getTime() < Date.now()) rows.push({ label: tc(ctx, 'warning'), value: tc(ctx, 'inThePast'), tone: 'warning' });
    return { ...base, rows };
  };
  const speech = tc(ctx, 'confirmReschedule', { patient: appt.patientName, from: before.speech, to: afterText });
  await confirmAndSave(ctx, card, speech, 'reschedule', { start, services: appt.services as Service[] | undefined });
}

registerVoiceCommand<CalendarRescheduleParsed, CalendarVoiceAiResult>({
  id: 'calendar.reschedule',
  domain: CALENDAR_VOICE_DOMAIN,
  usesFocus: true,
  priority: 30,
  match: (normalized) => parseCalendarReschedule(normalized),
  run: runReschedule,
  ai: {
    from: (r) => (r.intent === 'calendar.reschedule'
      ? {
        from: { patient: r.patient ? normalizeSpeech(r.patient) : null, time: parseTimeKey(r.from_time), date: r.from_date },
        date: r.date,
        time: parseTimeKey(r.time),
      }
      : null),
  },
});

/**
 * Verbos que no corrigen el formulario sino que piden otra cosa (moverse, exportar, buscar, abrir
 * otra pantalla, zoom…). Los de edición (poné, cambiá, agregá, sacá, pasá) no están.
 */
const FOREIGN_TO_FORM = /^(?:(?:por favor|dale|bueno|che)\s)?(?:exporta\w*|descarga\w*|imprimi\w*|anda|andate|ve|vete|vamos|volve|vuelve|mostra\w*|muestra\w*|busca\w*|abri\w*|abre\w*|zoom|acerca\w*|aleja\w*|agranda\w*|achica\w*|actualiza (?:el calendario|la agenda|la pantalla)|refresca\w*|recarga\w*|bloquea\w*|habilita\w*|agrupa\w*|filtra\w*|oculta\w*|recorda\w*|recuerda\w*|dame|decime|dime|resumi\w*|go|show|open|find|search|export|download|print|zoom|refresh|reload|block|enable|group|filter|hide|remind|give|tell|summarize)(?=\s|$)/;

// ── Formulario abierto a mano: la voz se para ahí ─────────────────────────────

/**
 * Con el formulario de una cita abierto (con el mouse o por voz) lo que se dice es para él:
 * cambia campos, guarda o cancela. Lee lo que tiene y sigue el mismo ciclo que confirmAndSave.
 */
export async function runOpenFormSession(ctx: VoiceCommandContext, raw: string) {
  const bridge = await needCalendar(ctx, tc(ctx, 'formTitle'));
  if (!bridge) return;
  const snapshot = bridge.actions.readAppointmentForm();
  const initial: FormDraft = {
    start: snapshot?.start ?? new Date(),
    doctor: snapshot?.doctor,
    services: snapshot?.services,
    calendar: snapshot?.calendar,
    patient: snapshot?.patient,
    notes: snapshot?.notes,
    endTime: snapshot?.endTime ?? undefined,
  };
  const card = (draft: FormDraft): VoiceCard => {
    const current = getCalendarVoice()?.actions.readAppointmentForm();
    const services = current?.services ?? draft.services ?? [];
    return {
      title: tc(ctx, 'formTitle'),
      subtitle: current?.patient?.name ?? draft.patient?.name ?? undefined,
      rows: [
        { label: tc(ctx, 'when'), value: `${format(draft.start, 'dd/MM HH:mm')}${current?.endTime ? ` – ${current.endTime}` : ''}` },
        ...(current?.doctor ?? draft.doctor ? [{ label: tc(ctx, 'doctor'), value: (current?.doctor ?? draft.doctor)!.name }] : []),
        ...(current?.calendar ?? draft.calendar ? [{ label: tc(ctx, 'calendar'), value: (current?.calendar ?? draft.calendar)!.name }] : []),
        ...(services.length ? [{ label: tc(ctx, 'services'), value: services.map((s) => s.name).join(', ') }] : []),
      ],
      tone: 'confirm',
    };
  };
  await confirmAndSave(ctx, card, tc(ctx, 'formConfirmHint'), 'form', initial, raw);
}
