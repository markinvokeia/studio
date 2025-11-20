'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ServicesColumnsWrapper } from './columns';
import { Service } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const serviceFormSchema = (t: (key: string) => string) => z.object({
  id: z.string().optional(),
  name: z.string().min(1, t('nameRequired')),
  category: z.string().min(1, t('categoryRequired')),
  price: z.coerce.number().positive(t('pricePositive')),
  currency: z.enum(['UYU', 'USD']).default('USD'),
  duration_minutes: z.coerce.number().int().positive(t('durationInteger')),
  description: z.string().optional(),
  indications: z.string().optional(),
});

type ServiceFormValues = z.infer<ReturnType<typeof serviceFormSchema>>;

async function getServices(): Promise<Service[]> {
  try {
    const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/services?is_sales=true', {
      method: 'GET',
      mode: 'cors',
      headers: {
        'Accept': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    const servicesData = Array.isArray(data) ? data : (data.services || data.data || data.result || []);

    return servicesData.map((apiService: any) => ({
      id: apiService.id ? String(apiService.id) : `srv_${Math.random().toString(36).substr(2, 9)}`,
      name: apiService.name || 'No Name',
      category: apiService.category || 'No Category',
      price: apiService.price || 0,
      currency: apiService.currency || 'USD',
      duration_minutes: apiService.duration_minutes || 0,
      description: apiService.description,
      indications: apiService.indications,
      is_active: apiService.is_active,
    }));
  } catch (error) {
    console.error("Failed to fetch services:", error);
    return [];
  }
}

async function upsertService(serviceData: ServiceFormValues) {
    const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/catalogoservicios/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({...serviceData, is_sales: true}),
    });
    const responseData = await response.json();
    if (!response.ok || (Array.isArray(responseData) && responseData[0]?.code >= 400)) {
        const message = Array.isArray(responseData) && responseData[0]?.message ? responseData[0].message : 'Failed to save service';
        throw new Error(message);
    }
    return responseData;
}

async function deleteService(id: string) {
    const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/catalogoservicios/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_sales: true }),
    });
    const responseData = await response.json();
    if (!response.ok || (Array.isArray(responseData) && responseData[0]?.code >= 400)) {
        const message = Array.isArray(responseData) && responseData[0]?.message ? responseData[0].message : 'Failed to delete service';
        throw new Error(message);
    }
    return responseData;
}

export default function ServicesPage() {
  const t = useTranslations('ServicesPage');
  const tValidation = useTranslations('ServicesPage.validation');
  const [services, setServices] = React.useState<Service[]>([]);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [editingService, setEditingService] = React.useState<Service | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [deletingService, setDeletingService] = React.useState<Service | null>(null);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [submissionError, setSubmissionError] = React.useState<string | null>(null);

  const { toast } = useToast();

  const form = useForm<ServiceFormValues>({
    resolver: zodResolver(serviceFormSchema(tValidation)),
  });

  const loadServices = React.useCallback(async () => {
    setIsRefreshing(true);
    const fetchedServices = await getServices();
    setServices(fetchedServices);
    setIsRefreshing(false);
  }, []);

  React.useEffect(() => {
    loadServices();
  }, [loadServices]);

  const handleCreate = () => {
    setEditingService(null);
    form.reset({
      name: '',
      category: '',
      price: 0,
      currency: 'USD',
      duration_minutes: 60,
      description: '',
      indications: '',
    });
    setSubmissionError(null);
    setIsDialogOpen(true);
  };
  
  const handleEdit = (service: Service) => {
    setEditingService(service);
    form.reset({
        id: service.id,
        name: service.name,
        category: service.category,
        price: service.price,
        currency: service.currency || 'USD',
        duration_minutes: service.duration_minutes,
        description: service.description,
        indications: service.indications,
    });
    setSubmissionError(null);
    setIsDialogOpen(true);
  };

  const handleDelete = (service: Service) => {
    setDeletingService(service);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingService) return;
    try {
        await deleteService(deletingService.id);
        toast({
            title: t('toast.deleteSuccessTitle'),
            description: t('toast.deleteSuccessDescription', {name: deletingService.name}),
        });
        setIsDeleteDialogOpen(false);
        setDeletingService(null);
        loadServices();
    } catch (error) {
        toast({
            variant: 'destructive',
            title: t('toast.errorTitle'),
            description: error instanceof Error ? error.message : t('toast.deleteErrorDescription'),
        });
    }
  };

  const onSubmit = async (values: ServiceFormValues) => {
    setSubmissionError(null);
    try {
        await upsertService(values);
        toast({
            title: editingService ? t('toast.editSuccessTitle') : t('toast.createSuccessTitle'),
            description: t('toast.successDescription', {name: values.name}),
        });
        setIsDialogOpen(false);
        loadServices();
    } catch (error) {
        setSubmissionError(error instanceof Error ? error.message : t('toast.genericError'));
    }
  };
  
  const servicesColumns = ServicesColumnsWrapper({ onEdit: handleEdit, onDelete: handleDelete });


  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable 
          columns={servicesColumns} 
          data={services} 
          filterColumnId="name" 
          filterPlaceholder={t('filterPlaceholder')} 
          onCreate={handleCreate}
          onRefresh={loadServices}
          isRefreshing={isRefreshing}
        />
      </CardContent>
    </Card>

    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingService ? t('createDialog.editTitle') : t('createDialog.title')}</DialogTitle>
          <DialogDescription>
            {editingService ? t('createDialog.editDescription') : t('createDialog.description')}
          </DialogDescription>
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
                    name="category"
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
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                      control={form.control}
                      name="price"
                      render={({ field }) => (
                          <FormItem>
                          <FormLabel>{t('createDialog.price')}</FormLabel>
                          <FormControl>
                              <Input type="number" placeholder="0.00" {...field} />
                          </FormControl>
                          <FormMessage />
                          </FormItem>
                      )}
                  />
                   <FormField
                      control={form.control}
                      name="currency"
                      render={({ field }) => (
                          <FormItem>
                              <FormLabel>{t('createDialog.currency')}</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                  <SelectTrigger>
                                      <SelectValue placeholder={t('createDialog.selectCurrency')} />
                                  </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                  <SelectItem value="USD">USD</SelectItem>
                                  <SelectItem value="UYU">UYU</SelectItem>
                              </SelectContent>
                              </Select>
                              <FormMessage />
                          </FormItem>
                      )}
                  />
                </div>
                <FormField
                    control={form.control}
                    name="duration_minutes"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>{t('createDialog.duration')}</FormLabel>
                        <FormControl>
                            <Input type="number" placeholder="60" {...field} />
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
                        <FormLabel>{t('createDialog.descriptionLabel')}</FormLabel>
                        <FormControl>
                            <Textarea placeholder={t('createDialog.descriptionPlaceholder')} {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="indications"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>{t('createDialog.indicationsLabel')}</FormLabel>
                        <FormControl>
                            <Textarea placeholder={t('createDialog.indicationsPlaceholder')} {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                <DialogFooter>
                    <Button variant="outline" type="button" onClick={() => setIsDialogOpen(false)}>{t('createDialog.cancel')}</Button>
                    <Button type="submit">{editingService ? t('createDialog.editSave') : t('createDialog.save')}</Button>
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
                    {t('deleteDialog.description', {name: deletingService?.name})}
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
