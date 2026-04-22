'use client';

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { DatePickerInput } from '@/components/ui/date-picker';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type {
    AvailabilityResult,
    SessionPrefillData,
    StepCascadeMode,
    TreatmentSequence,
    TreatmentSequenceStatus,
    TreatmentSequenceStep,
    TreatmentSequenceStepStatus,
} from '@/lib/types';
import { cn } from '@/lib/utils';
import { API_ROUTES } from '@/constants/routes';
import { api } from '@/services/api';
import {
    changeStepStatus,
    deleteTreatmentStep,
    getTreatmentSequences,
    scheduleStep,
    upsertTreatmentStep,
    validateStepsAvailability,
} from '@/services/treatment-plans';
import { format, differenceInDays, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
    AlertTriangle,
    CalendarCheck,
    CalendarPlus,
    CalendarSearch,
    CheckCircle2,
    ClipboardCheck,
    ChevronDown,
    ChevronRight,
    Circle,
    ClipboardList,
    Eye,
    EyeOff,
    Loader2,
    MoreHorizontal,
    Pencil,
    Phone,
    PlusCircle,
    Stethoscope,
    Trash2,
    XCircle,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

interface UserTreatmentPlansProps {
    userId: string;
    userName?: string;
    onCreateAppointment?: () => void;
    onViewAppointment?: (appointmentId: string, scheduledDate?: string, serviceId?: string, serviceName?: string) => void;
    onViewSession?: (sesionId: number) => void;
    onStepCompleted?: (data: SessionPrefillData) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sequenceStatusVariant(status: TreatmentSequenceStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
    switch (status) {
        case 'active': return 'default';
        case 'completed': return 'secondary';
        case 'cancelled': return 'destructive';
        case 'paused': return 'outline';
    }
}

function formatShortDate(dateStr?: string | null): string {
    if (!dateStr) return '—';
    try { return format(parseISO(dateStr), 'd MMM', { locale: es }); } catch { return dateStr; }
}

function formatLongDate(dateStr?: string | null): string {
    if (!dateStr) return '—';
    try { return format(parseISO(dateStr), 'd LLL yyyy', { locale: es }); } catch { return dateStr; }
}

function stepStatusIcon(status: TreatmentSequenceStepStatus, cls?: string) {
    const c = cls ?? 'h-4 w-4 shrink-0';
    switch (status) {
        case 'completed': return <CheckCircle2 className={cn(c, 'text-emerald-500')} />;
        case 'scheduled': return <CalendarCheck className={cn(c, 'text-blue-500')} />;
        case 'missed':    return <XCircle className={cn(c, 'text-destructive')} />;
        case 'cancelled': return <XCircle className={cn(c, 'text-muted-foreground')} />;
        default:          return <Circle className={cn(c, 'text-muted-foreground')} />;
    }
}

function stepStatusClass(status: TreatmentSequenceStepStatus): string {
    switch (status) {
        case 'completed': return 'text-emerald-600 dark:text-emerald-400';
        case 'scheduled': return 'text-blue-600 dark:text-blue-400';
        case 'missed':    return 'text-destructive';
        case 'cancelled': return 'text-muted-foreground line-through';
        default:          return 'text-muted-foreground';
    }
}

const STEP_STATUS_OPTIONS: TreatmentSequenceStepStatus[] = ['pending', 'scheduled', 'completed', 'missed', 'cancelled'];

function StepStatusBadge({
    status,
    t,
}: {
    status: TreatmentSequenceStepStatus;
    t: ReturnType<typeof useTranslations>;
}) {
    const label = t(`stepStatus.${status}`);
    switch (status) {
        case 'completed':
            return (
                <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    <CheckCircle2 className="h-2.5 w-2.5" />
                    {label}
                </span>
            );
        case 'scheduled':
            return (
                <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                    <CalendarCheck className="h-2.5 w-2.5" />
                    {label}
                </span>
            );
        case 'missed':
            return (
                <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 border border-red-200 dark:border-red-800">
                    <XCircle className="h-2.5 w-2.5" />
                    {label}
                </span>
            );
        case 'cancelled':
            return (
                <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold bg-muted text-muted-foreground border border-border">
                    <XCircle className="h-2.5 w-2.5" />
                    {label}
                </span>
            );
        default: // pending
            return (
                <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold bg-muted text-muted-foreground border border-border">
                    <Circle className="h-2.5 w-2.5" />
                    {label}
                </span>
            );
    }
}

// ─── Milestone step card (horizontal scroll) ──────────────────────────────────

function MilestoneCard({ step, isCurrent, t }: { step: TreatmentSequenceStep; isCurrent: boolean; t: ReturnType<typeof useTranslations> }) {
    const isCompleted = step.status === 'completed';
    const isMissed    = step.status === 'missed';
    const isCancelled = step.status === 'cancelled';

    const statusColors: Record<TreatmentSequenceStepStatus, string> = {
        completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300',
        scheduled: 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300',
        missed:    'bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300',
        cancelled: 'bg-muted text-muted-foreground',
        pending:   'bg-muted text-muted-foreground',
    };

    return (
        <div className={cn(
            'flex flex-col gap-1.5 px-3 py-2.5 rounded-lg border min-w-[100px] max-w-[120px] shrink-0 select-none',
            isCompleted && 'bg-emerald-950/60 border-emerald-700/60 dark:bg-emerald-950/60 dark:border-emerald-700/60',
            isCurrent && !isCompleted && 'bg-primary/10 border-primary dark:bg-primary/10',
            isMissed && 'bg-destructive/10 border-destructive/50',
            isCancelled && 'opacity-50',
            !isCompleted && !isCurrent && !isMissed && !isCancelled && 'bg-muted/40 border-border',
        )}>
            {/* Number bubble + status icon */}
            <div className="flex items-center gap-1.5">
                <span className={cn(
                    'flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold shrink-0 border',
                    isCompleted && 'bg-emerald-700/40 border-emerald-500/40 text-emerald-300',
                    isCurrent && !isCompleted && 'bg-primary/20 border-primary/50 text-primary',
                    isMissed && 'bg-destructive/20 border-destructive/50 text-destructive',
                    !isCompleted && !isCurrent && !isMissed && 'bg-muted/60 border-border text-muted-foreground',
                )}>
                    {step.step_number}
                </span>
                {isCompleted && <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />}
                {isCurrent && !isCompleted && <ChevronRight className="h-3 w-3 text-primary shrink-0" />}
                {isMissed && <XCircle className="h-3 w-3 text-destructive shrink-0" />}
            </div>
            <p className={cn(
                'text-xs font-semibold leading-tight line-clamp-2',
                isCompleted ? 'text-emerald-100' : isCurrent ? 'text-foreground' : isMissed ? 'text-destructive' : 'text-muted-foreground',
            )}>
                {step.step_name}
            </p>
            {step.scheduled_date && (
                <p className={cn(
                    'text-[10px]',
                    isCompleted ? 'text-emerald-400/80' : isCurrent ? 'text-primary/80' : 'text-muted-foreground/70',
                )}>
                    {formatShortDate(step.scheduled_date)}
                </p>
            )}
            {/* Status pill */}
            <span className={cn('inline-block rounded-full px-1.5 py-0.5 text-[9px] font-semibold self-start', statusColors[step.status])}>
                {t(`stepStatus.${step.status}`)}
            </span>
        </div>
    );
}

// ─── Cascade confirmation dialog ──────────────────────────────────────────────

interface CascadeDialogState {
    open: boolean;
    stepId: string;
    stepPosition: number;
    appointmentId: string | null;
    patch: Partial<TreatmentSequenceStep>;
    oldDate: string | null;
    newDate: string;
    daysDelta: number;
    subsequentCount: number;
    availabilityResults: AvailabilityResult[];
    checking: boolean;
}

function CascadeDialog({
    state,
    onConfirm,
    onClose,
    t,
}: {
    state: CascadeDialogState;
    onConfirm: (mode: StepCascadeMode, days: number) => void;
    onClose: () => void;
    t: ReturnType<typeof useTranslations>;
}) {
    const [cascadeMode, setCascadeMode] = React.useState<'none' | 'shift_all'>('shift_all');

    if (!state.open) return null;

    return (
        <AlertDialog open={state.open} onOpenChange={(open) => { if (!open) onClose(); }}>
            <AlertDialogContent className="max-w-md">
                <AlertDialogHeader>
                    <AlertDialogTitle>{t('cascade.title')}</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                        <div className="space-y-3 text-sm text-muted-foreground">
                            <p>
                                {t('cascade.description', {
                                    from: formatLongDate(state.oldDate),
                                    to: formatLongDate(state.newDate),
                                    days: Math.abs(state.daysDelta),
                                    direction: state.daysDelta > 0 ? t('cascade.forward') : t('cascade.backward'),
                                })}
                            </p>
                            <RadioGroup value={cascadeMode} onValueChange={(v) => setCascadeMode(v as 'none' | 'shift_all')}>
                                <div className="flex items-start gap-3 rounded-lg border p-3">
                                    <RadioGroupItem value="none" id="cascade-none" className="mt-0.5" />
                                    <div className="space-y-0.5">
                                        <Label htmlFor="cascade-none" className="text-sm font-medium cursor-pointer">
                                            {t('cascade.optionNone')}
                                        </Label>
                                        <p className="text-xs text-muted-foreground">{t('cascade.optionNoneDesc')}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 rounded-lg border p-3">
                                    <RadioGroupItem value="shift_all" id="cascade-all" className="mt-0.5" />
                                    <div className="space-y-0.5">
                                        <Label htmlFor="cascade-all" className="text-sm font-medium cursor-pointer">
                                            {t('cascade.optionAll', { count: state.subsequentCount, days: Math.abs(state.daysDelta) })}
                                        </Label>
                                        <p className="text-xs text-muted-foreground">{t('cascade.optionAllDesc')}</p>
                                    </div>
                                </div>
                            </RadioGroup>

                            {/* Availability results (shown when cascade mode = shift_all) */}
                            {cascadeMode === 'shift_all' && state.availabilityResults.length > 0 && (
                                <div className="rounded-lg border border-border p-3 space-y-1.5">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                        {t('cascade.availability')}
                                    </p>
                                    {state.checking
                                        ? <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />{t('cascade.checking')}</div>
                                        : state.availabilityResults.map(r => (
                                            <div key={r.step_id} className="flex items-center gap-2 text-xs">
                                                {r.status === 'available'
                                                    ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                                                    : <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                                                <span className={r.status === 'conflict' ? 'text-destructive' : ''}>
                                                    {r.step_id}: {r.status === 'available' ? t('cascade.available') : r.conflict_reason}
                                                </span>
                                            </div>
                                        ))
                                    }
                                </div>
                            )}
                        </div>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={onClose}>{t('edit.cancel')}</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onConfirm(cascadeMode, state.daysDelta)}>
                        {t('cascade.confirm')}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

// ─── Delete confirmation dialog ───────────────────────────────────────────────

interface DeleteDialogState {
    open: boolean;
    stepId: string;          // appointments.id
    stepPosition: number;    // step_position (treatment_steps.position)
    stepName: string;
    stepNumber: number;
    hasAppointment: boolean;
    appointmentDate: string | null;
    subsequentCount: number;
}

function DeleteDialog({
    state,
    onConfirm,
    onClose,
    t,
}: {
    state: DeleteDialogState;
    onConfirm: (cancelAppt: boolean, cascade: boolean, gapDays: number) => void;
    onClose: () => void;
    t: ReturnType<typeof useTranslations>;
}) {
    const [cancelAppt, setCancelAppt] = React.useState(true);
    const [closedGap, setCloseGap] = React.useState(state.subsequentCount > 0);
    const [gapDays, setGapDays] = React.useState(7);

    if (!state.open) return null;

    return (
        <AlertDialog open={state.open} onOpenChange={(open) => { if (!open) onClose(); }}>
            <AlertDialogContent className="max-w-md">
                <AlertDialogHeader>
                    <AlertDialogTitle className="text-destructive">{t('delete.title')}</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                        <div className="space-y-3 text-sm text-muted-foreground">
                            <p>{t('delete.description', { name: state.stepName })}</p>

                            {/* Appointment warning */}
                            {state.hasAppointment && (
                                <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-3 flex items-start gap-3">
                                    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                                    <div className="space-y-2 flex-1">
                                        <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                                            {t('delete.hasAppointment', { date: formatLongDate(state.appointmentDate) })}
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <Checkbox
                                                id="cancel-appt"
                                                checked={cancelAppt}
                                                onCheckedChange={(v) => setCancelAppt(!!v)}
                                            />
                                            <Label htmlFor="cancel-appt" className="text-xs cursor-pointer">
                                                {t('delete.cancelAppointment')}
                                            </Label>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Close gap option */}
                            {state.subsequentCount > 0 && (
                                <div className="rounded-lg border p-3 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Checkbox
                                            id="close-gap"
                                            checked={closedGap}
                                            onCheckedChange={(v) => setCloseGap(!!v)}
                                        />
                                        <Label htmlFor="close-gap" className="text-xs cursor-pointer font-medium">
                                            {t('delete.closeGap', { count: state.subsequentCount })}
                                        </Label>
                                    </div>
                                    {closedGap && (
                                        <div className="flex items-center gap-2 ml-6">
                                            <Label className="text-xs text-muted-foreground shrink-0">{t('delete.gapDays')}</Label>
                                            <Input
                                                type="number"
                                                min={1}
                                                value={gapDays}
                                                onChange={e => setGapDays(parseInt(e.target.value, 10) || 7)}
                                                className="h-7 w-20 text-xs"
                                            />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={onClose}>{t('edit.cancel')}</AlertDialogCancel>
                    <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={() => onConfirm(cancelAppt, closedGap, closedGap ? gapDays : 0)}
                    >
                        {t('delete.confirm')}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

// ─── Status change confirmation dialog ───────────────────────────────────────

interface StatusDialogState {
    open: boolean;
    stepId: string;          // appointments.id
    stepPosition: number;    // step_position
    stepName: string;
    newStatus: TreatmentSequenceStepStatus;
    hasAppointment: boolean;
    appointmentDate: string | null;
}

function StatusDialog({
    state,
    onConfirm,
    onClose,
    t,
}: {
    state: StatusDialogState;
    onConfirm: (syncAppt: boolean, notify: boolean) => void;
    onClose: () => void;
    t: ReturnType<typeof useTranslations>;
}) {
    const [syncAppt, setSyncAppt] = React.useState(true);
    const [notify, setNotify] = React.useState(false);

    if (!state.open) return null;

    return (
        <AlertDialog open={state.open} onOpenChange={(open) => { if (!open) onClose(); }}>
            <AlertDialogContent className="max-w-md">
                <AlertDialogHeader>
                    <AlertDialogTitle>{t('statusChange.title')}</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                        <div className="space-y-3 text-sm text-muted-foreground">
                            <p>{t('statusChange.description', { name: state.stepName, status: t(`stepStatus.${state.newStatus}`) })}</p>

                            {state.hasAppointment && (
                                <div className="rounded-lg border border-border p-3 space-y-2">
                                    <p className="text-xs font-medium">
                                        {t('statusChange.appointmentEffect', { date: formatLongDate(state.appointmentDate) })}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {state.newStatus === 'completed' && t('statusChange.appointmentCompleted')}
                                        {state.newStatus === 'cancelled' && t('statusChange.appointmentCancelled')}
                                        {state.newStatus === 'missed' && t('statusChange.appointmentMissed')}
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <Checkbox
                                            id="sync-appt"
                                            checked={syncAppt}
                                            onCheckedChange={(v) => setSyncAppt(!!v)}
                                        />
                                        <Label htmlFor="sync-appt" className="text-xs cursor-pointer">
                                            {t('statusChange.syncAppointment')}
                                        </Label>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Checkbox
                                            id="notify-patient"
                                            checked={notify}
                                            onCheckedChange={(v) => setNotify(!!v)}
                                        />
                                        <Label htmlFor="notify-patient" className="text-xs cursor-pointer">
                                            {t('statusChange.notifyPatient')}
                                        </Label>
                                    </div>
                                </div>
                            )}
                        </div>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={onClose}>{t('edit.cancel')}</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onConfirm(syncAppt, notify)}>
                        {t('statusChange.confirm')}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

// ─── Schedule step dialog (create appointment for step) ───────────────────────

interface ScheduleDialogState {
    open: boolean;
    stepId: string;
    stepPosition: number;
    stepName: string;
    sequenceId: string;
    defaultDate: string;
    defaultDoctorId: string;
    defaultDoctorName: string;
    patientId: string;
    defaultGoogleCalendarId: string | null;
    serviceId: string;
    serviceName: string;
    defaultNotes: string;
}

function ScheduleStepDialog({
    state,
    onConfirm,
    onClose,
    t,
}: {
    state: ScheduleDialogState;
    onConfirm: (date: string, time: string, duration: number, doctorId: string, doctorName: string, googleCalendarId: string | null, notify: boolean, notes: string) => Promise<void>;
    onClose: () => void;
    t: ReturnType<typeof useTranslations>;
}) {
    const [date, setDate] = React.useState(state.defaultDate);
    const [time, setTime] = React.useState('09:00');
    const [duration, setDuration] = React.useState(60);
    const [doctorId, setDoctorId] = React.useState(state.defaultDoctorId);
    const [doctorName, setDoctorName] = React.useState(state.defaultDoctorName);
    const [googleCalendarId, setGoogleCalendarId] = React.useState<string | null>(state.defaultGoogleCalendarId);
    const [notes, setNotes] = React.useState(state.defaultNotes);
    const [notify, setNotify] = React.useState(true);
    const [isSaving, setIsSaving] = React.useState(false);
    const [availability, setAvailability] = React.useState<AvailabilityResult | null>(null);
    const [isChecking, setIsChecking] = React.useState(false);
    const [doctors, setDoctors] = React.useState<{ id: string; name: string }[]>([]);
    const [calendars, setCalendars] = React.useState<{ id: string; name: string; google_calendar_id: string | null }[]>([]);
    const [isLoadingDoctors, setIsLoadingDoctors] = React.useState(true);
    const [isLoadingCalendars, setIsLoadingCalendars] = React.useState(true);

    // Load doctors + calendars when dialog opens
    React.useEffect(() => {
        if (!state.open) return;
        setDoctorId(state.defaultDoctorId);
        setDoctorName(state.defaultDoctorName);
        setGoogleCalendarId(state.defaultGoogleCalendarId);
        setDate(state.defaultDate);
        setTime('09:00');
        setNotes(state.defaultNotes);
        setAvailability(null);

        import('@/services/api').then(({ default: api }) =>
            import('@/constants/routes').then(({ API_ROUTES }) => {
                // Doctors
                setIsLoadingDoctors(true);
                api.get(API_ROUTES.USERS_DOCTORS)
                    .then((data: any) => {
                        setDoctors((Array.isArray(data) ? data : []).map((d: any) => ({
                            id: String(d.id),
                            name: d.name as string,
                        })));
                    })
                    .catch(() => setDoctors([]))
                    .finally(() => setIsLoadingDoctors(false));

                // Calendars
                setIsLoadingCalendars(true);
                api.get(API_ROUTES.CALENDARS)
                    .then((data: any) => {
                        const list = (Array.isArray(data) ? data : (data?.calendars ?? data?.data ?? []));
                        setCalendars(list.map((c: any) => ({
                            id: String(c.id),
                            name: c.name as string,
                            google_calendar_id: c.google_calendar_id ?? null,
                        })));
                    })
                    .catch(() => setCalendars([]))
                    .finally(() => setIsLoadingCalendars(false));
            })
        );
    }, [state.open, state.defaultDate, state.defaultDoctorId, state.defaultDoctorName, state.defaultGoogleCalendarId, state.defaultNotes]);

    async function checkAvailability() {
        if (!date || !doctorId) return;
        setIsChecking(true);
        try {
            const res = await validateStepsAvailability({
                doctor_id: doctorId,
                steps: [{ step_id: state.stepId, step_name: state.stepName, scheduled_date: date, duration_minutes: duration, schedule_mode: 'calendar' }],
            });
            setAvailability(res.results[0] ?? null);
        } finally {
            setIsChecking(false);
        }
    }

    if (!state.open) return null;

    const canSave = !!(date && time && doctorId);

    return (
        <Dialog open={state.open} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CalendarPlus className="h-4 w-4 text-primary shrink-0" />
                        {t('schedule.title')}
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                        {t('schedule.description', { name: state.stepName })}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 px-6 py-5 overflow-y-auto">
                    {/* Doctor selector */}
                    <div className="space-y-1.5">
                        <Label className="text-xs font-medium">{t('schedule.doctor')}</Label>
                        {isLoadingDoctors ? (
                            <div className="flex items-center gap-2 h-9 text-xs text-muted-foreground">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            </div>
                        ) : (
                            <Select
                                value={doctorId}
                                onValueChange={(val) => {
                                    setDoctorId(val);
                                    setDoctorName(doctors.find(d => d.id === val)?.name ?? '');
                                    setAvailability(null);
                                }}
                            >
                                <SelectTrigger className="h-9 text-sm">
                                    <SelectValue placeholder={t('schedule.doctorPlaceholder')} />
                                </SelectTrigger>
                                <SelectContent>
                                    {doctors.map(d => (
                                        <SelectItem key={d.id} value={d.id} className="text-sm">
                                            {d.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>

                    {/* Calendar selector */}
                    <div className="space-y-1.5">
                        <Label className="text-xs font-medium">{t('schedule.calendar')}</Label>
                        {isLoadingCalendars ? (
                            <div className="flex items-center gap-2 h-9 text-xs text-muted-foreground">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            </div>
                        ) : (
                            <Select
                                value={googleCalendarId ?? ''}
                                onValueChange={(val) => setGoogleCalendarId(val || null)}
                            >
                                <SelectTrigger className="h-9 text-sm">
                                    <SelectValue placeholder={t('schedule.calendarPlaceholder')} />
                                </SelectTrigger>
                                <SelectContent>
                                    {calendars.map(c => (
                                        <SelectItem key={c.id} value={c.google_calendar_id ?? c.id} className="text-sm">
                                            {c.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>

                    {/* Date + Time row */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-medium">{t('schedule.date')}</Label>
                            <DatePickerInput
                                value={date}
                                onChange={(d) => { setDate(d); setAvailability(null); }}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-medium">{t('schedule.time')}</Label>
                            <Input
                                type="time"
                                value={time}
                                onChange={e => { setTime(e.target.value); setAvailability(null); }}
                                className="h-9 text-sm"
                            />
                        </div>
                    </div>

                    {/* Duration */}
                    <div className="space-y-1.5">
                        <Label className="text-xs font-medium">{t('schedule.duration')}</Label>
                        <Input
                            type="number"
                            min={15}
                            value={duration}
                            onChange={e => setDuration(parseInt(e.target.value, 10) || 60)}
                            className="h-9 text-sm"
                        />
                    </div>

                    {/* Availability check */}
                    {date && doctorId && (
                        <div className="space-y-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs gap-1.5 w-full"
                                onClick={checkAvailability}
                                disabled={isChecking}
                            >
                                {isChecking && <Loader2 className="h-3 w-3 animate-spin" />}
                                {t('schedule.checkAvailability')}
                            </Button>
                            {availability && (
                                <div className={cn('flex items-center gap-2 text-xs rounded-md px-2.5 py-2 border',
                                    availability.status === 'available'
                                        ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-600'
                                        : 'border-destructive/30 bg-destructive/5 text-destructive',
                                )}>
                                    {availability.status === 'available'
                                        ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                                        : <XCircle className="h-3.5 w-3.5 shrink-0" />}
                                    <span>
                                        {availability.status === 'available'
                                            ? t('schedule.available')
                                            : availability.conflict_reason}
                                    </span>
                                </div>
                            )}
                            {availability?.alternatives && availability.alternatives.length > 0 && (
                                <div className="space-y-1">
                                    <p className="text-xs text-muted-foreground">{t('schedule.alternatives')}:</p>
                                    <div className="flex flex-wrap gap-1">
                                        {availability.alternatives.map(alt => (
                                            <button
                                                key={alt}
                                                type="button"
                                                onClick={() => { setDate(alt); setAvailability(null); }}
                                                className="text-[11px] px-2 py-0.5 rounded border border-border bg-muted/40 hover:bg-muted transition-colors"
                                            >
                                                {formatLongDate(alt)}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Service (read-only) */}
                    {state.serviceName && (
                        <div className="space-y-1.5">
                            <Label className="text-xs font-medium">{t('schedule.service')}</Label>
                            <div className="flex items-center h-9 px-3 rounded-md border bg-muted/50 text-sm text-muted-foreground">
                                {state.serviceName}
                            </div>
                        </div>
                    )}

                    {/* Notes */}
                    <div className="space-y-1.5">
                        <Label className="text-xs font-medium">{t('schedule.notes')}</Label>
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            rows={3}
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                            placeholder={t('schedule.notesPlaceholder')}
                        />
                    </div>

                    {/* Notify */}
                    <div className="flex items-center gap-2">
                        <Checkbox id="notify" checked={notify} onCheckedChange={(v) => setNotify(!!v)} />
                        <Label htmlFor="notify" className="text-xs cursor-pointer">{t('schedule.notifyPatient')}</Label>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={onClose}>
                        {t('edit.cancel')}
                    </Button>
                    <Button
                        size="sm"
                        className="h-8 text-xs gap-1.5"
                        disabled={!canSave || isSaving}
                        onClick={async () => {
                            setIsSaving(true);
                            try { await onConfirm(date, time, duration, doctorId, doctorName, googleCalendarId, notify, notes); }
                            finally { setIsSaving(false); }
                        }}
                    >
                        {isSaving && <Loader2 className="h-3 w-3 animate-spin" />}
                        {t('schedule.confirm')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ─── Create Session from Step dialog ──────────────────────────────────────────

interface CreateSessionState {
    open: boolean;
    stepId: string;
    prefill: {
        date: string;
        doctorId: string;
        doctorName: string;
        notes: string;
        serviceId: string;
        serviceName: string;
    };
}

function CreateSessionFromStepDialog({
    state,
    patientId,
    sequenceId,
    onSuccess,
    onClose,
    t,
}: {
    state: CreateSessionState;
    patientId: string;
    sequenceId: string;
    onSuccess: (sesionId: number, stepId: string) => void;
    onClose: () => void;
    t: ReturnType<typeof useTranslations>;
}) {
    const [date, setDate] = React.useState(state.prefill.date);
    const [doctorId, setDoctorId] = React.useState(state.prefill.doctorId);
    const [notes, setNotes] = React.useState(state.prefill.notes);
    const [doctors, setDoctors] = React.useState<{ id: string; name: string }[]>([]);
    const [isLoadingDoctors, setIsLoadingDoctors] = React.useState(true);
    const [isSaving, setIsSaving] = React.useState(false);

    React.useEffect(() => {
        if (!state.open) return;
        setDate(state.prefill.date);
        setDoctorId(state.prefill.doctorId);
        setNotes(state.prefill.notes);
        setIsLoadingDoctors(true);
        api.get(API_ROUTES.USERS_DOCTORS)
            .then((data: any) => setDoctors((Array.isArray(data) ? data : []).map((d: any) => ({ id: String(d.id), name: d.name as string }))))
            .catch(() => setDoctors([]))
            .finally(() => setIsLoadingDoctors(false));
    }, [state.open, state.prefill.date, state.prefill.doctorId, state.prefill.notes]);

    if (!state.open) return null;

    async function handleSave() {
        if (!date || !patientId) return;
        setIsSaving(true);
        try {
            const formData = new FormData();
            formData.append('paciente_id', patientId);
            formData.append('fecha', date);
            if (doctorId) formData.append('doctor_id', doctorId);
            if (notes.trim()) formData.append('notas', notes.trim());

            const response: any = await api.post(API_ROUTES.CLINIC_HISTORY.SESSIONS_UPSERT, formData);
            const sesionId: number =
                response?.data?.id ??
                response?.sesion_id ??
                response?.data?.sesion_id ??
                response?.id ??
                null;

            if (!sesionId) throw new Error('No sesion_id in response');

            await api.post(API_ROUTES.TREATMENT_PLANS.SEQUENCE_ADD_SESSION, {
                seq_step_id: Number(state.stepId),
                sesion_id: sesionId,
            });

            onSuccess(sesionId, state.stepId);
            onClose();
        } catch (err) {
            console.error('Failed to create session from step', err);
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <Dialog open={state.open} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Stethoscope className="h-4 w-4 text-primary shrink-0" />
                        {t('createSession.title')}
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                        {t('createSession.description')}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 px-6 py-5 overflow-y-auto">
                    {/* Service (read-only) */}
                    {state.prefill.serviceName && (
                        <div className="space-y-1.5">
                            <Label className="text-xs font-medium">{t('createSession.service')}</Label>
                            <div className="flex items-center h-9 px-3 rounded-md border bg-muted/50 text-sm text-muted-foreground">
                                {state.prefill.serviceName}
                            </div>
                        </div>
                    )}

                    {/* Date */}
                    <div className="space-y-1.5">
                        <Label className="text-xs font-medium">{t('createSession.date')}</Label>
                        <DatePickerInput value={date} onChange={setDate} />
                    </div>

                    {/* Doctor */}
                    <div className="space-y-1.5">
                        <Label className="text-xs font-medium">{t('createSession.doctor')}</Label>
                        {isLoadingDoctors ? (
                            <div className="flex items-center gap-2 h-9 text-xs text-muted-foreground">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            </div>
                        ) : (
                            <Select value={doctorId} onValueChange={setDoctorId}>
                                <SelectTrigger className="h-9 text-sm">
                                    <SelectValue placeholder={t('createSession.doctorPlaceholder')} />
                                </SelectTrigger>
                                <SelectContent>
                                    {doctors.map(d => (
                                        <SelectItem key={d.id} value={d.id} className="text-sm">{d.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>

                    {/* Notes */}
                    <div className="space-y-1.5">
                        <Label className="text-xs font-medium">{t('createSession.notes')}</Label>
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            rows={3}
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                            placeholder={t('createSession.notesPlaceholder')}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={onClose} disabled={isSaving}>
                        {t('edit.cancel')}
                    </Button>
                    <Button
                        size="sm"
                        className="h-8 text-xs gap-1.5"
                        disabled={!date || isSaving}
                        onClick={handleSave}
                    >
                        {isSaving && <Loader2 className="h-3 w-3 animate-spin" />}
                        {t('createSession.confirm')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ─── Step timeline (full CRUD with cascade) ───────────────────────────────────

function StepTimeline({
    sequence,
    patientId,
    onStepsChange,
    onSequenceStatusChange,
    onViewAppointment,
    onViewSession,
    onStepCompleted,
    t,
}: {
    sequence: TreatmentSequence;
    patientId: string;
    onStepsChange: (id: string, steps: TreatmentSequenceStep[]) => void;
    onSequenceStatusChange?: (id: string, status: TreatmentSequenceStatus) => void;
    onViewAppointment?: (appointmentId: string, scheduledDate?: string, serviceId?: string, serviceName?: string) => void;
    onViewSession?: (sesionId: number) => void;
    onStepCompleted?: (data: SessionPrefillData) => void;
    t: ReturnType<typeof useTranslations>;
}) {
    const [editingStepId, setEditingStepId] = React.useState<string | null>(null);
    const [isAddingStep, setIsAddingStep] = React.useState(false);
    const [isBusy, setIsBusy] = React.useState(false);

    // Dialog state
    const [cascadeDialog, setCascadeDialog] = React.useState<CascadeDialogState>({
        open: false, stepId: '', stepPosition: 0, appointmentId: null,
        patch: {}, oldDate: null, newDate: '', daysDelta: 0,
        subsequentCount: 0, availabilityResults: [], checking: false,
    });
    const [deleteDialog, setDeleteDialog] = React.useState<DeleteDialogState>({
        open: false, stepId: '', stepPosition: 0, stepName: '', stepNumber: 0,
        hasAppointment: false, appointmentDate: null, subsequentCount: 0,
    });
    const [statusDialog, setStatusDialog] = React.useState<StatusDialogState>({
        open: false, stepId: '', stepPosition: 0, stepName: '', newStatus: 'pending',
        hasAppointment: false, appointmentDate: null,
    });
    const [scheduleDialog, setScheduleDialog] = React.useState<ScheduleDialogState>({
        open: false, stepId: '', stepPosition: 0, stepName: '', sequenceId: '',
        defaultDate: '', defaultDoctorId: '', defaultDoctorName: '', patientId: '', defaultGoogleCalendarId: null,
        serviceId: '', serviceName: '', defaultNotes: '',
    });
    const [createSessionDialog, setCreateSessionDialog] = React.useState<CreateSessionState>({
        open: false,
        stepId: '',
        prefill: { date: '', doctorId: '', doctorName: '', notes: '', serviceId: '', serviceName: '' },
    });

    function openCreateSessionDialog(step: TreatmentSequenceStep) {
        const noteParts = [step.step_name, step.notes].filter(Boolean);
        setCreateSessionDialog({
            open: true,
            stepId: step.id,
            prefill: {
                date: step.scheduled_date ?? '',
                doctorId: sequence.doctor_id ?? '',
                doctorName: sequence.doctor_name ?? '',
                notes: noteParts.join('\n'),
                serviceId: sequence.service_id ?? '',
                serviceName: sequence.service_name ?? '',
            },
        });
    }

    function handleSessionCreated(sesionId: number, stepId: string) {
        onStepsChange(sequence.id, sequence.steps.map(s =>
            s.id === stepId ? { ...s, sesion_id: String(sesionId) } : s
        ));
    }

    // ── Save step (edit) ──────────────────────────────────────────────────────

    async function handleStepSave(stepId: string, patch: Partial<TreatmentSequenceStep>) {
        const step = sequence.steps.find(s => s.id === stepId);
        if (!step) return;

        // If date changed and there are subsequent steps → show cascade dialog
        if (patch.scheduled_date && patch.scheduled_date !== step.scheduled_date) {
            const hasSubsequent = sequence.steps.some(s => s.step_number > step.step_number && s.scheduled_date);
            const daysDelta = patch.scheduled_date && step.scheduled_date
                ? differenceInDays(parseISO(patch.scheduled_date), parseISO(step.scheduled_date))
                : 0;

            if (hasSubsequent && daysDelta !== 0) {
                const subsequentCalendarSteps = sequence.steps
                    .filter(s => s.step_number > step.step_number && s.scheduled_date);

                setCascadeDialog({
                    open: true,
                    stepId,
                    stepPosition: step.step_number,
                    appointmentId: step.appointment_id ?? null,
                    patch,
                    oldDate: step.scheduled_date ?? null,
                    newDate: patch.scheduled_date,
                    daysDelta,
                    subsequentCount: subsequentCalendarSteps.length,
                    availabilityResults: [],
                    checking: false,
                });
                return;
            }
        }

        // Direct save without cascade
        await executeSaveStep(stepId, patch, 'none', 0);
    }

    async function executeSaveStep(
        stepId: string,
        patch: Partial<TreatmentSequenceStep>,
        cascadeMode: StepCascadeMode,
        cascadeDays: number
    ) {
        const step = sequence.steps.find(s => s.id === stepId);
        if (!step) return;
        setIsBusy(true);
        try {
            const res = await upsertTreatmentStep({
                seq_step_id: Number(step.id),
                sequence_id: Number(sequence.id),
                step_position: step.step_number,
                step_name: patch.step_name ?? step.step_name,
                scheduled_date: patch.scheduled_date ?? step.scheduled_date,
                duration_minutes: patch.duration_minutes ?? step.duration_minutes ?? 60,
                notes: patch.notes ?? step.notes,
                cascade_mode: cascadeMode,
                cascade_days: cascadeDays,
            });
            if (res.success && res.affected_steps) {
                onStepsChange(sequence.id, res.affected_steps);
            } else {
                // Optimistic update fallback
                onStepsChange(sequence.id, sequence.steps.map(s => s.id === stepId ? { ...s, ...patch } : s));
            }
        } finally {
            setIsBusy(false);
            setEditingStepId(null);
        }
    }

    // ── Add step ──────────────────────────────────────────────────────────────

    async function handleStepAdd(newStep: Omit<TreatmentSequenceStep, 'id'>, insertAfter?: number) {
        setIsBusy(true);
        try {
            const res = await upsertTreatmentStep({
                sequence_id: Number(sequence.id),
                step_position: newStep.step_number,
                step_name: newStep.step_name,
                scheduled_date: newStep.scheduled_date,
                duration_minutes: newStep.duration_minutes ?? 60,
                notes: newStep.notes,
                cascade_mode: 'none',
                cascade_days: 0,
            });
            if (res.success && res.affected_steps) {
                onStepsChange(sequence.id, res.affected_steps);
            } else {
                onStepsChange(sequence.id, [...sequence.steps, { ...newStep, id: `tmp_${Date.now()}` }]);
            }
        } finally {
            setIsBusy(false);
            setIsAddingStep(false);
        }
    }

    // ── Delete step ───────────────────────────────────────────────────────────

    function openDeleteDialog(step: TreatmentSequenceStep) {
        const subsequent = sequence.steps.filter(s => s.step_number > step.step_number);
        setDeleteDialog({
            open: true,
            stepId: step.id,
            stepPosition: step.step_number,
            stepName: step.step_name,
            stepNumber: step.step_number,
            hasAppointment: !!step.appointment_id,
            appointmentDate: step.scheduled_date ?? null,
            subsequentCount: subsequent.length,
        });
    }

    async function executeDelete(cancelAppt: boolean, doCloseGap: boolean, gapDays: number) {
        setDeleteDialog(prev => ({ ...prev, open: false }));
        setIsBusy(true);
        try {
            const res = await deleteTreatmentStep({
                seq_step_id: Number(deleteDialog.stepId),
                sequence_id: Number(sequence.id),
                cancel_appointment: cancelAppt,
                cascade_mode: doCloseGap ? 'shift_all' : 'none',
                cascade_days: doCloseGap ? -gapDays : 0,
            });
            if (res.success && res.affected_steps) {
                onStepsChange(sequence.id, res.affected_steps);
            } else {
                onStepsChange(
                    sequence.id,
                    sequence.steps
                        .filter(s => s.id !== deleteDialog.stepId)
                        .map((s, i) => ({ ...s, step_number: i + 1 }))
                );
            }
        } finally {
            setIsBusy(false);
        }
    }

    // ── Status change ─────────────────────────────────────────────────────────

    function openStatusDialog(step: TreatmentSequenceStep, newStatus: TreatmentSequenceStepStatus) {
        const needsConfirm = step.appointment_id && ['completed', 'cancelled', 'missed'].includes(newStatus);
        if (!needsConfirm) {
            executeStatusChange(step.id, step.step_number, newStatus, false, false);
            return;
        }
        setStatusDialog({
            open: true,
            stepId: step.id,
            stepPosition: step.step_number,
            stepName: step.step_name,
            newStatus,
            hasAppointment: !!step.appointment_id,
            appointmentDate: step.scheduled_date ?? null,
        });
    }

    // Map UI step status to DB milestone_status
    function toMilestoneStatus(status: TreatmentSequenceStepStatus): 'waiting' | 'done' | 'alert' | 'pending' {
        if (status === 'completed') return 'done';
        if (status === 'scheduled') return 'waiting';
        if (status === 'missed') return 'alert';
        return 'pending';
    }

    async function executeStatusChange(
        stepId: string,
        stepPosition: number,
        status: TreatmentSequenceStepStatus,
        syncAppt: boolean,
        notify: boolean
    ) {
        setStatusDialog(prev => ({ ...prev, open: false }));
        setIsBusy(true);
        const milestoneStatus = toMilestoneStatus(status);
        const appointmentStatus = syncAppt
            ? status === 'completed' ? 'completed' as const
            : status === 'cancelled' ? 'cancelled' as const
            : undefined
            : undefined;
        const originalStep = sequence.steps.find(s => s.id === stepId);
        try {
            const res = await changeStepStatus({
                seq_step_id: Number(stepId),
                milestone_status: milestoneStatus,
                appointment_status: appointmentStatus,
                notify_patient: notify,
            });
            const updatedStep = res.step ?? originalStep;
            if (res.success && res.step) {
                const updated = sequence.steps.map(s => s.id === stepId ? res.step! : s);
                onStepsChange(sequence.id, updated);
                if (res.sequence_completed) {
                    onSequenceStatusChange?.(sequence.id, 'completed');
                }
            } else {
                onStepsChange(sequence.id, sequence.steps.map(s =>
                    s.id === stepId
                        ? { ...s, status, completed_at: status === 'completed' ? new Date().toISOString() : s.completed_at }
                        : s
                ));
            }
            if (status === 'completed' && updatedStep && !updatedStep.sesion_id) {
                openCreateSessionDialog(updatedStep);
            }
        } finally {
            setIsBusy(false);
        }
    }

    // ── Schedule step (create appointment) ────────────────────────────────────

    function openScheduleDialog(step: TreatmentSequenceStep) {
        const stepNoteParts = [step.step_name, step.notes].filter(Boolean);
        setScheduleDialog({
            open: true,
            stepId: step.id,
            stepPosition: step.step_number,
            stepName: step.step_name,
            sequenceId: sequence.id,
            defaultDate: step.scheduled_date ?? '',
            defaultDoctorId: sequence.doctor_id ?? '',
            defaultDoctorName: sequence.doctor_name ?? '',
            patientId: patientId,
            defaultGoogleCalendarId: sequence.google_calendar_id ?? null,
            serviceId: sequence.service_id ?? '',
            serviceName: sequence.service_name ?? '',
            defaultNotes: stepNoteParts.join('\n'),
        });
    }

    async function executeSchedule(date: string, time: string, duration: number, doctorId: string, doctorName: string, googleCalendarId: string | null, _notify: boolean, notes: string) {
        const res = await scheduleStep({
            seq_step_id: Number(scheduleDialog.stepId),
            patient_id: scheduleDialog.patientId,
            doctor_id: doctorId,
            doctor_name: doctorName,
            scheduled_date: date,
            scheduled_time: time,
            duration_minutes: duration,
            notes: notes || undefined,
            service_id: scheduleDialog.serviceId || undefined,
            google_calendar_id: googleCalendarId,
        });
        setScheduleDialog(prev => ({ ...prev, open: false }));
        if (res.success && res.step) {
            onStepsChange(sequence.id, sequence.steps.map(s => s.id === scheduleDialog.stepId ? res.step! : s));
        }
    }

    // ─────────────────────────────────────────────────────────────────────────

    return (
        <div className="space-y-0 pt-1">
            {isBusy && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground pb-2">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {t('edit.saving')}
                </div>
            )}

            {sequence.steps.map((step, idx) => (
                <div key={step.id} className="flex gap-3 min-h-[2.5rem]">
                    {/* Timeline connector */}
                    <div className="flex flex-col items-center shrink-0 w-6">
                        <div className="mt-0.5">{stepStatusIcon(step.status)}</div>
                        {(idx < sequence.steps.length - 1 || isAddingStep) && (
                            <div className="flex-1 w-px bg-border mt-1" />
                        )}
                    </div>

                    <div className={cn('pb-3 flex-1 min-w-0', idx === sequence.steps.length - 1 && !isAddingStep && 'pb-1')}>
                        {editingStepId === step.id ? (
                            <StepEditor
                                step={step}
                                onSave={(patch) => handleStepSave(step.id, patch)}
                                onCancel={() => setEditingStepId(null)}
                                t={t}
                            />
                        ) : (
                            <div className="flex items-start justify-between gap-2 group">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <p className="text-sm font-medium leading-tight text-foreground">
                                            {step.step_number}. {step.step_name}
                                        </p>
                                        <StepStatusBadge status={step.status} t={t} />
                                        {step.appointment_id && (
                                            <span title={t('edit.hasAppointment')}>
                                                <CalendarCheck className="h-3 w-3 text-blue-500 shrink-0" />
                                            </span>
                                        )}
                                    </div>
                                    {step.scheduled_date && (
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {formatLongDate(step.scheduled_date)}
                                        </p>
                                    )}
                                    {step.notes && (
                                        <p className="text-xs text-muted-foreground italic mt-0.5">{step.notes}</p>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-0.5 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
                                    {/* Schedule button — only for steps without appointment */}
                                    {!step.appointment_id && step.status !== 'completed' && step.status !== 'cancelled' && (
                                        <Button
                                            variant="ghost" size="icon"
                                            className="h-6 w-6 text-muted-foreground hover:text-blue-500"
                                            title={t('schedule.title')}
                                            onClick={() => openScheduleDialog(step)}
                                        >
                                            <CalendarPlus className="h-3 w-3" />
                                        </Button>
                                    )}

                                    {/* View appointment button — for steps with an appointment */}
                                    {step.appointment_id && step.status !== 'completed' && onViewAppointment && (
                                        <Button
                                            variant="ghost" size="icon"
                                            className="h-6 w-6 text-muted-foreground hover:text-blue-500"
                                            title={t('edit.viewAppointment')}
                                            onClick={() => onViewAppointment(step.appointment_id!, step.scheduled_date, sequence.service_id, sequence.service_name)}
                                        >
                                            <CalendarSearch className="h-3 w-3" />
                                        </Button>
                                    )}

                                    {/* Create session button — when no session linked yet and step not cancelled */}
                                    {!step.sesion_id && step.status !== 'cancelled' && (
                                        <Button
                                            variant="ghost" size="icon"
                                            className="h-6 w-6 text-muted-foreground hover:text-emerald-600"
                                            title={t('edit.createSession')}
                                            onClick={() => openCreateSessionDialog(step)}
                                        >
                                            <Stethoscope className="h-3 w-3" />
                                        </Button>
                                    )}

                                    {/* View/edit session button — when step has a linked session */}
                                    {!!step.sesion_id && onViewSession && (
                                        <Button
                                            variant="ghost" size="icon"
                                            className="h-6 w-6 text-muted-foreground hover:text-emerald-600"
                                            title={t('edit.viewSession')}
                                            onClick={() => onViewSession(Number(step.sesion_id))}
                                        >
                                            <ClipboardCheck className="h-3 w-3" />
                                        </Button>
                                    )}

                                    {/* Edit button */}
                                    <Button
                                        variant="ghost" size="icon"
                                        className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                        title={t('edit.editStep')}
                                        onClick={() => { setIsAddingStep(false); setEditingStepId(step.id); }}
                                    >
                                        <Pencil className="h-3 w-3" />
                                    </Button>

                                    {/* More menu */}
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground">
                                                <MoreHorizontal className="h-3.5 w-3.5" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-44">
                                            {/* Status options */}
                                            {STEP_STATUS_OPTIONS.filter(s => s !== step.status).map(status => (
                                                <DropdownMenuItem
                                                    key={status}
                                                    className="text-xs gap-2"
                                                    onSelect={() => openStatusDialog(step, status)}
                                                >
                                                    {stepStatusIcon(status, 'h-3 w-3')}
                                                    {t(`stepStatus.${status}`)}
                                                </DropdownMenuItem>
                                            ))}
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                                className="text-xs text-destructive focus:text-destructive gap-2"
                                                onSelect={() => openDeleteDialog(step)}
                                            >
                                                <Trash2 className="h-3 w-3" />
                                                {t('edit.deleteStep')}
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ))}

            {/* Add step form / button */}
            {isAddingStep ? (
                <div className="flex gap-3">
                    <div className="flex flex-col items-center shrink-0 w-6">
                        <div className="mt-1"><Circle className="h-4 w-4 text-muted-foreground/40" /></div>
                    </div>
                    <div className="flex-1">
                        <AddStepForm
                            sequence={sequence}
                            onAdd={handleStepAdd}
                            onCancel={() => setIsAddingStep(false)}
                            t={t}
                        />
                    </div>
                </div>
            ) : (
                <Button
                    type="button" variant="ghost" size="sm"
                    className="w-full mt-1 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => { setEditingStepId(null); setIsAddingStep(true); }}
                    disabled={isBusy}
                >
                    <PlusCircle className="h-3.5 w-3.5" />
                    {t('edit.addStep')}
                </Button>
            )}

            {/* Dialogs */}
            <CascadeDialog
                state={cascadeDialog}
                onConfirm={(mode, days) => {
                    setCascadeDialog(prev => ({ ...prev, open: false }));
                    executeSaveStep(cascadeDialog.stepId, cascadeDialog.patch, mode, days);
                }}
                onClose={() => setCascadeDialog(prev => ({ ...prev, open: false }))}
                t={t}
            />
            <DeleteDialog
                state={deleteDialog}
                onConfirm={executeDelete}
                onClose={() => setDeleteDialog(prev => ({ ...prev, open: false }))}
                t={t}
            />
            <StatusDialog
                state={statusDialog}
                onConfirm={(syncAppt, notify) => executeStatusChange(statusDialog.stepId, statusDialog.stepPosition, statusDialog.newStatus, syncAppt, notify)}
                onClose={() => setStatusDialog(prev => ({ ...prev, open: false }))}
                t={t}
            />
            <ScheduleStepDialog
                state={scheduleDialog}
                onConfirm={(date, time, duration, doctorId, doctorName, googleCalendarId, notify, notes) =>
                    executeSchedule(date, time, duration, doctorId, doctorName, googleCalendarId, notify, notes)
                }
                onClose={() => setScheduleDialog(prev => ({ ...prev, open: false }))}
                t={t}
            />
            <CreateSessionFromStepDialog
                state={createSessionDialog}
                patientId={patientId}
                sequenceId={sequence.id}
                onSuccess={handleSessionCreated}
                onClose={() => setCreateSessionDialog(prev => ({ ...prev, open: false }))}
                t={t}
            />
        </div>
    );
}

// ─── Inline step editor ───────────────────────────────────────────────────────

function StepEditor({
    step,
    onSave,
    onCancel,
    t,
}: {
    step: TreatmentSequenceStep;
    onSave: (patch: Partial<TreatmentSequenceStep>) => Promise<void>;
    onCancel: () => void;
    t: ReturnType<typeof useTranslations>;
}) {
    const [stepName, setStepName] = React.useState(step.step_name);
    const [date, setDate] = React.useState(step.scheduled_date ?? '');
    const [notes, setNotes] = React.useState(step.notes ?? '');
    const [status, setStatus] = React.useState<TreatmentSequenceStepStatus>(step.status);
    const [isSaving, setIsSaving] = React.useState(false);

    async function handleSave() {
        setIsSaving(true);
        try {
            await onSave({ step_name: stepName, scheduled_date: date || undefined, notes: notes || undefined, status });
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <div className="space-y-2 pt-1 pb-2 border rounded-md p-3 bg-muted/10">
            <div>
                <Label className="text-xs text-muted-foreground">{t('edit.stepName')}</Label>
                <Input value={stepName} onChange={e => setStepName(e.target.value)} className="h-8 text-sm mt-0.5" />
            </div>
            <div>
                <Label className="text-xs text-muted-foreground">{t('edit.scheduledDate')}</Label>
                <DatePickerInput value={date} onChange={setDate} className="mt-0.5" />
            </div>
            <div>
                <Label className="text-xs text-muted-foreground">{t('edit.status')}</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as TreatmentSequenceStepStatus)}>
                    <SelectTrigger className="h-8 text-sm mt-0.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {STEP_STATUS_OPTIONS.map(s => (
                            <SelectItem key={s} value={s} className="text-sm">{t(`stepStatus.${s}`)}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div>
                <Label className="text-xs text-muted-foreground">{t('edit.notes')}</Label>
                <Input value={notes} onChange={e => setNotes(e.target.value)} className="h-8 text-sm mt-0.5 text-muted-foreground" placeholder={t('edit.notesPlaceholder')} />
            </div>
            <div className="flex gap-2 pt-1">
                <Button size="sm" className="h-7 text-xs gap-1" onClick={handleSave} disabled={isSaving || !stepName.trim()}>
                    {isSaving && <Loader2 className="h-3 w-3 animate-spin" />}
                    {t('edit.save')}
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onCancel} disabled={isSaving}>
                    {t('edit.cancel')}
                </Button>
            </div>
        </div>
    );
}

// ─── Add step form ────────────────────────────────────────────────────────────

function AddStepForm({
    sequence,
    onAdd,
    onCancel,
    t,
}: {
    sequence: TreatmentSequence;
    onAdd: (step: Omit<TreatmentSequenceStep, 'id'>, insertAfter?: number) => Promise<void>;
    onCancel: () => void;
    t: ReturnType<typeof useTranslations>;
}) {
    const [stepName, setStepName] = React.useState('');
    const [date, setDate] = React.useState('');
    const [notes, setNotes] = React.useState('');
    const [duration, setDuration] = React.useState(60);
    const [insertAfter, setInsertAfter] = React.useState<number>(sequence.steps.length); // default: append
    const [isSaving, setIsSaving] = React.useState(false);

    async function handleAdd() {
        if (!stepName.trim()) return;
        setIsSaving(true);
        try {
            await onAdd(
                {
                    step_number: insertAfter + 1,
                    step_name: stepName,
                    scheduled_date: date || undefined,
                    duration_minutes: duration,
                    notes: notes || undefined,
                    status: 'pending',
                },
                insertAfter
            );
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <div className="border rounded-md p-3 space-y-2 mt-2 bg-muted/20">
            <p className="text-xs font-semibold text-muted-foreground">
                {t('edit.addStepTitle', { number: insertAfter + 1 })}
            </p>

            {/* Insert position */}
            {sequence.steps.length > 0 && (
                <div>
                    <Label className="text-xs text-muted-foreground">{t('edit.insertAfter')}</Label>
                    <Select
                        value={String(insertAfter)}
                        onValueChange={v => setInsertAfter(parseInt(v, 10))}
                    >
                        <SelectTrigger className="h-8 text-sm mt-0.5"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="0" className="text-sm">{t('edit.insertFirst')}</SelectItem>
                            {sequence.steps.map(s => (
                                <SelectItem key={s.id} value={String(s.step_number)} className="text-sm">
                                    {t('edit.insertAfterStep', { number: s.step_number, name: s.step_name })}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}

            <div>
                <Label className="text-xs text-muted-foreground">{t('edit.stepName')}</Label>
                <Input
                    value={stepName}
                    onChange={e => setStepName(e.target.value)}
                    className="h-8 text-sm mt-0.5"
                    placeholder={t('review.stepNamePlaceholder')}
                    autoFocus
                />
            </div>
            <div>
                <Label className="text-xs text-muted-foreground">{t('edit.scheduledDate')}</Label>
                <DatePickerInput value={date} onChange={setDate} className="mt-0.5" />
            </div>
            <div>
                <Label className="text-xs text-muted-foreground">{t('edit.duration')}</Label>
                <Input
                    type="number"
                    min={15}
                    value={duration}
                    onChange={e => setDuration(parseInt(e.target.value, 10) || 60)}
                    className="h-8 text-sm mt-0.5"
                />
            </div>
            <div>
                <Label className="text-xs text-muted-foreground">{t('edit.notes')}</Label>
                <Input value={notes} onChange={e => setNotes(e.target.value)} className="h-8 text-sm mt-0.5 text-muted-foreground" placeholder={t('edit.notesPlaceholder')} />
            </div>
            <div className="flex gap-2 pt-1">
                <Button size="sm" className="h-7 text-xs gap-1" onClick={handleAdd} disabled={isSaving || !stepName.trim()}>
                    {isSaving && <Loader2 className="h-3 w-3 animate-spin" />}
                    {t('edit.addStepConfirm')}
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onCancel} disabled={isSaving}>
                    {t('edit.cancel')}
                </Button>
            </div>
        </div>
    );
}

// ─── Active plan card ─────────────────────────────────────────────────────────

function ActivePlanCard({
    sequence,
    patientId,
    onStepsChange,
    onSequenceStatusChange,
    onViewAppointment,
    onViewSession,
    onStepCompleted,
    t,
}: {
    sequence: TreatmentSequence;
    patientId: string;
    onStepsChange: (id: string, steps: TreatmentSequenceStep[]) => void;
    onSequenceStatusChange?: (id: string, status: TreatmentSequenceStatus) => void;
    onViewAppointment?: (appointmentId: string, scheduledDate?: string, serviceId?: string, serviceName?: string) => void;
    onViewSession?: (sesionId: number) => void;
    onStepCompleted?: (data: SessionPrefillData) => void;
    t: ReturnType<typeof useTranslations>;
}) {
    const [expanded, setExpanded] = React.useState(false);

    const completedCount = sequence.steps.filter(s => s.status === 'completed').length;
    const totalCount = sequence.steps.length;
    const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
    const currentStepIdx = sequence.steps.findIndex(s => s.status !== 'completed' && s.status !== 'cancelled');
    const hasMissed = sequence.steps.some(s => s.status === 'missed');
    const missedStep = sequence.steps.find(s => s.status === 'missed');
    const missedDaysAgo = (() => {
        if (!missedStep?.scheduled_date) return null;
        try {
            const diff = Math.floor((new Date().getTime() - parseISO(missedStep.scheduled_date).getTime()) / 86400000);
            return diff > 0 ? diff : null;
        } catch { return null; }
    })();

    const seqIdLabel = sequence.id ? `SEQ-${String(sequence.id).padStart(4, '0')}` : '';

    return (
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
            {/* Card header */}
            <div className="bg-muted/30 px-4 pt-4 pb-3 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <Stethoscope className="h-4 w-4 text-primary shrink-0" />
                        <h3 className="font-bold text-sm leading-tight truncate">{sequence.service_name}</h3>
                    </div>
                    <Badge variant={sequenceStatusVariant(sequence.status)} className="shrink-0 gap-1 text-xs">
                        {sequence.status === 'active' && <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />}
                        {t(`status.${sequence.status}`)}
                    </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">
                    {t('startedAt')} {formatLongDate(sequence.started_at)}
                    {sequence.doctor_name && ` · ${sequence.doctor_name}`}
                    {seqIdLabel && ` · ID: ${seqIdLabel}`}
                </p>
                <div className="space-y-1">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">{t('progressLabel')}</span>
                        <span className="text-[11px] font-semibold text-primary">{completedCount} / {totalCount} {t('milestones')}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
                    </div>
                </div>
            </div>

            {/* Horizontal milestones */}
            <div className="px-4 py-3">
                <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <div className="flex gap-2 pb-1">
                        {sequence.steps.map((step, idx) => (
                            <MilestoneCard key={step.id} step={step} isCurrent={idx === currentStepIdx} t={t} />
                        ))}
                    </div>
                </div>
            </div>

            {/* Missed step alert */}
            {hasMissed && missedStep && (
                <div className="mx-4 mb-3 flex items-center gap-3 rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2.5">
                    <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-destructive">{t('interruptedAlert')}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                            {sequence.service_name}
                            {missedDaysAgo != null && <> — {t('missedDaysAgo', { days: missedDaysAgo })}</>}
                        </p>
                    </div>
                    <Button size="sm" variant="destructive" className="shrink-0 h-7 text-xs gap-1.5">
                        <Phone className="h-3 w-3" />
                        {t('contact')}
                    </Button>
                </div>
            )}

            {/* Expandable step editor */}
            <Collapsible open={expanded}>
                <button
                    type="button"
                    className="w-full flex items-center justify-between gap-2 px-4 py-2 border-t border-border hover:bg-muted/30 transition-colors text-xs text-muted-foreground"
                    onClick={() => setExpanded(v => !v)}
                >
                    <span>{t('editSteps')}</span>
                    {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                </button>
                <CollapsibleContent>
                    <div className="px-4 pb-3 pt-1 border-t border-border">
                        <StepTimeline
                            sequence={sequence}
                            patientId={patientId}
                            onStepsChange={onStepsChange}
                            onSequenceStatusChange={onSequenceStatusChange}
                            onViewAppointment={onViewAppointment}
                            onViewSession={onViewSession}
                            onStepCompleted={onStepCompleted}
                            t={t}
                        />
                    </div>
                </CollapsibleContent>
            </Collapsible>
        </div>
    );
}

// ─── Compact sequence card (historical) ──────────────────────────────────────

function CompactSequenceCard({
    sequence,
    patientId,
    onStepsChange,
    onViewAppointment,
    onViewSession,
    onStepCompleted,
    t,
}: {
    sequence: TreatmentSequence;
    patientId: string;
    onStepsChange: (id: string, steps: TreatmentSequenceStep[]) => void;
    onViewAppointment?: (appointmentId: string, scheduledDate?: string, serviceId?: string, serviceName?: string) => void;
    onViewSession?: (sesionId: number) => void;
    onStepCompleted?: (data: SessionPrefillData) => void;
    t: ReturnType<typeof useTranslations>;
}) {
    const [expanded, setExpanded] = React.useState(false);
    const completedCount = sequence.steps.filter(s => s.status === 'completed').length;
    const totalCount = sequence.steps.length;

    return (
        <div className="border rounded-lg overflow-hidden">
            <button
                className="w-full flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors text-left"
                onClick={() => setExpanded(v => !v)}
            >
                {sequence.service_color && (
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: sequence.service_color }} />
                )}
                <span className="font-medium text-sm flex-1 min-w-0 truncate">{sequence.service_name}</span>
                <span className="text-xs text-muted-foreground shrink-0">{formatLongDate(sequence.started_at)}</span>
                <Badge variant={sequenceStatusVariant(sequence.status)} className="text-xs shrink-0">
                    {t(`status.${sequence.status}`)}
                </Badge>
                <span className="text-xs text-muted-foreground shrink-0">{completedCount}/{totalCount}</span>
                {expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
            </button>
            <div className="h-0.5 bg-muted">
                <div className="h-full bg-primary/60 transition-all" style={{ width: totalCount > 0 ? `${(completedCount / totalCount) * 100}%` : '0%' }} />
            </div>
            <Collapsible open={expanded}>
                <CollapsibleContent>
                    <div className="px-3 pb-3 pt-2 border-t border-border">
                        <StepTimeline sequence={sequence} patientId={patientId} onStepsChange={onStepsChange}
                            onViewAppointment={onViewAppointment} onViewSession={onViewSession}
                            onStepCompleted={onStepCompleted} t={t} />
                    </div>
                </CollapsibleContent>
            </Collapsible>
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function UserTreatmentPlans({ userId, onCreateAppointment, onViewAppointment, onViewSession, onStepCompleted }: UserTreatmentPlansProps) {
    const t = useTranslations('TreatmentPlans');
    const [sequences, setSequences] = React.useState<TreatmentSequence[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [showHistorical, setShowHistorical] = React.useState(false);

    React.useEffect(() => {
        let cancelled = false;
        setIsLoading(true);
        getTreatmentSequences(userId).then(data => {
            if (!cancelled) { setSequences(data); setIsLoading(false); }
        });
        return () => { cancelled = true; };
    }, [userId]);

    function handleStepsChange(sequenceId: string, steps: TreatmentSequenceStep[]) {
        setSequences(prev => prev.map(seq => seq.id === sequenceId ? { ...seq, steps } : seq));
    }

    function handleSequenceStatusChange(sequenceId: string, status: TreatmentSequenceStatus) {
        setSequences(prev => prev.map(seq => seq.id === sequenceId ? { ...seq, status } : seq));
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('loading')}
            </div>
        );
    }

    if (sequences.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 gap-4 text-center px-4">
                <ClipboardList className="h-10 w-10 text-muted-foreground/30" />
                <div className="space-y-1">
                    <p className="font-medium text-sm text-muted-foreground">{t('emptyState')}</p>
                    <p className="text-xs text-muted-foreground max-w-xs">{t('emptyStateDescription')}</p>
                </div>
                {onCreateAppointment && (
                    <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={onCreateAppointment}>
                        <PlusCircle className="h-3.5 w-3.5" />
                        {t('createAppointment')}
                    </Button>
                )}
            </div>
        );
    }

    const active = sequences.filter(s => s.status === 'active' || s.status === 'paused');
    const historical = sequences.filter(s => s.status === 'completed' || s.status === 'cancelled');

    return (
        <div className="space-y-3 pb-4">
            {active.map(seq => (
                <ActivePlanCard
                    key={seq.id}
                    sequence={seq}
                    patientId={userId}
                    onStepsChange={handleStepsChange}
                    onSequenceStatusChange={handleSequenceStatusChange}
                    onViewAppointment={onViewAppointment}
                    onViewSession={onViewSession}
                    onStepCompleted={onStepCompleted}
                    t={t}
                />
            ))}

            {historical.length > 0 && (
                <div>
                    <div className="flex items-center justify-between py-1.5">
                        <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
                            {t('historicalTitle')} ({historical.length})
                        </span>
                        <button
                            type="button"
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-[10px] font-medium"
                            onClick={() => setShowHistorical(v => !v)}
                        >
                            {showHistorical ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            {showHistorical ? t('hideHistorical') : t('showHistorical')}
                        </button>
                    </div>
                    <Collapsible open={showHistorical}>
                        <CollapsibleContent>
                            <div className="space-y-2 pt-1">
                                {historical.map(seq => (
                                    <CompactSequenceCard key={seq.id} sequence={seq} patientId={userId}
                                        onStepsChange={handleStepsChange} onViewAppointment={onViewAppointment}
                                        onViewSession={onViewSession} onStepCompleted={onStepCompleted} t={t} />
                                ))}
                            </div>
                        </CollapsibleContent>
                    </Collapsible>
                </div>
            )}
        </div>
    );
}

// ─── Inline active treatment widget ──────────────────────────────────────────

interface UserActiveTreatmentWidgetProps {
    userId: string;
    onViewAll?: () => void;
    onCreateAppointment?: () => void;
}

export function UserActiveTreatmentWidget({ userId, onViewAll, onCreateAppointment }: UserActiveTreatmentWidgetProps) {
    const t = useTranslations('TreatmentPlans');
    const [sequences, setSequences] = React.useState<TreatmentSequence[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);

    React.useEffect(() => {
        let cancelled = false;
        setIsLoading(true);
        getTreatmentSequences(userId).then(data => {
            if (!cancelled) { setSequences(data); setIsLoading(false); }
        });
        return () => { cancelled = true; };
    }, [userId]);

    const active = sequences.filter(s => s.status === 'active' || s.status === 'paused');

    if (!isLoading && active.length === 0) return null;

    if (isLoading) {
        return (
            <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                {t('loading')}
            </div>
        );
    }

    const seq = active[0];
    const completedCount = seq.steps.filter(s => s.status === 'completed').length;
    const totalCount = seq.steps.length;
    const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
    const currentStepIdx = seq.steps.findIndex(s => s.status !== 'completed' && s.status !== 'cancelled');
    const currentStep = currentStepIdx >= 0 ? seq.steps[currentStepIdx] : null;
    const nextStep = seq.steps[currentStepIdx + 1] ?? null;
    const hasMissed = seq.steps.some(s => s.status === 'missed');

    return (
        <div className="mb-2">
            <div className="flex items-center justify-between py-1.5">
                <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <ClipboardList className="h-3 w-3" />
                    {t('widgetTitle')}
                    {active.length > 1 && (
                        <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">{active.length}</Badge>
                    )}
                </span>
                {onViewAll && (
                    <button type="button" onClick={onViewAll} className="text-[10px] text-primary hover:underline font-medium">
                        {t('viewAll')}
                    </button>
                )}
            </div>

            <div className={cn('rounded-lg border overflow-hidden', hasMissed ? 'border-destructive/40' : 'border-border')}>
                <div className="flex items-center gap-2.5 px-3 py-2.5 bg-muted/20">
                    {seq.service_color && <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: seq.service_color }} />}
                    <span className="font-semibold text-sm flex-1 min-w-0 truncate">{seq.service_name}</span>
                    <Badge variant={sequenceStatusVariant(seq.status)} className="text-xs shrink-0 gap-1">
                        {seq.status === 'active' && <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />}
                        {t(`status.${seq.status}`)}
                    </Badge>
                </div>
                <div className="h-1 bg-muted">
                    <div className={cn('h-full transition-all', hasMissed ? 'bg-destructive/60' : 'bg-primary')} style={{ width: `${progress}%` }} />
                </div>
                <div className="px-3 py-2.5 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{t('progressLabel')}</span>
                        <span className="font-semibold text-primary">{completedCount} / {totalCount} {t('milestones')}</span>
                    </div>
                    {currentStep && (
                        <div className={cn('flex items-start gap-2 rounded-md px-2.5 py-2 text-xs', hasMissed ? 'bg-destructive/10 border border-destructive/20' : 'bg-primary/5 border border-primary/15')}>
                            <div className="shrink-0 mt-0.5">
                                {hasMissed ? <XCircle className="h-3.5 w-3.5 text-destructive" /> : <ChevronRight className="h-3.5 w-3.5 text-primary" />}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="font-semibold text-[11px] uppercase tracking-wide text-muted-foreground mb-0.5">
                                    {hasMissed ? t('missedStep') : t('currentStep')}
                                </p>
                                <p className={cn('font-medium leading-tight', hasMissed ? 'text-destructive' : 'text-foreground')}>
                                    {currentStep.step_number}. {currentStep.step_name}
                                </p>
                                {currentStep.scheduled_date && (
                                    <p className="text-muted-foreground mt-0.5">{formatLongDate(currentStep.scheduled_date)}</p>
                                )}
                            </div>
                        </div>
                    )}
                    {nextStep && !hasMissed && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Circle className="h-3 w-3 shrink-0" />
                            <span className="truncate">
                                {t('nextStep')}: <span className="font-medium text-foreground">{nextStep.step_name}</span>
                                {nextStep.scheduled_date && <> · {formatLongDate(nextStep.scheduled_date)}</>}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
