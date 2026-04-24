'use client';

import React from 'react';
import { cn } from '@/lib/utils';

import type { Locale } from 'date-fns';
import { addDays, format, isSameDay, set, startOfWeek } from 'date-fns';

import { DEFAULT_SCROLL_HOUR, GROUPED_COLUMN_MIN_WIDTH, HOUR_SLOT_HEIGHT, TABLET_MAX_RESOURCE_COLS } from './calendar-constants';
import type { CalendarBreakpoint, CalendarEvent, CalendarGroupBy, CalendarGroupingColumn, CalendarSlotClickHandler, CalendarView } from './calendar-types';
import {
  filterEventsByDayAndGroup,
  getEventStyle,
  getEventsWithLayout,
} from './calendar-utils';
import { CalendarEventDay } from './calendar-event-day';
import { CalendarTimeColumn } from './calendar-time-column';
import { TimeSlotDividers } from './calendar-time-column';

interface CalendarDayViewGroupedProps {
  currentDate: Date;
  view: CalendarView;
  numDays: number;
  events: CalendarEvent[];
  groupBy: CalendarGroupBy;
  groupingColumns: CalendarGroupingColumn[];
  currentTime: Date;
  dateLocale: Locale;
  timeZoneLabel: string;
  breakpoint?: CalendarBreakpoint;
  onEventClick: (data: any) => void;
  onEventColorChange: (data: any, colorId: string) => void;
  onEventContextMenu?: (data: any) => React.ReactNode;
  onSlotClick?: CalendarSlotClickHandler;
}

export function CalendarDayViewGrouped({
  currentDate,
  view,
  numDays,
  events,
  groupBy,
  groupingColumns,
  currentTime,
  dateLocale,
  timeZoneLabel,
  breakpoint = 'desktop',
  onEventClick,
  onEventColorChange,
  onEventContextMenu,
  onSlotClick,
}: CalendarDayViewGroupedProps) {
  const startDay = view === 'week' ? startOfWeek(currentDate, { weekStartsOn: 1 }) : currentDate;
  const days = Array.from({ length: numDays }, (_, i) => addDays(startDay, i));

  const columns = groupingColumns;
  const isTablet = breakpoint === 'tablet';
  const groupedColumnMinWidth = isTablet ? 180 : GROUPED_COLUMN_MIN_WIDTH;
  const groupedDayGap = 1.6;
  // On tablet, cap visible columns to avoid excessive horizontal overflow
  const effectiveColCount = isTablet ? Math.min(columns.length, TABLET_MAX_RESOURCE_COLS) : columns.length;
  const groupedDayMinWidth = effectiveColCount * groupedColumnMinWidth;
  const contentMinWidth = `${60 + (days.length * groupedDayMinWidth) + ((days.length - 1) * groupedDayGap)}px`;

  const currentTimePosition = (currentTime.getHours() + currentTime.getMinutes() / 60) * 60;
  const showTimeIndicator = days.some((day) => isSameDay(day, currentTime));

  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = DEFAULT_SCROLL_HOUR * HOUR_SLOT_HEIGHT;
    }
  }, []);

  const handleSlotClick = (day: Date, col: CalendarGroupingColumn, e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if (onSlotClick) {
      const rect = e.currentTarget.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const hour = Math.floor(y / 60);
      const minute = Math.floor((y % 60) / 15) * 15;
      const clickedDate = set(day, { hours: hour, minutes: minute, seconds: 0, milliseconds: 0 });
      const context = groupBy !== 'none' ? { groupBy, value: col.value } : undefined;
      onSlotClick(clickedDate, context);
    }
  };

  return (
    <div className="day-view-container" ref={scrollContainerRef}>
      <div
        className="day-view-scroll-content"
        style={{ minWidth: contentMinWidth }}
      >
        {/* Header: date row */}
        <div className="day-view-header-wrapper">
          <div
            className="day-view-header-dates-grouped"
            style={{ gridTemplateColumns: `60px repeat(${days.length}, minmax(${groupedDayMinWidth}px, 1fr))` }}
          >
            <div className="time-zone-label">{timeZoneLabel}</div>
            {days.map((day) => (
              <div key={`date-${format(day, 'yyyy-MM-dd')}`} className="day-view-date-block">
                <span className="day-name">{format(day, 'EEE', { locale: dateLocale }).toUpperCase()}</span>
                <span className={cn('day-number', isSameDay(day, new Date()) && 'current-day')}>
                  {format(day, 'd', { locale: dateLocale })}
                </span>
              </div>
            ))}
          </div>

          {/* Header: group columns per day */}
          <div
            className="day-view-header-groups-by-day"
            style={{ gridTemplateColumns: `60px repeat(${days.length}, minmax(${groupedDayMinWidth}px, 1fr))` }}
          >
            <div className="day-view-header-spacer" />
            {days.map((day) => (
              <div
                key={`group-block-${format(day, 'yyyy-MM-dd')}`}
                className={cn('day-view-group-block', isTablet && columns.length > TABLET_MAX_RESOURCE_COLS && 'overflow-x-auto snap-x snap-mandatory')}
                style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(${groupedColumnMinWidth}px, 1fr))` }}
              >
                {columns.map((col) => (
                  <div key={`group-${format(day, 'yyyy-MM-dd')}-${col.id}`} className={cn('day-view-group-cell', isTablet && 'snap-start')}>
                    {col.color && (
                      <span
                        className="inline-block shrink-0 rounded-full mr-1.5"
                        style={{ width: 8, height: 8, background: col.color, boxShadow: `0 0 4px ${col.color}80` }}
                      />
                    )}
                    {col.label}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Body: time grid with grouped columns */}
        <div
          className="day-view-body-grouped"
          style={{ gridTemplateColumns: `60px repeat(${days.length}, minmax(${groupedDayMinWidth}px, 1fr))` }}
        >
          <CalendarTimeColumn />
          {days.map((day) => (
            <div
              key={`day-block-${format(day, 'yyyy-MM-dd')}`}
              className={cn('day-block', isTablet && columns.length > TABLET_MAX_RESOURCE_COLS && 'overflow-x-auto snap-x snap-mandatory')}
              style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(${groupedColumnMinWidth}px, 1fr))` }}
            >
              {columns.map((col) => {
                const dayColEvents = filterEventsByDayAndGroup(events, day, groupBy, col.value);
                const eventsWithLayout = getEventsWithLayout(dayColEvents);

                return (
                  <div
                    key={`${format(day, 'yyyy-MM-dd')}-${col.id}`}
                    className="day-column"
                    onClick={(e) => handleSlotClick(day, col, e)}
                  >
                    <TimeSlotDividers keyPrefix={col.id} />
                    {eventsWithLayout.map((event) => (
                      <CalendarEventDay
                        key={event.id}
                        event={event}
                        style={getEventStyle(event)}
                        dateLocale={dateLocale}
                        onEventClick={onEventClick}
                        onEventColorChange={onEventColorChange}
                        onEventContextMenu={onEventContextMenu}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
          {showTimeIndicator && (
            <div className="current-time-indicator" style={{ top: `${currentTimePosition}px` }}>
              <div className="current-time-dot" />
              <div className="current-time-line" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
