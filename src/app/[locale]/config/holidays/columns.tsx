
'use client';

import { ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { ClinicException } from '@/lib/types';
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

interface HolidaysColumnsProps {
    onEdit: (holiday: ClinicException) => void;
    onDelete: (holiday: ClinicException) => void;
}

export const HolidaysColumnsWrapper = ({ onEdit, onDelete }: HolidaysColumnsProps): ColumnDef<ClinicException>[] => {
    const t = useTranslations('HolidaysPage.columns');
    
    const columns: ColumnDef<ClinicException>[] = [
        { accessorKey: 'id', header: ({column}) => <DataTableColumnHeader column={column} title={t('id')} /> },
        { accessorKey: 'date', header: ({column}) => <DataTableColumnHeader column={column} title={t('date')} /> },
        { 
        accessorKey: 'is_open', 
        header: ({column}) => <DataTableColumnHeader column={column} title={t('status')} />,
        cell: ({ row }) => <Badge variant={row.original.is_open ? 'success' : 'destructive'}>{row.original.is_open ? t('open') : t('closed')}</Badge>,
        },
        { accessorKey: 'start_time', header: ({column}) => <DataTableColumnHeader column={column} title={t('startTime')} /> },
        { accessorKey: 'end_time', header: ({column}) => <DataTableColumnHeader column={column} title={t('endTime')} /> },
        { accessorKey: 'notes', header: ({column}) => <DataTableColumnHeader column={column} title={t('notes')} /> },
        {
            id: 'actions',
            cell: ({ row }) => {
            const holiday = row.original;
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
                    <DropdownMenuItem onClick={() => onEdit(holiday)}>{t('edit')}</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onDelete(holiday)} className="text-destructive">{t('delete')}</DropdownMenuItem>
                </DropdownMenuContent>
                </DropdownMenu>
            );
            },
        },
    ];
    return columns;
}
