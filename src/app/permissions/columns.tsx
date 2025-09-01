'use client';

import { ColumnDef } from '@tanstack/react-table';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import type { Permission } from '@/lib/types';
import { Badge } from '@/components/ui/badge';

export const permissionColumns: ColumnDef<Permission>[] = [
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
      <DataTableColumnHeader column={column} title="Permission ID" />
    ),
  },
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
  },
  {
    accessorKey: 'action',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Action" />
    ),
     cell: ({ row }) => <Badge variant="secondary" className="capitalize">{row.getValue('action')}</Badge>
  },
  {
    accessorKey: 'resource',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Resource" />
    ),
    cell: ({ row }) => <Badge variant="outline" className="capitalize">{row.getValue('resource')}</Badge>
  },
];
