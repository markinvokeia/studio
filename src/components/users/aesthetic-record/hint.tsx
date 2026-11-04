'use client';

import React from 'react';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

/** Shared provider of the hints: a short delay so they show while exploring a toolbar, not on every pass */
export function HintProvider({ children }: { children: React.ReactNode }) {
  return <TooltipProvider delayDuration={250} skipDelayDuration={400}>{children}</TooltipProvider>;
}

interface HintProps {
  /** What the control is */
  label: string;
  /** What it does */
  description?: string;
  /** Keyboard shortcut, e.g. "P" or "Ctrl+Z" */
  shortcut?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  children: React.ReactNode;
}

/**
 * Tooltip of a toolbar control: its name, what it does and its shortcut. It wraps the control in a
 * span so a disabled button (which gets no pointer events) still explains itself.
 */
export function Hint({ label, description, shortcut, side = 'bottom', children }: HintProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">{children}</span>
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-[16rem] px-3 py-2">
        <p className="flex items-center gap-2 text-xs font-semibold">
          {label}
          {shortcut && <kbd className="rounded border bg-muted px-1.5 py-px font-mono text-[10px] font-medium text-muted-foreground">{shortcut}</kbd>}
        </p>
        {description && <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{description}</p>}
      </TooltipContent>
    </Tooltip>
  );
}
