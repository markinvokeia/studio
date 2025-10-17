
'use client';

import * as React from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Permission } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandInput, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { AlertTriangle } from 'lucide-react';


const rolePermissionFormSchema = z.object({
  permission_id: z.string().min(1, 'Permission is required'),
});

type RolePermissionFormValues = z.infer<typeof rolePermissionFormSchema>;

async function getPermissionsForRole(roleId: string): Promise<Permission[]> {
  if (!roleId) return [];
  try {
    const response = await fetch(`https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/role_permissions?role_id=${roleId}`, {
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
        const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/permissions');
        if (!response.ok) throw new Error('Failed to fetch permissions');
        const data = await response.json();
        const permissionsData = Array.isArray(data) ? data : (data.permissions || data.data || []);
        return permissionsData.map((p: any) => ({ id: String(p.id), name: p.name, action: p.action, resource: p.resource, description: p.description }));
    } catch (error) {
        console.error("Failed to fetch all permissions:", error);
        return [];
    }
}

async function assignPermissionToRole(roleId: string, permissionId: string) {
    const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/role_permisos/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role_id: roleId, permission_id: permissionId }),
    });
    if (!response.ok) throw new Error('Failed to assign permission');
    return response.json();
}

async function deletePermissionFromRole(roleId: string, permissionId: string) {
    const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/role_permisos/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role_id: roleId, permission_id: permissionId }),
    });
    if (!response.ok) throw new Error('Failed to delete permission');
    return response.json();
}

interface RolePermissionsProps {
  roleId: string;
}

export function RolePermissions({ roleId }: RolePermissionsProps) {
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
            title: "Permission Removed",
            description: `Permission "${deletingPermission.name}" has been removed from this role.`,
        });
        setIsDeleteDialogOpen(false);
        setDeletingPermission(null);
        loadPermissions();
    } catch (error) {
        toast({
            variant: 'destructive',
            title: 'Error',
            description: error instanceof Error ? error.message : "Could not remove permission.",
        });
    }
  };

  const onSubmit = async (values: RolePermissionFormValues) => {
    setSubmissionError(null);
    try {
      await assignPermissionToRole(roleId, values.permission_id);
      toast({
        title: "Permission Assigned",
        description: "The permission has been successfully assigned to the role.",
      });
      setIsDialogOpen(false);
      loadPermissions();
    } catch (error) {
        setSubmissionError(error instanceof Error ? error.message : "An unexpected error occurred.");
    }
  };

  const columns: ColumnDef<Permission>[] = [
    {
      accessorKey: 'name',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Permission" />,
    },
    {
      accessorKey: 'description',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Description" />,
    },
    {
      accessorKey: 'action',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Action" />,
      cell: ({ row }) => <Badge variant="secondary" className="capitalize">{row.getValue('action')}</Badge>,
    },
    {
      accessorKey: 'resource',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Resource" />,
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
            filterPlaceholder='Filter by permission...'
            onCreate={handleCreate}
            onRefresh={loadPermissions}
            isRefreshing={isLoading}
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
                <Button variant="outline" type="button" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button type="submit">Assign Permission</Button>
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
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </>
  );
}
