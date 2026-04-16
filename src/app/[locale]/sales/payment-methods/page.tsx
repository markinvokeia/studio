'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { TwoPanelLayout } from '@/components/layout/two-panel-layout';
import { DataCard } from '@/components/ui/data-card';
import { SALES_PERMISSIONS } from '@/constants/permissions';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';
import { PaymentMethod } from '@/lib/types';
import api from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnDef, RowSelectionState } from '@tanstack/react-table';
import { AlertTriangle, CreditCard, Loader2, Pencil, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

const paymentMethodSchema = (t: (key: string) => string) => z.object({
    id: z.string().optional(),
    name: z.string().min(1, t('nameRequired')),
    code: z.string().min(1, t('codeRequired')),
    is_cash_equivalent: z.boolean().default(false),
    is_active: z.boolean().default(true),
});

type PaymentMethodFormValues = z.infer<ReturnType<typeof paymentMethodSchema>>;

async function getPaymentMethods(): Promise<PaymentMethod[]> {
    try {
        const data = await api.get(API_ROUTES.CASHIER.PAYMENT_METHODS);
        const methodsData = Array.isArray(data) ? data : (data.payment_methods || data.data || []);
        return methodsData.map((m: any) => ({ ...m, id: String(m.id) }));
    } catch {
        return [];
    }
}

async function upsertPaymentMethod(data: PaymentMethodFormValues) {
    const responseData = await api.post(API_ROUTES.SALES.PAYMENT_METHODS_UPSERT, data);
    if (Array.isArray(responseData) && responseData[0]?.code >= 400 || responseData.error) {
        throw new Error(responseData.message || (Array.isArray(responseData) && responseData[0]?.message) || 'Failed to save');
    }
    return responseData;
}

async function deletePaymentMethod(id: string) {
    const responseData = await api.delete(API_ROUTES.SALES.PAYMENT_METHODS_DELETE, { id });
    if (Array.isArray(responseData) && responseData[0]?.code >= 400 || responseData.error) {
        throw new Error(responseData.message || 'Failed to delete');
    }
    return responseData;
}

export default function PaymentMethodsPage() {
    const t = useTranslations('PaymentMethodsPage');
    const tValidation = useTranslations('PaymentMethodsPage.validation');
    const { toast } = useToast();
    const { hasPermission } = usePermissions();

    const canCreate = hasPermission(SALES_PERMISSIONS.PAYMENT_METHODS_CREATE);
    const canUpdate = hasPermission(SALES_PERMISSIONS.PAYMENT_METHODS_UPDATE);
    const canDelete = hasPermission(SALES_PERMISSIONS.PAYMENT_METHODS_DELETE);
    const isNarrow = useViewportNarrow();

    const [methods, setMethods] = React.useState<PaymentMethod[]>([]);
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
    const [selectedMethod, setSelectedMethod] = React.useState<PaymentMethod | null>(null);
    const [isEditing, setIsEditing] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);
    const [submissionError, setSubmissionError] = React.useState<string | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
    const [deletingMethod, setDeletingMethod] = React.useState<PaymentMethod | null>(null);

    const form = useForm<PaymentMethodFormValues>({
        resolver: zodResolver(paymentMethodSchema(tValidation)),
    });

    const loadMethods = React.useCallback(async () => {
        setIsRefreshing(true);
        const fetched = await getPaymentMethods();
        setMethods(fetched);
        setIsRefreshing(false);
    }, []);

    React.useEffect(() => { loadMethods(); }, [loadMethods]);

    const handleRowSelection = (rows: PaymentMethod[]) => {
        const method = rows[0] ?? null;
        setSelectedMethod(method);
        setIsEditing(false);
        setSubmissionError(null);
        if (method) form.reset(method);
    };

    const handleCreate = () => {
        setSelectedMethod(null);
        setRowSelection({});
        setIsEditing(true);
        setSubmissionError(null);
        form.reset({ name: '', code: '', is_cash_equivalent: false, is_active: true });
    };

    const handleClose = () => {
        setSelectedMethod(null);
        setRowSelection({});
        setIsEditing(false);
    };

    const handleBack = () => {
        if (isEditing && selectedMethod) {
            setIsEditing(false);
            form.reset(selectedMethod);
        } else {
            handleClose();
        }
    };

    const onSubmit = async (values: PaymentMethodFormValues) => {
        setSubmissionError(null);
        setIsSaving(true);
        try {
            const saved = await upsertPaymentMethod(values);
            toast({ title: selectedMethod ? t('toast.editSuccess') : t('toast.createSuccess') });
            await loadMethods();
            // Re-select updated method
            const updatedId = values.id || (Array.isArray(saved) ? saved[0]?.id : saved?.id);
            if (updatedId) {
                const updated = methods.find(m => String(m.id) === String(updatedId));
                if (updated) { setSelectedMethod(updated); form.reset(updated); }
            }
            setIsEditing(false);
        } catch (error) {
            setSubmissionError(error instanceof Error ? error.message : t('toast.genericError'));
        } finally {
            setIsSaving(false);
        }
    };

    const confirmDelete = async () => {
        if (!deletingMethod) return;
        try {
            await deletePaymentMethod(deletingMethod.id);
            toast({ title: t('toast.deleteSuccess') });
            setIsDeleteDialogOpen(false);
            setDeletingMethod(null);
            handleClose();
            loadMethods();
        } catch (error) {
            toast({ variant: 'destructive', title: t('toast.errorTitle'), description: error instanceof Error ? error.message : t('toast.deleteError') });
        }
    };

    const columns: ColumnDef<PaymentMethod>[] = [
        { accessorKey: 'name', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.name')} /> },
        { accessorKey: 'code', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.code')} /> },
        {
            accessorKey: 'is_active',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.isActive')} />,
            cell: ({ row }) => <Badge variant={row.original.is_active ? 'success' : 'outline'}>{row.original.is_active ? t('columns.yes') : t('columns.no')}</Badge>
        },
    ];

    const isRightOpen = !!selectedMethod || isEditing;

    const leftPanel = (
        <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm">
            <CardHeader className="flex-none p-4">
                <div className="flex items-start gap-3">
                    <div className="header-icon-circle mt-0.5"><CreditCard className="h-5 w-5" /></div>
                    <div>
                        <CardTitle className="text-lg">{t('title')}</CardTitle>
                        <CardDescription className="text-xs">{t('description')}</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden p-4 bg-card">
                <DataTable
                    columns={columns}
                    data={methods}
                    filterColumnId="name"
                    filterPlaceholder={t('filterPlaceholder')}
                    onCreate={canCreate ? handleCreate : undefined}
                    onRefresh={loadMethods}
                    isRefreshing={isRefreshing}
                    enableSingleRowSelection
                    rowSelection={rowSelection}
                    setRowSelection={setRowSelection}
                    onRowSelectionChange={handleRowSelection}
                    isNarrow={isNarrow || !!selectedMethod}
                    renderCard={(row: PaymentMethod) => (
                        <DataCard
                            title={row.name}
                            subtitle={row.code}
                            badge={<Badge variant={row.is_active ? 'success' : 'outline'} className="text-[10px]">{row.is_active ? t('columns.yes') : t('columns.no')}</Badge>}
                            fields={[{ label: t('columns.isCashEquivalent'), value: row.is_cash_equivalent ? t('columns.yes') : t('columns.no') }]}
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
                        <div className="header-icon-circle flex-none"><CreditCard className="h-5 w-5" /></div>
                        <CardTitle className="text-base lg:text-lg truncate">
                            {isEditing && !selectedMethod ? t('dialog.createTitle') : (selectedMethod?.name ?? '')}
                        </CardTitle>
                    </div>
                    <div className="flex items-center gap-1 ml-2 flex-none">
                        {selectedMethod && !isEditing && canUpdate && (
                            <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => setIsEditing(true)}>
                                <Pencil className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">{t('columns.edit')}</span>
                            </Button>
                        )}
                        {selectedMethod && !isEditing && canDelete && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive" onClick={() => { setDeletingMethod(selectedMethod); setIsDeleteDialogOpen(true); }}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>
                {selectedMethod && (
                    <div className="mt-1 ml-10">
                        <Badge variant={selectedMethod.is_active ? 'success' : 'outline'} className="text-[10px]">
                            {selectedMethod.is_active ? t('columns.yes') : t('columns.no')}
                        </Badge>
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
                        <FormField control={form.control} name="name" render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('dialog.name')}</FormLabel>
                                <FormControl><Input {...field} disabled={!isEditing} placeholder={t('dialog.namePlaceholder')} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="code" render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('dialog.code')}</FormLabel>
                                <FormControl><Input {...field} disabled={!isEditing} placeholder={t('dialog.codePlaceholder')} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="is_cash_equivalent" render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-lg border p-3">
                                <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={!isEditing} /></FormControl>
                                <FormLabel className="font-normal">{t('dialog.isCashEquivalent')}</FormLabel>
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="is_active" render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-lg border p-3">
                                <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={!isEditing} /></FormControl>
                                <FormLabel className="font-normal">{t('dialog.isActive')}</FormLabel>
                            </FormItem>
                        )} />
                        {isEditing && (
                            <div className="flex gap-2 pt-2">
                                <Button type="button" variant="outline" onClick={() => { setIsEditing(false); if (selectedMethod) form.reset(selectedMethod); else handleClose(); }} disabled={isSaving}>
                                    {t('dialog.cancel')}
                                </Button>
                                <Button type="submit" disabled={isSaving}>
                                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {selectedMethod ? t('dialog.save') : t('dialog.create')}
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
                        <AlertDialogDescription>{t('deleteDialog.description', { name: deletingMethod?.name })}</AlertDialogDescription>
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
