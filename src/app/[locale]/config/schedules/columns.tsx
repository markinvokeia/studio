
'use client';

import { ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { ClinicSchedule } from '@/lib/types';
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

const dayOfWeekMap: { [key: number]: string } = {
  0: 'sunday',
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
};

interface SchedulesColumnsProps {
    onEdit: (schedule: ClinicSchedule) => void;
    onDelete: (schedule: ClinicSchedule) => void;
}

export const SchedulesColumnsWrapper = ({ onEdit, onDelete }: SchedulesColumnsProps): ColumnDef<ClinicSchedule>[] => {
    const t = useTranslations('SchedulesPage.columns');
    const tDays = useTranslations('SchedulesPage.days');
    
    const columns: ColumnDef<ClinicSchedule>[] = [
        { accessorKey: 'id', header: ({column}) => <DataTableColumnHeader column={column} title={t('id')} /> },
        { 
        accessorKey: 'day_of_week', 
        header: ({column}) => <DataTableColumnHeader column={column} title={t('dayOfWeek')} />,
        cell: ({ row }) => tDays(dayOfWeekMap[row.original.day_of_week] as any) || 'Unknown Day',
        },
        { accessorKey: 'start_time', header: ({column}) => <DataTableColumnHeader column={column} title={t('startTime')} /> },
        { accessorKey: 'end_time', header: ({column}) => <DataTableColumnHeader column={column} title={t('endTime')} /> },
        {
            id: 'actions',
            cell: ({ row }) => {
            const schedule = row.original;
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
                    <DropdownMenuItem onClick={() => onEdit(schedule)}>{t('edit')}</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onDelete(schedule)} className="text-destructive">{t('delete')}</DropdownMenuItem>
                </DropdownMenuContent>
                </DropdownMenu>
            );
            },
        },
    ];

    return columns;
}
