
'use client';

import { Card, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Skeleton } from '@/components/ui/skeleton';
import { API_ROUTES } from '@/constants/routes';
import { Payment, Quote } from '@/lib/types';
import { api } from '@/services/api';
import { ColumnDef } from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import * as React from 'react';

const getColumns = (t: (key: string) => string): ColumnDef<Payment>[] => [
  {
    accessorKey: 'doc_no',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('PaymentsPage.columns.doc_no')} />,
    cell: ({ row }) => {
      const docNo = row.getValue('doc_no') as string;
      return docNo || 'N/A';
    },
  },
  {
    accessorKey: 'amount',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('PaymentsPage.columns.amount')} />,
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue('amount'));
      const formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: row.original.currency || 'USD',
      }).format(amount);
      return <div className="font-medium">{formatted}</div>;
    },
  },
  {
    accessorKey: 'method',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('PaymentsPage.columns.method')} />,
  },
  {
    accessorKey: 'createdAt',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('PaymentsPage.columns.createdAt')} />,
  },
];

async function getPaymentsForUser(userId: string): Promise<Payment[]> {
  if (!userId) return [];
  try {
    const data = await api.get(API_ROUTES.USER_PAYMENTS, { user_id: userId });
    const paymentsData = Array.isArray(data) ? data : (data.payments || []);

    return paymentsData.map((apiPayment: any) => ({
      id: apiPayment.id.toString(),
      doc_no: apiPayment.doc_no || `PAY-${apiPayment.id}`,
      order_id: apiPayment.order_id?.toString() ?? '',
      order_doc_no: apiPayment.order_doc_no || `ORD-${apiPayment.order_id}`,
      invoice_id: apiPayment.invoice_id?.toString() ?? '',
      quote_id: apiPayment.quote_id?.toString() ?? '',
      user_name: apiPayment.user_name || '',
      amount: parseFloat(apiPayment.amount),
      method: apiPayment.method,
      status: apiPayment.status,
      createdAt: apiPayment.created_at,
      updatedAt: apiPayment.updatedAt,
      currency: apiPayment.currency,
      payment_date: apiPayment.payment_date,
      amount_applied: parseFloat(apiPayment.amount_applied),
      source_amount: parseFloat(apiPayment.amount),
      source_currency: apiPayment.currency,
      exchange_rate: parseFloat(apiPayment.exchange_rate),
      payment_method: apiPayment.payment_method,
      transaction_type: apiPayment.transaction_type,
      transaction_id: apiPayment.transaction_id,
      reference_doc_id: apiPayment.reference_doc_id,
    }));
  } catch (error) {
    console.error("Failed to fetch user payments:", error);
    return [];
  }
}

interface UserPaymentsProps {
  userId: string;
  selectedQuote?: Quote | null;
}

export function UserPayments({ userId, selectedQuote }: UserPaymentsProps) {
  const t = useTranslations();
  const [payments, setPayments] = React.useState<Payment[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const columns = React.useMemo(() => getColumns(t), [t]);



  React.useEffect(() => {
    async function loadPayments() {
      if (!userId) return;
      setIsLoading(true);
      const fetchedPayments = await getPaymentsForUser(userId);
      let filteredPayments = fetchedPayments;
      if (selectedQuote) {
        filteredPayments = fetchedPayments.filter(payment => payment.quote_id === selectedQuote.id);
      }
      setPayments(filteredPayments);
      setIsLoading(false);
    }
    loadPayments();
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
              {t('UserPayments.showingForQuote')}:
            </div>
            <div className="font-medium">
              {selectedQuote.doc_no || selectedQuote.id}
            </div>
          </div>
        )}
        <DataTable
          columns={columns}
          data={payments}
          filterColumnId='doc_no'
          filterPlaceholder={t('PaymentsPage.filterPlaceholder')}
          columnTranslations={{
            doc_no: t('PaymentsPage.columns.doc_no'),
            user_name: t('PaymentsPage.columns.user'),
            amount: t('PaymentsPage.columns.amount'),
            method: t('PaymentsPage.columns.method'),
            createdAt: t('PaymentsPage.columns.createdAt'),
          }}
        />
      </CardContent>
    </Card>
  );
}
