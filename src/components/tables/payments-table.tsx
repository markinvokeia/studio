
'use client';

import { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Payment } from '@/lib/types';
import { cn, formatDateTime } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '../ui/skeleton';
import { Badge } from '@/components/ui/badge';
import React from 'react';
import { useTranslations } from 'next-intl';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Button } from '../ui/button';
import { MoreHorizontal, Printer, Send } from 'lucide-react';

const getColumns = (
  t: (key: string) => string,
  tTransactionType: (key: string) => string,
  tActions: (key: string) => string,
  onPrint?: (payment: Payment) => void,
  onSendEmail?: (payment: Payment) => void
): ColumnDef<Payment>[] => {


  const columns: ColumnDef<Payment>[] = [
    {
      accessorKey: 'doc_no',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('doc_no')} />
      ),
      cell: ({ row }) => {
        const docNo = row.getValue('doc_no') as string;
        return docNo || 'N/A';
      },
    },
    {
      accessorKey: 'user_name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('user')} />
      ),
    },
    {
      accessorKey: 'order_doc_no',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('order_doc_no')} />
      ),
    },

    {
      accessorKey: 'payment_date',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('date')} />
      ),
      cell: ({ row }) => formatDateTime(row.getValue('payment_date'))
    },
    {
      accessorKey: 'amount_applied',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('amount_applied')} />
      ),
      cell: ({ row }) => {
        const amount = parseFloat(row.getValue('amount_applied'));
        const formatted = new Intl.NumberFormat('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(amount);
        return <div className="text-right font-medium pr-4">{formatted}</div>;
      },
    },
    {
      accessorKey: 'source_amount',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('source_amount')} />
      ),
      cell: ({ row }) => {
        const amount = parseFloat(row.getValue('source_amount'));
        const currency = row.original.source_currency || 'USD';
        const formatted = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: currency,
        }).format(amount);
        return <div className="text-right font-medium pr-4">{formatted}</div>;
      },
    },
    {
      accessorKey: 'source_currency',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('source_currency')} />,
    },
    {
      accessorKey: 'exchange_rate',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('exchange_rate')} />,
      cell: ({ row }) => {
        const rate = parseFloat(String(row.getValue('exchange_rate')));
        return <div className="text-right pr-4">{!isNaN(rate) ? rate.toFixed(4) : 'N/A'}</div>;
      }
    },
    {
      accessorKey: 'method',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('method')} />
      ),
      cell: ({ row }) => {
        const method = row.getValue('method') as string;
        return <div className="capitalize">{method || 'N/A'}</div>;
      },
    },
    {
      accessorKey: 'transaction_type',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('transaction_type')} />
      ),
      cell: ({ row }) => {
        const type = row.original.transaction_type;
        return <Badge variant="secondary" className="capitalize">{tTransactionType(type || 'direct_payment')}</Badge>;
      }
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
                <span className="sr-only">{tActions('openMenu')}</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{tActions('title')}</DropdownMenuLabel>
              {onPrint && (
                <DropdownMenuItem onClick={() => onPrint(payment)}>
                  <Printer className="mr-2 h-4 w-4" />
                  {tActions('print')}
                </DropdownMenuItem>
              )}
              {onSendEmail && (
                <DropdownMenuItem onClick={() => onSendEmail(payment)}>
                  <Send className="mr-2 h-4 w-4" />
                  <span>{tActions('sendEmail')}</span>
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
  onCreate?: () => void;
  className?: string;
}

export function PaymentsTable({ payments, isLoading = false, onRefresh, isRefreshing, columnsToHide = [], onPrint, onSendEmail, onCreate, className }: PaymentsTableProps) {
  const t = useTranslations('PaymentsPage.columns');
  const tPage = useTranslations('PaymentsPage');
  const tTransactionType = useTranslations('PaymentsPage.transactionType');
  const tActions = useTranslations('PaymentsPage.actions');
  const columns = React.useMemo(() => getColumns(t, tTransactionType, tActions, onPrint, onSendEmail), [t, tTransactionType, tActions, onPrint, onSendEmail]);

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
  const filteredColumns = columns.filter(col => !columnsToHide.includes((col as any).accessorKey));

  return (
    <Card className={cn("h-full flex-1 flex flex-col min-h-0", className)}>
      <CardContent className="flex-1 flex flex-col min-h-0 p-4 overflow-hidden">
        <DataTable
          columns={filteredColumns}
          data={payments}
          filterColumnId="doc_no"
          filterPlaceholder={tPage('filterPlaceholder')}
          onRefresh={onRefresh}
          isRefreshing={isRefreshing}
          onCreate={onCreate ? () => onCreate() : undefined}
          createButtonLabel={tPage('createPrepaid')}
          columnTranslations={{
            doc_no: t('doc_no'),
            user_name: t('user'),
            order_doc_no: t('order_doc_no'),
            payment_date: t('date'),
            amount_applied: t('amount_applied'),
            source_amount: t('source_amount'),
            source_currency: t('source_currency'),
            exchange_rate: t('exchange_rate'),
            method: t('method'),
            transaction_type: t('transaction_type'),
          }}
        />
      </CardContent>
    </Card>
  );
}
