import { endOfDay, format, isValid, parseISO, startOfDay } from 'date-fns';

import { normalizeAppointmentStatus } from '@/constants/appointment-status';
import { API_ROUTES } from '@/constants/routes';
import { autoColWidths, sanitizeSheetName } from '@/lib/xlsx-export';
import { api } from '@/services/api';

/**
 * Exporta la agenda de citas de un único calendario a un `.xlsx` con el formato
 * de "planilla del día" (Horario · Estudio · Nombre y Apellido · Cédula ·
 * Teléfono). Reutiliza el endpoint `/users_appointments` que ya alimenta el
 * calendario, filtrado por `calendar_source_ids` y rango de fechas. Se excluyen
 * las citas canceladas y las ausencias (no-show), igual que el portal del
 * paciente.
 */

export interface ScheduleExportRow {
  time: string; // HH:mm
  study: string;
  patientName: string;
  identityDocument: string;
  phone: string;
  start: Date;
}

export interface ScheduleColumnHeaders {
  time: string;
  study: string;
  name: string;
  identityDocument: string;
  phone: string;
}

const parseDateTime = (value?: string): Date | null => {
  if (!value) return null;
  const parsed = parseISO(value.replace(/Z$/, ''));
  return isValid(parsed) ? parsed : null;
};

/** Trae y normaliza las filas de la planilla para un calendario y rango dados. */
export async function fetchScheduleRows(
  calendarSourceId: string,
  from: Date,
  to: Date,
): Promise<ScheduleExportRow[]> {
  const formatForAPI = (d: Date) => format(d, 'yyyy-MM-dd HH:mm:ss');

  const data = await api.get(API_ROUTES.USERS_APPOINTMENTS, {
    startingDateAndTime: formatForAPI(startOfDay(from)),
    endingDateAndTime: formatForAPI(endOfDay(to)),
    calendar_source_ids: calendarSourceId,
  });

  let rows: any[] = [];
  if (Array.isArray(data) && data.length > 0 && 'json' in data[0]) {
    rows = data.map((item: any) => item.json);
  } else if (Array.isArray(data)) {
    rows = data;
  }

  return rows
    .map((r: any): ScheduleExportRow | null => {
      const startNode = r.start_time || r.start;
      const startStr = typeof startNode === 'string' ? startNode : startNode?.dateTime;
      const start = parseDateTime(startStr);
      if (!start) return null;

      const status = normalizeAppointmentStatus(r.status);
      if (status === 'cancelled' || status === 'no_show') return null;

      return {
        time: format(start, 'HH:mm'),
        study: String(r.summary || r.service_name || r.serviceName || '').trim(),
        patientName: String(
          r.patient_name || r.patientName || r.patientname || r.user_name || '',
        ).trim(),
        identityDocument: String(
          r.patient_identity_document ||
            r.patientIdentityDocument ||
            r.identity_document ||
            r.patient_ci ||
            '',
        ).trim(),
        phone: String(
          r.patient_phone || r.patientPhone || r.patientphone || r.phone_number || '',
        ).trim(),
        start,
      };
    })
    .filter((row): row is ScheduleExportRow => row !== null)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

function sanitizeFilePart(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, ' ').trim() || 'agenda';
}

interface ExportScheduleParams {
  calendar: { id: string; name: string };
  from: Date;
  to: Date;
  columns: ScheduleColumnHeaders;
}

/**
 * Genera y descarga el `.xlsx` con la fila de encabezados de columna y un
 * registro por cita, sin ningún preámbulo. Devuelve la cantidad de citas para
 * que la UI avise cuando el período no tiene ninguna (en ese caso no descarga).
 */
export async function exportScheduleToExcel({
  calendar,
  from,
  to,
  columns,
}: ExportScheduleParams): Promise<{ count: number }> {
  const rows = await fetchScheduleRows(calendar.id, from, to);
  if (!rows.length) return { count: 0 };

  const { utils, writeFile } = await import('xlsx');

  const headerRow = [
    columns.time,
    columns.study,
    columns.name,
    columns.identityDocument,
    columns.phone,
  ];
  const aoa: unknown[][] = [
    headerRow,
    ...rows.map((r) => [r.time, r.study, r.patientName, r.identityDocument, r.phone]),
  ];

  const ws = utils.aoa_to_sheet(aoa);
  ws['!cols'] = autoColWidths(aoa, headerRow.length);

  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, sanitizeSheetName(calendar.name, new Set()));

  const sameDay = format(from, 'yyyy-MM-dd') === format(to, 'yyyy-MM-dd');
  const dateTag = sameDay
    ? format(from, 'yyyy-MM-dd')
    : `${format(from, 'yyyy-MM-dd')}_${format(to, 'yyyy-MM-dd')}`;
  writeFile(wb, `${sanitizeFilePart(calendar.name)}_${dateTag}.xlsx`);

  return { count: rows.length };
}
