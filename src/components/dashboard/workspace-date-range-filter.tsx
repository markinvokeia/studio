'use client';

import * as React from 'react';
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isSameYear,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import type { Locale } from 'date-fns';
import { CalendarDays, ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { DateRange } from 'react-day-picker';

import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import { cn } from '@/lib/utils';

export type WorkspaceDatePreset =
  | 'today'
  | 'tomorrow'
  | 'week'
  | 'next7'
  | 'month'
  | 'nextMonth'
  | 'prevMonth'
  | 'custom';

export interface WorkspaceDateRange {
  from: Date;
  to: Date;
}

/** Presets shown in the popover, in display order. `custom` is driven by the calendar. */
const PRESET_KEYS: Exclude<WorkspaceDatePreset, 'custom'>[] = [
  'today',
  'tomorrow',
  'week',
  'next7',
  'month',
  'nextMonth',
  'prevMonth',
];

/** Resolves a preset to a concrete day range. Both ends are normalized to the start of
 *  their day so range comparisons (isSameDay, grouping) stay predictable. */
export function getWorkspacePresetRange(
  preset: Exclude<WorkspaceDatePreset, 'custom'>,
  reference: Date = new Date(),
): WorkspaceDateRange {
  const today = startOfDay(reference);

  switch (preset) {
    case 'tomorrow': {
      const tomorrow = addDays(today, 1);
      return { from: tomorrow, to: tomorrow };
    }
    case 'week':
      return {
        from: startOfWeek(today, { weekStartsOn: 1 }),
        to: startOfDay(endOfWeek(today, { weekStartsOn: 1 })),
      };
    case 'next7':
      return { from: today, to: addDays(today, 6) };
    case 'month':
      return { from: startOfMonth(today), to: startOfDay(endOfMonth(today)) };
    case 'nextMonth': {
      const next = addMonths(today, 1);
      return { from: startOfMonth(next), to: startOfDay(endOfMonth(next)) };
    }
    case 'prevMonth': {
      const previous = subMonths(today, 1);
      return { from: startOfMonth(previous), to: startOfDay(endOfMonth(previous)) };
    }
    case 'today':
    default:
      return { from: today, to: today };
  }
}

/** Returns the preset whose range matches `range` exactly, or 'custom' when none does.
 *  Lets a range picked by hand (e.g. the 1st to the 31st) light up its matching preset. */
export function matchWorkspacePreset(range: WorkspaceDateRange, reference: Date = new Date()): WorkspaceDatePreset {
  const matched = PRESET_KEYS.find((key) => {
    const presetRange = getWorkspacePresetRange(key, reference);
    return isSameDay(presetRange.from, range.from) && isSameDay(presetRange.to, range.to);
  });

  return matched ?? 'custom';
}

/** Short, human label for the resolved range — used on the filter trigger. */
export function formatWorkspaceRangeLabel(range: WorkspaceDateRange, dateLocale: Locale): string {
  if (isSameDay(range.from, range.to)) {
    return format(range.from, 'EEEE d MMM', { locale: dateLocale });
  }

  if (isSameMonth(range.from, range.to) && isSameYear(range.from, range.to)) {
    return `${format(range.from, 'd', { locale: dateLocale })} – ${format(range.to, 'd MMM', { locale: dateLocale })}`;
  }

  if (isSameYear(range.from, range.to)) {
    return `${format(range.from, 'd MMM', { locale: dateLocale })} – ${format(range.to, 'd MMM', { locale: dateLocale })}`;
  }

  return `${format(range.from, 'd MMM yy', { locale: dateLocale })} – ${format(range.to, 'd MMM yy', { locale: dateLocale })}`;
}

interface WorkspaceDateRangeFilterProps {
  value: WorkspaceDateRange;
  preset: WorkspaceDatePreset;
  onChange: (range: WorkspaceDateRange, preset: WorkspaceDatePreset) => void;
  dateLocale: Locale;
  className?: string;
}

export function WorkspaceDateRangeFilter({
  value,
  preset,
  onChange,
  dateLocale,
  className,
}: WorkspaceDateRangeFilterProps) {
  const t = useTranslations('DoctorWorkspace.agenda.dateFilter');
  const [open, setOpen] = React.useState(false);
  // The calendar picks a single day by default; 'range' is opt-in and waits for two clicks.
  const [pickMode, setPickMode] = React.useState<'day' | 'range'>('day');
  const [pendingStart, setPendingStart] = React.useState<Date | null>(null);

  const triggerLabel = React.useMemo(
    () => formatWorkspaceRangeLabel(value, dateLocale),
    [value, dateLocale],
  );

  const applyPreset = (nextPreset: Exclude<WorkspaceDatePreset, 'custom'>) => {
    setPendingStart(null);
    onChange(getWorkspacePresetRange(nextPreset), nextPreset);
    setOpen(false);
  };

  const emitRange = (from: Date, to: Date) => {
    const range = { from, to };
    onChange(range, matchWorkspacePreset(range));
  };

  /**
   * Day mode: one click filters that single day.
   * Range mode: the first click marks the start, the second closes the period. Clicking the
   * same day twice narrows it to that day, and a second click before the first is treated as
   * "the doctor marked the end first", so the two ends are swapped instead of rejected.
   */
  const handleDayClick = (day: Date) => {
    const clicked = startOfDay(day);

    if (pickMode === 'day') {
      emitRange(clicked, clicked);
      setPendingStart(null);
      setOpen(false);
      return;
    }

    if (!pendingStart) {
      setPendingStart(clicked);
      return;
    }

    const isReversed = clicked < pendingStart;
    emitRange(isReversed ? clicked : pendingStart, isReversed ? pendingStart : clicked);
    setPendingStart(null);
    setOpen(false);
  };

  const switchPickMode = (nextMode: 'day' | 'range') => {
    setPickMode(nextMode);
    setPendingStart(null);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) setPendingStart(null);
  };

  // While a period is half-picked the calendar highlights only the pending start, so the
  // doctor sees what they marked before the second click lands.
  const calendarSelected: DateRange = pendingStart ? { from: pendingStart, to: pendingStart } : value;

  const pickHint = pickMode === 'day'
    ? t('hintDay')
    : pendingStart
      ? t('hintPickEnd', { date: format(pendingStart, 'd MMM', { locale: dateLocale }) })
      : t('hintPickStart');

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn('h-8 min-w-0 justify-start gap-2 text-xs font-normal capitalize', className)}
        >
          <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{triggerLabel}</span>
          <ChevronDown className="ml-auto h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[19rem] p-2" align="start">
        <div className="grid grid-cols-2 gap-1">
          {PRESET_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => applyPreset(key)}
              className={cn(
                'rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-accent hover:text-accent-foreground',
                preset === key && 'bg-accent font-medium text-accent-foreground',
              )}
            >
              {t(key)}
            </button>
          ))}
        </div>

        <div className="my-2 h-px bg-border" />

        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-0.5">
          <button
            type="button"
            onClick={() => switchPickMode('day')}
            className={cn(
              'rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
              pickMode === 'day' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t('modeDay')}
          </button>
          <button
            type="button"
            onClick={() => switchPickMode('range')}
            className={cn(
              'rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
              pickMode === 'range' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t('modeRange')}
          </button>
        </div>

        <p className="px-2 pt-1.5 text-[11px] leading-snug text-muted-foreground">{pickHint}</p>

        <DatePicker
          mode="range"
          locale={dateLocale}
          selected={calendarSelected}
          onDayClick={handleDayClick}
          numberOfMonths={1}
        />
      </PopoverContent>
    </Popover>
  );
}
