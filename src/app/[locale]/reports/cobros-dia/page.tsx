'use client';

import { CircleDollarSign } from 'lucide-react';
import { ReportDataTable } from '@/components/reports/report-data-table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CurrencySwitcher } from '@/components/reports/currency-switcher';
import { DateRangePresets } from '@/components/reports/date-range-presets';
import { ReportKPICard } from '@/components/reports/report-kpi-card';
import { ReportShell } from '@/components/reports/report-shell';
import { API_ROUTES } from '@/constants/routes';
import { api } from '@/services/api';
import type { ReportCobrosResponse, ReportCobrosRow } from '@/lib/types';
import { formatDateTime, fmtMoney, fmtMultiCurrency, cn } from '@/lib/utils';
import type { ColumnDef, VisibilityState } from '@tanstack/react-table';
import { endOfMonth, format, startOfMonth } from 'date-fns';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import type { DateRange } from 'react-day-picker';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

const fmt = (n: number) =>
  new Intl.NumberFormat('es-UY', { maximumFractionDigits: 0 }).format(n);

const PIE_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

/**
 * Pie chart that switches between ResponsiveContainer (screen) and
 * fixed pixel dimensions (print). For print the pie is pushed up so the
 * legend renders below without overlapping.
 *
 * cy controls vertical centre of the donut:
 *   - "35%" → top third → legend fits below in the remaining ~65% of height
 */
