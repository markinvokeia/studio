
'use client';

import * as React from 'react';
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
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
      avatar: apiUser.avatar || `https://picsum.photos/seed/${apiUser.id || Math.random()}/40/40`,
    }));

    return { users: mappedUsers, total: total };

  } catch (error) {
    console.error("Failed to fetch users:", error);
    return { users: [], total: 0 };
  }
}

export default function UsersPage() {
  const t = useTranslations('UsersPage');
  console.log('Translations for UsersPage loaded.');
  const userColumns = UserColumnsWrapper();
  const [users, setUsers] = React.useState<User[]>([]);
  const [userCount, setUserCount] = React.useState(0);
  const [selectedUser, setSelectedUser] = React.useState<User | null>(null);
  const [isCreateOpen, setCreateOpen] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);


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

  const handleRowSelectionChange = (selectedRows: User[]) => {
    const user = selectedRows.length > 0 ? selectedRows[0] : null;
    setSelectedUser(user);
  };
  
  const handleCloseDetails = () => {
    setSelectedUser(null);
    setRowSelection({});
  };
  
  return (
    <>
    <div className={cn("grid grid-cols-1 gap-4", selectedUser ? "lg:grid-cols-5" : "lg:grid-cols-1")}>
      <div className={cn("transition-all duration-300", selectedUser ? "lg:col-span-2" : "lg:col-span-5")}>
        <Card>
          <CardHeader>
            <CardTitle>{t('title')}</CardTitle>
            <CardDescription>{t('description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable 
              columns={userColumns} 
              data={users} 
              filterColumnId="email" 
              filterPlaceholder={t('filterPlaceholder')}
              onRowSelectionChange={handleRowSelectionChange}
              enableSingleRowSelection={true}
              onCreate={() => setCreateOpen(true)}
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
                    <CardTitle>{t('detailsFor', {name: selectedUser.name})}</CardTitle>
                </div>
                <Button variant="destructive-ghost" size="icon" onClick={handleCloseDetails}>
                    <X className="h-5 w-5" />
                    <span className="sr-only">{t('close')}</span>
                </Button>
            </CardHeader>
              <CardContent>
                <Tabs defaultValue="roles" className="w-full">
                   <TabsList className="h-auto items-center justify-start flex-wrap">
                    <TabsTrigger value="roles">{t('tabs.roles')}</TabsTrigger>
                    <TabsTrigger value="services">{t('tabs.services')}</TabsTrigger>
                    <TabsTrigger value="quotes">{t('tabs.quotes')}</TabsTrigger>
                    <TabsTrigger value="appointments">{t('tabs.appointments')}</TabsTrigger>
                    <TabsTrigger value="messages">{t('tabs.messages')}</TabsTrigger>
                    <TabsTrigger value="logs">{t('tabs.logs')}</TabsTrigger>
                    <TabsTrigger value="history">{t('tabs.history')}</TabsTrigger>
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

    <Dialog open={isCreateOpen} onOpenChange={setCreateOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('createDialog.title')}</DialogTitle>
          <DialogDescription>{t('createDialog.description')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">{t('createDialog.name')}</Label>
            <Input id="name" placeholder={t('createDialog.namePlaceholder')} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="email" className="text-right">{t('createDialog.email')}</Label>
            <Input id="email" type="email" placeholder={t('createDialog.emailPlaceholder')} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="phone" className="text-right">{t('createDialog.phone')}</Label>
            <Input id="phone" placeholder={t('createDialog.phonePlaceholder')} className="col-span-3" />
          </div>
           <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="avatar" className="text-right">{t('createDialog.avatarUrl')}</Label>
            <Input id="avatar" placeholder={t('createDialog.avatarUrlPlaceholder')} className="col-span-3" />
          </div>
          <div className="flex items-center space-x-2 justify-end">
             <Checkbox id="is_active" />
            <Label htmlFor="is_active">{t('createDialog.isActive')}</Label>
          </div>
        </div>
         <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>{t('createDialog.cancel')}</Button>
            <Button type="submit">{t('createDialog.save')}</Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
