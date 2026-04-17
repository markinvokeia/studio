
'use client';

import { Badge } from '@/components/ui/badge';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { ClinicException } from '@/lib/types';
import { ColumnDef } from '@tanstack/react-table';
import { Pencil, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { createSelectColumn } from '@/components/ui/table-select-column';

interface HolidaysColumnsProps {
    onEdit: (holiday: ClinicException) => void;
    onDelete: (holiday: ClinicException) => void;
    canEdit?: boolean;
    canDelete?: boolean;
}

export const HolidaysColumnsWrapper = ({ onEdit, onDelete, canEdit = true, canDelete = true }: HolidaysColumnsProps): ColumnDef<ClinicException>[] => {
    const t = useTranslations('HolidaysPage.columns');

    const columns: ColumnDef<ClinicException>[] = [
        createSelectColumn<ClinicException>(),
        { accessorKey: 'id', header: ({ column }) => <DataTableColumnHeader column={column} title={t('id')} /> },
        { accessorKey: 'date', header: ({ column }) => <DataTableColumnHeader column={column} title={t('date')} /> },
        {
            accessorKey: 'is_open',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('status')} />,
            cell: ({ row }) => <Badge variant={row.original.is_open ? 'success' : 'destructive'}>{row.original.is_open ? t('open') : t('closed')}</Badge>,
        },
        { accessorKey: 'start_time', header: ({ column }) => <DataTableColumnHeader column={column} title={t('startTime')} /> },
        { accessorKey: 'end_time', header: ({ column }) => <DataTableColumnHeader column={column} title={t('endTime')} /> },
        { accessorKey: 'notes', header: ({ column }) => <DataTableColumnHeader column={column} title={t('notes')} /> },
        {
            id: 'actions',
            cell: ({ row }) => {
                const holiday = row.original;
            return (
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              {canEdit && <button type="button" className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" onClick={() => onEdit(holiday)}>
                <Pencil className="h-3.5 w-3.5" />
                <span className="text-[9px] font-medium leading-tight">{t('edit')}</span>
              </button>}
              {canDelete && <button type="button" className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" onClick={() => onDelete(holiday)}>
                <Trash2 className="h-3.5 w-3.5" />
                <span className="text-[9px] font-medium leading-tight">{t('delete')}</span>
              </button>}
              </div>
            );
            },
        },
    ];
    return columns;
}
