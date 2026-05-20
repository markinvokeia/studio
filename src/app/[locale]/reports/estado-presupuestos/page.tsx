'use client';

import { FileText } from 'lucide-react';
import { ReportDataTable } from '@/components/reports/report-data-table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DateRangePresets } from '@/components/reports/date-range-presets';
import { ReportKPICard } from '@/components/reports/report-kpi-card';
import { ReportShell } from '@/components/reports/report-shell';
import { API_ROUTES } from '@/constants/routes';
import { api } from '@/services/api';
import type { ReportPresupuestosResponse, ReportPresupuestosRow } from '@/lib/types';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
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

const statusLabel = (s: string) => {
  const v = s.toLowerCase();
  if (v === 'confirmed') return 'Confirmado';
  if (v === 'pending') return 'Pendiente';
  if (v === 'draft') return 'Borrador';
  if (v === 'rejected') return 'Rechazado';
  return s;
};

export default function PresupuestosPendientesPage() {
  const t = useTranslations('ReportPresupuestosPage');

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [status, setStatus] = useState('draft');
  const [currency, setCurrency] = useState('all');

  const [data, setData] = useState<ReportPresupuestosResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = useCallback(async () => {
    if (!dateRange?.from || !dateRange?.to) return;
    setIsLoading(true);
    try {
      const query: Record<string, string> = {
        date_from: format(dateRange.from, 'yyyy-MM-dd'),
        date_to: format(dateRange.to, 'yyyy-MM-dd'),
      };
      if (status !== 'all') query.status = status;
      if (currency !== 'all') query.currency = currency;

      const res = await api.get(API_ROUTES.REPORTS.PRESUPUESTOS, query);
      setData(res?.data ?? null);
    } finally {
      setIsLoading(false);
    }
  }, [dateRange, status, currency]);

  const columns: ColumnDef<ReportPresupuestosRow>[] = [
    { accessorKey: 'doc_no', header: t('col_doc') },
    {
      accessorKey: 'created_at',
      header: t('col_fecha'),
      cell: ({ row }) => formatDate(row.original.created_at),
    },
    { accessorKey: 'patient_name', header: t('col_paciente') },
    {
      accessorKey: 'total',
      header: t('col_total'),
      cell: ({ row }) => fmt(Number(row.original.total)),
    },
    { accessorKey: 'currency', header: t('col_moneda') },
    {
      accessorKey: 'status',
      header: t('col_estado'),
      cell: ({ row }) => {
        const v = row.original.status.toLowerCase();
        return (
          <span className={cn('font-medium',
            v === 'confirmed' ? 'text-green-600' :
            v === 'rejected'  ? 'text-red-600' :
            'text-gray-800 dark:text-gray-200'
          )}>
            {statusLabel(row.original.status)}
          </span>
        );
      },
    },
    {
      accessorKey: 'days_pending',
      header: t('col_dias'),
      cell: ({ row }) => {
        const d = Number(row.original.days_pending);
        return (
          <span className={cn('font-medium tabular-nums', d > 30 ? 'text-red-600' : d > 14 ? 'text-amber-500' : '')}>
            {d}
          </span>
        );
      },
    },
  ];

  // Group by week for chart
  const byWeek: Record<string, { semana: string; borrador: number; confirmado: number; rechazado: number }> = {};
  for (const r of data?.rows ?? []) {
    const week = format(new Date(r.created_at), "'S'ww-yyyy");
    if (!byWeek[week]) byWeek[week] = { semana: week, borrador: 0, confirmado: 0, rechazado: 0 };
    if (r.status === 'draft')     byWeek[week].borrador   += Number(r.total);
    if (r.status === 'confirmed') byWeek[week].confirmado += Number(r.total);
    if (r.status === 'rejected')  byWeek[week].rechazado  += Number(r.total);
  }
  const chartData = Object.values(byWeek);

  const filters = (
    <div className="flex flex-wrap items-center gap-3">
      <DateRangePresets value={dateRange} onChange={setDateRange} />
      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger className="h-8 w-36 text-xs">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          <SelectItem value="draft">Borrador</SelectItem>
          <SelectItem value="confirmed">Confirmado</SelectItem>
          <SelectItem value="rejected">Rechazado</SelectItem>
        </SelectContent>
      </Select>
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

  const s = data?.summary;

  const byCur = (data?.rows ?? []).reduce<Record<string, number>>((acc, r) => {
    const c = r.currency ?? 'UYU';
    acc[c] = (acc[c] || 0) + Number(r.total ?? 0);
    return acc;
  }, {});
  const activeCurrencies = Object.keys(byCur).filter((c) => byCur[c] > 0).sort();
  const showMultiCurrency = currency === 'all' && activeCurrencies.length > 1;
  const displayCurrency = currency !== 'all' ? currency : activeCurrencies[0] ?? '';

  const filterParts: string[] = [];
  if (dateRange?.from && dateRange?.to) {
    filterParts.push(`${format(dateRange.from, 'dd/MM/yyyy')} al ${format(dateRange.to, 'dd/MM/yyyy')}`);
  }
  if (status !== 'all') filterParts.push(statusLabel(status));
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
      icon={FileText}
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
            <ReportKPICard title={t('kpi_num')} value={s!.num_presupuestos} />
            <ReportKPICard
              title={showMultiCurrency ? t('kpi_potencial') : `${t('kpi_potencial')}${displayCurrency ? ` (${displayCurrency})` : ''}`}
              value={showMultiCurrency ? activeCurrencies.map((c) => `${fmt(byCur[c] ?? 0)} (${c})`).join(' / ') : fmt(s!.total_potencial)}
              variant="success"
            />
            <ReportKPICard title={t('kpi_dias')} value={`${s!.dias_promedio} días`} />
            <ReportKPICard title={t('kpi_conversion')} value={`${(s!.tasa_conversion * 100).toFixed(1)}%`} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <Card className="lg:col-span-3">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{t('chart_title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="semana" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => fmt(v)} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Legend />
                    <Bar dataKey="borrador"   name="Borrador"   fill="hsl(var(--chart-3))" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="confirmado" name="Confirmado" fill="hsl(var(--chart-2))" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="rechazado"  name="Rechazado"  fill="hsl(var(--chart-1))" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Mayores presupuestos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[...data.rows]
                    .sort((a, b) => Number(b.total) - Number(a.total))
                    .slice(0, 6)
                    .map((r) => (
                      <div key={r.id} className="flex items-center justify-between text-sm gap-2">
                        <span className="truncate max-w-[150px] text-muted-foreground">{r.patient_name}</span>
                        <span className="font-medium tabular-nums shrink-0">{fmt(Number(r.total))} {r.currency}</span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <ReportDataTable columns={columns} data={data.rows} useGlobalFilter />
        </>
      )}
    </ReportShell>
  );
}
