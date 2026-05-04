'use client';

import React from 'react';
import { cn } from '@/lib/utils';

import type { Locale } from 'date-fns';
import { addDays, format, isSameDay, isToday, set, startOfWeek } from 'date-fns';

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/ui/carousel';

import { DEFAULT_SCROLL_HOUR, HOUR_SLOT_HEIGHT } from './calendar-constants';
import type { CalendarEvent, CalendarGroupBy, CalendarGroupingColumn, CalendarSlotClickHandler, CalendarView } from './calendar-types';
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
  onSlotClick?: CalendarSlotClickHandler;
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

  // Build slides: if grouped, one slide per (day × resource); if not, one slide per day
  const slides = React.useMemo(() => {
    if (isGrouped) {
      return days.flatMap((day) =>
        groupingColumns.map((col) => ({
          key: `${format(day, 'yyyy-MM-dd')}-${col.id}`,
          day,
          column: col,
          label: days.length > 1
            ? `${format(day, 'EEE d', { locale: dateLocale })} · ${col.label}`
            : col.label,
          color: col.color,
          events: getEventsWithLayout(filterEventsByDayAndGroup(events, day, groupBy, col.value)),
        }))
      );
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

  const timeGridScrollRef = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    if (timeGridScrollRef.current) {
      timeGridScrollRef.current.scrollTop = DEFAULT_SCROLL_HOUR * HOUR_SLOT_HEIGHT;
    }
  }, []);

  React.useEffect(() => {
    if (!api) return;
    const onSelect = () => setActiveIndex(api.selectedScrollSnap());
    api.on('select', onSelect);
    return () => { api.off('select', onSelect); };
  }, [api]);

  const handleSlotClick = (day: Date, column: CalendarGroupingColumn | null, e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if (onSlotClick) {
      const rect = e.currentTarget.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const hour = Math.floor(y / 60);
      const minute = Math.floor((y % 60) / 15) * 15;
      const clickedDate = set(day, { hours: hour, minutes: minute, seconds: 0, milliseconds: 0 });
      const context = column && groupBy !== 'none' ? { groupBy, value: column.value } : undefined;
      onSlotClick(clickedDate, context);
    }
  };

  const activeSlide = slides[activeIndex];
  const isMultiDayGrouped = isGrouped && days.length > 1;

  const scrollToSlide = (day: Date, colId: string | null) => {
    const idx = slides.findIndex((s) =>
      isSameDay(s.day, day) && (colId === null || s.column?.id === colId)
    );
    if (idx >= 0) api?.scrollTo(idx);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Two-row indicator when grouped across multiple days: days + resources */}
      {isMultiDayGrouped && (
        <div className="border-b border-border bg-card shrink-0">
          {/* Day row */}
          <div className="flex items-center justify-center gap-1 py-1.5 px-2">
            {days.map((day) => {
              const isActiveDay = activeSlide && isSameDay(activeSlide.day, day);
              const isDayToday = isToday(day);
              return (
                <button
                  key={format(day, 'yyyy-MM-dd')}
                  className={cn(
                    'flex flex-col items-center px-2 py-1 gap-0 flex-1 min-w-0 rounded-lg transition-colors',
                    isActiveDay
                      ? 'bg-primary text-primary-foreground'
                      : isDayToday
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground',
                  )}
                  onClick={() => scrollToSlide(day, activeSlide?.column?.id ?? groupingColumns[0]?.id ?? null)}
                >
                  <span className="text-[10px] font-medium uppercase leading-tight">
                    {format(day, 'EEEEE', { locale: dateLocale })}
                  </span>
                  <span className={cn('text-sm font-bold leading-tight', isActiveDay && 'text-primary-foreground')}>
                    {format(day, 'd')}
                  </span>
                </button>
              );
            })}
          </div>
          {/* Resource row (for the active day) */}
          <div className="flex items-center gap-1 py-1.5 px-2 overflow-x-auto border-t border-border/50">
            {groupingColumns.map((col) => {
              const isActiveCol = activeSlide?.column?.id === col.id;
              return (
                <button
                  key={col.id}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium shrink-0 transition-colors',
                    isActiveCol
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground',
                  )}
                  onClick={() => activeSlide && scrollToSlide(activeSlide.day, col.id)}
                >
                  {col.color && (
                    <span
                      className="inline-block w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: col.color }}
                    />
                  )}
                  <span className="truncate max-w-[120px]">{col.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Single-row indicator: non-grouped multi-day OR grouped single-day */}
      {!isMultiDayGrouped && slides.length > 1 && (
        <div
          className={cn(
            'flex items-center gap-1 py-2 border-b border-border bg-card shrink-0 px-2',
            isGrouped ? 'justify-start overflow-x-auto' : 'justify-center'
          )}
        >
          {slides.map((slide, i) => {
            const isActive = i === activeIndex;
            const isDayToday = isToday(slide.day);
            // Compact mode for many slides (week view with 7 days) - only for non-grouped views
            const compact = slides.length > 4 && !isGrouped;

            return (
              <button
                key={slide.key}
                className={cn(
                  'flex flex-col items-center transition-colors rounded-lg',
                  compact ? 'px-2 py-1 gap-0 flex-1 min-w-0' : 'px-2.5 py-1 gap-0.5',
                  isGrouped && 'shrink-0',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : isDayToday
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground',
                )}
                onClick={() => api?.scrollTo(i)}
              >
                {compact ? (
                  <>
                    <span className="text-[10px] font-medium uppercase leading-tight">
                      {format(slide.day, 'EEEEE', { locale: dateLocale })}
                    </span>
                    <span className={cn('text-sm font-bold leading-tight', isActive && 'text-primary-foreground')}>
                      {format(slide.day, 'd')}
                    </span>
                  </>
                ) : (
                  <span className="flex items-center gap-1.5 text-xs font-medium">
                    {slide.color && (
                      <span
                        className="inline-block w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: slide.color }}
                      />
                    )}
                    <span className="truncate max-w-[80px]">{slide.label}</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Scrollable time grid with carousel */}
      <div className="flex-1 overflow-y-auto" ref={timeGridScrollRef}>
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
                        onClick={(e) => handleSlotClick(slide.day, slide.column, e)}
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
