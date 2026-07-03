'use client';

import React from 'react';
import { Check, X, CalendarDays } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

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
 * Left side panel (custom mode) listing the visible agendas/calendars. Selecting
 * one shows only that agenda full-width. Modeled on CalendarGapsPanel.
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

  const renderItem = (cal: AgendaCalendar) => {
    const active = selectedId === cal.id;
    return (
      <button
        type="button"
        key={cal.id}
        onClick={() => onSelect(cal.id)}
        className={cn(
          'w-full flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors',
          active ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/50',
        )}
      >
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: cal.color || 'hsl(var(--muted-foreground))' }}
        />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{cal.name}</span>
        {active && <Check className="h-4 w-4 shrink-0 text-primary" />}
      </button>
    );
  };

  return (
    // Full-area overlay: covers the calendar so the user sees the agenda LIST or the
    // calendar, not both. A fixed panel is docked flush-left.
    <div className="absolute inset-0 z-30 bg-background/95 backdrop-blur-sm">
      <div className="flex h-full w-80 max-w-[90vw] flex-col border-r border-border bg-card shadow-xl">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <CalendarDays className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm font-semibold truncate">{t('agendasPanelTitle')}</span>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onClose} title={t('gaps.close')}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-3">
          {isEmpty ? (
            <p className="text-sm text-muted-foreground text-center py-8">{t('agendasEmpty')}</p>
          ) : (
            <>
              {groups.withSede.map((group) => (
                <div key={group.id}>
                  <p className="px-1 pb-1 text-xs font-medium text-muted-foreground truncate">{group.name}</p>
                  <div className="space-y-1">{group.calendars.map(renderItem)}</div>
                </div>
              ))}
              {groups.orphan.length > 0 && (
                <div className="space-y-1">{groups.orphan.map(renderItem)}</div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
