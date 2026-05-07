import type { PayrollEntry, PayrollPeriod } from '@/lib/types';
import { getMonthName } from '@/components/payroll/payroll-utils';
import { PAYROLL_DETAIL_COLUMNS, parsePayrollParams } from '@/components/payroll/payroll-detail-columns';

type Tx = (key: string) => string;
const num = (v: number | null | undefined) => Math.round((Number(v ?? 0)) * 100) / 100;

function buildSheets(period: PayrollPeriod, entries: PayrollEntry[], t: Tx, statusText: string) {
  const sum = (f: keyof PayrollEntry) => num(entries.reduce((s, e) => s + Number((e[f] as number) ?? 0), 0));

  const title = `${t('title')} — ${getMonthName(period.period_month)} ${period.period_year}`;

  // ── Resumen (concepto / monto) ──
  const resumen: (string | number)[][] = [
    [title],
    [`${t('status')}:`, statusText],
    [],
    [t('summary'), t('amount')],
    [t('gross'), sum('gross_salary')],
    [t('bpsEmployee'), sum('bps_employee')],
    [t('fonasaEmployee'), sum('fonasa_employee')],
    [t('frlEmployee'), sum('frl_employee')],
    [t('irpf'), sum('irpf_withholding')],
    [t('other'), sum('other_deductions')],
    [t('totalDeductions'), sum('total_deductions')],
    [t('net'), sum('net_salary')],
    [],
    [t('employer'), ''],
    [t('bpsEmployer'), sum('bps_employer')],
    [t('fonasaEmployer'), sum('fonasa_employer')],
    [t('frlEmployer'), sum('frl_employer')],
    [t('fgcl'), sum('fgcl_employer')],
    [t('bse'), sum('bse_employer')],
    [t('aguinaldo'), sum('aguinaldo_provision')],
    [t('vacation'), sum('vacation_provision')],
    [t('employerCost'), sum('total_employer_cost')],
  ];

  // ── Anexo (detalle por empleado en columnas) ──
  const header = [
    t('employee'), t('colSessions'), t('gross'), t('bpsEmployee'), t('fonasaEmployee'),
    t('frlEmployee'), t('irpf'), t('other'), t('totalDeductions'), t('net'), t('employerCost'),
  ];
  const rows: (string | number)[][] = entries.map((e) => [
    e.doctor_name ?? '', Number(e.sessions_count ?? 0), num(e.gross_salary), num(e.bps_employee),
    num(e.fonasa_employee), num(e.frl_employee), num(e.irpf_withholding), num(e.other_deductions),
    num(e.total_deductions), num(e.net_salary), num(e.total_employer_cost),
  ]);
  const totalRow = [
    t('totalRow'), sum('sessions_count'), sum('gross_salary'), sum('bps_employee'), sum('fonasa_employee'),
    sum('frl_employee'), sum('irpf_withholding'), sum('other_deductions'), sum('total_deductions'),
    sum('net_salary'), sum('total_employer_cost'),
  ];
  const anexo = [header, ...rows, totalRow];

  // ── Anexo 2: Detalle de cálculos (todas las columnas del detalle del empleado) ──
  const detalleHeader = PAYROLL_DETAIL_COLUMNS.map((c) => t(c.labelKey));
  const detalleRows: (string | number)[][] = entries.map((e) => {
    const cp = parsePayrollParams(e.calculation_params);
    return PAYROLL_DETAIL_COLUMNS.map((c) => {
      const v = c.get(e, cp);
      return typeof v === 'number' ? num(v) : v;
    });
  });
  const detalle = [detalleHeader, ...detalleRows];

  return { resumen, anexo, detalle };
}

function fileBase(period: PayrollPeriod) {
  return `nomina_${period.period_year}_${String(period.period_month).padStart(2, '0')}`;
}

export async function exportPayrollPeriodExcel(
  period: PayrollPeriod, entries: PayrollEntry[], t: Tx, statusText: string,
) {
  const { resumen, anexo, detalle } = buildSheets(period, entries, t, statusText);
  const { utils, writeFile } = await import('xlsx');
  const wb = utils.book_new();
  utils.book_append_sheet(wb, utils.aoa_to_sheet(resumen), t('summary').slice(0, 31));
  utils.book_append_sheet(wb, utils.aoa_to_sheet(anexo), t('annex').slice(0, 31));
  utils.book_append_sheet(wb, utils.aoa_to_sheet(detalle), t('annex2').slice(0, 31));
  writeFile(wb, `${fileBase(period)}.xlsx`);
}

export function exportPayrollPeriodCSV(
  period: PayrollPeriod, entries: PayrollEntry[], t: Tx, statusText: string,
) {
  const { detalle } = buildSheets(period, entries, t, statusText);
  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = detalle.map((row) => row.map(escape).join(',')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileBase(period)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
