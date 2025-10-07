
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { UserColumnsWrapper } from './columns';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { User } from '@/lib/types';
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
import { X } from 'lucide-react';
import { RowSelectionState, PaginationState, ColumnFiltersState } from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

const userFormSchema = (t: (key: string) => string) => z.object({
  id: z.string().optional(),
  name: z.string().min(1, { message: t('UsersPage.createDialog.validation.nameRequired') }),
  email: z.string().email({ message: t('UsersPage.createDialog.validation.emailInvalid') }),
  phone: z.string().min(1, { message: t('UsersPage.createDialog.validation.phoneRequired') }),
  identity_document: z.string().length(10, { message: t('UsersPage.createDialog.validation.identityInvalid') }).regex(/^\d+$/, { message: t('UsersPage.createDialog.validation.identityInvalid') }),
  is_active: z.boolean().default(false),
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

    const responseText = await response.text();
    const responseData = responseText ? JSON.parse(responseText) : {};
    
    return responseData;
}

export default function UsersPage() {
  const t = useTranslations();
  
  const { toast } = useToast();
  const [users, setUsers] = React.useState<User[]>([]);
  const [userCount, setUserCount] = React.useState(0);
  const [selectedUser, setSelectedUser] = React.useState<User | null>(null);
  const [editingUser, setEditingUser] = React.useState<User | null>(null);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [submissionError, setSubmissionError] = React.useState<string | null>(null);


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
  
  const userColumns = UserColumnsWrapper({ onToggleActivate: handleToggleActivate, onEdit: handleEdit });

  const handleRowSelectionChange = (selectedRows: User[]) => {
    const user = selectedRows.length > 0 ? selectedRows[0] : null;
    setSelectedUser(user);
  };
  
  const handleCloseDetails = () => {
    setSelectedUser(null);
    setRowSelection({});
  };

  const onSubmit = async (data: UserFormValues) => {
    setSubmissionError(null);
    try {
        const responseData = await upsertUser(data);
        const isEditing = !!editingUser;

        const result = Array.isArray(responseData) ? responseData[0] : responseData;
        const code = result?.code;
        const errorMessage = result?.error_message || result?.message;

        if (code === 200 || (result.id && !errorMessage)) {
            toast({
                title: isEditing ? t('UsersPage.createDialog.editTitle') : t('UsersPage.createDialog.title'),
                description: isEditing ? 'The user has been updated successfully.' : 'The new user has been added successfully.',
            });
            setIsDialogOpen(false);
            loadUsers();
        } else {
            setSubmissionError(errorMessage || t('UsersPage.createDialog.validation.genericError'));
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : t('UsersPage.createDialog.validation.genericError');
        setSubmissionError(errorMessage);
    }
  };
  
  return (
    <>
    <div className={cn("grid grid-cols-1 gap-4", selectedUser ? "lg:grid-cols-5" : "lg:grid-cols-1")}>
      <div className={cn("transition-all duration-300", selectedUser ? "lg:col-span-2" : "lg:col-span-5")}>
        <Card>
          <CardHeader>
            <CardTitle>{t('UsersPage.title')}</CardTitle>
            <CardDescription>{t('UsersPage.description')}</CardDescription>
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
                <Button variant="destructive-ghost" size="icon" onClick={handleCloseDetails}>
                    <X className="h-5 w-5" />
                    <span className="sr-only">{t('UsersPage.close')}</span>
                </Button>
            </CardHeader>
              <CardContent>
                <Tabs defaultValue="roles" className="w-full">
                   <TabsList className="h-auto items-center justify-start flex-wrap">
                    <TabsTrigger value="roles">{t('UsersPage.tabs.roles')}</TabsTrigger>
                    <TabsTrigger value="services">{t('UsersPage.tabs.services')}</TabsTrigger>
                    <TabsTrigger value="quotes">{t('UsersPage.tabs.quotes')}</TabsTrigger>
                    <TabsTrigger value="appointments">{t('UsersPage.tabs.appointments')}</TabsTrigger>
                    <TabsTrigger value="messages">{t('UsersPage.tabs.messages')}</TabsTrigger>
                    <TabsTrigger value="logs">{t('UsersPage.tabs.logs')}</TabsTrigger>
                    <TabsTrigger value="history">{t('UsersPage.tabs.history')}</TabsTrigger>
                  </TabsList>
                  <TabsContent value="roles">
                    <UserRoles userId={selectedUser.id} />
                  </TabsContent>
                  <TabsContent value="services">
                    <UserServices userId={selectedUser.id} />
                  </TabsContent>
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
          <DialogTitle>{editingUser ? t('UsersPage.createDialog.editTitle') : t('UsersPage.createDialog.title')}</DialogTitle>
          <DialogDescription>{editingUser ? t('UsersPage.createDialog.editDescription') : t('UsersPage.createDialog.description')}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {submissionError && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{submissionError}</AlertDescription>
                  </Alert>
                )}
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
                                <Input placeholder={t('UsersPage.createDialog.phonePlaceholder')} {...field} />
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
