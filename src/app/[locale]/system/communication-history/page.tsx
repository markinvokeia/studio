
'use client';

import * as React from 'react';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ColumnDef } from '@tanstack/react-table';
import { CommunicationLog, AlertAction } from '@/lib/types';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { api } from '@/services/api';

const mapAlertActionToCommunicationLog = (action: AlertAction): CommunicationLog => {
  const channel = action.action_type === 'SEND_EMAIL' ? 'EMAIL' : action.action_type as any; // map others if needed
  const recipient = action.action_data?.patient?.email || action.action_data?.clinic?.email || '';
  const title = action.title || '';
  const summary = action.summary || '';
  const status = action.result_status === 'SUCCESS' ? 'SENT' : action.result_status === 'FAILED' ? 'FAILED' : 'QUEUED';
  const error_message = action.result_status === 'FAILED' ? action.result_message : undefined;

  return {
    id: action.id.toString(),
    alert_instance_id: action.alert_instance_id.toString(),
    channel,
    recipient_address: recipient,
    title,
    summary,
    status,
    sent_at: action.performed_at,
    error_message,
  };
};

const getColumns = (t: (key: string) => string): ColumnDef<CommunicationLog>[] => [
    {
        accessorKey: 'sent_at',
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.sentAt')} />,
        cell: ({ row }) => format(new Date(row.original.sent_at!), 'yyyy-MM-dd HH:mm'),
    },
    {
        accessorKey: 'channel',
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.channel')} />,
        cell: ({ row }) => <Badge variant="secondary">{row.original.channel}</Badge>
    },
    {
        accessorKey: 'recipient_address',
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.recipient')} />,
    },
    {
        accessorKey: 'title',
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.title')} />,
    },
    {
        accessorKey: 'status',
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.status')} />,
        cell: ({ row }) => {
            const status = row.original.status.toLowerCase();
            const variant: 'success' | 'destructive' | 'outline' | 'secondary' = status === 'sent' || status === 'delivered' ? 'success' : status === 'failed' || status === 'bounced' ? 'destructive' : 'secondary';
            return <Badge variant={variant} className="capitalize">{status}</Badge>;
        }
    },
    {
        accessorKey: 'alert_instance_id',
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.alertId')} />,
    }
];

export default function CommunicationHistoryPage() {
    const t = useTranslations('CommunicationHistoryPage');
    const [logs, setLogs] = React.useState<CommunicationLog[]>([]);
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 50 });

    const fetchLogs = async (page: number, limit: number) => {
        try {
            const response = await api.get('/system/alert-actions', { page: page.toString(), limit: limit.toString() });
            const mappedLogs = response.map(mapAlertActionToCommunicationLog);
            setLogs(mappedLogs);
        } catch (error) {
            console.error('Failed to fetch communication logs:', error);
        }
    };

    React.useEffect(() => {
        fetchLogs(1, 50);
    }, []);

    const columns = React.useMemo(() => getColumns(t), [t]);

    const onPaginationChange: React.Dispatch<React.SetStateAction<typeof pagination>> = (updater) => {
        const newPagination = typeof updater === 'function' ? updater(pagination) : updater;
        setPagination(newPagination);
        fetchLogs(newPagination.pageIndex + 1, newPagination.pageSize);
    };

    const onRefresh = async () => {
        setIsRefreshing(true);
        try {
            await fetchLogs(pagination.pageIndex + 1, pagination.pageSize);
        } catch (error) {
            console.error('Failed to refresh communication logs:', error);
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
                data={logs}
                filterColumnId="recipient_address"
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
