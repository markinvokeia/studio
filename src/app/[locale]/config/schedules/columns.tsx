
'use client';

import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { ClinicSchedule } from '@/lib/types';
import { ColumnDef } from '@tanstack/react-table';
import { Pencil, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { createSelectColumn } from '@/components/ui/table-select-column';

const dayOfWeekMap: { [key: number]: string } = {
    0: 'sunday',
    1: 'monday',
    2: 'tuesday',
    3: 'wednesday',
    4: 'thursday',
    5: 'friday',
    6: 'saturday',
};


export const SchedulesColumnsWrapper = ({
    onEdit,
    onDelete,
    canEdit = true,
    canDelete = true,
}: {
    onEdit: (schedule: ClinicSchedule) => void;
    onDelete: (schedule: ClinicSchedule) => void;
    canEdit?: boolean;
    canDelete?: boolean;
}): ColumnDef<ClinicSchedule>[] => {
    const t = useTranslations('SchedulesPage.columns');
    const tDays = useTranslations('SchedulesPage.days');

    const columns: ColumnDef<ClinicSchedule>[] = [
        createSelectColumn<ClinicSchedule>(),
        { accessorKey: 'id', header: ({ column }) => <DataTableColumnHeader column={column} title={t('id')} /> },
        {
            accessorKey: 'day_of_week',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('dayOfWeek')} />,
            cell: ({ row }) => tDays(dayOfWeekMap[row.original.day_of_week] as any) || 'Unknown Day',
            filterFn: (row, id, value) => {
                const dayName = tDays(dayOfWeekMap[row.original.day_of_week] as any) || 'Unknown Day';
                return dayName.toLowerCase().includes(String(value).toLowerCase());
            },
        },
        { accessorKey: 'start_time', header: ({ column }) => <DataTableColumnHeader column={column} title={t('startTime')} /> },
        { accessorKey: 'end_time', header: ({ column }) => <DataTableColumnHeader column={column} title={t('endTime')} /> },
        {
            id: 'actions',
            cell: ({ row }) => {
                const schedule = row.original;
            return (
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              {canEdit && <button type="button" className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" onClick={() => onEdit(schedule)}>
                <Pencil className="h-3.5 w-3.5" />
                <span className="text-[9px] font-medium leading-tight">{t('edit')}</span>
              </button>}
              {canDelete && <button type="button" className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" onClick={() => onDelete(schedule)}>
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
