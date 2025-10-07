
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
import { useTranslations } from 'next-intl';

async function getRolesForUser(userId: string): Promise<UserRole[]> {
  if (!userId) return [];
  try {
    const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/roles/user_roles?user_id=${userId}`, {
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
  const t = useTranslations('UserRoles');
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
            title: t('toast.success'),
            description: t('toast.statusUpdated', { roleName: role.name, status: role.is_active ? t('status.inactive') : t('status.active') }),
        });
        loadUserRoles();
    } catch (error) {
        toast({
            variant: 'destructive',
            title: t('toast.error'),
            description: error instanceof Error ? error.message : t('toast.statusUpdateFailed'),
        });
    }
  };

  const handleDelete = async () => {
    if (!roleToDelete) return;
    try {
        await deleteUserRole(roleToDelete.user_role_id);
        toast({
            title: t('toast.success'),
            description: t('toast.roleRemoved', { roleName: roleToDelete.name }),
        });
        setRoleToDelete(null);
        loadUserRoles();
    } catch (error) {
        toast({
            variant: 'destructive',
            title: t('toast.error'),
            description: error instanceof Error ? error.message : t('toast.roleRemoveFailed', { roleName: roleToDelete.name }),
        });
        setRoleToDelete(null);
    }
  };

  const columns: ColumnDef<UserRole>[] = [
    {
        accessorKey: 'name',
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.role')} />,
    },
    {
        accessorKey: 'is_active',
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.status')} />,
        cell: ({ row }) => {
            const isActive = row.getValue('is_active');
            return (
                <Badge variant={isActive ? 'success' : 'outline'}>
                    {isActive ? t('status.active') : t('status.inactive')}
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
                            <span className="sr-only">{t('actions.openMenu')}</span>
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>{t('actions.title')}</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => handleToggleActivate(role)}>
                            {role.is_active ? t('actions.deactivate') : t('actions.activate')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setRoleToDelete(role)} className="text-destructive">
                            {t('actions.delete')}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            );
        },
    },
];

  const handleAddRole = () => {
    setSelectedRoles([]);
    setIsDialogOpen(true);
  };
  
  const handleAssignRoles = async () => {
    try {
        await assignRolesToUser(userId, selectedRoles);
        toast({
            title: t('toast.success'),
            description: t('toast.rolesAssigned'),
        });
        setIsDialogOpen(false);
        setSelectedRoles([]);
        loadUserRoles();
    } catch (error) {
         toast({
            variant: "destructive",
            title: t('toast.error'),
            description: error instanceof Error ? error.message : t('toast.rolesAssignFailed'),
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
          filterPlaceholder={t('filterPlaceholder')}
          onCreate={handleAddRole}
        />
      </CardContent>
    </Card>
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>{t('dialog.title')}</DialogTitle>
                <DialogDescription>{t('dialog.description')}</DialogDescription>
            </DialogHeader>
            <div className="py-4">
                <Label>{t('dialog.availableRoles')}</Label>
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
                                            <Label htmlFor={`active-switch-${role.id}`} className="text-sm">{t('dialog.activeLabel')}</Label>
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
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>{t('dialog.cancel')}</Button>
                <Button onClick={handleAssignRoles}>{t('dialog.assign')}</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    <AlertDialog open={!!roleToDelete} onOpenChange={() => setRoleToDelete(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>{t('deleteDialog.title')}</AlertDialogTitle>
                <AlertDialogDescription>
                    {t('deleteDialog.description', { roleName: roleToDelete?.name })}
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>{t('deleteDialog.cancel')}</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>{t('deleteDialog.continue')}</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
