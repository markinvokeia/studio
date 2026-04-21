'use client';

import { ColumnDef } from '@tanstack/react-table';
import { Pencil, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { createSelectColumn } from '@/components/ui/table-select-column';

import { Clinic } from '@/lib/types';

interface ClinicsColumnsProps {
    t: ReturnType<typeof useTranslations>;
}

export const getClinicsColumns = ({ t }: ClinicsColumnsProps): ColumnDef<Clinic>[] => [
    createSelectColumn<Clinic>(),
    { accessorKey: 'id', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.id')} /> },
    { accessorKey: 'name', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.name')} /> },
    { accessorKey: 'location', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.location')} /> },
    { accessorKey: 'contact_email', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.email')} /> },
    { accessorKey: 'phone_number', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.phone')} /> },
    {
        id: 'actions',
        cell: () => (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <button type="button" className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                    <Pencil className="h-3.5 w-3.5" />
                    <span className="text-[9px] font-medium leading-tight">{t('columns.edit')}</span>
                </button>
                <button type="button" className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="text-[9px] font-medium leading-tight">{t('columns.delete')}</span>
                </button>
            </div>
        ),
    },
];

export function ClinicsColumnsWrapper(): ColumnDef<Clinic>[] {
    const t = useTranslations('ClinicDetailsPage');

    return React.useMemo(() => getClinicsColumns({ t }), [t]);
}
