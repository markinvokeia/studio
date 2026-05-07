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
import type { PayrollIrpfDeduction } from '@/lib/types';
import { cn } from '@/lib/utils';
import { formatCurrency, formatDate } from '@/components/payroll/payroll-utils';
import type { ColumnDef } from '@tanstack/react-table';
import { Filter, Plus, Settings2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

type IrpfType = PayrollIrpfDeduction['tipo'];

const TIPO_COLORS: Record<IrpfType, string> = {
  bhu_anv: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  caja_profesional: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  alimentos: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  alquiler: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  otro: 'bg-muted text-muted-foreground',
};

const IRPF_TYPES: IrpfType[] = ['bhu_anv', 'caja_profesional', 'alimentos', 'alquiler', 'otro'];

interface IrpfDeductionListProps {
  deductions: PayrollIrpfDeduction[];
  loading?: boolean;
  selectedId?: string;
  onSelect?: (id: string) => void;
  onNew?: () => void;
}

export function IrpfDeductionList({ deductions, loading, selectedId, onSelect, onNew }: IrpfDeductionListProps) {
  const t = useTranslations('PayrollPage.legajo.deducciones');
  const { isNarrow } = useNarrowMode();
  const isViewportNarrow = useViewportNarrow();
  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState<IrpfType | 'all'>('all');
  const [isCardMode, setIsCardMode] = useState(false);

  const filtered = useMemo(() => deductions.filter((d) => {
    const matchSearch = !search || (d.descripcion ?? '').toLowerCase().includes(search.toLowerCase());
    const matchTipo = filterTipo === 'all' || d.tipo === filterTipo;
    return matchSearch && matchTipo;
  }), [deductions, search, filterTipo]);

  const showCardMode = isCardMode || isNarrow || isViewportNarrow || !!selectedId;

  const columns = useMemo<ColumnDef<PayrollIrpfDeduction>[]>(() => [
    {
      id: 'descripcion',
      header: t('descripcion'),
      accessorKey: 'descripcion',
      cell: ({ row }) => <span className="font-medium">{row.original.descripcion}</span>,
    },
    {
      id: 'tipo',
      header: t('tipo'),
      accessorKey: 'tipo',
      cell: ({ row }) => (
        <Badge className={cn('text-xs', TIPO_COLORS[row.original.tipo] ?? '')}>
          {t(`tipos.${row.original.tipo}`)}
        </Badge>
      ),
    },
    {
      id: 'monto',
      header: t('monto'),
      accessorKey: 'monto_mensual',
      cell: ({ row }) => <span className="font-mono text-xs">{formatCurrency(row.original.monto_mensual)}/mes</span>,
    },
    {
      id: 'desde',
      header: t('desde'),
      accessorKey: 'vigente_desde',
      cell: ({ row }) => <span className="text-muted-foreground text-xs">{formatDate(row.original.vigente_desde)}</span>,
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
        enableSingleRowSelection
        onRowSelectionChange={(rows) => { if (rows[0]) onSelect?.(rows[0].id); }}
        onRowClick={(d) => onSelect?.(d.id)}
        getRowClassName={(d) =>
          cn('cursor-pointer transition-colors', d.id === selectedId ? 'bg-primary/5' : '')
        }
        renderCard={(ded, isSelected) => (
          <DataCard
            isSelected={isSelected || ded.id === selectedId}
            title={ded.descripcion}
            subtitle={`${formatCurrency(ded.monto_mensual)}/mes · ${formatDate(ded.vigente_desde)}`}
            avatar={(ded.descripcion ?? '?').slice(0, 2).toUpperCase()}
            showArrow
            onClick={() => onSelect?.(ded.id)}
            badge={
              <Badge className={cn('text-[9px]', TIPO_COLORS[ded.tipo] ?? '')}>
                {t(`tipos.${ded.tipo}`)}
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
                    variant={filterTipo !== 'all' ? 'secondary' : 'outline'}
                    size="icon"
                    className="h-8 w-8 shrink-0 relative"
                    title={t('filters')}
                  >
                    <Filter className="h-3.5 w-3.5" />
                    {filterTipo !== 'all' && (
                      <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[180px]">
                  <DropdownMenuCheckboxItem
                    checked={filterTipo === 'all'}
                    onCheckedChange={() => setFilterTipo('all')}
                  >
                    {t('filterAll')}
                  </DropdownMenuCheckboxItem>
                  {IRPF_TYPES.map((it) => (
                    <DropdownMenuCheckboxItem
                      key={it}
                      checked={filterTipo === it}
                      onCheckedChange={() => setFilterTipo(it)}
                    >
                      {t(`tipos.${it}`)}
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

      {/* Totals footer — always visible */}
      <div className="flex-none border-t bg-background px-3 py-2 flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">{t('totalMonthly')}</p>
        <p className="text-sm font-bold text-red-600 dark:text-red-400 font-mono">
          −{formatCurrency(filtered.reduce((s, d) => s + (Number(d.monto_mensual) || 0), 0))}/mes
        </p>
      </div>
    </div>
  );
}
