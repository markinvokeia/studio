'use client';

import React from 'react';
import Link from 'next/link';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { AlertTriangle, CalendarClock, ExternalLink } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogBody,
    DialogCancelButton,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

import { HelpScopeProvider } from '@/components/help/help-scope';
import { minutesToTimeString, planSlotEnable, type ClosureChange, type Interval } from '@/components/calendar/calendar-gaps';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/lib/error-utils';
import { formatDisplayDateWithWeekday } from '@/lib/utils';
import { isTimeoutError } from '@/services/api';
import { deleteClinicException, upsertClinicException } from '@/services/clinic-exceptions';

import { API_ROUTES } from '@/constants/routes';
import type { ClinicException, ClinicSchedule } from '@/lib/types';

/** Day/branch the user right-clicked, with the hours that apply to it. */
export interface EnableSlotTarget {
    day: Date;
    /** Branch the change is made for; undefined = every branch. */
    sedeId?: string;
    sedeName?: string;
    /** The clinic has a single branch: its clinic-wide closures can be edited. */
    singleBranch: boolean;
    schedules: ClinicSchedule[];
    exceptions: ClinicException[];
    /** Suggested window, in minutes from midnight. */
    initialStartMin: number;
    initialEndMin: number;
}

/** Which writes on Horarios de excepción the user may make. */
export interface EnableSlotPermissions {
    create: boolean;
    update: boolean;
    delete: boolean;
}

