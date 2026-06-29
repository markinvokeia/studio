import { format, parseISO } from 'date-fns';

import type { ClinicSchedule, ClinicException } from '@/lib/types';
import type { CalendarEvent } from './calendar-types';
import { filterEventsByDay } from './calendar-utils';

/** A free time slot (gap) between appointments within business hours. */
export interface Gap {
  /** `yyyy-MM-dd` of the day this gap belongs to. */
  dayKey: string;
  start: Date;
  end: Date;
  /** Duration in minutes. */
  minutes: number;
  /** True for the longest gap of its day/group (gets the emphasized animation). */
  isMax: boolean;
  /** When grouped (by doctor/calendar), the group/column value this gap belongs to. */
  groupValue?: string;
  /** Human-readable group label (e.g. the consultorio name), for the panel. */
  groupLabel?: string;
}

/** Default business window when the clinic has no schedule for a weekday. */
export const DEFAULT_BUSINESS_START_MIN = 9 * 60;  // 09:00
export const DEFAULT_BUSINESS_END_MIN = 19 * 60;   // 19:00
/** Minimum gap length to be considered useful. */
export const DEFAULT_MIN_GAP_MINUTES = 10;

/** Parses an `HH:mm[:ss]` time string into minutes from midnight. */
function timeToMinutes(value: string | undefined | null): number | null {
  if (!value) return null;
  const [h, m] = value.split(':');
  const hours = Number(h);
  const mins = Number(m ?? 0);
  if (!Number.isFinite(hours) || !Number.isFinite(mins)) return null;
  return hours * 60 + mins;
}

const stableUniqueDows = (schedules: ClinicSchedule[]): Set<number> =>
  new Set(schedules.map((s) => Number(s.day_of_week)));

/**
 * Business window (minutes from midnight) for a given day.
 *
 * Looks for a clinic schedule whose `day_of_week` matches the day. We try both
 * common conventions (JS `getDay()` Sun=0..Sat=6, and Mon=1..Sun=7) and pick
 * whichever the data uses. Falls back to 09:00–19:00 when none is defined.
 */
export function getBusinessWindow(
  day: Date,
  schedules: ClinicSchedule[],
): { startMin: number; endMin: number } {
  const jsDow = day.getDay();          // Sun=0..Sat=6
  const isoDow = jsDow === 0 ? 7 : jsDow; // Mon=1..Sun=7
  const dows = stableUniqueDows(schedules);
  // Decide which convention the dataset uses (Mon=1..Sun=7 has no 0).
  const usesIso = schedules.length > 0 && !dows.has(0);
  const target = usesIso ? isoDow : jsDow;

  const matches = schedules.filter((s) => Number(s.day_of_week) === target);
  if (matches.length > 0) {
    // A weekday can have several rows (e.g. morning/afternoon); take the
    // outermost open window so gaps span the whole working day.
    let startMin = Infinity;
    let endMin = -Infinity;
    for (const s of matches) {
      const sm = timeToMinutes(s.start_time);
      const em = timeToMinutes(s.end_time);
      if (sm !== null) startMin = Math.min(startMin, sm);
      if (em !== null) endMin = Math.max(endMin, em);
    }
    if (Number.isFinite(startMin) && Number.isFinite(endMin) && endMin > startMin) {
      return { startMin, endMin };
    }
  }
  return { startMin: DEFAULT_BUSINESS_START_MIN, endMin: DEFAULT_BUSINESS_END_MIN };
}

const toDate = (v: Date | string): Date => (typeof v === 'string' ? parseISO(v) : v);
const minutesOf = (d: Date): number => d.getHours() * 60 + d.getMinutes();

/** Builds a Date on `day` at the given minutes-from-midnight. */
function dateAtMinutes(day: Date, minutes: number): Date {
  const d = new Date(day);
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return d;
}

/**
 * Free slots for a single day within its business window, computed from the
 * (already filtered) visible events. Overlapping events are merged; the result
 * is the complement within [startMin, endMin] that is ≥ minMinutes. The longest
 * gap is flagged `isMax`.
 */
