import { services } from '@/lib/data';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ColumnDef } from '@tanstack/react-table';
import { Service } from '@/lib/types';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';

const columns: ColumnDef<Service>[] = [
    { accessorKey: 'id', header: ({column}) => <DataTableColumnHeader column={column} title="ID" /> },
    { accessorKey: 'name', header: ({column}) => <DataTableColumnHeader column={column} title="Name" /> },
    { accessorKey: 'category', header: ({column}) => <DataTableColumnHeader column={column} title="Category" /> },
    { accessorKey: 'price', header: ({column}) => <DataTableColumnHeader column={column} title="Price" />, cell: ({row}) => `$${row.original.price}`},
    { accessorKey: 'duration_minutes', header: ({column}) => <DataTableColumnHeader column={column} title="Duration (min)" /> },
];

export default function ServicesPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Service Catalog</CardTitle>
        <CardDescription>Manage business services.</CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable columns={columns} data={services} filterColumnId="name" filterPlaceholder="Filter services..." />
      </CardContent>
    </Card>
  );
}
