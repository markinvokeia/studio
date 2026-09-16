import { DEFAULT_STATUS_DISPLAY } from '@/constants/appointment-status';
import { API_ROUTES } from '@/constants/routes';
import { mergeStatusMatrix } from '@/lib/appointment-status-display';
import type { CalendarStatusDisplayRow } from '@/lib/types';
import { api } from '@/services/api';

/**
 * Configuración → Colores de calendario. Fila por `(calendar_id, status)`:
 * `calendar_id: null` es la matriz general de la clínica, no-null un override
 * de ese calendario. Ver plan `calendar-status-colors-plan.md`.
 */

function unwrapRows(data: unknown): unknown[] {
  if (Array.isArray(data)) {
    // Soporta tanto `[{status, ...}, ...]` como `[{json: {status, ...}}, ...]`
    // o `[{data: [...]}]`, mismo patrón defensivo que `unwrapCalendarSettingsRow`.
    if (data.length > 0 && Array.isArray((data[0] as any)?.data)) return (data[0] as any).data;
    return data.map((row) => (row as any)?.json ?? row);
  }
  const wrapped = (data as any)?.data ?? (data as any)?.json ?? data;
  return Array.isArray(wrapped) ? wrapped : wrapped ? [wrapped] : [];
}

function toRow(raw: any): CalendarStatusDisplayRow | null {
  if (!raw || typeof raw.status !== 'string') return null;
  return {
    calendar_id: raw.calendar_id != null ? String(raw.calendar_id) : null,
    status: raw.status,
    color: raw.color,
    calendarMode: raw.calendar_mode,
    badgeStyle: raw.badge_style,
  };
}

export async function fetchStatusDisplayRows(): Promise<CalendarStatusDisplayRow[]> {
  const data = await api.get(API_ROUTES.CALENDAR_STATUS_DISPLAY.SEARCH);
  return unwrapRows(data)
    .map(toRow)
    .filter((row): row is CalendarStatusDisplayRow => row !== null);
}

/**
 * Batch: guardar la matriz completa (10 filas) o replicarla a N calendarios
 * (10·N filas) son ambos una sola petición. Un flujo de a una fila haría
 * 10·N requests al replicar — ver §2 del plan.
 */
export async function upsertStatusDisplayRows(rows: CalendarStatusDisplayRow[]): Promise<void> {
  const response = await api.post(API_ROUTES.CALENDAR_STATUS_DISPLAY.UPSERT, {
    rows: rows.map((row) => ({
      calendar_id: row.calendar_id,
      status: row.status,
      color: row.color,
      calendar_mode: row.calendarMode,
      badge_style: row.badgeStyle,
    })),
  });

  const result = Array.isArray(response) ? response[0] : response;
  if (result?.error || (result?.code && result.code >= 400)) {
    throw new Error(result?.message || 'No se pudo guardar la matriz de colores.');
  }
}

export async function deleteCalendarOverride(calendarId: string): Promise<void> {
  const response = await api.post(API_ROUTES.CALENDAR_STATUS_DISPLAY.DELETE, {
    calendar_id: calendarId,
  });

  const result = Array.isArray(response) ? response[0] : response;
  if (result?.error || (result?.code && result.code >= 400)) {
    throw new Error(result?.message || 'No se pudo quitar la configuración de ese calendario.');
  }
}

/** Aplica filas crudas de la API sobre los defaults compilados. Nunca lanza. */
export function buildMatrixFromRows(rows: CalendarStatusDisplayRow[]) {
  return mergeStatusMatrix(DEFAULT_STATUS_DISPLAY, rows);
}
