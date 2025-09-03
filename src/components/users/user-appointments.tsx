'use client';

import * as React from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Appointment } from '@/lib/types';
import { appointments as mockAppointments } from '@/lib/data';
import { Badge } from '@/components/ui/badge';

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

async function getAppointmentsForUser(userId: string): Promise<Appointment[]> {
  if (!userId) return [];
  // Simulate API call. In a real app, you'd fetch this.
  return Promise.resolve(mockAppointments);
}

interface UserAppointmentsProps {
  userId: string;
}

export function UserAppointments({ userId }: UserAppointmentsProps) {
  const [appointments, setAppointments] = React.useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    async function loadAppointments() {
      if (!userId) return;
      setIsLoading(true);
      const fetchedAppointments = await getAppointmentsForUser(userId);
      setAppointments(fetchedAppointments);
      setIsLoading(false);
    }
    loadAppointments();
  }, [userId]);

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
