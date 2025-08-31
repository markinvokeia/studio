import { auditLogs } from '@/lib/data';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ColumnDef } from '@tanstack/react-table';
import { AuditLog } from '@/lib/types';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';

const columns: ColumnDef<AuditLog>[] = [
    { accessorKey: 'id', header: ({column}) => <DataTableColumnHeader column={column} title="ID" /> },
    { accessorKey: 'timestamp', header: ({column}) => <DataTableColumnHeader column={column} title="Timestamp" /> },
    { accessorKey: 'changed_by', header: ({column}) => <DataTableColumnHeader column={column} title="Changed By" /> },
    { accessorKey: 'table_name', header: ({column}) => <DataTableColumnHeader column={column} title="Table" /> },
    { accessorKey: 'record_id', header: ({column}) => <DataTableColumnHeader column={column} title="Record ID" /> },
    { accessorKey: 'operation', header: ({column}) => <DataTableColumnHeader column={column} title="Operation" /> },
];

export default function AuditLogPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit Log</CardTitle>
        <CardDescription>Review system activity.</CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable columns={columns} data={auditLogs} filterColumnId="table_name" filterPlaceholder="Filter by table..." />
      </CardContent>
    </Card>
  );
}
