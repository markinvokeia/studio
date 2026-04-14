
'use client';

import { ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { DentalCondition } from '@/lib/types';
import { Can } from '@/components/auth/Can';
import { Pencil, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { createSelectColumn } from '@/components/ui/table-select-column';

interface DentalConditionsColumnsProps {
    onEdit: (condition: DentalCondition) => void;
    onDelete: (condition: DentalCondition) => void;
    canEdit?: boolean;
    canDelete?: boolean;
}

export const DentalConditionsColumnsWrapper = ({ onEdit, onDelete }: DentalConditionsColumnsProps) => {
    const t = useTranslations('DentalConditionsColumns');
    const columns: ColumnDef<DentalCondition>[] = [
        createSelectColumn<DentalCondition>(),
        { accessorKey: 'id', header: ({column}) => <DataTableColumnHeader column={column} title={t('id')} /> },
        { accessorKey: 'nombre', header: ({column}) => <DataTableColumnHeader column={column} title={t('name')} /> },
        { accessorKey: 'codigo_visual', header: ({column}) => <DataTableColumnHeader column={column} title={t('visualCode')} /> },
        { 
            accessorKey: 'color_hex', 
            header: ({column}) => <DataTableColumnHeader column={column} title={t('color')} />,
            cell: ({ row }) => {
                const color = row.original.color_hex || '#ffffff';
                return (
                    <div className="flex items-center gap-2">
                        <div className="h-4 w-4 rounded-full border" style={{ backgroundColor: color }} />
                        <span>{color}</span>
                    </div>
                );
            }
        },
        {
            id: 'actions',
            cell: ({ row }) => {
            const condition = row.original;
                    return (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button type="button" className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" onClick={() => onEdit(condition)}>
                        <Pencil className="h-3.5 w-3.5" />
                        <span className="text-[9px] font-medium leading-tight">{t('edit')}</span>
                      </button>
                      <button type="button" className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" onClick={() => onDelete(condition)}>
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="text-[9px] font-medium leading-tight">{t('delete')}</span>
                      </button>
                      </div>
                    );
            },
        },
    ];
    return columns;
};
