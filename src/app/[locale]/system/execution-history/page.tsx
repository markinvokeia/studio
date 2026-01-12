
'use client';

import * as React from 'react';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ColumnDef } from '@tanstack/react-table';
import { AlertScheduleRun } from '@/lib/types';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { api } from '@/services/api';

const getColumns = (t: (key: string) => string): ColumnDef<AlertScheduleRun>[] => [
    {
        accessorKey: 'run_date',
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.runDate')} />,
        cell: ({ row }) => format(new Date(row.original.run_date), 'yyyy-MM-dd HH:mm'),
    },
    {
        accessorKey: 'status',
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.status')} />,
        cell: ({ row }) => {
            const status = row.original.status.toLowerCase();
            const variant: 'success' | 'destructive' | 'secondary' = status === 'completed' ? 'success' : status === 'failed' ? 'destructive' : 'secondary';
            return <Badge variant={variant} className="capitalize">{status}</Badge>;
        }
    },
    {
        accessorKey: 'alerts_created',
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.alertsCreated')} />,
    },
    {
        accessorKey: 'emails_sent',
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.emailsSent')} />,
    },
    {
        accessorKey: 'errors_count',
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.errorsCount')} />,
    },
    {
        accessorKey: 'duration',
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.duration')} />,
        cell: ({ row }) => {
            if (!row.original.completed_at) return 'N/A';
            const duration = new Date(row.original.completed_at).getTime() - new Date(row.original.started_at).getTime();
            return `${(duration / 1000).toFixed(2)}s`;
        }
    }
];

export default function ExecutionHistoryPage() {
  const t = useTranslations('ExecutionHistoryPage');
  const [runs, setRuns] = React.useState<AlertScheduleRun[]>([]);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 10 });
  
  const fetchRuns = async (page: number, limit: number) => {
    try {
      const response = await api.get('/system/alert-execution-history', { page: page.toString(), limit: limit.toString() });
      setRuns(response);
    } catch (error) {
      console.error('Failed to fetch execution history:', error);
    }
  };

  React.useEffect(() => {
    fetchRuns(1, 10);
  }, []);

  const columns = React.useMemo(() => getColumns(t), [t]);

  const onPaginationChange: React.Dispatch<React.SetStateAction<typeof pagination>> = (updater) => {
    const newPagination = typeof updater === 'function' ? updater(pagination) : updater;
    setPagination(newPagination);
    fetchRuns(newPagination.pageIndex + 1, newPagination.pageSize);
  };

  const onRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchRuns(pagination.pageIndex + 1, pagination.pageSize);
    } catch (error) {
      console.error('Failed to refresh execution history:', error);
    } finally {
      setIsRefreshing(false);
    }
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable
            columns={columns}
            data={runs}
            filterColumnId="status"
            filterPlaceholder={t('filterPlaceholder')}
            onRefresh={onRefresh}
            isRefreshing={isRefreshing}
            pagination={pagination}
            onPaginationChange={onPaginationChange}
            manualPagination
        />
      </CardContent>
    </Card>
  );
}
