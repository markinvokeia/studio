import { clinics } from '@/lib/data';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ColumnDef } from '@tanstack/react-table';
import { Clinic } from '@/lib/types';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';

const columns: ColumnDef<Clinic>[] = [
    { accessorKey: 'id', header: ({column}) => <DataTableColumnHeader column={column} title="ID" /> },
    { accessorKey: 'name', header: ({column}) => <DataTableColumnHeader column={column} title="Name" /> },
    { accessorKey: 'location', header: ({column}) => <DataTableColumnHeader column={column} title="Location" /> },
    { accessorKey: 'contact_email', header: ({column}) => <DataTableColumnHeader column={column} title="Email" /> },
    { accessorKey: 'phone_number', header: ({column}) => <DataTableColumnHeader column={column} title="Phone" /> },
];

export default function ClinicsPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Clinics</CardTitle>
        <CardDescription>Manage clinic locations.</CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable columns={columns} data={clinics} filterColumnId="name" filterPlaceholder="Filter clinics..." />
      </CardContent>
    </Card>
  );
}
