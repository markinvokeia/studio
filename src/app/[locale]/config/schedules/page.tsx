
'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { ClinicSchedule } from '@/lib/types';
import api from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { SchedulesColumnsWrapper } from './columns';

const scheduleFormSchema = (t: (key: string) => string) => z.object({
    id: z.string().optional(),
    day_of_week: z.string().min(1, t('dayRequired')),
    start_time: z.string().min(1, t('startRequired')),
    end_time: z.string().min(1, t('endRequired')),
});

type ScheduleFormValues = z.infer<ReturnType<typeof scheduleFormSchema>>;

async function getSchedules(): Promise<ClinicSchedule[]> {
    try {
        const data = await api.get(API_ROUTES.CLINIC_SCHEDULES);
        const schedulesData = Array.isArray(data) ? data : (data.schedules || data.data || data.result || []);

        return schedulesData.map((apiSchedule: any) => ({
            id: String(apiSchedule.id),
            day_of_week: apiSchedule.day_of_week,
            start_time: apiSchedule.start_time,
            end_time: apiSchedule.end_time,
        }));
    } catch (error) {
        console.error("Failed to fetch schedules:", error);
        return [];
    }
}

async function upsertSchedule(scheduleData: ScheduleFormValues) {
    const responseData = await api.post(API_ROUTES.CLINIC_SCHEDULES_UPSERT, { ...scheduleData, day_of_week: Number(scheduleData.day_of_week) });
    if (Array.isArray(responseData) && responseData[0]?.code >= 400) {
        const message = responseData[0]?.message ? responseData[0].message : 'Failed to save schedule';
        throw new Error(message);
    }
    return responseData;
}

async function deleteSchedule(id: string) {
    const responseData = await api.delete(API_ROUTES.CLINIC_SCHEDULES_DELETE, { id });
    if (Array.isArray(responseData) && responseData[0]?.code >= 400) {
        const message = responseData[0]?.message ? responseData[0].message : 'Failed to delete schedule';
        throw new Error(message);
    }
    return responseData;
}

export default function SchedulesPage() {
    const t = useTranslations('SchedulesPage');
    const tValidation = useTranslations('SchedulesPage.validation');
    const { toast } = useToast();
    const [schedules, setSchedules] = React.useState<ClinicSchedule[]>([]);
    const [isRefreshing, setIsRefreshing] = React.useState(false);

    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingSchedule, setEditingSchedule] = React.useState<ClinicSchedule | null>(null);

    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
    const [deletingSchedule, setDeletingSchedule] = React.useState<ClinicSchedule | null>(null);
    const [submissionError, setSubmissionError] = React.useState<string | null>(null);

    const form = useForm<ScheduleFormValues>({
        resolver: zodResolver(scheduleFormSchema(tValidation)),
        defaultValues: { day_of_week: '', start_time: '', end_time: '' },
    });

    const loadSchedules = React.useCallback(async () => {
        setIsRefreshing(true);
        const fetchedSchedules = await getSchedules();
        setSchedules(fetchedSchedules);
        setIsRefreshing(false);
    }, []);

    React.useEffect(() => {
        loadSchedules();
    }, [loadSchedules]);

    const handleCreate = () => {
        setEditingSchedule(null);
        form.reset({ day_of_week: '', start_time: '', end_time: '' });
        setSubmissionError(null);
        setIsDialogOpen(true);
    };

    const handleEdit = (schedule: ClinicSchedule) => {
        setEditingSchedule(schedule);
        form.reset({
            id: schedule.id,
            day_of_week: String(schedule.day_of_week),
            start_time: schedule.start_time,
            end_time: schedule.end_time,
        });
        setSubmissionError(null);
        setIsDialogOpen(true);
    };

    const handleDelete = (schedule: ClinicSchedule) => {
        setDeletingSchedule(schedule);
        setIsDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
        if (!deletingSchedule) return;
        try {
            await deleteSchedule(deletingSchedule.id);
            toast({
                title: t('toast.deleteSuccessTitle'),
                description: t('toast.deleteSuccessDescription'),
            });
            setIsDeleteDialogOpen(false);
            setDeletingSchedule(null);
            loadSchedules();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: t('toast.errorTitle'),
                description: t('toast.deleteErrorDescription'),
            });
        }
    };

    const onSubmit = async (values: ScheduleFormValues) => {
        setSubmissionError(null);
        try {
            await upsertSchedule(values);
            toast({
                title: editingSchedule ? t('toast.editSuccessTitle') : t('toast.createSuccessTitle'),
                description: t('toast.successDescription'),
            });
            setIsDialogOpen(false);
            loadSchedules();
        } catch (error) {
            setSubmissionError(error instanceof Error ? error.message : t('toast.genericError'));
        }
    };

    const schedulesColumns = SchedulesColumnsWrapper({ onEdit: handleEdit, onDelete: handleDelete });


    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>{t('title')}</CardTitle>
                    <CardDescription>{t('description')}</CardDescription>
                </CardHeader>
                <CardContent>
                    <DataTable
                        columns={schedulesColumns}
                        data={schedules}
                        filterColumnId="day_of_week"
                        filterPlaceholder={t('filterPlaceholder')}
                        onCreate={handleCreate}
                        onRefresh={loadSchedules}
                        isRefreshing={isRefreshing}
                    />
                </CardContent>
            </Card>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingSchedule ? t('createDialog.editTitle') : t('createDialog.title')}</DialogTitle>
                        <DialogDescription>
                            {editingSchedule ? t('createDialog.editDescription') : t('createDialog.description')}
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                            {submissionError && (
                                <Alert variant="destructive">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertTitle>{t('toast.errorTitle')}</AlertTitle>
                                    <AlertDescription>{submissionError}</AlertDescription>
                                </Alert>
                            )}
                            <FormField
                                control={form.control}
                                name="day_of_week"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('createDialog.dayOfWeek')}</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder={t('createDialog.selectDay')} />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="1">{t('days.monday')}</SelectItem>
                                                <SelectItem value="2">{t('days.tuesday')}</SelectItem>
                                                <SelectItem value="3">{t('days.wednesday')}</SelectItem>
                                                <SelectItem value="4">{t('days.thursday')}</SelectItem>
                                                <SelectItem value="5">{t('days.friday')}</SelectItem>
                                                <SelectItem value="6">{t('days.saturday')}</SelectItem>
                                                <SelectItem value="0">{t('days.sunday')}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="start_time"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('createDialog.startTime')}</FormLabel>
                                        <FormControl>
                                            <Input type="time" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="end_time"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('createDialog.endTime')}</FormLabel>
                                        <FormControl>
                                            <Input type="time" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <DialogFooter>
                                <Button variant="outline" type="button" onClick={() => setIsDialogOpen(false)}>{t('createDialog.cancel')}</Button>
                                <Button type="submit">{editingSchedule ? t('createDialog.editSave') : t('createDialog.save')}</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('deleteDialog.title')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('deleteDialog.description')}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('deleteDialog.cancel')}</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">{t('deleteDialog.confirm')}</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
