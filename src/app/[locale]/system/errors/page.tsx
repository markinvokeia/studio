
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
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { SYSTEM_PERMISSIONS } from '@/constants/permissions';
import { API_ROUTES } from '@/constants/routes';
import { usePermissions } from '@/hooks/usePermissions';
import { ErrorLog } from '@/lib/types';
import api from '@/services/api';
import { ColumnDef, PaginationState, VisibilityState } from '@tanstack/react-table';
import { FileWarning, MoreHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { DataCard } from '@/components/ui/data-card';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';

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


export default function ErrorLogPage() {
    const t = useTranslations('ErrorLogPage');
    const { hasPermission } = usePermissions();
    const canViewList = hasPermission(SYSTEM_PERMISSIONS.ERROR_LOG_VIEW_LIST);
    const isNarrow = useViewportNarrow();
    const [data, setData] = React.useState<ErrorLog[]>([]);
    const [logCount, setLogCount] = React.useState(0);
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    const [pagination, setPagination] = React.useState<PaginationState>({
        pageIndex: 0,
        pageSize: 10,
    });
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({
        id: false,
    });

    const columns: ColumnDef<ErrorLog>[] = React.useMemo(() => [
        {
            accessorKey: 'id',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.id')} />,
            enableHiding: true,
        },
        { accessorKey: 'created_at', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.createdAt')} /> },
        { accessorKey: 'severity', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.severity')} /> },
        { accessorKey: 'message', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.message')} /> },
        { accessorKey: 'channel', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.channel')} /> },
        { accessorKey: 'user_id', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.userId')} /> },
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
                            <DropdownMenuItem>{t('columns.viewDetails')}</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                );
            },
        },
    ], [t]);

    const loadLogs = React.useCallback(async () => {
        setIsRefreshing(true);
        const { errorLogs, total } = await getErrorLogs(pagination);
        setData(errorLogs);
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
                            <FileWarning className="h-5 w-5" />
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
                            filterColumnId="message"
                            filterPlaceholder={t('filterPlaceholder')}
                            onRefresh={loadLogs}
                            isRefreshing={isRefreshing}
                            isNarrow={isNarrow}
                            renderCard={(row: ErrorLog) => (
                                <DataCard
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
