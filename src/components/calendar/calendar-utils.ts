import type { Locale } from 'date-fns';
import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  getHours,
  getMinutes,
  isSameDay,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from 'date-fns';

import type { CalendarEvent, CalendarGroupBy, CalendarView } from './calendar-types';
import { HOUR_SLOT_HEIGHT } from './calendar-constants';

// ---------------------------------------------------------------------------
// Date range computation
// ---------------------------------------------------------------------------

export function computeDateRange(
  currentDate: Date,
  view: CalendarView
): { start: Date; end: Date } | null {
  switch (view) {
    case 'day':
      return { start: startOfDay(currentDate), end: endOfDay(currentDate) };
    case '2-day':
      return { start: startOfDay(currentDate), end: endOfDay(addDays(currentDate, 1)) };
    case '3-day':
      return { start: startOfDay(currentDate), end: endOfDay(addDays(currentDate, 2)) };
    case 'week':
      return {
        start: startOfWeek(currentDate, { weekStartsOn: 1 }),
        end: endOfWeek(currentDate, { weekStartsOn: 1 }),
      };
    case 'month':
      return { start: startOfMonth(currentDate), end: endOfMonth(currentDate) };
    case 'year':
      return { start: startOfYear(currentDate), end: endOfYear(currentDate) };
    case 'schedule':
      return { start: startOfMonth(currentDate), end: endOfMonth(currentDate) };
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Navigation helpers
// ---------------------------------------------------------------------------

export function navigateDate(
  currentDate: Date,
  view: CalendarView,
  direction: 1 | -1
): Date {
  const delta = direction;
  switch (view) {
    case 'day': return addDays(currentDate, delta);
    case '2-day': return addDays(currentDate, 2 * delta);
    case '3-day': return addDays(currentDate, 3 * delta);
    case 'week': return addWeeks(currentDate, delta);
    case 'year': return addYears(currentDate, delta);
    case 'month':
    case 'schedule':
    default: return addMonths(currentDate, delta);
  }
}

export function computeHeaderTitle(
  currentDate: Date,
  view: CalendarView,
  dateLocale: Locale
): string {
  const start = view === 'week' ? startOfWeek(currentDate, { weekStartsOn: 1 }) : currentDate;
  switch (view) {
    case 'day':
      return format(currentDate, 'MMMM d, yyyy', { locale: dateLocale });
    case '2-day':
      return `${format(start, 'MMMM d', { locale: dateLocale })} - ${format(addDays(start, 1), 'd, yyyy', { locale: dateLocale })}`;
    case '3-day':
      return `${format(start, 'MMMM d', { locale: dateLocale })} - ${format(addDays(start, 2), 'd, yyyy', { locale: dateLocale })}`;
    case 'week': {
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      return `${format(start, 'MMMM d', { locale: dateLocale })} - ${format(end, 'd, yyyy', { locale: dateLocale })}`;
    }
    case 'year':
      return format(currentDate, 'yyyy', { locale: dateLocale });
    case 'month':
    case 'schedule':
    default:
      return format(currentDate, 'MMMM yyyy', { locale: dateLocale });
  }
}

// ---------------------------------------------------------------------------
// Event time formatting
// ---------------------------------------------------------------------------

export function formatEventTime(value: Date | string, dateLocale: Locale): string {
  const dateValue = typeof value === 'string' ? parseISO(value) : value;
  return format(dateValue, 'p', { locale: dateLocale });
}

// ---------------------------------------------------------------------------
// Event positioning in time grid
// ---------------------------------------------------------------------------

export function getEventStyle(event: CalendarEvent): React.CSSProperties {
  const start = typeof event.start === 'string' ? parseISO(event.start) : event.start;
  const end = typeof event.end === 'string' ? parseISO(event.end) : event.end;
  const top = (getHours(start) + getMinutes(start) / 60) * HOUR_SLOT_HEIGHT;
  const duration = (end.getTime() - start.getTime()) / (1000 * 60);
  return {
    top: `${top}px`,
    height: `${duration}px`,
    backgroundColor: event.color || 'hsl(var(--primary))',
  };
}

// ---------------------------------------------------------------------------
// Event group value
// ---------------------------------------------------------------------------

export function getEventGroupValue(
  event: CalendarEvent,
  groupBy: CalendarGroupBy
): string | undefined {
  if (groupBy === 'doctor') return event.doctorGroupId;
  if (groupBy === 'calendar') return event.calendarGroupId;
  return undefined;
}

// ---------------------------------------------------------------------------
// Event overlap layout algorithm
// ---------------------------------------------------------------------------

export function getEventsWithLayout(dayEvents: CalendarEvent[]): CalendarEvent[] {
  if (dayEvents.length === 0) return [];

  const sortedEvents = [...dayEvents].sort((a, b) => {
    const startA = (typeof a.start === 'string' ? parseISO(a.start) : a.start).getTime();
    const startB = (typeof b.start === 'string' ? parseISO(b.start) : b.start).getTime();
    if (startA !== startB) return startA - startB;
    const endA = (typeof a.end === 'string' ? parseISO(a.end) : a.end).getTime();
    const endB = (typeof b.end === 'string' ? parseISO(b.end) : b.end).getTime();
    return endA - endB;
  });

  const clusters: CalendarEvent[][] = [];
  let currentCluster: CalendarEvent[] = [];
  let clusterEnd = 0;

  sortedEvents.forEach((event) => {
    const start = (typeof event.start === 'string' ? parseISO(event.start) : event.start).getTime();
    const end = (typeof event.end === 'string' ? parseISO(event.end) : event.end).getTime();

    if (start >= clusterEnd) {
      if (currentCluster.length > 0) {
        clusters.push(currentCluster);
      }
      currentCluster = [event];
      clusterEnd = end;
    } else {
      currentCluster.push(event);
      clusterEnd = Math.max(clusterEnd, end);
    }
  });
  if (currentCluster.length > 0) {
    clusters.push(currentCluster);
  }

  const positionedEvents: CalendarEvent[] = [];

  clusters.forEach((cluster) => {
    const columns: CalendarEvent[][] = [];

    cluster.forEach((event) => {
      let placed = false;
      const eventStart = (typeof event.start === 'string' ? parseISO(event.start) : event.start).getTime();

      for (let i = 0; i < columns.length; i++) {
        const lastEventInColumn = columns[i][columns[i].length - 1];
        const lastEventEnd = (typeof lastEventInColumn.end === 'string'
          ? parseISO(lastEventInColumn.end)
          : lastEventInColumn.end
        ).getTime();

        if (eventStart >= lastEventEnd) {
          columns[i].push(event);
          event.column = i;
          placed = true;
          break;
        }
      }

      if (!placed) {
        event.column = columns.length;
        columns.push([event]);
      }
    });

    cluster.forEach((event) => {
      event.totalColumns = columns.length;
      positionedEvents.push(event);
    });
  });

  return positionedEvents;
}

// ---------------------------------------------------------------------------
// Filter events by day (and optionally by group)
// ---------------------------------------------------------------------------

export function filterEventsByDay(
  events: CalendarEvent[],
  day: Date
): CalendarEvent[] {
  return events.filter((event) => {
    const eventStart = typeof event.start === 'string' ? parseISO(event.start) : event.start;
    return isSameDay(eventStart, day);
  });
}

export function filterEventsByDayAndGroup(
  events: CalendarEvent[],
  day: Date,
  groupBy: CalendarGroupBy,
  groupValue: string
): CalendarEvent[] {
  return events.filter((event) => {
    const eventStart = typeof event.start === 'string' ? parseISO(event.start) : event.start;
    return isSameDay(eventStart, day) && getEventGroupValue(event, groupBy) === groupValue;
  });
}

// ---------------------------------------------------------------------------
// Time slots generation
// ---------------------------------------------------------------------------

export function generateTimeSlots(count = 24): string[] {
  return Array.from({ length: count }, (_, i) => `${i.toString().padStart(2, '0')}:00`);
}

// ---------------------------------------------------------------------------
// Format 24h slot label to 12h AM/PM
// ---------------------------------------------------------------------------

export function formatTimeSlotLabel(time: string): string {
  const hour24 = parseInt(time.split(':')[0], 10);
  const isPM = hour24 >= 12;
  const ampm = isPM ? 'PM' : 'AM';
  let hour12 = hour24 % 12;
  if (hour12 === 0) hour12 = 12;
  return `${hour12} ${ampm}`;
}
