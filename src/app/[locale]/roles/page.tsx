'use client';

import { TwoPanelLayout, useNarrowMode } from '@/components/layout/two-panel-layout';
import { DataCard } from '@/components/ui/data-card';
import { RolePermissions } from '@/components/roles/role-permissions';
import { RoleUsers } from '@/components/roles/role-users';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SYSTEM_PERMISSIONS } from '@/constants/permissions';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { Role } from '@/lib/types';
import { api } from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { RowSelectionState } from '@tanstack/react-table';
import { AlertTriangle, KeyRound, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { RolesColumnsWrapper } from './columns';
import { useDeepLink } from '@/hooks/use-deep-link';

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


function RolesTableNarrow({ columns, roles, selectedRole, onRowSelectionChange, onCreate, onRefresh, isRefreshing, rowSelection, setRowSelection, filterPlaceholder }: {
  columns: any[]; roles: any[]; selectedRole: any;
  onRowSelectionChange: (rows: any[]) => void; onCreate?: () => void; onRefresh: () => void; isRefreshing: boolean;
  rowSelection: RowSelectionState; setRowSelection: React.Dispatch<React.SetStateAction<RowSelectionState>>;
  filterPlaceholder: string;
}) {
  const { isNarrow } = useNarrowMode();
  return (
    <DataTable
      columns={columns}
      data={roles}
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
          subtitle={row.description || ''}
          isSelected={selectedRole?.id === row.id}
          showArrow
          onClick={() => onRowSelectionChange([row])}
        />
      )}
    />
  );
}

