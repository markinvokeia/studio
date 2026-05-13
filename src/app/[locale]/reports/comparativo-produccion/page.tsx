'use client';

import { TrendingUp } from 'lucide-react';
import { ReportDataTable } from '@/components/reports/report-data-table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CurrencySwitcher } from '@/components/reports/currency-switcher';
import { ReportKPICard } from '@/components/reports/report-kpi-card';
import { ReportShell } from '@/components/reports/report-shell';
import { API_ROUTES } from '@/constants/routes';
import { api } from '@/services/api';
import type { ReportComparativoResponse, ReportComparativoRow } from '@/lib/types';
import { fmtMoney } from '@/lib/utils';
import type { ColumnDef } from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const fmt = (n: number) =>
  new Intl.NumberFormat('es-UY', { maximumFractionDigits: 0 }).format(n);

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic'];

const LINE_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export default function ComparativoProduccionPage() {
  const t = useTranslations('ReportComparativoPage');
  const currentYear = new Date().getFullYear();

  const [year, setYear] = useState(String(currentYear));
  const [currency, setCurrency] = useState('all');

  const [chartCurrency, setChartCurrency] = useState<'UYU' | 'USD'>('UYU');

  const [data, setData] = useState<ReportComparativoResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = useCallback(async () => {
    setIsLoading(true);
    try {
      const query: Record<string, string> = { year };
      if (currency !== 'all') query.currency = currency;
      const res = await api.get(API_ROUTES.REPORTS.COMPARATIVO_PROD, query);
      setData(res?.data ?? null);
    } finally {
      setIsLoading(false);
    }
  }, [year, currency]);

  const activeCurrency = (currency !== 'all' ? currency : chartCurrency) as 'UYU' | 'USD';
  const activeRows = (data?.rows ?? []).filter((r) => r.currency === activeCurrency);

  // Build chart data: 12 months × N doctors (filtered by activeCurrency)
  const doctors = [...new Set(activeRows.map((r) => r.doctor_name))];
  const chartData = MONTHS.map((label, i) => {
    const mesNum = i + 1;
    const entry: Record<string, number | string> = { mes: label };
    for (const doc of doctors) {
      const row = activeRows.find((r) => r.mes_num === mesNum && r.doctor_name === doc);
      entry[doc] = row ? Number(row.total_facturado) : 0;
    }
    return entry;
  });

  // Summary: best month, current month, avg (filtered by activeCurrency)
  const totalByMonth = MONTHS.map((_, i) => {
    const mesNum = i + 1;
    return activeRows
      .filter((r) => r.mes_num === mesNum)
      .reduce((s, r) => s + Number(r.total_facturado), 0);
  });
  const bestMonthVal = Math.max(...(totalByMonth.length ? totalByMonth : [0]));
  const bestMonthLabel = MONTHS[totalByMonth.indexOf(bestMonthVal)] ?? '-';
  const currentMonthVal = totalByMonth[new Date().getMonth()] ?? 0;
  const avgMonthly = totalByMonth.length
    ? totalByMonth.filter(Boolean).reduce((s, v) => s + v, 0) / (totalByMonth.filter(Boolean).length || 1)
    : 0;

  const columns: ColumnDef<ReportComparativoRow>[] = [
    { accessorKey: 'mes', header: t('col_mes') },
    { accessorKey: 'doctor_name', header: t('col_doctor') },
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
      accessorKey: 'num_pacientes',
      header: t('col_pacientes'),
      cell: ({ row }) => Number(row.original.num_pacientes),
    },
  ];

  const yearOptions = Array.from({ length: 5 }, (_, i) => String(currentYear - i));

  const filters = (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <Label className="text-xs whitespace-nowrap">{t('filter_year')}</Label>
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="h-8 w-24 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {yearOptions.map((y) => (
              <SelectItem key={y} value={y}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <Label className="text-xs whitespace-nowrap">{t('filter_currency')}</Label>
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
    </div>
  );

  return (
    <ReportShell
      icon={TrendingUp}
            title={t('title')}
      description={t('description')}
      filters={filters}
      onGenerate={handleGenerate}
      isLoading={isLoading}
      hasData={!!data}
    >
      {data && (
        <>
          <div className="flex flex-wrap gap-3">
            <ReportKPICard title={t('kpi_mejor')} value={bestMonthLabel} subtitle={currency !== 'all' ? fmtMoney(bestMonthVal, currency) : fmt(bestMonthVal)} />
            <ReportKPICard title={t('kpi_actual')} value={currency !== 'all' ? fmtMoney(currentMonthVal, currency) : fmt(currentMonthVal)} />
            <ReportKPICard title={t('kpi_promedio')} value={currency !== 'all' ? fmtMoney(avgMonthly, currency) : fmt(avgMonthly)} />
            <ReportKPICard title={t('kpi_num_doctores')} value={doctors.length} />
          </div>

          <div className="print:hidden">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm font-medium">{t('chart_title')} {year}</CardTitle>
                  {currency === 'all' && <CurrencySwitcher value={chartCurrency} onChange={setChartCurrency} />}
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => fmt(v)} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Legend />
                    {doctors.map((doc, i) => (
                      <Line
                        key={doc}
                        type="monotone"
                        dataKey={doc}
                        stroke={LINE_COLORS[i % LINE_COLORS.length]}
                        strokeWidth={2}
                        dot={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Print: dual-currency layout — only shown when Ambos is selected */}
          {currency === 'all' && (
            <div className="hidden print:grid print:grid-cols-2 print:gap-4">
              {(['UYU', 'USD'] as const).map((cur) => {
                const curRows = (data?.rows ?? []).filter(r => r.currency === cur);
                const curDoctors = [...new Set(curRows.map(r => r.doctor_name))];
                const curChartData = MONTHS.map((label, i) => {
                  const mesNum = i + 1;
                  const entry: Record<string, number | string> = { mes: label };
                  for (const doc of curDoctors) {
                    const row = curRows.find(r => r.mes_num === mesNum && r.doctor_name === doc);
                    entry[doc] = row ? Number(row.total_facturado) : 0;
                  }
                  return entry;
                });
                return (
                  <Card key={cur}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">{t('chart_title')} {year} — {cur}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={curChartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="mes" tick={{ fontSize: 9 }} />
                          <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => fmt(v)} />
                          <Tooltip formatter={(v: number) => fmt(v)} />
                          <Legend />
                          {curDoctors.map((doc, i) => (
                            <Line
                              key={doc}
                              type="monotone"
                              dataKey={doc}
                              stroke={LINE_COLORS[i % LINE_COLORS.length]}
                              strokeWidth={2}
                              dot={false}
                            />
                          ))}
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
