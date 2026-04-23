'use client';

import * as React from 'react';
import { ColumnDef, RowSelectionState } from '@tanstack/react-table';
import { useNarrowMode } from '@/components/layout/two-panel-layout';
import { DataCard } from '@/components/ui/data-card';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';
import { InvoiceItem } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslations } from 'next-intl';
import { MoreHorizontal } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Button } from '../ui/button';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';

interface InvoiceItemsTableProps {
  items: InvoiceItem[];
  isLoading?: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onCreate?: () => void;
  canEdit?: boolean;
  onEdit?: (item: InvoiceItem) => void;
  onDelete?: (item: InvoiceItem) => void;
  onRowSelectionChange?: (selectedRows: InvoiceItem[]) => void;
  rowSelection?: RowSelectionState;
  setRowSelection?: React.Dispatch<React.SetStateAction<RowSelectionState>>;
}

export function InvoiceItemsTable({ items, isLoading = false, onRefresh, isRefreshing, onCreate, canEdit = false, onEdit, onDelete, onRowSelectionChange, rowSelection, setRowSelection }: InvoiceItemsTableProps) {
  const t = useTranslations('InvoicesPage.InvoiceItemsTable');
  const { isNarrow: panelNarrow } = useNarrowMode();
  const viewportNarrow = useViewportNarrow();
  const isNarrow = panelNarrow || viewportNarrow;

  const columns: ColumnDef<InvoiceItem>[] = [
    {
      id: 'select',
      header: () => null,
      cell: ({ row, table }) => {
        const isSelected = row.getIsSelected();
        return (
          <RadioGroup
            value={isSelected ? row.id : ''}
            onValueChange={() => {
              if (onRowSelectionChange) {
                table.toggleAllPageRowsSelected(false);
                row.toggleSelected(true);
              }
            }}
          >
            <RadioGroupItem value={row.id} id={row.id} aria-label="Select row" />
          </RadioGroup>
        );
      },
      enableSorting: false,
      enableHiding: false,
    },
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
    <Card className="h-full flex flex-col min-h-0">
      <CardContent className="flex-1 flex flex-col min-h-0 p-4">
        <DataTable
          columns={columns}
          data={items}
          filterColumnId="service_name"
          filterPlaceholder={t('filterPlaceholder')}
          onRefresh={onRefresh}
          isRefreshing={isRefreshing}
          onCreate={canEdit ? onCreate : undefined}
          enableSingleRowSelection={onRowSelectionChange ? true : false}
          onRowSelectionChange={onRowSelectionChange}
          rowSelection={rowSelection}
          setRowSelection={setRowSelection}
          isNarrow={isNarrow}
          renderCard={(item: InvoiceItem, isSelected: boolean) => (
            <DataCard
              isSelected={isSelected}
              title={item.service_name || String(item.id)}
              subtitle={[
                `${t('columns.quantity')}: ${item.quantity}`,
                `${t('columns.total')}: ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(item.total || 0)}`,
              ].filter(Boolean).join(' · ')}
              showArrow={!!onRowSelectionChange}
              onClick={() => onRowSelectionChange?.([item])}
            />
          )}
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
