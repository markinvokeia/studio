import { APPOINTMENT_STATUSES } from '@/constants/appointment-status';
import { VOICE_CANCELLATION_REASONS } from '@/lib/voice/commands/calendar-parse';

import type { AppointmentStatus, CalendarVoiceAiResult, CalendarVoiceIntent, CalendarVoiceView } from '@/lib/types';

/**
 * Revalida en el navegador lo que la IA interpretó para el calendario (n8n ya lo validó; esto es
 * la segunda vuelta): solo ids que están en el contexto que se mandó, fechas y horas reales,
 * estados y vistas conocidos. Lo que no cierra queda en null o vacío, y una acción sobre una cita
 * sin paciente ni hora pasa a 'unknown'.
 */

export interface CalendarAiContext {
  doctors: Array<{ id: string; name: string }>;
  calendars: Array<{ id: string; name: string; sede?: string | null }>;
  sedes: Array<{ id: string; name: string }>;
  services: Array<{ id: string; name: string }>;
}

const INTENTS: CalendarVoiceIntent[] = [
  'calendar.navigate', 'calendar.view', 'calendar.filter', 'calendar.group', 'calendar.search', 'calendar.agenda',
  'calendar.next', 'calendar.patient_next', 'calendar.gaps', 'calendar.status', 'calendar.create', 'calendar.reschedule', 'calendar.edit',
  'calendar.color', 'calendar.move_calendar', 'calendar.assign_doctor', 'calendar.duration', 'calendar.delete', 'calendar.open',
  'calendar.block', 'calendar.enable', 'calendar.reminder', 'calendar.reminder_done', 'calendar.reminder_delete',
  'calendar.print', 'calendar.refresh', 'unknown',
];
const COLORS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', 'none'] as const;
const TARGETS = ['history', 'documents', 'accounts', 'appointments', 'patient', 'session', 'bill'] as const;
const VIEWS: CalendarVoiceView[] = ['day', 'week', 'month', 'year', '2-day', '3-day', '4-day', '5-day', '6-day', 'schedule'];
/** 'deleted' nunca como estado: borrar es su propio comando (calendar.delete), con confirmación. */
const STATUSES = APPOINTMENT_STATUSES as readonly AppointmentStatus[];

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

function listOf(ctx: Record<string, unknown>, key: keyof CalendarAiContext): Set<string> {
  const rows = Array.isArray(ctx[key]) ? (ctx[key] as Array<{ id?: unknown }>) : [];
  return new Set(rows.map((r) => String(r?.id ?? '')).filter(Boolean));
}

export function sanitizeCalendarAiResult(raw: unknown, context: Record<string, unknown>): CalendarVoiceAiResult {
  const p = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const doctors = listOf(context, 'doctors');
  const calendars = listOf(context, 'calendars');
  const sedes = listOf(context, 'sedes');
  const services = listOf(context, 'services');
  const confidence = Number(p.confidence);

  const result: CalendarVoiceAiResult = {
    intent: oneOf(INTENTS, p.intent) ?? 'unknown',
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
    minutes: Number.isInteger(Number(p.minutes)) && Number(p.minutes) >= 5 && Number(p.minutes) <= 720 ? Number(p.minutes) : null,
    end_time: isTime(p.end_time) ? p.end_time : null,
    title: str(p.title, 120),
    reminder_type: oneOf(['reminder', 'note'] as const, p.reminder_type),
    target: oneOf(TARGETS, p.target),
    confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0,
  };

  // Lo que le falta lo esencial no se ejecuta.
  const hasRef = !!result.patient || !!result.time;
  const missing: Partial<Record<CalendarVoiceIntent, boolean>> = {
    'calendar.navigate': !result.date && !result.step,
    'calendar.view': !result.view,
    'calendar.filter': !result.filter_op || (result.filter_op !== 'all' && !result.doctor_ids.length && !result.calendar_ids.length && !result.sede_ids.length),
    'calendar.group': !result.group_by,
    'calendar.search': !result.query,
    'calendar.patient_next': !result.patient,
    'calendar.status': !result.status || !(result.patient || result.time),
    'calendar.create': !result.patient && !result.date && !result.time,
    'calendar.reschedule': !(result.patient || result.from_time) || (!result.date && !result.time),
    'calendar.edit': !(result.patient || result.from_time),
    'calendar.color': !result.color || !(result.patient || result.from_time),
    'calendar.move_calendar': !result.calendar_id || !(result.patient || result.from_time),
    'calendar.assign_doctor': !result.doctor_id || !(result.patient || result.from_time),
    'calendar.duration': !result.minutes || !(result.patient || result.from_time),
    'calendar.delete': !(result.patient || result.from_time),
    'calendar.open': !result.target || !(result.patient || result.from_time),
    'calendar.block': !result.date && !result.time,
    'calendar.enable': !result.date && !result.time,
    'calendar.reminder_done': !result.title && !result.time,
    'calendar.reminder_delete': !result.title && !result.time,
  };
  if (result.intent === 'calendar.status' && !hasRef) result.intent = 'unknown';
  if (missing[result.intent]) result.intent = 'unknown';
  return result;
}
