'use client';

import * as React from 'react';
import { userColumns } from './columns';
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
import { RowSelectionState, PaginationState } from '@tanstack/react-table';

type GetUsersResponse = {
  users: User[];
  total: number;
};

async function getUsers(pagination: PaginationState): Promise<GetUsersResponse> {
  try {
    const params = new URLSearchParams({
      page: (pagination.pageIndex + 1).toString(),
      limit: pagination.pageSize.toString(),
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
    const data = Array.isArray(responseData) && responseData.length > 0 ? responseData[0] : responseData;
    
    const usersData = Array.isArray(data.data) ? data.data : (data.users || data.data || data.result || []);
    const total = data.total || (Array.isArray(data) ? data.length : 0);

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


  const loadUsers = React.useCallback(async () => {
    setIsRefreshing(true);
    const { users: fetchedUsers, total } = await getUsers(pagination);
    setUsers(fetchedUsers);
    setUserCount(total);
    setIsRefreshing(false);
  }, [pagination]);

  React.useEffect(() => {
    loadUsers();
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
    <div className={cn("grid grid-cols-1 gap-4", selectedUser ? "lg:grid-cols-2" : "lg:grid-cols-1")}>
      <div className={cn("transition-all duration-300", selectedUser ? "lg:col-span-1" : "lg:col-span-2")}>
        <Card>
          <CardHeader>
            <CardTitle>Users</CardTitle>
            <CardDescription>Manage all users in the system.</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable 
              columns={userColumns} 
              data={users} 
              filterColumnId="email" 
              filterPlaceholder="Filter users by email..."
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
            />
          </CardContent>
        </Card>
      </div>
      
      {selectedUser && (
        <div className="col-span-1">
            <Card>
               <CardHeader className="flex flex-row items-start justify-between">
                <div>
                    <CardTitle>Details for {selectedUser.name}</CardTitle>
                    <CardDescription>User ID: {selectedUser.id}</CardDescription>
                </div>
                <Button variant="ghost" size="icon" onClick={handleCloseDetails}>
                    <X className="h-5 w-5" />
                    <span className="sr-only">Close details</span>
                </Button>
            </CardHeader>
              <CardContent>
                <Tabs defaultValue="roles" className="w-full">
                   <TabsList className="h-auto items-center justify-start flex-wrap">
                    <TabsTrigger value="roles">Roles</TabsTrigger>
                    <TabsTrigger value="services">Services</TabsTrigger>
                    <TabsTrigger value="quotes">Quotes</TabsTrigger>
                    <TabsTrigger value="appointments">Appointments</TabsTrigger>
                    <TabsTrigger value="messages">Messages</TabsTrigger>
                    <TabsTrigger value="logs">Logs</TabsTrigger>
                    <TabsTrigger value="history">Clinic History</TabsTrigger>
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
          <DialogTitle>Create New User</DialogTitle>
          <DialogDescription>
            Fill in the details below to add a new user.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Name
            </Label>
            <Input id="name" placeholder="John Doe" className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="email" className="text-right">
              Email
            </Label>
            <Input id="email" type="email" placeholder="john.doe@example.com" className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="phone" className="text-right">
              Phone
            </Label>
            <Input id="phone" placeholder="123-456-7890" className="col-span-3" />
          </div>
           <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="avatar" className="text-right">
              Avatar URL
            </Label>
            <Input id="avatar" placeholder="https://example.com/avatar.png" className="col-span-3" />
          </div>
          <div className="flex items-center space-x-2 justify-end">
             <Checkbox id="is_active" />
            <Label htmlFor="is_active">Is Active</Label>
          </div>
        </div>
         <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit">Create User</Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
