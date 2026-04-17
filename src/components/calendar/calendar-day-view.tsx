'use client';

import { cn } from '@/lib/utils';

import type { Locale } from 'date-fns';
import { addDays, format, isSameDay, set, startOfWeek } from 'date-fns';

import type { CalendarEvent, CalendarView } from './calendar-types';
import {
  filterEventsByDay,
  generateTimeSlots,
  getEventStyle,
  getEventsWithLayout,
} from './calendar-utils';
import { CalendarEventDay } from './calendar-event-day';
import { CalendarTimeColumn } from './calendar-time-column';
import { TimeSlotDividers } from './calendar-time-column';

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
  onEventContextMenu?: (data: any) => React.ReactNode;
  onSlotClick?: (date: Date) => void;
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
  onEventContextMenu,
  onSlotClick,
}: CalendarDayViewProps) {
  const startDay = view === 'week' ? startOfWeek(currentDate, { weekStartsOn: 1 }) : currentDate;
  const days = Array.from({ length: numDays }, (_, i) => addDays(startDay, i));
  const timeSlots = generateTimeSlots();

  const currentTimePosition = (currentTime.getHours() + currentTime.getMinutes() / 60) * 60;
  const showTimeIndicator = days.some((day) => isSameDay(day, currentTime));

  const handleSlotClick = (day: Date, e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if (onSlotClick) {
      const rect = e.currentTarget.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const hour = Math.floor(y / 60);
      const minute = Math.floor((y % 60) / 15) * 15;
      const clickedDate = set(day, { hours: hour, minutes: minute, seconds: 0, milliseconds: 0 });
      onSlotClick(clickedDate);
    }
  };

  return (
    <div className="day-view-container">
      <div className="day-view-scroll-content">
        <div className="day-view-header-wrapper">
          <div
            className="day-view-header-dates"
            style={{ gridTemplateColumns: `60px repeat(${days.length}, 1fr)` }}
          >
            <div className="time-zone-label">{timeZoneLabel}</div>
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
        <div className="day-view-body" style={{ '--num-days': days.length } as any}>
          <CalendarTimeColumn />
          {days.map((day) => (
            <div
              key={format(day, 'yyyy-MM-dd')}
              className="day-column"
              onClick={(e) => handleSlotClick(day, e)}
            >
              <TimeSlotDividers />
              {getEventsWithLayout(filterEventsByDay(events, day)).map((event) => (
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
