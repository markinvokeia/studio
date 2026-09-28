
'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmActionDialog } from '@/components/ui/confirm-action-dialog';
import { DataTable } from '@/components/ui/data-table';
import {
  Dialog,
  DialogBody,
  DialogCancelButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { FormattedNumberInput } from '@/components/ui/formatted-number-input';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { API_ROUTES } from '@/constants/routes';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useDataLoader } from '@/hooks/use-data-loader';
import { useToast } from '@/hooks/use-toast';
import { useClinicInfo } from '@/hooks/useClinicInfo';
import { normalizeApiResponse } from '@/lib/api-utils';
import { getErrorMessage } from '@/lib/error-utils';
import { MiscellaneousCategory, Service } from '@/lib/types';
import api, { isTimeoutError, REQUEST_TIMEOUT_MS } from '@/services/api';
import { getSalesServices } from '@/services/services';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, PlusCircle, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import * as z from 'zod';
import { ServicesColumnsWrapper } from './columns';
import { currencySchema } from '@/lib/currency';
import { CurrencySelect } from '@/components/ui/currency-select';
import { getClinicCurrency } from '@/stores/clinic-info-store';

const serviceFormSchema = (t: (key: string) => string) => z.object({
  id: z.string().optional(),
  name: z.string().min(1, t('nameRequired')),
  category: z.string().min(1, t('categoryRequired')),
  price: z.coerce.number().positive(t('pricePositive')),
  currency: currencySchema,
  duration_minutes: z.coerce.number().int().positive(t('durationInteger')),
  description: z.string().optional(),
  indications: z.string().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, t('colorInvalid')).optional().nullable(),
  service_type: z.enum(['single', 'workflow']).default('single'),
  treatment_steps: z.array(z.object({
    position: z.number(),
    name: z.string().min(1),
    offset_days_from_prev: z.coerce.number().int().min(0),
    duration_minutes: z.coerce.number().int().positive(),
    notes: z.string().optional(),
  })).optional(),
});

type ServiceFormValues = z.infer<ReturnType<typeof serviceFormSchema>>;

async function getServices(): Promise<Service[]> {
    const result = await getSalesServices({ limit: 100 });
    const servicesData = result.items;

    return servicesData.map((apiService: any) => ({
      id: apiService.id ? String(apiService.id) : `srv_${Math.random().toString(36).substr(2, 9)}`,
      name: apiService.name || 'No Name',
      category: apiService.category_name || apiService.category || 'No Category',
      price: apiService.price || 0,
      currency: apiService.currency || getClinicCurrency(),
      duration_minutes: apiService.duration_minutes || 0,
      description: apiService.description,
      indications: apiService.indications,
      is_active: apiService.is_active,
      color: apiService.color,
    }));
}

async function getMiscellaneousCategories(signal?: AbortSignal): Promise<MiscellaneousCategory[]> {
    const data = await api.get(API_ROUTES.CASHIER.MISCELLANEOUS_CATEGORIES_GET, undefined, undefined, { signal });
    const normalized = normalizeApiResponse(data);
    const categoriesData = normalized.items;

    return categoriesData.map((c: any) => ({
      ...c,
      id: String(c.id),
      type: c.category_type
    }));
}


