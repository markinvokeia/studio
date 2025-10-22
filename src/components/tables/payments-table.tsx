
'use client';

import { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Payment } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '../ui/skeleton';
import { Badge } from '@/components/ui/badge';
import React from 'react';
import { useTranslations } from 'next-intl';

const getColumns = (
  t: (key: string) => string,
  tStatus: (key: string) => string,
  tMethods: (key: string) => string,
): ColumnDef<Payment>[] => {
    const paymentMethodMap: { [key: string]: string } = {
        'transferencia': 'bank_transfer',
        'tarjeta de credito': 'credit_card',
        'efectivo': 'cash',
        'tarjeta de debito': 'debit',
        // Add other mappings as needed
    };
    
    return [
      {
        accessorKey: 'id',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('id')} />
        ),
      },
      {
        accessorKey: 'quote_id',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('quoteId')} />
        ),
      },
      {
        accessorKey: 'order_id',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('orderId')} />
        ),
      },
      {
        accessorKey: 'invoice_id',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('invoiceId')} />
        ),
      },
      {
        accessorKey: 'user_name',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('user')} />
        ),
      },
      {
        accessorKey: 'amount',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('amount')} />
        ),
        cell: ({ row }) => {
          const amount = parseFloat(row.getValue('amount'));
          const formatted = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
          }).format(amount);
          return <div className="font-medium">{formatted}</div>;
        },
      },
      {
        accessorKey: 'method',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('method')} />
        ),
         cell: ({ row }) => {
          const method = row.getValue('method') as string;
          let normalizedMethod = paymentMethodMap[method.toLowerCase()] || method.toLowerCase();
          normalizedMethod = normalizedMethod.replace(/\s+/g, '_');
          return <div className="capitalize">{tMethods(normalizedMethod)}</div>;
        },
      },
      {
        accessorKey: 'status',
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('status')} />,
        cell: ({ row }) => {
          const status = row.original.status;
          const variant = {
            completed: 'success',
            pending: 'info',
            failed: 'destructive',
          }[status.toLowerCase()] ?? ('default' as any);
          return <Badge variant={variant} className="capitalize">{tStatus(status)}</Badge>;
        },
      },
      {
        accessorKey: 'createdAt',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('createdAt')} />
        ),
      },
    ];
};

interface PaymentsTableProps {
  payments: Payment[];
  isLoading?: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  columnsToHide?: string[];
}

export function PaymentsTable({ payments, isLoading = false, onRefresh, isRefreshing, columnsToHide = [] }: PaymentsTableProps) {
    const t = useTranslations('PaymentsPage.columns');
    const tStatus = useTranslations('InvoicesPage.status');
    const tMethods = useTranslations('InvoicesPage.methods');
    const columns = React.useMemo(() => getColumns(t, tStatus, tMethods), [t, tStatus, tMethods]);

    if (isLoading) {
    return (
      <div className="space-y-4 pt-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }
  const filteredColumns = columns.filter(col => !columnsToHide.includes(col.accessorKey as string));
  
  return (
    <Card>
      <CardContent className="p-4">
        <DataTable
          columns={filteredColumns}
          data={payments}
          filterColumnId="invoice_id"
          filterPlaceholder={t('filterPlaceholder')}
          onRefresh={onRefresh}
          isRefreshing={isRefreshing}
        />
      </CardContent>
    </Card>
  );
}
