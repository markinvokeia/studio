'use client';

import { RolePermissions } from '@/components/roles/role-permissions';
import { RoleUsers } from '@/components/roles/role-users';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { Role } from '@/lib/types';
import { cn } from '@/lib/utils';
import { api } from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { RowSelectionState } from '@tanstack/react-table';
import { AlertTriangle, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { RolesColumnsWrapper } from './columns';
import { TwoPanelLayout } from '@/components/layout/two-panel-layout';

const roleFormSchema = (t: (key: string) => string) => z.object({
  id: z.string().optional(),
  name: z.string().min(1, t('nameRequired')),
});

type RoleFormValues = z.infer<ReturnType<typeof roleFormSchema>>;

async function getRoles(): Promise<Role[]> {
  try {
    const data = await api.get(API_ROUTES.ROLES);
    const rolesData = Array.isArray(data) ? data : (data.roles || data.data || data.result || []);

    return rolesData.map((apiRole: any) => ({
      id: apiRole.id ? String(apiRole.id) : `rol_${Math.random().toString(36).substr(2, 9)}`,
      name: apiRole.name || 'No Name',
    }));
  } catch (error) {
    console.error("Failed to fetch roles:", error);
    return [];
  }
}

async function upsertRole(roleData: RoleFormValues) {
  return await api.post(API_ROUTES.ROLES_UPSERT, roleData);
}

async function deleteRole(id: string) {
  return await api.delete(API_ROUTES.ROLES_DELETE, { id });
}


export default function RolesPage() {
  const t = useTranslations('RolesPage');
  const tValidation = useTranslations('RolesPage.validation');

  const [roles, setRoles] = React.useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = React.useState<Role | null>(null);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [editingRole, setEditingRole] = React.useState<Role | null>(null);
  const [deletingRole, setDeletingRole] = React.useState<Role | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [submissionError, setSubmissionError] = React.useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const { toast } = useToast();

  const form = useForm<RoleFormValues>({
    resolver: zodResolver(roleFormSchema(tValidation)),
    defaultValues: { name: '' },
  });

  const loadRoles = React.useCallback(async () => {
    setIsRefreshing(true);
    const fetchedRoles = await getRoles();
    setRoles(fetchedRoles);
    setIsRefreshing(false);
  }, []);

  React.useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  const handleCreate = () => {
    setEditingRole(null);
    form.reset({ name: '' });
    setSubmissionError(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (role: Role) => {
    setEditingRole(role);
    form.reset({ id: role.id, name: role.name });
    setSubmissionError(null);
    setIsDialogOpen(true);
  };

  const handleDelete = (role: Role) => {
    setDeletingRole(role);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingRole) return;
    try {
      await deleteRole(deletingRole.id);
      toast({
        title: t('toast.deleteSuccess'),
        description: t('toast.deleteDescription', { name: deletingRole.name }),
      });
      setIsDeleteDialogOpen(false);
      setDeletingRole(null);
      loadRoles();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('toast.error'),
        description: error instanceof Error ? error.message : t('toast.deleteError'),
      });
    }
  };

  const handleRowSelectionChange = (selectedRows: Role[]) => {
    const role = selectedRows.length > 0 ? selectedRows[0] : null;
    setSelectedRole(role);
  };

  const handleCloseDetails = () => {
    setSelectedRole(null);
    setRowSelection({});
  };

  const onSubmit = async (values: RoleFormValues) => {
    setSubmissionError(null);
    try {
      await upsertRole(values);
      toast({
        title: editingRole ? t('toast.editSuccess') : t('toast.createSuccess'),
        description: t('toast.successDescription', { name: values.name }),
      });
      setIsDialogOpen(false);
      loadRoles();
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : t('toast.saveError'));
    }
  };

  const rolesColumns = RolesColumnsWrapper({ onEdit: handleEdit, onDelete: handleDelete });


  return (
    <>
      <TwoPanelLayout
        isRightPanelOpen={!!selectedRole}
        leftPanel={
          <Card className="h-full flex flex-col">
            <CardHeader className="flex-none">
              <CardTitle>{t('title')}</CardTitle>
              <CardDescription>{t('description')}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden flex flex-col min-h-0">
              <DataTable
                columns={rolesColumns}
                data={roles}
                filterColumnId="name"
                filterPlaceholder={t('filterPlaceholder')}
                onRowSelectionChange={handleRowSelectionChange}
                enableSingleRowSelection={true}
                onCreate={handleCreate}
                onRefresh={loadRoles}
                isRefreshing={isRefreshing}
                rowSelection={rowSelection}
                setRowSelection={setRowSelection}
              />
            </CardContent>
          </Card>
        }
        rightPanel={
          selectedRole && (
            <Card className="h-full flex flex-col">
              <CardHeader className="flex flex-row items-start justify-between flex-none">
                <div>
                  <CardTitle>{t('detailsFor', { name: selectedRole.name })}</CardTitle>
                  <CardDescription>Role ID: {selectedRole.id}</CardDescription>
                </div>
                <Button variant="destructive-ghost" size="icon" onClick={handleCloseDetails}>
                  <X className="h-5 w-5" />
                  <span className="sr-only">{t('close')}</span>
                </Button>
              </CardHeader>
              <CardContent className="flex-1 overflow-auto">
                <Tabs defaultValue="users" className="w-full h-full flex flex-col">
                  <TabsList>
                    <TabsTrigger value="users">{t('tabs.users')}</TabsTrigger>
                    <TabsTrigger value="permissions">{t('tabs.permissions')}</TabsTrigger>
                  </TabsList>
                  <div className="flex-1 overflow-auto mt-4">
                    <TabsContent value="users" className="m-0">
                      <RoleUsers roleId={selectedRole.id} />
                    </TabsContent>
                    <TabsContent value="permissions" className="m-0">
                      <RolePermissions roleId={selectedRole.id} />
                    </TabsContent>
                  </div>
                </Tabs>
              </CardContent>
            </Card>
          )
        }
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRole ? t('createDialog.editTitle') : t('createDialog.title')}</DialogTitle>
            <DialogDescription>
              {editingRole ? t('createDialog.editDescription') : t('createDialog.description')}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
              {submissionError && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>{t('toast.error')}</AlertTitle>
                  <AlertDescription>{submissionError}</AlertDescription>
                </Alert>
              )}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('createDialog.nameLabel')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('createDialog.namePlaceholder')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setIsDialogOpen(false)}>{t('createDialog.cancel')}</Button>
                <Button type="submit">{editingRole ? t('createDialog.editSave') : t('createDialog.save')}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteDialog.description', { name: deletingRole?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('deleteDialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">{t('deleteDialog.confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
