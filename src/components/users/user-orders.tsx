
'use client';

import { Card, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Skeleton } from '@/components/ui/skeleton';
import { API_ROUTES } from '@/constants/routes';
import { Order } from '@/lib/types';
import { api } from '@/services/api';
import { ColumnDef } from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { Badge } from '../ui/badge';

const getColumns = (t: (key: string) => string): ColumnDef<Order>[] => [
  {
    accessorKey: 'id',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('OrderColumns.orderId')} />,
  },
  {
    accessorKey: 'quote_id',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('QuoteColumns.quoteId')} />,
  },
  {
    accessorKey: 'createdAt',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('OrderColumns.createdAt')} />,
  },
  {
    accessorKey: 'status',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('UserColumns.status')} />,
    cell: ({ row }) => {
      const status = row.getValue('status') as string;
      const statusLower = status.toLowerCase().trim();

      const variant = {
        completed: 'success',
        pending: 'info',
        processing: 'default',
        cancelled: 'destructive',
      }[statusLower] ?? ('default' as any);

      // Map API status values to translation keys
      const translationKeyMap: Record<string, string> = {
        'completed': 'completed',
        'pending': 'pending',
        'processing': 'processing',
        'in progress': 'processing',
        'in_progress': 'processing',
        'cancelled': 'cancelled',
        'canceled': 'cancelled', // Handle both spellings
      };

      const translationKey = translationKeyMap[statusLower] || statusLower;

      return (
        <Badge variant={variant} className="capitalize">
          {t(`OrdersPage.status.${translationKey}`)}
        </Badge>
      );
    }
  },
];

async function getOrdersForUser(userId: string): Promise<Order[]> {
  if (!userId) return [];
  try {
    const data = await api.get(API_ROUTES.USER_ORDERS, { user_id: userId });
    const ordersData = Array.isArray(data) ? data : (data.orders || data.data || []);
    return ordersData.map((apiOrder: any) => ({
      id: apiOrder.id ? String(apiOrder.id) : `ord_${Math.random().toString(36).substr(2, 9)}`,
      user_id: apiOrder.user_id,
      quote_id: apiOrder.quote_id,
      status: apiOrder.status,
      createdAt: apiOrder.created_at,
      updatedAt: apiOrder.updated_at,
      currency: apiOrder.currency || 'USD',
    }));
  } catch (error) {
    console.error("Failed to fetch user orders:", error);
    return [];
  }
}

interface UserOrdersProps {
  userId: string;
}

export function UserOrders({ userId }: UserOrdersProps) {
  const t = useTranslations();
  const [orders, setOrders] = React.useState<Order[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const columns = React.useMemo(() => getColumns(t), [t]);

  React.useEffect(() => {
    async function loadOrders() {
      if (!userId) return;
      setIsLoading(true);
      const fetchedOrders = await getOrdersForUser(userId);
      setOrders(fetchedOrders);
      setIsLoading(false);
    }
    loadOrders();
  }, [userId]);

  if (isLoading) {
    return (
      <div className="space-y-2 pt-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="p-4">
        <DataTable
          columns={columns}
          data={orders}
          filterColumnId='id'
          filterPlaceholder={t('OrdersPage.filterPlaceholder')}
          columnTranslations={{
            id: t('OrderColumns.orderId'),
            quote_id: t('QuoteColumns.quoteId'),
            createdAt: t('OrderColumns.createdAt'),
            status: t('UserColumns.status'),
          }}
        />
      </CardContent>
    </Card>
  );
}
