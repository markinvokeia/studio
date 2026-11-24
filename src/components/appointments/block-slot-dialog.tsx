'use client';

import React from 'react';
import Link from 'next/link';
import { zodResolver } from '@hookform/resolvers/zod';
import { format, parseISO } from 'date-fns';
import { AlertTriangle, Ban, ExternalLink } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useForm, useWatch } from 'react-hook-form';

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

import {
    enableSlotSchema as slotWindowSchema,
    formatIntervals,
    hhmmToMinutes,
    type EnableSlotPermissions,
} from '@/components/appointments/enable-slot-dialog';
import { minutesToTimeString, planSlotBlock, type Interval, type OpeningChange } from '@/components/calendar/calendar-gaps';
import { HelpScopeProvider } from '@/components/help/help-scope';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/lib/error-utils';
import { formatDisplayDateWithWeekday } from '@/lib/utils';
import { isTimeoutError } from '@/services/api';
import { deleteClinicException, upsertClinicException } from '@/services/clinic-exceptions';

import { API_ROUTES } from '@/constants/routes';
import type { Appointment, ClinicException, ClinicSchedule } from '@/lib/types';

/** Day/branch the user right-clicked, with what the closure has to be planned against. */
export interface BlockSlotTarget {
    day: Date;
    /** Branch the closure is for; undefined = every branch. */
    sedeId?: string;
    sedeName?: string;
    /** The clinic has a single branch: its clinic-wide openings can be edited. */
    singleBranch: boolean;
    schedules: ClinicSchedule[];
    /** The whole clinic's exceptions, not just the scope's (see `planSlotBlock`). */
    exceptions: ClinicException[];
    /** Calendars the closure reaches: the ones to look for appointments in. */
    calendarIds: string[];
    /** Suggested window, in minutes from midnight. */
    initialStartMin: number;
    initialEndMin: number;
}

interface BlockSlotDialogProps {
    target: BlockSlotTarget | null;
    permissions: EnableSlotPermissions;
    onOpenChange: (open: boolean) => void;
    /** Reloads the clinic exceptions so the calendar reflects the closure. */
    onBlocked: () => Promise<void>;
    /** The day's appointments in the target's calendars, visible or not. */
    loadDayAppointments: (target: BlockSlotTarget) => Promise<Appointment[]>;
}

/** Same statuses `get_available_users()` doesn't count as taking up the time. */
const INACTIVE_STATUSES = new Set(['cancelled', 'canceled', 'declined', 'no_show', 'deleted']);
const MAX_LISTED_APPOINTMENTS = 5;

/** Minutes the appointment takes up on its day, or null if its times are unusable. */
function appointmentWindow(appointment: Appointment): Interval | null {
    const startMin = hhmmToMinutes(appointment.time);
    const rawEnd = appointment.end?.dateTime;
    if (startMin === null || !rawEnd) return null;
    const end = parseISO(rawEnd.replace(/Z$/, ''));
    if (isNaN(end.getTime())) return null;
    const endMin = format(end, 'yyyy-MM-dd') === appointment.date ? end.getHours() * 60 + end.getMinutes() : 24 * 60;
    return { startMin, endMin };
}

