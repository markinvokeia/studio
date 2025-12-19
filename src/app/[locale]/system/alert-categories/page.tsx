
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AlertCategory } from '@/lib/types';
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
import { AlertTriangle, MoreHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';

const categoryFormSchema = z.object({
  id: z.string().optional(),
  code: z.string().min(1, 'Code is required.'),
  name: z.string().min(1, 'Name is required.'),
  description: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  sort_order: z.coerce.number().optional(),
  is_active: z.boolean().default(true),
});

type CategoryFormValues = z.infer<typeof categoryFormSchema>;

async function getCategories(): Promise<AlertCategory[]> {
    return [
        { id: '1', code: 'APPOINTMENTS', name: 'Appointments', description: 'Alerts related to patient appointments.', icon: 'calendar', color: '#3b82f6', is_active: true, sort_order: 1 },
        { id: '2', code: 'BILLING', name: 'Billing', description: 'Alerts related to invoices and payments.', icon: 'dollar-sign', color: '#10b981', is_active: true, sort_order: 2 },
        { id: '3', code: 'FOLLOWUP', name: 'Follow-up', description: 'Post-consultation follow-up alerts.', icon: 'stethoscope', color: '#f97316', is_active: true, sort_order: 3 },
    ];
}

export default function AlertCategoriesPage() {
    const t = useTranslations('AlertCategoriesPage');
    const { toast } = useToast();
    const [categories, setCategories] = React.useState<AlertCategory[]>([]);
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingCategory, setEditingCategory] = React.useState<AlertCategory | null>(null);

    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
    const [deletingCategory, setDeletingCategory] = React.useState<AlertCategory | null>(null);

    const [submissionError, setSubmissionError] = React.useState<string | null>(null);

    const form = useForm<CategoryFormValues>({
        resolver: zodResolver(categoryFormSchema),
    });

    const loadCategories = React.useCallback(async () => {
        setIsRefreshing(true);
        const fetchedCategories = await getCategories();
        setCategories(fetchedCategories);
        setIsRefreshing(false);
    }, []);

    React.useEffect(() => {
        loadCategories();
    }, [loadCategories]);

    const handleCreate = () => {
        setEditingCategory(null);
        form.reset({ code: '', name: '', description: '', icon: '', color: '', sort_order: 0, is_active: true });
        setSubmissionError(null);
        setIsDialogOpen(true);
    };
    
    const handleEdit = (category: AlertCategory) => {
        setEditingCategory(category);
        form.reset(category);
        setSubmissionError(null);
        setIsDialogOpen(true);
    };

    const handleDelete = (category: AlertCategory) => {
        setDeletingCategory(category);
        setIsDeleteDialogOpen(true);
    };
    
    const confirmDelete = async () => {
        if (!deletingCategory) return;
        toast({ title: t('toast.deleteSuccessTitle'), description: t('toast.deleteSuccessDescription', { name: deletingCategory.name }) });
        setIsDeleteDialogOpen(false);
        setDeletingCategory(null);
        // await deleteCategory(deletingCategory.id);
        loadCategories();
    };

    const onSubmit = async (values: CategoryFormValues) => {
        setSubmissionError(null);
        toast({ title: editingCategory ? t('toast.editSuccessTitle') : t('toast.createSuccessTitle'), description: t('toast.successDescription', { name: values.name }) });
        setIsDialogOpen(false);
        // await upsertCategory(values);
        loadCategories();
    };
    
    const columns: ColumnDef<AlertCategory>[] = [
        { accessorKey: 'code', header: ({column}) => <DataTableColumnHeader column={column} title={t('columns.code')} /> },
        { accessorKey: 'name', header: ({column}) => <DataTableColumnHeader column={column} title={t('columns.name')} /> },
        { accessorKey: 'description', header: ({column}) => <DataTableColumnHeader column={column} title={t('columns.description')} /> },
        { accessorKey: 'is_active', header: ({column}) => <DataTableColumnHeader column={column} title={t('columns.isActive')} />,
            cell: ({ row }) => row.original.is_active ? t('columns.yes') : t('columns.no')
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
                        <FormField control={form.control} name="code" render={({ field }) => (
                            <FormItem><FormLabel>{t('dialog.code')}</FormLabel><FormControl><Input placeholder={t('dialog.codePlaceholder')} {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="name" render={({ field }) => (
                            <FormItem><FormLabel>{t('dialog.name')}</FormLabel><FormControl><Input placeholder={t('dialog.namePlaceholder')} {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="description" render={({ field }) => (
                            <FormItem><FormLabel>{t('dialog.description')}</FormLabel><FormControl><Textarea placeholder={t('dialog.descriptionPlaceholder')} {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="icon" render={({ field }) => (
                            <FormItem><FormLabel>{t('dialog.icon')}</FormLabel><FormControl><Input placeholder={t('dialog.iconPlaceholder')} {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="color" render={({ field }) => (
                            <FormItem><FormLabel>{t('dialog.color')}</FormLabel><FormControl><Input type="color" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="sort_order" render={({ field }) => (
                            <FormItem><FormLabel>{t('dialog.sortOrder')}</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="is_active" render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-3 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>{t('dialog.isActive')}</FormLabel></FormItem>
                        )} />
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
