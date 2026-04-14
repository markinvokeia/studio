
'use client';

import { ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { DentalSurface } from '@/lib/types';
import { Can } from '@/components/auth/Can';
import { Pencil, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { createSelectColumn } from '@/components/ui/table-select-column';

interface DentalSurfacesColumnsProps {
    onEdit: (surface: DentalSurface) => void;
    onDelete: (surface: DentalSurface) => void;
    canEdit?: boolean;
    canDelete?: boolean;
}

export const DentalSurfacesColumnsWrapper = ({ onEdit, onDelete }: DentalSurfacesColumnsProps) => {
    const t = useTranslations('DentalSurfacesColumns');
    const columns: ColumnDef<DentalSurface>[] = [
        createSelectColumn<DentalSurface>(),
        { accessorKey: 'id', header: ({column}) => <DataTableColumnHeader column={column} title={t('id')} /> },
        { accessorKey: 'nombre', header: ({column}) => <DataTableColumnHeader column={column} title={t('name')} /> },
        { accessorKey: 'codigo', header: ({column}) => <DataTableColumnHeader column={column} title={t('code')} /> },
        {
            id: 'actions',
            cell: ({ row }) => {
            const surface = row.original;
                    return (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button type="button" className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" onClick={() => onEdit(surface)}>
                        <Pencil className="h-3.5 w-3.5" />
                        <span className="text-[9px] font-medium leading-tight">{t('edit')}</span>
                      </button>
                      <button type="button" className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" onClick={() => onDelete(surface)}>
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
