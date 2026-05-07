'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataCard } from '@/components/ui/data-card';
import { DataTable } from '@/components/ui/data-table';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNarrowMode } from '@/components/layout/two-panel-layout';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';
import { PeriodCreateDialog } from '@/components/payroll/PeriodCreateDialog';
import { PayrollListToolbar } from '@/components/payroll/PayrollListToolbar';
import { formatCurrency, getMonthName } from '@/components/payroll/payroll-utils';
import type { PayrollPeriod, PayrollPeriodStatus } from '@/lib/types';
import { cn } from '@/lib/utils';
import api from '@/services/api';
import { API_ROUTES } from '@/constants/routes';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus, Settings2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';

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
  /** Bump to force the list to refetch (e.g. after a recalc in the detail panel) */
  refreshSignal?: number;
}

export function PeriodList({ selectedId, onSelect, refreshSignal }: PeriodListProps) {
  const t = useTranslations('PayrollPage.periods');
  const { isNarrow } = useNarrowMode();
  const isViewportNarrow = useViewportNarrow();
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCardMode, setIsCardMode] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [search, setSearch] = useState('');

  const fetchPeriods = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get(API_ROUTES.PAYROLL.PERIODS, undefined);
      const inner = (data as { data?: unknown; periods?: unknown })?.data
        ?? (data as { periods?: unknown })?.periods
        ?? data;
      // Filter out null/invalid rows so the list never crashes on p.id
      setPeriods(Array.isArray(inner) ? (inner as PayrollPeriod[]).filter((p) => p && p.id) : []);
    } catch {
      setPeriods([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPeriods(); }, [fetchPeriods, refreshSignal]);

  const filteredPeriods = useMemo(() => periods.filter((p) => {
    if (!p) return false;
    if (!search) return true;
    const hay = `${getMonthName(p.period_month)} ${p.period_year} ${t(`statusLabels.${p.status}`)}`.toLowerCase();
    return hay.includes(search.toLowerCase());
  }), [periods, search, t]);

  const showCardMode = isCardMode || isNarrow || isViewportNarrow || !!selectedId;

  const columns = useMemo<ColumnDef<PayrollPeriod>[]>(() => [
    {
      id: 'month',
      header: t('month'),
      accessorFn: (p) => p.period_year * 100 + p.period_month,
      sortingFn: 'basic',
      cell: ({ row }) => (
        <span className="font-medium capitalize">
          {getMonthName(row.original.period_month)} {row.original.period_year}
        </span>
      ),
    },
    {
      id: 'status',
      header: t('status'),
      accessorKey: 'status',
      cell: ({ row }) => (
        <Badge className={cn('text-xs', STATUS_COLORS[row.original.status])}>
          {t(`statusLabels.${row.original.status}`)}
        </Badge>
      ),
    },
    {
      id: 'totalGross',
      header: t('totalGross'),
      accessorKey: 'total_gross',
      cell: ({ row }) => (
        <span className="text-right block font-medium">
          {row.original.total_gross ? formatCurrency(row.original.total_gross) : '—'}
        </span>
      ),
    },
    {
      id: 'totalNet',
      header: t('totalNet'),
      accessorKey: 'total_net',
      cell: ({ row }) => (
        <span className="text-right block font-medium text-green-600 dark:text-green-400">
          {row.original.total_net ? formatCurrency(row.original.total_net) : '—'}
        </span>
      ),
    },
    {
      id: 'doctors',
      header: t('doctors'),
      accessorKey: 'entries_count',
      cell: ({ row }) => (
        <span className="text-right block text-muted-foreground">
          {row.original.entries_count ?? 0}
        </span>
      ),
    },
  ], [t]);

  return (
    <>
      <div className="flex flex-col h-full min-h-0">
      <DataTable
        columns={columns}
        data={filteredPeriods}
        isLoading={loading}
        isNarrow={showCardMode}
        compact
        enableSingleRowSelection
        onRowSelectionChange={(rows) => { if (rows[0]) onSelect?.(rows[0].id); }}
        onRowClick={(p) => onSelect?.(p.id)}
        getRowClassName={(p) =>
          cn('cursor-pointer transition-colors', p.id === selectedId ? 'bg-primary/5' : '')
        }
        renderCard={(period, isSelected) => (
          <DataCard
            isSelected={isSelected || period.id === selectedId}
            title={`${getMonthName(period.period_month)} ${period.period_year}`}
            subtitle={period.total_gross
              ? `${formatCurrency(period.total_gross)} ${t('gross').toLowerCase()} · ${period.entries_count ?? 0} ${t('doctors').toLowerCase()}`
              : `${period.entries_count ?? 0} ${t('doctors').toLowerCase()}`}
            avatar={String(period.period_month).padStart(2, '0')}
            showArrow
            onClick={() => onSelect?.(period.id)}
            badge={
              <Badge className={cn('text-[9px]', STATUS_COLORS[period.status])}>
                {t(`statusLabels.${period.status}`)}
              </Badge>
            }
          />
        )}
        customToolbar={(table, paginationNode) => (
          <PayrollListToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder={t('searchPlaceholder')}
            onRefresh={() => fetchPeriods()}
            refreshing={loading}
            viewMode={isCardMode ? 'card' : 'table'}
            onViewModeChange={(m) => setIsCardMode(m === 'card')}
            showViewToggle={!isViewportNarrow && !isNarrow}
            columnsSlot={!showCardMode && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-8 w-8 shrink-0">
                    <Settings2 className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {(table as any).getAllColumns()
                    .filter((col: any) => col.getCanHide())
                    .map((col: any) => (
                      <DropdownMenuCheckboxItem
                        key={col.id}
                        checked={col.getIsVisible()}
                        onCheckedChange={(val) => col.toggleVisibility(!!val)}
                      >
                        {typeof col.columnDef.header === 'string' ? col.columnDef.header : col.id}
                      </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            actions={
              <Button size="sm" className="h-8 text-xs" onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-3 w-3 mr-1" />
                {t('createPeriod')}
              </Button>
            }
            paginationNode={paginationNode}
          />
        )}
      />
    </div>

      <PeriodCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        existingPeriods={periods}
        onCreated={(created) => {
          setPeriods((prev) => [created, ...prev]);
          onSelect?.(created.id);
        }}
      />
    </>
  );
}
