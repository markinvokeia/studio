import { endOfDay, format, isValid, parseISO, startOfDay, type Locale } from 'date-fns';

import { normalizeAppointmentStatus } from '@/constants/appointment-status';
import { API_ROUTES } from '@/constants/routes';
import { getEffectiveAppointmentContact, normalizeResponsibleContact } from '@/lib/appointment-contact';
import type { AppointmentStatus, ScheduleExportColumn, ScheduleExportSettings } from '@/lib/types';
import { autoColWidths, sanitizeSheetName } from '@/lib/xlsx-export';
import { api } from '@/services/api';
import { DEFAULT_SCHEDULE_EXPORT_COLUMNS } from '@/services/system-config';

/**
 * Exporta la agenda de citas a un `.xlsx`. Reutiliza el endpoint
 * `/users_appointments` que ya alimenta el calendario, filtrado por
 * `calendar_source_ids` y rango de fechas. Se excluyen las citas canceladas y
 * las ausencias (no-show), igual que el portal del paciente. Cuando la cita no
 * tiene nombre de paciente se usa el texto del estudio (`summary`) como nombre.
 *
 * El formato sale de `system_configurations.appointment_schedule_export`:
 * - `basic` (por defecto): un calendario, "planilla del día" (Horario · Nombre y
 *   Apellido · Teléfono) con una fila de fecha antes de las citas de cada día.
 * - `extended`: varios calendarios, con las columnas elegidas en Preferencias de
 *   Clínica, sin filas de agrupación (para ordenar y filtrar en Excel) y, si
 *   `split_by_sede`, una hoja por sede (sólo las sedes con citas).
 */

export interface ScheduleExportRow {
  time: string; // HH:mm
  /** HH:mm; vacío si la cita no trae un fin válido. */
  endTime: string;
  patientName: string;
  phone: string;
  email: string;
  doctor: string;
  service: string;
  status: AppointmentStatus;
  notes: string;
  start: Date;
  calendarId: string;
}

export interface ScheduleExportCalendar {
  id: string;
  name: string;
  /** Nombre de la sede del calendario; vacío si no tiene sede. */
  sedeName?: string;
}

export interface ScheduleExportLabels {
  /** Encabezados del básico. */
  basic: { time: string; name: string; phone: string };
  /** Encabezado de cada columna del extendido. */
  columns: Record<ScheduleExportColumn, string>;
  /** Etiqueta del estado de la cita (la misma que muestra la agenda). */
  status: (status: AppointmentStatus) => string;
  /** Sede de los calendarios que no tienen una. */
  noSede: string;
  /** Base del nombre de archivo y de la hoja cuando se exporta más de un calendario. */
  multiCalendarFile: string;
}

const parseDateTime = (value?: string): Date | null => {
  if (!value) return null;
  const parsed = parseISO(value.replace(/Z$/, ''));
  return isValid(parsed) ? parsed : null;
};

const dateTimeOf = (node: unknown): Date | null =>
  parseDateTime(typeof node === 'string' ? node : (node as { dateTime?: string } | null)?.dateTime);

