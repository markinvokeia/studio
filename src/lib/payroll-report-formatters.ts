import { API_ROUTES } from '@/constants/routes';
import type { PayrollDocumentTipo } from '@/lib/types';

// ── Report registry ────────────────────────────────────────────────────────────
// Single source of truth for the payroll reports shown in /payroll/reports.
//   source: where the content comes from
//     'period'   → the period print/export (planilla: PDF print + Excel/CSV)
//     'receipts' → batch pay-slip print (PDF)
//     'data'     → fetch `endpoint` (JSON rows) and format client-side
//     'none'     → not available yet (official spec pending)
//   formats: which download options the row offers (pdf = print dialog).

export type ReportCategory = 'interno' | 'bps' | 'dgi' | 'bank' | 'otros';
export type ReportSource = 'period' | 'receipts' | 'data' | 'none';
export type ReportFormat = 'pdf' | 'excel' | 'csv';

export interface ReportDef {
  tipo: PayrollDocumentTipo;
  category: ReportCategory;
  source: ReportSource;
  endpoint?: string;
  formats: ReportFormat[];
  available: boolean;
  /** dgi is annual (uses year instead of period_id). */
  annual?: boolean;
  /** Temporarily hidden from /payroll/reports (not yet ready to expose to users). */
  hidden?: boolean;
}

const ALL: ReportFormat[] = ['pdf', 'excel', 'csv'];

export const PAYROLL_REPORT_DEFS: ReportDef[] = [
  { tipo: 'planilla_sueldos', category: 'interno', source: 'period',   formats: ALL,      available: true, hidden: true },
  { tipo: 'receipts',         category: 'interno', source: 'receipts', formats: ['pdf'],  available: true },
  { tipo: 'accounting',       category: 'interno', source: 'data', endpoint: API_ROUTES.PAYROLL.REPORTS_ACCOUNTING,  formats: ALL, available: true, hidden: true },
  { tipo: 'cost_center',      category: 'interno', source: 'data', endpoint: API_ROUTES.PAYROLL.REPORTS_COST_CENTER, formats: ALL, available: true, hidden: true },
  { tipo: 'bps_nomina',       category: 'bps',     source: 'data', endpoint: API_ROUTES.PAYROLL.REPORTS_BPS_NOMINA,  formats: ALL, available: true, hidden: true },
  { tipo: 'bps_gafi',         category: 'bps',     source: 'none',  formats: [],          available: false, hidden: true },
  { tipo: 'dgi_irpf',         category: 'dgi',     source: 'data', endpoint: API_ROUTES.PAYROLL.REPORTS_DGI_IRPF,    formats: ALL, available: true, annual: true, hidden: true },
  { tipo: 'bank_file',        category: 'bank',    source: 'data', endpoint: API_ROUTES.PAYROLL.REPORTS_BANK_FILE,   formats: ALL, available: true, hidden: true },
  { tipo: 'mtss',             category: 'otros',   source: 'data', endpoint: API_ROUTES.PAYROLL.REPORTS_MTSS,       formats: ALL, available: true, hidden: true },
];

// ── Data helpers ────────────────────────────────────────────────────────────────
export type Row = Record<string, unknown>;

export function rowsFrom(res: unknown): Row[] {
  const inner = (res as { data?: unknown })?.data ?? res;
  if (Array.isArray(inner)) return inner as Row[];
  if (inner && typeof inner === 'object') return [inner as Row];
  return [];
}

const cell = (v: unknown) => (v === null || v === undefined) ? '' : String(v);

function csvEscape(v: unknown): string {
  const s = cell(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Columns + matrix from arbitrary JSON rows (header = keys of the first row). */
export function rowsToMatrix(rows: Row[]): { columns: string[]; matrix: (string | number)[][] } {
  if (!rows.length) return { columns: [], matrix: [] };
  const columns = Object.keys(rows[0]);
  const matrix = rows.map((r) => columns.map((c) => {
    const v = r[c];
    return typeof v === 'number' ? v : cell(v);
  }));
  return { columns, matrix };
}

export function buildDelimited(rows: Row[], sep: ',' | ';' | '\t'): string {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const head = cols.map(csvEscape).join(sep);
  const body = rows.map((r) => cols.map((c) => csvEscape(r[c])).join(sep)).join('\r\n');
  return `${head}\r\n${body}`;
}

export async function buildXlsxBlob(rows: Row[]): Promise<Blob> {
  const { utils, write } = await import('xlsx');
  const ws = rows.length ? utils.json_to_sheet(rows) : utils.aoa_to_sheet([['sin datos']]);
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, 'Reporte');
  const out = write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function blobFromText(text: string, mime: string, bom = false): Blob {
  return new Blob([(bom ? '﻿' : '') + text], { type: `${mime};charset=utf-8;` });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Build a Blob + filename for a `data` report in the requested non-PDF format. */
export async function buildDataBlob(rows: Row[], format: 'excel' | 'csv', baseName: string): Promise<{ blob: Blob; filename: string }> {
  if (format === 'excel') return { blob: await buildXlsxBlob(rows), filename: `${baseName}.xlsx` };
  return { blob: blobFromText(buildDelimited(rows, ','), 'text/csv', true), filename: `${baseName}.csv` };
}
