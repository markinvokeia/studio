'use client';

import * as React from 'react';
import { Check, Plus, Search } from 'lucide-react';

import { ContextMenuItem, ContextMenuSeparator } from '@/components/ui/context-menu';
import { cn } from '@/lib/utils';

export interface ContextEntityPickerItem {
  id: string;
  title: string;
  subtitle?: string;
}

interface ContextEntityPickerProps {
  items: ContextEntityPickerItem[];
  selectedId?: string | null;
  onSelect: (id: string) => void;
  onCreateNew: () => void;
  createLabel: string;
  searchPlaceholder: string;
  emptyText: string;
}

/**
 * Searchable picker rendered inside a ContextMenuSubContent. A filter field and
 * a pinned "create new" action stay visible above a scrollable list of the
 * patient's most recent records. Items are native ContextMenuItems so selecting
 * one closes the whole context menu.
 */
export function ContextEntityPicker({
  items,
  selectedId,
  onSelect,
  onCreateNew,
  createLabel,
  searchPlaceholder,
  emptyText,
}: ContextEntityPickerProps) {
  const [query, setQuery] = React.useState('');

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(q) || item.subtitle?.toLowerCase().includes(q),
    );
  }, [items, query]);

  return (
    <div className="flex w-72 flex-col">
      {/* Search — keep typing local to the input (so the menu's typeahead doesn't
          hijack it) while still letting Escape close and arrows move into the list. */}
      <div
        className="flex items-center gap-2 border-b px-2 py-1.5"
        onKeyDown={(e) => {
          if (!['Escape', 'ArrowDown', 'ArrowUp', 'Enter'].includes(e.key)) {
            e.stopPropagation();
          }
        }}
      >
        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      {/* Pinned "create new" — always visible above the scrollable list */}
      <ContextMenuItem onSelect={onCreateNew} className="flex items-center gap-2 cursor-pointer font-medium">
        <Plus className="h-4 w-4 shrink-0" />
        {createLabel}
      </ContextMenuItem>

      <ContextMenuSeparator />

      {/* Scrollable record list */}
      <div className="max-h-64 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">{emptyText}</p>
        ) : (
          filtered.map((item) => (
            <ContextMenuItem
              key={item.id}
              onSelect={() => onSelect(item.id)}
              className="flex items-center gap-2 cursor-pointer"
            >
              <Check
                className={cn(
                  'h-4 w-4 shrink-0',
                  String(item.id) === String(selectedId) ? 'opacity-100' : 'opacity-0',
                )}
              />
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{item.title}</span>
                {item.subtitle && (
                  <span className="truncate text-xs text-muted-foreground">{item.subtitle}</span>
                )}
              </span>
            </ContextMenuItem>
          ))
        )}
      </div>
    </div>
  );
}
