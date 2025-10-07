
'use client';

import * as React from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Role } from '@/lib/types';

type UserRole = {
  role_id: string;
  name: string;
  is_active: boolean;
};

const columns: ColumnDef<UserRole>[] = [
    {
        accessorKey: 'name',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Role" />,
    },
    {
        accessorKey: 'is_active',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => {
            const isActive = row.getValue('is_active');
            return (
                <Badge variant={isActive ? 'success' : 'outline'}>
                    {isActive ? 'Active' : 'Inactive'}
                </Badge>
            );
        }
    }
];

async function getRolesForUser(userId: string): Promise<UserRole[]> {
  if (!userId) return [];
  try {
    const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/user_roles?user_id=${userId}`, {
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
    const userRolesData = Array.isArray(data) ? data : (data.user_roles || data.data || data.result || []);

    return userRolesData.map((apiRole: any) => ({
      role_id: apiRole.role_id,
      name: apiRole.name || 'Unknown Role',
      is_active: apiRole.is_active,
    }));
  } catch (error) {
    console.error("Failed to fetch user roles:", error);
    return [];
  }
}

async function getAllRoles(): Promise<Role[]> {
  try {
    const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/roles', {
      method: 'GET',
      mode: 'cors',
      headers: { 'Accept': 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('Failed to fetch roles');
    const data = await response.json();
    return Array.isArray(data) ? data : (data.roles || data.data || []);
  } catch (error) {
    console.error("Failed to fetch all roles:", error);
    return [];
  }
}

async function assignRoleToUser(userId: string, roleId: string): Promise<any> {
    const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/user_roles/assign', {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, role_id: roleId }),
    });

    const responseText = await response.text();
    if (!response.ok) {
        const errorData = responseText ? JSON.parse(responseText) : { message: 'Failed to assign role' };
        throw new Error(errorData.message || `Error HTTP: ${response.status}`);
    }
    return responseText ? JSON.parse(responseText) : {};
}


interface UserRolesProps {
  userId: string;
}

export function UserRoles({ userId }: UserRolesProps) {
  const [userRoles, setUserRoles] = React.useState<UserRole[]>([]);
  const [allRoles, setAllRoles] = React.useState<Role[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [selectedRole, setSelectedRole] = React.useState<string | null>(null);
  const { toast } = useToast();

  const loadUserRoles = React.useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    const fetchedUserRoles = await getRolesForUser(userId);
    setUserRoles(fetchedUserRoles);
    setIsLoading(false);
  }, [userId]);

  React.useEffect(() => {
    loadUserRoles();
  }, [loadUserRoles]);

  React.useEffect(() => {
    if (isDialogOpen) {
      getAllRoles().then(setAllRoles);
    }
  }, [isDialogOpen]);

  const handleAddRole = () => {
    setIsDialogOpen(true);
  };
  
  const handleAssignRole = async () => {
    if (!selectedRole) {
        toast({
            variant: "destructive",
            title: "Error",
            description: "Please select a role to assign.",
        });
        return;
    }
    try {
        await assignRoleToUser(userId, selectedRole);
        toast({
            title: "Success",
            description: "Role assigned successfully.",
        });
        setIsDialogOpen(false);
        setSelectedRole(null);
        loadUserRoles();
    } catch (error) {
         toast({
            variant: "destructive",
            title: "Error",
            description: error instanceof Error ? error.message : "Could not assign role.",
        });
    }
  };


  if (isLoading) {
    return (
      <div className="space-y-2 pt-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  return (
    <>
    <Card>
      <CardContent className="p-4">
        <DataTable
          columns={columns}
          data={userRoles}
          filterColumnId='name'
          filterPlaceholder='Filter by role...'
          onCreate={handleAddRole}
        />
      </CardContent>
    </Card>
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Add Role to User</DialogTitle>
                <DialogDescription>Select a role to assign to this user.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="role" className="text-right">Role</Label>
                    <Select onValueChange={setSelectedRole}>
                        <SelectTrigger className="col-span-3">
                            <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                        <SelectContent>
                            {allRoles.map(role => (
                                <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleAssignRole}>Assign Role</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    </>
  );
}
