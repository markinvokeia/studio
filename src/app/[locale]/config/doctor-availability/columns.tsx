
'use client';

import { ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { AvailabilityRule } from '@/lib/types';
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
    
    const columns: ColumnDef<AvailabilityRule>[] = [
        { accessorKey: 'user_name', header: ({column}) => <DataTableColumnHeader column={column} title={t('doctor')} /> },
        { 
          accessorKey: 'recurrence', 
          header: ({column}) => <DataTableColumnHeader column={column} title={t('recurrence')} />,
          cell: ({ row }) => <Badge variant="secondary" className="capitalize">{tDialog(row.original.recurrence)}</Badge>
        },
        { 
            accessorKey: 'day_of_week', 
            header: ({column}) => <DataTableColumnHeader column={column} title={t('day')} />,
            cell: ({ row }) => row.original.day_of_week ? tDays(dayOfWeekMap[row.original.day_of_week]) : 'N/A',
        },
        { accessorKey: 'start_time', header: ({column}) => <DataTableColumnHeader column={column} title={t('startTime')} /> },
        { accessorKey: 'end_time', header: ({column}) => <DataTableColumnHeader column={column} title={t('endTime')} /> },
        { accessorKey: 'start_date', header: ({column}) => <DataTableColumnHeader column={column} title={t('startDate')} /> },
        { accessorKey: 'end_date', header: ({column}) => <DataTableColumnHeader column={column} title={t('endDate')} /> },
        {
            id: 'actions',
            cell: ({ row }) => {
            const rule = row.original;
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
                    <DropdownMenuItem onClick={() => onEdit(rule)}>{t('edit')}</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onDelete(rule)} className="text-destructive">{t('delete')}</DropdownMenuItem>
                </DropdownMenuContent>
                </DropdownMenu>
            );
            },
        },
    ];
    return columns;
}
