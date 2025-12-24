
'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Skeleton } from '@/components/ui/skeleton';
import { API_ROUTES } from '@/constants/routes';
import { Appointment, User } from '@/lib/types';
import { api } from '@/services/api';
import { ColumnDef } from '@tanstack/react-table';
import { addMonths, format, parseISO } from 'date-fns';
import { useTranslations } from 'next-intl';
import * as React from 'react';

const getColumns = (t: (key: string) => string, tStatus: (key: string) => string): ColumnDef<Appointment>[] => [
  {
    accessorKey: 'service_name',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('service')} />,
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
    attendeesEmails: user.email,
  });

  try {
    const data = await api.get(API_ROUTES.USERS_APPOINTMENTS, {
      startingDateAndTime: formatDateForAPI(startDate),
      endingDateAndTime: formatDateForAPI(endDate),
      attendeesEmails: user.email,
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
      const appointmentDateTimeStr = apiAppt.start_time || (apiAppt.start && apiAppt.start.dateTime);
      if (!appointmentDateTimeStr) return null;

      const appointmentDateTime = parseISO(appointmentDateTimeStr);
      if (isNaN(appointmentDateTime.getTime())) return null;

      return {
        id: apiAppt.id ? String(apiAppt.id) : `appt_${Math.random().toString(36).substr(2, 9)}`,
        patientName: user.name,
        service_name: apiAppt.summary || 'No Service Name',
        date: format(appointmentDateTime, 'yyyy-MM-dd'),
        time: format(appointmentDateTime, 'HH:mm'),
        status: apiAppt.status || 'confirmed',
        patientPhone: apiAppt.patientPhone,
        doctorName: apiAppt.doctorName,
        calendar_id: apiAppt.organizer?.email,
        calendar_name: apiAppt.organizer?.displayName || apiAppt.organizer?.email || '',
      };
    }).filter(apt => apt !== null) as Appointment[];

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
      <div className="space-y-2 pt-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="p-4">
        <DataTable
          columns={columns}
          data={appointments}
          filterColumnId="service_name"
          filterPlaceholder={tAppointmentsPage('filterByService')}
        />
      </CardContent>
    </Card>
  );
}
