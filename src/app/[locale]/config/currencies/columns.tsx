
'use client';

import * as React from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Eye } from 'lucide-react';
import { ExchangeRateHistoryItem } from '@/lib/types';

export const getColumns = (
    t: (key: string) => string,
    onViewDetails?: (item: ExchangeRateHistoryItem) => void
): ColumnDef<ExchangeRateHistoryItem>[] => [
    {
        accessorKey: 'fecha',
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.date')} />,
        cell: ({ row }) => {
            const date = new Date(row.original.fecha);
            return date.toLocaleDateString('es-ES', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
            });
        },
    },
    {
        accessorKey: 'usd_compra',
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.usdBuy')} />,
        cell: ({ row }) => `$${row.original.datos_completos.usd_compra.toFixed(2)}`,
    },
    {
        accessorKey: 'usd_venta',
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.usdSell')} />,
        cell: ({ row }) => `$${row.original.datos_completos.usd_venta.toFixed(2)}`,
    },
    {
        accessorKey: 'usd_promedio',
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.usdAverage')} />,
        cell: ({ row }) => {
            const average = (row.original.datos_completos.usd_compra + row.original.datos_completos.usd_venta) / 2;
            return `$${average.toFixed(2)}`;
        },
    },
    {
        id: 'actions',
        header: t('columns.actions'),
        cell: ({ row }) => (
            <Button
                variant="ghost"
                size="sm"
                onClick={() => onViewDetails?.(row.original)}
            >
                <Eye className="h-4 w-4 mr-2" />
                {t('columns.viewDetails')}
            </Button>
        ),
    },
];

export function ExchangeRateColumnsWrapper(onViewDetails?: (item: ExchangeRateHistoryItem) => void) {
    const t = useTranslations('CurrenciesPage');
    const columns = React.useMemo(() => getColumns(t, onViewDetails), [t, onViewDetails]);
    return columns;
}
