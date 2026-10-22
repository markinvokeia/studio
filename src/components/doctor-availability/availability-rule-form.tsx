'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { useTranslations } from 'next-intl';
import type { UseFormReturn } from 'react-hook-form';
import * as z from 'zod';

import { DatePickerInput } from '@/components/ui/date-picker';
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MonthDayGrid, useWeekdayListLabel, WeekdayToggleGroup } from '@/components/schedules/day-pickers';

import { parseNumberList } from '@/lib/day-lists';
import { formatDate } from '@/lib/utils';
import { api, REQUEST_TIMEOUT_MS } from '@/services/api';

import { API_ROUTES } from '@/constants/routes';
import type { AvailabilityRule } from '@/lib/types';

/** Recurrences the form offers. 'daily' is legacy (migrated to weekly Mon–Fri). */
type RuleRecurrence = 'weekly' | 'biweekly' | 'monthly';

export const availabilityRuleFormSchema = (t: (key: string) => string) => z.object({
    id: z.string().optional(),
    user_id: z.string().min(1, t('doctorRequired')),
    recurrence: z.enum(['weekly', 'biweekly', 'monthly']),
    days_of_week: z.array(z.number().int().min(1).max(7)).default([]),
    days_of_month: z.array(z.number().int().min(1).max(31)).default([]),
    start_time: z.string().min(1, t('startTimeRequired')),
    end_time: z.string().min(1, t('endTimeRequired')),
    start_date: z.string().min(1, t('startDateRequired')),
    end_date: z.string().optional(),
}).refine(data => (data.recurrence !== 'weekly' && data.recurrence !== 'biweekly') || data.days_of_week.length > 0, {
    message: t('dayOfWeekRequired'),
    path: ['days_of_week'],
}).refine(data => data.recurrence !== 'monthly' || data.days_of_month.length > 0, {
    message: t('dayOfMonthRequired'),
    path: ['days_of_month'],
}).refine(data => {
    if (!data.start_time || !data.end_time) return true;
    return data.end_time > data.start_time;
}, {
    message: t('endTimeAfterStartTime'),
    path: ['end_time'],
});

export type AvailabilityRuleFormValues = z.infer<ReturnType<typeof availabilityRuleFormSchema>>;

export function emptyAvailabilityRuleForm(userId = ''): AvailabilityRuleFormValues {
    return {
        user_id: userId,
        recurrence: 'weekly',
        days_of_week: [],
        days_of_month: [],
        start_time: '',
        end_time: '',
        start_date: format(new Date(), 'yyyy-MM-dd'),
        end_date: '',
    };
}

export function availabilityRuleToFormValues(rule: AvailabilityRule): AvailabilityRuleFormValues {
    return {
        id: rule.id,
        user_id: rule.user_id,
        // A rule still stored as 'daily' opens as the weekly Mon–Fri it means.
        recurrence: rule.recurrence === 'daily' ? 'weekly' : rule.recurrence,
        days_of_week: rule.recurrence === 'daily' ? [1, 2, 3, 4, 5] : rule.days_of_week ?? [],
        days_of_month: rule.days_of_month ?? [],
        start_time: rule.start_time,
        end_time: rule.end_time,
        start_date: formatDate(rule.start_date),
        end_date: rule.end_date ? formatDate(rule.end_date) : '',
    };
}

/** Row of `availability_rules/search` → AvailabilityRule (accepts pre-139 scalar columns too). */
export function parseAvailabilityRule(raw: Record<string, unknown>): AvailabilityRule {
    const recurrence = (raw.recurrence as AvailabilityRule['recurrence']) || 'weekly';
    return {
        id: String(raw.id),
        user_id: String(raw.user_id ?? ''),
        user_name: raw.user_name ? String(raw.user_name) : undefined,
        recurrence,
        days_of_week: recurrence === 'weekly' || recurrence === 'biweekly' ? parseNumberList(raw.days_of_week, raw.day_of_week) : undefined,
        days_of_month: recurrence === 'monthly' ? parseNumberList(raw.days_of_month, raw.day_of_month) : undefined,
        biweekly_reference_date: raw.biweekly_reference_date ? formatDate(raw.biweekly_reference_date as string) : undefined,
        start_time: String(raw.start_time ?? ''),
        end_time: String(raw.end_time ?? ''),
        start_date: String(raw.start_date ?? ''),
        end_date: raw.end_date ? String(raw.end_date) : undefined,
    };
}

function throwOnErrorResponse(responseData: { error?: unknown; message?: string } | Array<{ code?: number; message?: string }>) {
    const first = Array.isArray(responseData) ? responseData[0] : undefined;
    if ((!Array.isArray(responseData) && responseData?.error) || (first?.code ?? 0) >= 400) {
        throw new Error((!Array.isArray(responseData) && responseData.message) || first?.message);
    }
}

