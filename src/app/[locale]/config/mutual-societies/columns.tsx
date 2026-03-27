'use client';

import { ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { MutualSociety } from '@/lib/types';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Can } from '@/components/auth/Can';
import { BUSINESS_CONFIG_PERMISSIONS } from '@/constants/permissions';
import { MoreHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { format, parseISO } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { useLocale } from 'next-intl';

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
                <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                    <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuLabel>{t('actions')}</DropdownMenuLabel>
                    <Can permission={BUSINESS_CONFIG_PERMISSIONS.SEQUENCES_UPDATE}>
                        <DropdownMenuItem onClick={() => onEdit(mutualSociety)}>{t('edit')}</DropdownMenuItem>
                    </Can>
                    <Can permission={BUSINESS_CONFIG_PERMISSIONS.SEQUENCES_DELETE}>
                        <DropdownMenuItem onClick={() => onDelete(mutualSociety)} className="text-destructive">{t('delete')}</DropdownMenuItem>
                    </Can>
                </DropdownMenuContent>
                </DropdownMenu>
            );
            },
        },
    ];
    return columns;
}
