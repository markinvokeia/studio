'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface VerticalTab {
  id: string;
  icon: React.ElementType;
  label: string;
  /** Shorter label shown on mobile when space is tight */
  shortLabel?: string;
  /** If set, clicking this tab calls pushPanel instead of switching content */
  navigatesTo?: string;
  /** Secondary line shown in the tab tooltip */
  description?: string;
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
 * Arrow buttons let the user navigate left/right (touch pan also works).
 */
export function VerticalTabStrip({ tabs, activeTabId, onTabClick, className }: VerticalTabStripProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = React.useState(false);
  const [canScrollRight, setCanScrollRight] = React.useState(false);

  const SCROLL_STEP = 120;

  function updateArrows() {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateArrows();
    el.addEventListener('scroll', updateArrows, { passive: true });
    const ro = new ResizeObserver(updateArrows);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', updateArrows);
      ro.disconnect();
    };
  }, [tabs]);

  // Scroll the active tab into view whenever activeTabId changes
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const activeBtn = el.querySelector('[aria-selected="true"]') as HTMLElement | null;
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }, [activeTabId]);

  function scrollBy(delta: number) {
    scrollRef.current?.scrollBy({ left: delta, behavior: 'smooth' });
  }

  return (
    <TooltipProvider delayDuration={600}>
      <div className={cn('flex flex-row border-b border-border bg-muted/20 shrink-0 items-stretch', className)}>

        {/* Left arrow */}
        <button
          type="button"
          aria-hidden="true"
          tabIndex={-1}
          onClick={() => scrollBy(-SCROLL_STEP)}
          className={cn(
            'flex items-center justify-center shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-150 border-r border-border overflow-hidden',
            canScrollLeft ? 'w-7 opacity-100 pointer-events-auto' : 'w-0 opacity-0 pointer-events-none border-0',
          )}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>

        {/* Scrollable tab list — scrollbar hidden, touch pan works */}
        <div
          ref={scrollRef}
          className="flex flex-row flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
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
                      'relative flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1 h-12 sm:h-10 px-2 sm:px-3 transition-all duration-150 whitespace-nowrap shrink-0',
                      isActive
                        ? 'text-primary'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
                    )}
                    aria-label={tab.label}
                    aria-selected={isActive}
                  >
                    {isActive && (
                      <span className="absolute bottom-0 left-1.5 right-1.5 h-0.5 rounded-t-full bg-primary" />
                    )}
                    <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                    <span className="text-[10px] sm:text-xs font-medium leading-tight">
                      <span className="sm:hidden">{tab.shortLabel ?? tab.label}</span>
                      <span className="hidden sm:inline">{tab.label}</span>
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs font-medium">
                  <div>{tab.label}</div>
                  {tab.description && <div className="text-[10px] text-muted-foreground font-normal">{tab.description}</div>}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {/* Right arrow */}
        <button
          type="button"
          aria-hidden="true"
          tabIndex={-1}
          onClick={() => scrollBy(SCROLL_STEP)}
          className={cn(
            'flex items-center justify-center shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-150 border-l border-border overflow-hidden',
            canScrollRight ? 'w-7 opacity-100 pointer-events-auto' : 'w-0 opacity-0 pointer-events-none border-0',
          )}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>

      </div>
    </TooltipProvider>
  );
}
