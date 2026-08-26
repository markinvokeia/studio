'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

import { Checkbox } from '@/components/ui/checkbox';
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from '@/components/ui/context-menu';

import type { Locale } from 'date-fns';
import { addDays, format, isSameDay, set } from 'date-fns';

import { DEFAULT_SCROLL_HOUR, GROUPED_COLUMN_MIN_WIDTH, HOUR_SLOT_HEIGHT, TABLET_MAX_RESOURCE_COLS } from './calendar-constants';
import type { CalendarBreakpoint, CalendarEvent, CalendarGroupBy, CalendarGroupingColumn, CalendarSlotClickHandler, CalendarSlotContextMenuContext, CalendarSlotContextMenuRenderer, CalendarView } from './calendar-types';
import {
  filterEventsByDayAndGroup,
  getCalendarViewStartDate,
  getEventStyle,
  getEventsWithLayout,
  slotTimeFromOffset,
} from './calendar-utils';
import { CalendarEventDay } from './calendar-event-day';
import { CalendarTimeColumn } from './calendar-time-column';
import { TimeSlotDividers } from './calendar-time-column';
import { CalendarHourRail } from './calendar-hour-rail';
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
  renderSlotContextMenu?: CalendarSlotContextMenuRenderer;
  hourSlotHeight?: number;
  slotMinutes?: number;
  gaps?: Gap[];
  selectedGapKey?: string;
  onGapClick?: (gap: Gap) => void;
  blockedRanges?: BlockedRange[];
  /** Whether the main hour gutter shows the hour labels (toggled via GMT checkbox). */
  showTimeColumn?: boolean;
  onToggleTimeColumn?: (value: boolean) => void;
  /** Hide the 60px hour gutter entirely (custom mode) — hours stay on each column rail. */
  hideTimeGutter?: boolean;
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
  renderSlotContextMenu,
  hourSlotHeight = HOUR_SLOT_HEIGHT,
  slotMinutes,
  gaps,
  selectedGapKey,
  onGapClick,
  blockedRanges,
  showTimeColumn = false,
  onToggleTimeColumn,
  hideTimeGutter = false,
}: CalendarDayViewGroupedProps) {
  const t = useTranslations('Calendar');
  const startDay = view === 'week'
    ? getCalendarViewStartDate(currentDate, view)
    : currentDate;
  const days = Array.from({ length: numDays }, (_, i) => addDays(startDay, i));
  // Custom mode hides the 60px gutter; the leading grid track collapses to 0.
  const gutterTrack = hideTimeGutter ? '' : '60px ';

  const columns = groupingColumns;
  const [contextSlot, setContextSlot] = React.useState<CalendarSlotContextMenuContext | null>(null);
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
    if (!renderSlotContextMenu) return;
    // An event's own context menu (radix ContextMenuTrigger) already handled and
    // preventDefault'd the right-click — don't also open the slot menu over it.
    if (e.defaultPrevented) return;
    if ((e.target as HTMLElement).closest('.event-in-day-view, .event')) return;
    if (!e.currentTarget.contains(e.target as Node)) return;
    const date = slotDateFromEvent(day, e);
    const context = groupBy !== 'none' ? { groupBy, value: col.value } : undefined;
    setContextSlot({
      date,
      context,
      isBlocked: isSlotBlocked(blockedRanges, date, col.value),
    });
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
            style={{ gridTemplateColumns: `${gutterTrack}repeat(${days.length}, minmax(${groupedDayMinWidth}px, 1fr))` }}
          >
            {!hideTimeGutter && (
              <div className="time-zone-label">
                <Checkbox
                  className="time-zone-toggle"
                  checked={showTimeColumn}
                  onCheckedChange={(v) => onToggleTimeColumn?.(v === true)}
                  aria-label={t('showHours')}
                  title={t('showHours')}
                />
                <span>{timeZoneLabel}</span>
              </div>
            )}
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
            style={{ gridTemplateColumns: `${gutterTrack}repeat(${days.length}, minmax(${groupedDayMinWidth}px, 1fr))` }}
          >
            {!hideTimeGutter && <div className="day-view-header-spacer" />}
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
          style={{ gridTemplateColumns: `${gutterTrack}repeat(${days.length}, minmax(${groupedDayMinWidth}px, 1fr))`, '--hour-slot-height': `${hourSlotHeight}px` } as React.CSSProperties}
        >
          {!hideTimeGutter && <CalendarTimeColumn visible={showTimeColumn} />}
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
                  <ContextMenu key={`${format(day, 'yyyy-MM-dd')}-${col.id}`}>
                    <ContextMenuTrigger asChild disabled={!renderSlotContextMenu}>
                      <div className="day-column" data-group-col={col.value}>
                        <CalendarHourRail
                          keyPrefix={col.id}
                          ariaLabel={t('createAppointment')}
                          onClick={(e) => handleSlotClick(day, col, e)}
                          onContextMenu={(e) => handleSlotContextMenu(day, col, e)}
                        />
                        <div
                          className="day-column-content"
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
                              hourSlotHeight={hourSlotHeight}
                              dateLocale={dateLocale}
                              onEventClick={onEventClick}
                              onEventColorChange={onEventColorChange}
                              onEventDoubleClick={onEventDoubleClick}
                              onEventContextMenu={onEventContextMenu}
                              onEventContextMenuOpen={onEventContextMenuOpen}
                            />
                          ))}
                        </div>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      {contextSlot && renderSlotContextMenu?.(contextSlot)}
                    </ContextMenuContent>
                  </ContextMenu>
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
