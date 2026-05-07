'use client';

import { PayrollCalculationBreakdown } from '@/components/payroll/PayrollCalculationBreakdown';
import { ManualAdjustmentsPanel } from '@/components/payroll/ManualAdjustmentsPanel';
import { SessionAssignmentsTable } from '@/components/payroll/SessionAssignmentsTable';
import { MOCK_ADJUSTMENTS, MOCK_SESSION_ASSIGNMENTS } from '@/components/payroll/mock-data';
import type { PayrollEntry, PayrollManualAdjustment, PayrollSessionAssignment } from '@/lib/types';
import { formatCurrency } from '@/components/payroll/payroll-utils';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

interface Props {
  entry: PayrollEntry;
  readonly?: boolean;
}

export function PayrollEntryDetail({ entry, readonly }: Props) {
  const t = useTranslations('PayrollPage.periodDetail');

  const [adjustments, setAdjustments] = useState<PayrollManualAdjustment[]>(
    MOCK_ADJUSTMENTS.filter((a) => a.payroll_entry_id === entry.id)
  );
  const [assignments, setAssignments] = useState<PayrollSessionAssignment[]>(
    MOCK_SESSION_ASSIGNMENTS.filter((s) => s.payroll_entry_id === entry.id)
  );

  function handleToggleSession(id: string, included: boolean) {
    setAssignments((prev) => prev.map((s) => (s.id === id ? { ...s, is_included: included } : s)));
  }

  const contractLabel = entry.contract_type
    ? `${t(`..contracts.contractTypes.${entry.contract_type}` as Parameters<typeof t>[0])} · ${entry.calculation_type ? t(`..contracts.calculationTypes.${entry.calculation_type}` as Parameters<typeof t>[0]) : ''}`
    : undefined;

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-5">
      {/* Activity summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border bg-muted/30 px-3 py-2 text-center">
          <p className="text-2xl font-bold">{entry.sessions_count}</p>
          <p className="text-xs text-muted-foreground">{t('sessions')}</p>
        </div>
        <div className="rounded-lg border bg-muted/30 px-3 py-2 text-center">
          <p className="text-2xl font-bold">{entry.hours_worked}h</p>
          <p className="text-xs text-muted-foreground">{t('hours')}</p>
        </div>
        <div className="rounded-lg border bg-muted/30 px-3 py-2 text-center">
          <p className="text-2xl font-bold">{formatCurrency(entry.services_revenue_billed)}</p>
          <p className="text-xs text-muted-foreground">{t('production')}</p>
        </div>
      </div>

      {/* Breakdown */}
      <PayrollCalculationBreakdown
        entry={entry}
        adjustments={adjustments}
        contractLabel={contractLabel}
      />

      {/* Manual adjustments */}
      <ManualAdjustmentsPanel
        adjustments={adjustments}
        entryId={entry.id}
        onChange={setAdjustments}
        readonly={readonly}
      />

      {/* Sessions */}
      <SessionAssignmentsTable
        assignments={assignments}
        onToggle={handleToggleSession}
        readonly={readonly}
      />
    </div>
  );
}
