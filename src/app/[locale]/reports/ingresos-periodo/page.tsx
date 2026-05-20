'use client';

import { TrendingUp } from 'lucide-react';
import { ReportDataTable } from '@/components/reports/report-data-table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CurrencySwitcher } from '@/components/reports/currency-switcher';
import { DateRangePresets } from '@/components/reports/date-range-presets';
import { ReportKPICard } from '@/components/reports/report-kpi-card';
import { ReportShell } from '@/components/reports/report-shell';
import { API_ROUTES } from '@/constants/routes';
import { api } from '@/services/api';
import type { ReportIngresosResponse, ReportIngresosRow } from '@/lib/types';
import { fmtMoney, fmtMultiCurrency } from '@/lib/utils';
import type { ColumnDef } from '@tanstack/react-table';
import { endOfMonth, format, startOfMonth } from 'date-fns';
import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import type { DateRange } from 'react-day-picker';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const fmt = (n: number) =>
  new Intl.NumberFormat('es-UY', { maximumFractionDigits: 0 }).format(n);

export default function IngresosPeriodoPage() {
  const t = useTranslations('ReportIngresosPeriodoPage');

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [currency, setCurrency] = useState('all');
  const [groupBy, setGroupBy] = useState('day');

  const [chartCurrency, setChartCurrency] = useState<'UYU' | 'USD'>('UYU');

  const [data, setData] = useState<ReportIngresosResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = useCallback(async () => {
    if (!dateRange?.from || !dateRange?.to) return;
    setIsLoading(true);
    try {
      const query: Record<string, string> = {
        date_from: format(dateRange.from, 'yyyy-MM-dd'),
        date_to: format(dateRange.to, 'yyyy-MM-dd'),
        group_by: groupBy,
      };
      if (currency !== 'all') query.currency = currency;
      const res = await api.get(API_ROUTES.REPORTS.INGRESOS_PERIODO, query);
      setData(res?.data ?? null);
    } finally {
      setIsLoading(false);
    }
  }, [dateRange, currency, groupBy]);

  const columns: ColumnDef<ReportIngresosRow>[] = [
    {
      accessorKey: 'periodo',
      header: t('col_periodo'),
      cell: ({ row }) => String(row.original.periodo ?? '').substring(0, 10),
    },
    { accessorKey: 'currency', header: t('col_moneda') },
    {
      accessorKey: 'total_cobrado',
      header: t('col_total'),
      cell: ({ row }) => fmt(Number(row.original.total_cobrado)),
    },
    {
      accessorKey: 'num_cobros',
      header: t('col_cobros'),
      cell: ({ row }) => Number(row.original.num_cobros),
    },
    {
      accessorKey: 'promedio',
      header: t('col_promedio'),
      cell: ({ row }) => fmt(Number(row.original.promedio)),
    },
  ];

  const activeCurrency = (currency !== 'all' ? currency : chartCurrency) as 'UYU' | 'USD';

  const chartData = [...(data?.rows ?? [])]
    .filter((r) => r.currency === activeCurrency)
    .reverse()
    .map((r) => ({
      periodo: String(r.periodo ?? '').substring(5, 10),
      total: Number(r.total_cobrado),
    }));

  const totalByCurrency = (data?.rows ?? []).reduce<Record<string, number>>((acc, r) => {
    acc[r.currency] = (acc[r.currency] || 0) + Number(r.total_cobrado || 0);
    return acc;
  }, {});

  const activeCurrencies = Object.keys(totalByCurrency).filter((c) => totalByCurrency[c] > 0).sort();
  const showMultiCurrency = currency === 'all' && activeCurrencies.length > 1;
  const displayCurrency = currency !== 'all' ? currency : activeCurrencies[0] ?? '';
  const filteredForAvg = (data?.rows ?? []).filter((r) => r.currency === activeCurrency);
  const avg = filteredForAvg.length
    ? filteredForAvg.reduce((s, r) => s + Number(r.total_cobrado), 0) / filteredForAvg.length
    : 0;
  const s = data?.summary;

  const filters = (
    <div className="flex flex-wrap items-center gap-3">
      <DateRangePresets value={dateRange} onChange={setDateRange} />
      <div className="flex items-center gap-2">
        <Label className="text-xs whitespace-nowrap">{t('filter_agrupar')}</Label>
        <Select value={groupBy} onValueChange={setGroupBy}>
          <SelectTrigger className="h-8 w-28 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day">{t('group_dia')}</SelectItem>
            <SelectItem value="week">{t('group_semana')}</SelectItem>
            <SelectItem value="month">{t('group_mes')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Select value={currency} onValueChange={setCurrency}>
        <SelectTrigger className="h-8 w-24 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas</SelectItem>
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
  if (currency !== 'all') filterParts.push(currency);
  filterParts.push({ day: 'Por día', week: 'Por semana', month: 'Por mes' }[groupBy] ?? groupBy);
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
      icon={TrendingUp}
            title={t('title')}
      description={dateRangeDescription}
      filters={filters}
      onGenerate={handleGenerate}
      isLoading={isLoading}
      hasData={!!data}
    >
      {data && (
        <>
          <div className="flex flex-wrap gap-3 print:grid print:grid-cols-4 print:gap-3">
            <ReportKPICard
              title={showMultiCurrency ? t('kpi_total') : `${t('kpi_total')}${displayCurrency ? ` (${displayCurrency})` : ''}`}
              value={currency !== 'all' ? fmtMoney(s!.total_cobrado, currency) : fmtMultiCurrency(totalByCurrency)}
              variant="success"
            />
            <ReportKPICard title={t('kpi_cobros')} value={s!.num_cobros} />
            <ReportKPICard
              title={showMultiCurrency ? t('kpi_promedio') : `${t('kpi_promedio')}${displayCurrency ? ` (${displayCurrency})` : ''}`}
              value={currency !== 'all' ? fmtMoney(s!.promedio_periodo, currency) : '—'}
            />
            <ReportKPICard title={t('kpi_mejor')} value={s!.mejor_periodo} />
          </div>

          <div className="print:hidden">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm font-medium">{t('chart_title')}</CardTitle>
                  {currency === 'all' && <CurrencySwitcher value={chartCurrency} onChange={setChartCurrency} />}
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="periodo" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => fmt(v)} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <ReferenceLine y={avg} stroke="hsl(var(--chart-3))" strokeDasharray="4 4" label={{ value: 'Prom', fontSize: 9 }} />
                    <Line type="monotone" dataKey="total" name={t('chart_total')} stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Print: dual-currency layout — only shown when Ambos is selected */}
          {currency === 'all' && (
            <div className="hidden print:grid print:grid-cols-2 print:gap-4">
              {(['UYU', 'USD'] as const).map((cur) => {
                const curChartData = [...(data?.rows ?? [])].filter(r => r.currency === cur).reverse().map(r => ({
                  periodo: String(r.periodo ?? '').substring(5, 10),
                  total: Number(r.total_cobrado),
                }));
                const curAvg = curChartData.length > 0 ? curChartData.reduce((s, r) => s + r.total, 0) / curChartData.length : 0;
                return (
                  <Card key={cur}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">{t('chart_title')} — {cur}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={curChartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="periodo" tick={{ fontSize: 9 }} />
                          <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => fmt(v)} />
                          <Tooltip formatter={(v: number) => fmt(v)} />
                          <ReferenceLine y={curAvg} stroke="hsl(var(--chart-3))" strokeDasharray="4 4" label={{ value: 'Prom', fontSize: 8 }} />
                          <Line type="monotone" dataKey="total" name={t('chart_total')} stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          <ReportDataTable columns={columns} data={data.rows} useGlobalFilter />
        </>
      )}
    </ReportShell>
  );
}
