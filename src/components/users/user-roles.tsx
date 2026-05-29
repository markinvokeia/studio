
'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { API_ROUTES } from '@/constants/routes';
import { useLicenseStore } from '@/stores/license-store';
import { useToast } from '@/hooks/use-toast';
import { LicensePayload, Role, UserRole, UserRoleAssignment } from '@/lib/types';
import { api } from '@/services/api';
import { ColumnDef, ColumnFiltersState } from '@tanstack/react-table';
import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { Checkbox } from '../ui/checkbox';
import { ScrollArea } from '../ui/scroll-area';
import { Switch } from '../ui/switch';

interface AllRoleCounts {
  doctor: number;
  receptionist: number;
  admin: number;
  superAdmin: number;
}

async function fetchAllRoleCounts(): Promise<AllRoleCounts> {
  const data = await api.get(API_ROUTES.REPORTS.USERS_BY_ROLE);
  const rows: { name: string; count: string }[] = Array.isArray(data) ? data : [];
  const find = (key: string) => {
    const row = rows.find((r) => r.name?.toLowerCase().includes(key));
    return row ? Number(row.count) || 0 : 0;
  };
  return {
    doctor: find('medico'),
    receptionist: find('recepcionista'),
    admin: find('gerente'),
    superAdmin: find('administrador'),
  };
}

async function getAllRoles(): Promise<Role[]> {
  try {
    const data = await api.get(API_ROUTES.ROLES);
    const rolesData = Array.isArray(data) ? data : (data.roles || data.data || []);
    return rolesData.map((role: any) => ({ id: String(role.id), name: role.name, is_default: role.is_default ?? false }));
  } catch (error) {
    console.error("Failed to fetch all roles:", error);
    return [];
  }
}

async function assignRolesToUser(userId: string, roles: UserRoleAssignment[]): Promise<any> {
  return await api.patch(API_ROUTES.ROLES_ASSIGN, { user_id: userId, roles: roles });
}

function getRoleLimitInfo(
  roleName: string,
  counts: AllRoleCounts,
  license: LicensePayload,
): { current: number; max: number } | null {
  const n = roleName.toLowerCase();
  if (n.includes('medico') || n.includes('doctor')) return { current: counts.doctor, max: license.maxDoctors };
  if (n.includes('recepcionista')) return { current: counts.receptionist, max: license.maxReceptionists };
  if (n.includes('gerente')) return { current: counts.admin, max: license.maxAdmins };
  if (n.includes('administrador')) return { current: counts.superAdmin, max: license.maxSuperAdmins };
  return null;
}

interface UserRolesProps {
  userId: string;
  initialUserRoles: UserRole[];
  isLoading: boolean;
  onRolesChange: () => void;
  canAssignRole?: boolean;
  canRemoveRole?: boolean;
}

