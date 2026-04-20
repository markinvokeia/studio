'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { DatePickerInput } from '@/components/ui/date-picker';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { TreatmentSequence, TreatmentSequenceStatus, TreatmentSequenceStep, TreatmentSequenceStepStatus } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
    addTreatmentSequenceStep,
    deleteTreatmentSequenceStep,
    getTreatmentSequences,
    updateSequenceStepStatus,
    updateTreatmentSequenceStep,
} from '@/services/treatment-plans';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
    AlertTriangle,
    CalendarCheck,
    CheckCircle2,
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
    try {
        return format(parseISO(dateStr), 'd MMM', { locale: es });
    } catch { return dateStr; }
}

function formatLongDate(dateStr?: string | null): string {
    if (!dateStr) return '—';
    try {
        return format(parseISO(dateStr), 'd LLL yyyy', { locale: es });
    } catch { return dateStr; }
}

const STEP_STATUS_OPTIONS: TreatmentSequenceStepStatus[] = ['pending', 'scheduled', 'completed', 'missed', 'cancelled'];

// ─── Milestone step card (horizontal) ────────────────────────────────────────

function MilestoneCard({
    step,
    isCurrent,
}: {
    step: TreatmentSequenceStep;
    isCurrent: boolean;
}) {
    const isCompleted = step.status === 'completed';
    const isMissed = step.status === 'missed';

    return (
        <div
            className={cn(
                'flex flex-col gap-1.5 px-3 py-2.5 rounded-lg border min-w-[100px] max-w-[120px] shrink-0 select-none',
                isCompleted && 'bg-emerald-950/60 border-emerald-700/60 dark:bg-emerald-950/60 dark:border-emerald-700/60',
                isCurrent && !isCompleted && 'bg-primary/10 border-primary dark:bg-primary/10',
                isMissed && 'bg-destructive/10 border-destructive/50',
                !isCompleted && !isCurrent && !isMissed && 'bg-muted/40 border-border',
            )}
        >
            {/* Label row */}
            <div className="flex items-center gap-1">
                <span className={cn(
                    'text-[10px] font-bold uppercase tracking-wider',
                    isCompleted ? 'text-emerald-400' : isCurrent ? 'text-primary' : isMissed ? 'text-destructive' : 'text-muted-foreground',
                )}>
                    HITO {step.step_number}
                </span>
                {isCompleted && <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />}
                {isCurrent && !isCompleted && <ChevronRight className="h-3 w-3 text-primary shrink-0" />}
                {isMissed && <XCircle className="h-3 w-3 text-destructive shrink-0" />}
            </div>

            {/* Name */}
            <p className={cn(
                'text-xs font-semibold leading-tight line-clamp-2',
                isCompleted ? 'text-emerald-100' : isCurrent ? 'text-foreground' : isMissed ? 'text-destructive' : 'text-muted-foreground',
            )}>
                {step.step_name}
            </p>

            {/* Date */}
            {step.scheduled_date && (
                <p className={cn(
                    'text-[10px]',
                    isCompleted ? 'text-emerald-400/80' : isCurrent ? 'text-primary/80' : 'text-muted-foreground/70',
                )}>
                    {formatShortDate(step.scheduled_date)}
                </p>
            )}
        </div>
    );
}

// ─── Active plan card (featured view) ────────────────────────────────────────

