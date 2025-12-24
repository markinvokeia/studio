
'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { User, UserRole } from '@/lib/types';
import { cn } from '@/lib/utils';
import { api } from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnDef } from '@tanstack/react-table';
import { AlertTriangle, Check, ChevronsUpDown, MoreHorizontal } from 'lucide-react';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';

const userRoleFormSchema = z.object({
  user_id: z.string().min(1, 'User is required'),
});

type UserRoleFormValues = z.infer<typeof userRoleFormSchema>;

async function getUsersForRole(roleId: string): Promise<UserRole[]> {
  if (!roleId) return [];
  try {
    const data = await api.get(API_ROUTES.ROLE_USERS, { role_id: roleId });
    const usersData = Array.isArray(data) ? data : (data.role_users || data.data || data.result || []);

    return usersData.map((apiUser: any) => ({
      user_role_id: apiUser.user_role_id,
      id: apiUser.user_id ? String(apiUser.user_id) : `usr_${Math.random().toString(36).substr(2, 9)}`,
      name: apiUser.name || 'No Name',
      email: apiUser.email || 'no-email@example.com',
      is_active: apiUser.is_active !== undefined ? apiUser.is_active : true,
    }));
  } catch (error) {
    console.error("Failed to fetch role users:", error);
    return [];
  }
}

async function getAllUsers(): Promise<User[]> {
  try {
    const data = await api.get(API_ROUTES.USERS);
    const usersData = (Array.isArray(data) && data.length > 0 && data[0].data) ? data[0].data : (data.data || []);
    return usersData.map((u: any) => ({ id: String(u.id), name: u.name, email: u.email, phone_number: u.phone_number, is_active: u.is_active, avatar: u.avatar }));
  } catch (error) {
    console.error("Failed to fetch all users:", error);
    return [];
  }
}

async function assignUserToRole(roleId: string, userId: string) {
  return await api.post(API_ROUTES.ROLE_USERS_UPSERT, { role_id: roleId, user_id: userId });
}

async function deleteUserFromRole(roleId: string, userId: string) {
  return await api.delete(API_ROUTES.ROLE_USERS_DELETE, { role_id: roleId, user_id: userId });
}

interface RoleUsersProps {
  roleId: string;
}

export function RoleUsers({ roleId }: RoleUsersProps) {
  const [users, setUsers] = React.useState<UserRole[]>([]);
  const [allUsers, setAllUsers] = React.useState<User[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [deletingUser, setDeletingUser] = React.useState<UserRole | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [submissionError, setSubmissionError] = React.useState<string | null>(null);
  const { toast } = useToast();

  const form = useForm<UserRoleFormValues>({
    resolver: zodResolver(userRoleFormSchema),
  });

  const loadUsers = React.useCallback(async () => {
    if (!roleId) return;
    setIsLoading(true);
    const fetchedUsers = await getUsersForRole(roleId);
    setUsers(fetchedUsers);
    setIsLoading(false);
  }, [roleId]);

  React.useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleCreate = async () => {
    const fetchedAllUsers = await getAllUsers();
    setAllUsers(fetchedAllUsers);
    form.reset({ user_id: '' });
    setSubmissionError(null);
    setIsDialogOpen(true);
  };

  const handleDelete = (user: UserRole) => {
    setDeletingUser(user);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingUser) return;
    try {
      await deleteUserFromRole(roleId, deletingUser.id);
      toast({
        title: "User Removed",
        description: `User "${deletingUser.name}" has been removed from this role.`,
      });
      setIsDeleteDialogOpen(false);
      setDeletingUser(null);
      loadUsers();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : "Could not remove user.",
      });
    }
  };

  const onSubmit = async (values: UserRoleFormValues) => {
    setSubmissionError(null);
    try {
      await assignUserToRole(roleId, values.user_id);
      toast({
        title: "User Assigned",
        description: "The user has been successfully assigned to the role.",
      });
      setIsDialogOpen(false);
      loadUsers();
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : "An unexpected error occurred.");
    }
  };

  const columns: ColumnDef<UserRole>[] = [
    {
      accessorKey: 'name',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{row.getValue('name')}</span>
        </div>
      ),
    },
    {
      accessorKey: 'email',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Email" />,
    },
    {
      accessorKey: 'is_active',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => (
        <Badge variant={row.getValue('is_active') ? 'default' : 'outline'}>
          {row.getValue('is_active') ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const user = row.original;
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
              <DropdownMenuItem onClick={() => handleDelete(user)} className="text-destructive">
                Remove from Role
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
            data={users}
            filterColumnId='name'
            filterPlaceholder='Filter by user...'
            onCreate={handleCreate}
            onRefresh={loadUsers}
            isRefreshing={isLoading}
          />
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign User to Role</DialogTitle>
            <DialogDescription>Select a user to assign to this role.</DialogDescription>
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
                name="user_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>User</FormLabel>
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
                              ? allUsers.find(u => u.id === field.value)?.name
                              : "Select a user"}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                        <Command>
                          <CommandInput placeholder="Search user..." />
                          <CommandEmpty>No user found.</CommandEmpty>
                          <CommandList>
                            <CommandGroup>
                              {allUsers.map((user) => (
                                <CommandItem
                                  value={user.name}
                                  key={user.id}
                                  onSelect={() => {
                                    form.setValue("user_id", user.id)
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      user.id === field.value ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {user.name}
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
                <Button type="submit">Assign User</Button>
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
              This will remove the user "{deletingUser?.name}" from the role. This action cannot be undone.
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
