'use client';

import { CalendarX } from 'lucide-react';
import { ReportDataTable } from '@/components/reports/report-data-table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DateRangePresets } from '@/components/reports/date-range-presets';
import { ReportKPICard } from '@/components/reports/report-kpi-card';
import { ReportShell } from '@/components/reports/report-shell';
import { API_ROUTES } from '@/constants/routes';
import { api } from '@/services/api';
import type {
  ReportCancelacionesByReason,
  ReportCancelacionesResponse,
  ReportCancelacionesRow,
} from '@/lib/types';
import type { ColumnDef } from '@tanstack/react-table';
import { endOfMonth, format, startOfMonth } from 'date-fns';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import type { DateRange } from 'react-day-picker';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

// ── Reason helpers ───────────────────────────────────────────────────────────
const REASON_LABELS: Record<string, string> = {
  late:       'Llegó tarde',
  in_time:    'Canceló a tiempo',
  no_notice:  'Sin aviso',
  by_doctor:  'Por el doctor',
  by_clinic:  'Por la clínica',
  other:      'Otro motivo',
  reschedule: 'Reprogramó',
};
const REASON_COLORS: Record<string, string> = {
  late:       '#f59e0b',  // amber
  in_time:    '#06b6d4',  // cyan
  no_notice:  '#ef4444',  // red
  by_doctor:  '#3b82f6',  // blue
  by_clinic:  '#8b5cf6',  // violet
  other:      '#94a3b8',  // slate
  reschedule: '#22c55e',  // green
};
const ALL_REASONS = ['late', 'in_time', 'no_notice', 'by_doctor', 'by_clinic', 'other', 'reschedule'];

interface DoctorOption   { id: string; name: string; }
interface CalendarOption { id: number; name: string; }

