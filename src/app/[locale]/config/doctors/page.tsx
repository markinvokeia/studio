
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
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
import { VerticalTabStrip, VerticalTab } from '@/components/ui/vertical-tab-strip';
import { DoctorAvailability } from '@/components/users/doctor-availability';
import { DoctorAvailabilityExceptions } from '@/components/users/doctor-availability-exceptions';
import { UserServices } from '@/components/users/user-services';
import { SYSTEM_PERMISSIONS } from '@/constants/permissions';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { Calendar, User, UserRole } from '@/lib/types';
import api from '@/services/api';
import { useLicenseStore } from '@/stores/license-store';
import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnFiltersState, PaginationState, RowSelectionState } from '@tanstack/react-table';
import { isValidPhoneNumber } from 'libphonenumber-js';
import { AlertTriangle, CalendarClock, CalendarX, Check, ChevronsUpDown, ClipboardList, KeyRound, Stethoscope, UserSquare, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { DoctorsColumnsWrapper } from './columns';
import { useDeepLink } from '@/hooks/use-deep-link';


const doctorFormSchema = (t: (key: string) => string) => z.object({
  id: z.string().optional(),
  name: z.string().min(1, { message: t('DoctorsPage.createDialog.validation.nameRequired') }),
  email: z.string().optional().refine(val => {
    if (!val || val.trim() === '') return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  }, { message: t('DoctorsPage.createDialog.validation.emailInvalid') }),
  phone: z.string().optional().refine(val => {
    if (!val || val.trim() === '') return true;
    return isValidPhoneNumber(val);
  }, { message: t('DoctorsPage.createDialog.validation.phoneInvalid') }),
  identity_document: z.string()
    .regex(/^\d*$/, { message: t('DoctorsPage.createDialog.validation.identityInvalid') })
    .max(10, { message: t('DoctorsPage.createDialog.validation.identityMaxLength') })
    .optional()
    .or(z.literal('')),
  is_active: z.boolean().default(false),
  color: z.string().optional(),
  calendar_source_id: z.string().optional(),
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

async function getUsers(pagination: PaginationState, searchQuery: string, onlyActive: boolean): Promise<GetUsersResponse> {
  try {
    const responseData = await api.get(API_ROUTES.USERS, {
      page: (pagination.pageIndex + 1).toString(),
      limit: pagination.pageSize.toString(),
      search: searchQuery,
      filter_type: "DOCTOR",
      only_active: String(onlyActive),
    });

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
    }));

    return { users: mappedUsers, total: total };

  } catch (error) {
    console.error("Failed to fetch users:", error);
    return { users: [], total: 0 };
  }
}

