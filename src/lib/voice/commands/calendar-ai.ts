import { APPOINTMENT_STATUSES } from '@/constants/appointment-status';
import { VOICE_CANCELLATION_REASONS } from '@/lib/voice/commands/calendar-parse';
import { PATIENT_INFO_TOPICS } from '@/lib/voice/patient-info';

import type {
  AppointmentStatus,
  CalendarVoiceAiPlanResult,
  CalendarVoiceAiResult,
  CalendarVoiceIntent,
  CalendarVoiceSettingKey,
  CalendarVoiceView,
  VoiceRelation,
} from '@/lib/types';

/**
 * Revalida en el navegador lo que la IA interpretó para el calendario (n8n ya lo validó; esto es
 * la segunda vuelta): solo ids que están en el contexto que se mandó, fechas y horas reales,
 * estados, vistas y preferencias conocidos. Lo que no cierra queda en null o vacío, y un paso al
 * que le falta lo esencial pasa a 'unknown' (y se descarta del plan).
 *
 * La IA devuelve un PLAN: `relation` (qué tiene que ver con la tarea en curso), `answer` (si
 * contesta la pregunta abierta) y `steps` (los pasos en orden). El primer paso también va arriba,
 * así los comandos que leen un solo resultado siguen funcionando.
 */

export interface CalendarAiContext {
  doctors: Array<{ id: string; name: string }>;
  calendars: Array<{ id: string; name: string; sede?: string | null }>;
  sedes: Array<{ id: string; name: string }>;
  services: Array<{ id: string; name: string }>;
  /** Hay una cita en foco: los pasos sobre «la cita» sin nombrarla son sobre ella. */
  has_focus?: boolean;
}

export const CALENDAR_INTENTS: CalendarVoiceIntent[] = [
  'calendar.navigate', 'calendar.view', 'calendar.filter', 'calendar.group', 'calendar.search', 'calendar.agenda',
  'calendar.next', 'calendar.patient_next', 'calendar.gaps', 'calendar.status', 'calendar.create', 'calendar.reschedule', 'calendar.edit',
  'calendar.color', 'calendar.move_calendar', 'calendar.assign_doctor', 'calendar.duration', 'calendar.delete', 'calendar.open',
  'calendar.block', 'calendar.enable', 'calendar.reminder', 'calendar.reminder_done', 'calendar.reminder_delete',
  'calendar.print', 'calendar.refresh', 'calendar.today', 'calendar.zoom', 'calendar.panel', 'calendar.options',
  'calendar.close_search', 'calendar.hide_gaps', 'calendar.export', 'calendar.settings', 'calendar.settings_open',
  'calendar.select', 'calendar.form_set', 'calendar.form_save', 'calendar.form_cancel', 'calendar.dialog',
  'calendar.patient_find', 'calendar.patient_ask', 'calendar.patient_info', 'calendar.patient_action', 'calendar.close_panels', 'unknown',
];
const RELATIONS: VoiceRelation[] = ['new', 'answer', 'aux', 'ignore', 'cancel', 'resume'];
const COLORS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', 'none'] as const;
const TARGETS = ['history', 'documents', 'accounts', 'appointments', 'patient', 'session', 'bill'] as const;
const VIEWS: CalendarVoiceView[] = ['day', 'week', 'month', 'year', '2-day', '3-day', '4-day', '5-day', '6-day', 'schedule'];
export const SETTING_KEYS: CalendarVoiceSettingKey[] = [
  'mode', 'default_view', 'grouped_by', 'hour_height', 'slot_duration', 'default_sede', 'event_label_format',
  'hidden_weekdays', 'visible_hours', 'color_by_status', 'check_availability', 'block_unavailable',
  'filter_doctors_by_service', 'inline_appointment_creation', 'inline_draft_live_preview',
];
/** 'deleted' nunca como estado: borrar es su propio comando (calendar.delete), con confirmación. */
const STATUSES = APPOINTMENT_STATUSES as readonly AppointmentStatus[];
const MAX_STEPS = 6;

const isDate = (v: unknown): v is string => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
};
const isTime = (v: unknown): v is string => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const oneOf = <T extends string>(list: readonly T[], v: unknown): T | null => (list.includes(v as T) ? (v as T) : null);
const idsIn = (v: unknown, allowed: Set<string>, max = 20) => [...new Set((Array.isArray(v) ? v : []).map(String).filter((id) => allowed.has(id)))].slice(0, max);
const idIn = (v: unknown, allowed: Set<string>) => (v != null && allowed.has(String(v)) ? String(v) : null);
const intIn = (v: unknown, min: number, max: number) => {
  const n = Number(v);
  return v != null && v !== '' && Number.isInteger(n) && n >= min && n <= max ? n : null;
};

