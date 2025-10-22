
'use client';

import { ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { SystemConfiguration } from '@/lib/types';
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

interface ConfigsColumnsProps {
    onEdit: (config: SystemConfiguration) => void;
    onDelete: (config: SystemConfiguration) => void;
}


export const ConfigsColumnsWrapper = ({ onEdit, onDelete }: ConfigsColumnsProps): ColumnDef<SystemConfiguration>[] => {
    const t = useTranslations('ConfigurationsPage.columns');
    const columns: ColumnDef<SystemConfiguration>[] = [
        { accessorKey: 'id', header: ({column}) => <DataTableColumnHeader column={column} title={t('id')} /> },
        { accessorKey: 'key', header: ({column}) => <DataTableColumnHeader column={column} title={t('key')} /> },
        { accessorKey: 'value', header: ({column}) => <DataTableColumnHeader column={column} title={t('value')} /> },
        { accessorKey: 'description', header: ({column}) => <DataTableColumnHeader column={column} title={t('description')} /> },
        { accessorKey: 'data_type', header: ({column}) => <DataTableColumnHeader column={column} title={t('type')} /> },
        { 
            accessorKey: 'is_public', 
            header: ({column}) => <DataTableColumnHeader column={column} title={t('isPublic')} />,
            cell: ({ row }) => <Badge variant={row.original.is_public ? 'success' : 'outline'}>{row.original.is_public ? t('yes') : t('no')}</Badge>,
        },
        { accessorKey: 'updated_by', header: ({column}) => <DataTableColumnHeader column={column} title={t('updatedBy')} /> },
        {
            id: 'actions',
            cell: ({ row }) => {
            const config = row.original;
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
                    <DropdownMenuItem onClick={() => onEdit(config)}>{t('edit')}</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onDelete(config)} className="text-destructive">{t('delete')}</DropdownMenuItem>
                </DropdownMenuContent>
                </DropdownMenu>
            );
            },
        },
    ];
    return columns;
}
