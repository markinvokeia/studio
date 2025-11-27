
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Button } from '../ui/button';
import { MoreHorizontal, Printer, Send } from 'lucide-react';
import { format } from 'date-fns';

const getColumns = (
  t: (key: string) => string,
  tMethods: (key: string) => string,
  tTransactionType: (key: string) => string,
  onPrint?: (payment: Payment) => void,
  onSendEmail?: (payment: Payment) => void
): ColumnDef<Payment>[] => {
    const paymentMethodMap: { [key: string]: string } = {
        'transferencia': 'bank_transfer',
        'tarjeta de credito': 'credit_card',
        'tarjeta de débito': 'debit_card',
        'efectivo': 'cash',
        'credit': 'credit',
        'debit': 'debit',
        'mercado pago': 'mercado_pago',
    };
    
    const columns: ColumnDef<Payment>[] = [
      {
        accessorKey: 'transaction_id',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('id')} />
        ),
      },
      {
        accessorKey: 'user_name',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('user')} />
        ),
      },
      {
        accessorKey: 'order_id',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('orderId')} />
        ),
      },
      {
        accessorKey: 'quote_id',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('quoteId')} />
        ),
      },
      {
        accessorKey: 'payment_date',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('date')} />
        ),
        cell: ({ row }) => format(new Date(row.getValue('payment_date')), 'yyyy-MM-dd')
      },
      {
        accessorKey: 'amount_applied',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('amount_applied')} />
        ),
        cell: ({ row }) => {
          const amount = parseFloat(row.getValue('amount_applied'));
          const formatted = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD', // Assuming invoice currency is USD
          }).format(amount);
          return <div className="font-medium">{formatted}</div>;
        },
      },
      {
        accessorKey: 'source_amount',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('source_amount')} />
        ),
        cell: ({ row }) => {
          const amount = parseFloat(row.getValue('source_amount'));
          const formatted = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: row.original.source_currency,
          }).format(amount);
          return <div className="font-medium">{formatted}</div>;
        },
      },
      {
        accessorKey: 'source_currency',
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('source_currency')} />,
      },
      {
        accessorKey: 'exchange_rate',
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('exchange_rate')} />,
        cell: ({ row }) => parseFloat(row.getValue('exchange_rate')).toFixed(4)
      },
      {
        accessorKey: 'payment_method',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('method')} />
        ),
         cell: ({ row }) => {
          const method = row.getValue('payment_method') as string;
          let normalizedMethod = paymentMethodMap[method.toLowerCase()] || method.toLowerCase();
          normalizedMethod = normalizedMethod.replace(/\s+/g, '_');
          return <div className="capitalize">{tMethods(normalizedMethod)}</div>;
        },
      },
      {
        accessorKey: 'transaction_type',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('transaction_type')} />
        ),
        cell: ({ row }) => {
          const type = row.original.transaction_type;
          return <Badge variant="secondary" className="capitalize">{tTransactionType(type)}</Badge>;
        }
      },
      {
        accessorKey: 'reference_doc_id',
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('reference_doc_id')} />,
      },
    ];

    if (onPrint || onSendEmail) {
        columns.push({
            id: 'actions',
            cell: ({ row }) => {
                const payment = row.original;
                return (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    {onPrint && (
                        <DropdownMenuItem onClick={() => onPrint(payment)}>
                            <Printer className="mr-2 h-4 w-4" />
                            Print
                        </DropdownMenuItem>
                    )}
                     {onSendEmail && (
                        <DropdownMenuItem onClick={() => onSendEmail(payment)}>
                          <Send className="mr-2 h-4 w-4" />
                          <span>Send Email</span>
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                </DropdownMenu>
                );
            },
        });
    }

    return columns;
};

interface PaymentsTableProps {
  payments: Payment[];
  isLoading?: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  columnsToHide?: string[];
  onPrint?: (payment: Payment) => void;
  onSendEmail?: (payment: Payment) => void;
}

export function PaymentsTable({ payments, isLoading = false, onRefresh, isRefreshing, columnsToHide = [], onPrint, onSendEmail }: PaymentsTableProps) {
    const t = useTranslations('PaymentsPage.columns');
    const tMethods = useTranslations('InvoicesPage.methods');
    const tPage = useTranslations('PaymentsPage');
    const tTransactionType = useTranslations('PaymentsPage.transactionTypes');
    const columns = React.useMemo(() => getColumns(t, tMethods, tTransactionType, onPrint, onSendEmail), [t, tMethods, tTransactionType, onPrint, onSendEmail]);

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
          filterPlaceholder={tPage('filterPlaceholder')}
          onRefresh={onRefresh}
          isRefreshing={isRefreshing}
        />
      </CardContent>
    </Card>
  );
}
