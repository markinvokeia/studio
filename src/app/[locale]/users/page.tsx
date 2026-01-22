
'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { DataTable } from '@/components/ui/data-table';
import { DataTableAdvancedToolbar } from '@/components/ui/data-table-advanced-toolbar';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PhoneInput } from '@/components/ui/phone-input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MedicalHistory } from '@/components/users/medical-history';
import { UserAppointments } from '@/components/users/user-appointments';
import { UserInvoices } from '@/components/users/user-invoices';
import { UserLogs } from '@/components/users/user-logs';
import { UserMessages } from '@/components/users/user-messages';
import { UserOrders } from '@/components/users/user-orders';
import { UserPayments } from '@/components/users/user-payments';
import { UserQuotes } from '@/components/users/user-quotes';
import { UserServices } from '@/components/users/user-services';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { User, UserRole, Quote } from '@/lib/types';
import { cn } from '@/lib/utils';
import { api } from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnDef, ColumnFiltersState, PaginationState, RowSelectionState } from '@tanstack/react-table';
import { endOfDay, endOfMonth, endOfWeek, format, startOfDay, startOfMonth, startOfWeek } from 'date-fns';
import { isValidPhoneNumber } from 'libphonenumber-js';
import { AlertTriangle, Banknote, Check, CreditCard, DollarSign, Filter, KeyRound, Receipt, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { DateRange } from 'react-day-picker';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { UserColumnsWrapper } from './columns';
import { TwoPanelLayout } from '@/components/layout/two-panel-layout';

const userFormSchema = (t: (key: string) => string) => z.object({
  id: z.string().optional(),
  name: z.string().min(1, { message: t('UsersPage.createDialog.validation.nameRequired') }),
  email: z.string().email({ message: t('UsersPage.createDialog.validation.emailInvalid') }),
  phone: z.string().refine(isValidPhoneNumber, { message: t('UsersPage.createDialog.validation.phoneInvalid') }),
  identity_document: z.string()
    .regex(/^\d+$/, { message: t('UsersPage.createDialog.validation.identityInvalid') })
    .max(10, { message: t('UsersPage.createDialog.validation.identityMaxLength') }),
  birth_date: z.string().optional(),
  is_active: z.boolean().default(false),
});

type UserFormValues = z.infer<ReturnType<typeof userFormSchema>>;

type GetUsersResponse = {
  users: User[];
  total: number;
};

const UserStats = ({ user, t }: { user: User, t: (key: string) => string }) => {
  const formatCurrency = (value: any, currency: 'USD' | 'UYU') => {
    const symbol = currency === 'USD' ? 'U$S' : '$U';
    const numericValue = Number(value) || 0;
    const formattedValue = new Intl.NumberFormat('es-UY', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numericValue);
    return `${symbol} ${formattedValue}`;
  };

  const renderStatValue = (value: any) => {
    const usdValue = value?.USD ?? 0;
    const uyuValue = value?.UYU ?? 0;

    return (
      <div className="text-lg font-bold">
        <div>{formatCurrency(usdValue, 'USD')}</div>
        <div>{formatCurrency(uyuValue, 'UYU')}</div>
      </div>
    );
  };

  const stats = [
    { title: t('UsersPage.stats.totalInvoiced'), value: user.total_invoiced, icon: Receipt, color: 'text-blue-500' },
    { title: t('UsersPage.stats.totalPaid'), value: user.total_paid, icon: DollarSign, color: 'text-green-500' },
    { title: t('UsersPage.stats.currentDebt'), value: user.current_debt, icon: CreditCard, color: 'text-red-500' },
    { title: t('UsersPage.stats.availableBalance'), value: user.available_balance, icon: Banknote, color: 'text-indigo-500' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {stats.map(stat => (
        <Card key={stat.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
            <stat.icon className={cn("h-4 w-4 text-muted-foreground", stat.color)} />
          </CardHeader>
          <CardContent>
            {renderStatValue(stat.value)}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};


function formatBirthDate(dateStr: string | undefined): string {
  if (!dateStr) return '';

  // If already in YYYY-MM-DD format, return as is
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }

  // If in DD/MM/YYYY format, convert to YYYY-MM-DD
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
    const [day, month, year] = dateStr.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // If it's a timestamp or other format, try to parse
  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  } catch {
    // Ignore parsing errors
  }

  return dateStr; // Return as is if can't format
}

async function getUsers(pagination: PaginationState, searchQuery: string, onlyDebtors: boolean, dateRange?: DateRange): Promise<GetUsersResponse> {
  try {
    const query: Record<string, string> = {
      page: (pagination.pageIndex + 1).toString(),
      limit: pagination.pageSize.toString(),
      search: searchQuery,
      filter_type: "PACIENTE",
      only_debtors: String(onlyDebtors)
    };

    if (dateRange?.from) {
      const dateFrom = new Date(dateRange.from);
      dateFrom.setHours(0, 0, 0, 0);
      query.date_from = dateFrom.toISOString();
    }

    if (dateRange?.to) {
      const dateTo = new Date(dateRange.to);
      dateTo.setHours(23, 59, 59, 999);
      query.date_to = dateTo.toISOString();
    }

    const responseData = await api.get(API_ROUTES.USERS, query);

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
      id: apiUser.id ? String(apiUser.id) : `usr_${Math.random().toString(36).substr(2, 9)}`,
      name: apiUser.name || 'No Name',
      email: apiUser.email || 'no-email@example.com',
      phone_number: apiUser.phone_number || '000-000-0000',
      is_active: apiUser.is_active !== undefined ? apiUser.is_active : true,
      identity_document: apiUser.identity_document,
      birth_date: formatBirthDate(apiUser.birth_date || apiUser.birthday),
      avatar: apiUser.avatar || `https://picsum.photos/seed/${apiUser.id || Math.random()}/40/40`,
      total_invoiced: apiUser.total_invoiced,
      total_paid: apiUser.total_paid,
      current_debt: apiUser.current_debt,
      available_balance: apiUser.available_balance,
    }));

    return { users: mappedUsers, total };
  } catch (error) {
    console.error("Failed to fetch users:", error);
    return { users: [], total: 0 };
  }
}

async function upsertUser(userData: UserFormValues) {
  const responseData = await api.post(API_ROUTES.USERS_UPSERT, { ...userData, filter_type: 'PACIENTE', is_sales: true });

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

export default function UsersPage() {
  const t = useTranslations();

  const { toast } = useToast();
  const [users, setUsers] = React.useState<any[]>([]);
  const [userCount, setUserCount] = React.useState(0);
  const [selectedUser, setSelectedUser] = React.useState<User | null>(null);
  const [selectedUserRoles, setSelectedUserRoles] = React.useState<UserRole[]>([]);
  const [selectedQuote, setSelectedQuote] = React.useState<Quote | null>(null);
  const [isRolesLoading, setIsRolesLoading] = React.useState(false);
  const [editingUser, setEditingUser] = React.useState<User | null>(null);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [submissionError, setSubmissionError] = React.useState<string | null>(null);
  const [canSetFirstPassword, setCanSetFirstPassword] = React.useState(false);


  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [date, setDate] = React.useState<DateRange | undefined>(undefined);
  const [datePreset, setDatePreset] = React.useState<string | null>('allTime');
  const [showDebtors, setShowDebtors] = React.useState(false);

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema(t)),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      identity_document: '',
      birth_date: '',
      is_active: true,
    },
  });

  const loadUsers = React.useCallback(async () => {
    setIsRefreshing(true);
    const searchQuery = (columnFilters.find(f => f.id === 'email')?.value as string) || '';
    const { users: fetchedUsers, total } = await getUsers(pagination, searchQuery, showDebtors, date);
    setUsers(fetchedUsers);
    setUserCount(total);
    setIsRefreshing(false);
  }, [pagination, columnFilters, date, showDebtors]);

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

  const handleToggleActivate = async (user: User) => {
    try {
      await api.put(API_ROUTES.USERS_ACTIVATE, {
        user_id: user.id,
        is_active: !user.is_active,
      });

      toast({
        title: 'Success',
        description: `Patient ${user.name} has been ${user.is_active ? 'deactivated' : 'activated'}.`,
      });

      loadUsers();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not update patient status.',
      });
      console.error(error);
    }
  };

  const handleCreate = () => {
    setEditingUser(null);
    form.reset({
      name: '',
      email: '',
      phone: '',
      identity_document: '',
      birth_date: '',
      is_active: true,
    });
    setSubmissionError(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    form.reset({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone_number,
      identity_document: user.identity_document,
      birth_date: user.birth_date || '',
      is_active: user.is_active,
    });
    setSubmissionError(null);
    setIsDialogOpen(true);
  };

  const userColumns = UserColumnsWrapper({ onToggleActivate: handleToggleActivate, onEdit: handleEdit });

  const debtorColumns: ColumnDef<User>[] = [
    {
      id: 'select',
      header: () => null,
      cell: ({ row, table }) => {
        const isSelected = row.getIsSelected();
        return (
          <RadioGroup
            value={isSelected ? row.original.id : ''}
            onValueChange={() => {
              if (handleRowSelectionChange) {
                table.toggleAllPageRowsSelected(false);
                row.toggleSelected(true);
                handleRowSelectionChange([row.original]);
              }
            }}
          >
            <RadioGroupItem value={row.original.id} id={row.original.id} aria-label="Select row" />
          </RadioGroup>
        );
      },
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: 'name',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('UserColumns.name')} />,
    },
    {
      accessorKey: 'email',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('UserColumns.email')} />,
    },
    {
      accessorKey: 'identity_document',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('UserColumns.identity_document')} />,
    },
    {
      id: 'debt_uyu',
      header: `${t('UserColumns.currentDebt')} (UYU)`,
      cell: ({ row }) => {
        const debt = row.original.current_debt?.UYU;
        return debt ? `$${Number(debt).toFixed(2)}` : '-';
      },
    },
    {
      id: 'debt_usd',
      header: `${t('UserColumns.currentDebt')} (USD)`,
      cell: ({ row }) => {
        const debt = row.original.current_debt?.USD;
        return debt ? `$${Number(debt).toFixed(2)}` : '-';
      },
    },
  ];

  const handleRowSelectionChange = (selectedRows: User[]) => {
    const user = selectedRows.length > 0 ? selectedRows[0] : null;
    setSelectedUser(user);
  };

  React.useEffect(() => {
    const checkFirstPasswordRequirements = async () => {
      if (!selectedUser) {
        setCanSetFirstPassword(false);
        return;
      }

      const token = localStorage.getItem('token');
      if (!token) {
        setCanSetFirstPassword(false);
        return;
      }

      try {
        await api.get(API_ROUTES.SYSTEM.API_AUTH_CHECK_FIRST_PASSWORD, { user_id: selectedUser.id });
        setCanSetFirstPassword(true);
      } catch (error) {
        console.error("Failed to check first password requirements:", error);
        setCanSetFirstPassword(false);
      }
    };

    if (selectedUser) {
      loadUserRoles(selectedUser.id);
      checkFirstPasswordRequirements();
    } else {
      setSelectedUserRoles([]);
      setCanSetFirstPassword(false);
    }
  }, [selectedUser, loadUserRoles]);

  const handleCloseDetails = () => {
    setSelectedUser(null);
    setSelectedQuote(null);
    setRowSelection({});
  };

  const onSubmit = async (data: UserFormValues) => {
    setSubmissionError(null);
    form.clearErrors();

    try {
      await upsertUser(data);
      const isEditing = !!editingUser;

      toast({
        title: isEditing ? t('UsersPage.createDialog.editSuccessTitle') : t('UsersPage.createDialog.createSuccessTitle'),
        description: isEditing ? t('UsersPage.createDialog.editSuccessDescription') : t('UsersPage.createDialog.createSuccessDescription'),
      });
      setIsDialogOpen(false);
      loadUsers();

    } catch (error: any) {
      const errorData = error.data?.error || (Array.isArray(error.data) && error.data[0]?.error);
      if (errorData?.code === 'unique_conflict' && errorData?.conflictedFields) {
        const fields = errorData.conflictedFields.map((f: string) => t(`UsersPage.createDialog.validation.fields.${f}`)).join(', ');
        setSubmissionError(t('UsersPage.createDialog.validation.uniqueConflict', { fields }));
      } else if ((error.status === 400 || error.status === 409) && errorData?.errors) {
        const errors = Array.isArray(errorData.errors) ? errorData.errors : [];
        if (errors.length > 0) {
          errors.forEach((err: { field: any; message: string }) => {
            if (err.field) {
              form.setError(err.field as keyof UserFormValues, {
                type: 'manual',
                message: err.message,
              });
            }
          });
        } else {
          setSubmissionError(errorData?.message || t('UsersPage.createDialog.validation.genericError'));
        }
      } else if (error.status >= 500) {
        setSubmissionError(t('UsersPage.createDialog.validation.serverError'));
      } else {
        const errorMessage = typeof error.data === 'string' ? error.data : errorData?.message || (error instanceof Error ? error.message : t('UsersPage.createDialog.validation.genericError'));
        setSubmissionError(errorMessage);
      }
    }
  };

  const handleSendInitialPassword = async () => {
    if (!selectedUser) return;
    try {
      const responseData = await api.post(API_ROUTES.SYSTEM.API_AUTH_FIRST_TIME_PASSWORD_TOKEN, { user_id: selectedUser.id });
      toast({ title: 'Email Sent', description: responseData.message });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: error instanceof Error ? error.message : 'An unexpected error occurred.' });
    }
  };

  const handleDatePreset = (preset: 'today' | 'week' | 'month' | 'allTime') => {
    setDatePreset(preset);
    if (preset === 'today') {
      setDate({ from: startOfDay(new Date()), to: endOfDay(new Date()) });
    } else if (preset === 'week') {
      setDate({ from: startOfWeek(new Date(), { weekStartsOn: 1 }), to: endOfWeek(new Date(), { weekStartsOn: 1 }) });
    } else if (preset === 'month') {
      setDate({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) });
    } else if (preset === 'allTime') {
      setDate(undefined);
    }
  };

  const handleDateChange = (newDate: DateRange | undefined) => {
    if (newDate?.from && newDate?.to) {
      setDate({ from: startOfDay(newDate.from), to: endOfDay(newDate.to) });
    } else {
      setDate(newDate);
    }
    setDatePreset(null); // Custom range
  };

  /* 
   * NEW FILTER API LOGIC 
   */

  // Helper to sync 'date' state with 'datePreset' label for the filter chips
  // When 'date' changes manually (via calendar), we might lose the preset label unless we track it.
  // But for now, we rely on 'datePreset' state for the chip labels.

  const handleClearFilters = () => {
    setDatePreset('allTime');
    setDate(undefined);
    setShowDebtors(false);
    setColumnFilters((prev) => prev.filter(f => f.id !== 'email')); // Clear search too if desired, or keep it separate.
    // Usually "Clear Filters" implies clearing the dropdown filters, not necessarily the text search.
    // If we want to clear text search, we can do that too. 
    // Let's clear search too for a full reset? Or maybe just the "advanced" filters.
    // The UI shows "My Pipeline" with an X, and search text separate.
    // For now, let's clear the toggleable filters. 
  };

  const filtersOptionList = [
    {
      value: 'allTime',
      label: t('UsersPage.filters.date.allTime'),
      group: t('UsersPage.filters.date.label'),
      isActive: datePreset === 'allTime',
      onSelect: () => handleDatePreset('allTime'),
    },
    {
      value: 'today',
      label: t('UsersPage.filters.date.today'),
      group: t('UsersPage.filters.date.label'),
      isActive: datePreset === 'today',
      onSelect: () => handleDatePreset('today'),
    },
    {
      value: 'week',
      label: t('UsersPage.filters.date.thisWeek'),
      group: t('UsersPage.filters.date.label'),
      isActive: datePreset === 'week',
      onSelect: () => handleDatePreset('week'),
    },
    {
      value: 'month',
      label: t('UsersPage.filters.date.thisMonth'),
      group: t('UsersPage.filters.date.label'),
      isActive: datePreset === 'month',
      onSelect: () => handleDatePreset('month'),
    },
    // Custom range is tricky as a simple toggle, usually involves a dialog. 
    // For now, we can keep the DatePicker popover separate OR integrate it.
    // The requirement asks for "Date Range" filters. 
    // Let's keep the predefined ranges first.

    {
      value: 'debtors',
      label: t('UsersPage.filters.showOnlyDebtors'),
      group: 'Status', // Or translate "Status"
      isActive: showDebtors,
      onSelect: () => setShowDebtors(!showDebtors),
    }
  ];

  return (
    <>
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <TwoPanelLayout
          minLeftSize={20}
          isRightPanelOpen={!!selectedUser}
          leftPanel={
            <Card className="h-full flex flex-col">
              <CardHeader className="flex-none">
                <CardTitle>{t('UsersPage.title')}</CardTitle>
                <CardDescription>{t('UsersPage.description')}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden flex flex-col min-h-0">
                <DataTable
                  columns={showDebtors ? debtorColumns : userColumns}
                  data={users}
                  filterColumnId="email"
                  filterPlaceholder={t('UsersPage.filterPlaceholder')}
                  onRowSelectionChange={handleRowSelectionChange}
                  enableSingleRowSelection={true}
                  onCreate={handleCreate}
                  onRefresh={loadUsers}
                  isRefreshing={isRefreshing}
                  rowSelection={rowSelection}
                  setRowSelection={setRowSelection}
                  pageCount={Math.ceil(userCount / pagination.pageSize)}
                  pagination={pagination}
                  onPaginationChange={setPagination}
                  manualPagination={true}
                  columnFilters={columnFilters}
                  onColumnFiltersChange={setColumnFilters}
                  customToolbar={(table) => (
                    <DataTableAdvancedToolbar
                      table={table}
                      filterPlaceholder={t('UsersPage.filterPlaceholder')}
                      searchQuery={(columnFilters.find(f => f.id === 'email')?.value as string) || ''}
                      onSearchChange={(value) => {
                        setColumnFilters((prev) => {
                          const newFilters = prev.filter((f) => f.id !== 'email');
                          if (value) {
                            newFilters.push({ id: 'email', value });
                          }
                          return newFilters;
                        });
                      }}
                      filters={filtersOptionList}
                      onClearFilters={handleClearFilters}
                      onCreate={handleCreate}
                      onRefresh={loadUsers}
                      isRefreshing={isRefreshing}
                      extraButtons={null}
                      columnTranslations={{
                        name: t('UserColumns.name'),
                        email: t('UserColumns.email'),
                        identity_document: t('UserColumns.identity_document'),
                        phone_number: t('UserColumns.phone'),
                        is_active: t('UserColumns.status'),
                        debt_uyu: `${t('UserColumns.currentDebt')} (UYU)`,
                        debt_usd: `${t('UserColumns.currentDebt')} (USD)`,
                      }}
                    />
                  )}
                  columnTranslations={{
                    name: t('UserColumns.name'),
                    email: t('UserColumns.email'),
                    identity_document: t('UserColumns.identity_document'),
                    phone_number: t('UserColumns.phone'),
                    is_active: t('UserColumns.status'),
                    debt_uyu: `${t('UserColumns.currentDebt')} (UYU)`,
                    debt_usd: `${t('UserColumns.currentDebt')} (USD)`,
                  }}
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
                    {canSetFirstPassword && (
                      <Button variant="outline" size="sm" onClick={handleSendInitialPassword}>
                        <KeyRound className="mr-2 h-4 w-4" />
                        {t('UsersPage.setInitialPassword')}
                      </Button>
                    )}
                    <Button variant="destructive-ghost" size="icon" onClick={handleCloseDetails}>
                      <X className="h-5 w-5" />
                      <span className="sr-only">{t('UsersPage.close')}</span>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden flex flex-col min-h-0">
                  <UserStats user={selectedUser} t={t} />
                  <Tabs defaultValue="history" className="w-full flex-1 flex flex-col min-h-0">
                    <TabsList className="h-auto items-center justify-start flex-wrap flex-none">
                      <TabsTrigger value="history">{t('UsersPage.tabs.history')}</TabsTrigger>
                      {selectedUserRoles.some(role => role.name.toLowerCase() === 'medico' && role.is_active) && (
                        <TabsTrigger value="services">{t('UsersPage.tabs.services')}</TabsTrigger>
                      )}
                      <TabsTrigger value="quotes">{t('UsersPage.tabs.quotes')}</TabsTrigger>
                      <TabsTrigger value="orders">{t('UsersPage.tabs.orders')}</TabsTrigger>
                      <TabsTrigger value="invoices">{t('UsersPage.tabs.invoices')}</TabsTrigger>
                      <TabsTrigger value="payments">{t('UsersPage.tabs.payments')}</TabsTrigger>
                      <TabsTrigger value="appointments">{t('UsersPage.tabs.appointments')}</TabsTrigger>
                      <TabsTrigger value="messages">{t('UsersPage.tabs.messages')}</TabsTrigger>
                      <TabsTrigger value="logs">{t('UsersPage.tabs.logs')}</TabsTrigger>
                    </TabsList>
                    <div className="flex-1 overflow-hidden flex flex-col min-h-0 mt-4">
                      <TabsContent value="history" className="m-0 flex-1 min-h-0 data-[state=active]:flex data-[state=active]:flex-col">
                        <MedicalHistory user={selectedUser} />
                      </TabsContent>
                      {selectedUserRoles.some(role => role.name.toLowerCase() === 'medico' && role.is_active) && (
                        <TabsContent value="services" className="m-0 flex-1 min-h-0 data-[state=active]:flex data-[state=active]:flex-col">
                          <UserServices userId={selectedUser.id} isSalesUser={true} />
                        </TabsContent>
                      )}
                      <TabsContent value="quotes" className="m-0 flex-1 min-h-0 data-[state=active]:flex data-[state=active]:flex-col">
                        <UserQuotes userId={selectedUser.id} onQuoteSelect={setSelectedQuote} />
                      </TabsContent>
                      <TabsContent value="orders" className="m-0 flex-1 min-h-0 data-[state=active]:flex data-[state=active]:flex-col">
                        <UserOrders userId={selectedUser.id} selectedQuote={selectedQuote} />
                      </TabsContent>
                      <TabsContent value="invoices" className="m-0 flex-1 min-h-0 data-[state=active]:flex data-[state=active]:flex-col">
                        <UserInvoices userId={selectedUser.id} />
                      </TabsContent>
                      <TabsContent value="payments" className="m-0 flex-1 min-h-0 data-[state=active]:flex data-[state=active]:flex-col">
                        <UserPayments userId={selectedUser.id} selectedQuote={selectedQuote} />
                      </TabsContent>
                      <TabsContent value="appointments" className="m-0 flex-1 min-h-0 data-[state=active]:flex data-[state=active]:flex-col">
                        <UserAppointments user={selectedUser} />
                      </TabsContent>
                      <TabsContent value="messages" className="m-0 flex-1 min-h-0 data-[state=active]:flex data-[state=active]:flex-col">
                        <UserMessages userId={selectedUser.id} />
                      </TabsContent>
                      <TabsContent value="logs" className="m-0 flex-1 min-h-0 data-[state=active]:flex data-[state=active]:flex-col">
                        <UserLogs userId={selectedUser.id} />
                      </TabsContent>
                    </div>
                  </Tabs>
                </CardContent>
              </Card>
            )
          }
        />
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUser ? t('UsersPage.createDialog.editTitle') : t('UsersPage.createDialog.title')}</DialogTitle>
            <DialogDescription>{editingUser ? t('UsersPage.createDialog.editDescription') : t('UsersPage.createDialog.description')}</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {submissionError && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>{t('UsersPage.createDialog.validation.errorTitle')}</AlertTitle>
                  <AlertDescription>{submissionError}</AlertDescription>
                </Alert>
              )}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('UsersPage.createDialog.name')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('UsersPage.createDialog.namePlaceholder')} {...field} />
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
                    <FormLabel>{t('UsersPage.createDialog.email')}</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder={t('UsersPage.createDialog.emailPlaceholder')} {...field} />
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
                    <FormLabel>{t('UsersPage.createDialog.phone')}</FormLabel>
                    <FormControl>
                      <PhoneInput
                        {...field}
                        defaultCountry="UY"
                        placeholder={t('UsersPage.createDialog.phonePlaceholder')}
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
                    <FormLabel>{t('UsersPage.createDialog.identity_document')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('UsersPage.createDialog.identity_document_placeholder')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="birth_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('UsersPage.createDialog.birth_date')}</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        placeholder={t('UsersPage.createDialog.birth_date_placeholder')}
                        {...field}
                        max={new Date().toISOString().split('T')[0]}
                        min="1900-01-01"
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
                    <FormLabel>{t('UsersPage.createDialog.isActive')}</FormLabel>
                  </FormItem>
                )}
              />
              <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>{t('UsersPage.createDialog.cancel')}</Button>
                <Button type="submit">{editingUser ? t('UsersPage.createDialog.editSave') : t('UsersPage.createDialog.save')}</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
