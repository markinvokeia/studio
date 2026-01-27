
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
import { Textarea } from '@/components/ui/textarea';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { AlertCategory } from '@/lib/types';
import { api } from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnDef, ColumnFiltersState } from '@tanstack/react-table';
import * as LucideIcons from 'lucide-react';
import { AlertTriangle, MoreHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

const categoryFormSchema = (t: (key: string) => string) => z.object({
    id: z.union([z.string(), z.number()]).optional(),
    code: z.string()
        .min(1, t('validation.codeRequired'))
        .regex(/^[A-Z0-9_]+$/, t('validation.codeFormat')),
    name: z.string().min(1, t('validation.nameRequired')).max(100, t('validation.nameMaxLength')),
    description: z.string().max(500, t('validation.descriptionMaxLength')).optional(),
    icon: z.string().optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, t('validation.colorInvalid')).optional(),
    sort_order: z.coerce.number().optional(),
    is_active: z.boolean().default(true),
});

type CategoryFormValues = z.infer<ReturnType<typeof categoryFormSchema>>;

interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 100;

async function getCategories(search?: string, is_active?: boolean, page: number = DEFAULT_PAGE, limit: number = DEFAULT_LIMIT): Promise<PaginatedResponse<AlertCategory>> {
    try {
        const query: Record<string, string> = {
            page: page.toString(),
            limit: limit.toString()
        };

        if (search) query.search = search;
        if (is_active !== undefined) query.is_active = is_active.toString();

const response = await api.get(API_ROUTES.SYSTEM.ALERT_CATEGORIES, query);
        
        // Check if no data: array with one empty object
        if (response.length === 1 && Object.keys(response[0]).length === 0) {
            return {
                data: [],
                total: 0,
                page: page,
                limit: limit
            };
        }
        
        return {
            data: response.map((cat: any) => ({ ...cat, rules_count: cat.rules_count || 0 })),
            total: response.length,
            page: page,
            limit: limit
        };
    } catch (error) {
        console.error('Failed to fetch alert categories:', error);
        throw error;
    }
}

async function upsertCategory(category: Partial<CategoryFormValues>): Promise<AlertCategory> {
    try {
        const response = await api.post(API_ROUTES.SYSTEM.ALERT_CATEGORY, category);
        if (response.error || (Array.isArray(response) && response[0]?.code >= 400)) {
            const message = response.message || (Array.isArray(response) && response[0]?.message) || 'Failed to save category';
            throw new Error(message);
        }
        return response;
    } catch (error) {
        console.error('Failed to upsert alert category:', error);
        throw error;
    }
}

async function deleteCategory(id: string): Promise<void> {
    try {
        await api.delete(API_ROUTES.SYSTEM.ALERT_CATEGORY, { id });
    } catch (error) {
        console.error('Failed to delete alert category:', error);
        throw error;
    }
}

