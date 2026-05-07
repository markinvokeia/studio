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
import type { DoctorContract } from '@/lib/types';
import { cn } from '@/lib/utils';
import { formatDate } from '@/components/payroll/payroll-utils';
import type { ColumnDef } from '@tanstack/react-table';
import { FileText, Filter, Plus, Settings2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

const TODAY = new Date().toISOString().slice(0, 10);

function isContractActive(c: DoctorContract): boolean {
  return c.is_active && (!c.valid_until || c.valid_until.slice(0, 10) >= TODAY);
}

const CONTRACT_TYPE_COLORS: Record<string, string> = {
  empleado: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  arrendamiento: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  honorarios: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  empresa_unipersonal: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  mixto: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
};

export function contractRateSummary(c: DoctorContract, t: ReturnType<typeof useTranslations>): string {
  switch (c.calculation_type) {
    case 'fijo': return `${c.currency} ${(c.base_salary ?? 0).toLocaleString('es-UY')}`;
    case 'por_hora': return `${c.currency} ${(c.hourly_rate ?? 0).toLocaleString('es-UY')}/h`;
    case 'porcentaje': return `${c.percentage_rate}%`;
    case 'fijo_porcentaje': return `${c.currency} ${(c.base_salary ?? 0).toLocaleString('es-UY')} + ${c.percentage_rate}%`;
    case 'por_prestacion': return `${c.currency} ${(c.per_session_rate ?? 0).toLocaleString('es-UY')}/sesión`;
    default: return '—';
  }
}

interface ContractListProps {
  contracts: DoctorContract[];
  loading?: boolean;
  selectedId?: string;
  onSelect?: (id: string) => void;
  onNew?: () => void;
}

export function ContractList({ contracts, loading, selectedId, onSelect, onNew }: ContractListProps) {
  const t = useTranslations('PayrollPage.contracts');
  const { isNarrow } = useNarrowMode();
  const isViewportNarrow = useViewportNarrow();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'active' | 'inactive' | 'all'>('all');
  const [isCardMode, setIsCardMode] = useState(false);

  const filtered = useMemo(() => contracts.filter((c) => {
    const matchSearch = !search || (c.doctor_name ?? '').toLowerCase().includes(search.toLowerCase());
    const active = isContractActive(c);
    const matchStatus =
      filterStatus === 'all' ||
      (filterStatus === 'active' && active) ||
      (filterStatus === 'inactive' && !active);
    return matchSearch && matchStatus;
  }), [contracts, search, filterStatus]);

  const showCardMode = isCardMode || isNarrow || isViewportNarrow || !!selectedId;

  const columns = useMemo<ColumnDef<DoctorContract>[]>(() => [
    {
      id: 'contractType',
      header: t('contractType'),
      accessorKey: 'contract_type',
      cell: ({ row }) => (
        <Badge className={cn('text-xs', CONTRACT_TYPE_COLORS[row.original.contract_type] ?? '')}>
          {t(`contractTypes.${row.original.contract_type}`)}
        </Badge>
      ),
    },
    {
      id: 'calculationType',
      header: t('calculationType'),
      accessorKey: 'calculation_type',
      cell: ({ row }) => (
        <span className="text-muted-foreground text-xs">{t(`calculationTypes.${row.original.calculation_type}`)}</span>
      ),
    },
    {
      id: 'rate',
      header: t('rate'),
      accessorFn: (c) => contractRateSummary(c, t),
      cell: ({ row }) => (
        <span className="font-mono text-xs">{contractRateSummary(row.original, t)}</span>
      ),
    },
    {
      id: 'validFrom',
      header: t('validFrom'),
      accessorKey: 'valid_from',
      cell: ({ row }) => <span className="text-muted-foreground text-xs">{formatDate(row.original.valid_from)}</span>,
    },
    {
      id: 'status',
      header: t('status'),
      accessorKey: 'is_active',
      cell: ({ row }) => {
        const active = isContractActive(row.original);
        return (
          <Badge className={cn('text-xs', active
            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
            : 'bg-muted text-muted-foreground')}>
            {active ? t('active') : t('inactive')}
          </Badge>
        );
      },
    },
    {
      id: 'document',
      header: '',
      accessorKey: 'contract_document_id',
      cell: ({ row }) => {
        if (!row.original.contract_document_id) return null;
        return (
          <FileText
            className="h-3.5 w-3.5 text-muted-foreground"
            aria-label={row.original.contract_document_name ?? 'Documento adjunto'}
          />
        );
      },
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
        onRowClick={(c) => onSelect?.(c.id)}
        getRowClassName={(c) =>
          cn('cursor-pointer transition-colors', c.id === selectedId ? 'bg-primary/5' : '')
        }
        renderCard={(contract, isSelected) => {
          const active = isContractActive(contract);
          const validFrom = formatDate(contract.valid_from);
          const validUntil = contract.valid_until ? formatDate(contract.valid_until) : '∞';
          return (
            <DataCard
              isSelected={isSelected || contract.id === selectedId}
              title={`${t(`contractTypes.${contract.contract_type}`)} · ${t(`calculationTypes.${contract.calculation_type}`)}`}
              subtitle={`${contractRateSummary(contract, t)} · ${validFrom} → ${validUntil}`}
              avatar={t(`contractTypes.${contract.contract_type}`).slice(0, 2).toUpperCase()}
              showArrow
              onClick={() => onSelect?.(contract.id)}
              badge={
                <div className="flex items-center gap-1">
                  <Badge className={cn('text-[9px]', active
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-muted text-muted-foreground')}>
                    {active ? t('active') : t('inactive')}
                  </Badge>
                  {contract.contract_document_id && (
                    <FileText className="h-3 w-3 text-muted-foreground" aria-label={contract.contract_document_name} />
                  )}
                </div>
              }
            />
          );
        }}
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
                      {f === 'active' ? t('filterActive') : f === 'inactive' ? t('inactive') : t('filterAll')}
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
    </div>
  );
}
