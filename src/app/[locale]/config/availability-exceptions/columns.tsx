
'use client';

import { ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { AvailabilityException } from '@/lib/types';
import { Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useTranslations } from 'next-intl';
import { createSelectColumn } from '@/components/ui/table-select-column';

interface ExceptionsColumnsProps {
    onEdit: (exception: AvailabilityException) => void;
    onDelete: (exception: AvailabilityException) => void;
}


export const ExceptionsColumnsWrapper = ({ onEdit, onDelete }: ExceptionsColumnsProps): ColumnDef<AvailabilityException>[] => {
    const t = useTranslations('DoctorAvailabilityExceptionsPage.columns');

    const columns: ColumnDef<AvailabilityException>[] = [
        createSelectColumn<AvailabilityException>(),
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
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <button type="button" className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" onClick={() => onEdit(exception)}>
                <Pencil className="h-3.5 w-3.5" />
                <span className="text-[9px] font-medium leading-tight">{t('edit')}</span>
              </button>
              <button type="button" className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" onClick={() => onDelete(exception)}>
                <Trash2 className="h-3.5 w-3.5" />
                <span className="text-[9px] font-medium leading-tight">{t('delete')}</span>
              </button>
              </div>
            );
            },
        },
    ];
    return columns;
}
