'use client';

import React from 'react';
import { BellRing, CheckCircle2, FileText, Users } from 'lucide-react';

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

import type { CalendarEvent } from './calendar-types';
import { formatEventTime, getReadableTextColor } from './calendar-utils';
import { getReminderCardStyle, getReminderPriorityColor, isGeneralReminder, isReminderDone } from './reminder-visuals';

interface CalendarEventChipProps {
  event: CalendarEvent;
  dateLocale: Locale;
  onEventClick: (data: any) => void;
  /** @deprecated Color swatches are now rendered by the `onEventContextMenu` render prop. Kept for prop compatibility with the view components. */
  onEventColorChange?: (data: any, colorId: string) => void;
  onEventContextMenu?: (data: any) => React.ReactNode;
  onEventContextMenuOpen?: (data: any) => void;
}

export const CalendarEventChip = React.memo(function CalendarEventChip({
  event,
  dateLocale,
  onEventClick,
  onEventContextMenu,
  onEventContextMenuOpen,
}: CalendarEventChipProps) {
  const rawStatus = event.data?.status as string | undefined;
  const isReminder = event.data?.kind === 'reminder';
  const isNote = isReminder && event.data?.type === 'note';
  const reminderStatus = event.data?.status as CalendarReminderStatus | undefined;
  const reminderPriority = event.data?.priority as CalendarReminderPriority | undefined;
  const reminderIsDone = isReminderDone(reminderStatus);
  const reminderIsGeneral = isReminder && isGeneralReminder(event.data);
  const ReminderIcon = isNote ? FileText : reminderIsDone ? CheckCircle2 : reminderIsGeneral ? Users : BellRing;
  const status = (rawStatus?.toLowerCase() as AppointmentStatus | undefined) ?? undefined;
  const cancellationReason = (event.data?.cancellation_reason as CancellationReason | undefined) ?? null;
  const isCancelled = status === 'cancelled';
  const statusColored = event.statusColored === true;
  // Con la card ya pintada del gris de "cancelada" el rayado sobra: se muestra
  // solo cuando el color viene del calendario/servicio y no del estado.
  const showCancelledStripes = isCancelled && !statusColored;
  const accentColor = isReminder ? getReminderPriorityColor(reminderPriority) : status ? STATUS_ACCENT_COLOR[status] : undefined;

  const bg = event.color || 'hsl(var(--primary))';
  const textColor = isReminder ? undefined : showCancelledStripes ? undefined : getReadableTextColor(event.color);
  const eventStyle = isReminder
    ? getReminderCardStyle(event.color, reminderIsDone)
    : { backgroundColor: showCancelledStripes ? undefined : bg, color: textColor };

  return (
    <ContextMenu onOpenChange={(o) => { if (o) onEventContextMenuOpen?.(event.data); }}>
      <ContextMenuTrigger asChild>
        <div
          data-testid="calendar-event"
          title={event.label ?? event.title}
          className={cn(
            'event',
            showCancelledStripes && 'event-cancelled',
            isReminder && 'event-reminder',
            reminderIsDone && 'event-reminder-done',
          )}
          style={eventStyle}
          onContextMenu={(e) => e.stopPropagation()}
          onClick={(e) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            onEventClick(event.data);
          }}
        >
          {event.label ? (
            <span className="event-title">{event.label}</span>
          ) : (
            <>
              <span className="event-time">{formatEventTime(event.start, dateLocale)}</span>
              <span className="event-title">{event.title}</span>
            </>
          )}
          {isReminder && (
            <span
              aria-hidden
              className="event-status-corner"
              title={event.title}
              style={{ backgroundColor: accentColor }}
            >
              <ReminderIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
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
                // Sobre una card ya pintada con el color del estado el círculo
                // desaparece, así que se invierte: fondo claro, ícono del color.
                style={statusColored
                  ? { backgroundColor: 'rgba(255,255,255,0.92)', color: accentColor }
                  : { backgroundColor: accentColor }}
              >
                <StatusIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
              </span>
            );
          })()}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-[min(18rem,calc(100vw-1rem))]">
        {/* The whole menu body (including color swatches) is supplied by the
            consumer's render prop so it can place the color picker inline or in
            a submenu depending on the calendar mode. */}
        {onEventContextMenu && onEventContextMenu(event.data)}
      </ContextMenuContent>
    </ContextMenu>
  );
});
