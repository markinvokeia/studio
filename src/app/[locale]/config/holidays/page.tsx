
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ClinicException } from '@/lib/types';
import { HolidaysColumnsWrapper } from './columns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useTranslations } from 'next-intl';

const holidayFormSchema = (t: (key: string) => string) => z.object({
  id: z.string().optional(),
  date: z.string().min(1, t('validation.dateRequired')),
  is_open: z.boolean().default(false),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  notes: z.string().optional(),
});

type HolidayFormValues = z.infer<ReturnType<typeof holidayFormSchema>>;

async function getHolidays(): Promise<ClinicException[]> {
    try {
        const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/exceptions', {
            method: 'GET',
            mode: 'cors',
            headers: {
                'Accept': 'application/json',
            },
            cache: 'no-store',
        });

        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status} - ${response.statusText}`);
        }

        const data = await response.json();
        const holidaysData = Array.isArray(data) ? data : (data.exceptions || data.data || data.result || []);

        return holidaysData.map((apiHoliday: any) => ({
            id: apiHoliday.id ? String(apiHoliday.id) : `ex_${Math.random().toString(36).substr(2, 9)}`,
            date: apiHoliday.date,
            is_open: apiHoliday.is_open,
            start_time: apiHoliday.start_time,
            end_time: apiHoliday.end_time,
            notes: apiHoliday.notes || '',
        }));
    } catch (error) {
        console.error("Failed to fetch holidays:", error);
        return [];
    }
}

async function upsertHoliday(holidayData: HolidayFormValues) {
    const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/feriados/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(holidayData),
    });
    const responseData = await response.json();
    if (!response.ok || (Array.isArray(responseData) && responseData[0]?.code >= 400)) {
        const message = Array.isArray(responseData) && responseData[0]?.message ? responseData[0].message : 'Failed to save holiday';
        throw new Error(message);
    }
    return responseData;
}

async function deleteHoliday(id: string) {
    const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/feriados/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
    });
    const responseData = await response.json();
    if (!response.ok || (Array.isArray(responseData) && responseData[0]?.code >= 400)) {
        const message = Array.isArray(responseData) && responseData[0]?.message ? responseData[0].message : 'Failed to delete holiday';
        throw new Error(message);
    }
    return responseData;
}

export default function HolidaysPage() {
    const t = useTranslations('HolidaysPage');
    const tNav = useTranslations('Navigation');
    const tValidation = useTranslations('HolidaysPage.validation');

    const { toast } = useToast();
    const [holidays, setHolidays] = React.useState<ClinicException[]>([]);
    const [isRefreshing, setIsRefreshing] = React.useState(false);

    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingHoliday, setEditingHoliday] = React.useState<ClinicException | null>(null);

    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
    const [deletingHoliday, setDeletingHoliday] = React.useState<ClinicException | null>(null);
    const [submissionError, setSubmissionError] = React.useState<string | null>(null);

    const form = useForm<HolidayFormValues>({
        resolver: zodResolver(holidayFormSchema(tValidation)),
        defaultValues: { date: '', is_open: false, start_time: '', end_time: '', notes: '' },
    });

    const loadHolidays = React.useCallback(async () => {
        setIsRefreshing(true);
        const fetchedHolidays = await getHolidays();
        setHolidays(fetchedHolidays);
        setIsRefreshing(false);
    }, []);

    React.useEffect(() => {
        loadHolidays();
    }, [loadHolidays]);

    const handleCreate = () => {
        setEditingHoliday(null);
        form.reset({ date: '', is_open: false, start_time: '', end_time: '', notes: '' });
        setSubmissionError(null);
        setIsDialogOpen(true);
    };

    const handleEdit = (holiday: ClinicException) => {
        setEditingHoliday(holiday);
        form.reset({
            id: holiday.id,
            date: format(parseISO(holiday.date), 'yyyy-MM-dd'),
            is_open: holiday.is_open,
            start_time: holiday.start_time,
            end_time: holiday.end_time,
            notes: holiday.notes,
        });
        setSubmissionError(null);
        setIsDialogOpen(true);
    };

    const handleDelete = (holiday: ClinicException) => {
        setDeletingHoliday(holiday);
        setIsDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
        if (!deletingHoliday) return;
        try {
            await deleteHoliday(deletingHoliday.id);
            toast({
                title: t('toast.deleteSuccessTitle'),
                description: t('toast.deleteSuccessDescription'),
            });
            setIsDeleteDialogOpen(false);
            setDeletingHoliday(null);
            loadHolidays();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: t('toast.errorTitle'),
                description: t('toast.deleteErrorDescription'),
            });
        }
    };

    const onSubmit = async (values: HolidayFormValues) => {
        setSubmissionError(null);
        try {
            await upsertHoliday(values);
            toast({
                title: editingHoliday ? t('toast.editSuccessTitle') : t('toast.createSuccessTitle'),
                description: t('toast.successDescription'),
            });
            setIsDialogOpen(false);
            loadHolidays();
        } catch (error) {
            setSubmissionError(error instanceof Error ? error.message : t('toast.genericError'));
        }
    };

    const holidaysColumns = HolidaysColumnsWrapper({ onEdit: handleEdit, onDelete: handleDelete });


    return (
        <>
        <Card>
            <CardHeader>
                <CardTitle>{tNav('Holidays')}</CardTitle>
                <CardDescription>{t('description')}</CardDescription>
            </CardHeader>
            <CardContent>
                <DataTable 
                    columns={holidaysColumns} 
                    data={holidays} 
                    filterColumnId="date" 
                    filterPlaceholder={t('filterPlaceholder')}
                    onCreate={handleCreate}
                    onRefresh={loadHolidays}
                    isRefreshing={isRefreshing}
                />
            </CardContent>
        </Card>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{editingHoliday ? t('createDialog.editTitle') : t('createDialog.title')}</DialogTitle>
                    <DialogDescription>
                        {editingHoliday ? t('createDialog.editDescription') : t('createDialog.description')}
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
                            name="date"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('createDialog.date')}</FormLabel>
                                    <FormControl>
                                        <Input type="date" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="is_open"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                    <FormControl>
                                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                    </FormControl>
                                    <FormLabel>{t('createDialog.isOpen')}</FormLabel>
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
                         <FormField
                            control={form.control}
                            name="notes"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('createDialog.notes')}</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder={t('createDialog.notesPlaceholder')} {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter>
                            <Button variant="outline" type="button" onClick={() => setIsDialogOpen(false)}>{t('createDialog.cancel')}</Button>
                            <Button type="submit">{editingHoliday ? t('createDialog.editSave') : t('createDialog.save')}</Button>
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
