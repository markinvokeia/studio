'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import {
    CalendarCheck,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    Circle,
    ClipboardList,
    Clock,
    Loader2,
    MoreHorizontal,
    Pencil,
    PlusCircle,
    Trash2,
    X,
    XCircle,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

interface UserTreatmentPlansProps {
    userId: string;
    userName?: string;
}

function sequenceStatusVariant(status: TreatmentSequenceStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
    switch (status) {
        case 'active': return 'default';
        case 'completed': return 'secondary';
        case 'cancelled': return 'destructive';
        case 'paused': return 'outline';
    }
}

function stepStatusIcon(status: TreatmentSequenceStepStatus) {
    switch (status) {
        case 'completed': return <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />;
        case 'scheduled': return <CalendarCheck className="h-4 w-4 text-blue-500 shrink-0" />;
        case 'missed': return <XCircle className="h-4 w-4 text-destructive shrink-0" />;
        case 'cancelled': return <XCircle className="h-4 w-4 text-muted-foreground shrink-0" />;
        default: return <Circle className="h-4 w-4 text-muted-foreground shrink-0" />;
    }
}

function stepStatusClass(status: TreatmentSequenceStepStatus): string {
    switch (status) {
        case 'completed': return 'text-green-600 dark:text-green-400';
        case 'scheduled': return 'text-blue-600 dark:text-blue-400';
        case 'missed': return 'text-destructive';
        case 'cancelled': return 'text-muted-foreground line-through';
        default: return 'text-muted-foreground';
    }
}

function formatDate(dateStr?: string): string {
    if (!dateStr) return '—';
    try {
        return format(parseISO(dateStr), 'dd/MM/yyyy');
    } catch {
        return dateStr;
    }
}

