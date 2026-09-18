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
 * Extracción literal de la lógica de pintado del calendario (antes en
 * `appointments/page.tsx`), con `STATUS_FORCED_CALENDAR_COLOR` reemplazado
 * por `display.calendarMode`.
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
  const keepsOwnColor = hasOwnColorTag || (!forces && colorSource === 'service');
  const statusColored = showsStatus && !keepsOwnColor;

  return {
    color: statusColored ? display.color : color,
    statusColored,
    statusStripeColor: showsStatus && keepsOwnColor ? display.color : undefined,
  };
}
