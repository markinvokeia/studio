'use client';

import { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Order } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTranslations } from 'next-intl';
import React from 'react';
import { formatDateTime, cn } from '@/lib/utils';
import { DocumentCheckIcon } from '../icons/document-check-icon';

const getColumns = (
  t: (key: string) => string
): ColumnDef<Order>[] => [
    {
      accessorKey: 'doc_no',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('OrderColumns.orderId')} />
      ),
    },
    {
      accessorKey: 'user_name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('UserColumns.name')} />
      ),
    },
    {
      accessorKey: 'currency',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('QuoteColumns.currency')} />
      ),
      cell: ({ row }) => row.original.currency || 'N/A',
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('OrderColumns.createdAt')} />
      ),
      cell: ({ row }) => formatDateTime(row.original.createdAt),
    },
    {
      accessorKey: 'status',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('UserColumns.status')} />
      ),
      cell: ({ row }) => {
        const status = row.getValue('status') as string;
        const variant = {
          completed: 'success',
          pending: 'info',
          processing: 'default',
          cancelled: 'destructive',
        }[status.toLowerCase()] ?? ('default' as any);

        return (
          <Badge variant={variant} className="capitalize">
            {status}
          </Badge>
        );
      },
    },
  ];

interface RecentOrdersTableProps {
  orders: Order[];
  onRefresh?: () => void;
  isRefreshing?: boolean;
  className?: string;
}

export function RecentOrdersTable({ orders, onRefresh, isRefreshing, className }: RecentOrdersTableProps) {
  const t = useTranslations();
  const columns = React.useMemo(() => getColumns(t), [t]);

  return (
    <Card className={cn("h-full flex-1 flex flex-col min-h-0", className)}>
      <CardHeader className="flex-none p-4 pb-2">
        <div className="flex items-start gap-3">
          <div className="header-icon-circle mt-0.5">
            <DocumentCheckIcon className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <CardTitle className="text-lg">{t('RecentOrdersTable.title')}</CardTitle>
            <CardDescription className="text-xs">{t('RecentOrdersTable.description')}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden pt-2">
        <DataTable
          columns={columns}
          data={orders}
          filterColumnId="doc_no"
          filterPlaceholder={t('RecentOrdersTable.filterPlaceholder')}
          onRefresh={onRefresh}
          isRefreshing={isRefreshing}
        />
      </CardContent>
    </Card>
  );
}
