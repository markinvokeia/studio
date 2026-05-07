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
import { PayrollListToolbar } from '@/components/payroll/PayrollListToolbar';
import { formatCurrency } from '@/components/payroll/payroll-utils';
import type { PayrollEntry } from '@/lib/types';
import { cn } from '@/lib/utils';
import type { ColumnDef } from '@tanstack/react-table';
import { Settings2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

interface Props {
  entries: PayrollEntry[];
  selectedId?: string;
  onSelect?: (entry: PayrollEntry) => void;
}

export function PeriodEntriesList({ entries, selectedId, onSelect }: Props) {
  const t = useTranslations('PayrollPage.periodDetail');
  const { isNarrow } = useNarrowMode();
  const isViewportNarrow = useViewportNarrow();
  const [search, setSearch] = useState('');
  const [isCardMode, setIsCardMode] = useState(false);

  const filtered = useMemo(() => entries.filter((e) =>
    !search || (e.doctor_name ?? '').toLowerCase().includes(search.toLowerCase())
  ), [entries, search]);

  const showCardMode = isCardMode || isNarrow || isViewportNarrow || !!selectedId;

  const columns = useMemo<ColumnDef<PayrollEntry>[]>(() => [
    {
      id: 'doctor',
      header: t('employee'),
      accessorFn: (e) => e.doctor_name ?? '',
      cell: ({ row }) => <span className="font-medium">{row.original.doctor_name}</span>,
    },
    {
      id: 'sessions',
      header: t('sessions'),
      accessorKey: 'sessions_count',
      cell: ({ row }) => <span className="text-right block text-muted-foreground">{row.original.sessions_count}</span>,
    },
    {
      id: 'gross',
      header: t('gross'),
      accessorKey: 'gross_salary',
      cell: ({ row }) => <span className="text-right block font-medium">{formatCurrency(row.original.gross_salary)}</span>,
    },
    {
      id: 'net',
      header: t('net'),
      accessorKey: 'net_salary',
      cell: ({ row }) => (
        <span className="text-right block font-medium text-green-600 dark:text-green-400">
          {formatCurrency(row.original.net_salary)}
        </span>
      ),
    },
  ], [t]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <DataTable
        columns={columns}
        data={filtered}
        isNarrow={showCardMode}
        compact
        enableSingleRowSelection
        onRowSelectionChange={(rows) => { if (rows[0]) onSelect?.(rows[0]); }}
        onRowClick={(e) => onSelect?.(e)}
        getRowClassName={(e) =>
          cn('cursor-pointer transition-colors', e.id === selectedId ? 'bg-primary/5' : '')
        }
        renderCard={(entry, isSelected) => (
          <DataCard
            isSelected={isSelected || entry.id === selectedId}
            title={entry.doctor_name}
            avatar={(entry.doctor_name ?? '?').slice(0, 2)}
            showArrow
            fields={[
              { label: t('sessions'), value: entry.sessions_count },
              { label: t('gross'), value: formatCurrency(entry.gross_salary) },
              { label: t('net'), value: formatCurrency(entry.net_salary), primary: true },
            ]}
          />
        )}
        customToolbar={(table, paginationNode) => (
          <PayrollListToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder={t('searchEmployee')}
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
            paginationNode={paginationNode}
          />
        )}
      />
    </div>
  );
}
