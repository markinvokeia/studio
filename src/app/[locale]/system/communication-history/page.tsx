
'use client';

import * as React from 'react';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ColumnDef } from '@tanstack/react-table';
import { CommunicationLog } from '@/lib/types';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';


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
        accessorKey: 'subject',
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.subject')} />,
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

const mockLogs: CommunicationLog[] = [
    { id: '1', sent_at: '2024-07-30T10:00:00Z', channel: 'EMAIL', recipient_address: 'juan.perez@example.com', subject: 'Recordatorio de Cita', status: 'DELIVERED', alert_instance_id: '1' },
    { id: '2', sent_at: '2024-07-30T09:00:00Z', channel: 'SMS', recipient_address: '+1234567890', subject: 'Factura Vencida', status: 'SENT', alert_instance_id: '2' },
    { id: '3', sent_at: '2024-07-29T15:00:00Z', channel: 'EMAIL', recipient_address: 'carlos.ruiz@example.com', subject: 'Feliz Cumpleaños!', status: 'FAILED', error_message: 'Invalid email address', alert_instance_id: '3' },
];

export default function CommunicationHistoryPage() {
    const t = useTranslations('CommunicationHistoryPage');
    const [logs, setLogs] = React.useState<CommunicationLog[]>(mockLogs);
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    
    const columns = React.useMemo(() => getColumns(t), [t]);
    
    const onRefresh = () => {
        setIsRefreshing(true);
        setTimeout(() => {
            setLogs([...mockLogs].sort(() => 0.5 - Math.random()));
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
                data={logs}
                filterColumnId="recipient_address" 
                filterPlaceholder={t('filterPlaceholder')}
                onRefresh={onRefresh}
                isRefreshing={isRefreshing}
            />
        </CardContent>
        </Card>
    );
}
