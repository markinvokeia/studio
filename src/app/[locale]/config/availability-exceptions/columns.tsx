
'use client';

import { ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { AvailabilityException } from '@/lib/types';
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

interface ExceptionsColumnsProps {
    onEdit: (exception: AvailabilityException) => void;
    onDelete: (exception: AvailabilityException) => void;
}


export const ExceptionsColumnsWrapper = ({ onEdit, onDelete }: ExceptionsColumnsProps): ColumnDef<AvailabilityException>[] => {
    
    const columns: ColumnDef<AvailabilityException>[] = [
        { accessorKey: 'user_name', header: ({column}) => <DataTableColumnHeader column={column} title="Doctor" /> },
        { accessorKey: 'exception_date', header: ({column}) => <DataTableColumnHeader column={column} title="Date" /> },
        { 
          accessorKey: 'is_available', 
          header: ({column}) => <DataTableColumnHeader column={column} title="Available" />,
          cell: ({ row }) => <Badge variant={row.original.is_available ? 'success' : 'destructive'}>{row.original.is_available ? 'Yes' : 'No'}</Badge>
        },
        { accessorKey: 'start_time', header: ({column}) => <DataTableColumnHeader column={column} title="Start Time" /> },
        { accessorKey: 'end_time', header: ({column}) => <DataTableColumnHeader column={column} title="End Time" /> },
        {
            id: 'actions',
            cell: ({ row }) => {
            const exception = row.original;
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
                    <DropdownMenuItem onClick={() => onEdit(exception)}>Edit</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onDelete(exception)} className="text-destructive">Delete</DropdownMenuItem>
                </DropdownMenuContent>
                </DropdownMenu>
            );
            },
        },
    ];
    return columns;
}
