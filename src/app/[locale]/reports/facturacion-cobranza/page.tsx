'use client';

import { Scale } from 'lucide-react';
import { ReportDataTable } from '@/components/reports/report-data-table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CurrencySwitcher } from '@/components/reports/currency-switcher';
import { DateRangePresets } from '@/components/reports/date-range-presets';
import { ReportKPICard } from '@/components/reports/report-kpi-card';
import { ReportShell } from '@/components/reports/report-shell';
import { API_ROUTES } from '@/constants/routes';
import { api } from '@/services/api';
import type { ReportFactCobranzaResponse, ReportFactCobranzaRow } from '@/lib/types';
import { fmtMoney, fmtMultiCurrency } from '@/lib/utils';
import type { ColumnDef } from '@tanstack/react-table';
import { endOfMonth, format, startOfMonth } from 'date-fns';
import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import type { DateRange } from 'react-day-picker';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const fmt = (n: number) =>
  new Intl.NumberFormat('es-UY', { maximumFractionDigits: 0 }).format(n);

export default function FacturacionCobranzaPage() {
  const t = useTranslations('ReportFacturacionCobranzaPage');

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [currency, setCurrency] = useState('all');

  const [chartCurrency, setChartCurrency] = useState<'UYU' | 'USD'>('UYU');

  const [data, setData] = useState<ReportFactCobranzaResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = useCallback(async () => {
    if (!dateRange?.from || !dateRange?.to) return;
    setIsLoading(true);
    try {
      const query: Record<string, string> = {
        date_from: format(dateRange.from, 'yyyy-MM-dd'),
        date_to: format(dateRange.to, 'yyyy-MM-dd'),
      };
      if (currency !== 'all') query.currency = currency;
      const res = await api.get(API_ROUTES.REPORTS.FACTURACION_COBRANZA, query);
      setData(res?.data ?? null);
    } finally {
      setIsLoading(false);
    }
  }, [dateRange, currency]);

  const columns: ColumnDef<ReportFactCobranzaRow>[] = [
    { accessorKey: 'mes', header: t('col_mes') },
    { accessorKey: 'currency', header: t('col_moneda') },
    {
      accessorKey: 'total_facturado',
      header: t('col_facturado'),
      cell: ({ row }) => fmt(Number(row.original.total_facturado)),
    },
    {
      accessorKey: 'total_cobrado',
      header: t('col_cobrado'),
      cell: ({ row }) => fmt(Number(row.original.total_cobrado)),
    },
    {
      accessorKey: 'pendiente',
      header: t('col_pendiente'),
      cell: ({ row }) => (
        <span className="text-amber-600 tabular-nums">{fmt(Number(row.original.pendiente))}</span>
      ),
    },
    {
      accessorKey: 'pct_cobrado',
      header: t('col_pct'),
      cell: ({ row }) => `${Number(row.original.pct_cobrado).toFixed(1)}%`,
    },
  ];

  const facturadoByCurrency = (data?.rows ?? []).reduce<Record<string, number>>((acc, r) => {
    acc[r.currency] = (acc[r.currency] || 0) + Number(r.total_facturado || 0);
    return acc;
  }, {});
  const cobradoByCurrency = (data?.rows ?? []).reduce<Record<string, number>>((acc, r) => {
    acc[r.currency] = (acc[r.currency] || 0) + Number(r.total_cobrado || 0);
    return acc;
  }, {});
  const pendienteByCurrency = (data?.rows ?? []).reduce<Record<string, number>>((acc, r) => {
    acc[r.currency] = (acc[r.currency] || 0) + Number(r.pendiente || 0);
    return acc;
  }, {});

  const activeCurrencies = Object.keys(facturadoByCurrency).filter((c) => facturadoByCurrency[c] > 0).sort();
  const showMultiCurrency = currency === 'all' && activeCurrencies.length > 1;
  const displayCurrency = currency !== 'all' ? currency : activeCurrencies[0] ?? '';
  const activeCurrency = (currency !== 'all' ? currency : chartCurrency) as 'UYU' | 'USD';

  const chartData = [...(data?.rows ?? [])]
    .filter((r) => r.currency === activeCurrency)
    .reverse()
    .map((r) => ({
      mes: r.mes,
      facturado: Number(r.total_facturado),
      cobrado: Number(r.total_cobrado),
      pendiente: Number(r.pendiente),
    }));

  const s = data?.summary;

  const filters = (
    <div className="flex flex-wrap items-center gap-3">
      <DateRangePresets value={dateRange} onChange={setDateRange} />
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
      icon={Scale}
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
              title={showMultiCurrency ? t('kpi_facturado') : `${t('kpi_facturado')}${displayCurrency ? ` (${displayCurrency})` : ''}`}
              value={currency !== 'all' ? fmtMoney(s!.total_facturado, currency) : fmtMultiCurrency(facturadoByCurrency)}
            />
            <ReportKPICard
              title={showMultiCurrency ? t('kpi_cobrado') : `${t('kpi_cobrado')}${displayCurrency ? ` (${displayCurrency})` : ''}`}
              value={currency !== 'all' ? fmtMoney(s!.total_cobrado, currency) : fmtMultiCurrency(cobradoByCurrency)}
              variant="success"
            />
            <ReportKPICard
              title={showMultiCurrency ? t('kpi_pendiente') : `${t('kpi_pendiente')}${displayCurrency ? ` (${displayCurrency})` : ''}`}
              value={currency !== 'all' ? fmtMoney(s!.pendiente, currency) : fmtMultiCurrency(pendienteByCurrency)}
              variant="warning"
            />
            <ReportKPICard title={t('kpi_pct')} value={`${s!.pct_cobrado.toFixed(1)}%`} />
          </div>

          {/* Screen chart — ResponsiveContainer works fine when visible */}
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
                  <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => fmt(v)} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Legend />
                    <Bar dataKey="facturado" name={t('chart_facturado')} fill="hsl(var(--chart-1))" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="cobrado" name={t('chart_cobrado')} fill="hsl(var(--chart-2))" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="pendiente" name={t('chart_pendiente')} fill="hsl(var(--chart-3))" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Print: single currency — fixed dimensions, no ResizeObserver dependency */}
          {currency !== 'all' && (
            <div className="hidden print:block">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">{t('chart_title')} — {currency}</CardTitle>
                </CardHeader>
                <CardContent>
                  <BarChart data={chartData} width={680} height={240} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="mes" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => fmt(v)} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Legend />
                    <Bar dataKey="facturado" name={t('chart_facturado')} fill="hsl(var(--chart-1))" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="cobrado" name={t('chart_cobrado')} fill="hsl(var(--chart-2))" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="pendiente" name={t('chart_pendiente')} fill="hsl(var(--chart-3))" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Print: both currencies side by side — fixed dimensions */}
          {currency === 'all' && (
            <div className="hidden print:grid print:grid-cols-2 print:gap-4">
              {(['UYU', 'USD'] as const).map((cur) => {
                const curData = [...(data?.rows ?? [])].filter(r => r.currency === cur).reverse().map(r => ({
                  mes: r.mes,
                  facturado: Number(r.total_facturado),
                  cobrado: Number(r.total_cobrado),
                  pendiente: Number(r.pendiente),
                }));
                return (
                  <Card key={cur}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">{t('chart_title')} — {cur}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <BarChart data={curData} width={320} height={200} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="mes" tick={{ fontSize: 8 }} />
                        <YAxis tick={{ fontSize: 8 }} tickFormatter={(v) => fmt(v)} width={50} />
                        <Tooltip formatter={(v: number) => fmt(v)} />
                        <Legend wrapperStyle={{ fontSize: 9 }} />
                        <Bar dataKey="facturado" name={t('chart_facturado')} fill="hsl(var(--chart-1))" radius={[3,3,0,0]} />
                        <Bar dataKey="cobrado" name={t('chart_cobrado')} fill="hsl(var(--chart-2))" radius={[3,3,0,0]} />
                        <Bar dataKey="pendiente" name={t('chart_pendiente')} fill="hsl(var(--chart-3))" radius={[3,3,0,0]} />
                      </BarChart>
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
