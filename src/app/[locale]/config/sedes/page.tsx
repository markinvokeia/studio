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
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
import { Separator } from '@/components/ui/separator';
import { TwoPanelLayout } from '@/components/layout/two-panel-layout';
import { BUSINESS_CONFIG_PERMISSIONS } from '@/constants/permissions';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';
import { Clinic, Sede } from '@/lib/types';
import api from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnDef, RowSelectionState } from '@tanstack/react-table';
import { AlertTriangle, Building2, Loader2, MapPin, Pencil, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

const sedeFormSchema = (t: (key: string) => string) => z.object({
    id: z.string().optional(),
    name: z.string().min(1, t('SedesPage.validation.nameRequired')),
    address: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional().refine(val => {
        if (!val || val.trim() === '') return true;
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
    }, { message: t('SedesPage.validation.emailInvalid') }),
    is_active: z.boolean().default(true),
});

type SedeFormValues = z.infer<ReturnType<typeof sedeFormSchema>>;

async function getSedes(): Promise<Sede[]> {
    try {
        const data = await api.get(API_ROUTES.SEDES, { page: '1', limit: '200' });
        const raw = Array.isArray(data) ? data : (data.sedes || data.data || data.result || []);
        return raw.map((s: any) => ({
            id: String(s.id),
            clinic_id: String(s.clinic_id),
            name: s.name || '',
            address: s.address || undefined,
            phone: s.phone || undefined,
            email: s.email || undefined,
            is_active: s.is_active !== undefined ? s.is_active : true,
            created_at: s.created_at,
            updated_at: s.updated_at,
        }));
    } catch {
        return [];
    }
}

async function getClinicId(): Promise<string> {
    try {
        const data = await api.get(API_ROUTES.CLINIC);
        const clinic: Clinic = Array.isArray(data) ? data[0] : data;
        return String(clinic.id);
    } catch {
        return '';
    }
}

async function upsertSede(sedeData: SedeFormValues & { clinic_id: string }) {
    const payload: any = {
        clinic_id: Number(sedeData.clinic_id),
        name: sedeData.name,
        address: sedeData.address || null,
        phone: sedeData.phone || null,
        email: sedeData.email || null,
        is_active: sedeData.is_active,
    };
    if (sedeData.id) payload.id = Number(sedeData.id);
    const responseData = await api.post(API_ROUTES.SEDE_UPSERT, payload);
    if (Array.isArray(responseData) && responseData[0]?.code >= 400) {
        throw new Error(responseData[0]?.message || 'Failed to save sede');
    }
    return responseData;
}

async function deleteSede(id: string) {
    const responseData = await api.delete(API_ROUTES.SEDE_DELETE, { id: Number(id) });
    if (Array.isArray(responseData) && responseData[0]?.code >= 400) {
        throw new Error(responseData[0]?.message || 'Failed to delete sede');
    }
    return responseData;
}

export default function SedesPage() {
    const t = useTranslations();
    const { toast } = useToast();
    const isNarrow = useViewportNarrow();
    const { hasPermission } = usePermissions();

    const canCreate = hasPermission(BUSINESS_CONFIG_PERMISSIONS.SEDES_CREATE);
    const canUpdate = hasPermission(BUSINESS_CONFIG_PERMISSIONS.SEDES_UPDATE);
    const canDelete = hasPermission(BUSINESS_CONFIG_PERMISSIONS.SEDES_DELETE);

    const [sedes, setSedes] = React.useState<Sede[]>([]);
    const [clinicId, setClinicId] = React.useState('');
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
    const [selectedSede, setSelectedSede] = React.useState<Sede | null>(null);
    const [isEditing, setIsEditing] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);
    const [submissionError, setSubmissionError] = React.useState<string | null>(null);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
    const [deletingSede, setDeletingSede] = React.useState<Sede | null>(null);

    const form = useForm<SedeFormValues>({
        resolver: zodResolver(sedeFormSchema(t)),
        defaultValues: { name: '', address: '', phone: '', email: '', is_active: true },
    });

    const loadSedes = React.useCallback(async () => {
        setIsRefreshing(true);
        const fetched = await getSedes();
        setSedes(fetched);
        setIsRefreshing(false);
    }, []);

    React.useEffect(() => {
        loadSedes();
        getClinicId().then(setClinicId);
    }, [loadSedes]);

    const resetForm = (sede?: Sede) => {
        form.reset({
            id: sede?.id,
            name: sede?.name || '',
            address: sede?.address || '',
            phone: sede?.phone || '',
            email: sede?.email || '',
            is_active: sede?.is_active ?? true,
        });
    };

    const handleRowSelection = (rows: Sede[]) => {
        const sede = rows[0] ?? null;
        setSelectedSede(sede);
        setSubmissionError(null);
        setIsEditing(false);
        if (sede) resetForm(sede);
    };

    const handleCreate = () => {
        setSelectedSede(null);
        setRowSelection({});
        setIsEditing(true);
        setSubmissionError(null);
        form.reset({ name: '', address: '', phone: '', email: '', is_active: true });
        setIsCreateDialogOpen(true);
    };

    const handleClose = () => {
        setSelectedSede(null);
        setRowSelection({});
        setIsEditing(false);
    };

    const handleBack = () => {
        if (isEditing && selectedSede) {
            setIsEditing(false);
            resetForm(selectedSede);
        } else {
            handleClose();
        }
    };

    const onSubmit = async (values: SedeFormValues) => {
        setSubmissionError(null);
        setIsSaving(true);
        try {
            await upsertSede({ ...values, clinic_id: clinicId });
            toast({ title: selectedSede ? t('SedesPage.toast.editSuccess') : t('SedesPage.toast.createSuccess') });
            await loadSedes();
            setIsEditing(false);
            if (!values.id) {
                setIsCreateDialogOpen(false);
                handleClose();
            }
        } catch (error) {
            setSubmissionError(error instanceof Error ? error.message : t('SedesPage.toast.genericError'));
        } finally {
            setIsSaving(false);
        }
    };

    const confirmDelete = async () => {
        if (!deletingSede) return;
        try {
            await deleteSede(deletingSede.id);
            toast({ title: t('SedesPage.toast.deleteSuccess') });
            setIsDeleteDialogOpen(false);
            setDeletingSede(null);
            handleClose();
            loadSedes();
        } catch {
            toast({ variant: 'destructive', title: t('SedesPage.toast.errorTitle'), description: t('SedesPage.toast.deleteError') });
        }
    };

    const columns: ColumnDef<Sede>[] = [
        { accessorKey: 'name', header: ({ column }) => <DataTableColumnHeader column={column} title={t('SedesPage.columns.name')} /> },
        {
            accessorKey: 'address',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('SedesPage.columns.address')} />,
            cell: ({ row }) => <span className="text-muted-foreground text-sm">{row.original.address || '—'}</span>,
        },
        {
            accessorKey: 'phone',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('SedesPage.columns.phone')} />,
            cell: ({ row }) => <span className="text-muted-foreground text-sm">{row.original.phone || '—'}</span>,
        },
        {
            accessorKey: 'email',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('SedesPage.columns.email')} />,
            cell: ({ row }) => <span className="text-muted-foreground text-sm">{row.original.email || '—'}</span>,
        },
        {
            accessorKey: 'is_active',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('SedesPage.columns.status')} />,
            cell: ({ row }) => (
                <Badge variant={row.original.is_active ? 'success' : 'outline'} className="text-[10px]">
                    {row.original.is_active ? t('SedesPage.active') : t('SedesPage.inactive')}
                </Badge>
            ),
        },
    ];

    const sedeForm = (disabled: boolean) => (
        <div className="space-y-4">
            {submissionError && (
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>{t('SedesPage.toast.errorTitle')}</AlertTitle>
                    <AlertDescription>{submissionError}</AlertDescription>
                </Alert>
            )}
            <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                    <FormLabel>{t('SedesPage.form.name')}</FormLabel>
                    <FormControl><Input {...field} disabled={disabled} placeholder={t('SedesPage.form.namePlaceholder')} /></FormControl>
                    <FormMessage />
                </FormItem>
            )} />
            <FormField control={form.control} name="address" render={({ field }) => (
                <FormItem>
                    <FormLabel>{t('SedesPage.form.address')}</FormLabel>
                    <FormControl><Input {...field} disabled={disabled} placeholder={t('SedesPage.form.addressPlaceholder')} /></FormControl>
                    <FormMessage />
                </FormItem>
            )} />
            <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem>
                    <FormLabel>{t('SedesPage.form.phone')}</FormLabel>
                    <FormControl>
                        <PhoneInput {...field} defaultCountry="UY" disabled={disabled} placeholder={t('SedesPage.form.phonePlaceholder')} onChange={field.onChange} value={field.value} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )} />
            <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                    <FormLabel>{t('SedesPage.form.email')}</FormLabel>
                    <FormControl><Input type="email" {...field} disabled={disabled} placeholder={t('SedesPage.form.emailPlaceholder')} /></FormControl>
                    <FormMessage />
                </FormItem>
            )} />
            <FormField control={form.control} name="is_active" render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-lg border p-3">
                    <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={disabled} /></FormControl>
                    <FormLabel className="font-normal">{t('SedesPage.form.isActive')}</FormLabel>
                </FormItem>
            )} />
        </div>
    );

    const leftPanel = (
        <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm">
            <CardHeader className="flex-none p-4">
                <div className="flex items-start gap-3">
                    <div className="header-icon-circle mt-0.5"><Building2 className="h-5 w-5" /></div>
                    <div>
                        <CardTitle className="text-lg">{t('Navigation.Sedes')}</CardTitle>
                        <CardDescription className="text-xs">{t('SedesPage.description')}</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden p-4 bg-card">
                <DataTable
                    columns={columns}
                    data={sedes}
                    filterColumnId="name"
                    filterPlaceholder={t('SedesPage.filterPlaceholder')}
                    onCreate={canCreate ? handleCreate : undefined}
                    onRefresh={loadSedes}
                    isRefreshing={isRefreshing}
                    enableSingleRowSelection
                    rowSelection={rowSelection}
                    setRowSelection={setRowSelection}
                    onRowSelectionChange={handleRowSelection}
                    isNarrow={isNarrow || !!selectedSede}
                    renderCard={(row: Sede, _isSelected: boolean) => (
                        <DataCard
                            isSelected={_isSelected}
                            title={row.name}
                            subtitle={row.address}
                            badge={<Badge variant={row.is_active ? 'success' : 'outline'} className="text-[10px]">{row.is_active ? t('SedesPage.active') : t('SedesPage.inactive')}</Badge>}
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
                        <div className="header-icon-circle flex-none"><Building2 className="h-5 w-5" /></div>
                        <CardTitle className="text-base lg:text-lg truncate">
                            {selectedSede?.name ?? ''}
                        </CardTitle>
                    </div>
                    <div className="flex items-center gap-1 ml-2 flex-none">
                        {selectedSede && !isEditing && canUpdate && (
                            <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => setIsEditing(true)}>
                                <Pencil className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">{t('SedesPage.form.edit')}</span>
                            </Button>
                        )}
                        {selectedSede && !isEditing && canDelete && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive" onClick={() => { setDeletingSede(selectedSede); setIsDeleteDialogOpen(true); }}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>
                {selectedSede && !isEditing && (
                    <div className="ml-10 mt-1 flex items-center gap-2">
                        <Badge variant={selectedSede.is_active ? 'success' : 'outline'} className="text-[10px]">
                            {selectedSede.is_active ? t('SedesPage.active') : t('SedesPage.inactive')}
                        </Badge>
                        {selectedSede.address && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <MapPin className="h-3 w-3" />{selectedSede.address}
                            </span>
                        )}
                    </div>
                )}
            </CardHeader>
            <Separator />
            <CardContent className="flex-1 overflow-auto p-4">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        {sedeForm(!isEditing)}
                        {isEditing && (
                            <div className="flex gap-2 pt-2">
                                <Button type="button" variant="outline" onClick={() => { setIsEditing(false); if (selectedSede) resetForm(selectedSede); else handleClose(); }} disabled={isSaving}>
                                    {t('SedesPage.form.cancel')}
                                </Button>
                                <Button type="submit" disabled={isSaving}>
                                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {t('SedesPage.form.save')}
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
                isRightPanelOpen={!!selectedSede}
                onBack={handleBack}
                leftPanelDefaultSize={40}
                rightPanelDefaultSize={60}
            />

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('SedesPage.deleteDialog.title')}</AlertDialogTitle>
                        <AlertDialogDescription>{t('SedesPage.deleteDialog.description', { name: deletingSede?.name })}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('SedesPage.deleteDialog.cancel')}</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">
                            {t('SedesPage.deleteDialog.delete')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
                setIsCreateDialogOpen(open);
                if (!open) { setIsEditing(false); setSubmissionError(null); form.reset({ name: '', address: '', phone: '', email: '', is_active: true }); }
            }}>
                <DialogContent maxWidth="lg">
                    <DialogHeader>
                        <DialogTitle>{t('SedesPage.form.createTitle')}</DialogTitle>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col min-h-0">
                            <DialogBody className="space-y-4 px-6 py-4">
                                {sedeForm(false)}
                            </DialogBody>
                            <DialogFooter>
                                <Button type="button" variant="outline" disabled={isSaving} onClick={() => setIsCreateDialogOpen(false)}>
                                    {t('SedesPage.form.cancel')}
                                </Button>
                                <Button type="submit" disabled={isSaving}>
                                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {t('SedesPage.form.create')}
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
