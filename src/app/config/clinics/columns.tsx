'use client';

import { ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Clinic } from '@/lib/types';

export const clinicsColumns: ColumnDef<Clinic>[] = [
    { accessorKey: 'id', header: ({column}) => <DataTableColumnHeader column={column} title="ID" /> },
    { accessorKey: 'name', header: ({column}) => <DataTableColumnHeader column={column} title="Name" /> },
    { accessorKey: 'location', header: ({column}) => <DataTableColumnHeader column={column} title="Location" /> },
    { accessorKey: 'contact_email', header: ({column}) => <DataTableColumnHeader column={column} title="Email" /> },
    { accessorKey: 'phone_number', header: ({column}) => <DataTableColumnHeader column={column} title="Phone" /> },
];