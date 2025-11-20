
'use client';

import * as React from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { useTranslations } from 'next-intl';

interface ExchangeRateHistory {
    date: string;
    from: string;
    to: string;
    rate: number;
}

export const getColumns = (t: (key: string) => string): ColumnDef<ExchangeRateHistory>[] => [
    {
        accessorKey: 'date',
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.date')} />,
    },
    {
        accessorKey: 'from',
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.from')} />,
    },
    {
        accessorKey: 'to',
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.to')} />,
    },
    {
        accessorKey: 'rate',
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.rate')} />,
        cell: ({ row }) => row.original.rate.toFixed(4),
    },
];

export function ExchangeRateColumnsWrapper() {
    const t = useTranslations('CurrenciesPage');
    const columns = React.useMemo(() => getColumns(t), [t]);
    return columns;
}
