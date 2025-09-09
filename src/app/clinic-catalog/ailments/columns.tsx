
'use client';

import { ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Ailment } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreHorizontal } from 'lucide-react';

export const ailmentsColumns: ColumnDef<Ailment>[] = [
    { accessorKey: 'id', header: ({column}) => <DataTableColumnHeader column={column} title="ID" /> },
    { accessorKey: 'nombre', header: ({column}) => <DataTableColumnHeader column={column} title="Name" /> },
    { accessorKey: 'categoria', header: ({column}) => <DataTableColumnHeader column={column} title="Category" /> },
    { 
      accessorKey: 'nivel_alerta', 
      header: ({column}) => <DataTableColumnHeader column={column} title="Alert Level" />,
      cell: ({ row }) => {
        const level = row.original.nivel_alerta;
        const variant = {
            1: 'success',
            2: 'info',
            3: 'destructive',
        }[level] || 'default';
        return <Badge variant={variant as any}>{level}</Badge>;
      }
    },
    {
        id: 'actions',
        cell: ({ row }) => {
        const ailment = row.original;
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
