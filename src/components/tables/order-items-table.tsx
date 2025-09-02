
'use client';

import { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { OrderItem } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const columns: ColumnDef<OrderItem>[] = [
  {
    accessorKey: 'id',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Item ID" />
    ),
  },
  {
    accessorKey: 'service_id',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Service ID" />
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
          filterColumnId="service_id"
          filterPlaceholder="Filter by service..."
        />
      </CardContent>
    </Card>
  );
}
