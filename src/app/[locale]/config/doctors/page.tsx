'use client';

import { DOCTORS_DIRECTORY_CONFIG, StaffDirectory } from '@/components/config/staff-directory';
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
  DialogCancelButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
import { SedeSelector } from '@/components/ui/sede-selector';
import { VerticalTabStrip, VerticalTab } from '@/components/ui/vertical-tab-strip';
import { DoctorAvailability } from '@/components/users/doctor-availability';
import { DoctorAvailabilityExceptions } from '@/components/users/doctor-availability-exceptions';
import { UserServices } from '@/components/users/user-services';
import { UserPreferencesTab } from '@/components/users/user-preferences-tab';
import { SignatureUploader } from '@/components/users/signature-uploader';
import { SYSTEM_PERMISSIONS, BUSINESS_CONFIG_PERMISSIONS } from '@/constants/permissions';
import { DoctorCalendarsTab } from '@/components/calendar/doctor-calendars-tab';
import { API_ROUTES } from '@/constants/routes';
import { useAsyncAction, useKeyedAsyncAction } from '@/hooks/use-async-action';
import { useDataLoader } from '@/hooks/use-data-loader';
import { useDebounce } from '@/hooks/use-debounce';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { getErrorMessage } from '@/lib/error-utils';
import { Calendar, Sede, User, UserRole } from '@/lib/types';
import { DEFAULT_PHONE_COUNTRY } from '@/lib/countries';
import api, { isTimeoutError, REQUEST_TIMEOUT_MS } from '@/services/api';
import { useLicenseStore } from '@/stores/license-store';
import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnFiltersState, PaginationState, RowSelectionState } from '@tanstack/react-table';
import { isValidPhoneNumber } from 'libphonenumber-js';
import { AlertTriangle, Calendar as CalendarIcon, CalendarClock, CalendarX, Check, ChevronsUpDown, ClipboardList, KeyRound, PenLine, Settings2, Stethoscope, UserSquare, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { DoctorsColumnsWrapper } from '@/components/config/staff-directory-columns';
import { useDeepLink } from '@/hooks/use-deep-link';
import { extractCreatedUserId, sendFirstTimePasswordToken } from '@/services/users';
import { useCheckFirstPassword } from '@/hooks/use-check-first-password';


const doctorFormSchema = (t: (key: string) => string) => z.object({
  id: z.string().optional(),
  name: z.string().min(1, { message: t('DoctorsPage.createDialog.validation.nameRequired') }),
  email: z.string().optional().refine(val => {
    if (!val || val.trim() === '') return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  }, { message: t('DoctorsPage.createDialog.validation.emailInvalid') }),
  phone: z.string().optional().refine(val => {
    if (!val || val.trim() === '') return true;
    return isValidPhoneNumber(val, DEFAULT_PHONE_COUNTRY);
  }, { message: t('DoctorsPage.createDialog.validation.phoneInvalid') }),
  identity_document: z.string()
    .regex(/^\d*$/, { message: t('DoctorsPage.createDialog.validation.identityInvalid') })
    .max(10, { message: t('DoctorsPage.createDialog.validation.identityMaxLength') })
    .optional()
    .or(z.literal('')),
  is_active: z.boolean().default(false),
  color: z.string().optional(),
  calendar_source_id: z.string().optional(),
  active_sede_id: z.string().optional(),
}).refine((data) => {
  const hasEmail = data.email && data.email.trim() !== '';
  const hasPhone = data.phone && data.phone.trim() !== '';
  return hasEmail || hasPhone;
}, {
  message: t('DoctorsPage.createDialog.validation.emailOrPhoneRequired'),
  path: ['email'],
});

type DoctorFormValues = z.infer<ReturnType<typeof doctorFormSchema>>;

type GetUsersResponse = {
  users: User[];
  total: number;
};

async function getUsers(pagination: PaginationState, searchQuery: string, onlyActive: boolean, signal?: AbortSignal): Promise<GetUsersResponse> {
    const responseData = await api.get(API_ROUTES.USERS, {
      page: (pagination.pageIndex + 1).toString(),
      limit: pagination.pageSize.toString(),
      search: searchQuery,
      filter_type: "DOCTOR",
      only_active: String(onlyActive),
    }, undefined, { signal });

    let usersData = [];
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
      avatar: apiUser.avatar || `https://picsum.photos/seed/${apiUser.id || Math.random()}/40/40`,
      color: apiUser.color,
      is_sales: apiUser.is_sales,
      calendar_source_id: apiUser.calendar_source_id ? String(apiUser.calendar_source_id) : undefined,
      active_sede_id: apiUser.active_sede_id != null ? String(apiUser.active_sede_id) : null,
    }));

    return { users: mappedUsers, total: total };
}

