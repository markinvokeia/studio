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
  slotTimeFromOffset,
} from './calendar-utils';
import { CalendarEventDay } from './calendar-event-day';
import { CalendarTimeColumn } from './calendar-time-column';
import { TimeSlotDividers } from './calendar-time-column';
import { CalendarGapOverlays } from './calendar-gap-overlay';
import { CalendarBlockedOverlays } from './calendar-blocked-overlay';
import { isSlotBlocked } from './calendar-gaps';
import type { Gap, BlockedRange } from './calendar-gaps';

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
  onEventDoubleClick?: (data: any) => void;
  onEventContextMenu?: (data: any) => React.ReactNode;
  onEventContextMenuOpen?: (data: any) => void;
  onSlotClick?: CalendarSlotClickHandler;
  onSlotContextMenu?: CalendarSlotClickHandler;
  inlineDraft?: import('./calendar-types').InlineDraft | null;
  renderInlineDraft?: () => React.ReactNode;
  hourSlotHeight?: number;
  slotMinutes?: number;
  gaps?: Gap[];
  selectedGapKey?: string;
  onGapClick?: (gap: Gap) => void;
  blockedRanges?: BlockedRange[];
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
  onEventDoubleClick,
  onEventContextMenu,
  onEventContextMenuOpen,
  onSlotClick,
  onSlotContextMenu,
  inlineDraft,
  renderInlineDraft,
  hourSlotHeight = HOUR_SLOT_HEIGHT,
  slotMinutes,
  gaps,
  selectedGapKey,
  onGapClick,
  blockedRanges,
}: CalendarDayViewGroupedProps) {
  const startDay = view === 'week' ? startOfWeek(currentDate, { weekStartsOn: 1 }) : currentDate;
  const days = Array.from({ length: numDays }, (_, i) => addDays(startDay, i));

  const columns = groupingColumns;
  const isTablet = breakpoint === 'tablet';
  const groupedColumnMinWidth = isTablet ? 360 : GROUPED_COLUMN_MIN_WIDTH;
  const groupedDayGap = 1.6;
  // On tablet, cap visible columns to avoid excessive horizontal overflow
  const effectiveColCount = isTablet ? Math.min(columns.length, TABLET_MAX_RESOURCE_COLS) : columns.length;
  const groupedDayMinWidth = effectiveColCount * groupedColumnMinWidth;
  const contentMinWidth = `${60 + (days.length * groupedDayMinWidth) + ((days.length - 1) * groupedDayGap)}px`;

  const currentTimePosition = (currentTime.getHours() + currentTime.getMinutes() / 60) * hourSlotHeight;
  const showTimeIndicator = days.some((day) => isSameDay(day, currentTime));

  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const didInitialScrollRef = React.useRef(false);
  const prevHourRef = React.useRef(hourSlotHeight);
  React.useLayoutEffect(() => {
    const c = scrollContainerRef.current;
    if (!c) return;
    if (!didInitialScrollRef.current) {
      c.scrollTop = DEFAULT_SCROLL_HOUR * hourSlotHeight;
      didInitialScrollRef.current = true;
    } else if (prevHourRef.current && prevHourRef.current !== hourSlotHeight) {
      const topTimeMin = (c.scrollTop / prevHourRef.current) * 60;
      c.scrollTop = (topTimeMin / 60) * hourSlotHeight;
    }
    prevHourRef.current = hourSlotHeight;
  }, [hourSlotHeight]);

  // Center the clicked point when an inline draft opens (and scroll its column
  // into view); restore the previous scroll position when it closes.
  const draftKey = inlineDraft ? inlineDraft.date.getTime() : null;
  const draftGroup = inlineDraft?.groupValue ?? null;
  const savedScrollMinRef = React.useRef<number | null>(null);
  const savedScrollLeftRef = React.useRef(0);
  React.useEffect(() => {
    const c = scrollContainerRef.current;
    if (!c) return;
    if (draftKey !== null) {
      if (savedScrollMinRef.current === null) {
        savedScrollMinRef.current = (c.scrollTop / hourSlotHeight) * 60;
        savedScrollLeftRef.current = c.scrollLeft;
      }
      const d = new Date(draftKey);
      const clickMin = d.getHours() * 60 + d.getMinutes();
      const top = (clickMin / 60) * hourSlotHeight;
      c.scrollTo({ top: Math.max(0, top - c.clientHeight / 2), behavior: 'smooth' });
      if (draftGroup != null) {
        const colEl = c.querySelector(`[data-group-col="${CSS.escape(String(draftGroup))}"]`) as HTMLElement | null;
        colEl?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    } else if (savedScrollMinRef.current !== null) {
      c.scrollTo({ top: Math.max(0, (savedScrollMinRef.current / 60) * hourSlotHeight), left: savedScrollLeftRef.current, behavior: 'smooth' });
      savedScrollMinRef.current = null;
    }
  }, [draftKey, draftGroup, hourSlotHeight]);

  const slotDateFromEvent = (day: Date, e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const { hour, minute } = slotTimeFromOffset(y, hourSlotHeight, slotMinutes);
    return set(day, { hours: hour, minutes: minute, seconds: 0, milliseconds: 0 });
  };

  const handleSlotClick = (day: Date, col: CalendarGroupingColumn, e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    // Ignore synthetic clicks that bubbled from portalled children (Sheets, DropdownMenu, ContextMenu).
    if (!e.currentTarget.contains(e.target as Node)) return;
    if (onSlotClick) {
      const date = slotDateFromEvent(day, e);
      if (isSlotBlocked(blockedRanges, date, col.value)) return; // no creating on blocked slots
      const context = groupBy !== 'none' ? { groupBy, value: col.value } : undefined;
      onSlotClick(date, context);
    }
  };

  const handleSlotContextMenu = (day: Date, col: CalendarGroupingColumn, e: React.MouseEvent<HTMLDivElement>) => {
    if (!onSlotContextMenu) return;
    // An event's own context menu (radix ContextMenuTrigger) already handled and
    // preventDefault'd the right-click — don't also open the slot menu over it.
    if (e.defaultPrevented) return;
    if ((e.target as HTMLElement).closest('.event-in-day-view, .event')) return;
    if (!e.currentTarget.contains(e.target as Node)) return;
    const date = slotDateFromEvent(day, e);
    if (isSlotBlocked(blockedRanges, date, col.value)) { e.preventDefault(); return; } // disable create/reminder on blocked slots
    e.preventDefault();
    const context = groupBy !== 'none' ? { groupBy, value: col.value } : undefined;
    onSlotContextMenu(date, context);
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
                    <span className="truncate min-w-0" title={col.label}>{col.label}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Body: time grid with grouped columns */}
        <div
          className="day-view-body-grouped"
          style={{ gridTemplateColumns: `60px repeat(${days.length}, minmax(${groupedDayMinWidth}px, 1fr))`, '--hour-slot-height': `${hourSlotHeight}px` } as React.CSSProperties}
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
                    data-group-col={col.value}
                    onClick={(e) => handleSlotClick(day, col, e)}
                    onContextMenu={(e) => handleSlotContextMenu(day, col, e)}
                  >
                    <TimeSlotDividers keyPrefix={col.id} />
                    <CalendarBlockedOverlays
                      ranges={blockedRanges}
                      dayKey={format(day, 'yyyy-MM-dd')}
                      groupValue={col.value}
                      hourSlotHeight={hourSlotHeight}
                    />
                    <CalendarGapOverlays
                      gaps={gaps}
                      dayKey={format(day, 'yyyy-MM-dd')}
                      groupValue={col.value}
                      hourSlotHeight={hourSlotHeight}
                      selectedGapKey={selectedGapKey}
                      onGapClick={onGapClick}
                    />
                    {eventsWithLayout.map((event) => (
                      <CalendarEventDay
                        key={event.id}
                        event={event}
                        style={getEventStyle(event, hourSlotHeight)}
                        dateLocale={dateLocale}
                        onEventClick={onEventClick}
                        onEventColorChange={onEventColorChange}
                        onEventDoubleClick={onEventDoubleClick}
                        onEventContextMenu={onEventContextMenu}
                        onEventContextMenuOpen={onEventContextMenuOpen}
                      />
                    ))}
                    {inlineDraft && renderInlineDraft && isSameDay(day, inlineDraft.date) && String(inlineDraft.groupValue ?? '') === String(col.value) && (
                      <div
                        className="absolute left-0.5 right-0.5 z-[12]"
                        style={{
                          top: `${(inlineDraft.date.getHours() + inlineDraft.date.getMinutes() / 60) * hourSlotHeight}px`,
                          minHeight: `${Math.max((inlineDraft.durationMin / 60) * hourSlotHeight, 96)}px`,
                        }}
                        onClick={(e) => e.stopPropagation()}
                        onContextMenu={(e) => e.stopPropagation()}
                      >
                        {renderInlineDraft()}
                      </div>
                    )}
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
