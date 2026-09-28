'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmActionDialog } from '@/components/ui/confirm-action-dialog';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import {
    Dialog,
    DialogCancelButton,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { DynamicFieldInput } from '@/components/ui/dynamic-field-input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { SYSTEM_PERMISSIONS } from '@/constants/permissions';
import { API_ROUTES } from '@/constants/routes';
import { useAsyncAction, useKeyedAsyncAction } from '@/hooks/use-async-action';
import { useDataLoader } from '@/hooks/use-data-loader';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { getErrorMessage } from '@/lib/error-utils';
import { AlertCategory, AlertRule } from '@/lib/types';
import { DataCard } from '@/components/ui/data-card';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';
import { api, isTimeoutError, REQUEST_TIMEOUT_MS } from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnDef } from '@tanstack/react-table';
import { Separator } from '@/components/ui/separator';
import { TwoPanelLayout } from '@/components/layout/two-panel-layout';
import { AlertTriangle, BotMessageSquare, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { RowSelectionState } from '@tanstack/react-table';

const ruleFormSchema = (t: (key: string) => string) => z.object({
    id: z.union([z.string(), z.number()]).optional(),
    category_id: z.string().min(1, t('categoryRequired')),
    code: z.string().min(1, t('codeRequired')),
    name: z.string().min(1, t('nameRequired')),
    description: z.string().optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
    source_table: z.string().min(1, t('sourceTableRequired')),
    table_id_field: z.string().min(1, t('tableIdFieldRequired')),
    user_id_field: z.string().optional(),
    days_before: z.coerce.number().int().default(0),
    days_after: z.coerce.number().int().default(0),
    recurrence_type: z.enum(['ONCE', 'DAILY', 'WEEKLY', 'MONTHLY']).optional(),
    auto_send_email: z.boolean().default(false),
    auto_send_sms: z.boolean().default(false),
    email_template_id: z.coerce.number().int().optional(),
    sms_template_id: z.coerce.number().int().optional(),
    whatsapp_template_id: z.coerce.number().int().optional(),
    is_active: z.boolean().default(true),
});

type RuleFormValues = z.infer<ReturnType<typeof ruleFormSchema>>;

/** n8n answers some failures with a 2xx body carrying the error. */
function throwIfBackendError(response: any, fallback: string) {
    const first = Array.isArray(response) ? response[0] : response;
    if (first?.error || (first?.code && Number(first.code) >= 400)) {
        throw new Error(first?.message || (typeof first?.error === 'string' ? first.error : '') || fallback);
    }
}

async function getRules(signal?: AbortSignal): Promise<{ data: AlertRule[], total: number, page: number, limit: number }> {
    try {
        const response = await api.get(API_ROUTES.SYSTEM.ALERT_RULES, { search: '', page: '1', limit: '100', is_active: 'true' }, undefined, { signal });
        const filteredData = Array.isArray(response) ? response.filter(item => Object.keys(item).length > 0) : [];
        return {
            data: filteredData,
            total: filteredData.length,
            page: 1,
            limit: 100
        };
    } catch (error) {
        console.error('Error fetching rules:', error);
        // Rethrown: a failed load must show an error, not "no rules".
        throw error;
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

async function getWhatsAppTemplates(): Promise<any[]> {
    try {
        const response = await api.get(API_ROUTES.SYSTEM.COMMUNICATION_TEMPLATES, { search: '', page: '1', limit: '1000', is_active: 'true', type: 'whatsapp' });
        return Array.isArray(response) ? response.filter((item: any) => Object.keys(item).length > 0) : (response.data || []);
    } catch (error) {
        console.error('Error fetching WhatsApp templates:', error);
        return [];
    }
}

export default function AlertRulesPage() {
    const t = useTranslations('AlertRulesPage');
    const tValidation = useTranslations('AlertRulesPage.validation');
    const tCommon = useTranslations('Common');
    const { toast } = useToast();
    const { hasPermission } = usePermissions();

    const canViewList = hasPermission(SYSTEM_PERMISSIONS.ALERT_RULES_VIEW_LIST);
    const canCreate = hasPermission(SYSTEM_PERMISSIONS.ALERT_RULES_CREATE);
    const canUpdate = hasPermission(SYSTEM_PERMISSIONS.ALERT_RULES_UPDATE);
    const canDelete = hasPermission(SYSTEM_PERMISSIONS.ALERT_RULES_DELETE);
    const isNarrow = useViewportNarrow();

    const [selectedTable, setSelectedTable] = React.useState<string>('');
    const [conditions, setConditions] = React.useState<Array<{ id: string, column: string, operator: string, value: string, logic?: 'AND' | 'OR' }>>([]);
    const [displayFields, setDisplayFields] = React.useState<Array<{ id: string, label: string, source_column: string, type: string }>>([]);
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingRule, setEditingRule] = React.useState<AlertRule | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
    const [deletingRule, setDeletingRule] = React.useState<AlertRule | null>(null);
    const [submissionError, setSubmissionError] = React.useState<string | null>(null);
    const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
    const [selectedRule, setSelectedRule] = React.useState<AlertRule | null>(null);

    const form = useForm<RuleFormValues>({
        resolver: zodResolver(ruleFormSchema(tValidation)),
    });

    const {
        data: { rules, categories, tablesAndColumns, emailTemplates, smsTemplates, whatsappTemplates },
        isLoading,
        isRefreshing,
        error: loadError,
        reload: loadData,
    } = useDataLoader(
        async (signal) => {
            const [fetchedRules, fetchedCategories, fetchedTables, fetchedEmailTemplates, fetchedSmsTemplates, fetchedWhatsappTemplates] = await Promise.all([
                getRules(signal),
                getCategories(),
                getTablesAndColumns(),
                getEmailTemplates(),
                getSmsTemplates(),
                getWhatsAppTemplates()
            ]);
            const mappedRules = fetchedRules.data.map(rule => ({
                ...rule,
                table_id_field: (rule as any).condition_config?.table_id_field?.name || '',
                user_id_field: (rule as any).condition_config?.user_id_field || null,
            }));
            return {
                rules: mappedRules as AlertRule[],
                categories: fetchedCategories.data as AlertCategory[],
                tablesAndColumns: fetchedTables,
                emailTemplates: fetchedEmailTemplates,
                smsTemplates: fetchedSmsTemplates,
                whatsappTemplates: fetchedWhatsappTemplates,
            };
        },
        {
            rules: [] as AlertRule[],
            categories: [] as AlertCategory[],
            tablesAndColumns: {} as Record<string, { name: string, type: string, is_nullable: string }[]>,
            emailTemplates: [] as any[],
            smsTemplates: [] as any[],
            whatsappTemplates: [] as any[],
        },
        [],
        { enabled: canViewList }
    );

    const getColumnType = (columnName: string): string | undefined => {
        const tableCols = tablesAndColumns[selectedTable] || [];
        const col = tableCols.find(c => c.name === columnName);
        return col?.type;
    };

    const validateTableIdField = React.useCallback((tableIdField: string, tableName: string): boolean => {
        const tableCols = tablesAndColumns[tableName] || [];
        return tableCols.some(col => col.name === tableIdField);
    }, [tablesAndColumns]);

    const validateUserIdField = React.useCallback((userIdField: string, tableName: string): boolean => {
        const tableCols = tablesAndColumns[tableName] || [];
        return tableCols.some(col => col.name === userIdField);
    }, [tablesAndColumns]);

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
                return colName.includes('user_id') || 
                       colName.includes('patient_id') || 
                       colName.includes('paciente_id') || 
                       colName.includes('doctor_id') || 
                       colName.includes('profesional_id') || 
                       colName.includes('customer_id') || 
                       colName.includes('client_id');
            })
            .map(col => {
                const colName = col.name.toLowerCase();
                let priority = 3;
                if (colName.includes('user_id') || colName.includes('paciente_id')) {
                    priority = 1;
                } else if (colName.includes('patient_id') || colName.includes('doctor_id') || colName.includes('profesional_id')) {
                    priority = 2;
                }
                return { name: col.name, type: col.type, priority };
            })
            .sort((a, b) => a.priority - b.priority);
    };

    const getAvailableOperators = (columnName: string): string[] => {
        const type = getColumnType(columnName);
        if (!type) return ['=', '!=', 'IS NULL', 'IS NOT NULL'];
        const lowerType = type.toLowerCase();
        const baseOperators = ['=', '!=', 'IS NULL', 'IS NOT NULL'];
        if (lowerType.includes('varchar') || lowerType.includes('text') || lowerType.includes('char')) {
            return [...baseOperators, 'LIKE', 'NOT LIKE'];
        } else if (
            lowerType.includes('int') || lowerType.includes('decimal') ||
            lowerType.includes('numeric') || lowerType.includes('float') || lowerType.includes('double')
        ) {
            return [...baseOperators, '>', '<', '>=', '<='];
        } else if (lowerType.includes('date') || lowerType.includes('time')) {
            return [...baseOperators, '>', '<', '>=', '<=', 'BETWEEN'];
        }
        return baseOperators;
    };


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
    }, [selectedTable, form, validateTableIdField, validateUserIdField]);

    const handleCreate = () => {
        setEditingRule(null);
        setSelectedTable('');
        setConditions([]);
        setDisplayFields([]);
        form.reset({ code: '', name: '', description: '', is_active: true, priority: 'MEDIUM', source_table: '', table_id_field: '', user_id_field: '', recurrence_type: undefined, email_template_id: undefined, sms_template_id: undefined, whatsapp_template_id: undefined, days_before: 0, days_after: 0 });
        setSubmissionError(null);
        setIsDialogOpen(true);
    };

    const handleEdit = (rule: AlertRule) => {
        setSelectedRule(rule);
        // Row ids are entity ids (DataTable default), so select by rule.id.
        setRowSelection({ [String(rule.id)]: true });
        setEditingRule(rule);
        setSelectedTable(rule.source_table || '');
        const conds = (rule as any).condition_config?.conditions || [];
        setConditions(conds.map((c: any, i: number) => ({ id: `cond-${i}`, ...(i > 0 ? { logic: c.logic || 'AND' } : {}), ...c })));
        const dispConfig = (rule as any).ui_display_config;
        let dispFields: any[] = [];
        if (Array.isArray(dispConfig)) {
            dispFields = dispConfig;
        } else if (dispConfig?.fields && Array.isArray(dispConfig.fields)) {
            dispFields = dispConfig.fields;
        }
        setDisplayFields(dispFields.map((f: any, i: number) => ({ id: `field-${i}`, ...f })));
        form.reset({
            ...rule,
            category_id: String(rule.category_id || ''),
            table_id_field: (rule as any).table_id_field || '',
            days_before: rule.days_before ?? 0,
            days_after: rule.days_after ?? 0,
            email_template_id: rule.email_template_id ? parseInt(rule.email_template_id) : undefined,
            sms_template_id: rule.sms_template_id ? parseInt(rule.sms_template_id) : undefined,
            whatsapp_template_id: rule.whatsapp_template_id ? parseInt(rule.whatsapp_template_id) : undefined,
            user_id_field: (rule as any).user_id_field || '',
        });
        setSubmissionError(null);
        setIsDialogOpen(true);
    };

    const handleDuplicate = (rule: AlertRule) => {
        setEditingRule(null);
        setSelectedTable(rule.source_table || '');
        const conds = (rule as any).condition_config?.conditions || [];
        const dispConfig = (rule as any).ui_display_config;
        let dispFields: any[] = [];
        if (Array.isArray(dispConfig)) {
            dispFields = dispConfig;
        } else if (dispConfig?.fields && Array.isArray(dispConfig.fields)) {
            dispFields = dispConfig.fields;
        }
        setDisplayFields(dispFields.map((f: any, i: number) => ({ id: `field-${i}`, ...f })));
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
            whatsapp_template_id: rule.whatsapp_template_id ? parseInt(rule.whatsapp_template_id) : undefined,
            user_id_field: (rule as any).user_id_field || '',
        });
        setSubmissionError(null);
        setIsDialogOpen(true);
    };

    const remove = useAsyncAction(
        async (rule: AlertRule) => {
            const response = await api.delete(API_ROUTES.SYSTEM.ALERT_RULES, { id: rule.id }, undefined, undefined, { timeoutMs: REQUEST_TIMEOUT_MS.mutation });
            throwIfBackendError(response, t('toast.deleteErrorDescription'));
            return rule;
        },
        {
            onSuccess: async (rule) => {
                toast({ title: t('toast.deleteSuccessTitle'), description: t('toast.deleteSuccessDescription', { name: rule.name }) });
                setIsDeleteDialogOpen(false);
                setDeletingRule(null);
                if (selectedRule && String(selectedRule.id) === String(rule.id)) {
                    setSelectedRule(null);
                    setRowSelection({});
                }
                await loadData();
            },
            onError: (error) => { if (isTimeoutError(error)) loadData(); },
            errorTitle: t('toast.deleteErrorDescription'),
        }
    );

    // Per rule: testing one rule doesn't block testing another, but the same one can't run twice at once.
    const testRule = useKeyedAsyncAction(
        async (rule: AlertRule) => {
            const response = await api.post(API_ROUTES.SYSTEM.ALERT_RULES_TEST, { id: rule.id }, undefined, undefined, { timeoutMs: REQUEST_TIMEOUT_MS.longRunning });
            throwIfBackendError(response, t('toast.testErrorDescription'));
            return rule;
        },
        {
            onSuccess: (rule) => {
                toast({ title: t('toast.testSuccessTitle'), description: t('toast.testSuccessDescription', { name: rule.name }) });
            },
            errorTitle: t('toast.testErrorDescription'),
        }
    );
    const handleTest = (rule: AlertRule) => { testRule.run(String(rule.id), rule); };

    const save = useAsyncAction(
        async (values: RuleFormValues) => {
            setSubmissionError(null);
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
                display_config: {
                    fields: displayFields.map(({ id, ...rest }) => rest)
                },
                created_by: 1,
                email_template_id: values.email_template_id ?? null,
                sms_template_id: values.sms_template_id ?? null,
                whatsapp_template_id: values.whatsapp_template_id ?? null,
            };
            if (editingRule) {
                (data as any).id = parseInt(editingRule.id);
            }
            const response = await api.post(API_ROUTES.SYSTEM.ALERT_RULES, data, undefined, undefined, { timeoutMs: REQUEST_TIMEOUT_MS.mutation });
            throwIfBackendError(response, t('toast.errorTitle'));
            return { values, isEdit: !!editingRule };
        },
        {
            onSuccess: async ({ values, isEdit }) => {
                toast({ title: isEdit ? t('toast.editSuccessTitle') : t('toast.createSuccessTitle'), description: t('toast.successDescription', { name: values.name }) });
                await loadData();
                setIsDialogOpen(false);
            },
            onError: (error) => {
                if (isTimeoutError(error)) {
                    // The rule may have been saved anyway: refresh so the user can check before retrying.
                    setSubmissionError(tCommon('timeoutError'));
                    loadData();
                    return;
                }
                setSubmissionError(getErrorMessage(error) || tCommon('genericError'));
            },
            showErrorToast: false,
        }
    );

    React.useEffect(() => {
        if (selectedRule) {
            const updated = rules.find(r => String(r.id) === String(selectedRule.id));
            if (updated) setSelectedRule(updated);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rules]);

    const handleRowSelection = (rows: AlertRule[]) => {
        setSelectedRule(rows[0] ?? null);
        setSubmissionError(null);
    };

    const handleBack = () => {
        setSelectedRule(null);
        setRowSelection({});
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
                    // The menu is portaled but still a React child of the row: without this, clicks on
                    // the trigger or its items bubble up and also toggle the row selection.
                    <div onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0" aria-busy={testRule.isPending(String(rule.id)) || undefined}>
                                <span className="sr-only">{t('columns.actions')}</span>
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>{t('columns.actions')}</DropdownMenuLabel>
                            {canUpdate && <DropdownMenuItem onClick={() => handleEdit(rule)}>{t('columns.edit')}</DropdownMenuItem>}
                            {canCreate && <DropdownMenuItem onClick={() => handleDuplicate(rule)}>{t('columns.duplicate')}</DropdownMenuItem>}
                            {canUpdate && <DropdownMenuItem onClick={() => handleTest(rule)} disabled={testRule.isPending(String(rule.id))}>{t('columns.test')}</DropdownMenuItem>}
                            {canDelete && <DropdownMenuItem onClick={() => { setDeletingRule(rule); setIsDeleteDialogOpen(true); }} className="text-destructive">{t('columns.delete')}</DropdownMenuItem>}
                        </DropdownMenuContent>
                    </DropdownMenu>
                    </div>
                );
            },
        },
    ];

    const leftPanel = (
        <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm">
            <CardHeader className="p-4">
                <div className="flex items-start gap-3">
                    <div className="header-icon-circle mt-0.5"><BotMessageSquare className="h-5 w-5" /></div>
                    <div className="flex flex-col text-left">
                        <CardTitle className="text-lg">{t('title')}</CardTitle>
                        <CardDescription className="text-xs">{t('description')}</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden p-4 bg-card">
                {canViewList ? (
                    <DataTable
                        columns={columns}
                        data={rules}
                        filterColumnId="name"
                        filterPlaceholder={t('filterPlaceholder')}
                        onCreate={canCreate ? handleCreate : undefined}
                        onRefresh={loadData}
                        isRefreshing={isRefreshing}
                        isLoading={isLoading}
                        loadError={loadError}
                        isNarrow={isNarrow || !!selectedRule}
                        renderCard={(row: AlertRule, _isSelected: boolean) => (
                            <DataCard isSelected={_isSelected}
                                title={row.name}
                                subtitle={row.code}
                                badge={<span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${row.priority === 'CRITICAL' ? 'bg-red-100 text-red-700' : row.priority === 'HIGH' ? 'bg-orange-100 text-orange-700' : row.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-500'}`}>{row.priority}</span>}
                                showArrow
                            />
                        )}
                        enableSingleRowSelection
                        rowSelection={rowSelection}
                        setRowSelection={setRowSelection}
                        onRowSelectionChange={handleRowSelection}
                    />
                ) : (
                    <div className="flex items-center justify-center h-full">
                        <p className="text-muted-foreground">{t('noAccess')}</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );

    const rightPanel = selectedRule ? (
        <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm">
            <CardHeader className="flex-none p-4 pb-2 space-y-0">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="header-icon-circle flex-none"><BotMessageSquare className="h-5 w-5" /></div>
                    <div className="min-w-0 flex-1">
                        <CardTitle className="text-base lg:text-lg truncate">{selectedRule?.name}</CardTitle>
                        <p className="text-xs text-muted-foreground truncate">{selectedRule?.code}</p>
                    </div>
                    {selectedRule && (
                        <div className="flex gap-1 flex-none">
                            {canUpdate && (
                                <Button size="sm" variant="outline" onClick={() => handleEdit(selectedRule)}>
                                    <Pencil className="h-4 w-4 mr-1" />{t('columns.edit')}
                                </Button>
                            )}
                            {canDelete && (
                                <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" aria-label={t('columns.delete')} onClick={() => { setDeletingRule(selectedRule); setIsDeleteDialogOpen(true); }}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            </CardHeader>
            <Separator />
            <CardContent className="flex-1 overflow-auto p-4">
                <dl className="space-y-3 text-sm">
                    <div>
                        <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">{t('columns.name')}</dt>
                        <dd className="text-foreground">{selectedRule!.name}</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">Código</dt>
                        <dd className="text-foreground font-mono text-xs">{selectedRule!.code}</dd>
                    </div>
                    {selectedRule!.description && (
                        <div>
                            <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">Descripción</dt>
                            <dd className="text-foreground text-xs">{selectedRule!.description}</dd>
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">{t('columns.priority')}</dt>
                            <dd><Badge variant={selectedRule!.priority === 'CRITICAL' ? 'destructive' : 'secondary'}>{selectedRule!.priority}</Badge></dd>
                        </div>
                        <div>
                            <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">{t('columns.isActive')}</dt>
                            <dd><Badge variant={selectedRule!.is_active ? 'success' : 'outline'}>{selectedRule!.is_active ? t('columns.yes') : t('columns.no')}</Badge></dd>
                        </div>
                    </div>
                    <div>
                        <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">{t('columns.category')}</dt>
                        <dd className="text-foreground">{categories.find(c => String(c.id) === String(selectedRule!.category_id))?.name || selectedRule!.category_id}</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">Tabla fuente</dt>
                        <dd className="text-foreground font-mono text-xs">{selectedRule!.source_table || '-'}</dd>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">{t('columns.autoEmail')}</dt>
                            <dd><Badge variant={selectedRule!.auto_send_email ? 'success' : 'outline'}>{selectedRule!.auto_send_email ? t('columns.yes') : t('columns.no')}</Badge></dd>
                        </div>
                        <div>
                            <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">{t('columns.autoSms')}</dt>
                            <dd><Badge variant={selectedRule!.auto_send_sms ? 'success' : 'outline'}>{selectedRule!.auto_send_sms ? t('columns.yes') : t('columns.no')}</Badge></dd>
                        </div>
                    </div>
                </dl>
            </CardContent>
        </Card>
    ) : <div />;

    return (
        <>
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <TwoPanelLayout
                    leftPanel={leftPanel}
                    rightPanel={rightPanel}
                    isRightPanelOpen={!!selectedRule}
                    onBack={handleBack}
                    leftPanelDefaultSize={50}
                    rightPanelDefaultSize={50}
                />
            </div>

            <Dialog
                open={isDialogOpen}
                onOpenChange={(open) => {
                    if (!open && save.isPending) return;
                    setIsDialogOpen(open);
                    if (!open) setSubmissionError(null);
                }}
            >
                <DialogContent maxWidth="6xl" className="flex max-h-[90vh] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] flex-col p-0" confirmOnClose isDirty={form.formState.isDirty && !save.isPending}>
                    <DialogHeader>
                        <DialogTitle>{editingRule ? t('dialog.editTitle') : t('dialog.createTitle')}</DialogTitle>
                    </DialogHeader>
                    <Form {...form}>
                        <form id="alert-rule-form" onSubmit={form.handleSubmit(save.run)} className="flex-1 overflow-y-auto space-y-5 px-4 py-4 sm:px-6">
                            {/* Native fieldset disables every control while the request is in flight */}
                            <fieldset disabled={save.isPending} className="min-w-0 space-y-5">
                            {submissionError && (
                                <Alert variant="destructive">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertTitle>{t('toast.errorTitle')}</AlertTitle>
                                    <AlertDescription>{submissionError}</AlertDescription>
                                </Alert>
                            )}

                            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
                            </div>

                            <FormField
                                control={form.control}
                                name="description"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('dialog.description')}</FormLabel>
                                        <FormControl>
                                            <Textarea {...field} className="min-h-24" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                <FormField
                                    control={form.control}
                                    name="source_table"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('dialog.sourceTable')}</FormLabel>
                                            <Select
                                                onValueChange={(val) => {
                                                    field.onChange(val);
                                                    setSelectedTable(val);
                                                }}
                                                value={field.value}
                                            >
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder={t('dialog.selectSourceTable')} />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {Object.keys(tablesAndColumns).map(table => (
                                                        <SelectItem key={table} value={table}>{table}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

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

                            <div className="space-y-4">
                                <div className="flex items-center justify-between gap-3">
                                    <Label>{t('dialog.conditions')}</Label>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setConditions([...conditions, { id: `cond-${Date.now()}`, column: '', operator: '=', value: '', ...(conditions.length > 0 ? { logic: 'AND' } : {}) }])}
                                    >
                                        Add Condition
                                    </Button>
                                </div>
                                {conditions.map((cond, index) => (
                                    <div key={cond.id} className="flex min-w-0 flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center">
                                        {index > 0 && (
                                            <Select
                                                value={cond.logic}
                                                onValueChange={(val: any) => {
                                                    const newConds = [...conditions];
                                                    newConds[index].logic = val;
                                                    setConditions(newConds);
                                                }}
                                            >
                                                <SelectTrigger className="w-full sm:w-16"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="AND">AND</SelectItem>
                                                    <SelectItem value="OR">OR</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        )}
                                        <Select
                                            value={cond.column}
                                            onValueChange={(val) => {
                                                const newConds = [...conditions];
                                                newConds[index].column = val;
                                                setConditions(newConds);
                                            }}
                                        >
                                            <SelectTrigger className="w-full min-w-0 sm:flex-1"><SelectValue placeholder="Column" /></SelectTrigger>
                                            <SelectContent>
                                                {(tablesAndColumns[selectedTable] || []).map(col => (
                                                    <SelectItem key={col.name} value={col.name}>{col.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Select
                                            value={cond.operator}
                                            onValueChange={(val) => {
                                                const newConds = [...conditions];
                                                newConds[index].operator = val;
                                                setConditions(newConds);
                                            }}
                                        >
                                            <SelectTrigger className="w-full sm:w-24"><SelectValue placeholder="Op" /></SelectTrigger>
                                            <SelectContent>
                                                {getAvailableOperators(cond.column).map(op => (
                                                    <SelectItem key={op} value={op}>{op}</SelectItem>
                                                ))}
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
                                            className="w-full min-w-0 sm:flex-1"
                                        />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="self-end sm:self-auto"
                                            onClick={() => setConditions(conditions.filter((_, i) => i !== index))}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between gap-3">
                                    <Label>{t('dialog.displayFields')}</Label>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setDisplayFields([...displayFields, { id: `field-${Date.now()}`, label: '', source_column: '', type: 'text' }])}
                                    >
                                        {t('dialog.addDisplayField')}
                                    </Button>
                                </div>
                                {displayFields.map((field, index) => {
                                    const columnType = tablesAndColumns[selectedTable]?.find(c => c.name === field.source_column)?.type || '';
                                    return (
                                    <div key={field.id} className="flex min-w-0 flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center">
                                        <Input
                                            placeholder={t('dialog.fieldLabel')}
                                            value={field.label}
                                            onChange={(e) => {
                                                const newFields = [...displayFields];
                                                newFields[index].label = e.target.value;
                                                setDisplayFields(newFields);
                                            }}
                                            className="w-full min-w-0 sm:flex-1"
                                        />
                                        <Select
                                            value={field.source_column}
                                            onValueChange={(val) => {
                                                const newFields = [...displayFields];
                                                newFields[index].source_column = val;
                                                newFields[index].type = getColumnType(val) || 'text';
                                                setDisplayFields(newFields);
                                            }}
                                        >
                                            <SelectTrigger className="w-full min-w-0 sm:flex-1">
                                                <SelectValue placeholder={t('dialog.selectFieldColumn')} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {(tablesAndColumns[selectedTable] || []).map(col => (
                                                    <SelectItem key={col.name} value={col.name}>{col.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <div className="w-full rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground sm:w-28">
                                            {columnType || '-'}
                                        </div>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="self-end sm:self-auto"
                                            onClick={() => setDisplayFields(displayFields.filter((_, i) => i !== index))}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    );
                                })}
                            </div>

                            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
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
                                <FormField
                                    control={form.control}
                                    name="whatsapp_template_id"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('dialog.whatsappTemplate')}</FormLabel>
                                            <Select onValueChange={(val) => field.onChange(val ? parseInt(val) : undefined)} value={field.value?.toString()}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder={t('dialog.selectWhatsappTemplate')} />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {whatsappTemplates.map(tmp => <SelectItem key={tmp.id} value={tmp.id.toString()}>{tmp.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-4">
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
                            </fieldset>
                        </form>
                    </Form>
                    <DialogFooter className="border-t px-4 py-3 sm:px-6">
                        <Button type="submit" form="alert-rule-form" className="w-full sm:w-auto" loading={save.isPending}>{editingRule ? t('dialog.save') : t('dialog.create')}</Button>
                        <DialogCancelButton className="w-full sm:w-auto" disabled={save.isPending}>{t('dialog.cancel')}</DialogCancelButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ConfirmActionDialog
                open={isDeleteDialogOpen}
                onOpenChange={setIsDeleteDialogOpen}
                title={t('deleteDialog.title')}
                description={t('deleteDialog.description', { name: deletingRule?.name })}
                cancelLabel={t('deleteDialog.cancel')}
                confirmLabel={remove.isPending ? t('deleteDialog.deleting') : t('deleteDialog.confirm')}
                onConfirm={() => { if (deletingRule) remove.run(deletingRule); }}
                isPending={remove.isPending}
            />
        </>
    );
}
