import { endOfDay, format, isValid, parseISO, startOfDay } from 'date-fns';

import { normalizeAppointmentStatus } from '@/constants/appointment-status';
import { API_ROUTES } from '@/constants/routes';
import { autoColWidths, sanitizeSheetName } from '@/lib/xlsx-export';
import { api } from '@/services/api';

/**
 * Exporta la agenda de citas de un único calendario a un `.xlsx` con el formato
 * de "planilla del día" (Horario · Nombre y Apellido · Teléfono). Reutiliza el
 * endpoint `/users_appointments` que ya alimenta el calendario, filtrado por
 * `calendar_source_ids` y rango de fechas. Se excluyen las citas canceladas y
 * las ausencias (no-show), igual que el portal del paciente. Cuando la cita no
 * tiene nombre de paciente se usa el texto del estudio (`summary`) como nombre.
 */

export interface ScheduleExportRow {
  time: string; // HH:mm
  patientName: string;
  phone: string;
  start: Date;
}

export interface ScheduleColumnHeaders {
  time: string;
  name: string;
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

      const study = String(r.summary || r.service_name || r.serviceName || '').trim();
      const name = String(
        r.patient_name || r.patientName || r.patientname || r.user_name || '',
      ).trim();

      return {
        time: format(start, 'HH:mm'),
        // Si la cita no trae nombre de paciente, se usa el estudio como nombre.
        patientName: name || study,
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

/**
 * Pone bordes finos en toda la tabla y la fila de encabezados en negrita. Sin
 * rellenos ni cambios de color: solo fuente y líneas. `xlsx-js-style` lee el
 * estilo desde la propiedad `.s` de cada celda; hay que recorrer el rango
 * completo porque las celdas vacías no se crean solas y sin celda no hay borde.
 */
function applyScheduleSheetStyles(
  ws: Record<string, any>,
  utils: { encode_cell: (cell: { r: number; c: number }) => string },
  rowCount: number,
  colCount: number,
): void {
  const line = { style: 'thin' };
  const border = { top: line, bottom: line, left: line, right: line };

  for (let r = 0; r < rowCount; r++) {
    for (let c = 0; c < colCount; c++) {
      const addr = utils.encode_cell({ r, c });
      if (!ws[addr]) ws[addr] = { t: 's', v: '' };
      ws[addr].s = r === 0 ? { border, font: { bold: true } } : { border };
    }
  }
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

  // `xlsx-js-style` es el fork de SheetJS que sí serializa estilos por celda al
  // escribir (la edición community de `xlsx` los ignora). Misma API.
  const { utils, writeFile } = await import('xlsx-js-style');

  const headerRow = [columns.time, columns.name, columns.phone];
  const aoa: unknown[][] = [
    headerRow,
    ...rows.map((r) => [r.time, r.patientName, r.phone]),
  ];

  const ws = utils.aoa_to_sheet(aoa);
  ws['!cols'] = autoColWidths(aoa, headerRow.length);
  applyScheduleSheetStyles(ws, utils, aoa.length, headerRow.length);

  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, sanitizeSheetName(calendar.name, new Set()));

  const sameDay = format(from, 'yyyy-MM-dd') === format(to, 'yyyy-MM-dd');
  const dateTag = sameDay
    ? format(from, 'yyyy-MM-dd')
    : `${format(from, 'yyyy-MM-dd')}_${format(to, 'yyyy-MM-dd')}`;
  writeFile(wb, `${sanitizeFilePart(calendar.name)}_${dateTag}.xlsx`);

  return { count: rows.length };
}
