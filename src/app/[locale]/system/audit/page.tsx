
'use client';

import * as React from 'react';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ColumnDef, PaginationState, VisibilityState } from '@tanstack/react-table';
import { AuditLog } from '@/lib/types';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreHorizontal } from 'lucide-react';


const columns: ColumnDef<AuditLog>[] = [
    { 
        accessorKey: 'id', 
        header: ({column}) => <DataTableColumnHeader column={column} title="ID" />,
        enableHiding: true,
    },
    { accessorKey: 'changed_at', header: ({column}) => <DataTableColumnHeader column={column} title="Changed At" /> },
    { accessorKey: 'table_name', header: ({column}) => <DataTableColumnHeader column={column} title="Table" /> },
    { accessorKey: 'record_id', header: ({column}) => <DataTableColumnHeader column={column} title="Record ID" /> },
    { accessorKey: 'operation', header: ({column}) => <DataTableColumnHeader column={column} title="Operation" /> },
    { 
        accessorKey: 'old_value', 
        header: ({column}) => <DataTableColumnHeader column={column} title="Old Value" />,
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
        header: ({column}) => <DataTableColumnHeader column={column} title="New Value" />,
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
    { accessorKey: 'changed_by', header: ({column}) => <DataTableColumnHeader column={column} title="Changed By" /> },
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

type GetAuditLogsResponse = {
  auditLogs: AuditLog[];
  total: number;
};


async function getAuditLogs(pagination: PaginationState): Promise<GetAuditLogsResponse> {
    try {
        const params = new URLSearchParams({
            page: (pagination.pageIndex + 1).toString(),
            limit: pagination.pageSize.toString(),
        });
        const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/audit_logs?${params.toString()}`, {
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
        <Card>
            <CardHeader>
                <CardTitle>Audit Log</CardTitle>
                <CardDescription>Review system activity.</CardDescription>
            </CardHeader>
            <CardContent>
                <DataTable 
                    columns={columns} 
                    data={data} 
                    filterColumnId="table_name" 
                    filterPlaceholder="Filter logs by table name..." 
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
