import { conversations } from '@/lib/data';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ColumnDef } from '@tanstack/react-table';
import { Conversation } from '@/lib/types';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';

const columns: ColumnDef<Conversation>[] = [
    { accessorKey: 'id', header: ({column}) => <DataTableColumnHeader column={column} title="ID" /> },
    { accessorKey: 'subject', header: ({column}) => <DataTableColumnHeader column={column} title="Subject" /> },
    { accessorKey: 'user_id', header: ({column}) => <DataTableColumnHeader column={column} title="User ID" /> },
    { accessorKey: 'channel_id', header: ({column}) => <DataTableColumnHeader column={column} title="Channel ID" /> },
    { accessorKey: 'status', header: ({column}) => <DataTableColumnHeader column={column} title="Status" /> },
];

export default function CommunicationsPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Conversations</CardTitle>
        <CardDescription>Manage user conversations.</CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable columns={columns} data={conversations} filterColumnId="subject" filterPlaceholder="Filter subjects..." />
      </CardContent>
    </Card>
  );
}
