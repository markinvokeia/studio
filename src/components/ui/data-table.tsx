
'use client';

import * as React from 'react';
import { flushSync } from 'react-dom';
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
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';

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
  getRowClassName?: (row: TData) => string;
  /** When true the search input filters across all columns instead of a single column */
  useGlobalFilter?: boolean;
  /** When true, overrides pagination to show all rows (used before programmatic window.print()) */
  printMode?: boolean;
  /** When true, renders `renderCard` list instead of the standard table */
  isNarrow?: boolean;
  /** Card renderer for narrow mode — receives the row's original data and selection state */
  renderCard?: (row: TData, isSelected: boolean) => React.ReactNode;
  /** Called when a card is clicked in narrow mode */
  onRowClick?: (row: TData) => void;
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
  getRowClassName,
  useGlobalFilter,
  printMode,
  isNarrow,
  renderCard,
  onRowClick,
}: DataTableProps<TData, TValue>) {
  const t = useTranslations('General');
  const showCardList = Boolean(isNarrow && renderCard);
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

  // Show all rows before printing (Cmd+P); restore afterwards.
  // flushSync forces React to commit synchronously inside the beforeprint handler.
  React.useEffect(() => {
    const savedSizeRef = { value: table.getState().pagination.pageSize };
    const expand = () => {
      savedSizeRef.value = table.getState().pagination.pageSize;
      flushSync(() => { table.setPageSize(data.length || 99999); });
    };
    const restore = () => { table.setPageSize(savedSizeRef.value); };
    window.addEventListener('beforeprint', expand);
    window.addEventListener('afterprint', restore);
    return () => {
      window.removeEventListener('beforeprint', expand);
      window.removeEventListener('afterprint', restore);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.length]);

  // Programmatic printMode: expand/restore for the print button flow.
  const savedPrintSizeRef = React.useRef<number>(10);
  React.useEffect(() => {
    if (printMode) {
      savedPrintSizeRef.current = table.getState().pagination.pageSize;
      table.setPageSize(data.length || 99999);
    } else {
      table.setPageSize(savedPrintSizeRef.current);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [printMode, data.length]);

  // Use a ref so the callback never appears in deps — prevents firing on every render.
  const onRowSelectionChangeRef = React.useRef(onRowSelectionChange);
  React.useLayoutEffect(() => { onRowSelectionChangeRef.current = onRowSelectionChange; });

  React.useEffect(() => {
    if (onRowSelectionChangeRef.current) {
      const selectedRows = table.getFilteredSelectedRowModel().rows.map(row => row.original);
      onRowSelectionChangeRef.current(selectedRows);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalRowSelection]);


  return (
    <div className="w-full flex-1 flex flex-col min-h-0 space-y-4 print:block print:h-auto">
      <div className="print:hidden">
        {typeof customToolbar === 'function' ? customToolbar(table) : customToolbar ? customToolbar : (filterColumnId || filterPlaceholder || useGlobalFilter) && (
          <DataTableToolbar
            table={table}
            filterColumnId={filterColumnId}
            filterPlaceholder={filterPlaceholder}
            useGlobalFilter={useGlobalFilter}
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
      </div>
      {showCardList ? (
        <div data-testid="card-list" className="flex flex-col gap-2 overflow-auto flex-1 min-h-0 px-1 py-1">
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <div key={row.id} data-testid="list-item" onClick={() => {
                if (enableSingleRowSelection) {
                  table.toggleAllPageRowsSelected(false);
                  row.toggleSelected(true);
                }
                onRowClick?.(row.original);
              }}>
                {renderCard!(row.original, row.getIsSelected())}
              </div>
            ))
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground">{t('noResults')}</div>
          )}
        </div>
      ) : null}
      {!showCardList ? (
      <div className="rounded-md border overflow-auto print:overflow-visible flex-1 min-h-0 print:h-auto relative print:max-h-none">
        <table className={cn("w-full caption-bottom text-sm")}>
          <TableHeader className="sticky print:static top-0 z-10 bg-card shadow-[0_1px_0_0_hsl(var(--border))]">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead
                      key={header.id}
                      style={{ width: header.getSize() !== 150 ? `${header.getSize()}px` : undefined }}
                      className={header.column.getCanSort() ? 'cursor-pointer select-none' : ''}
                      onClick={header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined}
                    >
                      {header.isPlaceholder ? null : (
                        <div className={cn('flex items-center gap-1', header.column.getCanSort() && 'group')}>
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getCanSort() && (
                            header.column.getIsSorted() === 'asc'  ? <ArrowUp   className="h-3 w-3 text-foreground"              /> :
                            header.column.getIsSorted() === 'desc' ? <ArrowDown className="h-3 w-3 text-foreground"              /> :
                                                                     <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-40" />
                          )}
                        </div>
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody className="[&_tr:last-child]:border-b">
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
                  className={cn(
                    enableSingleRowSelection ? 'cursor-pointer' : '',
                    getRowClassName ? getRowClassName(row.original) : ''
                  )}
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
      ) : null}
      <div className="print:hidden">
        <DataTablePagination table={table} />
      </div>
    </div>
  );
}
