import type { AppointmentStatus, CancellationReason } from '@/lib/types';

export const APPOINTMENT_STATUSES: AppointmentStatus[] = [
  'scheduled',
  'confirmed',
  'arrived',
  'arrived_late',
  'in_progress',
  'completed',
  'attended_late',
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
  pending:       'info',
  scheduled:     'info',
  confirmed:     'default',
  arrived:       'warning',
  arrived_late:  'warning',
  in_progress:   'warning',
  completed:     'success',
  attended_late: 'success',
  no_show:       'destructive',
  cancelled:     'destructive',
};

/**
 * Accent color used to render a small strip on the left of a calendar event,
 * similar to Outlook's "Mostrar como" indicator. Cancelled is handled separately
 * with a striped overlay (see Calendar.css `.event-cancelled`).
 */
export const STATUS_ACCENT_COLOR: Record<AppointmentStatus, string> = {
  pending:       '#9ca3af', // gray-400
  // violet-400 (lila) — 'Programada' pinta siempre la cita, así que su color no
  // es un acento más: es la señal de "sin confirmar". El lila no lo usa ningún
  // otro estado y se separa del sky-600 de confirmed, que es el color que la cita
  // adopta recién al confirmarse.
  scheduled:     '#a78bfa',
  // sky-600 — fuera de la familia verde: antes era emerald-500 (#10b981) y se
  // confundía con completed (#16a34a), sobre todo porque sus íconos son Check y
  // CheckCheck, que a 14px se distinguen por un palito.
  // Ya no compite con scheduled: ese pasó a lila (#a78bfa), justamente para que
  // el salto de "sin confirmar" a "confirmada" se note de un vistazo.
  confirmed:     '#0284c7', // sky-600
  arrived:       '#f59e0b', // amber-500
  arrived_late:  '#d97706', // amber-600 (arrived, but late)
  in_progress:   '#f97316', // orange-500
  completed:     '#16a34a', // green-600
  attended_late: '#0d9488', // teal-600 (attended, but late)
  // gray-600 — 'No asistió' se lee como cita muerta, no como alerta. Un paso más
  // oscuro que el gray-500 de cancelled (que además va rayada) y que el gray-400
  // de pending, para que los tres grises sigan distinguiéndose.
  no_show:       '#4b5563',
  cancelled:     '#6b7280', // gray-500 (used for the stripe pattern)
};

/**
 * Estados que pintan la cita entera con su STATUS_ACCENT_COLOR sin importar la
 * preferencia "colorear por estado" ni el color de servicio, de doctor o de
 * consultorio: son los dos estados que hay que reconocer de un vistazo.
 * 'Programada' (sin confirmar) va en lila y 'No asistió' en gris; al confirmarse
 * la cita vuelve a tomar el color de la clínica con su orden habitual
 * (propio > servicio > doctor > consultorio).
 *
 * Excepción: si alguien le asignó a mano una etiqueta de color a la cita, ese
 * color manda igual y el estado pasa a la franja lateral — el cambio de color
 * tiene que verse en el momento, no recién al avanzar de estado.
 *
 * El resto de los estados sí dependen de la preferencia: muestran su color como
 * franja lateral si la cita tiene color propio o de servicio, o pintando toda la
 * card si solo hereda el del doctor o el consultorio.
 */
export const STATUS_FORCED_CALENDAR_COLOR: AppointmentStatus[] = ['scheduled', 'no_show'];

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

export function normalizeCancellationReason(value: unknown): CancellationReason | null {
  const raw = String(value ?? '').toLowerCase().trim();
  const reasons: CancellationReason[] = [
    'late',
    'in_time',
    'no_notice',
    'by_doctor',
    'by_clinic',
    'other',
    'reschedule',
  ];

  return (reasons as readonly string[]).includes(raw) ? (raw as CancellationReason) : null;
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
 * Ordered layout for the status pickers (badge dropdown + calendar context menu).
 * Some cancellation reasons are surfaced as direct actions; the rest live in the
 * trailing "Cancelar…" submenu. `pending` is intentionally omitted — it stays a
 * valid backend/normalized status (badges still render it) but is no longer
 * offered as a selectable option.
 */
export type StatusMenuEntry =
  | { kind: 'status'; status: AppointmentStatus }
  | { kind: 'cancelReason'; reason: CancellationReason }
  | { kind: 'cancelSubmenu' };

export const STATUS_MENU_LAYOUT: StatusMenuEntry[] = [
  { kind: 'status', status: 'scheduled' },
  { kind: 'status', status: 'confirmed' },
  { kind: 'status', status: 'arrived' },
  { kind: 'status', status: 'in_progress' },
  { kind: 'status', status: 'completed' },
  { kind: 'status', status: 'arrived_late' },
  { kind: 'status', status: 'no_show' },
  { kind: 'cancelReason', reason: 'in_time' },
  { kind: 'cancelReason', reason: 'late' },
  { kind: 'cancelReason', reason: 'by_doctor' },
  { kind: 'status', status: 'attended_late' },
  { kind: 'cancelSubmenu' },
];

/**
 * Cancellation reasons shown inside the trailing "Cancelar…" submenu — i.e. the
 * ones NOT already promoted to direct actions in STATUS_MENU_LAYOUT.
 */
export const CANCELLATION_REASONS_SUBMENU: CancellationReason[] = [
  'no_notice',
  'by_clinic',
];

/**
 * Statuses from which a user is allowed to reschedule. Terminal states
 * (completed, cancelled, no_show) are excluded.
 */
export const RESCHEDULABLE_STATUSES: AppointmentStatus[] = [
  'pending',
  'scheduled',
  'confirmed',
  'arrived',
  'arrived_late',
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
