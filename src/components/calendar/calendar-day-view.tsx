'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

import { Checkbox } from '@/components/ui/checkbox';
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from '@/components/ui/context-menu';

import type { Locale } from 'date-fns';
import { addDays, format, isSameDay, set, startOfWeek } from 'date-fns';

import { DEFAULT_SCROLL_HOUR, HOUR_SLOT_HEIGHT } from './calendar-constants';
import type { CalendarEvent, CalendarSlotClickHandler, CalendarSlotContextMenuContext, CalendarSlotContextMenuRenderer, CalendarView } from './calendar-types';
import {
  filterEventsByDay,
  generateTimeSlots,
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

interface CalendarDayViewProps {
  currentDate: Date;
  view: CalendarView;
  numDays: number;
  events: CalendarEvent[];
  currentTime: Date;
  dateLocale: Locale;
  timeZoneLabel: string;
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
}

export function CalendarDayView({
  currentDate,
  view,
  numDays,
  events,
  currentTime,
  dateLocale,
  timeZoneLabel,
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
}: CalendarDayViewProps) {
  const t = useTranslations('Calendar');
  const startDay = view === 'week' ? startOfWeek(currentDate, { weekStartsOn: 1 }) : currentDate;
  const days = Array.from({ length: numDays }, (_, i) => addDays(startDay, i));
  const timeSlots = generateTimeSlots();
  const [contextSlot, setContextSlot] = React.useState<CalendarSlotContextMenuContext | null>(null);

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
      // Preserve the time at the viewport top when the slot height changes (zoom).
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

  const handleSlotClick = (day: Date, e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    // Ignore synthetic clicks that bubbled from portalled children (Sheets, DropdownMenu, ContextMenu).
    if (!e.currentTarget.contains(e.target as Node)) return;
    if (onSlotClick) {
      const date = slotDateFromEvent(day, e);
      if (isSlotBlocked(blockedRanges, date)) return; // no creating on blocked slots
      onSlotClick(date);
    }
  };

  const handleSlotContextMenu = (day: Date, e: React.MouseEvent<HTMLDivElement>) => {
    if (!renderSlotContextMenu) return;
    // An event's own context menu (radix ContextMenuTrigger) already handled and
    // preventDefault'd the right-click — don't also open the slot menu over it.
    if (e.defaultPrevented) return;
    if ((e.target as HTMLElement).closest('.event-in-day-view, .event')) return;
    if (!e.currentTarget.contains(e.target as Node)) return;
    const date = slotDateFromEvent(day, e);
    setContextSlot({ date, isBlocked: isSlotBlocked(blockedRanges, date) });
  };

  return (
    <div className="day-view-container" ref={scrollContainerRef}>
      <div className="day-view-scroll-content">
        <div className="day-view-header-wrapper">
          <div
            className="day-view-header-dates"
            style={{ gridTemplateColumns: `60px repeat(${days.length}, 1fr)` }}
          >
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
            {days.map((day) => (
              <div key={`date-${format(day, 'yyyy-MM-dd')}`} className="day-view-date-cell">
                <span className="day-name">{format(day, 'EEE', { locale: dateLocale }).toUpperCase()}</span>
                <span className={cn('day-number', isSameDay(day, new Date()) && 'current-day')}>
                  {format(day, 'd', { locale: dateLocale })}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="day-view-body" style={{ '--num-days': days.length, '--hour-slot-height': `${hourSlotHeight}px` } as any}>
          <CalendarTimeColumn visible={showTimeColumn} />
          {days.map((day) => (
            <ContextMenu key={format(day, 'yyyy-MM-dd')}>
              <ContextMenuTrigger asChild disabled={!renderSlotContextMenu}>
                <div className="day-column">
                  <CalendarHourRail
                    ariaLabel={t('createAppointment')}
                    onClick={(e) => handleSlotClick(day, e)}
                    onContextMenu={(e) => handleSlotContextMenu(day, e)}
                  />
                  <div
                    className="day-column-content"
                    onClick={(e) => handleSlotClick(day, e)}
                    onContextMenu={(e) => handleSlotContextMenu(day, e)}
                  >
                    <TimeSlotDividers />
                    <CalendarBlockedOverlays
                      ranges={blockedRanges}
                      dayKey={format(day, 'yyyy-MM-dd')}
                      hourSlotHeight={hourSlotHeight}
                    />
                    <CalendarGapOverlays
                      gaps={gaps}
                      dayKey={format(day, 'yyyy-MM-dd')}
                      hourSlotHeight={hourSlotHeight}
                      selectedGapKey={selectedGapKey}
                      onGapClick={onGapClick}
                    />
                    {getEventsWithLayout(filterEventsByDay(events, day)).map((event) => (
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
                  </div>
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent>
                {contextSlot && renderSlotContextMenu?.(contextSlot)}
              </ContextMenuContent>
            </ContextMenu>
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
