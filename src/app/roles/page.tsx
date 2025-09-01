'use client';

import * as React from 'react';
import { roleColumns } from './columns';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Role } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

async function getRoles(): Promise<Role[]> {
  try {
    const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/roles', {
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
    const rolesData = Array.isArray(data) ? data : (data.roles || data.data || data.result || []);

    return rolesData.map((apiRole: any) => ({
      id: apiRole.id ? String(apiRole.id) : `rol_${Math.random().toString(36).substr(2, 9)}`,
      name: apiRole.name || 'No Name',
    }));
  } catch (error) {
    console.error("Failed to fetch roles:", error);
    return [];
  }
}


export default function RolesPage() {
  const [roles, setRoles] = React.useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = React.useState<Role | null>(null);
  const [isCreateOpen, setCreateOpen] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const loadRoles = React.useCallback(async () => {
    setIsRefreshing(true);
    const fetchedRoles = await getRoles();
    setRoles(fetchedRoles);
    setIsRefreshing(false);
  }, []);

  React.useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  const handleRowSelectionChange = (selectedRows: Role[]) => {
    const role = selectedRows.length > 0 ? selectedRows[0] : null;
    setSelectedRole(role);
  };
  
  return (
    <>
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className={cn("transition-all duration-300", selectedRole ? "lg:col-span-2" : "lg:col-span-3")}>
            <Card>
                <CardHeader>
                    <CardTitle>Roles</CardTitle>
                    <CardDescription>Manage user roles and their permissions.</CardDescription>
                </CardHeader>
                <CardContent>
                    <DataTable 
                    columns={roleColumns} 
                    data={roles} 
                    filterColumnId="name" 
                    filterPlaceholder="Filter roles by name..."
                    onRowSelectionChange={handleRowSelectionChange}
                    enableSingleRowSelection={true}
                    onCreate={() => setCreateOpen(true)}
                    onRefresh={loadRoles}
                    isRefreshing={isRefreshing}
                    />
                </CardContent>
            </Card>
        </div>
        {selectedRole && (
            <div className="lg:col-span-1">
                <Card>
                    <CardHeader>
                        <CardTitle>Details for {selectedRole.name}</CardTitle>
                        <CardDescription>Role ID: {selectedRole.id}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p>Details for the selected role will be displayed here.</p>
                    </CardContent>
                </Card>
            </div>
        )}
    </div>

    <Dialog open={isCreateOpen} onOpenChange={setCreateOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Role</DialogTitle>
          <DialogDescription>
            Fill in the details below to add a new role.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Name
            </Label>
            <Input id="name" placeholder="Admin" className="col-span-3" />
          </div>
        </div>
         <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit">Create Role</Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
