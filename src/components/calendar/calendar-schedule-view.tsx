'use client';

import type { Locale } from 'date-fns';
import { format, parseISO } from 'date-fns';
import { BellRing, CheckCircle2, Clock, Stethoscope, FileText } from 'lucide-react';

import { getStatusIcon } from '@/components/appointments/status-icons';
import { STATUS_ACCENT_COLOR } from '@/constants/appointment-status';
import { cn } from '@/lib/utils';
import type { AppointmentStatus, CalendarReminderPriority, CalendarReminderStatus, CancellationReason } from '@/lib/types';

import type { CalendarBreakpoint, CalendarEvent } from './calendar-types';
import { formatEventTime } from './calendar-utils';
import { getReminderCardStyle, getReminderPriorityColor, isReminderDone } from './reminder-visuals';

function StatusBadge({
  status,
  cancellationReason,
}: {
  status: AppointmentStatus;
  cancellationReason?: CancellationReason | null;
}) {
  const Icon = getStatusIcon(status, cancellationReason);
  const color = STATUS_ACCENT_COLOR[status];
  if (!Icon || !color) return null;
  const label = status === 'cancelled' && cancellationReason ? `${status} – ${cancellationReason}` : status;
  return (
    <span
      aria-hidden
      title={label}
      className="inline-flex items-center justify-center rounded-full p-1 text-white shrink-0"
      style={{ backgroundColor: color }}
    >
      <Icon className="h-3 w-3" strokeWidth={2.5} />
    </span>
  );
}

interface CalendarScheduleViewProps {
  events: CalendarEvent[];
  dateLocale: Locale;
  breakpoint?: CalendarBreakpoint;
  onEventClick: (data: any) => void;
}

export function CalendarScheduleView({
  events,
  dateLocale,
  breakpoint = 'desktop',
  onEventClick,
}: CalendarScheduleViewProps) {
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

  Object.values(groupedEvents).forEach((list) => {
    list.sort((a, b) => {
      const startA = (typeof a.start === 'string' ? parseISO(a.start) : a.start).getTime();
      const startB = (typeof b.start === 'string' ? parseISO(b.start) : b.start).getTime();
      return startA - startB;
    });
  });

  const sortedDates = Object.keys(groupedEvents).sort();
  const isMobile = breakpoint === 'mobile';

  return (
    <div className="overflow-y-auto p-4">
      {sortedDates.map((date) => (
        <div key={date} className="mb-4">
          <h3 className="font-bold text-lg mb-2">
            {format(parseISO(date), 'EEEE, MMMM d, yyyy', { locale: dateLocale })}
          </h3>
          <div className="space-y-2">
            {groupedEvents[date].map((event) => {
              const rawStatus = event.data?.status as string | undefined;
              const isReminder = event.data?.kind === 'reminder';
              const reminderStatus = event.data?.status as CalendarReminderStatus | undefined;
              const reminderPriority = event.data?.priority as CalendarReminderPriority | undefined;
              const reminderIsDone = isReminderDone(reminderStatus);
              const reminderColor = getReminderPriorityColor(reminderPriority);
              const reminderCardStyle = isReminder ? getReminderCardStyle(event.color, reminderIsDone) : {};
              const ReminderIcon = reminderIsDone ? CheckCircle2 : BellRing;
              const status = (rawStatus?.toLowerCase() as AppointmentStatus | undefined) ?? undefined;
              const cancellationReason = (event.data?.cancellation_reason as CancellationReason | undefined) ?? null;
              return (
              <div
                key={event.id}
                data-testid="calendar-schedule-event"
                className={cn(
                  'p-2 rounded-md cursor-pointer',
                  isReminder && 'border border-dashed border-[var(--reminder-border)] bg-[var(--reminder-bg)]',
                  reminderIsDone && 'border-solid border-slate-200 opacity-80',
                )}
                style={isReminder ? reminderCardStyle : { backgroundColor: event.color ? `${event.color}20` : 'var(--muted)' }}
                onClick={(e) => {
                  if (e.button !== 0) return;
                  onEventClick(event.data);
                }}
              >
                {isMobile ? (
                  /* Mobile: stacked single-column layout */
                  <div className="flex items-start gap-2.5">
                    <div
                      className="w-1 self-stretch rounded-full shrink-0 mt-0.5"
                      style={{ backgroundColor: isReminder ? reminderColor : event.color || 'hsl(var(--primary))' }}
                    />
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5 text-sm font-semibold">
                        <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className={cn('truncate flex-1', reminderIsDone && 'text-muted-foreground line-through')}>
                          {event.title}
                        </span>
                        {isReminder ? (
                          <span
                            aria-hidden
                            className="inline-flex items-center justify-center rounded-full p-1 text-white shrink-0"
                            style={{ backgroundColor: reminderColor }}
                          >
                            <ReminderIcon className="h-3 w-3" strokeWidth={2.5} />
                          </span>
                        ) : status && <StatusBadge status={status} cancellationReason={cancellationReason} />}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
                        <Clock className="h-3 w-3 shrink-0" />
                        {formatEventTime(event.start, dateLocale)}
                      </div>
                      {event.data?.doctorName && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
                          <Stethoscope className="h-3 w-3 shrink-0" />
                          <span className="truncate">{event.data.doctorName}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Desktop/Tablet: horizontal 3-column layout — status badge first */
                  <div className="flex items-center gap-4">
                    {isReminder ? (
                      <span
                        aria-hidden
                        className="inline-flex items-center justify-center rounded-full p-1 text-white shrink-0"
                        style={{ backgroundColor: reminderColor }}
                      >
                        <ReminderIcon className="h-3 w-3" strokeWidth={2.5} />
                      </span>
                    ) : status && <StatusBadge status={status} cancellationReason={cancellationReason} />}
                    <div className="flex items-center gap-2 w-28 text-sm font-semibold">
                      <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <div
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: event.color || 'hsl(var(--primary))' }}
                      />
                      {formatEventTime(event.start, dateLocale)}
                    </div>
                    <div className="flex items-center gap-1.5 flex-1 text-sm min-w-0">
                      <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className={cn('truncate', reminderIsDone && 'text-muted-foreground line-through')}>
                        {event.title}
                      </span>
                    </div>
                    {event.data?.doctorName && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Stethoscope className="h-3.5 w-3.5 shrink-0" />
                        <span>{event.data.doctorName}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
