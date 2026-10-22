'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import type { UseFormReturn } from 'react-hook-form';
import * as z from 'zod';

import { Checkbox } from '@/components/ui/checkbox';
import { DatePickerInput } from '@/components/ui/date-picker';
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { MonthDayGrid, MultiDatePicker, WeekdayToggleGroup } from '@/components/schedules/day-pickers';

import { formatHolidayDate } from '@/lib/utils';

import type { Sede } from '@/lib/types';

/** Radix Select no admite value=""; este centinela representa "todas las sedes". */
const ALL_SEDES_VALUE = '__all__';

export const exceptionFormSchema = (t: (key: string) => string) => z.object({
    id: z.string().optional(),
    /** Inicio de la recurrencia; para 'once' se deriva de `dates` al guardar. */
    date: z.string().optional(),
    dates: z.array(z.string()).default([]),
    is_open: z.boolean().default(false),
    start_time: z.string().optional(),
    end_time: z.string().optional(),
    // '' = la excepción aplica a todas las sedes.
    sede_id: z.string().optional(),
    notes: z.string().optional(),
    recurrence: z.enum(['once', 'weekly', 'biweekly', 'monthly']).default('once'),
    days_of_week: z.array(z.number().int().min(1).max(7)).default([]),
    days_of_month: z.array(z.number().int().min(1).max(31)).default([]),
    biweekly_reference_date: z.string().optional(),
    end_date: z.string().optional(),
}).refine(data => data.recurrence !== 'once' || data.dates.length > 0, {
    message: t('datesRequired'),
    path: ['dates'],
}).refine(data => data.recurrence === 'once' || !!data.date, {
    message: t('dateRequired'),
    path: ['date'],
}).refine(data => (data.recurrence !== 'weekly' && data.recurrence !== 'biweekly') || data.days_of_week.length > 0, {
    message: t('dayOfWeekRequired'),
    path: ['days_of_week'],
}).refine(data => data.recurrence !== 'monthly' || data.days_of_month.length > 0, {
    message: t('dayOfMonthRequired'),
    path: ['days_of_month'],
}).refine(data => data.recurrence !== 'biweekly' || !!data.biweekly_reference_date, {
    message: t('biweeklyReferenceDateRequired'),
    path: ['biweekly_reference_date'],
});

export type ExceptionFormValues = z.infer<ReturnType<typeof exceptionFormSchema>>;

export const EMPTY_EXCEPTION_FORM: ExceptionFormValues = {
    date: '', dates: [], is_open: false, start_time: '', end_time: '', sede_id: '', notes: '',
    recurrence: 'once', days_of_week: [], days_of_month: [], biweekly_reference_date: '', end_date: '',
};

interface ExceptionFormFieldsProps {
    form: UseFormReturn<ExceptionFormValues>;
    /** View mode of the detail panel: every control shown but locked. */
    readOnly?: boolean;
    sedes: Sede[];
}

