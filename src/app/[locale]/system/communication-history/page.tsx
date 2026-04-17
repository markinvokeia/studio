
'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DataCard } from '@/components/ui/data-card';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Separator } from '@/components/ui/separator';
import { TwoPanelLayout } from '@/components/layout/two-panel-layout';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';
import { CommunicationLog, AlertAction } from '@/lib/types';
import { api } from '@/services/api';
import { ColumnDef, PaginationState, RowSelectionState } from '@tanstack/react-table';
import { format } from 'date-fns';
import { Mails } from 'lucide-react';
import { useTranslations } from 'next-intl';

const mapAlertActionToCommunicationLog = (action: AlertAction): CommunicationLog => {
  const channel = action.action_type === 'SEND_EMAIL' ? 'EMAIL' : action.action_type as any;
  const recipient = action.action_data?.patient?.email || action.action_data?.clinic?.email || '';
  const status = action.result_status === 'SUCCESS' ? 'SENT' : action.result_status === 'FAILED' ? 'FAILED' : 'QUEUED';
  return {
    id: action.id.toString(),
    alert_instance_id: action.alert_instance_id.toString(),
    channel,
    recipient_address: recipient,
    title: action.title || '',
    summary: action.summary || '',
    status,
    sent_at: action.performed_at,
    error_message: action.result_status === 'FAILED' ? action.result_message : undefined,
    notes: action.notes,
  };
};

