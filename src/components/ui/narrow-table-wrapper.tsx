'use client';

/**
 * NarrowTableWrapper
 *
 * Reads `isNarrow` from NarrowModeContext (provided by TwoPanelLayout).
 * When narrow: renders a scrollable list of DataCard items.
 * When wide: renders the children (the original table component).
 *
 * Usage:
 *   <NarrowTableWrapper
 *     data={payments}
 *     renderCard={(row) => <DataCard title={row.doc_no} ... />}
 *   >
 *     <PaymentsTable ... />
 *   </NarrowTableWrapper>
 */

import * as React from 'react';
import { useNarrowMode } from '@/components/layout/two-panel-layout';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useTranslations } from 'next-intl';

interface NarrowTableWrapperProps<TData> {
  data: TData[];
  renderCard: (row: TData) => React.ReactNode;
  children: React.ReactNode;
  /** Override narrow detection — set true to force card view */
  forceNarrow?: boolean;
}

export function NarrowTableWrapper<TData>({
  data,
  renderCard,
  children,
  forceNarrow,
}: NarrowTableWrapperProps<TData>) {
  const { isNarrow } = useNarrowMode();
  const t = useTranslations('General');
  const narrow = forceNarrow ?? isNarrow;

  // Minimal table instance for pagination in narrow mode
  const table = useReactTable({
    data,
    columns: [],
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  if (!narrow) return <>{children}</>;

  return (
    <div className="flex flex-col gap-2 h-full min-h-0">
      <div className="flex-1 overflow-auto min-h-0 flex flex-col gap-2 px-0.5 py-0.5">
        {data.length > 0
          ? table.getRowModel().rows.map((row, i) => (
              <div key={i}>{renderCard(row.original)}</div>
            ))
          : <div className="py-8 text-center text-sm text-muted-foreground">{t('noResults')}</div>
        }
      </div>
      <DataTablePagination table={table} />
    </div>
  );
}
