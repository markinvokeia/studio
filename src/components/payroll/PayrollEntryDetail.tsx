'use client';

import { PayrollCalculationBreakdown } from '@/components/payroll/PayrollCalculationBreakdown';
import { ManualAdjustmentsPanel } from '@/components/payroll/ManualAdjustmentsPanel';
import { EmployeeIrpfDeductionsPanel } from '@/components/payroll/EmployeeIrpfDeductionsPanel';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { PayrollAusencia, PayrollEntry, PayrollManualAdjustment, PayrollPeriod } from '@/lib/types';
import { coerceNumericStrings, formatCurrency, formatDate } from '@/components/payroll/payroll-utils';
import { WorkLogPanel } from '@/components/payroll/WorkLogPanel';
import { cn } from '@/lib/utils';
import api from '@/services/api';
import { API_ROUTES } from '@/constants/routes';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';

// Normalizes { data } / { <key> } / bare-array responses and coerces numeric strings.
function unwrapRows<T>(raw: unknown, key: string): T[] {
  const inner = (raw as Record<string, unknown>)?.data
    ?? (raw as Record<string, unknown>)?.[key]
    ?? raw;
  if (!Array.isArray(inner)) return [];
  return inner.map((r) => coerceNumericStrings(r as Record<string, unknown>) as unknown as T);
}

interface Props {
  entry: PayrollEntry;
  period?: PayrollPeriod;
  readonly?: boolean;
  /** Called after a manual adjustment is persisted, so the parent can refetch entry totals. */
  onEntryChanged?: () => void;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function PayrollEntryDetail({ entry, period, readonly, onEntryChanged }: Props) {
  const t = useTranslations('PayrollPage.periodDetail');
  const tContracts = useTranslations('PayrollPage.contracts');
  const tLic = useTranslations('PayrollPage.legajo.licencias');

  const [adjustments, setAdjustments] = useState<PayrollManualAdjustment[]>([]);
  const [ausencias, setAusencias] = useState<PayrollAusencia[]>([]);
  const [loading, setLoading] = useState(true);

  // Period boundaries (first/last day) for the date-ranged fetches.
  const periodStart = period ? `${period.period_year}-${pad(period.period_month)}-01` : undefined;
  const periodEnd = period
    ? `${period.period_year}-${pad(period.period_month)}-${pad(new Date(period.period_year, period.period_month, 0).getDate())}`
    : undefined;

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const adjData = await api.get(API_ROUTES.PAYROLL.ADJUSTMENTS_BY_ENTRY, { entry_id: entry.id }).catch(() => []);
      setAdjustments(unwrapRows<PayrollManualAdjustment>(adjData, 'adjustments'));
    } catch {
      setAdjustments([]);
    } finally {
      setLoading(false);
    }

    // Leave/absences overlapping the period for this employee (read-only).
    // by-employee accepts the user_id (it matches employee_id OR pe.user_id).
    if (periodStart && periodEnd && entry.user_id) {
      api.get(API_ROUTES.PAYROLL.AUSENCIAS_BY_EMPLOYEE, { employee_id: entry.user_id })
        .then((res) => {
          const all = unwrapRows<PayrollAusencia>(res, 'ausencias');
          setAusencias(all.filter((a) =>
            (a.fecha_desde ?? '') <= periodEnd && (a.fecha_hasta ?? '') >= periodStart));
        })
        .catch(() => setAusencias([]));
    } else {
      setAusencias([]);
    }
  }, [entry.id, entry.user_id, periodStart, periodEnd]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const ctKey = `contractTypes.${entry.contract_type}` as Parameters<typeof tContracts>[0];
  const calcKey = `calculationTypes.${entry.calculation_type}` as Parameters<typeof tContracts>[0];
  const ctLabel = entry.contract_type
    ? (tContracts.has(ctKey) ? tContracts(ctKey) : entry.contract_type)
    : '';
  const calcLabel = entry.calculation_type
    ? (tContracts.has(calcKey) ? tContracts(calcKey) : entry.calculation_type)
    : '';
  const contractLabel = ctLabel
    ? (calcLabel ? `${ctLabel} · ${calcLabel}` : ctLabel)
    : undefined;

  if (loading) {
    return (
      <div className="flex flex-col gap-3 p-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

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
        readonly={readonly}
        onSaved={() => { fetchData(); onEntryChanged?.(); }}
      />

      {/* Manual adjustments */}
      <ManualAdjustmentsPanel
        adjustments={adjustments}
        entryId={entry.id}
        onChanged={() => { fetchData(); onEntryChanged?.(); }}
        readonly={readonly}
      />

      {/* Employee IRPF deductions (configured in the profile) — manage from here too */}
      {entry.user_id && (
        <EmployeeIrpfDeductionsPanel userId={entry.user_id} readonly={readonly} onChanged={onEntryChanged} />
      )}

      {/* Parte de trabajo del período (lectura) */}
      {entry.user_id && periodStart && periodEnd && (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-muted-foreground mb-1">{t('workLog')}</p>
          <div className="h-80 rounded-lg border">
            <WorkLogPanel
              userId={entry.user_id}
              readonly
              initialRange={{ from: new Date(`${periodStart}T00:00:00`), to: new Date(`${periodEnd}T00:00:00`) }}
            />
          </div>
        </div>
      )}

      {/* Leave / absences in the period (read-only) — always shown for reference */}
      <div className="flex flex-col gap-1">
        <p className="text-xs font-medium text-muted-foreground mb-1">{t('absences')}</p>
        {ausencias.length === 0 ? (
          <p className="text-xs text-muted-foreground/70">{t('noAbsences')}</p>
        ) : (
          ausencias.map((a) => (
            <div key={a.id} className="flex items-center justify-between rounded-md border px-3 py-1.5 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <Badge variant="outline" className="text-[10px]">
                  {tLic.has(`tipos.${a.tipo}` as Parameters<typeof tLic>[0]) ? tLic(`tipos.${a.tipo}` as Parameters<typeof tLic>[0]) : a.tipo}
                </Badge>
                <span className="text-muted-foreground">
                  {formatDate(a.fecha_desde)} → {formatDate(a.fecha_hasta)} · {a.dias}d
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {!a.pagada && a.tipo === 'ausencia_injustificada' && (
                  <Badge className="text-[9px] bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                    {tLic('paid')}: —
                  </Badge>
                )}
                <Badge className={cn('text-[9px]',
                  a.estado === 'aprobada' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : a.estado === 'rechazada' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400')}>
                  {tLic.has(`estados.${a.estado}` as Parameters<typeof tLic>[0]) ? tLic(`estados.${a.estado}` as Parameters<typeof tLic>[0]) : a.estado}
                </Badge>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
