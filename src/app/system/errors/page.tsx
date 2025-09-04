
'use client';

import * as React from 'react';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ColumnDef, PaginationState, VisibilityState } from '@tanstack/react-table';
import { ErrorLog } from '@/lib/types';
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


const columns: ColumnDef<ErrorLog>[] = [
    { 
        accessorKey: 'id', 
        header: ({column}) => <DataTableColumnHeader column={column} title="ID" />,
        enableHiding: true,
    },
    { accessorKey: 'timestamp', header: ({column}) => <DataTableColumnHeader column={column} title="Timestamp" /> },
    { accessorKey: 'severity', header: ({column}) => <DataTableColumnHeader column={column} title="Severity" /> },
    { accessorKey: 'message', header: ({column}) => <DataTableColumnHeader column={column} title="Message" /> },
    { accessorKey: 'user_id', header: ({column}) => <DataTableColumnHeader column={column} title="User ID" /> },
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
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuItem>View Details</DropdownMenuItem>
            </DropdownMenuContent>
            </DropdownMenu>
        );
        },
    },
];

type GetErrorLogsResponse = {
  errorLogs: ErrorLog[];
  total: number;
};

async function getErrorLogs(pagination: PaginationState): Promise<GetErrorLogsResponse> {
    try {
        const params = new URLSearchParams({
            page: (pagination.pageIndex + 1).toString(),
            limit: pagination.pageSize.toString(),
        });
        const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/error_logs?${params.toString()}`, {
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
        
        const logsData = Array.isArray(data.data) ? data.data : (data.error_logs || data.data || data.result || []);
        const total = data.total || (Array.isArray(data) ? data.length : 0);

        const mappedLogs = logsData.map((apiLog: any) => ({
            id: apiLog.id ? String(apiLog.id) : `err_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: apiLog.timestamp,
            severity: apiLog.severity,
            message: apiLog.message,
            user_id: apiLog.user_id,
        }));
        
        return { errorLogs: mappedLogs, total };
    } catch (error) {
        console.error("Failed to fetch error logs:", error);
        return { errorLogs: [], total: 0 };
    }
}


export default function ErrorLogPage() {
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
    <Card>
      <CardHeader>
        <CardTitle>Error Log</CardTitle>
        <CardDescription>Track system errors and warnings.</CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable 
            columns={columns} 
            data={data} 
            filterColumnId="message" 
            filterPlaceholder="Filter errors by message..."
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
