
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { DoctorsColumnsWrapper } from './columns';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { User, UserRole, UserRoleAssignment } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { UserServices } from '@/components/users/user-services';
import { UserMessages } from '@/components/users/user-messages';
import { UserLogs } from '@/components/users/user-logs';
import { X, AlertTriangle, KeyRound } from 'lucide-react';
import { RowSelectionState, PaginationState, ColumnFiltersState } from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { isValidPhoneNumber } from 'libphonenumber-js';
import { PhoneInput } from '@/components/ui/phone-input';


const doctorFormSchema = (t: (key: string) => string) => z.object({
  id: z.string().optional(),
  name: z.string().min(1, { message: t('DoctorsPage.createDialog.validation.nameRequired') }),
  email: z.string().email({ message: t('DoctorsPage.createDialog.validation.emailInvalid') }),
  phone: z.string().refine(isValidPhoneNumber, { message: t('DoctorsPage.createDialog.validation.phoneInvalid') }),
  identity_document: z.string()
    .regex(/^\d+$/, { message: t('DoctorsPage.createDialog.validation.identityInvalid') })
    .max(10, { message: t('DoctorsPage.createDialog.validation.identityMaxLength') }),
  is_active: z.boolean().default(false),
  color: z.string().optional(),
});

type DoctorFormValues = z.infer<ReturnType<typeof doctorFormSchema>>;

type GetUsersResponse = {
  users: User[];
  total: number;
};

async function getUsers(pagination: PaginationState, searchQuery: string): Promise<GetUsersResponse> {
  try {
    const params = new URLSearchParams({
      page: (pagination.pageIndex + 1).toString(),
      limit: pagination.pageSize.toString(),
      search: searchQuery,
      filter_type: "DOCTOR",
    });
    const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/users?${params.toString()}`, {
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
    
    const responseData = await response.json();
    
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
      id: apiUser.id ? String(apiUser.id) : `usr_${Math.random().toString(36).substr(2, 9)}`,
      name: apiUser.name || 'No Name',
      email: apiUser.email || 'no-email@example.com',
      phone_number: apiUser.phone_number || '000-000-0000',
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
    const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/users/upsert', {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...userData, filter_type: 'DOCTOR', is_sales: true }),
    });
    
    const responseData = await response.json();

    if (responseData.error && (responseData.error.error || responseData.code > 200)) {
        const error = new Error('API Error') as any;
        error.status = responseData.code || response.status;
        error.data = responseData;
        throw error;
    }
    
    return responseData;
}

async function getRolesForUser(userId: string): Promise<UserRole[]> {
  if (!userId) return [];
  try {
    const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/roles/user_roles?user_id=${userId}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    const userRolesData = Array.isArray(data) ? (Object.keys(data[0]).length === 0? [] : data) : (data.user_roles || data.data || data.result || []);
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
    const { users: fetchedUsers, total } = await getUsers(pagination, searchQuery);
    setUsers(fetchedUsers);
    setUserCount(total);
    setIsRefreshing(false);
  }, [pagination, columnFilters]);

  React.useEffect(() => {
    const debounce = setTimeout(() => {
        loadUsers();
    }, 500);
    return () => clearTimeout(debounce);
  }, [loadUsers]);

  const handleToggleActivate = async (user: User) => {
    try {
        const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/users/activate', {
            method: 'PUT',
            mode: 'cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: user.id,
                is_active: !user.is_active,
            }),
        });
        
        if (!response.ok) {
            throw new Error('Failed to update user status');
        }

        toast({
            title: 'Success',
            description: `Doctor ${user.name} has been ${user.is_active ? 'deactivated' : 'activated'}.`,
        });

        loadUsers();
    } catch (error) {
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Could not update doctor status.',
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
      identity_document: user.identity_document,
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
            const fields = errorData.conflictedFields.map((f:string) => t(`DoctorsPage.createDialog.validation.fields.${f}`)).join(', ');
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
    <>
    <div className={cn("grid grid-cols-1 gap-4", selectedUser ? "lg:grid-cols-5" : "lg:grid-cols-1")}>
      <div className={cn("transition-all duration-300", selectedUser ? "lg:col-span-2" : "lg:col-span-5")}>
        <Card>
          <CardHeader>
            <CardTitle>{t('Navigation.Doctors')}</CardTitle>
            <CardDescription>{t('DoctorsPage.description')}</CardDescription>
          </CardHeader>
          <CardContent>
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
            />
          </CardContent>
        </Card>
      </div>
      
      {selectedUser && (
        <div className="lg:col-span-3">
            <Card>
               <CardHeader className="flex flex-row items-start justify-between">
                <div>
                    <CardTitle>{t('UsersPage.detailsFor', {name: selectedUser.name})}</CardTitle>
                </div>
                 <div className="flex items-center gap-2">
                    <Button variant="destructive-ghost" size="icon" onClick={handleCloseDetails}>
                        <X className="h-5 w-5" />
                        <span className="sr-only">{t('UsersPage.close')}</span>
                    </Button>
                </div>
            </CardHeader>
              <CardContent>
                <Tabs defaultValue="services" className="w-full">
                   <TabsList className="h-auto items-center justify-start flex-wrap">
                    <TabsTrigger value="services">{t('UsersPage.tabs.services')}</TabsTrigger>
                    <TabsTrigger value="messages">{t('UsersPage.tabs.messages')}</TabsTrigger>
                    <TabsTrigger value="logs">{t('UsersPage.tabs.logs')}</TabsTrigger>
                  </TabsList>
                  <TabsContent value="services">
                    <UserServices userId={selectedUser.id} isSalesUser={selectedUser.is_sales || true} />
                  </TabsContent>
                  <TabsContent value="messages">
                    <UserMessages userId={selectedUser.id} />
                  </TabsContent>
                  <TabsContent value="logs">
                    <UserLogs userId={selectedUser.id} />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
        </div>
      )}
    </div>

    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingUser ? t('DoctorsPage.createDialog.editTitle') : t('DoctorsPage.createDialog.createTitle')}</DialogTitle>
          <DialogDescription>{editingUser ? t('DoctorsPage.createDialog.editDescription') : t('DoctorsPage.createDialog.createDescription')}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                            <FormLabel>{t('DoctorsPage.dialog.color')}</FormLabel>
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
    </>
  );
}

