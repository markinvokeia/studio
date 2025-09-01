'use client';

import { ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { ClinicException } from '@/lib/types';
import { Badge } from '@/components/ui/badge';

export const holidaysColumns: ColumnDef<ClinicException>[] = [
    { accessorKey: 'id', header: ({column}) => <DataTableColumnHeader column={column} title="ID" /> },
    { accessorKey: 'date', header: ({column}) => <DataTableColumnHeader column={column} title="Date" /> },
    { 
      accessorKey: 'is_open', 
      header: ({column}) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => <Badge variant={row.original.is_open ? 'success' : 'destructive'}>{row.original.is_open ? 'Open' : 'Closed'}</Badge>,
    },
    { accessorKey: 'start_time', header: ({column}) => <DataTableColumnHeader column={column} title="Start Time" /> },
    { accessorKey: 'end_time', header: ({column}) => <DataTableColumnHeader column={column} title="End Time" /> },
    { accessorKey: 'notes', header: ({column}) => <DataTableColumnHeader column={column} title="Notes" /> },
];
