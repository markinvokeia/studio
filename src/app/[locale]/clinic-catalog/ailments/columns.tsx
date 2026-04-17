
'use client';

import { ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Ailment } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Can } from '@/components/auth/Can';
import { Pencil, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { createSelectColumn } from '@/components/ui/table-select-column';

interface AilmentsColumnsProps {
    onEdit: (ailment: Ailment) => void;
    onDelete: (ailment: Ailment) => void;
    canEdit?: boolean;
    canDelete?: boolean;
}

export const AilmentsColumnsWrapper = ({ onEdit, onDelete, canEdit, canDelete }: AilmentsColumnsProps) => {
    const t = useTranslations('AilmentsColumns');
    const columns: ColumnDef<Ailment>[] = [
        createSelectColumn<Ailment>(),
        { accessorKey: 'id', header: ({column}) => <DataTableColumnHeader column={column} title={t('id')} /> },
        { accessorKey: 'nombre', header: ({column}) => <DataTableColumnHeader column={column} title={t('name')} /> },
        { accessorKey: 'categoria', header: ({column}) => <DataTableColumnHeader column={column} title={t('category')} /> },
        { 
          accessorKey: 'nivel_alerta', 
          header: ({column}) => <DataTableColumnHeader column={column} title={t('alertLevel')} />,
          cell: ({ row }) => {
            const level = row.original.nivel_alerta;
            const variant = {
                1: 'success',
                2: 'info',
                3: 'destructive',
            }[level] || 'default';
            return <Badge variant={variant as any}>{level}</Badge>;
          }
        },
        {
            id: 'actions',
            cell: ({ row }) => {
            const ailment = row.original;
                    return (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button type="button" className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" onClick={() => onEdit(ailment)}>
                        <Pencil className="h-3.5 w-3.5" />
                        <span className="text-[9px] font-medium leading-tight">{t('edit')}</span>
                      </button>
                      <button type="button" className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" onClick={() => onDelete(ailment)}>
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
