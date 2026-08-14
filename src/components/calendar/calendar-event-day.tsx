'use client';

import React from 'react';
import { BellRing, CheckCircle2, FileText, Users } from 'lucide-react';

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { cn } from '@/lib/utils';

import type { Locale } from 'date-fns';
import { parseISO } from 'date-fns';

import { STATUS_ACCENT_COLOR } from '@/constants/appointment-status';
import type { AppointmentStatus, CalendarReminderPriority, CalendarReminderStatus, CancellationReason } from '@/lib/types';
import { getStatusIcon } from '@/components/appointments/status-icons';

import type { CalendarEvent } from './calendar-types';
import { formatEventTime, getReadableTextColor } from './calendar-utils';
import { getReminderCardStyle, getReminderPriorityColor, isGeneralReminder, isReminderDone } from './reminder-visuals';

interface CalendarEventDayProps {
  event: CalendarEvent;
  style: React.CSSProperties;
  dateLocale: Locale;
  onEventClick: (data: any) => void;
  /** @deprecated Color swatches are now rendered by the `onEventContextMenu` render prop. Kept for prop compatibility with the view components. */
  onEventColorChange?: (data: any, colorId: string) => void;
  onEventDoubleClick?: (data: any) => void;
  onEventContextMenu?: (data: any) => React.ReactNode;
  onEventContextMenuOpen?: (data: any) => void;
}

export const CalendarEventDay = React.memo(function CalendarEventDay({
  event,
  style,
  dateLocale,
  onEventClick,
  onEventDoubleClick,
  onEventContextMenu,
  onEventContextMenuOpen,
}: CalendarEventDayProps) {
  // Distinguish single vs double click: delay the single-click action briefly so a
  // double-click (inline edit) can cancel it. Only delays when a dbl handler exists.
  const clickTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => () => { if (clickTimer.current) clearTimeout(clickTimer.current); }, []);
  const start = typeof event.start === 'string' ? parseISO(event.start) : event.start;
  const end = typeof event.end === 'string' ? parseISO(event.end) : event.end;
  const durationMinutes = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60));
  const isShortEvent = durationMinutes < 60;
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
  const textColor = isReminder ? undefined : showCancelledStripes ? undefined : getReadableTextColor(event.color);
  const reminderCardStyle = isReminder ? getReminderCardStyle(event.color, reminderIsDone) : {};

  return (
    <ContextMenu onOpenChange={(o) => { if (o) onEventContextMenuOpen?.(event.data); }}>
      <ContextMenuTrigger asChild>
        <div
          data-testid="calendar-day-event"
          title={event.label ?? event.title}
          className={cn(
            'event-in-day-view',
            isShortEvent && 'event-in-day-view-compact',
            showCancelledStripes && 'event-cancelled',
            isReminder && 'event-reminder',
            reminderIsDone && 'event-reminder-done',
          )}
          style={{
            ...style,
            ...reminderCardStyle,
            color: textColor,
            left: `${((event.column || 0) / (event.totalColumns || 1)) * 100}%`,
            width: `${(1 / (event.totalColumns || 1)) * 100}%`,
            paddingRight: '4px',
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.stopPropagation()}
          onClick={(e) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            if (!onEventDoubleClick) { onEventClick(event.data); return; }
            if (e.detail > 1) return; // part of a double-click; ignore
            if (clickTimer.current) clearTimeout(clickTimer.current);
            clickTimer.current = setTimeout(() => onEventClick(event.data), 220);
          }}
          onDoubleClick={(e) => {
            if (!onEventDoubleClick) return;
            e.stopPropagation();
            if (clickTimer.current) { clearTimeout(clickTimer.current); clickTimer.current = null; }
            onEventDoubleClick(event.data);
          }}
        >
          {event.label ? (
            <span className="event-day-title">{event.label}</span>
          ) : (
            <>
              <span className="event-day-title">{event.title}</span>
              <span className="event-day-time whitespace-nowrap">
                {isShortEvent
                  ? `, ${formatEventTime(event.start, dateLocale)} - ${formatEventTime(event.end, dateLocale)}`
                  : `${formatEventTime(event.start, dateLocale)} - ${formatEventTime(event.end, dateLocale)}`}
              </span>
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
