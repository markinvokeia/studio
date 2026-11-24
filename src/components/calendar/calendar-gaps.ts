import { differenceInCalendarISOWeeks, format, parseISO } from 'date-fns';

import type { ClinicSchedule, ClinicException } from '@/lib/types';
import type { CalendarEvent } from './calendar-types';
import { filterEventsByDay } from './calendar-utils';
import { MINUTES_IN_DAY } from './calendar-constants';

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

/** End of day, in minutes from midnight. */
const DAY_END_MIN = 24 * 60;

/**
 * Parses an END time (`HH:mm[:ss]`) into minutes.
 *
 * Two normalizations, both driven by how the data is actually stored: the backend
 * writes `23:59:59` when no end time is given, and users save ends like `14:59:59`
 * meaning "up to 15:00".
 *  - seconds > 0 round the minute up (`14:59:59` → 15:00, `23:59:59` → 24:00);
 *  - anything landing on the last minute of the day snaps to 24:00, so a whole-day
 *    closure never leaves a one-minute sliver open.
 */
function endTimeToMinutes(value: string | undefined | null): number | null {
  const base = timeToMinutes(value);
  if (base === null) return null;
  const secs = Number(value?.split(':')[2] ?? 0);
  const rounded = Number.isFinite(secs) && secs > 0 ? base + 1 : base;
  return rounded >= DAY_END_MIN - 1 ? DAY_END_MIN : rounded;
}

/** An interval that carries the exception note(s) that produced it. */
type NotedInterval = Interval & { note?: string };

/** Joins the notes of merged closures, de-duplicated. */
function joinNotes(a?: string, b?: string): string {
  const parts = [a, b]
    .flatMap((n) => (n ? n.split(' · ') : []))
    .map((s) => s.trim())
    .filter(Boolean);
  return Array.from(new Set(parts)).join(' · ');
}

/** Like `mergeIntervals`, but combines the notes of the merged pieces. */
function mergeNoted(intervals: NotedInterval[]): NotedInterval[] {
  const sorted = [...intervals]
    .filter((i) => i.endMin > i.startMin)
    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  const out: NotedInterval[] = [];
  for (const it of sorted) {
    const last = out[out.length - 1];
    if (last && it.startMin <= last.endMin) {
      last.endMin = Math.max(last.endMin, it.endMin);
      last.note = joinNotes(last.note, it.note);
    } else {
      out.push({ ...it });
    }
  }
  return out;
}

/**
 * The window a `is_open=false` exception closes. With no usable times (or an
 * inverted range) it closes the whole day — the historical behaviour.
 */
function closureWindow(e: ClinicException): Interval {
  const sm = timeToMinutes(e.start_time);
  const em = endTimeToMinutes(e.end_time);
  if (sm === null && em === null) return { startMin: 0, endMin: DAY_END_MIN };
  const startMin = sm ?? 0;
  const endMin = em ?? DAY_END_MIN;
  if (endMin <= startMin) return { startMin: 0, endMin: DAY_END_MIN };
  return { startMin, endMin };
}

/** Merged closing windows (with their notes) for the exceptions of a single day. */
function closuresFor(dayExceptions: ClinicException[]): NotedInterval[] {
  return mergeNoted(
    dayExceptions
      .filter((e) => !e.is_open)
      .map((e) => ({ ...closureWindow(e), note: e.notes || '' })),
  );
}

/** `base` minus `holes` (both merged and sorted by start). */
function subtractIntervals(base: Interval[], holes: Interval[]): Interval[] {
  if (holes.length === 0) return base;
  const out: Interval[] = [];
  for (const b of base) {
    let cursor = b.startMin;
    for (const h of holes) {
      if (h.endMin <= cursor) continue;
      if (h.startMin >= b.endMin) break;
      if (h.startMin > cursor) out.push({ startMin: cursor, endMin: Math.min(h.startMin, b.endMin) });
      cursor = Math.max(cursor, h.endMin);
      if (cursor >= b.endMin) break;
    }
    if (cursor < b.endMin) out.push({ startMin: cursor, endMin: b.endMin });
  }
  return out;
}

