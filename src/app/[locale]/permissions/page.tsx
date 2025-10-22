
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { PermissionsColumnsWrapper } from './columns';
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Permission } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RowSelectionState } from '@tanstack/react-table';
import { X, AlertTriangle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PermissionUsers } from '@/components/permissions/permission-users';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useTranslations } from 'next-intl';

const permissionFormSchema = (t: (key: string) => string) => z.object({
  id: z.string().optional(),
  name: z.string().min(1, t('validation.nameRequired')),
  description: z.string().optional(),
  action: z.string().min(1, t('validation.actionRequired')),
  resource: z.string().min(1, t('validation.resourceRequired')),
});

type PermissionFormValues = z.infer<ReturnType<typeof permissionFormSchema>>;

async function getPermissions(): Promise<Permission[]> {
  try {
    const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/permissions', {
      method: 'GET',
      mode: 'cors',
      headers: {
        'Accept': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
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
    const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/permisos/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(permissionData),
    });
    const responseData = await response.json();
    if (!response.ok || (Array.isArray(responseData) && responseData[0]?.code >= 400)) {
        const message = Array.isArray(responseData) && responseData[0]?.message ? responseData[0].message : 'Failed to save permission';
        throw new Error(message);
    }
    return responseData;
}

async function deletePermission(id: string) {
    const response = await fetch('https://n8n-project-n8n.7ig1i3.easypanel.host/webhook/permisos/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
    });
     const responseData = await response.json();
    if (!response.ok || (Array.isArray(responseData) && responseData[0]?.code >= 400)) {
        const message = Array.isArray(responseData) && responseData[0]?.message ? responseData[0].message : 'Failed to delete permission';
        throw new Error(message);
    }
    return responseData;
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
            description: t('toast.deleteSuccessDescription', {name: deletingPermission.name}),
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
            description: t('toast.successDescription', {name: values.name}),
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
    <div className={cn("grid grid-cols-1 gap-4", selectedPermission ? "lg:grid-cols-5" : "lg:grid-cols-1")}>
        <div className={cn("transition-all duration-300", selectedPermission ? "lg:col-span-2" : "lg:col-span-5")}>
            <Card>
                <CardHeader>
                    <CardTitle>{t('title')}</CardTitle>
                    <CardDescription>{t('description')}</CardDescription>
                </CardHeader>
                <CardContent>
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
        </div>
        {selectedPermission && (
             <div className="lg:col-span-3">
                 <Card>
                    <CardHeader className="flex flex-row items-start justify-between">
                        <div>
                            <CardTitle>{t('detailsFor', {name: selectedPermission.name})}</CardTitle>
                            <CardDescription>{t('permissionId')}: {selectedPermission.id}</CardDescription>
                        </div>
                         <Button variant="destructive-ghost" size="icon" onClick={handleCloseDetails}>
                            <X className="h-5 w-5" />
                            <span className="sr-only">{t('close')}</span>
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <Tabs defaultValue="users" className="w-full">
                            <TabsList className="h-auto items-center justify-start flex-wrap">
                                <TabsTrigger value="users">{t('tabs.users')}</TabsTrigger>
                            </TabsList>
                            <TabsContent value="users">
                                <PermissionUsers permissionId={selectedPermission.id} />
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>
            </div>
        )}
    </div>

    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingPermission ? t('dialog.editTitle') : t('dialog.title')}</DialogTitle>
          <DialogDescription>
            {editingPermission ? t('dialog.editDescription') : t('dialog.description')}
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
                    {t('deleteDialog.description', {name: deletingPermission?.name})}
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
