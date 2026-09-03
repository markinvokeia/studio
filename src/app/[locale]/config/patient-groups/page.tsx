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
import { Dialog, DialogBody, DialogCancelButton, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { TwoPanelLayout } from '@/components/layout/two-panel-layout';
import { PatientGroupExportButton, PatientGroupsExportAllButton } from '@/components/patients/patient-group-export-buttons';
import { PatientGroupPatientsTab } from '@/components/patients/patient-group-patients-tab';
import { PatientGroupServicesTab } from '@/components/patients/patient-group-services-tab';
import { BUSINESS_CONFIG_PERMISSIONS } from '@/constants/permissions';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';
import { PatientGroup } from '@/lib/types';
import api from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnDef, ColumnFiltersState, PaginationState, RowSelectionState } from '@tanstack/react-table';
import { AlertTriangle, Loader2, Trash2, UsersRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

const patientGroupFormSchema = (t: (key: string) => string) => z.object({
    id: z.union([z.string(), z.number()]).optional(),
    name: z.string().min(1, { message: t('validation.nameRequired') }),
    description: z.string().optional(),
    is_active: z.boolean().default(true),
    is_doctor: z.boolean().default(false),
    user_id: z.string().optional().nullable(),
}).refine((data) => !data.is_doctor || !!data.user_id, {
    message: t('validation.doctorRequired'),
    path: ['user_id'],
});

type PatientGroupFormValues = z.infer<ReturnType<typeof patientGroupFormSchema>>;

type PatientGroupResponse = { patientGroups: PatientGroup[]; total: number };

type DoctorOption = { id: string; name: string };

async function getDoctors(): Promise<DoctorOption[]> {
    try {
        const data = await api.get(API_ROUTES.USERS, {
            page: '1',
            limit: '500',
            search: '',
            filter_type: 'DOCTOR',
            only_active: 'true',
        });

        let usersData: any[] = [];
        if (Array.isArray(data) && data.length > 0) {
            const firstElement = data[0];
            if (firstElement.json && typeof firstElement.json === 'object') {
                usersData = firstElement.json.data || [];
            } else if (firstElement.data) {
                usersData = firstElement.data;
            } else if ('id' in firstElement) {
                usersData = data;
            }
        } else if (typeof data === 'object' && data !== null && (data as any).data) {
            usersData = (data as any).data;
        }

        return usersData
            .map((u: any) => ({ id: String(u.id), name: u.name || '' }))
            .filter((d: DoctorOption) => d.id && d.id !== 'undefined');
    } catch (error) {
        console.error('Failed to fetch doctors:', error);
        return [];
    }
}

async function getPatientGroups(pagination: PaginationState, searchQuery: string): Promise<PatientGroupResponse> {
    try {
        const searchValue = searchQuery.length >= 3 ? searchQuery : '';
        const data = await api.get(API_ROUTES.PATIENT_GROUPS, {
            search: searchValue,
            page: (pagination.pageIndex + 1).toString(),
            limit: pagination.pageSize.toString(),
        });

        let patientGroupsData: any[] = [];
        let total = 0;

        if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object' && 'id' in data[0] && !('json' in data[0])) {
            patientGroupsData = data;
            total = data.length;
        } else if (Array.isArray(data) && data.length > 0) {
            const firstElement = data[0];
            if (firstElement.json && typeof firstElement.json === 'object') {
                patientGroupsData = firstElement.json.data || [];
                total = Number(firstElement.json.total_items) || patientGroupsData.length;
            } else if (firstElement.data) {
                patientGroupsData = firstElement.data;
                total = Number(firstElement.total_items) || patientGroupsData.length;
            }
        } else if (typeof data === 'object' && data !== null) {
            const responseObj = (data as any)[0]?.json || data;
            patientGroupsData = (responseObj as any).data || [];
            total = Number((responseObj as any).total_items) || patientGroupsData.length;
        }

        const patientGroups = patientGroupsData
            .map((g: any) => ({
                id: g.id,
                name: g.name,
                description: g.description,
                is_active: g.is_active ?? true,
                is_doctor: g.is_doctor ?? false,
                user_id: g.user_id ?? null,
                external_id: g.external_id ?? null,
                created_at: g.created_at,
                updated_at: g.updated_at,
            }))
            .filter((g: PatientGroup) => g.id !== undefined && g.id !== null);

        return { patientGroups, total };
    } catch (error) {
        console.error("Failed to fetch patient groups:", error);
        return { patientGroups: [], total: 0 };
    }
}

