
'use client';

import { ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { AvailabilityException } from '@/lib/types';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreHorizontal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useTranslations } from 'next-intl';

interface ExceptionsColumnsProps {
    onEdit: (exception: AvailabilityException) => void;
    onDelete: (exception: AvailabilityException) => void;
}


export const ExceptionsColumnsWrapper = ({ onEdit, onDelete }: ExceptionsColumnsProps): ColumnDef<AvailabilityException>[] => {
    const t = useTranslations('DoctorAvailabilityExceptionsPage.columns');

    const columns: ColumnDef<AvailabilityException>[] = [
        { accessorKey: 'user_name', header: ({ column }) => <DataTableColumnHeader column={column} title={t('doctor')} /> },
        { accessorKey: 'exception_date', header: ({ column }) => <DataTableColumnHeader column={column} title={t('date')} /> },
        {
            accessorKey: 'is_available',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('available')} />,
            cell: ({ row }) => <Badge variant={row.original.is_available ? 'success' : 'destructive'}>{row.original.is_available ? t('yes') : t('no')}</Badge>
        },
        { accessorKey: 'start_time', header: ({ column }) => <DataTableColumnHeader column={column} title={t('startTime')} /> },
        { accessorKey: 'end_time', header: ({ column }) => <DataTableColumnHeader column={column} title={t('endTime')} /> },
        {
            id: 'actions',
            cell: ({ row }) => {
                const exception = row.original;
                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">{t('openMenu')}</span>
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>{t('actions')}</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => onEdit(exception)}>{t('edit')}</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onDelete(exception)} className="text-destructive">{t('delete')}</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                );
            },
        },
    ];
    return columns;
}
