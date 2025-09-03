'use client';

import * as React from 'react';
import { auditLogs } from '@/lib/data';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ColumnDef } from '@tanstack/react-table';
import { AuditLog } from '@/lib/types';
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


const columns: ColumnDef<AuditLog>[] = [
    { accessorKey: 'id', header: ({column}) => <DataTableColumnHeader column={column} title="ID" /> },
    { accessorKey: 'timestamp', header: ({column}) => <DataTableColumnHeader column={column} title="Timestamp" /> },
    { accessorKey: 'changed_by', header: ({column}) => <DataTableColumnHeader column={column} title="Changed By" /> },
    { accessorKey: 'table_name', header: ({column}) => <DataTableColumnHeader column={column} title="Table" /> },
    { accessorKey: 'record_id', header: ({column}) => <DataTableColumnHeader column={column} title="Record ID" /> },
    { accessorKey: 'operation', header: ({column}) => <DataTableColumnHeader column={column} title="Operation" /> },
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

export default function AuditLogPage() {
    const [data, setData] = React.useState<AuditLog[]>(auditLogs);
    const [isRefreshing, setIsRefreshing] = React.useState(false);

    const handleRefresh = () => {
        setIsRefreshing(true);
        setTimeout(() => {
            setData([...auditLogs]);
            setIsRefreshing(false);
        }, 1000);
    };

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
            onRefresh={handleRefresh}
            isRefreshing={isRefreshing}
        />
      </CardContent>
    </Card>
  );
}

    