async function upsertPatientGroup(patientGroupData: PatientGroupFormValues) {
    const responseData = await api.post(API_ROUTES.PATIENT_GROUP_UPSERT, patientGroupData);
    if (Array.isArray(responseData) && responseData[0]?.code >= 400) {
        throw new Error(responseData[0]?.message || 'Failed to save patient group');
    }
    return responseData;
}

async function deletePatientGroup(id: string) {
    const responseData = await api.delete(API_ROUTES.PATIENT_GROUP_DELETE, { id });
    if (Array.isArray(responseData) && responseData[0]?.code >= 400) {
        throw new Error(responseData[0]?.message || 'Failed to delete patient group');
    }
    return responseData;
}

export default function PatientGroupsPage() {
    const t = useTranslations('PatientGroupsPage');
    const tColumns = useTranslations('PatientGroupsColumns');
    const { toast } = useToast();
    const { hasPermission } = usePermissions();
    const isNarrow = useViewportNarrow();

    const canCreate = hasPermission(BUSINESS_CONFIG_PERMISSIONS.PATIENT_GROUPS_CREATE);
    const canUpdate = hasPermission(BUSINESS_CONFIG_PERMISSIONS.PATIENT_GROUPS_UPDATE);
    const canDelete = hasPermission(BUSINESS_CONFIG_PERMISSIONS.PATIENT_GROUPS_DELETE);

    const [patientGroups, setPatientGroups] = React.useState<PatientGroup[]>([]);
    const [totalItems, setTotalItems] = React.useState(0);
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize: 25 });
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
    const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
    const [selectedPatientGroup, setSelectedPatientGroup] = React.useState<PatientGroup | null>(null);
    const [isEditing, setIsEditing] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);
    const [submissionError, setSubmissionError] = React.useState<string | null>(null);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
    const [deletingPatientGroup, setDeletingPatientGroup] = React.useState<PatientGroup | null>(null);

    const [doctors, setDoctors] = React.useState<DoctorOption[]>([]);

    const form = useForm<PatientGroupFormValues>({
        resolver: zodResolver(patientGroupFormSchema(t)),
        defaultValues: { name: '', description: '', is_active: true, is_doctor: false, user_id: null },
    });

    const isDoctor = form.watch('is_doctor');

    React.useEffect(() => {
        getDoctors().then(setDoctors);
    }, []);

    const groupToFormValues = React.useCallback((group: PatientGroup): PatientGroupFormValues => ({
        id: group.id,
        name: group.name,
        description: group.description || '',
        is_active: group.is_active,
        is_doctor: group.is_doctor ?? false,
        user_id: group.user_id ?? null,
    }), []);

    const emptyFormValues: PatientGroupFormValues = { name: '', description: '', is_active: true, is_doctor: false, user_id: null };

    const loadPatientGroups = React.useCallback(async () => {
        setIsRefreshing(true);
        const searchQuery = (columnFilters.find(f => f.id === 'name')?.value as string) || '';
        const { patientGroups: fetched, total } = await getPatientGroups(pagination, searchQuery);
        setPatientGroups(fetched);
        setTotalItems(total);
        setIsRefreshing(false);
    }, [pagination, columnFilters]);

    React.useEffect(() => {
        const debounce = setTimeout(() => { loadPatientGroups(); }, 500);
        return () => clearTimeout(debounce);
    }, [loadPatientGroups]);

    React.useEffect(() => {
        setPagination(prev => ({ ...prev, pageIndex: 0 }));
    }, [columnFilters]);

    const handleRowSelection = (rows: PatientGroup[]) => {
        const group = rows[0] ?? null;
        setSelectedPatientGroup(group);
        setSubmissionError(null);
        if (group) {
            setIsEditing(canUpdate);
            form.reset(groupToFormValues(group));
        }
    };

    const handleCreate = () => {
        setSelectedPatientGroup(null);
        setRowSelection({});
        setIsEditing(true);
        setSubmissionError(null);
        form.reset(emptyFormValues);
        setIsCreateDialogOpen(true);
    };

    const handleClose = () => {
        setSelectedPatientGroup(null);
        setRowSelection({});
        setIsEditing(false);
    };

    const handleBack = () => {
        handleClose();
    };

    const onSubmit = async (values: PatientGroupFormValues) => {
        setSubmissionError(null);
        setIsSaving(true);
        try {
            const payload = { ...values, user_id: values.is_doctor ? values.user_id ?? null : null };
            await upsertPatientGroup(payload);
            toast({ title: selectedPatientGroup ? t('toast.editSuccessTitle') : t('toast.createSuccessTitle') });
            await loadPatientGroups();
            if (!values.id) {
                setIsEditing(false);
                setIsCreateDialogOpen(false);
                handleClose();
            } else if (selectedPatientGroup) {
                // Keep the detail panel in edit mode; sync the header with the saved values.
                setSelectedPatientGroup(prev => (prev ? { ...prev, ...payload } : prev));
            }
        } catch (error) {
            setSubmissionError(error instanceof Error ? error.message : t('toast.genericError'));
        } finally {
            setIsSaving(false);
        }
    };

    const confirmDelete = async () => {
        if (!deletingPatientGroup) return;
        try {
            await deletePatientGroup(String(deletingPatientGroup.id));
            toast({ title: t('toast.deleteSuccessTitle') });
            setIsDeleteDialogOpen(false);
            setDeletingPatientGroup(null);
            handleClose();
            loadPatientGroups();
        } catch (error) {
            toast({ variant: 'destructive', title: t('toast.errorTitle'), description: error instanceof Error ? error.message : t('toast.deleteErrorDescription') });
        }
    };

    const columns: ColumnDef<PatientGroup>[] = [
        { accessorKey: 'name', header: ({ column }) => <DataTableColumnHeader column={column} title={tColumns('name')} /> },
        { accessorKey: 'description', header: ({ column }) => <DataTableColumnHeader column={column} title={tColumns('description')} /> },
        {
            accessorKey: 'is_active',
            header: ({ column }) => <DataTableColumnHeader column={column} title={tColumns('isActive')} />,
            cell: ({ row }) => <Badge variant={row.original.is_active ? 'success' : 'outline'} className="text-[10px]">{row.original.is_active ? 'Activo' : 'Inactivo'}</Badge>,
        },
    ];

    const isRightOpen = !!selectedPatientGroup;

    const leftPanel = (
        <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm">
            <CardHeader className="flex-none p-4">
                <div className="flex items-start gap-3">
                    <div className="header-icon-circle mt-0.5"><UsersRound className="h-5 w-5" /></div>
                    <div>
                        <CardTitle className="text-lg">{t('title')}</CardTitle>
                        <CardDescription className="text-xs">{t('description')}</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden p-4 bg-card">
                <DataTable
                    columns={columns}
                    data={patientGroups}
                    filterColumnId="name"
                    filterPlaceholder={t('filterPlaceholder')}
                    onCreate={canCreate ? handleCreate : undefined}
                    primaryActions={<PatientGroupsExportAllButton />}
                    onRefresh={loadPatientGroups}
                    isRefreshing={isRefreshing}
                    enableSingleRowSelection
                    rowSelection={rowSelection}
                    setRowSelection={setRowSelection}
                    onRowSelectionChange={handleRowSelection}
                    isNarrow={isNarrow || !!selectedPatientGroup}
                    pageCount={totalItems > 0 ? Math.ceil(totalItems / pagination.pageSize) : 0}
                    rowCount={totalItems}
                    pagination={pagination}
                    onPaginationChange={setPagination}
                    manualPagination={true}
                    columnFilters={columnFilters}
                    onColumnFiltersChange={setColumnFilters}
                    renderCard={(row: PatientGroup, _isSelected: boolean) => (
                        <DataCard isSelected={_isSelected}
                            title={row.name}
                            subtitle={row.description}
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
                    <div className="header-icon-circle flex-none"><UsersRound className="h-5 w-5" /></div>
                    <div className="min-w-0 flex-1">
                        <CardTitle className="text-base lg:text-lg truncate">
                            {isEditing && !selectedPatientGroup ? t('createDialog.title') : (selectedPatientGroup?.name ?? '')}
                        </CardTitle>
                        {selectedPatientGroup && (
                            <div className="mt-0.5">
                                <Badge variant={selectedPatientGroup.is_active ? 'success' : 'outline'} className="text-[10px]">
                                    {selectedPatientGroup.is_active ? 'Activo' : 'Inactivo'}
                                </Badge>
                            </div>
                        )}
                    </div>
                    {selectedPatientGroup && (
                        <div className="flex items-center gap-1 flex-none">
                            <PatientGroupExportButton group={{ id: String(selectedPatientGroup.id), name: selectedPatientGroup.name }} />
                            {canDelete && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive" onClick={() => { setDeletingPatientGroup(selectedPatientGroup); setIsDeleteDialogOpen(true); }}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            </CardHeader>
            <Separator />
            <Tabs defaultValue="info" className="flex-1 flex flex-col min-h-0">
                <TabsList className="mx-4 mt-3 w-fit flex-none">
                    <TabsTrigger value="info">{t('tabs.info')}</TabsTrigger>
                    <TabsTrigger value="patients" disabled={!selectedPatientGroup}>{t('tabs.patients')}</TabsTrigger>
                    <TabsTrigger value="services" disabled={!selectedPatientGroup}>{t('tabs.services')}</TabsTrigger>
                </TabsList>
                <TabsContent value="info" className="mt-0 min-h-0 flex-1 flex-col data-[state=active]:flex">
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
                        <FormField control={form.control} name="is_doctor" render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-lg border p-3">
                                <FormControl><Checkbox checked={field.value} onCheckedChange={(checked) => {
                                    field.onChange(checked);
                                    if (!checked) form.setValue('user_id', null);
                                }} disabled={!isEditing} /></FormControl>
                                <FormLabel className="font-normal">{t('createDialog.isDoctor')}</FormLabel>
                            </FormItem>
                        )} />
                        {isDoctor && (
                            <FormField control={form.control} name="user_id" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('createDialog.doctor')}</FormLabel>
                                    <Select value={field.value ?? ''} onValueChange={field.onChange} disabled={!isEditing}>
                                        <FormControl>
                                            <SelectTrigger><SelectValue placeholder={t('createDialog.doctorPlaceholder')} /></SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {doctors.map((doc) => (
                                                <SelectItem key={doc.id} value={doc.id}>{doc.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        )}
                    </CardContent>
                    {isEditing && (
                        <div className="flex-none border-t bg-card px-4 py-3 flex gap-2">
                            <Button type="submit" disabled={isSaving}>
                                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {selectedPatientGroup ? t('createDialog.editSave') : t('createDialog.save')}
                            </Button>
                            <Button type="button" variant="outline" disabled={isSaving || !form.formState.isDirty} onClick={() => {
                                setSubmissionError(null);
                                if (selectedPatientGroup) {
                                    form.reset(groupToFormValues(selectedPatientGroup));
                                }
                            }}>
                                {t('createDialog.revert')}
                            </Button>
                        </div>
                    )}
                </form>
            </Form>
                </TabsContent>
                <TabsContent value="patients" className="mt-0 min-h-0 flex-1 flex-col p-4 data-[state=active]:flex">
                    {selectedPatientGroup && (
                        <PatientGroupPatientsTab groupId={String(selectedPatientGroup.id)} canManage={canUpdate} />
                    )}
                </TabsContent>
                <TabsContent value="services" className="mt-0 min-h-0 flex-1 flex-col p-4 data-[state=active]:flex">
                    {selectedPatientGroup && (
                        <PatientGroupServicesTab groupId={String(selectedPatientGroup.id)} canManage={canUpdate} />
                    )}
                </TabsContent>
            </Tabs>
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
                        <AlertDialogDescription>{t('deleteDialog.description', { name: deletingPatientGroup?.name })}</AlertDialogDescription>
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
                        form.reset(emptyFormValues);
                    }
                }}
            >
                <DialogContent maxWidth="lg" confirmOnClose isDirty={form.formState.isDirty}>
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
                                <FormField control={form.control} name="name" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('createDialog.name')}</FormLabel>
                                        <FormControl><Input {...field} placeholder={t('createDialog.namePlaceholder')} /></FormControl>
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
                                <FormField control={form.control} name="is_doctor" render={({ field }) => (
                                    <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-lg border p-3">
                                        <FormControl><Checkbox checked={field.value} onCheckedChange={(checked) => {
                                            field.onChange(checked);
                                            if (!checked) form.setValue('user_id', null);
                                        }} /></FormControl>
                                        <FormLabel className="font-normal">{t('createDialog.isDoctor')}</FormLabel>
                                    </FormItem>
                                )} />
                                {isDoctor && (
                                    <FormField control={form.control} name="user_id" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('createDialog.doctor')}</FormLabel>
                                            <Select value={field.value ?? ''} onValueChange={field.onChange}>
                                                <FormControl>
                                                    <SelectTrigger><SelectValue placeholder={t('createDialog.doctorPlaceholder')} /></SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {doctors.map((doc) => (
                                                        <SelectItem key={doc.id} value={doc.id}>{doc.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                )}
                            </DialogBody>
                            <DialogFooter>
                                <DialogCancelButton disabled={isSaving}>
                                    {t('createDialog.cancel')}
                                </DialogCancelButton>
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
