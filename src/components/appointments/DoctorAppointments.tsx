'use client';

import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Skeleton } from '@/components/ui/skeleton';
import { API_ROUTES } from '@/constants/routes';
import { Appointment, Calendar as CalendarType } from '@/lib/types';
import { api } from '@/services/api';
import { ColumnDef } from '@tanstack/react-table';
import { addMonths, format, parseISO } from 'date-fns';
import { useTranslations } from 'next-intl';
import * as React from 'react';

const GOOGLE_CALENDAR_COLORS: Record<string, string> = {
  '1': '#a4bdfc', '2': '#7ae7bf', '3': '#dbadff', '4': '#ff887c', '5': '#fbd75b',
  '6': '#ffb878', '7': '#46d6db', '8': '#e1e1e1', '9': '#5484ed', '10': '#51b749', '11': '#dc2127',
};

async function getCalendars(): Promise<CalendarType[]> {
  try {
    const data = await api.get(API_ROUTES.CALENDARS);
    const arr = Array.isArray(data) ? data : (data.calendars || data.data || data.result || []);
    return arr.map((c: any, i: number) => ({
      id: c.id || c.google_calendar_id,
      name: c.name,
      google_calendar_id: c.google_calendar_id,
      is_active: c.is_active,
      color: c.color || `hsl(${(i * 50) % 360}, 70%, 50%)`,
    }));
  } catch {
    return [];
  }
}

async function getAppointmentsForDoctor(
  doctorId: string,
  calendarGoogleIds: string[],
): Promise<Appointment[]> {
  const now = new Date();
  const startDate = addMonths(now, -6);
  const endDate = addMonths(now, 6);
  const fmt = (d: Date) => format(d, 'yyyy-MM-dd HH:mm:ss');

  try {
    const query: Record<string, string> = {
      startingDateAndTime: fmt(startDate),
      endingDateAndTime: fmt(endDate),
      doctor_id: doctorId,
    };
    if (calendarGoogleIds.length > 0) query.calendar_ids = calendarGoogleIds.join(',');

    const data = await api.get(API_ROUTES.USERS_APPOINTMENTS, query);
    let raw: any[] = [];
    if (Array.isArray(data) && data.length > 0 && 'json' in data[0]) {
      raw = data.map((item: any) => item.json);
    } else if (Array.isArray(data)) {
      raw = data;
    }

    return raw.map((a: any): Appointment | null => {
      const startNode = a.start_time || a.start;
      const startStr = typeof startNode === 'string' ? startNode : startNode?.dateTime;
      if (!startStr) return null;
      const dt = parseISO(startStr.replace(/Z$/, ''));
      if (isNaN(dt.getTime())) return null;

      const endNode = a.end_time || a.end;
      const colorRaw = String(a.color || '');
      const colorHex = GOOGLE_CALENDAR_COLORS[colorRaw] || a.color || undefined;

      return {
        id: String(a.appointment_id || a.appointmentId || a.id || ''),
        patientId: String(a.patient_id || a.patientId || a.patientid || ''),
        patientName: a.patient_name || a.patientName || a.patientname || '',
        doctorId: doctorId,
        doctorName: a.doctor_name || a.doctorName || '',
        doctorEmail: a.doctor_email || a.doctorEmail || '',
        summary: a.summary || '',
        service_name: a.summary || '',
        description: a.description || '',
        notes: a.notes || '',
        date: format(dt, 'yyyy-MM-dd'),
        time: format(dt, 'HH:mm'),
        status: a.status || 'confirmed',
        created_at: a.created_at,
        google_calendar_id: a.google_calendar_id || '',
        googleEventId: a.google_event_id || a.googleEventId || a.id,
        calendar_id: a.google_calendar_id || '',
        calendar_name: a.calendar_name || '',
        color: colorHex,
        colorId: colorRaw,
        start: typeof startNode === 'string' ? { dateTime: startNode } : startNode,
        end: typeof endNode === 'string' ? { dateTime: endNode } : endNode,
        services: Array.isArray(a.services)
          ? a.services.map((s: any) => ({ id: String(s.id), name: s.name || '', price: Number(s.price || 0), category: '', duration_minutes: 30, is_active: true }))
          : [],
        quote_id: a.quote_id || a.quoteId || undefined,
        quote_doc_no: a.quote_doc_no || a.quoteDocNo || undefined,
      } as Appointment;
    }).filter((a): a is Appointment => a !== null);
  } catch {
    return [];
  }
}

interface DoctorAppointmentsProps {
  doctorId: string;
  refreshTrigger?: number;
}

export function DoctorAppointments({ doctorId, refreshTrigger }: DoctorAppointmentsProps) {
  const t = useTranslations('AppointmentsColumns');
  const tStatus = useTranslations('AppointmentStatus');
  const tPage = useTranslations('AppointmentsPage');

  const [appointments, setAppointments] = React.useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const columns = React.useMemo<ColumnDef<Appointment>[]>(() => [
    {
      accessorKey: 'date',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('date')} />,
      cell: ({ row }) => {
        const val = row.original.date;
        if (!val) return <span className="text-muted-foreground">—</span>;
        try { return <span>{format(parseISO(val), 'dd/MM/yyyy')}</span>; }
        catch { return <span>{val}</span>; }
      },
    },
    {
      accessorKey: 'time',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('time')} />,
    },
    {
      accessorKey: 'patientName',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('patient')} />,
    },
    {
      accessorKey: 'summary',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('service')} />,
    },
    {
      accessorKey: 'status',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('status')} />,
      cell: ({ row }) => {
        const status = (row.getValue('status') as string).toLowerCase();
        const variant = ({ completed: 'success', confirmed: 'default', pending: 'info', cancelled: 'destructive', scheduled: 'info' } as any)[status] || 'default';
        return <Badge variant={variant} className="capitalize">{tStatus(status)}</Badge>;
      },
    },
  ], [t, tStatus]);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    // doctor_id is the primary filter; calendar_ids is optional for scoping
    const [cals, appts] = await Promise.all([getCalendars(), getAppointmentsForDoctor(doctorId, [])]);
    const ids = cals.map(c => c.google_calendar_id).filter((id): id is string => !!id);
    setAppointments(ids.length > 0 ? appts.filter(a => !a.google_calendar_id || ids.includes(a.google_calendar_id)) : appts);
    setIsLoading(false);
  }, [doctorId]);

  React.useEffect(() => { load(); }, [load]);
  React.useEffect(() => { if (refreshTrigger && refreshTrigger > 0) load(); }, [refreshTrigger, load]);

  if (isLoading) {
    return (
      <div className="space-y-2 pt-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <DataTable
      columns={columns}
      data={appointments}
      filterColumnId="patientName"
      filterPlaceholder={tPage('filterByService')}
      columnTranslations={{
        date: t('date'),
        time: t('time'),
        patientName: t('patient'),
        summary: t('service'),
        status: t('status'),
      }}
    />
  );
}