async function upsertUser(userData: DoctorFormValues) {
  const responseData = await api.post(API_ROUTES.USERS_UPSERT, { ...userData, filter_type: 'DOCTOR', is_sales: true });

  if (responseData.error && (responseData.error.error || responseData.code > 200)) {
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

function DoctorsTableNarrow({ columns, users, selectedUser, onRowSelectionChange, onCreate, onRefresh, isRefreshing, rowSelection, setRowSelection, userCount, pagination, setPagination, columnFilters, setColumnFilters, filtersOptionList, handleClearFilters, t }: {
  columns: any[]; users: any[]; selectedUser: any;
  onRowSelectionChange: (rows: any[]) => void; onCreate: () => void; onRefresh: () => void; isRefreshing: boolean;
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
  const [users, setUsers] = React.useState<User[]>([]);
  const [userCount, setUserCount] = React.useState(0);
  const [selectedUser, setSelectedUser] = React.useState<User | null>(null);
  const [hasPasswordPermission, setHasPasswordPermission] = React.useState(false);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [submissionError, setSubmissionError] = React.useState<string | null>(null);
  const [detailError, setDetailError] = React.useState<string | null>(null);
  const [isSavingDetail, setIsSavingDetail] = React.useState(false);

  const canSetInitialPassword = hasPermission(SYSTEM_PERMISSIONS.USERS_SET_INITIAL_PASSWORD);


  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [showOnlyActive, setShowOnlyActive] = React.useState(true);
  const [calendars, setCalendars] = React.useState<Calendar[]>([]);
  const [isCalendarOpen, setIsCalendarOpen] = React.useState(false);
  const [isDetailCalendarOpen, setIsDetailCalendarOpen] = React.useState(false);

  React.useEffect(() => {
    api.get(API_ROUTES.CALENDARS).then((data: any) => {
      const raw = Array.isArray(data) ? data : (data.calendars || data.data || []);
      setCalendars(raw.filter((c: any) => c.is_active !== false).map((c: any) => ({
        id: String(c.id),
        name: c.name || '',
        google_calendar_id: c.google_calendar_id,
        is_active: c.is_active !== undefined ? c.is_active : true,
        color: c.color,
      })));
    }).catch(() => setCalendars([]));
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
    },
  });

  const loadUsers = React.useCallback(async () => {
    setIsRefreshing(true);
    const searchQuery = (columnFilters.find(f => f.id === 'email')?.value as string) || '';
    const { users: fetchedUsers, total } = await getUsers(pagination, searchQuery, showOnlyActive);
    setUsers(fetchedUsers);
    setUserCount(total);
    setIsRefreshing(false);
  }, [pagination, columnFilters, showOnlyActive]);

  React.useEffect(() => {
    const debounce = setTimeout(() => {
      loadUsers();
    }, 500);
    return () => clearTimeout(debounce);
  }, [loadUsers]);

  const handleToggleActivate = async (user: User) => {
    try {
      await api.put(API_ROUTES.USERS_ACTIVATE, {
        user_id: user.id,
        is_active: !user.is_active,
      });

      toast({
        title: !user.is_active ? t('DoctorsPage.createDialog.SuccessActivate') : t('DoctorsPage.createDialog.SuccessDeactivate'),
        description: !user.is_active ? t('DoctorsPage.createDialog.SuccessActivateDescription', { name: user.name }) : t('DoctorsPage.createDialog.SuccessDeactivateDescription', { name: user.name }),
      });

      loadUsers();
    } catch (error) {
      toast({
        variant: !user.is_active ? 'default' : 'destructive',
        title: !user.is_active ? t('DoctorsPage.createDialog.ErrorActivate') : t('DoctorsPage.createDialog.ErrorDeactivate'),
        description: !user.is_active ? t('DoctorsPage.createDialog.ErrorActivateDescription') : t('DoctorsPage.createDialog.ErrorDeactivateDescription'),
      });
      console.error(error);
    }
  };

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
    });
    setSubmissionError(null);
    setIsDialogOpen(true);
  };

  const userColumns = DoctorsColumnsWrapper({
    onToggleActivate: handleToggleActivate,
    onEdit: () => {},
  });

  const handleRowSelectionChange = (selectedRows: User[]) => {
    const user = selectedRows.length > 0 ? selectedRows[0] : null;
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
      });
      setDetailError(null);
    }
  };

  React.useEffect(() => {
    const checkFirstPasswordRequirements = async () => {
      if (!selectedUser || !canSetInitialPassword) {
        setHasPasswordPermission(false);
        return;
      }
      const token = localStorage.getItem('token');
      if (!token) {
        setHasPasswordPermission(false);
        return;
      }
      try {
        await api.get(API_ROUTES.SYSTEM.API_AUTH_CHECK_FIRST_PASSWORD, { user_id: selectedUser.id });
        setHasPasswordPermission(true);
      } catch {
        setHasPasswordPermission(false);
      }
    };

    if (selectedUser) {
      checkFirstPasswordRequirements();
    } else {
      setHasPasswordPermission(false);
    }
  }, [selectedUser, canSetInitialPassword]);

  const handleSendInitialPassword = async () => {
    if (!selectedUser || !canSetInitialPassword) return;
    try {
      await api.post(API_ROUTES.SYSTEM.API_AUTH_FIRST_TIME_PASSWORD_TOKEN, { user_id: selectedUser.id });
      toast({ title: t('SystemUsersPage.initialPasswordSentTitle'), description: t('SystemUsersPage.initialPasswordSentDescription') });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: error instanceof Error ? error.message : t('SystemUsersPage.initialPasswordError') });
    }
  };

  const handleCloseDetails = () => {
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

  const onDetailSubmit = async (data: DoctorFormValues) => {
    setDetailError(null);
    detailForm.clearErrors();
    setIsSavingDetail(true);
    try {
      await upsertUser(data);
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
      };
      setSelectedUser(updated);
      setUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
    } catch (error: any) {
      const errorData = error.data?.error || (Array.isArray(error.data) && error.data[0]?.error);
      setDetailError(errorData?.message || (error instanceof Error ? error.message : t('DoctorsPage.createDialog.validation.genericError')));
    } finally {
      setIsSavingDetail(false);
    }
  };

  const onSubmit = async (data: DoctorFormValues) => {
    setSubmissionError(null);
    form.clearErrors();

    try {
      await upsertUser(data);
      toast({
        title: t('DoctorsPage.createDialog.createSuccessTitle'),
        description: t('DoctorsPage.createDialog.createSuccessDescription'),
      });
      setIsDialogOpen(false);
      loadUsers();

    } catch (error: any) {
      const errorData = error.data?.error || (Array.isArray(error.data) && error.data[0]?.error);
      if (errorData?.code === 'unique_conflict' && errorData?.conflictedFields) {
        const fields = errorData.conflictedFields.map((f: string) => t(`DoctorsPage.createDialog.validation.fields.${f}`)).join(', ');
        setSubmissionError(t('DoctorsPage.createDialog.validation.uniqueConflict', { fields }));
      } else if ((error.status === 400 || error.status === 409) && errorData?.errors) {
        const errors = Array.isArray(errorData.errors) ? errorData.errors : [];
        if (errors.length > 0) {
          errors.forEach((err: { field: any; message: string }) => {
            if (err.field) {
              form.setError(err.field as keyof DoctorFormValues, {
                type: 'manual',
                message: err.message,
              });
            }
          });
        } else {
          setSubmissionError(errorData?.message || t('DoctorsPage.createDialog.validation.genericError'));
        }
      } else if (error.status >= 500) {
        setSubmissionError(t('DoctorsPage.createDialog.validation.serverError'));
      } else {
        const errorMessage = typeof error.data === 'string' ? error.data : errorData?.message || (error instanceof Error ? error.message : t('DoctorsPage.createDialog.validation.genericError'));
        setSubmissionError(errorMessage);
      }
    }
  };

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
    isLoading: isRefreshing,
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
                    <Button variant="outline" size="sm" onClick={handleSendInitialPassword}>
                      <KeyRound className="mr-2 h-4 w-4" />
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
                    { id: 'availability', icon: CalendarClock, label: t('DoctorsPage.tabs.availability') },
                    { id: 'exceptions', icon: CalendarX, label: t('DoctorsPage.tabs.exceptions') },
                  ] satisfies VerticalTab[]}
                  activeTabId={activeTab}
                  onTabClick={(tab) => setActiveTab(tab.id)}
                />
                <div className="flex-1 overflow-auto px-4 py-4">
                  {activeTab === 'details' && (
                    <Form {...detailForm}>
                      <form onSubmit={detailForm.handleSubmit(onDetailSubmit)} className="space-y-4">
                        {detailError && (
                          <Alert variant="destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>{t('DoctorsPage.createDialog.validation.errorTitle')}</AlertTitle>
                            <AlertDescription>{detailError}</AlertDescription>
                          </Alert>
                        )}
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
                                    <CommandEmpty>{t('General.noResults')}</CommandEmpty>
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
                        <FormField control={detailForm.control} name="is_active" render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                            <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            <FormLabel>{t('DoctorsPage.createDialog.isActive')}</FormLabel>
                          </FormItem>
                        )} />
                        <div className="flex gap-2 pt-2">
                          <Button type="submit" disabled={isSavingDetail}>
                            {isSavingDetail ? t('DoctorsPage.createDialog.editSave') + '...' : t('DoctorsPage.createDialog.editSave')}
                          </Button>
                        </div>
                      </form>
                    </Form>
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
                </div>
              </CardContent>
            </Card>
          )
        }
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('DoctorsPage.createDialog.createTitle')}</DialogTitle>
            <DialogDescription>{t('DoctorsPage.createDialog.createDescription')}</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
              <DialogBody className="space-y-4 px-6 py-4">
                {submissionError && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>{t('DoctorsPage.createDialog.validation.errorTitle')}</AlertTitle>
                    <AlertDescription>{submissionError}</AlertDescription>
                  </Alert>
                )}
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
                              <CommandEmpty>{t('General.noResults')}</CommandEmpty>
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
              </DialogBody>
              <DialogFooter>
                <Button type="submit">{t('DoctorsPage.createDialog.save')}</Button>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>{t('DoctorsPage.createDialog.cancel')}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
