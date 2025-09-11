
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
      <DataTableColumnHeader column={column} title="Order ID" />
    ),
  },
  {
    accessorKey: 'createdAt',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Created At" />
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
  const t = useTranslations();
  const columns = React.useMemo(() => getColumns(t), [t]);
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
          filterPlaceholder="Filter by order ID..."
          onRefresh={onRefresh}
          isRefreshing={isRefreshing}
        />
      </CardContent>
    </Card>
  );
}
