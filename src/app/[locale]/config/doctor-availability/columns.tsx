
'use client';

import { ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { AvailabilityRule } from '@/lib/types';
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

interface AvailabilityRulesColumnsProps {
    onEdit: (rule: AvailabilityRule) => void;
    onDelete: (rule: AvailabilityRule) => void;
}

const dayOfWeekMap: { [key: number]: string } = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
  7: 'Sunday',
};


export const AvailabilityRulesColumnsWrapper = ({ onEdit, onDelete }: AvailabilityRulesColumnsProps): ColumnDef<AvailabilityRule>[] => {
    
    const columns: ColumnDef<AvailabilityRule>[] = [
        { accessorKey: 'user_name', header: ({column}) => <DataTableColumnHeader column={column} title="Doctor" /> },
        { 
          accessorKey: 'recurrence', 
          header: ({column}) => <DataTableColumnHeader column={column} title="Recurrence" />,
          cell: ({ row }) => <Badge variant="secondary" className="capitalize">{row.original.recurrence}</Badge>
        },
        { 
            accessorKey: 'day_of_week', 
            header: ({column}) => <DataTableColumnHeader column={column} title="Day" />,
            cell: ({ row }) => row.original.day_of_week ? dayOfWeekMap[row.original.day_of_week] : 'N/A',
        },
        { accessorKey: 'start_time', header: ({column}) => <DataTableColumnHeader column={column} title="Start Time" /> },
        { accessorKey: 'end_time', header: ({column}) => <DataTableColumnHeader column={column} title="End Time" /> },
        { accessorKey: 'start_date', header: ({column}) => <DataTableColumnHeader column={column} title="Start Date" /> },
        { accessorKey: 'end_date', header: ({column}) => <DataTableColumnHeader column={column} title="End Date" /> },
        {
            id: 'actions',
            cell: ({ row }) => {
            const rule = row.original;
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
                    <DropdownMenuItem onClick={() => onEdit(rule)}>Edit</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onDelete(rule)} className="text-destructive">Delete</DropdownMenuItem>
                </DropdownMenuContent>
                </DropdownMenu>
            );
            },
        },
    ];
    return columns;
}