const text = (...values: unknown[]): string => {
  for (const v of values) {
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return '';
};

/**
 * Servicios de la cita para la columna Servicio / Estudio. El `summary` NO sirve
 * tal cual: la agenda lo guarda como título del evento, "Paciente - Servicios"
 * (ver `generatedSummary` en la página de citas). Se usan los nombres de
 * `services`; sin servicios (citas importadas de Google, donde el summary es el
 * título libre del evento) se usa el summary, quitándole el "Paciente - " si lo trae.
 */
function serviceOf(services: unknown, summary: string, patientName: string): string {
  if (Array.isArray(services)) {
    const names = services.map((s) => text((s as { name?: unknown } | null)?.name)).filter(Boolean);
    if (names.length) return Array.from(new Set(names)).join(', ');
  }
  const prefix = patientName ? `${patientName} - ` : '';
  if (prefix && summary.toLocaleLowerCase().startsWith(prefix.toLocaleLowerCase())) {
    return summary.slice(prefix.length).trim();
  }
  return summary === patientName ? '' : summary;
}

/** Trae y normaliza las filas de la planilla para los calendarios y el rango dados. */
export async function fetchScheduleRows(
  calendarSourceIds: string[],
  from: Date,
  to: Date,
): Promise<ScheduleExportRow[]> {
  const ids = calendarSourceIds.filter(Boolean);
  if (!ids.length) return [];
  const formatForAPI = (d: Date) => format(d, 'yyyy-MM-dd HH:mm:ss');

  const data = await api.get(API_ROUTES.USERS_APPOINTMENTS, {
    startingDateAndTime: formatForAPI(startOfDay(from)),
    endingDateAndTime: formatForAPI(endOfDay(to)),
    calendar_source_ids: ids.join(','),
  });

  let rows: any[] = [];
  if (Array.isArray(data) && data.length > 0 && 'json' in data[0]) {
    rows = data.map((item: any) => item.json);
  } else if (Array.isArray(data)) {
    rows = data;
  }

  const requested = new Set(ids);

  return rows
    .map((r: any): ScheduleExportRow | null => {
      const start = dateTimeOf(r.start_time || r.start);
      if (!start) return null;

      const status = normalizeAppointmentStatus(r.status);
      if (status === 'cancelled' || status === 'no_show') return null;

      // Con un solo calendario pedido, una cita sin `calendar_source_id` es de ese.
      const calendarId = r.calendar_source_id != null ? String(r.calendar_source_id) : ids.length === 1 ? ids[0] : '';
      if (!requested.has(calendarId)) return null;

      const end = dateTimeOf(r.end_time || r.end);
      const patientName = text(r.patient_name, r.patientName, r.patientname, r.user_name);
      const summary = text(r.summary, r.service_name, r.serviceName);
      // Dependientes sin teléfono/correo propio: el del responsable, igual que la agenda.
      const contact = getEffectiveAppointmentContact({
        patientPhone: text(r.patient_phone, r.patientPhone, r.patientphone, r.phone_number),
        patientEmail: text(r.patient_email, r.patientEmail, r.patientemail, r.user_email),
        responsibleContact: normalizeResponsibleContact(r.responsible_contact ?? r.responsibleContact),
      });

      return {
        time: format(start, 'HH:mm'),
        endTime: end && end.getTime() > start.getTime() ? format(end, 'HH:mm') : '',
        // Si la cita no trae nombre de paciente, se usa el estudio como nombre.
        patientName: patientName || summary,
        phone: contact.phone ?? '',
        email: contact.email ?? '',
        doctor: text(r.doctor_name, r.doctorName, r.doctorname, r.assignee_name),
        service: serviceOf(r.services, summary, patientName),
        status,
        notes: text(r.notes),
        start,
        calendarId,
      };
    })
    .filter((row): row is ScheduleExportRow => row !== null)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

function sanitizeFilePart(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, ' ').trim() || 'agenda';
}

type XlsxUtils = {
  encode_cell: (cell: { r: number; c: number }) => string;
  encode_range: (range: { s: { r: number; c: number }; e: { r: number; c: number } }) => string;
  aoa_to_sheet: (aoa: unknown[][]) => Record<string, any>;
};

const THIN = { style: 'thin' };
const BORDER = { top: THIN, bottom: THIN, left: THIN, right: THIN };

/**
 * Bordes finos en toda la tabla; en negrita el encabezado (fila 0) y las filas
 * de `boldRows`. Sin rellenos ni colores. `xlsx-js-style` lee el estilo desde la
 * propiedad `.s` de cada celda; se recorre el rango completo porque las celdas
 * vacías no se crean solas y sin celda no hay borde.
 */
function applySheetStyles(
  ws: Record<string, any>,
  utils: XlsxUtils,
  rowCount: number,
  colCount: number,
  boldRows: Set<number> = new Set(),
): void {
  for (let r = 0; r < rowCount; r++) {
    const bold = r === 0 || boldRows.has(r);
    for (let c = 0; c < colCount; c++) {
      const addr = utils.encode_cell({ r, c });
      if (!ws[addr]) ws[addr] = { t: 's', v: '' };
      ws[addr].s = bold ? { border: BORDER, font: { bold: true } } : { border: BORDER };
    }
  }
}

/**
 * Número de serie de Excel del día (sin hora). Se calcula en UTC a partir de la
 * fecha local para no arrastrar el desfase horario histórico que SheetJS mete al
 * convertir un `Date` (en Montevideo, 1899 tenía un offset de -3:44:51).
 */
function excelDateSerial(date: Date): number {
  return (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(1899, 11, 30)) / 86_400_000;
}

const capitalize = (s: string) => (s ? s.charAt(0).toLocaleUpperCase() + s.slice(1) : s);

/** Básico: encabezado y, por cada día, una fila con la fecha (celdas combinadas) y sus citas. */
function buildBasicSheet(
  utils: XlsxUtils,
  rows: ScheduleExportRow[],
  labels: ScheduleExportLabels,
  dateLocale?: Locale,
): Record<string, any> {
  const COLS = 3;
  const aoa: unknown[][] = [[labels.basic.time, labels.basic.name, labels.basic.phone]];
  const dayRows = new Set<number>();
  let currentDay = '';

  for (const r of rows) {
    const day = format(r.start, 'yyyy-MM-dd');
    if (day !== currentDay) {
      currentDay = day;
      dayRows.add(aoa.length);
      aoa.push([capitalize(format(r.start, 'EEEE dd/MM/yyyy', { locale: dateLocale })), '', '']);
    }
    aoa.push([r.time, r.patientName, r.phone]);
  }

  const ws = utils.aoa_to_sheet(aoa);
  // El ancho no se calcula con la fila de fecha: va combinada sobre las 3 columnas.
  ws['!cols'] = autoColWidths(aoa.filter((_, i) => !dayRows.has(i)), COLS);
  ws['!merges'] = Array.from(dayRows, (r) => ({ s: { r, c: 0 }, e: { r, c: COLS - 1 } }));
  applySheetStyles(ws, utils, aoa.length, COLS, dayRows);
  return ws;
}

interface ExtendedContext {
  sedeOf: (row: ScheduleExportRow) => string;
  calendarOf: (row: ScheduleExportRow) => string;
  labels: ScheduleExportLabels;
}

function cellValue(column: ScheduleExportColumn, row: ScheduleExportRow, ctx: ExtendedContext): string {
  switch (column) {
    case 'sede': return ctx.sedeOf(row) || ctx.labels.noSede;
    case 'calendar': return ctx.calendarOf(row);
    case 'date': return format(row.start, 'dd/MM/yyyy'); // se reemplaza por la fecha real de Excel
    case 'time': return row.time;
    case 'end_time': return row.endTime;
    case 'patient_name': return row.patientName;
    case 'phone': return row.phone;
    case 'email': return row.email;
    case 'doctor': return row.doctor;
    case 'service': return row.service;
    case 'status': return ctx.labels.status(row.status);
    case 'notes': return row.notes;
  }
}

/** Extendido: tabla plana con las columnas elegidas, la fecha como fecha de Excel y filtros. */
function buildExtendedSheet(
  utils: XlsxUtils,
  rows: ScheduleExportRow[],
  columns: ScheduleExportColumn[],
  ctx: ExtendedContext,
): Record<string, any> {
  const aoa: unknown[][] = [
    columns.map((c) => ctx.labels.columns[c]),
    ...rows.map((r) => columns.map((c) => cellValue(c, r, ctx))),
  ];

  const ws = utils.aoa_to_sheet(aoa);
  // Fecha como número de serie con formato de fecha: Excel la ordena y filtra como fecha.
  const dateCol = columns.indexOf('date');
  if (dateCol >= 0) {
    rows.forEach((r, i) => {
      ws[utils.encode_cell({ r: i + 1, c: dateCol })] = { t: 'n', v: excelDateSerial(r.start), z: 'dd/mm/yyyy' };
    });
  }
  ws['!cols'] = autoColWidths(aoa, columns.length);
  ws['!autofilter'] = { ref: utils.encode_range({ s: { r: 0, c: 0 }, e: { r: aoa.length - 1, c: columns.length - 1 } }) };
  applySheetStyles(ws, utils, aoa.length, columns.length);
  return ws;
}

interface ExportScheduleParams {
  settings: ScheduleExportSettings;
  /** En básico se usa sólo el primero. */
  calendars: ScheduleExportCalendar[];
  from: Date;
  to: Date;
  labels: ScheduleExportLabels;
  /** Idioma del nombre del día en las filas de fecha del básico. */
  dateLocale?: Locale;
}

/**
 * Genera y descarga el `.xlsx`. Devuelve la cantidad de citas para que la UI
 * avise cuando el período no tiene ninguna (en ese caso no descarga).
 */
export async function exportScheduleToExcel({
  settings,
  calendars,
  from,
  to,
  labels,
  dateLocale,
}: ExportScheduleParams): Promise<{ count: number; sheets: number }> {
  const isBasic = settings.mode === 'basic';
  const selected = isBasic ? calendars.slice(0, 1) : calendars;
  if (!selected.length) return { count: 0, sheets: 0 };

  const rows = await fetchScheduleRows(selected.map((c) => c.id), from, to);
  if (!rows.length) return { count: 0, sheets: 0 };

  // `xlsx-js-style` es el fork de SheetJS que sí serializa estilos por celda al
  // escribir (la edición community de `xlsx` los ignora). Misma API.
  const { utils, writeFile } = await import('xlsx-js-style');

  const baseName = selected.length === 1 ? selected[0].name : labels.multiCalendarFile;
  const wb = utils.book_new();
  const usedSheetNames = new Set<string>();

  if (isBasic) {
    utils.book_append_sheet(wb, buildBasicSheet(utils, rows, labels, dateLocale), sanitizeSheetName(baseName, usedSheetNames));
  } else {
    const byId = new Map(selected.map((c) => [c.id, c]));
    const ctx: ExtendedContext = {
      sedeOf: (row) => byId.get(row.calendarId)?.sedeName?.trim() || '',
      calendarOf: (row) => byId.get(row.calendarId)?.name ?? '',
      labels,
    };
    // Sede (las sin sede al final), después fecha y hora, después calendario.
    const sorted = [...rows].sort((a, b) => {
      const sa = ctx.sedeOf(a);
      const sb = ctx.sedeOf(b);
      if (sa !== sb) {
        if (!sa) return 1;
        if (!sb) return -1;
        return sa.localeCompare(sb);
      }
      const byTime = a.start.getTime() - b.start.getTime();
      if (byTime !== 0) return byTime;
      return ctx.calendarOf(a).localeCompare(ctx.calendarOf(b));
    });

    if (settings.split_by_sede) {
      // La sede la dice el nombre de la hoja. Si sólo quedaba esa columna, van las de por defecto.
      const withoutSede = settings.columns.filter((c) => c !== 'sede');
      const columns = withoutSede.length ? withoutSede : DEFAULT_SCHEDULE_EXPORT_COLUMNS.filter((c) => c !== 'sede');
      // Una hoja por sede con citas; `sorted` ya viene agrupado por sede.
      const groups = new Map<string, ScheduleExportRow[]>();
      for (const row of sorted) {
        const sede = ctx.sedeOf(row);
        if (!groups.has(sede)) groups.set(sede, []);
        groups.get(sede)!.push(row);
      }
      groups.forEach((groupRows, sede) => {
        utils.book_append_sheet(
          wb,
          buildExtendedSheet(utils, groupRows, columns, ctx),
          sanitizeSheetName(sede || labels.noSede, usedSheetNames),
        );
      });
    } else {
      utils.book_append_sheet(
        wb,
        buildExtendedSheet(utils, sorted, settings.columns, ctx),
        sanitizeSheetName(baseName, usedSheetNames),
      );
    }
  }

  const sameDay = format(from, 'yyyy-MM-dd') === format(to, 'yyyy-MM-dd');
  const dateTag = sameDay
    ? format(from, 'yyyy-MM-dd')
    : `${format(from, 'yyyy-MM-dd')}_${format(to, 'yyyy-MM-dd')}`;
  writeFile(wb, `${sanitizeFilePart(baseName)}_${dateTag}.xlsx`);

  return { count: rows.length, sheets: usedSheetNames.size };
}
