
'use client';

import { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
    header: () => null,
    cell: ({ row, table }) => {
      const isSelected = row.getIsSelected();
      return (
        <RadioGroup
          value={isSelected ? row.id : ''}
          onValueChange={() => {
            table.toggleAllPageRowsSelected(false);
            row.toggleSelected(true);
          }}
        >
          <RadioGroupItem value={row.id} id={row.id} aria-label="Select row" />
        </RadioGroup>
      );
    },
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
    accessorKey: 'user_name',
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
        partial: 'info',
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
  onRowSelectionChange?: (selectedRows: Quote[]) => void;
  onCreate?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function RecentQuotesTable({ quotes, onRowSelectionChange, onCreate, onRefresh, isRefreshing }: RecentQuotesTableProps) {
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
          filterColumnId="user_name"
          filterPlaceholder="Filter quotes by user name..."
          onRowSelectionChange={onRowSelectionChange}
          enableSingleRowSelection={true}
          onCreate={onCreate}
          onRefresh={onRefresh}
          isRefreshing={isRefreshing}
        />
      </CardContent>
    </Card>
  );
}
