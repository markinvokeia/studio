
'use client';

import { PermissionUsers } from '@/components/permissions/permission-users';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { Permission } from '@/lib/types';
import { cn } from '@/lib/utils';
import { api } from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { RowSelectionState } from '@tanstack/react-table';
import { AlertTriangle, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { PermissionsColumnsWrapper } from './columns';
import { TwoPanelLayout } from '@/components/layout/two-panel-layout';

const permissionFormSchema = (t: (key: string) => string) => z.object({
  id: z.string().optional(),
  name: z.string().min(1, t('nameRequired')),
  description: z.string().optional(),
  action: z.string().min(1, t('actionRequired')),
  resource: z.string().min(1, t('resourceRequired')),
});

type PermissionFormValues = z.infer<ReturnType<typeof permissionFormSchema>>;

async function getPermissions(): Promise<Permission[]> {
  try {
    const data = await api.get(API_ROUTES.PERMISSIONS);
    const permissionsData = Array.isArray(data) ? data : (data.permissions || data.data || data.result || []);

    return permissionsData.map((apiPerm: any) => ({
      id: apiPerm.id ? String(apiPerm.id) : `perm_${Math.random().toString(36).substr(2, 9)}`,
      name: apiPerm.name || 'No Name',
      action: apiPerm.action || 'No Action',
      resource: apiPerm.resource || 'No Resource',
      description: apiPerm.description || 'No description',
    }));
  } catch (error) {
    console.error("Failed to fetch permissions:", error);
    return [];
  }
}

async function upsertPermission(permissionData: PermissionFormValues) {
  return await api.post(API_ROUTES.PERMISSIONS_UPSERT, permissionData);
}

async function deletePermission(id: string) {
  return await api.delete(API_ROUTES.PERMISSIONS_DELETE, { id });
}

export default function PermissionsPage() {
  const t = useTranslations('PermissionsPage');
  const tValidation = useTranslations('PermissionsPage.validation');
  const [permissions, setPermissions] = React.useState<Permission[]>([]);
  const [selectedPermission, setSelectedPermission] = React.useState<Permission | null>(null);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [editingPermission, setEditingPermission] = React.useState<Permission | null>(null);
  const [deletingPermission, setDeletingPermission] = React.useState<Permission | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [submissionError, setSubmissionError] = React.useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const { toast } = useToast();

  const form = useForm<PermissionFormValues>({
    resolver: zodResolver(permissionFormSchema(tValidation)),
    defaultValues: { name: '', description: '', action: '', resource: '' },
  });

  const loadPermissions = React.useCallback(async () => {
    setIsRefreshing(true);
    const fetchedPermissions = await getPermissions();
    setPermissions(fetchedPermissions);
    setIsRefreshing(false);
  }, []);

  React.useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  const handleCreate = () => {
    setEditingPermission(null);
    form.reset({ name: '', description: '', action: '', resource: '' });
    setSubmissionError(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (permission: Permission) => {
    setEditingPermission(permission);
    form.reset(permission);
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
      await deletePermission(deletingPermission.id);
      toast({
        title: t('toast.deleteSuccess'),
        description: t('toast.deleteSuccessDescription', { name: deletingPermission.name }),
      });
      setIsDeleteDialogOpen(false);
      setDeletingPermission(null);
      loadPermissions();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('toast.error'),
        description: error instanceof Error ? error.message : t('toast.deleteError'),
      });
    }
  };

  const handleRowSelectionChange = (selectedRows: Permission[]) => {
    const permission = selectedRows.length > 0 ? selectedRows[0] : null;
    setSelectedPermission(permission);
  };

  const handleCloseDetails = () => {
    setSelectedPermission(null);
    setRowSelection({});
  };

  const onSubmit = async (values: PermissionFormValues) => {
    setSubmissionError(null);
    try {
      await upsertPermission(values);
      toast({
        title: editingPermission ? t('toast.editSuccess') : t('toast.createSuccess'),
        description: t('toast.successDescription', { name: values.name }),
      });
      setIsDialogOpen(false);
      loadPermissions();
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : t('toast.genericError'));
    }
  };

  const permissionsColumns = PermissionsColumnsWrapper({ onEdit: handleEdit, onDelete: handleDelete });


  return (
    <>
      <TwoPanelLayout
        isRightPanelOpen={!!selectedPermission}
        leftPanel={
          <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm">
            <CardHeader className="bg-primary text-primary-foreground flex-none">
              <CardTitle>{t('title')}</CardTitle>
              <CardDescription className="text-primary-foreground/70">{t('description')}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden flex flex-col min-h-0 p-6 bg-background">
              <DataTable
                columns={permissionsColumns}
                data={permissions}
                filterColumnId="name"
                filterPlaceholder={t('filterPlaceholder')}
                onRowSelectionChange={handleRowSelectionChange}
                enableSingleRowSelection={true}
                onCreate={handleCreate}
                onRefresh={loadPermissions}
                isRefreshing={isRefreshing}
                rowSelection={rowSelection}
                setRowSelection={setRowSelection}
              />
            </CardContent>
          </Card>
        }
        rightPanel={
          selectedPermission && (
            <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm">
              <CardHeader className="flex flex-row items-start justify-between flex-none p-4 pb-2">
                <div>
                  <CardTitle className="text-lg lg:text-xl truncate">{t('detailsFor', { name: selectedPermission.name })}</CardTitle>
                  <CardDescription className="text-xs">{t('permissionId')}: {selectedPermission.id}</CardDescription>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive transition-colors" onClick={handleCloseDetails}>
                  <X className="h-5 w-5" />
                  <span className="sr-only">{t('close')}</span>
                </Button>
              </CardHeader>
              <CardContent className="flex-1 overflow-auto p-4 pt-0">
                <Tabs defaultValue="users" className="w-full h-full flex flex-col">
                  <TabsList>
                    <TabsTrigger value="users">{t('tabs.users')}</TabsTrigger>
                  </TabsList>
                  <div className="flex-1 overflow-auto mt-4">
                    <TabsContent value="users" className="m-0">
                      <PermissionUsers permissionId={selectedPermission.id} />
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
            <DialogTitle>{editingPermission ? t('dialog.editTitle') : t('dialog.title')}</DialogTitle>
            <DialogDescription>
              {editingPermission ? t('dialog.editDescription') : t('dialog.description')}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 px-6 py-4">
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
                    <FormLabel>{t('dialog.name')}</FormLabel>
                    <FormControl><Input placeholder={t('dialog.namePlaceholder')} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('dialog.descriptionLabel')}</FormLabel>
                    <FormControl><Input placeholder={t('dialog.descriptionPlaceholder')} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="action"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('dialog.action')}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder={t('dialog.selectAction')} /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="create">{t('dialog.actions.create')}</SelectItem>
                        <SelectItem value="read">{t('dialog.actions.read')}</SelectItem>
                        <SelectItem value="update">{t('dialog.actions.update')}</SelectItem>
                        <SelectItem value="delete">{t('dialog.actions.delete')}</SelectItem>
                        <SelectItem value="manage">{t('dialog.actions.manage')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="resource"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('dialog.resource')}</FormLabel>
                    <FormControl><Input placeholder={t('dialog.resourcePlaceholder')} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setIsDialogOpen(false)}>{t('dialog.cancel')}</Button>
                <Button type="submit">{editingPermission ? t('dialog.save') : t('dialog.create')}</Button>
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
              {t('deleteDialog.description', { name: deletingPermission?.name })}
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
