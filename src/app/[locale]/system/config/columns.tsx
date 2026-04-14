
'use client';

import { Badge } from '@/components/ui/badge';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { SystemConfiguration } from '@/lib/types';
import { ColumnDef } from '@tanstack/react-table';
import { Pencil, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { createSelectColumn } from '@/components/ui/table-select-column';

interface ConfigsColumnsProps {
    onEdit?: (config: SystemConfiguration) => void;
    onDelete?: (config: SystemConfiguration) => void;
}


export const ConfigsColumnsWrapper = ({ onEdit, onDelete }: ConfigsColumnsProps): ColumnDef<SystemConfiguration>[] => {
    const t = useTranslations('ConfigurationsPage.columns');
    const columns: ColumnDef<SystemConfiguration>[] = [
        createSelectColumn<SystemConfiguration>(),
        { accessorKey: 'id', header: ({ column }) => <DataTableColumnHeader column={column} title={t('id')} /> },
        { accessorKey: 'key', header: ({ column }) => <DataTableColumnHeader column={column} title={t('key')} /> },
        { accessorKey: 'value', header: ({ column }) => <DataTableColumnHeader column={column} title={t('value')} /> },
        { accessorKey: 'description', header: ({ column }) => <DataTableColumnHeader column={column} title={t('description')} /> },
        { accessorKey: 'data_type', header: ({ column }) => <DataTableColumnHeader column={column} title={t('type')} /> },
        {
            accessorKey: 'is_public',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('isPublic')} />,
            cell: ({ row }) => <Badge variant={row.original.is_public ? 'success' : 'outline'}>{row.original.is_public ? t('yes') : t('no')}</Badge>,
        },
        { accessorKey: 'updated_by', header: ({ column }) => <DataTableColumnHeader column={column} title={t('updatedBy')} /> },
        {
            id: 'actions',
            cell: ({ row }) => {
                const config = row.original;
            return (
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              {onEdit && <button type="button" className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" onClick={() => onEdit(config)}>
                <Pencil className="h-3.5 w-3.5" />
                <span className="text-[9px] font-medium leading-tight">{t('edit')}</span>
              </button>}
              {onDelete && <button type="button" className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" onClick={() => onDelete(config)}>
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
