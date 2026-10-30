'use client';

import { format } from 'date-fns';
import { useTranslations } from 'next-intl';
import type { UseFormReturn } from 'react-hook-form';
import * as z from 'zod';

import { Checkbox } from '@/components/ui/checkbox';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { MultiDatePicker } from '@/components/schedules/day-pickers';

import { parseDateList } from '@/lib/day-lists';
import { formatDate } from '@/lib/utils';
import { api, REQUEST_TIMEOUT_MS } from '@/services/api';

import { API_ROUTES } from '@/constants/routes';
import type { AvailabilityException } from '@/lib/types';

export const availabilityExceptionFormSchema = (t: (key: string) => string) => z.object({
    id: z.string().optional(),
    user_id: z.string().min(1, t('doctorRequired')),
    dates: z.array(z.string()).min(1, t('dateRequired')),
    start_time: z.string().optional(),
    end_time: z.string().optional(),
    is_available: z.boolean().default(false),
});

export type AvailabilityExceptionFormValues = z.infer<ReturnType<typeof availabilityExceptionFormSchema>>;

export function emptyAvailabilityExceptionForm(userId = ''): AvailabilityExceptionFormValues {
    return {
        user_id: userId,
        dates: [format(new Date(), 'yyyy-MM-dd')],
        start_time: '',
        end_time: '',
        is_available: false,
    };
}

export function availabilityExceptionToFormValues(exception: AvailabilityException): AvailabilityExceptionFormValues {
    return {
        id: exception.id,
        user_id: exception.user_id,
        dates: exception.dates,
        start_time: exception.start_time || '',
        end_time: exception.end_time || '',
        is_available: exception.is_available,
    };
}

/** Row of `availability_exceptions/search` → AvailabilityException (accepts pre-139 rows without `dates`). */
export function parseAvailabilityException(raw: Record<string, unknown>): AvailabilityException {
    const exceptionDate = raw.exception_date ? formatDate(raw.exception_date as string) : '';
    const dates = parseDateList(raw.dates, exceptionDate);
    return {
        id: String(raw.id),
        user_id: String(raw.user_id ?? ''),
        user_name: raw.user_name ? String(raw.user_name) : undefined,
        exception_date: dates[0] ?? exceptionDate,
        dates,
        start_time: (raw.start_time as string) ?? '',
        end_time: (raw.end_time as string) ?? '',
        is_available: Boolean(raw.is_available),
    };
}

function throwOnErrorResponse(responseData: { error?: unknown; message?: string } | Array<{ code?: number; message?: string }>) {
    const first = Array.isArray(responseData) ? responseData[0] : undefined;
    if ((!Array.isArray(responseData) && responseData?.error) || (first?.code ?? 0) >= 400) {
        throw new Error((!Array.isArray(responseData) && responseData.message) || first?.message);
    }
}

export async function upsertAvailabilityException(values: AvailabilityExceptionFormValues) {
    const dates = [...values.dates].sort();
    const responseData = await api.post(API_ROUTES.AVAILABILITY_EXCEPTIONS_UPSERT, {
        ...values,
        dates,
        // La fila se ordena y se busca por su primera fecha.
        exception_date: dates[0],
    }, undefined, undefined, { timeoutMs: REQUEST_TIMEOUT_MS.mutation });
    throwOnErrorResponse(responseData);
    return responseData;
}

export async function deleteAvailabilityException(id: string) {
    const responseData = await api.delete(API_ROUTES.AVAILABILITY_EXCEPTIONS_DELETE, { id }, undefined, undefined, { timeoutMs: REQUEST_TIMEOUT_MS.mutation });
    throwOnErrorResponse(responseData);
    return responseData;
}

interface AvailabilityExceptionFieldsProps {
    form: UseFormReturn<AvailabilityExceptionFormValues>;
}

/** Dates, availability and times of an exception — the doctor picker stays with the caller. */
export function AvailabilityExceptionFields({ form }: AvailabilityExceptionFieldsProps) {
    const t = useTranslations('DoctorAvailabilityExceptionsPage');
    return (
        <>
            <FormField control={form.control} name="dates" render={({ field }) => (
                <FormItem>
                    <FormLabel>{t('dialog.dates')}</FormLabel>
                    <FormControl>
                        <MultiDatePicker value={field.value} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )} />
            <FormField
                control={form.control}
                name="is_available"
                render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                        <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormLabel>{t('dialog.isAvailable')}</FormLabel>
                    </FormItem>
                )}
            />
            <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="start_time" render={({ field }) => (<FormItem><FormLabel>{t('dialog.startTime')}</FormLabel><FormControl><Input type="time" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="end_time" render={({ field }) => (<FormItem><FormLabel>{t('dialog.endTime')}</FormLabel><FormControl><Input type="time" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
            </div>
        </>
    );
}
