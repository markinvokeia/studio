'use client';

import * as React from 'react';
import { format, parseISO } from 'date-fns';
import { X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { Calendar } from '@/components/ui/calendar';

import { getDateFnsLocale } from '@/lib/locale';
import { cn, formatHolidayDate } from '@/lib/utils';

/** Monday..Sunday, the order every picker shows. */
export const WEEKDAY_NAMES = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

const MONTH_DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

/**
 * Day numbering of the table behind the picker: 'iso' = 1 (Monday)..7 (Sunday),
 * as in availability rules and clinic exceptions; 'js' = 0 (Sunday)..6
 * (Saturday), as in clinic_schedules.
 */
export type WeekdayConvention = 'iso' | 'js';

/** Value stored for the weekday at `index` (0 = Monday) in `convention`. */
export function weekdayValue(index: number, convention: WeekdayConvention = 'iso'): number {
    if (convention === 'js') return index === 6 ? 0 : index + 1;
    return index + 1;
}

/** Translation key (`days.*`) of a stored weekday value. */
export function weekdayName(value: number, convention: WeekdayConvention = 'iso'): (typeof WEEKDAY_NAMES)[number] | undefined {
    const index = convention === 'js' ? (value === 0 ? 6 : value - 1) : value - 1;
    return WEEKDAY_NAMES[index];
}

/** Short labels ("Lun, Mié, Vie") of `values`, ordered Monday first. */
export function useWeekdayListLabel(convention: WeekdayConvention = 'iso') {
    const t = useTranslations('DayPickers');
    return React.useCallback((values: number[] | undefined) => {
        if (!values?.length) return '-';
        return WEEKDAY_NAMES
            .map((name, i) => ({ name, value: weekdayValue(i, convention) }))
            .filter((d) => values.includes(d.value))
            .map((d) => t(`daysShort.${d.name}`))
            .join(', ');
    }, [t, convention]);
}

/** Adds or removes `value` from a sorted list. */
function toggleSorted(list: number[], value: number): number[] {
    const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
    return next.sort((a, b) => a - b);
}

const toggleButtonClass = (selected: boolean) => cn(
    'h-9 rounded-md border text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60',
    selected ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-muted',
);

/** Root props come from FormControl (id, aria-describedby, aria-invalid). */
type PickerRootProps = Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue'>;

interface WeekdayToggleGroupProps extends PickerRootProps {
    value: number[];
    onChange: (value: number[]) => void;
    disabled?: boolean;
    convention?: WeekdayConvention;
}

/** Monday..Sunday toggle buttons; any number of days can be on. */
export const WeekdayToggleGroup = React.forwardRef<HTMLDivElement, WeekdayToggleGroupProps>(
    ({ value, onChange, disabled, convention = 'iso', ...props }, ref) => {
        const t = useTranslations('DayPickers');
        return (
            <div ref={ref} role="group" {...props} className={cn('grid grid-cols-7 gap-1', props.className)}>
                {WEEKDAY_NAMES.map((name, i) => {
                    const day = weekdayValue(i, convention);
                    const selected = value.includes(day);
                    return (
                        <button
                            key={name}
                            type="button"
                            disabled={disabled}
                            aria-pressed={selected}
                            title={t(`days.${name}`)}
                            className={toggleButtonClass(selected)}
                            onClick={() => onChange(toggleSorted(value, day))}
                        >
                            {t(`daysShort.${name}`)}
                        </button>
                    );
                })}
            </div>
        );
    },
);
WeekdayToggleGroup.displayName = 'WeekdayToggleGroup';

interface MonthDayGridProps extends PickerRootProps {
    value: number[];
    onChange: (value: number[]) => void;
    disabled?: boolean;
}

/** 1..31 toggle grid; warns when a picked day doesn't exist in every month. */
export const MonthDayGrid = React.forwardRef<HTMLDivElement, MonthDayGridProps>(
    ({ value, onChange, disabled, ...props }, ref) => {
        const t = useTranslations('DayPickers');
        return (
            <div ref={ref} {...props} className={cn('space-y-2', props.className)}>
                <div className="grid grid-cols-7 gap-1" role="group" aria-label={props['aria-label']}>
                    {MONTH_DAYS.map((day) => {
                        const selected = value.includes(day);
                        return (
                            <button
                                key={day}
                                type="button"
                                disabled={disabled}
                                aria-pressed={selected}
                                className={toggleButtonClass(selected)}
                                onClick={() => onChange(toggleSorted(value, day))}
                            >
                                {day}
                            </button>
                        );
                    })}
                </div>
                {value.some((d) => d > 28) && (
                    <p className="text-[0.8rem] text-muted-foreground">{t('shortMonthsHelp')}</p>
                )}
            </div>
        );
    },
);
MonthDayGrid.displayName = 'MonthDayGrid';

interface MultiDatePickerProps extends PickerRootProps {
    /** Sorted `yyyy-MM-dd` dates. */
    value: string[];
    onChange: (value: string[]) => void;
    /** View mode: only the chips, without calendar or remove buttons. */
    readOnly?: boolean;
}

/** Inline calendar to pick loose dates, plus the picked dates as removable chips. */
export const MultiDatePicker = React.forwardRef<HTMLDivElement, MultiDatePickerProps>(
    ({ value, onChange, readOnly = false, ...props }, ref) => {
        const t = useTranslations('DayPickers');
        const dateLocale = getDateFnsLocale(useLocale());
        return (
            <div ref={ref} {...props} className={cn('space-y-2', props.className)}>
                {!readOnly && (
                    <div className="rounded-md border">
                        <Calendar
                            mode="multiple"
                            locale={dateLocale}
                            selected={value.map((d) => parseISO(d))}
                            defaultMonth={value[0] ? parseISO(value[0]) : undefined}
                            onSelect={(days) => onChange((days ?? []).map((d) => format(d, 'yyyy-MM-dd')).sort())}
                        />
                    </div>
                )}
                {value.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5" aria-live="polite">
                        {value.map((d) => (
                            <span key={d} className="inline-flex items-center gap-1 rounded-full border bg-muted/50 py-0.5 pl-2.5 pr-1 text-xs font-medium">
                                {formatHolidayDate(d)}
                                {!readOnly && (
                                    <button
                                        type="button"
                                        className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                                        aria-label={t('removeDate', { date: formatHolidayDate(d) })}
                                        onClick={() => onChange(value.filter((v) => v !== d))}
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                )}
                            </span>
                        ))}
                    </div>
                ) : (
                    <p className="text-xs text-muted-foreground">{t('noDatesSelected')}</p>
                )}
                {!readOnly && <p className="text-[0.8rem] text-muted-foreground">{t('datesHelp')}</p>}
            </div>
        );
    },
);
MultiDatePicker.displayName = 'MultiDatePicker';

/** "24/12/2026 (+2)": the first date of a multi-date rule and how many more. */
export function multiDateLabel(dates: string[] | undefined, fallback?: string): string {
    const first = formatHolidayDate(dates?.[0] ?? fallback);
    const extra = (dates?.length ?? 0) - 1;
    return extra > 0 ? `${first} (+${extra})` : first;
}
