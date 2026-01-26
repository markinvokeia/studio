'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { DataTable } from '@/components/ui/data-table';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { AvailabilityException, User } from '@/lib/types';
import { cn } from '@/lib/utils';
import { api } from '@/services/api';
import { getErrorMessage } from '@/lib/error-utils';
import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnFiltersState, PaginationState } from '@tanstack/react-table';
import { format, parseISO } from 'date-fns';
import { AlertTriangle, Check, ChevronsUpDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { ExceptionsColumnsWrapper } from './columns';

const exceptionFormSchema = (t: (key: string) => string) => z.object({
    id: z.string().optional(),
    user_id: z.string().min(1, t('doctorRequired')),
    exception_date: z.string().min(1, t('dateRequired')),
    start_time: z.string().optional(),
    end_time: z.string().optional(),
    is_available: z.boolean().default(false),
});

type ExceptionFormValues = z.infer<ReturnType<typeof exceptionFormSchema>>;

type GetExceptionsResponse = {
    exceptions: AvailabilityException[];
    total: number;
};

async function getAvailabilityExceptions(pagination: PaginationState, searchQuery: string): Promise<GetExceptionsResponse> {
    try {
        const responseData = await api.get(API_ROUTES.AVAILABILITY_EXCEPTIONS_SEARCH, {
            page: (pagination.pageIndex + 1).toString(),
            limit: pagination.pageSize.toString(),
            search: searchQuery,
        });
        const data = Array.isArray(responseData) && responseData.length > 0 ? responseData[0] : responseData;

        const exceptionsData = data.data || [];
        const total = Number(data.total) || 0;

        return {
            exceptions: exceptionsData.map((ex: any) => ({
                ...ex,
                id: String(ex.id),
                exception_date: format(parseISO(ex.exception_date), 'yyyy-MM-dd')
            })),
            total
        };
    } catch (error) {
        console.error("Failed to fetch availability exceptions:", error);
        return { exceptions: [], total: 0 };
    }
}

async function getDoctors(): Promise<User[]> {
    try {
        const data = await api.get(API_ROUTES.USERS_DOCTORS);
        const doctorsData = Array.isArray(data) ? data : (data.doctors || data.data || []);
        return doctorsData.map((doc: any) => ({ ...doc, id: String(doc.id) }));
    } catch (error) {
        console.error("Failed to fetch doctors:", error);
        return [];
    }
}

async function upsertAvailabilityException(exceptionData: ExceptionFormValues) {
    const responseData = await api.post(API_ROUTES.AVAILABILITY_EXCEPTIONS_UPSERT, exceptionData);
    if (Array.isArray(responseData) && responseData[0]?.code >= 400 || responseData.error) {
        const message = responseData.message || (Array.isArray(responseData) && responseData[0]?.message);
        throw new Error(message);
    }
    return responseData;
}

async function deleteAvailabilityException(id: string) {
    const responseData = await api.delete(API_ROUTES.AVAILABILITY_EXCEPTIONS_DELETE, { id });
    if (Array.isArray(responseData) && responseData[0]?.code >= 400 || responseData.error) {
        const message = responseData.message || (Array.isArray(responseData) && responseData[0]?.message);
        throw new Error(message);
    }
    return responseData;
}

export default function AvailabilityExceptionsPage() {
    const t = useTranslations('DoctorAvailabilityExceptionsPage');
    const tValidation = useTranslations('DoctorAvailabilityExceptionsPage.validation');
    const { toast } = useToast();
    const [exceptions, setExceptions] = React.useState<AvailabilityException[]>([]);
    const [doctors, setDoctors] = React.useState<User[]>([]);
    const [exceptionCount, setExceptionCount] = React.useState(0);
    const [isRefreshing, setIsRefreshing] = React.useState(false);

    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingException, setEditingException] = React.useState<AvailabilityException | null>(null);

    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
    const [deletingException, setDeletingException] = React.useState<AvailabilityException | null>(null);

    const [submissionError, setSubmissionError] = React.useState<string | null>(null);
    const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

    const form = useForm<ExceptionFormValues>({
        resolver: zodResolver(exceptionFormSchema(tValidation)),
    });

    const [isDoctorComboboxOpen, setIsDoctorComboboxOpen] = React.useState(false);


    const loadExceptions = React.useCallback(async () => {
        setIsRefreshing(true);
        const searchQuery = (columnFilters.find(f => f.id === 'user_name')?.value as string) || '';
        const { exceptions, total } = await getAvailabilityExceptions(pagination, searchQuery);
        setExceptions(exceptions);
        setExceptionCount(total);
        setIsRefreshing(false);
    }, [pagination, columnFilters]);

    React.useEffect(() => {
        loadExceptions();
    }, [loadExceptions]);

    React.useEffect(() => {
        if (isDialogOpen) {
            getDoctors().then(setDoctors);
        }
    }, [isDialogOpen]);

    const handleCreate = () => {
        setEditingException(null);
        form.reset({
            user_id: '',
            exception_date: format(new Date(), 'yyyy-MM-dd'),
            start_time: '',
            end_time: '',
            is_available: false,
        });
        setSubmissionError(null);
        setIsDialogOpen(true);
    };

    const handleEdit = (exception: AvailabilityException) => {
        setEditingException(exception);
        form.reset({
            id: exception.id,
            user_id: exception.user_id,
            exception_date: format(parseISO(exception.exception_date), 'yyyy-MM-dd'),
            start_time: exception.start_time || '',
            end_time: exception.end_time || '',
            is_available: exception.is_available,
        });
        setSubmissionError(null);
        setIsDialogOpen(true);
    };

    const handleDelete = (exception: AvailabilityException) => {
        setDeletingException(exception);
        setIsDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
        if (!deletingException) return;
        try {
            await deleteAvailabilityException(deletingException.id);
            toast({ title: t('toast.deleteTitle'), description: t('toast.deleteDescription') });
            setIsDeleteDialogOpen(false);
            setDeletingException(null);
            loadExceptions();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: t('toast.errorTitle'),
                description: error instanceof Error && error.message ? error.message : t('toast.deleteError'),
            });
        }
    };

    const onSubmit = async (values: ExceptionFormValues) => {
        setSubmissionError(null);
        try {
            await upsertAvailabilityException(values);
            toast({ title: editingException ? t('toast.editTitle') : t('toast.createTitle'), description: t('toast.successDescription') });
            setIsDialogOpen(false);
            loadExceptions();
        } catch (error) {
            setSubmissionError(getErrorMessage(error));
        }
    };

    const exceptionsColumns = ExceptionsColumnsWrapper({ onEdit: handleEdit, onDelete: handleDelete });

    const tColumns = useTranslations('DoctorAvailabilityExceptionsPage.columns');
    const columnTranslations = {
        user_name: tColumns('doctor'),
        exception_date: tColumns('date'),
        is_available: tColumns('available'),
        start_time: tColumns('startTime'),
        end_time: tColumns('endTime'),
    };

    return (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <CardHeader className="flex-none">
                    <CardTitle>{t('title')}</CardTitle>
                    <CardDescription>{t('description')}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    <DataTable
                        columns={exceptionsColumns}
                        data={exceptions}
                        pageCount={Math.ceil(exceptionCount / pagination.pageSize)}
                        pagination={pagination}
                        onPaginationChange={setPagination}
                        columnFilters={columnFilters}
                        onColumnFiltersChange={setColumnFilters}
                        manualPagination={true}
                        filterColumnId="user_name"
                        filterPlaceholder={t('filterPlaceholder')}
                        onCreate={handleCreate}
                        onRefresh={loadExceptions}
                        isRefreshing={isRefreshing}
                        columnTranslations={columnTranslations}
                    />
                </CardContent>
            </Card>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingException ? t('dialog.editTitle') : t('dialog.createTitle')}</DialogTitle>
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
                                name="user_id"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('dialog.doctor')}</FormLabel>
                                        <Popover open={isDoctorComboboxOpen} onOpenChange={setIsDoctorComboboxOpen}>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button variant="outline" role="combobox" className={cn("w-full justify-between", !field.value && "text-muted-foreground")}>
                                                        {field.value ? doctors.find(doc => doc.id === field.value)?.name : t('dialog.selectDoctor')}
                                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                                <Command>
                                                    <CommandInput placeholder={t('dialog.searchDoctor')} />
                                                    <CommandList>
                                                        <CommandEmpty>{t('dialog.noDoctorFound')}</CommandEmpty>
                                                        <CommandGroup>
                                                            {doctors.map((doctor) => (
                                                                <CommandItem
                                                                    value={doctor.name}
                                                                    key={doctor.id}
                                                                    onSelect={() => {
                                                                        form.setValue("user_id", doctor.id);
                                                                        setIsDoctorComboboxOpen(false);
                                                                    }}
                                                                >
                                                                    <Check className={cn("mr-2 h-4 w-4", doctor.id === field.value ? "opacity-100" : "opacity-0")} />
                                                                    {doctor.name}
                                                                </CommandItem>
                                                            ))}
                                                        </CommandGroup>
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField control={form.control} name="exception_date" render={({ field }) => (<FormItem><FormLabel>{t('dialog.date')}</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
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
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>{t('dialog.cancel')}</Button>
                                <Button type="submit">{editingException ? t('dialog.save') : t('dialog.create')}</Button>
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
                        <AlertDialogCancel>{t('deleteDialog.cancel')}</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">{t('deleteDialog.confirm')}</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
