
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Ailment } from '@/lib/types';
import { AilmentsColumnsWrapper } from './columns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTranslations } from 'next-intl';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

const ailmentFormSchema = (t: (key: string) => string) => z.object({
    id: z.string().optional(),
    nombre: z.string().min(1, { message: t('validation.nameRequired') }),
    categoria: z.string().min(1, { message: t('validation.categoryRequired') }),
    nivel_alerta: z.string().min(1, { message: t('validation.alertLevelRequired') }),
});

type AilmentFormValues = z.infer<ReturnType<typeof ailmentFormSchema>>;


async function getAilments(): Promise<Ailment[]> {
    try {
        const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/catalogo_padecimientos', {
            method: 'GET',
            mode: 'cors',
            headers: { 'Accept': 'application/json' },
            cache: 'no-store',
        });
        if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
        const data = await response.json();
        const ailmentsData = Array.isArray(data) ? data : (data.catalogo_padecimientos || data.data || data.result || []);
        return ailmentsData.map((apiAilment: any) => ({
            id: String(apiAilment.id),
            nombre: apiAilment.nombre,
            categoria: apiAilment.categoria,
            nivel_alerta: Number(apiAilment.nivel_alerta)
        }));
    } catch (error) {
        console.error("Failed to fetch ailments:", error);
        return [];
    }
}

async function upsertAilment(ailmentData: AilmentFormValues) {
    const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/padecimientos/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            ...ailmentData,
            nivel_alerta: Number(ailmentData.nivel_alerta),
        }),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to save ailment' }));
        throw new Error(errorData.message);
    }
    return response.json();
}

async function deleteAilment(id: string) {
    const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/padecimientos/delete', {
        method: 'POST', // Assuming DELETE might not be supported, using POST as per instruction.
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
    });
     if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to delete ailment' }));
        throw new Error(errorData.message);
    }
    return response.json();
}


export default function AilmentsPage() {
    const t = useTranslations('AilmentsPage');
    const { toast } = useToast();
    
    const [ailments, setAilments] = React.useState<Ailment[]>([]);
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingAilment, setEditingAilment] = React.useState<Ailment | null>(null);

    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
    const [deletingAilment, setDeletingAilment] = React.useState<Ailment | null>(null);

    const [submissionError, setSubmissionError] = React.useState<string | null>(null);

    const form = useForm<AilmentFormValues>({
        resolver: zodResolver(ailmentFormSchema(t)),
        defaultValues: { nombre: '', categoria: '', nivel_alerta: '' },
    });

    const loadAilments = React.useCallback(async () => {
        setIsRefreshing(true);
        const fetchedAilments = await getAilments();
        setAilments(fetchedAilments);
        setIsRefreshing(false);
    }, []);

    React.useEffect(() => {
        loadAilments();
    }, [loadAilments]);

    const handleCreate = () => {
        setEditingAilment(null);
        form.reset({ nombre: '', categoria: '', nivel_alerta: '' });
        setSubmissionError(null);
        setIsDialogOpen(true);
    };
    
    const handleEdit = (ailment: Ailment) => {
        setEditingAilment(ailment);
        form.reset({
            id: ailment.id,
            nombre: ailment.nombre,
            categoria: ailment.categoria,
            nivel_alerta: String(ailment.nivel_alerta),
        });
        setSubmissionError(null);
        setIsDialogOpen(true);
    };

    const handleDelete = (ailment: Ailment) => {
        setDeletingAilment(ailment);
        setIsDeleteDialogOpen(true);
    };
    
    const confirmDelete = async () => {
        if (!deletingAilment) return;
        try {
            await deleteAilment(deletingAilment.id);
            toast({
                title: t('toast.deleteSuccessTitle'),
                description: t('toast.deleteSuccessDescription', { name: deletingAilment.nombre }),
            });
            setIsDeleteDialogOpen(false);
            setDeletingAilment(null);
            loadAilments();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: t('toast.errorTitle'),
                description: error instanceof Error ? error.message : t('toast.deleteErrorDescription'),
            });
        }
    };

    const onSubmit = async (values: AilmentFormValues) => {
        setSubmissionError(null);
        try {
            await upsertAilment(values);
            toast({
                title: editingAilment ? t('toast.editSuccessTitle') : t('toast.createSuccessTitle'),
                description: t('toast.successDescription', { name: values.nombre }),
            });
            setIsDialogOpen(false);
            loadAilments();
        } catch (error) {
            setSubmissionError(error instanceof Error ? error.message : t('toast.genericError'));
        }
    };
    
    const ailmentsColumns = AilmentsColumnsWrapper({ onEdit: handleEdit, onDelete: handleDelete });


    return (
        <>
        <Card>
            <CardHeader>
                <CardTitle>{t('title')}</CardTitle>
                <CardDescription>{t('description')}</CardDescription>
            </CardHeader>
            <CardContent>
                <DataTable 
                    columns={ailmentsColumns} 
                    data={ailments} 
                    filterColumnId="nombre" 
                    filterPlaceholder={t('filterPlaceholder')}
                    onCreate={handleCreate}
                    onRefresh={loadAilments}
                    isRefreshing={isRefreshing}
                />
            </CardContent>
        </Card>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent>
                <DialogHeader>
                <DialogTitle>{editingAilment ? t('createDialog.editTitle') : t('createDialog.title')}</DialogTitle>
                <DialogDescription>
                    {editingAilment ? t('createDialog.editDescription') : t('createDialog.description')}
                </DialogDescription>
                </DialogHeader>
                 <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        {submissionError && (
                            <Alert variant="destructive">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>{t('toast.errorTitle')}</AlertTitle>
                                <AlertDescription>{submissionError}</AlertDescription>
                            </Alert>
                        )}
                        <FormField
                            control={form.control}
                            name="nombre"
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
                            name="categoria"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('createDialog.category')}</FormLabel>
                                    <FormControl>
                                        <Input placeholder={t('createDialog.categoryPlaceholder')} {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="nivel_alerta"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('createDialog.alertLevel')}</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder={t('createDialog.alertLevelPlaceholder')} />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="1">{t('createDialog.level1')}</SelectItem>
                                        <SelectItem value="2">{t('createDialog.level2')}</SelectItem>
                                        <SelectItem value="3">{t('createDialog.level3')}</SelectItem>
                                    </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>{t('createDialog.cancel')}</Button>
                            <Button type="submit">{editingAilment ? t('createDialog.editSave') : t('createDialog.save')}</Button>
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
                    {t('deleteDialog.description', { name: deletingAilment?.nombre })}
                </AlertDialogDescription>
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
