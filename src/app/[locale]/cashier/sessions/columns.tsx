
'use client';

import { ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { CajaSesion } from '@/lib/types';
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

interface CashSessionsColumnsProps {
    onView: (session: CajaSesion) => void;
    onPrint: (session: CajaSesion) => void;
}

const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
        return format(parseISO(dateString), 'yyyy-MM-dd HH:mm');
    } catch (error) {
        return dateString;
    }
};

const formatCurrency = (value?: number) => {
    if (value === undefined || value === null) return 'N/A';
    return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export const CashSessionsColumnsWrapper = ({ onView, onPrint }: CashSessionsColumnsProps): ColumnDef<CajaSesion>[] => {
    const t = useTranslations('CashSessionsPage.columns');
    
    const columns: ColumnDef<CajaSesion>[] = [
        { accessorKey: 'id', header: ({column}) => <DataTableColumnHeader column={column} title={t('id')} /> },
        { accessorKey: 'user_name', header: ({column}) => <DataTableColumnHeader column={column} title={t('user')} /> },
        { accessorKey: 'cash_point_name', header: ({column}) => <DataTableColumnHeader column={column} title={t('cashPoint')} /> },
        { 
          accessorKey: 'estado', 
          header: ({column}) => <DataTableColumnHeader column={column} title={t('status')} />,
          cell: ({ row }) => {
            const status = row.original.estado.toUpperCase();
            const variant = status === 'OPEN' ? 'success' : 'destructive';
            return <Badge variant={variant}>{status}</Badge>;
          }
        },
        { 
            accessorKey: 'fechaApertura', 
            header: ({column}) => <DataTableColumnHeader column={column} title={t('openDate')} />,
            cell: ({ row }) => formatDate(row.original.fechaApertura)
        },
        { 
            accessorKey: 'fechaCierre', 
            header: ({column}) => <DataTableColumnHeader column={column} title={t('closeDate')} />,
            cell: ({ row }) => formatDate(row.original.fechaCierre)
        },
        { 
            accessorKey: 'montoApertura', 
            header: ({column}) => <DataTableColumnHeader column={column} title={t('openingAmount')} />,
            cell: ({ row }) => formatCurrency(row.original.montoApertura)
        },
        {
            id: 'actions',
            cell: ({ row }) => {
            const session = row.original;
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
                    <DropdownMenuItem onClick={() => onView(session)}>{t('viewDetails')}</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onPrint(session)}>{t('print')}</DropdownMenuItem>
                </DropdownMenuContent>
                </DropdownMenu>
            );
            },
        },
    ];
    return columns;
}
