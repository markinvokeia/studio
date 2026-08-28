'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

import { NoDataBadge } from '@/components/dashboard/data-quality-badge';
import {
  EMPTY,
  formatAmount,
  formatCount,
  formatVariation,
  parseDateOnly,
  variationTone,
} from '@/components/dashboard/dashboard-format';

import { cn } from '@/lib/utils';
import type {
  DashboardCurrency,
  EvolucionMensualMetrica,
  EvolucionMensualResponse,
} from '@/lib/types';
import { formatDisplayDate } from '@/lib/utils';

import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { useLocale, useTranslations } from 'next-intl';

const TONE_PILL: Record<'positive' | 'negative' | 'neutral', string> = {
  positive: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400',
  negative: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
  neutral: 'bg-muted text-muted-foreground',
};

const METRIC_LABEL: Record<
  EvolucionMensualMetrica['key'],
  | 'metricProduction'
  | 'metricCollections'
  | 'metricAttendances'
  | 'metricPatients'
  | 'metricNew'
  | 'metricExpenses'
> = {
  produccion: 'metricProduction',
  cobranza: 'metricCollections',
  atenciones: 'metricAttendances',
  pacientes: 'metricPatients',
  nuevos: 'metricNew',
  gastos: 'metricExpenses',
};

interface MonthlyEvolutionProps {
  data: EvolucionMensualResponse | null;
  currency: DashboardCurrency;
  isLoading?: boolean;
  className?: string;
}

export function MonthlyEvolution({ data, currency, isLoading, className }: MonthlyEvolutionProps) {
  const t = useTranslations('DashboardGerencial');
  const locale = useLocale();
  const dateLocale = locale === 'en' ? enUS : es;

  const meses = data?.meses ?? [];
  const partial = meses.find((m) => m.es_parcial);
  // La columna de Δ compara contra el mes anterior al último; se nombra para que no haya
  // que adivinar contra qué se está midiendo.
  const prevMonth = meses.length >= 2 ? meses[meses.length - 2] : null;
  const prevMonthLabel = monthLabel(prevMonth?.inicio, dateLocale);

  return (
    <Card className={className}>
      <CardHeader className="flex-row items-center gap-3 space-y-0 border-b py-3.5">
        <div className="min-w-0 flex-1">
          <CardTitle className="text-sm font-extrabold tracking-tight">{t('evolutionTitle')}</CardTitle>
          <CardDescription className="mt-0.5 text-[10.5px] font-medium">
            {t('evolutionSubtitle', { count: meses.length || 6 })}
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        {isLoading ? (
          <Skeleton className="h-[180px] w-full" />
        ) : !data ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('blockUnavailable')}</p>
        ) : meses.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('noBranchData')}</p>
        ) : (
          <>
            {/* Con 6+ meses la tabla puede no entrar en pantallas angostas: scroll propio,
                nunca scroll horizontal de la página. */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 pr-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {t('evolutionMetric')}
                    </th>
                    {meses.map((m) => (
                      <th
                        key={m.mes}
                        className="px-2 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
                      >
                        {monthLabel(m.inicio, dateLocale)}
                        {m.es_parcial && <span className="ml-0.5 text-muted-foreground/60">*</span>}
                      </th>
                    ))}
                    <th className="py-2 pl-3 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {prevMonthLabel
                        ? t('evolutionDelta', { month: prevMonthLabel })
                        : t('evolutionDeltaGeneric')}
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {data.metricas.map((metrica) => {
                    const variation = formatVariation(metrica.var_pct);
                    return (
                      <tr key={metrica.key} className="border-b last:border-0">
                        <td className="py-2 pr-3 text-left">
                          <span className="flex items-center gap-1.5 text-xs font-semibold">
                            {t(METRIC_LABEL[metrica.key])}
                            {metrica.sin_datos && <NoDataBadge />}
                          </span>
                        </td>

                        {metrica.valores.map((valor, i) => {
                          const texto =
                            metrica.tipo === 'moneda'
                              ? formatAmount(valor, currency)
                              : formatCount(valor);
                          return (
                            <td
                              key={meses[i]?.mes ?? i}
                              className={cn(
                                'px-2 py-2 text-right text-xs font-semibold tabular-nums',
                                texto === EMPTY && 'text-muted-foreground/50',
                                meses[i]?.es_parcial && 'text-foreground',
                              )}
                            >
                              {texto}
                            </td>
                          );
                        })}

                        <td className="py-2 pl-3 text-right">
                          {variation ? (
                            <span
                              className={cn(
                                'rounded-full px-2 py-0.5 text-[10.5px] font-bold',
                                TONE_PILL[variationTone(metrica.var_pct)],
                              )}
                            >
                              {variation}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground/50">{EMPTY}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {partial && (
              <p className="mt-3 text-right text-[10px] text-muted-foreground/70">
                * {t('evolutionPartial', { date: formatDisplayDate(partial.fin) })}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** Nombre corto del mes (`may`, `dic`) desde un `yyyy-MM-dd`, sin corrimiento de zona. */
function monthLabel(iso: string | undefined, dateLocale: Locale): string | null {
  const date = parseDateOnly(iso);
  return date ? format(date, 'LLL', { locale: dateLocale }) : null;
}

type Locale = typeof es;
