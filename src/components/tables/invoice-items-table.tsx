'use client';

import * as React from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { InvoiceItem } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslations } from 'next-intl';
import { MoreHorizontal } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Button } from '../ui/button';

interface InvoiceItemsTableProps {
  items: InvoiceItem[];
  isLoading?: boolean;
  canEdit?: boolean;
  onEdit?: (item: InvoiceItem) => void;
  onDelete?: (item: InvoiceItem) => void;
}

export function InvoiceItemsTable({ items, isLoading = false, canEdit = false, onEdit, onDelete }: InvoiceItemsTableProps) {
  const t = useTranslations('InvoiceItemsTable');

  const columns: ColumnDef<InvoiceItem>[] = [
    {
      accessorKey: 'id',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('columns.id')} />
      ),
    },
    {
      accessorKey: 'service_name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('columns.service')} />
      ),
    },
    {
      accessorKey: 'quantity',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('columns.quantity')} />
      ),
    },
    {
      accessorKey: 'unit_price',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('columns.unitPrice')} />
      ),
      cell: ({ row }) => {
        const amount = parseFloat(row.getValue('unit_price'));
        const formatted = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
        }).format(amount);
        return <div className="font-medium">{formatted}</div>;
      },
    },
    {
      accessorKey: 'total',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('columns.total')} />
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
      id: 'actions',
      cell: ({ row }) => {
        const item = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0" disabled={!canEdit}>
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{t('actions.title')}</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => onEdit && onEdit(item)} disabled={!canEdit}>
                {t('actions.edit')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDelete && onDelete(item)} className="text-destructive" disabled={!canEdit}>
                {t('actions.delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    }
  ];

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
  return (
    <Card>
      <CardContent className="p-4">
        <DataTable
          columns={columns}
          data={items}
          filterColumnId="service_name"
          filterPlaceholder={t('filterPlaceholder')}
          columnTranslations={{
            id: t('columns.id'),
            service_name: t('columns.service'),
            quantity: t('columns.quantity'),
            unit_price: t('columns.unitPrice'),
            total: t('columns.total'),
          }}
        />
      </CardContent>
    </Card>
  );
}
