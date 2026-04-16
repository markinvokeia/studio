'use client';

import React from 'react';

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';

import type { Locale } from 'date-fns';

import { GOOGLE_CALENDAR_COLORS } from './calendar-constants';
import type { CalendarEvent } from './calendar-types';
import { formatEventTime } from './calendar-utils';

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
  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div
          className="event"
          style={{ backgroundColor: event.color || 'hsl(var(--primary))' }}
          onClick={(e) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            onEventClick(event.data);
          }}
        >
          <span className="mr-2" style={{ backgroundColor: event.color }}>&nbsp;</span>
          <span className="event-time">{formatEventTime(event.start, dateLocale)}</span>
          <span className="event-title">{event.title}</span>
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
