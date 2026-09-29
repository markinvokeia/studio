import { API_ROUTES } from '@/constants/routes';
import { DEFAULT_COLOR_SOURCES } from '@/lib/appointment-color';
import type { CalendarColorSourceRow, CalendarColorSources } from '@/lib/types';
import { api, type ApiRequestOptions } from '@/services/api';

/**
 * Configuración → Colores de calendario → Origen del color. Una fila por
 * calendario: `calendar_id: null` es la configuración general de la clínica,
 * no-null un override que reemplaza por completo a la general.
 */

function unwrapRows(data: unknown): unknown[] {
  if (Array.isArray(data)) {
    // Mismo patrón defensivo que `calendar-status-display`: `[{...}]`, `[{json: {...}}]` o `[{data: [...]}]`.
    if (data.length > 0 && Array.isArray((data[0] as any)?.data)) return (data[0] as any).data;
    return data.map((row) => (row as any)?.json ?? row);
  }
  const wrapped = (data as any)?.data ?? (data as any)?.json ?? data;
  return Array.isArray(wrapped) ? wrapped : wrapped ? [wrapped] : [];
}

const toFlag = (value: unknown, fallback: boolean): boolean => (typeof value === 'boolean' ? value : fallback);

function toRow(raw: any): CalendarColorSourceRow | null {
  // Una respuesta vacía de n8n llega como `{success: true}` sin las columnas: no es una fila.
  if (!raw || typeof raw !== 'object' || !('use_service' in raw || 'use_doctor' in raw || 'use_calendar' in raw)) return null;
  return {
    calendar_id: raw.calendar_id != null ? String(raw.calendar_id) : null,
    service: toFlag(raw.use_service, DEFAULT_COLOR_SOURCES.service),
    doctor: toFlag(raw.use_doctor, DEFAULT_COLOR_SOURCES.doctor),
    calendar: toFlag(raw.use_calendar, DEFAULT_COLOR_SOURCES.calendar),
  };
}

export async function fetchColorSourceRows(options?: ApiRequestOptions): Promise<CalendarColorSourceRow[]> {
  const data = await api.get(API_ROUTES.CALENDAR_COLOR_SOURCE.SEARCH, undefined, undefined, options);
  return unwrapRows(data)
    .map(toRow)
    .filter((row): row is CalendarColorSourceRow => row !== null);
}

/** Guarda una fila (general u override de un calendario). */
export async function upsertColorSourceRow(
  calendarId: string | null,
  sources: CalendarColorSources,
  options?: ApiRequestOptions,
): Promise<void> {
  const response = await api.post(API_ROUTES.CALENDAR_COLOR_SOURCE.UPSERT, {
    calendar_id: calendarId,
    use_service: sources.service,
    use_doctor: sources.doctor,
    use_calendar: sources.calendar,
  }, undefined, undefined, options);

  const result = Array.isArray(response) ? response[0] : response;
  if (result?.error || (result?.code && result.code >= 400)) {
    throw new Error(result?.message || 'No se pudo guardar el origen del color.');
  }
}

/** Borra el override de ese calendario: vuelve a usar la configuración general. */
export async function deleteColorSourceOverride(calendarId: string, options?: ApiRequestOptions): Promise<void> {
  const response = await api.post(API_ROUTES.CALENDAR_COLOR_SOURCE.DELETE, {
    calendar_id: calendarId,
  }, undefined, undefined, options);

  const result = Array.isArray(response) ? response[0] : response;
  if (result?.error || (result?.code && result.code >= 400)) {
    throw new Error(result?.message || 'No se pudo quitar la configuración de ese calendario.');
  }
}
