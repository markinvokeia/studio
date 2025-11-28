
'use client';

import * as React from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Payment } from '@/lib/types';
import { Badge } from '../ui/badge';
import { useTranslations } from 'next-intl';

const getColumns = (t: (key: string) => string): ColumnDef<Payment>[] => [
  {
    accessorKey: 'id',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('PaymentsPage.columns.id')} />,
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
    const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/user_payments?user_id=${userId}`);
    if (!response.ok) throw new Error(`Error HTTP: ${response.status} - ${response.statusText}`);
    const data = await response.json();
    const paymentsData = Array.isArray(data) ? data : (data.payments || []);

    return paymentsData.map((apiPayment: any) => ({
      id: apiPayment.id.toString(),
      order_id: apiPayment.order_id?.toString() ?? '',
      invoice_id: apiPayment.invoice_id?.toString() ?? '',
      quote_id: apiPayment.quote_id?.toString() ?? '',
      user_name: '', // Not needed
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
}

export function UserPayments({ userId }: UserPaymentsProps) {
  const t = useTranslations();
  const [payments, setPayments] = React.useState<Payment[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const columns = React.useMemo(() => getColumns(t), [t]);

  React.useEffect(() => {
    async function loadPayments() {
      if (!userId) return;
      setIsLoading(true);
      const fetchedPayments = await getPaymentsForUser(userId);
      setPayments(fetchedPayments);
      setIsLoading(false);
    }
    loadPayments();
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
          data={payments}
          filterColumnId='id'
          filterPlaceholder={t('PaymentsPage.filterPlaceholder')}
        />
      </CardContent>
    </Card>
  );
}
