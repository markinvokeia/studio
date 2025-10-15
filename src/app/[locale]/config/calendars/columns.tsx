
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

interface CalendarsColumnsProps {
    onEdit: (calendar: Calendar) => void;
    onDelete: (calendar: Calendar) => void;
}


export const CalendarsColumnsWrapper = ({ onEdit, onDelete }: CalendarsColumnsProps): ColumnDef<Calendar>[] => {
    const columns: ColumnDef<Calendar>[] = [
        { accessorKey: 'name', header: ({column}) => <DataTableColumnHeader column={column} title="Name" /> },
        { accessorKey: 'google_calendar_id', header: ({column}) => <DataTableColumnHeader column={column} title="Google Calendar ID" /> },
        { 
        accessorKey: 'is_active', 
        header: ({column}) => <DataTableColumnHeader column={column} title="Active" />,
        cell: ({ row }) => <Badge variant={row.original.is_active ? 'success' : 'outline'}>{row.original.is_active ? 'Yes' : 'No'}</Badge>,
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
                    <DropdownMenuItem onClick={() => onEdit(calendar)}>Edit</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onDelete(calendar)} className="text-destructive">Delete</DropdownMenuItem>
                </DropdownMenuContent>
                </DropdownMenu>
            );
            },
        },
    ];
    return columns;
}
