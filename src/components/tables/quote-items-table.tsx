'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Skeleton } from '@/components/ui/skeleton';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { QuoteItem } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ColumnDef, RowSelectionState } from '@tanstack/react-table';
import { Edit3, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

interface QuoteItemsTableProps {
  items: QuoteItem[];
  isLoading?: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  canEdit: boolean;
  onCreate: () => void;
  onEdit: (item: QuoteItem) => void;
  onDelete: (item: QuoteItem) => void;
  showToothNumber?: boolean;
}

const getColumns = (
  t: (key: string) => string,
  showToothNumber: boolean = true
): ColumnDef<QuoteItem>[] => {
  const baseColumns: ColumnDef<QuoteItem>[] = [
    {
      id: 'select',
      header: () => null,
      cell: ({ row, table }) => (
        <RadioGroup
          value={row.getIsSelected() ? row.id : ''}
          onValueChange={() => {
            table.toggleAllPageRowsSelected(false);
            row.toggleSelected(true);
          }}
        >
          <RadioGroupItem value={row.id} />
        </RadioGroup>
      ),
      size: 40,
    },
    {
      accessorKey: 'service_name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('service')} />
      ),
    },
    {
      accessorKey: 'quantity',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('quantity')} />
      ),
    },
    {
      accessorKey: 'unit_price',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('unitPrice')} />
      ),
      cell: ({ row }) => {
        const amount = parseFloat(row.getValue('unit_price'));
        const roundedAmount = Math.round(amount * 100) / 100;
        const formatted = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
        }).format(roundedAmount);
        return <div className="font-medium">{formatted}</div>;
      },
    },
    {
      accessorKey: 'total',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('total')} />
      ),
      cell: ({ row }) => {
        const amount = parseFloat(row.getValue('total'));
        const roundedAmount = Math.round(amount * 100) / 100;
        const formatted = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
        }).format(roundedAmount);
        return <div className="font-medium">{formatted}</div>;
      },
    },
  ];

  if (showToothNumber) {
    const toothNumberColumn: ColumnDef<QuoteItem> = {
      accessorKey: 'tooth_number',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('toothNumber')} />
      ),
      cell: ({ row }) => {
        const toothNumber = row.getValue('tooth_number') as number;
        return toothNumber ? <div className="font-medium">{toothNumber}</div> : <div className="text-muted-foreground">-</div>;
      },
    };
    baseColumns.splice(2, 0, toothNumberColumn);
  }

  return baseColumns;
};

export function QuoteItemsTable({ items, isLoading = false, onRefresh, isRefreshing, canEdit, onCreate, onEdit, onDelete, showToothNumber = true }: QuoteItemsTableProps) {
  const t = useTranslations('QuotesPage.itemDialog');
  const tShared = useTranslations('UserColumns');
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});

  const selectedItem = React.useMemo(() => {
    const selectedIndex = Object.keys(rowSelection)[0];
    return selectedIndex !== undefined ? items[parseInt(selectedIndex)] : null;
  }, [rowSelection, items]);

  const columns = React.useMemo(() => getColumns(
    (key) => {
      try {
        return t(key);
      } catch (e) {
        return tShared(key);
      }
    },
    showToothNumber
  ), [t, tShared, showToothNumber]);

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
    <Card className="h-full flex flex-col min-h-0 rounded-t-none shadow-none border-t-0">
      <CardContent className="flex-1 flex flex-col min-h-0 p-4 bg-card">
        <DataTable
          columns={columns}
          data={items}
          filterColumnId="service_name"
          filterPlaceholder={t('searchService')}
          onRefresh={onRefresh}
          isRefreshing={isRefreshing}
          onCreate={canEdit ? onCreate : undefined}
          enableSingleRowSelection={true}
          rowSelection={rowSelection}
          setRowSelection={setRowSelection}
          columnTranslations={{
            service_name: t('service'),
            ...(showToothNumber && { tooth_number: t('toothNumber') }),
            quantity: t('quantity'),
            unit_price: t('unitPrice'),
            total: t('total'),
          }}
          extraButtons={selectedItem && canEdit && (
            <div className="flex items-center gap-1 mr-2 px-2 border-r">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(selectedItem)}
                className="h-8 px-2 gap-1 text-xs font-bold text-primary hover:text-primary hover:bg-primary/10"
              >
                <Edit3 className="h-3.5 w-3.5" />
                {t('edit')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(selectedItem)}
                className="h-8 px-2 gap-1 text-xs font-bold text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t('delete')}
              </Button>
            </div>
          )}
        />
      </CardContent>
    </Card>
  );
}
