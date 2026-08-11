'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/lib/error-utils';
import { AvailabilityRule } from '@/lib/types';
import { formatDate, formatDisplayDate } from '@/lib/utils';
import { api } from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { AlertTriangle, CalendarPlus, Pencil, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

const availabilityFormSchema = (t: (key: string) => string) => z.object({
    id: z.string().optional(),
    user_id: z.string(),
    recurrence: z.enum(['daily', 'weekly', 'biweekly']),
    day_of_week: z.string().optional(),
    start_time: z.string().min(1, t('startTimeRequired')),
    end_time: z.string().min(1, t('endTimeRequired')),
    start_date: z.string().min(1, t('startDateRequired')),
    end_date: z.string().optional(),
}).refine(data => {
    if ((data.recurrence === 'weekly' || data.recurrence === 'biweekly') && !data.day_of_week) {
        return false;
    }
    return true;
}, {
    message: t('dayOfWeekRequired'),
    path: ["day_of_week"],
}).refine(data => {
    if (!data.start_time || !data.end_time) return true;
    return data.end_time > data.start_time;
}, {
    message: t('endTimeAfterStartTime'),
    path: ["end_time"],
});

type AvailabilityFormValues = z.infer<ReturnType<typeof availabilityFormSchema>>;

async function getAvailabilityRulesForUser(userId: string): Promise<AvailabilityRule[]> {
    try {
        const responseData = await api.get(API_ROUTES.AVAILABILITY_RULES_SEARCH, {
            page: '1',
            limit: '100',
            user_id: userId,
        });
        const data = Array.isArray(responseData) && responseData.length > 0 ? responseData[0] : responseData;
        const rulesData = data.data || [];
        return rulesData.map((rule: any) => ({ ...rule, id: String(rule.id) }));
    } catch {
        return [];
    }
}

async function upsertAvailabilityRule(ruleData: AvailabilityFormValues) {
    const responseData = await api.post(API_ROUTES.AVAILABILITY_RULES_UPSERT, {
        ...ruleData,
        day_of_week: ruleData.day_of_week ? Number(ruleData.day_of_week) : null,
    });
    if (responseData.error || (Array.isArray(responseData) && responseData[0]?.code >= 400)) {
        const message = responseData.message || (Array.isArray(responseData) && responseData[0]?.message);
        throw new Error(message);
    }
    return responseData;
}

async function deleteAvailabilityRule(id: string) {
    const responseData = await api.delete(API_ROUTES.AVAILABILITY_RULES_DELETE, { id });
    if (responseData.error || (Array.isArray(responseData) && responseData[0]?.code >= 400)) {
        const message = responseData.message || (Array.isArray(responseData) && responseData[0]?.message);
        throw new Error(message);
    }
    return responseData;
}

const DAY_NAMES = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

export function DoctorAvailability({ userId }: { userId: string }) {
    const t = useTranslations('DoctorAvailabilityPage');
    const tColumns = useTranslations('DoctorAvailabilityColumns');
    const { toast } = useToast();

    const [rules, setRules] = React.useState<AvailabilityRule[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingRule, setEditingRule] = React.useState<AvailabilityRule | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
    const [deletingRule, setDeletingRule] = React.useState<AvailabilityRule | null>(null);
    const [submissionError, setSubmissionError] = React.useState<string | null>(null);

    const tValidation = useTranslations('DoctorAvailabilityPage.validation');
    const form = useForm<AvailabilityFormValues>({
        resolver: zodResolver(availabilityFormSchema(tValidation)),
    });
    const watchedRecurrence = form.watch('recurrence');

    React.useEffect(() => {
        if (watchedRecurrence === 'daily') {
            form.setValue('day_of_week', undefined);
        }
    }, [watchedRecurrence, form]);

    const loadRules = React.useCallback(async () => {
        setIsLoading(true);
        const data = await getAvailabilityRulesForUser(userId);
        setRules(data);
        setIsLoading(false);
    }, [userId]);

    React.useEffect(() => {
        loadRules();
    }, [loadRules]);

    const handleCreate = () => {
        setEditingRule(null);
        form.reset({
            user_id: userId,
            recurrence: 'weekly',
            start_time: '',
            end_time: '',
            start_date: format(new Date(), 'yyyy-MM-dd'),
            end_date: '',
        });
        setSubmissionError(null);
        setIsDialogOpen(true);
    };

    const handleEdit = (rule: AvailabilityRule) => {
        setEditingRule(rule);
        form.reset({
            id: rule.id,
            user_id: rule.user_id,
            recurrence: rule.recurrence as any,
            day_of_week: rule.day_of_week?.toString(),
            start_time: rule.start_time,
            end_time: rule.end_time,
            start_date: formatDate(rule.start_date),
            end_date: rule.end_date ? formatDate(rule.end_date) : '',
        });
        setSubmissionError(null);
        setIsDialogOpen(true);
    };

    const handleDelete = (rule: AvailabilityRule) => {
        setDeletingRule(rule);
        setIsDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
        if (!deletingRule) return;
        try {
            await deleteAvailabilityRule(deletingRule.id);
            toast({ title: t('toast.deleteTitle'), description: t('toast.deleteDescription') });
            setIsDeleteDialogOpen(false);
            setDeletingRule(null);
            loadRules();
        } catch (error) {
            toast({ variant: 'destructive', title: t('toast.errorTitle'), description: getErrorMessage(error) });
        }
    };

    const onSubmit = async (values: AvailabilityFormValues) => {
        setSubmissionError(null);
        try {
            await upsertAvailabilityRule(values);
            toast({ title: editingRule ? t('toast.editTitle') : t('toast.createTitle'), description: t('toast.successDescription') });
            setIsDialogOpen(false);
            loadRules();
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
                                    <Badge variant="outline" className="text-xs">{t(`dialog.${rule.recurrence}`)}</Badge>
                                    {rule.day_of_week !== undefined && rule.day_of_week !== null && (
                                        <span className="text-xs text-muted-foreground">{t(`days.${DAY_NAMES[rule.day_of_week - 1]}`)}</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-3 text-sm">
                                    <span>{rule.start_time} – {rule.end_time}</span>
                                    <span className="text-muted-foreground text-xs">{formatDisplayDate(rule.start_date)} → {rule.end_date ? formatDisplayDate(rule.end_date) : '∞'}</span>
                                </div>
                            </div>
                            <div className="flex gap-1 flex-none">
                                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEdit(rule)}>
                                    <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(rule)}>
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
                        <DialogTitle>{editingRule ? t('dialog.editTitle') : t('dialog.createTitle')}</DialogTitle>
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
                                <FormField
                                    control={form.control}
                                    name="recurrence"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('dialog.recurrence')}</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl><SelectTrigger><SelectValue placeholder={t('dialog.selectRecurrence')} /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    <SelectItem value="daily">{t('dialog.daily')}</SelectItem>
                                                    <SelectItem value="weekly">{t('dialog.weekly')}</SelectItem>
                                                    <SelectItem value="biweekly">{t('dialog.biweekly')}</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                {(watchedRecurrence === 'weekly' || watchedRecurrence === 'biweekly') && (
                                    <FormField
                                        control={form.control}
                                        name="day_of_week"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{t('dialog.dayOfWeek')}</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl><SelectTrigger><SelectValue placeholder={t('dialog.selectDay')} /></SelectTrigger></FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="1">{t('days.monday')}</SelectItem>
                                                        <SelectItem value="2">{t('days.tuesday')}</SelectItem>
                                                        <SelectItem value="3">{t('days.wednesday')}</SelectItem>
                                                        <SelectItem value="4">{t('days.thursday')}</SelectItem>
                                                        <SelectItem value="5">{t('days.friday')}</SelectItem>
                                                        <SelectItem value="6">{t('days.saturday')}</SelectItem>
                                                        <SelectItem value="7">{t('days.sunday')}</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                )}
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField control={form.control} name="start_time" render={({ field }) => (<FormItem><FormLabel>{t('dialog.startTime')}</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={form.control} name="end_time" render={({ field }) => (<FormItem><FormLabel>{t('dialog.endTime')}</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField control={form.control} name="start_date" render={({ field }) => (<FormItem><FormLabel>{t('dialog.startDate')}</FormLabel><FormControl><DatePickerInput value={field.value} onChange={field.onChange} /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={form.control} name="end_date" render={({ field }) => (<FormItem><FormLabel>{t('dialog.endDate')}</FormLabel><FormControl><DatePickerInput value={field.value} onChange={field.onChange} /></FormControl><FormMessage /></FormItem>)} />
                                </div>
                            </DialogBody>
                            <DialogFooter>
                                <Button type="submit">{editingRule ? t('dialog.save') : t('dialog.create')}</Button>
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
