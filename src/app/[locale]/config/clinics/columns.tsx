'use client';

import { ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Clinic } from '@/lib/types';
import { Pencil, Trash2 } from 'lucide-react';
import { createSelectColumn } from '@/components/ui/table-select-column';

export const clinicsColumns: ColumnDef<Clinic>[] = [
    createSelectColumn<Clinic>(),
    { accessorKey: 'id', header: ({column}) => <DataTableColumnHeader column={column} title="ID" /> },
    { accessorKey: 'name', header: ({column}) => <DataTableColumnHeader column={column} title="Name" /> },
    { accessorKey: 'location', header: ({column}) => <DataTableColumnHeader column={column} title="Address" /> },
    { accessorKey: 'contact_email', header: ({column}) => <DataTableColumnHeader column={column} title="Email" /> },
    { accessorKey: 'phone_number', header: ({column}) => <DataTableColumnHeader column={column} title="Phone" /> },
    {
        id: 'actions',
        cell: ({ row }) => {
        void row.original;
        return (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <button type="button" className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                    <Pencil className="h-3.5 w-3.5" />
                    <span className="text-[9px] font-medium leading-tight">Edit</span>
                </button>
                <button type="button" className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="text-[9px] font-medium leading-tight">Delete</span>
                </button>
            </div>
        );
        },
    },
];
