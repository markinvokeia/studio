
'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { DataCard } from '@/components/ui/data-card';
import { DataTable } from '@/components/ui/data-table';
import {
    Dialog,
    DialogBody,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from '@/components/ui/input';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { Calendar as CalendarType } from '@/lib/types';
import { api } from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, Calendar } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { CalendarsColumnsWrapper } from './columns';

const calendarFormSchema = (t: (key: string) => string) => z.object({
    id: z.string().optional(),
    name: z.string().min(1, t('nameRequired')),
    google_calendar_id: z.string().email(t('emailInvalid')),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, t('colorInvalid')).optional(),
    is_active: z.boolean().default(false),
});

type CalendarFormValues = z.infer<ReturnType<typeof calendarFormSchema>>;

async function getCalendars(): Promise<CalendarType[]> {
    try {
        const data = await api.get(API_ROUTES.CALENDARS);
        const calendarsData = Array.isArray(data) ? data : (data.calendars || data.data || data.result || []);

        return calendarsData.map((apiCalendar: any) => ({
            id: apiCalendar.id ? String(apiCalendar.id) : `cal_${Math.random().toString(36).substr(2, 9)}`,
            name: apiCalendar.name,
            google_calendar_id: apiCalendar.google_calendar_id,
            is_active: apiCalendar.is_active,
            color: apiCalendar.color
        }));
    } catch (error) {
        console.error("Failed to fetch calendars:", error);
        return [];
    }
}

async function upsertCalendar(calendarData: CalendarFormValues) {
    const responseData = await api.post(API_ROUTES.CALENDARS_UPSERT, calendarData);
    if (Array.isArray(responseData) && responseData[0]?.code >= 400) {
        const message = Array.isArray(responseData) && responseData[0]?.message ? responseData[0].message : 'Failed to save calendar';
        throw new Error(message);
    }
    return responseData;
}

async function deleteCalendar(id: string, googleCalendarId: string) {
    const responseData = await api.delete(API_ROUTES.CALENDARS_DELETE, { id, google_calendar_id: googleCalendarId });
    if (Array.isArray(responseData) && responseData[0]?.code >= 400) {
        const message = responseData[0]?.message ? responseData[0].message : 'Failed to delete calendar';
        throw new Error(message);
    }
    return responseData;
}

export default function CalendarsPage() {
    const t = useTranslations('CalendarsPage');
    const tNav = useTranslations('Navigation');
    const tValidation = useTranslations('CalendarsPage.validation');
    const isNarrow = useViewportNarrow();
    const { toast } = useToast();
    const [calendars, setCalendars] = React.useState<CalendarType[]>([]);
    const [isRefreshing, setIsRefreshing] = React.useState(false);

    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingCalendar, setEditingCalendar] = React.useState<CalendarType | null>(null);

    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
    const [deletingCalendar, setDeletingCalendar] = React.useState<CalendarType | null>(null);
    const [submissionError, setSubmissionError] = React.useState<string | null>(null);

    const form = useForm<CalendarFormValues>({
        resolver: zodResolver(calendarFormSchema(tValidation)),
        defaultValues: { name: '', google_calendar_id: '', color: '#ffffff', is_active: false },
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
        form.reset({ name: '', google_calendar_id: '', color: '#ffffff', is_active: false });
        setSubmissionError(null);
        setIsDialogOpen(true);
    };

    const handleEdit = (calendar: CalendarType) => {
        setEditingCalendar(calendar);
        form.reset({
            ...calendar,
            color: calendar.color || '#ffffff'
        });
        setSubmissionError(null);
        setIsDialogOpen(true);
    };

    const handleDelete = (calendar: CalendarType) => {
        setDeletingCalendar(calendar);
        setIsDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
        if (!deletingCalendar) return;
        try {
            await deleteCalendar(deletingCalendar.id, deletingCalendar.google_calendar_id);
            toast({
                title: t('toast.deleteSuccessTitle'),
                description: t('toast.deleteSuccessDescription', { name: deletingCalendar.name }),
            });
            setIsDeleteDialogOpen(false);
            setDeletingCalendar(null);
            loadCalendars();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: t('toast.errorTitle'),
                description: t('toast.deleteErrorDescription'),
            });
        }
    };

    const onSubmit = async (values: CalendarFormValues) => {
        setSubmissionError(null);
        try {
            await upsertCalendar(values);
            toast({
                title: editingCalendar ? t('toast.editSuccessTitle') : t('toast.createSuccessTitle'),
                description: t('toast.successDescription', { name: values.name }),
            });
            setIsDialogOpen(false);
            loadCalendars();
        } catch (error) {
            setSubmissionError(error instanceof Error ? error.message : t('toast.genericError'));
        }
    };

    const calendarsColumns = CalendarsColumnsWrapper({ onEdit: handleEdit, onDelete: handleDelete });

    const columnTranslations = {
        name: t('columns.name'),
        google_calendar_id: t('columns.googleCalendarId'),
        color: t('columns.color'),
        is_active: t('columns.active'),
        actions: t('columns.actions'),
    };

    return (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <Card className="flex-1 flex flex-col min-h-0 overflow-hidden border-0 lg:border shadow-none lg:shadow-sm">
                <CardHeader className="flex-none p-4">
                    <div className="flex items-start gap-3">
                        <div className="header-icon-circle mt-0.5">
                            <Calendar className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col text-left">
                            <CardTitle className="text-lg">{tNav('Calendars')}</CardTitle>
                            <CardDescription className="text-xs">{t('description')}</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden p-6 bg-card">
                    <DataTable
                        columns={calendarsColumns}
                        data={calendars}
                        filterColumnId="name"
                        filterPlaceholder={t('filterPlaceholder')}
                        onCreate={handleCreate}
                        onRefresh={loadCalendars}
                        isRefreshing={isRefreshing}
                        columnTranslations={columnTranslations}
                        isNarrow={isNarrow}
                        renderCard={(row: CalendarType) => (
                            <DataCard
                                title={row.name}
                                subtitle={row.google_calendar_id}
                                accentColor={row.color || undefined}
                                badge={<span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${row.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{row.is_active ? 'Activo' : 'Inactivo'}</span>}
                                showArrow
                            />
                        )}
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
                                    name="color"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('dialog.color')}</FormLabel>
                                            <FormControl>
                                                <div className="flex items-center gap-2">
                                                    <Input type="color" className="p-1 h-10 w-14" {...field} />
                                                    <Input placeholder="#FFFFFF" {...field} />
                                                </div>
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
                            </DialogBody>
                            <DialogFooter>
                                <Button type="submit">{editingCalendar ? t('dialog.save') : t('dialog.create')}</Button>
                                <Button variant="outline" type="button" onClick={() => setIsDialogOpen(false)}>{t('dialog.cancel')}</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent className="max-w-[400px]">
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('deleteDialog.title')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('deleteDialog.description', { name: deletingCalendar?.name })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">{t('deleteDialog.delete')}</AlertDialogAction>
                        <AlertDialogCancel>{t('deleteDialog.cancel')}</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
