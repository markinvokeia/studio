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
 * Horizontal tab strip that sits at the top of a detail panel.
 * Mobile: icon only. Desktop (sm+): icon + label.
 * Active tab gets a bottom accent bar.
 */
export function VerticalTabStrip({ tabs, activeTabId, onTabClick, className }: VerticalTabStripProps) {
  return (
    <TooltipProvider delayDuration={600}>
      <div className={cn(
        'flex flex-row border-b border-border bg-muted/20 shrink-0 overflow-x-auto',
        className
      )}>
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
                    'relative flex items-center justify-center gap-1.5 h-10 px-3 sm:px-4 transition-all duration-150 whitespace-nowrap shrink-0',
                    isActive
                      ? 'text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
                  )}
                  aria-label={tab.label}
                  aria-selected={isActive}
                >
                  {isActive && (
                    <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-t-full bg-primary" />
                  )}
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline text-xs font-medium">{tab.label}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs font-medium">
                {tab.label}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
