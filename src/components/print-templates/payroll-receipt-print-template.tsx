'use client';

import { useTranslations } from 'next-intl';
import type { PayrollReceiptPrintData } from '@/stores/print-document-store';
import { formatCurrency, getMonthName } from '@/components/payroll/payroll-utils';

interface Props {
  data: PayrollReceiptPrintData;
}

const num = (v: number | null | undefined) => Number(v ?? 0);

export function PayrollReceiptPrintTemplate({ data }: Props) {
  const t = useTranslations('PrintTemplates.payrollReceipt');
  const { period, entries } = data;
  const periodLabel = `${getMonthName(period.period_month)} ${period.period_year}`;

  const Line = ({ label, value, negative, strong }: { label: string; value: number; negative?: boolean; strong?: boolean }) => (
    <div className={`flex items-center justify-between py-0.5 ${strong ? 'font-semibold border-t border-gray-300 mt-1 pt-1' : ''}`}>
      <span className={strong ? '' : 'text-gray-600'}>{label}</span>
      <span className="font-mono">{negative && value > 0 ? `- ${formatCurrency(value)}` : formatCurrency(value)}</span>
    </div>
  );

  return (
    <div className="flex flex-col gap-0">
      {entries.map((e, i) => (
        <div key={e.id} className="text-sm" style={{ breakAfter: i < entries.length - 1 ? 'page' : 'auto' }}>
          <div className="flex items-baseline justify-between mb-3 pb-2 border-b border-gray-300">
            <h1 className="text-lg font-bold uppercase">{t('title')}</h1>
            <span className="text-sm text-gray-600 capitalize">{periodLabel}</span>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-1 mb-4 text-sm">
            <div><span className="text-gray-500">{t('employee')}: </span><strong>{e.doctor_name}</strong></div>
            <div><span className="text-gray-500">{t('sessions')}: </span><strong>{e.sessions_count}</strong></div>
          </div>

          <div className="grid grid-cols-2 gap-x-10">
            <div>
              <p className="text-xs font-semibold uppercase text-gray-500 mb-1">{t('earnings')}</p>
              <Line label={t('base')} value={num(e.base_amount)} />
              <Line label={t('variable')} value={num(e.variable_amount)} />
              <Line label={t('gross')} value={num(e.gross_salary)} strong />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-gray-500 mb-1">{t('deductions')}</p>
              <Line label={t('bps')} value={num(e.bps_employee)} negative />
              <Line label={t('fonasa')} value={num(e.fonasa_employee)} negative />
              <Line label={t('frl')} value={num(e.frl_employee)} negative />
              <Line label={t('irpf')} value={num(e.irpf_withholding)} negative />
              <Line label={t('other')} value={num(e.other_deductions)} negative />
              <Line label={t('totalDeductions')} value={num(e.total_deductions)} negative strong />
            </div>
          </div>

          <div className="mt-4 pt-2 border-t-2 border-gray-400 flex items-center justify-between">
            <span className="font-bold uppercase">{t('net')}</span>
            <span className="font-mono font-bold text-base">{formatCurrency(e.net_salary)}</span>
          </div>

          <div className="mt-12 grid grid-cols-2 gap-12 text-xs text-gray-500">
            <div className="border-t border-gray-400 pt-1 text-center">{t('employerSign')}</div>
            <div className="border-t border-gray-400 pt-1 text-center">{t('employeeSign')}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
