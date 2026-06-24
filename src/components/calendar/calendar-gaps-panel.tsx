'use client';

import React from 'react';
import { format, parseISO } from 'date-fns';
import type { Locale } from 'date-fns';
import { X, Clock } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { type Gap, gapKey } from './calendar-gaps';

interface CalendarGapsPanelProps {
  gaps: Gap[];
  selectedGapKey?: string;
  dateLocale: Locale;
  onSelect: (gap: Gap) => void;
  onClose: () => void;
}

/** Floating list of free slots ("Huecos") for the visible range. */
export function CalendarGapsPanel({ gaps, selectedGapKey, dateLocale, onSelect, onClose }: CalendarGapsPanelProps) {
  const t = useTranslations('Calendar.gaps');

  // Group gaps by day, preserving chronological order within each day.
  const byDay = React.useMemo(() => {
    const map = new Map<string, Gap[]>();
    for (const g of gaps) {
      const arr = map.get(g.dayKey) ?? [];
      arr.push(g);
      map.set(g.dayKey, arr);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.start.getTime() - b.start.getTime());
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [gaps]);

  return (
    <div className="absolute right-3 top-3 bottom-3 z-30 w-72 max-w-[85vw] flex flex-col rounded-xl border border-border bg-card shadow-xl">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Clock className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm font-semibold truncate">{t('panelTitle')}</span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onClose} title={t('close')}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {gaps.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">{t('empty')}</p>
        ) : (
          byDay.map(([dayKey, dayGaps]) => (
            <div key={dayKey}>
              <p className="px-1 pb-1 text-xs font-medium text-muted-foreground capitalize">
                {format(parseISO(dayKey), 'EEEE d MMM', { locale: dateLocale })}
              </p>
              <div className="space-y-1">
                {dayGaps.map((gap) => {
                  const key = gapKey(gap);
                  return (
                    <button
                      type="button"
                      key={key}
                      onClick={() => onSelect(gap)}
                      className={cn(
                        'w-full flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors',
                        selectedGapKey === key ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/50',
                        gap.isMax && 'ring-1 ring-primary/40',
                      )}
                    >
                      <span className="flex flex-col min-w-0">
                        <span className="text-sm font-medium tabular-nums">
                          {format(gap.start, 'HH:mm')} – {format(gap.end, 'HH:mm')}
                        </span>
                        {gap.groupLabel && (
                          <span className="text-[11px] text-muted-foreground truncate">{gap.groupLabel}</span>
                        )}
                      </span>
                      <span className="flex items-center gap-1.5 shrink-0">
                        {gap.isMax && (
                          <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold text-primary">
                            {t('maxBadge')}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">{t('duration', { min: gap.minutes })}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
