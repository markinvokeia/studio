
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
import { MedicalHistory } from '@/components/users/medical-history';
import { UserAppointments } from '@/components/users/user-appointments';
import { UserLogs } from '@/components/users/user-logs';
import { UserMessages } from '@/components/users/user-messages';
import { UserQuotes } from '@/components/users/user-quotes';
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
import { AlertTriangle, KeyRound, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { SystemUserColumnsWrapper } from './columns';
import { TwoPanelLayout } from '@/components/layout/two-panel-layout';
import { DataTableAdvancedToolbar, FilterOption } from '@/components/ui/data-table-advanced-toolbar';


const userFormSchema = (t: (key: string) => string) => z.object({
  id: z.string().optional(),
  name: z.string().min(1, { message: t('SystemUsersPage.createDialog.validation.nameRequired') }),
  email: z.string().optional(),
  phone: z.string().optional(),
  identity_document: z.string()
    .regex(/^\d+$/, { message: t('SystemUsersPage.createDialog.validation.identityInvalid') })
    .max(10, { message: t('SystemUsersPage.createDialog.validation.identityMaxLength') }),
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
  message: t('SystemUsersPage.createDialog.validation.emailOrPhoneRequired'),
  path: ['email'],
});

type UserFormValues = z.infer<ReturnType<typeof userFormSchema>>;

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
    }));

    return { users: mappedUsers, total: total };

  } catch (error) {
    console.error("Failed to fetch users:", error);
    return { users: [], total: 0 };
  }
}

