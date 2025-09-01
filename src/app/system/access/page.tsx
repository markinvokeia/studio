'use client';

import * as React from 'react';
import { accessLogs } from '@/lib/data';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ColumnDef } from '@tanstack/react-table';
import { AccessLog } from '@/lib/types';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';

const columns: ColumnDef<AccessLog>[] = [
    { accessorKey: 'id', header: ({column}) => <DataTableColumnHeader column={column} title="ID" /> },
    { accessorKey: 'user_id', header: ({column}) => <DataTableColumnHeader column={column} title="User ID" /> },
    { accessorKey: 'timestamp', header: ({column}) => <DataTableColumnHeader column={column} title="Timestamp" /> },
    { accessorKey: 'action', header: ({column}) => <DataTableColumnHeader column={column} title="Action" /> },
    { accessorKey: 'success', header: ({column}) => <DataTableColumnHeader column={column} title="Success" />, cell: ({row}) => row.original.success ? "Yes" : "No" },
    { accessorKey: 'ip_address', header: ({column}) => <DataTableColumnHeader column={column} title="IP Address" /> },
];

export default function AccessLogPage() {
    const [data, setData] = React.useState<AccessLog[]>(accessLogs);
    const [isRefreshing, setIsRefreshing] = React.useState(false);

    const handleRefresh = () => {
        setIsRefreshing(true);
        setTimeout(() => {
            setData([...accessLogs]);
            setIsRefreshing(false);
        }, 1000);
    };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Access Log</CardTitle>
        <CardDescription>Monitor user access and login attempts.</CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable 
            columns={columns} 
            data={data} 
            filterColumnId="user_id" 
            filterPlaceholder="Filter logs by user ID..."
            onRefresh={handleRefresh}
            isRefreshing={isRefreshing}
        />
      </CardContent>
    </Card>
  );
}
