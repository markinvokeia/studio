'use client';

import { Layers } from 'lucide-react';
import { ReportDataTable } from '@/components/reports/report-data-table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DateRangePresets } from '@/components/reports/date-range-presets';
import { ReportKPICard } from '@/components/reports/report-kpi-card';
import { ReportShell } from '@/components/reports/report-shell';
import { API_ROUTES } from '@/constants/routes';
import { api } from '@/services/api';
import type { ReportServiciosResponse, ReportServiciosRow } from '@/lib/types';
import type { ColumnDef } from '@tanstack/react-table';
import { endOfMonth, format, startOfMonth } from 'date-fns';
import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import type { DateRange } from 'react-day-picker';
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const fmt = (n: number) =>
  new Intl.NumberFormat('es-UY', { maximumFractionDigits: 0 }).format(n);

const PIE_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export default function ServiciosPage() {
  const t = useTranslations('ReportServiciosPage');

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [tipo,     setTipo]     = useState('all');
  const [currency, setCurrency] = useState('UYU');

  const [data, setData]           = useState<ReportServiciosResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = useCallback(async () => {
    if (!dateRange?.from || !dateRange?.to) return;
    setIsLoading(true);
    try {
      const res = await api.get(API_ROUTES.REPORTS.SERVICIOS, {
        date_from: format(dateRange.from, 'yyyy-MM-dd'),
        date_to:   format(dateRange.to,   'yyyy-MM-dd'),
        tipo,
        currency,
      });
      setData(res?.data ?? null);
    } finally {
      setIsLoading(false);
    }
  }, [dateRange, tipo, currency]);

  const rows = data?.rows ?? [];
  const s    = data?.summary;

  const tipoLabel = tipo === 'flow' ? t('filter_tipo_flow') : tipo === 'single' ? t('filter_tipo_single') : null;
  const description = (
    <span>
      {t('description')}
      {' · '}
      <strong>{currency}</strong>
      {tipoLabel && <> · <strong>{tipoLabel}</strong></>}
      {dateRange?.from && dateRange?.to && (
        <> · <strong>{format(dateRange.from, 'dd/MM/yyyy')} – {format(dateRange.to, 'dd/MM/yyyy')}</strong></>
      )}
    </span>
  );

  const chartTop10 = rows.slice(0, 10).map(r => ({
    name:      r.service_name.length > 28 ? r.service_name.slice(0, 26) + '…' : r.service_name,
    facturado: r.total_facturado,
    sesiones:  r.num_sesiones,
  }));

  const categoryMap = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.category] = (acc[r.category] || 0) + r.total_facturado;
    return acc;
  }, {});
  const pieData = Object.entries(categoryMap)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }));

  const totalFacturado = s?.total_facturado ?? 0;

  // Two-line header for print: currency goes to a second smaller line
  const MonetaryHeader = ({ label }: { label: string }) => (
    <span className="block leading-tight">
      {label}
      <span className="print:hidden"> ({currency})</span>
      <span className="hidden print:block text-[9px] font-normal opacity-60 leading-none mt-0.5">
        ({currency})
      </span>
    </span>
  );

  const columns: ColumnDef<ReportServiciosRow>[] = [
    {
      accessorKey: 'service_name',
      header: t('col_servicio'),
    },
    {
      accessorKey: 'category',
      header: t('col_categoria'),
      size: 115,
    },
    {
      id: 'tipo',
      header: t('col_tipo'),
      size: 110,
      enableSorting: false,
      cell: ({ row }) => row.original.is_flow
        ? <span className="text-xs font-medium text-blue-600 dark:text-blue-400">{t('tipo_flujo')}</span>
        : <span className="text-xs text-muted-foreground">{t('tipo_unico')}</span>,
    },
    {
      accessorKey: 'num_sesiones',
      header: t('col_sesiones'),
      size: 62,
      cell: ({ row }) => <span className="tabular-nums">{row.original.num_sesiones}</span>,
    },
    {
      accessorKey: 'num_presupuestos',
      header: t('col_presupuestos'),
      size: 62,
      cell: ({ row }) => <span className="tabular-nums">{row.original.num_presupuestos}</span>,
    },
    {
      accessorKey: 'num_facturas',
      header: t('col_facturas'),
      size: 55,
      cell: ({ row }) => <span className="tabular-nums">{row.original.num_facturas}</span>,
    },
    {
      accessorKey: 'num_tratamientos',
      header: t('col_tratamientos'),
      size: 65,
      cell: ({ row }) => <span className="tabular-nums">{row.original.num_tratamientos}</span>,
    },
    {
      accessorKey: 'total_facturado',
      header: () => <MonetaryHeader label={t('col_facturado')} />,
      size: 90,
      cell: ({ row }) => <span className="tabular-nums font-medium">{fmt(row.original.total_facturado)}</span>,
    },
    {
      accessorKey: 'precio_promedio',
      header: () => <MonetaryHeader label={t('col_precio')} />,
      size: 78,
      cell: ({ row }) => <span className="tabular-nums">{fmt(row.original.precio_promedio)}</span>,
    },
    {
      accessorKey: 'pct_total',
      header: t('col_pct'),
      size: 68,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <div className="h-1.5 w-10 rounded-full bg-muted overflow-hidden print:hidden">
            <div className="h-full bg-chart-1 rounded-full" style={{ width: `${Math.min(row.original.pct_total, 100)}%` }} />
          </div>
          <span className="text-xs tabular-nums">{row.original.pct_total.toFixed(1)}%</span>
        </div>
      ),
    },
  ];

  const filters = (
    <div className="flex flex-wrap items-center gap-3">
      <DateRangePresets value={dateRange} onChange={setDateRange} />
      <Select value={tipo} onValueChange={setTipo}>
        <SelectTrigger className="h-8 w-36 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('filter_tipo_all')}</SelectItem>
          <SelectItem value="single">{t('filter_tipo_single')}</SelectItem>
          <SelectItem value="flow">{t('filter_tipo_flow')}</SelectItem>
        </SelectContent>
      </Select>
      <Select value={currency} onValueChange={setCurrency}>
        <SelectTrigger className="h-8 w-28 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="UYU">UYU</SelectItem>
          <SelectItem value="USD">USD</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <ReportShell
      icon={Layers}
            title={t('title')}
      description={description}
      filters={filters}
      onGenerate={handleGenerate}
      isLoading={isLoading}
      hasData={!!data}
    >
      {data && s && (
        <>
          <div className="flex flex-wrap gap-3 print:grid print:grid-cols-4 print:gap-3">
            <ReportKPICard title={t('kpi_servicios')}                   value={s.total_servicios} />
            <ReportKPICard title={`${t('kpi_facturado')} (${currency})`} value={fmt(s.total_facturado)} variant="success" />
            <ReportKPICard title={t('kpi_sesiones')}                    value={s.total_sesiones} />
            <ReportKPICard title={`${t('kpi_precio')} (${currency})`}   value={fmt(s.precio_promedio)} />
          </div>

          {/* Screen charts */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 print:hidden">
            <Card className="lg:col-span-3">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  {t('chart_top10')} ({currency})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={chartTop10} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => fmt(v)} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={160} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="facturado" name={`${t('chart_facturado')} (${currency})`} fill="hsl(var(--chart-1))" radius={[0, 3, 3, 0]} />
                    <Bar dataKey="sesiones"  name={t('chart_sesiones')}                      fill="hsl(var(--chart-2))" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  {t('chart_categoria')} ({currency})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="42%"
                      innerRadius={50}
                      outerRadius={80}
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Legend
                      verticalAlign="bottom"
                      iconSize={10}
                      wrapperStyle={{ fontSize: 10 }}
                      formatter={(name: string) => {
                        const val = categoryMap[name] || 0;
                        const pct = totalFacturado ? (val / totalFacturado * 100).toFixed(1) : '0';
                        const short = name.length > 20 ? name.slice(0, 18) + '…' : name;
                        return `${short} ${pct}%`;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Print charts — stacked, each full width */}
          <div className="hidden print:flex print:flex-col print:gap-4">
            {/* Bar chart — full width */}
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                {t('chart_top10')} ({currency})
              </p>
              <BarChart
                width={760}
                height={260}
                data={chartTop10}
                layout="vertical"
                margin={{ top: 4, right: 24, left: 4, bottom: 4 }}
              >
                <XAxis type="number" tick={{ fontSize: 8 }} tickFormatter={(v) => fmt(v)} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 8 }} width={170} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Legend wrapperStyle={{ fontSize: 9 }} />
                <Bar dataKey="facturado" name={`${t('chart_facturado')} (${currency})`} fill="hsl(var(--chart-1))" radius={[0, 2, 2, 0]} />
                <Bar dataKey="sesiones"  name={t('chart_sesiones')}                      fill="hsl(var(--chart-2))" radius={[0, 2, 2, 0]} />
              </BarChart>
            </div>

            {/* Pie chart — full width, legend on right with percentages */}
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                {t('chart_categoria')} ({currency})
              </p>
              <PieChart width={760} height={240}>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="32%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Legend
                  layout="vertical"
                  align="right"
                  verticalAlign="top"
                  iconSize={9}
                  wrapperStyle={{ fontSize: 10, paddingLeft: 12, maxWidth: 260 }}
                  formatter={(name: string) => {
                    const val = categoryMap[name] || 0;
                    const pct = totalFacturado ? (val / totalFacturado * 100).toFixed(1) : '0';
                    const short = name.length > 22 ? name.slice(0, 20) + '…' : name;
                    return `${short} ${pct}%`;
                  }}
                />
              </PieChart>
            </div>
          </div>

          {/* Table — print column widths via @media print; wrapper removes right-edge border */}
          <style>{`
            @media print {
              .servicios-table th:nth-child(1), .servicios-table td:nth-child(1) { width: auto !important; min-width: 160px !important; }
              .servicios-table th:nth-child(3), .servicios-table td:nth-child(3) { width: 120px !important; min-width: 120px !important; }
              .servicios-table th:nth-child(4), .servicios-table td:nth-child(4) { width: 38px !important; min-width: 38px !important; }
              .servicios-table th:nth-child(5), .servicios-table td:nth-child(5) { width: 40px !important; min-width: 40px !important; }
              .servicios-table th:nth-child(6), .servicios-table td:nth-child(6) { width: 36px !important; min-width: 36px !important; }
              .servicios-table th:nth-child(7), .servicios-table td:nth-child(7) { width: 40px !important; min-width: 40px !important; }
            }
          `}</style>
          <div className="servicios-table [&>div>div]:print:border-r-0 [&>div>div]:print:rounded-none">
            <ReportDataTable
              columns={columns}
              data={rows}
              useGlobalFilter
              filterPlaceholder={t('search_placeholder')}
            />
          </div>
        </>
      )}
    </ReportShell>
  );
}
