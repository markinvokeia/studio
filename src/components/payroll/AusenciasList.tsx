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
import type { AusenciaTipo, PayrollAusencia, VacationBalance } from '@/lib/types';
import { cn } from '@/lib/utils';
import { formatDate } from '@/components/payroll/payroll-utils';
import type { ColumnDef } from '@tanstack/react-table';
import { Check, Filter, Paperclip, Plus, Settings2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

const TIPO_COLORS: Record<AusenciaTipo, string> = {
  vacaciones: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  licencia_medica: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  licencia_especial: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  licencia_estudio: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  ausencia_justificada: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  ausencia_injustificada: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  suspension: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  otro: 'bg-muted text-muted-foreground',
};

const ESTADO_COLORS: Record<string, string> = {
  aprobada: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  pendiente: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  rechazada: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const TIPOS: AusenciaTipo[] = [
  'vacaciones', 'licencia_medica', 'licencia_especial', 'licencia_estudio',
  'ausencia_justificada', 'ausencia_injustificada', 'suspension', 'otro',
];

interface AusenciasListProps {
  ausencias: PayrollAusencia[];
  loading?: boolean;
  selectedId?: string;
  showEmployee?: boolean;
  // When provided, renders a compact vacation-balance footer (employee profile).
  balance?: VacationBalance | null;
  onSelect?: (id: string) => void;
  onNew?: () => void;
}

export function AusenciasList({ ausencias, loading, selectedId, showEmployee, balance, onSelect, onNew }: AusenciasListProps) {
  const t = useTranslations('PayrollPage.legajo.licencias');
  const { isNarrow } = useNarrowMode();
  const isViewportNarrow = useViewportNarrow();
  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState<AusenciaTipo | 'all'>('all');
  const [isCardMode, setIsCardMode] = useState(false);

  const filtered = useMemo(() => ausencias.filter((a) => {
    const haystack = `${a.employee_name ?? ''} ${a.descripcion ?? ''}`.toLowerCase();
    const matchSearch = !search || haystack.includes(search.toLowerCase());
    const matchTipo = filterTipo === 'all' || a.tipo === filterTipo;
    return matchSearch && matchTipo;
  }), [ausencias, search, filterTipo]);

  const showCardMode = isCardMode || isNarrow || isViewportNarrow || !!selectedId;

  const columns = useMemo<ColumnDef<PayrollAusencia>[]>(() => {
    const cols: ColumnDef<PayrollAusencia>[] = [];
    if (showEmployee) {
      cols.push({
        id: 'empleado',
        header: t('employee'),
        accessorKey: 'employee_name',
        cell: ({ row }) => <span className="font-medium text-xs">{row.original.employee_name || '—'}</span>,
      });
    }
    cols.push(
      {
        id: 'tipo',
        header: t('type'),
        accessorKey: 'tipo',
        cell: ({ row }) => (
          <Badge className={cn('text-xs', TIPO_COLORS[row.original.tipo] ?? '')}>
            {t(`tipos.${row.original.tipo}`)}
          </Badge>
        ),
      },
      {
        id: 'periodo',
        header: t('period'),
        accessorFn: (a) => a.fecha_desde,
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {formatDate(row.original.fecha_desde)} → {formatDate(row.original.fecha_hasta)}
          </span>
        ),
      },
      {
        id: 'dias',
        header: t('days'),
        accessorKey: 'dias',
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.dias}</span>,
      },
      {
        id: 'justificada',
        header: t('justified'),
        accessorKey: 'justificada',
        cell: ({ row }) => row.original.justificada
          ? <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
          : <span className="text-muted-foreground text-xs">—</span>,
      },
      {
        id: 'pagada',
        header: t('paid'),
        accessorKey: 'pagada',
        cell: ({ row }) => row.original.pagada
          ? <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
          : <span className="text-muted-foreground text-xs">—</span>,
      },
      {
        id: 'estado',
        header: t('status'),
        accessorKey: 'estado',
        cell: ({ row }) => (
          <Badge className={cn('text-xs', ESTADO_COLORS[row.original.estado] ?? '')}>
            {t(`estados.${row.original.estado}`)}
          </Badge>
        ),
      },
      {
        id: 'doc',
        header: '',
        accessorKey: 'documento_url',
        enableHiding: false,
        cell: ({ row }) => row.original.documento_url
          ? <Paperclip className="h-3.5 w-3.5 text-muted-foreground" aria-label={t('hasAttachment')} />
          : null,
      },
    );
    return cols;
  }, [t, showEmployee]);

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
        onRowClick={(a) => onSelect?.(a.id)}
        getRowClassName={(a) =>
          cn('cursor-pointer transition-colors', a.id === selectedId ? 'bg-primary/5' : '')
        }
        renderCard={(a, isSelected) => (
          <DataCard
            isSelected={isSelected || a.id === selectedId}
            title={showEmployee && a.employee_name ? a.employee_name : t(`tipos.${a.tipo}`)}
            subtitle={`${formatDate(a.fecha_desde)} → ${formatDate(a.fecha_hasta)} · ${a.dias} ${t('daysShort')}`}
            avatar={t(`tipos.${a.tipo}`).slice(0, 2).toUpperCase()}
            showArrow
            onClick={() => onSelect?.(a.id)}
            badge={
              <div className="flex items-center gap-1">
                <Badge className={cn('text-[9px]', ESTADO_COLORS[a.estado] ?? '')}>
                  {t(`estados.${a.estado}`)}
                </Badge>
                {a.documento_url && <Paperclip className="h-3 w-3 text-muted-foreground" aria-label={t('hasAttachment')} />}
              </div>
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
                <DropdownMenuContent align="end" className="min-w-[200px]">
                  <DropdownMenuCheckboxItem
                    checked={filterTipo === 'all'}
                    onCheckedChange={() => setFilterTipo('all')}
                  >
                    {t('filterAll')}
                  </DropdownMenuCheckboxItem>
                  {TIPOS.map((tp) => (
                    <DropdownMenuCheckboxItem
                      key={tp}
                      checked={filterTipo === tp}
                      onCheckedChange={() => setFilterTipo(tp)}
                    >
                      {t(`tipos.${tp}`)}
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
              <Button size="sm" className="h-8 text-xs" onClick={onNew} title={t('create')}>
                <Plus className="h-3 w-3 sm:mr-1" />
                <span className="hidden sm:inline">{t('create')}</span>
              </Button>
            )}
            paginationNode={paginationNode}
          />
        )}
      />

      {/* Vacation balance footer — only in employee-profile context */}
      {balance && (
        <div className="flex-none border-t bg-background px-3 py-2 grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-[11px] text-muted-foreground">{t('generated')}</p>
            <p className="text-sm font-semibold">{(balance.generados ?? 0).toLocaleString('es-UY', { maximumFractionDigits: 1 })}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">{t('taken')}</p>
            <p className="text-sm font-semibold">{(balance.tomados ?? 0).toLocaleString('es-UY', { maximumFractionDigits: 1 })}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">{t('balance')}</p>
            <p className={cn('text-base font-bold',
              (balance.saldo ?? 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
              {(balance.saldo ?? 0).toLocaleString('es-UY', { maximumFractionDigits: 1 })}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
