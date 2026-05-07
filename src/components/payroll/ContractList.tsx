'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataCard } from '@/components/ui/data-card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useNarrowMode } from '@/components/layout/two-panel-layout';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';
import type { DoctorContract } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

const PAGE_SIZE = 25;

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
  const [showOnlyActive, setShowOnlyActive] = useState(true);
  const [page, setPage] = useState(0);

  const filtered = contracts.filter((c) => {
    const matchSearch =
      !search ||
      (c.doctor_name ?? '').toLowerCase().includes(search.toLowerCase());
    const matchActive = !showOnlyActive || c.is_active;
    return matchSearch && matchActive;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safeP = Math.min(page, totalPages - 1);
  const paged = filtered.slice(safeP * PAGE_SIZE, (safeP + 1) * PAGE_SIZE);

  const useCardMode = isNarrow || isViewportNarrow || !!selectedId;

  if (loading) {
    return (
      <div className="flex flex-col gap-3 p-4">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full rounded" />)}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Toolbar */}
      <div className={cn('flex gap-2 p-3 border-b shrink-0', useCardMode ? 'flex-col' : 'flex-row items-center')}>
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <div className="flex gap-1 shrink-0">
          <Button
            size="sm"
            variant={showOnlyActive ? 'default' : 'outline'}
            className="h-7 text-xs"
            onClick={() => { setShowOnlyActive(true); setPage(0); }}
          >
            {t('filterActive')}
          </Button>
          <Button
            size="sm"
            variant={!showOnlyActive ? 'default' : 'outline'}
            className="h-7 text-xs"
            onClick={() => { setShowOnlyActive(false); setPage(0); }}
          >
            {t('filterAll')}
          </Button>
          {onNew && (
            <Button size="sm" className="h-7 text-xs ml-1" onClick={onNew}>
              <Plus className="h-3 w-3 mr-1" />
              {t('create')}
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {useCardMode ? (
          <div className="flex flex-col gap-1.5 p-2">
            {paged.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-8">{t('noContracts')}</p>
            ) : (
              paged.map((contract) => (
                <DataCard
                  key={contract.id}
                  isSelected={contract.id === selectedId}
                  title={contract.doctor_name ?? '—'}
                  subtitle={`${t(`calculationTypes.${contract.calculation_type}`)} · ${contractRateSummary(contract, t)}`}
                  avatar={(contract.doctor_name ?? '??').slice(0, 2).toUpperCase()}
                  showArrow
                  onClick={() => onSelect?.(contract.id)}
                  badge={
                    <Badge className={cn('text-[9px]', CONTRACT_TYPE_COLORS[contract.contract_type] ?? '')}>
                      {t(`contractTypes.${contract.contract_type}`)}
                    </Badge>
                  }
                  accentColor={!contract.is_active ? undefined : undefined}
                />
              ))
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b sticky top-0">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs">{t('doctor')}</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs">{t('contractType')}</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs">{t('calculationType')}</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs">{t('rate')}</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs">{t('validFrom')}</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs">Estado</th>
                </tr>
              </thead>
              <tbody>
                {paged.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                      {t('noContracts')}
                    </td>
                  </tr>
                ) : (
                  paged.map((contract) => (
                    <tr
                      key={contract.id}
                      className={cn(
                        'border-b last:border-0 cursor-pointer transition-colors',
                        contract.id === selectedId
                          ? 'bg-primary/5 ring-1 ring-inset ring-primary/30'
                          : 'hover:bg-muted/20'
                      )}
                      onClick={() => onSelect?.(contract.id)}
                    >
                      <td className="px-4 py-2.5 font-medium">{contract.doctor_name}</td>
                      <td className="px-4 py-2.5">
                        <Badge className={cn('text-xs', CONTRACT_TYPE_COLORS[contract.contract_type])}>
                          {t(`contractTypes.${contract.contract_type}`)}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs">
                        {t(`calculationTypes.${contract.calculation_type}`)}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs">{contractRateSummary(contract, t)}</td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs">{contract.valid_from}</td>
                      <td className="px-4 py-2.5">
                        <Badge className={cn('text-xs', contract.is_active
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-muted text-muted-foreground')}>
                          {contract.is_active ? t('active') : t('inactive')}
                        </Badge>
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
          <Button
            variant="outline" size="sm" className="h-7"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={safeP === 0}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="text-xs text-muted-foreground">{safeP + 1} / {totalPages}</span>
          <Button
            variant="outline" size="sm" className="h-7"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={safeP >= totalPages - 1}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