function PrintPie({
  data: pieData,
  printMode,
  height = 240,
  printWidth = 500,
  printHeight = 240,
}: {
  data: { name: string; value: number }[];
  printMode: boolean;
  height?: number;
  printWidth?: number;
  printHeight?: number;
}) {
  const legendFmt = (value: string) => {
    const total = pieData.reduce((s, d) => s + d.value, 0);
    const item = pieData.find((d) => d.name === value);
    const pct = total > 0 && item ? ((item.value / total) * 100).toFixed(0) : '0';
    return <span style={{ fontSize: 11 }}>{value} ({pct}%)</span>;
  };

  const cells = pieData.map((_, i) => (
    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
  ));

  if (printMode) {
    return (
      <PieChart width={printWidth} height={printHeight}>
        {/* cy="42%" balances pie with legend below */}
        <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="42%" innerRadius={42} outerRadius={72}>
          {cells}
        </Pie>
        <Tooltip formatter={(v: number) => fmt(v)} />
        <Legend verticalAlign="bottom" formatter={legendFmt} />
      </PieChart>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        {/* cy="42%" balances pie with legend below */}
        <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="42%" innerRadius={45} outerRadius={82}>
          {cells}
        </Pie>
        <Tooltip formatter={(v: number) => fmt(v)} />
        <Legend verticalAlign="bottom" formatter={legendFmt} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export default function CobrosDiaPage() {
  const t = useTranslations('ReportCobrosDiaPage');

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [currency, setCurrency] = useState('all');
  const [chartCurrency, setChartCurrency] = useState<'UYU' | 'USD'>('UYU');
  const [data, setData] = useState<ReportCobrosResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [printMode, setPrintMode] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({ status: false });

  // Also catch Cmd+P — matchMedia fires before the print dialog renders
  useEffect(() => {
    const mql = window.matchMedia('print');
    const handler = (e: MediaQueryListEvent) => setPrintMode(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!dateRange?.from || !dateRange?.to) return;
    setIsLoading(true);
    try {
      const query: Record<string, string> = {
        date_from: format(dateRange.from, 'yyyy-MM-dd'),
        date_to: format(dateRange.to, 'yyyy-MM-dd'),
      };
      if (currency !== 'all') query.currency = currency;

      const res = await api.get(API_ROUTES.REPORTS.COBROS_DIA, query);
      setData(res?.data ?? null);
    } finally {
      setIsLoading(false);
    }
  }, [dateRange, currency]);

  const handlePrint = useCallback(async () => {
    setPrintMode(true);
    // Two animation frames: first for React to commit, second for Recharts to re-render SVG
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
    const restore = () => {
      setPrintMode(false);
      window.removeEventListener('afterprint', restore);
    };
    window.addEventListener('afterprint', restore);
    window.print();
  }, []);

  const columns: ColumnDef<ReportCobrosRow>[] = [
    { accessorKey: 'doc_no',            header: t('col_doc'),      size: 130 },
    {
      accessorKey: 'created_at',
      header: t('col_fecha'),
      size: 110,
      cell: ({ row }) => formatDateTime(row.original.created_at),
    },
    { accessorKey: 'patient_name',      header: t('col_paciente'), size: 140 },
    { accessorKey: 'payment_method',    header: t('col_metodo'),   size: 100 },
    {
      accessorKey: 'amount',
      header: t('col_monto'),
      size: 80,
      cell: ({ row }) => fmt(Number(row.original.amount)),
    },
    { accessorKey: 'currency',          header: t('col_moneda'),   size: 55  },
    { accessorKey: 'transaction_type',  header: t('col_tipo'),     size: 88  },
    {
      accessorKey: 'status',
      header: t('col_estado'),
      size: 88,
      cell: ({ row }) => (
        <span className={cn('font-medium', row.original.status === 'completed' ? 'text-green-600' : 'text-muted-foreground')}>
          {row.original.status}
        </span>
      ),
    },
  ];

  const filters = (
    <div className="flex flex-wrap items-center gap-3">
      <DateRangePresets value={dateRange} onChange={setDateRange} />
      <Select value={currency} onValueChange={setCurrency}>
        <SelectTrigger className="h-8 w-28 text-xs">
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

  const totalByCurrency = (data?.rows ?? []).reduce<Record<string, number>>((acc, r) => {
    acc[r.currency] = (acc[r.currency] || 0) + Number(r.amount || 0);
    return acc;
  }, {});

  const s = data?.summary;
  const activeCurrency = (currency !== 'all' ? currency : chartCurrency) as 'UYU' | 'USD';
  const activeRows = (data?.rows ?? []).filter((r) => r.currency === activeCurrency);

  const promedioVal = activeRows.length > 0
    ? activeRows.reduce((sum, r) => sum + Number(r.amount), 0) / activeRows.length
    : 0;
  const mayorVal = activeRows.length > 0
    ? Math.max(...activeRows.map((r) => Number(r.amount)))
    : 0;
  const pieData = activeRows.reduce<{ name: string; value: number }[]>((acc, r) => {
    const existing = acc.find((x) => x.name === r.payment_method);
    if (existing) existing.value += Number(r.amount);
    else acc.push({ name: r.payment_method, value: Number(r.amount) });
    return acc;
  }, []);

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
      icon={CircleDollarSign}
            title={t('title')}
      description={dateRangeDescription}
      filters={filters}
      onGenerate={handleGenerate}
      onPrint={handlePrint}
      isLoading={isLoading}
      hasData={!!data}
    >
      {data && (
        <>
          {/* KPI cards — 4-column grid on print fills the full A4 width */}
          <div className="flex flex-wrap gap-3 print:grid print:grid-cols-4 print:gap-3">
            {(() => {
              const isMulti = currency === 'all' && Object.keys(totalByCurrency).length > 1;
              const titleCur = isMulti ? '' : ` (${activeCurrency})`;
              return (
                <>
                  <ReportKPICard
                    title={`${t('kpi_total')}${titleCur}`}
                    value={isMulti ? fmtMultiCurrency(totalByCurrency) : fmtMoney(s!.total_cobrado, activeCurrency)}
                    variant="success"
                  />
                  <ReportKPICard title={t('kpi_cobros')} value={s!.num_cobros} />
                  <ReportKPICard title={`${t('kpi_promedio')}${titleCur}`} value={activeRows.length > 0 ? fmtMoney(promedioVal, activeCurrency) : '—'} />
                  <ReportKPICard title={`${t('kpi_mayor')}${titleCur}`}   value={activeRows.length > 0 ? fmtMoney(mayorVal,   activeCurrency) : '—'} />
                </>
              );
            })()}
          </div>

          {/* Charts — hidden on print only for Ambos (the dual-column section replaces them) */}
          <div className={`grid grid-cols-1 lg:grid-cols-5 gap-4${currency === 'all' ? ' print:hidden' : ''}`}>
            <Card className="lg:col-span-2 break-inside-avoid">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm font-medium">{t('chart_title')}</CardTitle>
                  {currency === 'all' && <CurrencySwitcher value={chartCurrency} onChange={setChartCurrency} />}
                </div>
              </CardHeader>
              <CardContent className="pt-3">
                <PrintPie data={pieData} printMode={printMode} />
              </CardContent>
            </Card>

            <Card className="lg:col-span-3 break-inside-avoid">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm font-medium">Top pacientes por monto</CardTitle>
                  {currency === 'all' && <CurrencySwitcher value={chartCurrency} onChange={setChartCurrency} />}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[...activeRows]
                    .sort((a, b) => Number(b.amount) - Number(a.amount))
                    .slice(0, 7)
                    .map((r) => (
                      <div key={r.id} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground truncate max-w-[200px]">{r.patient_name}</span>
                        <span className="font-medium tabular-nums">{fmtMoney(Number(r.amount), r.currency)}</span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Print: dual-currency layout — always use fixed px dimensions, no ResponsiveContainer,
              because this section is display:none on screen so ResizeObserver never measures it. */}
          {currency === 'all' && (
            <div className="hidden print:grid print:grid-cols-2 print:gap-4">
              {(['UYU', 'USD'] as const).map((cur) => {
                const curRows = (data?.rows ?? []).filter(r => r.currency === cur);
                const curPieData = curRows.reduce<{ name: string; value: number }[]>((acc, r) => {
                  const existing = acc.find(x => x.name === r.payment_method);
                  if (existing) existing.value += Number(r.amount);
                  else acc.push({ name: r.payment_method, value: Number(r.amount) });
                  return acc;
                }, []);
                const sorted = [...curRows].sort((a, b) => Number(b.amount) - Number(a.amount)).slice(0, 7);
                const legendFmt = (value: string) => {
                  const total = curPieData.reduce((s, d) => s + d.value, 0);
                  const item = curPieData.find(d => d.name === value);
                  const pct = total > 0 && item ? ((item.value / total) * 100).toFixed(0) : '0';
                  return <span style={{ fontSize: 10 }}>{value} ({pct}%)</span>;
                };
                return (
                  <div key={cur} className="space-y-3 break-inside-avoid">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">{t('chart_title')} — {cur}</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-2">
                        {/* Fixed px — no ResponsiveContainer for print-only sections */}
                        <PieChart width={310} height={240}>
                          <Pie data={curPieData} dataKey="value" nameKey="name" cx="50%" cy="35%" innerRadius={35} outerRadius={68}>
                            {curPieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                          </Pie>
                          <Tooltip formatter={(v: number) => fmt(v)} />
                          <Legend verticalAlign="bottom" formatter={legendFmt} />
                        </PieChart>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Top pacientes — {cur}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-1">
                          {sorted.map(r => (
                            <div key={r.id} className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground truncate max-w-[180px]">{r.patient_name}</span>
                              <span className="font-medium tabular-nums">{fmtMoney(Number(r.amount), cur)}</span>
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

          <ReportDataTable
            columns={columns}
            data={data.rows}
            useGlobalFilter
            filterPlaceholder="Buscar..."
            printMode={printMode}
            columnVisibility={columnVisibility}
            onColumnVisibilityChange={setColumnVisibility}
            columnTranslations={{
              doc_no: t('col_doc'),
              created_at: t('col_fecha'),
              patient_name: t('col_paciente'),
              payment_method: t('col_metodo'),
              amount: t('col_monto'),
              currency: t('col_moneda'),
              transaction_type: t('col_tipo'),
              status: t('col_estado'),
            }}
          />
        </>
      )}
    </ReportShell>
  );
}
