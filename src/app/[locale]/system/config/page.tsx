
'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmActionDialog } from '@/components/ui/confirm-action-dialog';
import { DataCard } from '@/components/ui/data-card';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { TwoPanelLayout } from '@/components/layout/two-panel-layout';
import { SYSTEM_PERMISSIONS } from '@/constants/permissions';
import { API_ROUTES } from '@/constants/routes';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useDataLoader } from '@/hooks/use-data-loader';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';
import { getErrorMessage } from '@/lib/error-utils';
import { SystemConfiguration } from '@/lib/types';
import api, { isTimeoutError, REQUEST_TIMEOUT_MS } from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnDef, RowSelectionState } from '@tanstack/react-table';
import { AlertTriangle, Pencil, Settings, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

const configFormSchema = (t: (key: string) => string) => z.object({
    id: z.string().optional(),
    key: z.string().min(1, t('validation.keyRequired')),
    value: z.string().min(1, t('validation.valueRequired')),
    description: z.string().optional(),
    data_type: z.enum(['string', 'number', 'boolean', 'json'], { required_error: t('validation.dataTypeRequired') }),
    is_public: z.boolean().default(false),
});

type ConfigFormValues = z.infer<ReturnType<typeof configFormSchema>>;

async function getConfigs(signal?: AbortSignal): Promise<SystemConfiguration[]> {
        const data = await api.get(API_ROUTES.SYSTEM.CONFIGS, undefined, undefined, { signal });
        const configsData = Array.isArray(data) ? data : (data?.configs || data?.data || data?.result || []);
        return configsData.map((apiConfig: any) => ({
            id: String(apiConfig.id),
            key: apiConfig.key,
            value: apiConfig.value,
            data_type: apiConfig.data_type,
            updated_by: apiConfig.updated_by,
            description: apiConfig.description,
            is_public: apiConfig.is_public,
        }));
}

async function upsertConfig(configData: ConfigFormValues) {
    const responseData = await api.post(API_ROUTES.SYSTEM.CONFIGS_UPSERT, configData, undefined, undefined, { timeoutMs: REQUEST_TIMEOUT_MS.mutation });
    if (Array.isArray(responseData) && responseData[0]?.code >= 400) {
        throw new Error(responseData[0]?.message || 'Failed to save configuration');
    }
    return responseData;
}

async function deleteConfig(id: string) {
    const responseData = await api.delete(API_ROUTES.SYSTEM.CONFIGS_DELETE, { id }, undefined, undefined, { timeoutMs: REQUEST_TIMEOUT_MS.mutation });
    if (Array.isArray(responseData) && responseData[0]?.code >= 400) {
        throw new Error(responseData[0]?.message || 'Failed to delete configuration');
    }
    return responseData;
}

export default function SystemConfigPage() {
    const t = useTranslations('ConfigurationsPage');
    const tCommon = useTranslations('Common');
    const { toast } = useToast();
    const { hasPermission } = usePermissions();

    const canViewList = hasPermission(SYSTEM_PERMISSIONS.SYS_CONFIG_VIEW_LIST);
    const canCreate = hasPermission(SYSTEM_PERMISSIONS.SYS_CONFIG_CREATE);
    const canUpdate = hasPermission(SYSTEM_PERMISSIONS.SYS_CONFIG_UPDATE);
    const canDelete = hasPermission(SYSTEM_PERMISSIONS.SYS_CONFIG_DELETE);
    const isNarrow = useViewportNarrow();

    const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
    const [selectedConfig, setSelectedConfig] = React.useState<SystemConfiguration | null>(null);
    const [isEditing, setIsEditing] = React.useState(false);
    const [submissionError, setSubmissionError] = React.useState<string | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
    const [deletingConfig, setDeletingConfig] = React.useState<SystemConfiguration | null>(null);

    const form = useForm<ConfigFormValues>({
        resolver: zodResolver(configFormSchema(t)),
    });

    const { data: configs, isLoading, isRefreshing, error: loadError, reload: loadConfigs } = useDataLoader(
        getConfigs, [] as SystemConfiguration[], [], { enabled: canViewList }
    );

    const handleRowSelection = (rows: SystemConfiguration[]) => {
        const config = rows[0] ?? null;
        // Don't drop an in-flight save or unsaved edits by clicking another row.
        if (save.isPending || (isEditing && form.formState.isDirty && !window.confirm(tCommon('unsavedChangesConfirm')))) {
            setRowSelection(selectedConfig ? { [selectedConfig.id]: true } : {});
            return;
        }
        setSelectedConfig(config);
        setIsEditing(false);
        setSubmissionError(null);
        if (config) {
            form.reset({ id: config.id, key: config.key, value: config.value, description: config.description, data_type: config.data_type, is_public: config.is_public });
        }
    };

    const handleCreate = () => {
        if (save.isPending) return;
        if (isEditing && form.formState.isDirty && !window.confirm(tCommon('unsavedChangesConfirm'))) return;
        setSelectedConfig(null);
        setRowSelection({});
        setIsEditing(true);
        setSubmissionError(null);
        form.reset({ key: '', value: '', description: '', data_type: 'string', is_public: false });
    };

    const handleClose = () => {
        setSelectedConfig(null);
        setRowSelection({});
        setIsEditing(false);
    };

    const handleBack = () => {
        if (save.isPending) return;
        if (isEditing && form.formState.isDirty && !window.confirm(tCommon('unsavedChangesConfirm'))) return;
        if (isEditing && selectedConfig) {
            setIsEditing(false);
            form.reset({ id: selectedConfig.id, key: selectedConfig.key, value: selectedConfig.value, description: selectedConfig.description, data_type: selectedConfig.data_type, is_public: selectedConfig.is_public });
        } else {
            handleClose();
        }
    };

    const save = useAsyncAction(
        async (values: ConfigFormValues) => {
            setSubmissionError(null);
            await upsertConfig(values);
            return values;
        },
        {
            onSuccess: async (values) => {
                toast({ title: values.id ? t('toast.editTitle') : t('toast.createTitle'), description: t('toast.successDescription', { key: values.key }) });
                const fresh = await loadConfigs();
                setIsEditing(false);
                if (!values.id) {
                    handleClose();
                    return;
                }
                const updated = fresh?.find((c) => c.id === values.id);
                if (updated) {
                    setSelectedConfig(updated);
                    form.reset({ id: updated.id, key: updated.key, value: updated.value, description: updated.description, data_type: updated.data_type, is_public: updated.is_public });
                }
            },
            onError: (error) => {
                if (isTimeoutError(error)) {
                    // The configuration may have been saved anyway: refresh so the user can check before retrying.
                    setSubmissionError(tCommon('timeoutError'));
                    loadConfigs();
                    return;
                }
                setSubmissionError(getErrorMessage(error) || t('toast.genericError'));
            },
            showErrorToast: false,
        }
    );

    const remove = useAsyncAction(
        async (config: SystemConfiguration) => {
            await deleteConfig(config.id);
            return config;
        },
        {
            onSuccess: async (config) => {
                toast({ title: t('toast.deleteTitle'), description: t('toast.deleteDescription', { key: config.key }) });
                setIsDeleteDialogOpen(false);
                setDeletingConfig(null);
                handleClose();
                await loadConfigs();
            },
            onError: (error) => { if (isTimeoutError(error)) loadConfigs(); },
            errorTitle: t('toast.deleteError'),
        }
    );

    const columns: ColumnDef<SystemConfiguration>[] = [
        { accessorKey: 'key', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.key')} /> },
        { accessorKey: 'value', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.value')} /> },
        {
            accessorKey: 'data_type',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.type')} />,
            cell: ({ row }) => <Badge variant="outline">{row.original.data_type}</Badge>,
        },
        {
            accessorKey: 'is_public',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.isPublic')} />,
            cell: ({ row }) => <Badge variant={row.original.is_public ? 'success' : 'outline'}>{row.original.is_public ? t('columns.yes') : t('columns.no')}</Badge>,
        },
    ];

    const isRightOpen = !!selectedConfig || isEditing;

    const leftPanel = (
        <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm">
            <CardHeader className="flex-none p-4">
                <div className="flex items-start gap-3">
                    <div className="header-icon-circle mt-0.5"><Settings className="h-5 w-5" /></div>
                    <div>
                        <CardTitle className="text-lg">{t('title')}</CardTitle>
                        <CardDescription className="text-xs">{t('description')}</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden p-4 bg-card">
                {canViewList ? (
                    <DataTable
                        columns={columns}
                        data={configs}
                        filterColumnId="key"
                        filterPlaceholder={t('filterPlaceholder')}
                        onCreate={canCreate ? handleCreate : undefined}
                        onRefresh={loadConfigs}
                        isRefreshing={isRefreshing}
                        isLoading={isLoading}
                        loadError={loadError}
                        isNarrow={isNarrow || !!selectedConfig}
                        renderCard={(row: SystemConfiguration, _isSelected: boolean) => (
                            <DataCard isSelected={_isSelected}
                                title={row.key}
                                subtitle={row.description || row.value}
                                badge={<span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600">{row.data_type}</span>}
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

    const rightPanel = (
        <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm">
            <CardHeader className="flex-none p-4 pb-2 space-y-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                        <div className="header-icon-circle flex-none"><Settings className="h-5 w-5" /></div>
                        <CardTitle className="text-base lg:text-lg truncate">
                            {isEditing && !selectedConfig ? t('dialog.createTitle') : (selectedConfig?.key ?? '')}
                        </CardTitle>
                    </div>
                    <div className="flex items-center gap-1 ml-2 flex-none">
                        {selectedConfig && !isEditing && canUpdate && (
                            <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => setIsEditing(true)}>
                                <Pencil className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">{t('columns.edit')}</span>
                            </Button>
                        )}
                        {selectedConfig && !isEditing && canDelete && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                                aria-label={t('deleteDialog.confirm')}
                                onClick={() => { setDeletingConfig(selectedConfig); setIsDeleteDialogOpen(true); }}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>
                {selectedConfig && !isEditing && (
                    <div className="ml-10 mt-1 flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{selectedConfig.data_type}</Badge>
                        <Badge variant={selectedConfig.is_public ? 'success' : 'outline'} className="text-[10px]">
                            {selectedConfig.is_public ? t('columns.yes') : t('columns.no')} {t('columns.isPublic')}
                        </Badge>
                    </div>
                )}
            </CardHeader>
            <Separator />
            <CardContent className="flex-1 overflow-auto p-4">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(save.run)} className="space-y-4">
                        {submissionError && (
                            <Alert variant="destructive">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>{t('toast.errorTitle')}</AlertTitle>
                                <AlertDescription>{submissionError}</AlertDescription>
                            </Alert>
                        )}
                        {/* Native fieldset disables every control while the request is in flight */}
                        <fieldset disabled={save.isPending} className="min-w-0 space-y-4">
                        <FormField control={form.control} name="key" render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('dialog.key')}</FormLabel>
                                <FormControl><Input placeholder={t('dialog.keyPlaceholder')} {...field} disabled={!isEditing} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="value" render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('dialog.value')}</FormLabel>
                                <FormControl><Input placeholder={t('dialog.valuePlaceholder')} {...field} disabled={!isEditing} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="description" render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('dialog.description')}</FormLabel>
                                <FormControl><Textarea placeholder={t('dialog.descriptionPlaceholder')} {...field} disabled={!isEditing} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="data_type" render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('dialog.dataType')}</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value} disabled={!isEditing}>
                                    <FormControl><SelectTrigger><SelectValue placeholder={t('dialog.selectDataType')} /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value="string">String</SelectItem>
                                        <SelectItem value="number">Number</SelectItem>
                                        <SelectItem value="boolean">Boolean</SelectItem>
                                        <SelectItem value="json">JSON</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="is_public" render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4">
                                <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={!isEditing} /></FormControl>
                                <div className="space-y-1 leading-none">
                                    <FormLabel>{t('dialog.isPublic')}</FormLabel>
                                    <FormDescription>{t('dialog.isPublicDescription')}</FormDescription>
                                </div>
                            </FormItem>
                        )} />
                        </fieldset>
                        {isEditing && (
                            <div className="flex gap-2 pt-2">
                                <Button type="button" variant="outline"
                                    onClick={() => {
                                        setIsEditing(false);
                                        setSubmissionError(null);
                                        if (selectedConfig) form.reset({ id: selectedConfig.id, key: selectedConfig.key, value: selectedConfig.value, description: selectedConfig.description, data_type: selectedConfig.data_type, is_public: selectedConfig.is_public });
                                        else handleClose();
                                    }}
                                    disabled={save.isPending}
                                >
                                    {t('dialog.cancel')}
                                </Button>
                                <Button type="submit" loading={save.isPending}>
                                    {selectedConfig ? t('dialog.save') : t('dialog.create')}
                                </Button>
                            </div>
                        )}
                    </form>
                </Form>
            </CardContent>
        </Card>
    );

    return (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <TwoPanelLayout
                leftPanel={leftPanel}
                rightPanel={rightPanel}
                isRightPanelOpen={isRightOpen}
                onBack={handleBack}
                leftPanelDefaultSize={40}
                rightPanelDefaultSize={60}
            />
            <ConfirmActionDialog
                open={isDeleteDialogOpen}
                onOpenChange={setIsDeleteDialogOpen}
                title={t('deleteDialog.title')}
                description={t('deleteDialog.description', { key: deletingConfig?.key })}
                cancelLabel={t('deleteDialog.cancel')}
                confirmLabel={t('deleteDialog.confirm')}
                onConfirm={() => { if (deletingConfig) remove.run(deletingConfig); }}
                isPending={remove.isPending}
            />
        </div>
    );
}
