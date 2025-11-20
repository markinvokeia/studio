
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { UserColumnsWrapper } from '../../users/columns';
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
import { MedicalHistory } from '@/components/users/medical-history';
import { UserRoles } from '@/components/users/user-roles';
import { UserServices } from '@/components/users/user-services';
import { UserQuotes } from '@/components/users/user-quotes';
import { UserMessages } from '@/components/users/user-messages';
import { UserAppointments } from '@/components/users/user-appointments';
import { UserLogs } from '@/components/users/user-logs';
import { X, AlertTriangle, KeyRound, ChevronsUpDown, Check } from 'lucide-react';
import { RowSelectionState, PaginationState, ColumnFiltersState } from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { isValidPhoneNumber } from 'libphonenumber-js';
import { PhoneInput } from '@/components/ui/phone-input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';


const userFormSchema = (t: (key: string) => string) => z.object({
  id: z.string().optional(),
  name: z.string().min(1, { message: t('UsersPage.createDialog.validation.nameRequired') }),
  email: z.string().email({ message: t('UsersPage.createDialog.validation.emailInvalid') }),
  phone: z.string().refine(isValidPhoneNumber, { message: t('UsersPage.createDialog.validation.phoneInvalid') }),
  identity_document: z.string()
    .regex(/^\d+$/, { message: t('UsersPage.createDialog.validation.identityInvalid') })
    .max(10, { message: t('UsersPage.createDialog.validation.identityMaxLength') }),
  is_active: z.boolean().default(false),
  doctor: z.string().nullable().optional(),
});

type UserFormValues = z.infer<ReturnType<typeof userFormSchema>>;

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
      doctor: 'true',
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
    }));

    return { users: mappedUsers, total: total };

  } catch (error) {
    console.error("Failed to fetch users:", error);
    return { users: [], total: 0 };
  }
}