const STEP_STATUS_OPTIONS: TreatmentSequenceStepStatus[] = ['pending', 'scheduled', 'completed', 'missed', 'cancelled'];

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
                <Input
                    value={stepName}
                    onChange={e => setStepName(e.target.value)}
                    className="h-8 text-sm mt-0.5"
                />
            </div>
            <div>
                <Label className="text-xs text-muted-foreground">{t('edit.scheduledDate')}</Label>
                <DatePickerInput value={date} onChange={setDate} className="mt-0.5" />
            </div>
            <div>
                <Label className="text-xs text-muted-foreground">{t('edit.status')}</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as TreatmentSequenceStepStatus)}>
                    <SelectTrigger className="h-8 text-sm mt-0.5">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {STEP_STATUS_OPTIONS.map(s => (
                            <SelectItem key={s} value={s} className="text-sm">
                                {t(`stepStatus.${s}`)}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div>
                <Label className="text-xs text-muted-foreground">{t('edit.notes')}</Label>
                <Input
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="h-8 text-sm mt-0.5 text-muted-foreground"
                    placeholder={t('edit.notesPlaceholder')}
                />
            </div>
            <div className="flex gap-2 pt-1">
                <Button
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={handleSave}
                    disabled={isSaving || !stepName.trim()}
                >
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

interface AddStepFormProps {
    nextStepNumber: number;
    onAdd: (step: Omit<TreatmentSequenceStep, 'id'>) => Promise<void>;
    onCancel: () => void;
    t: ReturnType<typeof useTranslations>;
}

function AddStepForm({ nextStepNumber, onAdd, onCancel, t }: AddStepFormProps) {
    const [stepName, setStepName] = React.useState('');
    const [date, setDate] = React.useState('');
    const [notes, setNotes] = React.useState('');
    const [isSaving, setIsSaving] = React.useState(false);

    async function handleAdd() {
        if (!stepName.trim()) return;
        setIsSaving(true);
        try {
            await onAdd({
                step_number: nextStepNumber,
                step_name: stepName,
                scheduled_date: date || undefined,
                notes: notes || undefined,
                status: 'pending',
            });
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <div className="border rounded-md p-3 space-y-2 mt-2 bg-muted/20">
            <p className="text-xs font-semibold text-muted-foreground">
                {t('edit.addStepTitle', { number: nextStepNumber })}
            </p>
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
                <Label className="text-xs text-muted-foreground">{t('edit.notes')}</Label>
                <Input
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="h-8 text-sm mt-0.5 text-muted-foreground"
                    placeholder={t('edit.notesPlaceholder')}
                />
            </div>
            <div className="flex gap-2 pt-1">
                <Button
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={handleAdd}
                    disabled={isSaving || !stepName.trim()}
                >
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

// ─── Sequence card ────────────────────────────────────────────────────────────

function SequenceCard({
    sequence,
    onStepsChange,
    t,
}: {
    sequence: TreatmentSequence;
    onStepsChange: (sequenceId: string, steps: TreatmentSequenceStep[]) => void;
    t: ReturnType<typeof useTranslations>;
}) {
    const [expanded, setExpanded] = React.useState(true);
    const [editingStepId, setEditingStepId] = React.useState<string | null>(null);
    const [isAddingStep, setIsAddingStep] = React.useState(false);

    const completedSteps = sequence.steps.filter(s => s.status === 'completed').length;
    const totalSteps = sequence.steps.length;

    async function handleStepSave(stepId: string, patch: Partial<TreatmentSequenceStep>) {
        await updateTreatmentSequenceStep(sequence.id, stepId, patch);
        const updatedSteps = sequence.steps.map(s =>
            s.id === stepId ? { ...s, ...patch } : s
        );
        onStepsChange(sequence.id, updatedSteps);
        setEditingStepId(null);
    }

    async function handleStepDelete(stepId: string) {
        await deleteTreatmentSequenceStep(sequence.id, stepId);
        const updatedSteps = sequence.steps
            .filter(s => s.id !== stepId)
            .map((s, i) => ({ ...s, step_number: i + 1 }));
        onStepsChange(sequence.id, updatedSteps);
    }

    async function handleStepAdd(step: Omit<TreatmentSequenceStep, 'id'>) {
        const newStep = await addTreatmentSequenceStep(sequence.id, step);
        onStepsChange(sequence.id, [...sequence.steps, newStep]);
        setIsAddingStep(false);
    }

    async function handleStatusChange(stepId: string, status: TreatmentSequenceStepStatus) {
        await updateSequenceStepStatus(sequence.id, stepId, status);
        const updatedSteps = sequence.steps.map(s =>
            s.id === stepId
                ? { ...s, status, completed_at: status === 'completed' ? new Date().toISOString() : s.completed_at }
                : s
        );
        onStepsChange(sequence.id, updatedSteps);
    }

    return (
        <div className="border rounded-lg overflow-hidden">
            {/* Card header */}
            <button
                className="w-full flex items-center gap-3 p-3 hover:bg-muted/40 transition-colors text-left"
                onClick={() => setExpanded(v => !v)}
            >
                {sequence.service_color && (
                    <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: sequence.service_color }} />
                )}
                <span className="font-medium text-sm flex-1 min-w-0 truncate">{sequence.service_name}</span>
                <Badge variant={sequenceStatusVariant(sequence.status)} className="text-xs shrink-0">
                    {t(`status.${sequence.status}`)}
                </Badge>
                <span className="text-xs text-muted-foreground shrink-0">
                    {completedSteps}/{totalSteps} {t('steps')}
                </span>
                {expanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
            </button>

            {/* Progress bar */}
            <div className="h-1 bg-muted">
                <div
                    className="h-1 bg-primary transition-all"
                    style={{ width: totalSteps > 0 ? `${(completedSteps / totalSteps) * 100}%` : '0%' }}
                />
            </div>

            {/* Steps timeline */}
            {expanded && (
                <div className="p-3 space-y-0">
                    <p className="text-xs text-muted-foreground mb-3">
                        <Clock className="h-3 w-3 inline mr-1" />
                        {t('startedAt')}: {formatDate(sequence.started_at)}
                    </p>

                    {sequence.steps.map((step, idx) => (
                        <div key={step.id} className="flex gap-3 min-h-[2.5rem]">
                            {/* Timeline connector */}
                            <div className="flex flex-col items-center shrink-0 w-6">
                                <div className="mt-0.5">{stepStatusIcon(step.status)}</div>
                                {(idx < sequence.steps.length - 1 || isAddingStep) && (
                                    <div className="flex-1 w-px bg-border mt-1" />
                                )}
                            </div>

                            {/* Step content */}
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
                                                    {formatDate(step.scheduled_date)}
                                                    {step.status === 'completed' && step.completed_at && (
                                                        <span className="text-green-600 dark:text-green-400 ml-1">
                                                            · {t('stepStatus.completed')}
                                                        </span>
                                                    )}
                                                </p>
                                            )}
                                            {step.notes && (
                                                <p className="text-xs text-muted-foreground italic mt-0.5">{step.notes}</p>
                                            )}
                                        </div>
                                        {/* Step actions */}
                                        <div className="flex items-center gap-0.5 shrink-0">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                                title={t('edit.editStep')}
                                                onClick={() => {
                                                    setIsAddingStep(false);
                                                    setEditingStepId(step.id);
                                                }}
                                            >
                                                <Pencil className="h-3 w-3" />
                                            </Button>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                                    >
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

                    {/* Add step inline form */}
                    {isAddingStep ? (
                        <div className="flex gap-3">
                            <div className="flex flex-col items-center shrink-0 w-6">
                                <div className="mt-1">
                                    <Circle className="h-4 w-4 text-muted-foreground/40" />
                                </div>
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
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="w-full mt-1 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => {
                                setEditingStepId(null);
                                setIsAddingStep(true);
                            }}
                        >
                            <PlusCircle className="h-3.5 w-3.5" />
                            {t('edit.addStep')}
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function UserTreatmentPlans({ userId }: UserTreatmentPlansProps) {
    const t = useTranslations('TreatmentPlans');
    const [sequences, setSequences] = React.useState<TreatmentSequence[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);

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
        setSequences(prev =>
            prev.map(seq => (seq.id === sequenceId ? { ...seq, steps } : seq))
        );
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
                <Clock className="h-4 w-4 mr-2 animate-spin" />
                {t('loading')}
            </div>
        );
    }

    if (sequences.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center px-4">
                <ClipboardList className="h-10 w-10 text-muted-foreground/40" />
                <p className="font-medium text-sm text-muted-foreground">{t('emptyState')}</p>
                <p className="text-xs text-muted-foreground max-w-xs">{t('emptyStateDescription')}</p>
            </div>
        );
    }

    return (
        <div className="space-y-3 px-0 pb-4">
            <div className="flex items-center gap-2 px-0 pt-1">
                <ClipboardList className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">{t('title')}</h3>
                <Badge variant="secondary" className="text-xs">{sequences.length}</Badge>
            </div>
            {sequences.map(seq => (
                <SequenceCard
                    key={seq.id}
                    sequence={seq}
                    onStepsChange={handleStepsChange}
                    t={t}
                />
            ))}
        </div>
    );
}
