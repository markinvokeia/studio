
'use client';

import { ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { ClinicSchedule } from '@/lib/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreHorizontal } from 'lucide-react';

const dayOfWeekMap: { [key: number]: string } = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
};

interface SchedulesColumnsProps {
    onEdit: (schedule: ClinicSchedule) => void;
    onDelete: (schedule: ClinicSchedule) => void;
}

export const SchedulesColumnsWrapper = ({ onEdit, onDelete }: SchedulesColumnsProps): ColumnDef<ClinicSchedule>[] => {
    
    const columns: ColumnDef<ClinicSchedule>[] = [
        { accessorKey: 'id', header: ({column}) => <DataTableColumnHeader column={column} title="ID" /> },
        { 
        accessorKey: 'day_of_week', 
        header: ({column}) => <DataTableColumnHeader column={column} title="Day of Week" />,
        cell: ({ row }) => dayOfWeekMap[row.original.day_of_week] || 'Unknown Day',
        },
        { accessorKey: 'start_time', header: ({column}) => <DataTableColumnHeader column={column} title="Start Time" /> },
        { accessorKey: 'end_time', header: ({column}) => <DataTableColumnHeader column={column} title="End Time" /> },
        {
            id: 'actions',
            cell: ({ row }) => {
            const schedule = row.original;
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
                    <DropdownMenuItem onClick={() => onEdit(schedule)}>Edit</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onDelete(schedule)} className="text-destructive">Delete</DropdownMenuItem>
                </DropdownMenuContent>
                </DropdownMenu>
            );
            },
        },
    ];

    return columns;
}

    