import type { AppointmentStatus, CancellationReason } from '@/lib/types';

export const APPOINTMENT_STATUSES: AppointmentStatus[] = [
  'scheduled',
  'confirmed',
  'arrived',
  'in_progress',
  'completed',
  'no_show',
  'cancelled',
  'pending',
];

export const ALLOWED_STATUS_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> =
  Object.fromEntries(
    APPOINTMENT_STATUSES.map((from) => [
      from,
      APPOINTMENT_STATUSES.filter((to) => to !== from),
    ]),
  ) as Record<AppointmentStatus, AppointmentStatus[]>;

export const STATUS_BADGE_VARIANT: Record<AppointmentStatus, string> = {
  pending:     'info',
  scheduled:   'info',
  confirmed:   'default',
  arrived:     'warning',
  in_progress: 'warning',
  completed:   'success',
  no_show:     'destructive',
  cancelled:   'destructive',
};

/**
 * Accent color used to render a small strip on the left of a calendar event,
 * similar to Outlook's "Mostrar como" indicator. Cancelled is handled separately
 * with a striped overlay (see Calendar.css `.event-cancelled`).
 */
export const STATUS_ACCENT_COLOR: Record<AppointmentStatus, string> = {
  pending:     '#9ca3af', // gray-400
  scheduled:   '#3b82f6', // blue-500
  confirmed:   '#10b981', // emerald-500
  arrived:     '#f59e0b', // amber-500
  in_progress: '#f97316', // orange-500
  completed:   '#16a34a', // green-600
  no_show:     '#ef4444', // red-500
  cancelled:   '#6b7280', // gray-500 (used for the stripe pattern)
};

export function canTransition(from: AppointmentStatus, to: AppointmentStatus): boolean {
  return from !== to;
}

/**
 * Normalize a status value coming from the backend to the canonical internal form.
 * Handles casing and the American "canceled" / British "cancelled" spelling.
 */
export function normalizeAppointmentStatus(value: unknown): AppointmentStatus {
  const raw = String(value ?? '').toLowerCase().trim();
  if (raw === 'canceled') return 'cancelled';
  return (APPOINTMENT_STATUSES as readonly string[]).includes(raw)
    ? (raw as AppointmentStatus)
    : 'confirmed';
}

/**
 * Cancellation reasons selectable from the UI. 'reschedule' is intentionally
 * excluded — it's only set by the reschedule endpoint, never picked manually.
 */
export const CANCELLATION_REASONS_QUICK: CancellationReason[] = [
  'late',
  'in_time',
  'no_notice',
  'by_doctor',
  'by_clinic',
];

export const CANCELLATION_REASON_OTHER: CancellationReason = 'other';

/**
 * Statuses from which a user is allowed to reschedule. Terminal states
 * (completed, cancelled, no_show) are excluded.
 */
export const RESCHEDULABLE_STATUSES: AppointmentStatus[] = [
  'pending',
  'scheduled',
  'confirmed',
  'arrived',
  'in_progress',
];

export function canReschedule(status: AppointmentStatus): boolean {
  return RESCHEDULABLE_STATUSES.includes(status);
}

/**
 * Statuses from which the appointment can be hard-deleted (different from
 * logical cancellation). Intentionally restricted to states where the deletion
 * doesn't lose meaningful clinical/billing history.
 */
export const DELETABLE_STATUSES: AppointmentStatus[] = [
  'pending',
  'scheduled',
  'cancelled',
  'no_show',
];

export function canDelete(status: AppointmentStatus): boolean {
  return DELETABLE_STATUSES.includes(status);
}
