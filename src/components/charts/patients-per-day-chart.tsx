'use client';

import * as React from 'react';
import { Bar, BarChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from 'recharts';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';

import { parseDateOnly } from '@/components/dashboard/dashboard-format';

import type { DashboardGranularity, PacientesPorDiaResponse } from '@/lib/types';
import { formatDisplayDate } from '@/lib/utils';

import { differenceInCalendarDays, format, isSameMonth, isSameYear } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { useLocale, useTranslations } from 'next-intl';

const COLOR_NEW = 'hsl(var(--chart-2))';
const COLOR_RETURNING = 'hsl(var(--chart-5))';
/**
 * El período en curso ya no se puede pintar recoloreando la barra: con el desglose
 * apilado eso borraría la distinción nuevos/recurrentes. Se marca con una línea vertical.
 */
const COLOR_CURRENT = 'hsl(var(--secondary))';

const chartConfig = {
  nuevos: { label: 'Nuevos', color: COLOR_NEW },
  recurrentes: { label: 'Recurrentes', color: COLOR_RETURNING },
};

/** Rótulos de la serie de atenciones y, como respaldo, los de personas distintas. */
const TITLE_KEY = {
  atenciones: { day: 'attendancesPerDay', week: 'attendancesPerWeek', month: 'attendancesPerMonth' },
  pacientes: { day: 'patientsPerDay', week: 'patientsPerWeek', month: 'patientsPerMonth' },
} as const;

const AVG_KEY = {
  atenciones: { day: 'avgAttendancesPerDay', week: 'avgAttendancesPerWeek', month: 'avgAttendancesPerMonth' },
  pacientes: { day: 'avgPerDay', week: 'avgPerWeek', month: 'avgPerMonth' },
} as const;

const UNIT_KEY: Record<DashboardGranularity, 'unitDay' | 'unitWeek' | 'unitMonth'> = {
  day: 'unitDay',
  week: 'unitWeek',
  month: 'unitMonth',
};

interface PatientsPerDayChartProps {
  data: PacientesPorDiaResponse | null;
  isLoading?: boolean;
  className?: string;
}

export function PatientsPerDayChart({ data, isLoading, className }: PatientsPerDayChartProps) {
  const t = useTranslations('DashboardGerencial');
  const locale = useLocale();
  const dateLocale = locale === 'en' ? enUS : es;

  const granularity: DashboardGranularity = data?.granularity ?? 'day';

  /**
   * Normaliza los puntos aceptando la forma anterior del webhook (`fecha` / `es_hoy`) además
   * de la actual (`fecha_inicio` / `fecha_fin` / `es_actual`). Sin esto, contra un workflow de
   * n8n desactualizado el `label` queda indefinido para todas las barras y el eje X no dibuja
   * ninguna etiqueta, que es un fallo mudo: se ven las barras y no se entiende qué falta.
   */
  const points = React.useMemo(
    () =>
      (data?.rows ?? []).map((row) => {
        const pacientes = Number(row.pacientes ?? 0);
        // Un workflow anterior al desglose no manda `nuevos`: en ese caso todo el volumen
        // va a la serie de recurrentes y el gráfico se degrada a una sola barra.
        const tieneDesglose = row.nuevos !== undefined && row.nuevos !== null;
        const nuevos = tieneDesglose ? Number(row.nuevos) : 0;
        // La serie que se dibuja es la de atenciones, que sí es aditiva. Si el workflow no
        // la manda, se cae a personas distintas y el título cambia en consecuencia.
        const tieneAtenciones = row.atenciones !== undefined && row.atenciones !== null;
        const atenciones = tieneAtenciones ? Number(row.atenciones) : pacientes;
        const atNuevos = tieneAtenciones ? Number(row.atenciones_nuevos ?? 0) : nuevos;
        return {
          inicio: row.fecha_inicio ?? row.fecha ?? '',
          fin: row.fecha_fin ?? row.fecha_inicio ?? row.fecha ?? '',
          pacientes,
          nuevos: atNuevos,
          recurrentes: Number(row.atenciones_recurrentes ?? atenciones - atNuevos),
          total: atenciones,
          tieneDesglose,
          tieneAtenciones,
          actual: row.es_actual ?? row.es_hoy ?? false,
        };
      }),
    [data],
  );

  const chartData = React.useMemo(() => {
    const rows = points;
    const starts = rows.map((r) => parseDateOnly(r.inicio));

    // Con barras diarias dentro de un solo mes alcanza el número de día; en cuanto el
    // período cruza de mes hay que agregar el mes, o el eje repite 1..31 sin distinguirlos.
    const firstDate = starts.find(Boolean) ?? null;
    const spansMonths = !!firstDate && starts.some((d) => d && !isSameMonth(d, firstDate));
    const spansYears = !!firstDate && starts.some((d) => d && !isSameYear(d, firstDate));

    return rows.map((row, index) => {
      const start = starts[index];
      let label = row.inicio;
      if (start) {
        if (granularity === 'month') label = format(start, spansYears ? 'LLL yy' : 'LLL', { locale: dateLocale });
        else if (granularity === 'week') label = format(start, 'dd/MM');
        else label = format(start, spansMonths ? 'dd/MM' : 'dd');
      }

      // El tooltip siempre muestra el rango completo del bucket: en semanas y meses el
      // label del eje solo nombra el inicio y por sí solo sería ambiguo.
      const rango =
        row.inicio === row.fin
          ? formatDisplayDate(row.inicio)
          : `${formatDisplayDate(row.inicio)} – ${formatDisplayDate(row.fin)}`;

      return {
        label,
        rango,
        pacientes: row.pacientes,
        nuevos: row.nuevos,
        recurrentes: row.recurrentes,
        total: row.total,
        es_actual: row.actual,
      };
    });
  }, [points, granularity, dateLocale]);

  /** Contra un workflow anterior al desglose no hay serie de nuevos: la leyenda lo refleja. */
  const hasBreakdown = points.some((p) => p.tieneDesglose);
  /** Con atenciones el gráfico es aditivo; sin ellas se muestran personas distintas. */
  const metric = points.some((p) => p.tieneAtenciones) ? 'atenciones' : 'pacientes';
  const average = metric === 'atenciones' ? data?.promedio_atenciones ?? 0 : data?.promedio ?? 0;

  /** Etiqueta del bucket en curso, para posicionar la línea de referencia. */
  const currentLabel = chartData.find((d) => d.es_actual)?.label ?? null;

  const spannedDays = React.useMemo(() => {
    const first = parseDateOnly(points[0]?.inicio);
    const last = parseDateOnly(points[points.length - 1]?.fin);
    return first && last ? differenceInCalendarDays(last, first) + 1 : 0;
  }, [points]);

  return (
    <Card className={className}>
      <CardHeader className="flex-row items-start gap-3 space-y-0 border-b py-3.5">
        <div className="min-w-0 flex-1">
          <CardTitle className="text-sm font-extrabold tracking-tight">
            {t(TITLE_KEY[metric][granularity])}
          </CardTitle>
          <CardDescription className="mt-0.5 text-[10.5px] font-medium">
            {t(AVG_KEY[metric][granularity], { avg: average })}
          </CardDescription>
          {granularity !== 'day' && spannedDays > 0 && (
            <CardDescription className="mt-0.5 text-[10px] font-medium text-muted-foreground/70">
              {t('granularityNote', { unit: t(UNIT_KEY[granularity]), days: spannedDays })}
            </CardDescription>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-x-3 gap-y-1 pt-0.5">
          {hasBreakdown && <LegendSwatch color={COLOR_NEW} label={t('legendNew')} />}
          <LegendSwatch
            color={COLOR_RETURNING}
            label={hasBreakdown ? t('legendReturning') : t('legendThisPeriod')}
          />
          <LegendSwatch
            color={COLOR_CURRENT}
            label={granularity === 'day' ? t('legendToday') : t('legendCurrentPeriod')}
          />
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        {isLoading ? (
          <Skeleton className="h-[260px] w-full" />
        ) : !data ? (
          <p className="py-16 text-center text-sm text-muted-foreground">{t('blockUnavailable')}</p>
        ) : (
          /* `aspect-auto` es obligatorio: ChartContainer trae `aspect-video` (16:9). En una tarjeta
             ancha ese aspecto deja al contenedor sin ancho útil para el eje, y Recharts corta por
             `if (width <= 0 …) return null` en CartesianAxis: el eje X desaparece entero, sin dejar
             rastro porque no hay línea de eje ni de ticks. Mismo criterio que sales-summary-chart. */
          <ChartContainer config={chartConfig} className="aspect-auto h-[260px] w-full">
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 9 }}
                /* Sin intervalo numérico: a todo el ancho entran las 31 etiquetas diarias, y así
                   Recharts oculta por colisión conservando siempre el primer y el último período. */
                interval="preserveStartEnd"
              />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 9 }} allowDecimals={false} width={34} />
              <ChartTooltip cursor={false} content={<ChartTooltipContent labelKey="rango" />} />
              {currentLabel !== null && (
                <ReferenceLine
                  x={currentLabel}
                  stroke={COLOR_CURRENT}
                  strokeWidth={2}
                  strokeDasharray="3 3"
                />
              )}
              {/* El radio va solo en el segmento de arriba, o se redondea el medio del apilado. */}
              <Bar dataKey="nuevos" stackId="pacientes" fill={COLOR_NEW} />
              <Bar dataKey="recurrentes" stackId="pacientes" fill={COLOR_RETURNING} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ChartContainer>
        )}

        {/* Sin nota al pie: con atenciones las barras suman exacto el total del período.
            Solo se aclara en el respaldo, donde la serie vuelve a ser de personas. */}
        {metric === 'pacientes' && (
          <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground/70">
            {t('uniquePatientsNote', { unit: t(UNIT_KEY[granularity]) })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
      <span className="text-[10px] font-semibold text-muted-foreground">{label}</span>
    </span>
  );
}
