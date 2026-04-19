'use client';

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
import { ScrollArea } from '@/components/ui/scroll-area';
import { TreatmentSequence, TreatmentSequenceStep } from '@/lib/types';
import { ClipboardList, Loader2, PlusCircle, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

interface TreatmentPlanReviewDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    pendingSequence: TreatmentSequence;
    onConfirm: (sequence: TreatmentSequence) => Promise<void>;
}

export function TreatmentPlanReviewDialog({
    open,
    onOpenChange,
    pendingSequence,
    onConfirm,
}: TreatmentPlanReviewDialogProps) {
    const t = useTranslations('TreatmentPlans');
    const [steps, setSteps] = React.useState<TreatmentSequenceStep[]>([]);
    const [isConfirming, setIsConfirming] = React.useState(false);

    // Reset editable steps whenever the dialog opens with a new sequence
    React.useEffect(() => {
        if (open) {
            setSteps(pendingSequence.steps.map(s => ({ ...s })));
        }
    }, [open, pendingSequence]);

    function updateStep(idx: number, patch: Partial<TreatmentSequenceStep>) {
        setSteps(prev => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
    }

    function removeStep(idx: number) {
        setSteps(prev =>
            prev
                .filter((_, i) => i !== idx)
                .map((s, i) => ({ ...s, step_number: i + 1 }))
        );
    }

    function addStep() {
        const lastDate =
            steps.length > 0
                ? steps[steps.length - 1].scheduled_date
                : pendingSequence.started_at;
        setSteps(prev => [
            ...prev,
            {
                id: `new_${Date.now()}`,
                step_number: prev.length + 1,
                step_name: '',
                scheduled_date: lastDate,
                status: 'pending',
            },
        ]);
    }

    async function handleConfirm() {
        setIsConfirming(true);
        try {
            await onConfirm({ ...pendingSequence, steps });
            onOpenChange(false);
        } finally {
            setIsConfirming(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ClipboardList className="h-5 w-5 text-primary shrink-0" />
                        {t('review.title')}
                    </DialogTitle>
                    <DialogDescription>
                        {t('review.description', { service: pendingSequence.service_name })}
                    </DialogDescription>
                </DialogHeader>
                <DialogBody>
                    <ScrollArea className="max-h-[55vh] pr-1">
                        <div className="space-y-0 pt-1">
                            {steps.map((step, idx) => (
                                <div key={step.id} className="flex gap-3">
                                    {/* Timeline column */}
                                    <div className="flex flex-col items-center shrink-0 w-7 pt-2">
                                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold shrink-0">
                                            {step.step_number}
                                        </div>
                                        {idx < steps.length - 1 && (
                                            <div className="flex-1 w-px bg-border mt-1 mb-1 min-h-[1rem]" />
                                        )}
                                    </div>
                                    {/* Editable step fields */}
                                    <div className="flex-1 pb-4 space-y-2">
                                        <div className="flex items-center gap-2">
                                            <Input
                                                placeholder={t('review.stepNamePlaceholder')}
                                                value={step.step_name}
                                                onChange={e => updateStep(idx, { step_name: e.target.value })}
                                                className="h-8 text-sm flex-1"
                                            />
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                                                onClick={() => removeStep(idx)}
                                                title={t('review.removeStep')}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                        <DatePickerInput
                                            value={step.scheduled_date}
                                            onChange={v => updateStep(idx, { scheduled_date: v })}
                                            placeholder={t('review.datePlaceholder')}
                                        />
                                        <Input
                                            placeholder={t('review.notesPlaceholder')}
                                            value={step.notes ?? ''}
                                            onChange={e => updateStep(idx, { notes: e.target.value })}
                                            className="h-8 text-sm text-muted-foreground"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full mt-1 gap-1.5 text-xs"
                            onClick={addStep}
                        >
                            <PlusCircle className="h-3.5 w-3.5" />
                            {t('review.addStep')}
                        </Button>
                    </ScrollArea>
                </DialogBody>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isConfirming}
                    >
                        {t('review.cancel')}
                    </Button>
                    <Button onClick={handleConfirm} disabled={isConfirming || steps.length === 0}>
                        {isConfirming ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                {t('review.confirming')}
                            </>
                        ) : (
                            t('review.confirm')
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
