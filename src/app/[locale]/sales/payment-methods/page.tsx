
'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from '@/components/ui/input';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { PaymentMethod } from '@/lib/types';
import api from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnDef } from '@tanstack/react-table';
import { AlertTriangle, MoreHorizontal } from 'lucide-react';
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
    } catch (error) {
        console.error("Failed to fetch payment methods:", error);
        return [];
    }
}

async function upsertPaymentMethod(data: PaymentMethodFormValues) {
    const responseData = await api.post(API_ROUTES.SALES.PAYMENT_METHODS_UPSERT, data);
    if (Array.isArray(responseData) && responseData[0]?.code >= 400 || responseData.error) {
        const message = responseData.message || (Array.isArray(responseData) && responseData[0]?.message) || 'Failed to save payment method';
        throw new Error(message);
    }
    return responseData;
}

async function deletePaymentMethod(id: string) {
    const responseData = await api.delete(API_ROUTES.SALES.PAYMENT_METHODS_DELETE, { id });
    if (Array.isArray(responseData) && responseData[0]?.code >= 400 || responseData.error) {
        const message = responseData.message || (Array.isArray(responseData) && responseData[0]?.message) || 'Failed to delete payment method';
        throw new Error(message);
    }
    return responseData;
}

export default function PaymentMethodsPage() {
    const t = useTranslations('PaymentMethodsPage');
    const tValidation = useTranslations('PaymentMethodsPage.validation');
    const { toast } = useToast();
    const [methods, setMethods] = React.useState<PaymentMethod[]>([]);
    const [isRefreshing, setIsRefreshing] = React.useState(false);

    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingMethod, setEditingMethod] = React.useState<PaymentMethod | null>(null);

    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
    const [deletingMethod, setDeletingMethod] = React.useState<PaymentMethod | null>(null);

    const [submissionError, setSubmissionError] = React.useState<string | null>(null);

    const form = useForm<PaymentMethodFormValues>({
        resolver: zodResolver(paymentMethodSchema(tValidation)),
    });

    const loadMethods = React.useCallback(async () => {
        setIsRefreshing(true);
        const fetchedMethods = await getPaymentMethods();
        setMethods(fetchedMethods);
        setIsRefreshing(false);
    }, []);

    React.useEffect(() => {
        loadMethods();
    }, [loadMethods]);

    const handleCreate = () => {
        setEditingMethod(null);
        form.reset({ name: '', code: '', is_cash_equivalent: false, is_active: true });
        setSubmissionError(null);
        setIsDialogOpen(true);
    };

    const handleEdit = (method: PaymentMethod) => {
        setEditingMethod(method);
        form.reset(method);
        setSubmissionError(null);
        setIsDialogOpen(true);
    };

    const handleDelete = (method: PaymentMethod) => {
        setDeletingMethod(method);
        setIsDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
        if (!deletingMethod) return;
        try {
            await deletePaymentMethod(deletingMethod.id);
            toast({ title: t('toast.deleteSuccess'), description: t('toast.deleteDescription', { name: deletingMethod.name }) });
            setIsDeleteDialogOpen(false);
            setDeletingMethod(null);
            loadMethods();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: t('toast.errorTitle'),
                description: error instanceof Error ? error.message : t('toast.deleteError'),
            });
        }
    };

    const onSubmit = async (values: PaymentMethodFormValues) => {
        setSubmissionError(null);
        try {
            await upsertPaymentMethod(values);
            toast({ title: editingMethod ? t('toast.editSuccess') : t('toast.createSuccess'), description: t('toast.saveDescription', { name: values.name }) });
            setIsDialogOpen(false);
            loadMethods();
        } catch (error) {
            setSubmissionError(error instanceof Error ? error.message : t('toast.genericError'));
        }
    };

    const columns: ColumnDef<PaymentMethod>[] = [
        { accessorKey: 'id', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.id')} /> },
        { accessorKey: 'name', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.name')} /> },
        { accessorKey: 'code', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.code')} /> },
        {
            accessorKey: 'is_cash_equivalent',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.isCashEquivalent')} />,
            cell: ({ row }) => <Badge variant={row.original.is_cash_equivalent ? 'success' : 'outline'}>{row.original.is_cash_equivalent ? t('columns.yes') : t('columns.no')}</Badge>
        },
        {
            accessorKey: 'is_active',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.isActive')} />,
            cell: ({ row }) => <Badge variant={row.original.is_active ? 'success' : 'destructive'}>{row.original.is_active ? t('columns.yes') : t('columns.no')}</Badge>
        },
        {
            id: 'actions',
            cell: ({ row }) => {
                const method = row.original;
                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>{t('columns.actions')}</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleEdit(method)}>{t('columns.edit')}</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDelete(method)} className="text-destructive">{t('columns.delete')}</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                );
            },
        },
    ];

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>{t('title')}</CardTitle>
                    <CardDescription>{t('description')}</CardDescription>
                </CardHeader>
                <CardContent>
                    <DataTable
                        columns={columns}
                        data={methods}
                        filterColumnId="name"
                        filterPlaceholder={t('filterPlaceholder')}
                        onCreate={handleCreate}
                        onRefresh={loadMethods}
                        isRefreshing={isRefreshing}
                    />
                </CardContent>
            </Card>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingMethod ? t('dialog.editTitle') : t('dialog.createTitle')}</DialogTitle>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                            {submissionError && (
                                <Alert variant="destructive">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertTitle>{t('toast.errorTitle')}</AlertTitle>
                                    <AlertDescription>{submissionError}</AlertDescription>
                                </Alert>
                            )}
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('dialog.name')}</FormLabel>
                                        <FormControl>
                                            <Input placeholder={t('dialog.namePlaceholder')} {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="code"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('dialog.code')}</FormLabel>
                                        <FormControl>
                                            <Input placeholder={t('dialog.codePlaceholder')} {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="is_cash_equivalent"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                        <FormControl>
                                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                        </FormControl>
                                        <FormLabel>{t('dialog.isCashEquivalent')}</FormLabel>
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="is_active"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                        <FormControl>
                                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                        </FormControl>
                                        <FormLabel>{t('dialog.isActive')}</FormLabel>
                                    </FormItem>
                                )}
                            />
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>{t('dialog.cancel')}</Button>
                                <Button type="submit">{editingMethod ? t('dialog.save') : t('dialog.create')}</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
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
        </>
    );
}
