'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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
            'flex items-center justify-center w-7 shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-150 border-r border-border',
            canScrollLeft ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
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

        {/* Right arrow */}
        <button
          type="button"
          aria-hidden="true"
          tabIndex={-1}
          onClick={() => scrollBy(SCROLL_STEP)}
          className={cn(
            'flex items-center justify-center w-7 shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-150 border-l border-border',
            canScrollRight ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
          )}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>

      </div>
    </TooltipProvider>
  );
}