export function UserRoles({ userId, initialUserRoles, isLoading, onRolesChange, canAssignRole = true, canRemoveRole = true }: UserRolesProps) {
  const t = useTranslations('UserRoles');
  const tGlobal = useTranslations();
  const [allRoles, setAllRoles] = React.useState<Role[]>([]);
  const [roleCounts, setRoleCounts] = React.useState<AllRoleCounts | null>(null);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [selectedRoles, setSelectedRoles] = React.useState<UserRoleAssignment[]>([]);
  const [assignError, setAssignError] = React.useState<string | null>(null);
  const { toast } = useToast();
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

  React.useEffect(() => {
    if (isDialogOpen) {
      getAllRoles().then(setAllRoles);
      fetchAllRoleCounts().then(setRoleCounts).catch(() => setRoleCounts(null));
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
    setAssignError(null);
    setRoleCounts(null);
    setIsDialogOpen(true);
  };

  const handleAssignRoles = async () => {
    if (!canAssignRole) return;
    setAssignError(null);

    try {
      await assignRolesToUser(userId, selectedRoles);
      toast({
        title: t('toast.success'),
        description: t('toast.rolesAssigned'),
      });
      setIsDialogOpen(false);
      setSelectedRoles([]);
      onRolesChange();
    } catch (error) {
      toast({
        variant: "destructive",
        title: t('toast.error'),
        description: error instanceof Error ? error.message : t('toast.rolesAssignFailed'),
      });
    }
  };

  const handleRoleSelection = (roleId: string, checked: boolean | 'indeterminate') => {
    if (checked) {
      // Validate against license limits before allowing selection
      const { license } = useLicenseStore.getState();
      if (license && roleCounts) {
        const role = allRoles.find((r) => r.id === roleId);
        if (role) {
          const limitInfo = getRoleLimitInfo(role.name, roleCounts, license);
          if (limitInfo && limitInfo.current >= limitInfo.max) {
            setAssignError(tGlobal('License.enforcement.userLimitReached', { max: limitInfo.max }));
            return;
          }
        }
      }
      setAssignError(null);
      setSelectedRoles(prev => [...prev, { role_id: roleId, is_active: true }]);
    } else {
      setAssignError(null);
      setSelectedRoles(prev => prev.filter(role => role.role_id !== roleId));
    }
  };

  const handleRoleActiveChange = (roleId: string, active: boolean) => {
    setSelectedRoles(prev => prev.map(role =>
      role.role_id === roleId ? { ...role, is_active: active } : role
    ));
  };

  const isRoleAtCapacity = (role: Role): boolean => {
    const { license } = useLicenseStore.getState();
    if (!license || !roleCounts) return false;
    const isAlreadySelected = selectedRoles.some((r) => r.role_id === role.id);
    if (isAlreadySelected) return false;
    const limitInfo = getRoleLimitInfo(role.name, roleCounts, license);
    return !!limitInfo && limitInfo.current >= limitInfo.max;
  };

  const getLimitLabel = (role: Role): string | null => {
    const { license } = useLicenseStore.getState();
    if (!license || !roleCounts) return null;
    const limitInfo = getRoleLimitInfo(role.name, roleCounts, license);
    if (!limitInfo) return null;
    return `${limitInfo.current}/${limitInfo.max}`;
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
        onCreate={canAssignRole ? handleAddRole : undefined}
        createButtonLabel={t('addRoles')}
        columnFilters={columnFilters}
        onColumnFiltersChange={setColumnFilters}
      />
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('dialog.title')}</DialogTitle>
            <DialogDescription>{t('dialog.description')}</DialogDescription>
          </DialogHeader>
          <div className="py-4 px-6">
            <Label>{t('dialog.availableRoles')}</Label>
            <ScrollArea className="h-64 mt-2 border rounded-md p-4">
              <div className="space-y-2">
                {allRoles.map(role => {
                  const isSelected = selectedRoles.some(r => r.role_id === role.id);
                  const roleData = selectedRoles.find(r => r.role_id === role.id);
                  const atCapacity = isRoleAtCapacity(role);
                  const limitLabel = getLimitLabel(role);
                  return (
                    <div key={role.id} className="flex items-center justify-between space-x-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`role-${role.id}`}
                          onCheckedChange={(checked) => handleRoleSelection(role.id, checked)}
                          checked={isSelected}
                          disabled={atCapacity}
                        />
                        <Label
                          htmlFor={`role-${role.id}`}
                          className={atCapacity ? 'text-muted-foreground' : undefined}
                        >
                          {role.name}
                        </Label>
                        {limitLabel && (
                          <span className={`text-xs tabular-nums ${atCapacity ? 'text-destructive' : 'text-muted-foreground'}`}>
                            ({limitLabel})
                          </span>
                        )}
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
          {assignError && (
            <div className="px-6 pb-2 flex items-start gap-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{assignError}</span>
            </div>
          )}
          <DialogFooter>
            <Button onClick={handleAssignRoles}>{t('dialog.assign')}</Button>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>{t('dialog.cancel')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
