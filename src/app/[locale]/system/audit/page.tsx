
'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SYSTEM_PERMISSIONS } from '@/constants/permissions';
import { API_ROUTES } from '@/constants/routes';
import { usePermissions } from '@/hooks/usePermissions';
import { AuditLog } from '@/lib/types';
import api from '@/services/api';
import { ColumnDef, PaginationState, VisibilityState } from '@tanstack/react-table';
import { BarChart, MoreHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { DataCard } from '@/components/ui/data-card';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';

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


export default function AuditLogPage() {
    const t = useTranslations('AuditLog');
    const { hasPermission } = usePermissions();
    const canViewList = hasPermission(SYSTEM_PERMISSIONS.AUDIT_LOG_VIEW_LIST);
    const canViewDetail = hasPermission(SYSTEM_PERMISSIONS.AUDIT_LOG_VIEW_DETAIL);
    const isNarrow = useViewportNarrow();
    const [data, setData] = React.useState<AuditLog[]>([]);
    const [logCount, setLogCount] = React.useState(0);
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    const [pagination, setPagination] = React.useState<PaginationState>({
        pageIndex: 0,
        pageSize: 10,
    });
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({
        id: false,
    });

    const columns: ColumnDef<AuditLog>[] = React.useMemo(() => [
        {
            accessorKey: 'id',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.id')} />,
            enableHiding: true,
        },
        { accessorKey: 'changed_at', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.changedAt')} /> },
        { accessorKey: 'table_name', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.table')} /> },
        { accessorKey: 'record_id', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.recordId')} /> },
        { accessorKey: 'operation', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.operation')} /> },
        {
            accessorKey: 'old_value',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.oldValue')} />,
            cell: ({ row }) => {
                const value = row.original.old_value;
                let displayValue = '';
                if (typeof value === 'object' && value !== null) {
                    displayValue = JSON.stringify(value, null, 2);
                } else if (value !== null && value !== undefined) {
                    displayValue = String(value);
                }
                return <pre className="text-xs whitespace-pre-wrap max-w-xs break-all">{displayValue}</pre>
            }
        },
        {
            accessorKey: 'new_value',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.newValue')} />,
            cell: ({ row }) => {
                const value = row.original.new_value;
                let displayValue = '';
                if (typeof value === 'object' && value !== null) {
                    displayValue = JSON.stringify(value, null, 2);
                } else if (value !== null && value !== undefined) {
                    displayValue = String(value);
                }
                return <pre className="text-xs whitespace-pre-wrap max-w-xs break-all">{displayValue}</pre>
            }
        },
        { accessorKey: 'changed_by', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.changedBy')} /> },
        {
            id: 'actions',
            cell: ({ row }) => {
                const log = row.original;
                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">{t('columns.openMenu')}</span>
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>{t('columns.actions')}</DropdownMenuLabel>
                            {canViewDetail && <DropdownMenuItem>{t('columns.viewDetails')}</DropdownMenuItem>}
                        </DropdownMenuContent>
                    </DropdownMenu>
                );
            },
        },
    ], [t]);

    const loadLogs = React.useCallback(async () => {
        setIsRefreshing(true);
        const { auditLogs, total } = await getAuditLogs(pagination);
        setData(auditLogs);
        setLogCount(total);
        setIsRefreshing(false);
    }, [pagination]);

    React.useEffect(() => {
        loadLogs();
    }, [loadLogs]);

    return (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <Card className="flex-1 flex flex-col min-h-0 overflow-hidden shadow-sm border-0">
                <CardHeader className="flex-none p-4">
                    <div className="flex items-start gap-3">
                        <div className="header-icon-circle mt-0.5">
                            <BarChart className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col text-left">
                            <CardTitle className="text-lg">{t('title')}</CardTitle>
                            <CardDescription className="text-xs">{t('description')}</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden p-6 bg-card">
                    {canViewList ? (
                        <DataTable
                            columns={columns}
                            data={data}
                            filterColumnId="table_name"
                            filterPlaceholder={t('filterPlaceholder')}
                            onRefresh={loadLogs}
                            isRefreshing={isRefreshing}
                            isNarrow={isNarrow}
                            renderCard={(row: AuditLog) => (
                                <DataCard
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
                        />
                    ) : (
                        <div className="flex items-center justify-center h-full">
                            <p className="text-muted-foreground">{t('noAccess')}</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
