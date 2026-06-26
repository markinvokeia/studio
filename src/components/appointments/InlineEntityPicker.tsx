'use client';

import * as React from 'react';
import { Check, Loader2 } from 'lucide-react';

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';

export interface InlineEntityPickerItem {
  id: string;
  name: string;
  color?: string;
}

interface InlineEntityPickerProps {
  items: InlineEntityPickerItem[];
  selectedId?: string;
  onSelect: (id: string) => void;
  searchPlaceholder: string;
  emptyText: string;
  isLoading?: boolean;
  isSaving?: boolean;
  className?: string;
  autoFocus?: boolean;
}

/**
 * Inline, popup-free entity picker (doctors / rooms). Renders a searchable
 * Command list to be embedded directly under the field being edited or inside
 * a context-menu sub-content, so the user never leaves the current context.
 */
export function InlineEntityPicker({
  items,
  selectedId,
  onSelect,
  searchPlaceholder,
  emptyText,
  isLoading = false,
  isSaving = false,
  className,
  autoFocus = true,
}: InlineEntityPickerProps) {
  return (
    <Command className={cn('rounded-lg border border-border bg-popover', className)}>
      <CommandInput placeholder={searchPlaceholder} autoFocus={autoFocus} disabled={isSaving} />
      <CommandList className="max-h-56">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : (
          <>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {items.map((item) => (
                <CommandItem
                  key={item.id}
                  value={`${item.name} ${item.id}`}
                  disabled={isSaving}
                  onSelect={() => onSelect(item.id)}
                  className="gap-2"
                >
                  <Check
                    className={cn(
                      'h-4 w-4 shrink-0',
                      selectedId === item.id ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  {item.color && (
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                  )}
                  <span className="min-w-0 flex-1 truncate">{item.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </Command>
  );
}
