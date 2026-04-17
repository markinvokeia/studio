'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { DataCard } from '@/components/ui/data-card';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { TwoPanelLayout } from '@/components/layout/two-panel-layout';
import { BUSINESS_CONFIG_PERMISSIONS } from '@/constants/permissions';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';
import { MutualSociety } from '@/lib/types';
import api from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnDef, ColumnFiltersState, PaginationState, RowSelectionState } from '@tanstack/react-table';
import { AlertTriangle, Handshake, Loader2, Pencil, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

const mutualSocietyFormSchema = (t: (key: string) => string) => z.object({
    id: z.union([z.string(), z.number()]).optional(),
    name: z.string().min(1, { message: t('validation.nameRequired') }),
    description: z.string().optional(),
    code: z.string().min(1, { message: t('validation.codeRequired') }),
    is_active: z.boolean().default(true),
});

type MutualSocietyFormValues = z.infer<ReturnType<typeof mutualSocietyFormSchema>>;

type MutualSocietyResponse = { mutualSocieties: MutualSociety[]; total: number };

async function getMutualSocieties(pagination: PaginationState, searchQuery: string): Promise<MutualSocietyResponse> {
    try {
        const searchValue = searchQuery.length >= 3 ? searchQuery : '';
        const data = await api.get(API_ROUTES.MUTUAL_SOCIETIES, {
            search: searchValue,
            page: (pagination.pageIndex + 1).toString(),
            limit: pagination.pageSize.toString(),
        });

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
    } catch (error) {
        console.error("Failed to fetch mutual societies:", error);
        return { mutualSocieties: [], total: 0 };
    }
}

async function upsertMutualSociety(mutualSocietyData: MutualSocietyFormValues) {
    const responseData = await api.post(API_ROUTES.MUTUAL_SOCIETIES_UPSERT, mutualSocietyData);
    if (Array.isArray(responseData) && responseData[0]?.code >= 400) {
        throw new Error(responseData[0]?.message || 'Failed to save mutual society');
    }
    return responseData;
}

async function deleteMutualSociety(id: string) {
    const responseData = await api.delete(API_ROUTES.MUTUAL_SOCIETIES_DELETE, { id });
    if (Array.isArray(responseData) && responseData[0]?.code >= 400) {
        throw new Error(responseData[0]?.message || 'Failed to delete mutual society');
    }
    return responseData;
}

export default function MutualSocietiesPage() {
    const t = useTranslations('MutualSocietiesPage');
    const tColumns = useTranslations('MutualSocietiesColumns');
    const { toast } = useToast();
    const { hasPermission } = usePermissions();
    const isNarrow = useViewportNarrow();

    const canCreate = hasPermission(BUSINESS_CONFIG_PERMISSIONS.MUTUAL_SOC_CREATE);
    const canUpdate = hasPermission(BUSINESS_CONFIG_PERMISSIONS.MUTUAL_SOC_UPDATE);
    const canDelete = hasPermission(BUSINESS_CONFIG_PERMISSIONS.MUTUAL_SOC_DELETE);

    const [mutualSocieties, setMutualSocieties] = React.useState<MutualSociety[]>([]);
    const [totalItems, setTotalItems] = React.useState(0);
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
    const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
    const [selectedMutualSociety, setSelectedMutualSociety] = React.useState<MutualSociety | null>(null);
    const [isEditing, setIsEditing] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);
    const [submissionError, setSubmissionError] = React.useState<string | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
    const [deletingMutualSociety, setDeletingMutualSociety] = React.useState<MutualSociety | null>(null);

    const form = useForm<MutualSocietyFormValues>({
        resolver: zodResolver(mutualSocietyFormSchema(t)),
        defaultValues: { name: '', description: '', code: '', is_active: true },
    });

    const loadMutualSocieties = React.useCallback(async () => {
        setIsRefreshing(true);
        const searchQuery = (columnFilters.find(f => f.id === 'name')?.value as string) || '';
        const { mutualSocieties: fetched, total } = await getMutualSocieties(pagination, searchQuery);
        setMutualSocieties(fetched);
        setTotalItems(total);
        setIsRefreshing(false);
    }, [pagination, columnFilters]);

    React.useEffect(() => {
        const debounce = setTimeout(() => { loadMutualSocieties(); }, 500);
        return () => clearTimeout(debounce);
    }, [loadMutualSocieties]);

    React.useEffect(() => {
        setPagination(prev => ({ ...prev, pageIndex: 0 }));
    }, [columnFilters]);

    const handleRowSelection = (rows: MutualSociety[]) => {
        const society = rows[0] ?? null;
        setSelectedMutualSociety(society);
        setIsEditing(false);
        setSubmissionError(null);
        if (society) form.reset({ id: society.id, name: society.name, description: society.description || '', code: society.code, is_active: society.is_active });
    };

    const handleCreate = () => {
        setSelectedMutualSociety(null);
        setRowSelection({});
        setIsEditing(true);
        setSubmissionError(null);
        form.reset({ name: '', description: '', code: '', is_active: true });
    };

    const handleClose = () => {
        setSelectedMutualSociety(null);
        setRowSelection({});
        setIsEditing(false);
    };

    const handleBack = () => {
        if (isEditing && selectedMutualSociety) {
            setIsEditing(false);
            form.reset({ id: selectedMutualSociety.id, name: selectedMutualSociety.name, description: selectedMutualSociety.description || '', code: selectedMutualSociety.code, is_active: selectedMutualSociety.is_active });
        } else {
            handleClose();
        }
    };

    const onSubmit = async (values: MutualSocietyFormValues) => {
        setSubmissionError(null);
        setIsSaving(true);
        try {
            await upsertMutualSociety(values);
            toast({ title: selectedMutualSociety ? t('toast.editSuccessTitle') : t('toast.createSuccessTitle') });
            await loadMutualSocieties();
            setIsEditing(false);
            if (!values.id) handleClose();
        } catch (error) {
            setSubmissionError(error instanceof Error ? error.message : t('toast.genericError'));
        } finally {
            setIsSaving(false);
        }
    };

    const confirmDelete = async () => {
        if (!deletingMutualSociety) return;
        try {
            await deleteMutualSociety(String(deletingMutualSociety.id));
            toast({ title: t('toast.deleteSuccessTitle') });
            setIsDeleteDialogOpen(false);
            setDeletingMutualSociety(null);
            handleClose();
            loadMutualSocieties();
        } catch (error) {
            toast({ variant: 'destructive', title: t('toast.errorTitle'), description: error instanceof Error ? error.message : t('toast.deleteErrorDescription') });
        }
    };

    const columns: ColumnDef<MutualSociety>[] = [
        { accessorKey: 'name', header: ({ column }) => <DataTableColumnHeader column={column} title={tColumns('name')} /> },
        { accessorKey: 'code', header: ({ column }) => <DataTableColumnHeader column={column} title={tColumns('code')} /> },
        {
            accessorKey: 'is_active',
            header: ({ column }) => <DataTableColumnHeader column={column} title={tColumns('isActive')} />,
            cell: ({ row }) => <Badge variant={row.original.is_active ? 'success' : 'outline'} className="text-[10px]">{row.original.is_active ? 'Activo' : 'Inactivo'}</Badge>,
        },
    ];

    const isRightOpen = !!selectedMutualSociety || isEditing;

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
                    enableSingleRowSelection
                    rowSelection={rowSelection}
                    setRowSelection={setRowSelection}
                    onRowSelectionChange={handleRowSelection}
                    isNarrow={isNarrow || !!selectedMutualSociety}
                    pageCount={totalItems > 0 ? Math.ceil(totalItems / pagination.pageSize) : 0}
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
                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive" onClick={() => { setDeletingMutualSociety(selectedMutualSociety); setIsDeleteDialogOpen(true); }}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            </CardHeader>
            <Separator />
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0">
                    <CardContent className="flex-1 overflow-auto p-4 space-y-4">
                        {submissionError && (
                            <Alert variant="destructive">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>{t('toast.errorTitle')}</AlertTitle>
                                <AlertDescription>{submissionError}</AlertDescription>
                            </Alert>
                        )}
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
                    </CardContent>
                    {isEditing && (
                        <div className="flex-none border-t bg-card px-4 py-3 flex gap-2">
                            <Button type="submit" disabled={isSaving}>
                                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {selectedMutualSociety ? t('createDialog.editSave') : t('createDialog.save')}
                            </Button>
                            <Button type="button" variant="outline" disabled={isSaving} onClick={() => {
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
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('deleteDialog.title')}</AlertDialogTitle>
                        <AlertDialogDescription>{t('deleteDialog.description', { name: deletingMutualSociety?.name })}</AlertDialogDescription>
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
