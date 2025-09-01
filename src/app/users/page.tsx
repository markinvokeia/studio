'use client';

import * as React from 'react';
import { userColumns } from './columns';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { User } from '@/lib/types';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { ChevronsUpDown } from 'lucide-react';

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
      phone_number: apiUser.phone || '000-000-0000',
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
  const [isUsersTableCollapsed, setIsUsersTableCollapsed] = React.useState(false);

  React.useEffect(() => {
    async function loadUsers() {
      const fetchedUsers = await getUsers();
      setUsers(fetchedUsers);
    }
    loadUsers();
  }, []);

  const handleRowSelectionChange = (selectedRows: User[]) => {
    const user = selectedRows.length > 0 ? selectedRows[0] : null;
    setSelectedUser(user);
    setIsUsersTableCollapsed(user !== null);
  };
  
  return (
    <div className="space-y-4">
      <Collapsible
        open={!isUsersTableCollapsed}
        onOpenChange={(open) => setIsUsersTableCollapsed(!open)}
      >
        <Card>
          <CardHeader className='flex-row items-center justify-between'>
            <div>
              <CardTitle>Users</CardTitle>
              <CardDescription>Manage all users in the system.</CardDescription>
            </div>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-9 p-0">
                <ChevronsUpDown className="h-4 w-4" />
                <span className="sr-only">Toggle</span>
              </Button>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent>
              <DataTable 
                columns={userColumns} 
                data={users} 
                filterColumnId="email" 
                filterPlaceholder="Filter by email..."
                onRowSelectionChange={handleRowSelectionChange}
              />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
      {selectedUser && (
        <Card>
          <CardHeader>
             <CardTitle>Details for {selectedUser.name}</CardTitle>
             <CardDescription>User ID: {selectedUser.id}</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="roles">
              <TabsList>
                <TabsTrigger value="roles">Roles</TabsTrigger>
                <TabsTrigger value="services">Services</TabsTrigger>
                <TabsTrigger value="quotes">Quotes</TabsTrigger>
                <TabsTrigger value="appointments">Appointments</TabsTrigger>
                <TabsTrigger value="messages">Messages</TabsTrigger>
                <TabsTrigger value="logs">Logs</TabsTrigger>
              </TabsList>
              <TabsContent value="roles">
                <Card>
                  <CardContent className="p-6">
                    <p>Roles content for {selectedUser.name}.</p>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="services">
                 <Card>
                  <CardContent className="p-6">
                    <p>Services content for {selectedUser.name}.</p>
                  </CardContent>
                </Card>
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
      )}
    </div>
  );
}
