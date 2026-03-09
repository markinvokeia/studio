
'use client';

import { ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { DentalSurface } from '@/lib/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Can } from '@/components/auth/Can';
import { MoreHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface DentalSurfacesColumnsProps {
    onEdit: (surface: DentalSurface) => void;
    onDelete: (surface: DentalSurface) => void;
    canEdit?: boolean;
    canDelete?: boolean;
}

export const DentalSurfacesColumnsWrapper = ({ onEdit, onDelete }: DentalSurfacesColumnsProps) => {
    const t = useTranslations('DentalSurfacesColumns');
    const columns: ColumnDef<DentalSurface>[] = [
        { accessorKey: 'id', header: ({column}) => <DataTableColumnHeader column={column} title={t('id')} /> },
        { accessorKey: 'nombre', header: ({column}) => <DataTableColumnHeader column={column} title={t('name')} /> },
        { accessorKey: 'codigo', header: ({column}) => <DataTableColumnHeader column={column} title={t('code')} /> },
        {
            id: 'actions',
            cell: ({ row }) => {
            const surface = row.original;
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
                    <Can permission="CATALOG_DENTAL_SURF_UPDATE">
                        <DropdownMenuItem onClick={() => onEdit(surface)}>{t('edit')}</DropdownMenuItem>
                    </Can>
                    <Can permission="CATALOG_DENTAL_SURF_DELETE">
                        <DropdownMenuItem onClick={() => onDelete(surface)} className="text-destructive">{t('delete')}</DropdownMenuItem>
                    </Can>
                </DropdownMenuContent>
                </DropdownMenu>
            );
            },
        },
    ];
    return columns;
};
