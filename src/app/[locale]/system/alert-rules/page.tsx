'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { AlertCategory, AlertRule } from '@/lib/types';
import { api } from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnDef } from '@tanstack/react-table';
import { AlertTriangle, MoreHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

const ruleFormSchema = (t: (key: string) => string) => z.object({
    id: z.union([z.string(), z.number()]).optional(),
    category_id: z.string().min(1, t('categoryRequired')),
    code: z.string().min(1, t('codeRequired')),
    name: z.string().min(1, t('nameRequired')),
    description: z.string().optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
    source_table: z.string().min(1, t('sourceTableRequired')),
    days_before: z.coerce.number().int().default(0),
    days_after: z.coerce.number().int().default(0),
    recurrence_type: z.enum(['ONCE', 'DAILY', 'WEEKLY', 'MONTHLY']).optional(),
    auto_send_email: z.boolean().default(false),
    auto_send_sms: z.boolean().default(false),
    email_template_id: z.coerce.number().int().optional(),
    sms_template_id: z.coerce.number().int().optional(),
    is_active: z.boolean().default(true),
});

type RuleFormValues = z.infer<ReturnType<typeof ruleFormSchema>>;

async function getRules(): Promise<{ data: AlertRule[], total: number, page: number, limit: number }> {
    try {
        const response = await api.get(API_ROUTES.SYSTEM.ALERT_RULES, { search: '', page: '1', limit: '100', is_active: 'true' });
        // Filter out empty objects
        const filteredData = Array.isArray(response) ? response.filter(item => Object.keys(item).length > 0) : [];
        return {
            data: filteredData,
            total: filteredData.length,
            page: 1,
            limit: 100
        };
    } catch (error) {
        console.error('Error fetching rules:', error);
        return {
            data: [],
            total: 0,
            page: 1,
            limit: 100
        };
    }
}

async function getCategories(): Promise<{ data: AlertCategory[], total: number, page: number, limit: number }> {
    try {
        const response = await api.get(API_ROUTES.SYSTEM.ALERT_CATEGORIES, { search: '', page: '1', limit: '100', is_active: 'true' });
        let data, total, page, limit;
        if (Array.isArray(response)) {
            data = response.filter(item => Object.keys(item).length > 0);
            total = data.length;
            page = 1;
            limit = 100;
        } else {
            data = (response.data || []).filter(item => Object.keys(item).length > 0);
            total = response.total || data.length;
            page = response.page || 1;
            limit = response.limit || 100;
        }
        return { data, total, page, limit };
    } catch (error) {
        console.error('Error fetching categories:', error);
        return {
            data: [],
            total: 0,
            page: 1,
            limit: 100
        };
    }
}

async function getTablesAndColumns(): Promise<Record<string, { name: string, type: string, is_nullable: string }[]>> {
    try {
        const response = await api.get(API_ROUTES.SYSTEM.TABLES);
        // Response is an array: [{ "tables": { ... } }]
        if (Array.isArray(response) && response[0]?.tables) {
            return response[0].tables;
        }
        // Fallback for other formats
        const tablesData = response.tables || response;
        return tablesData || {};
    } catch (error) {
        console.error('Error fetching tables:', error);
        return {};
    }
}

async function getEmailTemplates(): Promise<any[]> {
    try {
        const response = await api.get(API_ROUTES.SYSTEM.COMMUNICATION_TEMPLATES, { search: '', page: '1', limit: '1000', is_active: 'true', type: 'email' });
        let data;
        if (Array.isArray(response)) {
            data = response.filter(item => Object.keys(item).length > 0);
        } else {
            data = (response.data || []).filter(item => Object.keys(item).length > 0);
        }
        return data;
    } catch (error) {
        console.error('Error fetching email templates:', error);
        return [];
    }
}

async function getSmsTemplates(): Promise<any[]> {
    try {
        const response = await api.get(API_ROUTES.SYSTEM.COMMUNICATION_TEMPLATES, { search: '', page: '1', limit: '1000', is_active: 'true', type: 'sms' });
        let data;
        if (Array.isArray(response)) {
            data = response.filter(item => Object.keys(item).length > 0);
        } else {
            data = (response.data || []).filter(item => Object.keys(item).length > 0);
        }
        return data;
    } catch (error) {
        console.error('Error fetching SMS templates:', error);
        return [];
    }
}

export default function AlertRulesPage() {
    const t = useTranslations('AlertRulesPage');
    const tValidation = useTranslations('AlertRulesPage.validation');
    const { toast } = useToast();
    const [rules, setRules] = React.useState<AlertRule[]>([]);
    const [categories, setCategories] = React.useState<AlertCategory[]>([]);
    const [tablesAndColumns, setTablesAndColumns] = React.useState<Record<string, { name: string, type: string, is_nullable: string }[]>>({});
    const [selectedTable, setSelectedTable] = React.useState<string>('');
    const [emailTemplates, setEmailTemplates] = React.useState<any[]>([]);
    const [smsTemplates, setSmsTemplates] = React.useState<any[]>([]);
    const [conditions, setConditions] = React.useState<Array<{ id: string, column: string, operator: string, value: string, logic: 'AND' | 'OR' }>>([]);
    const [isRefreshing, setIsRefreshing] = React.useState(false);

    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingRule, setEditingRule] = React.useState<AlertRule | null>(null);

    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
    const [deletingRule, setDeletingRule] = React.useState<AlertRule | null>(null);

    const [submissionError, setSubmissionError] = React.useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [isDeleting, setIsDeleting] = React.useState(false);

    const form = useForm<RuleFormValues>({
        resolver: zodResolver(ruleFormSchema(tValidation)),
    });

    const loadData = React.useCallback(async () => {
        setIsRefreshing(true);
        try {
            const [fetchedRules, fetchedCategories, fetchedTables, fetchedEmailTemplates, fetchedSmsTemplates] = await Promise.all([
                getRules(),
                getCategories(),
                getTablesAndColumns(),
                getEmailTemplates(),
                getSmsTemplates()
            ]);
            setRules(fetchedRules.data);
            setCategories(fetchedCategories.data);
            setTablesAndColumns(fetchedTables);
            setEmailTemplates(fetchedEmailTemplates);
            setSmsTemplates(fetchedSmsTemplates);
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setIsRefreshing(false);
        }
    }, []);

    React.useEffect(() => {
        loadData();
    }, [loadData]);

    const handleCreate = () => {
        setEditingRule(null);
        setSelectedTable('');
        setConditions([]);
        form.reset({ code: '', name: '', description: '', is_active: true, priority: 'MEDIUM', source_table: '', recurrence_type: '', email_template_id: undefined, sms_template_id: undefined, days_before: 0, days_after: 0 });
        setSubmissionError(null);
        setIsDialogOpen(true);
    };

    const handleEdit = (rule: AlertRule) => {
        setEditingRule(rule);
        setSelectedTable(rule.source_table || '');
        const conds = rule.condition_config?.conditions || [];
        setConditions(conds.map((c: any, i: number) => ({ id: `cond-${i}`, logic: c.logic || 'AND', ...c })));
        form.reset({
            ...rule,
            category_id: String(rule.category_id || ''),
            days_before: rule.days_before ?? 0,
            days_after: rule.days_after ?? 0,
            email_template_id: rule.email_template_id ? rule.email_template_id : undefined,
            sms_template_id: rule.sms_template_id ? rule.sms_template_id : undefined,
        });
        setSubmissionError(null);
        setIsDialogOpen(true);
    };

    const handleDelete = (rule: AlertRule) => {
        setDeletingRule(rule);
        setIsDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
        if (!deletingRule) return;
        setIsDeleting(true);
        try {
            await api.delete(API_ROUTES.SYSTEM.ALERT_RULES, { id: deletingRule.id });
            toast({ title: t('toast.deleteSuccessTitle'), description: t('toast.deleteSuccessDescription', { name: deletingRule.name }) });
            setIsDeleteDialogOpen(false);
            setDeletingRule(null);
            loadData();
        } catch (error) {
            console.error('Error deleting rule:', error);
            toast({ title: t('toast.errorTitle'), description: t('toast.deleteErrorDescription'), variant: 'destructive' });
        } finally {
            setIsDeleting(false);
        }
    };

    const onSubmit = async (values: RuleFormValues) => {
        setSubmissionError(null);
        setIsSubmitting(true);
        try {
            // Clean up conditions by removing UI-specific fields and structuring properly
            const cleanedConditions = conditions.map((cond, index) => {
                const { id, ...cleanCond } = cond;
                // Remove logic from first condition as it's not needed
                if (index === 0) {
                    const { logic, ...firstCond } = cleanCond;
                    return firstCond;
                }
                return cleanCond;
            });

            const data = {
                ...values,
                category_id: parseInt(values.category_id),
                condition_config: { conditions: cleanedConditions },
                created_by: 1, // TODO: get from current user
                email_template_id: values.email_template_id ?? null,
                sms_template_id: values.sms_template_id ?? null,
            };
            if (editingRule) {
                data.id = parseInt(editingRule.id);
            }
            await api.post(API_ROUTES.SYSTEM.ALERT_RULES, data);
            toast({ title: editingRule ? t('toast.editSuccessTitle') : t('toast.createSuccessTitle'), description: t('toast.successDescription', { name: values.name }) });
            setIsDialogOpen(false);
            loadData();
        } catch (error) {
            setSubmissionError(error instanceof Error ? error.message : 'An error occurred');
        } finally {
            setIsSubmitting(false);
        }
    };

    const columns: ColumnDef<AlertRule>[] = [
        { accessorKey: 'name', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.name')} /> },
        {
            accessorKey: 'category_id', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.category')} />,
            cell: ({ row }) => categories.find(c => c.id === row.original.category_id)?.name || 'N/A'
        },
        {
            accessorKey: 'priority', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.priority')} />,
            cell: ({ row }) => <Badge variant={row.original.priority === 'CRITICAL' ? 'destructive' : 'secondary'}>{row.original.priority}</Badge>
        },
        {
            accessorKey: 'auto_send_email',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.autoEmail')} />,
            cell: ({ row }) => <Checkbox checked={row.original.auto_send_email} disabled />
        },
        {
            accessorKey: 'auto_send_sms',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.autoSms')} />,
            cell: ({ row }) => <Checkbox checked={row.original.auto_send_sms} disabled />
        },
        {
            accessorKey: 'is_active',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.isActive')} />,
            cell: ({ row }) => <Badge variant={row.original.is_active ? 'success' : 'outline'}>{row.original.is_active ? t('columns.yes') : t('columns.no')}</Badge>
        },
        {
            id: 'actions',
            cell: ({ row }) => {
                const rule = row.original;
                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>{t('columns.actions')}</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleEdit(rule)}>{t('columns.edit')}</DropdownMenuItem>
                            <DropdownMenuItem>{t('columns.duplicate')}</DropdownMenuItem>
                            <DropdownMenuItem>{t('columns.test')}</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDelete(rule)} className="text-destructive">{t('columns.delete')}</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                );
            },
        },
    ];

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>{t('title')}</CardTitle>
                    <CardDescription>{t('description')}</CardDescription>
                </CardHeader>
                <CardContent>
                    <DataTable
                        columns={columns}
                        data={rules}
                        filterColumnId="name"
                        filterPlaceholder={t('filterPlaceholder')}
                        onCreate={handleCreate}
                        onRefresh={loadData}
                        isRefreshing={isRefreshing}
                    />
                </CardContent>
            </Card>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{editingRule ? t('dialog.editTitle') : t('dialog.createTitle')}</DialogTitle>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-4">
                            {submissionError && (
                                <Alert variant="destructive">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertTitle>{t('toast.errorTitle')}</AlertTitle>
                                    <AlertDescription>{submissionError}</AlertDescription>
                                </Alert>
                            )}
                            <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>{t('dialog.name')}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="code" render={({ field }) => (<FormItem><FormLabel>{t('dialog.code')}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="category_id" render={({ field }) => (<FormItem><FormLabel>{t('dialog.category')}</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder={t('dialog.selectCategory')} /></SelectTrigger></FormControl><SelectContent>{categories.map(c => <SelectItem key={String(c.id)} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>{t('dialog.description')}</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="priority" render={({ field }) => (<FormItem><FormLabel>{t('dialog.priority')}</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder={t('dialog.selectPriority')} /></SelectTrigger></FormControl><SelectContent><SelectItem value="LOW">{t('priorities.low')}</SelectItem><SelectItem value="MEDIUM">{t('priorities.medium')}</SelectItem><SelectItem value="HIGH">{t('priorities.high')}</SelectItem><SelectItem value="CRITICAL">{t('priorities.critical')}</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="source_table" render={({ field }) => (<FormItem><FormLabel>{t('dialog.sourceTable')}</FormLabel><Select onValueChange={(value) => { field.onChange(value); setSelectedTable(value); }} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder={t('dialog.selectSourceTable')} /></SelectTrigger></FormControl><SelectContent>{Object.keys(tablesAndColumns).map(table => <SelectItem key={table} value={table}>{table}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                            <div className="space-y-4">
                                <FormLabel>{t('dialog.conditions')}</FormLabel>
                                {conditions.map((cond, index) => (
                                    <div key={cond.id} className="flex items-center space-x-2">
                                        {index > 0 && (
                                            <Select value={cond.logic} onValueChange={(value: 'AND' | 'OR') => {
                                                const newConds = [...conditions];
                                                newConds[index].logic = value;
                                                setConditions(newConds);
                                            }}>
                                                <SelectTrigger className="w-16">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="AND">AND</SelectItem>
                                                    <SelectItem value="OR">OR</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        )}
                                        <Select value={cond.column} onValueChange={(value) => {
                                            const newConds = [...conditions];
                                            newConds[index].column = value;
                                            setConditions(newConds);
                                        }}>
                                            <SelectTrigger className={index === 0 ? "w-1/3" : "w-1/4"}>
                                                <SelectValue placeholder="Column" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {(tablesAndColumns[selectedTable] || []).map(col => <SelectItem key={col.name} value={col.name}>{col.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        <Select value={cond.operator} onValueChange={(value) => {
                                            const newConds = [...conditions];
                                            newConds[index].operator = value;
                                            setConditions(newConds);
                                        }}>
                                            <SelectTrigger className="w-1/4">
                                                <SelectValue placeholder="Operator" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="=">=</SelectItem>
                                                <SelectItem value="!=">!=</SelectItem>
                                                <SelectItem value=">">{'>'}</SelectItem>
                                                <SelectItem value="<">{'<'}</SelectItem>
                                                <SelectItem value=">=">{'>='}</SelectItem>
                                                <SelectItem value="<=">{'<='}</SelectItem>
                                                <SelectItem value="contains">contains</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <Input
                                            value={cond.value}
                                            onChange={(e) => {
                                                const newConds = [...conditions];
                                                newConds[index].value = e.target.value;
                                                setConditions(newConds);
                                            }}
                                            placeholder="Value"
                                            className="w-1/4"
                                        />
                                        <Button type="button" variant="outline" size="sm" onClick={() => setConditions(conditions.filter((_, i) => i !== index))}>Remove</Button>
                                    </div>
                                ))}
                                <Button type="button" variant="outline" onClick={() => setConditions([...conditions, { id: `cond-${Date.now()}`, column: '', operator: '=', value: '', logic: 'AND' }])}>Add Condition</Button>
                            </div>
                            <FormField control={form.control} name="recurrence_type" render={({ field }) => (<FormItem><FormLabel>{t('dialog.recurrenceType')}</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder={t('dialog.selectRecurrenceType')} /></SelectTrigger></FormControl><SelectContent><SelectItem value="ONCE">Once</SelectItem><SelectItem value="DAILY">Daily</SelectItem><SelectItem value="WEEKLY">Weekly</SelectItem><SelectItem value="MONTHLY">Monthly</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                            <div className="grid grid-cols-2 gap-4">
                                <FormField control={form.control} name="email_template_id" render={({ field }) => (<FormItem><FormLabel>{t('dialog.emailTemplate')}</FormLabel><Select onValueChange={(value) => field.onChange(value ? parseInt(value) : undefined)} value={field.value?.toString() || ""}><FormControl><SelectTrigger><SelectValue placeholder={t('dialog.selectEmailTemplate')} /></SelectTrigger></FormControl><SelectContent>{emailTemplates.filter(t => t.id).map(t => <SelectItem key={t.id.toString()} value={t.id.toString()}>{t.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="sms_template_id" render={({ field }) => (<FormItem><FormLabel>{t('dialog.smsTemplate')}</FormLabel><Select onValueChange={(value) => field.onChange(value ? parseInt(value) : undefined)} value={field.value?.toString() || ""}><FormControl><SelectTrigger><SelectValue placeholder={t('dialog.selectSmsTemplate')} /></SelectTrigger></FormControl><SelectContent>{smsTemplates.filter(t => t.id).map(t => <SelectItem key={t.id.toString()} value={t.id.toString()}>{t.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <FormField control={form.control} name="days_before" render={({ field }) => (<FormItem><FormLabel>{t('dialog.daysBefore')}</FormLabel><FormControl><Input type="number" value={field.value ?? ''} onChange={field.onChange} onBlur={field.onBlur} name={field.name} ref={field.ref} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="days_after" render={({ field }) => (<FormItem><FormLabel>{t('dialog.daysAfter')}</FormLabel><FormControl><Input type="number" value={field.value ?? ''} onChange={field.onChange} onBlur={field.onBlur} name={field.name} ref={field.ref} /></FormControl><FormMessage /></FormItem>)} />
                            </div>
                            <div className="flex space-x-4">
                                <FormField control={form.control} name="auto_send_email" render={({ field }) => (<FormItem className="flex flex-row items-center space-x-3 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>{t('dialog.autoSendEmail')}</FormLabel></FormItem>)} />
                                <FormField control={form.control} name="auto_send_sms" render={({ field }) => (<FormItem className="flex flex-row items-center space-x-3 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>{t('dialog.autoSendSms')}</FormLabel></FormItem>)} />
                                <FormField control={form.control} name="is_active" render={({ field }) => (<FormItem className="flex flex-row items-center space-x-3 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>{t('dialog.isActive')}</FormLabel></FormItem>)} />
                            </div>

                            <DialogFooter className="sticky bottom-0 bg-background pt-4">
                                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting}>{t('dialog.cancel')}</Button>
                                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? t('dialog.saving') : (editingRule ? t('dialog.save') : t('dialog.create'))}</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('deleteDialog.title')}</AlertDialogTitle>
                        <AlertDialogDescription>{t('deleteDialog.description', { name: deletingRule?.name })}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>{t('deleteDialog.cancel')}</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">{isDeleting ? t('deleteDialog.deleting') : t('deleteDialog.confirm')}</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

