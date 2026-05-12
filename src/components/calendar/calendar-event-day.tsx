'use client';

import React from 'react';

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { cn } from '@/lib/utils';

import type { Locale } from 'date-fns';
import { parseISO } from 'date-fns';

import { STATUS_ACCENT_COLOR } from '@/constants/appointment-status';
import type { AppointmentStatus } from '@/lib/types';
import { STATUS_ICONS } from '@/components/appointments/status-icons';

import { GOOGLE_CALENDAR_COLORS } from './calendar-constants';
import type { CalendarEvent } from './calendar-types';
import { formatEventTime, getReadableTextColor } from './calendar-utils';

interface CalendarEventDayProps {
  event: CalendarEvent;
  style: React.CSSProperties;
  dateLocale: Locale;
  onEventClick: (data: any) => void;
  onEventColorChange: (data: any, colorId: string) => void;
  onEventContextMenu?: (data: any) => React.ReactNode;
}

export const CalendarEventDay = React.memo(function CalendarEventDay({
  event,
  style,
  dateLocale,
  onEventClick,
  onEventColorChange,
  onEventContextMenu,
}: CalendarEventDayProps) {
  const start = typeof event.start === 'string' ? parseISO(event.start) : event.start;
  const end = typeof event.end === 'string' ? parseISO(event.end) : event.end;
  const durationMinutes = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60));
  const isShortEvent = durationMinutes < 60;
  const rawStatus = event.data?.status as string | undefined;
  const status = (rawStatus?.toLowerCase() as AppointmentStatus | undefined) ?? undefined;
  const isCancelled = status === 'cancelled';
  const accentColor = status ? STATUS_ACCENT_COLOR[status] : undefined;
  const textColor = isCancelled ? undefined : getReadableTextColor(event.color);

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div
          data-testid="calendar-day-event"
          className={cn(
            'event-in-day-view',
            isShortEvent && 'event-in-day-view-compact',
            isCancelled && 'event-cancelled',
          )}
          style={{
            ...style,
            color: textColor,
            left: `${((event.column || 0) / (event.totalColumns || 1)) * 100}%`,
            width: `${(1 / (event.totalColumns || 1)) * 100}%`,
            paddingRight: '4px',
          }}
          onClick={(e) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            onEventClick(event.data);
          }}
        >
          {accentColor && !isCancelled && (
            <span className="event-status-accent" style={{ backgroundColor: accentColor }} />
          )}
          <span className="event-day-title">{event.title}</span>
          <span className="event-day-time whitespace-nowrap">
            {isShortEvent
              ? `, ${formatEventTime(event.start, dateLocale)} - ${formatEventTime(event.end, dateLocale)}`
              : `${formatEventTime(event.start, dateLocale)} - ${formatEventTime(event.end, dateLocale)}`}
          </span>
          {status && accentColor && (() => {
            const StatusIcon = STATUS_ICONS[status];
            if (!StatusIcon) return null;
            return (
              <span
                aria-hidden
                className="event-status-corner"
                title={status}
                style={{ backgroundColor: accentColor }}
              >
                <StatusIcon className="h-3 w-3" strokeWidth={2.5} />
              </span>
            );
          })()}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <div className="grid grid-cols-4 gap-2 p-2">
          {GOOGLE_CALENDAR_COLORS.map((color) => (
            <div
              key={color.id}
              className="w-6 h-6 rounded-full cursor-pointer hover:opacity-80"
              style={{ backgroundColor: color.hex }}
              onClick={(e) => {
                e.stopPropagation();
                onEventColorChange(event.data, color.id);
              }}
            />
          ))}
        </div>
        {onEventContextMenu && onEventContextMenu(event.data)}
      </ContextMenuContent>
    </ContextMenu>
  );
});
