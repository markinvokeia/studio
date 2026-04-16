
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
import { AccessLog } from '@/lib/types';
import api from '@/services/api';
import { ColumnDef, PaginationState, RowSelectionState, VisibilityState } from '@tanstack/react-table';
import { UserCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

type GetAccessLogsResponse = {
    accessLogs: AccessLog[];
    total: number;
};

async function getAccessLogs(pagination: PaginationState): Promise<GetAccessLogsResponse> {
    try {
        const responseData = await api.get(API_ROUTES.SYSTEM.ACCESS_LOGS, {
            page: (pagination.pageIndex + 1).toString(),
            limit: pagination.pageSize.toString(),
        });
        const data = Array.isArray(responseData) && responseData.length > 0 ? responseData[0] : responseData;
        const logsData = Array.isArray(data.data) ? data.data : (data.access_logs || data.data || data.result || []);
        const total = data.total || (Array.isArray(data) ? data.length : 0);
        const mappedLogs = logsData.map((apiLog: any) => ({
            id: apiLog.id ? String(apiLog.id) : `acc_${Math.random().toString(36).substr(2, 9)}`,
            user_id: apiLog.user_id,
            timestamp: apiLog.timestamp,
            action: apiLog.action,
            success: apiLog.success,
            ip_address: apiLog.ip_address,
            channel: apiLog.channel,
            details: apiLog.details,
        }));
        return { accessLogs: mappedLogs, total };
    } catch (error) {
        console.error("Failed to fetch access logs:", error);
        return { accessLogs: [], total: 0 };
    }
}

export default function AccessLogPage() {
    const t = useTranslations('AccessLogPage');
    const { hasPermission } = usePermissions();
    const canViewList = hasPermission(SYSTEM_PERMISSIONS.ACCESS_LOG_VIEW_LIST);
    const isNarrow = useViewportNarrow();

    const [data, setData] = React.useState<AccessLog[]>([]);
    const [logCount, setLogCount] = React.useState(0);
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({ id: false, ip_address: false });
    const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
    const [selectedLog, setSelectedLog] = React.useState<AccessLog | null>(null);

    const columns: ColumnDef<AccessLog>[] = [
        { accessorKey: 'id', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.id')} />, enableHiding: true },
        { accessorKey: 'user_id', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.userId')} /> },
        { accessorKey: 'timestamp', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.timestamp')} /> },
        { accessorKey: 'action', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.action')} /> },
        {
            accessorKey: 'success',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.success')} />,
            cell: ({ row }) => (
                <Badge variant={row.original.success ? 'success' : 'destructive'}>
                    {row.original.success ? t('columns.yes') : t('columns.no')}
                </Badge>
            ),
        },
        { accessorKey: 'ip_address', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.ipAddress')} /> },
        { accessorKey: 'channel', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.channel')} /> },
    ];

    const loadLogs = React.useCallback(async () => {
        setIsRefreshing(true);
        const { accessLogs, total } = await getAccessLogs(pagination);
        setData(accessLogs);
        setLogCount(total);
        setIsRefreshing(false);
    }, [pagination]);

    React.useEffect(() => { loadLogs(); }, [loadLogs]);

    const handleRowSelection = (rows: AccessLog[]) => {
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
                    <div className="header-icon-circle mt-0.5"><UserCheck className="h-5 w-5" /></div>
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
                        filterColumnId="user_id"
                        filterPlaceholder={t('filterPlaceholder')}
                        onRefresh={loadLogs}
                        isRefreshing={isRefreshing}
                        isNarrow={isNarrow || !!selectedLog}
                        renderCard={(row: AccessLog) => (
                            <DataCard
                                title={row.action}
                                subtitle={`${row.user_id} · ${row.timestamp}`}
                                badge={<span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${row.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{row.success ? t('columns.yes') : t('columns.no')}</span>}
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
                    <div className="header-icon-circle flex-none"><UserCheck className="h-5 w-5" /></div>
                    <div className="min-w-0">
                        <CardTitle className="text-base lg:text-lg truncate">{selectedLog.action}</CardTitle>
                        <p className="text-xs text-muted-foreground truncate">{selectedLog.user_id} · {selectedLog.timestamp}</p>
                    </div>
                    <Badge className="ml-auto flex-none" variant={selectedLog.success ? 'success' : 'destructive'}>
                        {selectedLog.success ? t('columns.yes') : t('columns.no')}
                    </Badge>
                </div>
            </CardHeader>
            <Separator />
            <CardContent className="flex-1 overflow-auto p-4">
                <dl className="space-y-3 text-sm">
                    <div>
                        <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">{t('columns.timestamp')}</dt>
                        <dd className="text-foreground">{selectedLog.timestamp || '-'}</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">{t('columns.userId')}</dt>
                        <dd className="text-foreground">{selectedLog.user_id || '-'}</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">{t('columns.channel')}</dt>
                        <dd className="text-foreground">{selectedLog.channel || '-'}</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">{t('columns.ipAddress')}</dt>
                        <dd className="text-foreground">{selectedLog.ip_address || '-'}</dd>
                    </div>
                    {selectedLog.details && (
                        <div>
                            <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">{t('columns.details')}</dt>
                            <dd>
                                <pre className="text-xs whitespace-pre-wrap break-all bg-muted/50 rounded p-2 max-h-64 overflow-auto">
                                    {selectedLog.details}
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
