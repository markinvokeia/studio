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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { TwoPanelLayout } from '@/components/layout/two-panel-layout';
import { SYSTEM_PERMISSIONS } from '@/constants/permissions';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';
import { AlertCategory, NotificationCategory } from '@/lib/types';
import { api } from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnDef, ColumnFiltersState, RowSelectionState } from '@tanstack/react-table';
import * as LucideIcons from 'lucide-react';
import { AlertTriangle, Layers, Loader2, Pencil, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

const categoryFormSchema = (t: (key: string) => string) => z.object({
    id: z.union([z.string(), z.number()]).optional(),
    code: z.string().min(1, t('codeRequired')).regex(/^[A-Z0-9_]+$/, t('codeFormat')),
    name: z.string().min(1, t('nameRequired')).max(100, t('nameMaxLength')),
    description: z.string().max(500, t('descriptionMaxLength')).optional(),
    icon: z.string().optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, t('colorInvalid')).optional(),
    sort_order: z.coerce.number().optional(),
    is_active: z.boolean().default(true),
    internal_category_id: z.string().optional(),
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

async function getCategories(search?: string, is_active?: boolean, page: number = DEFAULT_PAGE, limit: number = DEFAULT_LIMIT, internalCategories: NotificationCategory[] = []): Promise<PaginatedResponse<AlertCategory>> {
    try {
        const query: Record<string, string> = { page: page.toString(), limit: limit.toString() };
        if (search) query.search = search;
        if (is_active !== undefined) query.is_active = is_active.toString();
        const response = await api.get(API_ROUTES.SYSTEM.ALERT_CATEGORIES, query);
        if (response.length === 1 && Object.keys(response[0]).length === 0) {
            return { data: [], total: 0, page, limit };
        }
        const categoryMap = new Map(internalCategories.map(cat => [cat.slug, cat.name]));
        return {
            data: response.map((cat: any) => ({
                ...cat,
                rules_count: cat.rules_count || 0,
                internal_category_id: cat.notification_category_slug || undefined,
                internal_category_name: cat.notification_category_slug ? categoryMap.get(cat.notification_category_slug) : undefined
            })),
            total: response.length,
            page,
            limit
        };
    } catch (error) {
        console.error('Failed to fetch alert categories:', error);
        throw error;
    }
}

async function upsertCategory(category: Partial<CategoryFormValues>): Promise<AlertCategory> {
    try {
        const response = await api.post(API_ROUTES.SYSTEM.ALERT_CATEGORY, category);
        if (Array.isArray(response) && response.length > 0) {
            const firstItem = response[0];
            if (firstItem && (firstItem.code >= 400 || firstItem.error)) {
                throw new Error(firstItem.message || firstItem.error || 'Failed to save category');
            }
        }
        if (response && typeof response === 'object' && !Array.isArray(response)) {
            if (response.error || response.code >= 400) {
                throw new Error(response.message || response.error || 'Failed to save category');
            }
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

async function getInternalCategories(): Promise<NotificationCategory[]> {
    try {
        const response = await api.get(API_ROUTES.SYSTEM.NOTIFICATION_CATEGORIES);
        return Array.isArray(response) ? response : [];
    } catch (error) {
        console.error('Failed to fetch internal categories:', error);
        return [];
    }
}

export default function AlertCategoriesPage() {
    const t = useTranslations('AlertCategoriesPage');
    const tValidation = useTranslations('AlertCategoriesPage.validation');
    const { toast } = useToast();
    const { hasPermission } = usePermissions();

    const canViewList = hasPermission(SYSTEM_PERMISSIONS.ALERT_CATEGORIES_VIEW_LIST);
    const canCreate = hasPermission(SYSTEM_PERMISSIONS.ALERT_CATEGORIES_CREATE);
    const canUpdate = hasPermission(SYSTEM_PERMISSIONS.ALERT_CATEGORIES_UPDATE);
    const canDelete = hasPermission(SYSTEM_PERMISSIONS.ALERT_CATEGORIES_DELETE);
    const isNarrow = useViewportNarrow();

    const [categories, setCategories] = React.useState<AlertCategory[]>([]);
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
    const [currentPage, setCurrentPage] = React.useState(DEFAULT_PAGE);
    const [pageSize, setPageSize] = React.useState(DEFAULT_LIMIT);
    const [total, setTotal] = React.useState(0);
    const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
    const [selectedCategory, setSelectedCategory] = React.useState<AlertCategory | null>(null);
    const [isEditing, setIsEditing] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);
    const [submissionError, setSubmissionError] = React.useState<string | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
    const [deletingCategory, setDeletingCategory] = React.useState<AlertCategory | null>(null);
    const [internalCategories, setInternalCategories] = React.useState<NotificationCategory[]>([]);

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
            const result = await getCategories(searchValue, isActiveValue, page, limit, internalCategories);
            setCategories(result.data);
            setTotal(result.total);
            setCurrentPage(result.page);
            setPageSize(result.limit);
        } catch (error) {
            toast({ variant: 'destructive', title: t('toast.errorTitle'), description: t('toast.loadErrorDescription') });
        } finally {
            setIsRefreshing(false);
        }
    }, [t, toast, internalCategories]);

    React.useEffect(() => { loadCategories(columnFilters, currentPage, pageSize); }, [loadCategories, columnFilters, currentPage, pageSize]);
    React.useEffect(() => { getInternalCategories().then(setInternalCategories); }, []);
    React.useEffect(() => { loadCategories(columnFilters, currentPage, pageSize); }, [internalCategories]);

    const handleColumnFiltersChange = React.useCallback((filters: ColumnFiltersState | ((prev: ColumnFiltersState) => ColumnFiltersState)) => {
        setColumnFilters(filters);
        setCurrentPage(DEFAULT_PAGE);
    }, []);

    const handleRowSelection = (rows: AlertCategory[]) => {
        const category = rows[0] ?? null;
        setSelectedCategory(category);
        setIsEditing(false);
        setSubmissionError(null);
        if (category) {
            form.reset({ ...category, sort_order: category.sort_order || 0, internal_category_id: category.internal_category_id || undefined });
        }
    };

    const handleCreate = () => {
        setSelectedCategory(null);
        setRowSelection({});
        setIsEditing(true);
        setSubmissionError(null);
        form.reset({ code: '', name: '', description: '', icon: 'AlertCircle', color: '#888888', sort_order: 0, is_active: true, internal_category_id: undefined });
    };

    const handleClose = () => {
        setSelectedCategory(null);
        setRowSelection({});
        setIsEditing(false);
    };

    const handleBack = () => {
        if (isEditing && selectedCategory) {
            setIsEditing(false);
            form.reset({ ...selectedCategory, sort_order: selectedCategory.sort_order || 0, internal_category_id: selectedCategory.internal_category_id || undefined });
        } else {
            handleClose();
        }
    };

    const onSubmit = async (values: CategoryFormValues) => {
        setSubmissionError(null);
        setIsSaving(true);
        try {
            await upsertCategory(values);
            toast({ title: selectedCategory ? t('toast.editSuccessTitle') : t('toast.createSuccessTitle'), description: t('toast.successDescription', { name: values.name }) });
            await loadCategories(columnFilters, currentPage, pageSize);
            setIsEditing(false);
            if (!values.id) handleClose();
        } catch (error) {
            setSubmissionError(t('toast.submitErrorDescription'));
        } finally {
            setIsSaving(false);
        }
    };

    const confirmDelete = async () => {
        if (!deletingCategory) return;
        try {
            await deleteCategory(deletingCategory.id);
            toast({ title: t('toast.deleteSuccessTitle'), description: t('toast.deleteSuccessDescription', { name: deletingCategory.name }) });
            setIsDeleteDialogOpen(false);
            setDeletingCategory(null);
            handleClose();
            loadCategories(columnFilters, currentPage, pageSize);
        } catch (error) {
            toast({ variant: 'destructive', title: t('toast.deleteErrorTitle'), description: t('toast.deleteErrorDescription') });
        }
    };

    const pagination = { pageIndex: currentPage - 1, pageSize };
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
        { accessorKey: 'name', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.name')} />, filterFn: () => true },
        { accessorKey: 'code', header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.code')} /> },
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
    ];

    const isRightOpen = !!selectedCategory || isEditing;

    const CategoryIcon = selectedCategory ? (LucideIcons as any)[selectedCategory.icon || 'AlertCircle'] : Layers;

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
                    data={categories}
                    filterColumnId="name"
                    filterPlaceholder={t('filterPlaceholder')}
                    onCreate={canCreate ? handleCreate : undefined}
                    onRefresh={() => loadCategories(columnFilters, currentPage, pageSize)}
                    isRefreshing={isRefreshing}
                    isNarrow={isNarrow || !!selectedCategory}
                    renderCard={(row: AlertCategory, _isSelected: boolean) => (
                        <DataCard isSelected={_isSelected}
                            title={row.name}
                            subtitle={row.code}
                            badge={<span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${row.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{row.is_active ? t('columns.yes') : t('columns.no')}</span>}
                            accentColor={row.color || undefined}
                            showArrow
                        />
                    )}
                    columnFilters={columnFilters}
                    onColumnFiltersChange={handleColumnFiltersChange}
                    pagination={pagination}
                    onPaginationChange={onPaginationChange}
                    manualPagination={true}
                    pageCount={Math.ceil(total / pageSize)}
                    enableSingleRowSelection
                    rowSelection={rowSelection}
                    setRowSelection={setRowSelection}
                    onRowSelectionChange={handleRowSelection}
                />
            </CardContent>
        </Card>
    );

    const rightPanel = (
        <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm">
            <CardHeader className="flex-none p-4 pb-2 space-y-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                        <div className="header-icon-circle flex-none" style={selectedCategory?.color ? { backgroundColor: `${selectedCategory.color}20`, color: selectedCategory.color } : {}}>
                            {CategoryIcon ? <CategoryIcon className="h-5 w-5" /> : <Layers className="h-5 w-5" />}
                        </div>
                        <CardTitle className="text-base lg:text-lg truncate">
                            {isEditing && !selectedCategory ? t('dialog.createTitle') : (selectedCategory?.name ?? '')}
                        </CardTitle>
                    </div>
                    <div className="flex items-center gap-1 ml-2 flex-none">
                        {selectedCategory && !isEditing && canUpdate && (
                            <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => setIsEditing(true)}>
                                <Pencil className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">{t('columns.edit')}</span>
                            </Button>
                        )}
                        {selectedCategory && !isEditing && canDelete && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => {
                                    if (selectedCategory.rules_count && selectedCategory.rules_count > 0) {
                                        toast({ variant: 'destructive', title: t('toast.deleteErrorTitle'), description: t('toast.deleteErrorHasRules') });
                                        return;
                                    }
                                    setDeletingCategory(selectedCategory);
                                    setIsDeleteDialogOpen(true);
                                }}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>
                {selectedCategory && !isEditing && (
                    <div className="ml-10 mt-1">
                        <Badge variant={selectedCategory.is_active ? 'success' : 'outline'} className="text-[10px]">
                            {selectedCategory.is_active ? t('columns.yes') : t('columns.no')}
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
                        <FormField control={form.control} name="code" render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('dialog.code')}</FormLabel>
                                <FormControl>
                                    <Input
                                        {...field}
                                        disabled={!isEditing}
                                        placeholder={t('dialog.codePlaceholder')}
                                        onInput={(e) => isEditing && (e.currentTarget.value = e.currentTarget.value.toUpperCase().replace(/\s/g, ''))}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="name" render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('dialog.name')}</FormLabel>
                                <FormControl><Input {...field} disabled={!isEditing} placeholder={t('dialog.namePlaceholder')} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="description" render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('dialog.description')}</FormLabel>
                                <FormControl><Textarea {...field} disabled={!isEditing} placeholder={t('dialog.descriptionPlaceholder')} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="internal_category_id" render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('dialog.internalCategory')}</FormLabel>
                                <Select
                                    onValueChange={(val) => field.onChange(val === '__none__' ? undefined : val)}
                                    value={field.value || '__none__'}
                                    disabled={!isEditing}
                                >
                                    <FormControl><SelectTrigger><SelectValue placeholder={t('dialog.internalCategoryPlaceholder')} /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value="__none__">{t('dialog.noInternalCategory')}</SelectItem>
                                        {internalCategories.filter(cat => cat.slug).map((cat) => (
                                            <SelectItem key={cat.slug} value={cat.slug}>{cat.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="icon" render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('dialog.icon')}</FormLabel>
                                <FormControl><Input {...field} disabled={!isEditing} placeholder={t('dialog.iconPlaceholder')} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="color" render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('dialog.color')}</FormLabel>
                                <FormControl>
                                    <div className="flex items-center gap-2">
                                        <Input type="color" className="p-1 h-10 w-14" {...field} disabled={!isEditing} />
                                        <Input placeholder="#RRGGBB" {...field} disabled={!isEditing} />
                                    </div>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="sort_order" render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('dialog.sortOrder')}</FormLabel>
                                <FormControl><Input type="number" {...field} disabled={!isEditing} /></FormControl>
                                <FormMessage />
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
                                <Button type="button" variant="outline"
                                    onClick={() => {
                                        setIsEditing(false);
                                        if (selectedCategory) form.reset({ ...selectedCategory, sort_order: selectedCategory.sort_order || 0, internal_category_id: selectedCategory.internal_category_id || undefined });
                                        else handleClose();
                                    }}
                                    disabled={isSaving}
                                >
                                    {t('dialog.cancel')}
                                </Button>
                                <Button type="submit" disabled={isSaving}>
                                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {selectedCategory ? t('dialog.save') : t('dialog.create')}
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
                        <AlertDialogDescription>{t('deleteDialog.description', { name: deletingCategory?.name })}</AlertDialogDescription>
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
