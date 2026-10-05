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
import { Dialog, DialogBody, DialogCancelButton, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { TwoPanelLayout } from '@/components/layout/two-panel-layout';
import { BUSINESS_CONFIG_PERMISSIONS } from '@/constants/permissions';
import { API_ROUTES } from '@/constants/routes';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useDataLoader } from '@/hooks/use-data-loader';
import { useDebounce } from '@/hooks/use-debounce';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';
import { getErrorMessage } from '@/lib/error-utils';
import { MutualSociety } from '@/lib/types';
import api, { isTimeoutError, REQUEST_TIMEOUT_MS } from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnDef, ColumnFiltersState, PaginationState, RowSelectionState } from '@tanstack/react-table';
import { AlertTriangle, Handshake, Pencil, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { createDefaultPagination } from '@/lib/pagination';

const mutualSocietyFormSchema = (t: (key: string) => string) => z.object({
    id: z.union([z.string(), z.number()]).optional(),
    name: z.string().min(1, { message: t('validation.nameRequired') }),
    description: z.string().optional(),
    code: z.string().min(1, { message: t('validation.codeRequired') }),
    is_active: z.boolean().default(true),
});

type MutualSocietyFormValues = z.infer<ReturnType<typeof mutualSocietyFormSchema>>;

type MutualSocietyResponse = { mutualSocieties: MutualSociety[]; total: number };

async function getMutualSocieties(pagination: PaginationState, searchQuery: string, signal?: AbortSignal): Promise<MutualSocietyResponse> {
        const searchValue = searchQuery.length >= 3 ? searchQuery : '';
        const data = await api.get(API_ROUTES.MUTUAL_SOCIETIES, {
            search: searchValue,
            page: (pagination.pageIndex + 1).toString(),
            limit: pagination.pageSize.toString(),
        }, undefined, { signal });

        let mutualSocietiesData: any[] = [];
        let total = 0;

        if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object' && 'id' in data[0] && !('json' in data[0])) {
            mutualSocietiesData = data;
            total = data.length;
        } else if (Array.isArray(data) && data.length > 0) {
            const firstElement = data[0];
            if (firstElement.json && typeof firstElement.json === 'object') {
                mutualSocietiesData = firstElement.json.data || [];
                total = Number(firstElement.json.total_items) || 0;
            } else if (firstElement.data) {
                mutualSocietiesData = firstElement.data;
                total = Number(firstElement.total_items) || mutualSocietiesData.length;
            }
        } else if (typeof data === 'object' && data !== null) {
            const responseObj = (data as any)[0]?.json || data;
            mutualSocietiesData = (responseObj as any).data || [];
            total = Number((responseObj as any).total_items) || mutualSocietiesData.length;
        }

        const mutualSocieties = mutualSocietiesData
            .map((m: any) => ({
                id: m.id,
                name: m.name,
                description: m.description,
                code: m.code,
                is_active: m.is_active ?? true,
                created_at: m.created_at,
                updated_at: m.updated_at,
            }))
            .filter((m: MutualSociety) => m.id !== undefined && m.id !== null);

        return { mutualSocieties, total };
}

async function upsertMutualSociety(mutualSocietyData: MutualSocietyFormValues) {
    const responseData = await api.post(API_ROUTES.MUTUAL_SOCIETIES_UPSERT, mutualSocietyData, undefined, undefined, { timeoutMs: REQUEST_TIMEOUT_MS.mutation });
    if (Array.isArray(responseData) && responseData[0]?.code >= 400) {
        throw new Error(responseData[0]?.message || 'Failed to save mutual society');
    }
    return responseData;
}

async function deleteMutualSociety(id: string) {
    const responseData = await api.delete(API_ROUTES.MUTUAL_SOCIETIES_DELETE, { id }, undefined, undefined, { timeoutMs: REQUEST_TIMEOUT_MS.mutation });
    if (Array.isArray(responseData) && responseData[0]?.code >= 400) {
        throw new Error(responseData[0]?.message || 'Failed to delete mutual society');
    }
    return responseData;
}

