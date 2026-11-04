import { addDays, addMonths, endOfMonth, parse, startOfDay } from 'date-fns';

import type { PatientBookingWindowUnit } from '@/lib/types';

/**
 * Ventana de reserva del portal: hasta qué fecha puede agendar el paciente.
 *
 * - `days` + N ⇒ hasta hoy + N días.
 * - `months` + N ⇒ hasta el último día del mes calendario N, contando el actual
 *   como el 1. Con N = 1, sólo el mes en curso.
 *
 * Es el mismo cálculo que `patient_portal_booking_limit_date()` en la BD
 * (script 159), que es la que decide al crear la cita: si se cambia uno, hay que
 * cambiar el otro.
 */
export const DEFAULT_BOOKING_WINDOW_UNIT: PatientBookingWindowUnit = 'days';
export const DEFAULT_BOOKING_WINDOW_VALUE = 30;

/** Máximos por unidad. Coinciden con el CHECK de `public.clinic`. */
export const BOOKING_WINDOW_MAX: Record<PatientBookingWindowUnit, number> = {
  days: 365,
  months: 12,
};

export function isValidBookingWindow(unit: PatientBookingWindowUnit, value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= BOOKING_WINDOW_MAX[unit];
}

/** Última fecha reservable, inclusive. */
export function getBookingLimitDate(today: Date, unit: PatientBookingWindowUnit, value: number): Date {
  return unit === 'months'
    ? startOfDay(endOfMonth(addMonths(today, value - 1)))
    : addDays(startOfDay(today), value);
}

/** Normaliza lo que manda el backend; ausente o inválido ⇒ el default. */
export function parseBookingWindow(rawUnit: unknown, rawValue: unknown): {
  unit: PatientBookingWindowUnit;
  value: number;
} {
  const unit: PatientBookingWindowUnit = rawUnit === 'months' ? 'months' : 'days';
  const value = Number(rawValue);
  return isValidBookingWindow(unit, value)
    ? { unit, value }
    : { unit: DEFAULT_BOOKING_WINDOW_UNIT, value: DEFAULT_BOOKING_WINDOW_VALUE };
}

/**
 * Si el backend rechazó la cita por estar fuera de la ventana, devuelve la fecha
 * límite. Pasa cuando la clínica achicó la ventana con el portal ya abierto.
 */
export function getBookingWindowRejection(error: unknown): Date | null {
  const { status, data } = (error ?? {}) as { status?: number; data?: unknown };
  if (status !== 422) return null;

  const body = (Array.isArray(data) ? data[0] : data) as
    | { error_code?: string; limit_date?: string }
    | null
    | undefined;
  if (body?.error_code !== 'booking_window_exceeded' || !body.limit_date) return null;

  const limit = parse(body.limit_date, 'yyyy-MM-dd', new Date());
  return Number.isNaN(limit.getTime()) ? null : limit;
}
