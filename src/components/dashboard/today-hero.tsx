'use client';

import { Skeleton } from '@/components/ui/skeleton';

import { ConsolidatedOnlyBadge, NoDataBadge } from '@/components/dashboard/data-quality-badge';
import {
  EMPTY,
  formatAmount,
  formatCount,
  formatVariation,
  formatVariationAbs,
  parseDateOnly,
} from '@/components/dashboard/dashboard-format';

import { cn } from '@/lib/utils';
import type { DashboardCurrency, DashboardExecutiveSummary } from '@/lib/types';

import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { useLocale, useTranslations } from 'next-intl';

interface TodayHeroProps {
  data: DashboardExecutiveSummary | null;
  currency: DashboardCurrency;
  /** Hay una sucursal seleccionada: la cobranza sigue siendo consolidada. */
  isBranchFiltered: boolean;
  isLoading?: boolean;
}

interface HeroCell {
  key: string;
  label: string;
  value: string;
  pill: string | null;
  note: string | null;
  badge?: React.ReactNode;
}

export function TodayHero({ data, currency, isBranchFiltered, isLoading }: TodayHeroProps) {
  const t = useTranslations('DashboardGerencial');
  const locale = useLocale();

  // El día de comparación es el mismo día de la semana anterior: un miércoles contra un
  // miércoles. Contra "ayer" la lectura sería ruido, porque el volumen de la agenda
  // depende del día de la semana.
  const serverDate = parseDateOnly(data?.fecha_servidor);
  const weekday = serverDate ? format(serverDate, 'EEEE', { locale: locale === 'en' ? enUS : es }) : '';

  const cells: HeroCell[] = data
    ? [
        {
          key: 'produccion',
          label: t('production'),
          value: formatAmount(data.produccion.hoy, currency),
          pill: formatVariation(data.produccion.var_dia_pct),
          note: t('vsSameWeekday', { weekday }),
        },
        {
          key: 'cobranza',
          label: t('collections'),
          value: formatAmount(data.cobranza.hoy, currency),
          pill: formatVariation(data.cobranza.var_dia_pct),
          note: t('vsSameWeekday', { weekday }),
          badge: isBranchFiltered && !data.cobranza.disponible_por_sede ? <ConsolidatedOnlyBadge /> : undefined,
        },
        // Atenciones como cifra principal y personas como lectura secundaria. Sin el bloque
        // `atenciones` (workflow anterior) se vuelve a rotular "pacientes atendidos": mostrar
        // un conteo de personas bajo la etiqueta "Atenciones" seria decir algo falso.
        data.atenciones
          ? {
              key: 'atenciones',
              label: t('metricAttendances'),
              value: formatCount(data.atenciones.hoy),
              pill: formatVariationAbs(data.atenciones.var_dia_abs),
              note: [
                t('distinctPatients', { count: data.pacientes_atendidos.hoy }),
                t('ofScheduled', { count: data.atenciones.agendados_hoy }),
              ].join(' · '),
            }
          : {
              key: 'pacientes',
              label: t('patientsSeen'),
              value: formatCount(data.pacientes_atendidos.hoy),
              pill: formatVariationAbs(data.pacientes_atendidos.var_dia_abs),
              note: t('ofScheduled', { count: data.pacientes_atendidos.agendados_hoy }),
            },
        {
          key: 'resultado',
          label: t('cashResult'),
          value: formatAmount(data.resultado.hoy, currency),
          pill: null,
          note: data.resultado.sin_datos ? t('noExpensesLoaded') : null,
          badge: data.resultado.sin_datos ? <NoDataBadge /> : undefined,
        },
      ]
    : [];

  return (
    <div className="relative overflow-hidden rounded-xl bg-primary px-6 py-5 text-primary-foreground shadow-lg">
      {/* Halos decorativos: dan profundidad a la banda sin depender de un gradiente que
          cambia de legibilidad entre los temas claro, oscuro y "claro". */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-primary-foreground/5" />
      <div className="pointer-events-none absolute -bottom-24 right-16 h-48 w-48 rounded-full bg-primary-foreground/5" />

      <div className="relative flex items-center gap-2.5">
        <span className="h-1.5 w-1.5 rounded-full bg-green-400 ring-4 ring-green-400/25" />
        <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-primary-foreground/85">
          {t('today')}
        </span>
        {data && (
          <span className="text-[11px] font-medium text-primary-foreground/50">
            {t('updatedAt', { time: format(new Date(), 'HH:mm') })}
          </span>
        )}
      </div>

      {!isLoading && !data && (
        <p className="relative mt-4 text-sm font-medium text-primary-foreground/70">{t('blockUnavailable')}</p>
      )}

      <div className="relative mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="border-l-2 border-primary-foreground/15 pl-4">
                <Skeleton className="h-3 w-24 bg-primary-foreground/20" />
                <Skeleton className="mt-2.5 h-9 w-32 bg-primary-foreground/20" />
                <Skeleton className="mt-2.5 h-3 w-28 bg-primary-foreground/20" />
              </div>
            ))
          : cells.map((cell) => (
              <div key={cell.key} className="border-l-2 border-primary-foreground/15 pl-4">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10.5px] font-bold uppercase tracking-wider text-primary-foreground/60">
                    {cell.label}
                  </span>
                  {cell.badge}
                </div>
                <div
                  className={cn(
                    'mt-1.5 text-[2.5rem] font-extrabold leading-none tracking-tight tabular-nums',
                    cell.value === EMPTY && 'text-primary-foreground/40',
                  )}
                >
                  {cell.value}
                </div>
                {(cell.pill || cell.note) && (
                  <div className="mt-2 flex items-center gap-2">
                    {cell.pill && (
                      <span className="rounded-full bg-primary-foreground/15 px-2 py-0.5 text-[10.5px] font-bold">
                        {cell.pill}
                      </span>
                    )}
                    {cell.note && (
                      <span className="text-[10.5px] font-medium text-primary-foreground/55">{cell.note}</span>
                    )}
                  </div>
                )}
              </div>
            ))}
      </div>
    </div>
  );
}
