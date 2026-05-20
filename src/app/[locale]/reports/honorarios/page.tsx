'use client';

import { Banknote } from 'lucide-react';
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
import type { ReportHonorariosResponse, ReportHonorariosRow } from '@/lib/types';
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

export default function HonorariosPage() {
  const t = useTranslations('ReportHonorariosPage');

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [basis, setBasis] = useState<'cobrado' | 'facturado'>('cobrado');
  const [currency, setCurrency] = useState('all');

  const [chartCurrency, setChartCurrency] = useState<'UYU' | 'USD'>('UYU');

  const [data, setData] = useState<ReportHonorariosResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = useCallback(async () => {
    if (!dateRange?.from || !dateRange?.to) return;
    setIsLoading(true);
    try {
      const query: Record<string, string> = {
        date_from: format(dateRange.from, 'yyyy-MM-dd'),
        date_to: format(dateRange.to, 'yyyy-MM-dd'),
        basis,
      };
      if (currency !== 'all') query.currency = currency;
      const res = await api.get(API_ROUTES.REPORTS.HONORARIOS, query);
      setData(res?.data ?? null);
    } finally {
      setIsLoading(false);
    }
  }, [dateRange, basis, currency]);

  const columns: ColumnDef<ReportHonorariosRow>[] = [
    { accessorKey: 'doctor_name', header: t('col_doctor') },
    { accessorKey: 'currency', header: t('col_moneda') },
    {
      accessorKey: 'base_calculo',
      header: t('col_base'),
      cell: ({ row }) => fmt(Number(row.original.base_calculo)),
    },
    {
      accessorKey: 'porcentaje',
      header: t('col_pct'),
      cell: ({ row }) => `${Number(row.original.porcentaje).toFixed(1)}%`,
    },
    {
      accessorKey: 'honorario_calculado',
      header: t('col_honorario'),
      cell: ({ row }) => (
        <span className="font-semibold text-emerald-600">
          {fmt(Number(row.original.honorario_calculado))}
        </span>
      ),
    },
  ];

  const baseByCurrency = (data?.rows ?? []).reduce<Record<string, number>>((acc, r) => {
    acc[r.currency] = (acc[r.currency] || 0) + Number(r.base_calculo || 0);
    return acc;
  }, {});
  const honorariosByCurrency = (data?.rows ?? []).reduce<Record<string, number>>((acc, r) => {
    acc[r.currency] = (acc[r.currency] || 0) + Number(r.honorario_calculado || 0);
    return acc;
  }, {});

  const activeCurrencies = Object.keys(baseByCurrency).filter((c) => baseByCurrency[c] > 0).sort();
  const showMultiCurrency = currency === 'all' && activeCurrencies.length > 1;
  const displayCurrency = currency !== 'all' ? currency : activeCurrencies[0] ?? '';
  const activeCurrency = (currency !== 'all' ? currency : chartCurrency) as 'UYU' | 'USD';
  const activeRows = (data?.rows ?? []).filter((r) => r.currency === activeCurrency);

  const chartData = activeRows.map((r) => ({
    doctor: r.doctor_name.split(' ').slice(-1)[0],
    base: Number(r.base_calculo),
    honorario: Number(r.honorario_calculado),
  }));

  const s = data?.summary;

  const filters = (
    <div className="flex flex-wrap items-center gap-3">
      <DateRangePresets value={dateRange} onChange={setDateRange} />
      <div className="flex items-center gap-2">
        <Label className="text-xs whitespace-nowrap">{t('filter_basis')}</Label>
        <Select value={basis} onValueChange={(v) => setBasis(v as 'cobrado' | 'facturado')}>
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cobrado">{t('basis_cobrado')}</SelectItem>
            <SelectItem value="facturado">{t('basis_facturado')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Select value={currency} onValueChange={setCurrency}>
        <SelectTrigger className="h-8 w-28 text-xs">
          <SelectValue placeholder="Todas" />
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
  filterParts.push(basis === 'cobrado' ? 'Base cobrado' : 'Base facturado');
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
      icon={Banknote}
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
            <ReportKPICard
              title={showMultiCurrency ? t('kpi_base') : `${t('kpi_base')}${displayCurrency ? ` (${displayCurrency})` : ''}`}
              value={currency !== 'all' ? fmtMoney(s!.total_base, currency) : fmtMultiCurrency(baseByCurrency)}
            />
            <ReportKPICard
              title={showMultiCurrency ? t('kpi_honorarios') : `${t('kpi_honorarios')}${displayCurrency ? ` (${displayCurrency})` : ''}`}
              value={currency !== 'all' ? fmtMoney(s!.total_honorarios, currency) : fmtMultiCurrency(honorariosByCurrency)}
              variant="success"
            />
            <ReportKPICard title={t('kpi_doctores')} value={s!.num_doctores} />
            <ReportKPICard title={t('kpi_pct')} value={`${s!.porcentaje_promedio.toFixed(1)}%`} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 print:hidden">
            <Card className="lg:col-span-3">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm font-medium">{t('chart_title')}</CardTitle>
                  {currency === 'all' && <CurrencySwitcher value={chartCurrency} onChange={setChartCurrency} />}
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="doctor" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => fmt(v)} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Legend />
                    <Bar dataKey="base" name={t('chart_base')} fill="hsl(var(--chart-1))" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="honorario" name={t('chart_honorario')} fill="hsl(var(--chart-2))" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm font-medium">{t('detail_title')}</CardTitle>
                  {currency === 'all' && <CurrencySwitcher value={chartCurrency} onChange={setChartCurrency} />}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {activeRows.map((r) => (
                    <div key={r.doctor_id} className="flex items-center justify-between text-sm gap-2">
                      <span className="truncate max-w-[140px] text-muted-foreground">{r.doctor_name}</span>
                      <div className="text-right shrink-0">
                        <p className="font-semibold text-emerald-600">{fmtMoney(Number(r.honorario_calculado), r.currency)}</p>
                        <p className="text-xs text-muted-foreground">{Number(r.porcentaje).toFixed(1)}%</p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-4">* {t('estimado_note')}</p>
              </CardContent>
            </Card>
          </div>

          {/* Print: dual-currency layout — only shown when Ambos is selected */}
          {currency === 'all' && (
            <div className="hidden print:grid print:grid-cols-2 print:gap-4">
              {(['UYU', 'USD'] as const).map((cur) => {
                const curRows = (data?.rows ?? []).filter(r => r.currency === cur);
                const curChartData = curRows.map(r => ({
                  doctor: r.doctor_name.split(' ').slice(-1)[0],
                  base: Number(r.base_calculo),
                  honorario: Number(r.honorario_calculado),
                }));
                return (
                  <div key={cur} className="space-y-3">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">{t('chart_title')} — {cur}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={curChartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="doctor" tick={{ fontSize: 9 }} />
                            <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => fmt(v)} />
                            <Tooltip formatter={(v: number) => fmt(v)} />
                            <Legend />
                            <Bar dataKey="base" name={t('chart_base')} fill="hsl(var(--chart-1))" radius={[3,3,0,0]} />
                            <Bar dataKey="honorario" name={t('chart_honorario')} fill="hsl(var(--chart-2))" radius={[3,3,0,0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">{t('detail_title')} — {cur}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {curRows.map(r => (
                            <div key={r.doctor_id} className="flex items-center justify-between text-sm gap-2">
                              <span className="truncate text-muted-foreground">{r.doctor_name}</span>
                              <div className="text-right shrink-0">
                                <p className="font-semibold text-emerald-600">{fmtMoney(Number(r.honorario_calculado), cur)}</p>
                                <p className="text-xs text-muted-foreground">{Number(r.porcentaje).toFixed(1)}%</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
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
