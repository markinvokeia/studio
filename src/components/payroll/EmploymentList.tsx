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
import type { PayrollEmployment } from '@/lib/types';
import { cn } from '@/lib/utils';
import { formatCurrency, formatDate } from '@/components/payroll/payroll-utils';
import type { ColumnDef } from '@tanstack/react-table';
import { Filter, Plus, Settings2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

const TIPO_COLORS: Record<string, string> = {
  dependencia: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  arrendamiento: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  honorarios: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  empresa_unipersonal: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  pasante: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  termino: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  suplencia: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400',
};

interface EmploymentListProps {
  employments: PayrollEmployment[];
  loading?: boolean;
  selectedId?: string;
  onSelect?: (id: string) => void;
  onNew?: () => void;
}

export function EmploymentList({ employments, loading, selectedId, onSelect, onNew }: EmploymentListProps) {
  const t = useTranslations('PayrollPage.legajo.vinculaciones');
  const { isNarrow } = useNarrowMode();
  const isViewportNarrow = useViewportNarrow();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'active' | 'inactive' | 'all'>('all');
  const [isCardMode, setIsCardMode] = useState(false);

  const tipoLabel = (e: PayrollEmployment) =>
    t(`form.tipoContratoOpciones.${e.tipo_contrato}` as Parameters<typeof t>[0]);

  const filtered = useMemo(() => employments.filter((e) => {
    const haystack = `${tipoLabel(e)} ${e.category_name ?? ''}`.toLowerCase();
    const matchSearch = !search || haystack.includes(search.toLowerCase());
    const matchStatus =
      filterStatus === 'all' ||
      (filterStatus === 'active' && e.is_active) ||
      (filterStatus === 'inactive' && !e.is_active);
    return matchSearch && matchStatus;
  }), [employments, search, filterStatus, t]); // eslint-disable-line react-hooks/exhaustive-deps

  const showCardMode = isCardMode || isNarrow || isViewportNarrow || !!selectedId;

  const columns = useMemo<ColumnDef<PayrollEmployment>[]>(() => [
    {
      id: 'tipo',
      header: t('tipo'),
      accessorKey: 'tipo_contrato',
      cell: ({ row }) => (
        <Badge className={cn('text-xs', TIPO_COLORS[row.original.tipo_contrato] ?? '')}>
          {tipoLabel(row.original)}
        </Badge>
      ),
    },
    {
      id: 'categoria',
      header: t('categoria'),
      accessorKey: 'category_name',
      cell: ({ row }) => (
        <span className="text-muted-foreground text-xs">{row.original.category_name || '—'}</span>
      ),
    },
    {
      id: 'sueldoBase',
      header: t('sueldoBase'),
      accessorKey: 'sueldo_base',
      cell: ({ row }) => <span className="font-mono text-xs">{formatCurrency(row.original.sueldo_base)}</span>,
    },
    {
      id: 'inicio',
      header: t('inicio'),
      accessorKey: 'fecha_inicio',
      cell: ({ row }) => <span className="text-muted-foreground text-xs">{formatDate(row.original.fecha_inicio)}</span>,
    },
    {
      id: 'status',
      header: t('estado'),
      accessorKey: 'is_active',
      cell: ({ row }) => (
        <Badge className={cn('text-xs', row.original.is_active
          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
          : 'bg-muted text-muted-foreground')}>
          {row.original.is_active ? t('active') : t('inactive')}
        </Badge>
      ),
    },
  ], [t]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col h-full min-h-0">
      <DataTable
        columns={columns}
        data={filtered}
        isLoading={loading}
        isNarrow={showCardMode}
        compact
        enableSingleRowSelection
        onRowSelectionChange={(rows) => { if (rows[0]) onSelect?.(rows[0].id); }}
        onRowClick={(e) => onSelect?.(e.id)}
        getRowClassName={(e) =>
          cn('cursor-pointer transition-colors', e.id === selectedId ? 'bg-primary/5' : '')
        }
        renderCard={(empl, isSelected) => (
          <DataCard
            isSelected={isSelected || empl.id === selectedId}
            title={`${tipoLabel(empl)}${empl.category_name ? ` · ${empl.category_name}` : ''}`}
            subtitle={`${formatCurrency(empl.sueldo_base)} · ${formatDate(empl.fecha_inicio)}`}
            avatar={tipoLabel(empl).slice(0, 2).toUpperCase()}
            showArrow
            onClick={() => onSelect?.(empl.id)}
            badge={
              <Badge className={cn('text-[9px]', empl.is_active
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-muted text-muted-foreground')}>
                {empl.is_active ? t('active') : t('inactive')}
              </Badge>
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
            filterSlot={
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant={filterStatus !== 'all' ? 'secondary' : 'outline'}
                    size="icon"
                    className="h-8 w-8 shrink-0 relative"
                    title={t('filters')}
                  >
                    <Filter className="h-3.5 w-3.5" />
                    {filterStatus !== 'all' && (
                      <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[140px]">
                  {(['active', 'inactive', 'all'] as const).map((f) => (
                    <DropdownMenuCheckboxItem
                      key={f}
                      checked={filterStatus === f}
                      onCheckedChange={() => setFilterStatus(f)}
                    >
                      {f === 'active' ? t('active') : f === 'inactive' ? t('inactive') : t('filterAll')}
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
            actions={onNew && (
              <Button size="sm" className="h-8 text-xs" onClick={onNew} title={t('addNew')}>
                <Plus className="h-3 w-3 sm:mr-1" />
                <span className="hidden sm:inline">{t('addNew')}</span>
              </Button>
            )}
            paginationNode={paginationNode}
          />
        )}
      />
    </div>
  );
}
