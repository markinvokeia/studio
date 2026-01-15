
'use client';

import { Card, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Skeleton } from '@/components/ui/skeleton';
import { API_ROUTES } from '@/constants/routes';
import { Quote } from '@/lib/types';
import { api } from '@/services/api';
import { ColumnDef } from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { Badge } from '../ui/badge';
import { formatDateTime } from '@/lib/utils';

const getColumns = (t: (key: string) => string): ColumnDef<Quote>[] => [
  {
    accessorKey: 'id',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('QuoteColumns.quoteId')} />,
  },
  {
    accessorKey: 'total',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('QuoteColumns.total')} />,
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue('total'));
      const formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(amount);
      return <div className="font-medium">{formatted}</div>;
    }
  },
  {
    accessorKey: 'status',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('UserColumns.status')} />,
    cell: ({ row }) => {
      const status = row.getValue('status') as string;
      const variant = {
        accepted: 'success',
        confirmed: 'success',
        sent: 'default',
        pending: 'info',
        draft: 'outline',
        rejected: 'destructive',
      }[status.toLowerCase()] ?? ('default' as any);

      return (
        <Badge variant={variant} className="capitalize">
          {t(`QuotesPage.quoteDialog.${status.toLowerCase()}`)}
        </Badge>
      );
    },
  },
  {
    accessorKey: 'payment_status',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('Navigation.Payments')} />,
    cell: ({ row }) => {
      const status = row.getValue('payment_status') as string;
      const statusLower = status.toLowerCase().trim();

      const variant = {
        paid: 'success',
        partial: 'info',
        'partially paid': 'info',
        unpaid: 'outline',
      }[statusLower] ?? ('default' as any);

      // Map API status values to translation keys
      const translationKeyMap: Record<string, string> = {
        'paid': 'paid',
        'partial': 'partial',
        'partially paid': 'partiallyPaid',
        'partially_paid': 'partiallyPaid',
        'partiallypaid': 'partiallyPaid',
        'unpaid': 'unpaid',
      };

      const translationKey = translationKeyMap[statusLower] || 'unpaid'; // Default fallback

      return (
        <Badge variant={variant} className="capitalize">
          {t(`QuotesPage.quoteDialog.${translationKey}`)}
        </Badge>
      );
    },
  },
  {
    accessorKey: 'billing_status',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('QuoteColumns.billingStatus')} />,
    cell: ({ row }) => {
      const status = row.getValue('billing_status') as string;
      const statusLower = status.toLowerCase().trim();

      const variant = {
        invoiced: 'success',
        'partially invoiced': 'info',
        'not invoiced': 'outline',
      }[statusLower] ?? ('default' as any);

      // Map API status values to translation keys (camelCase format)
      const translationKeyMap: Record<string, string> = {
        'invoiced': 'invoiced',
        'partially invoiced': 'partiallyInvoiced',
        'partially_invoiced': 'partiallyInvoiced',
        'partiallyinvoiced': 'partiallyInvoiced',
        'not invoiced': 'notInvoiced',
        'not_invoiced': 'notInvoiced',
        'notinvoiced': 'notInvoiced',
      };

      const translationKey = translationKeyMap[statusLower] || 'notInvoiced'; // Default fallback

      return (
        <Badge variant={variant} className="capitalize">
          {t(`QuotesPage.quoteDialog.${translationKey}`)}
        </Badge>
      );
    },
  },
  {
    accessorKey: 'createdAt',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('QuoteColumns.createdAt')} />,
    cell: ({ row }) => formatDateTime(row.original.createdAt),
  }
];

async function getQuotesForUser(userId: string): Promise<Quote[]> {
  if (!userId) return [];
  try {
    const data = await api.get(API_ROUTES.USER_QUOTES, { user_id: userId });
    const userQuotesData = Array.isArray(data) ? data : (data.user_quotes || data.data || data.result || []);

    return userQuotesData.map((apiQuote: any) => ({
      id: apiQuote.id ? String(apiQuote.id) : `qt_${Math.random().toString(36).substr(2, 9)}`,
      user_id: apiQuote.user_id || 'N/A',
      total: apiQuote.total || 0,
      status: apiQuote.status || 'draft',
      payment_status: apiQuote.payment_status || 'unpaid',
      billing_status: apiQuote.billing_status || 'not invoiced',
      createdAt: apiQuote.createdAt || new Date().toISOString().split('T')[0],
    }));
  } catch (error) {
    console.error("Failed to fetch user quotes:", error);
    return [];
  }
}

interface UserQuotesProps {
  userId: string;
}

export function UserQuotes({ userId }: UserQuotesProps) {
  const t = useTranslations();
  const [userQuotes, setUserQuotes] = React.useState<Quote[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const columns = React.useMemo(() => getColumns(t), [t]);

  React.useEffect(() => {
    async function loadQuotes() {
      if (!userId) return;
      setIsLoading(true);
      const fetchedUserQuotes = await getQuotesForUser(userId);
      setUserQuotes(fetchedUserQuotes);
      setIsLoading(false);
    }
    loadQuotes();
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
          data={userQuotes}
          filterColumnId='id'
          filterPlaceholder={t('UserQuotes.filterPlaceholder')}
          columnTranslations={{
            id: t('QuoteColumns.quoteId'),
            total: t('QuoteColumns.total'),
            status: t('UserColumns.status'),
            payment_status: t('Navigation.Payments'),
            billing_status: t('QuoteColumns.billingStatus'),
          }}
        />
      </CardContent>
    </Card>
  );
}