export default function MutualSocietiesPage() {
    const t = useTranslations('MutualSocietiesPage');
    const tColumns = useTranslations('MutualSocietiesColumns');
    const tCommon = useTranslations('Common');
    const { toast } = useToast();
    const { hasPermission } = usePermissions();
    const isNarrow = useViewportNarrow();

    const canCreate = hasPermission(BUSINESS_CONFIG_PERMISSIONS.MUTUAL_SOC_CREATE);
    const canUpdate = hasPermission(BUSINESS_CONFIG_PERMISSIONS.MUTUAL_SOC_UPDATE);
    const canDelete = hasPermission(BUSINESS_CONFIG_PERMISSIONS.MUTUAL_SOC_DELETE);

    const [pagination, setPagination] = React.useState<PaginationState>(createDefaultPagination);
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
    const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
    const [selectedMutualSociety, setSelectedMutualSociety] = React.useState<MutualSociety | null>(null);
    const [isEditing, setIsEditing] = React.useState(false);
    const [submissionError, setSubmissionError] = React.useState<string | null>(null);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
    const [deletingMutualSociety, setDeletingMutualSociety] = React.useState<MutualSociety | null>(null);

    const form = useForm<MutualSocietyFormValues>({
        resolver: zodResolver(mutualSocietyFormSchema(t)),
        defaultValues: { name: '', description: '', code: '', is_active: true },
    });

    const searchQuery = (columnFilters.find(f => f.id === 'name')?.value as string) || '';
    const debouncedSearch = useDebounce(searchQuery, 500);

    // Only the latest page/search request may write the table: a slow "ju" can't overwrite "juan".
    const {
        data: { mutualSocieties, total: totalItems },
        isLoading,
        isRefreshing,
        error: loadError,
        reload: loadMutualSocieties,
    } = useDataLoader(
        (signal) => getMutualSocieties(pagination, debouncedSearch, signal),
        { mutualSocieties: [] as MutualSociety[], total: 0 },
        [pagination.pageIndex, pagination.pageSize, debouncedSearch]
    );

    React.useEffect(() => {
        setPagination(prev => ({ ...prev, pageIndex: 0 }));
    }, [columnFilters]);

    const handleRowSelection = (rows: MutualSociety[]) => {
        const society = rows[0] ?? null;
        // Don't drop an in-flight save or unsaved edits by clicking another row.
        if (save.isPending || (isEditing && form.formState.isDirty && !window.confirm(tCommon('unsavedChangesConfirm')))) {
            setRowSelection(selectedMutualSociety ? { [String(selectedMutualSociety.id)]: true } : {});
            return;
        }
        setSelectedMutualSociety(society);
        setSubmissionError(null);
        if (society) {
            setIsEditing(false);
            form.reset({ id: society.id, name: society.name, description: society.description || '', code: society.code, is_active: society.is_active });
        }
    };

    const handleCreate = () => {
        setSelectedMutualSociety(null);
        setRowSelection({});
        setIsEditing(true);
        setSubmissionError(null);
        form.reset({ name: '', description: '', code: '', is_active: true });
        setIsCreateDialogOpen(true);
    };

    const handleClose = () => {
        setSelectedMutualSociety(null);
        setRowSelection({});
        setIsEditing(false);
    };

    const handleBack = () => {
        if (save.isPending) return;
        if (isEditing && form.formState.isDirty && !window.confirm(tCommon('unsavedChangesConfirm'))) return;
        if (isEditing && selectedMutualSociety) {
            setIsEditing(false);
            form.reset({ id: selectedMutualSociety.id, name: selectedMutualSociety.name, description: selectedMutualSociety.description || '', code: selectedMutualSociety.code, is_active: selectedMutualSociety.is_active });
        } else {
            handleClose();
        }
    };

    const save = useAsyncAction(
        async (values: MutualSocietyFormValues) => {
            setSubmissionError(null);
            await upsertMutualSociety(values);
            return values;
        },
        {
            onSuccess: async (values) => {
                toast({ title: values.id ? t('toast.editSuccessTitle') : t('toast.createSuccessTitle') });
                const fresh = await loadMutualSocieties();
                setIsEditing(false);
                if (!values.id) {
                    setIsCreateDialogOpen(false);
                    handleClose();
                    return;
                }
                const updated = fresh?.mutualSocieties.find((m) => String(m.id) === String(values.id));
                if (updated) {
                    setSelectedMutualSociety(updated);
                    form.reset({ id: updated.id, name: updated.name, description: updated.description || '', code: updated.code, is_active: updated.is_active });
                }
            },
            onError: (error) => {
                if (isTimeoutError(error)) {
                    // The record may have been saved anyway: refresh so the user can check before retrying.
                    setSubmissionError(tCommon('timeoutError'));
                    loadMutualSocieties();
                    return;
                }
                setSubmissionError(getErrorMessage(error) || t('toast.genericError'));
            },
            showErrorToast: false,
        }
    );

    const remove = useAsyncAction(
        (society: MutualSociety) => deleteMutualSociety(String(society.id)),
        {
            onSuccess: async () => {
                toast({ title: t('toast.deleteSuccessTitle') });
                setIsDeleteDialogOpen(false);
                setDeletingMutualSociety(null);
                handleClose();
                await loadMutualSocieties();
            },
            onError: (error) => { if (isTimeoutError(error)) loadMutualSocieties(); },
            errorTitle: t('toast.deleteErrorDescription'),
        }
    );

    const columns: ColumnDef<MutualSociety>[] = [
        { accessorKey: 'name', header: ({ column }) => <DataTableColumnHeader column={column} title={tColumns('name')} /> },
        { accessorKey: 'code', header: ({ column }) => <DataTableColumnHeader column={column} title={tColumns('code')} /> },
        {
            accessorKey: 'is_active',
            header: ({ column }) => <DataTableColumnHeader column={column} title={tColumns('isActive')} />,
            cell: ({ row }) => <Badge variant={row.original.is_active ? 'success' : 'outline'} className="text-[10px]">{row.original.is_active ? 'Activo' : 'Inactivo'}</Badge>,
        },
    ];

    const isRightOpen = !!selectedMutualSociety;

    const leftPanel = (
        <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm">
            <CardHeader className="flex-none p-4">
                <div className="flex items-start gap-3">
                    <div className="header-icon-circle mt-0.5"><Handshake className="h-5 w-5" /></div>
                    <div>
                        <CardTitle className="text-lg">{t('title')}</CardTitle>
                        <CardDescription className="text-xs">{t('description')}</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden p-4 bg-card">
                <DataTable
                    columns={columns}
                    data={mutualSocieties}
                    filterColumnId="name"
                    filterPlaceholder={t('filterPlaceholder')}
                    onCreate={canCreate ? handleCreate : undefined}
                    onRefresh={loadMutualSocieties}
                    isRefreshing={isRefreshing}
                    isLoading={isLoading}
                    loadError={loadError}
                    enableSingleRowSelection
                    rowSelection={rowSelection}
                    setRowSelection={setRowSelection}
                    onRowSelectionChange={handleRowSelection}
                    isNarrow={isNarrow || !!selectedMutualSociety}
                    pageCount={totalItems > 0 ? Math.ceil(totalItems / pagination.pageSize) : 0}
                    rowCount={totalItems}
                    pagination={pagination}
                    onPaginationChange={setPagination}
                    manualPagination={true}
                    columnFilters={columnFilters}
                    onColumnFiltersChange={setColumnFilters}
                    renderCard={(row: MutualSociety, _isSelected: boolean) => (
                        <DataCard isSelected={_isSelected}
                            title={row.name}
                            subtitle={row.code}
                            badge={<Badge variant={row.is_active ? 'success' : 'outline'} className="text-[10px]">{row.is_active ? 'Activo' : 'Inactivo'}</Badge>}
                            showArrow
                        />
                    )}
                />
            </CardContent>
        </Card>
    );

    const rightPanel = (
        <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm">
            <CardHeader className="flex-none p-4 pb-2 space-y-0">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="header-icon-circle flex-none"><Handshake className="h-5 w-5" /></div>
                    <div className="min-w-0 flex-1">
                        <CardTitle className="text-base lg:text-lg truncate">
                            {isEditing && !selectedMutualSociety ? t('createDialog.title') : (selectedMutualSociety?.name ?? '')}
                        </CardTitle>
                        {selectedMutualSociety && !isEditing && (
                            <div className="mt-0.5">
                                <Badge variant={selectedMutualSociety.is_active ? 'success' : 'outline'} className="text-[10px]">
                                    {selectedMutualSociety.is_active ? 'Activo' : 'Inactivo'}
                                </Badge>
                            </div>
                        )}
                    </div>
                    {selectedMutualSociety && !isEditing && (
                        <div className="flex gap-1 flex-none">
                            {canUpdate && (
                                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                                    <Pencil className="h-4 w-4 mr-1" />
                                    <span className="hidden sm:inline">{tColumns('edit')}</span>
                                </Button>
                            )}
                            {canDelete && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive" aria-label={t('deleteDialog.confirm')} onClick={() => { setDeletingMutualSociety(selectedMutualSociety); setIsDeleteDialogOpen(true); }}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            </CardHeader>
            <Separator />
            <Form {...form}>
                <form onSubmit={form.handleSubmit(save.run)} className="flex-1 flex flex-col min-h-0">
                    <CardContent className="flex-1 overflow-auto p-4 space-y-4">
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
                                <FormLabel>{t('createDialog.name')}</FormLabel>
                                <FormControl><Input {...field} disabled={!isEditing} placeholder={t('createDialog.namePlaceholder')} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="code" render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('createDialog.code')}</FormLabel>
                                <FormControl><Input {...field} disabled={!isEditing} placeholder={t('createDialog.codePlaceholder')} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="description" render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('createDialog.description')}</FormLabel>
                                <FormControl><Textarea {...field} disabled={!isEditing} placeholder={isEditing ? t('createDialog.descriptionPlaceholder') : ''} value={field.value || ''} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="is_active" render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-lg border p-3">
                                <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={!isEditing} /></FormControl>
                                <FormLabel className="font-normal">{t('createDialog.isActive')}</FormLabel>
                            </FormItem>
                        )} />
                        </fieldset>
                    </CardContent>
                    {isEditing && (
                        <div className="flex-none border-t bg-card px-4 py-3 flex gap-2">
                            <Button type="submit" loading={save.isPending}>
                                {selectedMutualSociety ? t('createDialog.editSave') : t('createDialog.save')}
                            </Button>
                            <Button type="button" variant="outline" disabled={save.isPending} onClick={() => {
                                setIsEditing(false);
                                setSubmissionError(null);
                                if (selectedMutualSociety) {
                                    form.reset({ id: selectedMutualSociety.id, name: selectedMutualSociety.name, description: selectedMutualSociety.description || '', code: selectedMutualSociety.code, is_active: selectedMutualSociety.is_active });
                                } else {
                                    handleClose();
                                }
                            }}>
                                {t('createDialog.cancel')}
                            </Button>
                        </div>
                    )}
                </form>
            </Form>
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
                description={t('deleteDialog.description', { name: deletingMutualSociety?.name })}
                cancelLabel={t('deleteDialog.cancel')}
                confirmLabel={t('deleteDialog.confirm')}
                onConfirm={() => { if (deletingMutualSociety) remove.run(deletingMutualSociety); }}
                isPending={remove.isPending}
            />
            <Dialog
                open={isCreateDialogOpen}
                onOpenChange={(open) => {
                    if (!open && save.isPending) return;
                    setIsCreateDialogOpen(open);
                    if (!open) {
                        setIsEditing(false);
                        setSubmissionError(null);
                        form.reset({ name: '', description: '', code: '', is_active: true });
                    }
                }}
            >
                <DialogContent maxWidth="lg" confirmOnClose isDirty={form.formState.isDirty && !save.isPending}>
                    <DialogHeader>
                        <DialogTitle>{t('createDialog.title')}</DialogTitle>
                        <DialogDescription>{t('createDialog.description')}</DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(save.run)} className="flex flex-col min-h-0">
                            <DialogBody className="space-y-4 px-6 py-4">
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
                                        <FormLabel>{t('createDialog.name')}</FormLabel>
                                        <FormControl><Input {...field} placeholder={t('createDialog.namePlaceholder')} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="code" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('createDialog.code')}</FormLabel>
                                        <FormControl><Input {...field} placeholder={t('createDialog.codePlaceholder')} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="description" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('createDialog.description')}</FormLabel>
                                        <FormControl><Textarea {...field} placeholder={t('createDialog.descriptionPlaceholder')} value={field.value || ''} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="is_active" render={({ field }) => (
                                    <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-lg border p-3">
                                        <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                        <FormLabel className="font-normal">{t('createDialog.isActive')}</FormLabel>
                                    </FormItem>
                                )} />
                                </fieldset>
                            </DialogBody>
                            <DialogFooter>
                                <DialogCancelButton disabled={save.isPending}>
                                    {t('createDialog.cancel')}
                                </DialogCancelButton>
                                <Button type="submit" loading={save.isPending}>
                                    {t('createDialog.save')}
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
