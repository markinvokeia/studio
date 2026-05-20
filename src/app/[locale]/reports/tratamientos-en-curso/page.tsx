'use client';

import { ReportDataTable } from '@/components/reports/report-data-table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DateRangePresets } from '@/components/reports/date-range-presets';
import { ReportKPICard } from '@/components/reports/report-kpi-card';
import { ReportShell } from '@/components/reports/report-shell';
import { API_ROUTES } from '@/constants/routes';
import { api } from '@/services/api';
import type { ReportTratamientosCursoResponse, ReportTratamientosCursoRow } from '@/lib/types';
import { formatDate, cn } from '@/lib/utils';
import type { ColumnDef } from '@tanstack/react-table';
import { endOfMonth, format, startOfMonth } from 'date-fns';
import { ClipboardList, AlertTriangle, Info } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
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

const STATUS_COLOR: Record<string, string> = {
  active:    'text-green-600',
  completed: 'text-blue-600',
  cancelled: 'text-red-600',
  paused:    'text-amber-500',
  pending:   'text-muted-foreground',
};

const PIE_COLORS = [
  'hsl(var(--chart-2))',
  'hsl(var(--chart-5))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-1))',
];

const STEP_COLORS = [
  'hsl(var(--chart-2))', // done
  'hsl(var(--chart-4))', // pending
  'hsl(var(--chart-1))', // waiting
  'hsl(var(--chart-3))', // alert
];

const STEP_STATUS_COLOR: Record<string, string> = {
  done:    'text-green-600',
  pending: 'text-red-500',
  waiting: 'text-blue-500',
  alert:   'text-amber-500',
};

const STEP_STATUS_DOT: Record<string, string> = {
  done:    'bg-green-500',
  pending: 'bg-red-500',
  waiting: 'bg-blue-500',
  alert:   'bg-amber-500',
};

