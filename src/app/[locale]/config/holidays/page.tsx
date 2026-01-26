
'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Textarea } from '@/components/ui/textarea';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { ClinicException } from '@/lib/types';
import api from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { format, parseISO } from 'date-fns';
import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { HolidaysColumnsWrapper } from './columns';
import { DataTableAdvancedToolbar } from '@/components/ui/data-table-advanced-toolbar';

const holidayFormSchema = (t: (key: string) => string) => z.object({
    id: z.string().optional(),
    date: z.string().min(1, t('dateRequired')),
    is_open: z.boolean().default(false),
    start_time: z.string().optional(),
    end_time: z.string().optional(),
    notes: z.string().optional(),
});

type HolidayFormValues = z.infer<ReturnType<typeof holidayFormSchema>>;

async function getHolidays(): Promise<ClinicException[]> {
    try {
        const data = await api.get(API_ROUTES.EXCEPTIONS);
        const holidaysData = Array.isArray(data) ? data : (data.exceptions || data.data || data.result || []);

        return holidaysData.map((apiHoliday: any) => ({
            id: apiHoliday.id ? String(apiHoliday.id) : `ex_${Math.random().toString(36).substr(2, 9)}`,
            date: format(parseISO(apiHoliday.date), 'yyyy-MM-dd'),
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
    const responseData = await api.post(API_ROUTES.HOLIDAYS_UPSERT, holidayData);
    if (Array.isArray(responseData) && responseData[0]?.code >= 400) {
        const message = responseData[0]?.message ? responseData[0].message : 'Failed to save holiday';
        throw new Error(message);
    }
    return responseData;
}

async function deleteHoliday(id: string) {
    const responseData = await api.delete(API_ROUTES.HOLIDAYS_DELETE, { id });
    if (Array.isArray(responseData) && responseData[0]?.code >= 400) {
        const message = responseData[0]?.message ? responseData[0].message : 'Failed to delete holiday';
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
    const [searchQuery, setSearchQuery] = React.useState('');

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

    const filteredHolidays = React.useMemo(() => {
        if (!searchQuery) {
            return holidays;
        }
        return holidays.filter(holiday =>
            Object.values(holiday).some(value =>
                String(value).toLowerCase().includes(searchQuery.toLowerCase())
            )
        );
    }, [holidays, searchQuery]);

    const holidaysColumns = HolidaysColumnsWrapper({ onEdit: handleEdit, onDelete: handleDelete });

    const columnTranslations = {
        id: t('columns.id'),
        date: t('columns.date'),
        is_open: t('columns.status'),
        start_time: t('columns.startTime'),
        end_time: t('columns.endTime'),
        notes: t('columns.notes'),
    };

    return (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <CardHeader className="flex-none">
                    <CardTitle>{tNav('Holidays')}</CardTitle>
                    <CardDescription>{t('description')}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    <DataTable
                        columns={holidaysColumns}
                        data={filteredHolidays}
                        customToolbar={(table) => (
                            <DataTableAdvancedToolbar
                                table={table}
                                searchQuery={searchQuery}
                                onSearchChange={setSearchQuery}
                                filterPlaceholder={t('filterPlaceholder')}
                                onCreate={handleCreate}
                                onRefresh={loadHolidays}
                                isRefreshing={isRefreshing}
                                columnTranslations={columnTranslations}
                            />
                        )}
                        columnTranslations={columnTranslations}
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
        </div>
    );
}
