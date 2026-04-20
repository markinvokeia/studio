
'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Skeleton } from '@/components/ui/skeleton';
import { OrderItem, QuoteItem } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';
import { ColumnDef, RowSelectionState } from '@tanstack/react-table';
import { CalendarCheck, CheckCircle2, MoreHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

const DateCell = ({ dateValue }: { dateValue: string | null | undefined }) => {
  const tGeneral = useTranslations('General');
  const notAvailable = tGeneral('notAvailable');

  if (!dateValue || dateValue === notAvailable) {
    return <Badge variant="destructive">{notAvailable}</Badge>;
  }

  const date = new Date(dateValue);
  const now = new Date();
  date.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);

  if (date < now) {
    return <Badge variant="success">{formatDateTime(dateValue)}</Badge>;
  }
  return <Badge variant="info">{formatDateTime(dateValue)}</Badge>;
};

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
  onRowSelectionChange?: (selectedRows: QuoteItem[]) => void;
  rowSelection?: RowSelectionState;
  setRowSelection?: React.Dispatch<React.SetStateAction<RowSelectionState>>;
  // Confirmed-quote schedule/complete props
  quoteStatus?: string;
  orderItemsByQuoteItemId?: Map<string, OrderItem>;
  onSchedule?: (orderItem: OrderItem) => void;
  onComplete?: (orderItem: OrderItem) => void;
  canSchedule?: boolean;
  canComplete?: boolean;
}

const getColumns = (
  t: (key: string) => string,
  tOIT: (key: string) => string,
  onEdit: (item: QuoteItem) => void,
  onDelete: (item: QuoteItem) => void,
  canEdit: boolean,
  showToothNumber: boolean = true,
  onRowSelectionChange?: (selectedRows: QuoteItem[]) => void,
  isConfirmed?: boolean,
  orderItemsByQuoteItemId?: Map<string, OrderItem>,
  onSchedule?: (orderItem: OrderItem) => void,
  onComplete?: (orderItem: OrderItem) => void,
  canSchedule?: boolean,
  canComplete?: boolean
): ColumnDef<QuoteItem>[] => {
  const baseColumns: ColumnDef<QuoteItem>[] = [
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
        <DataTableColumnHeader column={column} title={t('id')} />
      ),
    },
    {
      accessorKey: 'service_name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('service')} />
      ),
      cell: ({ row }) => (
        <div className="truncate max-w-[600px]" title={row.getValue('service_name')}>
          {row.getValue('service_name')}
        </div>
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
    {
      id: 'actions',
      cell: ({ row }) => {
        const item = row.original;
        const orderItem = isConfirmed && orderItemsByQuoteItemId ? orderItemsByQuoteItemId.get(String(item.id)) : undefined;
        return (
          <div className="flex items-center gap-1">
            {isConfirmed && orderItem && (
              <>
                {canSchedule && !orderItem.scheduled_date && onSchedule && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 text-xs"
                    onClick={() => onSchedule(orderItem)}
                  >
                    <CalendarCheck className="h-3.5 w-3.5" />
                    {tOIT('actions.schedule')}
                  </Button>
                )}
                {canComplete && orderItem.scheduled_date && !orderItem.completed_date && onComplete && (
                  <Button
                    variant="default"
                    size="sm"
                    className="h-7 gap-1 text-xs bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => onComplete(orderItem)}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {tOIT('actions.complete')}
                  </Button>
                )}
              </>
            )}
            {canEdit && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-8 w-8 p-0">
                    <span className="sr-only">Open menu</span>
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>{t('actions')}</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => onEdit(item)}>{t('edit')}</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onDelete(item)} className="text-destructive">{t('delete')}</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        );
      },
    },
  ];

  // Insert tooth_number column after service_name if needed
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
    baseColumns.splice(2, 0, toothNumberColumn); // Insert at index 2 (after service_name)
  }

  // Add status + date columns before 'actions' when quote is confirmed
  if (isConfirmed && orderItemsByQuoteItemId) {
    const confirmedColumns: ColumnDef<QuoteItem>[] = [
      {
        id: 'order_status',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={tOIT('columns.status')} />
        ),
        cell: ({ row }) => {
          const orderItem = orderItemsByQuoteItemId.get(String(row.original.id));
          if (!orderItem) return <span className="text-muted-foreground">—</span>;
          const status = orderItem.status?.toLowerCase() ?? '';
          const variant = status === 'completed' ? 'success' : status === 'scheduled' ? 'info' : status === 'cancelled' ? 'destructive' : 'default';
          return (
            <Badge variant={variant as any} className="capitalize">
              {tOIT(`status.${status}`) || status}
            </Badge>
          );
        },
      },
      {
        id: 'scheduled_date',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={tOIT('columns.scheduled')} />
        ),
        cell: ({ row }) => {
          const orderItem = orderItemsByQuoteItemId.get(String(row.original.id));
          return <DateCell dateValue={orderItem?.scheduled_date} />;
        },
      },
      {
        id: 'completed_date',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={tOIT('columns.completed')} />
        ),
        cell: ({ row }) => {
          const orderItem = orderItemsByQuoteItemId.get(String(row.original.id));
          return <DateCell dateValue={orderItem?.completed_date} />;
        },
      },
      {
        id: 'invoiced_date',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={tOIT('columns.invoiced')} />
        ),
        cell: ({ row }) => {
          const orderItem = orderItemsByQuoteItemId.get(String(row.original.id));
          return <DateCell dateValue={orderItem?.invoiced_date} />;
        },
      },
    ];
    // Insert before 'actions' column (last element)
    baseColumns.splice(baseColumns.length - 1, 0, ...confirmedColumns);
  }

  return baseColumns;
};

export function QuoteItemsTable({ items, isLoading = false, onRefresh, isRefreshing, canEdit, onCreate, onEdit, onDelete, showToothNumber = true, onRowSelectionChange, rowSelection, setRowSelection, quoteStatus, orderItemsByQuoteItemId, onSchedule, onComplete, canSchedule, canComplete }: QuoteItemsTableProps) {
  const t = useTranslations('QuotesPage.itemDialog');
  const tShared = useTranslations('UserColumns');
  const tOIT = useTranslations('OrderItemsTable');
  const isConfirmed = quoteStatus?.toLowerCase() === 'confirmed';
  const columns = getColumns(
    (key) => {
      try {
        return t(key);
      } catch (e) {
        return tShared(key);
      }
    },
    (key) => tOIT(key as any),
    onEdit,
    onDelete,
    canEdit,
    showToothNumber,
    onRowSelectionChange,
    isConfirmed,
    orderItemsByQuoteItemId,
    onSchedule,
    onComplete,
    canSchedule,
    canComplete
  );

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
          filterPlaceholder={t('searchService')}
          onRefresh={onRefresh}
          isRefreshing={isRefreshing}
          onCreate={canEdit ? onCreate : undefined}
          enableSingleRowSelection={onRowSelectionChange ? true : false}
          onRowSelectionChange={onRowSelectionChange}
          rowSelection={rowSelection}
          setRowSelection={setRowSelection}
          columnTranslations={{
            id: t('id'),
            service_name: t('service'),
            ...(showToothNumber && { tooth_number: t('toothNumber') }),
            quantity: t('quantity'),
            unit_price: t('unitPrice'),
            total: t('total'),
          }}
        />
      </CardContent>
    </Card>
  );
}
