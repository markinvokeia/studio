'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AlertRule, AlertCategory } from '@/lib/types';
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
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, MoreHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

const ruleFormSchema = z.object({
  id: z.string().optional(),
  category_id: z.string().min(1, 'Category is required.'),
  code: z.string().min(1, 'Code is required.'),
  name: z.string().min(1, 'Name is required.'),
  description: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  source_table: z.string().min(1, 'Source table is required.'),
  query_template: z.string().min(1, 'Query template is required.'),
  days_before: z.coerce.number().optional(),
  days_after: z.coerce.number().optional(),
  auto_send_email: z.boolean().default(false),
  auto_send_sms: z.boolean().default(false),
  is_active: z.boolean().default(true),
});

type RuleFormValues = z.infer<typeof ruleFormSchema>;

// MOCK DATA - Replace with API calls
async function getRules(): Promise<AlertRule[]> {
    return [
        { id: '1', category_id: '1', code: 'APPT_REMINDER_24H', name: '24h Appointment Reminder', priority: 'HIGH', source_table: 'appointments', query_template: 'SELECT * FROM appointments WHERE appointment_date = CURRENT_DATE + 1', is_active: true, auto_send_email: true, auto_send_sms: false },
        { id: '2', category_id: '2', code: 'INV_OVERDUE', name: 'Invoice Overdue', priority: 'CRITICAL', source_table: 'invoices', query_template: 'SELECT * FROM invoices WHERE due_date < CURRENT_DATE AND status = \'unpaid\'', is_active: true, auto_send_email: true, auto_send_sms: false },
        { id: '3', category_id: '1', code: 'PATIENT_BIRTHDAY', name: 'Patient Birthday', priority: 'LOW', source_table: 'patients', query_template: 'SELECT * FROM patients WHERE EXTRACT(MONTH FROM dob) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(DAY FROM dob) = EXTRACT(DAY FROM CURRENT_DATE)', is_active: false, auto_send_email: false, auto_send_sms: false },
    ];
}

async function getCategories(): Promise<AlertCategory[]> {
    return [
        { id: '1', code: 'APPOINTMENTS', name: 'Appointments', description: 'Alerts related to patient appointments.', icon: 'calendar', color: '#3b82f6', is_active: true, sort_order: 1 },
        { id: '2', code: 'BILLING', name: 'Billing', description: 'Alerts related to invoices and payments.', icon: 'dollar-sign', color: '#10b981', is_active: true, sort_order: 2 },
        { id: '3', code: 'FOLLOWUP', name: 'Follow-up', description: 'Post-consultation follow-up alerts.', icon: 'stethoscope', color: '#f97316', is_active: true, sort_order: 3 },
    ];
}
// END MOCK DATA

