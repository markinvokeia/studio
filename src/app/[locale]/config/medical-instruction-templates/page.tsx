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
} from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DataCard } from '@/components/ui/data-card';
import { Separator } from '@/components/ui/separator';
import { TwoPanelLayout } from '@/components/layout/two-panel-layout';

import { InstructionRichTextEditor } from '@/components/medical-instructions/instruction-rich-text-editor';

import { BUSINESS_CONFIG_PERMISSIONS } from '@/constants/permissions';
import { API_ROUTES } from '@/constants/routes';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useDataLoader } from '@/hooks/use-data-loader';
import { useDebounce } from '@/hooks/use-debounce';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { getErrorMessage } from '@/lib/error-utils';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';
import { MedicalInstructionTemplate } from '@/lib/types';
import {
    MEDICAL_INSTRUCTION_TEMPLATE_VARIABLES,
    MEDICAL_INSTRUCTION_TEMPLATE_VARIABLE_GROUP_ORDER,
} from '@/lib/medical-instruction-template-variables';
import api, { isTimeoutError, REQUEST_TIMEOUT_MS } from '@/services/api';

import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnDef, ColumnFiltersState, PaginationState, RowSelectionState } from '@tanstack/react-table';
import { AlertTriangle, ClipboardList, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

const templateFormSchema = (t: (key: string) => string) => z.object({
    id: z.union([z.string(), z.number()]).optional(),
    name: z.string().min(1, t('validation.nameRequired')),
    description: z.string().optional(),
    content_html: z.string().min(1, t('validation.contentRequired')),
    is_active: z.boolean().default(true),
});

type TemplateFormValues = z.infer<ReturnType<typeof templateFormSchema>>;
type TemplateRow = MedicalInstructionTemplate;

/** n8n answers some failures with a 2xx body carrying the error: surface them as real errors. */
function throwIfBackendError(response: any, fallback: string) {
    const first = Array.isArray(response) ? response[0] : response;
    if (first?.error || (first?.code && Number(first.code) >= 400)) {
        throw new Error(first?.message || (typeof first?.error === 'string' ? first.error : '') || fallback);
    }
}

const upsertTemplate = async (data: any) => {
    try {
        const response = await api.post(API_ROUTES.MEDICAL_INSTRUCTION_TEMPLATES_UPSERT, data, undefined, undefined, { timeoutMs: REQUEST_TIMEOUT_MS.mutation });
        throwIfBackendError(response, 'Failed to save template');
        return response;
    } catch (error) {
        console.error('Failed to upsert medical instruction template', error);
        throw error;
    }
};

const deleteTemplate = async (id: string) => {
    try {
        const response = await api.delete(API_ROUTES.MEDICAL_INSTRUCTION_TEMPLATES_DELETE, { id }, undefined, undefined, { timeoutMs: REQUEST_TIMEOUT_MS.mutation });
        throwIfBackendError(response, 'Failed to delete template');
        return response;
    } catch (error) {
        console.error('Failed to delete medical instruction template', error);
        throw error;
    }
};

async function getTemplates(params: { search?: string; page?: number; limit?: number } = {}, signal?: AbortSignal): Promise<{ data: MedicalInstructionTemplate[]; total: number; page: number; limit: number }> {
    try {
        const query: Record<string, string> = {};
        if (params.search) query.search = params.search;
        if (params.page) query.page = params.page.toString();
        if (params.limit) query.limit = params.limit.toString();
        const response = await api.get(API_ROUTES.MEDICAL_INSTRUCTION_TEMPLATES, query, undefined, { signal });
        const data: MedicalInstructionTemplate[] = Array.isArray(response)
            ? response
            : (response?.rows || response?.data || response?.result || []);
        return {
            data,
            total: data.length,
            page: params.page || 1,
            limit: params.limit || 10,
        };
    } catch (error) {
        console.error('Failed to fetch medical instruction templates:', error);
        throw error;
    }
}

export default function MedicalInstructionTemplatesPage() {
    const t = useTranslations('MedicalInstructionTemplatesPage');
    const tCommon = useTranslations('Common');
    const { toast } = useToast();
    const { hasPermission } = usePermissions();

    const canViewList = hasPermission(BUSINESS_CONFIG_PERMISSIONS.MEDICAL_INSTRUCTION_TEMPLATES_VIEW);
    const canCreate = hasPermission(BUSINESS_CONFIG_PERMISSIONS.MEDICAL_INSTRUCTION_TEMPLATES_CREATE);
    const canUpdate = hasPermission(BUSINESS_CONFIG_PERMISSIONS.MEDICAL_INSTRUCTION_TEMPLATES_UPDATE);
    const canDelete = hasPermission(BUSINESS_CONFIG_PERMISSIONS.MEDICAL_INSTRUCTION_TEMPLATES_DELETE);
    const isNarrow = useViewportNarrow();

    const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize: 25 });
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

    const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
    const [selectedTemplate, setSelectedTemplate] = React.useState<MedicalInstructionTemplate | null>(null);

    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingTemplate, setEditingTemplate] = React.useState<MedicalInstructionTemplate | null>(null);

    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
    const [deletingTemplate, setDeletingTemplate] = React.useState<MedicalInstructionTemplate | null>(null);

    const [submissionError, setSubmissionError] = React.useState<string | null>(null);

    const form = useForm<TemplateFormValues>({
        resolver: zodResolver(templateFormSchema(t)),
    });

    const groupLabels = {
        patient: t('variables.groups.patient'),
        clinic: t('variables.groups.clinic'),
        document: t('variables.groups.document'),
        tables: t('variables.groups.tables'),
    };

    const searchQuery = (columnFilters.find(f => f.id === 'name')?.value as string) || '';
    const debouncedSearch = useDebounce(searchQuery, 500);

    // Only the latest page/search request may write the table: a slow "ju" can't overwrite "juan".
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
                limit: pagination.pageSize,
            }, signal);
            return {
                templates: templatesResponse.data.filter(template => Object.keys(template).length > 0),
                total: templatesResponse.total,
            };
        },
        { templates: [] as TemplateRow[], total: 0 },
        [pagination.pageIndex, pagination.pageSize, debouncedSearch],
        { enabled: canViewList }
    );

    React.useEffect(() => {
        setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    }, [columnFilters]);

    // Keep the detail panel in sync with the refreshed list (e.g. after editing it).
    React.useEffect(() => {
        setSelectedTemplate((current) => (current ? templates.find((tpl) => String(tpl.id) === String(current.id)) ?? current : current));
    }, [templates]);

    const handleRowSelection = (rows: MedicalInstructionTemplate[]) => {
        setSelectedTemplate(rows[0] ?? null);
    };

    const handleCreate = () => {
        setEditingTemplate(null);
        form.reset({ name: '', description: '', content_html: '', is_active: true });
        setSubmissionError(null);
        setIsDialogOpen(true);
    };

    const handleEdit = (template: MedicalInstructionTemplate) => {
        setEditingTemplate(template);
        form.reset({ ...template });
        setSubmissionError(null);
        setIsDialogOpen(true);
    };

    const handleDelete = (template: MedicalInstructionTemplate) => {
        setDeletingTemplate(template);
        setIsDeleteDialogOpen(true);
    };

    const remove = useAsyncAction(
        async (template: TemplateRow) => {
            await deleteTemplate(String(template.id));
            return template;
        },
        {
            onSuccess: async (template) => {
                toast({ title: t('toast.deleteSuccessTitle'), description: t('toast.deleteSuccessDescription', { name: template.name }) });
                setIsDeleteDialogOpen(false);
                setDeletingTemplate(null);
                setSelectedTemplate(null);
                setRowSelection({});
                await loadData();
            },
            onError: (error) => { if (isTimeoutError(error)) loadData(); },
            errorTitle: t('toast.errorTitle'),
        }
    );

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
            onError: (error) => {
                if (isTimeoutError(error)) {
                    // The template may have been saved anyway: refresh so the user can check before retrying.
                    setSubmissionError(tCommon('timeoutError'));
                    loadData();
                    return;
                }
                setSubmissionError(getErrorMessage(error) || tCommon('genericError'));
            },
            showErrorToast: false,
        }
    );


    const columns: ColumnDef<MedicalInstructionTemplate>[] = [
        { accessorKey: 'name', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.name')} /> },
        { accessorKey: 'description', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.description')} /> },
        {
            accessorKey: 'is_active',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.isActive')} />,
            cell: ({ row }) => <Badge variant={row.original.is_active ? 'success' : 'outline'}>{row.original.is_active ? t('columns.yes') : t('columns.no')}</Badge>,
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
                            {canUpdate && <DropdownMenuItem onClick={() => handleEdit(template)}>{t('columns.edit')}</DropdownMenuItem>}
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
                    <div className="header-icon-circle mt-0.5"><ClipboardList className="h-5 w-5" /></div>
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
                        renderCard={(row: MedicalInstructionTemplate, _isSelected: boolean) => (
                            <DataCard
                                isSelected={_isSelected}
                                title={row.name}
                                subtitle={row.description}
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
                    <div className="header-icon-circle flex-none"><ClipboardList className="h-5 w-5" /></div>
                    <div className="min-w-0 flex-1">
                        <CardTitle className="text-base lg:text-lg truncate">{selectedTemplate.name}</CardTitle>
                        {selectedTemplate.description && <p className="text-xs text-muted-foreground truncate">{selectedTemplate.description}</p>}
                    </div>
                    <div className="flex gap-1 flex-none">
                        {canUpdate && (
                            <Button size="sm" variant="outline" onClick={() => handleEdit(selectedTemplate)}>
                                <Pencil className="h-4 w-4 mr-1" />{t('columns.edit')}
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
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-0.5">{t('columns.isActive')}</dt>
                            <dd><Badge variant={selectedTemplate.is_active ? 'success' : 'outline'}>{selectedTemplate.is_active ? t('columns.yes') : t('columns.no')}</Badge></dd>
                        </div>
                    </div>
                    <div>
                        <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">{t('dialog.content')}</dt>
                        <dd
                            className="text-xs bg-muted/50 rounded p-2 max-h-96 overflow-auto whitespace-pre-wrap"
                            dangerouslySetInnerHTML={{ __html: selectedTemplate.content_html || '' }}
                        />
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
                <DialogContent maxWidth="6xl" confirmOnClose isDirty={form.formState.isDirty && !save.isPending}>
                    <DialogHeader>
                        <DialogTitle>{editingTemplate ? t('dialog.editTitle') : t('dialog.createTitle')}</DialogTitle>
                    </DialogHeader>
                    <Form {...form}>
                        <form id="template-form" onSubmit={form.handleSubmit(save.run)} className="space-y-4 py-4 px-6 max-h-[85vh] overflow-y-auto">
                            {submissionError && (
                                <Alert variant="destructive">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertTitle>{t('toast.errorTitle')}</AlertTitle>
                                    <AlertDescription>{submissionError}</AlertDescription>
                                </Alert>
                            )}
                            {/* Native fieldset disables every control while the request is in flight */}
                            <fieldset disabled={save.isPending} className="min-w-0 space-y-4">
                            <FormField control={form.control} name="name" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('dialog.name')}</FormLabel>
                                    <FormControl><Input placeholder={t('dialog.namePlaceholder')} {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="description" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('dialog.descriptionLabel')}</FormLabel>
                                    <FormControl><Textarea rows={2} {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <div className="space-y-2">
                                <FormLabel>{t('dialog.content')}</FormLabel>
                                <Alert>
                                    <AlertDescription className="text-xs">{t('dialog.legend')}</AlertDescription>
                                </Alert>
                                <FormField control={form.control} name="content_html" render={({ field }) => (
                                    <FormItem>
                                        <FormControl>
                                            <InstructionRichTextEditor
                                                value={field.value}
                                                onChange={field.onChange}
                                                variables={MEDICAL_INSTRUCTION_TEMPLATE_VARIABLES}
                                                groupOrder={MEDICAL_INSTRUCTION_TEMPLATE_VARIABLE_GROUP_ORDER}
                                                groupLabels={groupLabels}
                                                variablesLabel={t('variables.title')}
                                                minHeight="28rem"
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </div>
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
                        <Button type="submit" form="template-form" loading={save.isPending}>{editingTemplate ? t('dialog.save') : t('dialog.create')}</Button>
                        <DialogCancelButton disabled={save.isPending}>{t('dialog.cancel')}</DialogCancelButton>
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