async function upsertService(serviceData: ServiceFormValues) {
  const responseData = await api.post(API_ROUTES.SERVICES_UPSERT, { ...serviceData, is_sales: true }, undefined, undefined, { timeoutMs: REQUEST_TIMEOUT_MS.mutation });

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
  const responseData = await api.delete(API_ROUTES.SERVICES_DELETE, { id, is_sales: true }, undefined, undefined, { timeoutMs: REQUEST_TIMEOUT_MS.mutation });

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
  const tCommon = useTranslations('Common');
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [editingService, setEditingService] = React.useState<Service | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [deletingService, setDeletingService] = React.useState<Service | null>(null);
  const [submissionError, setSubmissionError] = React.useState<string | null>(null);

  const { toast } = useToast();
  const clinicInfo = useClinicInfo();

  const form = useForm<ServiceFormValues>({
    resolver: zodResolver(serviceFormSchema(tValidation)),
    defaultValues: { service_type: 'single', treatment_steps: [] },
  });

  const { fields, append, remove: removeStep } = useFieldArray({ control: form.control, name: 'treatment_steps' });
  const watchServiceType = form.watch('service_type');

  const { data: services, isLoading, isRefreshing, error: loadError, reload: loadServices } = useDataLoader(getServices, [] as Service[]);
  const { data: categories, error: categoriesError } = useDataLoader(getMiscellaneousCategories, [] as MiscellaneousCategory[], [], { enabled: isDialogOpen });

  const handleCreate = () => {
    setEditingService(null);
    form.reset({
      name: '',
      category: '',
      price: 0,
      currency: clinicInfo?.currency ?? getClinicCurrency(),
      duration_minutes: 60,
      description: '',
      indications: '',
      color: '#ffffff',
      service_type: 'single',
      treatment_steps: [],
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
      currency: service.currency || getClinicCurrency(),
      duration_minutes: service.duration_minutes,
      description: service.description,
      indications: service.indications,
      color: service.color || '#ffffff',
      service_type: service.service_type || 'single',
      treatment_steps: service.treatment_steps || [],
    });
    setSubmissionError(null);
    setIsDialogOpen(true);
  };

  const handleDelete = (service: Service) => {
    setDeletingService(service);
    setIsDeleteDialogOpen(true);
  };

  const removeService = useAsyncAction(
    async (service: Service) => {
      await deleteService(service.id);
      return service;
    },
    {
      onSuccess: async (service) => {
        toast({
          title: t('toast.deleteSuccessTitle'),
          description: t('toast.deleteSuccessDescription', { name: service.name }),
        });
        setIsDeleteDialogOpen(false);
        setDeletingService(null);
        await loadServices();
      },
      onError: (error) => { if (isTimeoutError(error)) loadServices(); },
      errorTitle: t('toast.deleteErrorDescription'),
    }
  );

  const save = useAsyncAction(
    async (values: ServiceFormValues) => {
      setSubmissionError(null);
      await upsertService(values);
      return values;
    },
    {
      onSuccess: async (values) => {
        toast({
          title: values.id ? t('toast.editSuccessTitle') : t('toast.createSuccessTitle'),
          description: t('toast.successDescription', { name: values.name }),
        });
        await loadServices();
        setIsDialogOpen(false);
      },
      onError: (error) => {
        if (isTimeoutError(error)) {
          // The service may have been saved anyway: refresh so the user can check before retrying.
          setSubmissionError(tCommon('timeoutError'));
          loadServices();
          return;
        }
        setSubmissionError(getErrorMessage(error) || t('toast.genericError'));
      },
      showErrorToast: false,
    }
  );

  const servicesColumns = ServicesColumnsWrapper({ onEdit: handleEdit, onDelete: handleDelete });

  const columnTranslations = {
    id: tColumns('id'),
    name: tColumns('name'),
    category: tColumns('category'),
    price: tColumns('price'),
    currency: tColumns('currency'),
    duration_minutes: tColumns('duration'),
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
            isLoading={isLoading}
            loadError={loadError}
            columnTranslations={columnTranslations}
          />
        </CardContent>
      </Card>

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          if (!open && save.isPending) return;
          setIsDialogOpen(open);
        }}
      >
        <DialogContent confirmOnClose isDirty={form.formState.isDirty && !save.isPending}>
          <DialogHeader>
            <DialogTitle>{editingService ? t('createDialog.editTitle') : t('createDialog.title')}</DialogTitle>
            <DialogDescription>
              {editingService ? t('createDialog.editDescription') : t('createDialog.description')}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(save.run)} className="flex flex-col flex-1 overflow-hidden">
              <DialogBody className="space-y-4 px-6 py-4">
                {submissionError && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>{t('toast.errorTitle')}</AlertTitle>
                    <AlertDescription>{submissionError}</AlertDescription>
                  </Alert>
                )}
                {/* Native fieldset disables every control while the request is in flight */}
                <fieldset disabled={save.isPending} className="min-w-0 space-y-4">
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
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('createDialog.categoryPlaceholder')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.name}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {categoriesError && <p className="text-xs text-destructive">{tCommon('loadError')}</p>}
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field: { onChange, value } }) => (
                      <FormItem>
                        <FormLabel>{t('createDialog.price')}</FormLabel>
                        <FormControl>
                          <FormattedNumberInput
                            value={value}
                            onChange={onChange}
                            placeholder="0.00"
                          />
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
                        <FormControl><CurrencySelect value={field.value} onChange={field.onChange} placeholder={t('createDialog.selectCurrency')} /></FormControl>
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
                  name="color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('createDialog.color')}</FormLabel>
                      <FormControl>
                        <div className="flex items-center gap-2">
                          <Input type="color" className="p-1 h-10 w-14" {...field} value={field.value || ''} />
                          <Input placeholder="#FFFFFF" {...field} value={field.value || ''} />
                        </div>
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

                {/* service_type toggle */}
                <FormField
                  control={form.control}
                  name="service_type"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-sm">{t('serviceType.label')}</FormLabel>
                        <p className="text-xs text-muted-foreground">{t('serviceType.description')}</p>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value === 'workflow'}
                          onCheckedChange={(v) => {
                            field.onChange(v ? 'workflow' : 'single');
                            if (!v) form.setValue('treatment_steps', []);
                          }}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {/* treatment steps sub-form */}
                {watchServiceType === 'workflow' && (
                  <div className="space-y-3 rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium">{t('serviceType.stepsTitle')}</h4>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => append({ position: fields.length + 1, name: '', offset_days_from_prev: 0, duration_minutes: 30 })}
                      >
                        <PlusCircle className="h-3.5 w-3.5 mr-1" />
                        {t('serviceType.addStep')}
                      </Button>
                    </div>
                    {fields.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-2">{t('serviceType.noSteps')}</p>
                    )}
                    {fields.map((field, index) => (
                      <div key={field.id} className="border rounded-md p-3 space-y-2 relative bg-muted/20">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-muted-foreground">{t('serviceType.stepLabel')} {index + 1}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            onClick={() => removeStep(index)}
                            aria-label={`${t('serviceType.stepLabel')} ${index + 1}`}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <FormField
                          control={form.control}
                          name={`treatment_steps.${index}.name`}
                          render={({ field: f }) => (
                            <FormItem>
                              <FormLabel className="text-xs">{t('serviceType.stepName')}</FormLabel>
                              <FormControl>
                                <Input placeholder={t('serviceType.stepNamePlaceholder')} className="h-8 text-sm" {...f} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <FormField
                            control={form.control}
                            name={`treatment_steps.${index}.offset_days_from_prev`}
                            render={({ field: f }) => (
                              <FormItem>
                                <FormLabel className="text-xs">{t('serviceType.offsetDays')}</FormLabel>
                                <FormControl>
                                  <Input type="number" min={0} className="h-8 text-sm" {...f} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`treatment_steps.${index}.duration_minutes`}
                            render={({ field: f }) => (
                              <FormItem>
                                <FormLabel className="text-xs">{t('serviceType.duration')}</FormLabel>
                                <FormControl>
                                  <Input type="number" min={1} className="h-8 text-sm" {...f} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <FormField
                          control={form.control}
                          name={`treatment_steps.${index}.notes`}
                          render={({ field: f }) => (
                            <FormItem>
                              <FormLabel className="text-xs">{t('serviceType.stepNotes')}</FormLabel>
                              <FormControl>
                                <Input placeholder={t('serviceType.stepNotesPlaceholder')} className="h-8 text-sm" {...f} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    ))}
                  </div>
                )}
                </fieldset>
              </DialogBody>
              <DialogFooter>
                <Button type="submit" loading={save.isPending}>{editingService ? t('createDialog.editSave') : t('createDialog.save')}</Button>
                <DialogCancelButton disabled={save.isPending}>{t('createDialog.cancel')}</DialogCancelButton>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ConfirmActionDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title={t('deleteDialog.title')}
        description={t('deleteDialog.description', { name: deletingService?.name })}
        cancelLabel={t('deleteDialog.cancel')}
        confirmLabel={t('deleteDialog.confirm')}
        onConfirm={() => { if (deletingService) removeService.run(deletingService); }}
        isPending={removeService.isPending}
      />
    </div>
  );
}
