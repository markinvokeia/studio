'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LayoutGrid, List, RefreshCw, Search } from 'lucide-react';
import * as React from 'react';

interface PayrollListToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
  /** View-mode toggle (grid/table). Rendered only when `onViewModeChange` is provided and `showViewToggle` is true. */
  viewMode?: 'card' | 'table';
  onViewModeChange?: (mode: 'card' | 'table') => void;
  showViewToggle?: boolean;
  /** Custom filter control (e.g. a funnel dropdown) rendered next to search. */
  filterSlot?: React.ReactNode;
  /** Column visibility dropdown — only meaningful in table mode. */
  columnsSlot?: React.ReactNode;
  /** Create / primary action buttons. */
  actions?: React.ReactNode;
  /** Pagination node provided by DataTable's function toolbar. */
  paginationNode?: React.ReactNode;
  className?: string;
}

/**
 * Shared toolbar for every /payroll/* list. Responsive to the *container* width
 * (not the viewport) via CSS container queries (see `.payroll-toolbar` in globals.css):
 * the search bar always stays on the first line and usable; the actions + pagination
 * group drops to a full-width second line when the column is too narrow.
 */
export function PayrollListToolbar({
  search,
  onSearchChange,
  searchPlaceholder,
  onRefresh,
  refreshing,
  viewMode,
  onViewModeChange,
  showViewToggle,
  filterSlot,
  columnsSlot,
  actions,
  paginationNode,
  className,
}: PayrollListToolbarProps) {
  return (
    <div className={cn('payroll-toolbar flex flex-wrap items-center gap-2 px-3 pb-3 pt-0 sm:pt-3', className)}>
      {/* Search group — always first line, search grows and keeps a usable min width */}
      <div className="flex items-center gap-1 flex-1 min-w-[11rem]">
        <div className="flex flex-1 h-8 min-w-0 items-center rounded-md border border-input bg-background text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
          <Search className="ml-2.5 h-3.5 w-3.5 shrink-0 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="flex-1 bg-transparent px-2 py-0 outline-none placeholder:text-muted-foreground text-sm h-full min-w-0"
          />
        </div>
        {showViewToggle && onViewModeChange && (
          <>
            <Button
              variant={viewMode === 'card' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => onViewModeChange('card')}
              title="Vista en tarjetas"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant={viewMode === 'table' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => onViewModeChange('table')}
              title="Vista en tabla"
            >
              <List className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
        {filterSlot}
        {onRefresh && (
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={onRefresh}
            disabled={refreshing}
            title="Refrescar"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
          </Button>
        )}
        {columnsSlot}
      </div>

      {/* Actions + pagination — inline when there's room, full second line when narrow */}
      {(actions || paginationNode) && (
        <div className="payroll-toolbar__actions flex items-center gap-1 justify-end shrink-0">
          {actions}
          {paginationNode}
        </div>
      )}
    </div>
  );
}
