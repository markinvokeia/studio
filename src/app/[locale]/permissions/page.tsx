'use client';

import { TwoPanelLayout, useNarrowMode } from '@/components/layout/two-panel-layout';
import { DataCard } from '@/components/ui/data-card';
import { PermissionUsers } from '@/components/permissions/permission-users';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import {
  Dialog,
  DialogBody,
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
import { SYSTEM_PERMISSIONS } from '@/constants/permissions';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { Permission } from '@/lib/types';
import { api } from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { RowSelectionState } from '@tanstack/react-table';
import { AlertTriangle, Shield, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { PermissionsColumnsWrapper } from './columns';
import { useDeepLink } from '@/hooks/use-deep-link';

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

function PermissionsTableNarrow({ columns, permissions, selectedPermission, onRowSelectionChange, onCreate, onRefresh, isRefreshing, rowSelection, setRowSelection, filterPlaceholder }: {
  columns: any[]; permissions: any[]; selectedPermission: any;
  onRowSelectionChange: (rows: any[]) => void; onCreate?: () => void; onRefresh: () => void; isRefreshing: boolean;
  rowSelection: RowSelectionState; setRowSelection: React.Dispatch<React.SetStateAction<RowSelectionState>>;
  filterPlaceholder: string;
}) {
  const { isNarrow: panelNarrow } = useNarrowMode();
  const isNarrow = !!selectedPermission || panelNarrow;
  return (
    <DataTable
      columns={columns}
      data={permissions}
      filterColumnId="name"
      filterPlaceholder={filterPlaceholder}
      onRowSelectionChange={onRowSelectionChange}
      enableSingleRowSelection={true}
      onCreate={onCreate}
      onRefresh={onRefresh}
      isRefreshing={isRefreshing}
      rowSelection={rowSelection}
      setRowSelection={setRowSelection}
      isNarrow={isNarrow}
      renderCard={(row: any) => (
        <DataCard
          title={row.name || ''}
          subtitle={row.code || row.description || ''}
          isSelected={selectedPermission?.id === row.id}
          showArrow
          onClick={() => onRowSelectionChange([row])}
        />
      )}
    />
  );
}

export default function PermissionsPage() {
  const t = useTranslations('PermissionsPage');
  const tValidation = useTranslations('PermissionsPage.validation');
  const { hasPermission } = usePermissions();

  // Permission checks
  const canViewList = hasPermission(SYSTEM_PERMISSIONS.PERMISSIONS_VIEW_LIST);
  const canCreate = hasPermission(SYSTEM_PERMISSIONS.PERMISSIONS_CREATE);
  const canUpdate = hasPermission(SYSTEM_PERMISSIONS.PERMISSIONS_UPDATE);
  const canDelete = hasPermission(SYSTEM_PERMISSIONS.PERMISSIONS_DELETE);
  const canViewImpact = hasPermission(SYSTEM_PERMISSIONS.PERMISSIONS_VIEW_IMPACT);

  const [permissions, setPermissions] = React.useState<Permission[]>([]);
  const [selectedPermission, setSelectedPermission] = React.useState<Permission | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
  const [deletingPermission, setDeletingPermission] = React.useState<Permission | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);
  const [detailError, setDetailError] = React.useState<string | null>(null);
  const [isSavingDetail, setIsSavingDetail] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const { toast } = useToast();

  // Form for create dialog
  const createForm = useForm<PermissionFormValues>({
    resolver: zodResolver(permissionFormSchema(tValidation)),
    defaultValues: { name: '', description: '', action: '', resource: '' },
  });

  // Form for inline detail edit
  const detailForm = useForm<PermissionFormValues>({
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

  // Populate detail form when selection changes
  React.useEffect(() => {
    if (selectedPermission) {
      detailForm.reset({
        id: selectedPermission.id,
        name: selectedPermission.name,
        description: selectedPermission.description || '',
        action: selectedPermission.action || '',
        resource: selectedPermission.resource || '',
      });
      setDetailError(null);
    }
  }, [selectedPermission, detailForm]);

  const handleCreate = () => {
    if (!canCreate) return;
    createForm.reset({ name: '', description: '', action: '', resource: '' });
    setCreateError(null);
    setIsCreateDialogOpen(true);
  };

  const handleDelete = (permission: Permission) => {
    if (!canDelete) return;
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
      if (selectedPermission?.id === deletingPermission.id) {
        setSelectedPermission(null);
        setRowSelection({});
      }
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

  const onCreateSubmit = async (values: PermissionFormValues) => {
    setCreateError(null);
    try {
      await upsertPermission(values);
      toast({
        title: t('toast.createSuccess'),
        description: t('toast.successDescription', { name: values.name }),
      });
      setIsCreateDialogOpen(false);
      loadPermissions();
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : t('toast.genericError'));
    }
  };

  const onDetailSubmit = async (values: PermissionFormValues) => {
    setDetailError(null);
    setIsSavingDetail(true);
    try {
      await upsertPermission(values);
      toast({
        title: t('toast.editSuccess'),
        description: t('toast.successDescription', { name: values.name }),
      });
      setPermissions(prev => prev.map(p => p.id === values.id ? { ...p, ...values } : p));
      setSelectedPermission(prev => prev ? { ...prev, ...values } : prev);
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : t('toast.genericError'));
    } finally {
      setIsSavingDetail(false);
    }
  };

  const permissionsColumns = PermissionsColumnsWrapper({ onDelete: handleDelete, canDelete: canDelete });

  const [activeTab, setActiveTab] = React.useState('details');
  const [deepLinkFilter, setDeepLinkFilter] = React.useState('');
  const deepLinkItems = deepLinkFilter
    ? permissions.filter(p => p.name.toLowerCase().includes(deepLinkFilter.toLowerCase()))
    : permissions;

  useDeepLink<Permission>({
    tabMap: { 'Detalles': 'details', 'Usuarios': 'users' },
    onFilter: (v) => setDeepLinkFilter(v),
    items: deepLinkItems,
    allItems: permissions,
    isLoading: isRefreshing,
    onAutoSelect: (perm) => handleRowSelectionChange([perm]),
    setRowSelection,
    onTabChange: (id) => setActiveTab(id),
    actionMap: { 'Crear': () => handleCreate() },
    filterDelay: 300,
  });

  const actionOptions = ['create', 'read', 'update', 'delete', 'manage'];

  return (
    <>
      <TwoPanelLayout
        isRightPanelOpen={!!selectedPermission}
        leftPanel={
          <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm">
            <CardHeader className="flex-none p-4">
              <div className="flex items-start gap-3">
                <div className="header-icon-circle mt-0.5">
                  <Shield className="h-5 w-5" />
                </div>
                <div className="flex flex-col">
                  <CardTitle className="text-lg">{t('title')}</CardTitle>
                  <CardDescription className="text-xs">{t('description')}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden flex flex-col min-h-0 p-4 bg-card">
              <PermissionsTableNarrow
                columns={permissionsColumns}
                permissions={permissions}
                selectedPermission={selectedPermission}
                onRowSelectionChange={handleRowSelectionChange}
                onCreate={canCreate ? handleCreate : undefined}
                onRefresh={loadPermissions}
                isRefreshing={isRefreshing}
                rowSelection={rowSelection}
                setRowSelection={setRowSelection}
                filterPlaceholder={t('filterPlaceholder')}
              />
            </CardContent>
          </Card>
        }
        rightPanel={
          selectedPermission && (
            <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm">
              <CardHeader className="flex flex-row items-start justify-between flex-none p-4 pb-2">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="header-icon-circle mt-0.5">
                    <Shield className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1 flex flex-col text-left">
                    <CardTitle className="text-lg lg:text-xl truncate">{t('detailsFor', { name: selectedPermission.name })}</CardTitle>
                    <CardDescription className="text-xs">{t('permissionId')}: {selectedPermission.id}</CardDescription>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive transition-colors" onClick={handleCloseDetails}>
                  <X className="h-5 w-5" />
                  <span className="sr-only">{t('close')}</span>
                </Button>
              </CardHeader>
              <CardContent className="flex-1 overflow-auto p-4 pt-0">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full flex flex-col">
                  <TabsList>
                    <TabsTrigger value="details">{t('tabs.details')}</TabsTrigger>
                    <TabsTrigger value="users">{t('tabs.users')}</TabsTrigger>
                  </TabsList>
                  <div className="flex-1 overflow-auto mt-4">
                    <TabsContent value="details" className="m-0">
                      <Form {...detailForm}>
                        <form onSubmit={detailForm.handleSubmit(onDetailSubmit)} className="space-y-4">
                          {detailError && (
                            <Alert variant="destructive">
                              <AlertTriangle className="h-4 w-4" />
                              <AlertTitle>{t('toast.error')}</AlertTitle>
                              <AlertDescription>{detailError}</AlertDescription>
                            </Alert>
                          )}
                          <FormField
                            control={detailForm.control}
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
                            control={detailForm.control}
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
                            control={detailForm.control}
                            name="action"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('dialog.action')}</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger><SelectValue placeholder={t('dialog.selectAction')} /></SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {actionOptions.map(a => (
                                      <SelectItem key={a} value={a}>{t(`dialog.actions.${a}`)}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={detailForm.control}
                            name="resource"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('dialog.resource')}</FormLabel>
                                <FormControl><Input placeholder={t('dialog.resourcePlaceholder')} {...field} /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          {canUpdate && (
                            <div className="flex gap-2 pt-2">
                              <Button type="submit" disabled={isSavingDetail}>
                                {isSavingDetail ? t('dialog.save') + '...' : t('dialog.save')}
                              </Button>
                            </div>
                          )}
                        </form>
                      </Form>
                    </TabsContent>
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

      {/* Create dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('dialog.title')}</DialogTitle>
            <DialogDescription>{t('dialog.description')}</DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="flex flex-col flex-1 overflow-hidden">
              <DialogBody className="space-y-4 px-6 py-4">
                {createError && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>{t('toast.error')}</AlertTitle>
                    <AlertDescription>{createError}</AlertDescription>
                  </Alert>
                )}
                <FormField
                  control={createForm.control}
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
                  control={createForm.control}
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
                  control={createForm.control}
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
                  control={createForm.control}
                  name="resource"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('dialog.resource')}</FormLabel>
                      <FormControl><Input placeholder={t('dialog.resourcePlaceholder')} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </DialogBody>
              <DialogFooter>
                <Button type="submit">{t('dialog.create')}</Button>
                <Button variant="outline" type="button" onClick={() => setIsCreateDialogOpen(false)}>{t('dialog.cancel')}</Button>
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
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">{t('deleteDialog.confirm')}</AlertDialogAction>
            <AlertDialogCancel>{t('deleteDialog.cancel')}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
