'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataCard } from '@/components/ui/data-card';
import { DataTable } from '@/components/ui/data-table';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { FormattedNumberInput } from '@/components/ui/formatted-number-input';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { TwoPanelLayout, useNarrowMode } from '@/components/layout/two-panel-layout';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';
import { PURCHASES_PERMISSIONS } from '@/constants/permissions';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { normalizeApiResponse } from '@/lib/api-utils';
import { MiscellaneousCategory, Service } from '@/lib/types';
import { api } from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, Briefcase, Trash2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { RowSelectionState } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { ServicesColumnsWrapper } from './columns';
import { useDeepLink } from '@/hooks/use-deep-link';

console.log("Purchases Services Page Loaded. API_ROUTES.SERVICES_ALL:", API_ROUTES.PURCHASES.SERVICES_ALL);

const serviceFormSchema = (t: (key: string) => string) => z.object({
  id: z.string().optional(),
  name: z.string().min(1, t('nameRequired')),
  category_id: z.string().min(1, t('categoryRequired')),
  category: z.string().optional(),
  price: z.coerce.number().positive(t('pricePositive')),
  currency: z.enum(['UYU', 'USD']).default('USD'),
  description: z.string().optional(),
  color: z.string().optional(),
  is_active: z.boolean().default(true),
});

type ServiceFormValues = z.infer<ReturnType<typeof serviceFormSchema>>;

