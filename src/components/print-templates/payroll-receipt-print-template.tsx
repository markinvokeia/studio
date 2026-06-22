'use client';

import { useTranslations } from 'next-intl';
import type { PayrollReceiptPrintData } from '@/stores/print-document-store';
import { useClinicInfo } from '@/hooks/useClinicInfo';
import { formatCurrency, formatDate, getMonthName } from '@/components/payroll/payroll-utils';

interface Props {
  data: PayrollReceiptPrintData;
}

const num = (v: number | null | undefined) => Number(v ?? 0);

export function PayrollReceiptPrintTemplate({ data }: Props) {
  const t = useTranslations('PrintTemplates.payrollReceipt');
  const clinic = useClinicInfo();
  const { period, rows } = data;
  const periodLabel = `${getMonthName(period.period_month)} ${period.period_year}`;

  const Line = ({ label, value, negative, strong }: { label: string; value: number; negative?: boolean; strong?: boolean }) => (
    <div className={`flex items-center justify-between py-0.5 ${strong ? 'font-semibold border-t border-gray-300 mt-1 pt-1' : ''}`}>
      <span className={strong ? '' : 'text-gray-600'}>{label}</span>
      <span className="font-mono">{negative && value > 0 ? `- ${formatCurrency(value)}` : formatCurrency(value)}</span>
    </div>
  );

  const Field = ({ label, value }: { label: string; value?: string | number | null }) => (
    <div>
      <span className="text-gray-500">{label}: </span>
      <strong>{value === null || value === undefined || value === '' ? '—' : value}</strong>
    </div>
  );

  return (
    <div className="flex flex-col gap-0">
      {rows.map((e, i) => {
        // Employer identity: prefer the values stored on the period row, fall back to clinic config.
        const empresa = e.empresa || clinic?.name || '';
        const empresaRut = e.empresa_rut || '';
        const empresaBps = e.empresa_bps || '';
        const empresaDom = e.empresa_domicilio || clinic?.address || '';
        const extras = num(e.hours_extra_habiles) + num(e.hours_extra_feriados);

        return (
          <div key={`${e.entry_id}-${i}`} className="text-sm" style={{ breakAfter: i < rows.length - 1 ? 'page' : 'auto' }}>
            {/* Header — empresa + recibo */}
            <div className="flex items-start justify-between mb-3 pb-2 border-b border-gray-300">
              <div className="min-w-0">
                <h1 className="text-lg font-bold uppercase leading-tight">{empresa}</h1>
                <p className="text-xs text-gray-600">
                  {empresaRut && <>{t('rut')}: {empresaRut}</>}
                  {empresaBps && <>{empresaRut ? '  ·  ' : ''}{t('bpsNo')}: {empresaBps}</>}
                </p>
                {empresaDom && <p className="text-xs text-gray-500">{empresaDom}</p>}
              </div>
              <div className="text-right shrink-0 pl-4">
                <p className="text-sm font-bold uppercase">{t('title')}</p>
                <p className="text-sm text-gray-600 capitalize">{periodLabel}</p>
              </div>
            </div>

            {/* Datos del empleado */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-1 mb-4 text-sm">
              <Field label={t('employee')} value={e.nombre} />
              <Field label={t('employeeId')} value={e.ci} />
              <Field label={t('bpsNo')} value={e.numero_bps} />
              <Field label={t('hireDate')} value={e.fecha_ingreso ? formatDate(e.fecha_ingreso) : ''} />
              <Field label={t('category')} value={e.categoria} />
              <Field label={t('contract')} value={e.vinculo} />
              <Field label={t('sessions')} value={e.sessions_count} />
              <Field label={t('hours')} value={`${num(e.hours_worked)}h${extras > 0 ? ` (+${extras}h)` : ''}`} />
            </div>

            {/* Haberes / Deducciones */}
            <div className="grid grid-cols-2 gap-x-10">
              <div>
                <p className="text-xs font-semibold uppercase text-gray-500 mb-1">{t('earnings')}</p>
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

            {/* Líquido */}
            <div className="mt-4 pt-2 border-t-2 border-gray-400 flex items-center justify-between">
              <span className="font-bold uppercase">{t('net')}</span>
              <span className="font-mono font-bold text-base">{formatCurrency(num(e.net_salary))}</span>
            </div>

            {/* Aportes patronales (informativo) + cuenta de cobro */}
            <div className="mt-3 grid grid-cols-2 gap-x-10 text-xs">
              <div>
                <p className="font-semibold uppercase text-gray-500 mb-1">{t('employerContributions')}</p>
                <Line label={t('bps')} value={num(e.bps_employer)} />
                <Line label={t('fonasa')} value={num(e.fonasa_employer)} />
                <Line label={t('aguinaldo')} value={num(e.aguinaldo_provision)} />
                <Line label={t('vacation')} value={num(e.vacation_provision)} />
              </div>
              <div>
                <p className="font-semibold uppercase text-gray-500 mb-1">{t('payment')}</p>
                <Field label={t('bank')} value={e.banco} />
                <Field label={t('account')} value={e.cuenta} />
              </div>
            </div>

            {/* Firmas */}
            <div className="mt-12 grid grid-cols-2 gap-12 text-xs text-gray-500">
              <div className="border-t border-gray-400 pt-1 text-center">{t('employerSign')}</div>
              <div className="border-t border-gray-400 pt-1 text-center">{t('employeeSign')}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
