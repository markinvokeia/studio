import { communicationChannels } from '@/lib/data';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ColumnDef } from '@tanstack/react-table';
import { CommunicationChannel } from '@/lib/types';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';

const columns: ColumnDef<CommunicationChannel>[] = [
    { accessorKey: 'id', header: ({column}) => <DataTableColumnHeader column={column} title="ID" /> },
    { accessorKey: 'name', header: ({column}) => <DataTableColumnHeader column={column} title="Name" /> },
    { accessorKey: 'channel_type', header: ({column}) => <DataTableColumnHeader column={column} title="Type" /> },
    { accessorKey: 'is_active', header: ({column}) => <DataTableColumnHeader column={column} title="Active" />, cell: ({row}) => row.original.is_active ? "Yes" : "No" },
];

export default function ChannelsPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Communication Channels</CardTitle>
        <CardDescription>Manage communication channels.</CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable columns={columns} data={communicationChannels} filterColumnId="name" filterPlaceholder="Filter channels..." />
      </CardContent>
    </Card>
  );
}
