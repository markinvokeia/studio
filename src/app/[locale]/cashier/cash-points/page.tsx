
'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { DataTable } from '@/components/ui/data-table';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from '@/components/ui/input';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { CashPoint } from '@/lib/types';
import { api } from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnFiltersState, PaginationState } from '@tanstack/react-table';
import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { CashPointsColumnsWrapper } from './columns';

const cashPointFormSchema = (t: (key: string) => string) => z.object({
    id: z.string().optional(),
    name: z.string().min(1, t('nameRequired')),
    is_active: z.boolean().default(true),
});

type CashPointFormValues = z.infer<ReturnType<typeof cashPointFormSchema>>;

type GetCashPointsResponse = {
    cashPoints: CashPoint[];
    total: number;
};

async function getCashPoints(pagination: PaginationState, searchQuery: string): Promise<GetCashPointsResponse> {
    try {
        const data = await api.get(API_ROUTES.CASHIER.CASH_POINTS_SEARCH, {
            page: (pagination.pageIndex + 1).toString(),
            limit: pagination.pageSize.toString(),
            search: searchQuery,
        });

        if (!data) return { cashPoints: [], total: 0 };

        const parsedData = Array.isArray(data) && data.length > 0 ? data[0] : data;
        const cashPointsData = parsedData?.data || [];
        const total = Number(parsedData?.total) || 0;

        return {
            cashPoints: cashPointsData.map((cp: any) => ({ ...cp, id: String(cp.id) })),
            total
        };
    } catch (error) {
        console.error("Failed to fetch cash points:", error);
        return { cashPoints: [], total: 0 };
    }
}

async function upsertCashPoint(cashPointData: CashPointFormValues) {
    const response = await api.post(API_ROUTES.CASHIER.CASH_POINTS_UPSERT, cashPointData);
    if (Array.isArray(response) && response[0]?.code >= 400) {
        const message = response[0]?.message || 'Failed to save cash point'; // This might come from backend, leaving as is or could be a generic error key
        throw new Error(message);
    }
    if (response.error) {
        throw new Error(response.message || 'Failed to save cash point');
    }
    return response;
}

async function deleteCashPoint(id: string) {
    const response = await api.delete(API_ROUTES.CASHIER.CASH_POINTS_DELETE, { id });
    if (Array.isArray(response) && response[0]?.code >= 400) {
        const message = response[0]?.message || 'Failed to delete cash point';
        throw new Error(message);
    }
    if (response.error) {
        throw new Error(response.message || 'Failed to delete cash point');
    }
    return response;
}

export default function CashPointsPage() {
    const t = useTranslations('PhysicalCashRegistersPage');
    const tValidation = useTranslations('PhysicalCashRegistersPage.validation');
    const { toast } = useToast();
    const [cashPoints, setCashPoints] = React.useState<CashPoint[]>([]);
    const [cashPointCount, setCashPointCount] = React.useState(0);
    const [isRefreshing, setIsRefreshing] = React.useState(false);

    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingCashPoint, setEditingCashPoint] = React.useState<CashPoint | null>(null);

    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
    const [deletingCashPoint, setDeletingCashPoint] = React.useState<CashPoint | null>(null);

    const [submissionError, setSubmissionError] = React.useState<string | null>(null);
    const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

    const form = useForm<CashPointFormValues>({
        resolver: zodResolver(cashPointFormSchema(tValidation)),
    });

    const loadCashPoints = React.useCallback(async () => {
        setIsRefreshing(true);
        const searchQuery = (columnFilters.find(f => f.id === 'name')?.value as string) || '';
        const { cashPoints, total } = await getCashPoints(pagination, searchQuery);
        setCashPoints(cashPoints);
        setCashPointCount(total);
        setIsRefreshing(false);
    }, [pagination, columnFilters]);

    React.useEffect(() => {
        loadCashPoints();
    }, [loadCashPoints]);

    const handleCreate = () => {
        setEditingCashPoint(null);
        form.reset({ name: '', is_active: true });
        setSubmissionError(null);
        setIsDialogOpen(true);
    };

    const handleEdit = (cashPoint: CashPoint) => {
        setEditingCashPoint(cashPoint);
        form.reset({
            id: cashPoint.id,
            name: cashPoint.name,
            is_active: cashPoint.is_active,
        });
        setSubmissionError(null);
        setIsDialogOpen(true);
    };

    const handleDelete = (cashPoint: CashPoint) => {
        setDeletingCashPoint(cashPoint);
        setIsDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
        if (!deletingCashPoint) return;
        try {
            await deleteCashPoint(deletingCashPoint.id);
            toast({ title: t('toast.deleteTitle'), description: t('toast.deleteDescription', { name: deletingCashPoint.name }) });
            setIsDeleteDialogOpen(false);
            setDeletingCashPoint(null);
            loadCashPoints();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: t('toast.errorTitle'),
                description: error instanceof Error ? error.message : t('toast.deleteError'),
            });
        }
    };

    const onSubmit = async (values: CashPointFormValues) => {
        setSubmissionError(null);
        try {
            await upsertCashPoint(values);
            toast({ title: editingCashPoint ? t('toast.editTitle') : t('toast.createTitle'), description: t('toast.successDescription', { name: values.name }) });
            setIsDialogOpen(false);
            loadCashPoints();
        } catch (error) {
            setSubmissionError(error instanceof Error ? error.message : t('toast.saveError'));
        }
    };

    const columns = CashPointsColumnsWrapper({ onEdit: handleEdit, onDelete: handleDelete });

    return (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <Card className="flex-1 flex flex-col min-h-0">
                <CardHeader className="flex-none">
                    <CardTitle>{t('title')}</CardTitle>
                    <CardDescription>{t('description')}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    <DataTable
                        columns={columns}
                        data={cashPoints}
                        pageCount={Math.ceil(cashPointCount / pagination.pageSize)}
                        pagination={pagination}
                        onPaginationChange={setPagination}
                        columnFilters={columnFilters}
                        onColumnFiltersChange={setColumnFilters}
                        manualPagination={true}
                        filterColumnId="name"
                        filterPlaceholder={t('filterPlaceholder')}
                        onCreate={handleCreate}
                        onRefresh={loadCashPoints}
                        isRefreshing={isRefreshing}
                    />
                </CardContent>
            </Card>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingCashPoint ? t('dialog.editTitle') : t('dialog.createTitle')}</DialogTitle>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4 px-6">
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
                                <Button type="submit">{editingCashPoint ? t('dialog.save') : t('dialog.create')}</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('deleteDialog.title')}</AlertDialogTitle>
                        <AlertDialogDescription>{t('deleteDialog.description', { name: deletingCashPoint?.name })}</AlertDialogDescription>
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
