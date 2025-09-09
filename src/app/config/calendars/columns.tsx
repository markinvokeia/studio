'use client';

import { ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Calendar } from '@/lib/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreHorizontal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export const calendarsColumns: ColumnDef<Calendar>[] = [
    { accessorKey: 'id', header: ({column}) => <DataTableColumnHeader column={column} title="ID" /> },
    { accessorKey: 'name', header: ({column}) => <DataTableColumnHeader column={column} title="Name" /> },
    { accessorKey: 'description', header: ({column}) => <DataTableColumnHeader column={column} title="Description" /> },
    { accessorKey: 'timezone', header: ({column}) => <DataTableColumnHeader column={column} title="Timezone" /> },
    { 
      accessorKey: 'is_default', 
      header: ({column}) => <DataTableColumnHeader column={column} title="Default" />,
      cell: ({ row }) => <Badge variant={row.original.is_default ? 'success' : 'outline'}>{row.original.is_default ? 'Yes' : 'No'}</Badge>,
    },
    {
        id: 'actions',
        cell: ({ row }) => {
        const calendar = row.original;
        return (
            <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuItem>Edit</DropdownMenuItem>
                <DropdownMenuItem>Delete</DropdownMenuItem>
            </DropdownMenuContent>
            </DropdownMenu>
        );
        },
    },
];
