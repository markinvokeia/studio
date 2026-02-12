
'use client';

import { Card, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Skeleton } from '@/components/ui/skeleton';
import { API_ROUTES } from '@/constants/routes';
import { Quote } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';
import { api } from '@/services/api';
import { ColumnDef, RowSelectionState } from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { Badge } from '../ui/badge';

const getColumns = (t: (key: string) => string): ColumnDef<Quote>[] => [
  {
    accessorKey: 'doc_no',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('QuoteColumns.quoteId')} />,
  },
  {
    accessorKey: 'total',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('QuoteColumns.total')} />,
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue('total'));
      const roundedAmount = Math.round(amount * 100) / 100;
      const formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(roundedAmount);
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
      doc_no: apiQuote.doc_no || 'N/A',
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
  onQuoteSelect?: (quote: Quote | null) => void;
}

export function UserQuotes({ userId, onQuoteSelect }: UserQuotesProps) {
  const t = useTranslations();
  const [userQuotes, setUserQuotes] = React.useState<Quote[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});

  const columns = React.useMemo(() => getColumns(t), [t]);

  const handleRowSelectionChange = React.useCallback((selectedRows: Quote[]) => {
    const selectedQuote = selectedRows.length > 0 ? selectedRows[0] : null;

    if (onQuoteSelect) {
      onQuoteSelect(selectedQuote);
    }
  }, [onQuoteSelect]);

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
    <Card className="flex-1 flex flex-col min-h-0 shadow-none border-0">
      <CardContent className="flex-1 flex flex-col min-h-0 p-0">
        <DataTable
          columns={columns}
          data={userQuotes}
          filterColumnId='doc_no'
          filterPlaceholder={t('UserQuotes.filterPlaceholder')}
          onRowSelectionChange={handleRowSelectionChange}
          enableSingleRowSelection={true}
          rowSelection={rowSelection}
          setRowSelection={setRowSelection}
          columnTranslations={{
            doc_no: t('QuoteColumns.quoteId'),
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
