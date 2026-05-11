import {
  Activity,
  Calendar,
  Check,
  CheckCheck,
  Hourglass,
  LogIn,
  OctagonX,
  UserMinus,
  type LucideIcon,
} from 'lucide-react';

import type { AppointmentStatus } from '@/lib/types';

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