export function ExceptionFormFields({ form, readOnly = false, sedes }: ExceptionFormFieldsProps) {
    const t = useTranslations('HolidaysPage');
    const recurrence = form.watch('recurrence');

    // Switching recurrence drops the fields of the previous pattern. Only touch
    // fields that hold something, so resetting to a saved rule doesn't make it dirty.
    React.useEffect(() => {
        const clear = (name: 'dates' | 'days_of_week' | 'days_of_month') => {
            if (form.getValues(name).length) form.setValue(name, []);
        };
        if (recurrence !== 'once') clear('dates');
        if (recurrence !== 'weekly' && recurrence !== 'biweekly') clear('days_of_week');
        if (recurrence !== 'monthly') clear('days_of_month');
        if (recurrence !== 'biweekly' && form.getValues('biweekly_reference_date')) form.setValue('biweekly_reference_date', '');
        if (recurrence === 'once' && form.getValues('end_date')) form.setValue('end_date', '');
    }, [recurrence, form]);

    return (
        <>
            <FormField control={form.control} name="recurrence" render={({ field }) => (
                <FormItem>
                    <FormLabel>{t('createDialog.recurrence')}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange} disabled={readOnly}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                            <SelectItem value="once">{t('createDialog.once')}</SelectItem>
                            <SelectItem value="weekly">{t('createDialog.weekly')}</SelectItem>
                            <SelectItem value="biweekly">{t('createDialog.biweekly')}</SelectItem>
                            <SelectItem value="monthly">{t('createDialog.monthly')}</SelectItem>
                        </SelectContent>
                    </Select>
                    <FormMessage />
                </FormItem>
            )} />

            {recurrence === 'once' && (
                <FormField control={form.control} name="dates" render={({ field }) => (
                    <FormItem>
                        <FormLabel>{t('createDialog.dates')}</FormLabel>
                        <FormControl>
                            <MultiDatePicker value={field.value} onChange={field.onChange} readOnly={readOnly} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
            )}

            {recurrence !== 'once' && (
                <FormField control={form.control} name="date" render={({ field }) => (
                    <FormItem>
                        <FormLabel>{t('createDialog.startDate')}</FormLabel>
                        <FormControl>
                            {readOnly
                                ? <Input value={field.value ? formatHolidayDate(field.value) : ''} disabled />
                                : <DatePickerInput value={field.value ?? ''} onChange={field.onChange} />}
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
            )}

            {(recurrence === 'weekly' || recurrence === 'biweekly') && (
                <FormField control={form.control} name="days_of_week" render={({ field }) => (
                    <FormItem>
                        <FormLabel>{t('createDialog.daysOfWeek')}</FormLabel>
                        <FormControl>
                            <WeekdayToggleGroup value={field.value} onChange={field.onChange} disabled={readOnly} aria-label={t('createDialog.daysOfWeek')} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
            )}

            {recurrence === 'biweekly' && (
                <FormField control={form.control} name="biweekly_reference_date" render={({ field }) => (
                    <FormItem>
                        <FormLabel>{t('createDialog.biweeklyReferenceDate')}</FormLabel>
                        <FormControl><DatePickerInput value={field.value ?? ''} onChange={field.onChange} disabled={readOnly} /></FormControl>
                        <FormDescription>{t('createDialog.biweeklyReferenceDateHelp')}</FormDescription>
                        <FormMessage />
                    </FormItem>
                )} />
            )}

            {recurrence === 'monthly' && (
                <FormField control={form.control} name="days_of_month" render={({ field }) => (
                    <FormItem>
                        <FormLabel>{t('createDialog.daysOfMonth')}</FormLabel>
                        <FormControl>
                            <MonthDayGrid value={field.value} onChange={field.onChange} disabled={readOnly} aria-label={t('createDialog.daysOfMonth')} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
            )}

            {recurrence !== 'once' && (
                <FormField control={form.control} name="end_date" render={({ field }) => (
                    <FormItem>
                        <FormLabel>{t('createDialog.endDate')}</FormLabel>
                        <FormControl><DatePickerInput value={field.value ?? ''} onChange={field.onChange} disabled={readOnly} /></FormControl>
                        <FormDescription>{t('createDialog.endDateHelp')}</FormDescription>
                        <FormMessage />
                    </FormItem>
                )} />
            )}

            <FormField control={form.control} name="is_open" render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-lg border p-3">
                    <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={readOnly} /></FormControl>
                    <FormLabel className="font-normal">{t('createDialog.isOpen')}</FormLabel>
                </FormItem>
            )} />

            {sedes.length > 0 && (
                <FormField control={form.control} name="sede_id" render={({ field }) => (
                    <FormItem>
                        <FormLabel>{t('createDialog.sede')}</FormLabel>
                        <Select
                            value={field.value ? field.value : ALL_SEDES_VALUE}
                            onValueChange={(val) => field.onChange(val === ALL_SEDES_VALUE ? '' : val)}
                            disabled={readOnly}
                        >
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                                <SelectItem value={ALL_SEDES_VALUE}>{t('createDialog.allSedes')}</SelectItem>
                                {sedes.map((sede) => (
                                    <SelectItem key={sede.id} value={String(sede.id)}>{sede.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <FormDescription>{t('createDialog.sedeHelp')}</FormDescription>
                        <FormMessage />
                    </FormItem>
                )} />
            )}

            <FormField control={form.control} name="start_time" render={({ field }) => (
                <FormItem>
                    <FormLabel>{t('createDialog.startTime')}</FormLabel>
                    <FormControl><Input type="time" {...field} value={field.value ?? ''} disabled={readOnly} /></FormControl>
                    <FormMessage />
                </FormItem>
            )} />
            <FormField control={form.control} name="end_time" render={({ field }) => (
                <FormItem>
                    <FormLabel>{t('createDialog.endTime')}</FormLabel>
                    <FormControl><Input type="time" {...field} value={field.value ?? ''} disabled={readOnly} /></FormControl>
                    <FormDescription>{t('createDialog.timesHelp')}</FormDescription>
                    <FormMessage />
                </FormItem>
            )} />
            <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                    <FormLabel>{t('createDialog.notes')}</FormLabel>
                    <FormControl><Textarea {...field} value={field.value ?? ''} disabled={readOnly} placeholder={readOnly ? '' : t('createDialog.notesPlaceholder')} /></FormControl>
                    <FormMessage />
                </FormItem>
            )} />
        </>
    );
}