export default function CommunicationHistoryPage() {
    const t = useTranslations('CommunicationHistoryPage');
    const isNarrow = useViewportNarrow();
    const [logs, setLogs] = React.useState<CommunicationLog[]>([]);
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize: 50 });
    const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
    const [selectedLog, setSelectedLog] = React.useState<CommunicationLog | null>(null);

    const fetchLogs = async (page: number, limit: number) => {
        try {
            const response = await api.get('/system/alert-actions', { page: page.toString(), limit: limit.toString() });
            const mappedLogs = response.map(mapAlertActionToCommunicationLog);
            setLogs(mappedLogs);
        } catch (error) {
            console.error('Failed to fetch communication logs:', error);
        }
    };

    React.useEffect(() => { fetchLogs(1, 50); }, []);

    const handleRowSelection = (rows: CommunicationLog[]) => {
        setSelectedLog(rows[0] ?? null);
    };

    const handleBack = () => {
        setSelectedLog(null);
        setRowSelection({});
    };

    const onPaginationChange: React.Dispatch<React.SetStateAction<typeof pagination>> = (updater) => {
        const newPagination = typeof updater === 'function' ? updater(pagination) : updater;
        setPagination(newPagination);
        fetchLogs(newPagination.pageIndex + 1, newPagination.pageSize);
    };

    const onRefresh = async () => {
        setIsRefreshing(true);
        try {
            await fetchLogs(pagination.pageIndex + 1, pagination.pageSize);
        } finally {
            setIsRefreshing(false);
        }
    };

    const columns: ColumnDef<CommunicationLog>[] = React.useMemo(() => [
        {
            accessorKey: 'sent_at',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.sentAt')} />,
            cell: ({ row }) => row.original.sent_at ? format(new Date(row.original.sent_at), 'yyyy-MM-dd HH:mm') : '-',
        },
        {
            accessorKey: 'channel',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.channel')} />,
            cell: ({ row }) => <Badge variant="secondary">{row.original.channel}</Badge>,
        },
        { accessorKey: 'recipient_address', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.recipient')} /> },
        { accessorKey: 'title', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.title')} /> },
        {
            accessorKey: 'status',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.status')} />,
            cell: ({ row }) => {
                const status = row.original.status.toLowerCase();
                const variant: 'success' | 'destructive' | 'secondary' = status === 'sent' || status === 'delivered' ? 'success' : status === 'failed' || status === 'bounced' ? 'destructive' : 'secondary';
                return <Badge variant={variant} className="capitalize">{status}</Badge>;
            },
        },
        { accessorKey: 'alert_instance_id', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.alertId')} /> },
    ], [t]);

    const leftPanel = (
        <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm">
            <CardHeader className="flex-none p-4">
                <div className="flex items-start gap-3">
                    <div className="header-icon-circle mt-0.5"><Mails className="h-5 w-5" /></div>
                    <div>
                        <CardTitle className="text-lg">{t('title')}</CardTitle>
                        <CardDescription className="text-xs">{t('description')}</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden p-4 bg-card">
                <DataTable
                    columns={columns}
                    data={logs}
                    filterColumnId="recipient_address"
                    filterPlaceholder={t('filterPlaceholder')}
                    onRefresh={onRefresh}
                    isRefreshing={isRefreshing}
                    isNarrow={isNarrow || !!selectedLog}
                    renderCard={(row: CommunicationLog, _isSelected: boolean) => (
                        <DataCard isSelected={_isSelected}
                            title={row.title || row.recipient_address}
                            subtitle={row.recipient_address}
                            badge={<span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${row.status === 'SENT' || row.status === 'DELIVERED' ? 'bg-green-100 text-green-700' : row.status === 'FAILED' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'}`}>{row.status}</span>}
                            showArrow
                        />
                    )}
                    pagination={pagination}
                    onPaginationChange={onPaginationChange}
                    manualPagination
                    enableSingleRowSelection
                    rowSelection={rowSelection}
                    setRowSelection={setRowSelection}
                    onRowSelectionChange={handleRowSelection}
                />
            </CardContent>
        </Card>
    );

    const rightPanel = selectedLog ? (
        <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm">
            <CardHeader className="flex-none p-4 pb-2 space-y-0">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="header-icon-circle flex-none"><Mails className="h-5 w-5" /></div>
                    <div className="min-w-0 flex-1">
                        <CardTitle className="text-base lg:text-lg truncate">{selectedLog.title || selectedLog.recipient_address}</CardTitle>
                        <p className="text-xs text-muted-foreground truncate">{selectedLog.channel} · {selectedLog.sent_at ? format(new Date(selectedLog.sent_at), 'yyyy-MM-dd HH:mm') : ''}</p>
                    </div>
                    {(() => {
                        const status = selectedLog.status.toLowerCase();
                        const variant: 'success' | 'destructive' | 'secondary' = status === 'sent' || status === 'delivered' ? 'success' : status === 'failed' || status === 'bounced' ? 'destructive' : 'secondary';
                        return <Badge variant={variant} className="flex-none capitalize">{status}</Badge>;
                    })()}
                </div>
            </CardHeader>
            <Separator />
            <CardContent className="flex-1 overflow-auto p-4">
                <dl className="space-y-3 text-sm">
                    <div>
                        <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">{t('columns.sentAt')}</dt>
                        <dd className="text-foreground">{selectedLog.sent_at ? format(new Date(selectedLog.sent_at), 'yyyy-MM-dd HH:mm') : '-'}</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">{t('columns.channel')}</dt>
                        <dd><Badge variant="secondary">{selectedLog.channel}</Badge></dd>
                    </div>
                    <div>
                        <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">{t('columns.recipient')}</dt>
                        <dd className="text-foreground">{selectedLog.recipient_address || '-'}</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">{t('columns.title')}</dt>
                        <dd className="text-foreground">{selectedLog.title || '-'}</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">{t('columns.alertId')}</dt>
                        <dd className="text-foreground">{selectedLog.alert_instance_id || '-'}</dd>
                    </div>
                    {selectedLog.summary && (
                        <div>
                            <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">Resumen</dt>
                            <dd className="text-foreground text-xs">{selectedLog.summary}</dd>
                        </div>
                    )}
                    {selectedLog.error_message && (
                        <div>
                            <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Error</dt>
                            <dd><pre className="text-xs whitespace-pre-wrap break-all bg-red-50 text-red-700 rounded p-2">{selectedLog.error_message}</pre></dd>
                        </div>
                    )}
                    {selectedLog.notes && (
                        <div>
                            <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">{t('notesTitle')}</dt>
                            <dd><pre className="text-xs whitespace-pre-wrap break-all bg-muted/50 rounded p-2 max-h-48 overflow-auto">{selectedLog.notes}</pre></dd>
                        </div>
                    )}
                </dl>
            </CardContent>
        </Card>
    ) : <div />;

    return (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <TwoPanelLayout
                leftPanel={leftPanel}
                rightPanel={rightPanel}
                isRightPanelOpen={!!selectedLog}
                onBack={handleBack}
                leftPanelDefaultSize={50}
                rightPanelDefaultSize={50}
            />
        </div>
    );
}
