'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataCard } from '@/components/ui/data-card';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { TwoPanelLayout } from '@/components/layout/two-panel-layout';
import { CLINIC_CATALOG_PERMISSIONS } from '@/constants/permissions';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';
import { DentalSurface } from '@/lib/types';
import api from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnDef, RowSelectionState } from '@tanstack/react-table';
import { AlertTriangle, Layers, Loader2, Pencil, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

const surfaceFormSchema = (t: (key: string) => string) => z.object({
    id: z.string().optional(),
    nombre: z.string().min(1, { message: t('validation.nameRequired') }),
    codigo: z.string().min(1, { message: t('validation.codeRequired') }),
});

type SurfaceFormValues = z.infer<ReturnType<typeof surfaceFormSchema>>;

async function getDentalSurfaces(): Promise<DentalSurface[]> {
    try {
        const data = await api.get(API_ROUTES.CLINIC_CATALOG.DENTAL_SURFACES);
        const surfacesData = Array.isArray(data) ? data : (data.catalogo_superficies_dentales || data.data || data.result || []);
        return surfacesData.map((apiSurface: any) => ({
            id: apiSurface.id ? String(apiSurface.id) : `surf_${Math.random().toString(36).substr(2, 9)}`,
            nombre: apiSurface.nombre,
            codigo: apiSurface.codigo,
        }));
    } catch (error) {
        console.error("Failed to fetch dental surfaces:", error);
        return [];
    }
}

async function upsertDentalSurface(surfaceData: SurfaceFormValues) {
    const responseData = await api.post(API_ROUTES.CLINIC_CATALOG.DENTAL_SURFACES_UPSERT, surfaceData);
    if (Array.isArray(responseData) && responseData[0]?.code >= 400) {
        throw new Error(responseData[0]?.message || 'Failed to save surface');
    }
    return responseData;
}

async function deleteDentalSurface(id: string) {
    const responseData = await api.delete(API_ROUTES.CLINIC_CATALOG.DENTAL_SURFACES_DELETE, { id });
    if (Array.isArray(responseData) && responseData[0]?.code >= 400) {
        throw new Error(responseData[0]?.message || 'Failed to delete surface');
    }
    return responseData;
}

export default function DentalSurfacesPage() {
    const t = useTranslations('DentalSurfacesPage');
    const tColumns = useTranslations('DentalSurfacesColumns');
    const { toast } = useToast();
    const { hasPermission } = usePermissions();
    const isNarrow = useViewportNarrow();

    const canCreate = hasPermission(CLINIC_CATALOG_PERMISSIONS.DENTAL_SURF_CREATE);
    const canUpdate = hasPermission(CLINIC_CATALOG_PERMISSIONS.DENTAL_SURF_UPDATE);
    const canDelete = hasPermission(CLINIC_CATALOG_PERMISSIONS.DENTAL_SURF_DELETE);

    const [surfaces, setSurfaces] = React.useState<DentalSurface[]>([]);
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
    const [selectedSurface, setSelectedSurface] = React.useState<DentalSurface | null>(null);
    const [isEditing, setIsEditing] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);
    const [submissionError, setSubmissionError] = React.useState<string | null>(null);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
    const [deletingSurface, setDeletingSurface] = React.useState<DentalSurface | null>(null);

    const form = useForm<SurfaceFormValues>({
        resolver: zodResolver(surfaceFormSchema(t)),
        defaultValues: { nombre: '', codigo: '' },
    });

    const loadSurfaces = React.useCallback(async () => {
        setIsRefreshing(true);
        const fetched = await getDentalSurfaces();
        setSurfaces(fetched);
        setIsRefreshing(false);
    }, []);

    React.useEffect(() => { loadSurfaces(); }, [loadSurfaces]);

    const handleRowSelection = (rows: DentalSurface[]) => {
        const surface = rows[0] ?? null;
        setSelectedSurface(surface);
        setSubmissionError(null);
        if (surface) {
            setIsEditing(false);
            form.reset(surface);
        }
    };

    const handleCreate = () => {
        setSelectedSurface(null);
        setRowSelection({});
        setIsEditing(true);
        setSubmissionError(null);
        form.reset({ nombre: '', codigo: '' });
        setIsCreateDialogOpen(true);
    };

    const handleClose = () => {
        setSelectedSurface(null);
        setRowSelection({});
        setIsEditing(false);
    };

    const handleBack = () => {
        if (isEditing && selectedSurface) {
            setIsEditing(false);
            form.reset(selectedSurface);
        } else {
            handleClose();
        }
    };

    const onSubmit = async (values: SurfaceFormValues) => {
        setSubmissionError(null);
        setIsSaving(true);
        try {
            await upsertDentalSurface(values);
            toast({ title: selectedSurface ? t('toast.editSuccessTitle') : t('toast.createSuccessTitle') });
            await loadSurfaces();
            setIsEditing(false);
            if (!values.id) {
                setIsCreateDialogOpen(false);
                handleClose();
            }
        } catch (error) {
            setSubmissionError(error instanceof Error ? error.message : t('toast.genericError'));
        } finally {
            setIsSaving(false);
        }
    };

    const confirmDelete = async () => {
        if (!deletingSurface) return;
        try {
            await deleteDentalSurface(deletingSurface.id);
            await loadSurfaces();
            toast({ title: t('toast.deleteSuccessTitle') });
            setIsDeleteDialogOpen(false);
            setDeletingSurface(null);
            handleClose();
        } catch (error) {
            toast({ variant: 'destructive', title: t('toast.errorTitle'), description: error instanceof Error ? error.message : t('toast.deleteErrorDescription') });
        }
    };

    const columns: ColumnDef<DentalSurface>[] = [
        { accessorKey: 'nombre', header: ({ column }) => <DataTableColumnHeader column={column} title={tColumns('name')} /> },
        { accessorKey: 'codigo', header: ({ column }) => <DataTableColumnHeader column={column} title={tColumns('code')} /> },
    ];

    const isRightOpen = !!selectedSurface;

    const leftPanel = (
        <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm">
            <CardHeader className="flex-none p-4">
                <div className="flex items-start gap-3">
                    <div className="header-icon-circle mt-0.5"><Layers className="h-5 w-5" /></div>
                    <div>
                        <CardTitle className="text-lg">{t('title')}</CardTitle>
                        <CardDescription className="text-xs">{t('description')}</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden p-4 bg-card">
                <DataTable
                    columns={columns}
                    data={surfaces}
                    filterColumnId="nombre"
                    filterPlaceholder={t('filterPlaceholder')}
                    onCreate={canCreate ? handleCreate : undefined}
                    onRefresh={loadSurfaces}
                    isRefreshing={isRefreshing}
                    enableSingleRowSelection
                    rowSelection={rowSelection}
                    setRowSelection={setRowSelection}
                    onRowSelectionChange={handleRowSelection}
                    isNarrow={isNarrow || !!selectedSurface}
                    renderCard={(row: DentalSurface, _isSelected: boolean) => (
                        <DataCard isSelected={_isSelected}
                            title={row.nombre}
                            subtitle={row.codigo}
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
                        <div className="header-icon-circle flex-none"><Layers className="h-5 w-5" /></div>
                        <CardTitle className="text-base lg:text-lg truncate">
                            {isEditing && !selectedSurface ? t('createDialog.title') : (selectedSurface?.nombre ?? '')}
                        </CardTitle>
                    </div>
                    <div className="flex items-center gap-1 ml-2 flex-none">
                        {selectedSurface && !isEditing && canUpdate && (
                            <Button aria-label={tColumns('edit')} variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => setIsEditing(true)}>
                                <Pencil className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">{tColumns('edit')}</span>
                            </Button>
                        )}
                        {selectedSurface && !isEditing && canDelete && (
                            <Button aria-label={tColumns('delete')} variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive" onClick={() => { setDeletingSurface(selectedSurface); setIsDeleteDialogOpen(true); }}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>
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
                        <FormField control={form.control} name="nombre" render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('createDialog.name')}</FormLabel>
                                <FormControl><Input {...field} disabled={!isEditing} placeholder={t('createDialog.namePlaceholder')} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="codigo" render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('createDialog.code')}</FormLabel>
                                <FormControl><Input {...field} disabled={!isEditing} placeholder={t('createDialog.codePlaceholder')} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        {isEditing && (
                            <div className="flex gap-2 pt-2">
                                <Button type="button" variant="outline" onClick={() => { setIsEditing(false); if (selectedSurface) form.reset(selectedSurface); else handleClose(); }} disabled={isSaving}>
                                    {t('createDialog.cancel')}
                                </Button>
                                <Button type="submit" disabled={isSaving}>
                                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {selectedSurface ? t('createDialog.editSave') : t('createDialog.save')}
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
                        <AlertDialogDescription>{t('deleteDialog.description', { name: deletingSurface?.nombre })}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('deleteDialog.cancel')}</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">{t('deleteDialog.confirm')}</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <Dialog
                open={isCreateDialogOpen}
                onOpenChange={(open) => {
                    setIsCreateDialogOpen(open);
                    if (!open) {
                        setIsEditing(false);
                        setSubmissionError(null);
                        form.reset({ nombre: '', codigo: '' });
                    }
                }}
            >
                <DialogContent maxWidth="lg">
                    <DialogHeader>
                        <DialogTitle>{t('createDialog.title')}</DialogTitle>
                        <DialogDescription>{t('createDialog.description')}</DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col min-h-0">
                            <DialogBody className="space-y-4 px-6 py-4">
                                {submissionError && (
                                    <Alert variant="destructive">
                                        <AlertTriangle className="h-4 w-4" />
                                        <AlertTitle>{t('toast.errorTitle')}</AlertTitle>
                                        <AlertDescription>{submissionError}</AlertDescription>
                                    </Alert>
                                )}
                                <FormField control={form.control} name="nombre" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('createDialog.name')}</FormLabel>
                                        <FormControl><Input {...field} placeholder={t('createDialog.namePlaceholder')} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="codigo" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('createDialog.code')}</FormLabel>
                                        <FormControl><Input {...field} placeholder={t('createDialog.codePlaceholder')} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </DialogBody>
                            <DialogFooter>
                                <Button type="button" variant="outline" disabled={isSaving} onClick={() => setIsCreateDialogOpen(false)}>
                                    {t('createDialog.cancel')}
                                </Button>
                                <Button type="submit" disabled={isSaving}>
                                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
