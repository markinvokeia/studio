'use client';

import { CalendarDays } from 'lucide-react';
import { ReportDataTable } from '@/components/reports/report-data-table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DateRangePresets } from '@/components/reports/date-range-presets';
import { ReportKPICard } from '@/components/reports/report-kpi-card';
import { ReportShell } from '@/components/reports/report-shell';
import { API_ROUTES } from '@/constants/routes';
import { api } from '@/services/api';
import type {
  ReportOcupacionByCalendar,
  ReportOcupacionByDoctor,
  ReportOcupacionByPeriod,
  ReportOcupacionResponse,
  ReportOcupacionRow,
} from '@/lib/types';
import type { ColumnDef } from '@tanstack/react-table';
import { endOfMonth, format, startOfMonth } from 'date-fns';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
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

// ── Status helpers ──────────────────────────────────────────────────────────
const STATUS_LABELS: Record<string, string> = {
  completed:   'Completada',
  confirmed:   'Confirmada',
  scheduled:   'Programada',
  cancelled:   'Cancelada',
  no_show:     'No asistió',
  arrived:     'Llegó',
  in_progress: 'En curso',
  pending:     'Pendiente',
};
const STATUS_COLORS: Record<string, string> = {
  completed:   '#22c55e',  // green-500
  confirmed:   '#3b82f6',  // blue-500
  arrived:     '#06b6d4',  // cyan-500
  in_progress: '#f59e0b',  // amber-500
  scheduled:   '#94a3b8',  // slate-400
  no_show:     '#f97316',  // orange-500
  cancelled:   '#ef4444',  // red-500
  pending:     '#94a3b8',  // slate-400
};
const STATUS_BADGE: Record<string, string> = {
  completed:   'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  confirmed:   'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  scheduled:   'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  cancelled:   'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  no_show:     'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  arrived:     'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
  in_progress: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  pending:     'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
};
const STATUS_TEXT_COLOR: Record<string, string> = {
  completed:   'text-green-700 dark:text-green-400',
  confirmed:   'text-blue-700 dark:text-blue-400',
  scheduled:   'text-slate-600 dark:text-slate-300',
  cancelled:   'text-red-700 dark:text-red-400',
  no_show:     'text-orange-700 dark:text-orange-400',
  arrived:     'text-cyan-700 dark:text-cyan-400',
  in_progress: 'text-yellow-600 dark:text-yellow-400',
  pending:     'text-slate-600 dark:text-slate-300',
};

const ALL_STATUSES = ['completed', 'confirmed', 'scheduled', 'cancelled', 'no_show', 'arrived', 'in_progress'];

const CANCELLATION_REASON_LABELS: Record<string, string> = {
  late:       'Llegó tarde',
  in_time:    'Canceló a tiempo',
  no_notice:  'Sin aviso',
  by_doctor:  'Por el doctor',
  by_clinic:  'Por la clínica',
  other:      'Otro motivo',
  reschedule: 'Reprogramó',
};

interface DoctorOption { id: string; name: string; }
interface CalendarOption { id: number; name: string; }

