
'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { AvailabilityRule, User } from '@/lib/types';
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
import { AvailabilityRulesColumnsWrapper } from './columns';

const availabilityFormSchema = (t: (key: string) => string) => z.object({
    id: z.string().optional(),
    user_id: z.string().min(1, t('doctorRequired')),
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
});

type AvailabilityFormValues = z.infer<ReturnType<typeof availabilityFormSchema>>;

type GetAvailabilityResponse = {
    rules: AvailabilityRule[];
    total: number;
};

async function getAvailabilityRules(pagination: PaginationState, searchQuery: string): Promise<GetAvailabilityResponse> {
    try {
        const responseData = await api.get(API_ROUTES.AVAILABILITY_RULES_SEARCH, {
            page: (pagination.pageIndex + 1).toString(),
            limit: pagination.pageSize.toString(),
            search: searchQuery,
        });
        const data = Array.isArray(responseData) && responseData.length > 0 ? responseData[0] : responseData;

        const rulesData = data.data || [];
        const total = Number(data.total) || 0;

        return {
            rules: rulesData.map((rule: any) => ({ ...rule, id: String(rule.id) })),
            total
        };
    } catch (error) {
        console.error("Failed to fetch availability rules:", error);
        return { rules: [], total: 0 };
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

export default function DoctorAvailabilityPage() {
    const t = useTranslations('DoctorAvailabilityPage');
    const { toast } = useToast();
    const [rules, setRules] = React.useState<AvailabilityRule[]>([]);
    const [doctors, setDoctors] = React.useState<User[]>([]);
    const [ruleCount, setRuleCount] = React.useState(0);
    const [isRefreshing, setIsRefreshing] = React.useState(false);

    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingRule, setEditingRule] = React.useState<AvailabilityRule | null>(null);

    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
    const [deletingRule, setDeletingRule] = React.useState<AvailabilityRule | null>(null);

    const [submissionError, setSubmissionError] = React.useState<string | null>(null);
    const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

    const tValidation = useTranslations('DoctorAvailabilityPage.validation');
    const form = useForm<AvailabilityFormValues>({
        resolver: zodResolver(availabilityFormSchema(tValidation)),
    });
    const [isDoctorComboboxOpen, React.useState(false);
    const watchedRecurrence = form.watch("recurrence");

    React.useEffect(() => {
        if (watchedRecurrence === 'daily') {
            form.setValue('day_of_week', undefined);
        }
    }, [watchedRecurrence, form]);

    const loadRules = React.useCallback(async () => {
        setIsRefreshing(true);
        const searchQuery = (columnFilters.find(f => f.id === 'user_name')?.value as string) || '';
        const { rules, total } = await getAvailabilityRules(pagination, searchQuery);
        setRules(rules);
        setRuleCount(total);
        setIsRefreshing(false);
    }, [pagination, columnFilters]);

    React.useEffect(() => {
        loadRules();
    }, [loadRules]);

    React.useEffect(() => {
        if (isDialogOpen) {
            getDoctors().then(setDoctors);
        }
    }, [isDialogOpen]);

    const handleCreate = () => {
        setEditingRule(null);
        form.reset({
            user_id: '',
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
            start_date: format(parseISO(rule.start_date), 'yyyy-MM-dd'),
            end_date: rule.end_date ? format(parseISO(rule.end_date), 'yyyy-MM-dd') : '',
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
            toast({
                variant: 'destructive',
                title: t('toast.errorTitle'),
                description: getErrorMessage(error),
            });
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

    const availabilityColumns = AvailabilityRulesColumnsWrapper({ onEdit: handleEdit, onDelete: handleDelete });

    const tColumns = useTranslations('DoctorAvailabilityColumns');
    const columnTranslations = {
        user_name: tColumns('doctor'),
        recurrence: tColumns('recurrence'),
        day_of_week: tColumns('day'),
        start_time: tColumns('startTime'),
        end_time: tColumns('endTime'),
        start_date: tColumns('startDate'),
        end_date: tColumns('endDate'),
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
                        columns={availabilityColumns}
                        data={rules}
                        pageCount={Math.ceil(ruleCount / pagination.pageSize)}
                        pagination={pagination}
                        onPaginationChange={setPagination}
                        columnFilters={columnFilters}
                        onColumnFiltersChange={setColumnFilters}
                        manualPagination={true}
                        filterColumnId="user_name"
                        filterPlaceholder={t('filterPlaceholder')}
                        onCreate={handleCreate}
                        onRefresh={loadRules}
                        isRefreshing={isRefreshing}
                        columnTranslations={columnTranslations}
                    />
                </CardContent>
            </Card>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingRule ? t('dialog.editTitle') : t('dialog.createTitle')}</DialogTitle>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4 px-6">
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
                            <FormField
                                control={form.control}
                                name="recurrence"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('dialog.recurrence')}</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                                <FormField control={form.control} name="start_date" render={({ field }) => (<FormItem><FormLabel>{t('dialog.startDate')}</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="end_date" render={({ field }) => (<FormItem><FormLabel>{t('dialog.endDate')}</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>{t('dialog.cancel')}</Button>
                                <Button type="submit">{editingRule ? t('dialog.save') : t('dialog.create')}</Button>
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
