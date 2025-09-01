import { systemConfigurations } from '@/lib/data';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ColumnDef } from '@tanstack/react-table';
import { SystemConfiguration } from '@/lib/types';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';

const columns: ColumnDef<SystemConfiguration>[] = [
    { accessorKey: 'id', header: ({column}) => <DataTableColumnHeader column={column} title="ID" /> },
    { accessorKey: 'key', header: ({column}) => <DataTableColumnHeader column={column} title="Key" /> },
    { accessorKey: 'value', header: ({column}) => <DataTableColumnHeader column={column} title="Value" /> },
    { accessorKey: 'data_type', header: ({column}) => <DataTableColumnHeader column={column} title="Type" /> },
    { accessorKey: 'updated_by', header: ({column}) => <DataTableColumnHeader column={column} title="Updated By" /> },
];

export default function SystemConfigPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>System Configurations</CardTitle>
        <CardDescription>Manage system-wide settings.</CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable columns={columns} data={systemConfigurations} filterColumnId="key" filterPlaceholder="Filter configurations by key..." />
      </CardContent>
    </Card>
  );
}
