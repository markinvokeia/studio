'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

import { EstimatedBadge } from '@/components/dashboard/data-quality-badge';
import { formatAmount, formatCount } from '@/components/dashboard/dashboard-format';

import { cn } from '@/lib/utils';
import type { DashboardCurrency, ProduccionSucursalResponse } from '@/lib/types';

import { useTranslations } from 'next-intl';

interface ProductionByBranchProps {
  data: ProduccionSucursalResponse | null;
  currency: DashboardCurrency;
  isLoading?: boolean;
  className?: string;
}

// Misma paleta que el resto de los gráficos, para que una sede tenga el mismo color
// acá y en cualquier otro corte del panel.
const BAR_COLORS = ['hsl(var(--chart-5))', 'hsl(var(--chart-3))', 'hsl(var(--chart-2))', 'hsl(var(--chart-4))'];

export function ProductionByBranch({ data, currency, isLoading, className }: ProductionByBranchProps) {
  const t = useTranslations('DashboardGerencial');

  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader className="flex-row items-center gap-2 space-y-0 border-b py-3.5">
        <CardTitle className="text-sm font-extrabold tracking-tight">{t('branches')}</CardTitle>
        {data?.sede_source === 'estimated' && <EstimatedBadge />}
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-4 pt-4">
        {isLoading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="mt-2 h-2.5 w-full rounded-full" />
              <Skeleton className="mt-2 h-3 w-2/3" />
            </div>
          ))
        ) : !data ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('blockUnavailable')}</p>
        ) : data.rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('noBranchData')}</p>
        ) : (
          data.rows.map((row, index) => (
            <div key={row.sede_id}>
              <div className="flex items-baseline gap-2">
                <span className="truncate text-[13px] font-extrabold">{row.name}</span>
                <span className="ml-auto shrink-0 text-[15px] font-extrabold tabular-nums">
                  {formatAmount(row.produccion, currency)}
                </span>
                <span className="shrink-0 text-[11px] font-bold text-muted-foreground tabular-nums">
                  {row.pct}%
                </span>
              </div>

              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.max(row.pct, 0)}%`,
                    backgroundColor: BAR_COLORS[index % BAR_COLORS.length],
                  }}
                />
              </div>

              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                {/* Atenciones primero: es la cifra aditiva. Los pacientes distintos van al
                    lado como lectura secundaria. Contra un workflow anterior no viene
                    `atenciones` y se muestra solo el conteo de personas. */}
                {row.atenciones !== undefined && (
                  <span className="text-[10px] font-semibold text-muted-foreground">
                    <span className="text-[13px] font-extrabold text-foreground tabular-nums">
                      {formatCount(row.atenciones)}
                    </span>{' '}
                    {t('attendancesLabel')}
                  </span>
                )}
                <span className="text-[10px] font-semibold text-muted-foreground">
                  <span className="text-[13px] font-extrabold text-foreground tabular-nums">
                    {formatCount(row.pacientes)}
                  </span>{' '}
                  {t('patientsLabel')}
                </span>
                <span className="text-[10px] font-semibold text-muted-foreground">
                  <span className="text-[13px] font-extrabold text-foreground tabular-nums">
                    {formatAmount(row.ticket_promedio, currency)}
                  </span>{' '}
                  {t('avgTicket')}
                </span>
                <span className="text-[10px] font-semibold text-muted-foreground">
                  <span className="text-[13px] font-extrabold text-destructive tabular-nums">
                    {formatCount(row.no_show)}
                  </span>{' '}
                  {t('noShow')}
                </span>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
