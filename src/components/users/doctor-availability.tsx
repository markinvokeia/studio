'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmActionDialog } from '@/components/ui/confirm-action-dialog';
import {
    Dialog,
    DialogBody,
    DialogCancelButton,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { Skeleton } from '@/components/ui/skeleton';
import {
    AvailabilityRuleFields,
    availabilityRuleFormSchema,
    availabilityRuleToFormValues,
    deleteAvailabilityRule,
    emptyAvailabilityRuleForm,
    parseAvailabilityRule,
    ruleRecurrenceKey,
    upsertAvailabilityRule,
    useAvailabilityRuleDaysLabel,
    type AvailabilityRuleFormValues,
} from '@/components/doctor-availability/availability-rule-form';
import { API_ROUTES } from '@/constants/routes';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useDataLoader } from '@/hooks/use-data-loader';
import { useToast } from '@/hooks/use-toast';
import { useInvalidSubmitToast } from '@/hooks/use-invalid-submit-toast';
import { getErrorMessage } from '@/lib/error-utils';
import { AvailabilityRule } from '@/lib/types';
import { formatDisplayDate } from '@/lib/utils';
import { api, isTimeoutError } from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, CalendarPlus, Pencil, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useForm } from 'react-hook-form';

async function getAvailabilityRulesForUser(userId: string, signal?: AbortSignal): Promise<AvailabilityRule[]> {
    const responseData = await api.get(API_ROUTES.AVAILABILITY_RULES_SEARCH, {
        page: '1',
        limit: '100',
        user_id: userId,
    }, undefined, { signal });
    const data = Array.isArray(responseData) && responseData.length > 0 ? responseData[0] : responseData;
    const rulesData = data?.data || [];
    return rulesData.map(parseAvailabilityRule);
}

