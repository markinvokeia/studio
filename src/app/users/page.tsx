import { users } from '@/lib/data';
import { userColumns } from './columns';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function UsersPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Users</CardTitle>
        <CardDescription>Manage all users in the system.</CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable columns={userColumns} data={users} filterColumnId="email" filterPlaceholder="Filter by email..." />
      </CardContent>
    </Card>
  );
}
