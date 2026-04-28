'use client';

import React from 'react';
import { cn } from '@/lib/utils';

import type { Locale } from 'date-fns';
import { addDays, format, getDaysInMonth, isSameDay, parseISO, startOfWeek } from 'date-fns';

import type { CalendarEvent, CalendarSlotClickHandler } from './calendar-types';
import { formatEventTime } from './calendar-utils';

interface CalendarMonthViewMobileProps {
  currentDate: Date;
  events: CalendarEvent[];
  dateLocale: Locale;
  onEventClick: (data: any) => void;
  onSlotClick?: CalendarSlotClickHandler;
}

export function CalendarMonthViewMobile({
  currentDate,
  events,
  dateLocale,
  onEventClick,
  onSlotClick,
}: CalendarMonthViewMobileProps) {
  // Initialize stable for SSR; set real "today" after mount.
  const [selectedDay, setSelectedDay] = React.useState<Date>(() => new Date(2000, 0, 1));
  React.useEffect(() => { setSelectedDay(new Date()); }, []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const dayOffset = (firstDayOfMonth - 1 + 7) % 7; // Monday = 1
  const daysInMonth = getDaysInMonth(currentDate);

  const dayNames = Array.from({ length: 7 }, (_, i) =>
    format(addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), i), 'EEEEE', { locale: dateLocale })
  );

  // Group events by date string for quick lookup
  const eventsByDate = React.useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    events.forEach((event) => {
      if (!event.start) return;
      try {
        const start = typeof event.start === 'string' ? parseISO(event.start) : event.start;
        const key = format(start, 'yyyy-MM-dd');
        const existing = map.get(key) || [];
        existing.push(event);
        map.set(key, existing);
      } catch {
        // skip invalid
      }
    });
    return map;
  }, [events]);

  // Events for the selected day
  const selectedDayKey = format(selectedDay, 'yyyy-MM-dd');
  const selectedDayEvents = eventsByDate.get(selectedDayKey) || [];

  const handleDayTap = (date: Date) => {
    setSelectedDay(date);
  };

  // Build calendar grid cells
  const cells: React.ReactNode[] = [];

  // Empty cells before first day
  for (let i = 0; i < dayOffset; i++) {
    cells.push(<div key={`empty-prev-${i}`} className="aspect-square" />);
  }

  // Day cells with dots
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dateKey = format(date, 'yyyy-MM-dd');
    const dayEvents = eventsByDate.get(dateKey) || [];
    const isSelected = isSameDay(date, selectedDay);
    const isToday = isSameDay(date, new Date());

    cells.push(
      <button
        key={day}
        className={cn(
          'aspect-square flex flex-col items-center justify-center rounded-lg text-sm relative',
          'transition-colors active:bg-muted',
          isSelected && 'bg-primary text-primary-foreground',
          isToday && !isSelected && 'ring-1 ring-primary',
        )}
        onClick={() => handleDayTap(date)}
      >
        <span className={cn('font-medium', isSelected && 'font-bold')}>{day}</span>
        {/* Colored dots */}
        {dayEvents.length > 0 && (
          <div className="flex gap-0.5 mt-0.5">
            {dayEvents.slice(0, 3).map((evt, i) => (
              <span
                key={i}
                className={cn(
                  'w-1 h-1 rounded-full',
                  isSelected ? 'bg-primary-foreground' : ''
                )}
                style={!isSelected ? { backgroundColor: evt.color || 'hsl(var(--primary))' } : undefined}
              />
            ))}
            {dayEvents.length > 3 && (
              <span className={cn('text-[8px] leading-none', isSelected ? 'text-primary-foreground' : 'text-muted-foreground')}>
                +{dayEvents.length - 3}
              </span>
            )}
          </div>
        )}
      </button>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Compact month grid */}
      <div className="shrink-0 px-3 pt-2 pb-1">
        {/* Day name headers */}
        <div className="grid grid-cols-7 text-center mb-1">
          {dayNames.map((name, i) => (
            <div key={i} className="text-xs font-medium text-muted-foreground py-1">
              {name}
            </div>
          ))}
        </div>

        {/* Grid of days */}
        <div className="grid grid-cols-7 gap-0.5">
          {cells}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-border mx-3" />

      {/* Agenda for selected day */}
      <div className="flex-1 overflow-y-auto px-3 pt-2 pb-20">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold">
            {format(selectedDay, 'd', { locale: dateLocale })}{' '}
            <span className="text-muted-foreground font-normal">
              {format(selectedDay, 'EEEE', { locale: dateLocale })}
            </span>
          </h3>
          {onSlotClick && (
            <button
              className="text-xs font-medium text-primary px-2 py-1 rounded-md hover:bg-primary/10"
              onClick={() => onSlotClick(selectedDay)}
            >
              + New
            </button>
          )}
        </div>

        {selectedDayEvents.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8">
            No appointments
          </div>
        ) : (
          <div className="space-y-2">
            {selectedDayEvents.map((event) => {
              const startTime = formatEventTime(event.start, dateLocale);
              return (
                <div
                  key={event.id}
                  data-testid="calendar-month-agenda-event"
                  className="flex items-start gap-3 p-3 rounded-lg border border-border/50 cursor-pointer active:bg-muted/50 transition-colors"
                  onClick={() => onEventClick(event.data)}
                >
                  {/* Color bar */}
                  <div
                    className="w-1 self-stretch rounded-full shrink-0"
                    style={{ backgroundColor: event.color || 'hsl(var(--primary))' }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm truncate">{event.title}</span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{startTime}</span>
                    </div>
                    {event.data?.doctorName && (
                      <span className="text-xs text-muted-foreground mt-0.5 block truncate">
                        {event.data.doctorName}
                      </span>
                    )}
                    {event.data?.calendar_name && (
                      <span className="text-xs text-muted-foreground block truncate">
                        {event.data.calendar_name}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
