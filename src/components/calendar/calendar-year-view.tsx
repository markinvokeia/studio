'use client';

import { cn } from '@/lib/utils';

import type { Locale } from 'date-fns';
import { addDays, format, getDay, getDaysInMonth, getYear, isSameDay, parseISO, startOfWeek } from 'date-fns';

import type { CalendarEvent } from './calendar-types';

interface CalendarYearViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  dateLocale: Locale;
}

export function CalendarYearView({ currentDate, events, dateLocale }: CalendarYearViewProps) {
  const year = getYear(currentDate);
  const months = Array.from({ length: 12 }, (_, i) => new Date(year, i, 1));

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4 overflow-y-auto">
      {months.map((month) => (
        <div key={format(month, 'yyyy-MM')}>
          <h4 className="font-semibold text-center mb-2">
            {format(month, 'MMMM', { locale: dateLocale })}
          </h4>
          <div className="grid grid-cols-7 text-xs text-center text-muted-foreground">
            {Array.from({ length: 7 }, (_, i) => (
              <div key={i}>
                {format(addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), i), 'EEEEE', { locale: dateLocale })}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 text-sm text-center">
            {Array.from({ length: (getDay(month) + 6) % 7 }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: getDaysInMonth(month) }).map((_, day) => {
              const date = new Date(year, month.getMonth(), day + 1);
              const dayEvents = events.filter((e) =>
                isSameDay(typeof e.start === 'string' ? parseISO(e.start) : e.start, date)
              );
              return (
                <div
                  key={day}
                  className={cn(
                    'relative rounded-full aspect-square flex items-center justify-center',
                    dayEvents.length > 0 && 'bg-primary/20',
                    isSameDay(date, new Date()) && 'bg-primary text-primary-foreground'
                  )}
                >
                  {day + 1}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
