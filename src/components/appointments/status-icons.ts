import {
  Activity,
  AlarmClock,
  BellOff,
  Building2,
  Calendar,
  Check,
  CheckCheck,
  Clock4,
  HelpCircle,
  Hourglass,
  LogIn,
  OctagonX,
  RotateCw,
  Stethoscope,
  UserMinus,
  type LucideIcon,
} from 'lucide-react';

import type { AppointmentStatus, CancellationReason } from '@/lib/types';

/**
 * Shared icon map per appointment status. Used by the status badge menu, the
 * context-menu and the calendar event chips so they stay in sync visually.
 *
 * Selected for legibility at small sizes (≤16px): simple silhouettes,
 * minimal internal detail, distinct one from another.
 */
export const STATUS_ICONS: Record<AppointmentStatus, LucideIcon> = {
  pending: Hourglass,
  scheduled: Calendar,
  confirmed: Check,
  arrived: LogIn,
  in_progress: Activity,
  completed: CheckCheck,
  no_show: UserMinus,
  cancelled: OctagonX,
};

/**
 * Icons used to differentiate cancellation reasons when a status badge is
 * shown for a cancelled appointment. Falls back to the generic cancelled icon
 * (`OctagonX`) when no reason is set.
 */
export const CANCELLATION_REASON_ICONS: Record<CancellationReason, LucideIcon> = {
  late:       AlarmClock,
  in_time:    Clock4,
  no_notice:  BellOff,
  by_doctor:  Stethoscope,
  by_clinic:  Building2,
  other:      HelpCircle,
  reschedule: RotateCw,
};

/**
 * Resolve the icon for an appointment status, optionally differentiating
 * cancellation sub-states by reason.
 */
export function getStatusIcon(
  status: AppointmentStatus,
  cancellationReason?: CancellationReason | null,
): LucideIcon {
  if (status === 'cancelled' && cancellationReason && CANCELLATION_REASON_ICONS[cancellationReason]) {
    return CANCELLATION_REASON_ICONS[cancellationReason];
  }
  return STATUS_ICONS[status];
}
