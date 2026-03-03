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
import { DynamicFieldInput } from '@/components/ui/dynamic-field-input';
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
import * as LucideIcons from 'lucide-react';
import { AlertTriangle, BotMessageSquare, MoreHorizontal, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

const ruleFormSchema = (t: (key: string) => string) => z.object({
    id: z.union([z.string(), z.number()]).optional(),
    category_id: z.string().min(1, t('validation.categoryRequired')),
    code: z.string().min(1, t('validation.codeRequired')),
    name: z.string().min(1, t('validation.nameRequired')),
    description: z.string().optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
    source_table: z.string().min(1, t('validation.sourceTableRequired')),
    table_id_field: z.string().min(1, t('validation.tableIdFieldRequired')),
    user_id_field: z.string().optional(),
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
        const filteredData = Array.isArray(response) ? response.filter(item => Object.keys(item).length > 0) : [];
        return {
            data: filteredData,
            total: filteredData.length,
            page: 1,
            limit: 100
        };
    } catch (error) {
        console.error('Error fetching rules:', error);
        return { data: [], total: 0, page: 1, limit: 100 };
    }
}

async function getCategories(): Promise<{ data: AlertCategory[], total: number, page: number, limit: number }> {
    try {
        const response = await api.get(API_ROUTES.SYSTEM.ALERT_CATEGORIES, { search: '', page: '1', limit: '100', is_active: 'true' });
        let data, total, page, limit;
        if (Array.isArray(response)) {
            data = response.filter((item: any) => Object.keys(item).length > 0);
            total = data.length;
            page = 1;
            limit = 100;
        } else {
            data = (response.data || []).filter((item: any) => Object.keys(item).length > 0);
            total = response.total || data.length;
            page = response.page || 1;
            limit = response.limit || 100;
        }
        return { data, total, page, limit };
    } catch (error) {
        console.error('Error fetching categories:', error);
        return { data: [], total: 0, page: 1, limit: 100 };
    }
}

async function getTablesAndColumns(): Promise<Record<string, { name: string, type: string, is_nullable: string }[]>> {
    try {
        const response = await api.get(API_ROUTES.SYSTEM.TABLES);
        if (Array.isArray(response) && response[0]?.tables) {
            return response[0].tables;
        }
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
        return Array.isArray(response) ? response.filter((item: any) => Object.keys(item).length > 0) : (response.data || []);
    } catch (error) {
        console.error('Error fetching email templates:', error);
        return [];
    }
}

async function getSmsTemplates(): Promise<any[]> {
    try {
        const response = await api.get(API_ROUTES.SYSTEM.COMMUNICATION_TEMPLATES, { search: '', page: '1', limit: '1000', is_active: 'true', type: 'sms' });
        return Array.isArray(response) ? response.filter((item: any) => Object.keys(item).length > 0) : (response.data || []);
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
    const [conditions, setConditions] = React.useState<Array<{ id: string, column: string, operator: string, value: string, logic?: 'AND' | 'OR' }>>([]);
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingRule, setEditingRule] = React.useState<AlertRule | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
    const [deletingRule, setDeletingRule] = React.useState<AlertRule | null>(null);
    const [submissionError, setSubmissionError] = React.useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [isDeleting, setIsDeleting] = React.useState(false);
    const [isTesting, setIsTesting] = React.useState(false);

    const form = useForm<RuleFormValues>({
        resolver: zodResolver(ruleFormSchema(tValidation)),
    });

    const getColumnType = (columnName: string): string | undefined => {
        const tableCols = tablesAndColumns[selectedTable] || [];
        const col = tableCols.find(c => c.name === columnName);
        return col?.type;
    };

    const validateTableIdField = (tableIdField: string, tableName: string): boolean => {
        const tableCols = tablesAndColumns[tableName] || [];
        return tableCols.some(col => col.name === tableIdField);
    };

    const validateUserIdField = (userIdField: string, tableName: string): boolean => {
        const tableCols = tablesAndColumns[tableName] || [];
        return tableCols.some(col => col.name === userIdField);
    };

    const getPotentialTableIdFields = (tableName: string) => {
        const tableCols = tablesAndColumns[tableName] || [];
        return tableCols
            .filter(col => {
                const colName = col.name.toLowerCase();
                const colType = col.type.toLowerCase();
                return (
                    colName === 'id' ||
                    colName.endsWith('_id') ||
                    (colName.includes('id') && (colType.includes('int') || colType.includes('bigint') || colType.includes('uuid') || colType.includes('varchar')))
                );
            })
            .map(col => ({
                name: col.name,
                type: col.type,
                priority: col.name.toLowerCase() === 'id' ? 1 : (col.name.toLowerCase().endsWith('_id') ? 2 : 5)
            }))
            .sort((a, b) => a.priority - b.priority);
    };

    const getPotentialUserIdFields = (tableName: string) => {
        const tableCols = tablesAndColumns[tableName] || [];
        return tableCols
            .filter(col => {
                const colName = col.name.toLowerCase();
                return colName.includes('user_id') || colName.includes('patient_id') || colName.includes('customer_id') || colName.includes('client_id');
            })
            .map(col => ({
                name: col.name,
                type: col.type,
                priority: col.name.toLowerCase().includes('user_id') ? 1 : 2
            }))
            .sort((a, b) => a.priority - b.priority);
    };

    const getAvailableOperators = (columnName: string): string[] => {
        const type = getColumnType(columnName);
        if (!type) return ['=', '!=', 'IS NULL', 'IS NOT NULL'];
        const lowerType = type.toLowerCase();
        const baseOperators = ['=', '!=', 'IS NULL', 'IS NOT NULL'];
        if (lowerType.includes('varchar') || lowerType.includes('text')) {
            return [...baseOperators, 'contains', 'LIKE', 'NOT LIKE', 'IN', 'NOT IN'];
        } else if (lowerType.includes('int') || lowerType.includes('decimal') || lowerType.includes('numeric')) {
            return [...baseOperators, '>', '<', '>=', '<=', 'IN', 'NOT IN', 'BETWEEN'];
        } else if (lowerType.includes('date') || lowerType.includes('time')) {
            return [...baseOperators, '>', '<', '>=', '<=', 'IN', 'NOT IN', 'BETWEEN'];
        }
        return baseOperators;
    };

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
            const mappedRules = fetchedRules.data.map(rule => ({
                ...rule,
                table_id_field: (rule as any).condition_config?.table_id_field?.name || '',
                user_id_field: (rule as any).condition_config?.user_id_field || null,
            }));
            setRules(mappedRules);
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

    React.useEffect(() => {
        if (selectedTable) {
            const currentTableIdField = form.getValues('table_id_field');
            if (currentTableIdField && !validateTableIdField(currentTableIdField, selectedTable)) {
                form.setValue('table_id_field', '');
            }
            const currentUserIdField = form.getValues('user_id_field');
            if (currentUserIdField && !validateUserIdField(currentUserIdField, selectedTable)) {
                form.setValue('user_id_field', '');
            }
        }
    }, [selectedTable, form, tablesAndColumns]);

    const handleCreate = () => {
        setEditingRule(null);
        setSelectedTable('');
        setConditions([]);
        form.reset({ code: '', name: '', description: '', is_active: true, priority: 'MEDIUM', source_table: '', table_id_field: '', user_id_field: '', recurrence_type: undefined, email_template_id: undefined, sms_template_id: undefined, days_before: 0, days_after: 0 });
        setSubmissionError(null);
        setIsDialogOpen(true);
    };

    const handleEdit = (rule: AlertRule) => {
        setEditingRule(rule);
        setSelectedTable(rule.source_table || '');
        const conds = (rule as any).condition_config?.conditions || [];
        setConditions(conds.map((c: any, i: number) => ({ id: `cond-${i}`, ...(i > 0 ? { logic: c.logic || 'AND' } : {}), ...c })));
        form.reset({
            ...rule,
            category_id: String(rule.category_id || ''),
            table_id_field: (rule as any).table_id_field || '',
            days_before: rule.days_before ?? 0,
            days_after: rule.days_after ?? 0,
            email_template_id: rule.email_template_id ? parseInt(rule.email_template_id) : undefined,
            sms_template_id: rule.sms_template_id ? parseInt(rule.sms_template_id) : undefined,
            user_id_field: (rule as any).user_id_field || '',
        });
        setSubmissionError(null);
        setIsDialogOpen(true);
    };

    const handleDuplicate = (rule: AlertRule) => {
        setEditingRule(null);
        setSelectedTable(rule.source_table || '');
        const conds = (rule as any).condition_config?.conditions || [];
        setConditions(conds.map((c: any, i: number) => ({ id: `cond-${i}`, ...(i > 0 ? { logic: c.logic || 'AND' } : {}), ...c })));
        form.reset({
            ...rule,
            id: undefined,
            name: `${rule.name} (Copy)`,
            code: `${rule.code}_COPY`,
            category_id: String(rule.category_id || ''),
            table_id_field: (rule as any).table_id_field || '',
            days_before: rule.days_before ?? 0,
            days_after: rule.days_after ?? 0,
            email_template_id: rule.email_template_id ? parseInt(rule.email_template_id) : undefined,
            sms_template_id: rule.sms_template_id ? parseInt(rule.sms_template_id) : undefined,
            user_id_field: (rule as any).user_id_field || '',
        });
        setSubmissionError(null);
        setIsDialogOpen(true);
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

    const handleTest = async (rule: AlertRule) => {
        setIsTesting(true);
        try {
            await api.post(API_ROUTES.SYSTEM.ALERT_RULES_TEST, { id: rule.id });
            toast({ title: t('toast.testSuccessTitle'), description: t('toast.testSuccessDescription', { name: rule.name }) });
        } catch (error) {
            console.error('Error testing rule:', error);
            toast({ title: t('toast.errorTitle'), description: t('toast.testErrorDescription'), variant: 'destructive' });
        } finally {
            setIsTesting(false);
        }
    };

    const onSubmit = async (values: RuleFormValues) => {
        setSubmissionError(null);
        setIsSubmitting(true);
        try {
            const cleanedConditions = conditions.map((cond, index) => {
                const { id, ...cleanCond } = cond;
                if (index === 0) {
                    const { logic, ...firstCond } = cleanCond;
                    return firstCond;
                }
                return cleanCond;
            });

            const data = {
                ...values,
                category_id: parseInt(values.category_id),
                table_id_field: values.table_id_field,
                user_id_field: values.user_id_field || null,
                condition_config: {
                    conditions: cleanedConditions,
                    table_id_field: {
                        name: values.table_id_field,
                        type: getColumnType(values.table_id_field) || ''
                    },
                    user_id_field: values.user_id_field || null
                },
                created_by: 1,
                email_template_id: values.email_template_id ?? null,
                sms_template_id: values.sms_template_id ?? null,
            };
            if (editingRule) {
                (data as any).id = parseInt(editingRule.id);
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
            cell: ({ row }) => categories.find(c => String(c.id) === String(row.original.category_id))?.name || 'N/A'
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
                            <DropdownMenuItem onClick={() => handleDuplicate(rule)}>{t('columns.duplicate')}</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleTest(rule)} disabled={isTesting}>{t('columns.test')}</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setDeletingRule(rule); setIsDeleteDialogOpen(true); }} className="text-destructive">{t('columns.delete')}</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                );
            },
        },
    ];

    return (
        <>
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <Card className="flex-1 flex flex-col min-h-0 overflow-hidden shadow-sm border-0">
                    <CardHeader className="p-4">
                        <div className="flex items-start gap-3">
                            <div className="header-icon-circle mt-0.5">
                                <BotMessageSquare className="h-5 w-5" />
                            </div>
                            <div className="flex flex-col text-left">
                                <CardTitle className="text-lg">{t('title')}</CardTitle>
                                <CardDescription className="text-xs">{t('description')}</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden p-6 bg-card">
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
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>{editingRule ? t('dialog.editTitle') : t('dialog.createTitle')}</DialogTitle>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 overflow-y-auto space-y-4 py-4 px-6">
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
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="code"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('dialog.code')}</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="category_id"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('dialog.category')}</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder={t('dialog.selectCategory')} />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {categories.map(c => <SelectItem key={String(c.id)} value={String(c.id)}>{c.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="description"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('dialog.description')}</FormLabel>
                                        <FormControl>
                                            <Textarea {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="priority"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('dialog.priority')}</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder={t('dialog.selectPriority')} />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="LOW">{t('priorities.low')}</SelectItem>
                                                <SelectItem value="MEDIUM">{t('priorities.medium')}</SelectItem>
                                                <SelectItem value="HIGH">{t('priorities.high')}</SelectItem>
                                                <SelectItem value="CRITICAL">{t('priorities.critical')}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="source_table"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('dialog.sourceTable')}</FormLabel>
                                        <Select onValueChange={(val) => { field.onChange(val); setSelectedTable(val); }} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder={t('dialog.selectSourceTable')} />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {Object.keys(tablesAndColumns).map(table => <SelectItem key={table} value={table}>{table}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="table_id_field"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('dialog.tableIdField')}</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder={t('dialog.selectTableIdField')} />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {selectedTable && getPotentialTableIdFields(selectedTable).map(col => (
                                                    <SelectItem key={col.name} value={col.name}>{col.name} ({col.type})</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="user_id_field"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('dialog.userIdField')}</FormLabel>
                                        <Select onValueChange={(val) => field.onChange(val === 'none' ? '' : val)} value={field.value || 'none'}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder={t('dialog.selectUserIdField')} />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="none">{t('dialog.noUserIdField')}</SelectItem>
                                                {selectedTable && getPotentialUserIdFields(selectedTable).map(col => (
                                                    <SelectItem key={col.name} value={col.name}>{col.name} ({col.type})</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="space-y-4">
                                <Label>{t('dialog.conditions')}</Label>
                                {conditions.map((cond, index) => (
                                    <div key={cond.id} className="flex items-center space-x-2">
                                        {index > 0 && (
                                            <Select value={cond.logic} onValueChange={(val: any) => {
                                                const newConds = [...conditions];
                                                newConds[index].logic = val;
                                                setConditions(newConds);
                                            }}>
                                                <SelectTrigger className="w-16"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="AND">AND</SelectItem>
                                                    <SelectItem value="OR">OR</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        )}
                                        <Select value={cond.column} onValueChange={(val) => {
                                            const newConds = [...conditions];
                                            newConds[index].column = val;
                                            setConditions(newConds);
                                        }}>
                                            <SelectTrigger className="flex-1"><SelectValue placeholder="Column" /></SelectTrigger>
                                            <SelectContent>
                                                {(tablesAndColumns[selectedTable] || []).map(col => <SelectItem key={col.name} value={col.name}>{col.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        <Select value={cond.operator} onValueChange={(val) => {
                                            const newConds = [...conditions];
                                            newConds[index].operator = val;
                                            setConditions(newConds);
                                        }}>
                                            <SelectTrigger className="w-24"><SelectValue placeholder="Op" /></SelectTrigger>
                                            <SelectContent>
                                                {getAvailableOperators(cond.column).map(op => <SelectItem key={op} value={op}>{op}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        <DynamicFieldInput
                                            value={cond.value}
                                            onChange={(val) => {
                                                const newConds = [...conditions];
                                                newConds[index].value = val;
                                                setConditions(newConds);
                                            }}
                                            fieldType={getColumnType(cond.column) || ''}
                                            operator={cond.operator}
                                            className="flex-1"
                                        />
                                        <Button type="button" variant="ghost" size="icon" onClick={() => setConditions(conditions.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></Button>
                                    </div>
                                ))}
                                <Button type="button" variant="outline" size="sm" onClick={() => setConditions([...conditions, { id: `cond-${Date.now()}`, column: '', operator: '=', value: '', ...(conditions.length > 0 ? { logic: 'AND' } : {}) }])}>
                                    Add Condition
                                </Button>
                            </div>

                            <FormField
                                control={form.control}
                                name="recurrence_type"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('dialog.recurrenceType')}</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder={t('dialog.selectRecurrenceType')} />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="ONCE">Once</SelectItem>
                                                <SelectItem value="DAILY">Daily</SelectItem>
                                                <SelectItem value="WEEKLY">Weekly</SelectItem>
                                                <SelectItem value="MONTHLY">Monthly</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="email_template_id"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('dialog.emailTemplate')}</FormLabel>
                                            <Select onValueChange={(val) => field.onChange(val ? parseInt(val) : undefined)} value={field.value?.toString()}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder={t('dialog.selectEmailTemplate')} />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {emailTemplates.map(tmp => <SelectItem key={tmp.id} value={tmp.id.toString()}>{tmp.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="sms_template_id"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('dialog.smsTemplate')}</FormLabel>
                                            <Select onValueChange={(val) => field.onChange(val ? parseInt(val) : undefined)} value={field.value?.toString()}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder={t('dialog.selectSmsTemplate')} />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {smsTemplates.map(tmp => <SelectItem key={tmp.id} value={tmp.id.toString()}>{tmp.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <FormField control={form.control} name="days_before" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('dialog.daysBefore')}</FormLabel>
                                        <FormControl>
                                            <Input type="number" {...field} />
                                        </FormControl>
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="days_after" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('dialog.daysAfter')}</FormLabel>
                                        <FormControl>
                                            <Input type="number" {...field} />
                                        </FormControl>
                                    </FormItem>
                                )} />
                            </div>

                            <div className="flex space-x-4">
                                <FormField control={form.control} name="auto_send_email" render={({ field }) => (
                                    <FormItem className="flex items-center space-x-2 space-y-0">
                                        <FormControl>
                                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                        </FormControl>
                                        <FormLabel>{t('dialog.autoSendEmail')}</FormLabel>
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="auto_send_sms" render={({ field }) => (
                                    <FormItem className="flex items-center space-x-2 space-y-0">
                                        <FormControl>
                                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                        </FormControl>
                                        <FormLabel>{t('dialog.autoSendSms')}</FormLabel>
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="is_active" render={({ field }) => (
                                    <FormItem className="flex items-center space-x-2 space-y-0">
                                        <FormControl>
                                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                        </FormControl>
                                        <FormLabel>{t('dialog.isActive')}</FormLabel>
                                    </FormItem>
                                )} />
                            </div>
                        </form>
                    </Form>
                    <DialogFooter className="pt-4 px-6">
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting}>{t('dialog.cancel')}</Button>
                        <Button disabled={isSubmitting} onClick={form.handleSubmit(onSubmit)}>{isSubmitting ? t('dialog.saving') : (editingRule ? t('dialog.save') : t('dialog.create'))}</Button>
                    </DialogFooter>
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
