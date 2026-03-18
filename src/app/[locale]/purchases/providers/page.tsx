'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { UserServices } from '@/components/users/user-services';
import { PURCHASES_PERMISSIONS } from '@/constants/permissions';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { User } from '@/lib/types';
import { cn } from '@/lib/utils';
import { api } from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnFiltersState, PaginationState, RowSelectionState } from '@tanstack/react-table';
import { isValidPhoneNumber } from 'libphonenumber-js';
import { AlertTriangle, Briefcase, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { ProviderColumnsWrapper } from './columns';

const providerFormSchema = (t: (key: string) => string) => z.object({
  id: z.string().optional(),
  name: z.string().min(1, { message: t('ProvidersPage.createDialog.validation.nameRequired') }),
  email: z.string().optional().refine(val => {
    if (!val || val.trim() === '') return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  }, { message: t('ProvidersPage.createDialog.validation.emailInvalid') }),
  phone: z.string().optional().refine(val => {
    if (!val || val.trim() === '') return true;
    return isValidPhoneNumber(val);
  }, { message: t('ProvidersPage.createDialog.validation.phoneInvalid') }),
  alternative_phone: z.string().optional().refine(val => {
    if (!val || val.trim() === '') return true;
    return isValidPhoneNumber(val);
  }, { message: t('ProvidersPage.createDialog.validation.alternativePhoneInvalid') }),
  identity_document: z.string()
    .min(1, { message: t('ProvidersPage.createDialog.validation.identityRequired') })
    .regex(/^\d*$/, { message: t('ProvidersPage.createDialog.validation.identityInvalid') })
    .max(10, { message: t('ProvidersPage.createDialog.validation.identityMaxLength') }),
  address: z.string().optional(),
  notes: z.string().optional(),
  bank_account: z.string().optional(),
  is_active: z.boolean().default(false),
}).refine((data) => {
  const hasEmail = data.email && data.email.trim() !== '';
  const hasPhone = data.phone && data.phone.trim() !== '';
  return hasEmail || hasPhone;
}, {
  message: t('ProvidersPage.createDialog.validation.emailOrPhoneRequired'),
  path: ['email'],
});

type ProviderFormValues = z.infer<ReturnType<typeof providerFormSchema>>;

type GetProvidersResponse = {
  users: User[];
  total: number;
};

async function getProviders(pagination: PaginationState, searchQuery: string): Promise<GetProvidersResponse> {
  try {
    const query = {
      page: (pagination.pageIndex + 1).toString(),
      limit: pagination.pageSize.toString(),
      search: searchQuery,
      filter_type: "PROVEEDOR"
    };
    const responseData = await api.get(API_ROUTES.USERS, query);

    let usersData = [];
    let total = 0;

    if (Array.isArray(responseData) && responseData.length > 0) {
      const firstElement = responseData[0];
      if (firstElement.json && typeof firstElement.json === 'object') {
        usersData = firstElement.json.data || [];
        total = Number(firstElement.json.total) || usersData.length;
      } else if (firstElement.data) {
        usersData = firstElement.data;
        total = Number(firstElement.total) || usersData.length;
      }
    } else if (typeof responseData === 'object' && responseData !== null && responseData.data) {
      usersData = responseData.data;
      total = Number(responseData.total) || usersData.length;
    }

    const mappedUsers = usersData.map((apiUser: any) => ({
      id: String(apiUser.id),
      name: apiUser.name || '',
      email: apiUser.email || '',
      phone_number: apiUser.phone_number || '',
      alternative_phone: apiUser.alternative_phone || '',
      address: apiUser.address || '',
      bank_account: apiUser.bank_account || '',
      is_active: apiUser.is_active !== undefined ? apiUser.is_active : true,
      identity_document: apiUser.identity_document,
      notes: apiUser.notes || '',
      avatar: apiUser.avatar || `https://picsum.photos/seed/${apiUser.id || Math.random()}/40/40`,
    }));

    return { users: mappedUsers, total: total };

  } catch (error) {
    console.error("Failed to fetch providers:", error);
    return { users: [], total: 0 };
  }
}

async function upsertProvider(providerData: ProviderFormValues) {
  const data = { ...providerData, filter_type: 'PROVEEDOR', is_sales: false };
  const responseData = await api.post(API_ROUTES.USERS_UPSERT, data);

  if (responseData.error && (responseData.error.error || responseData.code > 200)) {
    const error = new Error('API Error') as any;
    error.status = responseData.code || 500;
    error.data = responseData;
    throw error;
  }

  return responseData;
}

const NotesTab = ({ user, onUpdate }: { user: User, onUpdate: (notes: string) => void }) => {
  const t = useTranslations();
  const [isEditing, setIsEditing] = React.useState(false);
  const [notes, setNotes] = React.useState(user.notes || '');
  const [isSaving, setIsSaving] = React.useState(false);
  const { toast } = useToast();

  React.useEffect(() => {
    setNotes(user.notes || '');
  }, [user.notes]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onUpdate(notes);
      setIsEditing(false);
      toast({
        title: t('ProvidersPage.notes.saveSuccess'),
        description: t('ProvidersPage.notes.saveSuccessDescription'),
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('ProvidersPage.notes.saveError'),
        description: t('ProvidersPage.notes.saveErrorDescription'),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setNotes(user.notes || '');
    setIsEditing(false);
  };

  return (
    <Card className="h-full flex flex-col shadow-none border-0">
      <CardHeader className="flex flex-row items-center justify-between flex-none p-4 pb-2">
        <div className="min-w-0 flex-1">
          <CardTitle className="text-lg text-foreground font-bold">{t('ProvidersPage.notes.title')}</CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            {t('ProvidersPage.notes.description')}
          </CardDescription>
        </div>
        <div className="flex items-center gap-2 ml-2">
          {!isEditing && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
            >
              {t('ProvidersPage.notes.edit')}
            </Button>
          )}
          {isEditing && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                disabled={isSaving}
              >
                {t('ProvidersPage.notes.cancel')}
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? t('ProvidersPage.notes.saving') : t('ProvidersPage.notes.save')}
              </Button>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto p-4 pt-0 bg-card">
        {isEditing ? (
          <div className="h-full flex flex-col">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('ProvidersPage.notes.placeholder')}
              className="flex-1 min-h-[200px] resize-none"
            />
          </div>
        ) : (
          <div className="h-full">
            {notes ? (
              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                {notes}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <p className="text-center mb-4">
                  {t('ProvidersPage.notes.noNotes')}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                >
                  {t('ProvidersPage.notes.addFirstNote')}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default function ProvidersPage() {
  return <ProvidersPageContent />;
}

function ProvidersPageContent() {
  const t = useTranslations();
  const { toast } = useToast();
  const { hasPermission } = usePermissions();

  // Permission checks for UI elements
  const canViewList = hasPermission(PURCHASES_PERMISSIONS.SUPPLIERS_VIEW_LIST);
  const canCreateSupplier = hasPermission(PURCHASES_PERMISSIONS.SUPPLIERS_CREATE);
  const canUpdateSupplier = hasPermission(PURCHASES_PERMISSIONS.SUPPLIERS_UPDATE);
  const canDeleteSupplier = hasPermission(PURCHASES_PERMISSIONS.SUPPLIERS_DELETE);
  const canToggleStatus = hasPermission(PURCHASES_PERMISSIONS.SUPPLIERS_TOGGLE_STATUS);
  const canViewDetail = hasPermission(PURCHASES_PERMISSIONS.SUPPLIERS_VIEW_DETAIL);
  const canViewServices = hasPermission(PURCHASES_PERMISSIONS.SUPPLIERS_VIEW_SERVICES);

  const [providers, setProviders] = React.useState<User[]>([]);
  const [providerCount, setProviderCount] = React.useState(0);
  const [selectedProvider, setSelectedProvider] = React.useState<User | null>(null);
  const [editingProvider, setEditingProvider] = React.useState<User | null>(null);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [submissionError, setSubmissionError] = React.useState<string | null>(null);


  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

  const form = useForm<ProviderFormValues>({
    resolver: zodResolver(providerFormSchema(t)),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      alternative_phone: '',
      identity_document: '',
      address: '',
      notes: '',
      bank_account: '',
      is_active: true,
    },
  });

  const loadProviders = React.useCallback(async () => {
    setIsRefreshing(true);
    const searchQuery = (columnFilters.find(f => f.id === 'email')?.value as string) || '';
    const { users: fetchedProviders, total } = await getProviders(pagination, searchQuery);
    setProviders(fetchedProviders);
    setProviderCount(total);
    setIsRefreshing(false);
  }, [pagination, columnFilters]);

  React.useEffect(() => {
    const debounce = setTimeout(() => {
      loadProviders();
    }, 500);
    return () => clearTimeout(debounce);
  }, [loadProviders]);

  const handleToggleActivate = async (user: User) => {
    try {
      await api.put(API_ROUTES.USERS_ACTIVATE, {
        user_id: user.id,
        is_active: !user.is_active,
      });

      toast({
        title: 'Success',
        description: `Provider ${user.name} has been ${user.is_active ? 'deactivated' : 'activated'}.`,
      });

      loadProviders();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not update provider status.',
      });
      console.error(error);
    }
  };

  const handleCreate = () => {
    setEditingProvider(null);
    form.reset({
      name: '',
      email: '',
      phone: '',
      alternative_phone: '',
      identity_document: '',
      address: '',
      notes: '',
      bank_account: '',
      is_active: true,
    });
    setSubmissionError(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (provider: User) => {
    setEditingProvider(provider);
    form.reset({
      id: provider.id,
      name: provider.name,
      email: provider.email,
      phone: provider.phone_number,
      alternative_phone: provider.alternative_phone || '',
      identity_document: provider.identity_document || '',
      address: provider.address || '',
      notes: provider.notes || '',
      bank_account: provider.bank_account || '',
      is_active: provider.is_active,
    });
    setSubmissionError(null);
    setIsDialogOpen(true);
  };

  const providerColumns = ProviderColumnsWrapper({ onToggleActivate: canToggleStatus ? handleToggleActivate : undefined, onEdit: canUpdateSupplier ? handleEdit : undefined });

  const handleRowSelectionChange = (selectedRows: User[]) => {
    const user = selectedRows.length > 0 ? selectedRows[0] : null;
    setSelectedProvider(user);
  };

  const handleCloseDetails = () => {
    setSelectedProvider(null);
    setRowSelection({});
  };

  const handleUpdateNotes = async (notes: string) => {
    if (!selectedProvider) return;

    try {
      const updatedProviderData = {
        ...selectedProvider,
        notes,
      };

      await upsertProvider({
        id: selectedProvider.id,
        name: selectedProvider.name,
        email: selectedProvider.email,
        phone: selectedProvider.phone_number,
        alternative_phone: selectedProvider.alternative_phone || '',
        identity_document: selectedProvider.identity_document || '',
        address: selectedProvider.address || '',
        notes,
        bank_account: selectedProvider.bank_account || '',
        is_active: selectedProvider.is_active,
      });

      setSelectedProvider(updatedProviderData);

      setProviders(prevProviders =>
        prevProviders.map(provider =>
          provider.id === selectedProvider.id ? { ...provider, notes } : provider
        )
      );

    } catch (error) {
      console.error('Failed to update notes:', error);
      throw error;
    }
  };

  const onSubmit = async (data: ProviderFormValues) => {
    setSubmissionError(null);
    form.clearErrors();

    try {
      await upsertProvider(data);
      const isEditing = !!editingProvider;

      toast({
        title: isEditing ? t('ProvidersPage.createDialog.editSuccessTitle') : t('ProvidersPage.createDialog.createSuccessTitle'),
        description: isEditing ? t('ProvidersPage.createDialog.editSuccessDescription') : t('ProvidersPage.createDialog.createSuccessDescription'),
      });
      setIsDialogOpen(false);
      loadProviders();

    } catch (error: any) {
      const errorData = error.data?.error || (Array.isArray(error.data) && error.data[0]?.error);
      if (errorData?.code === 'unique_conflict' && errorData?.conflictedFields) {
        const fields = errorData.conflictedFields.map((f: string) => t(`ProvidersPage.createDialog.validation.fields.${f}`)).join(', ');
        setSubmissionError(t('ProvidersPage.createDialog.validation.uniqueConflict', { fields }));
      } else if ((error.status === 400 || error.status === 409) && errorData?.errors) {
        const errors = Array.isArray(errorData.errors) ? errorData.errors : [];
        if (errors.length > 0) {
          errors.forEach((err: { field: any; message: string }) => {
            if (err.field) {
              form.setError(err.field as keyof ProviderFormValues, {
                type: 'manual',
                message: err.message,
              });
            }
          });
        } else {
          setSubmissionError(errorData?.message || t('SystemUsersPage.createDialog.validation.genericError'));
        }
      } else if (error.status >= 500) {
        setSubmissionError(t('ProvidersPage.createDialog.validation.serverError'));
      } else {
        const errorMessage = typeof error.data === 'string' ? error.data : errorData?.message || (error instanceof Error ? error.message : t('ProvidersPage.createDialog.validation.genericError'));
        setSubmissionError(errorMessage);
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className={cn("grid grid-cols-1 gap-4 flex-1 min-h-0 overflow-hidden", selectedProvider ? "lg:grid-cols-5" : "lg:grid-cols-1")}>
        <div className={cn("transition-all duration-300 flex flex-col min-h-0 overflow-hidden", selectedProvider ? "lg:col-span-2" : "lg:col-span-1")}>
          <Card className="flex-1 flex flex-col min-h-0 overflow-hidden border-0 lg:border shadow-none lg:shadow-sm">
            <CardHeader className="flex-none p-4">
              <div className="flex items-start gap-3">
                <div className="header-icon-circle mt-0.5">
                  <Briefcase className="h-5 w-5" />
                </div>
                <div className="flex flex-col text-left">
                  <CardTitle className="text-lg">{t('ProvidersPage.title')}</CardTitle>
                  <CardDescription className="text-xs">{t('ProvidersPage.description')}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden p-6 bg-card">
              <DataTable
                columns={providerColumns}
                data={providers}
                filterColumnId="email"
                filterPlaceholder={t('ProvidersPage.filterPlaceholder')}
                onRowSelectionChange={handleRowSelectionChange}
                enableSingleRowSelection={true}
                onCreate={canCreateSupplier ? handleCreate : undefined}
                onRefresh={loadProviders}
                isRefreshing={isRefreshing}
                rowSelection={rowSelection}
                setRowSelection={setRowSelection}
                pageCount={Math.ceil(providerCount / pagination.pageSize)}
                pagination={pagination}
                onPaginationChange={setPagination}
                manualPagination={true}
                columnFilters={columnFilters}
                onColumnFiltersChange={setColumnFilters}
              />
            </CardContent>
          </Card>
        </div>

        {selectedProvider && (
          <div className="lg:col-span-3 flex flex-col min-h-0 overflow-hidden">
            <Card className="flex-1 flex flex-col min-h-0 overflow-hidden border-0 lg:border shadow-none lg:shadow-sm">
              <CardHeader className="flex flex-row items-start justify-between flex-none p-4">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="header-icon-circle mt-0.5">
                    <Briefcase className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1 flex flex-col text-left">
                    <CardTitle className="truncate">{t('ProvidersPage.detailsFor', { name: selectedProvider.name })}</CardTitle>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="destructive-ghost" size="icon" onClick={handleCloseDetails}>
                    <X className="h-5 w-5" />
                    <span className="sr-only">{t('ProvidersPage.close')}</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden p-4 pt-0">
                <Tabs defaultValue="summary" className="flex-1 flex flex-col min-h-0">
                  <TabsList className="h-auto items-center justify-start flex-wrap flex-none bg-muted/50 p-1">
                    <TabsTrigger value="summary" className="text-xs">{t('ProvidersPage.tabs.summary')}</TabsTrigger>
                    <TabsTrigger value="notes" className="text-xs">{t('ProvidersPage.tabs.notes')}</TabsTrigger>
                    <TabsTrigger value="services" className="text-xs">{t('UsersPage.tabs.services')}</TabsTrigger>
                  </TabsList>
                  <div className="flex-1 min-h-0 mt-3 flex flex-col overflow-hidden">
                    <TabsContent value="summary" className="m-0 flex-1 min-h-0 overflow-y-auto data-[state=active]:flex data-[state=active]:flex-col">
                      <Card className="h-full flex flex-col shadow-none border-0">
                        <CardHeader className="flex-none p-4 pb-2">
                          <CardTitle className="text-lg text-foreground font-bold">{t('ProvidersPage.summary.title')}</CardTitle>
                          <CardDescription className="text-sm text-muted-foreground">
                            {t('ProvidersPage.summary.description')}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 overflow-auto p-4 pt-0 bg-card">
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <span className="text-xs uppercase font-bold text-muted-foreground">{t('ProvidersPage.summary.name')}</span>
                                <p className="text-sm font-medium">{selectedProvider.name}</p>
                              </div>
                              <div className="space-y-1">
                                <span className="text-xs uppercase font-bold text-muted-foreground">{t('ProvidersPage.summary.identity_document')}</span>
                                <p className="text-sm font-medium">{selectedProvider.identity_document || '-'}</p>
                              </div>
                              <div className="space-y-1">
                                <span className="text-xs uppercase font-bold text-muted-foreground">{t('ProvidersPage.summary.email')}</span>
                                <p className="text-sm font-medium">{selectedProvider.email || '-'}</p>
                              </div>
                              <div className="space-y-1">
                                <span className="text-xs uppercase font-bold text-muted-foreground">{t('ProvidersPage.summary.phone')}</span>
                                <p className="text-sm font-medium">{selectedProvider.phone_number || '-'}</p>
                              </div>
                              <div className="space-y-1">
                                <span className="text-xs uppercase font-bold text-muted-foreground">{t('ProvidersPage.summary.alternative_phone')}</span>
                                <p className="text-sm font-medium">{selectedProvider.alternative_phone || '-'}</p>
                              </div>
                              <div className="space-y-1">
                                <span className="text-xs uppercase font-bold text-muted-foreground">{t('ProvidersPage.summary.address')}</span>
                                <p className="text-sm font-medium">{selectedProvider.address || '-'}</p>
                              </div>
                              <div className="space-y-1 md:col-span-2">
                                <span className="text-xs uppercase font-bold text-muted-foreground">{t('ProvidersPage.summary.bank_account')}</span>
                                <p className="text-sm font-medium">{selectedProvider.bank_account || '-'}</p>
                              </div>
                            </div>
                            <div className="space-y-1 pt-2 border-t">
                              <span className="text-xs uppercase font-bold text-muted-foreground">{t('ProvidersPage.summary.status')}</span>
                              <p className="text-sm font-medium">
                                <span className={selectedProvider.is_active ? "text-green-600" : "text-red-600"}>
                                  {selectedProvider.is_active ? t('ProvidersPage.summary.active') : t('ProvidersPage.summary.inactive')}
                                </span>
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>
                    <TabsContent value="notes" className="m-0 flex-1 min-h-0 overflow-y-auto data-[state=active]:flex data-[state=active]:flex-col">
                      <NotesTab user={selectedProvider} onUpdate={handleUpdateNotes} />
                    </TabsContent>
                    <TabsContent value="services" className="m-0 flex-1 min-h-0 overflow-y-auto data-[state=active]:flex data-[state=active]:flex-col">
                      <UserServices userId={selectedProvider.id} isSalesUser={false} />
                    </TabsContent>
                  </div>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingProvider ? t('ProvidersPage.createDialog.editTitle') : t('ProvidersPage.createDialog.title')}</DialogTitle>
            <DialogDescription>{editingProvider ? t('ProvidersPage.createDialog.editDescription') : t('ProvidersPage.createDialog.description')}</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
              <DialogBody className="space-y-4 px-6 py-4">
                {submissionError && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>{t('ProvidersPage.createDialog.validation.errorTitle')}</AlertTitle>
                    <AlertDescription>{submissionError}</AlertDescription>
                  </Alert>
                )}
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('ProvidersPage.createDialog.name')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('ProvidersPage.createDialog.namePlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('ProvidersPage.createDialog.email')}</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder={t('ProvidersPage.createDialog.emailPlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('ProvidersPage.createDialog.phone')}</FormLabel>
                      <FormControl>
                        <PhoneInput
                          {...field}
                          defaultCountry="UY"
                          placeholder={t('ProvidersPage.createDialog.phonePlaceholder')}
                          onChange={field.onChange}
                          value={field.value}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="identity_document"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('ProvidersPage.createDialog.identity_document')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('ProvidersPage.createDialog.identity_document_placeholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('ProvidersPage.createDialog.address')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('ProvidersPage.createDialog.addressPlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="alternative_phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('ProvidersPage.createDialog.alternative_phone')}</FormLabel>
                      <FormControl>
                        <PhoneInput
                          {...field}
                          defaultCountry="UY"
                          placeholder={t('ProvidersPage.createDialog.alternative_phonePlaceholder')}
                          onChange={field.onChange}
                          value={field.value}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="bank_account"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('ProvidersPage.createDialog.bank_account')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('ProvidersPage.createDialog.bank_accountPlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('ProvidersPage.createDialog.notes.title')}</FormLabel>
                      <FormControl>
                        <Textarea placeholder={t('ProvidersPage.createDialog.notes.placeholder')} {...field} />
                      </FormControl>
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
                      <FormLabel>{t('ProvidersPage.createDialog.isActive')}</FormLabel>
                    </FormItem>
                  )}
                />
              </DialogBody>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>{t('ProvidersPage.createDialog.cancel')}</Button>
                <Button type="submit">{editingProvider ? t('ProvidersPage.createDialog.editSave') : t('ProvidersPage.createDialog.save')}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
