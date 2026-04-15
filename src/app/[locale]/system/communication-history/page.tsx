
'use client';

import * as React from 'react';
import { DataCard } from '@/components/ui/data-card';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ColumnDef } from '@tanstack/react-table';
import { CommunicationLog, AlertAction } from '@/lib/types';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { api } from '@/services/api';
import { Mails, FileText } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const mapAlertActionToCommunicationLog = (action: AlertAction): CommunicationLog => {
  const channel = action.action_type === 'SEND_EMAIL' ? 'EMAIL' : action.action_type as any;
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
    notes: action.notes,
  };
};

interface NotesDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    notes: string | undefined;
    title: string;
}

function NotesDialog({ open, onOpenChange, notes, title }: NotesDialogProps) {
    const t = useTranslations('CommunicationHistoryPage');
    
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent maxWidth="md">
                <DialogHeader>
                    <DialogTitle>{t('notesTitle')}</DialogTitle>
                    <DialogDescription>{title}</DialogDescription>
                </DialogHeader>
                <div className="mt-4 px-6 pb-6">
                    {notes ? (
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{notes}</p>
                    ) : (
                        <p className="text-sm text-muted-foreground italic">{t('noNotes')}</p>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

const getColumns = (
    t: (key: string) => string,
    onViewNotes: (notes: string | undefined, title: string) => void
): ColumnDef<CommunicationLog>[] => [
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
    },
    {
        id: 'actions',
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.actions')} />,
        cell: ({ row }) => (
            <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={() => onViewNotes(row.original.notes, row.original.title || '')}
            >
                <FileText className="h-4 w-4 mr-1" />
                {t('viewNotes')}
            </Button>
        ),
    }
];

export default function CommunicationHistoryPage() {
    const t = useTranslations('CommunicationHistoryPage');
    const isNarrow = useViewportNarrow();
    const [logs, setLogs] = React.useState<CommunicationLog[]>([]);
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 50 });
    const [notesDialog, setNotesDialog] = React.useState({ open: false, notes: '', title: '' });

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

    const handleViewNotes = (notes: string | undefined, title: string) => {
        setNotesDialog({ open: true, notes: notes || '', title });
    };

    const columns = React.useMemo(() => getColumns(t, handleViewNotes), [t]);

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
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <Card className="flex-1 flex flex-col min-h-0 overflow-hidden shadow-sm border-0">
                <CardHeader className="flex-none p-4">
                    <div className="flex items-start gap-3">
                        <div className="header-icon-circle mt-0.5">
                            <Mails className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col text-left">
                            <CardTitle className="text-lg">{t('title')}</CardTitle>
                            <CardDescription className="text-xs">{t('description')}</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden p-6 bg-card">
                    <DataTable
                        columns={columns}
                        data={logs}
                        filterColumnId="recipient_address"
                        filterPlaceholder={t('filterPlaceholder')}
                        onRefresh={onRefresh}
                        isRefreshing={isRefreshing}
                        isNarrow={isNarrow}
                        renderCard={(row: CommunicationLog) => (
                            <DataCard
                                title={row.title || row.recipient_address}
                                subtitle={row.recipient_address}
                                badge={<span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${row.status === 'SENT' || row.status === 'DELIVERED' ? 'bg-green-100 text-green-700' : row.status === 'FAILED' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'}`}>{row.status}</span>}
                                showArrow
                            />
                        )}
                        pagination={pagination}
                        onPaginationChange={onPaginationChange}
                        manualPagination
                    />
                </CardContent>
            </Card>
            <NotesDialog
                open={notesDialog.open}
                onOpenChange={(open) => setNotesDialog((prev) => ({ ...prev, open }))}
                notes={notesDialog.notes}
                title={notesDialog.title}
            />
        </div>
    );
}
