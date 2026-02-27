
'use client';

import { TwoPanelLayout } from '@/components/layout/two-panel-layout';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { DataTable } from '@/components/ui/data-table';
import { DataTableAdvancedToolbar, FilterOption } from '@/components/ui/data-table-advanced-toolbar';
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
import { UserLogs } from '@/components/users/user-logs';
import { UserMessages } from '@/components/users/user-messages';
import { UserServices } from '@/components/users/user-services';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { User, UserRole } from '@/lib/types';
import api from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnFiltersState, PaginationState, RowSelectionState } from '@tanstack/react-table';
import { isValidPhoneNumber } from 'libphonenumber-js';
import { AlertTriangle, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { DoctorsColumnsWrapper } from './columns';


const doctorFormSchema = (t: (key: string) => string) => z.object({
  id: z.string().optional(),
  name: z.string().min(1, { message: t('DoctorsPage.createDialog.validation.nameRequired') }),
  email: z.string().optional(),
  phone: z.string().optional(),
  identity_document: z.string()
    .regex(/^\d*$/, { message: t('DoctorsPage.createDialog.validation.identityInvalid') })
    .max(10, { message: t('DoctorsPage.createDialog.validation.identityMaxLength') })
    .optional()
    .or(z.literal('')),
  is_active: z.boolean().default(false),
  color: z.string().optional(),
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
  message: t('DoctorsPage.createDialog.validation.emailOrPhoneRequired'),
  path: ['email'],
});

type DoctorFormValues = z.infer<ReturnType<typeof doctorFormSchema>>;

type GetUsersResponse = {
  users: User[];
  total: number;
};

async function getUsers(pagination: PaginationState, searchQuery: string, onlyActive: boolean): Promise<GetUsersResponse> {
  try {
    const responseData = await api.get(API_ROUTES.USERS, {
      page: (pagination.pageIndex + 1).toString(),
      limit: pagination.pageSize.toString(),
      search: searchQuery,
      filter_type: "DOCTOR",
      only_active: String(onlyActive),
    });

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
      color: apiUser.color,
      is_sales: apiUser.is_sales,
    }));

    return { users: mappedUsers, total: total };

  } catch (error) {
    console.error("Failed to fetch users:", error);
    return { users: [], total: 0 };
  }
}