export default function CancelacionesPage() {
  const t = useTranslations('ReportCancelacionesPage');

  // ── Filters ───────────────────────────────────────────────────────────────
  const [dateRange,  setDateRange]  = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to:   endOfMonth(new Date()),
  });
  const [doctorId,   setDoctorId]   = useState('all');
  const [calendarId, setCalendarId] = useState('all');
  const [reason,     setReason]     = useState('all');

  // ── Option lists ──────────────────────────────────────────────────────────
  const [doctors,   setDoctors]   = useState<DoctorOption[]>([]);
  const [calendars, setCalendars] = useState<CalendarOption[]>([]);

  useEffect(() => {
    api.get(API_ROUTES.USERS_DOCTORS).then((d: any) => {
      const list = Array.isArray(d) ? d : (d?.data ?? d?.users ?? []);
      setDoctors(list.map((u: any) => ({ id: u.id, name: u.name })));
    }).catch(() => {});
    api.get(API_ROUTES.CALENDARS).then((d: any) => {
      const list = Array.isArray(d) ? d : (d?.calendars ?? d?.data ?? []);
      setCalendars(list.map((c: any) => ({ id: c.id, name: c.name })));
    }).catch(() => {});
  }, []);

  // ── Data ──────────────────────────────────────────────────────────────────
  const [data,      setData]      = useState<ReportCancelacionesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = useCallback(async () => {
    if (!dateRange?.from || !dateRange?.to) return;
    setIsLoading(true);
    try {
      const params: Record<string, string> = {
        date_from: format(dateRange.from, 'yyyy-MM-dd'),
        date_to:   format(dateRange.to,   'yyyy-MM-dd'),
      };
      if (doctorId   !== 'all') params.doctor_id   = doctorId;
      if (calendarId !== 'all') params.calendar_id  = calendarId;
      if (reason     !== 'all') params.reason        = reason;
      const res = await api.get(API_ROUTES.REPORTS.CANCELACIONES, params);
      setData(res?.data ?? null);
    } finally {
      setIsLoading(false);
    }
  }, [dateRange, doctorId, calendarId, reason]);

  const s          = data?.summary;
  const byReason   = data?.by_reason   ?? [];
  const byDoctor   = data?.by_doctor   ?? [];
  const byPatient  = data?.by_patient  ?? [];
  const byService  = data?.by_service  ?? [];
  const byCalendar = data?.by_calendar ?? [];
  const byPeriod   = data?.by_period   ?? [];
  const rows       = data?.rows        ?? [];

  // ── Description ───────────────────────────────────────────────────────────
  const activeParts: string[] = [];
  if (dateRange?.from && dateRange?.to)
    activeParts.push(`${format(dateRange.from, 'dd/MM/yy')} – ${format(dateRange.to, 'dd/MM/yy')}`);
  if (doctorId   !== 'all') activeParts.push(doctors.find(d => d.id === doctorId)?.name ?? doctorId);
  if (calendarId !== 'all') activeParts.push(calendars.find(c => String(c.id) === calendarId)?.name ?? calendarId);
  if (reason     !== 'all') activeParts.push(REASON_LABELS[reason] ?? reason);

  const description = (
    <span>
      {t('description')}
      {activeParts.length > 0 && (
        <> · {activeParts.map((p, i) => (
          <span key={i}>{i > 0 && ' · '}<strong>{p}</strong></span>
        ))}</>
      )}
    </span>
  );

  // ── Columns ───────────────────────────────────────────────────────────────
  const columns: ColumnDef<ReportCancelacionesRow>[] = [
    {
      accessorKey: 'start_datetime',
      header: t('col_fecha'),
      size: 100,
      cell: ({ row }) => {
        const dt = new Date(row.original.start_datetime);
        return (
          <div className="leading-tight">
            <div className="tabular-nums text-xs">{format(dt, 'dd/MM/yyyy')}</div>
            <div className="tabular-nums text-[10px] text-muted-foreground">{format(dt, 'HH:mm')}</div>
          </div>
        );
      },
    },
    {
      accessorKey: 'patient_name',
      header: t('col_paciente'),
      size: 160,
      cell: ({ row }) => (
        <div className="leading-tight">
          <div className="text-xs font-medium">{row.original.patient_name}</div>
          {row.original.phone_number && (
            <div className="text-[10px] text-muted-foreground">{row.original.phone_number}</div>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'doctor_name',
      header: t('col_doctor'),
      size: 130,
      cell: ({ row }) => <span className="text-xs">{row.original.doctor_name}</span>,
    },
    {
      accessorKey: 'calendar_name',
      header: t('col_calendario'),
      size: 110,
      cell: ({ row }) => <span className="text-xs">{row.original.calendar_name}</span>,
    },
    {
      accessorKey: 'service_name',
      header: t('col_servicio'),
      size: 120,
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">{row.original.service_name ?? '—'}</span>
      ),
    },
    {
      accessorKey: 'cancellation_reason',
      header: t('col_motivo'),
      size: 120,
      cell: ({ row }) => {
        const r = row.original.cancellation_reason;
        const label = r ? (REASON_LABELS[r] ?? r) : '—';
        const color = r ? (REASON_COLORS[r] ?? '#94a3b8') : '#94a3b8';
        return (
          <span className="text-xs font-medium" style={{ color }}>
            {label}
          </span>
        );
      },
    },
  ];

  // ── Filters UI ────────────────────────────────────────────────────────────
  const filters = (
    <div className="flex flex-wrap items-center gap-2">
      <DateRangePresets value={dateRange} onChange={setDateRange} />

      <Select value={doctorId} onValueChange={setDoctorId}>
        <SelectTrigger className="h-8 w-38 text-xs"><SelectValue placeholder={t('filter_doctor')} /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('filter_all_doctors')}</SelectItem>
          {doctors.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={calendarId} onValueChange={setCalendarId}>
        <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder={t('filter_calendar')} /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('filter_all_calendars')}</SelectItem>
          {calendars.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={reason} onValueChange={setReason}>
        <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder={t('filter_reason')} /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('filter_all_reasons')}</SelectItem>
          {ALL_REASONS.map(r => <SelectItem key={r} value={r}>{REASON_LABELS[r]}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <ReportShell
      icon={CalendarX}
            title={t('title')}
      description={description}
      filters={filters}
      onGenerate={handleGenerate}
      isLoading={isLoading}
      hasData={!!data}
    >
      {data && s && (
        <>
          {/* KPIs */}
          <div className="flex flex-wrap gap-3 print:grid print:grid-cols-4 print:gap-3">
            <ReportKPICard title={t('kpi_total')}       value={s.total}               variant="danger" />
            <ReportKPICard title={t('kpi_top_reason')}  value={s.top_reason_label || '—'} />
            <ReportKPICard title={t('kpi_top_doctor')}  value={s.top_doctor  || '—'} />
            <ReportKPICard title={t('kpi_top_patient')} value={s.top_patient || '—'} />
          </div>

          {/* Evolución temporal — full width */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{t('chart_periodo')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={byPeriod} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="periodo" tick={{ fontSize: 9 }} tickFormatter={v => v.substring(5)} />
                  <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Line
                    type="monotone"
                    dataKey="count"
                    name={t('chart_cancelaciones')}
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Row: Por Motivo (pie) + Por Doctor (bar) */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 print:grid print:grid-cols-5 print:gap-3">
            <Card className="lg:col-span-2 print:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{t('chart_reason')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={byReason}
                      dataKey="count"
                      nameKey="label"
                      cx="50%"
                      cy="42%"
                      innerRadius={50}
                      outerRadius={84}
                    >
                      {byReason.map((entry: ReportCancelacionesByReason, i: number) => (
                        <Cell key={i} fill={REASON_COLORS[entry.reason] ?? '#94a3b8'} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number, name: string) => {
                        const entry = byReason.find(r => r.label === name);
                        return [`${v} (${entry?.pct ?? 0}%)`, name];
                      }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      iconSize={9}
                      wrapperStyle={{ fontSize: 10 }}
                      formatter={(name: string) => {
                        const entry = byReason.find(r => r.label === name);
                        return `${name} ${entry?.pct ?? 0}%`;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="lg:col-span-3 print:col-span-3">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{t('chart_doctor')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    data={byDoctor.slice(0, 8)}
                    layout="vertical"
                    margin={{ top: 4, right: 48, left: 4, bottom: 4 }}
                  >
                    <XAxis type="number" tick={{ fontSize: 9 }} allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="doctor_name"
                      tick={{ fontSize: 9 }}
                      width={110}
                      tickFormatter={v => v.split(' ').slice(-2).join(' ')}
                    />
                    <Tooltip formatter={(v: number) => [v, t('chart_cancelaciones')]} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="count" name={t('chart_cancelaciones')} radius={[0, 4, 4, 0]}>
                      {byDoctor.slice(0, 8).map((_: unknown, i: number) => (
                        <Cell key={i} fill={`hsl(0 ${70 - i * 5}% ${46 + i * 4}%)`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Row: Por Servicio + Por Paciente */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 print:grid print:grid-cols-2 print:gap-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{t('chart_service')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer
                  width="100%"
                  height={Math.max(160, Math.min(byService.length, 8) * 34 + 20)}
                >
                  <BarChart
                    data={byService.slice(0, 8)}
                    layout="vertical"
                    margin={{ top: 4, right: 48, left: 4, bottom: 4 }}
                  >
                    <XAxis type="number" tick={{ fontSize: 9 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="service_name" tick={{ fontSize: 9 }} width={120} />
                    <Tooltip formatter={(v: number) => [v, t('chart_cancelaciones')]} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="count" name={t('chart_cancelaciones')} fill="#f59e0b" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{t('chart_patient')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer
                  width="100%"
                  height={Math.max(160, Math.min(byPatient.length, 8) * 34 + 20)}
                >
                  <BarChart
                    data={byPatient.slice(0, 8)}
                    layout="vertical"
                    margin={{ top: 4, right: 48, left: 4, bottom: 4 }}
                  >
                    <XAxis type="number" tick={{ fontSize: 9 }} allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="patient_name"
                      tick={{ fontSize: 9 }}
                      width={120}
                      tickFormatter={v => v.split(' ').slice(0, 2).join(' ')}
                    />
                    <Tooltip formatter={(v: number) => [v, t('chart_cancelaciones')]} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="count" name={t('chart_cancelaciones')} fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Por Consultorio — solo si hay más de uno */}
          {byCalendar.length > 1 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{t('chart_calendar')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={Math.max(120, byCalendar.length * 44)}>
                  <BarChart
                    data={byCalendar}
                    layout="vertical"
                    margin={{ top: 4, right: 48, left: 4, bottom: 4 }}
                  >
                    <XAxis type="number" tick={{ fontSize: 9 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="calendar_name" tick={{ fontSize: 10 }} width={140} />
                    <Tooltip formatter={(v: number) => [v, t('chart_cancelaciones')]} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="count" name={t('chart_cancelaciones')} fill="#06b6d4" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Detalle */}
          <ReportDataTable
            columns={columns}
            data={rows}
            useGlobalFilter
            filterPlaceholder={t('search_placeholder')}
          />
        </>
      )}
    </ReportShell>
  );
}