function listOf(ctx: Record<string, unknown>, key: keyof Omit<CalendarAiContext, 'has_focus'>): Set<string> {
  const rows = Array.isArray(ctx[key]) ? (ctx[key] as Array<{ id?: unknown }>) : [];
  return new Set(rows.map((r) => String(r?.id ?? '')).filter(Boolean));
}

function settingValue(setting: CalendarVoiceSettingKey | null, v: unknown, sedes: Set<string>): string | number | boolean | null {
  if (!setting || v === undefined || v === null) return null;
  switch (setting) {
    case 'mode': return oneOf(['invoke', 'custom'] as const, v);
    case 'default_view': return oneOf(['day', '2_days', '3_days', 'week', 'month', 'agenda'] as const, v);
    case 'grouped_by': return oneOf(['none', 'doctor', 'calendar'] as const, v);
    case 'hour_height': return oneOf(['up', 'down', 'max', 'min'] as const, v) ?? intIn(v, 60, 200);
    case 'slot_duration': return [5, 10, 15, 20, 30, 60].includes(Number(v)) ? Number(v) : null;
    case 'default_sede': return v === '' || v === 'all' ? 'all' : idIn(v, sedes);
    case 'event_label_format': return oneOf(['time_patient_notes', 'patient_treatment_time', 'time_patient_notes_treatment', 'time_treatment_patient_notes'] as const, v);
    case 'visible_hours': return oneOf(['full', 'clinic', 'custom'] as const, v);
    case 'hidden_weekdays': return null;
    default: return typeof v === 'boolean' ? v : v === 'true' ? true : v === 'false' ? false : null;
  }
}

