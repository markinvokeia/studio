'use client';

import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import {
  type ColumnDef,
  type ColumnFiltersState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { type Dispatch, type SetStateAction, useState } from 'react';

interface ReportDataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  useGlobalFilter?: boolean;
  filterPlaceholder?: string;
  columnTranslations?: Record<string, string>;
  getRowClassName?: (row: TData) => string;
  printMode?: boolean;
  columnVisibility?: VisibilityState;
  onColumnVisibilityChange?: Dispatch<SetStateAction<VisibilityState>>;
  columnFilters?: ColumnFiltersState;
}

const PAGE_SIZE = 25;

export function ReportDataTable<TData>({
  columns,
  data,
  useGlobalFilter,
  filterPlaceholder,
  columnTranslations,
  getRowClassName,
  printMode,
  columnVisibility,
  onColumnVisibilityChange,
  columnFilters,
}: ReportDataTableProps<TData>) {
  const [globalFilter, setGlobalFilter] = useState('');
  const [pageIndex, setPageIndex] = useState(0);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      globalFilter,
      pagination: { pageIndex, pageSize: PAGE_SIZE },
      ...(columnVisibility ? { columnVisibility } : {}),
    },
    onGlobalFilterChange: (v) => {
      setGlobalFilter(v);
      setPageIndex(0);
    },
    onPaginationChange: (updater) => {
      const next =
        typeof updater === 'function'
          ? updater({ pageIndex, pageSize: PAGE_SIZE })
          : updater;
      setPageIndex(next.pageIndex);
    },
  });

  const pageCount = table.getPageCount();
  const rows = table.getRowModel().rows;

  return (
    <>
      {/* ── Mobile card list (< md, never printed) ─────────────────────── */}
      <div className="md:hidden print:hidden space-y-2">
        {useGlobalFilter && (
          <Input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder={filterPlaceholder}
            className="h-8 text-sm"
          />
        )}

        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">—</p>
        ) : (
          rows.map((row) => (
            <div
              key={row.id}
              className="rounded-lg border bg-card px-3 py-2.5 shadow-sm"
            >
              <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                {row.getVisibleCells().map((cell) => {
                  const hDef = cell.column.columnDef.header;
                  const label =
                    typeof hDef === 'string' ? hDef : cell.column.id;
                  return (
                    <div key={cell.id} className="min-w-0">
                      <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {label}
                      </p>
                      <div className="text-xs">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}

        {pageCount > 1 && (
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-muted-foreground">
              Pág {pageIndex + 1} / {pageCount}
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Desktop table (≥ md, always printed) ───────────────────────── */}
      <div className="hidden md:block print:block">
        <DataTable
          columns={columns}
          data={data}
          useGlobalFilter={useGlobalFilter}
          filterPlaceholder={filterPlaceholder}
          columnTranslations={columnTranslations}
          getRowClassName={getRowClassName}
          printMode={printMode}
          columnVisibility={columnVisibility}
          onColumnVisibilityChange={onColumnVisibilityChange}
          columnFilters={columnFilters}
        />
      </div>
    </>
  );
}
