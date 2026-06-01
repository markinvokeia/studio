
'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DataCard } from '@/components/ui/data-card';
import { DataListRow } from '@/components/ui/data-list-row';
import { ViewModeToggle } from '@/components/ui/view-mode-toggle';
import { useItemsViewMode } from '@/hooks/use-items-view-mode';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Skeleton } from '@/components/ui/skeleton';
import { useNarrowMode } from '@/components/layout/two-panel-layout';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';
import { QuoteItem } from '@/lib/types';
import { ColumnDef, RowSelectionState } from '@tanstack/react-table';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

const fmtUSD = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);

interface QuoteItemsTableProps {
  items: QuoteItem[];
  isLoading?: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  canEdit: boolean;
  onCreate: () => void;
  onEdit: (item: QuoteItem) => void;
  onDelete: (item: QuoteItem) => void;
  showToothNumber?: boolean;
  onRowSelectionChange?: (selectedRows: QuoteItem[]) => void;
  rowSelection?: RowSelectionState;
  setRowSelection?: React.Dispatch<React.SetStateAction<RowSelectionState>>;
  extraButtons?: React.ReactNode;
  /** Force card/list mode regardless of viewport width */
  forceCardMode?: boolean;
  /** When true, enables the table/list view toggle (list view shown on desktop) */
  listView?: boolean;
}

const getColumns = (
  t: (key: string) => string,
  onEdit: (item: QuoteItem) => void,
  onDelete: (item: QuoteItem) => void,
  canEdit: boolean,
  showToothNumber: boolean = true,
  onRowSelectionChange?: (selectedRows: QuoteItem[]) => void
): ColumnDef<QuoteItem>[] => {
  const baseColumns: ColumnDef<QuoteItem>[] = [
    {
      id: 'select',
      header: () => null,
      cell: ({ row, table }) => {
        const isSelected = row.getIsSelected();
        return (
          <RadioGroup
            value={isSelected ? row.id : ''}
            onValueChange={() => {
              if (onRowSelectionChange) {
                table.toggleAllPageRowsSelected(false);
                row.toggleSelected(true);
              }
            }}
          >
            <RadioGroupItem value={row.id} id={row.id} aria-label="Select row" />
          </RadioGroup>
        );
      },
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: 'id',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('id')} />
      ),
    },
    {
      accessorKey: 'service_name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('service')} />
      ),
      cell: ({ row }) => (
        <div className="truncate max-w-[600px]" title={row.getValue('service_name')}>
          {row.getValue('service_name')}
        </div>
      ),
    },
    {
      accessorKey: 'quantity',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('quantity')} />
      ),
    },
    {
      accessorKey: 'unit_price',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('unitPrice')} />
      ),
      cell: ({ row }) => {
        const amount = parseFloat(row.getValue('unit_price'));
        const roundedAmount = Math.round(amount * 100) / 100;
        const formatted = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
        }).format(roundedAmount);
        return <div className="font-medium">{formatted}</div>;
      },
    },
    {
      accessorKey: 'total',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('total')} />
      ),
      cell: ({ row }) => {
        const amount = parseFloat(row.getValue('total'));
        const roundedAmount = Math.round(amount * 100) / 100;
        const formatted = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
        }).format(roundedAmount);
        return <div className="font-medium">{formatted}</div>;
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const item = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0" disabled={!canEdit}>
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{t('actions')}</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => onEdit(item)}>{t('edit')}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDelete(item)} className="text-destructive">{t('delete')}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  // Insert tooth_number column after service_name if needed
  if (showToothNumber) {
    const toothNumberColumn: ColumnDef<QuoteItem> = {
      accessorKey: 'tooth_number',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('toothNumber')} />
      ),
      cell: ({ row }) => {
        const toothNumber = row.getValue('tooth_number') as number;
        return toothNumber ? <div className="font-medium">{toothNumber}</div> : <div className="text-muted-foreground">-</div>;
      },
    };
    baseColumns.splice(2, 0, toothNumberColumn); // Insert at index 2 (after service_name)
  }

  return baseColumns;
};