export default function AlertRulesPage() {
    const t = useTranslations('AlertRulesPage');
    const { toast } = useToast();
    const [rules, setRules] = React.useState<AlertRule[]>([]);
    const [categories, setCategories] = React.useState<AlertCategory[]>([]);
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingRule, setEditingRule] = React.useState<AlertRule | null>(null);

    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
    const [deletingRule, setDeletingRule] = React.useState<AlertRule | null>(null);

    const [submissionError, setSubmissionError] = React.useState<string | null>(null);

    const form = useForm<RuleFormValues>({
        resolver: zodResolver(ruleFormSchema),
    });

    const loadData = React.useCallback(async () => {
        setIsRefreshing(true);
        const [fetchedRules, fetchedCategories] = await Promise.all([getRules(), getCategories()]);
        setRules(fetchedRules);
        setCategories(fetchedCategories);
        setIsRefreshing(false);
    }, []);

    React.useEffect(() => {
        loadData();
    }, [loadData]);

    const handleCreate = () => {
        setEditingRule(null);
        form.reset({ code: '', name: '', description: '', is_active: true, priority: 'MEDIUM', source_table: '', query_template: '' });
        setSubmissionError(null);
        setIsDialogOpen(true);
    };
    
    const handleEdit = (rule: AlertRule) => {
        setEditingRule(rule);
        form.reset({ ...rule, category_id: String(rule.category_id) });
        setSubmissionError(null);
        setIsDialogOpen(true);
    };

    const handleDelete = (rule: AlertRule) => {
        setDeletingRule(rule);
        setIsDeleteDialogOpen(true);
    };
    
    const confirmDelete = async () => {
        if (!deletingRule) return;
        toast({ title: t('toast.deleteSuccessTitle'), description: t('toast.deleteSuccessDescription', { name: deletingRule.name }) });
        setIsDeleteDialogOpen(false);
        setDeletingRule(null);
        loadData();
    };

    const onSubmit = async (values: RuleFormValues) => {
        setSubmissionError(null);
        toast({ title: editingRule ? t('toast.editSuccessTitle') : t('toast.createSuccessTitle'), description: t('toast.successDescription', { name: values.name }) });
        setIsDialogOpen(false);
        loadData();
    };
    
    const columns: ColumnDef<AlertRule>[] = [
        { accessorKey: 'name', header: ({column}) => <DataTableColumnHeader column={column} title={t('columns.name')} /> },
        { accessorKey: 'category_id', header: ({column}) => <DataTableColumnHeader column={column} title={t('columns.category')} />,
            cell: ({ row }) => categories.find(c => c.id === row.original.category_id)?.name || 'N/A'
        },
        { accessorKey: 'priority', header: ({column}) => <DataTableColumnHeader column={column} title={t('columns.priority')} />,
            cell: ({ row }) => <Badge variant={row.original.priority === 'CRITICAL' ? 'destructive' : 'secondary'}>{row.original.priority}</Badge>
        },
        { accessorKey: 'is_active', header: ({column}) => <DataTableColumnHeader column={column} title={t('columns.isActive')} />,
            cell: ({ row }) => row.original.is_active ? t('columns.yes') : t('columns.no')
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
                        <FormField control={form.control} name="category_id" render={({ field }) => (<FormItem><FormLabel>{t('dialog.category')}</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder={t('dialog.selectCategory')} /></SelectTrigger></FormControl><SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>{t('dialog.description')}</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="priority" render={({ field }) => (<FormItem><FormLabel>{t('dialog.priority')}</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder={t('dialog.selectPriority')} /></SelectTrigger></FormControl><SelectContent><SelectItem value="LOW">Low</SelectItem><SelectItem value="MEDIUM">Medium</SelectItem><SelectItem value="HIGH">High</SelectItem><SelectItem value="CRITICAL">Critical</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="source_table" render={({ field }) => (<FormItem><FormLabel>{t('dialog.sourceTable')}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="query_template" render={({ field }) => (<FormItem><FormLabel>{t('dialog.queryTemplate')}</FormLabel><FormControl><Textarea {...field} rows={5} /></FormControl><FormMessage /></FormItem>)} />
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="days_before" render={({ field }) => (<FormItem><FormLabel>{t('dialog.daysBefore')}</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="days_after" render={({ field }) => (<FormItem><FormLabel>{t('dialog.daysAfter')}</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                        <div className="flex space-x-4">
                             <FormField control={form.control} name="auto_send_email" render={({ field }) => (<FormItem className="flex flex-row items-center space-x-3 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>{t('dialog.autoSendEmail')}</FormLabel></FormItem>)} />
                             <FormField control={form.control} name="auto_send_sms" render={({ field }) => (<FormItem className="flex flex-row items-center space-x-3 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>{t('dialog.autoSendSms')}</FormLabel></FormItem>)} />
                             <FormField control={form.control} name="is_active" render={({ field }) => (<FormItem className="flex flex-row items-center space-x-3 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>{t('dialog.isActive')}</FormLabel></FormItem>)} />
                        </div>

                        <DialogFooter className="sticky bottom-0 bg-background pt-4">
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
                    <AlertDialogDescription>{t('deleteDialog.description', { name: deletingRule?.name })}</AlertDialogDescription>
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
