'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export interface VerticalTab {
  id: string;
  icon: React.ElementType;
  label: string;
  /** If set, clicking this tab calls pushPanel instead of switching content */
  navigatesTo?: string;
}

interface VerticalTabStripProps {
  tabs: VerticalTab[];
  activeTabId: string;
  onTabClick: (tab: VerticalTab) => void;
  className?: string;
}

/**
 * Vertical tab column that sits on the left edge of a DetailPanel.
 * Shows icon above label — mirrors the main sidebar nav style.
 * Active tab gets a left accent bar + brand background tint.
 */
export function VerticalTabStrip({ tabs, activeTabId, onTabClick, className }: VerticalTabStripProps) {
  return (
    <TooltipProvider delayDuration={600}>
      <div className={cn('flex flex-col w-14 border-r border-border bg-muted/20 py-1 shrink-0', className)}>
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const Icon = tab.icon;
          return (
            <Tooltip key={tab.id}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => onTabClick(tab)}
                  className={cn(
                    'relative flex flex-col items-center justify-center gap-0.5 h-14 w-full px-1 transition-all duration-150',
                    isActive
                      ? 'text-primary bg-primary/8'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
                  )}
                  aria-label={tab.label}
                  aria-selected={isActive}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-7 rounded-r-full bg-primary" />
                  )}
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="text-[8px] font-medium leading-tight text-center line-clamp-2 w-full px-0.5">
                    {tab.label}
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs font-medium">
                {tab.label}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
