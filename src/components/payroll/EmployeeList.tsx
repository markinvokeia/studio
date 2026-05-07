'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataCard } from '@/components/ui/data-card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useNarrowMode } from '@/components/layout/two-panel-layout';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';
import type { PayrollEmployee } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, RefreshCw, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

const PAGE_SIZE = 25;

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
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('active');
  const [page, setPage] = useState(0);

  const filtered = employees.filter((e) => {
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
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safeP = Math.min(page, totalPages - 1);
  const paged = filtered.slice(safeP * PAGE_SIZE, (safeP + 1) * PAGE_SIZE);

  const useCardMode = isNarrow || isViewportNarrow || !!selectedId;

  if (loading) {
    return (
      <div className="flex flex-col gap-3 p-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-14 w-full rounded" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Toolbar */}
      <div className={cn('flex gap-2 p-3 border-b shrink-0', useCardMode ? 'flex-col' : 'flex-row items-center')}>
        <div className="flex gap-2 flex-1">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder={t('searchPlaceholder')}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="pl-8 h-8 text-sm"
            />
          </div>
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0 shrink-0"
              onClick={onRefresh}
              title={t('refresh')}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        <div className="flex gap-1 shrink-0">
          {(['active', 'inactive', 'all'] as const).map((f) => (
            <Button
              key={f}
              variant={filterActive === f ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => { setFilterActive(f); setPage(0); }}
            >
              {t(`filter.${f}`)}
            </Button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {useCardMode ? (
          <div className="flex flex-col gap-1.5 p-2">
            {paged.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-8">{t('noEmployees')}</p>
            ) : (
              paged.map((emp) => (
                <DataCard
                  key={emp.id}
                  isSelected={emp.id === selectedId}
                  title={`${emp.apellidos}, ${emp.nombres}`}
                  subtitle={`${emp.cedula}${emp.category_name ? ` · ${emp.category_name}` : ''}`}
                  avatar={getAvatar(emp)}
                  showArrow
                  onClick={() => onSelect?.(emp.id)}
                  badge={
                    !emp.activo ? (
                      <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-medium bg-muted text-muted-foreground">
                        {t('inactive')}
                      </span>
                    ) : undefined
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
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('name')}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('cedula')}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('category')}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('ingressDate')}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('status')}</th>
                </tr>
              </thead>
              <tbody>
                {paged.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                      {t('noEmployees')}
                    </td>
                  </tr>
                ) : (
                  paged.map((emp) => (
                    <tr
                      key={emp.id}
                      className={cn(
                        'border-b last:border-0 cursor-pointer transition-colors',
                        emp.id === selectedId
                          ? 'bg-primary/5 ring-1 ring-inset ring-primary/30'
                          : 'hover:bg-muted/20'
                      )}
                      onClick={() => onSelect?.(emp.id)}
                    >
                      <td className="px-4 py-3 font-medium">{emp.apellidos}, {emp.nombres}</td>
                      <td className="px-4 py-3 font-mono text-muted-foreground">{emp.cedula}</td>
                      <td className="px-4 py-3 text-muted-foreground">{emp.category_name ?? '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{emp.fecha_ingreso}</td>
                      <td className="px-4 py-3">
                        <Badge
                          className={cn(
                            'text-xs',
                            emp.activo
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-muted text-muted-foreground'
                          )}
                        >
                          {emp.activo ? t('active') : t('inactive')}
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
            variant="outline"
            size="sm"
            className="h-7"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={safeP === 0}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="text-xs text-muted-foreground">
            {safeP + 1} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-7"
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
