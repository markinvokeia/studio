'use client';

import React from 'react';
import { cn } from '@/lib/utils';

import type { Locale } from 'date-fns';
import { addDays, format, isSameDay, set, startOfWeek } from 'date-fns';

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/ui/carousel';

import type { CalendarEvent, CalendarGroupBy, CalendarGroupingColumn, CalendarView } from './calendar-types';
import {
  filterEventsByDay,
  filterEventsByDayAndGroup,
  generateTimeSlots,
  getEventStyle,
  getEventsWithLayout,
  formatTimeSlotLabel,
} from './calendar-utils';
import { CalendarEventDay } from './calendar-event-day';
import { TimeSlotDividers } from './calendar-time-column';

interface CalendarDayViewMobileProps {
  currentDate: Date;
  view: CalendarView;
  numDays: number;
  events: CalendarEvent[];
  groupBy: CalendarGroupBy;
  groupingColumns: CalendarGroupingColumn[];
  currentTime: Date;
  dateLocale: Locale;
  onEventClick: (data: any) => void;
  onEventColorChange: (data: any, colorId: string) => void;
  onEventContextMenu?: (data: any) => React.ReactNode;
  onSlotClick?: (date: Date) => void;
}

export function CalendarDayViewMobile({
  currentDate,
  view,
  numDays,
  events,
  groupBy,
  groupingColumns,
  currentTime,
  dateLocale,
  onEventClick,
  onEventColorChange,
  onEventContextMenu,
  onSlotClick,
}: CalendarDayViewMobileProps) {
  const [api, setApi] = React.useState<CarouselApi>();
  const [activeIndex, setActiveIndex] = React.useState(0);

  const startDay = view === 'week' ? startOfWeek(currentDate, { weekStartsOn: 1 }) : currentDate;
  const days = Array.from({ length: numDays }, (_, i) => addDays(startDay, i));
  const timeSlots = generateTimeSlots();

  const isGrouped = groupBy !== 'none' && groupingColumns.length > 0;

  // Build slides: if grouped, one slide per resource column; if not, one slide per day
  const slides = React.useMemo(() => {
    if (isGrouped) {
      // For grouped view, show resources for the first day (single-day mobile)
      const day = days[0];
      return groupingColumns.map((col) => ({
        key: `${format(day, 'yyyy-MM-dd')}-${col.id}`,
        day,
        column: col,
        label: col.label,
        color: col.color,
        events: getEventsWithLayout(filterEventsByDayAndGroup(events, day, groupBy, col.value)),
      }));
    }
    // Non-grouped: one slide per day
    return days.map((day) => ({
      key: format(day, 'yyyy-MM-dd'),
      day,
      column: null,
      label: format(day, 'EEE d', { locale: dateLocale }),
      color: undefined,
      events: getEventsWithLayout(filterEventsByDay(events, day)),
    }));
  }, [isGrouped, days, groupingColumns, events, groupBy, dateLocale]);

  const currentTimePosition = (currentTime.getHours() + currentTime.getMinutes() / 60) * 60;

  React.useEffect(() => {
    if (!api) return;
    const onSelect = () => setActiveIndex(api.selectedScrollSnap());
    api.on('select', onSelect);
    return () => { api.off('select', onSelect); };
  }, [api]);

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
    <div className="flex flex-col h-full">
      {/* Resource/day indicator dots */}
      {slides.length > 1 && (
        <div className="flex items-center justify-center gap-2 py-2 border-b border-border bg-card shrink-0">
          {slides.map((slide, i) => (
            <button
              key={slide.key}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
                i === activeIndex
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              )}
              onClick={() => api?.scrollTo(i)}
            >
              {slide.color && (
                <span
                  className="inline-block w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: slide.color }}
                />
              )}
              <span className="truncate max-w-[80px]">{slide.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Scrollable time grid with carousel */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex min-h-[1440px]">
          {/* Sticky time column */}
          <div className="sticky left-0 z-10 bg-card w-12 shrink-0">
            {timeSlots.map((time) => (
              <div key={time} className="h-[60px] relative">
                <span
                  className={cn(
                    'absolute right-1 text-[10px] text-muted-foreground',
                    time === '00:00' ? 'top-1' : '-top-[0.6em]'
                  )}
                >
                  {formatTimeSlotLabel(time)}
                </span>
              </div>
            ))}
          </div>

          {/* Carousel of resource/day columns */}
          <div className="flex-1 relative">
            <Carousel
              opts={{
                align: 'start',
                containScroll: 'trimSnaps',
                dragFree: false,
              }}
              setApi={setApi}
              className="h-full"
            >
              <CarouselContent className="-ml-0 h-full">
                {slides.map((slide) => {
                  const showIndicator = isSameDay(slide.day, currentTime);
                  return (
                    <CarouselItem
                      key={slide.key}
                      className="pl-0 basis-[85%] min-w-0"
                    >
                      <div
                        className="relative h-full border-r border-border/50"
                        onClick={(e) => handleSlotClick(slide.day, e)}
                      >
                        <TimeSlotDividers keyPrefix={slide.key} />
                        {slide.events.map((event) => (
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
                        {showIndicator && (
                          <div
                            className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
                            style={{ top: `${currentTimePosition}px` }}
                          >
                            <div className="w-2.5 h-2.5 bg-red-500 rounded-full -ml-1" />
                            <div className="flex-1 h-0.5 bg-red-500" />
                          </div>
                        )}
                      </div>
                    </CarouselItem>
                  );
                })}
              </CarouselContent>
            </Carousel>
          </div>
        </div>
      </div>
    </div>
  );
}
