'use client';

import * as React from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { UserLog } from '@/lib/types';
import { userLogs as mockLogs } from '@/lib/data';

const columns: ColumnDef<UserLog>[] = [
  {
    accessorKey: 'timestamp',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Timestamp" />,
    cell: ({ row }) => new Date(row.getValue('timestamp')).toLocaleString(),
  },
  {
    accessorKey: 'action',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Action" />,
  },
  {
    accessorKey: 'details',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Details" />,
  },
];

async function getLogsForUser(userId: string): Promise<UserLog[]> {
  if (!userId) return [];
  // Simulate API call. In a real app, you'd fetch this.
  return Promise.resolve(mockLogs);
}

interface UserLogsProps {
  userId: string;
}

export function UserLogs({ userId }: UserLogsProps) {
  const [logs, setLogs] = React.useState<UserLog[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    async function loadLogs() {
      if (!userId) return;
      setIsLoading(true);
      const fetchedLogs = await getLogsForUser(userId);
      setLogs(fetchedLogs);
      setIsLoading(false);
    }
    loadLogs();
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
          data={logs}
          filterColumnId="action"
          filterPlaceholder="Filter by action..."
        />
      </CardContent>
    </Card>
  );
}