async function getServices(): Promise<Service[]> {
  try {
    const data = await api.get(API_ROUTES.PURCHASES.SERVICES_ALL, { is_sales: 'false' });
    const normalized = normalizeApiResponse(data);
    return normalized.items.map((apiService: any) => ({
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
  } catch (error) {
    console.error("Failed to fetch services:", error);
    return [];
  }
}

async function getMiscellaneousCategories(): Promise<MiscellaneousCategory[]> {
  try {
    const data = await api.get(API_ROUTES.PURCHASES.MISC_CATEGORIES, { limit: '1000', type: 'expense' });
    const normalized = normalizeApiResponse(data);
    return normalized.items.map((c: any) => ({ ...c, id: String(c.id), type: c.category_type || c.type }));
  } catch (error) {
    console.error("Failed to fetch miscellaneous categories:", error);
    return [];
  }
}

async function upsertService(serviceData: ServiceFormValues, categories: MiscellaneousCategory[]) {
  const category = categories.find(cat => cat.id === serviceData.category_id)?.name || '';
  const responseData = await api.post(API_ROUTES.PURCHASES.SERVICES_UPSERT, { ...serviceData, category, is_sales: false });
  if (Array.isArray(responseData) && responseData.length > 0) {
    const firstItem = responseData[0];
    if (firstItem && (firstItem.code >= 400 || firstItem.error)) throw new Error(firstItem.message || firstItem.error || 'Failed to save service');
  }
  if (responseData && typeof responseData === 'object' && !Array.isArray(responseData)) {
    if (responseData.error || responseData.code >= 400) throw new Error(responseData.message || responseData.error || 'Failed to save service');
  }
  return responseData;
}

async function deleteService(id: string) {
  const responseData = await api.delete(API_ROUTES.PURCHASES.SERVICES_DELETE, { id, is_sales: false });
  if (Array.isArray(responseData) && responseData.length > 0) {
    const firstItem = responseData[0];
    if (firstItem && (firstItem.code >= 400 || firstItem.error)) throw new Error(firstItem.message || firstItem.error || 'Failed to delete service');
  }
  if (responseData && typeof responseData === 'object' && !Array.isArray(responseData)) {
    if (responseData.error || responseData.code >= 400) throw new Error(responseData.message || responseData.error || 'Failed to delete service');
  }
  return responseData;
}

function PurchaseServiceFormFields({ form, categories, t }: { form: any; categories: MiscellaneousCategory[]; t: (key: string) => string }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <FormField control={form.control} name="name" render={({ field }) => (
          <FormItem><FormLabel>{t('createDialog.name')}</FormLabel><FormControl><Input placeholder={t('createDialog.namePlaceholder')} {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="category_id" render={({ field }) => (
          <FormItem><FormLabel>{t('createDialog.category')}</FormLabel>
            <Select onValueChange={field.onChange} value={field.value || ''}>
              <FormControl><SelectTrigger><SelectValue placeholder={t('createDialog.categoryPlaceholder')} /></SelectTrigger></FormControl>
              <SelectContent>{categories.map((cat) => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}</SelectContent>
            </Select><FormMessage /></FormItem>
        )} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <FormField control={form.control} name="price" render={({ field: { onChange, value } }) => (
          <FormItem><FormLabel>{t('createDialog.price')}</FormLabel><FormControl><FormattedNumberInput value={value} onChange={onChange} placeholder="0.00" /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="currency" render={({ field }) => (
          <FormItem><FormLabel>{t('createDialog.currency')}</FormLabel>
            <Select onValueChange={field.onChange} value={field.value || 'USD'}>
              <FormControl><SelectTrigger><SelectValue placeholder={t('createDialog.selectCurrency')} /></SelectTrigger></FormControl>
              <SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="UYU">UYU</SelectItem></SelectContent>
            </Select><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="color" render={({ field }) => (
          <FormItem><FormLabel>{t('createDialog.colorLabel')}</FormLabel><FormControl><Input type="color" className="h-10 w-full cursor-pointer" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
      </div>
      <FormField control={form.control} name="description" render={({ field }) => (
        <FormItem><FormLabel>{t('createDialog.descriptionLabel')}</FormLabel><FormControl><Textarea placeholder={t('createDialog.descriptionPlaceholder')} className="resize-none" rows={2} {...field} /></FormControl><FormMessage /></FormItem>
      )} />
      <FormField control={form.control} name="is_active" render={({ field }) => (
        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
          <div className="space-y-0.5"><FormLabel className="text-base">{t('createDialog.activeLabel')}</FormLabel></div>
          <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
        </FormItem>
      )} />
    </>
  );
}

function ServicesTableWithCards({
  services, columns, selectedService, onRowSelect, onRefresh, isRefreshing, onCreate, rowSelection, setRowSelection, t,
}: {
  services: Service[];
  columns: any[];
  selectedService: Service | null;
  onRowSelect: (rows: Service[]) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  onCreate?: () => void;
  rowSelection: RowSelectionState;
  setRowSelection: React.Dispatch<React.SetStateAction<RowSelectionState>>;
  t: (key: string) => string;
}) {
  const { isNarrow: panelNarrow } = useNarrowMode();
  const isViewportNarrow = useViewportNarrow();
  const isNarrow = !!selectedService || panelNarrow || isViewportNarrow;
  return (
    <DataTable
      columns={columns}
      data={services}
      filterColumnId="name"
      filterPlaceholder={t('filterPlaceholder')}
      onCreate={onCreate}
      onRefresh={onRefresh}
      isRefreshing={isRefreshing}
      onRowSelectionChange={onRowSelect}
      enableSingleRowSelection={true}
      rowSelection={rowSelection}
      setRowSelection={setRowSelection}
      isNarrow={isNarrow}
      renderCard={(service: Service, _isSelected: boolean) => (
        <DataCard isSelected={_isSelected}
          title={service.name}
          subtitle={`${service.category} · ${service.currency} ${service.price}`}
          accentColor={service.color || undefined}
          showArrow
          onClick={() => onRowSelect([service])}
          badge={service.is_active
            ? undefined
            : <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-medium bg-muted text-muted-foreground">Inactivo</span>
          }
        />
      )}
    />
  );
}

export default function ServicesPage() {
  const t = useTranslations('ServicesPage');
  const tNav = useTranslations('Navigation');
  const tValidation = useTranslations('ServicesPage.validation');
  const tColumns = useTranslations('ServicesColumns');
  const { hasPermission } = usePermissions();
  const { toast } = useToast();

  const canCreateProduct = hasPermission(PURCHASES_PERMISSIONS.PRODUCTS_CREATE);
  const canUpdateProduct = hasPermission(PURCHASES_PERMISSIONS.PRODUCTS_UPDATE);
  const canDeleteProduct = hasPermission(PURCHASES_PERMISSIONS.PRODUCTS_DELETE);

  const [services, setServices] = React.useState<Service[]>([]);
  const [categories, setCategories] = React.useState<MiscellaneousCategory[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [deletingService, setDeletingService] = React.useState<Service | null>(null);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);
  const [detailError, setDetailError] = React.useState<string | null>(null);
  const [isSavingDetail, setIsSavingDetail] = React.useState(false);
  const [selectedService, setSelectedService] = React.useState<Service | null>(null);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});

  const createForm = useForm<ServiceFormValues>({ resolver: zodResolver(serviceFormSchema(tValidation)) });
  const detailForm = useForm<ServiceFormValues>({ resolver: zodResolver(serviceFormSchema(tValidation)) });

  const loadServices = React.useCallback(async () => {
    setIsRefreshing(true);
    setServices(await getServices());
    setIsRefreshing(false);
  }, []);

  React.useEffect(() => { loadServices(); }, [loadServices]);

  // Load categories and populate detail form when selection changes
  React.useEffect(() => {
    if (selectedService) {
      getMiscellaneousCategories().then(setCategories);
      detailForm.reset({
        id: selectedService.id,
        name: selectedService.name,
        category_id: selectedService.category_id || '',
        price: selectedService.price,
        currency: (selectedService.currency as 'USD' | 'UYU') || 'USD',
        description: selectedService.description || '',
        color: selectedService.color || '',
        is_active: selectedService.is_active ?? true,
      });
      setDetailError(null);
    }
  }, [selectedService, detailForm]);

  const handleCreate = () => {
    if (!canCreateProduct) return;
    getMiscellaneousCategories().then(setCategories);
    createForm.reset({ name: '', category_id: '', price: 0, currency: 'USD', description: '', color: '', is_active: true });
    setCreateError(null);
    setIsCreateDialogOpen(true);
  };

  const handleDelete = (service: Service) => { setDeletingService(service); setIsDeleteDialogOpen(true); };

  const confirmDelete = async () => {
    if (!deletingService) return;
    try {
      await deleteService(deletingService.id);
      toast({ title: t('toast.deleteSuccessTitle'), description: t('toast.deleteSuccessDescription', { name: deletingService.name }) });
      setIsDeleteDialogOpen(false);
      setDeletingService(null);
      if (selectedService?.id === deletingService.id) { setSelectedService(null); setRowSelection({}); }
      loadServices();
    } catch (error) {
      toast({ variant: 'destructive', title: t('toast.errorTitle'), description: error instanceof Error ? error.message : t('toast.deleteErrorDescription') });
    }
  };

  const onCreateSubmit = async (values: ServiceFormValues) => {
    setCreateError(null);
    try {
      await upsertService(values, categories);
      toast({ title: t('toast.createSuccessTitle'), description: t('toast.successDescription', { name: values.name }) });
      setIsCreateDialogOpen(false);
      loadServices();
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : t('toast.genericError'));
    }
  };

  const onDetailSubmit = async (values: ServiceFormValues) => {
    setDetailError(null);
    setIsSavingDetail(true);
    try {
      await upsertService(values, categories);
      toast({ title: t('toast.editSuccessTitle'), description: t('toast.successDescription', { name: values.name }) });
      const updatedService: Service = { ...selectedService!, name: values.name, price: values.price, currency: values.currency, description: values.description, color: values.color || null, is_active: values.is_active, category_id: values.category_id };
      setServices(prev => prev.map(s => s.id === values.id ? updatedService : s));
      setSelectedService(updatedService);
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : t('toast.genericError'));
    } finally {
      setIsSavingDetail(false);
    }
  };

  const handleRowSelect = (rows: Service[]) => setSelectedService(rows.length > 0 ? rows[0] : null);
  const handleCloseDetail = () => { setSelectedService(null); setRowSelection({}); };

  const servicesColumns = ServicesColumnsWrapper({ onDelete: canDeleteProduct ? handleDelete : undefined });

  const [activeTab, setActiveTab] = React.useState('details');
  const [deepLinkFilter, setDeepLinkFilter] = React.useState('');
  const deepLinkItems = deepLinkFilter
    ? services.filter(s => s.name.toLowerCase().includes(deepLinkFilter.toLowerCase()))
    : services;

  useDeepLink<Service>({
    tabMap: { 'Detalles': 'details', 'Info': 'info' },
    onFilter: (v) => setDeepLinkFilter(v),
    items: deepLinkItems,
    allItems: services,
    isLoading: isRefreshing,
    onAutoSelect: (svc) => handleRowSelect([svc]),
    setRowSelection,
    onTabChange: (id) => setActiveTab(id),
    actionMap: { 'Crear': () => setIsCreateDialogOpen(true) },
    filterDelay: 300,
  });

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <TwoPanelLayout
        isRightPanelOpen={!!selectedService}
        onBack={handleCloseDetail}
        leftPanel={
          <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm">
            <CardHeader className="flex-none p-4">
              <div className="flex items-start gap-3">
                <div className="header-icon-circle mt-0.5"><Briefcase className="h-5 w-5" /></div>
                <div className="flex flex-col text-left">
                  <CardTitle className="text-lg">{tNav('ProviderProducts')}</CardTitle>
                  <CardDescription className="text-xs">{t('description')}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden p-4 bg-card">
              <ServicesTableWithCards
                services={services}
                columns={servicesColumns}
                selectedService={selectedService}
                onRowSelect={handleRowSelect}
                onRefresh={loadServices}
                isRefreshing={isRefreshing}
                onCreate={canCreateProduct ? handleCreate : undefined}
                rowSelection={rowSelection}
                setRowSelection={setRowSelection}
                t={t}
              />
            </CardContent>
          </Card>
        }
        rightPanel={
          selectedService && (
            <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm">
              <CardHeader className="flex-none p-4 pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {selectedService.color
                      ? <div className="h-9 w-9 rounded-full border-2 border-white shadow flex-none" style={{ backgroundColor: selectedService.color }} />
                      : <div className="header-icon-circle flex-none"><Briefcase className="h-5 w-5" /></div>
                    }
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-lg truncate">{selectedService.name}</CardTitle>
                      <CardDescription className="text-xs">{selectedService.category}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 ml-2 flex-none">
                    {canDeleteProduct && (
                      <button type="button" title={tColumns('delete')} onClick={() => handleDelete(selectedService)} className="flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                    <button type="button" onClick={handleCloseDetail} className="flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-auto p-4 pt-0">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full flex flex-col">
                  <TabsList>
                    <TabsTrigger value="details">{t('tabs.details')}</TabsTrigger>
                    <TabsTrigger value="info">{t('tabs.info')}</TabsTrigger>
                  </TabsList>
                  <div className="flex-1 overflow-auto mt-4">
                    <TabsContent value="details" className="m-0">
                      <Form {...detailForm}>
                        <form onSubmit={detailForm.handleSubmit(onDetailSubmit)} className="space-y-3">
                          {detailError && (
                            <Alert variant="destructive">
                              <AlertTriangle className="h-4 w-4" />
                              <AlertTitle>{t('toast.errorTitle')}</AlertTitle>
                              <AlertDescription>{detailError}</AlertDescription>
                            </Alert>
                          )}
                          <PurchaseServiceFormFields form={detailForm} categories={categories} t={t} />
                          {canUpdateProduct && (
                            <div className="flex gap-2 pt-2">
                              <Button type="submit" disabled={isSavingDetail}>
                                {isSavingDetail ? t('createDialog.editSave') + '...' : t('createDialog.editSave')}
                              </Button>
                            </div>
                          )}
                        </form>
                      </Form>
                    </TabsContent>
                    <TabsContent value="info" className="m-0 space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg border border-border bg-muted/30 p-3">
                          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">{tColumns('price')}</p>
                          <p className="text-xl font-bold text-foreground">{selectedService.currency} {selectedService.price}</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between py-2 border-b border-border/50">
                          <span className="text-xs text-muted-foreground">{tColumns('category')}</span>
                          <span className="text-xs font-medium">{selectedService.category}</span>
                        </div>
                        <div className="flex items-center justify-between py-2 border-b border-border/50">
                          <span className="text-xs text-muted-foreground">{tColumns('isActive')}</span>
                          <Badge variant={selectedService.is_active ? 'success' : 'outline'}>
                            {selectedService.is_active ? tColumns('active') : tColumns('inactive')}
                          </Badge>
                        </div>
                      </div>
                      {selectedService.description && (
                        <div>
                          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">{t('createDialog.descriptionLabel')}</p>
                          <p className="text-sm text-foreground whitespace-pre-wrap">{selectedService.description}</p>
                        </div>
                      )}
                    </TabsContent>
                  </div>
                </Tabs>
              </CardContent>
            </Card>
          )
        }
      />

      {/* Create dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('createDialog.title')}</DialogTitle>
            <DialogDescription>{t('createDialog.description')}</DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="flex flex-col flex-1 overflow-hidden">
              <DialogBody className="space-y-3 py-4 px-6">
                {createError && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>{t('toast.errorTitle')}</AlertTitle>
                    <AlertDescription>{createError}</AlertDescription>
                  </Alert>
                )}
                <PurchaseServiceFormFields form={createForm} categories={categories} t={t} />
              </DialogBody>
              <DialogFooter>
                <Button type="submit">{t('createDialog.save')}</Button>
                <Button variant="outline" type="button" onClick={() => setIsCreateDialogOpen(false)}>{t('createDialog.cancel')}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('deleteDialog.description', { name: deletingService?.name })}</AlertDialogDescription>
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
