
'use client';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { Permission } from '@/lib/types';
import { cn } from '@/lib/utils';
import { api } from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnDef } from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Check, ChevronsUpDown, MoreHorizontal } from 'lucide-react';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';


const rolePermissionFormSchema = z.object({
  permission_id: z.string().min(1, 'Permission is required'),
});

type RolePermissionFormValues = z.infer<typeof rolePermissionFormSchema>;

async function getPermissionsForRole(roleId: string): Promise<Permission[]> {
  if (!roleId) return [];
  try {
    const data = await api.get(API_ROUTES.ROLE_PERMISSIONS, { role_id: roleId });
    const permissionsData = Array.isArray(data) ? data : (data.role_permissions || data.data || data.result || []);

    return permissionsData.map((apiPerm: any) => ({
      id: apiPerm.permission_id ? String(apiPerm.permission_id) : `perm_${Math.random().toString(36).substr(2, 9)}`,
      name: apiPerm.name || 'Unknown Permission',
      action: apiPerm.action || 'N/A',
      resource: apiPerm.resource || 'N/A',
      description: apiPerm.description || 'No description',
    }));
  } catch (error) {
    console.error("Failed to fetch role permissions:", error);
    return [];
  }
}

async function getAllPermissions(): Promise<Permission[]> {
  try {
    const data = await api.get(API_ROUTES.PERMISSIONS);
    const permissionsData = Array.isArray(data) ? data : (data.permissions || data.data || []);
    return permissionsData.map((p: any) => ({ id: String(p.id), name: p.name, action: p.action, resource: p.resource, description: p.description }));
  } catch (error) {
    console.error("Failed to fetch all permissions:", error);
    return [];
  }
}

async function assignPermissionToRole(roleId: string, permissionId: string) {
  return await api.post(API_ROUTES.ROLE_PERMISSIONS_UPSERT, { role_id: roleId, permission_id: permissionId });
}

async function deletePermissionFromRole(roleId: string, permissionId: string) {
  return await api.delete(API_ROUTES.ROLE_PERMISSIONS_DELETE, { role_id: roleId, permission_id: permissionId });
}

interface RolePermissionsProps {
  roleId: string;
}

export function RolePermissions({ roleId }: RolePermissionsProps) {
  const t = useTranslations();
  const [permissions, setPermissions] = React.useState<Permission[]>([]);
  const [allPermissions, setAllPermissions] = React.useState<Permission[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [deletingPermission, setDeletingPermission] = React.useState<Permission | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [submissionError, setSubmissionError] = React.useState<string | null>(null);
  const { toast } = useToast();

  const form = useForm<RolePermissionFormValues>({
    resolver: zodResolver(rolePermissionFormSchema),
  });

  const loadPermissions = React.useCallback(async () => {
    if (!roleId) return;
    setIsLoading(true);
    const fetchedPermissions = await getPermissionsForRole(roleId);
    setPermissions(fetchedPermissions);
    setIsLoading(false);
  }, [roleId]);

  React.useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  const handleCreate = async () => {
    const fetchedAllPermissions = await getAllPermissions();
    setAllPermissions(fetchedAllPermissions);
    form.reset({ permission_id: '' });
    setSubmissionError(null);
    setIsDialogOpen(true);
  };

  const handleDelete = (permission: Permission) => {
    setDeletingPermission(permission);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingPermission) return;
    try {
      await deletePermissionFromRole(roleId, deletingPermission.id);
      toast({
        title: t('PermissionsPage.toast.success'),
        description: t('PermissionsPage.toast.deleteSuccess'),
      });
      setIsDeleteDialogOpen(false);
      setDeletingPermission(null);
      loadPermissions();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('PermissionsPage.toast.errorTitle'),
        description: error instanceof Error ? error.message : t('PermissionsPage.toast.genericError'),
      });
    }
  };

  const onSubmit = async (values: RolePermissionFormValues) => {
    setSubmissionError(null);
    try {
      await assignPermissionToRole(roleId, values.permission_id);
      toast({
        title: t('PermissionsPage.toast.success'),
        description: t('PermissionsPage.toast.createSuccessTitle'),
      });
      setIsDialogOpen(false);
      loadPermissions();
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : t('PermissionsPage.toast.genericError'));
    }
  };

  const columns: ColumnDef<Permission>[] = [
    {
      accessorKey: 'name',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('PermissionsPage.columns.name')} />,
    },
    {
      accessorKey: 'description',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('PermissionsPage.columns.description')} />,
    },
    {
      accessorKey: 'action',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('PermissionsPage.columns.action')} />,
      cell: ({ row }) => <Badge variant="secondary" className="capitalize">{row.getValue('action')}</Badge>,
    },
    {
      accessorKey: 'resource',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('PermissionsPage.columns.resource')} />,
      cell: ({ row }) => <Badge variant="outline" className="capitalize">{row.getValue('resource')}</Badge>,
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const permission = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleDelete(permission)} className="text-destructive">
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

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
            data={permissions}
            filterColumnId='name'
            filterPlaceholder={t('PermissionsPage.filterPlaceholder')}
            onCreate={handleCreate}
            onRefresh={loadPermissions}
            isRefreshing={isLoading}
            columnTranslations={{
              name: t('PermissionsPage.columns.name'),
              description: t('PermissionsPage.columns.description'),
              action: t('PermissionsPage.columns.action'),
              resource: t('PermissionsPage.columns.resource'),
            }}
          />
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Permission</DialogTitle>
            <DialogDescription>Select a permission to assign to this role.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
              {submissionError && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{submissionError}</AlertDescription>
                </Alert>
              )}
              <FormField
                control={form.control}
                name="permission_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Permission</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            className={cn(
                              "w-full justify-between",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value
                              ? allPermissions.find(p => p.id === field.value)?.name
                              : "Select a permission"}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                        <Command>
                          <CommandInput placeholder="Search permission..." />
                          <CommandEmpty>No permission found.</CommandEmpty>
                          <CommandList>
                            <CommandGroup>
                              {allPermissions.map((permission) => (
                                <CommandItem
                                  value={permission.name}
                                  key={permission.id}
                                  onSelect={() => {
                                    form.setValue("permission_id", permission.id)
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      permission.id === field.value
                                        ? "opacity-100"
                                        : "opacity-0"
                                    )}
                                  />
                                  {permission.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setIsDialogOpen(false)}>{t('PermissionsPage.dialog.cancel')}</Button>
                <Button type="submit">{t('PermissionsPage.dialog.create')}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the permission "{deletingPermission?.name}" from the role. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('PermissionsPage.deleteDialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">{t('PermissionsPage.deleteDialog.confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
