
'use client';

import { Card, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Skeleton } from '@/components/ui/skeleton';
import { API_ROUTES } from '@/constants/routes';
import { UserLog } from '@/lib/types';
import { api } from '@/services/api';
import { ColumnDef } from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import * as React from 'react';

const getColumns = (t: (key: string) => string): ColumnDef<UserLog>[] => [
  {
    accessorKey: 'timestamp',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.timestamp')} />,
    cell: ({ row }) => new Date(row.getValue('timestamp')).toLocaleString(),
  },
  {
    accessorKey: 'action',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.action')} />,
  },
  {
    accessorKey: 'details',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.details')} />,
  },
];

async function getLogsForUser(userId: string): Promise<UserLog[]> {
  if (!userId) return [];
  try {
    const data = await api.get(API_ROUTES.USER_LOGS, { user_id: userId });
    const logsData = Array.isArray(data) ? data : (data.user_logs || data.data || data.result || []);

    return logsData.map((apiLog: any) => ({
      id: apiLog.id ? String(apiLog.id) : `log_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: apiLog.timestamp,
      action: apiLog.action,
      details: apiLog.details,
    }));
  } catch (error) {
    console.error("Failed to fetch user logs:", error);
    return [];
  }
}

interface UserLogsProps {
  userId: string;
}

export function UserLogs({ userId }: UserLogsProps) {
  const t = useTranslations('UserLogsPage');
  const [logs, setLogs] = React.useState<UserLog[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const columns = React.useMemo(() => getColumns(t), [t]);

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
          filterPlaceholder={t('filterPlaceholder')}
          columnTranslations={{
            timestamp: t('columns.timestamp'),
            action: t('columns.action'),
            details: t('columns.details'),
          }}
        />
      </CardContent>
    </Card>
  );
}
