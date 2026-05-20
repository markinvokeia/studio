'use client';

import { LayoutDashboard } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DateRangePresets } from '@/components/reports/date-range-presets';
import { ReportKPICard } from '@/components/reports/report-kpi-card';
import { ReportShell } from '@/components/reports/report-shell';
import { API_ROUTES } from '@/constants/routes';
import { api } from '@/services/api';
import type { ReportEstadoResultadoResponse } from '@/lib/types';
import { fmtMoney, cn } from '@/lib/utils';
import { endOfMonth, format, startOfMonth } from 'date-fns';
import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import type { DateRange } from 'react-day-picker';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const fmt = (n: number) =>
  new Intl.NumberFormat('es-UY', { maximumFractionDigits: 0 }).format(n);

export default function EstadoResultadosPage() {
  const t = useTranslations('ReportEstadoResultadosPage');

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [currency, setCurrency] = useState('UYU');

  const [data, setData] = useState<ReportEstadoResultadoResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = useCallback(async () => {
    if (!dateRange?.from || !dateRange?.to) return;
    setIsLoading(true);
    try {
      const query: Record<string, string> = {
        date_from: format(dateRange.from, 'yyyy-MM-dd'),
        date_to: format(dateRange.to, 'yyyy-MM-dd'),
        currency,
      };
      const res = await api.get(API_ROUTES.REPORTS.ESTADO_RESULTADOS, query);
      setData(res?.data ?? null);
    } finally {
      setIsLoading(false);
    }
  }, [dateRange, currency]);

  // Build waterfall chart data
  const chartData = data ? [
    { name: t('chart_ingresos'), value: data.ingresos.total, fill: 'hsl(var(--chart-1))' },
    ...data.gastos.lineas.map((l) => ({
      name: l.concepto,
      value: -Number(l.total),
      fill: 'hsl(var(--chart-4))',
    })),
    { name: t('chart_resultado'), value: data.resultado.neto, fill: data.resultado.neto >= 0 ? 'hsl(var(--chart-2))' : 'hsl(var(--chart-5))' },
  ] : [];

  const filters = (
    <div className="flex flex-wrap items-center gap-3">
      <DateRangePresets value={dateRange} onChange={setDateRange} />
      <Select value={currency} onValueChange={setCurrency}>
        <SelectTrigger className="h-8 w-24 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="UYU">UYU</SelectItem>
          <SelectItem value="USD">USD</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  const filterParts: string[] = [];
  if (dateRange?.from && dateRange?.to) {
    filterParts.push(`${format(dateRange.from, 'dd/MM/yyyy')} al ${format(dateRange.to, 'dd/MM/yyyy')}`);
  }
  filterParts.push(currency);
  const dateRangeDescription = filterParts.length > 0 ? (
    <span>
      {t('description')}{' — '}
      {filterParts.map((p, i) => (
        <span key={p}>
          {i > 0 && ' · '}
          <strong className="text-foreground font-semibold">{p}</strong>
        </span>
      ))}
    </span>
  ) : t('description');

  return (
    <ReportShell
      icon={LayoutDashboard}
            title={t('title')}
      description={dateRangeDescription}
      filters={filters}
      onGenerate={handleGenerate}
      isLoading={isLoading}
      hasData={!!data}
    >
      {data && (
        <>
          <div className="flex flex-wrap gap-3">
            <ReportKPICard title={`${t('kpi_ingresos')} (${currency})`} value={fmtMoney(data.ingresos.total, currency)} variant="success" />
            <ReportKPICard title={`${t('kpi_gastos')} (${currency})`} value={fmtMoney(data.gastos.total, currency)} variant="danger" />
            <ReportKPICard
              title={`${t('kpi_neto')} (${currency})`}
              value={fmtMoney(data.resultado.neto, currency)}
              variant={data.resultado.neto >= 0 ? 'success' : 'danger'}
            />
            <ReportKPICard title={t('kpi_margen')} value={`${(data.resultado.margen * 100).toFixed(1)}%`} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <Card className="lg:col-span-3">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{t('chart_title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => fmt(Math.abs(v))} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                      {chartData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{t('detail_title')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">{t('section_ingresos')}</p>
                  <div className="space-y-1">
                    {data.ingresos.lineas.map((l, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="truncate max-w-[160px] text-muted-foreground">{l.concepto}</span>
                        <span className="font-medium text-emerald-600 tabular-nums shrink-0">{fmt(Number(l.total))}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">{t('section_gastos')}</p>
                  <div className="space-y-1">
                    {data.gastos.lineas.map((l, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="truncate max-w-[160px] text-muted-foreground">{l.concepto}</span>
                        <span className="font-medium text-red-600 tabular-nums shrink-0">({fmt(Number(l.total))})</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex justify-between text-sm font-semibold border-t pt-2">
                  <span>{t('resultado_label')}</span>
                  <span className={cn('font-semibold tabular-nums', data.resultado.neto >= 0 ? 'text-green-600' : 'text-red-600')}>
                    {fmtMoney(data.resultado.neto, currency)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </ReportShell>
  );
}
