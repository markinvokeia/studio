
'use client';

import { ColumnDef, RowSelectionState } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Order } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';


const columns: ColumnDef<Order>[] = [
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
      <DataTableColumnHeader column={column} title="Order ID" />
    ),
  },
  {
    accessorKey: 'status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => {
      const status = row.getValue('status') as string;
      const variant = {
        completed: 'success',
        pending: 'info',
        processing: 'default',
        cancelled: 'destructive',
      }[status?.toLowerCase() ?? ''] ?? ('default' as any);

      return (
        <Badge variant={variant} className="capitalize">
          {status}
        </Badge>
      );
    },
  },
  {
    accessorKey: 'createdAt',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Created At" />
    ),
  },
];

interface OrdersTableProps {
  orders: Order[];
  isLoading?: boolean;
  onRowSelectionChange?: (selectedRows: Order[]) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  title?: string;
  description?: string;
  rowSelection?: RowSelectionState;
  setRowSelection?: (selection: RowSelectionState) => void;
}

export function OrdersTable({ orders, isLoading = false, onRowSelectionChange, onRefresh, isRefreshing, title, description, rowSelection, setRowSelection }: OrdersTableProps) {
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
          data={orders}
          filterColumnId="id"
          filterPlaceholder="Filter by order ID..."
          onRowSelectionChange={onRowSelectionChange}
          enableSingleRowSelection={onRowSelectionChange ? true : false}
          onRefresh={onRefresh}
          isRefreshing={isRefreshing}
          rowSelection={rowSelection}
          setRowSelection={setRowSelection}
        />
      </CardContent>
    </Card>
  );
}
