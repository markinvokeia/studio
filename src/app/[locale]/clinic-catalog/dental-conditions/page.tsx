'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { DentalCondition } from '@/lib/types';
import api from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { DentalConditionsColumnsWrapper } from './columns';

const conditionFormSchema = (t: (key: string) => string) => z.object({
    id: z.string().optional(),
    nombre: z.string().min(1, { message: t('validation.nameRequired') }),
    codigo_visual: z.string().min(1, { message: t('validation.codeRequired') }),
    color_hex: z.string().regex(/^#[0-9a-fA-F]{6}$/, { message: t('validation.colorInvalid') }),
});

type ConditionFormValues = z.infer<ReturnType<typeof conditionFormSchema>>;

async function getDentalConditions(): Promise<DentalCondition[]> {
    try {
        const data = await api.get(API_ROUTES.CLINIC_CATALOG.DENTAL_CONDITIONS);
        const conditionsData = Array.isArray(data) ? data : (data.catalogo_condiciones_dentales || data.data || data.result || []);
        return conditionsData.map((apiCondition: any) => ({
            id: apiCondition.id ? String(apiCondition.id) : `cond_${Math.random().toString(36).substr(2, 9)}`,
            nombre: apiCondition.nombre,
            codigo_visual: apiCondition.codigo_visual,
            color_hex: apiCondition.color_hex,
        }));
    } catch (error) {
        console.error("Failed to fetch dental conditions:", error);
        return [];
    }
}

async function upsertDentalCondition(conditionData: ConditionFormValues) {
    const responseData = await api.post(API_ROUTES.CLINIC_CATALOG.DENTAL_CONDITIONS_UPSERT, conditionData);
    if (Array.isArray(responseData) && responseData[0]?.code >= 400) {
        const message = Array.isArray(responseData) && responseData[0]?.message ? responseData[0].message : 'Failed to save condition';
        throw new Error(message);
    }
    return responseData;
}

async function deleteDentalCondition(id: string) {
    const responseData = await api.delete(API_ROUTES.CLINIC_CATALOG.DENTAL_CONDITIONS_DELETE, { id });
    if (Array.isArray(responseData) && responseData[0]?.code >= 400) {
        const message = Array.isArray(responseData) && responseData[0]?.message ? responseData[0].message : 'Failed to delete condition';
        throw new Error(message);
    }
    return responseData;
}

export default function DentalConditionsPage() {
    const t = useTranslations('DentalConditionsPage');
    const { toast } = useToast();

    const [conditions, setConditions] = React.useState<DentalCondition[]>([]);
    const [isRefreshing, setIsRefreshing] = React.useState(false);

    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingCondition, setEditingCondition] = React.useState<DentalCondition | null>(null);

    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
    const [deletingCondition, setDeletingCondition] = React.useState<DentalCondition | null>(null);

    const [submissionError, setSubmissionError] = React.useState<string | null>(null);

    const form = useForm<ConditionFormValues>({
        resolver: zodResolver(conditionFormSchema(t)),
        defaultValues: { nombre: '', codigo_visual: '', color_hex: '#ffffff' },
    });

    const loadConditions = React.useCallback(async () => {
        setIsRefreshing(true);
        const fetchedConditions = await getDentalConditions();
        setConditions(fetchedConditions);
        setIsRefreshing(false);
    }, []);

    React.useEffect(() => {
        loadConditions();
    }, [loadConditions]);

    const handleCreate = () => {
        setEditingCondition(null);
        form.reset({ nombre: '', codigo_visual: '', color_hex: '#ffffff' });
        setSubmissionError(null);
        setIsDialogOpen(true);
    };

    const handleEdit = (condition: DentalCondition) => {
        setEditingCondition(condition);
        form.reset({
            id: condition.id,
            nombre: condition.nombre,
            codigo_visual: condition.codigo_visual,
            color_hex: condition.color_hex || '#ffffff',
        });
        setSubmissionError(null);
        setIsDialogOpen(true);
    };

    const handleDelete = (condition: DentalCondition) => {
        setDeletingCondition(condition);
        setIsDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
        if (!deletingCondition) return;
        try {
            await deleteDentalCondition(deletingCondition.id);
            toast({
                title: t('toast.deleteSuccessTitle'),
                description: t('toast.deleteSuccessDescription', { name: deletingCondition.nombre }),
            });
            setIsDeleteDialogOpen(false);
            setDeletingCondition(null);
            loadConditions();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: t('toast.errorTitle'),
                description: error instanceof Error ? error.message : t('toast.deleteErrorDescription'),
            });
        }
    };

    const onSubmit = async (values: ConditionFormValues) => {
        setSubmissionError(null);
        try {
            await upsertDentalCondition(values);
            toast({
                title: editingCondition ? t('toast.editSuccessTitle') : t('toast.createSuccessTitle'),
                description: t('toast.successDescription', { name: values.nombre }),
            });
            setIsDialogOpen(false);
            loadConditions();
        } catch (error) {
            setSubmissionError(error instanceof Error ? error.message : t('toast.genericError'));
        }
    };

    const dentalConditionsColumns = DentalConditionsColumnsWrapper({ onEdit: handleEdit, onDelete: handleDelete });


    return (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <CardHeader className="flex-none">
                    <CardTitle>{t('title')}</CardTitle>
                    <CardDescription>{t('description')}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    <DataTable
                        columns={dentalConditionsColumns}
                        data={conditions}
                        filterColumnId="nombre"
                        filterPlaceholder={t('filterPlaceholder')}
                        onCreate={handleCreate}
                        onRefresh={loadConditions}
                        isRefreshing={isRefreshing}
                    />
                </CardContent>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingCondition ? t('createDialog.editTitle') : t('createDialog.title')}</DialogTitle>
                        <DialogDescription>
                            {editingCondition ? t('createDialog.editDescription') : t('createDialog.description')}
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
                                name="codigo_visual"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('createDialog.visualCode')}</FormLabel>
                                        <FormControl>
                                            <Input placeholder={t('createDialog.visualCodePlaceholder')} {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="color_hex"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('createDialog.color')}</FormLabel>
                                        <FormControl>
                                            <div className="flex items-center gap-2">
                                                <Input type="color" className="p-1 h-10 w-14" {...field} />
                                                <Input placeholder="#FFFFFF" {...field} />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>{t('createDialog.cancel')}</Button>
                                <Button type="submit">{editingCondition ? t('createDialog.editSave') : t('createDialog.save')}</Button>
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
                            {t('deleteDialog.description', { name: deletingCondition?.nombre })}
                        </AlertDialogDescription>
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