export function BlockSlotDialog({ target, permissions, onOpenChange, onBlocked, loadDayAppointments }: BlockSlotDialogProps) {
    const t = useTranslations('AppointmentsPage.blockSlot');
    const tCommon = useTranslations('Common');
    const locale = useLocale();
    const { toast } = useToast();
    const [submissionError, setSubmissionError] = React.useState<string | null>(null);
    // null = todavía cargando: la lista de citas decide si se puede confirmar.
    const [dayAppointments, setDayAppointments] = React.useState<Appointment[] | null>(null);
    const [appointmentsFailed, setAppointmentsFailed] = React.useState(false);

    const form = useForm<{ start_time: string; end_time: string; notes?: string }>({
        resolver: zodResolver(slotWindowSchema(t)),
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

    React.useEffect(() => {
        if (!target) return;
        let cancelled = false;
        setDayAppointments(null);
        setAppointmentsFailed(false);
        loadDayAppointments(target)
            .then((rows) => { if (!cancelled) setDayAppointments(rows); })
            .catch(() => {
                if (cancelled) return;
                setDayAppointments([]);
                setAppointmentsFailed(true);
            });
        return () => { cancelled = true; };
    }, [target, loadDayAppointments]);

    const startTime = useWatch({ control: form.control, name: 'start_time' });
    const endTime = useWatch({ control: form.control, name: 'end_time' });
    const notes = useWatch({ control: form.control, name: 'notes' });

    const blocked = React.useMemo<Interval | null>(() => {
        const startMin = hhmmToMinutes(startTime);
        const rawEnd = hhmmToMinutes(endTime);
        if (startMin === null || rawEnd === null || rawEnd <= startMin) return null;
        // 23:59 means "until the end of the day", as everywhere else in the calendar.
        return { startMin, endMin: rawEnd >= 24 * 60 - 1 ? 24 * 60 : rawEnd };
    }, [startTime, endTime]);

    const plan = React.useMemo(() => {
        if (!target || !blocked) return null;
        return planSlotBlock(target.day, target.schedules, target.exceptions, blocked, {
            sedeId: target.sedeId,
            singleBranch: target.singleBranch,
            notes: notes?.trim() || t('defaultNote'),
        });
    }, [target, blocked, notes, t]);

    const affectedAppointments = React.useMemo(() => {
        if (!blocked || !dayAppointments) return [];
        return dayAppointments.flatMap((appointment) => {
            if (INACTIVE_STATUSES.has(appointment.status)) return [];
            const window = appointmentWindow(appointment);
            if (!window || window.startMin >= blocked.endMin || window.endMin <= blocked.startMin) return [];
            return [{ appointment, window }];
        }).sort((a, b) => a.window.startMin - b.window.startMin);
    }, [dayAppointments, blocked]);

    // Every kind of write the plan makes needs its own permission.
    const missingPermission = !!plan && plan.writes.some((w) => !permissions[w.type]);

    const save = useAsyncAction(
        async () => {
            if (!plan) return;
            const total = plan.writes.length;
            let done = 0;
            try {
                // The closure goes first: stopping halfway never leaves the day more
                // open than it was (see `planSlotBlock`).
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
                await onBlocked();
                onOpenChange(false);
            },
            onError: (error) => {
                setSubmissionError(isTimeoutError(error) ? tCommon('timeoutError') : getErrorMessage(error) || tCommon('genericError'));
                // The backend may have applied some writes: show what it actually has.
                void onBlocked().catch(() => undefined);
            },
            showErrorToast: false,
        },
    );

    const dateLabel = target ? formatDisplayDateWithWeekday(format(target.day, 'yyyy-MM-dd'), locale) : '';
    const sedeLabel = target?.sedeName || t('thisBranch');
    const scopeLabel = target?.sedeId ? sedeLabel : t('allBranches');
    const openingName = (e: ClinicException) => e.notes?.trim() || t('unnamedOpening');

    const describeChange = (change: OpeningChange) => {
        const name = openingName(change.exception);
        if (change.otherDates > 0) {
            return change.remaining.length > 0
                ? t('changes.removeDatePartial', { name, count: change.otherDates, hours: formatIntervals(change.remaining) })
                : t('changes.removeDate', { name, count: change.otherDates });
        }
        return change.remaining.length > 0
            ? t('changes.trimOpening', { name, hours: formatIntervals(change.remaining) })
            : t('changes.liftOpening', { name });
    };

    const hasLocked = !!plan && plan.locked.length > 0;
    const checkingAppointments = dayAppointments === null;

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
                        <Ban className="h-5 w-5" />
                        {t('title')}
                    </DialogTitle>
                    <DialogDescription>{t('description', { date: dateLabel, scope: scopeLabel })}</DialogDescription>
                </DialogHeader>
                <HelpScopeProvider scope="appointments.block-slot">
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

                            {target && (
                                <p className="text-sm font-medium">
                                    {target.sedeId ? t('scopeBranch', { name: sedeLabel }) : t('scopeAll')}
                                </p>
                            )}

                            {plan && plan.openingChanges.length > 0 && (
                                <div className="space-y-1 rounded-md bg-muted px-3 py-2 text-sm">
                                    <p className="font-medium">{t('changes.title')}</p>
                                    <ul className="list-disc space-y-0.5 pl-5">
                                        {plan.openingChanges.map((change) => (
                                            <li key={change.exception.id}>{describeChange(change)}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {checkingAppointments && (
                                <p className="text-sm text-muted-foreground">{t('appointments.checking')}</p>
                            )}
                            {appointmentsFailed && (
                                <Alert variant="warning">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertDescription>{t('appointments.checkFailed')}</AlertDescription>
                                </Alert>
                            )}
                            {affectedAppointments.length > 0 && (
                                <Alert variant="warning" data-help-id="appointments.block-slot.section.affected-appointments">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertDescription className="space-y-1">
                                        <p>{t('appointments.title', { count: affectedAppointments.length })}</p>
                                        <ul className="list-disc space-y-0.5 pl-5">
                                            {affectedAppointments.slice(0, MAX_LISTED_APPOINTMENTS).map(({ appointment, window }) => (
                                                <li key={appointment.id}>
                                                    {formatIntervals([window])} · {appointment.patientName}
                                                </li>
                                            ))}
                                        </ul>
                                        {affectedAppointments.length > MAX_LISTED_APPOINTMENTS && (
                                            <p>{t('appointments.more', { count: affectedAppointments.length - MAX_LISTED_APPOINTMENTS })}</p>
                                        )}
                                    </AlertDescription>
                                </Alert>
                            )}

                            {plan && hasLocked && (
                                <Alert variant="warning">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertDescription className="space-y-1">
                                        <p>{t('locked.title')}</p>
                                        <ul className="list-disc space-y-0.5 pl-5">
                                            {plan.locked.map(({ exception, reason }) => (
                                                <li key={exception.id}>
                                                    {reason === 'recurring'
                                                        ? t('locked.recurring', { name: openingName(exception) })
                                                        : t('locked.otherScope', { name: openingName(exception) })}
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
                                    <p className="text-sm text-muted-foreground">{t('alreadyClosed')}</p>
                                )
                            )}
                            {missingPermission && (
                                <p className="text-sm text-destructive">{t('missingPermission')}</p>
                            )}
                            <p className="text-xs text-muted-foreground">{t('hint')}</p>
                        </DialogBody>
                        <DialogFooter>
                            <DialogCancelButton disabled={save.isPending}>{t('cancel')}</DialogCancelButton>
                            <Button
                                type="submit"
                                loading={save.isPending}
                                disabled={!plan?.changesSomething || missingPermission || hasLocked || checkingAppointments}
                            >
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
