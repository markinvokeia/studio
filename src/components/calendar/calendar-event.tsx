'use client';

import React from 'react';
import { BellRing, CheckCircle2 } from 'lucide-react';

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';

import type { Locale } from 'date-fns';

import { STATUS_ACCENT_COLOR } from '@/constants/appointment-status';
import { cn } from '@/lib/utils';
import type { AppointmentStatus, CalendarReminderPriority, CalendarReminderStatus, CancellationReason } from '@/lib/types';
import { getStatusIcon } from '@/components/appointments/status-icons';

import { GOOGLE_CALENDAR_COLORS } from './calendar-constants';
import type { CalendarEvent } from './calendar-types';
import { formatEventTime, getReadableTextColor } from './calendar-utils';
import { getReminderCardStyle, getReminderPriorityColor, isReminderDone } from './reminder-visuals';

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
  const isReminder = event.data?.kind === 'reminder';
  const reminderStatus = event.data?.status as CalendarReminderStatus | undefined;
  const reminderPriority = event.data?.priority as CalendarReminderPriority | undefined;
  const reminderIsDone = isReminderDone(reminderStatus);
  const ReminderIcon = reminderIsDone ? CheckCircle2 : BellRing;
  const status = (rawStatus?.toLowerCase() as AppointmentStatus | undefined) ?? undefined;
  const cancellationReason = (event.data?.cancellation_reason as CancellationReason | undefined) ?? null;
  const isCancelled = status === 'cancelled';
  const accentColor = isReminder ? getReminderPriorityColor(reminderPriority) : status ? STATUS_ACCENT_COLOR[status] : undefined;

  const bg = event.color || 'hsl(var(--primary))';
  const textColor = isReminder ? undefined : isCancelled ? undefined : getReadableTextColor(event.color);
  const eventStyle = isReminder
    ? getReminderCardStyle(event.color, reminderIsDone)
    : { backgroundColor: isCancelled ? undefined : bg, color: textColor };

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div
          data-testid="calendar-event"
          className={cn(
            'event',
            isCancelled && 'event-cancelled',
            isReminder && 'event-reminder',
            reminderIsDone && 'event-reminder-done',
          )}
          style={eventStyle}
          onClick={(e) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            onEventClick(event.data);
          }}
        >
          <span className="event-time">{formatEventTime(event.start, dateLocale)}</span>
          <span className="event-title">{event.title}</span>
          {isReminder && (
            <span
              aria-hidden
              className="event-status-corner"
              title={event.title}
              style={{ backgroundColor: accentColor }}
            >
              <ReminderIcon className="h-3 w-3" strokeWidth={2.5} />
            </span>
          )}
          {!isReminder && status && accentColor && (() => {
            const StatusIcon = getStatusIcon(status, cancellationReason);
            if (!StatusIcon) return null;
            return (
              <span
                aria-hidden
                className="event-status-corner"
                title={cancellationReason ? `${status} - ${cancellationReason}` : status}
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
