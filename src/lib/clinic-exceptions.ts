import type { ClinicException, ClinicExceptionRecurrence } from '@/lib/types';
import { parseDateList, parseNumberList } from '@/lib/day-lists';
import { formatDate } from '@/lib/utils';

/** Fila de `/exceptions` → ClinicException, con fechas `yyyy-MM-dd` y listas ordenadas. */
export function parseClinicException(raw: Record<string, unknown>): ClinicException {
  const recurrence = (raw.recurrence as ClinicExceptionRecurrence) || 'once';
  const date = raw.date ? formatDate(raw.date as string) : '';
  return {
    id: raw.id ? String(raw.id) : `ex_${Math.random().toString(36).slice(2, 11)}`,
    date,
    is_open: Boolean(raw.is_open),
    start_time: (raw.start_time as string) ?? '',
    end_time: (raw.end_time as string) ?? '',
    // Sede vacía/ausente = excepción global (aplica a todas las sedes).
    sede_id: raw.sede_id !== undefined && raw.sede_id !== null && String(raw.sede_id) !== ''
      ? String(raw.sede_id)
      : undefined,
    sede_name: raw.sede_name ? String(raw.sede_name) : undefined,
    // Notes can come under a few key names depending on the flow.
    notes: String(raw.notes ?? raw.note ?? raw.nota ?? raw.notas ?? raw.description ?? raw.descripcion ?? raw.motivo ?? ''),
    recurrence,
    dates: recurrence === 'once' ? parseDateList(raw.dates, date) : undefined,
    days_of_week: recurrence === 'weekly' || recurrence === 'biweekly' ? parseNumberList(raw.days_of_week, raw.day_of_week) : undefined,
    days_of_month: recurrence === 'monthly' ? parseNumberList(raw.days_of_month, raw.day_of_month) : undefined,
    biweekly_reference_date: raw.biweekly_reference_date ? formatDate(raw.biweekly_reference_date as string) : undefined,
    end_date: raw.end_date ? formatDate(raw.end_date as string) : undefined,
  };
}

/** Rows of a `/exceptions` response, whatever envelope the flow used. */
export function parseClinicExceptions(data: unknown): ClinicException[] {
  const envelope = data as { exceptions?: unknown[]; data?: unknown[]; result?: unknown[] } | null;
  const rows = Array.isArray(data) ? data : (envelope?.exceptions || envelope?.data || envelope?.result || []);
  return (rows as Record<string, unknown>[]).map(parseClinicException);
}
