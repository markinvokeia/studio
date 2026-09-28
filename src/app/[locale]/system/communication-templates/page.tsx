
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { SYSTEM_PERMISSIONS } from '@/constants/permissions';
import { API_ROUTES } from '@/constants/routes';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useDataLoader } from '@/hooks/use-data-loader';
import { useDebounce } from '@/hooks/use-debounce';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { getErrorMessage } from '@/lib/error-utils';
import { AlertCategory, CommunicationTemplate } from '@/lib/types';
import { DataCard } from '@/components/ui/data-card';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';
import api, { isTimeoutError, REQUEST_TIMEOUT_MS } from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { Separator } from '@/components/ui/separator';
import { TwoPanelLayout } from '@/components/layout/two-panel-layout';
import { ColumnDef, ColumnFiltersState, PaginationState, RowSelectionState } from '@tanstack/react-table';
import { AlertTriangle, Bold, BookCopy, CheckCircle2, Code2, Copy, Eye, HelpCircle, Italic, List, Loader2, MoreHorizontal, Pencil, Search, Trash2, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

const templateFormSchema = (t: (key: string) => string) => z.object({
    id: z.union([z.string(), z.number()]).nullish(),
    code: z.string().min(1, t('validation.codeRequired')),
    name: z.string().min(1, t('validation.nameRequired')),
    type: z.enum(['EMAIL', 'SMS', 'DOCUMENT', 'WHATSAPP']),
    category_id: z.coerce.number().nullish(),
    subject: z.string().nullish(),
    body_html: z.string().nullish(),
    body_text: z.string().nullish(),
    variables_schema: z.any().nullish(),
    provider_language: z.string().nullish(),
    entity_type: z.enum(['patient', 'appointment', 'invoice']).nullish(),
    default_sender: z.string().nullish(),
    attachments_config: z.any().nullish(),
    is_active: z.boolean().default(true),
    version: z.coerce.number().nullish(),
    created_at: z.string().nullish(),
    updated_at: z.string().nullish(),
});

// entity_type -> resolver field keys the n8n send flow can populate (docs/whatsapp-templates-alerts-design.md).
// Growing this list requires adding the matching resolution logic server-side; it's not just frontend config.
const WHATSAPP_ENTITY_FIELD_KEYS: Record<'patient' | 'appointment' | 'invoice', string[]> = {
    patient: ['patient.name', 'clinic.name'],
    appointment: ['patient.name', 'clinic.name', 'appointment.date', 'appointment.hour', 'appointment.professional_name'],
    invoice: ['patient.name', 'clinic.name', 'invoice.doc_no', 'invoice.amount_formatted', 'invoice.due_date_formatted'],
};

// Resolver field key (dotted, used in variables_schema) -> i18n key under dialog.whatsapp.fieldLabels.
// next-intl treats "." in message keys as nesting, so the translation keys can't contain the dot themselves.
const WHATSAPP_FIELD_LABEL_KEYS: Record<string, string> = {
    'patient.name': 'patientName',
    'clinic.name': 'clinicName',
    'appointment.date': 'appointmentDate',
    'appointment.hour': 'appointmentHour',
    'appointment.professional_name': 'appointmentProfessionalName',
    'invoice.doc_no': 'invoiceDocNo',
    'invoice.amount_formatted': 'invoiceAmount',
    'invoice.due_date_formatted': 'invoiceDueDate',
};

async function fetchYCloudTemplates(): Promise<any[]> {
    try {
        const response = await api.get(API_ROUTES.WHATSAPP_TEMPLATES);
        if (Array.isArray(response)) return response;
        return response?.data || response?.templates || [];
    } catch (error) {
        console.error('Failed to fetch YCloud templates:', error);
        return [];
    }
}

type TemplateFormValues = z.infer<ReturnType<typeof templateFormSchema>>;

/** n8n answers some failures with a 2xx body carrying the error. */
function throwIfBackendError(response: any, fallback: string) {
    const first = Array.isArray(response) ? response[0] : response;
    if (first?.error && typeof first.error === 'string') throw new Error(first?.message || first.error || fallback);
    if (first?.code && Number(first.code) >= 400) throw new Error(first?.message || fallback);
}

const upsertTemplate = async (data: any) => {
    try {
        const response = await api.post(API_ROUTES.SYSTEM.COMMUNICATION_TEMPLATES, data, undefined, undefined, { timeoutMs: REQUEST_TIMEOUT_MS.mutation });
        throwIfBackendError(response, 'Failed to save template');
        return response;
    }
    catch (error) {
        console.error('Failed to upsert communication template', error);
        throw error;
    }
};

const deleteTemplate = async (id: string) => {
    try {
        const response = await api.delete(API_ROUTES.SYSTEM.COMMUNICATION_TEMPLATES, { id }, undefined, undefined, { timeoutMs: REQUEST_TIMEOUT_MS.mutation });
        throwIfBackendError(response, 'Failed to delete template');
        return response;
    }
    catch (error) {
        console.error('Failed to delete communication template', error);
        throw error;
    }
};


async function getTemplates(params: { search?: string; is_active?: boolean; page?: number; limit?: number } = {}, signal?: AbortSignal): Promise<{ data: CommunicationTemplate[]; total: number; page: number; limit: number }> {
    try {
        const query: Record<string, string> = {};
        if (params.search) query.search = params.search;
        if (params.is_active !== undefined) query.is_active = params.is_active.toString();
        if (params.page) query.page = params.page.toString();
        if (params.limit) query.limit = params.limit.toString();
        const response = await api.get(API_ROUTES.SYSTEM.COMMUNICATION_TEMPLATES, query, undefined, { signal });
        const rows = Array.isArray(response) ? response : [];
        return {
            data: rows,
            total: rows.length,
            page: params.page || 1,
            limit: params.limit || 10
        };
    } catch (error) {
        console.error('Failed to fetch templates:', error);
        throw error;
    }
};

async function getCategories(params: { search?: string; is_active?: boolean; page?: number; limit?: number } = {}, signal?: AbortSignal): Promise<{ data: AlertCategory[]; total: number; page: number; limit: number }> {
    try {
        const query: Record<string, string> = {};
        if (params.search) query.search = params.search;
        if (params.is_active !== undefined) query.is_active = params.is_active.toString();
        if (params.page) query.page = params.page.toString();
        if (params.limit) query.limit = params.limit.toString();
        const response = await api.get(API_ROUTES.SYSTEM.ALERT_CATEGORIES, query, undefined, { signal });
        const rows = Array.isArray(response) ? response : [];
        return {
            data: rows,
            total: rows.length,
            page: params.page || 1,
            limit: params.limit || 10
        };
    } catch (error) {
        console.error('Failed to fetch categories:', error);
        throw error;
    }
};

const getAvailableVariables = (t: (key: string) => string) => ({
    'patient': {
        'full_name': { label: t('dialog.variables.fields.full_name'), value: 'full_name' },
        'email': { label: t('dialog.variables.fields.email'), value: 'email' },
        'phone': { label: t('dialog.variables.fields.phone'), value: 'phone' },
        'document_id': { label: t('dialog.variables.fields.document_id'), value: 'document_id' },
    },
    'clinic': {
        'name': { label: t('dialog.variables.fields.name'), value: 'name' },
        'address': { label: t('dialog.variables.fields.address'), value: 'address' },
        'phone': { label: t('dialog.variables.fields.phone'), value: 'phone' },
        'email': { label: t('dialog.variables.fields.email'), value: 'email' },
    },
    'data': {
        'custom_field': { label: t('dialog.variables.fields.custom_field'), value: 'custom_field' },
    },
});

export default function CommunicationTemplatesPage() {
    const t = useTranslations('CommunicationTemplatesPage');
    const tCommon = useTranslations('Common');
    const { toast } = useToast();
    const { hasPermission } = usePermissions();

    const canViewList = hasPermission(SYSTEM_PERMISSIONS.ALERT_TEMPLATES_VIEW_LIST);
    const canCreate = hasPermission(SYSTEM_PERMISSIONS.ALERT_TEMPLATES_CREATE);
    const canUpdate = hasPermission(SYSTEM_PERMISSIONS.ALERT_TEMPLATES_UPDATE);
    const canDelete = hasPermission(SYSTEM_PERMISSIONS.ALERT_TEMPLATES_DELETE);
    const isNarrow = useViewportNarrow();
    const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize: 25 });
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

    const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
    const [selectedTemplate, setSelectedTemplate] = React.useState<CommunicationTemplate | null>(null);

    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingTemplate, setEditingTemplate] = React.useState<CommunicationTemplate | null>(null);

    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
    const [deletingTemplate, setDeletingTemplate] = React.useState<CommunicationTemplate | null>(null);

    const [isPreviewDialogOpen, setIsPreviewDialogOpen] = React.useState(false);
    const [previewingTemplate, setPreviewingTemplate] = React.useState<CommunicationTemplate | null>(null);

    const [submissionError, setSubmissionError] = React.useState<string | null>(null);
    const [showPreview, setShowPreview] = React.useState(false);

    const form = useForm<TemplateFormValues>({
        resolver: zodResolver(templateFormSchema(t)),
    });

    const watchedBodyHtml = form.watch('body_html');
    const watchedType = form.watch('type');
    const watchedCode = form.watch('code');
    const watchedProviderLanguage = form.watch('provider_language');
    const watchedEntityType = form.watch('entity_type') as 'patient' | 'appointment' | 'invoice' | undefined;
    const watchedVariablesSchema = (form.watch('variables_schema') || {}) as Record<string, string>;
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    // WhatsApp template search (YCloud) — used to pick the exact Meta-approved template name + language for `code`/`provider_language`.
    const [waAllTemplates, setWaAllTemplates] = React.useState<any[] | null>(null);
    const [waLoadingTemplates, setWaLoadingTemplates] = React.useState(false);
    const [waSearchQuery, setWaSearchQuery] = React.useState('');
    const [waSelectedTemplate, setWaSelectedTemplate] = React.useState<any | null>(null);

    const ensureWaTemplatesLoaded = React.useCallback(async () => {
        if (waAllTemplates !== null || waLoadingTemplates) return;
        setWaLoadingTemplates(true);
        const list = await fetchYCloudTemplates();
        setWaAllTemplates(list);
        setWaLoadingTemplates(false);
    }, [waAllTemplates, waLoadingTemplates]);

    React.useEffect(() => {
        if (isDialogOpen && watchedType === 'WHATSAPP') ensureWaTemplatesLoaded();
    }, [isDialogOpen, watchedType, ensureWaTemplatesLoaded]);

    // Auto-select the live YCloud match for a template already saved with a code/provider_language (edit flow).
    React.useEffect(() => {
        if (!isDialogOpen || watchedType !== 'WHATSAPP' || !waAllTemplates || waSelectedTemplate || !watchedCode) return;
        const match = waAllTemplates.find(tpl => tpl.name === watchedCode && (!watchedProviderLanguage || tpl.language === watchedProviderLanguage));
        if (match) setWaSelectedTemplate(match);
    }, [isDialogOpen, watchedType, waAllTemplates, waSelectedTemplate, watchedCode, watchedProviderLanguage]);

    const waFilteredResults = React.useMemo(() => {
        if (!waAllTemplates) return [];
        const q = waSearchQuery.trim().toLowerCase();
        const matches = q ? waAllTemplates.filter(tpl => String(tpl.name).toLowerCase().includes(q)) : waAllTemplates;
        return matches.slice(0, 20);
    }, [waAllTemplates, waSearchQuery]);

    const waBodyText = React.useMemo(() => {
        const bodyComponent = Array.isArray(waSelectedTemplate?.components)
            ? waSelectedTemplate.components.find((c: any) => String(c.type).toUpperCase() === 'BODY')
            : null;
        return bodyComponent?.text || '';
    }, [waSelectedTemplate]);

    const handleSelectWaTemplate = (tpl: any) => {
        setWaSelectedTemplate(tpl);
        form.setValue('code', tpl.name, { shouldValidate: true, shouldDirty: true });
        form.setValue('provider_language', tpl.language, { shouldDirty: true });

        const bodyComponent = Array.isArray(tpl.components) ? tpl.components.find((c: any) => String(c.type).toUpperCase() === 'BODY') : null;
        const placeholderNames = new Set<string>();
        if (typeof bodyComponent?.text === 'string') {
            const found = bodyComponent.text.match(/\{\{\s*([^{}]+?)\s*\}\}/g) || [];
            found.forEach((m: string) => placeholderNames.add(m.replace(/[{}]/g, '').trim()));
        }
        const prevSchema = (form.getValues('variables_schema') || {}) as Record<string, string>;
        const nextSchema: Record<string, string> = {};
        placeholderNames.forEach(name => { nextSchema[name] = prevSchema[name] || ''; });
        form.setValue('variables_schema', nextSchema, { shouldDirty: true, shouldValidate: true });
    };

    const handleWaVariableFieldChange = (varName: string, fieldKey: string) => {
        const current = (form.getValues('variables_schema') || {}) as Record<string, string>;
        form.setValue('variables_schema', { ...current, [varName]: fieldKey }, { shouldDirty: true });
    };

    const insertText = (text: string) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const currentText = textarea.value;
        const newText = currentText.substring(0, start) + text + currentText.substring(end);

        form.setValue('body_html', newText, { shouldValidate: true });

        setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = start + text.length;
            textarea.focus();
        }, 0);
    };

    const wrapText = (wrapper: [string, string]) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = textarea.value.substring(start, end);
        const newText = `${textarea.value.substring(0, start)}${wrapper[0]}${selectedText}${wrapper[1]}${textarea.value.substring(end)}`;

        form.setValue('body_html', newText, { shouldValidate: true });

        setTimeout(() => {
            textarea.selectionStart = start + wrapper[0].length;
            textarea.selectionEnd = end + wrapper[0].length;
            textarea.focus();
        }, 0);
    };

    const searchQuery = (columnFilters.find(f => f.id === 'name')?.value as string) || '';
    const debouncedSearch = useDebounce(searchQuery, 500);

    // Only the latest page/search request may write the table; a failed load shows an error.
    const {
        data: { templates, total: templatesTotal },
        isLoading,
        isRefreshing,
        error: loadError,
        reload: loadData,
    } = useDataLoader(
        async (signal) => {
            const templatesResponse = await getTemplates({
                search: debouncedSearch || undefined,
                page: pagination.pageIndex + 1,
                limit: pagination.pageSize
            }, signal);
            return {
                templates: templatesResponse.data.filter(template => Object.keys(template).length > 0),
                total: templatesResponse.total,
            };
        },
        { templates: [] as CommunicationTemplate[], total: 0 },
        [pagination.pageIndex, pagination.pageSize, debouncedSearch],
        { enabled: canViewList }
    );

    // Categories are a lookup for the category column/select: loaded once, not filtered by the
    // template search (that made every category show as "N/A" while searching).
    const { data: categoriesResponse } = useDataLoader(
        (signal) => getCategories({ page: 1, limit: 100 }, signal),
        { data: [] as AlertCategory[], total: 0, page: 1, limit: 100 },
        [],
        { enabled: canViewList }
    );
    const categories = categoriesResponse.data;

    React.useEffect(() => {
        setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    }, [columnFilters]);

    // Keep the detail panel in sync with the refreshed list (e.g. after editing it).
    React.useEffect(() => {
        setSelectedTemplate((current) => (current ? templates.find((tpl) => String(tpl.id) === String(current.id)) ?? current : current));
    }, [templates]);

    const handleRowSelection = (rows: CommunicationTemplate[]) => {
        setSelectedTemplate(rows[0] ?? null);
    };

    const handleCreate = () => {
        setEditingTemplate(null);
        setWaSelectedTemplate(null);
        setWaSearchQuery('');
        form.reset({
            code: '',
            name: '',
            type: 'EMAIL',
            is_active: true,
            subject: '',
            body_html: '',
            body_text: '',
            default_sender: '',
            variables_schema: {},
            provider_language: '',
            entity_type: undefined,
            attachments_config: {},
            version: 1
        });
        setSubmissionError(null);
        setIsDialogOpen(true);
    };

    const handleEdit = (template: CommunicationTemplate) => {
        setEditingTemplate(template);
        setWaSelectedTemplate(null);
        setWaSearchQuery(template.type === 'WHATSAPP' ? template.code : '');
        form.reset({
            ...template,
            version: (template.version || 1) + 1
        });
        setSubmissionError(null);
        setIsDialogOpen(true);
    };

    const handleDelete = (template: CommunicationTemplate) => {
        setDeletingTemplate(template);
        setIsDeleteDialogOpen(true);
    };

    const handleDuplicate = (template: CommunicationTemplate) => {
        setEditingTemplate(null);
        setWaSelectedTemplate(null);
        setWaSearchQuery(template.type === 'WHATSAPP' ? template.code : '');
        form.reset({
            ...template,
            id: undefined,
            code: template.code + '_COPY',
            version: 1,
            name: template.name + ' (Copy)',
        });
        setSubmissionError(null);
        setIsDialogOpen(true);
    };

    const handlePreview = (template: CommunicationTemplate) => {
        setPreviewingTemplate(template);
        setIsPreviewDialogOpen(true);
    };

    const remove = useAsyncAction(
        async (template: CommunicationTemplate) => {
            await deleteTemplate(String(template.id));
            return template;
        },
        {
            onSuccess: async (template) => {
                toast({ title: t('toast.deleteSuccessTitle'), description: t('toast.deleteSuccessDescription', { name: template.name }) });
                setIsDeleteDialogOpen(false);
                setDeletingTemplate(null);
                if (selectedTemplate && String(selectedTemplate.id) === String(template.id)) {
                    setSelectedTemplate(null);
                    setRowSelection({});
                }
                await loadData();
            },
            onError: (error) => { if (isTimeoutError(error)) loadData(); },
            errorTitle: t('toast.errorTitle'),
        }
    );

    const onInvalidSubmit = () => {
        setSubmissionError(t('validation.badRequest'));
    };

    const save = useAsyncAction(
        async (values: TemplateFormValues) => {
            setSubmissionError(null);
            await upsertTemplate(values);
            return values;
        },
        {
            onSuccess: async (values) => {
                toast({ title: values.id ? t('toast.editSuccessTitle') : t('toast.createSuccessTitle'), description: t('toast.successDescription', { name: values.name }) });
                await loadData();
                setIsDialogOpen(false);
            },
            onError: (error: any) => {
                if (isTimeoutError(error)) {
                    // The template may have been saved anyway: refresh so the user can check before retrying.
                    setSubmissionError(tCommon('timeoutError'));
                    loadData();
                    return;
                }
                const errorData = error.data?.error || (Array.isArray(error.data) && error.data[0]?.error);
                if (errorData?.code === 'unique_conflict' && errorData?.conflictedFields) {
                    const fields = errorData.conflictedFields.map((f: string) => t(`validation.uniqueConflictFields.${f}`)).join(', ');
                    setSubmissionError(t('validation.uniqueConflict', { fields }));
                } else if (error.status === 400) {
                    setSubmissionError(t('validation.badRequest'));
                } else if ((error.status === 409) && errorData?.message) {
                    setSubmissionError(errorData.message);
                } else {
                    setSubmissionError(getErrorMessage(error) || tCommon('genericError'));
                }
            },
            showErrorToast: false,
        }
    );

    const columns: ColumnDef<CommunicationTemplate>[] = [
        { accessorKey: 'name', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.name')} /> },
        {
            accessorKey: 'type', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.type')} />,
            cell: ({ row }) => <Badge variant="secondary">{row.original.type}</Badge>
        },
        {
            accessorKey: 'version', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.version')} />,
            cell: ({ row }) => <Badge variant="outline">v{row.original.version || 1}</Badge>
        },
        {
            accessorKey: 'category_id', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.category')} />,
            cell: ({ row }) => categories.find(c => String(c.id) === String(row.original.category_id))?.name || 'N/A'
        },
        {
            accessorKey: 'is_active',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.isActive')} />,
            cell: ({ row }) => <Badge variant={row.original.is_active ? 'success' : 'outline'}>{row.original.is_active ? t('columns.yes') : t('columns.no')}</Badge>
        },
        {
            id: 'actions',
            cell: ({ row }) => {
                const template = row.original;
                return (
                    // The menu is portaled but still a React child of the row: without this, clicks on
                    // the trigger or its items bubble up and also toggle the row selection.
                    <div onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">{t('columns.actions')}</span>
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>{t('columns.actions')}</DropdownMenuLabel>
                            {canUpdate && <><DropdownMenuItem onClick={() => handleEdit(template)}>{t('columns.edit')}</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDuplicate(template)}>{t('columns.duplicate')}</DropdownMenuItem></>}
                            <DropdownMenuItem onClick={() => handlePreview(template)}>{t('columns.preview')}</DropdownMenuItem>
                            {/* <DropdownMenuItem>{t('columns.history')}</DropdownMenuItem> */}
                            <DropdownMenuSeparator />
                            {canDelete && <DropdownMenuItem onClick={() => handleDelete(template)} className="text-destructive">{t('columns.delete')}</DropdownMenuItem>}
                        </DropdownMenuContent>
                    </DropdownMenu>
                    </div>
                );
            },
        },
    ];

    const leftPanel = (
        <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm">
            <CardHeader className="flex-none p-4">
                <div className="flex items-start gap-3">
                    <div className="header-icon-circle mt-0.5"><BookCopy className="h-5 w-5" /></div>
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
                        data={templates}
                        filterColumnId="name"
                        filterPlaceholder={t('filterPlaceholder')}
                        onCreate={canCreate ? handleCreate : undefined}
                        onRefresh={loadData}
                        isRefreshing={isRefreshing}
                        isLoading={isLoading}
                        loadError={loadError}
                        isNarrow={isNarrow || !!selectedTemplate}
                        renderCard={(row: CommunicationTemplate, _isSelected: boolean) => (
                            <DataCard isSelected={_isSelected}
                                title={row.name}
                                subtitle={row.code}
                                badge={<span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700">{row.type}</span>}
                                showArrow
                            />
                        )}
                        pageCount={Math.ceil(templatesTotal / pagination.pageSize)}
                        rowCount={templatesTotal}
                        pagination={pagination}
                        onPaginationChange={setPagination}
                        columnFilters={columnFilters}
                        onColumnFiltersChange={setColumnFilters}
                        manualPagination={true}
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

    const rightPanel = selectedTemplate ? (
        <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm">
            <CardHeader className="flex-none p-4 pb-2 space-y-0">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="header-icon-circle flex-none"><BookCopy className="h-5 w-5" /></div>
                    <div className="min-w-0 flex-1">
                        <CardTitle className="text-base lg:text-lg truncate">{selectedTemplate.name}</CardTitle>
                        <p className="text-xs text-muted-foreground truncate">{selectedTemplate.code}</p>
                    </div>
                    <div className="flex gap-1 flex-none">
                        {canUpdate && (
                            <Button size="sm" variant="outline" onClick={() => handleEdit(selectedTemplate)}>
                                <Pencil className="h-4 w-4 mr-1" />Editar
                            </Button>
                        )}
                        {canDelete && (
                            <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" aria-label={t('columns.delete')} onClick={() => handleDelete(selectedTemplate)}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>
            </CardHeader>
            <Separator />
            <CardContent className="flex-1 overflow-auto p-4">
                <dl className="space-y-3 text-sm">
                    <div>
                        <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">{t('columns.name')}</dt>
                        <dd className="text-foreground">{selectedTemplate.name}</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">Código</dt>
                        <dd className="text-foreground font-mono text-xs">{selectedTemplate.code}</dd>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">{t('columns.type')}</dt>
                            <dd><Badge variant="secondary">{selectedTemplate.type}</Badge></dd>
                        </div>
                        <div>
                            <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">{t('columns.version')}</dt>
                            <dd><Badge variant="outline">v{selectedTemplate.version || 1}</Badge></dd>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">{t('columns.category')}</dt>
                            <dd className="text-foreground">{categories.find(c => String(c.id) === String(selectedTemplate.category_id))?.name || '-'}</dd>
                        </div>
                        <div>
                            <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">{t('columns.isActive')}</dt>
                            <dd><Badge variant={selectedTemplate.is_active ? 'success' : 'outline'}>{selectedTemplate.is_active ? t('columns.yes') : t('columns.no')}</Badge></dd>
                        </div>
                    </div>
                    {selectedTemplate.subject && (
                        <div>
                            <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">Asunto</dt>
                            <dd className="text-foreground text-xs">{selectedTemplate.subject}</dd>
                        </div>
                    )}
                    {selectedTemplate.default_sender && (
                        <div>
                            <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">Remitente</dt>
                            <dd className="text-foreground text-xs">{selectedTemplate.default_sender}</dd>
                        </div>
                    )}
                    {selectedTemplate.body_html && (
                        <div>
                            <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Cuerpo HTML</dt>
                            <dd><pre className="text-xs whitespace-pre-wrap break-all bg-muted/50 rounded p-2 max-h-48 overflow-auto">{selectedTemplate.body_html}</pre></dd>
                        </div>
                    )}
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
                    isRightPanelOpen={!!selectedTemplate}
                    onBack={() => { setSelectedTemplate(null); setRowSelection({}); }}
                    leftPanelDefaultSize={50}
                    rightPanelDefaultSize={50}
                />
            </div>
            <Dialog
                open={isDialogOpen}
                onOpenChange={(open) => {
                    if (!open && save.isPending) return;
                    setIsDialogOpen(open);
                }}
            >
                <DialogContent className="max-w-4xl" confirmOnClose isDirty={form.formState.isDirty && !save.isPending}>
                    <DialogHeader>
                        <DialogTitle>{editingTemplate ? t('dialog.editTitle') : t('dialog.createTitle')}</DialogTitle>
                    </DialogHeader>
                    <Form {...form}>
                        <form id="communication-template-form" onSubmit={form.handleSubmit(save.run, onInvalidSubmit)} className="space-y-4 py-4 px-6 max-h-[70vh] overflow-y-auto">
                            {submissionError && (
                                <Alert variant="destructive">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertTitle>{t('toast.errorTitle')}</AlertTitle>
                                    <AlertDescription>{submissionError}</AlertDescription>
                                </Alert>
                            )}
                            {/* Native fieldset disables every control while the request is in flight */}
                            <fieldset disabled={save.isPending} className="min-w-0 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <FormField control={form.control} name="name" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('dialog.name')}</FormLabel>
                                        <FormControl><Input placeholder={t('dialog.namePlaceholder')} {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="code" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('dialog.code')}</FormLabel>
                                        <FormControl>
                                            <Input
                                                {...field}
                                                readOnly={watchedType === 'WHATSAPP'}
                                                className={watchedType === 'WHATSAPP' ? 'bg-muted font-mono text-xs' : undefined}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="version" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('dialog.version')}</FormLabel>
                                        <FormControl><Input {...field} value={field.value || (editingTemplate ? (editingTemplate.version || 1) + 1 : 1)} readOnly className="bg-muted" /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={form.control} name="type" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('dialog.type')}</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl><SelectTrigger><SelectValue placeholder={t('dialog.selectType')} /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="EMAIL">Email</SelectItem>
                                                <SelectItem value="SMS">SMS</SelectItem>
                                                <SelectItem value="DOCUMENT">Document</SelectItem>
                                                <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="category_id" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('dialog.category')}</FormLabel>
                                        <Select onValueChange={(value) => field.onChange(value ? parseInt(value) : undefined)} value={field.value?.toString()}>
                                            <FormControl><SelectTrigger><SelectValue placeholder={t('dialog.selectCategory')} /></SelectTrigger></FormControl>
                                            <SelectContent>{categories.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </div>
                            <FormField control={form.control} name="subject" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('dialog.subject')}</FormLabel>
                                    <FormControl><Input {...field} value={field.value || ''} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="default_sender" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('dialog.defaultSender')}</FormLabel>
                                    <FormControl><Input {...field} value={field.value || ''} placeholder="sender@example.com" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            {watchedType === 'WHATSAPP' ? (
                                <div className="space-y-4">
                                    <FormField control={form.control} name="entity_type" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('dialog.whatsapp.entityType')}</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value || undefined}>
                                                <FormControl><SelectTrigger><SelectValue placeholder={t('dialog.whatsapp.selectEntityType')} /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    <SelectItem value="patient">{t('dialog.whatsapp.entityTypes.patient')}</SelectItem>
                                                    <SelectItem value="appointment">{t('dialog.whatsapp.entityTypes.appointment')}</SelectItem>
                                                    <SelectItem value="invoice">{t('dialog.whatsapp.entityTypes.invoice')}</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )} />

                                    <div className="space-y-2">
                                        <Label>{t('dialog.whatsapp.searchLabel')}</Label>
                                        <div className="flex items-center gap-2">
                                            <div className="relative flex-1">
                                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    value={waSearchQuery}
                                                    onChange={(e) => setWaSearchQuery(e.target.value)}
                                                    placeholder={t('dialog.whatsapp.searchPlaceholder')}
                                                    className="pl-8"
                                                />
                                            </div>
                                            <Button type="button" variant="outline" size="sm" onClick={ensureWaTemplatesLoaded} disabled={waLoadingTemplates}>
                                                {waLoadingTemplates ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                                <span className="ml-2 hidden sm:inline">{t('dialog.whatsapp.searchButton')}</span>
                                            </Button>
                                        </div>

                                        {waLoadingTemplates ? (
                                            <p className="text-xs text-muted-foreground py-2">{t('dialog.whatsapp.loadingTemplates')}</p>
                                        ) : waAllTemplates && waAllTemplates.length > 0 ? (
                                            waFilteredResults.length === 0 ? (
                                                <p className="text-xs text-muted-foreground py-2">{t('dialog.whatsapp.noResults')}</p>
                                            ) : (
                                                <div className="max-h-40 overflow-y-auto rounded-md border divide-y">
                                                    {waFilteredResults.map((tpl, idx) => {
                                                        const isSelected = waSelectedTemplate?.name === tpl.name && waSelectedTemplate?.language === tpl.language;
                                                        const StatusIcon = tpl.status === 'APPROVED' ? CheckCircle2 : tpl.status === 'REJECTED' ? XCircle : HelpCircle;
                                                        return (
                                                            <button
                                                                type="button"
                                                                key={`${tpl.name}-${tpl.language}-${idx}`}
                                                                onClick={() => handleSelectWaTemplate(tpl)}
                                                                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50 ${isSelected ? 'bg-primary/5' : ''}`}
                                                            >
                                                                <StatusIcon className={`h-4 w-4 flex-none ${tpl.status === 'APPROVED' ? 'text-green-600' : tpl.status === 'REJECTED' ? 'text-destructive' : 'text-muted-foreground'}`} />
                                                                <span className="font-mono flex-1 truncate">{tpl.name}</span>
                                                                <Badge variant="outline" className="flex-none">{tpl.language}</Badge>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )
                                        ) : null}
                                    </div>

                                    {waSelectedTemplate && (
                                        <div className="space-y-3 rounded-md border p-3 bg-muted/30">
                                            <div className="flex items-center justify-between">
                                                <p className="text-sm font-medium">{t('dialog.whatsapp.selectedTemplate')}: <span className="font-mono">{waSelectedTemplate.name}</span></p>
                                                <Badge variant={waSelectedTemplate.status === 'APPROVED' ? 'success' : waSelectedTemplate.status === 'REJECTED' ? 'destructive' : 'outline'}>
                                                    {t(`dialog.whatsapp.status.${waSelectedTemplate.status || 'unknown'}` as any)}
                                                </Badge>
                                            </div>
                                            {waBodyText && (
                                                <div>
                                                    <Label className="text-xs text-muted-foreground">{t('dialog.whatsapp.previewLabel')}</Label>
                                                    <pre className="mt-1 whitespace-pre-wrap text-xs bg-background rounded p-2 border">{waBodyText}</pre>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <Label>{t('dialog.whatsapp.variablesTitle')}</Label>
                                        <p className="text-xs text-muted-foreground">{t('dialog.whatsapp.variablesDescription')}</p>
                                        {Object.keys(watchedVariablesSchema).length === 0 ? (
                                            <p className="text-xs text-muted-foreground py-2">
                                                {waSelectedTemplate ? t('dialog.whatsapp.noVariables') : t('dialog.whatsapp.searchFirst')}
                                            </p>
                                        ) : (
                                            <div className="space-y-2">
                                                {Object.keys(watchedVariablesSchema).map((varName) => (
                                                    <div key={varName} className="flex items-center gap-2">
                                                        <code className="text-xs bg-muted rounded px-2 py-1 flex-none w-32 truncate">{`{{${varName}}}`}</code>
                                                        <Select
                                                            value={watchedVariablesSchema[varName] || undefined}
                                                            onValueChange={(val) => handleWaVariableFieldChange(varName, val)}
                                                            disabled={!watchedEntityType}
                                                        >
                                                            <SelectTrigger className="flex-1"><SelectValue placeholder={t('dialog.whatsapp.selectSourceField')} /></SelectTrigger>
                                                            <SelectContent>
                                                                {(watchedEntityType ? WHATSAPP_ENTITY_FIELD_KEYS[watchedEntityType] : []).map((key) => (
                                                                    <SelectItem key={key} value={key}>{t(`dialog.whatsapp.fieldLabels.${WHATSAPP_FIELD_LABEL_KEYS[key]}` as any)}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <FormLabel>{t('dialog.body')}</FormLabel>
                                        <div className="flex items-center gap-2">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="outline" size="sm"><Code2 className="mr-2 h-4 w-4" /> {t('dialog.variables.title')}</Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent>
                                                    {Object.entries(getAvailableVariables(t)).map(([group, vars]) => (
                                                        <React.Fragment key={group}>
                                                            <DropdownMenuLabel className="capitalize">
                                                                {t(`dialog.variables.${group}`)}
                                                            </DropdownMenuLabel>
                                                            {Object.entries(vars).map(([key, variable]) => (
                                                                <DropdownMenuItem key={key} onSelect={() => insertText(`{{${group}.${variable.value}}}`)}>
                                                                    {variable.label}
                                                                </DropdownMenuItem>
                                                            ))}
                                                            <DropdownMenuSeparator />
                                                        </React.Fragment>
                                                    ))}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                            <div className="flex items-center space-x-1 border rounded-md p-1">
                                                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => wrapText(['<strong>', '</strong>'])}><Bold className="h-4 w-4" /></Button>
                                                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => wrapText(['<em>', '</em>'])}><Italic className="h-4 w-4" /></Button>
                                                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => insertText('<ul>\n  <li>Item 1</li>\n</ul>')}><List className="h-4 w-4" /></Button>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <Switch id="preview-mode" checked={showPreview} onCheckedChange={setShowPreview} />
                                                <Label htmlFor="preview-mode">{t('dialog.preview.title')}</Label>
                                            </div>
                                        </div>
                                    </div>
                                    {showPreview ? (
                                        <div className="h-64 rounded-md border bg-muted p-4 overflow-y-auto" dangerouslySetInnerHTML={{ __html: watchedBodyHtml?.replace(/{{(.*?)}}/g, (match, p1) => `<span class="bg-primary/20 text-primary-foreground rounded px-1">${p1.trim()}</span>`) || '' }} />
                                    ) : (
                                        <FormField control={form.control} name="body_html" render={({ field }) => (
                                            <FormItem>
                                                <FormControl>
                                                    <Textarea
                                                        {...field}
                                                        value={field.value || ''}
                                                        ref={textareaRef}
                                                        rows={12}
                                                        className="font-mono"
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                    )}
                                </div>
                            )}

                            <FormField control={form.control} name="is_active" render={({ field }) => (
                                <FormItem className="flex flex-row items-center space-x-3 space-y-0 pt-2">
                                    <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                    <FormLabel>{t('dialog.isActive')}</FormLabel>
                                </FormItem>
                            )} />
                            </fieldset>
                        </form>
                    </Form>
                    <DialogFooter>
                        <Button type="submit" form="communication-template-form" loading={save.isPending}>{editingTemplate ? t('dialog.save') : t('dialog.create')}</Button>
                        <DialogCancelButton disabled={save.isPending}>{t('dialog.cancel')}</DialogCancelButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <div className="flex items-center gap-3">
                            <DialogTitle>{previewingTemplate?.name}</DialogTitle>
                            <Badge variant="secondary">{previewingTemplate?.type}</Badge>
                        </div>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto space-y-4 px-6 py-4">
                        {previewingTemplate?.type === 'EMAIL' && previewingTemplate.subject && (
                            <div className="space-y-1">
                                <Label className="text-muted-foreground">{t('dialog.subject')}</Label>
                                <div
                                    className="p-3 bg-background border rounded-md text-foreground"
                                    dangerouslySetInnerHTML={{
                                        __html: previewingTemplate.subject.replace(/{{(.*?)}}/g, (match, p1) => `<span class="bg-primary/20 text-primary-foreground rounded px-1">${p1.trim()}</span>`)
                                    }}
                                />
                            </div>
                        )}
                        <div className="space-y-1">
                            <Label className="text-muted-foreground">{t('dialog.body')}</Label>
                            <div
                                className="p-4 bg-background border rounded-md min-h-[200px] text-foreground"
                                dangerouslySetInnerHTML={{
                                    __html: previewingTemplate?.body_html?.replace(
                                        /{{(.*?)}}/g,
                                        (match, p1) => `<span class="bg-primary/20 text-primary-foreground rounded px-1">${p1.trim()}</span>`
                                    ) || ''
                                }}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsPreviewDialogOpen(false)}>{t('dialog.close')}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <ConfirmActionDialog
                open={isDeleteDialogOpen}
                onOpenChange={setIsDeleteDialogOpen}
                title={t('deleteDialog.title')}
                description={t('deleteDialog.description', { name: deletingTemplate?.name })}
                cancelLabel={t('deleteDialog.cancel')}
                confirmLabel={t('deleteDialog.confirm')}
                onConfirm={() => { if (deletingTemplate?.id) remove.run(deletingTemplate); }}
                isPending={remove.isPending}
            />
        </>
    );
}
