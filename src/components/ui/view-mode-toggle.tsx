'use client';

import * as React from 'react';
import { LayoutList, Table2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { ItemsViewMode } from '@/hooks/use-items-view-mode';

interface ViewModeToggleProps {
  value: ItemsViewMode;
  onChange: (mode: ItemsViewMode) => void;
  tableLabel?: string;
  listLabel?: string;
  className?: string;
}

/** Segmented control to switch between table and list (timeline-style) views. */
export function ViewModeToggle({ value, onChange, tableLabel = 'Tabla', listLabel = 'Lista', className }: ViewModeToggleProps) {
  const options: { mode: ItemsViewMode; icon: typeof Table2; label: string }[] = [
    { mode: 'table', icon: Table2, label: tableLabel },
    { mode: 'list', icon: LayoutList, label: listLabel },
  ];

  return (
    <div className={cn('inline-flex h-9 shrink-0 items-center rounded-md border bg-muted/40 p-0.5', className)}>
      {options.map(({ mode, icon: Icon, label }) => (
        <button
          key={mode}
          type="button"
          aria-label={label}
          title={label}
          aria-pressed={value === mode}
          onClick={() => onChange(mode)}
          className={cn(
            'inline-flex h-8 w-8 items-center justify-center rounded-[5px] transition-colors',
            value === mode
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}
