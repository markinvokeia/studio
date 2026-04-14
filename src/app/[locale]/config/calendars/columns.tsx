
'use client';

import { ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Calendar } from '@/lib/types';
import { Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useTranslations } from 'next-intl';
import { createSelectColumn } from '@/components/ui/table-select-column';

interface CalendarsColumnsProps {
    onEdit: (calendar: Calendar) => void;
    onDelete: (calendar: Calendar) => void;
}


export const CalendarsColumnsWrapper = ({ onEdit, onDelete }: CalendarsColumnsProps): ColumnDef<Calendar>[] => {
    const t = useTranslations('CalendarsPage.columns');
    const columns: ColumnDef<Calendar>[] = [
        createSelectColumn<Calendar>(),
        { accessorKey: 'name', header: ({column}) => <DataTableColumnHeader column={column} title={t('name')} /> },
        { accessorKey: 'google_calendar_id', header: ({column}) => <DataTableColumnHeader column={column} title={t('googleCalendarId')} /> },
        { 
            accessorKey: 'color', 
            header: ({column}) => <DataTableColumnHeader column={column} title={t('color')} />,
            cell: ({ row }) => {
                const color = row.original.color || '#ffffff';
                return (
                    <div className="flex items-center gap-2">
                        <div className="h-4 w-4 rounded-full border" style={{ backgroundColor: color }} />
                        <span>{color}</span>
                    </div>
                );
            }
        },
        { 
        accessorKey: 'is_active', 
        header: ({column}) => <DataTableColumnHeader column={column} title={t('active')} />,
        cell: ({ row }) => <Badge variant={row.original.is_active ? 'success' : 'outline'}>{row.original.is_active ? t('yes') : t('no')}</Badge>,
        },
        {
            id: 'actions',
            cell: ({ row }) => {
            const calendar = row.original;
        return (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" onClick={() => onEdit(calendar)}>
            <Pencil className="h-3.5 w-3.5" />
            <span className="text-[9px] font-medium leading-tight">{t('edit')}</span>
          </button>
          <button type="button" className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" onClick={() => onDelete(calendar)}>
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
