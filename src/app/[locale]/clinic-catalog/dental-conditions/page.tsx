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
import { DentalCondition } from '@/lib/types';
import api from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnDef, RowSelectionState } from '@tanstack/react-table';
import { AlertTriangle, Loader2, Pencil, Smile, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

const conditionFormSchema = (t: (key: string) => string) => z.object({
    id: z.string().optional(),
    nombre: z.string().min(1, { message: t('validation.nameRequired') }),
    codigo_visual: z.string().min(1, { message: t('validation.codeRequired') }),
    color_hex: z.string().regex(/^#[0-9a-fA-F]{6}$/, { message: t('validation.colorInvalid') }),
});

type ConditionFormValues = z.infer<ReturnType<typeof conditionFormSchema>>;

async function getDentalConditions(): Promise<DentalCondition[]> {
    try {
        const data = await api.get(API_ROUTES.CLINIC_CATALOG.DENTAL_CONDITIONS);
        const conditionsData = Array.isArray(data) ? data : (data.catalogo_condiciones_dentales || data.data || data.result || []);
        return conditionsData.map((apiCondition: any) => ({
            id: apiCondition.id ? String(apiCondition.id) : `cond_${Math.random().toString(36).substr(2, 9)}`,
            nombre: apiCondition.nombre,
            codigo_visual: apiCondition.codigo_visual,
            color_hex: apiCondition.color_hex,
        }));
    } catch (error) {
        console.error("Failed to fetch dental conditions:", error);
        return [];
    }
}

async function upsertDentalCondition(conditionData: ConditionFormValues) {
    const responseData = await api.post(API_ROUTES.CLINIC_CATALOG.DENTAL_CONDITIONS_UPSERT, conditionData);
    if (Array.isArray(responseData) && responseData[0]?.code >= 400) {
        throw new Error(responseData[0]?.message || 'Failed to save condition');
    }
    return responseData;
}

async function deleteDentalCondition(id: string) {
    const responseData = await api.delete(API_ROUTES.CLINIC_CATALOG.DENTAL_CONDITIONS_DELETE, { id });
    if (Array.isArray(responseData) && responseData[0]?.code >= 400) {
        throw new Error(responseData[0]?.message || 'Failed to delete condition');
    }
    return responseData;
}

export default function DentalConditionsPage() {
    const t = useTranslations('DentalConditionsPage');
    const tColumns = useTranslations('DentalConditionsColumns');
    const { toast } = useToast();
    const { hasPermission } = usePermissions();
    const isNarrow = useViewportNarrow();

    const canCreate = hasPermission(CLINIC_CATALOG_PERMISSIONS.DENTAL_COND_CREATE);
    const canUpdate = hasPermission(CLINIC_CATALOG_PERMISSIONS.DENTAL_COND_UPDATE);
    const canDelete = hasPermission(CLINIC_CATALOG_PERMISSIONS.DENTAL_COND_DELETE);

    const [conditions, setConditions] = React.useState<DentalCondition[]>([]);
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
    const [selectedCondition, setSelectedCondition] = React.useState<DentalCondition | null>(null);
    const [isEditing, setIsEditing] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);
    const [submissionError, setSubmissionError] = React.useState<string | null>(null);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
    const [deletingCondition, setDeletingCondition] = React.useState<DentalCondition | null>(null);

    const form = useForm<ConditionFormValues>({
        resolver: zodResolver(conditionFormSchema(t)),
        defaultValues: { nombre: '', codigo_visual: '', color_hex: '#ffffff' },
    });

    const loadConditions = React.useCallback(async () => {
        setIsRefreshing(true);
        const fetched = await getDentalConditions();
        setConditions(fetched);
        setIsRefreshing(false);
    }, []);

    React.useEffect(() => { loadConditions(); }, [loadConditions]);

    const handleRowSelection = (rows: DentalCondition[]) => {
        const condition = rows[0] ?? null;
        setSelectedCondition(condition);
        setSubmissionError(null);
        if (condition) {
            setIsEditing(false);
            form.reset({ ...condition, color_hex: condition.color_hex || '#ffffff' });
        }
    };

    const handleCreate = () => {
        setSelectedCondition(null);
        setRowSelection({});
        setIsEditing(true);
        setSubmissionError(null);
        form.reset({ nombre: '', codigo_visual: '', color_hex: '#ffffff' });
        setIsCreateDialogOpen(true);
    };

    const handleClose = () => {
        setSelectedCondition(null);
        setRowSelection({});
        setIsEditing(false);
    };

    const handleBack = () => {
        if (isEditing && selectedCondition) {
            setIsEditing(false);
            form.reset({ ...selectedCondition, color_hex: selectedCondition.color_hex || '#ffffff' });
        } else {
            handleClose();
        }
    };

    const onSubmit = async (values: ConditionFormValues) => {
        setSubmissionError(null);
        setIsSaving(true);
        try {
            await upsertDentalCondition(values);
            toast({ title: selectedCondition ? t('toast.editSuccessTitle') : t('toast.createSuccessTitle') });
            await loadConditions();
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
        if (!deletingCondition) return;
        try {
            await deleteDentalCondition(deletingCondition.id);
            toast({ title: t('toast.deleteSuccessTitle') });
            setIsDeleteDialogOpen(false);
            setDeletingCondition(null);
            handleClose();
            loadConditions();
        } catch (error) {
            toast({ variant: 'destructive', title: t('toast.errorTitle'), description: error instanceof Error ? error.message : t('toast.deleteErrorDescription') });
        }
    };

    const columns: ColumnDef<DentalCondition>[] = [
        { accessorKey: 'nombre', header: ({ column }) => <DataTableColumnHeader column={column} title={tColumns('name')} /> },
        { accessorKey: 'codigo_visual', header: ({ column }) => <DataTableColumnHeader column={column} title={tColumns('visualCode')} /> },
        {
            accessorKey: 'color_hex',
            header: ({ column }) => <DataTableColumnHeader column={column} title={tColumns('color')} />,
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <div className="h-5 w-5 rounded border border-border" style={{ backgroundColor: row.original.color_hex || '#ffffff' }} />
                    <span className="text-xs text-muted-foreground">{row.original.color_hex}</span>
                </div>
            ),
        },
    ];

    const isRightOpen = !!selectedCondition;

    const leftPanel = (
        <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm">
            <CardHeader className="flex-none p-4">
                <div className="flex items-start gap-3">
                    <div className="header-icon-circle mt-0.5"><Smile className="h-5 w-5" /></div>
                    <div>
                        <CardTitle className="text-lg">{t('title')}</CardTitle>
                        <CardDescription className="text-xs">{t('description')}</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden p-4 bg-card">
                <DataTable
                    columns={columns}
                    data={conditions}
                    filterColumnId="nombre"
                    filterPlaceholder={t('filterPlaceholder')}
                    onCreate={canCreate ? handleCreate : undefined}
                    onRefresh={loadConditions}
                    isRefreshing={isRefreshing}
                    enableSingleRowSelection
                    rowSelection={rowSelection}
                    setRowSelection={setRowSelection}
                    onRowSelectionChange={handleRowSelection}
                    isNarrow={isNarrow || !!selectedCondition}
                    renderCard={(row: DentalCondition, _isSelected: boolean) => (
                        <DataCard isSelected={_isSelected}
                            title={row.nombre}
                            subtitle={row.codigo_visual}
                            accentColor={row.color_hex || undefined}
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
                        <div className="header-icon-circle flex-none"><Smile className="h-5 w-5" /></div>
                        <CardTitle className="text-base lg:text-lg truncate">
                            {isEditing && !selectedCondition ? t('createDialog.title') : (selectedCondition?.nombre ?? '')}
                        </CardTitle>
                    </div>
                    <div className="flex items-center gap-1 ml-2 flex-none">
                        {selectedCondition && !isEditing && canUpdate && (
                            <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => setIsEditing(true)}>
                                <Pencil className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">{tColumns('edit')}</span>
                            </Button>
                        )}
                        {selectedCondition && !isEditing && canDelete && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive" onClick={() => { setDeletingCondition(selectedCondition); setIsDeleteDialogOpen(true); }}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>
                {selectedCondition && !isEditing && (
                    <div className="mt-2 ml-10">
                        <div className="flex items-center gap-2">
                            <div className="h-5 w-5 rounded border border-border" style={{ backgroundColor: selectedCondition.color_hex || '#ffffff' }} />
                            <span className="text-xs text-muted-foreground">{selectedCondition.color_hex}</span>
                        </div>
                    </div>
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
                        <FormField control={form.control} name="nombre" render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('createDialog.name')}</FormLabel>
                                <FormControl><Input {...field} disabled={!isEditing} placeholder={t('createDialog.namePlaceholder')} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="codigo_visual" render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('createDialog.visualCode')}</FormLabel>
                                <FormControl><Input {...field} disabled={!isEditing} placeholder={t('createDialog.visualCodePlaceholder')} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="color_hex" render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('createDialog.color')}</FormLabel>
                                <FormControl>
                                    <div className="flex items-center gap-2">
                                        <Input type="color" className="p-1 h-10 w-14" {...field} disabled={!isEditing} />
                                        <Input placeholder="#FFFFFF" {...field} disabled={!isEditing} />
                                    </div>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        {isEditing && (
                            <div className="flex gap-2 pt-2">
                                <Button type="button" variant="outline" onClick={() => { setIsEditing(false); if (selectedCondition) form.reset({ ...selectedCondition, color_hex: selectedCondition.color_hex || '#ffffff' }); else handleClose(); }} disabled={isSaving}>
                                    {t('createDialog.cancel')}
                                </Button>
                                <Button type="submit" disabled={isSaving}>
                                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {selectedCondition ? t('createDialog.editSave') : t('createDialog.save')}
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
                        <AlertDialogDescription>{t('deleteDialog.description', { name: deletingCondition?.nombre })}</AlertDialogDescription>
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
                        form.reset({ nombre: '', codigo_visual: '', color_hex: '#ffffff' });
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
                                <FormField control={form.control} name="codigo_visual" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('createDialog.visualCode')}</FormLabel>
                                        <FormControl><Input {...field} placeholder={t('createDialog.visualCodePlaceholder')} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="color_hex" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('createDialog.color')}</FormLabel>
                                        <FormControl>
                                            <div className="flex items-center gap-2">
                                                <Input type="color" className="p-1 h-10 w-14" {...field} />
                                                <Input placeholder="#FFFFFF" {...field} />
                                            </div>
                                        </FormControl>
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
