
'use client';

import * as React from 'react';
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  Row,
  RowSelectionState,
  PaginationState,
} from '@tanstack/react-table';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DataTablePagination } from './data-table-pagination';
import { DataTableToolbar } from './data-table-toolbar';
import { useTranslations } from 'next-intl';

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  filterColumnId: string;
  filterPlaceholder: string;
  onRowSelectionChange?: (selectedRows: TData[]) => void;
  enableSingleRowSelection?: boolean;
  onCreate?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  rowSelection?: RowSelectionState;
  setRowSelection?: React.Dispatch<React.SetStateAction<RowSelectionState>>;
  pageCount?: number;
  pagination?: PaginationState;
  onPaginationChange?: React.Dispatch<React.SetStateAction<PaginationState>>;
  manualPagination?: boolean;
  columnVisibility?: VisibilityState;
  onColumnVisibilityChange?: React.Dispatch<React.SetStateAction<VisibilityState>>;
  sorting?: SortingState;
  onSortingChange?: React.Dispatch<React.SetStateAction<SortingState>>;
  columnFilters?: ColumnFiltersState;
  onColumnFiltersChange?: React.Dispatch<React.SetStateAction<ColumnFiltersState>>;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  filterColumnId,
  filterPlaceholder,
  onRowSelectionChange,
  enableSingleRowSelection = false,
  onCreate,
  onRefresh,
  isRefreshing,
  rowSelection,
  setRowSelection,
  pageCount,
  pagination,
  onPaginationChange,
  manualPagination = false,
  columnVisibility,
  onColumnVisibilityChange,
  sorting: controlledSorting,
  onSortingChange: setControlledSorting,
  columnFilters: controlledColumnFilters,
  onColumnFiltersChange: setControlledColumnFilters,
}: DataTableProps<TData, TValue>) {
  const t = useTranslations('General');
  console.log('Translations for General loaded.');
  const [internalRowSelection, setInternalRowSelection] = React.useState({});
  const [internalColumnVisibility, setInternalColumnVisibility] =
    React.useState<VisibilityState>({});
  const [internalColumnFilters, setInternalColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [internalSorting, setInternalSorting] = React.useState<SortingState>([]);

  const isControlledPagination = manualPagination && pagination !== undefined && onPaginationChange !== undefined;
  
  const sorting = controlledSorting ?? internalSorting;
  const setSorting = setControlledSorting ?? setInternalSorting;
  const columnFilters = controlledColumnFilters ?? internalColumnFilters;
  const setColumnFilters = setControlledColumnFilters ?? setInternalColumnFilters;

  const table = useReactTable({
    data,
    columns,
    pageCount: pageCount,
    state: {
      sorting,
      columnVisibility: columnVisibility ?? internalColumnVisibility,
      rowSelection: rowSelection ?? internalRowSelection,
      columnFilters,
      ...(isControlledPagination && { pagination }),
    },
    enableRowSelection: true,
    enableMultiRowSelection: !enableSingleRowSelection,
    onRowSelectionChange: setRowSelection ?? setInternalRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: onColumnVisibilityChange ?? setInternalColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: isControlledPagination,
    ...(isControlledPagination && { onPaginationChange: onPaginationChange }),
  });
  
  React.useEffect(() => {
    if (onRowSelectionChange) {
      const selectedRows = table.getFilteredSelectedRowModel().rows.map(row => row.original);
      onRowSelectionChange(selectedRows);
    }
  }, [rowSelection, internalRowSelection, table, onRowSelectionChange]);


  return (
    <div className="space-y-4">
      <DataTableToolbar 
        table={table}
        filterColumnId={filterColumnId}
        filterPlaceholder={filterPlaceholder}
        onCreate={onCreate}
        onRefresh={onRefresh}
        isRefreshing={isRefreshing}
      />
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id} style={{ width: header.getSize() !== 150 ? `${header.getSize()}px` : undefined }}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  {t('noResults')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} />
    </div>
  );
}