export function computeDayGaps(
  events: CalendarEvent[],
  day: Date,
  minMinutes: number,
  window: { startMin: number; endMin: number },
): Gap[] {
  const { startMin, endMin } = window;
  if (endMin <= startMin) return [];

  // Busy intervals (clamped to the window), merged.
  const busy = filterEventsByDay(events, day)
    .map((e) => {
      const s = Math.max(startMin, minutesOf(toDate(e.start)));
      const en = Math.min(endMin, minutesOf(toDate(e.end)));
      return [s, en] as [number, number];
    })
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0]);

  const merged: Array<[number, number]> = [];
  for (const [s, e] of busy) {
    const last = merged[merged.length - 1];
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else merged.push([s, e]);
  }

  const dayKey = format(day, 'yyyy-MM-dd');
  const gaps: Gap[] = [];
  let cursor = startMin;
  for (const [s, e] of merged) {
    if (s - cursor >= minMinutes) {
      gaps.push({ dayKey, start: dateAtMinutes(day, cursor), end: dateAtMinutes(day, s), minutes: s - cursor, isMax: false });
    }
    cursor = Math.max(cursor, e);
  }
  if (endMin - cursor >= minMinutes) {
    gaps.push({ dayKey, start: dateAtMinutes(day, cursor), end: dateAtMinutes(day, endMin), minutes: endMin - cursor, isMax: false });
  }

  // Flag the longest gap of the day.
  let maxIdx = -1;
  let maxMin = -1;
  gaps.forEach((g, i) => { if (g.minutes > maxMin) { maxMin = g.minutes; maxIdx = i; } });
  if (maxIdx >= 0) gaps[maxIdx].isMax = true;

  return gaps;
}

/** Free slots across every visible day. */
export function computeRangeGaps(
  events: CalendarEvent[],
  days: Date[],
  schedules: ClinicSchedule[],
  minMinutes: number = DEFAULT_MIN_GAP_MINUTES,
): Gap[] {
  return days.flatMap((day) => computeDayGaps(events, day, minMinutes, getBusinessWindow(day, schedules)));
}

/** Stable key for a gap (used to mark the selected one). */
export const gapKey = (g: Gap): string =>
  `${g.groupValue ?? ''}_${g.dayKey}_${minutesOf(g.start)}_${minutesOf(g.end)}`;

// ─────────────────────────────────────────────────────────────────────────────
// Business-hours blocking (schedules + exceptions) — ADDITIVE, independent of the
// "Huecos" path above. None of the functions above are modified.
// ─────────────────────────────────────────────────────────────────────────────

export interface Interval { startMin: number; endMin: number }

/** A non-working range tied to a specific day (for overlay rendering). */
export interface BlockedRange {
  dayKey: string;
  startMin: number;
  endMin: number;
  groupValue?: string;
  /** Why it's blocked — 'exception' (cerrado) bands render red with the note. */
  reason?: 'schedule' | 'exception';
  /** Exception notes, shown in parentheses after "No disponible". */
  note?: string;
}

/** Normalizes a (possibly ISO/datetime) date string to `yyyy-MM-dd`. */
function normalizeDateKey(value: string | undefined | null): string {
  if (!value) return '';
  // Accept already-`yyyy-MM-dd` or ISO/datetime; take the date part.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  try {
    return format(parseISO(value), 'yyyy-MM-dd');
  } catch {
    return value;
  }
}

/** Sorts and merges overlapping/adjacent intervals. */
function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = [...intervals].filter((i) => i.endMin > i.startMin).sort((a, b) => a.startMin - b.startMin);
  const out: Interval[] = [];
  for (const it of sorted) {
    const last = out[out.length - 1];
    if (last && it.startMin <= last.endMin) last.endMin = Math.max(last.endMin, it.endMin);
    else out.push({ ...it });
  }
  return out;
}

/**
 * Working intervals available for `day`, from clinic schedules and exceptions.
 * Exceptions take precedence: `is_open=false` closes the date (→ []), `is_open=true`
 * opens it (using its start/end, else the weekday schedule, else 09:00–19:00).
 * A weekday with no schedule rows (and no opening exception) is closed (→ []).
 */
