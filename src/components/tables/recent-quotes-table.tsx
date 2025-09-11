
'use client';

import * as React from 'react';
import { ColumnDef } from '@tanstack/react-table';
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreHorizontal } from 'lucide-react';
import { DocumentTextIcon } from '../icons/document-text-icon';
import { useTranslations } from 'next-intl';

const getColumns = (t: (key: string) => string): ColumnDef<Quote>[] => [
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
        currency: 'USD',
      }).format(amount);
      return <div className="font-medium">{formatted}</div>;
    },
  },
  {
    accessorKey: 'status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={t('UserColumns.status')} />
    ),
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
          {status}
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
      const status = row.getValue('payment_status') as string;
      const variant = {
        paid: 'success',
        partial: 'info',
        unpaid: 'outline',
      }[status.toLowerCase()] ?? ('default'as any);

      return (
        <Badge variant={variant} className="capitalize">
          {status}
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
      const status = row.getValue('billing_status') as string;
      const variant = {
        invoiced: 'success',
        'partially invoiced': 'info',
        'not invoiced': 'outline',
      }[status.toLowerCase()] ?? ('default'as any);

      return (
        <Badge variant={variant} className="capitalize">
          {status}
        </Badge>
      );
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const t = useTranslations('UserColumns');
      const quote = row.original;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{t('actions')}</DropdownMenuLabel>
            <DropdownMenuItem>{t('viewDetails')}</DropdownMenuItem>
            <DropdownMenuItem>{t('edit')}</DropdownMenuItem>
            <DropdownMenuItem>{t('delete')}</DropdownMenuItem>
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
}

export function RecentQuotesTable({ quotes, onRowSelectionChange, onCreate, onRefresh, isRefreshing }: RecentQuotesTableProps) {
  const t = useTranslations('RecentQuotesTable');
  const tUserColumns = useTranslations('UserColumns');
  const tQuoteColumns = useTranslations('QuoteColumns');
  const tNav = useTranslations('Navigation');
  
  const columns = React.useMemo(() => getColumns((key) => {
    if (key.startsWith('UserColumns.')) return tUserColumns(key.replace('UserColumns.', '') as any);
    if (key.startsWith('QuoteColumns.')) return tQuoteColumns(key.replace('QuoteColumns.', '') as any);
    if (key.startsWith('Navigation.')) return tNav(key.replace('Navigation.', '') as any);
    return key;
  }), [tUserColumns, tQuoteColumns, tNav]);
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
            <DocumentTextIcon className="h-6 w-6 text-amber-500" />
            <CardTitle>{t('title')}</CardTitle>
        </div>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={quotes}
          filterColumnId="user_name"
          filterPlaceholder={t('filterPlaceholder')}
          onRowSelectionChange={onRowSelectionChange}
          enableSingleRowSelection={onRowSelectionChange ? true : false}
          onCreate={onCreate}
          onRefresh={onRefresh}
          isRefreshing={isRefreshing}
        />
      </CardContent>
    </Card>
  );
}
