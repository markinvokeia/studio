
'use client';

import { ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { SystemConfiguration } from '@/lib/types';
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

interface ConfigsColumnsProps {
    onEdit: (config: SystemConfiguration) => void;
    onDelete: (config: SystemConfiguration) => void;
}


export const ConfigsColumnsWrapper = ({ onEdit, onDelete }: ConfigsColumnsProps): ColumnDef<SystemConfiguration>[] => {
    const columns: ColumnDef<SystemConfiguration>[] = [
        { accessorKey: 'id', header: ({column}) => <DataTableColumnHeader column={column} title="ID" /> },
        { accessorKey: 'key', header: ({column}) => <DataTableColumnHeader column={column} title="Key" /> },
        { accessorKey: 'value', header: ({column}) => <DataTableColumnHeader column={column} title="Value" /> },
        { accessorKey: 'description', header: ({column}) => <DataTableColumnHeader column={column} title="Description" /> },
        { accessorKey: 'data_type', header: ({column}) => <DataTableColumnHeader column={column} title="Type" /> },
        { 
            accessorKey: 'is_public', 
            header: ({column}) => <DataTableColumnHeader column={column} title="Is Public" />,
            cell: ({ row }) => <Badge variant={row.original.is_public ? 'success' : 'outline'}>{row.original.is_public ? 'Yes' : 'No'}</Badge>,
        },
        { accessorKey: 'updated_by', header: ({column}) => <DataTableColumnHeader column={column} title="Updated By" /> },
        {
            id: 'actions',
            cell: ({ row }) => {
            const config = row.original;
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
                    <DropdownMenuItem onClick={() => onEdit(config)}>Edit</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onDelete(config)} className="text-destructive">Delete</DropdownMenuItem>
                </DropdownMenuContent>
                </DropdownMenu>
            );
            },
        },
    ];
    return columns;
}