/** ISO day of week for `day` (Mon=1..Sun=7), matching availability_rules/clinic_exceptions convention. */
function isoDayOfWeek(day: Date): number {
  const jsDow = day.getDay();
  return jsDow === 0 ? 7 : jsDow;
}

/**
 * Whether exception `e` applies to `day`. Mirrors the recurrence semantics of
 * `get_available_users()` in Postgres: 'once' (default) matches any of its
 * `dates`; 'weekly'/'biweekly'/'monthly' match any of their days within
 * `[date, end_date]` (end_date null = indefinite).
 */
function exceptionMatchesDay(e: ClinicException, day: Date, dayKey: string): boolean {
  const recurrence = e.recurrence ?? 'once';
  if (recurrence === 'once') {
    return e.dates?.length ? e.dates.some((d) => normalizeDateKey(d) === dayKey) : normalizeDateKey(e.date) === dayKey;
  }

  const startKey = normalizeDateKey(e.date);
  if (!startKey || dayKey < startKey) return false;
  if (e.end_date && dayKey > normalizeDateKey(e.end_date)) return false;

  if (recurrence === 'monthly') {
    return !!e.days_of_month?.includes(day.getDate());
  }
  if (recurrence === 'weekly' || recurrence === 'biweekly') {
    if (!e.days_of_week?.includes(isoDayOfWeek(day))) return false;
    if (recurrence === 'weekly') return true;
    if (!e.biweekly_reference_date) return false;
    // Real distance in weeks between both Mondays: ISO week numbers would flip
    // the parity after a 53-week year (same fix as script 138 in Postgres).
    const weekDiff = differenceInCalendarISOWeeks(day, parseISO(normalizeDateKey(e.biweekly_reference_date)));
    return weekDiff % 2 === 0;
  }
  return false;
}

/** Exceptions applying to `day` (tolerates ISO/datetime `date` values, and recurrence patterns). */
function dayExceptionsFor(day: Date, exceptions: ClinicException[]): ClinicException[] {
  const dayKey = format(day, 'yyyy-MM-dd');
  return exceptions.filter((e) => exceptionMatchesDay(e, day, dayKey));
}

/** Weekday schedule rows as merged intervals (handles both day_of_week conventions). */
function weekdayIntervalsFor(day: Date, schedules: ClinicSchedule[]): Interval[] {
  const jsDow = day.getDay();              // Sun=0..Sat=6
  const isoDow = jsDow === 0 ? 7 : jsDow;  // Mon=1..Sun=7
  const dows = new Set(schedules.map((s) => Number(s.day_of_week)));
  const usesIso = schedules.length > 0 && !dows.has(0);
  const target = usesIso ? isoDow : jsDow;
  return mergeIntervals(
    schedules
      .filter((s) => Number(s.day_of_week) === target)
      .map((s) => ({ startMin: timeToMinutes(s.start_time), endMin: timeToMinutes(s.end_time) }))
      .filter((i): i is Interval => i.startMin !== null && i.endMin !== null),
  );
}

/** The window of an `is_open` exception, or null when it has no usable start/end. */
function openingWindow(e: ClinicException): Interval | null {
  const sm = timeToMinutes(e.start_time);
  const em = endTimeToMinutes(e.end_time);
  return sm !== null && em !== null && em > sm ? { startMin: sm, endMin: em } : null;
}

/** Windows of the day's `is_open` exceptions that carry a usable start/end. */
function timedOpeningsFor(dayExceptions: ClinicException[]): Interval[] {
  return dayExceptions.flatMap((e) => {
    const window = e.is_open ? openingWindow(e) : null;
    return window ? [window] : [];
  });
}

