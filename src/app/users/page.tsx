'use client';

import * as React from 'react';
import { userColumns } from './columns';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { User } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

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

  React.useEffect(() => {
    async function loadUsers() {
      const fetchedUsers = await getUsers();
      setUsers(fetchedUsers);
    }
    loadUsers();
  }, []);

  const handleRowSelectionChange = (selectedRows: User[]) => {
    const user = selectedRows.length > 0 ? selectedRows[0] : null;
    // Check if the selection has actually changed to prevent infinite loops
    if (user?.id !== selectedUser?.id) {
       setSelectedUser(user);
    } else if (!user && selectedUser) {
       setSelectedUser(null);
    }
  };
  
  return (
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
              filterPlaceholder="Filter by email..."
              onRowSelectionChange={handleRowSelectionChange}
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
                  <div className="relative w-full">
                    <Carousel
                        opts={{
                          align: "start",
                          dragFree: true,
                        }}
                        className="w-full"
                      >
                       <CarouselContent>
                          <CarouselItem className="basis-auto p-0">
                            <TabsList>
                              <TabsTrigger value="roles">Roles</TabsTrigger>
                              <TabsTrigger value="services">Services</TabsTrigger>
                              <TabsTrigger value="quotes">Quotes</TabsTrigger>
                              <TabsTrigger value="appointments">Appointments</TabsTrigger>
                              <TabsTrigger value="messages">Messages</TabsTrigger>
                              <TabsTrigger value="logs">Logs</TabsTrigger>
                            </TabsList>
                          </CarouselItem>
                       </CarouselContent>
                       <CarouselPrevious className="absolute -left-4 top-1/2 -translate-y-1/2" />
                       <CarouselNext className="absolute -right-4 top-1/2 -translate-y-1/2" />
                    </Carousel>
                  </div>

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
        </div>
      )}
    </div>
  );
}
