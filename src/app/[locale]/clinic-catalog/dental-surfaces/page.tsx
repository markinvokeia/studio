
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
import { DentalSurface } from '@/lib/types';
import api from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { DentalSurfacesColumnsWrapper } from './columns';

const surfaceFormSchema = (t: (key: string) => string) => z.object({
    id: z.string().optional(),
    nombre: z.string().min(1, { message: t('validation.nameRequired') }),
    codigo: z.string().min(1, { message: t('validation.codeRequired') }),
});

type SurfaceFormValues = z.infer<ReturnType<typeof surfaceFormSchema>>;


async function getDentalSurfaces(): Promise<DentalSurface[]> {
    try {
        const data = await api.get(API_ROUTES.CLINIC_CATALOG.DENTAL_SURFACES);
        const surfacesData = Array.isArray(data) ? data : (data.catalogo_superficies_dentales || data.data || data.result || []);
        return surfacesData.map((apiSurface: any) => ({
            id: apiSurface.id ? String(apiSurface.id) : `surf_${Math.random().toString(36).substr(2, 9)}`,
            nombre: apiSurface.nombre,
            codigo: apiSurface.codigo,
        }));
    } catch (error) {
        console.error("Failed to fetch dental surfaces:", error);
        return [];
    }
}

async function upsertDentalSurface(surfaceData: SurfaceFormValues) {
    const responseData = await api.post(API_ROUTES.CLINIC_CATALOG.DENTAL_SURFACES_UPSERT, surfaceData);
    if (Array.isArray(responseData) && responseData[0]?.code >= 400) {
        const message = Array.isArray(responseData) && responseData[0]?.message ? responseData[0].message : 'Failed to save surface';
        throw new Error(message);
    }
    return responseData;
}

async function deleteDentalSurface(id: string) {
    const responseData = await api.delete(API_ROUTES.CLINIC_CATALOG.DENTAL_SURFACES_DELETE, { id });
    if (Array.isArray(responseData) && responseData[0]?.code >= 400) {
        const message = Array.isArray(responseData) && responseData[0]?.message ? responseData[0].message : 'Failed to delete surface';
        throw new Error(message);
    }
    return responseData;
}

export default function DentalSurfacesPage() {
    const t = useTranslations('DentalSurfacesPage');
    const { toast } = useToast();

    const [surfaces, setSurfaces] = React.useState<DentalSurface[]>([]);
    const [isRefreshing, setIsRefreshing] = React.useState(false);

    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingSurface, setEditingSurface] = React.useState<DentalSurface | null>(null);

    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
    const [deletingSurface, setDeletingSurface] = React.useState<DentalSurface | null>(null);

    const [submissionError, setSubmissionError] = React.useState<string | null>(null);

    const form = useForm<SurfaceFormValues>({
        resolver: zodResolver(surfaceFormSchema(t)),
        defaultValues: { nombre: '', codigo: '' },
    });

    const loadSurfaces = React.useCallback(async () => {
        setIsRefreshing(true);
        const fetchedSurfaces = await getDentalSurfaces();
        setSurfaces(fetchedSurfaces);
        setIsRefreshing(false);
    }, []);

    React.useEffect(() => {
        loadSurfaces();
    }, [loadSurfaces]);

    const handleCreate = () => {
        setEditingSurface(null);
        form.reset({ nombre: '', codigo: '' });
        setSubmissionError(null);
        setIsDialogOpen(true);
    };

    const handleEdit = (surface: DentalSurface) => {
        setEditingSurface(surface);
        form.reset({
            id: surface.id,
            nombre: surface.nombre,
            codigo: surface.codigo,
        });
        setSubmissionError(null);
        setIsDialogOpen(true);
    };

    const handleDelete = (surface: DentalSurface) => {
        setDeletingSurface(surface);
        setIsDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
        if (!deletingSurface) return;
        try {
            await deleteDentalSurface(deletingSurface.id);
            toast({
                title: t('toast.deleteSuccessTitle'),
                description: t('toast.deleteSuccessDescription', { name: deletingSurface.nombre }),
            });
            setIsDeleteDialogOpen(false);
            setDeletingSurface(null);
            loadSurfaces();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: t('toast.errorTitle'),
                description: error instanceof Error ? error.message : t('toast.deleteErrorDescription'),
            });
        }
    };

    const onSubmit = async (values: SurfaceFormValues) => {
        setSubmissionError(null);
        try {
            await upsertDentalSurface(values);
            toast({
                title: editingSurface ? t('toast.editSuccessTitle') : t('toast.createSuccessTitle'),
                description: t('toast.successDescription', { name: values.nombre }),
            });
            setIsDialogOpen(false);
            loadSurfaces();
        } catch (error) {
            setSubmissionError(error instanceof Error ? error.message : t('toast.genericError'));
        }
    };

    const dentalSurfacesColumns = DentalSurfacesColumnsWrapper({ onEdit: handleEdit, onDelete: handleDelete });


    return (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <Card className="flex-1 flex flex-col min-h-0 overflow-hidden shadow-sm border-0">
                <CardHeader className="bg-primary text-primary-foreground">
                    <CardTitle>{t('title')}</CardTitle>
                    <CardDescription className="text-primary-foreground/70">{t('description')}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden p-6 bg-background">
                    <DataTable
                        columns={dentalSurfacesColumns}
                        data={surfaces}
                        filterColumnId="nombre"
                        filterPlaceholder={t('filterPlaceholder')}
                        onCreate={handleCreate}
                        onRefresh={loadSurfaces}
                        isRefreshing={isRefreshing}
                    />
                </CardContent>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingSurface ? t('createDialog.editTitle') : t('createDialog.title')}</DialogTitle>
                        <DialogDescription>
                            {editingSurface ? t('createDialog.editDescription') : t('createDialog.description')}
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 px-6 py-4">
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
                                name="codigo"
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
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>{t('createDialog.cancel')}</Button>
                                <Button type="submit">{editingSurface ? t('createDialog.editSave') : t('createDialog.save')}</Button>
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
                            {t('deleteDialog.description', { name: deletingSurface?.nombre })}
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
