'use client';

import { Activity, Search } from 'lucide-react';
import { ReportDataTable } from '@/components/reports/report-data-table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DateRangePresets } from '@/components/reports/date-range-presets';
import { ReportKPICard } from '@/components/reports/report-kpi-card';
import { ReportShell } from '@/components/reports/report-shell';
import { API_ROUTES } from '@/constants/routes';
import { api } from '@/services/api';
import { useReportExport } from '@/hooks/use-report-export';
import type { ReportTratamientosResponse, ReportTratamientosRow } from '@/lib/types';
import type { ColumnDef } from '@tanstack/react-table';
import { endOfMonth, format, startOfMonth } from 'date-fns';
import { useTranslations } from 'next-intl';
import { useCallback, useMemo, useState } from 'react';
import type { DateRange } from 'react-day-picker';
import {
  Bar,
  BarChart,
  CartesianGrid,
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

export default function TratamientosPage() {
  const t = useTranslations('ReportTratamientosPage');

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  const [data, setData] = useState<ReportTratamientosResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Client-side filter state
  const [serviceSearch, setServiceSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'cantidad' | 'facturado'>('cantidad');

  const handleGenerate = useCallback(async () => {
    if (!dateRange?.from || !dateRange?.to) return;
    setIsLoading(true);
    try {
      const query: Record<string, string> = {
        date_from: format(dateRange.from, 'yyyy-MM-dd'),
        date_to: format(dateRange.to, 'yyyy-MM-dd'),
      };
      const res = await api.get(API_ROUTES.REPORTS.TRATAMIENTOS, query);
      setData(res?.data ?? null);
    } finally {
      setIsLoading(false);
    }
  }, [dateRange]);

  const columns: ColumnDef<ReportTratamientosRow>[] = [
    { accessorKey: 'service_name', header: t('col_tratamiento') },
    { accessorKey: 'category', header: t('col_categoria') },
    {
      accessorKey: 'cantidad',
      header: t('col_cantidad'),
      cell: ({ row }) => Number(row.original.cantidad),
    },
    {
      accessorKey: 'total_facturado',
      header: t('col_total'),
      cell: ({ row }) => fmt(Number(row.original.total_facturado)),
    },
    {
      accessorKey: 'precio_promedio',
      header: t('col_precio'),
      cell: ({ row }) => fmt(Number(row.original.precio_promedio)),
    },
    {
      accessorKey: 'pct_total',
      header: t('col_pct'),
      cell: ({ row }) => `${Number(row.original.pct_total).toFixed(1)}%`,
    },
  ];

  const allRows = useMemo(() => data?.rows ?? [], [data]);

  // Unique categories for filter
  const categories = useMemo(() => {
    const cats = [...new Set(allRows.map((r) => r.category || 'Sin categoría'))].sort();
    return cats;
  }, [allRows]);

  const filteredRows = useMemo(() => {
    let rows = allRows;
    if (serviceSearch) rows = rows.filter((r) => r.service_name.toLowerCase().includes(serviceSearch.toLowerCase()));
    if (categoryFilter !== 'all') rows = rows.filter((r) => (r.category || 'Sin categoría') === categoryFilter);
    return [...rows].sort((a, b) =>
      sortBy === 'cantidad'
        ? Number(b.cantidad) - Number(a.cantidad)
        : Number(b.total_facturado) - Number(a.total_facturado)
    );
  }, [allRows, serviceSearch, categoryFilter, sortBy]);

  const { exportCSV, exportExcel, exportPDF } = useReportExport(columns, filteredRows.length > 0 ? filteredRows : null, 'tratamientos');

  // Aggregate by category for pie chart (from filtered rows)
  const byCat: Record<string, number> = {};
  for (const r of filteredRows) {
    const cat = r.category || 'Sin categoría';
    byCat[cat] = (byCat[cat] || 0) + Number(r.total_facturado);
  }
  const pieData = Object.entries(byCat).map(([name, value]) => ({ name, value }));

  const top10 = filteredRows.slice(0, 10);

  const s = data?.summary;

  const filters = (
    <div className="flex flex-wrap items-center gap-3">
      <DateRangePresets value={dateRange} onChange={setDateRange} />
      {data && (
        <>
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="pl-8 h-8 text-xs w-44"
              placeholder="Buscar tratamiento..."
              value={serviceSearch}
              onChange={(e) => setServiceSearch(e.target.value)}
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las cat.</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as 'cantidad' | 'facturado')}>
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cantidad">Por cantidad</SelectItem>
              <SelectItem value="facturado">Por facturado</SelectItem>
            </SelectContent>
          </Select>
          {(serviceSearch || categoryFilter !== 'all') && (
            <Badge variant="outline" className="text-xs h-8 px-2">
              {filteredRows.length} / {allRows.length}
            </Badge>
          )}
        </>
      )}
    </div>
  );

  const filterParts: string[] = [];
  if (dateRange?.from && dateRange?.to) {
    filterParts.push(`${format(dateRange.from, 'dd/MM/yyyy')} al ${format(dateRange.to, 'dd/MM/yyyy')}`);
  }
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
      icon={Activity}
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
            <ReportKPICard title={t('kpi_total')} value={filteredRows.reduce((s, r) => s + Number(r.cantidad), 0)} />
            <ReportKPICard title={t('kpi_facturado')} value={fmt(filteredRows.reduce((s, r) => s + Number(r.total_facturado), 0))} variant="success" />
            <ReportKPICard title={t('kpi_precio')} value={s!.precio_promedio ? fmt(s!.precio_promedio) : '—'} />
            <ReportKPICard title={t('kpi_categorias')} value={new Set(filteredRows.map((r) => r.category)).size} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <Card className="lg:col-span-3">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{t('chart_top10')} — {sortBy === 'cantidad' ? 'por cantidad' : 'por facturado'}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={top10} layout="vertical" margin={{ top: 5, right: 20, left: 100, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={sortBy === 'facturado' ? (v) => fmt(v) : undefined} />
                    <YAxis type="category" dataKey="service_name" tick={{ fontSize: 9 }} width={95} />
                    <Tooltip formatter={(v: number) => sortBy === 'facturado' ? fmt(v) : v} />
                    <Bar
                      dataKey={sortBy === 'cantidad' ? 'cantidad' : 'total_facturado'}
                      name={sortBy === 'cantidad' ? t('chart_cantidad') : t('col_total')}
                      fill="hsl(var(--chart-1))"
                      radius={[0, 3, 3, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{t('chart_cat')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <ReportDataTable columns={columns} data={filteredRows} useGlobalFilter />
        </>
      )}
    </ReportShell>
  );
}
