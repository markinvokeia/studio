'use client';

import * as React from 'react';
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DoubleArrowLeftIcon,
  DoubleArrowRightIcon,
} from '@radix-ui/react-icons';
import { Table } from '@tanstack/react-table';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

const PAGE_SIZES = [10, 25, 50, 100, 200];

interface DataTablePaginationProps<TData> {
  table: Table<TData>;
}

export function DataTablePagination<TData>({
  table,
}: DataTablePaginationProps<TData>) {
  const t = useTranslations('DataTablePagination');
  const [editing, setEditing] = React.useState(false);

  const { pageIndex, pageSize } = table.getState().pagination;
  // Use the rows actually rendered on this page — always correct for `to` in both
  // client and server (manual) modes, regardless of whether a total is known.
  const renderedRows = table.getRowModel().rows.length;
  const total = table.getRowCount();
  const from = renderedRows === 0 ? 0 : pageIndex * pageSize + 1;
  const to = from === 0 ? 0 : from + renderedRows - 1;
  // The total is only trustworthy when it covers the current page. In manual
  // pagination without `rowCount`, getRowCount() returns just this page's rows.
  const showTotal = total >= to;

  // Close the size picker on any outside click. The listener is attached *after*
  // the click that opened it (effects run post-commit), so it doesn't self-close.
  React.useEffect(() => {
    if (!editing) return;
    const close = () => setEditing(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [editing]);

  const applySize = (value: number | 'all') => {
    table.setPageSize(value === 'all' ? table.getRowCount() : value);
    setEditing(false);
  };

  return (
    <div className="flex items-center gap-0.5 text-xs text-muted-foreground">
      <Button
        variant="ghost"
        className="h-7 w-7 p-0"
        onClick={() => table.setPageIndex(0)}
        disabled={!table.getCanPreviousPage()}
      >
        <span className="sr-only">{t('goToFirst')}</span>
        <DoubleArrowLeftIcon className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        className="h-7 w-7 p-0"
        onClick={() => table.previousPage()}
        disabled={!table.getCanPreviousPage()}
      >
        <span className="sr-only">{t('goToPrevious')}</span>
        <ChevronLeftIcon className="h-4 w-4" />
      </Button>

      <div className="relative">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setEditing((v) => !v);
          }}
          title={t('rowsPerPage')}
          className="flex select-none items-center gap-0.5 whitespace-nowrap rounded px-1.5 py-1 tabular-nums hover:bg-muted hover:text-foreground"
        >
          {showTotal ? t('range', { from, to, total }) : `${from}–${to}`}
          <ChevronDownIcon className="h-3 w-3 opacity-60" />
        </button>
        {editing && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute right-0 top-full z-50 mt-1 min-w-[5rem] rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
          >
            {PAGE_SIZES.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => applySize(size)}
                className={cn(
                  'flex w-full items-center rounded-sm px-2 py-1 text-xs tabular-nums hover:bg-accent hover:text-accent-foreground',
                  pageSize === size && 'font-semibold text-foreground'
                )}
              >
                {size}
              </button>
            ))}
            <button
              type="button"
              onClick={() => applySize('all')}
              className="flex w-full items-center rounded-sm px-2 py-1 text-xs hover:bg-accent hover:text-accent-foreground"
            >
              {t('all')}
            </button>
          </div>
        )}
      </div>

      <Button
        variant="ghost"
        className="h-7 w-7 p-0"
        onClick={() => table.nextPage()}
        disabled={!table.getCanNextPage()}
      >
        <span className="sr-only">{t('goToNext')}</span>
        <ChevronRightIcon className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        className="h-7 w-7 p-0"
        onClick={() => table.setPageIndex(table.getPageCount() - 1)}
        disabled={!table.getCanNextPage()}
      >
        <span className="sr-only">{t('goToLast')}</span>
        <DoubleArrowRightIcon className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
