
'use client';

import { ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Medication } from '@/lib/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface MedicationsColumnsProps {
    onEdit: (medication: Medication) => void;
    onDelete: (medication: Medication) => void;
}

export const MedicationsColumnsWrapper = ({ onEdit, onDelete }: MedicationsColumnsProps) => {
    const t = useTranslations('MedicationsColumns');
    const columns: ColumnDef<Medication>[] = [
        { accessorKey: 'id', header: ({column}) => <DataTableColumnHeader column={column} title={t('id')} /> },
        { accessorKey: 'nombre_generico', header: ({column}) => <DataTableColumnHeader column={column} title={t('genericName')} /> },
        { accessorKey: 'nombre_comercial', header: ({column}) => <DataTableColumnHeader column={column} title={t('commercialName')} /> },
        {
            id: 'actions',
            cell: ({ row }) => {
            const medication = row.original;
            return (
                <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                    <span className="sr-only">Open menu</span>
                    <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuLabel>{t('actions')}</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => onEdit(medication)}>{t('edit')}</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onDelete(medication)} className="text-destructive">{t('delete')}</DropdownMenuItem>
                </DropdownMenuContent>
                </DropdownMenu>
            );
            },
        },
    ];
    return columns;
}
