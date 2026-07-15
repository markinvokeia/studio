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
  const viewStart = startOfDay(currentDate);

  switch (view) {
    case 'day':
      return { start: startOfDay(currentDate), end: endOfDay(currentDate) };
    case '2-day':
      return { start: viewStart, end: endOfDay(addDays(viewStart, 1)) };
    case '3-day':
      return { start: viewStart, end: endOfDay(addDays(viewStart, 2)) };
    case '4-day':
      return { start: viewStart, end: endOfDay(addDays(viewStart, 3)) };
    case '5-day':
      return { start: viewStart, end: endOfDay(addDays(viewStart, 4)) };
    case '6-day':
      return { start: viewStart, end: endOfDay(addDays(viewStart, 5)) };
    case 'week':
      return {
        start: getCalendarViewStartDate(currentDate, view),
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

const MULTI_DAY_VIEW_LENGTHS: Partial<Record<CalendarView, number>> = {
  '2-day': 2,
  '3-day': 3,
  '4-day': 4,
  '5-day': 5,
  '6-day': 6,
};

function getMultiDayBlockOffsets(numberOfDays: number): number[] {
  const offsets: number[] = [];

  for (let offset = 0; offset + numberOfDays <= 7; offset += numberOfDays) {
    offsets.push(offset);
  }

  const finalOffset = 7 - numberOfDays;
  if (offsets[offsets.length - 1] !== finalOffset) {
    offsets.push(finalOffset);
  }

  return offsets;
}

/**
 * Returns the first visible date for a calendar view.
 *
 * Multi-day views are split into blocks anchored to Monday. The final block is
 * shifted back when needed so it stays inside the same Monday-Sunday week.
 */
export function getCalendarViewStartDate(currentDate: Date, view: CalendarView): Date {
  if (view === 'week') {
    return startOfWeek(currentDate, { weekStartsOn: 1 });
  }

  const numberOfDays = MULTI_DAY_VIEW_LENGTHS[view];
  if (!numberOfDays) {
    return startOfDay(currentDate);
  }

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const dayOffset = currentDate.getDay() === 0 ? 6 : currentDate.getDay() - 1;
  const blockOffset = Math.min(
    Math.floor(dayOffset / numberOfDays) * numberOfDays,
    7 - numberOfDays
  );

  return addDays(weekStart, blockOffset);
}

export function navigateDate(
  currentDate: Date,
  view: CalendarView,
  direction: 1 | -1
): Date {
  const delta = direction;
  const viewStart = startOfDay(currentDate);
  const numberOfDays = MULTI_DAY_VIEW_LENGTHS[view];

  if (numberOfDays) {
    const weekStart = startOfWeek(viewStart, { weekStartsOn: 1 });
    const blockOffsets = getMultiDayBlockOffsets(numberOfDays);
    const currentOffset = viewStart.getDay() === 0 ? 6 : viewStart.getDay() - 1;
    const currentBlockIndex = blockOffsets.indexOf(currentOffset);
    const nextBlockIndex = currentBlockIndex + direction;

    if (nextBlockIndex < 0) {
      return addDays(addWeeks(weekStart, -1), blockOffsets[blockOffsets.length - 1]);
    }

    if (nextBlockIndex >= blockOffsets.length) {
      return addWeeks(weekStart, 1);
    }

    return addDays(weekStart, blockOffsets[nextBlockIndex]);
  }

  switch (view) {
    case 'day': return addDays(currentDate, delta);
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
  const start = view === 'week'
    ? getCalendarViewStartDate(currentDate, view)
    : currentDate;
  switch (view) {
    case 'day':
      return format(currentDate, 'MMMM d, yyyy', { locale: dateLocale });
    case '2-day':
      return `${format(start, 'MMMM d', { locale: dateLocale })} - ${format(addDays(start, 1), 'd, yyyy', { locale: dateLocale })}`;
    case '3-day':
      return `${format(start, 'MMMM d', { locale: dateLocale })} - ${format(addDays(start, 2), 'd, yyyy', { locale: dateLocale })}`;
    case '4-day':
      return `${format(start, 'MMMM d', { locale: dateLocale })} - ${format(addDays(start, 3), 'd, yyyy', { locale: dateLocale })}`;
    case '5-day':
      return `${format(start, 'MMMM d', { locale: dateLocale })} - ${format(addDays(start, 4), 'd, yyyy', { locale: dateLocale })}`;
    case '6-day':
      return `${format(start, 'MMMM d', { locale: dateLocale })} - ${format(addDays(start, 5), 'd, yyyy', { locale: dateLocale })}`;
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

export function getEventStyle(
  event: CalendarEvent,
  hourSlotHeight: number = HOUR_SLOT_HEIGHT
): React.CSSProperties {
  const start = typeof event.start === 'string' ? parseISO(event.start) : event.start;
  const end = typeof event.end === 'string' ? parseISO(event.end) : event.end;
  const top = (getHours(start) + getMinutes(start) / 60) * hourSlotHeight;
  const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
  const height = (durationMinutes / 60) * hourSlotHeight;
  return {
    top: `${top}px`,
    height: `${height}px`,
    backgroundColor: event.color || 'hsl(var(--primary))',
  };
}

/**
 * Returns a text color (`#111` or `#fff`) that contrasts well with the given
 * hex background. Uses the WCAG relative luminance formula. Falls back to
 * white when the input is not a parseable hex (e.g. `hsl(...)`).
 */
export function getReadableTextColor(bg?: string | null): string {
  if (!bg) return '#fff';
  const hex = bg.startsWith('#') ? bg.slice(1) : '';
  if (hex.length !== 6 && hex.length !== 8) return '#fff';
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return '#fff';
  // Perceived brightness (0–1). Threshold 0.6 picks dark text on light pastels.
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#111' : '#fff';
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

/**
 * Snap a vertical click offset (px from the top of the time grid) to the start of
 * the slot it falls in, based on the configured slot duration. With 10-min slots
 * (6 per hour) clicking the 13:00 hour yields 13:00/13:10/.../13:50; with 20-min
 * slots (3 per hour) it yields 13:00/13:20/13:40.
 */
export function slotTimeFromOffset(
  y: number,
  hourSlotHeight: number,
  slotMinutes = 15,
): { hour: number; minute: number } {
  const safeSlot = slotMinutes > 0 ? slotMinutes : 15;
  const slotsPerHour = Math.max(1, Math.round(60 / safeSlot));
  const hour = Math.floor(y / hourSlotHeight);
  const slotPx = hourSlotHeight / slotsPerHour;
  const idx = Math.max(0, Math.min(slotsPerHour - 1, Math.floor((y % hourSlotHeight) / slotPx)));
  return { hour, minute: idx * safeSlot };
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