async function upsertUser(userData: UserFormValues) {
  const responseData = await api.post(API_ROUTES.USERS_UPSERT, { ...userData, is_sales: true });

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

export default function SystemUsersPage() {
  const t = useTranslations();

  const { toast } = useToast();
  const [users, setUsers] = React.useState<User[]>([]);
  const [userCount, setUserCount] = React.useState(0);
  const [selectedUser, setSelectedUser] = React.useState<User | null>(null);
  const [selectedUserRoles, setSelectedUserRoles] = React.useState<UserRole[]>([]);
  const [isRolesLoading, setIsRolesLoading] = React.useState(false);
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

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema(t)),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      identity_document: '',
      is_active: true,
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

  const loadUserRoles = React.useCallback(async (userId: string) => {
    setIsRolesLoading(true);
    const roles = await getRolesForUser(userId);
    setSelectedUserRoles(roles);
    setIsRolesLoading(false);
  }, []);


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
        title: 'Success',
        description: `User ${user.name} has been ${user.is_active ? 'deactivated' : 'activated'}.`,
      });

      loadUsers();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not update user status.',
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
      identity_document: user.identity_document,
      is_active: user.is_active,
    });
    setSubmissionError(null);
    setIsDialogOpen(true);
  };

  const userColumns = SystemUserColumnsWrapper({ onToggleActivate: handleToggleActivate, onEdit: handleEdit });

  const handleRowSelectionChange = (selectedRows: User[]) => {
    const user = selectedRows.length > 0 ? selectedRows[0] : null;
    setSelectedUser(user);
  };

  React.useEffect(() => {
    const checkFirstPasswordRequirements = async () => {
      if (!selectedUser) {
        setCanSetFirstPassword(false);
        return;
      }

      const token = localStorage.getItem('token');
      if (!token) {
        setCanSetFirstPassword(false);
        return;
      }

      try {
        await api.get(API_ROUTES.SYSTEM.API_AUTH_CHECK_FIRST_PASSWORD, { user_id: selectedUser.id });
        setCanSetFirstPassword(true);
      } catch (error) {
        console.error("Failed to check first password requirements:", error);
        setCanSetFirstPassword(false);
      }
    };

    if (selectedUser) {
      loadUserRoles(selectedUser.id);
      checkFirstPasswordRequirements();
    } else {
      setSelectedUserRoles([]);
      setCanSetFirstPassword(false);
    }
  }, [selectedUser, loadUserRoles]);

  const handleCloseDetails = () => {
    setSelectedUser(null);
    setRowSelection({});
  };

  const onSubmit = async (data: UserFormValues) => {
    setSubmissionError(null);
    form.clearErrors();

    try {
      await upsertUser(data);
      const isEditing = !!editingUser;

      toast({
        title: isEditing ? t('SystemUsersPage.createDialog.editSuccessTitle') : t('SystemUsersPage.createDialog.createSuccessTitle'),
        description: isEditing ? t('SystemUsersPage.createDialog.editSuccessDescription') : t('SystemUsersPage.createDialog.createSuccessDescription'),
      });
      setIsDialogOpen(false);
      loadUsers();

    } catch (error: any) {
      const errorData = error.data?.error || (Array.isArray(error.data) && error.data[0]?.error);
      if (errorData?.code === 'unique_conflict' && errorData?.conflictedFields) {
        const fields = errorData.conflictedFields.map((f: string) => t(`SystemUsersPage.createDialog.validation.fields.${f}`)).join(', ');
        setSubmissionError(t('SystemUsersPage.createDialog.validation.uniqueConflict', { fields }));
      } else if ((error.status === 400 || error.status === 409) && errorData?.errors) {
        const errors = Array.isArray(errorData.errors) ? errorData.errors : [];
        if (errors.length > 0) {
          errors.forEach((err: { field: any; message: string }) => {
            if (err.field) {
              form.setError(err.field as keyof UserFormValues, {
                type: 'manual',
                message: err.message,
              });
            }
          });
        } else {
          setSubmissionError(errorData?.message || t('SystemUsersPage.createDialog.validation.genericError'));
        }
      } else if (error.status >= 500) {
        setSubmissionError(t('SystemUsersPage.createDialog.validation.serverError'));
      } else {
        const errorMessage = typeof error.data === 'string' ? error.data : errorData?.message || (error instanceof Error ? error.message : t('SystemUsersPage.createDialog.validation.genericError'));
        setSubmissionError(errorMessage);
      }
    }
  };

  const handleSendInitialPassword = async () => {
    if (!selectedUser) return;
    try {
      const responseData = await api.post(API_ROUTES.SYSTEM.API_AUTH_FIRST_TIME_PASSWORD_TOKEN, { user_id: selectedUser.id });
      toast({ title: 'Email Sent', description: responseData.message });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: error instanceof Error ? error.message : 'An unexpected error occurred.' });
    }
  };

  const filtersOptionList: FilterOption[] = [
    {
      value: 'active',
      label: t('SystemUsersPage.filters.showOnlyActive'),
      group: 'Status',
      isActive: showOnlyActive,
      onSelect: () => setShowOnlyActive(!showOnlyActive),
    },
  ];

  const handleClearFilters = () => {
    setShowOnlyActive(true);
    setColumnFilters([]);
  };

  return (
    <>
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <TwoPanelLayout
          isRightPanelOpen={!!selectedUser}
          leftPanel={
            <Card className="h-full flex flex-col">
              <CardHeader className="flex-none">
                <CardTitle>{t('SystemUsersPage.title')}</CardTitle>
                <CardDescription>{t('SystemUsersPage.description')}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden flex flex-col min-h-0">
                <DataTable
                  columns={userColumns}
                  data={users}
                  filterColumnId="email"
                  filterPlaceholder={t('SystemUsersPage.filterPlaceholder')}
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
                      filterPlaceholder={t('SystemUsersPage.filterPlaceholder')}
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
                    />
                  )}
                  columnTranslations={{
                    name: t('SystemUserColumns.name'),
                    email: t('SystemUserColumns.email'),
                    phone_number: t('SystemUserColumns.phone'),
                    is_active: t('SystemUserColumns.status'),
                    roles: t('SystemUserColumns.roles'),
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
                    <CardTitle>{t('SystemUsersPage.detailsFor', { name: selectedUser.name })}</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    {canSetFirstPassword && (
                      <Button variant="outline" size="sm" onClick={handleSendInitialPassword}>
                        <KeyRound className="mr-2 h-4 w-4" />
                        {t('SystemUsersPage.setInitialPassword')}
                      </Button>
                    )}
                    <Button variant="destructive-ghost" size="icon" onClick={handleCloseDetails}>
                      <X className="h-5 w-5" />
                      <span className="sr-only">{t('SystemUsersPage.close')}</span>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden flex flex-col min-h-0">
                  <Tabs defaultValue="roles" className="w-full flex-1 flex flex-col min-h-0">
                    <TabsList className="h-auto items-center justify-start flex-wrap flex-none">
                      <TabsTrigger value="roles">{t('SystemUsersPage.tabs.roles')}</TabsTrigger>
                      <TabsTrigger value="logs">{t('SystemUsersPage.tabs.logs')}</TabsTrigger>
                    </TabsList>
                    <div className="flex-1 overflow-hidden flex flex-col min-h-0 mt-4">
                      <TabsContent value="roles" className="m-0 flex-1 min-h-0 data-[state=active]:flex data-[state=active]:flex-col">
                        <UserRoles
                          userId={selectedUser.id}
                          initialUserRoles={selectedUserRoles}
                          isLoading={isRolesLoading}
                          onRolesChange={() => loadUserRoles(selectedUser.id)}
                        />
                      </TabsContent>
                      <TabsContent value="logs" className="m-0 flex-1 min-h-0 data-[state=active]:flex data-[state=active]:flex-col">
                        <UserLogs userId={selectedUser.id} />
                      </TabsContent>
                    </div>
                  </Tabs>
                </CardContent>
              </Card>
            )
          }
        />
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUser ? t('SystemUsersPage.createDialog.editTitle') : t('SystemUsersPage.createDialog.title')}</DialogTitle>
            <DialogDescription>{editingUser ? t('SystemUsersPage.createDialog.editDescription') : t('SystemUsersPage.createDialog.description')}</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {submissionError && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>{t('SystemUsersPage.createDialog.validation.errorTitle')}</AlertTitle>
                  <AlertDescription>{submissionError}</AlertDescription>
                </Alert>
              )}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('SystemUsersPage.createDialog.name')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('SystemUsersPage.createDialog.namePlaceholder')} {...field} />
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
                    <FormLabel>{t('SystemUsersPage.createDialog.email')}</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder={t('SystemUsersPage.createDialog.emailPlaceholder')} {...field} />
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
                    <FormLabel>{t('SystemUsersPage.createDialog.phone')}</FormLabel>
                    <FormControl>
                      <PhoneInput
                        {...field}
                        defaultCountry="UY"
                        placeholder={t('SystemUsersPage.createDialog.phonePlaceholder')}
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
                    <FormLabel>{t('SystemUsersPage.createDialog.identity_document')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('SystemUsersPage.createDialog.identity_document_placeholder')} {...field} />
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
                    <FormLabel>{t('SystemUsersPage.createDialog.isActive')}</FormLabel>
                  </FormItem>
                )}
              />
              <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>{t('SystemUsersPage.createDialog.cancel')}</Button>
                <Button type="submit">{editingUser ? t('SystemUsersPage.createDialog.editSave') : t('SystemUsersPage.createDialog.save')}</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
