'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataCard } from '@/components/ui/data-card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useNarrowMode } from '@/components/layout/two-panel-layout';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';
import { MOCK_HONORARIOS, MOCK_PERIODS } from '@/components/payroll/mock-data';
import { formatCurrency, getMonthName } from '@/components/payroll/payroll-utils';
import type { HonorariosEstado } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

const PAGE_SIZE = 25;

const STATUS_COLORS: Record<HonorariosEstado, string> = {
  pendiente:  'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  validada:   'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  autorizada: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  pagada:     'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  rechazada:  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

interface HonorariosListProps {
  selectedId?: string;
  onSelect?: (id: string) => void;
}

export function HonorariosList({ selectedId, onSelect }: HonorariosListProps) {
  const t = useTranslations('PayrollPage.honorarios');
  const { isNarrow } = useNarrowMode();
  const isViewportNarrow = useViewportNarrow();
  const currentPeriod = MOCK_PERIODS.find((p) => p.status !== 'closed') ?? MOCK_PERIODS[0];
  const [selectedPeriod, setSelectedPeriod] = useState(currentPeriod?.id ?? '');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  const honorarios = MOCK_HONORARIOS.filter((h) => {
    const matchPeriod = h.payroll_period_id === selectedPeriod;
    const matchSearch = !search || (h.doctor_name ?? '').toLowerCase().includes(search.toLowerCase());
    return matchPeriod && matchSearch;
  });

  const totalPages = Math.max(1, Math.ceil(honorarios.length / PAGE_SIZE));
  const safeP = Math.min(page, totalPages - 1);
  const paged = honorarios.slice(safeP * PAGE_SIZE, (safeP + 1) * PAGE_SIZE);

  const totalBruto = honorarios.reduce((s, h) => s + h.bruto, 0);
  const totalLiquido = honorarios.reduce((s, h) => s + h.liquido, 0);

  const useCardMode = isNarrow || isViewportNarrow || !!selectedId;

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
        <div className="flex gap-2 items-center shrink-0">
          <Select value={selectedPeriod} onValueChange={(v) => { setSelectedPeriod(v); setPage(0); }}>
            <SelectTrigger className="h-8 text-sm w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MOCK_PERIODS.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {getMonthName(p.period_month)} {p.period_year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" className="h-7 text-xs">
            <Plus className="h-3 w-3 mr-1" />
            {t('generate')}
          </Button>
        </div>
      </div>

      {/* Summary bar */}
      {honorarios.length > 0 && (
        <div className="flex gap-4 px-3 py-1.5 border-b bg-muted/20 text-xs shrink-0">
          <span className="text-muted-foreground">{t('totalBruto')}: <strong>{formatCurrency(totalBruto)}</strong></span>
          <span className="text-muted-foreground">{t('totalLiquido')}: <strong className="text-green-600 dark:text-green-400">{formatCurrency(totalLiquido)}</strong></span>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {useCardMode ? (
          <div className="flex flex-col gap-1.5 p-2">
            {paged.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-8">{t('none')}</p>
            ) : (
              paged.map((hon) => (
                <DataCard
                  key={hon.id}
                  isSelected={hon.id === selectedId}
                  title={hon.doctor_name}
                  subtitle={`${t(`modalidades.${hon.modalidad}`)} · ${formatCurrency(hon.bruto)}`}
                  avatar={(hon.doctor_name ?? '??').slice(0, 2).toUpperCase()}
                  showArrow
                  onClick={() => onSelect?.(hon.id)}
                  badge={
                    <Badge className={cn('text-[9px]', STATUS_COLORS[hon.estado])}>
                      {t(`estados.${hon.estado}`)}
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
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('doctor')}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('modalidad')}</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">{t('produccion')}</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">{t('bruto')}</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">{t('liquido')}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('status')}</th>
                </tr>
              </thead>
              <tbody>
                {paged.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">{t('none')}</td>
                  </tr>
                ) : (
                  paged.map((hon) => (
                    <tr
                      key={hon.id}
                      className={cn(
                        'border-b last:border-0 cursor-pointer hover:bg-muted/20 transition-colors',
                        hon.id === selectedId && 'bg-primary/5 ring-1 ring-inset ring-primary/30'
                      )}
                      onClick={() => onSelect?.(hon.id)}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium">{hon.doctor_name}</p>
                        {hon.doctor_rut && <p className="text-xs text-muted-foreground font-mono">RUT {hon.doctor_rut}</p>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{t(`modalidades.${hon.modalidad}`)}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{formatCurrency(hon.produccion_base)}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatCurrency(hon.bruto)}</td>
                      <td className="px-4 py-3 text-right font-medium text-green-600 dark:text-green-400">{formatCurrency(hon.liquido)}</td>
                      <td className="px-4 py-3">
                        <Badge className={cn('text-xs', STATUS_COLORS[hon.estado])}>
                          {t(`estados.${hon.estado}`)}
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