export function QuoteItemsTable({ items, isLoading = false, onRefresh, isRefreshing, canEdit, onCreate, onEdit, onDelete, showToothNumber = true, onRowSelectionChange, rowSelection, setRowSelection, extraButtons, forceCardMode = false, listView = false }: QuoteItemsTableProps) {
  const t = useTranslations('QuotesPage.itemDialog');
  const tShared = useTranslations('UserColumns');
  const { isNarrow: panelNarrow } = useNarrowMode();
  const viewportNarrow = useViewportNarrow();
  const [viewMode, setViewMode] = useItemsViewMode('list');
  // Toggle only on desktop/tablet; mobile always shows cards.
  const showToggle = listView && !viewportNarrow;
  // Render the list view on desktop; mobile keeps DataCard.
  const useListView = listView && !viewportNarrow && viewMode === 'list';
  const isNarrow = forceCardMode || useListView || panelNarrow || viewportNarrow;
  const columns = getColumns(
    (key) => {
      try {
        return t(key);
      } catch (e) {
        return tShared(key);
      }
    },
    onEdit,
    onDelete,
    canEdit,
    showToothNumber,
    onRowSelectionChange
  );

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
    <Card className={forceCardMode ? "flex flex-col" : "h-full flex flex-col min-h-0"}>
      <CardContent className={`flex flex-col p-4 ${forceCardMode ? "" : "flex-1 min-h-0"}`}>
        <DataTable
          columns={columns}
          data={items}
          filterColumnId="service_name"
          filterPlaceholder={t('searchService')}
          onRefresh={onRefresh}
          isRefreshing={isRefreshing}
          onCreate={canEdit ? onCreate : undefined}
          enableSingleRowSelection={onRowSelectionChange ? true : false}
          onRowSelectionChange={onRowSelectionChange}
          rowSelection={rowSelection}
          setRowSelection={setRowSelection}
          primaryActions={extraButtons}
          viewControls={showToggle ? <ViewModeToggle value={viewMode} onChange={setViewMode} /> : undefined}
          isNarrow={isNarrow}
          cardListClassName={useListView ? 'gap-0 px-0 py-0 rounded-md border' : undefined}
          renderCard={(item: QuoteItem, isSelected: boolean) => useListView ? (
            <DataListRow
              isSelected={isSelected}
              onClick={onRowSelectionChange ? () => onRowSelectionChange([item]) : undefined}
              title={item.service_name || String(item.id)}
              meta={(
                <>
                  <span>{t('id')}: {item.id}</span>
                  {showToothNumber && item.tooth_number ? <span>{t('toothNumber')}: {item.tooth_number}</span> : null}
                  <span>{t('quantity')}: {item.quantity}</span>
                  <span>{t('unitPrice')}: {fmtUSD(item.unit_price || 0)}</span>
                  <span className="font-medium text-foreground">{t('total')}: {fmtUSD(item.total || 0)}</span>
                </>
              )}
              actions={canEdit ? (
                <>
                  <Button variant="outline" size="sm" className="h-6 px-2 text-xs gap-1"
                    onClick={(e) => { e.stopPropagation(); onEdit(item); }}>
                    <Pencil className="h-3 w-3" />{t('edit')}
                  </Button>
                  <Button variant="outline" size="sm" className="h-6 px-2 text-xs gap-1 text-destructive hover:text-destructive"
                    onClick={(e) => { e.stopPropagation(); onDelete(item); }}>
                    <Trash2 className="h-3 w-3" />{t('delete')}
                  </Button>
                </>
              ) : undefined}
            />
          ) : (
            <DataCard
              isSelected={isSelected}
              title={item.service_name || String(item.id)}
              subtitle={`ID: ${item.id}`}
              fields={[
                ...(showToothNumber && item.tooth_number
                  ? [{ label: t('toothNumber'), value: String(item.tooth_number) }]
                  : []),
                { label: t('quantity'), value: String(item.quantity) },
                {
                  label: t('unitPrice'),
                  value: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(item.unit_price || 0),
                },
                {
                  label: t('total'),
                  value: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(item.total || 0),
                  primary: true,
                },
              ]}
              showArrow={!!onRowSelectionChange}
              onClick={() => onRowSelectionChange?.([item])}
            />
          )}
          columnTranslations={{
            id: t('id'),
            service_name: t('service'),
            ...(showToothNumber && { tooth_number: t('toothNumber') }),
            quantity: t('quantity'),
            unit_price: t('unitPrice'),
            total: t('total'),
          }}
        />
      </CardContent>
    </Card>
  );
}
