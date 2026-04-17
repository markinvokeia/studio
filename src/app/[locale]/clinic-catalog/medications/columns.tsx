
'use client';

import { ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Medication } from '@/lib/types';
import { Can } from '@/components/auth/Can';
import { Pencil, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { createSelectColumn } from '@/components/ui/table-select-column';

interface MedicationsColumnsProps {
    onEdit: (medication: Medication) => void;
    onDelete: (medication: Medication) => void;
    canEdit?: boolean;
    canDelete?: boolean;
}

export const MedicationsColumnsWrapper = ({ onEdit, onDelete }: MedicationsColumnsProps) => {
    const t = useTranslations('MedicationsColumns');
    const columns: ColumnDef<Medication>[] = [
        createSelectColumn<Medication>(),
        { accessorKey: 'id', header: ({column}) => <DataTableColumnHeader column={column} title={t('id')} /> },
        { accessorKey: 'nombre_generico', header: ({column}) => <DataTableColumnHeader column={column} title={t('genericName')} /> },
        { accessorKey: 'nombre_comercial', header: ({column}) => <DataTableColumnHeader column={column} title={t('commercialName')} /> },
        {
            id: 'actions',
            cell: ({ row }) => {
            const medication = row.original;
                    return (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button type="button" className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" onClick={() => onEdit(medication)}>
                        <Pencil className="h-3.5 w-3.5" />
                        <span className="text-[9px] font-medium leading-tight">{t('edit')}</span>
                      </button>
                      <button type="button" className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" onClick={() => onDelete(medication)}>
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
