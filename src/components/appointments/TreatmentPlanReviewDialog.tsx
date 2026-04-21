'use client';

/**
 * TreatmentPlanReviewDialog — 3-step wizard
 *
 * Step 1 – Edit plan steps (name, date, notes, schedule mode)
 * Step 2 – Check availability for each step; show conflicts + quick alternatives
 * Step 3 – Confirm & create: posts to backend, closes dialog
 */

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DatePickerInput } from '@/components/ui/date-picker';
import {
    Dialog,
    DialogBody,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { API_ROUTES } from '@/constants/routes';
import { TreatmentSequence, TreatmentSequenceStep } from '@/lib/types';
import api from '@/services/api';
import { createTreatmentSequence } from '@/services/treatment-plans';
import {
    AlertTriangle,
    CalendarCheck,
    CalendarClock,
    CalendarX,
    CheckCircle2,
    ChevronRight,
    ClipboardList,
    Loader2,
    PlusCircle,
    RotateCcw,
    Trash2,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Whether the step should be auto-scheduled in the calendar or managed manually */
type ScheduleMode = 'calendar' | 'manual';

interface EditableStep extends TreatmentSequenceStep {
    scheduleMode: ScheduleMode;
}

type AvailabilityStatus = 'available' | 'conflict' | 'unchecked';

interface StepAvailability {
    step_id: string;
    status: AvailabilityStatus;
    /** Suggested alternative dates when status === 'conflict' */
    alternatives?: string[];
    /** Chosen alternative (or original date if no conflict) */
    resolved_date?: string;
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface TreatmentPlanReviewDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    pendingSequence: TreatmentSequence;
    /** Called once the plan is fully confirmed. Parent can close dialog. */
    onCreated?: (sequence: TreatmentSequence) => void;
}

// ─── Step indicator ──────────────────────────────────────────────────────────

function WizardStepIndicator({ current, total }: { current: number; total: number }) {
    return (
        <div className="flex items-center gap-1 shrink-0">
            {Array.from({ length: total }).map((_, i) => (
                <React.Fragment key={i}>
                    <div
                        className={cn(
                            'h-1.5 rounded-full transition-all duration-300',
                            i < current
                                ? 'w-4 bg-primary'
                                : i === current
                                    ? 'w-6 bg-primary'
                                    : 'w-4 bg-border',
                        )}
                    />
                </React.Fragment>
            ))}
        </div>
    );
}

// ─── Availability badge ───────────────────────────────────────────────────────

function AvailabilityBadge({ status }: { status: AvailabilityStatus }) {
    const t = useTranslations('TreatmentPlans.wizard');
    if (status === 'available')
        return (
            <Badge variant="secondary" className="gap-1 text-green-600 bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800 dark:text-green-400">
                <CheckCircle2 className="h-3 w-3" />
                {t('available')}
            </Badge>
        );
    if (status === 'conflict')
        return (
            <Badge variant="destructive" className="gap-1">
                <CalendarX className="h-3 w-3" />
                {t('conflict')}
            </Badge>
        );
    return (
        <Badge variant="outline" className="gap-1 text-muted-foreground">
            <CalendarClock className="h-3 w-3" />
            {t('unchecked')}
        </Badge>
    );
}

// ─── Step 1: Edit steps ───────────────────────────────────────────────────────

function Step1Edit({
    steps,
    serviceName,
    onStepsChange,
    t,
}: {
    steps: EditableStep[];
    serviceName: string;
    onStepsChange: (steps: EditableStep[]) => void;
    t: ReturnType<typeof useTranslations>;
}) {
    function update(idx: number, patch: Partial<EditableStep>) {
        onStepsChange(steps.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
    }

    function remove(idx: number) {
        onStepsChange(
            steps
                .filter((_, i) => i !== idx)
                .map((s, i) => ({ ...s, step_number: i + 1 }))
        );
    }

    function addStep() {
        const lastDate = steps.length > 0 ? steps[steps.length - 1].scheduled_date : undefined;
        onStepsChange([
            ...steps,
            {
                id: `new_${Date.now()}`,
                step_number: steps.length + 1,
                step_name: '',
                scheduled_date: lastDate,
                status: 'pending',
                scheduleMode: 'calendar',
            },
        ]);
    }

    return (
        <div className="space-y-1">
            <div className="flex items-center gap-2 pb-1">
                <ClipboardList className="h-4 w-4 text-primary shrink-0" />
                <p className="text-sm font-semibold">{serviceName}</p>
            </div>
            <p className="text-xs text-muted-foreground pb-3">
                {t('wizard.step1.hint')}
            </p>
            <div className="space-y-0">
                {steps.map((step, idx) => (
                    <div key={step.id} className="flex gap-3">
                        {/* Timeline column */}
                        <div className="flex flex-col items-center shrink-0 w-8 pt-3">
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold">
                                {step.step_number}
                            </div>
                            {idx < steps.length - 1 && (
                                <div className="flex-1 w-px bg-border mt-1.5 mb-1.5 min-h-[1.5rem]" />
                            )}
                        </div>

                        {/* Fields */}
                        <div className="flex-1 pb-5 space-y-2.5">
                            {/* Name + remove */}
                            <div className="flex items-center gap-2">
                                <Input
                                    placeholder={t('wizard.step1.stepNamePlaceholder')}
                                    value={step.step_name}
                                    onChange={e => update(idx, { step_name: e.target.value })}
                                    className="h-9 text-sm flex-1"
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                                    onClick={() => remove(idx)}
                                    title={t('wizard.step1.removeStep')}
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                            </div>

                            {/* Date */}
                            <div>
                                <Label className="text-xs text-muted-foreground mb-1 block">{t('wizard.step1.scheduledDate')}</Label>
                                <DatePickerInput
                                    value={step.scheduled_date}
                                    onChange={v => update(idx, { scheduled_date: v })}
                                    placeholder={t('wizard.step1.datePlaceholder')}
                                />
                            </div>

                            {/* Notes */}
                            <Input
                                placeholder={t('wizard.step1.notesPlaceholder')}
                                value={step.notes ?? ''}
                                onChange={e => update(idx, { notes: e.target.value || undefined })}
                                className="h-8 text-xs text-muted-foreground"
                            />

                            {/* Schedule mode */}
                            <div>
                                <Label className="text-xs text-muted-foreground mb-1.5 block">{t('wizard.step1.scheduleModeLabel')}</Label>
                                <RadioGroup
                                    value={step.scheduleMode}
                                    onValueChange={(v) => update(idx, { scheduleMode: v as ScheduleMode })}
                                    className="flex gap-4"
                                >
                                    <div className="flex items-center gap-1.5">
                                        <RadioGroupItem value="calendar" id={`cal-${step.id}`} />
                                        <Label htmlFor={`cal-${step.id}`} className="text-xs font-normal flex items-center gap-1 cursor-pointer">
                                            <CalendarCheck className="h-3.5 w-3.5 text-primary" />
                                            {t('wizard.step1.modeCalendar')}
                                        </Label>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <RadioGroupItem value="manual" id={`man-${step.id}`} />
                                        <Label htmlFor={`man-${step.id}`} className="text-xs font-normal flex items-center gap-1 cursor-pointer">
                                            <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
                                            {t('wizard.step1.modeManual')}
                                        </Label>
                                    </div>
                                </RadioGroup>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full gap-1.5 text-xs mt-1"
                onClick={addStep}
            >
                <PlusCircle className="h-3.5 w-3.5" />
                {t('wizard.step1.addStep')}
            </Button>
        </div>
    );
}

// ─── Step 2: Availability check ───────────────────────────────────────────────

function Step2Availability({
    steps,
    doctorId,
    availability,
    isChecking,
    onAvailabilityChange,
    onRecheck,
    t,
}: {
    steps: EditableStep[];
    doctorId?: string;
    availability: StepAvailability[];
    isChecking: boolean;
    onAvailabilityChange: (av: StepAvailability[]) => void;
    onRecheck: () => void;
    t: ReturnType<typeof useTranslations>;
}) {
    function resolveDate(stepId: string, date: string) {
        onAvailabilityChange(
            availability.map(a =>
                a.step_id === stepId ? { ...a, resolved_date: date } : a
            )
        );
    }

    const calendarSteps = steps.filter(s => s.scheduleMode === 'calendar');
    const manualSteps = steps.filter(s => s.scheduleMode === 'manual');
    const conflicts = availability.filter(a => a.status === 'conflict');
    const allResolved = conflicts.every(a => a.resolved_date);

    return (
        <div className="space-y-4">
            {isChecking ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <p className="text-sm">{t('wizard.step2.checking')}</p>
                </div>
            ) : (
                <>
                    {/* Summary banner */}
                    {conflicts.length === 0 ? (
                        <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
                            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                            <AlertDescription className="text-green-700 dark:text-green-300 text-sm">
                                {t('wizard.step2.allAvailable')}
                            </AlertDescription>
                        </Alert>
                    ) : (
                        <Alert variant="destructive" className="border-destructive/40 bg-destructive/5">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription className="text-sm">
                                {t('wizard.step2.conflictsFound', { count: conflicts.length })}
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Steps that go to calendar */}
                    {calendarSteps.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                {t('wizard.step2.calendarSteps')}
                            </p>
                            <div className="border rounded-lg divide-y divide-border overflow-hidden">
                                {calendarSteps.map(step => {
                                    const av = availability.find(a => a.step_id === step.id);
                                    const hasConflict = av?.status === 'conflict';
                                    return (
                                        <div key={step.id} className={cn('p-3 space-y-2', hasConflict && 'bg-destructive/5')}>
                                            {/* Step header */}
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium leading-tight">
                                                        {step.step_number}. {step.step_name}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground mt-0.5">
                                                        {av?.resolved_date ?? step.scheduled_date ?? '—'}
                                                    </p>
                                                </div>
                                                <AvailabilityBadge status={av?.status ?? 'unchecked'} />
                                            </div>

                                            {/* Conflict resolution */}
                                            {hasConflict && av && (
                                                <div className="space-y-1.5">
                                                    <p className="text-xs text-destructive font-medium">{t('wizard.step2.selectAlternative')}</p>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {(av.alternatives ?? []).map(alt => (
                                                            <button
                                                                key={alt}
                                                                type="button"
                                                                onClick={() => resolveDate(step.id, alt)}
                                                                className={cn(
                                                                    'px-2.5 py-1 rounded-md text-xs border transition-colors',
                                                                    av.resolved_date === alt
                                                                        ? 'bg-primary text-primary-foreground border-primary'
                                                                        : 'bg-background hover:bg-muted border-border'
                                                                )}
                                                            >
                                                                {alt}
                                                            </button>
                                                        ))}
                                                        {/* Custom date picker for conflict */}
                                                        <div className="w-full mt-1">
                                                            <p className="text-xs text-muted-foreground mb-1">{t('wizard.step2.orPickDate')}</p>
                                                            <DatePickerInput
                                                                value={
                                                                    av.resolved_date && !(av.alternatives ?? []).includes(av.resolved_date)
                                                                        ? av.resolved_date
                                                                        : ''
                                                                }
                                                                onChange={v => v && resolveDate(step.id, v)}
                                                                placeholder={t('wizard.step2.customDatePlaceholder')}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Manual steps (no check needed) */}
                    {manualSteps.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                {t('wizard.step2.manualSteps')}
                            </p>
                            <div className="border rounded-lg divide-y divide-border overflow-hidden">
                                {manualSteps.map(step => (
                                    <div key={step.id} className="p-3 flex items-center justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium leading-tight">
                                                {step.step_number}. {step.step_name}
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                {step.scheduled_date ?? '—'}
                                            </p>
                                        </div>
                                        <Badge variant="outline" className="text-xs text-muted-foreground shrink-0">
                                            <CalendarClock className="h-3 w-3 mr-1" />
                                            {t('wizard.step1.modeManual')}
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Re-check button */}
                    {conflicts.length > 0 && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="w-full gap-1.5 text-xs text-muted-foreground"
                            onClick={onRecheck}
                        >
                            <RotateCcw className="h-3.5 w-3.5" />
                            {t('wizard.step2.recheck')}
                        </Button>
                    )}
                </>
            )}
        </div>
    );
}

// ─── Step 3: Confirm summary ──────────────────────────────────────────────────

function Step3Confirm({
    steps,
    availability,
    serviceName,
    t,
}: {
    steps: EditableStep[];
    availability: StepAvailability[];
    serviceName: string;
    t: ReturnType<typeof useTranslations>;
}) {
    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 pb-1">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                <p className="text-sm font-semibold">{serviceName}</p>
            </div>
            <p className="text-xs text-muted-foreground">{t('wizard.step3.hint')}</p>

            <div className="border rounded-lg divide-y divide-border overflow-hidden">
                {steps.map(step => {
                    const av = availability.find(a => a.step_id === step.id);
                    const finalDate = step.scheduleMode === 'calendar'
                        ? (av?.resolved_date ?? step.scheduled_date)
                        : step.scheduled_date;

                    return (
                        <div key={step.id} className="flex items-start gap-3 p-3">
                            {/* Step number */}
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold shrink-0 mt-0.5">
                                {step.step_number}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium leading-tight">{step.step_name}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{finalDate ?? '—'}</p>
                                {step.notes && (
                                    <p className="text-xs text-muted-foreground italic mt-0.5">{step.notes}</p>
                                )}
                            </div>
                            <Badge
                                variant={step.scheduleMode === 'calendar' ? 'default' : 'outline'}
                                className="text-xs shrink-0"
                            >
                                {step.scheduleMode === 'calendar' ? (
                                    <><CalendarCheck className="h-3 w-3 mr-1" />{t('wizard.step1.modeCalendar')}</>
                                ) : (
                                    <><CalendarClock className="h-3 w-3 mr-1" />{t('wizard.step1.modeManual')}</>
                                )}
                            </Badge>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Main dialog ──────────────────────────────────────────────────────────────

const WIZARD_STEPS = 3;

export function TreatmentPlanReviewDialog({
    open,
    onOpenChange,
    pendingSequence,
    onCreated,
}: TreatmentPlanReviewDialogProps) {
    const t = useTranslations('TreatmentPlans');
    const { toast } = useToast();

    const [wizardStep, setWizardStep] = React.useState(0);
    const [steps, setSteps] = React.useState<EditableStep[]>([]);
    const [availability, setAvailability] = React.useState<StepAvailability[]>([]);
    const [isChecking, setIsChecking] = React.useState(false);
    const [isCreating, setIsCreating] = React.useState(false);

    // ── Reset when dialog opens ──────────────────────────────────────────────
    React.useEffect(() => {
        if (open) {
            setWizardStep(0);
            setSteps(
                pendingSequence.steps.map(s => ({
                    ...s,
                    scheduleMode: 'calendar',
                }))
            );
            setAvailability([]);
            setIsCreating(false);
        }
    }, [open, pendingSequence]);

    // ── Availability check ───────────────────────────────────────────────────
    async function checkAvailability() {
        setIsChecking(true);
        const calendarSteps = steps.filter(s => s.scheduleMode === 'calendar');

        try {
            // Build request payload for all calendar steps
            const requestPayload = {
                service_id: pendingSequence.service_id,
                doctor_id: pendingSequence.doctor_id,
                steps: calendarSteps.map(s => ({
                    step_id: s.id,
                    step_name: s.step_name,
                    scheduled_date: s.scheduled_date,
                    duration_minutes: s.duration_minutes ?? 60,
                    schedule_mode: s.scheduleMode,
                })),
            };

            let results: StepAvailability[];

            try {
                const res = await api.post(API_ROUTES.TREATMENT_PLANS.VALIDATE_AVAILABILITY, requestPayload);
                const raw: any[] = Array.isArray(res) ? res : Array.isArray(res?.steps) ? res.steps : [];
                results = raw.map((r: any) => ({
                    step_id: r.step_id,
                    status: r.available ? 'available' : 'conflict',
                    alternatives: r.alternatives ?? [],
                    resolved_date: r.available ? r.scheduled_date : undefined,
                }));
            } catch {
                // Backend not implemented yet — mock a successful check
                results = calendarSteps.map(s => ({
                    step_id: s.id,
                    status: 'available' as AvailabilityStatus,
                    resolved_date: s.scheduled_date,
                }));
            }

            // Merge with existing (preserve resolved_date for manual steps)
            const newAv: StepAvailability[] = steps.map(s => {
                if (s.scheduleMode === 'manual') {
                    return { step_id: s.id, status: 'available', resolved_date: s.scheduled_date };
                }
                return results.find(r => r.step_id === s.id) ?? { step_id: s.id, status: 'unchecked' };
            });
            setAvailability(newAv);
        } finally {
            setIsChecking(false);
        }
    }

    // ── Create plan ──────────────────────────────────────────────────────────
    async function createPlan() {
        setIsCreating(true);
        try {
            const stepsPayload = steps.map(s => {
                const av = availability.find(a => a.step_id === s.id);
                const finalDate = s.scheduleMode === 'calendar'
                    ? (av?.resolved_date ?? s.scheduled_date)
                    : s.scheduled_date;
                return {
                    step_number: s.step_number,
                    step_name: s.step_name,
                    scheduled_date: finalDate,
                    duration_minutes: s.duration_minutes ?? 60,
                    schedule_mode: s.scheduleMode,
                    notes: s.notes ?? '',
                };
            });

            const payload = {
                patient_id: pendingSequence.patient_id,
                service_id: pendingSequence.service_id,
                service_name: pendingSequence.service_name,
                service_color: pendingSequence.service_color ?? null,
                doctor_id: pendingSequence.doctor_id ?? '',
                doctor_name: pendingSequence.doctor_name ?? '',
                doctor_email: pendingSequence.doctor_email ?? '',
                google_calendar_id: pendingSequence.google_calendar_id ?? null,
                started_by: pendingSequence.started_by ?? pendingSequence.doctor_id ?? '',
                notes: pendingSequence.notes ?? null,
                steps: stepsPayload,
            };

            let created: TreatmentSequence;
            try {
                const res = await api.post(API_ROUTES.TREATMENT_PLANS.CREATE, payload);
                created = Array.isArray(res) ? res[0] : res;
            } catch {
                // Backend not implemented — fall back to mock store
                const mockSteps: TreatmentSequenceStep[] = steps.map(s => {
                    const av = availability.find(a => a.step_id === s.id);
                    const finalDate = s.scheduleMode === 'calendar'
                        ? (av?.resolved_date ?? s.scheduled_date)
                        : s.scheduled_date;
                    return {
                        id: s.id,
                        step_number: s.step_number,
                        step_name: s.step_name,
                        scheduled_date: finalDate,
                        status: (s.scheduleMode === 'calendar' ? 'scheduled' : 'pending') as TreatmentSequenceStep['status'],
                        notes: s.notes,
                        duration_minutes: s.duration_minutes ?? 60,
                    };
                });
                created = await createTreatmentSequence({
                    patient_id: pendingSequence.patient_id,
                    service_id: pendingSequence.service_id,
                    service_name: pendingSequence.service_name,
                    service_color: pendingSequence.service_color,
                    status: 'active',
                    started_at: pendingSequence.started_at,
                    steps: mockSteps,
                });
            }

            toast({
                title: t('wizard.createSuccess'),
                description: t('wizard.createSuccessDesc', {
                    name: pendingSequence.service_name,
                    steps: stepsPayload.length,
                }),
            });
            onCreated?.(created);
            onOpenChange(false);
        } catch (err) {
            toast({
                variant: 'destructive',
                title: t('wizard.createError'),
                description: err instanceof Error ? err.message : t('wizard.createErrorDesc'),
            });
        } finally {
            setIsCreating(false);
        }
    }

    // ── Navigation ───────────────────────────────────────────────────────────
    async function handleNext() {
        if (wizardStep === 0) {
            // Move to availability step and auto-check
            setWizardStep(1);
            await checkAvailability();
        } else if (wizardStep === 1) {
            setWizardStep(2);
        } else {
            await createPlan();
        }
    }

    function handleBack() {
        setWizardStep(prev => Math.max(0, prev - 1));
    }

    // ── Can proceed? ─────────────────────────────────────────────────────────
    const canProceed = React.useMemo(() => {
        if (wizardStep === 0) {
            return steps.length > 0 && steps.every(s => s.step_name.trim());
        }
        if (wizardStep === 1) {
            if (isChecking) return false;
            // All calendar-step conflicts must have a resolved_date
            const conflicts = availability.filter(a => a.status === 'conflict');
            return conflicts.every(a => a.resolved_date);
        }
        return true;
    }, [wizardStep, steps, availability, isChecking]);

    // ── Step titles / descriptions ───────────────────────────────────────────
    const stepMeta = [
        { title: t('wizard.step1.title'), desc: t('wizard.step1.desc') },
        { title: t('wizard.step2.title'), desc: t('wizard.step2.desc') },
        { title: t('wizard.step3.title'), desc: t('wizard.step3.desc') },
    ];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent maxWidth="xl">
                <DialogHeader>
                    <div className="flex items-center justify-between gap-3">
                        <DialogTitle className="flex items-center gap-2">
                            <ClipboardList className="h-5 w-5 text-primary shrink-0" />
                            {stepMeta[wizardStep].title}
                        </DialogTitle>
                        <WizardStepIndicator current={wizardStep} total={WIZARD_STEPS} />
                    </div>
                    <DialogDescription>{stepMeta[wizardStep].desc}</DialogDescription>
                </DialogHeader>

                <Separator />

                <DialogBody>
                    <ScrollArea className="h-[52vh]">
                        <div className="px-6 py-4">
                            {wizardStep === 0 && (
                                <Step1Edit
                                    steps={steps}
                                    serviceName={pendingSequence.service_name}
                                    onStepsChange={setSteps}
                                    t={t}
                                />
                            )}
                            {wizardStep === 1 && (
                                <Step2Availability
                                    steps={steps}
                                    availability={availability}
                                    isChecking={isChecking}
                                    onAvailabilityChange={setAvailability}
                                    onRecheck={checkAvailability}
                                    t={t}
                                />
                            )}
                            {wizardStep === 2 && (
                                <Step3Confirm
                                    steps={steps}
                                    availability={availability}
                                    serviceName={pendingSequence.service_name}
                                    t={t}
                                />
                            )}
                        </div>
                    </ScrollArea>
                </DialogBody>

                <Separator />

                <DialogFooter className="px-6 py-4 gap-2 sm:gap-2">
                    {/* Left: step label */}
                    <p className="text-xs text-muted-foreground flex-1 self-center hidden sm:block">
                        {t('wizard.stepLabel', { current: wizardStep + 1, total: WIZARD_STEPS })}
                    </p>

                    <Button
                        variant="outline"
                        onClick={wizardStep === 0 ? () => onOpenChange(false) : handleBack}
                        disabled={isCreating || isChecking}
                    >
                        {wizardStep === 0 ? t('wizard.cancel') : t('wizard.back')}
                    </Button>

                    <Button
                        onClick={handleNext}
                        disabled={!canProceed || isCreating}
                        className="gap-2 min-w-[9rem]"
                    >
                        {isCreating ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                {t('wizard.creating')}
                            </>
                        ) : wizardStep === WIZARD_STEPS - 1 ? (
                            <>
                                <CheckCircle2 className="h-4 w-4" />
                                {t('wizard.create')}
                            </>
                        ) : (
                            <>
                                {t('wizard.next')}
                                <ChevronRight className="h-4 w-4" />
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