export function DoctorAvailability({ userId }: { userId: string }) {
    const t = useTranslations('DoctorAvailabilityPage');
    const tColumns = useTranslations('DoctorAvailabilityColumns');
    const tCommon = useTranslations('Common');
    const { toast } = useToast();

    // Switching doctors quickly can't show another doctor's rules: only the latest load writes.
    const {
        data: rules,
        isLoading,
        isRefreshing,
        error: loadError,
        reload: loadRules,
    } = useDataLoader((signal) => getAvailabilityRulesForUser(userId, signal), [] as AvailabilityRule[], [userId]);
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingRule, setEditingRule] = React.useState<AvailabilityRule | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
    const [deletingRule, setDeletingRule] = React.useState<AvailabilityRule | null>(null);
    const [submissionError, setSubmissionError] = React.useState<string | null>(null);

    const tValidation = useTranslations('DoctorAvailabilityPage.validation');
    const onInvalidSubmit = useInvalidSubmitToast();
    const form = useForm<AvailabilityRuleFormValues>({
        resolver: zodResolver(availabilityRuleFormSchema(tValidation)),
        defaultValues: emptyAvailabilityRuleForm(userId),
    });
    const daysLabel = useAvailabilityRuleDaysLabel();

    const handleCreate = () => {
        setEditingRule(null);
        form.reset(emptyAvailabilityRuleForm(userId));
        setSubmissionError(null);
        setIsDialogOpen(true);
    };

    const handleEdit = (rule: AvailabilityRule) => {
        setEditingRule(rule);
        form.reset(availabilityRuleToFormValues(rule));
        setSubmissionError(null);
        setIsDialogOpen(true);
    };

    const handleDelete = (rule: AvailabilityRule) => {
        setDeletingRule(rule);
        setIsDeleteDialogOpen(true);
    };

    const remove = useAsyncAction(
        (rule: AvailabilityRule) => deleteAvailabilityRule(rule.id),
        {
            onSuccess: async () => {
                toast({ title: t('toast.deleteTitle'), description: t('toast.deleteDescription') });
                setIsDeleteDialogOpen(false);
                setDeletingRule(null);
                await loadRules();
            },
            onError: (error) => { if (isTimeoutError(error)) loadRules(); },
            errorTitle: t('toast.deleteError'),
        }
    );

    const save = useAsyncAction(
        async (values: AvailabilityRuleFormValues) => {
            setSubmissionError(null);
            await upsertAvailabilityRule(values);
            return values;
        },
        {
            onSuccess: async (values) => {
                toast({ title: values.id ? t('toast.editTitle') : t('toast.createTitle'), description: t('toast.successDescription') });
                await loadRules();
                setIsDialogOpen(false);
            },
            onError: (error) => {
                if (isTimeoutError(error)) {
                    // The rule may have been saved anyway: refresh so the user can check before retrying.
                    setSubmissionError(tCommon('timeoutError'));
                    loadRules();
                    return;
                }
                setSubmissionError(getErrorMessage(error) || t('toast.saveError'));
            },
            showErrorToast: false,
        }
    );

    if (isLoading) {
        return (
            <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
            </div>
        );
    }

    if (loadError) {
        // An empty list here would hide the real rules and invite duplicates: show the error instead.
        return (
            <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{tCommon('loadError')}</AlertTitle>
                <AlertDescription className="flex flex-wrap items-center gap-3">
                    <span>{loadError}</span>
                    <Button size="sm" variant="outline" onClick={() => loadRules()} loading={isRefreshing}>
                        {tCommon('retry')}
                    </Button>
                </AlertDescription>
            </Alert>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{t('description')}</p>
                <Button size="sm" onClick={handleCreate}>
                    <Plus className="h-4 w-4 mr-1" />
                    {t('dialog.create')}
                </Button>
            </div>

            {rules.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                    <CalendarPlus className="h-10 w-10 mb-3 opacity-30" />
                    <p className="text-sm">{t('empty')}</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {rules.map((rule) => (
                        <div key={rule.id} className="flex items-start justify-between rounded-lg border px-4 py-3 gap-4">
                            <div className="flex flex-col gap-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <Badge variant="outline" className="text-xs">{t(`dialog.${ruleRecurrenceKey(rule)}`)}</Badge>
                                    <span className="text-xs text-muted-foreground">
                                        {rule.recurrence === 'monthly' ? `${t('dialog.daysOfMonth')}: ${daysLabel(rule)}` : daysLabel(rule)}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3 text-sm">
                                    <span>{rule.start_time} – {rule.end_time}</span>
                                    <span className="text-muted-foreground text-xs">{formatDisplayDate(rule.start_date)} → {rule.end_date ? formatDisplayDate(rule.end_date) : '∞'}</span>
                                </div>
                            </div>
                            <div className="flex gap-1 flex-none">
                                <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={t('dialog.editTitle')} onClick={() => handleEdit(rule)}>
                                    <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" aria-label={t('deleteDialog.confirm')} onClick={() => handleDelete(rule)}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <Dialog
                open={isDialogOpen}
                onOpenChange={(open) => {
                    if (!open && save.isPending) return;
                    setIsDialogOpen(open);
                }}
            >
                <DialogContent confirmOnClose isDirty={form.formState.isDirty && !save.isPending}>
                    <DialogHeader>
                        <DialogTitle>{editingRule ? t('dialog.editTitle') : t('dialog.createTitle')}</DialogTitle>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(save.run, onInvalidSubmit)} className="flex flex-col flex-1 overflow-hidden">
                            <DialogBody className="space-y-4 py-4 px-6">
                                {submissionError && (
                                    <Alert variant="destructive">
                                        <AlertTriangle className="h-4 w-4" />
                                        <AlertTitle>{t('toast.errorTitle')}</AlertTitle>
                                        <AlertDescription>{submissionError}</AlertDescription>
                                    </Alert>
                                )}
                                {/* Native fieldset disables every control while the request is in flight */}
                                <fieldset disabled={save.isPending} className="min-w-0 space-y-4">
                                <AvailabilityRuleFields form={form} />
                                </fieldset>
                            </DialogBody>
                            <DialogFooter>
                                <Button type="submit" loading={save.isPending}>{editingRule ? t('dialog.save') : t('dialog.create')}</Button>
                                <DialogCancelButton variant="outline" disabled={save.isPending}>{t('dialog.cancel')}</DialogCancelButton>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            <ConfirmActionDialog
                open={isDeleteDialogOpen}
                onOpenChange={setIsDeleteDialogOpen}
                title={t('deleteDialog.title')}
                description={t('deleteDialog.description', {
                    doctor: deletingRule?.user_name || '',
                    schedule: deletingRule ? `${t(`dialog.${ruleRecurrenceKey(deletingRule)}`)} · ${daysLabel(deletingRule)} ${deletingRule.start_time}–${deletingRule.end_time}` : '',
                })}
                cancelLabel={t('deleteDialog.cancel')}
                confirmLabel={t('deleteDialog.confirm')}
                onConfirm={() => { if (deletingRule) remove.run(deletingRule); }}
                isPending={remove.isPending}
            />
        </div>
    );
}
