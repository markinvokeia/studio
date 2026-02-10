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
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { normalizeApiResponse } from '@/lib/api-utils';
import { MiscellaneousCategory, Service } from '@/lib/types';
import api from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { ServicesColumnsWrapper } from './columns';

console.log("Services Page Loaded. API_ROUTES.SERVICES:", API_ROUTES.SERVICES);

const serviceFormSchema = (t: (key: string) => string) => z.object({
  id: z.string().optional(),
  name: z.string().min(1, t('nameRequired')),
  category_id: z.string().min(1, t('categoryRequired')),
  category: z.string().optional(),
  price: z.coerce.number().positive(t('pricePositive')),
  currency: z.enum(['UYU', 'USD']).default('USD'),
  duration_minutes: z.coerce.number().int().positive(t('durationInteger')),
  description: z.string().optional(),
  indications: z.string().optional(),
  color: z.string().optional(),
  is_active: z.boolean().default(true),
});

type ServiceFormValues = z.infer<ReturnType<typeof serviceFormSchema>>;

async function getServices(): Promise<Service[]> {
  try {
    const data = await api.get(API_ROUTES.SERVICES, { is_sales: 'true' });
    const normalized = normalizeApiResponse(data);
    console.log("Normalized Sales Services Items Count:", normalized.items.length);

    const services = normalized.items.map((apiService: any) => ({
      id: apiService.id ? String(apiService.id) : `srv_${Math.random().toString(36).substr(2, 9)}`,
      name: apiService.name || 'No Name',
      category: apiService.category_name || apiService.category || 'No Category',
      category_id: apiService.category_id ? String(apiService.category_id) : undefined,
      price: apiService.price || 0,
      currency: apiService.currency || 'USD',
      duration_minutes: apiService.duration_minutes || 0,
      description: apiService.description,
      indications: apiService.indications,
      color: apiService.color || null,
      is_active: apiService.is_active,
    }));
    return services;
  } catch (error) {
    console.error("Failed to fetch services:", error);
    return [];
  }
}

async function getMiscellaneousCategories(): Promise<MiscellaneousCategory[]> {
  try {
    const data = await api.get(API_ROUTES.PURCHASES.MISC_CATEGORIES, { limit: '1000' });
    const normalized = normalizeApiResponse(data);

    const categories = normalized.items.map((c: any) => ({
      ...c,
      id: String(c.id),
      type: c.category_type || c.type
    }));
    return categories;
  } catch (error) {
    console.error("Failed to fetch miscellaneous categories:", error);
    return [];
  }
}

async function upsertService(serviceData: ServiceFormValues, categories: MiscellaneousCategory[]) {
  // Find category name based on category_id for backend compatibility
  const category = categories.find(cat => cat.id === serviceData.category_id)?.name || '';
  const responseData = await api.post(API_ROUTES.PURCHASES.SERVICES_UPSERT, { 
    ...serviceData, 
    category,
    is_sales: true 
  });

  // Check for error responses in array format
  if (Array.isArray(responseData) && responseData.length > 0) {
    const firstItem = responseData[0];
    if (firstItem && (firstItem.code >= 400 || firstItem.error)) {
      const message = firstItem.message || firstItem.error || 'Failed to save service';
      throw new Error(message);
    }
  }

  // Check for error responses in object format
  if (responseData && typeof responseData === 'object' && !Array.isArray(responseData)) {
    if (responseData.error || responseData.code >= 400) {
      const message = responseData.message || responseData.error || 'Failed to save service';
      throw new Error(message);
    }
  }

  return responseData;
}

async function deleteService(id: string) {
  const responseData = await api.delete(API_ROUTES.SERVICES_DELETE, { id, is_sales: true });

  // Check for error responses in array format
  if (Array.isArray(responseData) && responseData.length > 0) {
    const firstItem = responseData[0];
    if (firstItem && (firstItem.code >= 400 || firstItem.error)) {
      const message = firstItem.message || firstItem.error || 'Failed to delete service';
      throw new Error(message);
    }
  }

  // Check for error responses in object format
  if (responseData && typeof responseData === 'object' && !Array.isArray(responseData)) {
    if (responseData.error || responseData.code >= 400) {
      const message = responseData.message || responseData.error || 'Failed to delete service';
      throw new Error(message);
    }
  }

  return responseData;
}

export default function ServicesPage() {
  const t = useTranslations('ServicesPage');
  const tValidation = useTranslations('ServicesPage.validation');
  const tColumns = useTranslations('ServicesColumns');
  const [services, setServices] = React.useState<Service[]>([]);
  const [categories, setCategories] = React.useState<MiscellaneousCategory[]>([]);
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

  React.useEffect(() => {
    if (isDialogOpen) {
      getMiscellaneousCategories().then(setCategories);
    }
  }, [isDialogOpen]);

const handleCreate = () => {
    setEditingService(null);
    form.reset({
      name: '',
      category_id: '',
      price: 0,
      currency: 'USD',
      duration_minutes: 60,
      description: '',
      indications: '',
      color: '',
      is_active: true,
    });
    setSubmissionError(null);
    setIsDialogOpen(true);
  };

const handleEdit = (service: Service) => {
    setEditingService(service);
    form.reset({
      id: service.id,
      name: service.name,
      category_id: service.category_id,
      price: service.price,
      currency: service.currency || 'USD',
      duration_minutes: service.duration_minutes,
      description: service.description,
      indications: service.indications,
      color: service.color || '',
      is_active: service.is_active,
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
        description: t('toast.deleteSuccessDescription', { name: deletingService.name }),
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
      await upsertService(values, categories);
      toast({
        title: editingService ? t('toast.editSuccessTitle') : t('toast.createSuccessTitle'),
        description: t('toast.successDescription', { name: values.name }),
      });
      setIsDialogOpen(false);
      loadServices();
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : t('toast.genericError'));
    }
  };

  const servicesColumns = ServicesColumnsWrapper({ onEdit: handleEdit, onDelete: handleDelete });

  const columnTranslations = {
    id: tColumns('id'),
    name: tColumns('name'),
    category: tColumns('category'),
    price: tColumns('price'),
    currency: tColumns('currency'),
    duration_minutes: tColumns('duration'),
    color: tColumns('color'),
    actions: tColumns('actions'),
  };


  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <CardHeader className="flex-none">
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <DataTable
            columns={servicesColumns}
            data={services}
            filterColumnId="name"
            filterPlaceholder={t('filterPlaceholder')}
            onCreate={handleCreate}
            onRefresh={loadServices}
            isRefreshing={isRefreshing}
            columnTranslations={columnTranslations}
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
                name="category_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('createDialog.category')}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('createDialog.categoryPlaceholder')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
<FormField
                control={form.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('createDialog.colorLabel')}</FormLabel>
                    <FormControl>
                      <div className="flex items-center space-x-2">
                        <Input
                          type="color"
                          className="w-16 h-10 p-1 border rounded cursor-pointer"
                          {...field}
                        />
                        <Input
                          type="text"
                          placeholder="#000000"
                          className="flex-1"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">{t('createDialog.activeLabel')}</FormLabel>
                      <FormDescription>
                        {t('createDialog.activeDescription')}
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
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
              {t('deleteDialog.description', { name: deletingService?.name })}
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
