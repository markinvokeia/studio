
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Medication } from '@/lib/types';
import { MedicationsColumnsWrapper } from './columns';
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
import { useTranslations } from 'next-intl';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

const medicationFormSchema = (t: (key: string) => string) => z.object({
    id: z.string().optional(),
    nombre_generico: z.string().min(1, { message: t('validation.nameRequired') }),
    nombre_comercial: z.string().optional(),
});

type MedicationFormValues = z.infer<ReturnType<typeof medicationFormSchema>>;

async function getMedications(): Promise<Medication[]> {
    try {
        const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/catalogo_medicamentos', {
            method: 'GET',
            mode: 'cors',
            headers: { 'Accept': 'application/json' },
            cache: 'no-store',
        });
        if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
        const data = await response.json();
        const medicationsData = Array.isArray(data) ? data : (data.catalogo_medicamentos || data.data || data.result || []);
        return medicationsData.map((apiMedication: any) => ({
            id: String(apiMedication.id),
            nombre_generico: apiMedication.nombre_generico,
            nombre_comercial: apiMedication.nombre_comercial,
        }));
    } catch (error) {
        console.error("Failed to fetch medications:", error);
        return [];
    }
}

async function upsertMedication(medicationData: MedicationFormValues) {
    const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/medicamentos/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(medicationData),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to save medication' }));
        throw new Error(errorData.message);
    }
    return response.json();
}

async function deleteMedication(id: string) {
    const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/medicamentos/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
    });
     if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to delete medication' }));
        throw new Error(errorData.message);
    }
    return response.json();
}

export default function MedicationsPage() {
    const t = useTranslations('MedicationsPage');
    const { toast } = useToast();
    
    const [medications, setMedications] = React.useState<Medication[]>([]);
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingMedication, setEditingMedication] = React.useState<Medication | null>(null);

    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
    const [deletingMedication, setDeletingMedication] = React.useState<Medication | null>(null);

    const [submissionError, setSubmissionError] = React.useState<string | null>(null);

    const form = useForm<MedicationFormValues>({
        resolver: zodResolver(medicationFormSchema(t)),
        defaultValues: { nombre_generico: '', nombre_comercial: '' },
    });

    const loadMedications = React.useCallback(async () => {
        setIsRefreshing(true);
        const fetchedMedications = await getMedications();
        setMedications(fetchedMedications);
        setIsRefreshing(false);
    }, []);

    React.useEffect(() => {
        loadMedications();
    }, [loadMedications]);

    const handleCreate = () => {
        setEditingMedication(null);
        form.reset({ nombre_generico: '', nombre_comercial: '' });
        setSubmissionError(null);
        setIsDialogOpen(true);
    };
    
    const handleEdit = (medication: Medication) => {
        setEditingMedication(medication);
        form.reset({
            id: medication.id,
            nombre_generico: medication.nombre_generico,
            nombre_comercial: medication.nombre_comercial,
        });
        setSubmissionError(null);
        setIsDialogOpen(true);
    };

    const handleDelete = (medication: Medication) => {
        setDeletingMedication(medication);
        setIsDeleteDialogOpen(true);
    };
    
    const confirmDelete = async () => {
        if (!deletingMedication) return;
        try {
            await deleteMedication(deletingMedication.id);
            toast({
                title: t('toast.deleteSuccessTitle'),
                description: t('toast.deleteSuccessDescription', { name: deletingMedication.nombre_generico }),
            });
            setIsDeleteDialogOpen(false);
            setDeletingMedication(null);
            loadMedications();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: t('toast.errorTitle'),
                description: error instanceof Error ? error.message : t('toast.deleteErrorDescription'),
            });
        }
    };

    const onSubmit = async (values: MedicationFormValues) => {
        setSubmissionError(null);
        try {
            await upsertMedication(values);
            toast({
                title: editingMedication ? t('toast.editSuccessTitle') : t('toast.createSuccessTitle'),
                description: t('toast.successDescription', { name: values.nombre_generico }),
            });
            setIsDialogOpen(false);
            loadMedications();
        } catch (error) {
            setSubmissionError(error instanceof Error ? error.message : t('toast.genericError'));
        }
    };
    
    const medicationsColumns = MedicationsColumnsWrapper({ onEdit: handleEdit, onDelete: handleDelete });


    return (
        <>
        <Card>
            <CardHeader>
                <CardTitle>{t('title')}</CardTitle>
                <CardDescription>{t('description')}</CardDescription>
            </CardHeader>
            <CardContent>
                <DataTable 
                    columns={medicationsColumns} 
                    data={medications} 
                    filterColumnId="nombre_generico" 
                    filterPlaceholder={t('filterPlaceholder')}
                    onCreate={handleCreate}
                    onRefresh={loadMedications}
                    isRefreshing={isRefreshing}
                />
            </CardContent>
        </Card>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent>
                <DialogHeader>
                <DialogTitle>{editingMedication ? t('createDialog.editTitle') : t('createDialog.title')}</DialogTitle>
                <DialogDescription>
                    {editingMedication ? t('createDialog.editDescription') : t('createDialog.description')}
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
                            name="nombre_generico"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('createDialog.genericName')}</FormLabel>
                                    <FormControl>
                                        <Input placeholder={t('createDialog.genericNamePlaceholder')} {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="nombre_comercial"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('createDialog.commercialName')}</FormLabel>
                                    <FormControl>
                                        <Input placeholder={t('createDialog.commercialNamePlaceholder')} {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>{t('createDialog.cancel')}</Button>
                            <Button type="submit">{editingMedication ? t('createDialog.editSave') : t('createDialog.save')}</Button>
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
                    {t('deleteDialog.description', { name: deletingMedication?.nombre_generico })}
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