export async function upsertAvailabilityRule(values: AvailabilityRuleFormValues) {
    const isWeekly = values.recurrence === 'weekly' || values.recurrence === 'biweekly';
    const responseData = await api.post(API_ROUTES.AVAILABILITY_RULES_UPSERT, {
        ...values,
        // Sólo viaja la lista de la recurrencia elegida; la otra va en NULL.
        days_of_week: isWeekly ? values.days_of_week : null,
        days_of_month: values.recurrence === 'monthly' ? values.days_of_month : null,
        // biweekly_reference_date no viaja: el trigger trg_availability_biweekly_calc
        // la fija siempre al lunes de la semana de start_date.
        end_date: values.end_date || null,
    }, undefined, undefined, { timeoutMs: REQUEST_TIMEOUT_MS.mutation });
    throwOnErrorResponse(responseData);
    return responseData;
}

export async function deleteAvailabilityRule(id: string) {
    const responseData = await api.delete(API_ROUTES.AVAILABILITY_RULES_DELETE, { id }, undefined, undefined, { timeoutMs: REQUEST_TIMEOUT_MS.mutation });
    throwOnErrorResponse(responseData);
    return responseData;
}

/** "Lun, Mié, Vie" / "1, 15" / "Lun–Vie" for a rule's days, for lists and the detail panel. */
export function useAvailabilityRuleDaysLabel() {
    const weekdayListLabel = useWeekdayListLabel();
    return React.useCallback((rule: AvailabilityRule) => {
        if (rule.recurrence === 'daily') return weekdayListLabel([1, 2, 3, 4, 5]);
        if (rule.recurrence === 'monthly') return rule.days_of_month?.join(', ') || '-';
        return weekdayListLabel(rule.days_of_week);
    }, [weekdayListLabel]);
}

/** Recurrence name of a rule; legacy 'daily' reads as the weekly rule it now is. */
export function ruleRecurrenceKey(rule: AvailabilityRule): RuleRecurrence {
    return rule.recurrence === 'daily' ? 'weekly' : rule.recurrence;
}

interface AvailabilityRuleFieldsProps {
    form: UseFormReturn<AvailabilityRuleFormValues>;
}

/** Recurrence, days, times and dates of a rule — the doctor picker stays with the caller. */
export function AvailabilityRuleFields({ form }: AvailabilityRuleFieldsProps) {
    const t = useTranslations('DoctorAvailabilityPage');
    const recurrence = form.watch('recurrence');

    // Switching recurrence drops the days of the previous pattern. Only touch
    // fields that hold something, so resetting to a saved rule doesn't make it dirty.
    React.useEffect(() => {
        if (recurrence !== 'weekly' && recurrence !== 'biweekly' && form.getValues('days_of_week').length) form.setValue('days_of_week', []);
        if (recurrence !== 'monthly' && form.getValues('days_of_month').length) form.setValue('days_of_month', []);
    }, [recurrence, form]);

    return (
        <>
            <FormField control={form.control} name="recurrence" render={({ field }) => (
                <FormItem>
                    <FormLabel>{t('dialog.recurrence')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder={t('dialog.selectRecurrence')} /></SelectTrigger></FormControl>
                        <SelectContent>
                            <SelectItem value="weekly">{t('dialog.weekly')}</SelectItem>
                            <SelectItem value="biweekly">{t('dialog.biweekly')}</SelectItem>
                            <SelectItem value="monthly">{t('dialog.monthly')}</SelectItem>
                        </SelectContent>
                    </Select>
                    <FormMessage />
                </FormItem>
            )} />
            {(recurrence === 'weekly' || recurrence === 'biweekly') && (
                <FormField control={form.control} name="days_of_week" render={({ field }) => (
                    <FormItem>
                        <FormLabel>{t('dialog.daysOfWeek')}</FormLabel>
                        <FormControl>
                            <WeekdayToggleGroup value={field.value} onChange={field.onChange} aria-label={t('dialog.daysOfWeek')} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
            )}
            {recurrence === 'monthly' && (
                <FormField control={form.control} name="days_of_month" render={({ field }) => (
                    <FormItem>
                        <FormLabel>{t('dialog.daysOfMonth')}</FormLabel>
                        <FormControl>
                            <MonthDayGrid value={field.value} onChange={field.onChange} aria-label={t('dialog.daysOfMonth')} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
            )}
            <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="start_time" render={({ field }) => (<FormItem><FormLabel>{t('dialog.startTime')}</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="end_time" render={({ field }) => (<FormItem><FormLabel>{t('dialog.endTime')}</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="start_date" render={({ field }) => (
                    <FormItem>
                        <FormLabel>{t('dialog.startDate')}</FormLabel>
                        <FormControl><DatePickerInput value={field.value} onChange={field.onChange} /></FormControl>
                        {recurrence === 'biweekly' && <FormDescription>{t('dialog.biweeklyStartHelp')}</FormDescription>}
                        <FormMessage />
                    </FormItem>
                )} />
                <FormField control={form.control} name="end_date" render={({ field }) => (<FormItem><FormLabel>{t('dialog.endDate')}</FormLabel><FormControl><DatePickerInput value={field.value ?? ''} onChange={field.onChange} /></FormControl><FormMessage /></FormItem>)} />
            </div>
        </>
    );
}
