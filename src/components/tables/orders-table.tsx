'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { Order } from '@/lib/types';
import { cn, formatDateTime } from '@/lib/utils';
import { api } from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnDef, RowSelectionState } from '@tanstack/react-table';
import { AlertTriangle, Receipt, ShoppingCart } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { DataTableAdvancedToolbar } from '../ui/data-table-advanced-toolbar';
import { DatePicker } from '../ui/date-picker';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Skeleton } from '../ui/skeleton';

interface OrdersTableProps {
  orders: Order[];
  isLoading?: boolean;
  onRowSelectionChange?: (selectedRows: Order[]) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onCreate?: () => void;
  rowSelection?: RowSelectionState;
  setRowSelection?: React.Dispatch<React.SetStateAction<RowSelectionState>>;
  columnTranslations?: { [key: string]: string };
  columnsToHide?: string[];
  isSales?: boolean;
  className?: string;
  isCompact?: boolean;
  title?: string;
  description?: string;
  standalone?: boolean;
}

export function OrdersTable({ orders, isLoading = false, onRowSelectionChange, onRefresh, isRefreshing, onCreate, rowSelection, setRowSelection, columnTranslations, columnsToHide = [], isSales = true, className, isCompact = false, title, description, standalone = false }: OrdersTableProps) {
  const t = useTranslations();
  const tOrderColumns = useTranslations('OrderColumns');
  const tUserColumns = useTranslations('UserColumns');
  const tQuoteColumns = useTranslations('QuoteColumns');
  const tOrdersPage = useTranslations('OrdersPage');
  const { toast } = useToast();
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = React.useState(false);
  const [selectedOrderForInvoice, setSelectedOrderForInvoice] = React.useState<Order | null>(null);
  const [invoiceDate, setInvoiceDate] = React.useState<Date | undefined>(new Date());
  const [invoiceSubmissionError, setInvoiceSubmissionError] = React.useState<string | null>(null);
  const locale = useLocale();

  const handleInvoiceClick = (order: Order) => {
    setSelectedOrderForInvoice(order);
    setInvoiceDate(new Date());
    setInvoiceSubmissionError(null);
    setIsInvoiceDialogOpen(true);
  };

  const handleConfirmInvoice = async () => {
    if (!selectedOrderForInvoice || !invoiceDate) return;
    setInvoiceSubmissionError(null);
    try {
      const payload = {
        order_id: selectedOrderForInvoice.id,
        is_sales: isSales,
        query: JSON.stringify({
          order_id: parseInt(selectedOrderForInvoice.id, 10),
          invoice_date: invoiceDate.toISOString(),
          is_sales: isSales,
          user_id: selectedOrderForInvoice.user_id,
        }),
      };

      const apiRoute = isSales ? API_ROUTES.SALES.ORDER_INVOICE : API_ROUTES.PURCHASES.ORDER_INVOICE;
      const responseData = await api.post(apiRoute, payload);
      if (responseData.error || (responseData.code && responseData.code >= 400)) {
        if (responseData.message) {
          setInvoiceSubmissionError(responseData.message);
          return;
        }
        throw new Error(tOrdersPage('invoiceDialog.createError'));
      }

      toast({
        title: tOrdersPage('invoiceDialog.invoiceSuccess'),
        description: tOrdersPage('invoiceDialog.invoiceSuccessDesc', { orderId: selectedOrderForInvoice.doc_no }),
      });

      if (onRefresh) {
        onRefresh();
      }
      setIsInvoiceDialogOpen(false);
      setSelectedOrderForInvoice(null);

    } catch (error) {
      setInvoiceSubmissionError(error instanceof Error ? error.message : tOrdersPage('invoiceDialog.createError'));
    }
  };

  const columns: ColumnDef<Order>[] = [
    {
      id: 'select',
      header: () => null,
      cell: ({ row, table }) => (
        <RadioGroup
          value={row.getIsSelected() ? row.id : ''}
          onValueChange={() => {
            if (onRowSelectionChange) {
              table.toggleAllPageRowsSelected(false);
              row.toggleSelected(true);
            }
          }}
        >
          <RadioGroupItem value={row.id} />
        </RadioGroup>
      ),
      size: 40,
    },
    {
      accessorKey: 'doc_no',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={tOrderColumns('orderId')} />
      ),
      cell: ({ row }) => row.original.doc_no || `ORD-${row.original.id}`,
    },
    {
      accessorKey: 'user_name',
      header: ({ column }) => <DataTableColumnHeader column={column} title={tUserColumns('name')} />,
    },
    {
      accessorKey: 'quote_doc_no',
      header: ({ column }) => <DataTableColumnHeader column={column} title={tQuoteColumns('quoteDocNo')} />,
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
        <DataTableColumnHeader column={column} title={tUserColumns('status')} />
      ),
      cell: ({ row }) => {
        const status = (row.getValue('status') as string) || '';
        let normalizedStatus = status.toLowerCase();
        if (normalizedStatus === 'in progress') {
          normalizedStatus = 'processing';
        }
        const variant = {
          completed: 'success',
          pending: 'info',
          processing: 'default',
          cancelled: 'destructive',
        }[normalizedStatus] ?? ('default' as any);

        return (
          <Badge variant={variant} className="capitalize">
            {tOrdersPage(`status.${normalizedStatus}` as any)}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={tOrderColumns('createdAt')} />
      ),
      cell: ({ row }) => formatDateTime(row.original.createdAt),
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
  const filteredColumns = columns.filter(col => {
    const key = (col as any).accessorKey;
    return !key || !columnsToHide.includes(key);
  });

  const availableFilterColumns = filteredColumns
    .map(col => (col as any).accessorKey)
    .filter(key => key);
  const filterColumnId = availableFilterColumns.includes('doc_no') ? 'doc_no' : (availableFilterColumns[0] || '');

  const internalSelectedOrder = React.useMemo(() => {
    if (!rowSelection) return null;
    const selectedIndex = Object.keys(rowSelection)[0];
    return selectedIndex !== undefined ? orders[parseInt(selectedIndex)] : null;
  }, [rowSelection, orders]);

  return (
    <div className={cn("h-full flex-1 flex flex-col min-h-0", className)}>
      <Card className="h-full flex-1 flex flex-col min-h-0 rounded-t-none shadow-none border-t-0">
        {title && (
          <CardHeader className="flex-none p-4">
            <div className="flex items-start gap-3">
              <div className="header-icon-circle mt-0.5">
                <ShoppingCart className="h-5 w-5" />
              </div>
              <div className="flex flex-col">
                <CardTitle className="text-lg">{title}</CardTitle>
                {description && <CardDescription className="text-xs">{description}</CardDescription>}
              </div>
            </div>
          </CardHeader>
        )}
        <CardContent className="flex-1 flex flex-col min-h-0 p-4 overflow-hidden bg-card">
          <DataTable
            columns={filteredColumns}
            data={orders}
            filterColumnId={filterColumnId}
            onRowSelectionChange={onRowSelectionChange}
            enableSingleRowSelection={true}
            onRefresh={onRefresh}
            isRefreshing={isRefreshing}
            onCreate={onCreate}
            rowSelection={rowSelection}
            setRowSelection={setRowSelection}
            customToolbar={standalone ? (table) => (
              <DataTableAdvancedToolbar
                table={table}
                isCompact={isCompact}
                filterPlaceholder={tOrdersPage('filterPlaceholder')}
                searchQuery={(table.getState().columnFilters.find((f: any) => f.id === filterColumnId)?.value as string) || ''}
                onSearchChange={(value) => {
                  table.setColumnFilters((prev: any) => {
                    const newFilters = prev.filter((f: any) => f.id !== filterColumnId);
                    if (value) {
                      newFilters.push({ id: filterColumnId, value });
                    }
                    return newFilters;
                  });
                }}
                onCreate={onCreate}
                onRefresh={onRefresh}
                isRefreshing={isRefreshing}
                columnTranslations={{
                  doc_no: tOrderColumns('orderId'),
                  user_name: tUserColumns('name'),
                  quote_id: tQuoteColumns('quoteId'),
                  currency: t('QuoteColumns.currency'),
                  status: tUserColumns('status'),
                  createdAt: tOrderColumns('createdAt'),
                }}
                extraButtons={internalSelectedOrder && (
                  <div className="flex items-center gap-1 mr-2 px-2 border-r">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleInvoiceClick(internalSelectedOrder)}
                      className="h-8 px-2 gap-1 text-xs font-bold text-primary hover:text-primary hover:bg-primary/10"
                    >
                      <Receipt className="h-3.5 w-3.5" />
                      {t('Navigation.InvoiceAction')}
                    </Button>
                  </div>
                )}
              />
            ) : undefined}
            columnTranslations={{
              doc_no: tOrderColumns('orderId'),
              user_name: tUserColumns('name'),
              quote_id: tQuoteColumns('quoteId'),
              currency: t('QuoteColumns.currency'),
              status: tUserColumns('status'),
              createdAt: tOrderColumns('createdAt'),
            }}
          />
        </CardContent>
      </Card>

      <Dialog open={isInvoiceDialogOpen} onOpenChange={setIsInvoiceDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{tOrdersPage('invoiceDialog.title')}</DialogTitle>
            <DialogDescription>
              {tOrdersPage('invoiceDialog.description', { orderId: selectedOrderForInvoice?.doc_no })}
            </DialogDescription>
          </DialogHeader>
          {invoiceSubmissionError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{tOrdersPage('invoiceDialog.error')}</AlertTitle>
              <AlertDescription>{invoiceSubmissionError}</AlertDescription>
            </Alert>
          )}
          <div className="flex justify-center py-4">
            <DatePicker
              mode="single"
              selected={invoiceDate}
              onSelect={setInvoiceDate}
              initialFocus
            />
          </div>
          <DialogFooter>
            <Button onClick={handleConfirmInvoice}>{tOrdersPage('invoiceDialog.confirm')}</Button>
            <Button variant="outline" onClick={() => setIsInvoiceDialogOpen(false)}>{tOrdersPage('cancel')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
