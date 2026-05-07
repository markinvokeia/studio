'use client';

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
import { DateRangePresets } from '@/components/reports/date-range-presets';
import { PayrollListToolbar } from '@/components/payroll/PayrollListToolbar';
import type { PayrollClinicalSession } from '@/lib/types';
import { cn } from '@/lib/utils';
import { formatDate, formatDuration, formatTime } from '@/components/payroll/payroll-utils';
import type { ColumnDef } from '@tanstack/react-table';
import { Settings2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import type { DateRange } from 'react-day-picker';

interface ClinicalSessionsListProps {
  sessions: PayrollClinicalSession[];
  loading?: boolean;
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
}

export function ClinicalSessionsList({ sessions, loading, dateRange, onDateRangeChange }: ClinicalSessionsListProps) {
  const t = useTranslations('PayrollPage.legajo.jornadas');
  const { isNarrow } = useNarrowMode();
  const isViewportNarrow = useViewportNarrow();
  const [search, setSearch] = useState('');
  const [isCardMode, setIsCardMode] = useState(false);

  const filtered = useMemo(() => sessions.filter((s) => {
    if (!search) return true;
    const haystack = `${s.paciente_name ?? ''} ${s.procedimiento_realizado ?? ''} ${s.diagnostico ?? ''}`.toLowerCase();
    return haystack.includes(search.toLowerCase());
  }), [sessions, search]);

  const showCardMode = isCardMode || isNarrow || isViewportNarrow;

  const columns = useMemo<ColumnDef<PayrollClinicalSession>[]>(() => [
    {
      id: 'fecha',
      header: t('date'),
      accessorKey: 'start_at',
      cell: ({ row }) => <span className="text-xs">{formatDate(row.original.start_at)}</span>,
    },
    {
      id: 'inicio',
      header: t('start'),
      accessorFn: (s) => s.start_at,
      cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">{formatTime(row.original.start_at)}</span>,
    },
    {
      id: 'fin',
      header: t('end'),
      accessorFn: (s) => s.end_at,
      cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">{formatTime(row.original.end_at)}</span>,
    },
    {
      id: 'duracion',
      header: t('duration'),
      accessorKey: 'duration_min',
      cell: ({ row }) => <span className="font-mono text-xs">{formatDuration(row.original.duration_min)}</span>,
    },
    {
      id: 'paciente',
      header: t('patient'),
      accessorKey: 'paciente_name',
      cell: ({ row }) => <span className="text-xs">{row.original.paciente_name || '—'}</span>,
    },
    {
      id: 'procedimiento',
      header: t('procedure'),
      accessorKey: 'procedimiento_realizado',
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground truncate max-w-[220px] block">
          {row.original.procedimiento_realizado || '—'}
        </span>
      ),
    },
  ], [t]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <DataTable
        columns={columns}
        data={filtered}
        isLoading={loading}
        isNarrow={showCardMode}
        compact
        renderCard={(session) => (
          <DataCard
            title={session.paciente_name || '—'}
            subtitle={`${formatDate(session.start_at)} · ${formatTime(session.start_at)}${session.end_at ? `–${formatTime(session.end_at)}` : ''} · ${formatDuration(session.duration_min)}`}
            avatar={(session.paciente_name ?? '?').slice(0, 2).toUpperCase()}
            badge={
              session.procedimiento_realizado ? (
                <span className="text-[10px] text-muted-foreground truncate max-w-[160px]">
                  {session.procedimiento_realizado}
                </span>
              ) : undefined
            }
          />
        )}
        customToolbar={(table, paginationNode) => (
          <PayrollListToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder={t('searchPlaceholder')}
            viewMode={isCardMode ? 'card' : 'table'}
            onViewModeChange={(m) => setIsCardMode(m === 'card')}
            showViewToggle={!isViewportNarrow && !isNarrow}
            filterSlot={<DateRangePresets value={dateRange} onChange={onDateRangeChange} />}
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
            paginationNode={paginationNode}
          />
        )}
      />

      {/* Totals footer — always visible */}
      <div className="flex-none border-t bg-background px-3 py-2 grid grid-cols-2 gap-2 text-center">
        <div>
          <p className="text-[11px] text-muted-foreground">{t('totalSessions')}</p>
          <p className="text-sm font-semibold">{filtered.length}</p>
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground">{t('totalTime')}</p>
          <p className="text-sm font-semibold">
            {formatDuration(filtered.reduce((s, a) => s + (a.duration_min ?? 0), 0))}
          </p>
        </div>
      </div>
    </div>
  );
}
