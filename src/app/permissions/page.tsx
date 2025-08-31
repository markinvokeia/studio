import { permissions } from '@/lib/data';
import { permissionColumns } from './columns';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function PermissionsPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Permissions</CardTitle>
        <CardDescription>View all system permissions.</CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable columns={permissionColumns} data={permissions} filterColumnId="name" filterPlaceholder="Filter by name..." />
      </CardContent>
    </Card>
  );
}
