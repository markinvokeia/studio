'use client';

import { TwoPanelLayout, useNarrowMode } from '@/components/layout/two-panel-layout';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';
import { DataCard } from '@/components/ui/data-card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { DataTable } from '@/components/ui/data-table';
import { DataTableAdvancedToolbar, FilterOption } from '@/components/ui/data-table-advanced-toolbar';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserLogs } from '@/components/users/user-logs';
import { UserRoles } from '@/components/users/user-roles';
import { SYSTEM_PERMISSIONS } from '@/constants/permissions';
import { API_ROUTES } from '@/constants/routes';
import { useLicenseStore } from '@/stores/license-store';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { Role, User, UserRole, UserRoleAssignment } from '@/lib/types';
import { api } from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnDef, ColumnFiltersState, PaginationState, RowSelectionState } from '@tanstack/react-table';
import { isValidPhoneNumber } from 'libphonenumber-js';
import { AlertTriangle, UserPlus, Users, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

// ---------------------------------------------------------------------------
// Types & helpers
// ---------------------------------------------------------------------------

type StaffRoleKey = 'receptionist' | 'admin';

// { receptionist: count of "recepcionista" roles, admin: count of "gerente" roles }
type RoleCounts = { receptionist: number; admin: number };

function getRoleKey(roleName: string): StaffRoleKey | null {
  const n = roleName.toLowerCase();
  if (n.includes('recepcionista')) return 'receptionist';
  if (n.includes('gerente')) return 'admin';
  return null;
}

function isStaffRole(roleName: string): boolean {
  const n = roleName.toLowerCase();
  return n.includes('recepcionista') || n.includes('gerente') || n.includes('administrador');
}

// Parse the flat array returned by GET /reports/users-by-role
// Response: [{ name: "recepcionista", count: "2" }, { name: "gerente", count: "1" }, ...]
function parseRoleCounts(data: unknown): RoleCounts {
  const rows: { name: string; count: string }[] = Array.isArray(data) ? data : [];
  const find = (key: string) => {
    const row = rows.find((r) => r.name?.toLowerCase().includes(key));
    return row ? Number(row.count) || 0 : 0;
  };
  return { receptionist: find('recepcionista'), admin: find('gerente') };
}

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const staffFormSchema = (t: (key: string) => string) =>
  z
    .object({
      id: z.string().optional(),
      name: z.string().min(1, { message: t('SystemUsersPage.createDialog.validation.nameRequired') }),
      email: z
        .string()
        .optional()
        .refine(
          (val) => {
            if (!val || val.trim() === '') return true;
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
          },
          { message: t('SystemUsersPage.createDialog.validation.emailInvalid') },
        ),
      phone: z
        .string()
        .optional()
        .refine(
          (val) => {
            if (!val || val.trim() === '') return true;
            return isValidPhoneNumber(val);
          },
          { message: t('SystemUsersPage.createDialog.validation.phoneInvalid') },
        ),
      identity_document: z
        .string()
        .regex(/^\d*$/, { message: t('SystemUsersPage.createDialog.validation.identityInvalid') })
        .max(10, { message: t('SystemUsersPage.createDialog.validation.identityMaxLength') })
        .optional()
        .or(z.literal('')),
      is_active: z.boolean().default(true),
      role_id: z.string().min(1, { message: t('StaffPage.createDialog.validation.roleRequired') }),
    })
    .refine(
      (data) => {
        const hasEmail = data.email && data.email.trim() !== '';
        const hasPhone = data.phone && data.phone.trim() !== '';
        return hasEmail || hasPhone;
      },
      {
        message: t('SystemUsersPage.createDialog.validation.emailOrPhoneRequired'),
        path: ['email'],
      },
    );

type StaffFormValues = z.infer<ReturnType<typeof staffFormSchema>>;

// Schema for the detail panel (no role_id required)
const detailFormSchema = (t: (key: string) => string) =>
  z
    .object({
      id: z.string().optional(),
      name: z.string().min(1, { message: t('SystemUsersPage.createDialog.validation.nameRequired') }),
      email: z
        .string()
        .optional()
        .refine(
          (val) => {
            if (!val || val.trim() === '') return true;
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
          },
          { message: t('SystemUsersPage.createDialog.validation.emailInvalid') },
        ),
      phone: z
        .string()
        .optional()
        .refine(
          (val) => {
            if (!val || val.trim() === '') return true;
            return isValidPhoneNumber(val);
          },
          { message: t('SystemUsersPage.createDialog.validation.phoneInvalid') },
        ),
      identity_document: z
        .string()
        .regex(/^\d*$/, { message: t('SystemUsersPage.createDialog.validation.identityInvalid') })
        .max(10, { message: t('SystemUsersPage.createDialog.validation.identityMaxLength') })
        .optional()
        .or(z.literal('')),
      is_active: z.boolean().default(true),
    })
    .refine(
      (data) => {
        const hasEmail = data.email && data.email.trim() !== '';
        const hasPhone = data.phone && data.phone.trim() !== '';
        return hasEmail || hasPhone;
      },
      {
        message: t('SystemUsersPage.createDialog.validation.emailOrPhoneRequired'),
        path: ['email'],
      },
    );

type DetailFormValues = z.infer<ReturnType<typeof detailFormSchema>>;

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

type GetUsersResponse = { users: User[]; total: number };

async function getUsers(
  pagination: PaginationState,
  searchQuery: string,
  onlyActive: boolean,
): Promise<GetUsersResponse> {
  try {
    const responseData = await api.get(API_ROUTES.USERS, {
      page: (pagination.pageIndex + 1).toString(),
      limit: pagination.pageSize.toString(),
      search: searchQuery,
      only_active: String(onlyActive),
      only_staff: 'true',
    });

    let usersData: any[] = [];
    let total = 0;

    if (Array.isArray(responseData) && responseData.length > 0) {
      const firstElement = responseData[0];
      if (firstElement.json && typeof firstElement.json === 'object') {
        usersData = firstElement.json.data || [];
        total = Number(firstElement.json.total) || usersData.length;
      } else if (firstElement.data) {
        usersData = firstElement.data;
        total = Number(firstElement.total) || usersData.length;
      }
    } else if (typeof responseData === 'object' && responseData !== null && responseData.data) {
      usersData = responseData.data;
      total = Number(responseData.total) || usersData.length;
    }

    const mappedUsers = usersData.map((apiUser: any) => ({
      id: String(apiUser.id),
      name: apiUser.name || '',
      email: apiUser.email || '',
      phone_number: apiUser.phone_number || '',
      is_active: apiUser.is_active !== undefined ? apiUser.is_active : true,
      identity_document: apiUser.identity_document,
      avatar:
        apiUser.avatar || `https://picsum.photos/seed/${apiUser.id || Math.random()}/40/40`,
    }));

    return { users: mappedUsers, total };
  } catch (error) {
    console.error('Failed to fetch users:', error);
    return { users: [], total: 0 };
  }
}

async function getAllRoles(): Promise<Role[]> {
  try {
    const data = await api.get(API_ROUTES.ROLES);
    const rolesData = Array.isArray(data) ? data : data.roles || data.data || [];
    return rolesData.map((role: any) => ({
      id: String(role.id),
      name: role.name,
      is_default: role.is_default ?? false,
    }));
  } catch (error) {
    console.error('Failed to fetch all roles:', error);
    return [];
  }
}

async function getRolesForUser(userId: string): Promise<UserRole[]> {
  if (!userId) return [];
  try {
    const data = await api.get(API_ROUTES.ROLES_USER_ROLES, { user_id: userId });
    const userRolesData = Array.isArray(data)
      ? Object.keys(data[0]).length === 0
        ? []
        : data
      : data.user_roles || data.data || data.result || [];
    return userRolesData.map((apiRole: any) => ({
      user_role_id: apiRole.user_role_id,
      role_id: apiRole.role_id,
      name: apiRole.name || 'Unknown Role',
      is_active: apiRole.is_active,
    }));
  } catch (error) {
    console.error('Failed to fetch user roles:', error);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Narrow table sub-component
// ---------------------------------------------------------------------------

function StaffTableNarrow({
  columns,
  users,
  selectedUser,
  onRowSelectionChange,
  onCreate,
  onRefresh,
  isRefreshing,
  rowSelection,
  setRowSelection,
  userCount,
  pagination,
  setPagination,
  columnFilters,
  setColumnFilters,
  filtersOptionList,
  handleClearFilters,
  canCreate,
  t,
}: {
  columns: ColumnDef<User>[];
  users: User[];
  selectedUser: User | null;
  onRowSelectionChange: (rows: User[]) => void;
  onCreate: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  rowSelection: RowSelectionState;
  setRowSelection: React.Dispatch<React.SetStateAction<RowSelectionState>>;
  userCount: number;
  pagination: PaginationState;
  setPagination: React.Dispatch<React.SetStateAction<PaginationState>>;
  columnFilters: ColumnFiltersState;
  setColumnFilters: React.Dispatch<React.SetStateAction<ColumnFiltersState>>;
  filtersOptionList: FilterOption[];
  handleClearFilters: () => void;
  canCreate: boolean;
  t: (k: string) => string;
}) {
  const { isNarrow: panelNarrow } = useNarrowMode();
  const isViewportNarrow = useViewportNarrow();
  const isNarrow = !!selectedUser || panelNarrow || isViewportNarrow;

  return (
    <DataTable
      columns={columns}
      data={users}
      filterColumnId="email"
      filterPlaceholder={t('StaffPage.filterPlaceholder')}
      onRowSelectionChange={onRowSelectionChange}
      enableSingleRowSelection={true}
      onCreate={onCreate}
      onRefresh={onRefresh}
      isRefreshing={isRefreshing}
      rowSelection={rowSelection}
      setRowSelection={setRowSelection}
      pageCount={Math.ceil(userCount / pagination.pageSize)}
      rowCount={userCount}
      pagination={pagination}
      onPaginationChange={setPagination}
      manualPagination={true}
      columnFilters={columnFilters}
      onColumnFiltersChange={setColumnFilters}
      isNarrow={isNarrow}
      renderCard={(row: User, _isSelected: boolean) => (
        <DataCard
          isSelected={_isSelected}
          title={row.name || ''}
          subtitle={row.email || row.phone_number || ''}
          avatar={row.name ? row.name.slice(0, 2).toUpperCase() : '?'}
          showArrow
          onClick={() => onRowSelectionChange([row])}
        />
      )}
      customToolbar={(table: any) => (
        <DataTableAdvancedToolbar
          table={table}
          filterPlaceholder={t('StaffPage.filterPlaceholder')}
          searchQuery={
            (columnFilters.find((f: any) => f.id === 'email')?.value as string) || ''
          }
          onSearchChange={(value: string) => {
            setPagination((prev) => ({ ...prev, pageIndex: 0 }));
            setColumnFilters((prev) => {
              const newFilters = prev.filter((f) => f.id !== 'email');
              if (value) newFilters.push({ id: 'email', value });
              return newFilters;
            });
          }}
          filters={filtersOptionList}
          onClearFilters={handleClearFilters}
          onCreate={canCreate ? onCreate : undefined}
          onRefresh={onRefresh}
          isRefreshing={isRefreshing}
          extraButtons={null}
        />
      )}
      columnTranslations={{
        name: t('StaffPage.columns.name'),
        email: t('StaffPage.columns.email'),
        phone_number: t('StaffPage.columns.phone'),
        is_active: t('StaffPage.columns.status'),
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function StaffPage() {
  const t = useTranslations();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { hasPermission } = usePermissions();
  const router = useRouter();
  const locale = useLocale();
  const tCommon = useTranslations('Common');
  const { toast } = useToast();

  // List state
  const [users, setUsers] = React.useState<User[]>([]);
  const [userCount, setUserCount] = React.useState(0);
  const [selectedUser, setSelectedUser] = React.useState<User | null>(null);
  const [selectedUserRoles, setSelectedUserRoles] = React.useState<UserRole[]>([]);
  const [isRolesLoading, setIsRolesLoading] = React.useState(false);

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [submissionError, setSubmissionError] = React.useState<string | null>(null);

  // Detail panel state
  const [detailError, setDetailError] = React.useState<string | null>(null);
  const [isSavingDetail, setIsSavingDetail] = React.useState(false);

  // Table state
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [showOnlyActive, setShowOnlyActive] = React.useState(true);

  // Staff roles & role counts for license enforcement
  const [staffRoles, setStaffRoles] = React.useState<Role[]>([]);
  const [roleCounts, setRoleCounts] = React.useState<RoleCounts | null>(null);

  // Tabs
  const [activeTab, setActiveTab] = React.useState('details');

  // Forms
  const form = useForm<StaffFormValues>({
    resolver: zodResolver(staffFormSchema(t)),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      identity_document: '',
      is_active: true,
      role_id: '',
    },
  });

  const detailForm = useForm<DetailFormValues>({
    resolver: zodResolver(detailFormSchema(t)),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      identity_document: '',
      is_active: true,
    },
  });

  // ---------------------------------------------------------------------------
  // Permissions
  // ---------------------------------------------------------------------------

  const canViewList = hasPermission(SYSTEM_PERMISSIONS.USERS_VIEW_LIST);
  const canCreate = hasPermission(SYSTEM_PERMISSIONS.USERS_CREATE);
  const canUpdate = hasPermission(SYSTEM_PERMISSIONS.USERS_UPDATE);
  const canToggleStatus = hasPermission(SYSTEM_PERMISSIONS.USERS_TOGGLE_STATUS);
  const canViewRoles = hasPermission(SYSTEM_PERMISSIONS.USERS_VIEW_ROLES);
  const canAssignRole = hasPermission(SYSTEM_PERMISSIONS.USERS_ASSIGN_ROLE);
  const canRemoveRole = hasPermission(SYSTEM_PERMISSIONS.USERS_REMOVE_ROLE);
  const canViewLogs = hasPermission(SYSTEM_PERMISSIONS.USERS_VIEW_LOGS);

  // Redirect if no access
  React.useEffect(() => {
    if (!isAuthLoading && user && !canViewList) {
      router.replace(`/${locale}/`);
    }
  }, [isAuthLoading, user, canViewList, router, locale]);

  if (isAuthLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <p>{tCommon('loading')}</p>
      </div>
    );
  }

  if (user && !canViewList) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-2xl font-bold">{tCommon('accessDenied')}</h2>
          <p className="text-muted-foreground mt-2">{tCommon('noPermission')}</p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Data loaders
  // ---------------------------------------------------------------------------

  const loadUsers = React.useCallback(async () => {
    setIsRefreshing(true);
    const searchQuery =
      (columnFilters.find((f) => f.id === 'email')?.value as string) || '';
    const { users: fetchedUsers, total } = await getUsers(pagination, searchQuery, showOnlyActive);
    setUsers(fetchedUsers);
    setUserCount(total);
    setIsRefreshing(false);
  }, [pagination, columnFilters, showOnlyActive]);

  const loadStaffRoles = React.useCallback(async () => {
    const allRoles = await getAllRoles();
    setStaffRoles(allRoles.filter((r) => isStaffRole(r.name)));
  }, []);

  const loadRoleCounts = React.useCallback(async () => {
    try {
      const data = await api.get(API_ROUTES.REPORTS.USERS_BY_ROLE);
      setRoleCounts(parseRoleCounts(data));
    } catch {
      // non-critical
    }
  }, []);

  const loadUserRoles = React.useCallback(async (userId: string) => {
    setIsRolesLoading(true);
    const roles = await getRolesForUser(userId);
    setSelectedUserRoles(roles);
    setIsRolesLoading(false);
  }, []);

  React.useEffect(() => {
    const debounce = setTimeout(() => {
      loadUsers();
    }, 500);
    return () => clearTimeout(debounce);
  }, [loadUsers]);

  React.useEffect(() => {
    if (selectedUser) {
      loadUserRoles(selectedUser.id);
    } else {
      setSelectedUserRoles([]);
    }
  }, [selectedUser, loadUserRoles]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleRowSelectionChange = (selectedRows: User[]) => {
    const u = selectedRows.length > 0 ? selectedRows[0] : null;
    setSelectedUser(u);
    if (u) {
      detailForm.reset({
        id: u.id,
        name: u.name,
        email: u.email || '',
        phone: u.phone_number || '',
        identity_document: u.identity_document || '',
        is_active: u.is_active,
      });
      setDetailError(null);
    }
  };

  const handleCloseDetails = () => {
    setSelectedUser(null);
    setRowSelection({});
  };

  const handleToggleActivate = async (targetUser: User) => {
    if (!canToggleStatus) return;
    try {
      await api.put(API_ROUTES.USERS_ACTIVATE, {
        user_id: targetUser.id,
        is_active: !targetUser.is_active,
      });
      toast({
        title: 'Success',
        description: `User ${targetUser.name} has been ${targetUser.is_active ? 'deactivated' : 'activated'}.`,
      });
      loadUsers();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not update user status.',
      });
      console.error(error);
    }
  };

  const handleCreate = async () => {
    if (!canCreate) return;

    // Fetch fresh role counts to validate license before opening dialog
    const { license } = useLicenseStore.getState();
    if (license) {
      try {
        const data = await api.get(API_ROUTES.REPORTS.USERS_BY_ROLE);
        const counts = parseRoleCounts(data);
        setRoleCounts(counts);

        const canAddRec = counts.receptionist < license.maxReceptionists;
        const canAddAdm = counts.admin < license.maxAdmins;

        if (!canAddRec && !canAddAdm) {
          const max = license.maxReceptionists + license.maxAdmins;
          toast({
            variant: 'destructive',
            title: t('License.enforcement.limitReachedTitle'),
            description: t('License.enforcement.userLimitReached', { max }),
          });
          return;
        }
      } catch {
        // non-critical, proceed to open dialog
      }
    }

    await loadStaffRoles();
    form.reset({
      name: '',
      email: '',
      phone: '',
      identity_document: '',
      is_active: true,
      role_id: '',
    });
    setSubmissionError(null);
    setIsDialogOpen(true);
  };

  const onSubmit = async (data: StaffFormValues) => {
    setSubmissionError(null);
    form.clearErrors();

    // Per-role license validation (receptionist → maxReceptionists, gerente → maxAdmins)
    const selectedRoleObj = staffRoles.find((r) => r.id === data.role_id);
    if (selectedRoleObj && roleCounts) {
      const { license } = useLicenseStore.getState();
      if (license) {
        const key = getRoleKey(selectedRoleObj.name);
        if (key === 'receptionist' && roleCounts.receptionist >= license.maxReceptionists) {
          setSubmissionError(t('License.enforcement.userLimitReached', { max: license.maxReceptionists }));
          return;
        }
        if (key === 'admin' && roleCounts.admin >= license.maxAdmins) {
          setSubmissionError(t('License.enforcement.userLimitReached', { max: license.maxAdmins }));
          return;
        }
      }
    }

    try {
      const { id: _id, role_id, ...userPayload } = data;
      const response = await api.post(API_ROUTES.USERS_UPSERT, {
        ...userPayload,
        is_sales: true,
      });

      if (response?.error && (response.error.error || response.code > 200)) {
        const apiError = new Error('API Error') as any;
        apiError.status = response.code || 500;
        apiError.data = response;
        throw apiError;
      }

      const newUserId =
        (Array.isArray(response) ? response[0]?.data?.id : null) ??
        response?.data?.id ??
        response?.id ??
        response?.user_id;

      if (newUserId && role_id) {
        try {
          await api.patch(API_ROUTES.ROLES_ASSIGN, {
            user_id: String(newUserId),
            roles: [{ role_id, is_active: true }],
          });
        } catch {
          // non-blocking — user was created successfully
        }
      }

      toast({
        title: t('StaffPage.createDialog.createSuccessTitle'),
        description: t('StaffPage.createDialog.createSuccessDescription'),
      });
      setIsDialogOpen(false);
      loadUsers();
    } catch (error: any) {
      const errorData =
        error.data?.error || (Array.isArray(error.data) && error.data[0]?.error);
      if (
        errorData?.code === 'unique_conflict' &&
        errorData?.conflictedFields
      ) {
        const fields = errorData.conflictedFields
          .map((f: string) =>
            t(`SystemUsersPage.createDialog.validation.fields.${f}`),
          )
          .join(', ');
        setSubmissionError(
          t('SystemUsersPage.createDialog.validation.uniqueConflict', { fields }),
        );
      } else if (
        (error.status === 400 || error.status === 409) &&
        errorData?.errors
      ) {
        const errors = Array.isArray(errorData.errors) ? errorData.errors : [];
        if (errors.length > 0) {
          errors.forEach((err: { field: any; message: string }) => {
            if (err.field) {
              form.setError(err.field as keyof StaffFormValues, {
                type: 'manual',
                message: err.message,
              });
            }
          });
        } else {
          setSubmissionError(
            errorData?.message ||
              t('SystemUsersPage.createDialog.validation.genericError'),
          );
        }
      } else if (error.status >= 500) {
        setSubmissionError(t('SystemUsersPage.createDialog.validation.serverError'));
      } else {
        const errorMessage =
          typeof error.data === 'string'
            ? error.data
            : errorData?.message ||
              (error instanceof Error
                ? error.message
                : t('SystemUsersPage.createDialog.validation.genericError'));
        setSubmissionError(errorMessage);
      }
    }
  };

  const onDetailSubmit = async (data: DetailFormValues) => {
    setDetailError(null);
    detailForm.clearErrors();
    setIsSavingDetail(true);
    try {
      const response = await api.post(API_ROUTES.USERS_UPSERT, {
        ...data,
        is_sales: true,
      });
      if (response?.error && (response.error.error || response.code > 200)) {
        const apiError = new Error('API Error') as any;
        apiError.status = response.code || 500;
        apiError.data = response;
        throw apiError;
      }
      toast({
        title: t('StaffPage.createDialog.editSuccessTitle'),
        description: t('StaffPage.createDialog.editSuccessDescription'),
      });
      const updated: User = {
        ...selectedUser!,
        name: data.name,
        email: data.email || '',
        phone_number: data.phone || '',
        identity_document: data.identity_document || '',
        is_active: data.is_active,
      };
      setSelectedUser(updated);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    } catch (error: any) {
      const errorData =
        error.data?.error || (Array.isArray(error.data) && error.data[0]?.error);
      setDetailError(
        errorData?.message ||
          (error instanceof Error
            ? error.message
            : t('SystemUsersPage.createDialog.validation.genericError')),
      );
    } finally {
      setIsSavingDetail(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Columns & filters
  // ---------------------------------------------------------------------------

  const userColumns: ColumnDef<User>[] = [
    {
      id: 'name',
      accessorKey: 'name',
      header: t('StaffPage.columns.name'),
    },
    {
      id: 'email',
      accessorKey: 'email',
      header: t('StaffPage.columns.email'),
    },
    {
      id: 'phone_number',
      accessorKey: 'phone_number',
      header: t('StaffPage.columns.phone'),
    },
    {
      id: 'is_active',
      accessorKey: 'is_active',
      header: t('StaffPage.columns.status'),
    },
  ];

  const filtersOptionList: FilterOption[] = [
    {
      value: 'active',
      label: t('StaffPage.filters.showOnlyActive'),
      group: 'Status',
      isActive: showOnlyActive,
      onSelect: () => setShowOnlyActive(!showOnlyActive),
    },
  ];

  const handleClearFilters = () => {
    setShowOnlyActive(true);
    setColumnFilters([]);
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <TwoPanelLayout
          isRightPanelOpen={!!selectedUser}
          onBack={handleCloseDetails}
          leftPanel={
            <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm">
              <CardHeader className="flex-none p-4">
                <div className="flex items-start gap-3">
                  <div className="header-icon-circle mt-0.5">
                    <UserPlus className="h-5 w-5" />
                  </div>
                  <div className="flex flex-col text-left">
                    <CardTitle className="text-lg">{t('StaffPage.title')}</CardTitle>
                    <CardDescription className="text-xs">
                      {t('StaffPage.description')}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden flex flex-col min-h-0 p-4 bg-card">
                <StaffTableNarrow
                  columns={userColumns}
                  users={users}
                  selectedUser={selectedUser}
                  onRowSelectionChange={handleRowSelectionChange}
                  onCreate={handleCreate}
                  onRefresh={loadUsers}
                  isRefreshing={isRefreshing}
                  rowSelection={rowSelection}
                  setRowSelection={setRowSelection}
                  userCount={userCount}
                  pagination={pagination}
                  setPagination={setPagination}
                  columnFilters={columnFilters}
                  setColumnFilters={setColumnFilters}
                  filtersOptionList={filtersOptionList}
                  handleClearFilters={handleClearFilters}
                  canCreate={canCreate}
                  t={t}
                />
              </CardContent>
            </Card>
          }
          rightPanel={
            selectedUser && (
              <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm">
                <CardHeader className="flex flex-row items-start justify-between flex-none p-4">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="header-icon-circle mt-0.5">
                      <Users className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1 flex flex-col text-left">
                      <CardTitle className="truncate">
                        {t('SystemUsersPage.detailsFor', { name: selectedUser.name })}
                      </CardTitle>
                    </div>
                  </div>
                  <Button
                    variant="destructive-ghost"
                    size="icon"
                    onClick={handleCloseDetails}
                  >
                    <X className="h-5 w-5" />
                    <span className="sr-only">{t('SystemUsersPage.close')}</span>
                  </Button>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden flex flex-col min-h-0 p-4 pt-0">
                  <Tabs
                    value={activeTab}
                    onValueChange={setActiveTab}
                    className="w-full flex-1 flex flex-col min-h-0"
                  >
                    <TabsList>
                      <TabsTrigger value="details">
                        {t('StaffPage.tabs.details')}
                      </TabsTrigger>
                      {canViewRoles && (
                        <TabsTrigger value="roles">
                          {t('StaffPage.tabs.roles')}
                        </TabsTrigger>
                      )}
                      {canViewLogs && (
                        <TabsTrigger value="logs">
                          {t('StaffPage.tabs.logs')}
                        </TabsTrigger>
                      )}
                    </TabsList>
                    <div className="flex-1 overflow-auto mt-4">
                      <TabsContent value="details" className="m-0">
                        <Form {...detailForm}>
                          <form
                            onSubmit={detailForm.handleSubmit(onDetailSubmit)}
                            className="space-y-4"
                          >
                            {detailError && (
                              <Alert variant="destructive">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>
                                  {t('SystemUsersPage.createDialog.validation.errorTitle')}
                                </AlertTitle>
                                <AlertDescription>{detailError}</AlertDescription>
                              </Alert>
                            )}
                            <FormField
                              control={detailForm.control}
                              name="name"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>
                                    {t('StaffPage.createDialog.name')}
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder={t(
                                        'StaffPage.createDialog.namePlaceholder',
                                      )}
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={detailForm.control}
                              name="email"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>
                                    {t('StaffPage.createDialog.email')}
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      type="email"
                                      placeholder={t(
                                        'StaffPage.createDialog.emailPlaceholder',
                                      )}
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={detailForm.control}
                              name="phone"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>
                                    {t('StaffPage.createDialog.phone')}
                                  </FormLabel>
                                  <FormControl>
                                    <PhoneInput
                                      {...field}
                                      defaultCountry="UY"
                                      placeholder={t(
                                        'StaffPage.createDialog.phonePlaceholder',
                                      )}
                                      onChange={field.onChange}
                                      value={field.value}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={detailForm.control}
                              name="identity_document"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>
                                    {t('StaffPage.createDialog.identity_document')}
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder={t(
                                        'StaffPage.createDialog.identity_document_placeholder',
                                      )}
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={detailForm.control}
                              name="is_active"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                    />
                                  </FormControl>
                                  <FormLabel>
                                    {t('StaffPage.createDialog.isActive')}
                                  </FormLabel>
                                </FormItem>
                              )}
                            />
                            {canUpdate && (
                              <div className="flex gap-2 pt-2">
                                <Button type="submit" disabled={isSavingDetail}>
                                  {isSavingDetail
                                    ? t('SystemUsersPage.createDialog.editSave') + '...'
                                    : t('SystemUsersPage.createDialog.editSave')}
                                </Button>
                              </div>
                            )}
                          </form>
                        </Form>
                      </TabsContent>
                      {canViewRoles && (
                        <TabsContent
                          value="roles"
                          className="m-0 flex-1 min-h-0 data-[state=active]:flex data-[state=active]:flex-col"
                        >
                          <UserRoles
                            userId={selectedUser.id}
                            initialUserRoles={selectedUserRoles}
                            isLoading={isRolesLoading}
                            onRolesChange={() => loadUserRoles(selectedUser.id)}
                            canAssignRole={canAssignRole}
                            canRemoveRole={canRemoveRole}
                          />
                        </TabsContent>
                      )}
                      {canViewLogs && (
                        <TabsContent
                          value="logs"
                          className="m-0 flex-1 min-h-0 data-[state=active]:flex data-[state=active]:flex-col"
                        >
                          <UserLogs userId={selectedUser.id} />
                        </TabsContent>
                      )}
                    </div>
                  </Tabs>
                </CardContent>
              </Card>
            )
          }
        />
      </div>

      {/* Create Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('StaffPage.createDialog.createTitle')}</DialogTitle>
            <DialogDescription>
              {t('StaffPage.createDialog.createDescription')}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex flex-col flex-1 overflow-hidden"
            >
              <DialogBody className="space-y-4 px-6 py-4">
                {submissionError && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>
                      {t('SystemUsersPage.createDialog.validation.errorTitle')}
                    </AlertTitle>
                    <AlertDescription>{submissionError}</AlertDescription>
                  </Alert>
                )}

                {/* Role selector — shown first */}
                <FormField
                  control={form.control}
                  name="role_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('StaffPage.createDialog.role')}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue
                              placeholder={t('StaffPage.createDialog.rolePlaceholder')}
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {staffRoles.map((r) => (
                            <SelectItem key={r.id} value={r.id}>
                              {r.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('StaffPage.createDialog.name')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('StaffPage.createDialog.namePlaceholder')}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('StaffPage.createDialog.email')}</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder={t('StaffPage.createDialog.emailPlaceholder')}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('StaffPage.createDialog.phone')}</FormLabel>
                      <FormControl>
                        <PhoneInput
                          {...field}
                          defaultCountry="UY"
                          placeholder={t('StaffPage.createDialog.phonePlaceholder')}
                          onChange={field.onChange}
                          value={field.value}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="identity_document"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t('StaffPage.createDialog.identity_document')}
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t(
                            'StaffPage.createDialog.identity_document_placeholder',
                          )}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="is_active"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel>{t('StaffPage.createDialog.isActive')}</FormLabel>
                    </FormItem>
                  )}
                />
              </DialogBody>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  {t('StaffPage.createDialog.cancel')}
                </Button>
                <Button type="submit">{t('StaffPage.createDialog.save')}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
