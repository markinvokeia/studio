
'use client';

import * as React from 'react';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ColumnDef, PaginationState, VisibilityState } from '@tanstack/react-table';
import { AccessLog } from '@/lib/types';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';


type GetAccessLogsResponse = {
  accessLogs: AccessLog[];
  total: number;
};

async function getAccessLogs(pagination: PaginationState): Promise<GetAccessLogsResponse> {
    try {
        const params = new URLSearchParams({
            page: (pagination.pageIndex + 1).toString(),
            limit: pagination.pageSize.toString(),
        });
        const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/access_logs?${params.toString()}`, {
            method: 'GET',
            mode: 'cors',
            headers: {
                'Accept': 'application/json',
            },
            cache: 'no-store',
        });

        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status} - ${response.statusText}`);
        }

        const responseData = await response.json();
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
    const [data, setData] = React.useState<AccessLog[]>([]);
    const [logCount, setLogCount] = React.useState(0);
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    const [pagination, setPagination] = React.useState<PaginationState>({
        pageIndex: 0,
        pageSize: 10,
    });
     const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({
        id: false,
        ip_address: false,
    });
    
    const columns: ColumnDef<AccessLog>[] = [
        { 
            accessorKey: 'id', 
            header: ({column}) => <DataTableColumnHeader column={column} title={t('columns.id')} />,
            enableHiding: true,
        },
        { accessorKey: 'user_id', header: ({column}) => <DataTableColumnHeader column={column} title={t('columns.userId')} /> },
        { accessorKey: 'timestamp', header: ({column}) => <DataTableColumnHeader column={column} title={t('columns.timestamp')} /> },
        { accessorKey: 'action', header: ({column}) => <DataTableColumnHeader column={column} title={t('columns.action')} /> },
        { accessorKey: 'success', header: ({column}) => <DataTableColumnHeader column={column} title={t('columns.success')} />, cell: ({row}) => row.original.success ? "Yes" : "No" },
        { accessorKey: 'ip_address', header: ({column}) => <DataTableColumnHeader column={column} title={t('columns.ipAddress')} /> },
        { accessorKey: 'channel', header: ({column}) => <DataTableColumnHeader column={column} title={t('columns.channel')} /> },
        { 
            accessorKey: 'details', 
            header: ({column}) => <DataTableColumnHeader column={column} title={t('columns.details')} />,
            cell: ({ row }) => <div className="max-w-xs whitespace-pre-wrap break-all">{row.original.details}</div>
        },
        {
            id: 'actions',
            cell: ({ row }) => {
            const log = row.original;
            return (
                <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                    <span className="sr-only">Open menu</span>
                    <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuLabel>{t('columns.actions')}</DropdownMenuLabel>
                    <DropdownMenuItem>{t('columns.viewUser')}</DropdownMenuItem>
                </DropdownMenuContent>
                </DropdownMenu>
            );
            },
        },
    ];

    const loadLogs = React.useCallback(async () => {
        setIsRefreshing(true);
        const { accessLogs, total } = await getAccessLogs(pagination);
        setData(accessLogs);
        setLogCount(total);
        setIsRefreshing(false);
    }, [pagination]);

    React.useEffect(() => {
        loadLogs();
    }, [loadLogs]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('title')}</CardTitle>
                <CardDescription>{t('description')}</CardDescription>
            </CardHeader>
            <CardContent>
                <DataTable 
                    columns={columns} 
                    data={data} 
                    filterColumnId="user_id" 
                    filterPlaceholder={t('filterPlaceholder')}
                    onRefresh={loadLogs}
                    isRefreshing={isRefreshing}
                    pageCount={Math.ceil(logCount / pagination.pageSize)}
                    pagination={pagination}
                    onPaginationChange={setPagination}
                    manualPagination={true}
                    columnVisibility={columnVisibility}
                    onColumnVisibilityChange={setColumnVisibility}
                />
            </CardContent>
        </Card>
    );
}
