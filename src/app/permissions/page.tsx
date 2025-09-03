'use client';

import * as React from 'react';
import { permissionColumns } from './columns';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Permission } from '@/lib/types';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

async function getPermissions(): Promise<Permission[]> {
  try {
    const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/permissions', {
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
    const permissionsData = Array.isArray(data) ? data : (data.permissions || data.data || data.result || []);

    return permissionsData.map((apiPerm: any) => ({
      id: apiPerm.id ? String(apiPerm.id) : `perm_${Math.random().toString(36).substr(2, 9)}`,
      name: apiPerm.name || 'No Name',
      action: apiPerm.action || 'No Action',
      resource: apiPerm.resource || 'No Resource',
    }));
  } catch (error) {
    console.error("Failed to fetch permissions:", error);
    return [];
  }
}

export default function PermissionsPage() {
  const [permissions, setPermissions] = React.useState<Permission[]>([]);
  const [selectedPermission, setSelectedPermission] = React.useState<Permission | null>(null);
  const [isCreateOpen, setCreateOpen] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const loadPermissions = React.useCallback(async () => {
    setIsRefreshing(true);
    const fetchedPermissions = await getPermissions();
    setPermissions(fetchedPermissions);
    setIsRefreshing(false);
  }, []);

  React.useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  const handleRowSelectionChange = (selectedRows: Permission[]) => {
    const permission = selectedRows.length > 0 ? selectedRows[0] : null;
    setSelectedPermission(permission);
  };
  
  return (
    <>
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className={cn("transition-all duration-300", selectedPermission ? "lg:col-span-2" : "lg:col-span-3")}>
            <Card>
                <CardHeader>
                    <CardTitle>Permissions</CardTitle>
                    <CardDescription>View all system permissions.</CardDescription>
                </CardHeader>
                <CardContent>
                    <DataTable 
                    columns={permissionColumns} 
                    data={permissions} 
                    filterColumnId="name" 
                    filterPlaceholder="Filter permissions by name..."
                    onRowSelectionChange={handleRowSelectionChange}
                    enableSingleRowSelection={true}
                    onCreate={() => setCreateOpen(true)}
                    onRefresh={loadPermissions}
                    isRefreshing={isRefreshing}
                    />
                </CardContent>
            </Card>
        </div>
        {selectedPermission && (
            <div className="lg:col-span-1">
                <Card>
                    <CardHeader>
                        <CardTitle>Details for {selectedPermission.name}</CardTitle>
                        <CardDescription>Permission ID: {selectedPermission.id}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p>Details for the selected permission will be displayed here.</p>
                    </CardContent>
                </Card>
            </div>
        )}
    </div>

    <Dialog open={isCreateOpen} onOpenChange={setCreateOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Permission</DialogTitle>
          <DialogDescription>
            Fill in the details below to add a new permission.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Name
            </Label>
            <Input id="name" placeholder="e.g., Create User" className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="action" className="text-right">
              Action
            </Label>
             <Select>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select an action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="create">Create</SelectItem>
                <SelectItem value="read">Read</SelectItem>
                <SelectItem value="update">Update</SelectItem>
                <SelectItem value="delete">Delete</SelectItem>
                 <SelectItem value="manage">Manage</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="resource" className="text-right">
              Resource
            </Label>
            <Input id="resource" placeholder="e.g., user" className="col-span-3" />
          </div>
        </div>
         <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit">Create Permission</Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}

    