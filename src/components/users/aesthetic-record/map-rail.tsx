'use client';

import React from 'react';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import { cn } from '@/lib/utils';

/** Vertical strip of icon controls floating over the map's left edge */
export function MapRail({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <TooltipProvider delayDuration={150}>
      <div className={cn('flex flex-col gap-2', className)}>{children}</div>
    </TooltipProvider>
  );
}

export interface RailOption<T extends string> {
  id: T;
  /** Accessible name and tooltip */
  label: string;
  icon: React.ElementType;
  /** Small marker on the icon's corner (e.g. a count) */
  badge?: React.ReactNode;
}

/** One single-choice group of the rail: icon buttons whose tooltip says what they do */
export function RailGroup<T extends string>({ value, options, onChange, ariaLabel, disabled, disabledReason }: {
  value: T;
  options: RailOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  /** The options other than the selected one cannot be picked */
  disabled?: boolean;
  /** Tooltip of the options that cannot be picked */
  disabledReason?: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex flex-col gap-0.5 rounded-xl border bg-card/90 p-0.5 shadow-sm backdrop-blur-sm">
      {options.map(({ id, label, icon: Icon, badge }) => {
        const selected = value === id;
        const blocked = !!disabled && !selected;
        return (
          <Tooltip key={id}>
            <TooltipTrigger asChild>
              {/* The wrapper keeps the tooltip working on a disabled button */}
              <span className="relative inline-flex">
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={label}
                  disabled={blocked}
                  onClick={() => onChange(id)}
                  className={cn(
                    'inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
                    // The dark theme's primary is a dark grey: fall back to the foreground there
                    selected
                      ? 'bg-primary text-primary-foreground shadow-sm dark:bg-foreground dark:text-background'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <Icon className="h-4 w-4" />
                </button>
                {badge && (
                  <span className="pointer-events-none absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full border bg-background px-1 text-foreground">
                    {badge}
                  </span>
                )}
              </span>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-56 px-2 py-1 text-xs">
              {blocked && disabledReason ? disabledReason : label}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
