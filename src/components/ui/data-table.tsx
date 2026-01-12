
'use client';

import * as React from 'react';
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
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

import { cn } from '@/lib/utils';

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  filterColumnId?: string;
  filterPlaceholder?: string;
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
  columnTranslations?: { [key: string]: string };
  extraButtons?: React.ReactNode;
  createButtonLabel?: string;
  filterOptions?: { label: string; value: string }[];
  onFilterChange?: (value: string) => void;
  filterValue?: string;
  createButtonIconOnly?: boolean;
  customToolbar?: React.ReactNode | ((table: any) => React.ReactNode);
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
  columnTranslations = {},
  extraButtons,
  createButtonLabel,
  filterOptions,
  onFilterChange,
  filterValue,
  createButtonIconOnly,
  customToolbar,
}: DataTableProps<TData, TValue>) {
  const t = useTranslations('General');
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
  const finalRowSelection = rowSelection ?? internalRowSelection;
  const finalSetRowSelection = setRowSelection ?? setInternalRowSelection;

  const table = useReactTable({
    data,
    columns,
    pageCount: pageCount,
    state: {
      sorting,
      columnVisibility: columnVisibility ?? internalColumnVisibility,
      rowSelection: finalRowSelection,
      columnFilters,
      ...(isControlledPagination && { pagination }),
    },
    enableRowSelection: true,
    enableMultiRowSelection: !enableSingleRowSelection,
    onRowSelectionChange: finalSetRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: onColumnVisibilityChange ?? setInternalColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    manualPagination: isControlledPagination,
    manualFiltering: !!controlledColumnFilters,
    ...(isControlledPagination && { onPaginationChange: onPaginationChange }),
  });

  React.useEffect(() => {
    if (onRowSelectionChange) {
      const selectedRows = table.getFilteredSelectedRowModel().rows.map(row => row.original);
      onRowSelectionChange(selectedRows);
    }
  }, [finalRowSelection, table, onRowSelectionChange]);


  return (
    <div className="space-y-4">
      {typeof customToolbar === 'function' ? customToolbar(table) : customToolbar ? customToolbar : (filterColumnId && filterPlaceholder) && (
        <DataTableToolbar
          table={table}
          filterColumnId={filterColumnId}
          filterPlaceholder={filterPlaceholder}
          onCreate={onCreate}
          onRefresh={onRefresh}
          isRefreshing={isRefreshing}
          columnTranslations={columnTranslations}
          extraButtons={extraButtons}
          createButtonLabel={createButtonLabel}
          filterOptions={filterOptions}
          onFilterChange={onFilterChange}
          filterValue={filterValue}
          createButtonIconOnly={createButtonIconOnly}
        />
      )}
      <div className="rounded-md border overflow-auto max-h-[calc(100vh-220px)] relative">
        <table className={cn("w-full caption-bottom text-sm")}>
          <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_hsl(var(--border))]">
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
                  onClick={() => {
                    if (enableSingleRowSelection) {
                      table.toggleAllPageRowsSelected(false);
                      row.toggleSelected(true);
                    }
                  }}
                  className={enableSingleRowSelection ? 'cursor-pointer' : ''}
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
        </table>
      </div>
      <DataTablePagination table={table} />
    </div>
  );
}
