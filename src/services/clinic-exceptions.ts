import { API_ROUTES } from '@/constants/routes';
import type { ClinicException } from '@/lib/types';
import { api, REQUEST_TIMEOUT_MS, type ApiRequestOptions } from '@/services/api';

/**
 * Rows of Configuración → Horarios de excepción (`clinic_exceptions`), written
 * through the same `/feriados/upsert` and `/feriados/delete` flows that screen uses.
 */

function throwOnErrorResponse(responseData: any, fallback: string) {
  if (responseData && typeof responseData === 'object' && responseData.error === true) {
    throw new Error(responseData.message || fallback);
  }
  if (Array.isArray(responseData) && responseData[0]?.code >= 400) {
    throw new Error(responseData[0]?.message || fallback);
  }
}

/** Creates (empty `id`) or updates an exception row. */
export async function upsertClinicException(exception: ClinicException, options?: ApiRequestOptions): Promise<void> {
  const recurrence = exception.recurrence ?? 'once';
  const isOnce = recurrence === 'once';
  const isWeekly = recurrence === 'weekly' || recurrence === 'biweekly';
  const dates = isOnce ? [...(exception.dates?.length ? exception.dates : [exception.date])].sort() : null;
  const payload = {
    ...(exception.id ? { id: exception.id } : {}),
    // 'once': la fila se ordena por su primera fecha.
    date: dates ? dates[0] : exception.date,
    dates,
    recurrence,
    is_open: exception.is_open,
    // NULL y no '': un cierre sin horas cierra el día completo.
    start_time: exception.start_time || null,
    end_time: exception.end_time || null,
    // Vacío = todas las sedes -> NULL en la columna.
    sede_id: exception.sede_id ? Number(exception.sede_id) : null,
    notes: exception.notes ?? '',
    days_of_week: isWeekly ? exception.days_of_week ?? [] : null,
    days_of_month: recurrence === 'monthly' ? exception.days_of_month ?? [] : null,
    biweekly_reference_date: exception.biweekly_reference_date || null,
    end_date: exception.end_date || null,
  };
  const responseData = await api.post(API_ROUTES.HOLIDAYS_UPSERT, payload, undefined, undefined, {
    timeoutMs: REQUEST_TIMEOUT_MS.mutation,
    ...options,
  });
  throwOnErrorResponse(responseData, 'Failed to save exception');
}

export async function deleteClinicException(id: string, options?: ApiRequestOptions): Promise<void> {
  const responseData = await api.delete(API_ROUTES.HOLIDAYS_DELETE, { id }, undefined, undefined, {
    timeoutMs: REQUEST_TIMEOUT_MS.mutation,
    ...options,
  });
  throwOnErrorResponse(responseData, 'Failed to delete exception');
}
