'use client';

import React from 'react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';
import { HOUR_SLOT_HEIGHT } from './calendar-constants';
import { type BlockedRange, blockedKey } from './calendar-gaps';

interface CalendarBlockedOverlaysProps {
  ranges?: BlockedRange[];
  /** Only render ranges whose `dayKey` matches this (when provided). */
  dayKey?: string;
  /** Only render ranges for this group/column (exact match, incl. `undefined`). */
  groupValue?: string;
  hourSlotHeight?: number;
}

/**
 * Absolutely-positioned "no disponible" bands for time outside business hours.
 * Swallows clicks (stopPropagation) so the underlying slot click never fires;
 * rendered below events so existing appointments stay clickable.
 */
export function CalendarBlockedOverlays({
  ranges,
  dayKey,
  groupValue,
  hourSlotHeight = HOUR_SLOT_HEIGHT,
}: CalendarBlockedOverlaysProps) {
  const t = useTranslations('Calendar.blocked');
  if (!ranges || ranges.length === 0) return null;
  const dayRanges = ranges.filter(
    (r) => (dayKey ? r.dayKey === dayKey : true) && r.groupValue === groupValue,
  );
  if (dayRanges.length === 0) return null;

  return (
    <>
      {dayRanges.map((r) => {
        const top = (r.startMin / 60) * hourSlotHeight;
        const height = ((r.endMin - r.startMin) / 60) * hourSlotHeight;
        const isException = r.reason === 'exception';
        return (
          <div
            key={blockedKey(r.dayKey, r)}
            className={cn('calendar-blocked', isException && 'calendar-blocked--exception')}
            style={{ top: `${top}px`, height: `${height}px` }}
            onClick={(e) => e.stopPropagation()}
            aria-hidden
          >
            {height >= 28 && (
              <span className="calendar-blocked__label">
                {t('label')}
                {isException && r.note ? <span className="calendar-blocked__note"> ({r.note})</span> : null}
              </span>
            )}
          </div>
        );
      })}
    </>
  );
}
