import { getReadableTextColor } from '@/components/calendar/calendar-utils';

import type {
  AppointmentColorSource,
  AppointmentStatus,
  AppointmentStatusDisplay,
  AppointmentStatusDisplayMatrix,
  CalendarStatusDisplayRow,
  StatusBadgeStyle,
  StatusCalendarMode,
} from '@/lib/types';

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const CALENDAR_MODES: StatusCalendarMode[] = ['always', 'preference', 'never'];
const BADGE_STYLES: StatusBadgeStyle[] = ['solid', 'soft', 'outline'];

export function resolveStatusDisplay(
  matrix: AppointmentStatusDisplayMatrix,
  status: AppointmentStatus,
): AppointmentStatusDisplay {
  return matrix[status];
}

/**
 * Aplica filas de override (backend/DB) sobre una matriz base. Filas con un
 * hex o enum inválido se ignoran en vez de romper el calendario: es la
 * defensa contra datos corruptos que documenta el plan de colores de estado.
 */
export function mergeStatusMatrix(
  base: AppointmentStatusDisplayMatrix,
  rows: CalendarStatusDisplayRow[],
): AppointmentStatusDisplayMatrix {
  const result = { ...base };
  for (const row of rows) {
    if (!row || !(row.status in result)) continue;
    if (typeof row.color !== 'string' || !HEX_COLOR_RE.test(row.color)) continue;
    if (!CALENDAR_MODES.includes(row.calendarMode)) continue;
    if (!BADGE_STYLES.includes(row.badgeStyle)) continue;
    result[row.status] = {
      color: row.color,
      calendarMode: row.calendarMode,
      badgeStyle: row.badgeStyle,
    };
  }
  return result;
}

/** Clases Tailwind para un badge/chip con el color de la matriz. Ver `custom` en `badge.tsx`. */
export function statusBadgeClassNames(display: AppointmentStatusDisplay): string {
  switch (display.badgeStyle) {
    case 'soft':
      return 'border-transparent';
    case 'outline':
      return 'bg-transparent border';
    case 'solid':
    default:
      return 'border-transparent';
  }
}

export type StatusBadgeInlineStyle = {
  backgroundColor?: string;
  color?: string;
  borderColor?: string;
};

/** Estilos inline (color/fondo/borde) que acompañan a `statusBadgeClassNames`. */
export function statusBadgeInlineStyle(display: AppointmentStatusDisplay): StatusBadgeInlineStyle {
  switch (display.badgeStyle) {
    case 'soft':
      return { backgroundColor: `${display.color}26`, color: display.color };
    case 'outline':
      return { borderColor: display.color, color: display.color };
    case 'solid':
    default:
      return { backgroundColor: display.color, color: getReadableTextColor(display.color) };
  }
}

/**
 * Decide con qué color se dibuja la card de una cita y si el estado va como
 * franja lateral. Dos decisiones independientes:
 *
 *   1. `showsStatus` — ¿el estado participa? Lo gobierna `display.calendarMode`:
 *      'always' siempre, 'never' nunca, 'preference' según el switch
 *      "colorear por estado" del usuario.
 *   2. `keepsOwnColor` — ¿la cita ya tiene un color propio que respetar? Lo es
 *      cualquier color efectivo de la cadena `etiqueta > servicio > doctor >
 *      consultorio`: si la cita se ve de un color, ese color se mantiene y el
 *      estado se comunica con la franja lateral, no pisando la card.
 *
 * `always` es la única excepción: pisa el color heredado de servicio, doctor o
 * consultorio. Lo que nunca pisa es la etiqueta de color puesta a mano sobre la
 * cita, porque es una decisión explícita que debe verse al instante.
 *
 * Sin color en ninguno de los cuatro niveles (`colorSource: 'none'`) no hay
 * nada que preservar: ahí el estado pinta la card entera.
 */
export function resolveEventStatusColors({
  status,
  display,
  colorSource,
  color,
  colorByStatus,
}: {
  status: AppointmentStatus;
  display: AppointmentStatusDisplay;
  colorSource: AppointmentColorSource | undefined;
  color: string | undefined;
  colorByStatus: boolean;
}): { color: string | undefined; statusColored: boolean; statusStripeColor: string | undefined } {
  const showsStatus =
    display.calendarMode === 'always'
      ? true
      : display.calendarMode === 'never'
        ? false
        : colorByStatus;
  const forces = display.calendarMode === 'always';
  const hasOwnColorTag = colorSource === 'appointment' && Boolean(color);
  // Heredado del servicio, del doctor o del consultorio: es color que la cita ya
  // muestra, así que se preserva salvo que el estado esté en modo 'always'.
  const inheritsColor =
    Boolean(color) &&
    (colorSource === 'service' || colorSource === 'doctor' || colorSource === 'calendar');
  const keepsOwnColor = hasOwnColorTag || (!forces && inheritsColor);
  const statusColored = showsStatus && !keepsOwnColor;

  return {
    color: statusColored ? display.color : color,
    statusColored,
    statusStripeColor: showsStatus && keepsOwnColor ? display.color : undefined,
  };
}
