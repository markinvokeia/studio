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
import { PayrollListToolbar } from '@/components/payroll/PayrollListToolbar';
import type { PayrollEmployee } from '@/lib/types';
import { cn } from '@/lib/utils';
import { formatDate } from '@/components/payroll/payroll-utils';
import type { ColumnDef, VisibilityState } from '@tanstack/react-table';
import { Filter, Settings2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

interface Props {
  employees: PayrollEmployee[];
  loading?: boolean;
  selectedId?: string;
  onSelect?: (id: string) => void;
  onRefresh?: () => void;
}

function getAvatar(emp: PayrollEmployee) {
  const n = (emp.nombres ?? '').charAt(0).toUpperCase();
  const a = (emp.apellidos ?? '').charAt(0).toUpperCase();
  return `${n}${a}` || '?';
}

export function EmployeeList({ employees, loading, selectedId, onSelect, onRefresh }: Props) {
  const t = useTranslations('PayrollPage.employees');
  const { isNarrow } = useNarrowMode();
  const isViewportNarrow = useViewportNarrow();
  const [search, setSearch] = useState('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');
  const [isCardMode, setIsCardMode] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({ cedula: false });

  const filtered = useMemo(() => employees.filter((e) => {
    const matchSearch =
      !search ||
      `${e.nombres} ${e.apellidos}`.toLowerCase().includes(search.toLowerCase()) ||
      e.cedula.includes(search) ||
      (e.email ?? '').toLowerCase().includes(search.toLowerCase());
    const matchActive =
      filterActive === 'all' ||
      (filterActive === 'active' && e.activo) ||
      (filterActive === 'inactive' && !e.activo);
    return matchSearch && matchActive;
  }), [employees, search, filterActive]);

  const showCardMode = isCardMode || isNarrow || isViewportNarrow || !!selectedId;

  const columns = useMemo<ColumnDef<PayrollEmployee>[]>(() => [
    {
      id: 'name',
      header: t('name'),
      accessorFn: (emp) => `${emp.apellidos}, ${emp.nombres}`,
      cell: ({ row }) => (
        <span className="font-medium">{row.original.apellidos}, {row.original.nombres}</span>
      ),
    },
    {
      id: 'cedula',
      header: t('cedula'),
      accessorKey: 'cedula',
      cell: ({ row }) => (
        <span className="font-mono text-muted-foreground">{row.original.cedula}</span>
      ),
    },
    {
      id: 'category',
      header: t('category'),
      accessorKey: 'category_name',
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.category_name ?? '—'}</span>
      ),
    },
    {
      id: 'ingressDate',
      header: t('ingressDate'),
      accessorKey: 'fecha_ingreso',
      cell: ({ row }) => (
        <span className="text-muted-foreground">{formatDate(row.original.fecha_ingreso)}</span>
      ),
    },
    {
      id: 'status',
      header: t('status'),
      accessorKey: 'activo',
      cell: ({ row }) => (
        <Badge className={cn('text-xs', row.original.activo
          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
          : 'bg-muted text-muted-foreground')}>
          {row.original.activo ? t('active') : t('inactive')}
        </Badge>
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
        columnVisibility={columnVisibility}
        onColumnVisibilityChange={setColumnVisibility}
        enableSingleRowSelection
        onRowSelectionChange={(rows) => { if (rows[0]) onSelect?.(rows[0].id); }}
        onRowClick={(emp) => onSelect?.(emp.id)}
        getRowClassName={(emp) =>
          cn('cursor-pointer transition-colors', emp.id === selectedId ? 'bg-primary/5' : '')
        }
        renderCard={(emp, isSelected) => (
          <DataCard
            isSelected={isSelected || emp.id === selectedId}
            title={`${emp.apellidos}, ${emp.nombres}`}
            subtitle={`${emp.cedula}${emp.category_name ? ` · ${emp.category_name}` : ''}`}
            avatar={getAvatar(emp)}
            showArrow
            badge={
              !emp.activo ? (
                <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-medium bg-muted text-muted-foreground">
                  {t('inactive')}
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
            onRefresh={onRefresh}
            viewMode={isCardMode ? 'card' : 'table'}
            onViewModeChange={(m) => setIsCardMode(m === 'card')}
            showViewToggle={!isViewportNarrow && !isNarrow}
            filterSlot={
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant={filterActive !== 'all' ? 'secondary' : 'outline'}
                    size="icon"
                    className="h-8 w-8 shrink-0 relative"
                    title={t('filters')}
                  >
                    <Filter className="h-3.5 w-3.5" />
                    {filterActive !== 'all' && (
                      <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[140px]">
                  {(['active', 'inactive', 'all'] as const).map((f) => (
                    <DropdownMenuCheckboxItem
                      key={f}
                      checked={filterActive === f}
                      onCheckedChange={() => setFilterActive(f)}
                    >
                      {t(`filter.${f}`)}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            }
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