export default function RolesPage() {
  const t = useTranslations('RolesPage');
  const tValidation = useTranslations('RolesPage.validation');
  const { hasPermission } = usePermissions();

  // Permission checks
  const canViewList = hasPermission(SYSTEM_PERMISSIONS.ROLES_VIEW_LIST);
  const canCreate = hasPermission(SYSTEM_PERMISSIONS.ROLES_CREATE);
  const canUpdate = hasPermission(SYSTEM_PERMISSIONS.ROLES_UPDATE);
  const canDelete = hasPermission(SYSTEM_PERMISSIONS.ROLES_DELETE);
  const canViewUsers = hasPermission(SYSTEM_PERMISSIONS.ROLES_VIEW_USERS);
  const canAddUser = hasPermission(SYSTEM_PERMISSIONS.ROLES_ADD_USER);
  const canRemoveUser = hasPermission(SYSTEM_PERMISSIONS.ROLES_REMOVE_USER);
  const canViewPermissions = hasPermission(SYSTEM_PERMISSIONS.ROLES_VIEW_PERMISSIONS);
  const canAssignPermission = hasPermission(SYSTEM_PERMISSIONS.ROLES_ASSIGN_PERMISSION);
  const canRemovePermission = hasPermission(SYSTEM_PERMISSIONS.ROLES_REMOVE_PERMISSION);

  const [roles, setRoles] = React.useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = React.useState<Role | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
  const [deletingRole, setDeletingRole] = React.useState<Role | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);
  const [detailError, setDetailError] = React.useState<string | null>(null);
  const [isSavingDetail, setIsSavingDetail] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const { toast } = useToast();

  // Form for create dialog
  const createForm = useForm<RoleFormValues>({
    resolver: zodResolver(roleFormSchema(tValidation)),
    defaultValues: { name: '' },
  });

  // Form for inline detail edit
  const detailForm = useForm<RoleFormValues>({
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

  // Populate detail form when selection changes
  React.useEffect(() => {
    if (selectedRole) {
      detailForm.reset({ id: selectedRole.id, name: selectedRole.name });
      setDetailError(null);
    }
  }, [selectedRole, detailForm]);

  const handleCreate = () => {
    if (!canCreate) return;
    createForm.reset({ name: '' });
    setCreateError(null);
    setIsCreateDialogOpen(true);
  };

  const handleDelete = (role: Role) => {
    if (!canDelete) return;
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
      if (selectedRole?.id === deletingRole.id) {
        setSelectedRole(null);
        setRowSelection({});
      }
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

  const onCreateSubmit = async (values: RoleFormValues) => {
    setCreateError(null);
    try {
      await upsertRole(values);
      toast({
        title: t('toast.createSuccess'),
        description: t('toast.successDescription', { name: values.name }),
      });
      setIsCreateDialogOpen(false);
      loadRoles();
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : t('toast.saveError'));
    }
  };

  const onDetailSubmit = async (values: RoleFormValues) => {
    setDetailError(null);
    setIsSavingDetail(true);
    try {
      await upsertRole(values);
      toast({
        title: t('toast.editSuccess'),
        description: t('toast.successDescription', { name: values.name }),
      });
      // Update local state
      setRoles(prev => prev.map(r => r.id === values.id ? { ...r, name: values.name } : r));
      setSelectedRole(prev => prev ? { ...prev, name: values.name } : prev);
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : t('toast.saveError'));
    } finally {
      setIsSavingDetail(false);
    }
  };

  const rolesColumns = RolesColumnsWrapper({ onDelete: handleDelete, canDelete: canDelete });

  const [activeTab, setActiveTab] = React.useState('details');
  const [deepLinkFilter, setDeepLinkFilter] = React.useState('');
  const deepLinkItems = deepLinkFilter
    ? roles.filter(r => r.name.toLowerCase().includes(deepLinkFilter.toLowerCase()))
    : roles;

  useDeepLink<Role>({
    tabMap: { 'Detalles': 'details', 'Usuarios': 'users', 'Permisos': 'permissions' },
    onFilter: (v) => setDeepLinkFilter(v),
    items: deepLinkItems,
    allItems: roles,
    isLoading: isRefreshing,
    onAutoSelect: (role) => handleRowSelectionChange([role]),
    setRowSelection,
    onTabChange: (id) => setActiveTab(id),
    actionMap: { 'Crear': () => handleCreate() },
    filterDelay: 300,
  });

  return (
    <>
      <TwoPanelLayout
        isRightPanelOpen={!!selectedRole}
        leftPanel={
          <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm">
            <CardHeader className="flex-none p-4">
              <div className="flex items-start gap-3">
                <div className="header-icon-circle mt-0.5">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div className="flex flex-col text-left">
                  <CardTitle className="text-lg">{t('title')}</CardTitle>
                  <CardDescription className="text-xs">{t('description')}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden flex flex-col min-h-0 p-4 bg-card">
              <RolesTableNarrow
                columns={rolesColumns}
                roles={roles}
                selectedRole={selectedRole}
                onRowSelectionChange={handleRowSelectionChange}
                onCreate={canCreate ? handleCreate : undefined}
                onRefresh={loadRoles}
                isRefreshing={isRefreshing}
                rowSelection={rowSelection}
                setRowSelection={setRowSelection}
                filterPlaceholder={t('filterPlaceholder')}
              />
            </CardContent>
          </Card>
        }
        rightPanel={
          selectedRole && (
            <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm">
              <CardHeader className="flex flex-row items-start justify-between flex-none p-4 pb-2">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="header-icon-circle mt-0.5">
                    <KeyRound className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1 flex flex-col text-left">
                    <CardTitle className="text-lg lg:text-xl truncate">{t('detailsFor', { name: selectedRole.name })}</CardTitle>
                    <CardDescription className="text-xs">Role ID: {selectedRole.id}</CardDescription>
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
                    {canViewUsers && <TabsTrigger value="users">{t('tabs.users')}</TabsTrigger>}
                    {canViewPermissions && <TabsTrigger value="permissions">{t('tabs.permissions')}</TabsTrigger>}
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
                                <FormLabel>{t('createDialog.nameLabel')}</FormLabel>
                                <FormControl>
                                  <Input placeholder={t('createDialog.namePlaceholder')} {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          {canUpdate && (
                            <div className="flex gap-2 pt-2">
                              <Button type="submit" disabled={isSavingDetail}>
                                {isSavingDetail ? t('createDialog.editSave') + '...' : t('createDialog.editSave')}
                              </Button>
                            </div>
                          )}
                        </form>
                      </Form>
                    </TabsContent>
                    {canViewUsers && (
                      <TabsContent value="users" className="m-0">
                        <RoleUsers roleId={selectedRole.id} canAddUser={canAddUser} canRemoveUser={canRemoveUser} />
                      </TabsContent>
                    )}
                    {canViewPermissions && (
                      <TabsContent value="permissions" className="m-0">
                        <RolePermissions roleId={selectedRole.id} canAssignPermission={canAssignPermission} canRemovePermission={canRemovePermission} />
                      </TabsContent>
                    )}
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
            <DialogTitle>{t('createDialog.title')}</DialogTitle>
            <DialogDescription>{t('createDialog.description')}</DialogDescription>
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
                      <FormLabel>{t('createDialog.nameLabel')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('createDialog.namePlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </DialogBody>
              <DialogFooter>
                <Button type="submit">{t('createDialog.save')}</Button>
                <Button variant="outline" type="button" onClick={() => setIsCreateDialogOpen(false)}>{t('createDialog.cancel')}</Button>
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
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">{t('deleteDialog.confirm')}</AlertDialogAction>
            <AlertDialogCancel>{t('deleteDialog.cancel')}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
