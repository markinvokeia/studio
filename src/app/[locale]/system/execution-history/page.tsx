
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

const mockRuns: AlertScheduleRun[] = [
    { id: '1', run_date: '2024-07-30T06:00:00Z', started_at: '2024-07-30T06:00:00Z', completed_at: '2024-07-30T06:02:15Z', status: 'COMPLETED', alerts_created: 5, emails_sent: 2, errors_count: 0 },
    { id: '2', run_date: '2024-07-29T06:00:00Z', started_at: '2024-07-29T06:00:00Z', completed_at: '2024-07-29T06:05:30Z', status: 'FAILED', alerts_created: 2, emails_sent: 0, errors_count: 1, error_details: { 'rule_id': 'INV_OVERDUE', 'error': 'Connection timed out' } },
    { id: '3', run_date: '2024-07-28T06:00:00Z', started_at: '2024-07-28T06:00:00Z', completed_at: '2024-07-28T06:01:45Z', status: 'COMPLETED', alerts_created: 8, emails_sent: 5, errors_count: 0 },
];

export default function ExecutionHistoryPage() {
  const t = useTranslations('ExecutionHistoryPage');
  const [runs, setRuns] = React.useState<AlertScheduleRun[]>(mockRuns);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  
  const columns = React.useMemo(() => getColumns(t), [t]);

  const onRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
        setRuns([...mockRuns].sort(() => 0.5 - Math.random()));
        setIsRefreshing(false);
    }, 1000);
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
        />
      </CardContent>
    </Card>
  );
}
