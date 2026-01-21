
'use client';

import { Card, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Skeleton } from '@/components/ui/skeleton';
import { API_ROUTES } from '@/constants/routes';
import { Order, Quote } from '@/lib/types';
import { api } from '@/services/api';
import { ColumnDef } from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { Badge } from '../ui/badge';

const getColumns = (t: (key: string) => string): ColumnDef<Order>[] => [
  {
    accessorKey: 'doc_no',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('OrderColumns.docNo')} />,
    cell: ({ row }) => {
      const docNo = row.getValue('doc_no') as string;
      return docNo || 'N/A';
    },
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
      id: apiOrder.id ? String(apiOrder.id) : 'N/A',
      doc_no: apiOrder.doc_no || 'N/A',
      user_id: apiOrder.user_id,
      user_name: apiOrder.user_name || '',
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
  selectedQuote?: Quote | null;
}

export function UserOrders({ userId, selectedQuote }: UserOrdersProps) {
  const t = useTranslations();
  const [orders, setOrders] = React.useState<Order[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const columns = React.useMemo(() => getColumns(t), [t]);

  React.useEffect(() => {
    async function loadOrders() {
      if (!userId) return;
      setIsLoading(true);
      const fetchedOrders = await getOrdersForUser(userId);
      let filteredOrders = fetchedOrders;
      if (selectedQuote) {
        filteredOrders = fetchedOrders.filter(order => order.quote_id === selectedQuote.id);
      }
      setOrders(filteredOrders);
      setIsLoading(false);
    }
    loadOrders();
  }, [userId, selectedQuote]);

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
        {selectedQuote && (
          <div className="mb-4 p-3 bg-muted rounded-lg">
            <div className="text-sm text-muted-foreground">
              {t('UserOrders.showingForQuote')}:
            </div>
            <div className="font-medium">
              {selectedQuote.doc_no}
            </div>
          </div>
        )}
        <DataTable
          columns={columns}
          data={orders}
          filterColumnId='doc_no'
          filterPlaceholder={t('OrdersPage.filterPlaceholder')}
          columnTranslations={{
            doc_no: t('OrderColumns.docNo'),
            user_name: t('UserColumns.name'),
            quote_id: t('QuoteColumns.quoteId'),
            createdAt: t('OrderColumns.createdAt'),
            status: t('UserColumns.status'),
          }}
        />
      </CardContent>
    </Card>
  );
}
