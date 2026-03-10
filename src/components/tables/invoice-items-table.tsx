'use client';

import * as React from 'react';
import { ColumnDef, RowSelectionState, flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { InvoiceItem } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslations } from 'next-intl';
import { Edit3, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { DataTableAdvancedToolbar } from '../ui/data-table-advanced-toolbar';
import { DataTablePagination } from '../ui/data-table-pagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

interface InvoiceItemsTableProps {
  items: InvoiceItem[];
  isLoading?: boolean;
  canEdit?: boolean;
  onEdit?: (item: InvoiceItem) => void;
  onDelete?: (item: InvoiceItem) => void;
}

const getColumns = (
  t: any,
  onRowSelectionChange?: (selectedRows: InvoiceItem[]) => void
): ColumnDef<InvoiceItem>[] => [
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
      accessorKey: 'service_name',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.service')} />,
    },
    {
      accessorKey: 'quantity',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.quantity')} />,
    },
    {
      accessorKey: 'unit_price',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.unitPrice')} />,
      cell: ({ row }) => {
        const amount = parseFloat(row.getValue('unit_price'));
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
      },
    },
    {
      accessorKey: 'total',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.total')} />,
      cell: ({ row }) => {
        const amount = parseFloat(row.getValue('total'));
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
      },
    },
  ];

export function InvoiceItemsTable({ items, isLoading = false, canEdit = false, onEdit, onDelete }: InvoiceItemsTableProps) {
  const t = useTranslations('InvoicesPage.InvoiceItemsTable');
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});

  const columns = React.useMemo(() => getColumns(t), [t]);

  const table = useReactTable({
    data: items,
    columns,
    state: { rowSelection },
    enableRowSelection: true,
    enableMultiRowSelection: false,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const selectedItem = React.useMemo(() => {
    const rows = table.getFilteredSelectedRowModel().rows;
    return rows.length > 0 ? rows[0].original : null;
  }, [rowSelection, items]);

  if (isLoading) return <div className="space-y-4 pt-4"><Skeleton className="h-8 w-full" /><Skeleton className="h-12 w-full" /></div>;

  return (
    <Card className="h-full flex-1 flex flex-col min-h-0 rounded-t-none shadow-none border-t-0">
      <CardContent className="flex-1 flex flex-col min-h-0 p-4 bg-card">
        <DataTableAdvancedToolbar
          table={table}
          filterPlaceholder={t('filterPlaceholder')}
          searchQuery={(table.getState().columnFilters.find((f: any) => f.id === 'service_name')?.value as string) || ''}
          onSearchChange={(value) => table.getColumn('service_name')?.setFilterValue(value)}
          extraButtons={selectedItem && canEdit && (
            <div className="flex items-center gap-1 mr-2 px-2 border-r">
              <Button variant="ghost" size="sm" onClick={() => onEdit?.(selectedItem)} className="h-8 px-2 gap-1 text-xs font-bold text-primary hover:text-primary hover:bg-primary/10">
                <Edit3 className="h-3.5 w-3.5" /> {t('actions.edit')}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onDelete?.(selectedItem)} className="h-8 px-2 gap-1 text-xs font-bold text-destructive hover:text-destructive hover:bg-destructive/10">
                <Trash2 className="h-3.5 w-3.5" /> {t('actions.delete')}
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
                  <TableRow 
                    key={row.id} 
                    data-state={row.getIsSelected() && 'selected'} 
                    className="cursor-pointer"
                    onClick={() => {
                      table.toggleAllPageRowsSelected(false);
                      row.toggleSelected(true);
                    }}
                  >
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
