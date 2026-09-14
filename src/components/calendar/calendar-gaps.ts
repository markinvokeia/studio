import { format, parseISO } from 'date-fns';

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

/** Exceptions falling on `day` (tolerates ISO/datetime `date` values). */
function dayExceptionsFor(day: Date, exceptions: ClinicException[]): ClinicException[] {
  const dayKey = format(day, 'yyyy-MM-dd');
  return exceptions.filter((e) => normalizeDateKey(e.date) === dayKey);
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

  const opened: Interval[] = [];
  for (const e of openings) {
    const sm = timeToMinutes(e.start_time);
    const em = endTimeToMinutes(e.end_time);
    if (sm !== null && em !== null && em > sm) opened.push({ startMin: sm, endMin: em });
  }
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
 * hatch + note). The two sets are disjoint by construction — grey is
 * `[0,1440) \ base` and red is `closures ∩ base` — so the bands never overlap
 * and `blockedKey()` stays unique even though it ignores `reason`.
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
  if (base.length === 0) return [{ startMin: 0, endMin: DAY_END_MIN, reason: 'schedule' }];

  const blocked: BlockedInterval[] = [];

  // 1. Out-of-schedule time (the complement of `base`).
  let cursor = 0;
  for (const it of base) {
    if (it.startMin > cursor) blocked.push({ startMin: cursor, endMin: it.startMin, reason: 'schedule' });
    cursor = Math.max(cursor, it.endMin);
  }
  if (cursor < DAY_END_MIN) blocked.push({ startMin: cursor, endMin: DAY_END_MIN, reason: 'schedule' });

  // 2. Closures clipped to `base`, so the red band and its note only cover time
  //    that was otherwise open; the rest already falls inside a grey band.
  for (const c of closures) {
    for (const b of base) {
      const startMin = Math.max(c.startMin, b.startMin);
      const endMin = Math.min(c.endMin, b.endMin);
      if (endMin > startMin) blocked.push({ startMin, endMin, reason: 'exception', note: c.note || '' });
    }
  }

  return blocked.sort((a, b) => a.startMin - b.startMin);
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