interface EnableSlotDialogProps {
    target: EnableSlotTarget | null;
    permissions: EnableSlotPermissions;
    onOpenChange: (open: boolean) => void;
    /** Reloads the clinic exceptions so the calendar reflects the new hours. */
    onEnabled: () => Promise<void>;
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function hhmmToMinutes(value: string): number | null {
    if (!TIME_RE.test(value)) return null;
    const [h, m] = value.split(':').map(Number);
    return h * 60 + m;
}

function formatIntervals(intervals: Interval[]): string {
    return intervals
        .map((i) => `${minutesToTimeString(i.startMin)}–${i.endMin >= 24 * 60 ? '24:00' : minutesToTimeString(i.endMin)}`)
        .join(', ');
}

const enableSlotSchema = (t: (key: string) => string) => z.object({
    start_time: z.string().regex(TIME_RE, t('validation.time')),
    end_time: z.string().regex(TIME_RE, t('validation.time')),
    notes: z.string().max(200).optional(),
}).refine((v) => (hhmmToMinutes(v.end_time) ?? 0) > (hhmmToMinutes(v.start_time) ?? 0), {
    path: ['end_time'],
    message: t('validation.endAfterStart'),
});

type EnableSlotFormValues = z.infer<ReturnType<typeof enableSlotSchema>>;

export function EnableSlotDialog({ target, permissions, onOpenChange, onEnabled }: EnableSlotDialogProps) {
    const t = useTranslations('AppointmentsPage.enableSlot');
    const tCommon = useTranslations('Common');
    const locale = useLocale();
    const { toast } = useToast();
    const [submissionError, setSubmissionError] = React.useState<string | null>(null);

    const form = useForm<EnableSlotFormValues>({
        resolver: zodResolver(enableSlotSchema(t)),
        defaultValues: { start_time: '', end_time: '', notes: '' },
    });

    React.useEffect(() => {
        if (!target) return;
        setSubmissionError(null);
        form.reset({
            start_time: minutesToTimeString(target.initialStartMin),
            end_time: minutesToTimeString(target.initialEndMin),
            notes: '',
        });
    }, [target, form]);

    const startTime = useWatch({ control: form.control, name: 'start_time' });
    const endTime = useWatch({ control: form.control, name: 'end_time' });
    const notes = useWatch({ control: form.control, name: 'notes' });
    const plan = React.useMemo(() => {
        if (!target) return null;
        const startMin = hhmmToMinutes(startTime);
        const rawEnd = hhmmToMinutes(endTime);
        if (startMin === null || rawEnd === null || rawEnd <= startMin) return null;
        // 23:59 means "until the end of the day", as everywhere else in the calendar.
        const endMin = rawEnd >= 24 * 60 - 1 ? 24 * 60 : rawEnd;
        return planSlotEnable(target.day, target.schedules, target.exceptions, { startMin, endMin }, {
            sedeId: target.sedeId,
            singleBranch: target.singleBranch,
            openingNotes: notes?.trim() || t('defaultNote'),
        });
    }, [target, startTime, endTime, notes, t]);

    // Every kind of write the plan makes needs its own permission.
    const missingPermission = !!plan && plan.writes.some((w) => !permissions[w.type]);

    const save = useAsyncAction(
        async () => {
            if (!plan) return;
            const total = plan.writes.length;
            let done = 0;
            try {
                // `writes` is ordered so stopping halfway leaves the day LESS open
                // than asked, never more (see `planSlotEnable`).
                for (const write of plan.writes) {
                    if (write.type === 'delete') await deleteClinicException(write.exception.id);
                    else await upsertClinicException(write.exception);
                    done += 1;
                }
            } catch (error) {
                if (done > 0 && !isTimeoutError(error)) {
                    throw new Error(t('partialError', { saved: done, total }));
                }
                throw error;
            }
        },
        {
            onSuccess: async () => {
                toast({ title: t('successTitle'), description: plan ? t('successDescription', { hours: formatIntervals(plan.resulting) || t('closedAllDay') }) : undefined });
                await onEnabled();
                onOpenChange(false);
            },
            onError: (error) => {
                setSubmissionError(isTimeoutError(error) ? tCommon('timeoutError') : getErrorMessage(error) || tCommon('genericError'));
                // The backend may have applied some writes: show what it actually has.
                void onEnabled().catch(() => undefined);
            },
            showErrorToast: false,
        },
    );

    const dateLabel = target ? formatDisplayDateWithWeekday(format(target.day, 'yyyy-MM-dd'), locale) : '';
    const scopeLabel = target?.sedeId ? (target.sedeName || t('thisBranch')) : t('allBranches');
    const closureName = (e: ClinicException) => e.notes?.trim() || t('unnamedClosure');

    const describeChange = (change: ClosureChange) => {
        const name = closureName(change.exception);
        // `remaining` is clipped to the day's hours; the saved rows may still close
        // time outside them (so "closed except …" survives a schedule change).
        if (change.otherDates > 0) {
            if (change.remaining.length > 0) {
                return t('changes.removeDatePartial', { name, count: change.otherDates, hours: formatIntervals(change.remaining) });
            }
            return change.closedOutsideHours
                ? t('changes.removeDateOutsideHours', { name, count: change.otherDates })
                : t('changes.removeDate', { name, count: change.otherDates });
        }
        if (change.remaining.length > 0) {
            return t('changes.trimClosure', { name, hours: formatIntervals(change.remaining) });
        }
        return change.closedOutsideHours
            ? t('changes.closedOutsideHours', { name })
            : t('changes.liftClosure', { name });
    };

    return (
        <Dialog
            open={!!target}
            onOpenChange={(next) => {
                if (!next && save.isPending) return;
                onOpenChange(next);
            }}
        >
            <DialogContent className="sm:max-w-md" confirmOnClose isDirty={form.formState.isDirty}>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CalendarClock className="h-5 w-5 text-primary" />
                        {t('title')}
                    </DialogTitle>
                    <DialogDescription>{t('description', { date: dateLabel, scope: scopeLabel })}</DialogDescription>
                </DialogHeader>
                <HelpScopeProvider scope="appointments.enable-slot">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(() => save.run())}>
                        <DialogBody className="space-y-4 px-6 py-4">
                            {submissionError && (
                                <Alert variant="destructive">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertDescription>{submissionError}</AlertDescription>
                                </Alert>
                            )}
                            <fieldset disabled={save.isPending} className="min-w-0 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField control={form.control} name="start_time" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('startTime')}</FormLabel>
                                            <FormControl><Input type="time" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="end_time" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('endTime')}</FormLabel>
                                            <FormControl><Input type="time" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </div>
                                <FormField control={form.control} name="notes" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('notes')}</FormLabel>
                                        <FormControl>
                                            <Textarea rows={2} placeholder={t('notesPlaceholder')} {...field} value={field.value ?? ''} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </fieldset>

                            {plan && (plan.closureChanges.length > 0 || plan.extendsHours) && (
                                <div className="space-y-1 rounded-md bg-muted px-3 py-2 text-sm">
                                    <p className="font-medium">{t('changes.title')}</p>
                                    <ul className="list-disc space-y-0.5 pl-5">
                                        {plan.closureChanges.map((change) => (
                                            <li key={change.exception.id}>{describeChange(change)}</li>
                                        ))}
                                        {plan.extendsHours && <li>{t('changes.extendHours')}</li>}
                                    </ul>
                                </div>
                            )}

                            {plan && plan.locked.length > 0 && target && (
                                <Alert variant="warning">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertDescription className="space-y-1">
                                        <p>{t('locked.title')}</p>
                                        <ul className="list-disc space-y-0.5 pl-5">
                                            {plan.locked.map(({ exception, reason }) => (
                                                <li key={exception.id}>
                                                    {reason === 'recurring'
                                                        ? t('locked.recurring', { name: closureName(exception) })
                                                        : t('locked.otherScope', { name: closureName(exception) })}
                                                </li>
                                            ))}
                                        </ul>
                                        <Link
                                            href={`/${locale}${API_ROUTES.CONFIG.HOLIDAYS}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 font-medium underline underline-offset-2"
                                        >
                                            {t('locked.link')}
                                            <ExternalLink className="h-3 w-3" />
                                        </Link>
                                    </AlertDescription>
                                </Alert>
                            )}

                            {plan && (
                                plan.changesSomething ? (
                                    <p className="text-sm">
                                        {t('resultingHours', { hours: formatIntervals(plan.resulting) || t('closedAllDay') })}
                                    </p>
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        {plan.locked.length > 0 ? t('nothingEditable') : t('alreadyOpen')}
                                    </p>
                                )
                            )}
                            {missingPermission && (
                                <p className="text-sm text-destructive">{t('missingPermission')}</p>
                            )}
                            <p className="text-xs text-muted-foreground">{t('hint')}</p>
                        </DialogBody>
                        <DialogFooter>
                            <DialogCancelButton disabled={save.isPending}>{t('cancel')}</DialogCancelButton>
                            <Button type="submit" loading={save.isPending} disabled={!plan?.changesSomething || missingPermission}>
                                {t('confirm')}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
                </HelpScopeProvider>
            </DialogContent>
        </Dialog>
    );
}