export default function TratamientosEnCursoPage() {
  const t = useTranslations('ReportTratamientosCursoPage');

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [status, setStatus]         = useState('all');
  const [stepStatus, setStepStatus] = useState('all');

  const [data, setData]         = useState<ReportTratamientosCursoResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const statusLabel = (v: string) =>
    v === 'active'    ? t('status_active') :
    v === 'completed' ? t('status_completed') :
    v === 'cancelled' ? t('status_cancelled') :
    v === 'paused'    ? t('status_paused') :
    v === 'pending'   ? t('status_pending') : v;

  const stepLabel = (v: string) =>
    v === 'done'    ? t('step_done') :
    v === 'pending' ? t('step_pending') :
    v === 'waiting' ? t('step_waiting') :
    v === 'alert'   ? t('step_alert') : v;

  const handleGenerate = useCallback(async () => {
    if (!dateRange?.from || !dateRange?.to) return;
    setIsLoading(true);
    try {
      const query: Record<string, string> = {
        date_from:   format(dateRange.from, 'yyyy-MM-dd'),
        date_to:     format(dateRange.to,   'yyyy-MM-dd'),
        status,
        step_status: stepStatus,
      };
      const res = await api.get(API_ROUTES.REPORTS.TRATAMIENTOS_CURSO, query);
      setData(res?.data ?? null);
    } finally {
      setIsLoading(false);
    }
  }, [dateRange, status, stepStatus]);

  const rows = data?.rows ?? [];
  const s    = data?.summary;

  // Chart: status distribution
  const statusChartData = [
    { name: t('status_active'),    value: s?.en_curso    ?? 0 },
    { name: t('status_completed'), value: s?.completados ?? 0 },
  ].filter(d => d.value > 0);

  // Chart: top services
  const serviceMap = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.service_name] = (acc[r.service_name] || 0) + 1;
    return acc;
  }, {});
  const chartServiceData = Object.entries(serviceMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }));

  // Chart: step status distribution
  const totalDone    = rows.reduce((sum, r) => sum + r.done_steps,    0);
  const totalPending = rows.reduce((sum, r) => sum + r.pending_steps, 0);
  const totalWaiting = rows.reduce((sum, r) => sum + r.waiting_steps, 0);
  const totalAlert   = rows.reduce((sum, r) => sum + r.alert_steps,   0);
  const stepDistData = [
    { name: t('step_done'),    value: totalDone },
    { name: t('step_pending'), value: totalPending },
    { name: t('step_waiting'), value: totalWaiting },
    { name: t('step_alert'),   value: totalAlert },
  ];

  // Chart: by category
  const categoryMap = rows.reduce<Record<string, number>>((acc, r) => {
    const cat = r.category || 'Sin categoría';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});
  const chartCategoryData = Object.entries(categoryMap)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));

  const columns: ColumnDef<ReportTratamientosCursoRow>[] = [
    { accessorKey: 'patient_name', header: t('col_paciente') },
    { accessorKey: 'phone_number', header: t('col_telefono'), size: 120 },
    { accessorKey: 'service_name', header: t('col_servicio') },
    { accessorKey: 'category',     header: t('col_categoria'), size: 130 },
    { accessorKey: 'doctor_name',  header: t('col_doctor') },
    {
      accessorKey: 'started_at',
      header: t('col_inicio'),
      size: 100,
      cell: ({ row }) => row.original.started_at ? formatDate(row.original.started_at) : '—',
    },
    {
      id: 'avance',
      enableSorting: false,
      header: t('col_avance'),
      size: 190,
      cell: ({ row }) => {
        const total    = row.original.total_steps;
        const done     = row.original.done_steps;
        const hasAlert = row.original.alert_steps > 0;
        const pct      = total ? Math.round((done / total) * 100) : 0;
        const steps    = row.original.steps_detail ?? [];
        const matchingSteps = stepStatus !== 'all'
          ? steps.filter(st => st.milestone_status === stepStatus)
          : [];
        return (
          <div className="min-w-[150px]">
            {/* Row 1: progress bar + count + alert + info popover */}
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-chart-1 rounded-full" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs tabular-nums shrink-0">{done}/{total}</span>
              {hasAlert && <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />}
              {steps.length > 0 && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="print:hidden shrink-0 text-muted-foreground hover:text-foreground transition-colors" aria-label="Ver pasos">
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-3" align="end">
                    <p className="text-xs font-semibold mb-2 text-foreground">Detalle de pasos</p>
                    <div className="space-y-1">
                      {steps.map(st => (
                        <div key={st.step_position} className="flex items-center gap-2 text-xs">
                          <span className="text-muted-foreground shrink-0 tabular-nums w-10">Paso {st.step_position}</span>
                          <span className="flex-1 truncate">{st.step_name}</span>
                          <span className={cn('shrink-0 font-medium', STEP_STATUS_COLOR[st.milestone_status] ?? 'text-muted-foreground')}>
                            {stepLabel(st.milestone_status)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>

            {/* Matching steps (screen only) — dot + step name */}
            {matchingSteps.length > 0 && (
              <div className="print:hidden mt-1 space-y-0.5">
                {matchingSteps.map(st => (
                  <div key={st.step_position} className="flex items-center gap-1.5 text-xs text-muted-foreground leading-tight">
                    <span className={cn('inline-block w-2 h-2 rounded-full shrink-0', STEP_STATUS_DOT[st.milestone_status] ?? 'bg-muted-foreground')} />
                    Paso {st.step_position}: {st.step_name}
                  </div>
                ))}
              </div>
            )}

            {/* All steps (print only) — dot + step name */}
            {steps.length > 0 && (
              <div className="hidden print:block mt-0.5 space-y-0.5">
                {steps.map(st => (
                  <div key={st.step_position} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className={cn('inline-block w-2 h-2 rounded-full shrink-0', STEP_STATUS_DOT[st.milestone_status] ?? 'bg-muted-foreground')} />
                    Paso {st.step_position}: {st.step_name}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'status',
      header: t('col_estado'),
      size: 110,
      cell: ({ row }) => (
        <span className={cn('font-medium', STATUS_COLOR[row.original.status] ?? '')}>
          {statusLabel(row.original.status)}
        </span>
      ),
    },
    {
      accessorKey: 'days_active',
      header: t('col_dias_activo'),
      size: 100,
      cell: ({ row }) => {
        const d = row.original.days_active;
        return d != null
          ? <span className="tabular-nums">{d}d</span>
          : <span className="text-muted-foreground">—</span>;
      },
    },
    {
      accessorKey: 'days_since_last_step',
      header: t('col_ultima_actividad'),
      size: 120,
      cell: ({ row }) => {
        const d = row.original.days_since_last_step;
        if (d == null) return <span className="text-muted-foreground">—</span>;
        return (
          <span className={cn('tabular-nums',
            d > 30 ? 'text-red-600' : d > 14 ? 'text-amber-500' : ''
          )}>
            {d}d
          </span>
        );
      },
    },
  ];

  const filters = (
    <div className="flex flex-wrap items-center gap-3">
      <DateRangePresets value={dateRange} onChange={setDateRange} />
      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger className="h-8 w-40 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('filter_all_estados')}</SelectItem>
          <SelectItem value="active">{t('status_active')}</SelectItem>
          <SelectItem value="completed">{t('status_completed')}</SelectItem>
        </SelectContent>
      </Select>
      <Select value={stepStatus} onValueChange={setStepStatus}>
        <SelectTrigger className="h-8 w-44 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('filter_all_pasos')}</SelectItem>
          <SelectItem value="done">{t('step_done')}</SelectItem>
          <SelectItem value="pending">{t('step_pending')}</SelectItem>
          <SelectItem value="waiting">{t('step_waiting')}</SelectItem>
          <SelectItem value="alert">{t('step_alert')}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  const filterParts: string[] = [];
  if (dateRange?.from && dateRange?.to) {
    filterParts.push(`${format(dateRange.from, 'dd/MM/yyyy')} al ${format(dateRange.to, 'dd/MM/yyyy')}`);
  }
  if (status !== 'all')     filterParts.push(statusLabel(status));
  if (stepStatus !== 'all') filterParts.push(`pasos: ${stepLabel(stepStatus)}`);
  const description = filterParts.length > 0 ? (
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
      icon={ClipboardList}
            title={t('title')}
      description={description}
      filters={filters}
      onGenerate={handleGenerate}
      isLoading={isLoading}
      hasData={!!data}
    >
      {data && s && (
        <>
          {/* Tratamiento KPIs */}
          <div className="flex flex-wrap gap-3 print:grid print:grid-cols-4 print:gap-3">
            <ReportKPICard title={t('kpi_total')}       value={s!.total} />
            <ReportKPICard title={t('kpi_en_curso')}    value={s!.en_curso}    variant="success" />
            <ReportKPICard title={t('kpi_completados')} value={s!.completados} />
            <ReportKPICard title={t('kpi_tasa')}        value={`${(s!.tasa_completado * 100).toFixed(1)}%`} />
          </div>

          {/* Paso KPIs */}
          <div className="flex flex-wrap gap-3 print:grid print:grid-cols-4 print:gap-3">
            <ReportKPICard title={`Pasos ${t('kpi_steps_done')}`}    value={s!.steps_done} />
            <ReportKPICard title={`Pasos ${t('kpi_steps_pending')}`} value={s!.steps_pending} variant="danger" />
            <ReportKPICard title={`Pasos ${t('kpi_steps_waiting')}`} value={s!.steps_waiting} />
            <ReportKPICard title={`Pasos ${t('kpi_steps_alert')}`}   value={s!.steps_alert}   variant="warning" />
          </div>

          {/* Screen: step bar (3/5) + status donut (2/5) */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 print:block">
            <Card className="lg:col-span-3">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{t('chart_pasos_title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={stepDistData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" name="Pasos" radius={[3, 3, 0, 0]}>
                      {stepDistData.map((_, i) => (
                        <Cell key={i} fill={STEP_COLORS[i % STEP_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className="lg:col-span-2 print:hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{t('chart_estado_title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={statusChartData} dataKey="value" nameKey="name" cx="50%" cy="42%" innerRadius={42} outerRadius={65}>
                      {statusChartData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Screen: top services (3/5) + category (2/5) */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 print:block">
            <Card className="lg:col-span-3">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{t('chart_servicios_title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={chartServiceData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-muted" />
                    <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={140} />
                    <Tooltip />
                    <Bar dataKey="count" name="Tratamientos" fill="hsl(var(--chart-1))" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className="lg:col-span-2 print:hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{t('chart_categoria_title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={chartCategoryData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-muted" />
                    <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={110} />
                    <Tooltip />
                    <Bar dataKey="count" name="Tratamientos" fill="hsl(var(--chart-2))" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Print only: status donut + category side by side */}
          <div className="hidden print:grid print:grid-cols-2 print:gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{t('chart_estado_title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <PieChart width={280} height={200}>
                  <Pie data={statusChartData} dataKey="value" nameKey="name" cx="50%" cy="40%" innerRadius={38} outerRadius={62}>
                    {statusChartData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" iconSize={10} wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{t('chart_categoria_title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <BarChart data={chartCategoryData} layout="vertical" width={280} height={200} margin={{ top: 5, right: 10, left: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 9 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={100} />
                  <Tooltip />
                  <Bar dataKey="count" name="Tratamientos" fill="hsl(var(--chart-2))" radius={[0, 3, 3, 0]} />
                </BarChart>
              </CardContent>
            </Card>
          </div>

          <ReportDataTable columns={columns} data={data.rows} useGlobalFilter filterPlaceholder="Buscar..." />
        </>
      )}
    </ReportShell>
  );
}
