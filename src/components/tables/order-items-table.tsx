
'use client';

import { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { OrderItem } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

const DateCell = ({ dateValue }: { dateValue: string | null }) => {
    if (!dateValue || dateValue === 'N/A') {
        return <Badge variant="destructive">N/A</Badge>;
    }

    const date = new Date(dateValue);
    const now = new Date();
    
    // Reset time part for accurate date-only comparison
    date.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);

    if (date < now) {
        return <Badge variant="success">{dateValue}</Badge>; // Past
    }
    return <Badge variant="info">{dateValue}</Badge>; // Future or Today
};


const columns: ColumnDef<OrderItem>[] = [
  {
    accessorKey: 'service_name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Service" />
    ),
  },
  {
    accessorKey: 'quantity',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Qty" />
    ),
  },
  {
    accessorKey: 'unit_price',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Unit Price" />
    ),
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue('unit_price'));
      const formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(amount);
      return <div className="font-medium">{formatted}</div>;
    },
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
    accessorKey: 'scheduled_date',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Scheduled" />
    ),
     cell: ({ row }) => <DateCell dateValue={row.getValue('scheduled_date')} />,
  },
  {
    accessorKey: 'completed_date',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Completed" />
    ),
    cell: ({ row }) => <DateCell dateValue={row.getValue('completed_date')} />,
  },
];

interface OrderItemsTableProps {
  items: OrderItem[];
  isLoading?: boolean;
}

export function OrderItemsTable({ items, isLoading = false }: OrderItemsTableProps) {
    if (isLoading) {
    return (
      <div className="space-y-4 pt-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }
  return (
    <Card>
      <CardContent className="p-4">
        <DataTable
          columns={columns}
          data={items}
          filterColumnId="service_name"
          filterPlaceholder="Filter by service..."
        />
      </CardContent>
    </Card>
  );
}
