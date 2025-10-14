
'use client';

import { ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { DentalCondition } from '@/lib/types';
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

interface DentalConditionsColumnsProps {
    onEdit: (condition: DentalCondition) => void;
    onDelete: (condition: DentalCondition) => void;
}

export const DentalConditionsColumnsWrapper = ({ onEdit, onDelete }: DentalConditionsColumnsProps) => {
    const t = useTranslations('DentalConditionsColumns');
    const columns: ColumnDef<DentalCondition>[] = [
        { accessorKey: 'id', header: ({column}) => <DataTableColumnHeader column={column} title={t('id')} /> },
        { accessorKey: 'nombre', header: ({column}) => <DataTableColumnHeader column={column} title={t('name')} /> },
        { accessorKey: 'codigo_visual', header: ({column}) => <DataTableColumnHeader column={column} title={t('visualCode')} /> },
        { 
            accessorKey: 'color_hex', 
            header: ({column}) => <DataTableColumnHeader column={column} title={t('color')} />,
            cell: ({ row }) => {
                const color = row.original.color_hex || '#ffffff';
                return (
                    <div className="flex items-center gap-2">
                        <div className="h-4 w-4 rounded-full border" style={{ backgroundColor: color }} />
                        <span>{color}</span>
                    </div>
                );
            }
        },
        {
            id: 'actions',
            cell: ({ row }) => {
            const condition = row.original;
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
                    <DropdownMenuItem onClick={() => onEdit(condition)}>{t('edit')}</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onDelete(condition)} className="text-destructive">{t('delete')}</DropdownMenuItem>
                </DropdownMenuContent>
                </DropdownMenu>
            );
            },
        },
    ];
    return columns;
};
