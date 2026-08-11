'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogBody,
    DialogCancelButton,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { DatePickerInput } from '@/components/ui/date-picker';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/lib/error-utils';
import { AvailabilityException } from '@/lib/types';
import { formatDate, formatDisplayDate } from '@/lib/utils';
import { api } from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { format, parseISO } from 'date-fns';
import { AlertTriangle, Pencil, Plus, Trash2, UserX } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

const exceptionFormSchema = (t: (key: string) => string) => z.object({
    id: z.string().optional(),
    user_id: z.string(),
    exception_date: z.string().min(1, t('dateRequired')),
    start_time: z.string().optional(),
    end_time: z.string().optional(),
    is_available: z.boolean().default(false),
});

type ExceptionFormValues = z.infer<ReturnType<typeof exceptionFormSchema>>;

async function getExceptionsForUser(userId: string): Promise<AvailabilityException[]> {
    try {
        const responseData = await api.get(API_ROUTES.AVAILABILITY_EXCEPTIONS_SEARCH, {
            page: '1',
            limit: '100',
            user_id: userId,
        });
        const data = Array.isArray(responseData) && responseData.length > 0 ? responseData[0] : responseData;
        const exceptionsData = data.data || [];
        return exceptionsData.map((ex: any) => ({
            ...ex,
            id: String(ex.id),
            exception_date: formatDate(ex.exception_date),
        }));
    } catch {
        return [];
    }
}

async function upsertException(data: ExceptionFormValues) {
    const responseData = await api.post(API_ROUTES.AVAILABILITY_EXCEPTIONS_UPSERT, data);
    if (Array.isArray(responseData) && responseData[0]?.code >= 400 || responseData.error) {
        const message = responseData.message || (Array.isArray(responseData) && responseData[0]?.message);
        throw new Error(message);
    }
    return responseData;
}

async function deleteException(id: string) {
    const responseData = await api.delete(API_ROUTES.AVAILABILITY_EXCEPTIONS_DELETE, { id });
    if (Array.isArray(responseData) && responseData[0]?.code >= 400 || responseData.error) {
        const message = responseData.message || (Array.isArray(responseData) && responseData[0]?.message);
        throw new Error(message);
    }
    return responseData;
}

export function DoctorAvailabilityExceptions({ userId }: { userId: string }) {
    const t = useTranslations('DoctorAvailabilityExceptionsPage');
    const tColumns = useTranslations('DoctorAvailabilityExceptionsPage.columns');
    const { toast } = useToast();

    const [exceptions, setExceptions] = React.useState<AvailabilityException[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingException, setEditingException] = React.useState<AvailabilityException | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
    const [deletingException, setDeletingException] = React.useState<AvailabilityException | null>(null);
    const [submissionError, setSubmissionError] = React.useState<string | null>(null);

    const tValidation = useTranslations('DoctorAvailabilityExceptionsPage.validation');
    const form = useForm<ExceptionFormValues>({
        resolver: zodResolver(exceptionFormSchema(tValidation)),
    });

    const loadExceptions = React.useCallback(async () => {
        setIsLoading(true);
        const data = await getExceptionsForUser(userId);
        setExceptions(data);
        setIsLoading(false);
    }, [userId]);

    React.useEffect(() => {
        loadExceptions();
    }, [loadExceptions]);

    const handleCreate = () => {
        setEditingException(null);
        form.reset({
            user_id: userId,
            exception_date: format(new Date(), 'yyyy-MM-dd'),
            start_time: '',
            end_time: '',
            is_available: false,
        });
        setSubmissionError(null);
        setIsDialogOpen(true);
    };

    const handleEdit = (ex: AvailabilityException) => {
        setEditingException(ex);
        form.reset({
            id: ex.id,
            user_id: ex.user_id,
            exception_date: formatDate(ex.exception_date),
            start_time: ex.start_time || '',
            end_time: ex.end_time || '',
            is_available: ex.is_available,
        });
        setSubmissionError(null);
        setIsDialogOpen(true);
    };

    const handleDelete = (ex: AvailabilityException) => {
        setDeletingException(ex);
        setIsDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
        if (!deletingException) return;
        try {
            await deleteException(deletingException.id);
            toast({ title: t('toast.deleteTitle'), description: t('toast.deleteDescription') });
            setIsDeleteDialogOpen(false);
            setDeletingException(null);
            loadExceptions();
        } catch (error) {
            toast({ variant: 'destructive', title: t('toast.errorTitle'), description: getErrorMessage(error) });
        }
    };

    const onSubmit = async (values: ExceptionFormValues) => {
        setSubmissionError(null);
        try {
            await upsertException(values);
            toast({ title: editingException ? t('toast.editTitle') : t('toast.createTitle'), description: t('toast.successDescription') });
            setIsDialogOpen(false);
            loadExceptions();
        } catch (error) {
            setSubmissionError(getErrorMessage(error));
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
            </div>
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
                                    <span className="text-sm font-medium">{formatDisplayDate(ex.exception_date)}</span>
                                    <Badge variant={ex.is_available ? 'success' : 'destructive'} className="text-xs">
                                        {ex.is_available ? tColumns('yes') : tColumns('no')}
                                    </Badge>
                                </div>
                                {(ex.start_time || ex.end_time) && (
                                    <span className="text-xs text-muted-foreground">{ex.start_time} – {ex.end_time}</span>
                                )}
                            </div>
                            <div className="flex gap-1 flex-none">
                                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEdit(ex)}>
                                    <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(ex)}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent confirmOnClose isDirty={form.formState.isDirty}>
                    <DialogHeader>
                        <DialogTitle>{editingException ? t('dialog.editTitle') : t('dialog.createTitle')}</DialogTitle>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
                            <DialogBody className="space-y-4 py-4 px-6">
                                {submissionError && (
                                    <Alert variant="destructive">
                                        <AlertTriangle className="h-4 w-4" />
                                        <AlertTitle>{t('toast.errorTitle')}</AlertTitle>
                                        <AlertDescription>{submissionError}</AlertDescription>
                                    </Alert>
                                )}
                                <FormField control={form.control} name="exception_date" render={({ field }) => (
                                    <FormItem><FormLabel>{t('dialog.date')}</FormLabel><FormControl><DatePickerInput value={field.value} onChange={field.onChange} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField
                                    control={form.control}
                                    name="is_available"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                            <FormControl>
                                                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                            </FormControl>
                                            <FormLabel>{t('dialog.isAvailable')}</FormLabel>
                                        </FormItem>
                                    )}
                                />
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField control={form.control} name="start_time" render={({ field }) => (<FormItem><FormLabel>{t('dialog.startTime')}</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={form.control} name="end_time" render={({ field }) => (<FormItem><FormLabel>{t('dialog.endTime')}</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                </div>
                            </DialogBody>
                            <DialogFooter>
                                <Button type="submit">{editingException ? t('dialog.save') : t('dialog.create')}</Button>
                                <DialogCancelButton variant="outline">{t('dialog.cancel')}</DialogCancelButton>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('deleteDialog.title')}</AlertDialogTitle>
                        <AlertDialogDescription>{t('deleteDialog.description')}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">{t('deleteDialog.confirm')}</AlertDialogAction>
                        <AlertDialogCancel>{t('deleteDialog.cancel')}</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
