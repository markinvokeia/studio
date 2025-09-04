'use client';

import * as React from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Appointment, User } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { format, addMonths } from 'date-fns';

const columns: ColumnDef<Appointment>[] = [
  {
    accessorKey: 'service_name',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Service" />,
  },
  {
    accessorKey: 'date',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
  },
  {
    accessorKey: 'time',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Time" />,
  },
  {
    accessorKey: 'status',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
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
          {status}
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
        const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/users_appointments?${params.toString()}`, {
            method: 'GET',
            mode: 'cors',
            headers: {
                'Accept': 'application/json',
            },
            cache: 'no-store',
        });

        if (!response.ok) {
            console.error(`HTTP error! status: ${response.status}`);
            return [];
        }

        const data = await response.json();
        const appointmentsData = Array.isArray(data) ? data : (data.appointments || data.data || data.result || []);

        return appointmentsData.map((apiAppt: any) => {
            const appointmentDateTime = new Date(apiAppt.start_time);
            return {
                id: apiAppt.id ? String(apiAppt.id) : `appt_${Math.random().toString(36).substr(2, 9)}`,
                service_name: apiAppt.summary || 'No Service Name',
                date: format(appointmentDateTime, 'yyyy-MM-dd'),
                time: format(appointmentDateTime, 'hh:mm a'),
                status: apiAppt.status || 'confirmed',
            };
        });
    } catch (error) {
        console.error("Failed to fetch appointments:", error);
        return [];
    }
}

interface UserAppointmentsProps {
  user: User;
}

export function UserAppointments({ user }: UserAppointmentsProps) {
  const [appointments, setAppointments] = React.useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    async function loadAppointments() {
      if (!user) return;
      setIsLoading(true);
      const fetchedAppointments = await getAppointmentsForUser(user);
      setAppointments(fetchedAppointments);
      setIsLoading(false);
    }
    loadAppointments();
  }, [user]);

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
          filterPlaceholder="Filter by service..."
        />
      </CardContent>
    </Card>
  );
}
