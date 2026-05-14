'use client';

import { UserPlus } from 'lucide-react';
import { ReportDataTable } from '@/components/reports/report-data-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DateRangePresets } from '@/components/reports/date-range-presets';
import { ReportKPICard } from '@/components/reports/report-kpi-card';
import { ReportShell } from '@/components/reports/report-shell';
import { API_ROUTES } from '@/constants/routes';
import { api } from '@/services/api';
import type { ReportNuevosPxResponse, ReportNuevosPxRow } from '@/lib/types';
import { formatDate } from '@/lib/utils';
import type { ColumnDef } from '@tanstack/react-table';
import { endOfMonth, format, startOfMonth } from 'date-fns';
import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import type { DateRange } from 'react-day-picker';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const fmt = (n: number) =>
  new Intl.NumberFormat('es-UY', { maximumFractionDigits: 0 }).format(n);

export default function NuevosPacientesPage() {
  const t = useTranslations('ReportNuevosPacientesPage');

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  const [data, setData] = useState<ReportNuevosPxResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = useCallback(async () => {
    if (!dateRange?.from || !dateRange?.to) return;
    setIsLoading(true);
    try {
      const query: Record<string, string> = {
        date_from: format(dateRange.from, 'yyyy-MM-dd'),
        date_to: format(dateRange.to, 'yyyy-MM-dd'),
      };
      const res = await api.get(API_ROUTES.REPORTS.NUEVOS_PACIENTES, query);
      setData(res?.data ?? null);
    } finally {
      setIsLoading(false);
    }
  }, [dateRange]);

  const columns: ColumnDef<ReportNuevosPxRow>[] = [
    { accessorKey: 'name', header: t('col_nombre') },
    { accessorKey: 'email', header: t('col_email') },
    { accessorKey: 'phone_number', header: t('col_telefono') },
    {
      accessorKey: 'registration_date',
      header: t('col_registro'),
      cell: ({ row }) => formatDate(row.original.registration_date),
    },
    {
      accessorKey: 'first_appointment',
      header: t('col_primera_cita'),
      cell: ({ row }) => row.original.first_appointment ? formatDate(row.original.first_appointment) : '—',
    },
    {
      accessorKey: 'total_appointments',
      header: t('col_citas'),
      cell: ({ row }) => Number(row.original.total_appointments),
    },
  ];

  // Group by week — label shows "S1 Ene", "S2 Feb", etc.
  const MONTHS_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const byWeek: Record<string, { key: string; semana: string; nuevos: number }> = {};
  for (const r of data?.rows ?? []) {
    const d = new Date(r.registration_date);
    const weekOfMonth = Math.ceil(d.getDate() / 7);
    const mon = MONTHS_ES[d.getMonth()];
    const yr = d.getFullYear();
    const key = `${yr}-${String(d.getMonth()).padStart(2,'0')}-w${weekOfMonth}`;
    const label = `S${weekOfMonth} ${mon}`;
    if (!byWeek[key]) byWeek[key] = { key, semana: label, nuevos: 0 };
    byWeek[key].nuevos += 1;
  }
  const chartData = Object.entries(byWeek)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v);

  const s = data?.summary;

  const filters = (
    <div className="flex flex-wrap items-center gap-3">
      <DateRangePresets value={dateRange} onChange={setDateRange} />
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
      icon={UserPlus}
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
            <ReportKPICard title={t('kpi_nuevos')} value={s!.num_nuevos} variant="success" />
            <ReportKPICard title={t('kpi_con_cita')} value={s!.con_cita} />
            <ReportKPICard title={t('kpi_sin_cita')} value={s!.sin_cita} variant="warning" />
            <ReportKPICard title={t('kpi_conversion')} value={`${(s!.tasa_conversion * 100).toFixed(1)}%`} />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{t('chart_title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="semana" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="nuevos" name={t('chart_nuevos')} fill="hsl(var(--chart-1))" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2 print:col-span-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{t('recent_title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.rows.slice(0, 8).map((r) => (
                    <div key={r.id} className="flex items-center justify-between text-sm gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{r.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{r.phone_number}</p>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatDate(r.registration_date)}
                      </span>
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
