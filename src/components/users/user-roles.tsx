
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
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Role, UserRoleAssignment } from '@/lib/types';
import { Checkbox } from '../ui/checkbox';
import { ScrollArea } from '../ui/scroll-area';

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
    const rolesData = Array.isArray(data) ? data : (data.roles || data.data || []);
    return rolesData.map((role: any) => ({ id: String(role.id), name: role.name }));
  } catch (error) {
    console.error("Failed to fetch all roles:", error);
    return [];
  }
}


async function assignRolesToUser(userId: string, roleIds: string[]): Promise<any> {
    const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/roles/assign?user_id=${userId}`, {
        method: 'PATCH',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role_ids: roleIds }),
    });

    const responseText = await response.text();
    if (!response.ok) {
        const errorData = responseText ? JSON.parse(responseText) : { message: 'Failed to assign roles' };
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
  const [selectedRoleIds, setSelectedRoleIds] = React.useState<string[]>([]);
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
    setSelectedRoleIds([]);
    setIsDialogOpen(true);
  };
  
  const handleAssignRoles = async () => {
    if (selectedRoleIds.length === 0) {
        toast({
            variant: "destructive",
            title: "Error",
            description: "Please select at least one role to assign.",
        });
        return;
    }
    try {
        await assignRolesToUser(userId, selectedRoleIds);
        toast({
            title: "Success",
            description: "Roles assigned successfully.",
        });
        setIsDialogOpen(false);
        setSelectedRoleIds([]);
        loadUserRoles();
    } catch (error) {
         toast({
            variant: "destructive",
            title: "Error",
            description: error instanceof Error ? error.message : "Could not assign roles.",
        });
    }
  };

  const handleRoleSelection = (roleId: string, checked: boolean | 'indeterminate') => {
      if (checked) {
          setSelectedRoleIds(prev => [...prev, roleId]);
      } else {
          setSelectedRoleIds(prev => prev.filter(id => id !== roleId));
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
                <DialogTitle>Add Roles to User</DialogTitle>
                <DialogDescription>Select the roles to assign to this user.</DialogDescription>
            </DialogHeader>
            <div className="py-4">
                <Label>Available Roles</Label>
                <ScrollArea className="h-64 mt-2 border rounded-md p-4">
                   <div className="space-y-2">
                        {allRoles.map(role => (
                            <div key={role.id} className="flex items-center space-x-2">
                                <Checkbox 
                                    id={`role-${role.id}`}
                                    onCheckedChange={(checked) => handleRoleSelection(role.id, checked)}
                                    checked={selectedRoleIds.includes(role.id)}
                                />
                                <Label htmlFor={`role-${role.id}`}>{role.name}</Label>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleAssignRoles} disabled={selectedRoleIds.length === 0}>Assign Roles</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    </>
  );
}
