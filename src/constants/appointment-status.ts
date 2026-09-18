import type {
  AppointmentStatus,
  AppointmentStatusDisplayMatrix,
  CancellationReason,
} from '@/lib/types';

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

/**
 * Matriz por defecto de color/modo-calendario/estilo-badge por estado, usada
 * hasta que el store carga la configuración real del cliente (§ plan
 * calendar-status-colors) y como semilla de la migración SQL. Valores tomados
 * de `clinica_imagen` (rama con el trabajo de color más reciente).
 *
 * `calendarMode`:
 *   - 'always': pinta la card entera con este color sin importar la preferencia
 *     "colorear por estado" ni el color de servicio/doctor/consultorio (salvo
 *     etiqueta de color puesta a mano en la cita, que siempre gana).
 *   - 'preference': respeta el switch "colorear por estado" del usuario.
 *   - 'never': nunca aporta color al calendario.
 *
 * 'scheduled' (lila) y 'no_show' (gris) van en 'always': son los dos estados
 * que hay que reconocer de un vistazo. El lila no lo usa ningún otro estado y
 * se separa del sky-600 de 'confirmed' (antes emerald, se confundía con
 * 'completed' a 14px). El gris de 'no_show' es un paso más oscuro que el de
 * 'cancelled' (rayado) y más oscuro que el de 'pending', para que los tres
 * grises se distingan entre sí.
 */
export const DEFAULT_STATUS_DISPLAY: AppointmentStatusDisplayMatrix = {
  pending:       { color: '#9ca3af', calendarMode: 'preference', badgeStyle: 'solid' }, // gray-400
  scheduled:     { color: '#a78bfa', calendarMode: 'always',     badgeStyle: 'solid' }, // violet-400
  confirmed:     { color: '#0284c7', calendarMode: 'preference', badgeStyle: 'solid' }, // sky-600
  arrived:       { color: '#f59e0b', calendarMode: 'preference', badgeStyle: 'solid' }, // amber-500
  arrived_late:  { color: '#d97706', calendarMode: 'preference', badgeStyle: 'solid' }, // amber-600
  in_progress:   { color: '#f97316', calendarMode: 'preference', badgeStyle: 'solid' }, // orange-500
  completed:     { color: '#16a34a', calendarMode: 'preference', badgeStyle: 'solid' }, // green-600
  attended_late: { color: '#0d9488', calendarMode: 'preference', badgeStyle: 'solid' }, // teal-600
  no_show:       { color: '#4b5563', calendarMode: 'always',     badgeStyle: 'solid' }, // gray-600
  cancelled:     { color: '#6b7280', calendarMode: 'preference', badgeStyle: 'solid' }, // gray-500
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
