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
    AvailabilityExceptionFields,
    availabilityExceptionFormSchema,
    availabilityExceptionToFormValues,
    deleteAvailabilityException,
    emptyAvailabilityExceptionForm,
    parseAvailabilityException,
    upsertAvailabilityException,
    type AvailabilityExceptionFormValues,
} from '@/components/doctor-availability/availability-exception-form';
import { multiDateLabel } from '@/components/schedules/day-pickers';
import { API_ROUTES } from '@/constants/routes';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useDataLoader } from '@/hooks/use-data-loader';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/lib/error-utils';
import { AvailabilityException } from '@/lib/types';
import { api, isTimeoutError } from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, Pencil, Plus, Trash2, UserX } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useForm } from 'react-hook-form';

async function getExceptionsForUser(userId: string, signal?: AbortSignal): Promise<AvailabilityException[]> {
    const responseData = await api.get(API_ROUTES.AVAILABILITY_EXCEPTIONS_SEARCH, {
        page: '1',
        limit: '100',
        user_id: userId,
    }, undefined, { signal });
    const data = Array.isArray(responseData) && responseData.length > 0 ? responseData[0] : responseData;
    const exceptionsData = data?.data || [];
    return exceptionsData.map(parseAvailabilityException);
}

export function DoctorAvailabilityExceptions({ userId }: { userId: string }) {
    const t = useTranslations('DoctorAvailabilityExceptionsPage');
    const tColumns = useTranslations('DoctorAvailabilityExceptionsPage.columns');
    const tCommon = useTranslations('Common');
    const { toast } = useToast();

    // Switching doctors quickly can't show another doctor's exceptions: only the latest load writes.
    const {
        data: exceptions,
        isLoading,
        isRefreshing,
        error: loadError,
        reload: loadExceptions,
    } = useDataLoader((signal) => getExceptionsForUser(userId, signal), [] as AvailabilityException[], [userId]);
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingException, setEditingException] = React.useState<AvailabilityException | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
    const [deletingException, setDeletingException] = React.useState<AvailabilityException | null>(null);
    const [submissionError, setSubmissionError] = React.useState<string | null>(null);

    const tValidation = useTranslations('DoctorAvailabilityExceptionsPage.validation');
    const form = useForm<AvailabilityExceptionFormValues>({
        resolver: zodResolver(availabilityExceptionFormSchema(tValidation)),
        defaultValues: emptyAvailabilityExceptionForm(userId),
    });

    const handleCreate = () => {
        setEditingException(null);
        form.reset(emptyAvailabilityExceptionForm(userId));
        setSubmissionError(null);
        setIsDialogOpen(true);
    };

    const handleEdit = (ex: AvailabilityException) => {
        setEditingException(ex);
        form.reset(availabilityExceptionToFormValues(ex));
        setSubmissionError(null);
        setIsDialogOpen(true);
    };

    const handleDelete = (ex: AvailabilityException) => {
        setDeletingException(ex);
        setIsDeleteDialogOpen(true);
    };

    const remove = useAsyncAction(
        (ex: AvailabilityException) => deleteAvailabilityException(ex.id),
        {
            onSuccess: async () => {
                toast({ title: t('toast.deleteTitle'), description: t('toast.deleteDescription') });
                setIsDeleteDialogOpen(false);
                setDeletingException(null);
                await loadExceptions();
            },
            onError: (error) => { if (isTimeoutError(error)) loadExceptions(); },
            errorTitle: t('toast.deleteError'),
        }
    );

    const save = useAsyncAction(
        async (values: AvailabilityExceptionFormValues) => {
            setSubmissionError(null);
            await upsertAvailabilityException(values);
            return values;
        },
        {
            onSuccess: async (values) => {
                toast({ title: values.id ? t('toast.editTitle') : t('toast.createTitle'), description: t('toast.successDescription') });
                await loadExceptions();
                setIsDialogOpen(false);
            },
            onError: (error) => {
                if (isTimeoutError(error)) {
                    // The exception may have been saved anyway: refresh so the user can check before retrying.
                    setSubmissionError(tCommon('timeoutError'));
                    loadExceptions();
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
                    <Button size="sm" variant="outline" onClick={() => loadExceptions()} loading={isRefreshing}>
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

            {exceptions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                    <UserX className="h-10 w-10 mb-3 opacity-30" />
                    <p className="text-sm">{t('empty')}</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {exceptions.map((ex) => (
                        <div key={ex.id} className="flex items-start justify-between rounded-lg border px-4 py-3 gap-4">
                            <div className="flex flex-col gap-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-medium">{multiDateLabel(ex.dates, ex.exception_date)}</span>
                                    <Badge variant={ex.is_available ? 'success' : 'destructive'} className="text-xs">
                                        {ex.is_available ? tColumns('yes') : tColumns('no')}
                                    </Badge>
                                </div>
                                {(ex.start_time || ex.end_time) && (
                                    <span className="text-xs text-muted-foreground">{ex.start_time} – {ex.end_time}</span>
                                )}
                            </div>
                            <div className="flex gap-1 flex-none">
                                <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={t('dialog.editTitle')} onClick={() => handleEdit(ex)}>
                                    <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" aria-label={t('deleteDialog.confirm')} onClick={() => handleDelete(ex)}>
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
                        <DialogTitle>{editingException ? t('dialog.editTitle') : t('dialog.createTitle')}</DialogTitle>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(save.run)} className="flex flex-col flex-1 overflow-hidden">
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
                                <AvailabilityExceptionFields form={form} />
                                </fieldset>
                            </DialogBody>
                            <DialogFooter>
                                <Button type="submit" loading={save.isPending}>{editingException ? t('dialog.save') : t('dialog.create')}</Button>
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
                    doctor: deletingException?.user_name || '',
                    date: deletingException ? multiDateLabel(deletingException.dates, deletingException.exception_date) : '',
                })}
                cancelLabel={t('deleteDialog.cancel')}
                confirmLabel={t('deleteDialog.confirm')}
                onConfirm={() => { if (deletingException) remove.run(deletingException); }}
                isPending={remove.isPending}
            />
        </div>
    );
}
