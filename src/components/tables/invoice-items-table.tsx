'use client';

import * as React from 'react';
import { ColumnDef, RowSelectionState } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { InvoiceItem } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslations } from 'next-intl';
import { Edit3, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';

interface InvoiceItemsTableProps {
  items: InvoiceItem[];
  isLoading?: boolean;
  canEdit?: boolean;
  onEdit?: (item: InvoiceItem) => void;
  onDelete?: (item: InvoiceItem) => void;
}

export function InvoiceItemsTable({ items, isLoading = false, canEdit = false, onEdit, onDelete }: InvoiceItemsTableProps) {
  const t = useTranslations('InvoicesPage.InvoiceItemsTable');
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});

  const selectedItem = React.useMemo(() => {
    const selectedIndex = Object.keys(rowSelection)[0];
    return selectedIndex !== undefined ? items[parseInt(selectedIndex)] : null;
  }, [rowSelection, items]);

  const columns: ColumnDef<InvoiceItem>[] = [
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
    <Card className="h-full flex flex-col min-h-0 rounded-t-none shadow-none border-t-0">
      <CardContent className="flex-1 flex flex-col min-h-0 p-4 bg-card">
        <DataTable
          columns={columns}
          data={items}
          filterColumnId="service_name"
          filterPlaceholder={t('filterPlaceholder')}
          enableSingleRowSelection={true}
          rowSelection={rowSelection}
          setRowSelection={setRowSelection}
          columnTranslations={{
            service_name: t('columns.service'),
            quantity: t('columns.quantity'),
            unit_price: t('columns.unitPrice'),
            total: t('columns.total'),
          }}
          extraButtons={selectedItem && canEdit && (
            <div className="flex items-center gap-1 mr-2 px-2 border-r">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit?.(selectedItem)}
                className="h-8 px-2 gap-1 text-xs font-bold text-primary hover:text-primary hover:bg-primary/10"
              >
                <Edit3 className="h-3.5 w-3.5" />
                {t('actions.edit')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete?.(selectedItem)}
                className="h-8 px-2 gap-1 text-xs font-bold text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t('actions.delete')}
              </Button>
            </div>
          )}
        />
      </CardContent>
    </Card>
  );
}
