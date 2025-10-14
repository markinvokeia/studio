
'use client';

import { ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Ailment } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
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

interface AilmentsColumnsProps {
    onEdit: (ailment: Ailment) => void;
    onDelete: (ailment: Ailment) => void;
}

export const AilmentsColumnsWrapper = ({ onEdit, onDelete }: AilmentsColumnsProps) => {
    const t = useTranslations('AilmentsColumns');
    const columns: ColumnDef<Ailment>[] = [
        { accessorKey: 'id', header: ({column}) => <DataTableColumnHeader column={column} title={t('id')} /> },
        { accessorKey: 'nombre', header: ({column}) => <DataTableColumnHeader column={column} title={t('name')} /> },
        { accessorKey: 'categoria', header: ({column}) => <DataTableColumnHeader column={column} title={t('category')} /> },
        { 
          accessorKey: 'nivel_alerta', 
          header: ({column}) => <DataTableColumnHeader column={column} title={t('alertLevel')} />,
          cell: ({ row }) => {
            const level = row.original.nivel_alerta;
            const variant = {
                1: 'success',
                2: 'info',
                3: 'destructive',
            }[level] || 'default';
            return <Badge variant={variant as any}>{level}</Badge>;
          }
        },
        {
            id: 'actions',
            cell: ({ row }) => {
            const ailment = row.original;
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
                    <DropdownMenuItem onClick={() => onEdit(ailment)}>{t('edit')}</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onDelete(ailment)} className="text-destructive">{t('delete')}</DropdownMenuItem>
                </DropdownMenuContent>
                </DropdownMenu>
            );
            },
        },
    ];
    return columns;
}
