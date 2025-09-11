
'use client';

import { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Order } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTranslations } from 'next-intl';
import React from 'react';

const getColumns = (
    tUser: (key: string) => string,
    tOrder: (key: string) => string
): ColumnDef<Order>[] => [
  {
    accessorKey: 'id',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={tOrder('orderId')} />
    ),
  },
   {
    accessorKey: 'user_name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={tUser('name')} />
    ),
  },
  {
    accessorKey: 'createdAt',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={tOrder('createdAt')} />
    ),
  },
  {
    accessorKey: 'status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={tUser('status')} />
    ),
    cell: ({ row }) => {
      const status = row.getValue('status') as string;
      const variant = {
        completed: 'success',
        pending: 'info',
        processing: 'default',
        cancelled: 'destructive',
      }[status.toLowerCase()] ?? ('default' as any);

      return (
        <Badge variant={variant} className="capitalize">
          {status}
        </Badge>
      );
    },
  },
];

interface RecentOrdersTableProps {
  orders: Order[];
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function RecentOrdersTable({ orders, onRefresh, isRefreshing }: RecentOrdersTableProps) {
  const t = useTranslations('RecentOrdersTable');
  console.log('Translations for RecentOrdersTable loaded.');
  const tUserColumns = useTranslations('UserColumns');
  console.log('Translations for UserColumns loaded.');
  const tOrderColumns = useTranslations('OrderColumns');
  console.log('Translations for OrderColumns loaded.');
  const columns = React.useMemo(() => getColumns(tUserColumns, tOrderColumns), [tUserColumns, tOrderColumns]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={orders}
          filterColumnId="id"
          filterPlaceholder={t('filterPlaceholder')}
          onRefresh={onRefresh}
          isRefreshing={isRefreshing}
        />
      </CardContent>
    </Card>
  );
}
