'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataCard } from '@/components/ui/data-card';
import { DataTable } from '@/components/ui/data-table';
import {
    Dialog,
    DialogBody,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { BUSINESS_CONFIG_PERMISSIONS } from '@/constants/permissions';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { MutualSociety } from '@/lib/types';
import api from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnFiltersState, PaginationState } from '@tanstack/react-table';
import { AlertTriangle, Handshake } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { MutualSocietiesColumnsWrapper } from './columns';

const mutualSocietyFormSchema = (t: (key: string) => string) => z.object({
    id: z.union([z.string(), z.number()]).optional(),
    name: z.string().min(1, { message: t('validation.nameRequired') }),
    description: z.string().optional(),
    code: z.string().min(1, { message: t('validation.codeRequired') }),
    is_active: z.boolean().default(true),
});

type MutualSocietyFormValues = z.infer<ReturnType<typeof mutualSocietyFormSchema>>;

type MutualSocietyResponse = {
    mutualSocieties: MutualSociety[];
    total: number;
};

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
            const responseObj = data[0]?.json || data;
            mutualSocietiesData = responseObj.data || [];
            total = Number(responseObj.total_items) || mutualSocietiesData.length;
        }

        const mutualSocieties = mutualSocietiesData
            .map((apiMutualSociety: any) => ({
                id: apiMutualSociety.id,
                name: apiMutualSociety.name,
                description: apiMutualSociety.description,
                code: apiMutualSociety.code,
                is_active: apiMutualSociety.is_active ?? true,
                created_at: apiMutualSociety.created_at,
                updated_at: apiMutualSociety.updated_at,
            }))
            .filter((mutualSociety: MutualSociety) => mutualSociety.id !== undefined && mutualSociety.id !== null);

        return { mutualSocieties, total };
    } catch (error) {
        console.error("Failed to fetch mutual societies:", error);
        return { mutualSocieties: [], total: 0 };
    }
}

async function upsertMutualSociety(mutualSocietyData: MutualSocietyFormValues) {
    const responseData = await api.post(API_ROUTES.MUTUAL_SOCIETIES_UPSERT, mutualSocietyData);
    if (Array.isArray(responseData) && responseData[0]?.code >= 400) {
        const message = Array.isArray(responseData) && responseData[0]?.message ? responseData[0].message : 'Failed to save mutual society';
        throw new Error(message);
    }
    return responseData;
}

async function deleteMutualSociety(id: string) {
    const responseData = await api.delete(API_ROUTES.MUTUAL_SOCIETIES_DELETE, { id });
    if (Array.isArray(responseData) && responseData[0]?.code >= 400) {
        const message = Array.isArray(responseData) && responseData[0]?.message ? responseData[0].message : 'Failed to delete mutual society';
        throw new Error(message);
    }
    return responseData;
}