/**
 * The day's open window BEFORE closing exceptions are applied: the opening
 * exceptions when there are any, otherwise the weekday schedule.
 */
function baseIntervalsFor(
  day: Date,
  schedules: ClinicSchedule[],
  dayExceptions: ClinicException[],
): Interval[] {
  const weekdayIntervals = weekdayIntervalsFor(day, schedules);
  const openings = dayExceptions.filter((e) => e.is_open);
  if (openings.length === 0) return weekdayIntervals;

  const opened = timedOpeningsFor(dayExceptions);
  if (opened.length > 0) return mergeIntervals(opened);
  if (weekdayIntervals.length > 0) return weekdayIntervals;
  return [{ startMin: DEFAULT_BUSINESS_START_MIN, endMin: DEFAULT_BUSINESS_END_MIN }];
}

/**
 * Exceptions that apply to a branch: rows with no `sede_id` are clinic-wide and
 * always apply; rows with one apply only to that branch.
 *
 * With no sede context (a timeline mixing branches) only the clinic-wide rows
 * apply — a branch-specific holiday must not grey out a column that is also
 * showing another branch's appointments.
 */
export function filterExceptionsForSede(
  exceptions: ClinicException[],
  sedeId?: string,
): ClinicException[] {
  if (sedeId) return exceptions.filter((e) => !e.sede_id || String(e.sede_id) === String(sedeId));
  return exceptions.filter((e) => !e.sede_id);
}

/**
 * Working intervals available for `day`, from clinic schedules and exceptions.
 *
 * `is_open=true` exceptions replace the day's open window (their own times, else
 * the weekday schedule, else 09:00–19:00). `is_open=false` exceptions are
 * subtracted from it: with a start/end they only close that window, without times
 * they close the whole day. Several exceptions on the same date combine.
 * A weekday with no schedule rows (and no opening exception) is closed (→ []).
 */
export function getAvailableIntervals(
  day: Date,
  schedules: ClinicSchedule[],
  exceptions: ClinicException[] = [],
): Interval[] {
  const dayExceptions = dayExceptionsFor(day, exceptions);
  const base = baseIntervalsFor(day, schedules, dayExceptions);
  if (base.length === 0) return [];
  return subtractIntervals(base, closuresFor(dayExceptions));
}

/** A blocked interval, annotated with why it's blocked. */
export type BlockedInterval = Interval & { reason: 'schedule' | 'exception'; note?: string };

/**
 * Non-working ranges for `day` within [0, 1440] — the complement of the available
 * intervals, split by cause: time outside the schedule is `reason: 'schedule'`
 * (grey), time removed by a "cerrado" exception is `reason: 'exception'` (red
 * hatch + note). Grey is `[0,1440) \ base` minus the red bands, so the two sets
 * are disjoint and `blockedKey()` stays unique even though it ignores `reason`.
 *
 * On a normal day red is `closures ∩ base`: a closure wider than the schedule only
 * shows where the day was open. With timed openings, or no hours at all, it's the
 * whole closure: "bloquear horario" cuts the openings it overlaps (`planSlotBlock`),
 * so the closure no longer intersects `base` and would lose its reason otherwise.
 *
 * A closure covering the whole day still collapses into a single 0–1440 exception
 * band, so existing full-day feriados render exactly as before.
 */
