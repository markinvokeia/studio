
'use client';

import { ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { CashPoint } from '@/lib/types';
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
import { format, parseISO } from 'date-fns';

interface CashPointsColumnsProps {
    onEdit: (cashPoint: CashPoint) => void;
    onDelete: (cashPoint: CashPoint) => void;
}

const formatDate = (dateString: string) => {
    try {
        return format(parseISO(dateString), 'yyyy-MM-dd HH:mm');
    } catch (error) {
        return dateString;
    }
};

export const CashPointsColumnsWrapper = ({ onEdit, onDelete }: CashPointsColumnsProps): ColumnDef<CashPoint>[] => {
    const t = useTranslations('PhysicalCashRegistersPage.columns');

    const columns: ColumnDef<CashPoint>[] = [
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
            cell: ({ row }) => formatDate(row.original.created_at)
        },
        {
            accessorKey: 'updated_at',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('updatedAt')} />,
            cell: ({ row }) => formatDate(row.original.updated_at)
        },
        {
            id: 'actions',
            cell: ({ row }) => {
                const cashPoint = row.original;
                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">{t('openMenu')}</span>
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>{t('actions')}</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => onEdit(cashPoint)}>{t('edit')}</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onDelete(cashPoint)} className="text-destructive">{t('delete')}</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                );
            },
        },
    ];
    return columns;
}
