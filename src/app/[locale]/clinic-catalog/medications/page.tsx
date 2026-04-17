'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataCard } from '@/components/ui/data-card';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { TwoPanelLayout } from '@/components/layout/two-panel-layout';
import { CLINIC_CATALOG_PERMISSIONS } from '@/constants/permissions';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';
import { Medication } from '@/lib/types';
import api from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnDef, ColumnFiltersState, PaginationState, RowSelectionState } from '@tanstack/react-table';
import { AlertTriangle, Loader2, Pencil, Pill, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

const medicationFormSchema = (t: (key: string) => string) => z.object({
    id: z.string().optional(),
    nombre_generico: z.string().min(1, { message: t('validation.nameRequired') }),
    nombre_comercial: z.string().optional(),
});

type MedicationFormValues = z.infer<ReturnType<typeof medicationFormSchema>>;

type MedicationResponse = {
    medications: Medication[];
    total: number;
};

async function getMedications(pagination: PaginationState, searchQuery: string): Promise<MedicationResponse> {
    try {
        const searchValue = searchQuery.length >= 3 ? searchQuery : '';
        const data = await api.get(API_ROUTES.CLINIC_CATALOG.MEDICATIONS, {
            search: searchValue,
            page: (pagination.pageIndex + 1).toString(),
            limit: pagination.pageSize.toString(),
        });

        let medicationsData: any[] = [];
        let total = 0;

        if (Array.isArray(data) && data.length > 0) {
            const firstElement = data[0];
            if (firstElement.json && typeof firstElement.json === 'object') {
                medicationsData = firstElement.json.data || [];
                total = Number(firstElement.json.total_items) || 0;
            } else if (firstElement.data) {
                medicationsData = firstElement.data;
                total = Number(firstElement.total_items) || medicationsData.length;
            }
        } else if (typeof data === 'object' && data !== null) {
            const responseObj = data[0]?.json || data;
            medicationsData = responseObj.data || [];
            total = Number(responseObj.total_items) || medicationsData.length;
        }

        const medications = medicationsData
            .map((apiMedication: any) => ({
                id: String(apiMedication.id),
                nombre_generico: apiMedication.nombre_generico,
                nombre_comercial: apiMedication.nombre_comercial,
            }))
            .filter((medication: Medication) => medication.id && medication.id !== 'undefined' && medication.nombre_generico);

        return { medications, total };
    } catch (error) {
        console.error("Failed to fetch medications:", error);
        return { medications: [], total: 0 };
    }
}

async function upsertMedication(medicationData: MedicationFormValues) {
    const responseData = await api.post(API_ROUTES.CLINIC_CATALOG.MEDICATIONS_UPSERT, medicationData);
    if (Array.isArray(responseData) && responseData[0]?.code >= 400) {
        throw new Error(responseData[0]?.message || 'Failed to save medication');
    }
    return responseData;
}

async function deleteMedication(id: string) {
    const responseData = await api.delete(API_ROUTES.CLINIC_CATALOG.MEDICATIONS_DELETE, { id });
    if (Array.isArray(responseData) && responseData[0]?.code >= 400) {
        throw new Error(responseData[0]?.message || 'Failed to delete medication');
    }
    return responseData;
}

export default function MedicationsPage() {
    const t = useTranslations('MedicationsPage');
    const tColumns = useTranslations('MedicationsColumns');
    const { toast } = useToast();
    const { hasPermission } = usePermissions();
    const isNarrow = useViewportNarrow();

    const canCreate = hasPermission(CLINIC_CATALOG_PERMISSIONS.MEDICATIONS_CREATE);
    const canUpdate = hasPermission(CLINIC_CATALOG_PERMISSIONS.MEDICATIONS_UPDATE);
    const canDelete = hasPermission(CLINIC_CATALOG_PERMISSIONS.MEDICATIONS_DELETE);

    const [medications, setMedications] = React.useState<Medication[]>([]);
    const [totalItems, setTotalItems] = React.useState(0);
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
    const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
    const [selectedMedication, setSelectedMedication] = React.useState<Medication | null>(null);
    const [isEditing, setIsEditing] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);
    const [submissionError, setSubmissionError] = React.useState<string | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
    const [deletingMedication, setDeletingMedication] = React.useState<Medication | null>(null);

    const form = useForm<MedicationFormValues>({
        resolver: zodResolver(medicationFormSchema(t)),
        defaultValues: { nombre_generico: '', nombre_comercial: '' },
    });

    const loadMedications = React.useCallback(async () => {
        setIsRefreshing(true);
        const searchQuery = (columnFilters.find(f => f.id === 'nombre_generico')?.value as string) || '';
        const { medications: fetched, total } = await getMedications(pagination, searchQuery);
        setMedications(fetched);
        setTotalItems(total);
        setIsRefreshing(false);
    }, [pagination, columnFilters]);

    React.useEffect(() => {
        const debounce = setTimeout(() => { loadMedications(); }, 500);
        return () => clearTimeout(debounce);
    }, [loadMedications]);

    React.useEffect(() => {
        setPagination(prev => ({ ...prev, pageIndex: 0 }));
    }, [columnFilters]);

    const handleRowSelection = (rows: Medication[]) => {
        const medication = rows[0] ?? null;
        setSelectedMedication(medication);
        setIsEditing(false);
        setSubmissionError(null);
        if (medication) form.reset(medication);
    };

    const handleCreate = () => {
        setSelectedMedication(null);
        setRowSelection({});
        setIsEditing(true);
        setSubmissionError(null);
        form.reset({ nombre_generico: '', nombre_comercial: '' });
    };

    const handleClose = () => {
        setSelectedMedication(null);
        setRowSelection({});
        setIsEditing(false);
    };

    const handleBack = () => {
        if (isEditing && selectedMedication) {
            setIsEditing(false);
            form.reset(selectedMedication);
        } else {
            handleClose();
        }
    };

    const onSubmit = async (values: MedicationFormValues) => {
        setSubmissionError(null);
        setIsSaving(true);
        try {
            await upsertMedication(values);
            toast({ title: selectedMedication ? t('toast.editSuccessTitle') : t('toast.createSuccessTitle') });
            await loadMedications();
            setIsEditing(false);
            if (!values.id) handleClose();
        } catch (error) {
            setSubmissionError(error instanceof Error ? error.message : t('toast.genericError'));
        } finally {
            setIsSaving(false);
        }
    };

    const confirmDelete = async () => {
        if (!deletingMedication) return;
        try {
            await deleteMedication(deletingMedication.id);
            toast({ title: t('toast.deleteSuccessTitle') });
            setIsDeleteDialogOpen(false);
            setDeletingMedication(null);
            handleClose();
            loadMedications();
        } catch (error) {
            toast({ variant: 'destructive', title: t('toast.errorTitle'), description: error instanceof Error ? error.message : t('toast.deleteErrorDescription') });
        }
    };

    const columns: ColumnDef<Medication>[] = [
        { accessorKey: 'nombre_generico', header: ({ column }) => <DataTableColumnHeader column={column} title={tColumns('genericName')} /> },
        { accessorKey: 'nombre_comercial', header: ({ column }) => <DataTableColumnHeader column={column} title={tColumns('commercialName')} /> },
    ];

    const isRightOpen = !!selectedMedication || isEditing;

    const leftPanel = (
        <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm">
            <CardHeader className="flex-none p-4">
                <div className="flex items-start gap-3">
                    <div className="header-icon-circle mt-0.5"><Pill className="h-5 w-5" /></div>
                    <div>
                        <CardTitle className="text-lg">{t('title')}</CardTitle>
                        <CardDescription className="text-xs">{t('description')}</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden p-4 bg-card">
                <DataTable
                    columns={columns}
                    data={medications}
                    filterColumnId="nombre_generico"
                    filterPlaceholder={t('filterPlaceholder')}
                    onCreate={canCreate ? handleCreate : undefined}
                    onRefresh={loadMedications}
                    isRefreshing={isRefreshing}
                    enableSingleRowSelection
                    rowSelection={rowSelection}
                    setRowSelection={setRowSelection}
                    onRowSelectionChange={handleRowSelection}
                    isNarrow={isNarrow || !!selectedMedication}
                    pageCount={totalItems > 0 ? Math.ceil(totalItems / pagination.pageSize) : 0}
                    pagination={pagination}
                    onPaginationChange={setPagination}
                    manualPagination={true}
                    columnFilters={columnFilters}
                    onColumnFiltersChange={setColumnFilters}
                    renderCard={(row: Medication, _isSelected: boolean) => (
                        <DataCard isSelected={_isSelected}
                            title={row.nombre_generico}
                            subtitle={row.nombre_comercial || ''}
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
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                        <div className="header-icon-circle flex-none"><Pill className="h-5 w-5" /></div>
                        <CardTitle className="text-base lg:text-lg truncate">
                            {isEditing && !selectedMedication ? t('createDialog.title') : (selectedMedication?.nombre_generico ?? '')}
                        </CardTitle>
                    </div>
                    <div className="flex items-center gap-1 ml-2 flex-none">
                        {selectedMedication && !isEditing && canUpdate && (
                            <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => setIsEditing(true)}>
                                <Pencil className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">{tColumns('edit')}</span>
                            </Button>
                        )}
                        {selectedMedication && !isEditing && canDelete && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive" onClick={() => { setDeletingMedication(selectedMedication); setIsDeleteDialogOpen(true); }}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>
                {selectedMedication?.nombre_comercial && !isEditing && (
                    <p className="text-xs text-muted-foreground ml-10 mt-1">{selectedMedication.nombre_comercial}</p>
                )}
            </CardHeader>
            <Separator />
            <CardContent className="flex-1 overflow-auto p-4">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        {submissionError && (
                            <Alert variant="destructive">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>{t('toast.errorTitle')}</AlertTitle>
                                <AlertDescription>{submissionError}</AlertDescription>
                            </Alert>
                        )}
                        <FormField control={form.control} name="nombre_generico" render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('createDialog.genericName')}</FormLabel>
                                <FormControl><Input {...field} disabled={!isEditing} placeholder={t('createDialog.genericNamePlaceholder')} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="nombre_comercial" render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('createDialog.commercialName')}</FormLabel>
                                <FormControl><Input {...field} disabled={!isEditing} placeholder={t('createDialog.commercialNamePlaceholder')} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        {isEditing && (
                            <div className="flex gap-2 pt-2">
                                <Button type="button" variant="outline" onClick={() => { setIsEditing(false); if (selectedMedication) form.reset(selectedMedication); else handleClose(); }} disabled={isSaving}>
                                    {t('createDialog.cancel')}
                                </Button>
                                <Button type="submit" disabled={isSaving}>
                                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {selectedMedication ? t('createDialog.editSave') : t('createDialog.save')}
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
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('deleteDialog.title')}</AlertDialogTitle>
                        <AlertDialogDescription>{t('deleteDialog.description', { name: deletingMedication?.nombre_generico })}</AlertDialogDescription>
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