export function computeBlockedRanges(
  day: Date,
  schedules: ClinicSchedule[],
  exceptions: ClinicException[] = [],
): BlockedInterval[] {
  const dayExceptions = dayExceptionsFor(day, exceptions);
  const closures = closuresFor(dayExceptions);

  // Whole-day closure → one red band for the entire day (the legacy look).
  const fullDay = closures.find((c) => c.startMin <= 0 && c.endMin >= DAY_END_MIN);
  if (fullDay) {
    return [{ startMin: 0, endMin: DAY_END_MIN, reason: 'exception', note: fullDay.note || '' }];
  }

  // The open window before the closures: what those closures actually take away.
  const base = baseIntervalsFor(day, schedules, dayExceptions);

  // 1. Red bands, with their note.
  const paintWhole = base.length === 0 || timedOpeningsFor(dayExceptions).length > 0;
  const closed: BlockedInterval[] = closures.flatMap((c) => {
    const pieces = paintWhole ? [c] : intersectWith(c, base);
    return pieces.map(({ startMin, endMin }) => ({ startMin, endMin, reason: 'exception' as const, note: c.note || '' }));
  });

  // 2. Out-of-schedule time (the complement of `base`), around the red bands.
  const outOfHours: Interval[] = [];
  let cursor = 0;
  for (const it of base) {
    if (it.startMin > cursor) outOfHours.push({ startMin: cursor, endMin: it.startMin });
    cursor = Math.max(cursor, it.endMin);
  }
  if (cursor < DAY_END_MIN) outOfHours.push({ startMin: cursor, endMin: DAY_END_MIN });
  const grey: BlockedInterval[] = subtractIntervals(outOfHours, closed)
    .map(({ startMin, endMin }) => ({ startMin, endMin, reason: 'schedule' }));

  return [...grey, ...closed].sort((a, b) => a.startMin - b.startMin);
}

/**
 * `HH:mm` for a minute of the day. 1440 (end of day) is written as `23:59`, which
 * `endTimeToMinutes` reads back as 24:00 — a time column can't hold 24:00.
 */
