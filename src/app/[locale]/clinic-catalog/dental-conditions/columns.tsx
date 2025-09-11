
'use client';

import { ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { DentalCondition } from '@/lib/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreHorizontal } from 'lucide-react';

export const dentalConditionsColumns: ColumnDef<DentalCondition>[] = [
    { accessorKey: 'id', header: ({column}) => <DataTableColumnHeader column={column} title="ID" /> },
    { accessorKey: 'nombre', header: ({column}) => <DataTableColumnHeader column={column} title="Name" /> },
    { accessorKey: 'codigo_visual', header: ({column}) => <DataTableColumnHeader column={column} title="Visual Code" /> },
    { 
        accessorKey: 'color_hex', 
        header: ({column}) => <DataTableColumnHeader column={column} title="Color" />,
        cell: ({ row }) => {
            const color = row.original.color_hex || '#ffffff';
            return (
                <div className="flex items-center gap-2">
                    <div className="h-4 w-4 rounded-full border" style={{ backgroundColor: color }} />
                    <span>{color}</span>
                </div>
            );
        }
    },
    {
        id: 'actions',
        cell: ({ row }) => {
        const condition = row.original;
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
