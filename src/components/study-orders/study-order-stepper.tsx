'use client';

import * as React from 'react';
import { ArrowRight, Ban, CalendarPlus, Check, ChevronDown, Hourglass, PackageCheck, Play, Undo2, UserCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';

import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
    AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { countPendingBlocking } from './study-order-review-list';

import { BUSINESS_CONFIG_PERMISSIONS, STUDY_ORDERS_PERMISSIONS } from '@/constants/permissions';
import { STUDY_ORDER_PATH, STUDY_ORDER_STATUSES } from '@/constants/study-order-status';
import { useAppointmentStatus } from '@/hooks/use-appointment-status';
import { usePermissions } from '@/hooks/usePermissions';
import { cn, formatDisplayDate, toLocalISOString } from '@/lib/utils';
import type {
    Appointment, AppointmentStatus, StudyOrder, StudyOrderAppointment, StudyOrderEvent, StudyOrderStatus,
} from '@/lib/types';

/**
 * Las etapas de la orden en una línea (pestaña Orden) y el botón del paso siguiente (cabecera). Quién hizo cada cambio y cuándo
 * está en Actividad.
 *
 * De Paciente presente a Estudio completado el botón cambia la CITA y la orden la sigue: así la
 * agenda y la orden no pueden decir cosas distintas.
 */

/** Eventos anteriores a `status_changed` que equivalen a llegar a un estado. */
const LEGACY_EVENT_STATUS: Partial<Record<StudyOrderEvent['event_type'], StudyOrderStatus>> = {
    created: 'draft',
    submitted: 'confirmed',
    completed: 'completed',
    cancelled: 'cancelled',
};

/** La última vez que la orden llegó a cada estado. */
function lastEntryByStatus(events: StudyOrderEvent[]): Map<StudyOrderStatus, StudyOrderEvent> {
    const map = new Map<StudyOrderStatus, StudyOrderEvent>();
    for (const event of events) {
        const status = event.event_type === 'status_changed'
            ? (event.metadata?.to as StudyOrderStatus | undefined)
            : LEGACY_EVENT_STATUS[event.event_type];
        if (status) map.set(status, event);
    }
    return map;
}

interface StepAction {
    key: string;
    label: string;
    icon: React.ElementType;
    run: () => void;
    disabledReason?: string;
}

/** Un cambio de cita que espera confirmación porque la cita no es de hoy. */
interface PendingMove {
    appointment: StudyOrderAppointment;
    to: AppointmentStatus;
}

const WAITING: AppointmentStatus[] = ['pending', 'scheduled', 'confirmed'];
const PRESENT: AppointmentStatus[] = ['arrived', 'arrived_late'];
const EXECUTING: AppointmentStatus[] = ['in_progress', 'attended_late'];

/** `HH:mm` sin pasar por Date: el string viene sin zona y convertirlo la corre. */
const timeOf = (iso: string) => (iso.replace('Z', '').split(/[T ]/)[1] ?? '').slice(0, 5);

/** La línea de etapas. */
export function StudyOrderStepper({ order }: { order: StudyOrder }) {
    const t = useTranslations('StudyOrdersPage');

    const entries = React.useMemo(() => lastEntryByStatus(order.events ?? []), [order.events]);
    const isCancelled = order.status === 'cancelled';
    const cancelledEvent = entries.get('cancelled');
    // Cancelada: hasta dónde había llegado, según el último cambio de estado.
    const reached = (isCancelled ? cancelledEvent?.metadata?.from : order.status) as StudyOrderStatus | undefined;
    const currentIndex = STUDY_ORDER_STATUSES.indexOf(reached ?? 'draft');

    // Que la etapa actual se vea aunque la línea no entre entera. Se mueve solo la línea, no la página.
    const lineRef = React.useRef<HTMLOListElement>(null);
    const currentRef = React.useRef<HTMLLIElement>(null);
    React.useEffect(() => {
        const line = lineRef.current;
        const step = currentRef.current;
        if (line && step) line.scrollLeft = step.offsetLeft - (line.clientWidth - step.clientWidth) / 2;
    }, [order.id, currentIndex]);

    return (
        <section aria-label={t('progress.title')} className="space-y-2.5 rounded-lg border p-3">
            {isCancelled && (
                <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    <Ban className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <div className="min-w-0">
                        <p className="font-medium">{t('status.cancelled')}</p>
                        {order.cancellation_reason && <p className="break-words">{order.cancellation_reason}</p>}
                    </div>
                </div>
            )}

            <ol
                ref={lineRef}
                className="relative flex overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
                {STUDY_ORDER_PATH.map((status, index) => {
                    const isCurrent = !isCancelled && index === currentIndex;
                    const isPast = index < currentIndex || (isCancelled && index === currentIndex);
                    // Agenda pendiente se puede saltear: si no pasó por ahí, no se marca como hecha.
                    const isDone = isPast && (entries.has(status) || status !== 'pending_scheduling');
                    const reachedLine = index <= currentIndex;
                    return (
                        <li
                            key={status}
                            ref={index === currentIndex ? currentRef : undefined}
                            aria-current={isCurrent ? 'step' : undefined}
                            className="relative min-w-[4.25rem] flex-1 px-0.5 text-center"
                        >
                            {index > 0 && (
                                <span
                                    aria-hidden="true"
                                    className={cn(
                                        'absolute right-1/2 top-[11px] h-0.5 w-full transition-colors duration-300 motion-reduce:transition-none',
                                        reachedLine ? (isCancelled ? 'bg-destructive/40' : 'bg-primary') : 'bg-border',
                                    )}
                                />
                            )}
                            <span
                                aria-hidden="true"
                                className={cn(
                                    'relative z-10 mx-auto grid h-6 w-6 place-items-center rounded-full border-2 bg-card text-[11px] font-semibold tabular-nums transition-colors duration-300 motion-reduce:transition-none',
                                    isCurrent && 'border-primary bg-primary text-primary-foreground ring-4 ring-primary/15',
                                    isDone && !isCancelled && 'border-primary text-primary',
                                    isDone && isCancelled && 'border-destructive/40 text-destructive',
                                    !isCurrent && !isDone && 'border-border text-muted-foreground',
                                )}
                            >
                                {isDone ? <Check className="h-3.5 w-3.5" /> : index + 1}
                            </span>
                            <p className={cn('mt-1 text-[11px] leading-tight', isCurrent ? 'font-semibold text-primary' : !isDone && 'text-muted-foreground')}>
                                {t(`status.${status}`)}
                            </p>
                        </li>
                    );
                })}
            </ol>
        </section>
    );
}

export interface StudyOrderNextStepProps {
    order: StudyOrder;
    scope: 'clinic' | 'mine';
    readOnly?: boolean;
    onConfirm?: () => void;
    onMarkPending?: () => void;
    onSchedule?: () => void;
    onDeliver?: () => void;
    /** Cambió una cita: hay que volver a pedir la orden. */
    onChanged: () => void;
}

/** El botón del paso siguiente, con las alternativas y volver atrás en el desplegable. */
export function StudyOrderNextStep({
    order, scope, readOnly = false, onConfirm, onMarkPending, onSchedule, onDeliver, onChanged,
}: StudyOrderNextStepProps) {
    const t = useTranslations('StudyOrdersPage');
    const { hasPermission } = usePermissions();
    const { updateStatus, isUpdating } = useAppointmentStatus({ onSuccess: onChanged });
    const [pendingMove, setPendingMove] = React.useState<PendingMove | null>(null);

    const applyMove = ({ appointment, to }: PendingMove) => {
        void updateStatus({
            appointment: {
                id: appointment.id,
                status: appointment.status,
                googleEventId: appointment.google_event_id ?? undefined,
                calendar_source_id: appointment.calendar_source_id ?? undefined,
                patientId: order.patient_id,
                patientName: order.patient_name,
            } as unknown as Appointment,
            newStatus: to,
        });
    };

    const requestMove = (move: PendingMove) => {
        const isToday = move.appointment.start_datetime.slice(0, 10) === toLocalISOString(new Date()).slice(0, 10);
        if (isToday) applyMove(move);
        else setPendingMove(move);
    };

    // ── Qué se puede hacer ahora ─────────────────────────────────────────────
    const forward: StepAction[] = [];
    const back: StepAction[] = [];

    if (!readOnly) {
        const isClinic = scope === 'clinic';
        const appointments = order.appointments ?? [];
        const activeItems = order.items.filter((i) => !i.is_cancelled);
        const hasUnscheduled = activeItems.some((i) => !i.is_scheduled);
        const canMoveAppointments = isClinic && hasPermission(BUSINESS_CONFIG_PERMISSIONS.APPOINTMENT_STATUS_UPDATE);

        /** Una acción por cita; con más de una, cada etiqueta dice cuál. */
        const appointmentActions = (
            from: AppointmentStatus[], to: AppointmentStatus, label: string, icon: React.ElementType,
        ): StepAction[] => {
            if (!canMoveAppointments) return [];
            const candidates = appointments.filter((a) => from.includes(a.status));
            return candidates.map((appointment) => ({
                key: `${to}-${appointment.id}`,
                label: candidates.length > 1
                    ? t('stepper.forAppointment', {
                        action: label,
                        date: `${formatDisplayDate(appointment.start_datetime)} ${timeOf(appointment.start_datetime)}`,
                    })
                    : label,
                icon,
                run: () => requestMove({ appointment, to }),
            }));
        };
        const arrive = () => appointmentActions(WAITING, 'arrived', t('stepper.arrive'), UserCheck);
        const start = () => appointmentActions(PRESENT, 'in_progress', t('stepper.start'), Play);
        const finish = () => appointmentActions(EXECUTING, 'completed', t('stepper.finish'), Check);
        const schedule: StepAction[] = isClinic && hasUnscheduled && onSchedule && hasPermission(STUDY_ORDERS_PERMISSIONS.SCHEDULE)
            ? [{ key: 'schedule', label: t('actions.schedule'), icon: CalendarPlus, run: onSchedule }]
            : [];

        switch (order.status) {
            case 'draft': {
                const blocking = countPendingBlocking(order.review_items);
                if (onConfirm && hasPermission(STUDY_ORDERS_PERMISSIONS.SUBMIT)) {
                    forward.push({
                        key: 'confirm', label: t('actions.submit'), icon: Check, run: onConfirm,
                        disabledReason: blocking > 0 ? t('review.submitBlocked', { count: blocking }) : undefined,
                    });
                }
                break;
            }
            case 'confirmed':
                forward.push(...schedule);
                if (isClinic && onMarkPending
                    && (hasPermission(STUDY_ORDERS_PERMISSIONS.SCHEDULE) || hasPermission(STUDY_ORDERS_PERMISSIONS.ACKNOWLEDGE))) {
                    forward.push({ key: 'pending', label: t('actions.markPending'), icon: Hourglass, run: onMarkPending });
                }
                break;
            case 'pending_scheduling':
                forward.push(...schedule, ...arrive());
                break;
            case 'scheduled':
                forward.push(...arrive());
                break;
            case 'patient_present':
                forward.push(...start(), ...arrive());
                back.push(...appointmentActions(PRESENT, 'confirmed', t('stepper.undoArrive'), Undo2));
                break;
            case 'in_execution':
                forward.push(...finish(), ...start(), ...arrive(), ...schedule);
                back.push(...appointmentActions(EXECUTING, 'arrived', t('stepper.undoStart'), Undo2));
                break;
            case 'completed':
                if (isClinic && onDeliver && hasPermission(STUDY_ORDERS_PERMISSIONS.DELIVER)) {
                    forward.push({ key: 'deliver', label: t('actions.deliver'), icon: PackageCheck, run: onDeliver });
                }
                back.push(...appointmentActions(['completed'], 'in_progress', t('stepper.undoFinish'), Undo2));
                break;
        }
    }

    const [primary, ...rest] = forward;
    const PrimaryIcon = primary?.icon ?? ArrowRight;
    const hasMenu = rest.length > 0 || back.length > 0;

    return (
        <>
            {(primary || hasMenu) && (
                <div className="flex items-center">
                    <div className="flex items-center gap-1">
                        {primary && (
                            <Button
                                size="sm"
                                className="h-8 px-3"
                                loading={isUpdating}
                                disabled={!!primary.disabledReason}
                                title={primary.disabledReason ?? t('stepper.next')}
                                onClick={primary.run}
                                data-testid="study-order-next-step"
                            >
                                {!isUpdating && <PrimaryIcon className="mr-2 h-4 w-4" aria-hidden="true" />}
                                {primary.label}
                            </Button>
                        )}
                        {hasMenu && (
                            <DropdownMenu modal={false}>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className={cn('h-8', primary ? 'px-2' : 'px-3')}
                                        disabled={isUpdating}
                                        aria-label={t('stepper.more')}
                                        title={t('stepper.more')}
                                    >
                                        {!primary && t('stepper.more')}
                                        <ChevronDown className={cn('h-4 w-4', !primary && 'ml-1.5')} aria-hidden="true" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-72">
                                    {rest.map(({ key, label, icon: Icon, run }) => (
                                        <DropdownMenuItem key={key} onSelect={run} className="gap-2">
                                            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                                            {label}
                                        </DropdownMenuItem>
                                    ))}
                                    {rest.length > 0 && back.length > 0 && <DropdownMenuSeparator />}
                                    {back.map(({ key, label, icon: Icon, run }) => (
                                        <DropdownMenuItem key={key} onSelect={run} className="gap-2 text-muted-foreground">
                                            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                                            {label}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </div>
                </div>
            )}

            <AlertDialog open={!!pendingMove} onOpenChange={(open) => !open && setPendingMove(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('stepper.otherDay.title')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {pendingMove && t('stepper.otherDay.description', {
                                date: `${formatDisplayDate(pendingMove.appointment.start_datetime)} ${timeOf(pendingMove.appointment.start_datetime)}`,
                            })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('stepper.otherDay.cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (pendingMove) applyMove(pendingMove);
                                setPendingMove(null);
                            }}
                        >
                            {t('stepper.otherDay.confirm')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

export default StudyOrderStepper;
