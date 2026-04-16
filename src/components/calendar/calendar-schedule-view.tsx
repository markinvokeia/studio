'use client';

import type { Locale } from 'date-fns';
import { format, parseISO } from 'date-fns';

import type { CalendarEvent } from './calendar-types';

interface CalendarScheduleViewProps {
  events: CalendarEvent[];
  dateLocale: Locale;
  onEventClick: (data: any) => void;
}

export function CalendarScheduleView({ events, dateLocale, onEventClick }: CalendarScheduleViewProps) {
  const groupedEvents = events.reduce<Record<string, CalendarEvent[]>>((acc, event) => {
    if (!event.start) return acc;
    try {
      const date = format(typeof event.start === 'string' ? parseISO(event.start) : event.start, 'yyyy-MM-dd');
      if (!acc[date]) acc[date] = [];
      acc[date].push(event);
    } catch {
      // skip invalid dates
    }
    return acc;
  }, {});

  const sortedDates = Object.keys(groupedEvents).sort();

  return (
    <div className="overflow-y-auto p-4">
      {sortedDates.map((date) => (
        <div key={date} className="mb-4">
          <h3 className="font-bold text-lg mb-2">
            {format(parseISO(date), 'EEEE, MMMM d, yyyy', { locale: dateLocale })}
          </h3>
          <div className="space-y-2">
            {groupedEvents[date].map((event) => (
              <div
                key={event.id}
                className="p-2 rounded-md flex items-center gap-4 cursor-pointer"
                style={{ backgroundColor: event.color ? `${event.color}20` : 'var(--muted)' }}
                onClick={(e) => {
                  if (e.button !== 0) return;
                  onEventClick(event.data);
                }}
              >
                <div className="flex items-center gap-2 w-28 text-sm font-semibold">
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: event.color || 'hsl(var(--primary))' }}
                  />
                  {format(typeof event.start === 'string' ? parseISO(event.start) : event.start, 'p', { locale: dateLocale })}
                </div>
                <div className="flex-1 text-sm">{event.title}</div>
                {event.data?.doctorName && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{event.data.doctorName}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