/** Un paso validado. Lo que le falta lo esencial queda 'unknown'. */
export function sanitizeCalendarStep(raw: unknown, context: Record<string, unknown>): CalendarVoiceAiResult {
  const p = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const doctors = listOf(context, 'doctors');
  const calendars = listOf(context, 'calendars');
  const sedes = listOf(context, 'sedes');
  const services = listOf(context, 'services');
  const confidence = Number(p.confidence);
  const setting = oneOf(SETTING_KEYS, p.setting);

  const result: CalendarVoiceAiResult = {
    intent: oneOf(CALENDAR_INTENTS, p.intent) ?? 'unknown',
    date: isDate(p.date) ? p.date : null,
    time: isTime(p.time) ? p.time : null,
    from_date: isDate(p.from_date) ? p.from_date : null,
    from_time: isTime(p.from_time) ? p.from_time : null,
    step: p.step === 1 || p.step === -1 ? p.step : null,
    view: oneOf(VIEWS, p.view),
    filter_op: oneOf(['only', 'add', 'remove', 'all'] as const, p.filter_op),
    filter_target: oneOf(['doctor', 'calendar', 'sede'] as const, p.filter_target),
    doctor_ids: idsIn(p.doctor_ids, doctors),
    calendar_ids: idsIn(p.calendar_ids, calendars),
    sede_ids: idsIn(p.sede_ids, sedes),
    group_by: oneOf(['none', 'doctor', 'calendar'] as const, p.group_by),
    patient: str(p.patient, 80),
    query: str(p.query, 80),
    doctor_id: idIn(p.doctor_id, doctors),
    calendar_id: idIn(p.calendar_id, calendars),
    service_ids: idsIn(p.service_ids, services, 10),
    status: oneOf(STATUSES, p.status),
    cancellation_reason: oneOf(VOICE_CANCELLATION_REASONS, p.cancellation_reason),
    period: oneOf(['morning', 'afternoon'] as const, p.period),
    color: oneOf(COLORS, p.color == null ? null : String(p.color)),
    minutes: intIn(p.minutes, 5, 720),
    end_time: isTime(p.end_time) ? p.end_time : null,
    title: str(p.title, 240),
    reminder_type: oneOf(['reminder', 'note'] as const, p.reminder_type),
    target: oneOf(TARGETS, p.target),
    zoom_op: oneOf(['in', 'out', 'max', 'min', 'reset', 'set'] as const, p.zoom_op),
    zoom_level: intIn(p.zoom_level, 30, 250),
    amount: intIn(p.amount, 1, 10),
    panel_op: oneOf(['open', 'close', 'pin', 'unpin'] as const, p.panel_op),
    options_of: oneOf(['views', 'calendars', 'doctors', 'sedes'] as const, p.options_of),
    export_range: oneOf(['day', 'week', 'month', 'custom'] as const, p.export_range),
    end_date: isDate(p.end_date) ? p.end_date : null,
    export_now: p.export_now === true,
    setting,
    setting_value: settingValue(setting, p.setting_value, sedes),
    weekdays: [...new Set((Array.isArray(p.weekdays) ? p.weekdays : []).map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))],
    weekday_op: oneOf(['hide', 'show', 'set'] as const, p.weekday_op),
    remove_service_ids: idsIn(p.remove_service_ids, services, 10),
    notes_op: oneOf(['append', 'replace', 'clear'] as const, p.notes_op),
    dialog_op: oneOf(['confirm', 'cancel'] as const, p.dialog_op),
    document: str(p.document, 40),
    email: str(p.email, 120),
    phone: str(p.phone, 40),
    question: str(p.question, 300),
    info_topics: [...new Set((Array.isArray(p.info_topics) ? p.info_topics : []).filter((x): x is CalendarVoiceAiResult['info_topics'][number] => (PATIENT_INFO_TOPICS as string[]).includes(String(x))))].slice(0, 8),
    patient_action: oneOf(['quote', 'invoice', 'treatment', 'session', 'bill'] as const, p.patient_action),
    confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0,
  };

  // La cita: nombrada (paciente / hora) o la que está en foco.
  const ref = !!result.patient || !!result.from_time || !!result.time || context.has_focus === true;
  const refFrom = !!result.patient || !!result.from_time || context.has_focus === true;
  const missing: Partial<Record<CalendarVoiceIntent, boolean>> = {
    'calendar.navigate': !result.date && !result.step,
    'calendar.view': !result.view,
    'calendar.filter': !result.filter_op || (result.filter_op !== 'all' && !result.doctor_ids.length && !result.calendar_ids.length && !result.sede_ids.length),
    'calendar.group': !result.group_by,
    'calendar.search': !result.query,
    'calendar.patient_next': !result.patient,
    'calendar.status': !result.status || !ref,
    'calendar.create': !result.patient && !result.date && !result.time,
    'calendar.reschedule': !refFrom || (!result.date && !result.time),
    'calendar.edit': !refFrom,
    'calendar.select': !result.patient && !result.from_time && !result.time,
    'calendar.color': !result.color || !refFrom,
    'calendar.move_calendar': !result.calendar_id || !refFrom,
    'calendar.assign_doctor': !result.doctor_id || !refFrom,
    'calendar.duration': !result.minutes || !refFrom,
    'calendar.delete': !refFrom,
    'calendar.open': !result.target || !refFrom,
    'calendar.block': !result.date && !result.time,
    'calendar.enable': !result.date && !result.time,
    'calendar.reminder_done': !result.title && !result.time,
    'calendar.reminder_delete': !result.title && !result.time,
    'calendar.zoom': !result.zoom_op || (result.zoom_op === 'set' && !result.zoom_level),
    'calendar.panel': !result.panel_op,
    'calendar.settings_open': !result.panel_op,
    'calendar.options': !result.options_of,
    'calendar.settings': !result.setting || (result.setting === 'hidden_weekdays'
      ? !result.weekday_op || (result.weekday_op !== 'show' && !result.weekdays.length)
      : result.setting === 'visible_hours'
        ? !result.setting_value && !(result.time && result.end_time)
        : result.setting_value === null),
    'calendar.dialog': !result.dialog_op,
    'calendar.patient_find': !result.patient && !result.document && !result.email && !result.phone,
    'calendar.patient_ask': !result.question,
    'calendar.patient_info': !result.info_topics.length,
    'calendar.patient_action': !result.patient_action,
  };
  if (missing[result.intent]) result.intent = 'unknown';
  return result;
}

/** El plan completo: relación, respuesta y pasos válidos (el primero también arriba). */
export function sanitizeCalendarAiResult(raw: unknown, context: Record<string, unknown>): CalendarVoiceAiPlanResult {
  const p = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const rawSteps = Array.isArray(p.steps) && p.steps.length ? p.steps.slice(0, MAX_STEPS) : [p];
  // Los pasos que vienen después de elegir una cita pueden no nombrarla: es la del paso anterior.
  let focusSoFar = context.has_focus === true;
  const steps: CalendarVoiceAiResult[] = [];
  for (const step of rawSteps) {
    const clean = sanitizeCalendarStep(step, { ...context, has_focus: focusSoFar });
    if (clean.intent === 'unknown') continue;
    steps.push(clean);
    if (clean.patient || clean.from_time || clean.intent === 'calendar.select') focusSoFar = true;
  }
  const relation = oneOf(RELATIONS, p.relation) ?? 'new';
  const confidence = Number(p.confidence);
  const first = steps[0] ?? sanitizeCalendarStep({}, context);
  return {
    ...first,
    confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : first.confidence,
    relation,
    answer: str(p.answer, 120),
    steps,
  };
}