async function upsertUser(userData: DoctorFormValues) {
  const responseData = await api.post(API_ROUTES.USERS_UPSERT, { ...userData, filter_type: 'DOCTOR', is_sales: true });

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

export default function DoctorsPage() {
  const t = useTranslations();

  const { toast } = useToast();
  const [users, setUsers] = React.useState<User[]>([]);
  const [userCount, setUserCount] = React.useState(0);
  const [selectedUser, setSelectedUser] = React.useState<User | null>(null);
  const [editingUser, setEditingUser] = React.useState<User | null>(null);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [submissionError, setSubmissionError] = React.useState<string | null>(null);
  const [canSetFirstPassword, setCanSetFirstPassword] = React.useState(false);


  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [showOnlyActive, setShowOnlyActive] = React.useState(true);

  const form = useForm<DoctorFormValues>({
    resolver: zodResolver(doctorFormSchema(t)),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      identity_document: '',
      is_active: true,
      color: '',
    },
  });

  const loadUsers = React.useCallback(async () => {
    setIsRefreshing(true);
    const searchQuery = (columnFilters.find(f => f.id === 'email')?.value as string) || '';
    const { users: fetchedUsers, total } = await getUsers(pagination, searchQuery, showOnlyActive);
    setUsers(fetchedUsers);
    setUserCount(total);
    setIsRefreshing(false);
  }, [pagination, columnFilters, showOnlyActive]);

  React.useEffect(() => {
    const debounce = setTimeout(() => {
      loadUsers();
    }, 500);
    return () => clearTimeout(debounce);
  }, [loadUsers]);

  const handleToggleActivate = async (user: User) => {
    try {
      await api.put(API_ROUTES.USERS_ACTIVATE, {
        user_id: user.id,
        is_active: !user.is_active,
      });

      toast({
        title: !user.is_active ? t('DoctorsPage.createDialog.SuccessActivate') : t('DoctorsPage.createDialog.SuccessDeactivate'),
        description: !user.is_active ? t('DoctorsPage.createDialog.SuccessActivateDescription', { name: user.name }) : t('DoctorsPage.createDialog.SuccessDeactivateDescription', { name: user.name }),
      });

      loadUsers();
    } catch (error) {
      toast({
        variant: !user.is_active ? 'default' : 'destructive',
        title: !user.is_active ? t('DoctorsPage.createDialog.ErrorActivate') : t('DoctorsPage.createDialog.ErrorDeactivate'),
        description: !user.is_active ? t('DoctorsPage.createDialog.ErrorActivateDescription') : t('DoctorsPage.createDialog.ErrorDeactivateDescription'),
      });
      console.error(error);
    }
  };

  const handleCreate = () => {
    setEditingUser(null);
    form.reset({
      name: '',
      email: '',
      phone: '',
      identity_document: '',
      is_active: true,
      color: '',
    });
    setSubmissionError(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    form.reset({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone_number,
      identity_document: user.identity_document || '',
      is_active: user.is_active,
      color: user.color || '',
    });
    setSubmissionError(null);
    setIsDialogOpen(true);
  };

  const userColumns = DoctorsColumnsWrapper({
    onToggleActivate: handleToggleActivate,
    onEdit: handleEdit,
  });

  const handleRowSelectionChange = (selectedRows: User[]) => {
    const user = selectedRows.length > 0 ? selectedRows[0] : null;
    setSelectedUser(user);
  };

  const handleCloseDetails = () => {
    setSelectedUser(null);
    setRowSelection({});
  };

  const filtersOptionList: FilterOption[] = [
    {
      value: 'active',
      label: t('DoctorsPage.filters.showOnlyActive'),
      group: 'Status',
      isActive: showOnlyActive,
      onSelect: () => setShowOnlyActive(!showOnlyActive),
    },
  ];

  const handleClearFilters = () => {
    setShowOnlyActive(true);
    setColumnFilters([]);
  };

  const onSubmit = async (data: DoctorFormValues) => {
    setSubmissionError(null);
    form.clearErrors();

    try {
      await upsertUser(data);
      const isEditing = !!editingUser;

      toast({
        title: isEditing ? t('DoctorsPage.createDialog.editSuccessTitle') : t('DoctorsPage.createDialog.createSuccessTitle'),
        description: isEditing ? t('DoctorsPage.createDialog.editSuccessDescription') : t('DoctorsPage.createDialog.createSuccessDescription'),
      });
      setIsDialogOpen(false);
      loadUsers();

    } catch (error: any) {
      const errorData = error.data?.error || (Array.isArray(error.data) && error.data[0]?.error);
      if (errorData?.code === 'unique_conflict' && errorData?.conflictedFields) {
        const fields = errorData.conflictedFields.map((f: string) => t(`DoctorsPage.createDialog.validation.fields.${f}`)).join(', ');
        setSubmissionError(t('DoctorsPage.createDialog.validation.uniqueConflict', { fields }));
      } else if ((error.status === 400 || error.status === 409) && errorData?.errors) {
        const errors = Array.isArray(errorData.errors) ? errorData.errors : [];
        if (errors.length > 0) {
          errors.forEach((err: { field: any; message: string }) => {
            if (err.field) {
              form.setError(err.field as keyof DoctorFormValues, {
                type: 'manual',
                message: err.message,
              });
            }
          });
        } else {
          setSubmissionError(errorData?.message || t('DoctorsPage.createDialog.validation.genericError'));
        }
      } else if (error.status >= 500) {
        setSubmissionError(t('DoctorsPage.createDialog.validation.serverError'));
      } else {
        const errorMessage = typeof error.data === 'string' ? error.data : errorData?.message || (error instanceof Error ? error.message : t('DoctorsPage.createDialog.validation.genericError'));
        setSubmissionError(errorMessage);
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <TwoPanelLayout
        isRightPanelOpen={!!selectedUser}
        leftPanel={
          <Card className="h-full flex flex-col">
            <CardHeader className="flex-none">
              <CardTitle>{t('Navigation.Doctors')}</CardTitle>
              <CardDescription>{t('DoctorsPage.description')}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden flex flex-col min-h-0">
              <DataTable
                columns={userColumns}
                data={users}
                filterColumnId="email"
                filterPlaceholder={t('UsersPage.filterPlaceholder')}
                onRowSelectionChange={handleRowSelectionChange}
                enableSingleRowSelection={true}
                onCreate={handleCreate}
                onRefresh={loadUsers}
                isRefreshing={isRefreshing}
                rowSelection={rowSelection}
                setRowSelection={setRowSelection}
                pageCount={Math.ceil(userCount / pagination.pageSize)}
                pagination={pagination}
                onPaginationChange={setPagination}
                manualPagination={true}
                columnFilters={columnFilters}
                onColumnFiltersChange={setColumnFilters}
                customToolbar={(table) => (
                  <DataTableAdvancedToolbar
                    table={table}
                    filterPlaceholder={t('UsersPage.filterPlaceholder')}
                    searchQuery={(columnFilters.find(f => f.id === 'email')?.value as string) || ''}
                    onSearchChange={(value) => {
                      setColumnFilters((prev) => {
                        const newFilters = prev.filter((f) => f.id !== 'email');
                        if (value) {
                          newFilters.push({ id: 'email', value });
                        }
                        return newFilters;
                      });
                    }}
                    filters={filtersOptionList}
                    onClearFilters={handleClearFilters}
                    onCreate={handleCreate}
                    onRefresh={loadUsers}
                    isRefreshing={isRefreshing}
                    extraButtons={null}
                    columnTranslations={{
                      name: t('DoctorsPage.DoctorColumns.name'),
                      email: t('DoctorsPage.DoctorColumns.email'),
                      identity_document: t('DoctorsPage.DoctorColumns.identity_document'),
                      phone_number: t('DoctorsPage.DoctorColumns.phone'),
                      is_active: t('DoctorsPage.DoctorColumns.status'),
                    }}
                  />
                )}
                columnTranslations={{
                  name: t('DoctorsPage.DoctorColumns.name'),
                  email: t('DoctorsPage.DoctorColumns.email'),
                  identity_document: t('DoctorsPage.DoctorColumns.identity_document'),
                  phone_number: t('DoctorsPage.DoctorColumns.phone'),
                  is_active: t('DoctorsPage.DoctorColumns.status'),
                }}
              />
            </CardContent>
          </Card>
        }
        rightPanel={
          selectedUser && (
            <Card className="h-full flex flex-col">
              <CardHeader className="flex flex-row items-start justify-between flex-none">
                <div>
                  <CardTitle>{t('UsersPage.detailsFor', { name: selectedUser.name })}</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="destructive-ghost" size="icon" onClick={handleCloseDetails}>
                    <X className="h-5 w-5" />
                    <span className="sr-only">{t('UsersPage.close')}</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-auto">
                <Tabs defaultValue="services" className="w-full h-full flex flex-col">
                  <TabsList className="h-auto items-center justify-start flex-wrap flex-none">
                    <TabsTrigger value="services">{t('UsersPage.tabs.services')}</TabsTrigger>
                    <TabsTrigger value="messages">{t('UsersPage.tabs.messages')}</TabsTrigger>
                    <TabsTrigger value="logs">{t('UsersPage.tabs.logs')}</TabsTrigger>
                  </TabsList>
                  <div className="flex-1 overflow-auto mt-4">
                    <TabsContent value="services" className="m-0">
                      <UserServices userId={selectedUser.id} isSalesUser={selectedUser.is_sales || true} />
                    </TabsContent>
                    <TabsContent value="messages" className="m-0">
                      <UserMessages userId={selectedUser.id} />
                    </TabsContent>
                    <TabsContent value="logs" className="m-0">
                      <UserLogs userId={selectedUser.id} />
                    </TabsContent>
                  </div>
                </Tabs>
              </CardContent>
            </Card>
          )
        }
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUser ? t('DoctorsPage.createDialog.editTitle') : t('DoctorsPage.createDialog.createTitle')}</DialogTitle>
            <DialogDescription>{editingUser ? t('DoctorsPage.createDialog.editDescription') : t('DoctorsPage.createDialog.createDescription')}</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 px-6 py-4">
              {submissionError && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>{t('DoctorsPage.createDialog.validation.errorTitle')}</AlertTitle>
                  <AlertDescription>{submissionError}</AlertDescription>
                </Alert>
              )}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('DoctorsPage.createDialog.name')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('DoctorsPage.createDialog.namePlaceholder')} {...field} />
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
                    <FormLabel>{t('DoctorsPage.createDialog.email')}</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder={t('DoctorsPage.createDialog.emailPlaceholder')} {...field} />
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
                    <FormLabel>{t('DoctorsPage.createDialog.phone')}</FormLabel>
                    <FormControl>
                      <PhoneInput
                        {...field}
                        defaultCountry="UY"
                        placeholder={t('DoctorsPage.createDialog.phonePlaceholder')}
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
                    <FormLabel>{t('DoctorsPage.createDialog.identity_document')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('DoctorsPage.createDialog.identity_document_placeholder')} {...field} />
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
                    <FormLabel>{t('DoctorsPage.createDialog.color')}</FormLabel>
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
              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel>{t('DoctorsPage.createDialog.isActive')}</FormLabel>
                  </FormItem>
                )}
              />
              <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>{t('DoctorsPage.createDialog.cancel')}</Button>
                <Button type="submit">{editingUser ? t('DoctorsPage.createDialog.editSave') : t('DoctorsPage.createDialog.save')}</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
