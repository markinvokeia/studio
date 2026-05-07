'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataCard } from '@/components/ui/data-card';
import { useNarrowMode } from '@/components/layout/two-panel-layout';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';
import { MOCK_PERIODS } from '@/components/payroll/mock-data';
import { formatCurrency, getMonthName } from '@/components/payroll/payroll-utils';
import type { PayrollPeriod, PayrollPeriodStatus } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

const PAGE_SIZE = 25;

const STATUS_COLORS: Record<PayrollPeriodStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  calculated: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  approved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  closed: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
};

interface PeriodListProps {
  selectedId?: string;
  onSelect?: (id: string) => void;
}

export function PeriodList({ selectedId, onSelect }: PeriodListProps) {
  const t = useTranslations('PayrollPage.periods');
  const { isNarrow } = useNarrowMode();
  const isViewportNarrow = useViewportNarrow();
  const [periods, setPeriods] = useState<PayrollPeriod[]>(MOCK_PERIODS);
  const [page, setPage] = useState(0);

  const totalPages = Math.max(1, Math.ceil(periods.length / PAGE_SIZE));
  const safeP = Math.min(page, totalPages - 1);
  const paged = periods.slice(safeP * PAGE_SIZE, (safeP + 1) * PAGE_SIZE);

  const useCardMode = isNarrow || isViewportNarrow || !!selectedId;

  function handleCreatePeriod() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const exists = periods.find((p) => p.period_year === year && p.period_month === month);
    if (exists) {
      onSelect?.(exists.id);
      return;
    }
    const newPeriod: PayrollPeriod = {
      id: `p${Date.now()}`,
      period_year: year,
      period_month: month,
      status: 'draft',
      entries_count: 0,
      created_at: new Date().toISOString(),
    };
    setPeriods((prev) => [newPeriod, ...prev]);
    onSelect?.(newPeriod.id);
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 p-3 border-b shrink-0">
        <span className="text-xs text-muted-foreground">{periods.length} períodos</span>
        <Button size="sm" className="h-7 text-xs" onClick={handleCreatePeriod}>
          <Plus className="h-3 w-3 mr-1" />
          {t('createPeriod')}
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {useCardMode ? (
          <div className="flex flex-col gap-1.5 p-2">
            {paged.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-8">{t('noPeriods')}</p>
            ) : (
              paged.map((period) => (
                <DataCard
                  key={period.id}
                  isSelected={period.id === selectedId}
                  title={`${getMonthName(period.period_month)} ${period.period_year}`}
                  subtitle={period.total_gross
                    ? `${formatCurrency(period.total_gross)} bruto · ${period.entries_count ?? 0} doctores`
                    : `${period.entries_count ?? 0} doctores`
                  }
                  avatar={String(period.period_month).padStart(2, '0')}
                  showArrow
                  onClick={() => onSelect?.(period.id)}
                  badge={
                    <Badge className={cn('text-[9px]', STATUS_COLORS[period.status])}>
                      {t(`statusLabels.${period.status}`)}
                    </Badge>
                  }
                />
              ))
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b sticky top-0">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs">{t('month')}</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs">{t('status')}</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground text-xs">{t('totalGross')}</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground text-xs">{t('totalNet')}</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground text-xs">{t('doctors')}</th>
                </tr>
              </thead>
              <tbody>
                {paged.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">{t('noPeriods')}</td>
                  </tr>
                ) : (
                  paged.map((period) => (
                    <tr
                      key={period.id}
                      onClick={() => onSelect?.(period.id)}
                      className={cn(
                        'border-b last:border-0 cursor-pointer transition-colors',
                        period.id === selectedId
                          ? 'bg-primary/5 ring-1 ring-inset ring-primary/30'
                          : 'hover:bg-muted/20'
                      )}
                    >
                      <td className="px-4 py-2.5 font-medium capitalize">
                        {getMonthName(period.period_month)} {period.period_year}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge className={cn('text-xs', STATUS_COLORS[period.status])}>
                          {t(`statusLabels.${period.status}`)}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium">
                        {period.total_gross ? formatCurrency(period.total_gross) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right text-green-600 dark:text-green-400 font-medium">
                        {period.total_net ? formatCurrency(period.total_net) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">
                        {period.entries_count ?? 0}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-t shrink-0">
          <Button variant="outline" size="sm" className="h-7"
            onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={safeP === 0}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="text-xs text-muted-foreground">{safeP + 1} / {totalPages}</span>
          <Button variant="outline" size="sm" className="h-7"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={safeP >= totalPages - 1}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
