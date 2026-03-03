
'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Skeleton } from '@/components/ui/skeleton';
import { API_ROUTES } from '@/constants/routes';
import { Appointment, User, Service } from '@/lib/types';
import { api } from '@/services/api';
import { ColumnDef } from '@tanstack/react-table';
import { addMonths, format, parseISO } from 'date-fns';
import { useTranslations } from 'next-intl';
import * as React from 'react';

const isWhite = (color: string | null | undefined) => {
  if (!color) return true;
  const n = color.toLowerCase().replace(/\s/g, '');
  return n === '#ffffff' || n === '#fff' || n === 'white' || n === 'rgb(255,255,255)' || n === 'rgba(255,255,255,1)' || n === 'hsl(0,0%,100%)';
};

const getColumns = (t: (key: string) => string, tStatus: (key: string) => string): ColumnDef<Appointment>[] => [
  {
    accessorKey: 'summary',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('service')} />,
  },
  {
    accessorKey: 'doctorName',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('doctor')} />,
  },
  {
    accessorKey: 'date',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('date')} />,
  },
  {
    accessorKey: 'time',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('time')} />,
  },
  {
    accessorKey: 'status',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('status')} />,
    cell: ({ row }) => {
      const status = row.getValue('status') as string;
      const variant = {
        completed: 'success',
        confirmed: 'default',
        pending: 'info',
        cancelled: 'destructive',
        scheduled: 'info',
      }[status.toLowerCase()] ?? ('default' as any);

      return (
        <Badge variant={variant} className="capitalize">
          {tStatus(status.toLowerCase())}
        </Badge>
      );
    },
  },
];

async function getAppointmentsForUser(user: User | null): Promise<Appointment[]> {
  if (!user || !user.email) return [];

  const now = new Date();
  const startDate = addMonths(now, -6);
  const endDate = addMonths(now, 6);
  const formatDateForAPI = (date: Date) => format(date, 'yyyy-MM-dd HH:mm:ss');

  const params = new URLSearchParams({
    startingDateAndTime: formatDateForAPI(startDate),
    endingDateAndTime: formatDateForAPI(endDate),
    patientId: String(user.id),
  });

  try {
    const data = await api.get(API_ROUTES.USERS_APPOINTMENTS, {
      startingDateAndTime: formatDateForAPI(startDate),
      endingDateAndTime: formatDateForAPI(endDate),
      patientId: String(user.id),
    });
    let appointmentsData: any[] = [];

    if (Array.isArray(data) && data.length > 0 && 'json' in data[0]) {
      appointmentsData = data.map(item => item.json);
    } else if (Array.isArray(data)) {
      appointmentsData = data;
    }

    if (!Array.isArray(appointmentsData)) {
      console.error("Fetched data could not be resolved to an array:", data);
      return [];
    }

    const appointments = appointmentsData.map((apiAppt: any) => {
      const startNode = apiAppt.start_time || apiAppt.start;
      const appointmentDateTimeStr = typeof startNode === 'string' ? startNode : (startNode?.dateTime);
      if (!appointmentDateTimeStr) return null;

      const appointmentDateTime = parseISO(appointmentDateTimeStr);
      if (isNaN(appointmentDateTime.getTime())) return null;

      const doctorId = apiAppt.doctor_id || apiAppt.doctorId || apiAppt.doctorid;
      const doctorName = apiAppt.doctor_name || apiAppt.doctorName || apiAppt.doctorname || 'Doctor';

      const endNode = apiAppt.end_time || apiAppt.end;

      const appointment = {
        id: String(apiAppt.appointment_id || apiAppt.appointmentId || apiAppt.appointmentid || apiAppt.id),
        patientId: String(user.id),
        patientName: user.name,
        doctorId: String(doctorId || ''),
        doctorName: doctorName,
        doctorEmail: apiAppt.doctor_email || apiAppt.doctorEmail || apiAppt.doctoremail || '',
        summary: apiAppt.summary || 'Cita',
        description: apiAppt.description || '',
        date: format(appointmentDateTime, 'yyyy-MM-dd'),
        time: format(appointmentDateTime, 'HH:mm'),
        status: apiAppt.status || 'confirmed',
        created_at: apiAppt.created_at || apiAppt.createdat,
        google_calendar_id: apiAppt.google_calendar_id || '',
        googleEventId: apiAppt.google_event_id || apiAppt.googleEventId || apiAppt.googleeventid || apiAppt.id,
        color: (() => {
          const c = (apiAppt.color && ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"].includes(String(apiAppt.color)))
            ? {
              "1": "#a4bdfc", "2": "#7ae7bf", "3": "#dbadff", "4": "#ff887c", "5": "#fbd75b",
              "6": "#ffb878", "7": "#46d6db", "8": "#e1e1e1", "9": "#5484ed", "10": "#51b749", "11": "#dc2127"
            }[String(apiAppt.color)]
            : apiAppt.color;
          return isWhite(c) ? undefined : c;
        })(),
        start: typeof startNode === 'string' ? { dateTime: startNode } : startNode,
        end: typeof endNode === 'string' ? { dateTime: endNode } : endNode,
        services: Array.isArray(apiAppt.services) ? apiAppt.services.map((s: any) => ({
          id: String(s.id),
          name: s.name || '',
          price: Number(s.price || 0),
          category: '',
          duration_minutes: 30,
          is_active: true
        } as Service)) : []
      } as Appointment;
      return appointment;
    }).filter((apt): apt is Appointment => apt !== null);

    return appointments;
  } catch (error) {
    console.error("Failed to fetch appointments:", error);
    return [];
  }
}

interface UserAppointmentsProps {
  user: User;
}

export function UserAppointments({ user }: UserAppointmentsProps) {
  const t = useTranslations('AppointmentsColumns');
  const tStatus = useTranslations('AppointmentStatus');
  const tAppointmentsPage = useTranslations('AppointmentsPage');
  const [appointments, setAppointments] = React.useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const columns = React.useMemo(() => getColumns(t, tStatus), [t, tStatus]);

  const loadAppointments = React.useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    const fetchedAppointments = await getAppointmentsForUser(user);
    setAppointments(fetchedAppointments);
    setIsLoading(false);
  }, [user]);

  React.useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col min-h-0 space-y-2 pt-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  return (
    <DataTable
      columns={columns}
      data={appointments}
      filterColumnId="summary"
      filterPlaceholder={tAppointmentsPage('filterByService')}
      columnTranslations={{
        service_name: t('service'),
        doctorName: t('doctor'),
        date: t('date'),
        time: t('time'),
        status: t('status'),
      }}
    />
  );
}
