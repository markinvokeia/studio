'use client';

import type { PayrollEntry, PayrollManualAdjustment } from '@/lib/types';
import { formatCurrency } from '@/components/payroll/payroll-utils';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

interface Props {
  entry: PayrollEntry;
  adjustments: PayrollManualAdjustment[];
  contractLabel?: string;
}

function Row({ label, amount, negative, highlight, indent }: {
  label: string;
  amount: number;
  negative?: boolean;
  highlight?: boolean;
  indent?: boolean;
}) {
  return (
    <div className={cn('flex items-center justify-between py-1', indent && 'pl-4')}>
      <span className={cn('text-sm text-muted-foreground', highlight && 'text-foreground font-medium')}>{label}</span>
      <span className={cn(
        'text-sm font-mono',
        highlight && 'font-semibold',
        negative ? 'text-red-600 dark:text-red-400' : highlight ? 'text-foreground' : 'text-muted-foreground'
      )}>
        {negative && amount > 0 ? `- ${formatCurrency(amount)}` : formatCurrency(amount)}
      </span>
    </div>
  );
}

function Divider() {
  return <div className="h-px bg-border my-1" />;
}

export function PayrollCalculationBreakdown({ entry, adjustments, contractLabel }: Props) {
  const t = useTranslations('PayrollPage.periodDetail.breakdown');
  const isEmpleado = entry.contract_type === 'empleado';
  const totalAdjAdded = adjustments.filter((a) => a.adjustment_type === 'addition').reduce((s, a) => s + a.amount, 0);
  const totalAdjDeducted = adjustments.filter((a) => a.adjustment_type === 'deduction').reduce((s, a) => s + a.amount, 0);

  const fonasaPct = entry.fonasa_rate
    ? `${(entry.fonasa_rate * 100).toFixed(1)}%`
    : entry.fonasa_employee > 0 ? `${((entry.fonasa_employee / entry.gross_salary) * 100).toFixed(1)}%` : '0%';

  return (
    <div className="flex flex-col gap-3 text-sm">
      {contractLabel && (
        <p className="text-xs text-muted-foreground border rounded-full px-2.5 py-0.5 w-fit">{contractLabel}</p>
      )}

      {/* Gross */}
      <div className="rounded-lg border bg-muted/30 p-3">
        <p className="text-xs font-medium text-muted-foreground mb-2">{t('grossCalc')}</p>
        {entry.base_amount > 0 && <Row label={t('baseAmount')} amount={entry.base_amount} />}
        {entry.variable_amount > 0 && <Row label={t('variableAmount')} amount={entry.variable_amount} />}
        {(entry.extra_hours_amount ?? 0) > 0 && <Row label={t('extraHours')} amount={entry.extra_hours_amount!} />}
        <Divider />
        <Row label={t('grossTotal')} amount={entry.gross_salary} highlight />
      </div>

      {/* Deductions — empleado only */}
      {isEmpleado && (
        <div className="rounded-lg border bg-red-50/50 dark:bg-red-900/5 p-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">{t('deductions')}</p>
          <Row label={t('montepio')} amount={entry.bps_employee} negative />
          <Row label={`${t('fonasaEmployee')} (${fonasaPct})`} amount={entry.fonasa_employee} negative />
          {(entry.frl_employee ?? 0) > 0 && <Row label={t('frlEmployee')} amount={entry.frl_employee!} negative />}
          <Row label={t('irpf')} amount={entry.irpf_withholding} negative />
          {entry.other_deductions > 0 && <Row label={t('otherDeductions')} amount={entry.other_deductions} negative />}
          <Divider />
          <Row label={t('netSalary')} amount={entry.net_salary} highlight />
        </div>
      )}

      {/* Manual adjustments */}
      {adjustments.length > 0 && (
        <div className="rounded-lg border p-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">{t('adjustments')}</p>
          {adjustments.map((adj) => (
            <Row
              key={adj.id}
              label={adj.description}
              amount={adj.amount}
              negative={adj.adjustment_type === 'deduction'}
            />
          ))}
          {totalAdjAdded > 0 && totalAdjDeducted > 0 && (
            <>
              <Divider />
              <Row label={t('netAdjustment')} amount={totalAdjAdded - totalAdjDeducted} highlight />
            </>
          )}
        </div>
      )}

      {/* Employer cost — empleado only */}
      {isEmpleado && (
        <div className="rounded-lg border bg-amber-50/50 dark:bg-amber-900/5 p-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">{t('employerSection')}</p>
          <Row label={t('bpsEmployer')} amount={entry.bps_employer} />
          <Row label={t('fonasaEmployer')} amount={entry.fonasa_employer} />
          {(entry.frl_employer ?? 0) > 0 && <Row label={t('frlEmployer')} amount={entry.frl_employer!} />}
          {(entry.fgcl_employer ?? 0) > 0 && <Row label={t('fgclEmployer')} amount={entry.fgcl_employer!} />}
          {(entry.bse_employer ?? 0) > 0 && <Row label={t('bseEmployer')} amount={entry.bse_employer!} />}
          {(entry.ccm_employer ?? 0) > 0 && <Row label={t('ccmEmployer')} amount={entry.ccm_employer!} />}
          <Divider />
          <Row label={t('aguinaldo')} amount={entry.aguinaldo_provision} />
          <Row label={t('vacation')} amount={entry.vacation_provision} />
          <Divider />
          <Row label={t('totalEmployerCost')} amount={entry.total_employer_cost} highlight />
        </div>
      )}
    </div>
  );
}
