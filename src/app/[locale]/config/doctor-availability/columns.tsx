
'use client';

import { ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { AvailabilityRule } from '@/lib/types';
import { Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useTranslations } from 'next-intl';
import { formatDate } from '@/lib/utils';
import { createSelectColumn } from '@/components/ui/table-select-column';

const dayOfWeekMap: { [key: number]: string } = {
    1: 'monday',
    2: 'tuesday',
    3: 'wednesday',
    4: 'thursday',
    5: 'friday',
    6: 'saturday',
    7: 'sunday',
};


export const AvailabilityRulesColumnsWrapper = ({ onEdit, onDelete }: { onEdit: (rule: AvailabilityRule) => void; onDelete: (rule: AvailabilityRule) => void; }): ColumnDef<AvailabilityRule>[] => {
    const t = useTranslations('DoctorAvailabilityColumns');
    const tDays = useTranslations('DoctorAvailabilityPage.days');
    const tDialog = useTranslations('DoctorAvailabilityPage.dialog');
    const tGeneral = useTranslations('General');

    const columns: ColumnDef<AvailabilityRule>[] = [
        createSelectColumn<AvailabilityRule>(),
        { accessorKey: 'user_name', header: ({ column }) => <DataTableColumnHeader column={column} title={t('doctor')} /> },
        {
            accessorKey: 'recurrence',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('recurrence')} />,
            cell: ({ row }) => <Badge variant="secondary" className="capitalize">{tDialog(row.original.recurrence)}</Badge>
        },
        {
            accessorKey: 'day_of_week',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('day')} />,
            cell: ({ row }) => row.original.day_of_week ? tDays(dayOfWeekMap[row.original.day_of_week]) : tGeneral('notAvailable'),
        },
        { accessorKey: 'start_time', header: ({ column }) => <DataTableColumnHeader column={column} title={t('startTime')} /> },
        { accessorKey: 'end_time', header: ({ column }) => <DataTableColumnHeader column={column} title={t('endTime')} /> },
        {
            accessorKey: 'start_date',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('startDate')} />,
            cell: ({ row }) => formatDate(row.original.start_date)
        },
        {
            accessorKey: 'end_date',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('endDate')} />,
            cell: ({ row }) => row.original.end_date ? formatDate(row.original.end_date) : tGeneral('notAvailable')
        },
        {
            id: 'actions',
            cell: ({ row }) => {
                const rule = row.original;
            return (
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <button type="button" className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" onClick={() => onEdit(rule)}>
                <Pencil className="h-3.5 w-3.5" />
                <span className="text-[9px] font-medium leading-tight">{t('edit')}</span>
              </button>
              <button type="button" className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" onClick={() => onDelete(rule)}>
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
