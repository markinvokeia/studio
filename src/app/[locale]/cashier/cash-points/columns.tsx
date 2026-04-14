
'use client';

import { ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { CashPoint } from '@/lib/types';
import { Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useTranslations } from 'next-intl';
import { formatDateTime } from '@/lib/utils';
import { createSelectColumn } from '@/components/ui/table-select-column';

interface CashPointsColumnsProps {
    onEdit: (cashPoint: CashPoint) => void;
    onDelete: (cashPoint: CashPoint) => void;
}

export const CashPointsColumnsWrapper = ({ onEdit, onDelete }: CashPointsColumnsProps): ColumnDef<CashPoint>[] => {
    const t = useTranslations('PhysicalCashRegistersPage.columns');

    const columns: ColumnDef<CashPoint>[] = [
        createSelectColumn<CashPoint>(),
        { accessorKey: 'id', header: ({ column }) => <DataTableColumnHeader column={column} title={t('id')} /> },
        { accessorKey: 'name', header: ({ column }) => <DataTableColumnHeader column={column} title={t('name')} /> },
        {
            accessorKey: 'is_active',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('isActive')} />,
            cell: ({ row }) => <Badge variant={row.original.is_active ? 'success' : 'destructive'}>{row.original.is_active ? t('yes') : t('no')}</Badge>
        },
        {
            accessorKey: 'created_at',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('createdAt')} />,
            cell: ({ row }) => formatDateTime(row.original.created_at)
        },
        {
            accessorKey: 'updated_at',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('updatedAt')} />,
            cell: ({ row }) => formatDateTime(row.original.updated_at)
        },
        {
            id: 'actions',
            cell: ({ row }) => {
                const cashPoint = row.original;
            return (
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <button type="button" className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" onClick={() => onEdit(cashPoint)}>
                <Pencil className="h-3.5 w-3.5" />
                <span className="text-[9px] font-medium leading-tight">{t('edit')}</span>
              </button>
              <button type="button" className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" onClick={() => onDelete(cashPoint)}>
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
