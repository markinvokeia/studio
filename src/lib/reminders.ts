import type {
  CalendarItemType,
  CalendarReminder,
  CalendarReminderPriority,
  ReminderRecurrence,
  ReminderRecurrenceEndMode,
  ReminderRecurrenceFreq,
} from '@/lib/types';

export const REMINDER_PRIORITY_COLORS: Record<CalendarReminderPriority, string> = {
  HIGH:   '#ef4444', // red-500
  MEDIUM: '#f59e0b', // amber-500
  LOW:    '#3b82f6', // blue-500
};

export function getPriorityColor(priority: CalendarReminderPriority): string {
  return REMINDER_PRIORITY_COLORS[priority] ?? REMINDER_PRIORITY_COLORS.MEDIUM;
}

/** Normaliza un id que puede llegar como number, string, '' o null. */
function normalizeId(value: unknown): string | null {
  return value == null || value === '' ? null : String(value);
}

/**
 * Si el usuario es quien creó el ítem.
 *
 * Uno sin `created_by` se considera de todos: son filas viejas, o filas cuyo autor fue
 * dado de baja (la FK es ON DELETE SET NULL). Dejarlas sin dueño evita que queden
 * inaccesibles para siempre.
 */
export function isReminderAuthor(
  reminder: Pick<CalendarReminder, 'created_by'>,
  userId?: string | null,
): boolean {
  const author = normalizeId(reminder.created_by);
  if (author === null) return true;
  const viewer = normalizeId(userId);
  return viewer !== null && author === viewer;
}

/**
 * Si el usuario puede ver y gestionar (editar, completar, eliminar) el ítem.
 *
 * Ver y gestionar son la misma pregunta a propósito: lo compartido lo maneja cualquiera
 * y lo personal ajeno ni se muestra, así que no existe el estado intermedio "lo veo pero
 * no lo puedo tocar". Tenerlas como una sola función es lo que evita que el filtro del
 * calendario y el gate de los botones se separen con el tiempo.
 */
export function canManageReminder(
  reminder: Pick<CalendarReminder, 'visibility' | 'created_by'>,
  userId?: string | null,
): boolean {
  return reminder.visibility === 'clinic' || isReminderAuthor(reminder, userId);
}

/** Si el ítem pertenece a una serie, o sea si editarlo/borrarlo tiene que preguntar alcance. */
export function isRecurringReminder(reminder?: Pick<CalendarReminder, 'series_id'> | null): boolean {
  return normalizeId(reminder?.series_id) !== null;
}

const RECURRENCE_FREQS: ReminderRecurrenceFreq[] = ['DAILY', 'WEEKLY', 'MONTHLY'];
const RECURRENCE_END_MODES: ReminderRecurrenceEndMode[] = ['never', 'until', 'count'];

/**
 * Normaliza la regla que llega del backend.
 *
 * Devuelve `null` en cuanto algo no cierra en vez de armar una regla a medias: una
 * recurrencia mal parseada sembraría el editor con valores que no son los guardados, y el
 * usuario terminaría reescribiendo la serie sin querer.
 */
export function parseRecurrence(raw: unknown): ReminderRecurrence | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;

  const freq = String(value.freq ?? '').toUpperCase() as ReminderRecurrenceFreq;
  if (!RECURRENCE_FREQS.includes(freq)) return null;

  const endMode = String(value.end_mode ?? 'never').toLowerCase() as ReminderRecurrenceEndMode;
  if (!RECURRENCE_END_MODES.includes(endMode)) return null;

  const interval = Number(value.interval ?? value.rec_interval ?? 1);
  if (!Number.isFinite(interval) || interval < 1 || interval > 52) return null;

  const rawWeekdays = value.byweekday;
  const byweekday = Array.isArray(rawWeekdays)
    ? rawWeekdays.map(Number).filter((day) => Number.isInteger(day) && day >= 1 && day <= 7)
    : null;
  if (freq === 'WEEKLY' && (!byweekday || byweekday.length === 0)) return null;

  const monthDay = value.by_month_day == null ? null : Number(value.by_month_day);
  if (freq === 'MONTHLY' && (monthDay === null || !Number.isInteger(monthDay) || monthDay < 1 || monthDay > 31)) {
    return null;
  }

  const count = value.occurrence_count == null ? null : Number(value.occurrence_count);
  if (endMode === 'count' && (count === null || !Number.isInteger(count) || count < 1)) return null;

  const until = value.until_date == null || value.until_date === '' ? null : String(value.until_date).slice(0, 10);
  if (endMode === 'until' && !until) return null;

  return {
    freq,
    interval,
    byweekday: freq === 'WEEKLY' ? byweekday : null,
    by_month_day: freq === 'MONTHLY' ? monthDay : null,
    end_mode: endMode,
    until_date: endMode === 'until' ? until : null,
    occurrence_count: endMode === 'count' ? count : null,
  };
}

