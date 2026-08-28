'use client';

import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

import { ConsolidatedOnlyBadge, NoDataBadge } from '@/components/dashboard/data-quality-badge';
import {
  EMPTY,
  formatAmount,
  formatCount,
  formatVariation,
  parseDateOnly,
  variationTone,
} from '@/components/dashboard/dashboard-format';

import { cn } from '@/lib/utils';
import type { DashboardCurrency, DashboardExecutiveSummary } from '@/lib/types';

import { format, subMonths } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { useLocale, useTranslations } from 'next-intl';

interface MonthSummaryCardsProps {
  data: DashboardExecutiveSummary | null;
  currency: DashboardCurrency;
  isBranchFiltered: boolean;
  isLoading?: boolean;
}

interface MonthCard {
  key: string;
  label: string;
  value: string;
  variation: string | null;
  tone: 'positive' | 'negative' | 'neutral';
  note: string | null;
  badge?: React.ReactNode;
  muted?: boolean;
}

const TONE_PILL: Record<MonthCard['tone'], string> = {
  positive: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400',
  negative: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
  neutral: 'bg-muted text-muted-foreground',
};

export function MonthSummaryCards({ data, currency, isBranchFiltered, isLoading }: MonthSummaryCardsProps) {
  const t = useTranslations('DashboardGerencial');
  const locale = useLocale();
  const dateLocale = locale === 'en' ? enUS : es;

  const serverDate = parseDateOnly(data?.fecha_servidor);
  const monthName = serverDate ? format(serverDate, 'LLLL', { locale: dateLocale }) : '';
  const prevMonthName = serverDate ? format(subMonths(serverDate, 1), 'LLLL', { locale: dateLocale }) : '';
  const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

  // Qué proporción de lo facturado en el mes efectivamente entró: es la lectura que
  // separa "vendimos mucho" de "cobramos mucho".
  const collectionRatio =
    data && data.produccion.mes && data.cobranza.mes !== null
      ? Math.round((data.cobranza.mes / data.produccion.mes) * 100)
      : null;

  const cards: MonthCard[] = data
    ? [
        {
          key: 'produccion',
          label: t('production'),
          value: formatAmount(data.produccion.mes, currency),
          variation: formatVariation(data.produccion.var_mes_pct),
          tone: variationTone(data.produccion.var_mes_pct),
          note:
            data.produccion.mes_anterior !== null
              ? t('previousMonth', {
                  month: capitalize(prevMonthName),
                  value: formatAmount(data.produccion.mes_anterior, currency),
                })
              : null,
        },
        {
          key: 'cobranza',
          label: t('collections'),
          value: formatAmount(data.cobranza.mes, currency),
          variation: formatVariation(data.cobranza.var_mes_pct),
          tone: variationTone(data.cobranza.var_mes_pct),
          note: collectionRatio !== null ? t('pctOfProduced', { pct: collectionRatio }) : null,
          badge: isBranchFiltered && !data.cobranza.disponible_por_sede ? <ConsolidatedOnlyBadge /> : undefined,
        },
        // Ver el comentario del hero: sin `atenciones` se conserva la etiqueta anterior.
        data.atenciones
          ? {
              key: 'atenciones',
              label: t('metricAttendances'),
              value: formatCount(data.atenciones.mes),
              variation: formatVariation(data.atenciones.var_mes_pct),
              tone: variationTone(data.atenciones.var_mes_pct),
              note: [
                t('distinctPatients', { count: data.pacientes_atendidos.mes }),
                t('newThisMonth', { count: data.pacientes_nuevos.mes }),
              ].join(' · '),
            }
          : {
              key: 'pacientes',
              label: t('patientsSeen'),
              value: formatCount(data.pacientes_atendidos.mes),
              variation: formatVariation(data.pacientes_atendidos.var_mes_pct),
              tone: variationTone(data.pacientes_atendidos.var_mes_pct),
              note: t('newThisMonth', { count: data.pacientes_nuevos.mes }),
            },
        {
          key: 'gastos',
          label: t('monthExpenses'),
          value: formatAmount(data.gastos.mes, currency),
          variation: null,
          tone: 'neutral',
          note: data.gastos.sin_datos ? t('noExpensesLoaded') : null,
          badge: data.gastos.sin_datos ? <NoDataBadge /> : undefined,
          muted: data.gastos.sin_datos,
        },
      ]
    : [];

  return (
    <section>
      <div className="mb-2.5 flex items-center gap-2.5">
        <h2 className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">
          {t('monthAccrued', { month: capitalize(monthName) })}
        </h2>
        <div className="h-px flex-1 bg-border" />
      </div>

      {!isLoading && !data && (
        <p className="py-6 text-center text-sm text-muted-foreground">{t('blockUnavailable')}</p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="p-4">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="mt-2.5 h-6 w-28" />
                <Skeleton className="mt-2.5 h-3 w-32" />
              </Card>
            ))
          : cards.map((card) => (
              <Card key={card.key} className={cn('p-4', card.muted && 'bg-amber-50/60 dark:bg-amber-500/5')}>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {card.label}
                  </span>
                  {card.badge}
                </div>
                <div className="mt-2 flex items-end gap-2">
                  <span
                    className={cn(
                      'text-2xl font-extrabold leading-none tracking-tight tabular-nums',
                      card.value === EMPTY && 'text-muted-foreground/50',
                    )}
                  >
                    {card.value}
                  </span>
                  {card.variation && (
                    <span
                      className={cn(
                        'mb-0.5 rounded-full px-2 py-0.5 text-[10.5px] font-bold',
                        TONE_PILL[card.tone],
                      )}
                    >
                      {card.variation}
                    </span>
                  )}
                </div>
                {card.note && (
                  <p
                    className={cn(
                      'mt-2 text-[10.5px] font-semibold',
                      card.muted ? 'text-amber-700 dark:text-amber-500' : 'text-muted-foreground',
                    )}
                  >
                    {card.note}
                  </p>
                )}
              </Card>
            ))}
      </div>
    </section>
  );
}
