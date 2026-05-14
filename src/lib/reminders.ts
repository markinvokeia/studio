import type { CalendarReminder, CalendarReminderPriority } from '@/lib/types';

export const REMINDER_PRIORITY_COLORS: Record<CalendarReminderPriority, string> = {
  HIGH:   '#ef4444', // red-500
  MEDIUM: '#f59e0b', // amber-500
  LOW:    '#3b82f6', // blue-500
};

export function getPriorityColor(priority: CalendarReminderPriority): string {
  return REMINDER_PRIORITY_COLORS[priority] ?? REMINDER_PRIORITY_COLORS.MEDIUM;
}

export function normalizeReminder(rawReminder: Record<string, unknown>): CalendarReminder | null {
  const start = rawReminder.start_datetime || rawReminder.startDateTime || rawReminder.startdatetime;
  if (!start) return null;

  const priority: CalendarReminderPriority =
    rawReminder.priority === 'LOW' || rawReminder.priority === 'HIGH'
      ? (rawReminder.priority as CalendarReminderPriority)
      : 'MEDIUM';

  return {
    id:                 String(rawReminder.id ?? ''),
    title:              String(rawReminder.title ?? ''),
    description:        (rawReminder.description as string | null) ?? null,
    start_datetime:     String(start),
    end_datetime:       (rawReminder.end_datetime ?? rawReminder.endDateTime ?? rawReminder.enddatetime ?? null) as string | null,
    color:              getPriorityColor(priority),
    priority,
    status:             (['pending', 'done', 'dismissed', 'cancelled'] as string[]).includes(rawReminder.status as string)
                          ? (rawReminder.status as CalendarReminder['status'])
                          : 'pending',
    visibility:         'clinic',
    raise_alert:        Boolean(rawReminder.raise_alert),
    alert_instance_id:  (rawReminder.alert_instance_id ?? rawReminder.alertInstanceId ?? null) as number | null,
    created_by:         (rawReminder.created_by ?? rawReminder.createdBy ?? null) as string | null,
    created_at:         String(rawReminder.created_at ?? rawReminder.createdAt ?? ''),
    updated_at:         (rawReminder.updated_at ?? rawReminder.updatedAt ?? null) as string | null,
    completed_at:       (rawReminder.completed_at ?? rawReminder.completedAt ?? null) as string | null,
    completed_by:       (rawReminder.completed_by ?? rawReminder.completedBy ?? null) as string | null,
  };
}
