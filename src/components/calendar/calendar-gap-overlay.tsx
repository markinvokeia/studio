'use client';

import React from 'react';
import { format } from 'date-fns';

import { cn } from '@/lib/utils';
import { HOUR_SLOT_HEIGHT } from './calendar-constants';
import { type Gap, gapKey } from './calendar-gaps';

interface CalendarGapOverlaysProps {
  /** Gaps already scoped to a single day (or pass all + dayKey to filter). */
  gaps?: Gap[];
  /** Only render gaps whose `dayKey` matches this (when provided). */
  dayKey?: string;
  /** Only render gaps for this group/column (exact match, incl. `undefined`). */
  groupValue?: string;
  hourSlotHeight?: number;
  selectedGapKey?: string;
  onGapClick?: (gap: Gap) => void;
}

/**
 * Absolutely-positioned free-slot highlights for the time-grid views. Uses the
 * same `top`/`height` math as `getEventStyle` so they line up with events.
 */
export function CalendarGapOverlays({
  gaps,
  dayKey,
  groupValue,
  hourSlotHeight = HOUR_SLOT_HEIGHT,
  selectedGapKey,
  onGapClick,
}: CalendarGapOverlaysProps) {
  if (!gaps || gaps.length === 0) return null;
  const dayGaps = gaps.filter(
    (g) => (dayKey ? g.dayKey === dayKey : true) && g.groupValue === groupValue,
  );
  if (dayGaps.length === 0) return null;

  return (
    <>
      {dayGaps.map((gap) => {
        const top = (gap.start.getHours() + gap.start.getMinutes() / 60) * hourSlotHeight;
        const height = (gap.minutes / 60) * hourSlotHeight;
        const key = gapKey(gap);
        return (
          <button
            type="button"
            key={key}
            className={cn(
              'calendar-gap',
              gap.isMax && 'calendar-gap--max',
              selectedGapKey === key && 'calendar-gap--selected',
            )}
            style={{ top: `${top}px`, height: `${height}px` }}
            onClick={(e) => { e.stopPropagation(); onGapClick?.(gap); }}
            title={`${format(gap.start, 'HH:mm')} – ${format(gap.end, 'HH:mm')}`}
          >
            <span className="calendar-gap__label">
              {format(gap.start, 'HH:mm')}–{format(gap.end, 'HH:mm')}
            </span>
          </button>
        );
      })}
    </>
  );
}