export function getAvailableIntervals(
  day: Date,
  schedules: ClinicSchedule[],
  exceptions: ClinicException[] = [],
): Interval[] {
  const dayKey = format(day, 'yyyy-MM-dd');
  const dayExceptions = exceptions.filter((e) => normalizeDateKey(e.date) === dayKey);

  // Weekday schedule rows (handles both day_of_week conventions).
  const jsDow = day.getDay();              // Sun=0..Sat=6
  const isoDow = jsDow === 0 ? 7 : jsDow;  // Mon=1..Sun=7
  const dows = new Set(schedules.map((s) => Number(s.day_of_week)));
  const usesIso = schedules.length > 0 && !dows.has(0);
  const target = usesIso ? isoDow : jsDow;
  const weekdayRows = schedules.filter((s) => Number(s.day_of_week) === target);
  const weekdayIntervals = mergeIntervals(
    weekdayRows
      .map((s) => ({ startMin: timeToMinutes(s.start_time), endMin: timeToMinutes(s.end_time) }))
      .filter((i): i is Interval => i.startMin !== null && i.endMin !== null) as Interval[],
  );

  if (dayExceptions.length > 0) {
    // Any closing exception shuts the whole day.
    if (dayExceptions.some((e) => !e.is_open)) return [];
    // Opening exceptions: use their times, falling back to weekday schedule / default.
    const opened: Interval[] = [];
    for (const e of dayExceptions) {
      const sm = timeToMinutes(e.start_time);
      const em = timeToMinutes(e.end_time);
      if (sm !== null && em !== null && em > sm) opened.push({ startMin: sm, endMin: em });
    }
    if (opened.length > 0) return mergeIntervals(opened);
    if (weekdayIntervals.length > 0) return weekdayIntervals;
    return [{ startMin: DEFAULT_BUSINESS_START_MIN, endMin: DEFAULT_BUSINESS_END_MIN }];
  }

  return weekdayIntervals; // [] when the weekday has no schedule → closed
}

/** A blocked interval, annotated with why it's blocked. */
export type BlockedInterval = Interval & { reason: 'schedule' | 'exception'; note?: string };

/**
 * Non-working ranges for `day` within [0, 1440] — the complement of the available
 * intervals. A fully-closed day yields a single 0–1440 block. When the day is
 * closed by a "cerrado" exception, the block is tagged `reason: 'exception'` with
 * the exception's notes.
 */
export function computeBlockedRanges(
  day: Date,
  schedules: ClinicSchedule[],
  exceptions: ClinicException[] = [],
): BlockedInterval[] {
  const dayKey = format(day, 'yyyy-MM-dd');
  const closing = exceptions.find((e) => normalizeDateKey(e.date) === dayKey && !e.is_open);
  if (closing) {
    return [{ startMin: 0, endMin: 24 * 60, reason: 'exception', note: closing.notes || '' }];
  }
  const avail = getAvailableIntervals(day, schedules, exceptions);
  if (avail.length === 0) return [{ startMin: 0, endMin: 24 * 60, reason: 'schedule' }];
  const blocked: BlockedInterval[] = [];
  let cursor = 0;
  for (const it of avail) {
    if (it.startMin > cursor) blocked.push({ startMin: cursor, endMin: it.startMin, reason: 'schedule' });
    cursor = Math.max(cursor, it.endMin);
  }
  if (cursor < 24 * 60) blocked.push({ startMin: cursor, endMin: 24 * 60, reason: 'schedule' });
  return blocked;
}

/**
 * Gaps for a day computed within an arbitrary set of available intervals (e.g.
 * split shifts). Reuses `computeDayGaps` per interval and re-flags a single
 * `isMax` across the day. Used only by the blocking-aware path.
 */
export function computeDayGapsForIntervals(
  events: CalendarEvent[],
  day: Date,
  minMinutes: number,
  intervals: Interval[],
): Gap[] {
  const all = intervals.flatMap((iv) => computeDayGaps(events, day, minMinutes, iv).map((g) => ({ ...g, isMax: false })));
  let maxIdx = -1;
  let maxMin = -1;
  all.forEach((g, i) => { if (g.minutes > maxMin) { maxMin = g.minutes; maxIdx = i; } });
  if (maxIdx >= 0) all[maxIdx].isMax = true;
  return all;
}

/** Stable key for a blocked range (per day/group). */
export const blockedKey = (dayKey: string, b: Interval & { groupValue?: string }): string =>
  `${b.groupValue ?? ''}_${dayKey}_${b.startMin}_${b.endMin}`;

/**
 * Whether a clicked slot (a Date, optionally within a grouping column) falls
 * inside a non-working/blocked band — used to disable create on blocked slots.
 */
export function isSlotBlocked(
  blockedRanges: BlockedRange[] | undefined,
  date: Date,
  groupValue?: string,
): boolean {
  if (!blockedRanges || blockedRanges.length === 0) return false;
  const dayKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const minuteOfDay = date.getHours() * 60 + date.getMinutes();
  return blockedRanges.some((b) =>
    b.dayKey === dayKey &&
    (b.groupValue ?? '') === (groupValue ?? '') &&
    minuteOfDay >= b.startMin &&
    minuteOfDay < b.endMin,
  );
}
