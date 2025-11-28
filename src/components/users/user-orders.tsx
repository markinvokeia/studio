
'use client';

import * as React from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Order } from '@/lib/types';
import { Badge } from '../ui/badge';
import { useTranslations } from 'next-intl';

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
        }
    },
];

async function getOrdersForUser(userId: string): Promise<Order[]> {
  if (!userId) return [];
  try {
    const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/user_orders?user_id=${userId}`);
    if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status} - ${response.statusText}`);
    }
    const data = await response.json();
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
        />
      </CardContent>
    </Card>
  );
}
