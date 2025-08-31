import { roles } from '@/lib/data';
import { roleColumns } from './columns';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function RolesPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Roles</CardTitle>
        <CardDescription>Manage user roles and their permissions.</CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable columns={roleColumns} data={roles} filterColumnId="name" filterPlaceholder="Filter by name..." />
      </CardContent>
    </Card>
  );
}
