'use client';

import { resolveStatusDisplay, statusBadgeClassNames } from '@/lib/appointment-status-display';
import type { AppointmentStatus, AppointmentStatusDisplay, AppointmentStatusDisplayMatrix } from '@/lib/types';
import { useCalendarStatusDisplayStore } from '@/stores/calendar-status-display-store';

export interface AppointmentStatusDisplayApi {
  matrix: AppointmentStatusDisplayMatrix;
  colorOf: (status: AppointmentStatus) => string;
  displayOf: (status: AppointmentStatus) => AppointmentStatusDisplay;
  badgeClassOf: (status: AppointmentStatus) => string;
}

/**
 * Única puerta de entrada de los componentes a la matriz de colores de
 * estado: resuelve `byCalendar[calendarId] ?? general` sin disparar
 * peticiones. Mismo patrón que `useDiscountSettings`.
 */
export function useAppointmentStatusDisplay(calendarId?: string | null): AppointmentStatusDisplayApi {
  const general = useCalendarStatusDisplayStore((s) => s.general);
  const byCalendar = useCalendarStatusDisplayStore((s) => s.byCalendar);

  const matrix = (calendarId && byCalendar[calendarId]) || general;

  return {
    matrix,
    colorOf: (status) => resolveStatusDisplay(matrix, status).color,
    displayOf: (status) => resolveStatusDisplay(matrix, status),
    badgeClassOf: (status) => statusBadgeClassNames(resolveStatusDisplay(matrix, status)),
  };
}
