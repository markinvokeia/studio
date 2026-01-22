
'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { Role, UserRole, UserRoleAssignment } from '@/lib/types';
import { api } from '@/services/api';
import { ColumnDef, ColumnFiltersState } from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { Checkbox } from '../ui/checkbox';
import { ScrollArea } from '../ui/scroll-area';
import { Switch } from '../ui/switch';

async function getAllRoles(): Promise<Role[]> {
  try {
    const data = await api.get(API_ROUTES.ROLES);
    const rolesData = Array.isArray(data) ? data : (data.roles || data.data || []);
    return rolesData.map((role: any) => ({ id: String(role.id), name: role.name }));
  } catch (error) {
    console.error("Failed to fetch all roles:", error);
    return [];
  }
}

async function assignRolesToUser(userId: string, roles: UserRoleAssignment[]): Promise<any> {
  return await api.patch(API_ROUTES.ROLES_ASSIGN, { user_id: userId, roles: roles });
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
      <div className="flex-1 flex flex-col min-h-0 space-y-2 pt-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  return (
    <>
      <DataTable
        columns={columns}
        data={initialUserRoles}
        filterColumnId="name"
        filterPlaceholder={t('filterPlaceholder')}
        onCreate={handleAddRole}
        columnFilters={columnFilters}
        onColumnFiltersChange={setColumnFilters}
      />
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