async function getActiveCalendars(signal?: AbortSignal): Promise<Calendar[]> {
  const data = await api.get(API_ROUTES.CALENDARS, undefined, undefined, { signal });
  const raw = Array.isArray(data) ? data : (data?.calendars || data?.data || []);
  return raw.filter((c: any) => c.is_active !== false).map((c: any) => ({
    id: String(c.id),
    name: c.name || '',
    google_calendar_id: c.google_calendar_id,
    is_active: c.is_active !== undefined ? c.is_active : true,
    color: c.color,
  }));
}

async function upsertUser(userData: DoctorFormValues) {
  const { active_sede_id, ...rest } = userData;
  const responseData = await api.post(API_ROUTES.USERS_UPSERT, {
    ...rest,
    filter_type: 'DOCTOR',
    is_sales: true,
    // Va en el propio upsert y no por `/users/active-sede`: ese endpoint es self-only
    // (responde/actualiza la sede del usuario del JWT), así que mandarle un user_id ajeno
    // terminaba cambiándole la sede activa al admin que estaba editando.
    active_sede_id: active_sede_id ? Number(active_sede_id) : null,
  }, undefined, undefined, { timeoutMs: REQUEST_TIMEOUT_MS.mutation });

  if (responseData?.error && (responseData.error.error || responseData.code > 200)) {
    const error = new Error('API Error') as any;
    error.status = responseData.code || 500;
    error.data = responseData;
    throw error;
  }

  return responseData;
}

async function getRolesForUser(userId: string): Promise<UserRole[]> {
  if (!userId) return [];
  try {
    const data = await api.get(API_ROUTES.ROLES_USER_ROLES, { user_id: userId });
    const userRolesData = Array.isArray(data) ? (Object.keys(data[0]).length === 0 ? [] : data) : (data.user_roles || data.data || data.result || []);
    return userRolesData.map((apiRole: any) => ({
      user_role_id: apiRole.user_role_id,
      role_id: apiRole.role_id,
      name: apiRole.name || 'Unknown Role',
      is_active: apiRole.is_active,
    }));
  } catch (error) {
    console.error("Failed to fetch user roles:", error);
    return [];
  }
}

function DoctorsTableNarrow({ columns, users, selectedUser, onRowSelectionChange, onCreate, onRefresh, isRefreshing, isLoading, loadError, rowSelection, setRowSelection, userCount, pagination, setPagination, columnFilters, setColumnFilters, filtersOptionList, handleClearFilters, t }: {
  columns: any[]; users: any[]; selectedUser: any;
  onRowSelectionChange: (rows: any[]) => void; onCreate: () => void; onRefresh: () => void; isRefreshing: boolean;
  isLoading: boolean; loadError: string | null;
  rowSelection: RowSelectionState; setRowSelection: React.Dispatch<React.SetStateAction<RowSelectionState>>;
  userCount: number; pagination: PaginationState; setPagination: React.Dispatch<React.SetStateAction<PaginationState>>;
  columnFilters: ColumnFiltersState; setColumnFilters: React.Dispatch<React.SetStateAction<ColumnFiltersState>>;
  filtersOptionList: any[]; handleClearFilters: () => void; t: (k: string) => string;
}) {
  const { isNarrow: panelNarrow } = useNarrowMode();
  const isViewportNarrow = useViewportNarrow();
  const isNarrow = !!selectedUser || panelNarrow || isViewportNarrow;
  return (
    <DataTable
      columns={columns}
      data={users}
      filterColumnId="email"
      filterPlaceholder={t('UsersPage.filterPlaceholder')}
      onRowSelectionChange={onRowSelectionChange}
      enableSingleRowSelection={true}
      onCreate={onCreate}
      onRefresh={onRefresh}
      isRefreshing={isRefreshing}
      isLoading={isLoading}
      loadError={loadError}
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
      renderCard={(row: any, _isSelected: boolean) => (
        <DataCard isSelected={_isSelected}
          title={row.name || ''}
          subtitle={row.email || row.phone_number || ''}
          avatar={row.name ? row.name.slice(0, 2).toUpperCase() : '?'}
          showArrow
          onClick={() => onRowSelectionChange([row])}
        />
      )}
      customToolbar={(table: any, pagination: React.ReactNode) => (
        <DataTableAdvancedToolbar
          table={table}
          endSlot={pagination}
          filterPlaceholder={t('UsersPage.filterPlaceholder')}
          searchQuery={(columnFilters.find((f: any) => f.id === 'email')?.value as string) || ''}
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
          onCreate={onCreate}
          onRefresh={onRefresh}
          isRefreshing={isRefreshing}
          extraButtons={null}
          columnTranslations={{
            name: t('DoctorsPage.DoctorColumns.name'),
            email: t('DoctorsPage.DoctorColumns.email'),
            identity_document: t('DoctorsPage.DoctorColumns.identity_document'),
            phone_number: t('DoctorsPage.DoctorColumns.phone'),
            is_active: t('DoctorsPage.DoctorColumns.status'),
          }}
        />
      )}
      columnTranslations={{
        name: t('DoctorsPage.DoctorColumns.name'),
        email: t('DoctorsPage.DoctorColumns.email'),
        identity_document: t('DoctorsPage.DoctorColumns.identity_document'),
        phone_number: t('DoctorsPage.DoctorColumns.phone'),
        is_active: t('DoctorsPage.DoctorColumns.status'),
      }}
    />
  );
}