function ActivePlanCard({
    sequence,
    onStepsChange,
    t,
}: {
    sequence: TreatmentSequence;
    onStepsChange: (id: string, steps: TreatmentSequenceStep[]) => void;
    t: ReturnType<typeof useTranslations>;
}) {
    const [expanded, setExpanded] = React.useState(false);

    const completedCount = sequence.steps.filter(s => s.status === 'completed').length;
    const totalCount = sequence.steps.length;
    const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

    // Current step = first non-completed
    const currentStepIdx = sequence.steps.findIndex(s => s.status !== 'completed' && s.status !== 'cancelled');
    const hasMissed = sequence.steps.some(s => s.status === 'missed');

    // Days since last missed step
    const missedStep = sequence.steps.find(s => s.status === 'missed');
    const missedDaysAgo = React.useMemo(() => {
        if (!missedStep?.scheduled_date) return null;
        try {
            const diff = Math.floor((Date.now() - parseISO(missedStep.scheduled_date).getTime()) / 86400000);
            return diff > 0 ? diff : null;
        } catch { return null; }
    }, [missedStep]);

    const seqIdLabel = sequence.id ? `SEQ-${String(sequence.id).padStart(4, '0')}` : '';

    return (
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
            {/* Card header */}
            <div className="bg-muted/30 px-4 pt-4 pb-3 space-y-2.5">
                {/* Title row */}
                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <Stethoscope className="h-4 w-4 text-primary shrink-0" />
                        <h3 className="font-bold text-sm leading-tight truncate">{sequence.service_name}</h3>
                    </div>
                    <Badge
                        variant={sequenceStatusVariant(sequence.status)}
                        className="shrink-0 gap-1 text-xs"
                    >
                        {sequence.status === 'active' && (
                            <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
                        )}
                        {t(`status.${sequence.status}`)}
                    </Badge>
                </div>

                {/* Subtitle */}
                <p className="text-[11px] text-muted-foreground">
                    {t('startedAt')} {formatLongDate(sequence.started_at)}
                    {sequence.doctor_name && ` · ${sequence.doctor_name}`}
                    {seqIdLabel && ` · ID: ${seqIdLabel}`}
                </p>

                {/* Progress */}
                <div className="space-y-1">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">
                            {t('progressLabel')}
                        </span>
                        <span className="text-[11px] font-semibold text-primary">
                            {completedCount} / {totalCount} {t('milestones')}
                        </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                            className="h-full rounded-full bg-primary transition-all duration-500"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Horizontal milestones */}
            <div className="px-4 py-3">
                <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <div className="flex gap-2 pb-1">
                        {sequence.steps.map((step, idx) => (
                            <MilestoneCard
                                key={step.id}
                                step={step}
                                isCurrent={idx === currentStepIdx}
                            />
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
                            {missedDaysAgo != null && (
                                <> — {t('missedDaysAgo', { days: missedDaysAgo })}</>
                            )}
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
                            onStepsChange={onStepsChange}
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
    onStepsChange,
    t,
}: {
    sequence: TreatmentSequence;
    onStepsChange: (id: string, steps: TreatmentSequenceStep[]) => void;
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

            {/* Progress bar */}
            <div className="h-0.5 bg-muted">
                <div
                    className="h-full bg-primary/60 transition-all"
                    style={{ width: totalCount > 0 ? `${(completedCount / totalCount) * 100}%` : '0%' }}
                />
            </div>

            <Collapsible open={expanded}>
                <CollapsibleContent>
                    <div className="px-3 pb-3 pt-2 border-t border-border">
                        <StepTimeline
                            sequence={sequence}
                            onStepsChange={onStepsChange}
                            t={t}
                        />
                    </div>
                </CollapsibleContent>
            </Collapsible>
        </div>
    );
}

// ─── Step timeline (shared editor for both card types) ────────────────────────

function StepTimeline({
    sequence,
    onStepsChange,
    t,
}: {
    sequence: TreatmentSequence;
    onStepsChange: (id: string, steps: TreatmentSequenceStep[]) => void;
    t: ReturnType<typeof useTranslations>;
}) {
    const [editingStepId, setEditingStepId] = React.useState<string | null>(null);
    const [isAddingStep, setIsAddingStep] = React.useState(false);

    function stepStatusIcon(status: TreatmentSequenceStepStatus) {
        switch (status) {
            case 'completed': return <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />;
            case 'scheduled': return <CalendarCheck className="h-4 w-4 text-blue-500 shrink-0" />;
            case 'missed': return <XCircle className="h-4 w-4 text-destructive shrink-0" />;
            case 'cancelled': return <XCircle className="h-4 w-4 text-muted-foreground shrink-0" />;
            default: return <Circle className="h-4 w-4 text-muted-foreground shrink-0" />;
        }
    }

    function stepStatusClass(status: TreatmentSequenceStepStatus): string {
        switch (status) {
            case 'completed': return 'text-emerald-600 dark:text-emerald-400';
            case 'scheduled': return 'text-blue-600 dark:text-blue-400';
            case 'missed': return 'text-destructive';
            case 'cancelled': return 'text-muted-foreground line-through';
            default: return 'text-muted-foreground';
        }
    }

    async function handleStepSave(stepId: string, patch: Partial<TreatmentSequenceStep>) {
        await updateTreatmentSequenceStep(sequence.id, stepId, patch);
        onStepsChange(sequence.id, sequence.steps.map(s => s.id === stepId ? { ...s, ...patch } : s));
        setEditingStepId(null);
    }

    async function handleStepDelete(stepId: string) {
        await deleteTreatmentSequenceStep(sequence.id, stepId);
        onStepsChange(
            sequence.id,
            sequence.steps.filter(s => s.id !== stepId).map((s, i) => ({ ...s, step_number: i + 1 }))
        );
    }

    async function handleStatusChange(stepId: string, status: TreatmentSequenceStepStatus) {
        await updateSequenceStepStatus(sequence.id, stepId, status);
        onStepsChange(sequence.id, sequence.steps.map(s =>
            s.id === stepId ? { ...s, status, completed_at: status === 'completed' ? new Date().toISOString() : s.completed_at } : s
        ));
    }

    async function handleStepAdd(step: Omit<TreatmentSequenceStep, 'id'>) {
        const newStep = await addTreatmentSequenceStep(sequence.id, step);
        onStepsChange(sequence.id, [...sequence.steps, newStep]);
        setIsAddingStep(false);
    }

    return (
        <div className="space-y-0 pt-1">
            {sequence.steps.map((step, idx) => (
                <div key={step.id} className="flex gap-3 min-h-[2.5rem]">
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
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                    <p className={cn('text-sm font-medium leading-tight', stepStatusClass(step.status))}>
                                        {step.step_number}. {step.step_name}
                                    </p>
                                    {step.scheduled_date && (
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {formatLongDate(step.scheduled_date)}
                                        </p>
                                    )}
                                    {step.notes && (
                                        <p className="text-xs text-muted-foreground italic mt-0.5">{step.notes}</p>
                                    )}
                                </div>
                                <div className="flex items-center gap-0.5 shrink-0">
                                    <Button
                                        variant="ghost" size="icon"
                                        className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                        onClick={() => { setIsAddingStep(false); setEditingStepId(step.id); }}
                                    >
                                        <Pencil className="h-3 w-3" />
                                    </Button>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground">
                                                <MoreHorizontal className="h-3.5 w-3.5" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-40">
                                            {STEP_STATUS_OPTIONS.filter(s => s !== step.status).map(status => (
                                                <DropdownMenuItem
                                                    key={status}
                                                    className="text-xs gap-2"
                                                    onSelect={() => handleStatusChange(step.id, status)}
                                                >
                                                    {t(`stepStatus.${status}`)}
                                                </DropdownMenuItem>
                                            ))}
                                            <DropdownMenuItem
                                                className="text-xs text-destructive focus:text-destructive gap-2"
                                                onSelect={() => handleStepDelete(step.id)}
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

            {isAddingStep ? (
                <div className="flex gap-3">
                    <div className="flex flex-col items-center shrink-0 w-6">
                        <div className="mt-1"><Circle className="h-4 w-4 text-muted-foreground/40" /></div>
                    </div>
                    <div className="flex-1">
                        <AddStepForm
                            nextStepNumber={sequence.steps.length + 1}
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
                >
                    <PlusCircle className="h-3.5 w-3.5" />
                    {t('edit.addStep')}
                </Button>
            )}
        </div>
    );
}

// ─── Inline step editor ───────────────────────────────────────────────────────

interface StepEditorProps {
    step: TreatmentSequenceStep;
    onSave: (patch: Partial<TreatmentSequenceStep>) => Promise<void>;
    onCancel: () => void;
    t: ReturnType<typeof useTranslations>;
}

function StepEditor({ step, onSave, onCancel, t }: StepEditorProps) {
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
        <div className="space-y-2 pt-1 pb-2">
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

// ─── Add-step mini form ───────────────────────────────────────────────────────

function AddStepForm({
    nextStepNumber,
    onAdd,
    onCancel,
    t,
}: {
    nextStepNumber: number;
    onAdd: (step: Omit<TreatmentSequenceStep, 'id'>) => Promise<void>;
    onCancel: () => void;
    t: ReturnType<typeof useTranslations>;
}) {
    const [stepName, setStepName] = React.useState('');
    const [date, setDate] = React.useState('');
    const [notes, setNotes] = React.useState('');
    const [isSaving, setIsSaving] = React.useState(false);

    async function handleAdd() {
        if (!stepName.trim()) return;
        setIsSaving(true);
        try {
            await onAdd({ step_number: nextStepNumber, step_name: stepName, scheduled_date: date || undefined, notes: notes || undefined, status: 'pending' });
        } finally { setIsSaving(false); }
    }

    return (
        <div className="border rounded-md p-3 space-y-2 mt-2 bg-muted/20">
            <p className="text-xs font-semibold text-muted-foreground">{t('edit.addStepTitle', { number: nextStepNumber })}</p>
            <div>
                <Label className="text-xs text-muted-foreground">{t('edit.stepName')}</Label>
                <Input value={stepName} onChange={e => setStepName(e.target.value)} className="h-8 text-sm mt-0.5" placeholder={t('review.stepNamePlaceholder')} autoFocus />
            </div>
            <div>
                <Label className="text-xs text-muted-foreground">{t('edit.scheduledDate')}</Label>
                <DatePickerInput value={date} onChange={setDate} className="mt-0.5" />
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

// ─── Inline active treatment widget (shown on Info tab) ───────────────────────

interface UserActiveTreatmentWidgetProps {
    userId: string;
    onViewAll?: () => void;
    onCreateAppointment?: () => void;
}

export function UserActiveTreatmentWidget({ userId, onViewAll, onCreateAppointment }: UserActiveTreatmentWidgetProps) {
    const t = useTranslations('TreatmentPlans');
    const [sequences, setSequences] = React.useState<TreatmentSequence[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [stepsOpen, setStepsOpen] = React.useState(false);

    React.useEffect(() => {
        let cancelled = false;
        setIsLoading(true);
        getTreatmentSequences(userId).then(data => {
            if (!cancelled) { setSequences(data); setIsLoading(false); }
        });
        return () => { cancelled = true; };
    }, [userId]);

    function handleStepsChange(sequenceId: string, steps: TreatmentSequenceStep[]) {
        setSequences(prev => prev.map(s => s.id === sequenceId ? { ...s, steps } : s));
    }

    const active = sequences.filter(s => s.status === 'active' || s.status === 'paused');

    // Nothing loading + no active treatments → show link
    if (!isLoading && active.length === 0) return null;

    if (isLoading) {
        return (
            <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                {t('loading')}
            </div>
        );
    }

    // Show only the most relevant active plan
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
            {/* Widget header row */}
            <div className="flex items-center justify-between py-1.5">
                <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <ClipboardList className="h-3 w-3" />
                    {t('widgetTitle')}
                    {active.length > 1 && (
                        <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">{active.length}</Badge>
                    )}
                </span>
                {onViewAll && (
                    <button
                        type="button"
                        onClick={onViewAll}
                        className="text-[10px] text-primary hover:underline font-medium"
                    >
                        {t('viewAll')}
                    </button>
                )}
            </div>

            <div className={cn(
                'rounded-lg border overflow-hidden',
                hasMissed ? 'border-destructive/40' : 'border-border',
            )}>
                {/* Service + status row */}
                <div className="flex items-center gap-2.5 px-3 py-2.5 bg-muted/20">
                    {seq.service_color && (
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: seq.service_color }} />
                    )}
                    <span className="font-semibold text-sm flex-1 min-w-0 truncate">{seq.service_name}</span>
                    <Badge variant={sequenceStatusVariant(seq.status)} className="text-xs shrink-0 gap-1">
                        {seq.status === 'active' && (
                            <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
                        )}
                        {t(`status.${seq.status}`)}
                    </Badge>
                </div>

                {/* Progress bar */}
                <div className="h-1 bg-muted">
                    <div
                        className={cn('h-full transition-all', hasMissed ? 'bg-destructive/60' : 'bg-primary')}
                        style={{ width: `${progress}%` }}
                    />
                </div>

                {/* Body */}
                <div className="px-3 py-2.5 space-y-2">
                    {/* Progress label */}
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{t('progressLabel')}</span>
                        <span className="font-semibold text-primary">{completedCount} / {totalCount} {t('milestones')}</span>
                    </div>

                    {/* Current step */}
                    {currentStep && (
                        <div className={cn(
                            'flex items-start gap-2 rounded-md px-2.5 py-2 text-xs',
                            hasMissed ? 'bg-destructive/10 border border-destructive/20' : 'bg-primary/5 border border-primary/15',
                        )}>
                            <div className="shrink-0 mt-0.5">
                                {hasMissed
                                    ? <XCircle className="h-3.5 w-3.5 text-destructive" />
                                    : <ChevronRight className="h-3.5 w-3.5 text-primary" />}
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

                    {/* Next step (only if current is not missed) */}
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

                {/* Expandable editor */}
                <Collapsible open={stepsOpen}>
                    <button
                        type="button"
                        className="w-full flex items-center justify-between gap-2 px-3 py-1.5 border-t border-border hover:bg-muted/30 transition-colors text-[11px] text-muted-foreground"
                        onClick={() => setStepsOpen(v => !v)}
                    >
                        <span>{t('editSteps')}</span>
                        {stepsOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    </button>
                    <CollapsibleContent>
                        <div className="px-3 pb-3 pt-1 border-t border-border">
                            <StepTimeline
                                sequence={seq}
                                onStepsChange={handleStepsChange}
                                t={t}
                            />
                        </div>
                    </CollapsibleContent>
                </Collapsible>
            </div>
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function UserTreatmentPlans({ userId, onCreateAppointment }: UserTreatmentPlansProps) {
    const t = useTranslations('TreatmentPlans');
    const [sequences, setSequences] = React.useState<TreatmentSequence[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [showHistorical, setShowHistorical] = React.useState(false);

    React.useEffect(() => {
        let cancelled = false;
        setIsLoading(true);
        getTreatmentSequences(userId).then(data => {
            if (!cancelled) {
                setSequences(data);
                setIsLoading(false);
            }
        });
        return () => { cancelled = true; };
    }, [userId]);

    function handleStepsChange(sequenceId: string, steps: TreatmentSequenceStep[]) {
        setSequences(prev => prev.map(seq => seq.id === sequenceId ? { ...seq, steps } : seq));
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
                    <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-xs"
                        onClick={onCreateAppointment}
                    >
                        <PlusCircle className="h-3.5 w-3.5" />
                        {t('createAppointment')}
                    </Button>
                )}
            </div>
        );
    }

    // Split active vs historical
    const active = sequences.filter(s => s.status === 'active' || s.status === 'paused');
    const historical = sequences.filter(s => s.status === 'completed' || s.status === 'cancelled');

    return (
        <div className="space-y-3 pb-4">
            {/* Active / in-progress plans */}
            {active.map(seq => (
                <ActivePlanCard
                    key={seq.id}
                    sequence={seq}
                    onStepsChange={handleStepsChange}
                    t={t}
                />
            ))}

            {/* Historical plans — collapsible */}
            {historical.length > 0 && (
                <div>
                    {/* Toggle header — matches financial stats pattern */}
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
                                    <CompactSequenceCard
                                        key={seq.id}
                                        sequence={seq}
                                        onStepsChange={handleStepsChange}
                                        t={t}
                                    />
                                ))}
                            </div>
                        </CollapsibleContent>
                    </Collapsible>
                </div>
            )}
        </div>
    );
}
