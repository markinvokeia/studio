'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { MiscellaneousCategory } from '@/lib/types';
import { MiscellaneousCategoriesColumnsWrapper } from './columns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ColumnFiltersState } from '@tanstack/react-table';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const categoryFormSchema = (t: (key: string) => string) => z.object({
    id: z.string().optional(),
    name: z.string().min(1, t('nameRequired')),
    code: z.string().min(1, t('codeRequired')),
    description: z.string().optional(),
    type: z.enum(['income', 'expense']),
    is_active: z.boolean().default(true),
});

type CategoryFormValues = z.infer<ReturnType<typeof categoryFormSchema>>;

async function getMiscellaneousCategories(): Promise<MiscellaneousCategory[]> {
    try {
        const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/misc_categories`, {
            method: 'GET',
            mode: 'cors',
            headers: { 'Accept': 'application/json' },
            cache: 'no-store',
        });
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        
        const data = await response.json();
        const categoriesData = Array.isArray(data) ? data : (data.data || []);

        return categoriesData.map((c: any) => ({ 
            ...c, 
            id: String(c.id),
            type: c.category_type 
        }));
    } catch (error) {
        console.error("Failed to fetch miscellaneous categories:", error);
        return [];
    }
}

async function upsertMiscellaneousCategory(categoryData: CategoryFormValues) {
    const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/misc_categories/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(categoryData),
    });
    const responseData = await response.json();
    if (!response.ok || (Array.isArray(responseData) && responseData[0]?.code >= 400) || responseData.error) {
        const message = responseData.message || (Array.isArray(responseData) && responseData[0]?.message) || 'Failed to save category';
        throw new Error(message);
    }
    return responseData;
}

async function deleteMiscellaneousCategory(id: string) {
    const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/misc_categories/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
    });
    const responseData = await response.json();
    if (!response.ok || (Array.isArray(responseData) && responseData[0]?.code >= 400) || responseData.error) {
        const message = responseData.message || (Array.isArray(responseData) && responseData[0]?.message) || 'Failed to delete category';
        throw new Error(message);
    }
    return responseData;
}

export default function MiscellaneousCategoriesPage() {
    const t = useTranslations('MiscellaneousCategoriesPage');
    const tValidation = useTranslations('MiscellaneousCategoriesPage.validation');
    const { toast } = useToast();
    const [categories, setCategories] = React.useState<MiscellaneousCategory[]>([]);
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingCategory, setEditingCategory] = React.useState<MiscellaneousCategory | null>(null);

    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
    const [deletingCategory, setDeletingCategory] = React.useState<MiscellaneousCategory | null>(null);

    const [submissionError, setSubmissionError] = React.useState<string | null>(null);
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

    const form = useForm<CategoryFormValues>({
        resolver: zodResolver(categoryFormSchema(tValidation)),
    });

    const loadCategories = React.useCallback(async () => {
        setIsRefreshing(true);
        const fetchedCategories = await getMiscellaneousCategories();
        setCategories(fetchedCategories);
        setIsRefreshing(false);
    }, []);

    React.useEffect(() => {
        loadCategories();
    }, [loadCategories]);

    const handleCreate = () => {
        setEditingCategory(null);
        form.reset({ name: '', code: '', description: '', type: 'expense', is_active: true });
        setSubmissionError(null);
        setIsDialogOpen(true);
    };
    
    const handleEdit = (category: MiscellaneousCategory) => {
        setEditingCategory(category);
        form.reset({
            id: category.id,
            name: category.name,
            code: category.code,
            description: category.description,
            type: category.type,
            is_active: category.is_active,
        });
        setSubmissionError(null);
        setIsDialogOpen(true);
    };

    const handleDelete = (category: MiscellaneousCategory) => {
        setDeletingCategory(category);
        setIsDeleteDialogOpen(true);
    };
    
    const confirmDelete = async () => {
        if (!deletingCategory) return;
        try {
            await deleteMiscellaneousCategory(deletingCategory.id);
            toast({ title: t('toast.deleteTitle'), description: t('toast.deleteDescription', { name: deletingCategory.name }) });
            setIsDeleteDialogOpen(false);
            setDeletingCategory(null);
            loadCategories();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: t('toast.errorTitle'),
                description: error instanceof Error ? error.message : t('toast.deleteError'),
            });
        }
    };

    const onSubmit = async (values: CategoryFormValues) => {
        setSubmissionError(null);
        try {
            await upsertMiscellaneousCategory(values);
            toast({ title: editingCategory ? t('toast.editTitle') : t('toast.createTitle'), description: t('toast.successDescription', { name: values.name }) });
            setIsDialogOpen(false);
            loadCategories();
        } catch (error) {
            setSubmissionError(error instanceof Error ? error.message : t('toast.genericError'));
        }
    };
    
    const columns = MiscellaneousCategoriesColumnsWrapper({ onEdit: handleEdit, onDelete: handleDelete });

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
                    data={categories} 
                    columnFilters={columnFilters}
                    onColumnFiltersChange={setColumnFilters}
                    filterColumnId="name" 
                    filterPlaceholder={t('filterPlaceholder')}
                    onCreate={handleCreate}
                    onRefresh={loadCategories}
                    isRefreshing={isRefreshing}
                />
            </CardContent>
        </Card>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{editingCategory ? t('dialog.editTitle') : t('dialog.createTitle')}</DialogTitle>
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
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('dialog.description')}</FormLabel>
                                    <FormControl>
                                        <Input placeholder={t('dialog.descriptionPlaceholder')} {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="type"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('dialog.type')}</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder={t('dialog.selectType')} /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value="income">{t('dialog.income')}</SelectItem>
                                        <SelectItem value="expense">{t('dialog.expense')}</SelectItem>
                                    </SelectContent>
                                    </Select>
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
                            <Button type="submit">{editingCategory ? t('dialog.save') : t('dialog.create')}</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
         <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{t('deleteDialog.title')}</AlertDialogTitle>
                    <AlertDialogDescription>{t('deleteDialog.description', { name: deletingCategory?.name })}</AlertDialogDescription>
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

    