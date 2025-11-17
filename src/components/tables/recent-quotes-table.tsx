
'use client';

import * as React from 'react';
import { ColumnDef, RowSelectionState } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Quote } from '@/lib/types';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreHorizontal } from 'lucide-react';
import { DocumentTextIcon } from '../icons/document-text-icon';
import { useTranslations } from 'next-intl';

const getColumns = (
    t: (key: string) => string,
    onEdit: (quote: Quote) => void,
    onDelete: (quote: Quote) => void,
    onQuoteAction: (quote: Quote, action: 'confirm' | 'reject') => void,
): ColumnDef<Quote>[] => [
  {
    id: 'select',
    header: () => null,
    cell: ({ row, table }) => {
      const isSelected = row.getIsSelected();
      return (
        <RadioGroup
          value={isSelected ? row.id : ''}
          onValueChange={() => {
            table.toggleAllPageRowsSelected(false);
            row.toggleSelected(true);
          }}
        >
          <RadioGroupItem value={row.id} id={row.id} aria-label="Select row" />
        </RadioGroup>
      );
    },
    enableSorting: false,
    enableHiding: false,
    size: 20,
  },
  {
    accessorKey: 'id',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={t('QuoteColumns.quoteId')} />
    ),
    size: 50,
  },
  {
    accessorKey: 'user_name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={t('UserColumns.name')} />
    ),
  },
  {
    accessorKey: 'total',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={t('QuoteColumns.total')} />
    ),
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue('total'));
      const formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: row.original.currency || 'USD',
      }).format(amount);
      return <div className="font-medium">{formatted}</div>;
    },
  },
   {
    accessorKey: 'currency',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={t('QuoteColumns.currency')} />
    ),
    cell: ({ row }) => row.original.currency || 'N/A',
  },
  {
    accessorKey: 'status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={t('UserColumns.status')} />
    ),
    cell: ({ row }) => {
      const status = (row.getValue('status') as string) || '';
      const variant = {
        accepted: 'success',
        confirmed: 'success',
        sent: 'default',
        pending: 'info',
        draft: 'outline',
        rejected: 'destructive',
      }[status.toLowerCase()] ?? ('default' as any);

      const translationKey = `QuotesPage.quoteDialog.${status.toLowerCase()}`;
      const translatedStatus = t(translationKey as any);

      return (
        <Badge variant={variant} className="capitalize">
          {translatedStatus === translationKey ? status : translatedStatus}
        </Badge>
      );
    },
  },
  {
    accessorKey: 'payment_status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={t('Navigation.Payments')} />
    ),
     cell: ({ row }) => {
      const status = (row.getValue('payment_status') as string) || '';
      const variant = {
        paid: 'success',
        partial: 'info',
        unpaid: 'outline',
        partially_paid: 'info'
      }[status.toLowerCase()] ?? ('default'as any);
      
      const statusKeyMap: { [key: string]: string } = {
        'partially paid': 'partiallyPaid',
        'unpaid': 'unpaid',
        'paid': 'paid',
        'partial': 'partial',
      };
      
      const translationKey = `QuotesPage.quoteDialog.${statusKeyMap[status.toLowerCase()] || status.toLowerCase()}`;
      const translatedStatus = t(translationKey as any);

      return (
        <Badge variant={variant} className="capitalize">
          {translatedStatus === translationKey ? status : translatedStatus}
        </Badge>
      );
    },
  },
  {
    accessorKey: 'billing_status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={t('QuoteColumns.billingStatus')} />
    ),
     cell: ({ row }) => {
      const status = (row.getValue('billing_status') as string) || '';

      const statusKeyMap: { [key: string]: string } = {
        'invoiced': 'invoiced',
        'partially invoiced': 'partiallyInvoiced',
        'not invoiced': 'notInvoiced',
      };
      const variantMap: { [key: string]: any } = {
        'invoiced': 'success',
        'partially invoiced': 'info',
        'not invoiced': 'outline',
      };

      const normalizedStatus = status.toLowerCase();
      const translationKey = `QuotesPage.quoteDialog.${statusKeyMap[normalizedStatus]}`;
      const translatedStatus = t(translationKey as any);

      return (
        <Badge variant={variantMap[normalizedStatus] ?? 'default'} className="capitalize">
          {translatedStatus === translationKey ? status : translatedStatus}
        </Badge>
      );
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const t = useTranslations('UserColumns');
      const quote = row.original;
      const status = (quote.status || '').toLowerCase();
      const isDraft = status === 'draft';
      const isPending = status === 'pending';

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0" disabled={!isDraft}>
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{t('actions')}</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onEdit(quote)} disabled={!isDraft}>Edit Quote</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDelete(quote)} className="text-destructive" disabled={!isDraft}>Delete Quote</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onQuoteAction(quote, 'confirm')} disabled={!isDraft && !isPending}>Confirm</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onQuoteAction(quote, 'reject')} className="text-destructive" disabled={!isDraft && !isPending}>Reject</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];


interface RecentQuotesTableProps {
  quotes: Quote[];
  onRowSelectionChange?: (selectedRows: Quote[]) => void;
  onCreate?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  rowSelection?: RowSelectionState;
  setRowSelection?: (selection: RowSelectionState) => void;
  onEdit?: (quote: Quote) => void;
  onDelete?: (quote: Quote) => void;
  onQuoteAction?: (quote: Quote, action: 'confirm' | 'reject') => void;
}

export function RecentQuotesTable({ quotes, onRowSelectionChange, onCreate, onRefresh, isRefreshing, rowSelection, setRowSelection, onEdit = () => {}, onDelete = () => {}, onQuoteAction = () => {} }: RecentQuotesTableProps) {
  const t = useTranslations();
  const columns = React.useMemo(() => getColumns(t, onEdit, onDelete, onQuoteAction), [t, onEdit, onDelete, onQuoteAction]);
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
            <DocumentTextIcon className="h-6 w-6 text-amber-500" />
            <CardTitle>{t('RecentQuotesTable.title')}</CardTitle>
        </div>
        <CardDescription>{t('RecentQuotesTable.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={quotes}
          filterColumnId="user_name"
          filterPlaceholder={t('RecentQuotesTable.filterPlaceholder')}
          onRowSelectionChange={onRowSelectionChange}
          enableSingleRowSelection={onRowSelectionChange ? true : false}
          onCreate={onCreate}
          onRefresh={onRefresh}
          isRefreshing={isRefreshing}
          rowSelection={rowSelection}
          setRowSelection={setRowSelection}
        />
      </CardContent>
    </Card>
  );
}

    