
'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { DataTable } from '@/components/ui/data-table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserRoles } from '@/components/users/user-roles';
import { UserServices } from '@/components/users/user-services';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { User, UserRole } from '@/lib/types';
import { cn } from '@/lib/utils';
import { api } from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnFiltersState, PaginationState, RowSelectionState } from '@tanstack/react-table';
import { isValidPhoneNumber } from 'libphonenumber-js';
import { AlertTriangle, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { ProviderColumnsWrapper } from './columns';

const providerFormSchema = (t: (key: string) => string) => z.object({
  id: z.string().optional(),
  name: z.string().min(1, { message: t('ProvidersPage.createDialog.validation.nameRequired') }),
  email: z.string().optional(),
  phone: z.string().optional(),
  identity_document: z.string()
    .min(1, { message: t('ProvidersPage.createDialog.validation.identityRequired') })
    .regex(/^\d*$/, { message: t('ProvidersPage.createDialog.validation.identityInvalid') })
    .max(10, { message: t('ProvidersPage.createDialog.validation.identityMaxLength') }),
  is_active: z.boolean().default(false),
}).refine((data) => {
  // At least one of email or phone must be provided
  const hasEmail = data.email && data.email.trim() !== '';
  const hasPhone = data.phone && data.phone.trim() !== '';

  if (!hasEmail && !hasPhone) {
    return false;
  }

  // If email is provided, it must be valid
  if (hasEmail) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email!)) {
      return false;
    }
  }

  // If phone is provided, it must be valid
  if (hasPhone) {
    if (!isValidPhoneNumber(data.phone!)) {
      return false;
    }
  }

  return true;
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
      is_active: apiUser.is_active !== undefined ? apiUser.is_active : true,
      identity_document: apiUser.identity_document,
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

async function getRolesForUser(userId: string): Promise<UserRole[]> {
  if (!userId) return [];
  try {
    const data = await api.get(API_ROUTES.ROLES_USER_ROLES, { user_id: userId });
    const userRolesData = Array.isArray(data) ? (Object.keys(data[0]).length === 0 ? [] : data) : (data.user_roles || data.data || data.result || []);
    return userRolesData.map((apiRole: any) => ({
      user_role_id: apiRole.user_role_id,
      role_id: apiRole.role_id,
      name: apiRole.name || 'Unknown Role',
      is_active: apiRole.is_active,
    }));
  } catch (error) {
    console.error("Failed to fetch user roles:", error);
    return [];
  }
}

export default function ProvidersPage() {
  const t = useTranslations();

  const { toast } = useToast();
  const [providers, setProviders] = React.useState<User[]>([]);
  const [providerCount, setProviderCount] = React.useState(0);
  const [selectedProvider, setSelectedProvider] = React.useState<User | null>(null);
  const [selectedProviderRoles, setSelectedProviderRoles] = React.useState<UserRole[]>([]);
  const [isRolesLoading, setIsRolesLoading] = React.useState(false);
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
      identity_document: '',
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

  const loadProviderRoles = React.useCallback(async (userId: string) => {
    setIsRolesLoading(true);
    const roles = await getRolesForUser(userId);
    setSelectedProviderRoles(roles);
    setIsRolesLoading(false);
  }, []);

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
      identity_document: '',
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
      identity_document: provider.identity_document || '',
      is_active: provider.is_active,
    });
    setSubmissionError(null);
    setIsDialogOpen(true);
  };

  const providerColumns = ProviderColumnsWrapper({ onToggleActivate: handleToggleActivate, onEdit: handleEdit });

  const handleRowSelectionChange = (selectedRows: User[]) => {
    const user = selectedRows.length > 0 ? selectedRows[0] : null;
    setSelectedProvider(user);
  };

  React.useEffect(() => {
    if (selectedProvider) {
      loadProviderRoles(selectedProvider.id);
    } else {
      setSelectedProviderRoles([]);
    }
  }, [selectedProvider, loadProviderRoles]);

  const handleCloseDetails = () => {
    setSelectedProvider(null);
    setRowSelection({});
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
          setSubmissionError(errorData?.message || t('ProvidersPage.createDialog.validation.genericError'));
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
          <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <CardHeader className="flex-none">
              <CardTitle>{t('ProvidersPage.title')}</CardTitle>
              <CardDescription>{t('ProvidersPage.description')}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <DataTable
                columns={providerColumns}
                data={providers}
                filterColumnId="email"
                filterPlaceholder={t('ProvidersPage.filterPlaceholder')}
                onRowSelectionChange={handleRowSelectionChange}
                enableSingleRowSelection={true}
                onCreate={handleCreate}
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
            <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <CardHeader className="flex flex-row items-start justify-between flex-none">
                <div>
                  <CardTitle>{t('ProvidersPage.detailsFor', { name: selectedProvider.name })}</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="destructive-ghost" size="icon" onClick={handleCloseDetails}>
                    <X className="h-5 w-5" />
                    <span className="sr-only">{t('ProvidersPage.close')}</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden p-4 pt-0">
                <Tabs defaultValue="roles" className="flex-1 flex flex-col min-h-0">
                  <TabsList className="h-auto items-center justify-start flex-wrap flex-none bg-muted/50 p-1">
                    <TabsTrigger value="roles" className="text-xs">{t('ProvidersPage.tabs.roles')}</TabsTrigger>
                    <TabsTrigger value="services" className="text-xs">{t('UsersPage.tabs.services')}</TabsTrigger>
                  </TabsList>
                  <div className="flex-1 min-h-0 mt-3 flex flex-col overflow-hidden">
                    <TabsContent value="roles" className="m-0 flex-1 min-h-0 overflow-y-auto data-[state=active]:flex data-[state=active]:flex-col">
                      <UserRoles
                        userId={selectedProvider.id}
                        initialUserRoles={selectedProviderRoles}
                        isLoading={isRolesLoading}
                        onRolesChange={() => loadProviderRoles(selectedProvider.id)}
                      />
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
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
              <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>{t('ProvidersPage.createDialog.cancel')}</Button>
                <Button type="submit">{editingProvider ? t('ProvidersPage.createDialog.editSave') : t('ProvidersPage.createDialog.save')}</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

