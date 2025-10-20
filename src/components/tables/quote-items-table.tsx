
'use client';

import { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { QuoteItem } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal } from 'lucide-react';

interface QuoteItemsTableProps {
  items: QuoteItem[];
  isLoading?: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  canEdit: boolean;
  onCreate: () => void;
  onEdit: (item: QuoteItem) => void;
  onDelete: (item: QuoteItem) => void;
}

const getColumns = (
  onEdit: (item: QuoteItem) => void,
  onDelete: (item: QuoteItem) => void,
  canEdit: boolean
): ColumnDef<QuoteItem>[] => [
  {
    accessorKey: 'id',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="ID" />
    ),
  },
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
    id: 'actions',
    cell: ({ row }) => {
      const item = row.original;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0" disabled={!canEdit}>
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onEdit(item)}>Edit</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDelete(item)} className="text-destructive">Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];

export function QuoteItemsTable({ items, isLoading = false, onRefresh, isRefreshing, canEdit, onCreate, onEdit, onDelete }: QuoteItemsTableProps) {
    const columns = getColumns(onEdit, onDelete, canEdit);
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
          onRefresh={onRefresh}
          isRefreshing={isRefreshing}
          onCreate={canEdit ? onCreate : undefined}
        />
      </CardContent>
    </Card>
  );
}
