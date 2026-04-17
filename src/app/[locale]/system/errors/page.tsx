
'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataCard } from '@/components/ui/data-card';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Separator } from '@/components/ui/separator';
import { TwoPanelLayout } from '@/components/layout/two-panel-layout';
import { SYSTEM_PERMISSIONS } from '@/constants/permissions';
import { API_ROUTES } from '@/constants/routes';
import { usePermissions } from '@/hooks/usePermissions';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';
import { ErrorLog } from '@/lib/types';
import api from '@/services/api';
import { ColumnDef, PaginationState, RowSelectionState, VisibilityState } from '@tanstack/react-table';
import { FileWarning } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

type GetErrorLogsResponse = {
    errorLogs: ErrorLog[];
    total: number;
};

async function getErrorLogs(pagination: PaginationState): Promise<GetErrorLogsResponse> {
    try {
        const responseData = await api.get(API_ROUTES.SYSTEM.ERROR_LOGS, {
            page: (pagination.pageIndex + 1).toString(),
            limit: pagination.pageSize.toString(),
        });
        const data = Array.isArray(responseData) && responseData.length > 0 ? responseData[0] : responseData;
        const logsData = Array.isArray(data.data) ? data.data : (data.error_logs || data.data || data.result || []);
        const total = data.total || (Array.isArray(data) ? data.length : 0);
        const mappedLogs = logsData.map((apiLog: any) => ({
            id: apiLog.id ? String(apiLog.id) : `err_${Math.random().toString(36).substr(2, 9)}`,
            created_at: apiLog.created_at,
            severity: apiLog.severity,
            message: apiLog.error_message,
            user_id: apiLog.user_id,
            channel: apiLog.channel,
        }));
        return { errorLogs: mappedLogs, total };
    } catch (error) {
        console.error("Failed to fetch error logs:", error);
        return { errorLogs: [], total: 0 };
    }
}

function getSeverityVariant(severity: string | undefined): 'destructive' | 'secondary' | 'outline' {
    if (!severity) return 'outline';
    const s = severity.toUpperCase();
    if (s === 'CRITICAL' || s === 'ERROR') return 'destructive';
    if (s === 'WARNING') return 'secondary';
    return 'outline';
}

export default function ErrorLogPage() {
    const t = useTranslations('ErrorLogPage');
    const { hasPermission } = usePermissions();
    const canViewList = hasPermission(SYSTEM_PERMISSIONS.ERROR_LOG_VIEW_LIST);
    const isNarrow = useViewportNarrow();

    const [data, setData] = React.useState<ErrorLog[]>([]);
    const [logCount, setLogCount] = React.useState(0);
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({ id: false });
    const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
    const [selectedLog, setSelectedLog] = React.useState<ErrorLog | null>(null);

    const columns: ColumnDef<ErrorLog>[] = React.useMemo(() => [
        { accessorKey: 'id', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.id')} />, enableHiding: true },
        { accessorKey: 'created_at', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.createdAt')} /> },
        {
            accessorKey: 'severity',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.severity')} />,
            cell: ({ row }) => row.original.severity ? (
                <Badge variant={getSeverityVariant(row.original.severity)}>{row.original.severity}</Badge>
            ) : null,
        },
        { accessorKey: 'message', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.message')} /> },
        { accessorKey: 'channel', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.channel')} /> },
        { accessorKey: 'user_id', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.userId')} /> },
    ], [t]);

    const loadLogs = React.useCallback(async () => {
        setIsRefreshing(true);
        const { errorLogs, total } = await getErrorLogs(pagination);
        setData(errorLogs);
        setLogCount(total);
        setIsRefreshing(false);
    }, [pagination]);

    React.useEffect(() => { loadLogs(); }, [loadLogs]);

    const handleRowSelection = (rows: ErrorLog[]) => {
        setSelectedLog(rows[0] ?? null);
    };

    const handleBack = () => {
        setSelectedLog(null);
        setRowSelection({});
    };

    const leftPanel = (
        <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm">
            <CardHeader className="flex-none p-4">
                <div className="flex items-start gap-3">
                    <div className="header-icon-circle mt-0.5"><FileWarning className="h-5 w-5" /></div>
                    <div>
                        <CardTitle className="text-lg">{t('title')}</CardTitle>
                        <CardDescription className="text-xs">{t('description')}</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden p-4 bg-card">
                {canViewList ? (
                    <DataTable
                        columns={columns}
                        data={data}
                        filterColumnId="message"
                        filterPlaceholder={t('filterPlaceholder')}
                        onRefresh={loadLogs}
                        isRefreshing={isRefreshing}
                        isNarrow={isNarrow || !!selectedLog}
                        renderCard={(row: ErrorLog, _isSelected: boolean) => (
                            <DataCard isSelected={_isSelected}
                                title={row.message || ''}
                                subtitle={row.channel || ''}
                                badge={row.severity ? <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-red-100 text-red-700">{row.severity}</span> : undefined}
                                showArrow
                            />
                        )}
                        pageCount={Math.ceil(logCount / pagination.pageSize)}
                        pagination={pagination}
                        onPaginationChange={setPagination}
                        manualPagination={true}
                        columnVisibility={columnVisibility}
                        onColumnVisibilityChange={setColumnVisibility}
                        enableSingleRowSelection
                        rowSelection={rowSelection}
                        setRowSelection={setRowSelection}
                        onRowSelectionChange={handleRowSelection}
                    />
                ) : (
                    <div className="flex items-center justify-center h-full">
                        <p className="text-muted-foreground">{t('noAccess')}</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );

    const rightPanel = selectedLog ? (
        <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm">
            <CardHeader className="flex-none p-4 pb-2 space-y-0">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="header-icon-circle flex-none"><FileWarning className="h-5 w-5" /></div>
                    <div className="min-w-0 flex-1">
                        <CardTitle className="text-base lg:text-lg truncate">{selectedLog.severity || t('columns.severity')}</CardTitle>
                        <p className="text-xs text-muted-foreground truncate">{selectedLog.created_at}</p>
                    </div>
                    {selectedLog.severity && (
                        <Badge className="flex-none" variant={getSeverityVariant(selectedLog.severity)}>{selectedLog.severity}</Badge>
                    )}
                </div>
            </CardHeader>
            <Separator />
            <CardContent className="flex-1 overflow-auto p-4">
                <dl className="space-y-3 text-sm">
                    <div>
                        <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">{t('columns.createdAt')}</dt>
                        <dd className="text-foreground">{selectedLog.created_at || '-'}</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">{t('columns.userId')}</dt>
                        <dd className="text-foreground">{selectedLog.user_id || '-'}</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">{t('columns.channel')}</dt>
                        <dd className="text-foreground">{selectedLog.channel || '-'}</dd>
                    </div>
                    {selectedLog.message && (
                        <div>
                            <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">{t('columns.message')}</dt>
                            <dd>
                                <pre className="text-xs whitespace-pre-wrap break-all bg-muted/50 rounded p-2 max-h-64 overflow-auto">
                                    {selectedLog.message}
                                </pre>
                            </dd>
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
                leftPanelDefaultSize={45}
                rightPanelDefaultSize={55}
            />
        </div>
    );
}
