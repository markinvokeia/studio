'use client';

import React from 'react';

import { generateTimeSlots } from './calendar-utils';

interface CalendarHourRailProps {
  /** Left-click on the rail — creates a new appointment at the clicked slot. */
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  /** Right-click on the rail — opens the appointment/reminder chooser. */
  onContextMenu?: (e: React.MouseEvent<HTMLDivElement>) => void;
  /** Accessible label for the clickable rail (e.g. "Create appointment"). */
  ariaLabel?: string;
  /** Distinguishes keys when several rails render in the same subtree. */
  keyPrefix?: string;
}

/**
 * A thin, clickable rail rendered at the left edge of each day/resource column.
 * It shows the hour number at each hour mark (like the main time column) and,
 * because it sits beside the events area (not under it), clicking it always
 * creates a new appointment at that slot — even when an event already occupies
 * that time.
 */
export function CalendarHourRail({ onClick, onContextMenu, ariaLabel, keyPrefix }: CalendarHourRailProps) {
  const timeSlots = generateTimeSlots();
  return (
    <div
      className="column-hour-rail"
      role="button"
      aria-label={ariaLabel}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      {timeSlots.map((time) => {
        const hour = parseInt(time.split(':')[0], 10);
        return (
          <div key={keyPrefix ? `${time}-${keyPrefix}` : time} className="column-hour-rail-slot">
            <span className="column-hour-rail-label">{hour}</span>
          </div>
        );
      })}
    </div>
  );
}
