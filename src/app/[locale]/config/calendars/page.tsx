
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Calendar } from '@/lib/types';
import { CalendarsColumnsWrapper } from './columns';
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
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';

const calendarFormSchema = (t: (key: string) => string) => z.object({
    id: z.string().optional(),
    name: z.string().min(1, t('nameRequired')),
    google_calendar_id: z.string().email(t('emailInvalid')),
    is_active: z.boolean().default(false),
});

type CalendarFormValues = z.infer<ReturnType<typeof calendarFormSchema>>;

async function getCalendars(): Promise<Calendar[]> {
    try {
        const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/calendars', {
            method: 'GET',
            mode: 'cors',
            headers: { 'Accept': 'application/json' },
            cache: 'no-store',
        });

        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status} - ${response.statusText}`);
        }

        const data = await response.json();
        const calendarsData = Array.isArray(data) ? data : (data.calendars || data.data || data.result || []);

        return calendarsData.map((apiCalendar: any) => ({
            id: apiCalendar.id ? String(apiCalendar.id) : `cal_${Math.random().toString(36).substr(2, 9)}`,
            name: apiCalendar.name,
            google_calendar_id: apiCalendar.google_calendar_id,
            is_active: apiCalendar.is_active,
        }));
    } catch (error) {
        console.error("Failed to fetch calendars:", error);
        return [];
    }
}

async function upsertCalendar(calendarData: CalendarFormValues) {
    const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/calendarios/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(calendarData),
    });
    const responseData = await response.json();
    if (!response.ok || (Array.isArray(responseData) && responseData[0]?.code >= 400)) {
        const message = Array.isArray(responseData) && responseData[0]?.message ? responseData[0].message : 'Failed to save calendar';
        throw new Error(message);
    }
    return responseData;
}

async function deleteCalendar(id: string, googleCalendarId: string) {
    const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/calendarios/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, google_calendar_id: googleCalendarId }),
    });
    const responseData = await response.json();
     if (!response.ok || (Array.isArray(responseData) && responseData[0]?.code >= 400)) {
        const message = Array.isArray(responseData) && responseData[0]?.message ? responseData[0].message : 'Failed to delete calendar';
        throw new Error(message);
    }
    return responseData;
}

export default function CalendarsPage() {
    const t = useTranslations('CalendarsPage');
    const tNav = useTranslations('Navigation');
    const tValidation = useTranslations('CalendarsPage.validation');
    const { toast } = useToast();
    const [calendars, setCalendars] = React.useState<Calendar[]>([]);
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingCalendar, setEditingCalendar] = React.useState<Calendar | null>(null);
    
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
    const [deletingCalendar, setDeletingCalendar] = React.useState<Calendar | null>(null);
    const [submissionError, setSubmissionError] = React.useState<string | null>(null);

    const form = useForm<CalendarFormValues>({
        resolver: zodResolver(calendarFormSchema(tValidation)),
        defaultValues: { name: '', google_calendar_id: '', is_active: false },
    });

    const loadCalendars = React.useCallback(async () => {
        setIsRefreshing(true);
        const fetchedCalendars = await getCalendars();
        setCalendars(fetchedCalendars);
        setIsRefreshing(false);
    }, []);

    React.useEffect(() => {
        loadCalendars();
    }, [loadCalendars]);
    
    const handleCreate = () => {
        setEditingCalendar(null);
        form.reset({ name: '', google_calendar_id: '', is_active: false });
        setSubmissionError(null);
        setIsDialogOpen(true);
    };

    const handleEdit = (calendar: Calendar) => {
        setEditingCalendar(calendar);
        form.reset(calendar);
        setSubmissionError(null);
        setIsDialogOpen(true);
    };

    const handleDelete = (calendar: Calendar) => {
        setDeletingCalendar(calendar);
        setIsDeleteDialogOpen(true);
    };
    
    const confirmDelete = async () => {
        if (!deletingCalendar) return;
        try {
            await deleteCalendar(deletingCalendar.id, deletingCalendar.google_calendar_id);
            toast({
                title: t('toast.deleteSuccessTitle'),
                description: t('toast.deleteSuccessDescription', {name: deletingCalendar.name}),
            });
            setIsDeleteDialogOpen(false);
            setDeletingCalendar(null);
            loadCalendars();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: t('toast.errorTitle'),
                description: error instanceof Error ? error.message : t('toast.deleteErrorDescription'),
            });
        }
    };

    const onSubmit = async (values: CalendarFormValues) => {
        setSubmissionError(null);
        try {
            await upsertCalendar(values);
            toast({
                title: editingCalendar ? t('toast.editSuccessTitle') : t('toast.createSuccessTitle'),
                description: t('toast.successDescription', {name: values.name}),
            });
            setIsDialogOpen(false);
            loadCalendars();
        } catch (error) {
            setSubmissionError(error instanceof Error ? error.message : t('toast.genericError'));
        }
    };

    const calendarsColumns = CalendarsColumnsWrapper({ onEdit: handleEdit, onDelete: handleDelete });

    return (
        <>
        <Card>
            <CardHeader>
                <CardTitle>{tNav('Calendars')}</CardTitle>
                <CardDescription>{t('description')}</CardDescription>
            </CardHeader>
            <CardContent>
                <DataTable 
                    columns={calendarsColumns} 
                    data={calendars} 
                    filterColumnId="name" 
                    filterPlaceholder={t('filterPlaceholder')}
                    onCreate={handleCreate}
                    onRefresh={loadCalendars}
                    isRefreshing={isRefreshing}
                />
            </CardContent>
        </Card>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{editingCalendar ? t('dialog.editTitle') : t('dialog.createTitle')}</DialogTitle>
                    <DialogDescription>
                        {editingCalendar ? t('dialog.editDescription') : t('dialog.description')}
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
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('dialog.name')}</FormLabel>
                                    <FormControl>
                                        <Input placeholder={t('dialog.namePlaceholder')} {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="google_calendar_id"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('dialog.googleCalendarId')}</FormLabel>
                                    <FormControl>
                                        <Input type="email" placeholder={t('dialog.googleCalendarIdPlaceholder')} {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="is_active"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                    <FormControl>
                                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                    </FormControl>
                                    <FormLabel>{t('dialog.active')}</FormLabel>
                                </FormItem>
                            )}
                        />
                        <DialogFooter>
                            <Button variant="outline" type="button" onClick={() => setIsDialogOpen(false)}>{t('dialog.cancel')}</Button>
                            <Button type="submit">{editingCalendar ? t('dialog.save') : t('dialog.create')}</Button>
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
                    {t('deleteDialog.description', {name: deletingCalendar?.name})}
                </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                <AlertDialogCancel>{t('deleteDialog.cancel')}</AlertDialogCancel>
                <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">{t('deleteDialog.delete')}</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        </>
    );
}
