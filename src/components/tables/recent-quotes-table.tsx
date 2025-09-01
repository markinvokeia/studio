'use client';

import { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Quote } from '@/lib/types';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';

const columns: ColumnDef<Quote>[] = [
  {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'id',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Quote ID" />
    ),
  },
  {
    accessorKey: 'userName',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="User" />
    ),
  },
  {
    accessorKey: 'total',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Total" />
    ),
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue('total'));
      const formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(amount);
      return <div className="font-medium">{formatted}</div>;
    },
  },
  {
    accessorKey: 'status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => {
      const status = row.getValue('status') as string;
      const variant = {
        accepted: 'success',
        confirmed: 'success',
        sent: 'default',
        pending: 'info',
        draft: 'outline',
        rejected: 'destructive',
      }[status.toLowerCase()] ?? ('default' as any);

      return (
        <Badge variant={variant} className="capitalize">
          {status}
        </Badge>
      );
    },
  },
  {
    accessorKey: 'payment_status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Payment" />
    ),
     cell: ({ row }) => {
      const status = row.getValue('payment_status') as string;
      const variant = {
        paid: 'success',
        partial: 'secondary',
        unpaid: 'outline',
      }[status.toLowerCase()] ?? ('default'as any);

      return (
        <Badge variant={variant} className="capitalize">
          {status}
        </Badge>
      );
    },
  },
];

interface RecentQuotesTableProps {
  quotes: Quote[];
}

export function RecentQuotesTable({ quotes }: RecentQuotesTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Quotes</CardTitle>
        <CardDescription>An overview of the latest quotes.</CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={quotes}
          filterColumnId="userName"
          filterPlaceholder="Filter by user..."
        />
      </CardContent>
    </Card>
  );
}
