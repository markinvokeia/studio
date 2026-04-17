
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
import { AuditLog } from '@/lib/types';
import api from '@/services/api';
import { ColumnDef, PaginationState, RowSelectionState, VisibilityState } from '@tanstack/react-table';
import { BarChart } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

type GetAuditLogsResponse = {
    auditLogs: AuditLog[];
    total: number;
};

async function getAuditLogs(pagination: PaginationState): Promise<GetAuditLogsResponse> {
    try {
        const responseData = await api.get(API_ROUTES.SYSTEM.AUDIT_LOGS, {
            page: (pagination.pageIndex + 1).toString(),
            limit: pagination.pageSize.toString(),
        });
        const data = Array.isArray(responseData) && responseData.length > 0 ? responseData[0] : responseData;
        const logsData = Array.isArray(data.data) ? data.data : (data.audit_logs || data.data || data.result || []);
        const total = data.total || (Array.isArray(data) ? data.length : 0);
        const mappedLogs = logsData.map((apiLog: any) => ({
            id: apiLog.id ? String(apiLog.id) : `aud_${Math.random().toString(36).substr(2, 9)}`,
            changed_at: apiLog.changed_at,
            changed_by: apiLog.changed_by_id,
            table_name: apiLog.table_name,
            record_id: String(apiLog.record_id),
            operation: apiLog.operation,
            old_value: apiLog.old_value,
            new_value: apiLog.new_value,
        }));
        return { auditLogs: mappedLogs, total };
    } catch (error) {
        console.error("Failed to fetch audit logs:", error);
        return { auditLogs: [], total: 0 };
    }
}

function formatJsonValue(value: any): string {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
}

export default function AuditLogPage() {
    const t = useTranslations('AuditLog');
    const { hasPermission } = usePermissions();
    const canViewList = hasPermission(SYSTEM_PERMISSIONS.AUDIT_LOG_VIEW_LIST);
    const isNarrow = useViewportNarrow();

    const [data, setData] = React.useState<AuditLog[]>([]);
    const [logCount, setLogCount] = React.useState(0);
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({ id: false });
    const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
    const [selectedLog, setSelectedLog] = React.useState<AuditLog | null>(null);

    const columns: ColumnDef<AuditLog>[] = React.useMemo(() => [
        { accessorKey: 'id', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.id')} />, enableHiding: true },
        { accessorKey: 'changed_at', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.changedAt')} /> },
        { accessorKey: 'table_name', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.table')} /> },
        { accessorKey: 'record_id', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.recordId')} /> },
        { accessorKey: 'operation', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.operation')} /> },
        { accessorKey: 'changed_by', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.changedBy')} /> },
    ], [t]);

    const loadLogs = React.useCallback(async () => {
        setIsRefreshing(true);
        const { auditLogs, total } = await getAuditLogs(pagination);
        setData(auditLogs);
        setLogCount(total);
        setIsRefreshing(false);
    }, [pagination]);

    React.useEffect(() => { loadLogs(); }, [loadLogs]);

    const handleRowSelection = (rows: AuditLog[]) => {
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
                    <div className="header-icon-circle mt-0.5"><BarChart className="h-5 w-5" /></div>
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
                        filterColumnId="table_name"
                        filterPlaceholder={t('filterPlaceholder')}
                        onRefresh={loadLogs}
                        isRefreshing={isRefreshing}
                        isNarrow={isNarrow || !!selectedLog}
                        renderCard={(row: AuditLog, _isSelected: boolean) => (
                            <DataCard isSelected={_isSelected}
                                title={row.table_name}
                                subtitle={`${row.operation} · ${row.changed_at}`}
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
                    <div className="header-icon-circle flex-none"><BarChart className="h-5 w-5" /></div>
                    <div className="min-w-0">
                        <CardTitle className="text-base lg:text-lg truncate">{selectedLog.table_name}</CardTitle>
                        <p className="text-xs text-muted-foreground truncate">{selectedLog.operation} · {selectedLog.record_id}</p>
                    </div>
                </div>
            </CardHeader>
            <Separator />
            <CardContent className="flex-1 overflow-auto p-4">
                <dl className="space-y-3 text-sm">
                    <div>
                        <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">{t('columns.changedAt')}</dt>
                        <dd className="text-foreground">{selectedLog.changed_at || '-'}</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">{t('columns.changedBy')}</dt>
                        <dd className="text-foreground">{selectedLog.changed_by || '-'}</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">{t('columns.operation')}</dt>
                        <dd><Badge variant="secondary">{selectedLog.operation}</Badge></dd>
                    </div>
                    <Separator />
                    <div>
                        <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">{t('columns.oldValue')}</dt>
                        <dd>
                            <pre className="text-xs whitespace-pre-wrap break-all bg-muted/50 rounded p-2 max-h-48 overflow-auto">
                                {formatJsonValue(selectedLog.old_value)}
                            </pre>
                        </dd>
                    </div>
                    <div>
                        <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">{t('columns.newValue')}</dt>
                        <dd>
                            <pre className="text-xs whitespace-pre-wrap break-all bg-muted/50 rounded p-2 max-h-48 overflow-auto">
                                {formatJsonValue(selectedLog.new_value)}
                            </pre>
                        </dd>
                    </div>
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