export function minutesToTimeString(min: number): string {
  const clamped = Math.min(Math.max(min, 0), DAY_END_MIN - 1);
  return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`;
}

/** Pieces of `a` that fall inside any of `within` (merged, sorted). */
function intersectWith(a: Interval, within: Interval[]): Interval[] {
  const out: Interval[] = [];
  for (const w of within) {
    const startMin = Math.max(a.startMin, w.startMin);
    const endMin = Math.min(a.endMin, w.endMin);
    if (endMin > startMin) out.push({ startMin, endMin });
  }
  return out;
}

/** A closure "habilitar horario" can't change from the calendar. */
export interface LockedClosure {
  exception: ClinicException;
  /** 'recurring' = it repeats (weekly/biweekly/monthly); 'otherScope' = another branch scope. */
  reason: 'recurring' | 'otherScope';
}

/** How an editable closure ends up once the hours are enabled. */
export interface ClosureChange {
  exception: ClinicException;
  /** What stays closed on that day within its hours, for display (empty = none). */
  remaining: Interval[];
  /** The saved rows still close part of the day, but only outside its hours. */
  closedOutsideHours: boolean;
  /** Other dates the closure keeps covering (0 = it only covered this day). */
  otherDates: number;
}

/** A write against `clinic_exceptions`; `create` rows carry an empty `id`. */
export type ExceptionWrite =
  | { type: 'create'; exception: ClinicException }
  | { type: 'update'; exception: ClinicException }
  | { type: 'delete'; exception: ClinicException };

export interface SlotEnablePlan {
  /** Writes in a safe order: a failure halfway leaves the day LESS open, never more. */
  writes: ExceptionWrite[];
  closureChanges: ClosureChange[];
  locked: LockedClosure[];
  /** Whether opening exceptions are added (the range goes past the day's hours). */
  extendsHours: boolean;
  /** The day's available hours now, and once the writes are applied. */
  before: Interval[];
  resulting: Interval[];
  changesSomething: boolean;
}

/** What cutting a time range out of one row, on one day, keeps and writes. */
interface CarvedRow {
  /** What is left of the row's window that day. */
  kept: Interval[];
  /** Other dates the row keeps covering (0 = it only covered this day). */
  otherDates: number;
  creates: ExceptionWrite[];
  updates: ExceptionWrite[];
  deletes: ExceptionWrite[];
}

/**
 * Cuts `cut` out of a one-off row on `dayKey`. A multi-date row only loses this
 * date and what is left that day becomes its own single-date row; otherwise the
 * row is deleted, shrunk, or split (the second piece is created BEFORE the
 * original shrinks to the first).
 */
function carveRowForDay(e: ClinicException, window: Interval, cut: Interval, dayKey: string): CarvedRow {
  const singleDateCopy = (w: Interval): ClinicException => ({
    ...e,
    id: '',
    date: dayKey,
    dates: [dayKey],
    recurrence: 'once',
    start_time: minutesToTimeString(w.startMin),
    end_time: minutesToTimeString(w.endMin),
  });
  const kept = subtractIntervals([window], [cut]);
  const otherDates = Array.from(new Set((e.dates?.length ? e.dates : [e.date]).map(normalizeDateKey)))
    .filter((d) => d && d !== dayKey)
    .sort();
  const carved: CarvedRow = { kept, otherDates: otherDates.length, creates: [], updates: [], deletes: [] };

  if (otherDates.length > 0) {
    for (const w of kept) carved.creates.push({ type: 'create', exception: singleDateCopy(w) });
    carved.updates.push({ type: 'update', exception: { ...e, date: otherDates[0], dates: otherDates } });
  } else if (kept.length === 0) {
    carved.deletes.push({ type: 'delete', exception: e });
  } else {
    for (const w of kept.slice(1)) carved.creates.push({ type: 'create', exception: singleDateCopy(w) });
    carved.updates.push({
      type: 'update',
      exception: {
        ...e,
        start_time: minutesToTimeString(kept[0].startMin),
        end_time: minutesToTimeString(kept[0].endMin),
      },
    });
  }
  return carved;
}

export interface PlanSlotEnableOptions {
  /** Branch the action runs for; undefined = the whole clinic. */
  sedeId?: string;
  /** With a single branch, clinic-wide rows ARE that branch's, so they're editable. */
  singleBranch?: boolean;
  /** Notes for the opening rows. */
  openingNotes?: string;
}

/**
 * Plans "habilitar horario": make `added` available on `day` with as few, and as
 * honest, exception rows as possible.
 *
 * - One-off closures of the same scope that overlap `added` are edited in place:
 *   deleted when fully lifted, trimmed when one edge remains, split when the
 *   lifted range sits in the middle. A multi-date closure only loses this date;
 *   what stays closed that day becomes its own single-date closure. What stays
 *   closed is saved up to 00:00/24:00, NOT clipped to the day's hours: "closed
 *   except 10–12" must still hold if the weekday schedule changes later.
 * - Recurring closures, and closures of another scope (a clinic-wide row seen
 *   from one branch), aren't touched: they'd change other dates or branches.
 *   They're reported as `locked` and keep blocking their window.
 * - If `added` goes past the day's hours, `is_open` rows are added. Openings
 *   REPLACE the weekday schedule in the calendar (`baseIntervalsFor`) but are
 *   UNIONED with it — and win over closures — in `get_available_users()`, so
 *   they cover the whole new open window minus every closure that stays: both
 *   readings then agree.
 */
export function planSlotEnable(
  day: Date,
  schedules: ClinicSchedule[],
  exceptions: ClinicException[],
  added: Interval,
  { sedeId, singleBranch = false, openingNotes = '' }: PlanSlotEnableOptions = {},
): SlotEnablePlan {
  const dayKey = format(day, 'yyyy-MM-dd');
  const dayExceptions = dayExceptionsFor(day, exceptions);
  const base = baseIntervalsFor(day, schedules, dayExceptions);
  const openWindow = mergeIntervals([...base, added]);

  const isSameScope = (e: ClinicException) => {
    if (sedeId) return String(e.sede_id ?? '') === String(sedeId) || (!e.sede_id && singleBranch);
    return !e.sede_id;
  };

  const creates: ExceptionWrite[] = [];
  const updates: ExceptionWrite[] = [];
  const deletes: ExceptionWrite[] = [];
  const closureChanges: ClosureChange[] = [];
  const locked: LockedClosure[] = [];

  for (const e of dayExceptions) {
    if (e.is_open) continue;
    const window = closureWindow(e);
    if (window.endMin <= added.startMin || window.startMin >= added.endMin) continue;
    if ((e.recurrence ?? 'once') !== 'once') {
      locked.push({ exception: e, reason: 'recurring' });
      continue;
    }
    if (!isSameScope(e)) {
      locked.push({ exception: e, reason: 'otherScope' });
      continue;
    }
    const carved = carveRowForDay(e, window, added, dayKey);
    // Saved as is; only the display is clipped to the day's (new) hours.
    const remaining = carved.kept.flatMap((r) => intersectWith(r, openWindow));
    closureChanges.push({
      exception: e,
      remaining,
      closedOutsideHours: carved.kept.length > 0 && remaining.length === 0,
      otherDates: carved.otherDates,
    });
    creates.push(...carved.creates);
    updates.push(...carved.updates);
    deletes.push(...carved.deletes);
  }

  // The day's exceptions once the closure edits are applied.
  const touched = new Set([...updates, ...deletes].map((w) => w.exception.id));
  const editedDay = dayExceptionsFor(day, [
    ...dayExceptions.filter((e) => !touched.has(e.id)),
    ...updates.map((w) => w.exception),
    ...creates.map((w) => w.exception),
  ]);

  const extendsHours = JSON.stringify(openWindow) !== JSON.stringify(base);
  const openingWindows = extendsHours
    ? subtractIntervals(
      timedOpeningsFor(dayExceptions).length > 0 ? [added] : openWindow,
      closuresFor(editedDay),
    )
    : [];
  const openings: ExceptionWrite[] = openingWindows.map((w) => ({
    type: 'create',
    exception: {
      id: '',
      date: dayKey,
      dates: [dayKey],
      recurrence: 'once',
      is_open: true,
      start_time: minutesToTimeString(w.startMin),
      end_time: minutesToTimeString(w.endMin),
      sede_id: sedeId || undefined,
      notes: openingNotes,
    },
  }));

  const before = getAvailableIntervals(day, schedules, dayExceptions);
  const resulting = getAvailableIntervals(day, schedules, [...editedDay, ...openings.map((w) => w.exception)]);

  return {
    writes: [...creates, ...updates, ...deletes, ...openings],
    closureChanges,
    locked,
    extendsHours: openings.length > 0,
    before,
    resulting,
    changesSomething: JSON.stringify(before) !== JSON.stringify(resulting),
  };
}

/** The window "habilitar horario" proposes for a right-click at `slotMin`. */
export function suggestEnableWindow(
  day: Date,
  schedules: ClinicSchedule[],
  exceptions: ClinicException[],
  slotMin: number,
): Interval | null {
  const band = computeBlockedRanges(day, schedules, exceptions)
    .find((b) => slotMin >= b.startMin && slotMin < b.endMin);
  if (!band) return null;

  if (band.reason === 'exception') {
    if (band.startMin > 0 || band.endMin < DAY_END_MIN) return { startMin: band.startMin, endMin: band.endMin };
    // A whole-day closure: propose the day's usual hours.
    const base = baseIntervalsFor(day, schedules, dayExceptionsFor(day, exceptions));
    return base.length > 0
      ? { startMin: base[0].startMin, endMin: base[base.length - 1].endMin }
      : { startMin: DEFAULT_BUSINESS_START_MIN, endMin: DEFAULT_BUSINESS_END_MIN };
  }

  // Out of hours: stick to the open edge when the click is near it (extend the
  // close or bring the opening forward), otherwise an hour from the click.
  const NEAR_MIN = 180;
  const startMin = band.startMin > 0 && slotMin - band.startMin <= NEAR_MIN ? band.startMin : slotMin;
  const endMin = band.endMin < DAY_END_MIN && band.endMin - slotMin <= NEAR_MIN
    ? band.endMin
    : Math.min(slotMin + 60, band.endMin);
  return { startMin, endMin };
}

/** An opening that overlaps the range to block and can't be changed from the calendar. */
export interface LockedOpening {
  exception: ClinicException;
  /** 'recurring' = it repeats; 'otherScope' = it also applies to other branches. */
  reason: 'recurring' | 'otherScope';
}

/** How an opening ends up once the range is blocked. */
export interface OpeningChange {
  exception: ClinicException;
  /** What stays open from this row on that day (empty = nothing). */
  remaining: Interval[];
  /** Other dates the opening keeps covering (0 = it only covered this day). */
  otherDates: number;
}

export interface SlotBlockPlan {
  /** Writes in a safe order: the closure first, so a failure never leaves it more open. */
  writes: ExceptionWrite[];
  openingChanges: OpeningChange[];
  /** While any is left the closure wouldn't hold for the WhatsApp agent: don't save. */
  locked: LockedOpening[];
  /** The day's available hours now, and once the writes are applied. */
  before: Interval[];
  resulting: Interval[];
  changesSomething: boolean;
}

export interface PlanSlotBlockOptions {
  /** Branch the closure is for; undefined = the whole clinic. */
  sedeId?: string;
  /** With a single branch, clinic-wide rows ARE that branch's, so they're editable. */
  singleBranch?: boolean;
  /** Notes for the closing row. */
  notes?: string;
}

/**
 * Plans "bloquear horario": a one-off closure of `blocked` on `day`.
 *
 * The closure alone isn't enough. In `get_available_users()` an `is_open` row WINS
 * over a closure, while in the calendar the closure wins, so an opening left over
 * the range would show closed here and stay bookable for the WhatsApp agent. And
 * "habilitar horario" writes openings for the day's whole window, so this is the
 * usual case on a day that was enabled before. Overlapping openings are cut:
 *
 * - One-off openings inside the closure's scope are carved like `planSlotEnable`
 *   does with closures.
 * - Recurring openings, and clinic-wide ones seen from one branch of many, can't be
 *   cut without changing other dates or branches: they're reported as `locked`.
 * - A branch's own opening IS inside a clinic-wide closure, which is why this takes
 *   the whole clinic's `exceptions`, not the ones the calendar paints for the scope.
 */
export function planSlotBlock(
  day: Date,
  schedules: ClinicSchedule[],
  exceptions: ClinicException[],
  blocked: Interval,
  { sedeId, singleBranch = false, notes = '' }: PlanSlotBlockOptions = {},
): SlotBlockPlan {
  const dayKey = format(day, 'yyyy-MM-dd');
  const dayExceptions = dayExceptionsFor(day, exceptions);

  const creates: ExceptionWrite[] = [];
  const updates: ExceptionWrite[] = [];
  const deletes: ExceptionWrite[] = [];
  const openingChanges: OpeningChange[] = [];
  const locked: LockedOpening[] = [];

  for (const e of dayExceptions) {
    if (!e.is_open) continue;
    // Untimed openings open nothing in the backend, so there's nothing to cut.
    const window = openingWindow(e);
    if (!window || window.endMin <= blocked.startMin || window.startMin >= blocked.endMin) continue;
    // Another branch's opening doesn't apply to this branch's closure.
    if (sedeId && e.sede_id && String(e.sede_id) !== String(sedeId)) continue;
    if ((e.recurrence ?? 'once') !== 'once') {
      locked.push({ exception: e, reason: 'recurring' });
      continue;
    }
    if (sedeId && !e.sede_id && !singleBranch) {
      locked.push({ exception: e, reason: 'otherScope' });
      continue;
    }
    const carved = carveRowForDay(e, window, blocked, dayKey);
    openingChanges.push({ exception: e, remaining: carved.kept, otherDates: carved.otherDates });
    creates.push(...carved.creates);
    updates.push(...carved.updates);
    deletes.push(...carved.deletes);
  }

  const closure: ClinicException = {
    id: '',
    date: dayKey,
    dates: [dayKey],
    recurrence: 'once',
    is_open: false,
    start_time: minutesToTimeString(blocked.startMin),
    end_time: minutesToTimeString(blocked.endMin),
    sede_id: sedeId || undefined,
    notes,
  };

  const touched = new Set([...updates, ...deletes].map((w) => w.exception.id));
  const applied = [
    ...dayExceptions.filter((e) => !touched.has(e.id)),
    ...updates.map((w) => w.exception),
    ...creates.map((w) => w.exception),
    closure,
  ];
  const before = getAvailableIntervals(day, schedules, filterExceptionsForSede(dayExceptions, sedeId));
  const resulting = getAvailableIntervals(day, schedules, filterExceptionsForSede(applied, sedeId));

  return {
    writes: [{ type: 'create', exception: closure }, ...creates, ...updates, ...deletes],
    openingChanges,
    locked,
    before,
    resulting,
    // A cut opening counts even if the calendar already showed it closed: the
    // WhatsApp agent didn't.
    changesSomething: openingChanges.length > 0 || JSON.stringify(before) !== JSON.stringify(resulting),
  };
}

/**
 * The window "bloquear horario" proposes for a right-click at `slotMin`: an hour
 * from the click, within the open stretch it falls in. Null if it isn't open.
 */
export function suggestBlockWindow(
  day: Date,
  schedules: ClinicSchedule[],
  exceptions: ClinicException[],
  slotMin: number,
): Interval | null {
  const open = getAvailableIntervals(day, schedules, exceptions)
    .find((i) => slotMin >= i.startMin && slotMin < i.endMin);
  return open ? { startMin: slotMin, endMin: Math.min(slotMin + 60, open.endMin) } : null;
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

/** `yyyy-MM-dd` local de una fecha, en la misma forma que arma `blockedKey`. */
const dayKeyOf = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/**
 * Whether a time RANGE overlaps a non-working/blocked band.
 *
 * `isSlotBlocked` evalúa un instante, que alcanza para el clic en un slot vacío
 * pero no para mover o redimensionar una cita: un resize de 17:45 a 19:00 que
 * cruza el cierre de la clínica empieza en horario válido y pasaría el chequeo.
 * Acá el criterio es solape de intervalos semiabiertos [start, end).
 */
export function isRangeBlocked(
  blockedRanges: BlockedRange[] | undefined,
  start: Date,
  end: Date,
  groupValue?: string,
): boolean {
  if (!blockedRanges || blockedRanges.length === 0) return false;
  const dayKey = dayKeyOf(start);
  const startMin = start.getHours() * 60 + start.getMinutes();
  // Un rango de duración cero (recordatorio puntual) igual tiene que poder caer
  // dentro de una banda, así que se le da un minuto de ancho mínimo.
  const rawEndMin = end.getHours() * 60 + end.getMinutes();
  const endMin = Math.max(startMin + 1, dayKeyOf(end) === dayKey ? rawEndMin : MINUTES_IN_DAY);
  return blockedRanges.some((b) =>
    b.dayKey === dayKey &&
    (b.groupValue ?? '') === (groupValue ?? '') &&
    startMin < b.endMin &&
    endMin > b.startMin,
  );
}

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
  const dayKey = dayKeyOf(date);
  const minuteOfDay = date.getHours() * 60 + date.getMinutes();
  return blockedRanges.some((b) =>
    b.dayKey === dayKey &&
    (b.groupValue ?? '') === (groupValue ?? '') &&
    minuteOfDay >= b.startMin &&
    minuteOfDay < b.endMin,
  );
}
