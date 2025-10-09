
'use client';

import * as React from 'react';
import { ColumnDef, ColumnFiltersState } from '@tanstack/react-table';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Role, UserRoleAssignment, UserRole } from '@/lib/types';
import { Checkbox } from '../ui/checkbox';
import { ScrollArea } from '../ui/scroll-area';
import { Switch } from '../ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { useTranslations } from 'next-intl';

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

interface UserRolesProps {
  userId: string;
  initialUserRoles: UserRole[];
  isLoading: boolean;
  onRolesChange: () => void;
}

export function UserRoles({ userId, initialUserRoles, isLoading, onRolesChange }: UserRolesProps) {
  const t = useTranslations('UserRoles');
  const [allRoles, setAllRoles] = React.useState<Role[]>([]);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [selectedRoles, setSelectedRoles] = React.useState<UserRoleAssignment[]>([]);
  const { toast } = useToast();
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

  React.useEffect(() => {
    if (isDialogOpen) {
      getAllRoles().then(setAllRoles);
    }
  }, [isDialogOpen]);

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
];

  const handleAddRole = () => {
    const assignedRoles: UserRoleAssignment[] = initialUserRoles.map(role => ({
        role_id: String(role.role_id),
        is_active: role.is_active,
    }));
    setSelectedRoles(assignedRoles);
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
        onRolesChange(); // Notify parent to re-fetch roles
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
          data={initialUserRoles}
          filterColumnId='name'
          filterPlaceholder={t('filterPlaceholder')}
          onCreate={handleAddRole}
          columnFilters={columnFilters}
          onColumnFiltersChange={setColumnFilters}
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
    </>
  );
}