async function upsertUser(userData: UserFormValues) {
    const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/users/upsert', {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
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
  const [selectedUserRoles, setSelectedUserRoles] = React.useState<UserRole[]>([]);
  const [isRolesLoading, setIsRolesLoading] = React.useState(false);
  const [editingUser, setEditingUser] = React.useState<User | null>(null);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [submissionError, setSubmissionError] = React.useState<string | null>(null);
  const [canSetFirstPassword, setCanSetFirstPassword] = React.useState(false);
  const [isDoctorSearchOpen, setIsDoctorSearchOpen] = React.useState(false);


  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema(t)),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      identity_document: '',
      is_active: true,
      doctor: null,
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
      doctor: null,
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
      doctor: null,
    });
    setSubmissionError(null);
    setIsDialogOpen(true);
  };
  
  const userColumns = UserColumnsWrapper({ onToggleActivate: handleToggleActivate, onEdit: handleEdit });

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
            const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/api/auth/check-requirements-first-password?user_id=${selectedUser.id}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            setCanSetFirstPassword(response.ok);
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
            title: isEditing ? t('UsersPage.createDialog.editSuccessTitle') : t('UsersPage.createDialog.createSuccessTitle'),
            description: isEditing ? t('UsersPage.createDialog.editSuccessDescription') : t('UsersPage.createDialog.createSuccessDescription'),
        });
        setIsDialogOpen(false);
        loadUsers();

    } catch (error: any) {
        const errorData = error.data?.error || (Array.isArray(error.data) && error.data[0]?.error);
        if (errorData?.code === 'unique_conflict' && errorData?.conflictedFields) {
            const fields = errorData.conflictedFields.map((f:string) => t(`UsersPage.createDialog.validation.fields.${f}`)).join(', ');
            setSubmissionError(t('UsersPage.createDialog.validation.uniqueConflict', { fields }));
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
                 setSubmissionError(errorData?.message || t('UsersPage.createDialog.validation.genericError'));
            }
        } else if (error.status >= 500) {
            setSubmissionError(t('UsersPage.createDialog.validation.serverError'));
        } else {
             const errorMessage = typeof error.data === 'string' ? error.data : errorData?.message || (error instanceof Error ? error.message : t('UsersPage.createDialog.validation.genericError'));
             setSubmissionError(errorMessage);
        }
    }
  };

  const handleSendInitialPassword = async () => {
    if (!selectedUser) return;
    const token = localStorage.getItem('token');
    if (!token) {
        toast({ variant: 'destructive', title: 'Error', description: 'Authentication token not found.' });
        return;
    }
    try {
        const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/api/auth/first-time-password-token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ user_id: selectedUser.id }),
        });
        const responseData = await response.json();
        if (!response.ok) {
            throw new Error(responseData.message || 'Failed to send password email.');
        }
        toast({ title: 'Email Sent', description: responseData.message });
    } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: error instanceof Error ? error.message : 'An unexpected error occurred.' });
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
                    {canSetFirstPassword && (
                        <Button variant="outline" size="sm" onClick={handleSendInitialPassword}>
                            <KeyRound className="mr-2 h-4 w-4" />
                            {t('UsersPage.setInitialPassword')}
                        </Button>
                    )}
                    <Button variant="destructive-ghost" size="icon" onClick={handleCloseDetails}>
                        <X className="h-5 w-5" />
                        <span className="sr-only">{t('UsersPage.close')}</span>
                    </Button>
                </div>
            </CardHeader>
              <CardContent>
                <Tabs defaultValue="roles" className="w-full">
                   <TabsList className="h-auto items-center justify-start flex-wrap">
                    <TabsTrigger value="roles">{t('UsersPage.tabs.roles')}</TabsTrigger>
                    {selectedUserRoles.some(role => role.name.toLowerCase() === 'medico' && role.is_active) && (
                        <TabsTrigger value="services">{t('UsersPage.tabs.services')}</TabsTrigger>
                    )}
                    <TabsTrigger value="quotes">{t('UsersPage.tabs.quotes')}</TabsTrigger>
                    <TabsTrigger value="appointments">{t('UsersPage.tabs.appointments')}</TabsTrigger>
                    <TabsTrigger value="messages">{t('UsersPage.tabs.messages')}</TabsTrigger>
                    <TabsTrigger value="logs">{t('UsersPage.tabs.logs')}</TabsTrigger>
                    <TabsTrigger value="history">{t('UsersPage.tabs.history')}</TabsTrigger>
                  </TabsList>
                  <TabsContent value="roles">
                    <UserRoles
                        userId={selectedUser.id}
                        initialUserRoles={selectedUserRoles}
                        isLoading={isRolesLoading}
                        onRolesChange={() => loadUserRoles(selectedUser.id)}
                    />
                  </TabsContent>
                  {selectedUserRoles.some(role => role.name.toLowerCase() === 'medico' && role.is_active) && (
                    <TabsContent value="services">
                      <UserServices userId={selectedUser.id} />
                    </TabsContent>
                  )}
                  <TabsContent value="quotes">
                    <UserQuotes userId={selectedUser.id} />
                  </TabsContent>
                  <TabsContent value="appointments">
                    <UserAppointments user={selectedUser} />
                  </TabsContent>
                  <TabsContent value="messages">
                    <UserMessages userId={selectedUser.id} />
                  </TabsContent>
                  <TabsContent value="logs">
                    <UserLogs userId={selectedUser.id} />
                  </TabsContent>
                  <TabsContent value="history">
                    <MedicalHistory user={selectedUser} />
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
          <DialogTitle>{editingUser ? t('DoctorsPage.dialog.editTitle') : t('DoctorsPage.dialog.createTitle')}</DialogTitle>
          <DialogDescription>{editingUser ? t('DoctorsPage.dialog.editDescription') : t('DoctorsPage.dialog.createDescription')}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {submissionError && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>{t('UsersPage.createDialog.validation.errorTitle')}</AlertTitle>
                    <AlertDescription>{submissionError}</AlertDescription>
                  </Alert>
                )}
                 <FormField
                    control={form.control}
                    name="doctor"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{t('Navigation.Doctors')}</FormLabel>
                                <Popover open={isDoctorSearchOpen} onOpenChange={setIsDoctorSearchOpen}>
                                    <PopoverTrigger asChild>
                                        <FormControl>
                                        <Button variant="outline" role="combobox" className={cn("w-full justify-between", !field.value && "text-muted-foreground")}>
                                            {field.value ? users.find(u => u.id === field.value)?.name : "Select a doctor"}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                        </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                        <Command>
                                        <CommandInput placeholder="Search doctors..." />
                                        <CommandList>
                                            <CommandEmpty>No doctors found.</CommandEmpty>
                                            <CommandGroup>
                                            {users.filter(u => u.id !== editingUser?.id).map((user) => (
                                                <CommandItem
                                                    value={user.name}
                                                    key={user.id}
                                                    onSelect={() => {
                                                        form.setValue("doctor", user.id);
                                                        setIsDoctorSearchOpen(false);
                                                    }}
                                                >
                                                <Check className={cn("mr-2 h-4 w-4", user.id === field.value ? "opacity-100" : "opacity-0")}/>
                                                {user.name}
                                                </CommandItem>
                                            ))}
                                            </CommandGroup>
                                        </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{t('UsersPage.createDialog.name')}</FormLabel>
                            <FormControl>
                                <Input placeholder={t('UsersPage.createDialog.namePlaceholder')} {...field} />
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
                            <FormLabel>{t('UsersPage.createDialog.email')}</FormLabel>
                            <FormControl>
                                <Input type="email" placeholder={t('UsersPage.createDialog.emailPlaceholder')} {...field} />
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
                            <FormLabel>{t('UsersPage.createDialog.phone')}</FormLabel>
                            <FormControl>
                               <PhoneInput
                                    {...field}
                                    defaultCountry="UY"
                                    placeholder={t('UsersPage.createDialog.phonePlaceholder')}
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
                            <FormLabel>{t('UsersPage.createDialog.identity_document')}</FormLabel>
                            <FormControl>
                                <Input placeholder={t('UsersPage.createDialog.identity_document_placeholder')} {...field} />
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
                            <FormLabel>{t('UsersPage.createDialog.isActive')}</FormLabel>
                        </FormItem>
                    )}
                />
                 <div className="flex justify-end space-x-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>{t('UsersPage.createDialog.cancel')}</Button>
                    <Button type="submit">{editingUser ? t('UsersPage.createDialog.editSave') : t('UsersPage.createDialog.save')}</Button>
                </div>
            </form>
        </Form>
      </DialogContent>
    </Dialog>
    </>
  );
}

