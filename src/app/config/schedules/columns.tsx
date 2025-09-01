'use client';

import { ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { ClinicSchedule } from '@/lib/types';

const dayOfWeekMap: { [key: number]: string } = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
};

export const schedulesColumns: ColumnDef<ClinicSchedule>[] = [
    { accessorKey: 'id', header: ({column}) => <DataTableColumnHeader column={column} title="ID" /> },
    { 
      accessorKey: 'day_of_week', 
      header: ({column}) => <DataTableColumnHeader column={column} title="Day of Week" />,
      cell: ({ row }) => dayOfWeekMap[row.original.day_of_week] || 'Unknown Day',
    },
    { accessorKey: 'start_time', header: ({column}) => <DataTableColumnHeader column={column} title="Start Time" /> },
    { accessorKey: 'end_time', header: ({column}) => <DataTableColumnHeader column={column} title="End Time" /> },
];