/**
 * Resumen legible de la regla ("Cada 2 semanas, lun y mié, hasta el 31/12/2026").
 *
 * Recibe el traductor en vez de importarlo: este módulo es la regla de negocio compartida
 * entre la página, el panel y el formulario, y no debería depender de next-intl.
 */
export function formatRecurrenceSummary(
  recurrence: ReminderRecurrence,
  t: (key: string, values?: Record<string, string | number>) => string,
): string {
  const every = recurrence.interval === 1
    ? t(`recurrence.every.${recurrence.freq.toLowerCase()}`)
    : t(`recurrence.everyN.${recurrence.freq.toLowerCase()}`, { count: recurrence.interval });

  const parts: string[] = [every];

  if (recurrence.freq === 'WEEKLY' && recurrence.byweekday?.length) {
    const days = [...recurrence.byweekday]
      .sort((a, b) => a - b)
      .map((day) => t(`recurrence.weekdayShort.${day}`))
      .join(', ');
    parts.push(days);
  }

  if (recurrence.freq === 'MONTHLY' && recurrence.by_month_day) {
    parts.push(t('recurrence.onDay', { day: recurrence.by_month_day }));
  }

  if (recurrence.end_mode === 'until' && recurrence.until_date) {
    const [year, month, day] = recurrence.until_date.split('-');
    parts.push(t('recurrence.until', { date: `${day}/${month}/${year}` }));
  }

  if (recurrence.end_mode === 'count' && recurrence.occurrence_count) {
    parts.push(t('recurrence.afterCount', { count: recurrence.occurrence_count }));
  }

  return parts.join(', ');
}

function getReminderColor(value: unknown, priority: CalendarReminderPriority): string {
  if (typeof value !== 'string') return getPriorityColor(priority);

  const color = value.trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color : getPriorityColor(priority);
}

export function normalizeReminder(rawReminder: Record<string, unknown>): CalendarReminder | null {
  const start = rawReminder.start_datetime || rawReminder.startDateTime || rawReminder.startdatetime;
  if (!start) return null;

  const priority: CalendarReminderPriority =
    rawReminder.priority === 'LOW' || rawReminder.priority === 'HIGH'
      ? (rawReminder.priority as CalendarReminderPriority)
      : 'MEDIUM';

  const type: CalendarItemType = rawReminder.type === 'note' || rawReminder.tipo === 'nota' ? 'note' : 'reminder';
  const calendarId = rawReminder.calendar_id
    ?? rawReminder.calendarId
    ?? rawReminder.calendario_id
    ?? rawReminder.calendarioId
    ?? null;

  return {
    id:                 String(rawReminder.id ?? ''),
    type,
    calendar_id:        normalizeId(calendarId),
    title:              String(rawReminder.title ?? ''),
    description:        (rawReminder.description as string | null) ?? null,
    start_datetime:     String(start),
    end_datetime:       (rawReminder.end_datetime ?? rawReminder.endDateTime ?? rawReminder.enddatetime ?? null) as string | null,
    color:              getReminderColor(rawReminder.color, priority),
    priority,
    status:             (['pending', 'done', 'dismissed', 'cancelled'] as string[]).includes(rawReminder.status as string)
                          ? (rawReminder.status as CalendarReminder['status'])
                          : 'pending',
    visibility:         rawReminder.visibility === 'personal' ? 'personal' : 'clinic',
    is_all_day:         Boolean(rawReminder.is_all_day ?? rawReminder.isAllDay),
    series_id:          normalizeId(rawReminder.series_id ?? rawReminder.seriesId),
    is_series_exception: Boolean(rawReminder.is_series_exception ?? rawReminder.isSeriesException),
    recurrence:         parseRecurrence(rawReminder.recurrence),
    raise_alert:        Boolean(rawReminder.raise_alert),
    alert_instance_id:  (rawReminder.alert_instance_id ?? rawReminder.alertInstanceId ?? null) as number | null,
    created_by:         normalizeId(rawReminder.created_by ?? rawReminder.createdBy),
    created_at:         String(rawReminder.created_at ?? rawReminder.createdAt ?? ''),
    updated_at:         (rawReminder.updated_at ?? rawReminder.updatedAt ?? null) as string | null,
    completed_at:       (rawReminder.completed_at ?? rawReminder.completedAt ?? null) as string | null,
    completed_by:       normalizeId(rawReminder.completed_by ?? rawReminder.completedBy),
  };
}
