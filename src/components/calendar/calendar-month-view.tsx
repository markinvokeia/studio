'use client';

import { cn } from '@/lib/utils';

import type { Locale } from 'date-fns';
import { addDays, format, getDaysInMonth, isSameDay, parseISO, startOfWeek } from 'date-fns';

import { Skeleton } from '@/components/ui/skeleton';

import type { CalendarEvent, CalendarSlotClickHandler } from './calendar-types';
import { CalendarEventChip } from './calendar-event';
import { type Gap, gapKey } from './calendar-gaps';

interface CalendarMonthViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  dateLocale: Locale;
  isLoading?: boolean;
  onEventClick: (data: any) => void;
  onEventColorChange: (data: any, colorId: string) => void;
  onEventContextMenu?: (data: any) => React.ReactNode;
  onEventContextMenuOpen?: (data: any) => void;
  onSlotClick?: CalendarSlotClickHandler;
  gaps?: Gap[];
  selectedGapKey?: string;
  onGapClick?: (gap: Gap) => void;
  blockedFullDays?: Set<string>;
}

export function CalendarMonthView({
  currentDate,
  events,
  dateLocale,
  isLoading = false,
  onEventClick,
  onEventColorChange,
  onEventContextMenu,
  onEventContextMenuOpen,
  onSlotClick,
  gaps,
  selectedGapKey,
  onGapClick,
  blockedFullDays,
}: CalendarMonthViewProps) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayOfWeek = 1; // Monday
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const dayOffset = (firstDayOfMonth - firstDayOfWeek + 7) % 7;
  const daysInMonth = getDaysInMonth(currentDate);

  const dayNames = Array.from({ length: 7 }, (_, i) =>
    format(addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), i), 'EEE', { locale: dateLocale })
  );

  const renderDays = () => {
    const dayElements = [];

    for (let i = 0; i < dayOffset; i++) {
      dayElements.push(<div key={`empty-prev-${i}`} className="calendar-day other-month" />);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dayEvents = events
        .filter((e) => {
          if (!e.start) return false;
          try {
            return isSameDay(typeof e.start === 'string' ? parseISO(e.start) : e.start, date);
          } catch {
            return false;
          }
        })
        .sort((a, b) => {
          const startA = (typeof a.start === 'string' ? parseISO(a.start) : a.start).getTime();
          const startB = (typeof b.start === 'string' ? parseISO(b.start) : b.start).getTime();
          return startA - startB;
        });

      const dayKey = format(date, 'yyyy-MM-dd');
      const maxGap = gaps?.find((g) => g.dayKey === dayKey && g.isMax);
      const isBlocked = blockedFullDays?.has(dayKey) ?? false;

      dayElements.push(
        <div
          key={day}
          className={cn('calendar-day', isBlocked && 'calendar-day--blocked')}
          onClick={(e) => {
            if (e.button !== 0) return;
            // Ignore synthetic clicks that bubbled from portalled children.
            if (!e.currentTarget.contains(e.target as Node)) return;
            if (isBlocked) return; // closed day — not bookable
            if (onSlotClick) {
              e.stopPropagation();
              onSlotClick(date);
            }
          }}
        >
          <span
            className={cn(
              'font-semibold w-6 h-6 flex items-center justify-center rounded-full',
              isSameDay(date, new Date()) && 'current-day-month-view'
            )}
          >
            {day}
          </span>
          {maxGap && (
            <button
              type="button"
              className={cn('calendar-gap-badge', selectedGapKey === gapKey(maxGap) && 'calendar-gap-badge--selected')}
              onClick={(e) => { e.stopPropagation(); onGapClick?.(maxGap); }}
              title={`${format(maxGap.start, 'HH:mm')} – ${format(maxGap.end, 'HH:mm')}`}
            >
              {format(maxGap.start, 'HH:mm')}–{format(maxGap.end, 'HH:mm')}
            </button>
          )}
          <div className="mt-1 space-y-1">
            {dayEvents.map((event, index) => (
              <CalendarEventChip
                key={`${event.id}-${index}`}
                event={event}
                dateLocale={dateLocale}
                onEventClick={onEventClick}
                onEventColorChange={onEventColorChange}
                onEventContextMenu={onEventContextMenu}
                onEventContextMenuOpen={onEventContextMenuOpen}
              />
            ))}
          </div>
        </div>
      );
    }

    const totalCells = dayElements.length > 35 ? 42 : 35;
    while (dayElements.length < totalCells) {
      dayElements.push(<div key={`empty-next-${dayElements.length}`} className="calendar-day other-month" />);
    }

    return dayElements;
  };

  if (isLoading) {
    const skeletonDays = Array.from({ length: 42 }).map((_, i) => (
      <div key={`skel-${i}`} className="calendar-day">
        <Skeleton className="h-4 w-6 mb-2" />
        <Skeleton className="h-5 w-full mt-2" />
        <Skeleton className="h-5 w-full mt-1" />
      </div>
    ));
    return (
      <>
        <div className="calendar-day-name-grid">
          {dayNames.map((name) => <div key={name}>{name}</div>)}
        </div>
        <div className="calendar-grid month-view">{skeletonDays}</div>
      </>
    );
  }

  return (
    <>
      <div className="calendar-day-name-grid">
        {dayNames.map((name) => <div key={name}>{name}</div>)}
      </div>
      <div className="calendar-grid month-view">{renderDays()}</div>
    </>
  );
}
