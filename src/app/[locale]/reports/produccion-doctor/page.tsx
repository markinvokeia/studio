'use client';

import { Search, Stethoscope } from 'lucide-react';
import { ReportDataTable } from '@/components/reports/report-data-table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CurrencySwitcher } from '@/components/reports/currency-switcher';
import { DateRangePresets } from '@/components/reports/date-range-presets';
import { ReportKPICard } from '@/components/reports/report-kpi-card';
import { ReportShell } from '@/components/reports/report-shell';
import { API_ROUTES } from '@/constants/routes';
import { api } from '@/services/api';
import { useReportExport } from '@/hooks/use-report-export';
import type { ReportProduccionResponse, ReportProduccionRow } from '@/lib/types';
import { fmtMoney, fmtMultiCurrency } from '@/lib/utils';
import type { ColumnDef } from '@tanstack/react-table';
import { endOfMonth, format, startOfMonth } from 'date-fns';
import { useTranslations } from 'next-intl';
import { useCallback, useMemo, useState } from 'react';
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

const pct = (cobrado: number, facturado: number) =>
  facturado ? ((cobrado / facturado) * 100).toFixed(1) : '0.0';

export default function ProduccionDoctorPage() {
  const t = useTranslations('ReportProduccionDoctorPage');

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [currency, setCurrency] = useState('all');

  const [chartCurrency, setChartCurrency] = useState<'UYU' | 'USD'>('UYU');
  const [doctorSearch, setDoctorSearch] = useState('');
  const [minPctCobro, setMinPctCobro] = useState(0);
  const [topN, setTopN] = useState('all');

  const [data, setData] = useState<ReportProduccionResponse | null>(null);
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
      const res = await api.get(API_ROUTES.REPORTS.PRODUCCION_DOCTOR, query);
      setData(res?.data ?? null);
    } finally {
      setIsLoading(false);
    }
  }, [dateRange, currency]);

  const columns: ColumnDef<ReportProduccionRow>[] = [
    { accessorKey: 'doctor_name', header: t('col_doctor') },
    {
      accessorKey: 'num_pacientes',
      header: t('col_pacientes'),
      cell: ({ row }) => Number(row.original.num_pacientes),
    },
    {
      accessorKey: 'num_facturas',
      header: t('col_facturas'),
      cell: ({ row }) => Number(row.original.num_facturas),
    },
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
      accessorKey: 'ticket_promedio',
      header: t('col_ticket'),
      cell: ({ row }) => fmt(Number(row.original.ticket_promedio)),
    },
    {
      id: 'pct_cobro',
      enableSorting: false,
      header: t('col_pct'),
      cell: ({ row }) => (
        <span className="tabular-nums">
          {pct(Number(row.original.total_cobrado), Number(row.original.total_facturado))}%
        </span>
      ),
    },
  ];

  // Client-side filters applied on top of API data
  const allRows = useMemo(() => data?.rows ?? [], [data]);
  const filteredRows = useMemo(() => {
    let rows = allRows;
    if (doctorSearch) rows = rows.filter((r) => r.doctor_name.toLowerCase().includes(doctorSearch.toLowerCase()));
    if (minPctCobro > 0) rows = rows.filter((r) => {
      const p = Number(r.total_facturado) ? (Number(r.total_cobrado) / Number(r.total_facturado)) * 100 : 0;
      return p >= minPctCobro;
    });
    if (topN !== 'all') rows = rows.slice(0, Number(topN));
    return rows;
  }, [allRows, doctorSearch, minPctCobro, topN]);

  const { exportCSV, exportExcel, exportPDF } = useReportExport(columns, filteredRows.length > 0 ? filteredRows : null, 'produccion-doctor');

  const facturadoByCurrency = allRows.reduce<Record<string, number>>((acc, r) => {
    acc[r.currency] = (acc[r.currency] || 0) + Number(r.total_facturado || 0);
    return acc;
  }, {});
  const cobradoByCurrency = allRows.reduce<Record<string, number>>((acc, r) => {
    acc[r.currency] = (acc[r.currency] || 0) + Number(r.total_cobrado || 0);
    return acc;
  }, {});

  const activeCurrencies = Object.keys(facturadoByCurrency).filter((c) => facturadoByCurrency[c] > 0).sort();
  const showMultiCurrency = currency === 'all' && activeCurrencies.length > 1;
  const displayCurrency = currency !== 'all' ? currency : activeCurrencies[0] ?? '';
  const activeCurrency = (currency !== 'all' ? currency : chartCurrency) as 'UYU' | 'USD';
  const activeRows = allRows.filter((r) => r.currency === activeCurrency);

  const chartData = filteredRows
    .filter((r) => r.currency === activeCurrency)
    .map((r) => ({
      doctor: r.doctor_name.split(' ').slice(-1)[0],
      facturado: Number(r.total_facturado),
      cobrado: Number(r.total_cobrado),
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
      {data && (
        <>
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="pl-8 h-8 text-xs w-40"
              placeholder="Filtrar doctor..."
              value={doctorSearch}
              onChange={(e) => setDoctorSearch(e.target.value)}
            />
          </div>
          <Select value={topN} onValueChange={setTopN}>
            <SelectTrigger className="h-8 w-24 text-xs">
              <SelectValue placeholder="Top N" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="5">Top 5</SelectItem>
              <SelectItem value="10">Top 10</SelectItem>
              <SelectItem value="20">Top 20</SelectItem>
            </SelectContent>
          </Select>
          {minPctCobro > 0 && (
            <Badge variant="outline" className="text-xs h-8 px-2 gap-1">
              ≥{minPctCobro}% cobrado
              <button className="ml-1 text-muted-foreground hover:text-foreground" onClick={() => setMinPctCobro(0)}>×</button>
            </Badge>
          )}
          <div className="flex items-center gap-2 min-w-[160px]">
            <Label className="text-xs text-muted-foreground whitespace-nowrap shrink-0">% cobro mín</Label>
            <Slider
              min={0}
              max={100}
              step={5}
              value={[minPctCobro]}
              onValueChange={([v]) => setMinPctCobro(v)}
              className="w-24"
            />
            <span className="text-xs tabular-nums w-8">{minPctCobro}%</span>
          </div>
        </>
      )}
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
      icon={Stethoscope}
            title={t('title')}
      description={dateRangeDescription}
      filters={filters}
      onGenerate={handleGenerate}
      isLoading={isLoading}
      hasData={!!data}
      onExportCSV={exportCSV}
      onExportExcel={exportExcel}
      onExportPDF={exportPDF}
    >
      {data && (
        <>
          <div className="flex flex-wrap gap-3">
            <ReportKPICard
              title={showMultiCurrency ? t('kpi_facturado') : `${t('kpi_facturado')}${displayCurrency ? ` (${displayCurrency})` : ''}`}
              value={currency !== 'all' ? fmtMoney(s!.total_facturado, currency) : fmtMultiCurrency(facturadoByCurrency)}
              variant="success"
            />
            <ReportKPICard
              title={showMultiCurrency ? t('kpi_cobrado') : `${t('kpi_cobrado')}${displayCurrency ? ` (${displayCurrency})` : ''}`}
              value={currency !== 'all' ? fmtMoney(s!.total_cobrado, currency) : fmtMultiCurrency(cobradoByCurrency)}
            />
            <ReportKPICard title={t('kpi_doctores')} value={s!.num_doctores} />
            <ReportKPICard
              title={showMultiCurrency ? t('kpi_ticket') : `${t('kpi_ticket')}${displayCurrency ? ` (${displayCurrency})` : ''}`}
              value={currency !== 'all' ? fmtMoney(s!.ticket_promedio, currency) : '—'}
            />
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
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="doctor" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => fmt(v)} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Legend />
                    <Bar dataKey="facturado" name={t('chart_facturado')} fill="hsl(var(--chart-1))" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="cobrado" name={t('chart_cobrado')} fill="hsl(var(--chart-2))" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm font-medium">{t('ranking_title')}</CardTitle>
                  {currency === 'all' && <CurrencySwitcher value={chartCurrency} onChange={setChartCurrency} />}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {filteredRows.filter((r) => r.currency === activeCurrency).slice(0, 5).map((r) => {
                    const pctVal = Number(r.total_facturado) ? (Number(r.total_cobrado) / Number(r.total_facturado)) * 100 : 0;
                    return (
                      <div key={r.doctor_id} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="truncate max-w-[160px]">{r.doctor_name}</span>
                          <span className="font-medium tabular-nums shrink-0">{fmtMoney(Number(r.total_facturado), r.currency)}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-chart-2 rounded-full"
                            style={{ width: `${Math.min(pctVal, 100)}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">{pct(Number(r.total_cobrado), Number(r.total_facturado))}% cobrado</p>
                      </div>
                    );
                  })}
                </div>
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
                  facturado: Number(r.total_facturado),
                  cobrado: Number(r.total_cobrado),
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
                            <Bar dataKey="facturado" name={t('chart_facturado')} fill="hsl(var(--chart-1))" radius={[3,3,0,0]} />
                            <Bar dataKey="cobrado" name={t('chart_cobrado')} fill="hsl(var(--chart-2))" radius={[3,3,0,0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">{t('ranking_title')} — {cur}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {curRows.slice(0, 5).map(r => {
                            const pctVal = Number(r.total_facturado) ? (Number(r.total_cobrado) / Number(r.total_facturado)) * 100 : 0;
                            return (
                              <div key={r.doctor_id} className="space-y-0.5">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="truncate max-w-[130px]">{r.doctor_name}</span>
                                  <span className="font-medium tabular-nums shrink-0">{fmt(Number(r.total_facturado))}</span>
                                </div>
                                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                  <div className="h-full bg-chart-2 rounded-full" style={{ width: `${Math.min(pctVal, 100)}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                );
              })}
            </div>
          )}

          <ReportDataTable columns={columns} data={filteredRows} useGlobalFilter />
        </>
      )}
    </ReportShell>
  );
}
