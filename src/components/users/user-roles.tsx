'use client';

import * as React from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Role, UserRoleAssignment, UserRole } from '@/lib/types';
import { Checkbox } from '../ui/checkbox';
import { ScrollArea } from '../ui/scroll-area';
import { Switch } from '../ui/switch';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';

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
      user_role_id: apiRole.user_role_id,
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


async function assignRolesToUser(userId: string, roles: UserRoleAssignment[]): Promise<any> {
    const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/roles/assign`, {
        method: 'PATCH',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, roles: roles }),
    });

    const responseText = await response.text();
    if (!response.ok) {
        const errorData = responseText ? JSON.parse(responseText) : { message: 'Failed to assign roles' };
        throw new Error(errorData.message || `Error HTTP: ${response.status}`);
    }
    return responseText ? JSON.parse(responseText) : {};
}

async function updateUserRoleStatus(userRoleId: string, isActive: boolean): Promise<any> {
    const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/user_roles/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_role_id: userRoleId, is_active: isActive }),
    });
    if (!response.ok) {
        throw new Error('Failed to update role status');
    }
    return response.json();
}

async function deleteUserRole(userRoleId: string): Promise<any> {
    const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/user_roles/delete?user_role_id=${userRoleId}`, {
        method: 'DELETE',
    });
    if (!response.ok) {
        throw new Error('Failed to delete role assignment');
    }
    return response.json();
}


interface UserRolesProps {
  userId: string;
}

export function UserRoles({ userId }: UserRolesProps) {
  const [userRoles, setUserRoles] = React.useState<UserRole[]>([]);
  const [allRoles, setAllRoles] = React.useState<Role[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [selectedRoles, setSelectedRoles] = React.useState<UserRoleAssignment[]>([]);
  const [roleToDelete, setRoleToDelete] = React.useState<UserRole | null>(null);
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

  const handleToggleActivate = async (role: UserRole) => {
    try {
        await updateUserRoleStatus(role.user_role_id, !role.is_active);
        toast({
            title: 'Success',
            description: `Role ${role.name} has been ${role.is_active ? 'deactivated' : 'activated'}.`,
        });
        loadUserRoles();
    } catch (error) {
        toast({
            variant: 'destructive',
            title: 'Error',
            description: error instanceof Error ? error.message : 'Could not update role status.',
        });
    }
  };

  const handleDelete = async () => {
    if (!roleToDelete) return;
    try {
        await deleteUserRole(roleToDelete.user_role_id);
        toast({
            title: 'Success',
            description: `Role "${roleToDelete.name}" has been removed from the user.`,
        });
        setRoleToDelete(null);
        loadUserRoles();
    } catch (error) {
        toast({
            variant: 'destructive',
            title: 'Error',
            description: error instanceof Error ? error.message : `Could not remove role "${roleToDelete.name}".`,
        });
        setRoleToDelete(null);
    }
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
    },
    {
        id: 'actions',
        cell: ({ row }) => {
            const role = row.original;
            return (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => handleToggleActivate(role)}>
                            {role.is_active ? 'Deactivate' : 'Activate'}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setRoleToDelete(role)} className="text-destructive">
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            );
        },
    },
];

  const handleAddRole = () => {
    const initialSelectedRoles = userRoles.map(ur => ({ role_id: ur.role_id, is_active: ur.is_active }));
    setSelectedRoles(initialSelectedRoles);
    setIsDialogOpen(true);
  };
  
  const handleAssignRoles = async () => {
    try {
        await assignRolesToUser(userId, selectedRoles);
        toast({
            title: "Success",
            description: "Roles assigned successfully.",
        });
        setIsDialogOpen(false);
        setSelectedRoles([]);
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
      setSelectedRoles(prev => {
          if (checked) {
              return [...prev, { role_id: roleId, is_active: true }];
          } else {
              return prev.filter(role => role.role_id !== roleId);
          }
      });
  };
  
  const handleRoleActiveChange = (roleId: string, active: boolean) => {
    setSelectedRoles(prev => prev.map(role => 
        role.role_id === roleId ? { ...role, is_active: active } : role
    ));
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
                        {allRoles.map(role => {
                            const isSelected = selectedRoles.some(r => r.role_id === role.id);
                            const roleData = selectedRoles.find(r => r.role_id === role.id);
                            return (
                                <div key={role.id} className="flex items-center justify-between space-x-2">
                                    <div className="flex items-center space-x-2">
                                        <Checkbox 
                                            id={`role-${role.id}`}
                                            onCheckedChange={(checked) => handleRoleSelection(role.id, checked)}
                                            checked={isSelected}
                                        />
                                        <Label htmlFor={`role-${role.id}`}>{role.name}</Label>
                                    </div>
                                    {isSelected && (
                                        <div className="flex items-center space-x-2">
                                            <Label htmlFor={`active-switch-${role.id}`} className="text-sm">Active</Label>
                                            <Switch
                                                id={`active-switch-${role.id}`}
                                                checked={roleData?.is_active}
                                                onCheckedChange={(checked) => handleRoleActiveChange(role.id, checked)}
                                            />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </ScrollArea>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleAssignRoles}>Assign Roles</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    <AlertDialog open={!!roleToDelete} onOpenChange={() => setRoleToDelete(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action will remove the role "{roleToDelete?.name}" from the user. This cannot be undone.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>Continue</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
