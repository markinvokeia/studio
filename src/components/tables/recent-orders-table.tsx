
'use client';

import { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Order } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTranslations } from 'next-intl';
import React from 'react';

const getColumns = (t: (key: string) => string): ColumnDef<Order>[] => [
  {
    accessorKey: 'id',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={t('orderId')} />
    ),
  },
   {
    accessorKey: 'user_name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={t('UserColumns.name')} />
    ),
  },
  {
    accessorKey: 'createdAt',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={t('createdAt')} />
    ),
  },
  {
    accessorKey: 'status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={t('UserColumns.status')} />
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
  const tDashboard = useTranslations('Dashboard.recentOrders');
  const tColumns = useTranslations('OrderColumns');
  const tUserColumns = useTranslations('UserColumns');

  const columns = React.useMemo(() => getColumns((key) => {
    if (key.startsWith('UserColumns.')) return tUserColumns(key.replace('UserColumns.', '') as any);
    return tColumns(key as any);
  }), [tColumns, tUserColumns]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{tDashboard('title')}</CardTitle>
        <CardDescription>{tDashboard('description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={orders}
          filterColumnId="id"
          filterPlaceholder={tDashboard('filterPlaceholder')}
          onRefresh={onRefresh}
          isRefreshing={isRefreshing}
        />
      </CardContent>
    </Card>
  );
}