export default function OcupacionAgendaPage() {
  const t = useTranslations('ReportOcupacionAgendaPage');

  // ── Filter state ──────────────────────────────────────────────────────────
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to:   endOfMonth(new Date()),
  });
  const [doctorId,   setDoctorId]   = useState('all');
  const [status,     setStatus]     = useState('all');
  const [calendarId, setCalendarId] = useState('all');
  const [hasQuote,   setHasQuote]   = useState('all');
  const [hasSession, setHasSession] = useState('all');

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
  const [data,      setData]      = useState<ReportOcupacionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = useCallback(async () => {
    if (!dateRange?.from || !dateRange?.to) return;
    setIsLoading(true);
    try {
      const params: Record<string, string> = {
        date_from: format(dateRange.from, 'yyyy-MM-dd'),
        date_to:   format(dateRange.to,   'yyyy-MM-dd'),
        group_by:  'day',
      };
      if (doctorId   !== 'all') params.doctor_id   = doctorId;
      if (status     !== 'all') params.status       = status;
      if (calendarId !== 'all') params.calendar_id  = calendarId;
      if (hasQuote   !== 'all') params.has_quote    = hasQuote;
      if (hasSession !== 'all') params.has_session  = hasSession;
      const res = await api.get(API_ROUTES.REPORTS.OCUPACION_AGENDA, params);
      setData(res?.data ?? null);
    } finally {
      setIsLoading(false);
    }
  }, [dateRange, doctorId, status, calendarId, hasQuote, hasSession]);

  const s           = data?.summary;
  const rows        = data?.rows        ?? [];
  const byPeriod    = data?.by_period   ?? [];
  const byDoctor    = data?.by_doctor   ?? [];
  const byStatus    = data?.by_status   ?? [];
  const byCalendar  = data?.by_calendar ?? [];

  // ── Description ───────────────────────────────────────────────────────────
  const activeParts: string[] = [];
  if (dateRange?.from && dateRange?.to)
    activeParts.push(`${format(dateRange.from, 'dd/MM/yy')} – ${format(dateRange.to, 'dd/MM/yy')}`);
  if (doctorId   !== 'all') activeParts.push(doctors.find(d => d.id === doctorId)?.name ?? doctorId);
  if (status     !== 'all') activeParts.push(STATUS_LABELS[status] ?? status);
  if (calendarId !== 'all') activeParts.push(calendars.find(c => String(c.id) === calendarId)?.name ?? calendarId);
  if (hasQuote   !== 'all') activeParts.push(hasQuote === 'true' ? t('filter_quote_yes') : t('filter_quote_no'));
  if (hasSession !== 'all') activeParts.push(hasSession === 'true' ? t('filter_session_yes') : t('filter_session_no'));

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
  const columns: ColumnDef<ReportOcupacionRow>[] = [
    {
      accessorKey: 'start_datetime',
      header: t('col_fecha'),
      size: 120,
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
      size: 180,
      cell: ({ row }) => (
        <div className="leading-tight">
          <div className="text-xs font-medium">{row.original.patient_name}</div>
          {row.original.patient_phone && (
            <div className="text-[10px] text-muted-foreground">{row.original.patient_phone}</div>
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
      accessorKey: 'service_name',
      header: t('col_servicio'),
      size: 130,
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">{row.original.service_name ?? '—'}</span>
      ),
    },
    {
      accessorKey: 'calendar_name',
      header: t('col_calendario'),
      size: 110,
      cell: ({ row }) => <span className="text-xs">{row.original.calendar_name}</span>,
    },
    {
      accessorKey: 'status',
      header: t('col_estado'),
      size: 110,
      cell: ({ row }) => {
        const st = row.original.status;
        const reason = row.original.cancellation_reason;
        return (
          <div className="leading-tight">
            <span className={`text-xs font-medium ${STATUS_TEXT_COLOR[st] ?? STATUS_TEXT_COLOR.pending}`}>
              {STATUS_LABELS[st] ?? st}
            </span>
            {st === 'cancelled' && reason && (
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {CANCELLATION_REASON_LABELS[reason] ?? reason}
              </div>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'duration_min',
      header: t('col_duracion'),
      size: 68,
      cell: ({ row }) => <span className="tabular-nums text-xs">{row.original.duration_min} min</span>,
    },
    {
      id: 'has_quote',
      header: t('col_presupuesto'),
      size: 52,
      enableSorting: false,
      cell: ({ row }) => row.original.has_quote
        ? <span className="text-xs font-medium text-green-600 dark:text-green-400">✓</span>
        : <span className="text-xs text-muted-foreground">—</span>,
    },
    {
      id: 'has_session',
      header: t('col_sesion'),
      size: 52,
      enableSorting: false,
      cell: ({ row }) => row.original.has_session
        ? <span className="text-xs font-medium text-blue-600 dark:text-blue-400">✓</span>
        : <span className="text-xs text-muted-foreground">—</span>,
    },
  ];

  // ── Filters UI ────────────────────────────────────────────────────────────
  const filters = (
    <div className="flex flex-wrap items-center gap-2">
      <DateRangePresets value={dateRange} onChange={setDateRange} />

      {/* Doctor */}
      <Select value={doctorId} onValueChange={setDoctorId}>
        <SelectTrigger className="h-8 w-38 text-xs"><SelectValue placeholder={t('filter_doctor')} /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('filter_all_doctors')}</SelectItem>
          {doctors.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
        </SelectContent>
      </Select>

      {/* Estado */}
      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger className="h-8 w-34 text-xs"><SelectValue placeholder={t('filter_status')} /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('filter_all_status')}</SelectItem>
          {ALL_STATUSES.map(s => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
        </SelectContent>
      </Select>

      {/* Calendario */}
      <Select value={calendarId} onValueChange={setCalendarId}>
        <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder={t('filter_calendar')} /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('filter_all_calendars')}</SelectItem>
          {calendars.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
        </SelectContent>
      </Select>

      {/* Con presupuesto */}
      <Select value={hasQuote} onValueChange={setHasQuote}>
        <SelectTrigger className="h-8 w-34 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('filter_quote_all')}</SelectItem>
          <SelectItem value="true">{t('filter_quote_yes')}</SelectItem>
          <SelectItem value="false">{t('filter_quote_no')}</SelectItem>
        </SelectContent>
      </Select>

      {/* Con sesión */}
      <Select value={hasSession} onValueChange={setHasSession}>
        <SelectTrigger className="h-8 w-34 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('filter_session_all')}</SelectItem>
          <SelectItem value="true">{t('filter_session_yes')}</SelectItem>
          <SelectItem value="false">{t('filter_session_no')}</SelectItem>
        </SelectContent>
      </Select>

    </div>
  );

  return (
    <ReportShell
      icon={CalendarDays}
            title={t('title')}
      description={description}
      filters={filters}
      onGenerate={handleGenerate}
      isLoading={isLoading}
      hasData={!!data}
    >
      {data && s && (
        <>
          {/* KPI row 1 */}
          <div className="flex flex-wrap gap-3 print:grid print:grid-cols-4 print:gap-3">
            <ReportKPICard title={t('kpi_total')}       value={s.total_citas} />
            <ReportKPICard title={t('kpi_completadas')} value={`${s.tasa_completadas}%`} subtitle={`${s.completadas} citas`} variant="success" />
            <ReportKPICard title={t('kpi_canceladas')}  value={`${s.tasa_canceladas}%`} subtitle={`${s.canceladas} citas`} variant="danger" />
            <ReportKPICard title={t('kpi_no_shows')}    value={s.no_shows} />
          </div>

          {/* KPI row 2 */}
          <div className="flex flex-wrap gap-3 print:grid print:grid-cols-4 print:gap-3">
            <ReportKPICard title={t('kpi_con_presupuesto')} value={`${s.tasa_con_presupuesto}%`} subtitle={`${s.con_presupuesto} citas`} />
            <ReportKPICard title={t('kpi_con_sesion')}      value={s.con_sesion} />
            <ReportKPICard title={t('kpi_duracion')}        value={`${s.duracion_promedio_min} min`} />
            <ReportKPICard title={t('kpi_sin_atender')}     value={s.sin_atender} variant={s.sin_atender > 0 ? 'warning' : undefined} />
          </div>

          {/* Chart: By period — full width */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{t('chart_periodo')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={byPeriod} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                  <XAxis dataKey="periodo" tick={{ fontSize: 9 }} tickFormatter={v => v.substring(5)} />
                  <YAxis tick={{ fontSize: 9 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="completed"   name={STATUS_LABELS.completed}   stackId="a" fill={STATUS_COLORS.completed} />
                  <Bar dataKey="arrived"     name={STATUS_LABELS.arrived}     stackId="a" fill={STATUS_COLORS.arrived} />
                  <Bar dataKey="in_progress" name={STATUS_LABELS.in_progress} stackId="a" fill={STATUS_COLORS.in_progress} />
                  <Bar dataKey="confirmed"   name={STATUS_LABELS.confirmed}   stackId="a" fill={STATUS_COLORS.confirmed} />
                  <Bar dataKey="scheduled"   name={STATUS_LABELS.scheduled}   stackId="a" fill={STATUS_COLORS.scheduled} />
                  <Bar dataKey="no_show"     name={STATUS_LABELS.no_show}     stackId="a" fill={STATUS_COLORS.no_show} />
                  <Bar dataKey="cancelled"   name={STATUS_LABELS.cancelled}   stackId="a" fill={STATUS_COLORS.cancelled} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Charts: By Doctor + By Status — screen */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 print:hidden">
            <Card className="lg:col-span-3">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{t('chart_doctor')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    data={byDoctor.slice(0, 10)}
                    layout="vertical"
                    margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
                  >
                    <XAxis type="number" tick={{ fontSize: 9 }} />
                    <YAxis type="category" dataKey="doctor_name" tick={{ fontSize: 9 }} width={110} tickFormatter={v => v.split(' ').slice(-2).join(' ')} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="completed"   name={STATUS_LABELS.completed}   stackId="a" fill={STATUS_COLORS.completed} />
                    <Bar dataKey="arrived"     name={STATUS_LABELS.arrived}     stackId="a" fill={STATUS_COLORS.arrived} />
                    <Bar dataKey="in_progress" name={STATUS_LABELS.in_progress} stackId="a" fill={STATUS_COLORS.in_progress} />
                    <Bar dataKey="confirmed"   name={STATUS_LABELS.confirmed}   stackId="a" fill={STATUS_COLORS.confirmed} />
                    <Bar dataKey="scheduled"   name={STATUS_LABELS.scheduled}   stackId="a" fill={STATUS_COLORS.scheduled} />
                    <Bar dataKey="no_show"     name={STATUS_LABELS.no_show}     stackId="a" fill={STATUS_COLORS.no_show} />
                    <Bar dataKey="cancelled"   name={STATUS_LABELS.cancelled}   stackId="a" fill={STATUS_COLORS.cancelled} radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{t('chart_estado')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={byStatus}
                      dataKey="count"
                      nameKey="status"
                      cx="50%"
                      cy="44%"
                      innerRadius={48}
                      outerRadius={80}
                    >
                      {byStatus.map((entry, i) => (
                        <Cell key={i} fill={STATUS_COLORS[entry.status] ?? STATUS_COLORS.pending} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number, name: string) => [`${v} (${byStatus.find(r => r.status === name)?.pct ?? 0}%)`, STATUS_LABELS[name] ?? name]} />
                    <Legend
                      verticalAlign="bottom"
                      iconSize={9}
                      wrapperStyle={{ fontSize: 10 }}
                      formatter={(name: string) => {
                        const entry = byStatus.find(r => r.status === name);
                        return `${STATUS_LABELS[name] ?? name} ${entry?.pct ?? 0}%`;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Charts: By Doctor + By Status — print, side by side with fixed widths */}
          <div className="hidden print:grid print:grid-cols-2 print:gap-3">
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-medium">{t('chart_doctor')}</CardTitle>
              </CardHeader>
              <CardContent className="p-2">
                <BarChart
                  width={360} height={220}
                  data={byDoctor.slice(0, 8)}
                  layout="vertical"
                  margin={{ top: 4, right: 8, left: 4, bottom: 4 }}
                >
                  <XAxis type="number" tick={{ fontSize: 8 }} />
                  <YAxis type="category" dataKey="doctor_name" tick={{ fontSize: 8 }} width={90} tickFormatter={v => v.split(' ').slice(-2).join(' ')} />
                  <Legend wrapperStyle={{ fontSize: 9 }} />
                  <Bar dataKey="completed"   name={STATUS_LABELS.completed}   stackId="a" fill={STATUS_COLORS.completed} />
                  <Bar dataKey="arrived"     name={STATUS_LABELS.arrived}     stackId="a" fill={STATUS_COLORS.arrived} />
                  <Bar dataKey="in_progress" name={STATUS_LABELS.in_progress} stackId="a" fill={STATUS_COLORS.in_progress} />
                  <Bar dataKey="confirmed"   name={STATUS_LABELS.confirmed}   stackId="a" fill={STATUS_COLORS.confirmed} />
                  <Bar dataKey="scheduled"   name={STATUS_LABELS.scheduled}   stackId="a" fill={STATUS_COLORS.scheduled} />
                  <Bar dataKey="no_show"     name={STATUS_LABELS.no_show}     stackId="a" fill={STATUS_COLORS.no_show} />
                  <Bar dataKey="cancelled"   name={STATUS_LABELS.cancelled}   stackId="a" fill={STATUS_COLORS.cancelled} radius={[0, 2, 2, 0]} />
                </BarChart>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-medium">{t('chart_estado')}</CardTitle>
              </CardHeader>
              <CardContent className="p-2">
                <PieChart width={360} height={220}>
                  <Pie
                    data={byStatus}
                    dataKey="count"
                    nameKey="status"
                    cx="38%"
                    cy="50%"
                    innerRadius={44}
                    outerRadius={76}
                  >
                    {byStatus.map((entry, i) => (
                      <Cell key={i} fill={STATUS_COLORS[entry.status] ?? STATUS_COLORS.pending} />
                    ))}
                  </Pie>
                  <Legend
                    layout="vertical"
                    verticalAlign="middle"
                    align="right"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 9 }}
                    formatter={(name: string) => {
                      const entry = byStatus.find(r => r.status === name);
                      return `${STATUS_LABELS[name] ?? name} ${entry?.pct ?? 0}%`;
                    }}
                  />
                </PieChart>
              </CardContent>
            </Card>
          </div>

          {/* Chart: By Calendar */}
          {byCalendar.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{t('chart_calendario')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={Math.max(160, byCalendar.length * 44)}>
                  <BarChart
                    data={byCalendar}
                    layout="vertical"
                    margin={{ top: 4, right: 40, left: 4, bottom: 4 }}
                  >
                    <XAxis type="number" tick={{ fontSize: 9 }} />
                    <YAxis type="category" dataKey="calendar_name" tick={{ fontSize: 10 }} width={140} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="completed"   name={STATUS_LABELS.completed}   stackId="a" fill={STATUS_COLORS.completed} />
                    <Bar dataKey="arrived"     name={STATUS_LABELS.arrived}     stackId="a" fill={STATUS_COLORS.arrived} />
                    <Bar dataKey="in_progress" name={STATUS_LABELS.in_progress} stackId="a" fill={STATUS_COLORS.in_progress} />
                    <Bar dataKey="confirmed"   name={STATUS_LABELS.confirmed}   stackId="a" fill={STATUS_COLORS.confirmed} />
                    <Bar dataKey="scheduled"   name={STATUS_LABELS.scheduled}   stackId="a" fill={STATUS_COLORS.scheduled} />
                    <Bar dataKey="no_show"     name={STATUS_LABELS.no_show}     stackId="a" fill={STATUS_COLORS.no_show} />
                    <Bar dataKey="cancelled"   name={STATUS_LABELS.cancelled}   stackId="a" fill={STATUS_COLORS.cancelled} radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Detail table */}
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
