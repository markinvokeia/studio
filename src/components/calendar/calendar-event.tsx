'use client';

import React from 'react';

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';

import type { Locale } from 'date-fns';

import { STATUS_ACCENT_COLOR } from '@/constants/appointment-status';
import { cn } from '@/lib/utils';
import type { AppointmentStatus } from '@/lib/types';
import { STATUS_ICONS } from '@/components/appointments/status-icons';

import { GOOGLE_CALENDAR_COLORS } from './calendar-constants';
import type { CalendarEvent } from './calendar-types';
import { formatEventTime, getReadableTextColor } from './calendar-utils';

interface CalendarEventChipProps {
  event: CalendarEvent;
  dateLocale: Locale;
  onEventClick: (data: any) => void;
  onEventColorChange: (data: any, colorId: string) => void;
  onEventContextMenu?: (data: any) => React.ReactNode;
}

export const CalendarEventChip = React.memo(function CalendarEventChip({
  event,
  dateLocale,
  onEventClick,
  onEventColorChange,
  onEventContextMenu,
}: CalendarEventChipProps) {
  const rawStatus = event.data?.status as string | undefined;
  const status = (rawStatus?.toLowerCase() as AppointmentStatus | undefined) ?? undefined;
  const isCancelled = status === 'cancelled';
  const accentColor = status ? STATUS_ACCENT_COLOR[status] : undefined;

  const bg = event.color || 'hsl(var(--primary))';
  const textColor = isCancelled ? undefined : getReadableTextColor(event.color);

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div
          data-testid="calendar-event"
          className={cn('event', isCancelled && 'event-cancelled')}
          style={{ backgroundColor: isCancelled ? undefined : bg, color: textColor }}
          onClick={(e) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            onEventClick(event.data);
          }}
        >
          {accentColor && !isCancelled && (
            <span className="event-status-accent" style={{ backgroundColor: accentColor }} />
          )}
          <span className="event-time">{formatEventTime(event.start, dateLocale)}</span>
          <span className="event-title">{event.title}</span>
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
