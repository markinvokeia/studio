'use client';

import { ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { MutualSociety } from '@/lib/types';
import { Can } from '@/components/auth/Can';
import { BUSINESS_CONFIG_PERMISSIONS } from '@/constants/permissions';
import { Pencil, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { format, parseISO } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { useLocale } from 'next-intl';
import { createSelectColumn } from '@/components/ui/table-select-column';

interface MutualSocietiesColumnsProps {
    onEdit: (mutualSociety: MutualSociety) => void;
    onDelete: (mutualSociety: MutualSociety) => void;
}

export const MutualSocietiesColumnsWrapper = ({ onEdit, onDelete }: MutualSocietiesColumnsProps) => {
    const t = useTranslations('MutualSocietiesColumns');
    const locale = useLocale();
    const dateFnsLocale = locale === 'es' ? es : enUS;
    
    const formatDate = (dateString?: string) => {
        if (!dateString) return '-';
        const date = parseISO(dateString);
        const day = String(date.getUTCDate()).padStart(2, '0');
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const year = date.getUTCFullYear();
        const hours = String(date.getUTCHours()).padStart(2, '0');
        const minutes = String(date.getUTCMinutes()).padStart(2, '0');
        return `${day}/${month}/${year} ${hours}:${minutes}`;
    };

    const columns: ColumnDef<MutualSociety>[] = [
        createSelectColumn<MutualSociety>(),
        { accessorKey: 'id', header: ({column}) => <DataTableColumnHeader column={column} title={t('id')} /> },
        { accessorKey: 'name', header: ({column}) => <DataTableColumnHeader column={column} title={t('name')} /> },
        { accessorKey: 'description', header: ({column}) => <DataTableColumnHeader column={column} title={t('description')} /> },
        { accessorKey: 'code', header: ({column}) => <DataTableColumnHeader column={column} title={t('code')} /> },
        { 
            accessorKey: 'is_active', 
            header: ({column}) => <DataTableColumnHeader column={column} title={t('isActive')} />,
            cell: ({ row }) => {
                const isActive = row.original.is_active;
                return (
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${isActive ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'}`}>
                        {isActive ? t('isActive') : 'Inactive'}
                    </span>
                );
            }
        },
        { 
            accessorKey: 'created_at', 
            header: ({column}) => <DataTableColumnHeader column={column} title={t('createdAt')} />,
            cell: ({ row }) => formatDate(row.original.created_at)
        },
        { 
            accessorKey: 'updated_at', 
            header: ({column}) => <DataTableColumnHeader column={column} title={t('updatedAt')} />,
            cell: ({ row }) => formatDate(row.original.updated_at)
        },
        {
            id: 'actions',
            cell: ({ row }) => {
            const mutualSociety = row.original;
                    return (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button type="button" className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" onClick={() => onEdit(mutualSociety)}>
                        <Pencil className="h-3.5 w-3.5" />
                        <span className="text-[9px] font-medium leading-tight">{t('edit')}</span>
                      </button>
                      <button type="button" className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" onClick={() => onDelete(mutualSociety)}>
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
