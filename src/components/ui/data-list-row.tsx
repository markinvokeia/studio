import * as React from 'react';
import { cn } from '@/lib/utils';

interface DataListRowProps {
  /** Bold primary text */
  title: React.ReactNode;
  /** Optional status/label pill shown next to the title */
  badge?: React.ReactNode;
  /** Muted secondary line — typically several inline field chips */
  meta?: React.ReactNode;
  /** Action buttons rendered below the content */
  actions?: React.ReactNode;
  /** Highlights the row as selected */
  isSelected?: boolean;
  onClick?: () => void;
  className?: string;
}

/**
 * Flat, dense list-view row: left-aligned content, rows separated by a bottom
 * divider with a hover/selected state — table-like without being a table.
 * The list-mode counterpart of DataCard, used when a DataTable is shown as a
 * list instead of a grid. No icon, no right-floating content (everything stays
 * left-aligned so it reads well at any panel width).
 *
 * Presentational and dependency-free — reuse it in any view, with or without
 * a DataTable.
 *
 * @example
 * // 1) Standalone list (no DataTable):
 * <div className="rounded-md border divide-y">
 *   {items.map((it) => (
 *     <DataListRow
 *       key={it.id}
 *       title={it.name}
 *       badge={<Badge>{it.status}</Badge>}
 *       meta={<><span>ID: {it.id}</span><span>Total: {it.total}</span></>}
 *       isSelected={it.id === selectedId}
 *       onClick={() => setSelectedId(it.id)}
 *     />
 *   ))}
 * </div>
 *
 * @example
 * // 2) As the DataTable list-view renderer (desktop list instead of grid):
 * <DataTable
 *   columns={columns}
 *   data={rows}
 *   isNarrow                                   // force the list instead of the grid
 *   cardListClassName="gap-0 rounded-md border" // connected rows (no gap)
 *   renderCard={(row) => (
 *     <DataListRow title={row.name} meta={<span>{row.detail}</span>} />
 *   )}
 * />
 */
export function DataListRow({
  title,
  badge,
  meta,
  actions,
  isSelected,
  onClick,
  className,
}: DataListRowProps) {
  return (
    <div
      className={cn(
        'px-3 py-2 border-b border-border transition-colors border-l-2',
        onClick && 'cursor-pointer',
        isSelected ? 'border-l-primary bg-primary/5' : 'border-l-transparent hover:bg-muted/50',
        className,
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-sm font-medium">{title}</span>
        {badge}
      </div>
      {meta && (
        <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          {meta}
        </div>
      )}
      {actions && <div className="mt-1.5 flex gap-1.5">{actions}</div>}
    </div>
  );
}
