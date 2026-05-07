import type { PayrollCalculationParams, PayrollEntry } from '@/lib/types';

// Shared "Anexo 2 — Detalle de cálculos" column set. Mirrors the fields shown when
// editing an employee entry (PayrollCalculationBreakdown EDITABLE_FIELDS + bases),
// so the print template and the Excel/CSV export stay in sync.

export interface DetailColumn {
  /** i18n key under PrintTemplates.payrollPeriod */
  labelKey: string;
  /** Raw value (number for amounts, string for text). Consumers format as needed. */
  get: (e: PayrollEntry, cp: PayrollCalculationParams | null) => string | number;
  /** Render as currency in the print table (export keeps raw numbers). */
  currency?: boolean;
  /** Render as a percentage (rate stored as fraction). */
  rate?: boolean;
  /** Hidden in the printed PDF (too wide); still included in the Excel/CSV export. */
  printHide?: boolean;
}

/** Columns shown in the printed Anexo 2 (subset that fits an A4 landscape page). */
export const PAYROLL_DETAIL_PRINT_COLUMNS = (): DetailColumn[] =>
  PAYROLL_DETAIL_COLUMNS.filter((c) => !c.printHide);

export function parsePayrollParams(raw: unknown): PayrollCalculationParams | null {
  if (!raw) return null;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) as PayrollCalculationParams; } catch { return null; }
  }
  return raw as PayrollCalculationParams;
}

const n = (v: number | null | undefined) => Number(v ?? 0);
const amount = (field: keyof PayrollEntry): DetailColumn['get'] => (e) => n(e[field] as number);

export const PAYROLL_DETAIL_COLUMNS: DetailColumn[] = [
  { labelKey: 'employee',        get: (e) => e.doctor_name ?? '' },
  { labelKey: 'colSessions',     get: (e) => Number(e.sessions_count ?? 0) },
  { labelKey: 'colHours',        get: (e) => Number(e.hours_worked ?? 0), printHide: true },
  { labelKey: 'colRevBilled',    get: amount('services_revenue_billed'), currency: true, printHide: true },
  { labelKey: 'colRevListed',    get: amount('services_revenue_listed'), currency: true, printHide: true },
  { labelKey: 'colBase',         get: amount('base_amount'), currency: true, printHide: true },
  { labelKey: 'colVariable',     get: amount('variable_amount'), currency: true, printHide: true },
  { labelKey: 'colExtra',        get: amount('extra_hours_amount'), currency: true, printHide: true },
  { labelKey: 'gross',           get: amount('gross_salary'), currency: true },
  { labelKey: 'bpsEmployee',     get: amount('bps_employee'), currency: true },
  { labelKey: 'fonasaEmployee',  get: amount('fonasa_employee'), currency: true },
  { labelKey: 'frlEmployee',     get: amount('frl_employee'), currency: true },
  { labelKey: 'irpf',            get: amount('irpf_withholding'), currency: true },
  { labelKey: 'other',           get: amount('other_deductions'), currency: true },
  { labelKey: 'totalDeductions', get: amount('total_deductions'), currency: true },
  { labelKey: 'net',             get: amount('net_salary'), currency: true },
  { labelKey: 'bpsEmployer',     get: amount('bps_employer'), currency: true },
  { labelKey: 'fonasaEmployer',  get: amount('fonasa_employer'), currency: true },
  { labelKey: 'frlEmployer',     get: amount('frl_employer'), currency: true, printHide: true },
  { labelKey: 'fgcl',            get: amount('fgcl_employer'), currency: true, printHide: true },
  { labelKey: 'bse',             get: amount('bse_employer'), currency: true, printHide: true },
  { labelKey: 'ccm',             get: amount('ccm_employer'), currency: true, printHide: true },
  { labelKey: 'aguinaldo',       get: amount('aguinaldo_provision'), currency: true },
  { labelKey: 'vacation',        get: amount('vacation_provision'), currency: true },
  { labelKey: 'employerCost',    get: amount('total_employer_cost'), currency: true },
  // Bases de cálculo (read-only) — solo en Excel/CSV, ocultas en el PDF
  { labelKey: 'capBase',         get: (_e, cp) => cp?.cap_base ?? 0, currency: true, printHide: true },
  { labelKey: 'fonasaRate',      get: (_e, cp) => cp?.fonasa_rate_applied ?? 0, rate: true, printHide: true },
  { labelKey: 'irpfDeductions',  get: (_e, cp) => cp?.irpf_deductions_monthly ?? 0, currency: true, printHide: true },
  { labelKey: 'fonasaSituation', get: (_e, cp) => cp?.fonasa_family_situation ?? '', printHide: true },
];
