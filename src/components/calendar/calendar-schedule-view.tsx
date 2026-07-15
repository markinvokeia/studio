'use client';

import React from 'react';

import type { Locale } from 'date-fns';
import { format, parseISO } from 'date-fns';
import { BellRing, CheckCircle2, Clock, Stethoscope, FileText } from 'lucide-react';

import { Checkbox } from '@/components/ui/checkbox';
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
  selectedAppointmentIds?: Set<string>;
  onToggleAppointmentSelect?: (id: string) => void;
}

export function CalendarScheduleView({
  events,
  dateLocale,
  breakpoint = 'desktop',
  onEventClick,
  selectedAppointmentIds,
  onToggleAppointmentSelect,
}: CalendarScheduleViewProps) {
  const isBulkMode = !!onToggleAppointmentSelect;
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

  // Auto-scroll so today (or the next upcoming day) sits at the top, instead of
  // always landing on the first day of the month. Re-runs when the set of dates
  // changes (mount, async data load, month navigation).
  const containerRef = React.useRef<HTMLDivElement>(null);
  const datesKey = sortedDates.join(',');
  React.useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const scrollToToday = () => {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const target = sortedDates.find((d) => d >= todayStr);
      if (!target) return;
      const el = container.querySelector<HTMLElement>(`[data-date="${target}"]`);
      if (!el) return;
      container.scrollTop += el.getBoundingClientRect().top - container.getBoundingClientRect().top;
    };
    scrollToToday();
    // Re-align after web fonts load, since text reflow can shift the target.
    document.fonts?.ready.then(scrollToToday).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datesKey]);

  return (
    <div ref={containerRef} className="overflow-y-auto p-4">
      {sortedDates.map((date) => (
        <div key={date} data-date={date} className="mb-4">
          <h3 className="font-bold text-lg mb-2">
            {format(parseISO(date), 'EEEE, MMMM d, yyyy', { locale: dateLocale })}
          </h3>
          <div className="space-y-2">
            {groupedEvents[date].map((event) => {
              const rawStatus = event.data?.status as string | undefined;
              const isReminder = event.data?.kind === 'reminder';
              const isNote = isReminder && event.data?.type === 'note';
              const reminderStatus = event.data?.status as CalendarReminderStatus | undefined;
              const reminderPriority = event.data?.priority as CalendarReminderPriority | undefined;
              const reminderIsDone = isReminderDone(reminderStatus);
              const reminderColor = getReminderPriorityColor(reminderPriority);
              const reminderCardStyle = isReminder ? getReminderCardStyle(event.color, reminderIsDone) : {};
              const ReminderIcon = isNote ? FileText : reminderIsDone ? CheckCircle2 : BellRing;
              const status = (rawStatus?.toLowerCase() as AppointmentStatus | undefined) ?? undefined;
              const cancellationReason = (event.data?.cancellation_reason as CancellationReason | undefined) ?? null;
              const appointmentId: string = event.data?.id ?? event.id;
              const isSelected = !isReminder && isBulkMode && (selectedAppointmentIds?.has(appointmentId) ?? false);
              return (
              <div
                key={event.id}
                title={event.label ?? event.title}
                data-testid="calendar-schedule-event"
                className={cn(
                  'relative group/card overflow-hidden p-2 rounded-md cursor-pointer transition-all duration-150',
                  isReminder && !isBulkMode && 'border border-dashed border-[var(--reminder-border)] bg-[var(--reminder-bg)]',
                  reminderIsDone && !isBulkMode && 'border-solid border-slate-200',
                  isBulkMode && isReminder && 'opacity-40 cursor-default pointer-events-none',
                  isBulkMode && !isReminder && isSelected && 'shadow-sm',
                )}
                style={
                  isReminder
                    ? (isBulkMode ? { backgroundColor: 'var(--muted)' } : reminderCardStyle)
                    : isSelected
                      ? { backgroundColor: event.color ? `${event.color}35` : 'hsl(var(--primary) / 0.13)' }
                      : { backgroundColor: event.color ? `${event.color}20` : 'var(--muted)' }
                }
                onClick={(e) => {
                  if (e.button !== 0) return;
                  if (isBulkMode && !isReminder) {
                    onToggleAppointmentSelect!(appointmentId);
                    return;
                  }
                  onEventClick(event.data);
                }}
              >
                {/* Accent bar — selection indicator */}
                {isBulkMode && !isReminder && (
                  <span
                    aria-hidden
                    className={cn(
                      'absolute left-0 top-0 bottom-0 w-[3px] rounded-l-md transition-[background-color] duration-150',
                      isSelected
                        ? 'bg-primary'
                        : 'bg-transparent group-hover/card:bg-primary/40',
                    )}
                  />
                )}
                {isMobile ? (
                  /* Mobile: stacked single-column layout */
                  <div className="flex items-start gap-2.5">
                    {isBulkMode && !isReminder && (
                      <Checkbox
                        checked={isSelected}
                        className={cn('mt-0.5 shrink-0 transition-transform duration-150', isSelected && 'scale-110')}
                        onCheckedChange={() => onToggleAppointmentSelect!(appointmentId)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                    <div
                      className="w-1 self-stretch rounded-full shrink-0 mt-0.5"
                      style={{ backgroundColor: isReminder ? reminderColor : event.color || 'hsl(var(--primary))' }}
                    />
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5 text-sm font-semibold">
                        <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className={cn('truncate flex-1', reminderIsDone && 'text-muted-foreground line-through')}>
                          {event.label ?? event.title}
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
                      {!event.label && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
                          <Clock className="h-3 w-3 shrink-0" />
                          {formatEventTime(event.start, dateLocale)}
                        </div>
                      )}
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
                    {isBulkMode && !isReminder && (
                      <Checkbox
                        checked={isSelected}
                        className={cn('transition-transform duration-150 shrink-0', isSelected && 'scale-110')}
                        onCheckedChange={() => onToggleAppointmentSelect!(appointmentId)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                    {isReminder ? (
                      <span
                        aria-hidden
                        className="inline-flex items-center justify-center rounded-full p-1 text-white shrink-0"
                        style={{ backgroundColor: reminderColor }}
                      >
                        <ReminderIcon className="h-3 w-3" strokeWidth={2.5} />
                      </span>
                    ) : status && <StatusBadge status={status} cancellationReason={cancellationReason} />}
                    {!event.label && (
                      <div className="flex items-center gap-2 w-28 text-sm font-semibold">
                        <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <div
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: event.color || 'hsl(var(--primary))' }}
                        />
                        {formatEventTime(event.start, dateLocale)}
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 flex-1 text-sm min-w-0">
                      {event.label && (
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: event.color || 'hsl(var(--primary))' }}
                        />
                      )}
                      <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className={cn('truncate', reminderIsDone && 'text-muted-foreground line-through')}>
                        {event.label ?? event.title}
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
