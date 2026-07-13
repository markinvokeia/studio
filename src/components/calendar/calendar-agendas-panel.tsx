'use client';

import React from 'react';
import { X, CalendarDays } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface AgendaCalendar {
  id: string;
  name: string;
  color?: string;
}

interface AgendaSedeGroup {
  id: string;
  name: string;
  calendars: AgendaCalendar[];
}

interface CalendarAgendasPanelProps {
  /** Calendars grouped by sede (from `calendarSedeGroups.sedeGroups`). */
  sedeGroups: AgendaSedeGroup[];
  /** Calendars without a sede (from `calendarSedeGroups.noSede`). */
  noSede: AgendaCalendar[];
  /** Ids of currently-visible calendars — only these are listed. */
  visibleIds: string[];
  /** Id of the calendar currently shown (single-select highlight). */
  selectedId: string | null;
  /** Choose a calendar to show (single-select). */
  onSelect: (id: string) => void;
  onClose: () => void;
}

/**
 * Whether the referenced label is clipped by overflow, kept up to date via
 * ResizeObserver so the tooltip content is mounted before any hover starts.
 */
function useIsTruncated<T extends HTMLElement>(text: string) {
  const ref = React.useRef<T | null>(null);
  const [truncated, setTruncated] = React.useState(false);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setTruncated(el.scrollWidth > el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text]);
  return { ref, truncated };
}

function AgendaGroupHeading({ name }: { name: string }) {
  const { ref, truncated } = useIsTruncated<HTMLParagraphElement>(name);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <p
          ref={ref}
          className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground truncate"
        >
          {name}
        </p>
      </TooltipTrigger>
      {truncated && <TooltipContent side="right">{name}</TooltipContent>}
    </Tooltip>
  );
}

function AgendaItem({ cal, active, onSelect }: { cal: AgendaCalendar; active: boolean; onSelect: (id: string) => void }) {
  const { ref, truncated } = useIsTruncated<HTMLSpanElement>(cal.name);
  const color = cal.color || 'hsl(var(--muted-foreground))';
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => onSelect(cal.id)}
          className={cn(
            'w-full flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition-colors',
            !active && 'border-border bg-card hover:bg-muted/50',
          )}
          style={active ? { borderColor: color, backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)` } : undefined}
        >
          <span
            className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border-2"
            style={{ borderColor: color }}
          >
            {active && <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />}
          </span>
          <span ref={ref} className="min-w-0 flex-1 truncate text-[13px] font-medium">{cal.name}</span>
        </button>
      </TooltipTrigger>
      {truncated && <TooltipContent side="right">{cal.name}</TooltipContent>}
    </Tooltip>
  );
}

/**
 * Docked left side panel (custom mode) listing the visible agendas/calendars,
 * rendered beside the calendar. Selecting one shows only that agenda full-width.
 */
export function CalendarAgendasPanel({ sedeGroups, noSede, visibleIds, selectedId, onSelect, onClose }: CalendarAgendasPanelProps) {
  const t = useTranslations('Calendar');
  const visibleSet = React.useMemo(() => new Set(visibleIds), [visibleIds]);

  const groups = React.useMemo(() => {
    const withSede = sedeGroups
      .map((g) => ({ ...g, calendars: g.calendars.filter((c) => visibleSet.has(c.id)) }))
      .filter((g) => g.calendars.length > 0);
    const orphan = noSede.filter((c) => visibleSet.has(c.id));
    return { withSede, orphan };
  }, [sedeGroups, noSede, visibleSet]);

  const isEmpty = groups.withSede.length === 0 && groups.orphan.length === 0;

  const renderItem = (cal: AgendaCalendar) => (
    <AgendaItem key={cal.id} cal={cal} active={selectedId === cal.id} onSelect={onSelect} />
  );

  return (
    // Shares one continuous frame with the calendar: same border + left radius as
    // `.calendar-container` (whose left radius is flattened while the panel is open).
    <div className="flex h-full w-48 max-w-[85vw] shrink-0 flex-col rounded-l-lg border border-r-0 border-border bg-muted">
      <div className="flex items-center justify-between gap-1.5 px-3 pt-3 pb-2 shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <CalendarDays className="h-4 w-4 shrink-0" />
          <span className="text-sm font-semibold truncate">{t('agendasPanelTitle')}</span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 rounded-full" onClick={onClose} title={t('gaps.close')}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-3">
        {isEmpty ? (
          <p className="text-sm text-muted-foreground text-center py-8">{t('agendasEmpty')}</p>
        ) : (
          <TooltipProvider delayDuration={300} skipDelayDuration={0} disableHoverableContent>
            {groups.withSede.map((group) => (
              <div key={group.id}>
                <AgendaGroupHeading name={group.name} />
                <div className="space-y-1">{group.calendars.map(renderItem)}</div>
              </div>
            ))}
            {groups.orphan.length > 0 && (
              <div className="space-y-1">{groups.orphan.map(renderItem)}</div>
            )}
          </TooltipProvider>
        )}
      </div>
    </div>
  );
}
