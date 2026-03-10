'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Payment } from '@/lib/types';
import { cn, formatDateTime } from '@/lib/utils';
import { ColumnDef, RowSelectionState, flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table';
import { MoreHorizontal, Printer, Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { Button } from '../ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Skeleton } from '../ui/skeleton';
import { DataTableAdvancedToolbar } from '../ui/data-table-advanced-toolbar';
import { DataTablePagination } from '../ui/data-table-pagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

const getColumns = (
  t: any,
  tTransactionType: any,
  tPaymentMethods: any,
  onRowSelectionChange?: (selectedRows: Payment[]) => void
): ColumnDef<Payment>[] => [
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
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('doc_no')} />,
    },
    {
      accessorKey: 'user_name',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('user')} />,
    },
    {
      accessorKey: 'payment_date',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('date')} />,
      cell: ({ row }) => formatDateTime(row.getValue('payment_date'))
    },
    {
      accessorKey: 'amount_applied',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('amount_applied')} />,
      cell: ({ row }) => {
        const amount = parseFloat(row.getValue('amount_applied'));
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: row.original.currency || 'USD' }).format(amount);
      },
    },
    {
      accessorKey: 'payment_method_code',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('method')} />,
      cell: ({ row }) => {
        const code = row.original.payment_method_code || row.original.method;
        return tPaymentMethods(code) || code;
      }
    },
  ];

export function PaymentsTable({ payments, isLoading = false, onRefresh, isRefreshing, columnsToHide = [], onPrint, onSendEmail, onCreate, className, pagination, onPaginationChange, pageCount, manualPagination = false, onRowSelectionChange, rowSelection, setRowSelection }: PaymentsTableProps) {
  const t = useTranslations('PaymentsPage.columns');
  const tPage = useTranslations('PaymentsPage');
  const tTransactionType = useTranslations('PaymentsPage.transactionType');
  const tActions = useTranslations('PaymentsPage.actions');
  const tPaymentMethods = useTranslations('PaymentsPage.columns.paymentMethods');
  const columns = React.useMemo(() => getColumns(t, tTransactionType, tPaymentMethods, onRowSelectionChange), [t, tTransactionType, tPaymentMethods, onRowSelectionChange]);

  const table = useReactTable({
    data: payments,
    columns,
    state: { rowSelection: rowSelection ?? {}, ...(manualPagination && { pagination }) },
    enableRowSelection: true,
    enableMultiRowSelection: false,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    manualPagination,
    ...(manualPagination && { pageCount, onPaginationChange }),
  });

  const selectedPayment = React.useMemo(() => {
    const rows = table.getFilteredSelectedRowModel().rows;
    return rows.length > 0 ? rows[0].original : null;
  }, [rowSelection, payments]);

  if (isLoading) return <div className="space-y-4 pt-4"><Skeleton className="h-8 w-full" /><Skeleton className="h-12 w-full" /></div>;

  return (
    <Card className={cn("h-full flex-1 flex flex-col min-h-0 rounded-t-none shadow-none border-t-0", className)}>
      <CardContent className="flex-1 flex flex-col min-h-0 p-4 overflow-hidden bg-card">
        <DataTableAdvancedToolbar
          table={table}
          filterPlaceholder={tPage('filterPlaceholder')}
          searchQuery={(table.getState().columnFilters.find((f: any) => f.id === 'doc_no')?.value as string) || ''}
          onSearchChange={(value) => table.getColumn('doc_no')?.setFilterValue(value)}
          onCreate={onCreate}
          createButtonLabel={tPage('createPrepaid')}
          onRefresh={onRefresh}
          isRefreshing={isRefreshing}
          extraButtons={selectedPayment && (
            <div className="flex items-center gap-1 mr-2 px-2 border-r">
              <Button variant="ghost" size="sm" onClick={() => onPrint?.(selectedPayment)} className="h-8 px-2 gap-1 text-xs font-bold text-primary">
                <Printer className="h-3.5 w-3.5" /> {tActions('print')}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onSendEmail?.(selectedPayment)} className="h-8 px-2 gap-1 text-xs font-bold text-primary">
                <Send className="h-3.5 w-3.5" /> {tActions('sendEmail')}
              </Button>
            </div>
          )}
        />
        <div className="rounded-md border overflow-auto flex-1 min-h-0 relative mt-4">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_hsl(var(--border))]">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</TableHead>
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
  );
}
