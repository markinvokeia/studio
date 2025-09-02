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

async function getUsers(): Promise<User[]> {
  try {
    const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/users', {
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

    const data = await response.json();
    const usersData = Array.isArray(data) ? data : (data.users || data.data || data.result || []);

    return usersData.map((apiUser: any) => ({
      id: apiUser.id ? String(apiUser.id) : `usr_${Math.random().toString(36).substr(2, 9)}`,
      name: apiUser.name || 'No Name',
      email: apiUser.email || 'no-email@example.com',
      phone_number: apiUser.phone_number || '000-000-0000',
      is_active: apiUser.is_active !== undefined ? apiUser.is_active : true,
      avatar: apiUser.avatar || `https://picsum.photos/seed/${apiUser.id || Math.random()}/40/40`,
    }));
  } catch (error) {
    console.error("Failed to fetch users:", error);
    return [];
  }
}

export default function UsersPage() {
  const [users, setUsers] = React.useState<User[]>([]);
  const [selectedUser, setSelectedUser] = React.useState<User | null>(null);
  const [isCreateOpen, setCreateOpen] = React.useState(false);
  const [isHistoryOpen, setHistoryOpen] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const loadUsers = React.useCallback(async () => {
    setIsRefreshing(true);
    const fetchedUsers = await getUsers();
    setUsers(fetchedUsers);
    setIsRefreshing(false);
  }, []);

  React.useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleRowSelectionChange = (selectedRows: User[]) => {
    const user = selectedRows.length > 0 ? selectedRows[0] : null;
    if (user?.id !== selectedUser?.id) {
       setSelectedUser(user);
    } else if (!user && selectedUser) {
       setSelectedUser(null);
    }
  };
  
  return (
    <>
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className={cn("transition-all duration-300", selectedUser ? "lg:col-span-2" : "lg:col-span-3")}>
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
              onShowHistory={() => setHistoryOpen(true)}
            />
          </CardContent>
        </Card>
      </div>
      
      {selectedUser && (
        <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Details for {selectedUser.name}</CardTitle>
                <CardDescription>User ID: {selectedUser.id}</CardDescription>
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
                  </TabsList>
                  <TabsContent value="roles">
                    <UserRoles userId={selectedUser.id} />
                  </TabsContent>
                  <TabsContent value="services">
                    <UserServices userId={selectedUser.id} />
                  </TabsContent>
                  <TabsContent value="quotes">
                    <Card>
                      <CardContent className="p-6">
                        <p>Quotes content for {selectedUser.name}.</p>
                      </CardContent>
                    </Card>
                  </TabsContent>
                  <TabsContent value="appointments">
                    <Card>
                      <CardContent className="p-6">
                        <p>Appointments content for {selectedUser.name}.</p>
                      </CardContent>
                    </Card>
                  </TabsContent>
                  <TabsContent value="messages">
                    <Card>
                      <CardContent className="p-6">
                        <p>Messages content for {selectedUser.name}.</p>
                      </CardContent>
                    </Card>
                  </TabsContent>
                  <TabsContent value="logs">
                    <Card>
                      <CardContent className="p-6">
                        <p>Logs content for {selectedUser.name}.</p>
                      </CardContent>
                    </Card>
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
    {selectedUser && (
      <MedicalHistory
        isOpen={isHistoryOpen}
        onOpenChange={setHistoryOpen}
        user={selectedUser}
      />
    )}
    </>
  );
}
