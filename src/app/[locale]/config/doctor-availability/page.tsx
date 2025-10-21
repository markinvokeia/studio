
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AvailabilityRule, User } from '@/lib/types';
import { AvailabilityRulesColumnsWrapper } from './columns';
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
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Check, ChevronsUpDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ColumnFiltersState, PaginationState } from '@tanstack/react-table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const availabilityFormSchema = z.object({
    id: z.string().optional(),
    user_id: z.string().min(1, 'Doctor is required'),
    recurrence: z.enum(['daily', 'weekly', 'biweekly']),
    day_of_week: z.string().optional(),
    start_time: z.string().min(1, 'Start time is required'),
    end_time: z.string().min(1, 'End time is required'),
    start_date: z.string().min(1, 'Start date is required'),
    end_date: z.string().optional(),
}).refine(data => {
    if ((data.recurrence === 'weekly' || data.recurrence === 'biweekly') && !data.day_of_week) {
        return false;
    }
    return true;
}, {
    message: "Day of week is required for weekly or biweekly recurrence",
    path: ["day_of_week"],
});

type AvailabilityFormValues = z.infer<typeof availabilityFormSchema>;

type GetAvailabilityResponse = {
  rules: AvailabilityRule[];
  total: number;
};

async function getAvailabilityRules(pagination: PaginationState, searchQuery: string): Promise<GetAvailabilityResponse> {
    try {
        const params = new URLSearchParams({
            page: (pagination.pageIndex + 1).toString(),
            limit: pagination.pageSize.toString(),
            search: searchQuery,
        });
        const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/availability_rules/search?${params.toString()}`, {
            method: 'GET',
            mode: 'cors',
            headers: { 'Accept': 'application/json' },
            cache: 'no-store',
        });
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        
        const responseData = await response.json();
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
        const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/users/doctors`, {
            method: 'GET',
            mode: 'cors',
            headers: { 'Accept': 'application/json' },
            cache: 'no-store',
        });
        if (!response.ok) throw new Error('Failed to fetch doctors');
        const data = await response.json();
        const doctorsData = Array.isArray(data) ? data : (data.doctors || data.data || []);
        return doctorsData.map((doc: any) => ({ ...doc, id: String(doc.id) }));
    } catch (error) {
        console.error("Failed to fetch doctors:", error);
        return [];
    }
}


async function upsertAvailabilityRule(ruleData: AvailabilityFormValues) {
    const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/availability_rules/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            ...ruleData,
            day_of_week: ruleData.day_of_week ? Number(ruleData.day_of_week) : null,
        }),
    });
    const responseData = await response.json();
    if (!response.ok || (responseData.error || (Array.isArray(responseData) && responseData[0]?.code >= 400))) {
        const message = responseData.message || (Array.isArray(responseData) && responseData[0]?.message) || 'Failed to save rule';
        throw new Error(message);
    }
    return responseData;
}

async function deleteAvailabilityRule(id: string) {
    const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/availability_rules/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
    });
    const responseData = await response.json();
    if (!response.ok || (responseData.error || (Array.isArray(responseData) && responseData[0]?.code >= 400))) {
        const message = responseData.message || (Array.isArray(responseData) && responseData[0]?.message) || 'Failed to delete rule';
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

    const form = useForm<AvailabilityFormValues>({
        resolver: zodResolver(availabilityFormSchema),
    });
    const [isDoctorComboboxOpen, setIsDoctorComboboxOpen] = React.useState(false);
    const watchedRecurrence = form.watch("recurrence");

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
        if(isDialogOpen) {
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
            start_date: format(new Date(rule.start_date), 'yyyy-MM-dd'),
            end_date: rule.end_date ? format(new Date(rule.end_date), 'yyyy-MM-dd') : '',
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
                description: error instanceof Error ? error.message : t('toast.deleteError'),
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
            setSubmissionError(error instanceof Error ? error.message : "An unexpected error occurred.");
        }
    };
    
    const availabilityColumns = AvailabilityRulesColumnsWrapper({ onEdit: handleEdit, onDelete: handleDelete });


    return (
        <>
        <Card>
            <CardHeader>
                <CardTitle>{t('title')}</CardTitle>
                <CardDescription>{t('description')}</CardDescription>
            </CardHeader>
            <CardContent>
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
                />
            </CardContent>
        </Card>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{editingRule ? t('dialog.editTitle') : t('dialog.createTitle')}</DialogTitle>
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
                                                    <Check className={cn("mr-2 h-4 w-4", doctor.id === field.value ? "opacity-100" : "opacity-0")}/>
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
        </>
    );
}

