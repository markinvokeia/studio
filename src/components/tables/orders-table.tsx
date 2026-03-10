'use client';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { Order } from '@/lib/types';
import { cn, formatDateTime } from '@/lib/utils';
import { api } from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnDef, RowSelectionState, flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table';
import { AlertTriangle, Receipt, ShoppingCart, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { DataTableAdvancedToolbar } from '../ui/data-table-advanced-toolbar';
import { DatePicker } from '../ui/date-picker';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Skeleton } from '../ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { DataTablePagination } from '../ui/data-table-pagination';

const getColumns = (
  t: any,
  tOrderColumns: any,
  tUserColumns: any,
  tQuoteColumns: any,
  tOrdersPage: any,
  onRowSelectionChange?: (selectedRows: Order[]) => void
): ColumnDef<Order>[] => {
  return [
    {
      id: 'select',
      header: () => null,
      cell: ({ row, table }) => (
        <RadioGroup
          value={row.getIsSelected() ? row.id : ''}
          onValueChange={() => {
            table.toggleAllPageRowsSelected(false);
            row.toggleSelected(true);
            if (onRowSelectionChange) {
              onRowSelectionChange([row.original]);
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
      accessorKey: 'status',
      header: ({ column }) => <DataTableColumnHeader column={column} title={tUserColumns('status')} />,
      cell: ({ row }) => {
        const status = (row.getValue('status') as string) || '';
        let normalizedStatus = status.toLowerCase();
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
};

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

  const columns = React.useMemo(() => getColumns(t, tOrderColumns, tUserColumns, tQuoteColumns, tOrdersPage, onRowSelectionChange), [t, tOrderColumns, tUserColumns, tQuoteColumns, tOrdersPage, onRowSelectionChange]);

  const table = useReactTable({
    data: orders,
    columns,
    state: {
      rowSelection: rowSelection ?? {},
    },
    enableRowSelection: true,
    enableMultiRowSelection: false,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const selectedOrder = React.useMemo(() => {
    const rows = table.getFilteredSelectedRowModel().rows;
    return rows.length > 0 ? rows[0].original : null;
  }, [rowSelection, orders]);

  const handleInvoiceClick = (order: Order) => {
    setSelectedOrderForInvoice(order);
    setInvoiceDate(new Date());
    setInvoiceSubmissionError(null);
    setIsInvoiceDialogOpen(true);
  };

  const handleConfirmInvoice = async () => {
    if (!selectedOrderForInvoice || !invoiceDate) return;
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
      await api.post(isSales ? API_ROUTES.SALES.ORDER_INVOICE : API_ROUTES.PURCHASES.ORDER_INVOICE, payload);
      toast({ title: 'Invoice Created' });
      if (onRefresh) onRefresh();
      setIsInvoiceDialogOpen(false);
    } catch (error) {
      setInvoiceSubmissionError(error instanceof Error ? error.message : 'Error');
    }
  };

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
    <div className={cn("h-full flex-1 flex flex-col min-h-0", className)}>
      <Card className="h-full flex-1 flex flex-col min-h-0 rounded-t-none shadow-none border-t-0">
        <CardContent className="flex-1 flex flex-col min-h-0 p-4 overflow-hidden bg-card">
          <DataTableAdvancedToolbar
            table={table}
            isCompact={isCompact}
            filterPlaceholder={tOrdersPage('filterPlaceholder')}
            searchQuery={(table.getState().columnFilters.find((f: any) => f.id === 'doc_no')?.value as string) || ''}
            onSearchChange={(value) => {
              table.setColumnFilters((prev: any) => {
                const newFilters = prev.filter((f: any) => f.id !== 'doc_no');
                if (value) {
                  newFilters.push({ id: 'doc_no', value });
                }
                return newFilters;
              });
            }}
            onCreate={onCreate}
            onRefresh={onRefresh}
            isRefreshing={isRefreshing}
            extraButtons={selectedOrder && (
              <div className="flex items-center gap-1 mr-2 px-2 border-r">
                <Button variant="ghost" size="sm" onClick={() => handleInvoiceClick(selectedOrder)} className="h-8 px-2 gap-1 text-xs font-bold text-primary hover:text-primary hover:bg-primary/10">
                  <Receipt className="h-3.5 w-3.5" />
                  {t('Navigation.InvoiceAction')}
                </Button>
              </div>
            )}
          />
          <div className="rounded-md border overflow-auto flex-1 min-h-0 relative">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_hsl(var(--border))]">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'} className="cursor-pointer">
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={columns.length} className="h-24 text-center">No results.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <DataTablePagination table={table} />
        </CardContent>
      </Card>

      <Dialog open={isInvoiceDialogOpen} onOpenChange={setIsInvoiceDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{tOrdersPage('invoiceDialog.title')}</DialogTitle>
            <DialogDescription>{tOrdersPage('invoiceDialog.description', { orderId: selectedOrderForInvoice?.doc_no })}</DialogDescription>
          </DialogHeader>
          {invoiceSubmissionError && <Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{invoiceSubmissionError}</AlertDescription></Alert>}
          <div className="flex justify-center py-4">
            <DatePicker mode="single" selected={invoiceDate} onSelect={setInvoiceDate} initialFocus />
          </div>
          <DialogFooter>
            <Button onClick={handleConfirmInvoice}>{tOrdersPage('invoiceDialog.confirm')}</Button>
            <Button variant="outline" onClick={() => setIsInvoiceDialogOpen(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
