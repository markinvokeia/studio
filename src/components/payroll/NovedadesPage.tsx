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
import { MOCK_NOVEDADES, MOCK_PERIODS } from '@/components/payroll/mock-data';
import { formatCurrency, getMonthName } from '@/components/payroll/payroll-utils';
import type { NovedadType } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Plus, Search, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

const PAGE_SIZE = 25;

const NOVEDAD_COLORS: Record<NovedadType, string> = {
  hora_extra_habil:      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  hora_extra_feriado:    'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  ausencia_justificada:  'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  ausencia_injustificada:'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  certificado_medico:    'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  licencia:              'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  vacaciones:            'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  adelanto:              'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  bono:                  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  descuento:             'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  otro:                  'bg-muted text-muted-foreground',
};

interface NovedadesPageProps {
  selectedId?: string;
  onSelect?: (id: string) => void;
}

export function NovedadesPage({ selectedId, onSelect }: NovedadesPageProps) {
  const t = useTranslations('PayrollPage.novedades');
  const { isNarrow } = useNarrowMode();
  const isViewportNarrow = useViewportNarrow();
  const currentPeriod = MOCK_PERIODS.find((p) => p.status === 'draft') ?? MOCK_PERIODS[MOCK_PERIODS.length - 1];
  const [selectedPeriod, setSelectedPeriod] = useState(currentPeriod?.id ?? '');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  const period = MOCK_PERIODS.find((p) => p.id === selectedPeriod);
  const novedades = MOCK_NOVEDADES.filter((n) => {
    const matchPeriod = period && n.period_year === period.period_year && n.period_month === period.period_month;
    const matchSearch = !search || (n.employee_name ?? '').toLowerCase().includes(search.toLowerCase());
    return matchPeriod && matchSearch;
  });

  const totalPages = Math.max(1, Math.ceil(novedades.length / PAGE_SIZE));
  const safeP = Math.min(page, totalPages - 1);
  const paged = novedades.slice(safeP * PAGE_SIZE, (safeP + 1) * PAGE_SIZE);

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
          <Button variant="outline" size="sm" className="h-7 text-xs">
            <Upload className="h-3 w-3 mr-1" />
            {t('import')}
          </Button>
          <Button size="sm" className="h-7 text-xs">
            <Plus className="h-3 w-3 mr-1" />
            {t('add')}
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {useCardMode ? (
          <div className="flex flex-col gap-1.5 p-2">
            {paged.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-8">{t('none')}</p>
            ) : (
              paged.map((nov) => {
                const isMonetary = nov.tipo === 'adelanto' || nov.tipo === 'bono' || nov.tipo === 'descuento';
                return (
                  <DataCard
                    key={nov.id}
                    isSelected={nov.id === selectedId}
                    title={nov.employee_name}
                    subtitle={nov.descripcion ?? `${nov.cantidad}${nov.tipo.startsWith('hora') ? 'h' : 'd'}`}
                    avatar={(nov.employee_name ?? '??').slice(0, 2).toUpperCase()}
                    showArrow
                    onClick={() => onSelect?.(nov.id)}
                    badge={
                      <Badge className={cn('text-[9px]', NOVEDAD_COLORS[nov.tipo])}>
                        {t(`types.${nov.tipo}`)}
                      </Badge>
                    }
                    actions={
                      <span className="text-xs font-mono ml-auto text-muted-foreground">
                        {isMonetary ? formatCurrency(nov.cantidad) : `${nov.cantidad}${nov.tipo.startsWith('hora') ? 'h' : 'd'}`}
                      </span>
                    }
                  />
                );
              })
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('employee')}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('type')}</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">{t('quantity')}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('description')}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('dates')}</th>
                </tr>
              </thead>
              <tbody>
                {paged.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">{t('none')}</td>
                  </tr>
                ) : (
                  paged.map((nov) => {
                    const isMonetary = nov.tipo === 'adelanto' || nov.tipo === 'bono' || nov.tipo === 'descuento';
                    return (
                      <tr
                        key={nov.id}
                        className={cn(
                          'border-b last:border-0 cursor-pointer hover:bg-muted/20 transition-colors',
                          nov.id === selectedId && 'bg-primary/5 ring-1 ring-inset ring-primary/30'
                        )}
                        onClick={() => onSelect?.(nov.id)}
                      >
                        <td className="px-4 py-3 font-medium">{nov.employee_name}</td>
                        <td className="px-4 py-3">
                          <Badge className={cn('text-xs', NOVEDAD_COLORS[nov.tipo])}>
                            {t(`types.${nov.tipo}`)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          {isMonetary ? formatCurrency(nov.cantidad) : `${nov.cantidad}${nov.tipo.startsWith('hora') ? 'h' : 'd'}`}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">{nov.descripcion ?? '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs font-mono">
                          {nov.fecha_desde && nov.fecha_hasta
                            ? `${nov.fecha_desde} → ${nov.fecha_hasta}`
                            : nov.fecha_desde ?? '—'}
                        </td>
                      </tr>
                    );
                  })
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
