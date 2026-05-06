'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataCard } from '@/components/ui/data-card';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { TwoPanelLayout } from '@/components/layout/two-panel-layout';
import { CLINIC_CATALOG_PERMISSIONS } from '@/constants/permissions';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';
import { Ailment } from '@/lib/types';
import api from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnDef, RowSelectionState } from '@tanstack/react-table';
import { AlertTriangle, HeartPulse, Loader2, Pencil, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

const ailmentFormSchema = (t: (key: string) => string) => z.object({
    id: z.string().optional(),
    nombre: z.string().min(1, { message: t('validation.nameRequired') }),
    categoria: z.string().min(1, { message: t('validation.categoryRequired') }),
    nivel_alerta: z.string().min(1, { message: t('validation.alertLevelRequired') }),
});

type AilmentFormValues = z.infer<ReturnType<typeof ailmentFormSchema>>;

async function getAilments(): Promise<Ailment[]> {
    try {
        const data = await api.get(API_ROUTES.CLINIC_CATALOG.AILMENTS);
        const ailmentsData = Array.isArray(data) ? data : (data.catalogo_padecimientos || data.data || data.result || []);
        return ailmentsData.map((apiAilment: any) => ({
            id: String(apiAilment.id),
            nombre: apiAilment.nombre,
            categoria: apiAilment.categoria,
            nivel_alerta: Number(apiAilment.nivel_alerta),
        }));
    } catch (error) {
        console.error("Failed to fetch ailments:", error);
        return [];
    }
}

async function upsertAilment(ailmentData: AilmentFormValues) {
    const responseData = await api.post(API_ROUTES.CLINIC_CATALOG.AILMENTS_UPSERT, {
        ...ailmentData,
        nivel_alerta: Number(ailmentData.nivel_alerta),
    });
    if (Array.isArray(responseData) && responseData[0]?.code >= 400) {
        throw new Error(responseData[0]?.message || 'Failed to save ailment');
    }
    return responseData;
}

async function deleteAilment(id: string) {
    const responseData = await api.delete(API_ROUTES.CLINIC_CATALOG.AILMENTS_DELETE, { id });
    if (Array.isArray(responseData) && responseData[0]?.code >= 400) {
        throw new Error(responseData[0]?.message || 'Failed to delete ailment');
    }
    return responseData;
}

export default function AilmentsPage() {
    const t = useTranslations('AilmentsPage');
    const tColumns = useTranslations('AilmentsColumns');
    const { toast } = useToast();
    const { hasPermission } = usePermissions();
    const isNarrow = useViewportNarrow();

    const canCreate = hasPermission(CLINIC_CATALOG_PERMISSIONS.CONDITIONS_CREATE);
    const canUpdate = hasPermission(CLINIC_CATALOG_PERMISSIONS.CONDITIONS_UPDATE);
    const canDelete = hasPermission(CLINIC_CATALOG_PERMISSIONS.CONDITIONS_DELETE);

    const [ailments, setAilments] = React.useState<Ailment[]>([]);
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
    const [selectedAilment, setSelectedAilment] = React.useState<Ailment | null>(null);
    const [isEditing, setIsEditing] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);
    const [submissionError, setSubmissionError] = React.useState<string | null>(null);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
    const [deletingAilment, setDeletingAilment] = React.useState<Ailment | null>(null);

    const form = useForm<AilmentFormValues>({
        resolver: zodResolver(ailmentFormSchema(t)),
        defaultValues: { nombre: '', categoria: '', nivel_alerta: '' },
    });

    const loadAilments = React.useCallback(async () => {
        setIsRefreshing(true);
        const fetched = await getAilments();
        setAilments(fetched);
        setIsRefreshing(false);
    }, []);

    React.useEffect(() => { loadAilments(); }, [loadAilments]);

    const handleRowSelection = (rows: Ailment[]) => {
        const ailment = rows[0] ?? null;
        setSelectedAilment(ailment);
        setSubmissionError(null);
        if (ailment) {
            setIsEditing(false);
            form.reset({ ...ailment, nivel_alerta: String(ailment.nivel_alerta) });
        }
    };

    const handleCreate = () => {
        setSelectedAilment(null);
        setRowSelection({});
        setIsEditing(true);
        setSubmissionError(null);
        form.reset({ nombre: '', categoria: '', nivel_alerta: '' });
        setIsCreateDialogOpen(true);
    };

    const handleClose = () => {
        setSelectedAilment(null);
        setRowSelection({});
        setIsEditing(false);
    };

    const handleBack = () => {
        if (isEditing && selectedAilment) {
            setIsEditing(false);
            form.reset({ ...selectedAilment, nivel_alerta: String(selectedAilment.nivel_alerta) });
        } else {
            handleClose();
        }
    };

    const onSubmit = async (values: AilmentFormValues) => {
        setSubmissionError(null);
        setIsSaving(true);
        try {
            await upsertAilment(values);
            toast({ title: selectedAilment ? t('toast.editSuccessTitle') : t('toast.createSuccessTitle') });
            await loadAilments();
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
        if (!deletingAilment) return;
        try {
            await deleteAilment(deletingAilment.id);
            toast({ title: t('toast.deleteSuccessTitle') });
            setIsDeleteDialogOpen(false);
            setDeletingAilment(null);
            handleClose();
            loadAilments();
        } catch (error) {
            toast({ variant: 'destructive', title: t('toast.errorTitle'), description: error instanceof Error ? error.message : t('toast.deleteErrorDescription') });
        }
    };

    const columns: ColumnDef<Ailment>[] = [
        { accessorKey: 'nombre', header: ({ column }) => <DataTableColumnHeader column={column} title={tColumns('name')} /> },
        { accessorKey: 'categoria', header: ({ column }) => <DataTableColumnHeader column={column} title={tColumns('category')} /> },
        {
            accessorKey: 'nivel_alerta',
            header: ({ column }) => <DataTableColumnHeader column={column} title={tColumns('alertLevel')} />,
            cell: ({ row }) => <Badge variant="outline">{row.original.nivel_alerta}</Badge>,
        },
    ];

    const isRightOpen = !!selectedAilment;

    const leftPanel = (
        <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm">
            <CardHeader className="flex-none p-4">
                <div className="flex items-start gap-3">
                    <div className="header-icon-circle mt-0.5"><HeartPulse className="h-5 w-5" /></div>
                    <div>
                        <CardTitle className="text-lg">{t('title')}</CardTitle>
                        <CardDescription className="text-xs">{t('description')}</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden p-4 bg-card">
                <DataTable
                    columns={columns}
                    data={ailments}
                    filterColumnId="nombre"
                    filterPlaceholder={t('filterPlaceholder')}
                    onCreate={canCreate ? handleCreate : undefined}
                    onRefresh={loadAilments}
                    isRefreshing={isRefreshing}
                    enableSingleRowSelection
                    rowSelection={rowSelection}
                    setRowSelection={setRowSelection}
                    onRowSelectionChange={handleRowSelection}
                    isNarrow={isNarrow || !!selectedAilment}
                    renderCard={(row: Ailment, _isSelected: boolean) => (
                        <DataCard isSelected={_isSelected}
                            title={row.nombre}
                            subtitle={row.categoria}
                            badge={<Badge variant="outline" className="text-[10px]">{row.nivel_alerta}</Badge>}
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
                        <div className="header-icon-circle flex-none"><HeartPulse className="h-5 w-5" /></div>
                        <CardTitle className="text-base lg:text-lg truncate">
                            {isEditing && !selectedAilment ? t('createDialog.title') : (selectedAilment?.nombre ?? '')}
                        </CardTitle>
                    </div>
                    <div className="flex items-center gap-1 ml-2 flex-none">
                        {selectedAilment && !isEditing && canUpdate && (
                            <Button aria-label={tColumns('edit')} variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => setIsEditing(true)}>
                                <Pencil className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">{tColumns('edit')}</span>
                            </Button>
                        )}
                        {selectedAilment && !isEditing && canDelete && (
                            <Button aria-label={tColumns('delete')} variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive" onClick={() => { setDeletingAilment(selectedAilment); setIsDeleteDialogOpen(true); }}>
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
                        <FormField control={form.control} name="categoria" render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('createDialog.category')}</FormLabel>
                                <FormControl><Input {...field} disabled={!isEditing} placeholder={t('createDialog.categoryPlaceholder')} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="nivel_alerta" render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('createDialog.alertLevel')}</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value} disabled={!isEditing}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder={t('createDialog.alertLevelPlaceholder')} />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="1">{t('createDialog.level1')}</SelectItem>
                                        <SelectItem value="2">{t('createDialog.level2')}</SelectItem>
                                        <SelectItem value="3">{t('createDialog.level3')}</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )} />
                        {isEditing && (
                            <div className="flex gap-2 pt-2">
                                <Button type="button" variant="outline" onClick={() => { setIsEditing(false); if (selectedAilment) form.reset({ ...selectedAilment, nivel_alerta: String(selectedAilment.nivel_alerta) }); else handleClose(); }} disabled={isSaving}>
                                    {t('createDialog.cancel')}
                                </Button>
                                <Button type="submit" disabled={isSaving}>
                                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {selectedAilment ? t('createDialog.editSave') : t('createDialog.save')}
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
                        <AlertDialogDescription>{t('deleteDialog.description', { name: deletingAilment?.nombre })}</AlertDialogDescription>
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
                        form.reset({ nombre: '', categoria: '', nivel_alerta: '' });
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
                                <FormField control={form.control} name="categoria" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('createDialog.category')}</FormLabel>
                                        <FormControl><Input {...field} placeholder={t('createDialog.categoryPlaceholder')} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="nivel_alerta" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('createDialog.alertLevel')}</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder={t('createDialog.alertLevelPlaceholder')} />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="1">{t('createDialog.level1')}</SelectItem>
                                                <SelectItem value="2">{t('createDialog.level2')}</SelectItem>
                                                <SelectItem value="3">{t('createDialog.level3')}</SelectItem>
                                            </SelectContent>
                                        </Select>
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
