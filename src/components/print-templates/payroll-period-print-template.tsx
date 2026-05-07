'use client';

import { useTranslations } from 'next-intl';
import type { PayrollPeriodPrintData } from '@/stores/print-document-store';
import type { PayrollEntry } from '@/lib/types';
import { formatCurrency, getMonthName } from '@/components/payroll/payroll-utils';
import { PAYROLL_DETAIL_PRINT_COLUMNS, parsePayrollParams } from '@/components/payroll/payroll-detail-columns';

const ratePct = (r: number) => `${(r * 100).toFixed(3).replace(/0+$/, '').replace(/\.$/, '')}%`;

interface Props {
  data: PayrollPeriodPrintData;
}

const num = (v: number | null | undefined) => Number(v ?? 0);

export function PayrollPeriodPrintTemplate({ data }: Props) {
  const t = useTranslations('PrintTemplates.payrollPeriod');
  const tStatus = useTranslations('PayrollPage.periods.statusLabels');
  const { period, entries } = data;

  // Section totals summed across all entries.
  const sum = (f: keyof PayrollEntry) => entries.reduce((s, e) => s + num(e[f] as number), 0);
  const totalGross = sum('gross_salary');
  const dBps = sum('bps_employee');
  const dFonasa = sum('fonasa_employee');
  const dFrl = sum('frl_employee');
  const dIrpf = sum('irpf_withholding');
  const dOther = sum('other_deductions');
  const totalDeductions = sum('total_deductions');
  const totalNet = sum('net_salary');
  const eBps = sum('bps_employer');
  const eFonasa = sum('fonasa_employer');
  const eFrl = sum('frl_employer');
  const eFgcl = sum('fgcl_employer');
  const eBse = sum('bse_employer');
  const aguinaldo = sum('aguinaldo_provision');
  const vacation = sum('vacation_provision');
  const totalEmployerCost = sum('total_employer_cost');

  const statusKey = `${period.status}` as Parameters<typeof tStatus>[0];

  const SummaryRow = ({ label, value, strong }: { label: string; value: number; strong?: boolean }) => (
    <div className={`flex items-center justify-between py-1 ${strong ? 'font-semibold border-t border-gray-300 mt-1 pt-1.5' : ''}`}>
      <span className={strong ? '' : 'text-gray-600'}>{label}</span>
      <span className="font-mono tabular-nums">{formatCurrency(value)}</span>
    </div>
  );

  return (
    <div>
      {/* Title + status */}
      <div className="flex items-baseline justify-between mb-6 pb-3 border-b border-gray-300">
        <h1 className="text-2xl font-bold tracking-tight uppercase">
          {t('title')} — <span className="capitalize">{getMonthName(period.period_month)} {period.period_year}</span>
        </h1>
        <span className="text-sm text-gray-600">
          {t('status')}: <span className="font-semibold uppercase">{tStatus(statusKey)}</span>
        </span>
      </div>

      {/* Summary (section totals, no per-employee detail) */}
      <div className="mb-8 print-template-section">
        <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-2">{t('summary')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-10 text-sm">
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1">{t('incomeNet')}</p>
            <SummaryRow label={t('gross')} value={totalGross} />
            <SummaryRow label={t('net')} value={totalNet} strong />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1">{t('deductions')}</p>
            <SummaryRow label={t('bpsEmployee')} value={dBps} />
            <SummaryRow label={t('fonasaEmployee')} value={dFonasa} />
            <SummaryRow label={t('frlEmployee')} value={dFrl} />
            <SummaryRow label={t('irpf')} value={dIrpf} />
            <SummaryRow label={t('other')} value={dOther} />
            <SummaryRow label={t('totalDeductions')} value={totalDeductions} strong />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1">{t('employer')}</p>
            <SummaryRow label={t('bpsEmployer')} value={eBps} />
            <SummaryRow label={t('fonasaEmployer')} value={eFonasa} />
            <SummaryRow label={t('frlEmployer')} value={eFrl} />
            <SummaryRow label={t('fgcl')} value={eFgcl} />
            <SummaryRow label={t('bse')} value={eBse} />
            <SummaryRow label={t('aguinaldo')} value={aguinaldo} />
            <SummaryRow label={t('vacation')} value={vacation} />
            <SummaryRow label={t('employerCost')} value={totalEmployerCost} strong />
          </div>
        </div>
      </div>

      {/* Annex — per-employee detail table */}
      <div className="print-template-section">
        <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-2">{t('annex')}</h2>
        <table className="w-full text-[11px] border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-400 text-left">
              <th className="py-1 pr-2">{t('employee')}</th>
              <th className="py-1 px-1 text-right">{t('colSessions')}</th>
              <th className="py-1 px-1 text-right">{t('gross')}</th>
              <th className="py-1 px-1 text-right">{t('bpsEmployee')}</th>
              <th className="py-1 px-1 text-right">{t('fonasaEmployee')}</th>
              <th className="py-1 px-1 text-right">{t('frlEmployee')}</th>
              <th className="py-1 px-1 text-right">{t('irpf')}</th>
              <th className="py-1 px-1 text-right">{t('other')}</th>
              <th className="py-1 px-1 text-right">{t('totalDeductions')}</th>
              <th className="py-1 px-1 text-right">{t('net')}</th>
              <th className="py-1 px-1 text-right">{t('employerCost')}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-b border-gray-200">
                <td className="py-1 pr-2">{e.doctor_name}</td>
                <td className="py-1 px-1 text-right">{e.sessions_count}</td>
                <td className="py-1 px-1 text-right font-mono">{formatCurrency(e.gross_salary)}</td>
                <td className="py-1 px-1 text-right font-mono">{formatCurrency(e.bps_employee)}</td>
                <td className="py-1 px-1 text-right font-mono">{formatCurrency(e.fonasa_employee)}</td>
                <td className="py-1 px-1 text-right font-mono">{formatCurrency(num(e.frl_employee))}</td>
                <td className="py-1 px-1 text-right font-mono">{formatCurrency(e.irpf_withholding)}</td>
                <td className="py-1 px-1 text-right font-mono">{formatCurrency(e.other_deductions)}</td>
                <td className="py-1 px-1 text-right font-mono">{formatCurrency(e.total_deductions)}</td>
                <td className="py-1 px-1 text-right font-mono font-semibold">{formatCurrency(e.net_salary)}</td>
                <td className="py-1 px-1 text-right font-mono">{formatCurrency(e.total_employer_cost)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-400 font-semibold">
              <td className="py-1 pr-2">{t('totalRow')}</td>
              <td className="py-1 px-1 text-right">{sum('sessions_count')}</td>
              <td className="py-1 px-1 text-right font-mono">{formatCurrency(totalGross)}</td>
              <td className="py-1 px-1 text-right font-mono">{formatCurrency(dBps)}</td>
              <td className="py-1 px-1 text-right font-mono">{formatCurrency(dFonasa)}</td>
              <td className="py-1 px-1 text-right font-mono">{formatCurrency(dFrl)}</td>
              <td className="py-1 px-1 text-right font-mono">{formatCurrency(dIrpf)}</td>
              <td className="py-1 px-1 text-right font-mono">{formatCurrency(dOther)}</td>
              <td className="py-1 px-1 text-right font-mono">{formatCurrency(totalDeductions)}</td>
              <td className="py-1 px-1 text-right font-mono">{formatCurrency(totalNet)}</td>
              <td className="py-1 px-1 text-right font-mono">{formatCurrency(totalEmployerCost)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Annex 2 — full calculation detail (mirrors the employee entry edit fields) */}
      <div className="print-template-section mt-8" style={{ breakInside: 'avoid' }}>
        <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-2">{t('annex2')}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-[9px] border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-400 text-left">
                {PAYROLL_DETAIL_PRINT_COLUMNS().map((c) => (
                  <th key={c.labelKey} className={`py-1 px-0.5 ${c.labelKey === 'employee' ? '' : 'text-right'}`}>
                    {t(c.labelKey as Parameters<typeof t>[0])}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const cp = parsePayrollParams(e.calculation_params);
                return (
                  <tr key={e.id} className="border-b border-gray-200">
                    {PAYROLL_DETAIL_PRINT_COLUMNS().map((c) => {
                      const v = c.get(e, cp);
                      const display = c.currency ? formatCurrency(Number(v))
                        : c.rate ? ratePct(Number(v))
                        : v;
                      return (
                        <td key={c.labelKey} className={`py-0.5 px-0.5 ${c.labelKey === 'employee' ? '' : 'text-right font-mono'}`}>
                          {display}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