export default function DoctorsPage() {
  const t = useTranslations();

  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const [selectedUser, setSelectedUser] = React.useState<User | null>(null);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [submissionError, setSubmissionError] = React.useState<string | null>(null);
  const [detailError, setDetailError] = React.useState<string | null>(null);

  const canSetInitialPassword = hasPermission(SYSTEM_PERMISSIONS.USERS_SET_INITIAL_PASSWORD);
  const hasPasswordPermission = useCheckFirstPassword(selectedUser, canSetInitialPassword);
  const canUpdateDoctor = hasPermission(BUSINESS_CONFIG_PERMISSIONS.DOCTORS_UPDATE);

  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [showOnlyActive, setShowOnlyActive] = React.useState(true);
  const [sedes, setSedes] = React.useState<Sede[]>([]);
  const [isCalendarOpen, setIsCalendarOpen] = React.useState(false);
  const [isDetailCalendarOpen, setIsDetailCalendarOpen] = React.useState(false);

  const { data: calendars, error: calendarsError } = useDataLoader(getActiveCalendars, [] as Calendar[]);
  // In the calendar pickers, a failed load must not look like "no calendars".
  const calendarsEmptyLabel = calendarsError ? t('Common.loadError') : t('General.noResults');

  React.useEffect(() => {
    api.get(API_ROUTES.SEDES, { page: '1', limit: '200' }).then((data: any) => {
      const raw = Array.isArray(data) ? data : (data.sedes || data.data || []);
      setSedes(raw);
    }).catch(() => setSedes([]));
  }, []);

  const form = useForm<DoctorFormValues>({
    resolver: zodResolver(doctorFormSchema(t)),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      identity_document: '',
      is_active: true,
      color: '',
      calendar_source_id: '',
      active_sede_id: '',
    },
  });

  const detailForm = useForm<DoctorFormValues>({
    resolver: zodResolver(doctorFormSchema(t)),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      identity_document: '',
      is_active: true,
      color: '',
      calendar_source_id: '',
      active_sede_id: '',
    },
  });

  const searchQuery = (columnFilters.find(f => f.id === 'email')?.value as string) || '';
  const debouncedSearch = useDebounce(searchQuery, 500);

  // Only the latest page/search/filter request may write the table: a slow "ju" can't overwrite "juan".
  const {
    data: { users, total: userCount },
    setData: setUsersData,
    isLoading,
    isRefreshing,
    error: loadError,
    reload: loadUsers,
  } = useDataLoader(
    (signal) => getUsers(pagination, debouncedSearch, showOnlyActive, signal),
    { users: [] as User[], total: 0 },
    [pagination.pageIndex, pagination.pageSize, debouncedSearch, showOnlyActive]
  );

  const toggleActivate = useKeyedAsyncAction(
    async (user: User) => {
      try {
        await api.put(API_ROUTES.USERS_ACTIVATE, {
          user_id: user.id,
          is_active: !user.is_active,
        }, undefined, undefined, { timeoutMs: REQUEST_TIMEOUT_MS.mutation });
      } catch (error) {
        if (isTimeoutError(error)) throw error;
        throw new Error(!user.is_active ? t('DoctorsPage.createDialog.ErrorActivateDescription') : t('DoctorsPage.createDialog.ErrorDeactivateDescription'));
      }
      return user;
    },
    {
      onSuccess: async (user) => {
        toast({
          title: !user.is_active ? t('DoctorsPage.createDialog.SuccessActivate') : t('DoctorsPage.createDialog.SuccessDeactivate'),
          description: !user.is_active ? t('DoctorsPage.createDialog.SuccessActivateDescription', { name: user.name }) : t('DoctorsPage.createDialog.SuccessDeactivateDescription', { name: user.name }),
        });
        await loadUsers();
      },
      onError: (error) => {
        if (isTimeoutError(error)) loadUsers();
      },
    }
  );

  const runToggleActivate = toggleActivate.run;
  const handleToggleActivate = React.useCallback((user: User) => {
    runToggleActivate(user.id, user);
  }, [runToggleActivate]);

  const handleCreate = () => {
    const { canAddUserByRole, license } = useLicenseStore.getState();
    if (!canAddUserByRole('doctor', userCount)) {
      toast({
        variant: 'destructive',
        title: t('License.enforcement.limitReachedTitle'),
        description: t('License.enforcement.doctorLimitReached', { max: license?.maxDoctors ?? 0 }),
      });
      return;
    }

    form.reset({
      name: '',
      email: '',
      phone: '',
      identity_document: '',
      is_active: true,
      color: '',
      calendar_source_id: '',
      active_sede_id: '',
    });
    setSubmissionError(null);
    setIsDialogOpen(true);
  };

  const userColumns = DoctorsColumnsWrapper({
    onToggleActivate: handleToggleActivate,
    onEdit: () => {},
    isTogglePending: toggleActivate.isPending,
  });

  const handleRowSelectionChange = (selectedRows: User[]) => {
    const user = selectedRows.length > 0 ? selectedRows[0] : null;
    if (user?.id === selectedUser?.id) return;
    // Don't drop an in-flight save or unsaved edits of the current doctor by clicking another row.
    if (saveDetail.isPending || (detailForm.formState.isDirty && !window.confirm(t('Common.unsavedChangesConfirm')))) {
      setRowSelection(selectedUser ? { [selectedUser.id]: true } : {});
      return;
    }
    setSelectedUser(user);
    if (user) {
      detailForm.reset({
        id: user.id,
        name: user.name,
        email: user.email || '',
        phone: user.phone_number || '',
        identity_document: user.identity_document || '',
        is_active: user.is_active,
        color: user.color || '',
        calendar_source_id: user.calendar_source_id || '',
        active_sede_id: user.active_sede_id || '',
      });
      setDetailError(null);
    }
  };


  const sendInitialPassword = useAsyncAction(
    async (userId: string) => sendFirstTimePasswordToken(userId, { timeoutMs: REQUEST_TIMEOUT_MS.mutation }),
    {
      onSuccess: () => {
        toast({ title: t('SystemUsersPage.initialPasswordSentTitle'), description: t('SystemUsersPage.initialPasswordSentDescription') });
      },
      errorTitle: t('SystemUsersPage.initialPasswordError'),
    }
  );

  const handleCloseDetails = () => {
    if (saveDetail.isPending) return;
    if (detailForm.formState.isDirty && !window.confirm(t('Common.unsavedChangesConfirm'))) return;
    setSelectedUser(null);
    setRowSelection({});
  };

  const filtersOptionList: FilterOption[] = [
    {
      value: 'active',
      label: t('DoctorsPage.filters.showOnlyActive'),
      group: 'Status',
      isActive: showOnlyActive,
      onSelect: () => setShowOnlyActive(!showOnlyActive),
    },
  ];

  const handleClearFilters = () => {
    setShowOnlyActive(true);
    setColumnFilters([]);
  };

  /** Maps an upsert failure to inline form errors (field errors when the backend names them). */
  const reportUpsertError = (error: any, targetForm: typeof form, setError: (message: string | null) => void) => {
    if (isTimeoutError(error)) {
      // The doctor may have been saved anyway: refresh so the user can check before retrying.
      setError(t('Common.timeoutError'));
      loadUsers();
      return;
    }
    const errorData = error.data?.error || (Array.isArray(error.data) && error.data[0]?.error);
    if (errorData?.code === 'unique_conflict' && errorData?.conflictedFields) {
      const fields = errorData.conflictedFields.map((f: string) => t(`DoctorsPage.createDialog.validation.fields.${f}`)).join(', ');
      setError(t('DoctorsPage.createDialog.validation.uniqueConflict', { fields }));
    } else if ((error.status === 400 || error.status === 409) && errorData?.errors) {
      const errors = Array.isArray(errorData.errors) ? errorData.errors : [];
      if (errors.length > 0) {
        errors.forEach((err: { field: any; message: string }) => {
          if (err.field) {
            targetForm.setError(err.field as keyof DoctorFormValues, {
              type: 'manual',
              message: err.message,
            });
          }
        });
      } else {
        setError(errorData?.message || t('DoctorsPage.createDialog.validation.genericError'));
      }
    } else if (error.status >= 500) {
      setError(t('DoctorsPage.createDialog.validation.serverError'));
    } else {
      const errorMessage = typeof error.data === 'string' ? error.data : errorData?.message || getErrorMessage(error) || t('DoctorsPage.createDialog.validation.genericError');
      setError(errorMessage);
    }
  };

  const saveDetail = useAsyncAction(
    async (data: DoctorFormValues) => {
      setDetailError(null);
      detailForm.clearErrors();
      await upsertUser(data);
      return data;
    },
    {
      onSuccess: (data) => {
        toast({
          title: t('DoctorsPage.createDialog.editSuccessTitle'),
          description: t('DoctorsPage.createDialog.editSuccessDescription'),
        });
        const updated: User = {
          ...selectedUser!,
          name: data.name,
          email: data.email || '',
          phone_number: data.phone || '',
          identity_document: data.identity_document || '',
          is_active: data.is_active,
          color: data.color || '',
          calendar_source_id: data.calendar_source_id || undefined,
          active_sede_id: data.active_sede_id || null,
        };
        setSelectedUser(updated);
        setUsersData(prev => ({ ...prev, users: prev.users.map(u => u.id === updated.id ? updated : u) }));
        // The saved values become the new baseline for the unsaved-changes guard.
        detailForm.reset(data);
      },
      onError: (error) => reportUpsertError(error, detailForm, setDetailError),
      showErrorToast: false,
    }
  );

  const create = useAsyncAction(
    async (data: DoctorFormValues) => {
      setSubmissionError(null);
      form.clearErrors();
      const response = await upsertUser(data);
      const newUserId = extractCreatedUserId(response);
      let passwordEmailSent = true;
      if (newUserId) {
        try {
          await sendFirstTimePasswordToken(newUserId, { timeoutMs: REQUEST_TIMEOUT_MS.mutation });
        } catch {
          passwordEmailSent = false;
        }
      }
      return { passwordEmailSent };
    },
    {
      onSuccess: async ({ passwordEmailSent }) => {
        toast({
          title: t('DoctorsPage.createDialog.createSuccessTitle'),
          description: t('DoctorsPage.createDialog.createSuccessDescription'),
        });
        if (!passwordEmailSent) {
          // The doctor exists: say what did not happen instead of a generic error that invites a retry.
          toast({ variant: 'destructive', title: t('Common.errorTitle'), description: t('SystemUsersPage.initialPasswordPartialError') });
        }
        await loadUsers();
        setIsDialogOpen(false);
      },
      onError: (error) => reportUpsertError(error, form, setSubmissionError),
      showErrorToast: false,
    }
  );

  const [activeTab, setActiveTab] = React.useState('details');

  useDeepLink<User>({
    tabMap: {
      'Detalles': 'details',
      'Servicios': 'services',
      'Disponibilidad': 'availability',
      'Excepciones': 'exceptions',
    },
    onFilter: (v) => {
      setPagination((prev) => ({ ...prev, pageIndex: 0 }));
      setColumnFilters([{ id: 'email', value: v }]);
    },
    items: users,
    isLoading: isRefreshing || isLoading,
    onAutoSelect: (user) => handleRowSelectionChange([user]),
    setRowSelection,
    onTabChange: (id) => setActiveTab(id),
    actionMap: { 'Crear': () => handleCreate() },
  });

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <TwoPanelLayout
        isRightPanelOpen={!!selectedUser}
        onBack={handleCloseDetails}
        leftPanel={
          <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm">
            <CardHeader className="flex-none p-4">
              <div className="flex items-start gap-3">
                <div className="header-icon-circle mt-0.5">
                  <UserSquare className="h-5 w-5" />
                </div>
                <div className="flex flex-col text-left">
                  <CardTitle className="text-lg">{t('Navigation.Doctors')}</CardTitle>
                  <CardDescription className="text-xs">{t('DoctorsPage.description')}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden flex flex-col min-h-0 p-4 bg-card">
              <DoctorsTableNarrow
                columns={userColumns}
                users={users}
                selectedUser={selectedUser}
                onRowSelectionChange={handleRowSelectionChange}
                onCreate={handleCreate}
                onRefresh={loadUsers}
                isRefreshing={isRefreshing}
                isLoading={isLoading}
                loadError={loadError}
                rowSelection={rowSelection}
                setRowSelection={setRowSelection}
                userCount={userCount}
                pagination={pagination}
                setPagination={setPagination}
                columnFilters={columnFilters}
                setColumnFilters={setColumnFilters}
                filtersOptionList={filtersOptionList}
                handleClearFilters={handleClearFilters}
                t={t}
              />
            </CardContent>
          </Card>
        }
        rightPanel={
          selectedUser && (
            <Card className="h-full flex flex-col">
              <CardHeader className="flex flex-row items-start justify-between flex-none">
                <div>
                  <CardTitle>{t('UsersPage.detailsFor', { name: selectedUser.name })}</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  {hasPasswordPermission && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { if (canSetInitialPassword) sendInitialPassword.run(selectedUser.id); }}
                      loading={sendInitialPassword.isPending}
                    >
                      {!sendInitialPassword.isPending && <KeyRound className="mr-2 h-4 w-4" />}
                      {t('SystemUsersPage.setInitialPassword')}
                    </Button>
                  )}
                  <Button variant="destructive-ghost" size="icon" onClick={handleCloseDetails}>
                    <X className="h-5 w-5" />
                    <span className="sr-only">{t('UsersPage.close')}</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden flex flex-col p-0 pt-0">
                <VerticalTabStrip
                  tabs={[
                    { id: 'details', icon: ClipboardList, label: t('DoctorsPage.tabs.details') },
                    { id: 'services', icon: Stethoscope, label: t('UsersPage.tabs.services') },
                    { id: 'calendars', icon: CalendarIcon, label: t('DoctorsPage.tabs.calendars') },
                    { id: 'availability', icon: CalendarClock, label: t('DoctorsPage.tabs.availability') },
                    { id: 'exceptions', icon: CalendarX, label: t('DoctorsPage.tabs.exceptions') },
                    { id: 'signature', icon: PenLine, label: t('DoctorsPage.tabs.signature') },
                    ...(canUpdateDoctor ? [{ id: 'preferences', icon: Settings2, label: t('DoctorsPage.tabs.preferences') }] : []),
                  ] satisfies VerticalTab[]}
                  activeTabId={activeTab}
                  onTabClick={(tab) => setActiveTab(tab.id)}
                />
                <div className="flex-1 overflow-auto px-4 py-4">
                  {activeTab === 'details' && (
                    <Form {...detailForm}>
                      <form onSubmit={detailForm.handleSubmit(saveDetail.run)} className="space-y-4">
                        {detailError && (
                          <Alert variant="destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>{t('DoctorsPage.createDialog.validation.errorTitle')}</AlertTitle>
                            <AlertDescription>{detailError}</AlertDescription>
                          </Alert>
                        )}
                        {/* Native fieldset disables every control while the request is in flight */}
                        <fieldset disabled={saveDetail.isPending} className="min-w-0 space-y-4">
                        <FormField control={detailForm.control} name="name" render={({ field }) => (
                          <FormItem><FormLabel>{t('DoctorsPage.createDialog.name')}</FormLabel><FormControl><Input placeholder={t('DoctorsPage.createDialog.namePlaceholder')} {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={detailForm.control} name="email" render={({ field }) => (
                          <FormItem><FormLabel>{t('DoctorsPage.createDialog.email')}</FormLabel><FormControl><Input type="email" placeholder={t('DoctorsPage.createDialog.emailPlaceholder')} {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={detailForm.control} name="phone" render={({ field }) => (
                          <FormItem><FormLabel>{t('DoctorsPage.createDialog.phone')}</FormLabel><FormControl>
                            <PhoneInput {...field} defaultCountry="UY" placeholder={t('DoctorsPage.createDialog.phonePlaceholder')} onChange={field.onChange} value={field.value} />
                          </FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={detailForm.control} name="identity_document" render={({ field }) => (
                          <FormItem><FormLabel>{t('DoctorsPage.createDialog.identity_document')}</FormLabel><FormControl><Input placeholder={t('DoctorsPage.createDialog.identity_document_placeholder')} {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={detailForm.control} name="color" render={({ field }) => (
                          <FormItem><FormLabel>{t('DoctorsPage.createDialog.color')}</FormLabel><FormControl>
                            <div className="flex items-center gap-2">
                              <Input type="color" className="p-1 h-10 w-14" {...field} />
                              <Input placeholder="#FFFFFF" {...field} />
                            </div>
                          </FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={detailForm.control} name="calendar_source_id" render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('DoctorsPage.createDialog.defaultCalendar')}</FormLabel>
                            <Popover open={isDetailCalendarOpen} onOpenChange={setIsDetailCalendarOpen}>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button variant="outline" role="combobox" className={cn('w-full justify-between font-normal', !field.value && 'text-muted-foreground')}>
                                    {field.value ? (calendars.find(c => c.id === field.value)?.name ?? t('DoctorsPage.createDialog.selectCalendar')) : t('DoctorsPage.createDialog.selectCalendar')}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                                <Command>
                                  <CommandInput placeholder={t('DoctorsPage.createDialog.searchCalendarPlaceholder')} />
                                  <CommandList>
                                    <CommandEmpty>{calendarsEmptyLabel}</CommandEmpty>
                                    <CommandGroup>
                                      <CommandItem value="" onSelect={() => { field.onChange(''); setIsDetailCalendarOpen(false); }}>
                                        <Check className={cn('mr-2 h-4 w-4', !field.value ? 'opacity-100' : 'opacity-0')} />
                                        {t('DoctorsPage.createDialog.noCalendar')}
                                      </CommandItem>
                                      {calendars.map(cal => (
                                        <CommandItem key={cal.id} value={cal.name} onSelect={() => { field.onChange(cal.id); setIsDetailCalendarOpen(false); }}>
                                          <Check className={cn('mr-2 h-4 w-4', field.value === cal.id ? 'opacity-100' : 'opacity-0')} />
                                          {cal.name}
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={detailForm.control} name="active_sede_id" render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('DoctorsPage.createDialog.defaultSede')}</FormLabel>
                            <FormControl>
                              <SedeSelector
                                value={field.value}
                                onValueChange={field.onChange}
                                placeholder={t('DoctorsPage.createDialog.defaultSedePlaceholder')}
                                triggerText={t('DoctorsPage.createDialog.defaultSedePlaceholder')}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={detailForm.control} name="is_active" render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                            <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            <FormLabel>{t('DoctorsPage.createDialog.isActive')}</FormLabel>
                          </FormItem>
                        )} />
                        </fieldset>
                        <div className="flex gap-2 pt-2">
                          <Button type="submit" loading={saveDetail.isPending}>
                            {t('DoctorsPage.createDialog.editSave')}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  )}
                  {activeTab === 'calendars' && (
                    <DoctorCalendarsTab userId={selectedUser.id} canManage={hasPermission(BUSINESS_CONFIG_PERMISSIONS.CALENDARS_MANAGE_USERS)} />
                  )}
                  {activeTab === 'services' && (
                    <UserServices userId={selectedUser.id} isSalesUser={selectedUser.is_sales !== false} />
                  )}
                  {activeTab === 'availability' && (
                    <DoctorAvailability userId={selectedUser.id} />
                  )}
                  {activeTab === 'exceptions' && (
                    <DoctorAvailabilityExceptions userId={selectedUser.id} />
                  )}
                  {activeTab === 'signature' && (
                    <SignatureUploader
                      userId={selectedUser.id}
                      canManage={hasPermission(SYSTEM_PERMISSIONS.USERS_MANAGE_SIGNATURE)}
                    />
                  )}
                  {activeTab === 'preferences' && canUpdateDoctor && (
                    <UserPreferencesTab user={selectedUser} showAlertStyle sedes={sedes} />
                  )}
                </div>
              </CardContent>
            </Card>
          )
        }
      />

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          if (!open && create.isPending) return;
          setIsDialogOpen(open);
        }}
      >
        <DialogContent confirmOnClose isDirty={form.formState.isDirty && !create.isPending}>
          <DialogHeader>
            <DialogTitle>{t('DoctorsPage.createDialog.createTitle')}</DialogTitle>
            <DialogDescription>{t('DoctorsPage.createDialog.createDescription')}</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(create.run)} className="flex flex-col flex-1 overflow-hidden">
              <DialogBody className="space-y-4 px-6 py-4">
                {submissionError && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>{t('DoctorsPage.createDialog.validation.errorTitle')}</AlertTitle>
                    <AlertDescription>{submissionError}</AlertDescription>
                  </Alert>
                )}
                {/* Native fieldset disables every control while the request is in flight */}
                <fieldset disabled={create.isPending} className="min-w-0 space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('DoctorsPage.createDialog.name')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('DoctorsPage.createDialog.namePlaceholder')} {...field} />
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
                      <FormLabel>{t('DoctorsPage.createDialog.email')}</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder={t('DoctorsPage.createDialog.emailPlaceholder')} {...field} />
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
                      <FormLabel>{t('DoctorsPage.createDialog.phone')}</FormLabel>
                      <FormControl>
                        <PhoneInput
                          {...field}
                          defaultCountry="UY"
                          placeholder={t('DoctorsPage.createDialog.phonePlaceholder')}
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
                      <FormLabel>{t('DoctorsPage.createDialog.identity_document')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('DoctorsPage.createDialog.identity_document_placeholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('DoctorsPage.createDialog.color')}</FormLabel>
                      <FormControl>
                        <div className="flex items-center gap-2">
                          <Input type="color" className="p-1 h-10 w-14" {...field} />
                          <Input placeholder="#FFFFFF" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="calendar_source_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('DoctorsPage.createDialog.defaultCalendar')}</FormLabel>
                      <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button variant="outline" role="combobox" className={cn('w-full justify-between font-normal', !field.value && 'text-muted-foreground')}>
                              {field.value ? (calendars.find(c => c.id === field.value)?.name ?? t('DoctorsPage.createDialog.selectCalendar')) : t('DoctorsPage.createDialog.selectCalendar')}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                          <Command>
                            <CommandInput placeholder={t('DoctorsPage.createDialog.searchCalendarPlaceholder')} />
                            <CommandList>
                              <CommandEmpty>{calendarsEmptyLabel}</CommandEmpty>
                              <CommandGroup>
                                <CommandItem value="" onSelect={() => { field.onChange(''); setIsCalendarOpen(false); }}>
                                  <Check className={cn('mr-2 h-4 w-4', !field.value ? 'opacity-100' : 'opacity-0')} />
                                  {t('DoctorsPage.createDialog.noCalendar')}
                                </CommandItem>
                                {calendars.map(cal => (
                                  <CommandItem key={cal.id} value={cal.name} onSelect={() => { field.onChange(cal.id); setIsCalendarOpen(false); }}>
                                    <Check className={cn('mr-2 h-4 w-4', field.value === cal.id ? 'opacity-100' : 'opacity-0')} />
                                    {cal.name}
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
                <FormField
                  control={form.control}
                  name="active_sede_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('DoctorsPage.createDialog.defaultSede')}</FormLabel>
                      <FormControl>
                        <SedeSelector
                          value={field.value}
                          onValueChange={field.onChange}
                          placeholder={t('DoctorsPage.createDialog.defaultSedePlaceholder')}
                          triggerText={t('DoctorsPage.createDialog.defaultSedePlaceholder')}
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
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel>{t('DoctorsPage.createDialog.isActive')}</FormLabel>
                    </FormItem>
                  )}
                />
                </fieldset>
              </DialogBody>
              <DialogFooter>
                <Button type="submit" loading={create.isPending}>{t('DoctorsPage.createDialog.save')}</Button>
                <DialogCancelButton disabled={create.isPending}>{t('DoctorsPage.createDialog.cancel')}</DialogCancelButton>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
    return <StaffDirectory config={DOCTORS_DIRECTORY_CONFIG} />;
}