export default function MutualSocietiesPage() {
    const t = useTranslations('MutualSocietiesPage');
    const { toast } = useToast();
    const { hasPermission } = usePermissions();
    const isNarrow = useViewportNarrow();

    const [mutualSocieties, setMutualSocieties] = React.useState<MutualSociety[]>([]);
    const [totalItems, setTotalItems] = React.useState(0);
    const [isRefreshing, setIsRefreshing] = React.useState(false);

    const [pagination, setPagination] = React.useState<PaginationState>({
        pageIndex: 0,
        pageSize: 10,
    });
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingMutualSociety, setEditingMutualSociety] = React.useState<MutualSociety | null>(null);

    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
    const [deletingMutualSociety, setDeletingMutualSociety] = React.useState<MutualSociety | null>(null);

    const [submissionError, setSubmissionError] = React.useState<string | null>(null);

    const form = useForm<MutualSocietyFormValues>({
        resolver: zodResolver(mutualSocietyFormSchema(t)),
        defaultValues: { name: '', description: '', code: '', is_active: true },
    });

    const loadMutualSocieties = React.useCallback(async () => {
        setIsRefreshing(true);
        const searchQuery = (columnFilters.find(f => f.id === 'name')?.value as string) || '';
        const { mutualSocieties: fetchedMutualSocieties, total } = await getMutualSocieties(pagination, searchQuery);
        setMutualSocieties(fetchedMutualSocieties);
        setTotalItems(total);
        setIsRefreshing(false);
    }, [pagination, columnFilters]);

    React.useEffect(() => {
        const debounce = setTimeout(() => {
            loadMutualSocieties();
        }, 500);
        return () => clearTimeout(debounce);
    }, [loadMutualSocieties]);

    React.useEffect(() => {
        setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    }, [columnFilters]);

    const handleCreate = () => {
        setEditingMutualSociety(null);
        form.reset({ name: '', description: '', code: '', is_active: true });
        setSubmissionError(null);
        setIsDialogOpen(true);
    };

    const handleEdit = (mutualSociety: MutualSociety) => {
        setEditingMutualSociety(mutualSociety);
        form.reset({
            id: mutualSociety.id,
            name: mutualSociety.name,
            description: mutualSociety.description || '',
            code: mutualSociety.code,
            is_active: mutualSociety.is_active,
        });
        setSubmissionError(null);
        setIsDialogOpen(true);
    };

    const handleDelete = (mutualSociety: MutualSociety) => {
        setDeletingMutualSociety(mutualSociety);
        setIsDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
        if (!deletingMutualSociety) return;
        try {
            await deleteMutualSociety(String(deletingMutualSociety.id));
            toast({
                title: t('toast.deleteSuccessTitle'),
                description: t('toast.deleteSuccessDescription', { name: deletingMutualSociety.name }),
            });
            setIsDeleteDialogOpen(false);
            setDeletingMutualSociety(null);
            loadMutualSocieties();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: t('toast.errorTitle'),
                description: error instanceof Error ? error.message : t('toast.deleteErrorDescription'),
            });
        }
    };

    const onSubmit = async (values: MutualSocietyFormValues) => {
        setSubmissionError(null);
        try {
            await upsertMutualSociety(values);
            toast({
                title: editingMutualSociety ? t('toast.editSuccessTitle') : t('toast.createSuccessTitle'),
                description: t('toast.successDescription', { name: values.name }),
            });
            setIsDialogOpen(false);
            loadMutualSocieties();
        } catch (error) {
            setSubmissionError(error instanceof Error ? error.message : t('toast.genericError'));
        }
    };

    const mutualSocietiesColumns = MutualSocietiesColumnsWrapper({ onEdit: handleEdit, onDelete: handleDelete });
    const tColumns = useTranslations('MutualSocietiesColumns');


    return (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <Card className="flex-1 flex flex-col min-h-0 overflow-hidden shadow-sm border-0">
                <CardHeader className="p-4">
                    <div className="flex items-start gap-3">
                        <div className="header-icon-circle mt-0.5">
                            <Handshake className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col">
                            <CardTitle className="text-lg">{t('title')}</CardTitle>
                            <CardDescription className="text-xs">{t('description')}</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden p-6 bg-card">
                    <DataTable
                        columns={mutualSocietiesColumns}
                        data={mutualSocieties}
                        filterColumnId="name"
                        filterPlaceholder={t('filterPlaceholder')}
                        onCreate={hasPermission(BUSINESS_CONFIG_PERMISSIONS.SEQUENCES_CREATE) ? handleCreate : undefined}
                        onRefresh={loadMutualSocieties}
                        isRefreshing={isRefreshing}
                        columnTranslations={{
                            id: tColumns('id'),
                            name: tColumns('name'),
                            description: tColumns('description'),
                            code: tColumns('code'),
                            is_active: tColumns('isActive'),
                            created_at: tColumns('createdAt'),
                            updated_at: tColumns('updatedAt'),
                        }}
                        pageCount={totalItems > 0 ? Math.ceil(totalItems / pagination.pageSize) : 0}
                        pagination={pagination}
                        onPaginationChange={setPagination}
                        manualPagination={true}
                        columnFilters={columnFilters}
                        onColumnFiltersChange={setColumnFilters}
                        isNarrow={isNarrow}
                        renderCard={(row: MutualSociety) => (
                            <DataCard
                                title={row.name}
                                subtitle={row.code}
                                badge={<span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${row.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{row.is_active ? 'Activo' : 'Inactivo'}</span>}
                                showArrow
                            />
                        )}
                    />
                </CardContent>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingMutualSociety ? t('createDialog.editTitle') : t('createDialog.title')}</DialogTitle>
                        <DialogDescription>
                            {editingMutualSociety ? t('createDialog.editDescription') : t('createDialog.description')}
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
                            <DialogBody className="space-y-4 px-6 py-4">
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
                                            <FormLabel>{t('createDialog.name')}</FormLabel>
                                            <FormControl>
                                                <Input placeholder={t('createDialog.namePlaceholder')} {...field} />
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
                                            <FormLabel>{t('createDialog.code')}</FormLabel>
                                            <FormControl>
                                                <Input placeholder={t('createDialog.codePlaceholder')} {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="description"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('createDialog.description')}</FormLabel>
                                            <FormControl>
                                                <Textarea placeholder={t('createDialog.descriptionPlaceholder')} {...field} value={field.value || ''} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="is_active"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                            <FormControl>
                                                <Checkbox
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                />
                                            </FormControl>
                                            <div className="space-y-1 leading-none">
                                                <FormLabel>
                                                    {t('createDialog.isActive')}
                                                </FormLabel>
                                            </div>
                                        </FormItem>
                                    )}
                                />
                            </DialogBody>
                            <DialogFooter>
                                <Button type="submit">{editingMutualSociety ? t('createDialog.editSave') : t('createDialog.save')}</Button>
                                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>{t('createDialog.cancel')}</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('deleteDialog.title')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('deleteDialog.description', { name: deletingMutualSociety?.name })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">{t('deleteDialog.confirm')}</AlertDialogAction>
                        <AlertDialogCancel>{t('deleteDialog.cancel')}</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
