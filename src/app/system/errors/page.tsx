import { errorLogs } from '@/lib/data';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ColumnDef } from '@tanstack/react-table';
import { ErrorLog } from '@/lib/types';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';

const columns: ColumnDef<ErrorLog>[] = [
    { accessorKey: 'id', header: ({column}) => <DataTableColumnHeader column={column} title="ID" /> },
    { accessorKey: 'timestamp', header: ({column}) => <DataTableColumnHeader column={column} title="Timestamp" /> },
    { accessorKey: 'severity', header: ({column}) => <DataTableColumnHeader column={column} title="Severity" /> },
    { accessorKey: 'message', header: ({column}) => <DataTableColumnHeader column={column} title="Message" /> },
    { accessorKey: 'user_id', header: ({column}) => <DataTableColumnHeader column={column} title="User ID" /> },
];

export default function ErrorLogPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Error Log</CardTitle>
        <CardDescription>Track system errors and warnings.</CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable columns={columns} data={errorLogs} filterColumnId="message" filterPlaceholder="Filter by message..." />
      </CardContent>
    </Card>
  );
}