export default function AlertCategoriesPage() {
    const t = useTranslations('AlertCategoriesPage');
    const tValidation = useTranslations('AlertCategoriesPage.validation');
    const { toast } = useToast();
    const [categories, setCategories] = React.useState<AlertCategory[]>([]);
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
    const [currentPage, setCurrentPage] = React.useState(DEFAULT_PAGE);
    const [pageSize, setPageSize] = React.useState(DEFAULT_LIMIT);
    const [total, setTotal] = React.useState(0);

    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingCategory, setEditingCategory] = React.useState<AlertCategory | null>(null);

    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
    const [deletingCategory, setDeletingCategory] = React.useState<AlertCategory | null>(null);

    const [submissionError, setSubmissionError] = React.useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const form = useForm<CategoryFormValues>({
        resolver: zodResolver(categoryFormSchema(tValidation)),
    });

    const loadCategories = React.useCallback(async (filters: ColumnFiltersState, page: number = DEFAULT_PAGE, limit: number = DEFAULT_LIMIT) => {
        setIsRefreshing(true);
        try {
            const searchFilter = filters.find(f => f.id === 'name');
            const searchValue = searchFilter?.value as string || undefined;

            const isActiveFilterObj = filters.find(f => f.id === 'is_active');
            const isActiveValue = isActiveFilterObj?.value as boolean | undefined;

            const result = await getCategories(searchValue, isActiveValue, page, limit);
            setCategories(result.data);
            setTotal(result.total);
            setCurrentPage(result.page);
            setPageSize(result.limit);
        } catch (error) {
            console.error('Error loading categories:', error);
            toast({
                variant: 'destructive',
                title: t('toast.errorTitle'),
                description: t('toast.loadErrorDescription'),
            });
        } finally {
            setIsRefreshing(false);
        }
    }, [t, toast]);

    React.useEffect(() => {
        loadCategories(columnFilters, currentPage, pageSize);
    }, [loadCategories, columnFilters, currentPage, pageSize]);

    const handleColumnFiltersChange = React.useCallback((filters: ColumnFiltersState) => {
        setColumnFilters(filters);
        setCurrentPage(DEFAULT_PAGE);
    }, []);

    const handleCreate = () => {
        setEditingCategory(null);
        form.reset({ code: '', name: '', description: '', icon: 'AlertCircle', color: '#888888', sort_order: 0, is_active: true });
        setSubmissionError(null);
        setIsDialogOpen(true);
    };

    const handleEdit = (category: AlertCategory) => {
        setEditingCategory(category);
        form.reset({
            ...category,
            sort_order: category.sort_order || 0
        });
        setSubmissionError(null);
        setIsDialogOpen(true);
    };

    const handleDelete = (category: AlertCategory) => {
        if (category.rules_count && category.rules_count > 0) {
            toast({
                variant: 'destructive',
                title: t('toast.deleteErrorTitle'),
                description: t('toast.deleteErrorHasRules'),
            });
            return;
        }
        setDeletingCategory(category);
        setIsDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
        if (!deletingCategory) return;
        try {
            await deleteCategory(deletingCategory.id);
            toast({
                title: t('toast.deleteSuccessTitle'),
                description: t('toast.deleteSuccessDescription', { name: deletingCategory.name })
            });
            setIsDeleteDialogOpen(false);
            setDeletingCategory(null);
            loadCategories(columnFilters, currentPage, pageSize);
        } catch (error) {
            console.error('Error deleting category:', error);
            toast({
                variant: 'destructive',
                title: t('toast.deleteErrorTitle'),
                description: t('toast.deleteErrorDescription'),
            });
        }
    };

    const onSubmit = async (values: CategoryFormValues) => {
        setSubmissionError(null);
        setIsSubmitting(true);
        try {
            await upsertCategory(values);
            toast({
                title: editingCategory ? t('toast.editSuccessTitle') : t('toast.createSuccessTitle'),
                description: t('toast.successDescription', { name: values.name })
            });
            setIsDialogOpen(false);
            loadCategories(columnFilters, currentPage, pageSize);
        } catch (error) {
            console.error('Error submitting category:', error);
            setSubmissionError(t('toast.submitErrorDescription'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const pagination = {
        pageIndex: currentPage - 1,
        pageSize,
    };

    const onPaginationChange = (updater: any) => {
        const newPagination = typeof updater === 'function' ? updater(pagination) : updater;
        setCurrentPage(newPagination.pageIndex + 1);
        setPageSize(newPagination.pageSize);
    };

    const columns: ColumnDef<AlertCategory>[] = [
        {
            accessorKey: 'icon',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.icon')} />,
            cell: ({ row }) => {
                const Icon = (LucideIcons as any)[row.original.icon || 'AlertCircle'];
                return Icon ? <Icon className="h-5 w-5" style={{ color: row.original.color || '#888888' }} /> : null;
            }
        },
        {
            accessorKey: 'name',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.name')} />,
            filterFn: () => true
        },
        {
            accessorKey: 'code',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.code')} />
        },
        {
            accessorKey: 'rules_count',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.rulesCount')} />,
            cell: ({ row }) => <Badge variant="secondary">{row.original.rules_count || 0}</Badge>
        },
        {
            accessorKey: 'is_active',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.isActive')} />,
            cell: ({ row }) => <Badge variant={row.original.is_active ? 'success' : 'outline'}>{row.original.is_active ? t('columns.yes') : t('columns.no')}</Badge>,
            filterFn: () => true
        },
        {
            id: 'actions',
            cell: ({ row }) => {
                const category = row.original;
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
                            <DropdownMenuItem onClick={() => handleEdit(category)}>{t('columns.edit')}</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDelete(category)} className="text-destructive">{t('columns.delete')}</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                );
            },
        },
    ];

    return (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <CardHeader className="flex-none">
                    <CardTitle>{t('title')}</CardTitle>
                    <CardDescription>{t('description')}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    <DataTable
                        columns={columns}
                        data={categories}
                        filterColumnId="name"
                        filterPlaceholder={t('filterPlaceholder')}
                        onCreate={handleCreate}
                        onRefresh={() => loadCategories(columnFilters, currentPage, pageSize)}
                        isRefreshing={isRefreshing}
                        columnFilters={columnFilters}
                        onColumnFiltersChange={handleColumnFiltersChange}
                        pagination={pagination}
                        onPaginationChange={onPaginationChange}
                        manualPagination={true}
                        pageCount={Math.ceil(total / pageSize)}
                    />
                </CardContent>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{editingCategory ? t('dialog.editTitle') : t('dialog.createTitle')}</DialogTitle>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-4">
                            {submissionError && (
                                <Alert variant="destructive">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertTitle>{t('toast.errorTitle')}</AlertTitle>
                                    <AlertDescription>{submissionError}</AlertDescription>
                                </Alert>
                            )}
                            <div className="space-y-6">
                                <div className="space-y-4">
                                    <h4 className="text-sm font-medium">{t('dialog.basicInfo')}</h4>
                                    <FormField control={form.control} name="code" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('dialog.code')}</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder={t('dialog.codePlaceholder')}
                                                    {...field}
                                                    onInput={(e) => (e.currentTarget.value = e.currentTarget.value.toUpperCase().replace(/\s/g, ''))}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="name" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('dialog.name')}</FormLabel>
                                            <FormControl>
                                                <Input placeholder={t('dialog.namePlaceholder')} {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="description" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('dialog.description')}</FormLabel>
                                            <FormControl>
                                                <Textarea placeholder={t('dialog.descriptionPlaceholder')} {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </div>
                                <div className="space-y-4">
                                    <h4 className="text-sm font-medium">{t('dialog.visualSettings')}</h4>
                                    <FormField control={form.control} name="icon" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('dialog.icon')}</FormLabel>
                                            <FormControl>
                                                <Input placeholder={t('dialog.iconPlaceholder')} {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="color" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('dialog.color')}</FormLabel>
                                            <FormControl>
                                                <div className="flex items-center gap-2">
                                                    <Input type="color" className="p-1 h-10 w-14" {...field} />
                                                    <Input placeholder="#RRGGBB" {...field} />
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </div>
                                <div className="space-y-4">
                                    <h4 className="text-sm font-medium">{t('dialog.otherSettings')}</h4>
                                    <FormField control={form.control} name="sort_order" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('dialog.sortOrder')}</FormLabel>
                                            <FormControl>
                                                <Input type="number" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="is_active" render={({ field }) => (
                                        <FormItem className="flex flex-row items-center space-x-3 space-y-0 pt-2">
                                            <FormControl>
                                                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                            </FormControl>
                                            <FormLabel>{t('dialog.isActive')}</FormLabel>
                                        </FormItem>
                                    )} />
                                </div>
                            </div>
                            <DialogFooter className="sticky bottom-0 bg-background pt-4">
                                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                                    {t('dialog.cancel')}
                                </Button>
                                <Button type="submit" disabled={isSubmitting}>
                                    {isSubmitting ? t('dialog.saving') : editingCategory ? t('dialog.save') : t('dialog.create')}
                                </Button>
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
                            {t('deleteDialog.description', { name: deletingCategory?.name })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('deleteDialog.cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDelete}
                            className="bg-destructive hover:bg-destructive/90"
                        >
                            {t('deleteDialog.confirm')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
