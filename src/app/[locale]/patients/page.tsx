'use client';

import { TwoPanelLayout } from '@/components/layout/two-panel-layout';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { CollapsibleTrigger } from '@/components/ui/collapsible';
import { DataCard } from '@/components/ui/data-card';
import { DataTable } from '@/components/ui/data-table';
import { DataTableAdvancedToolbar } from '@/components/ui/data-table-advanced-toolbar';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { DatePicker, DatePickerInput } from '@/components/ui/date-picker';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PhoneInput } from '@/components/ui/phone-input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { VerticalTabStrip } from '@/components/ui/vertical-tab-strip';
import type { VerticalTab } from '@/components/ui/vertical-tab-strip';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AppointmentFormDialog } from '@/components/appointments/AppointmentFormDialog';
import { InvoiceFormDialog } from '@/components/tables/invoices-table';
import { PrepaidFormDialog } from '@/components/sales/payments/PrepaidFormDialog';
import { QuoteFormDialog } from '@/components/sales/quotes/QuoteFormDialog';
import { ClinicHistoryViewer } from '@/components/users/clinic-history-viewer';
import { UserAppointments } from '@/components/users/user-appointments';
import { UserCommunicationPreferences } from '@/components/users/user-communication-preferences';
import { UserFinancialSummaryStats } from '@/components/users/user-financial-summary-stats';
import { UserInvoices } from '@/components/users/user-invoices';
import { UserLogs } from '@/components/users/user-logs';
import { UserMessages } from '@/components/users/user-messages';
import { UserOrders } from '@/components/users/user-orders';
import { UserPayments } from '@/components/users/user-payments';
import { UserQuotes } from '@/components/users/user-quotes';
import { UserServices } from '@/components/users/user-services';
import { PATIENTS_PERMISSIONS } from '@/constants/permissions';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { Calendar as CalendarType, PatientDischarge, Quote, Service, User, UserFinancial, UserRole, MutualSociety } from '@/lib/types';
import { getSalesServices, getUsersServicesBatch } from '@/services/services';
import { cn, formatDisplayDate } from '@/lib/utils';
import { api } from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnDef, ColumnFiltersState, PaginationState, RowSelectionState } from '@tanstack/react-table';
import { addMonths, differenceInYears, endOfDay, endOfMonth, endOfWeek, format, parseISO, startOfDay, startOfMonth, startOfWeek } from 'date-fns';
import { isValidPhoneNumber } from 'libphonenumber-js';
import { AlertTriangle, Cake, CalendarIcon, CheckCircle, ChevronDown, CreditCard, FileText, Heart, History, Loader2, Mail, Maximize2, MessageSquare, Minimize2, Plus, Printer, Receipt, ShoppingCart, SlidersHorizontal, Stethoscope, StickyNote, ToggleLeft, Upload, Users, Wrench, X, XCircle } from 'lucide-react';
import { WhatsAppIcon } from '@/components/icons/whatsapp-icon';
import { EmailComposerDialog } from '@/components/email-composer-dialog';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { DateRange } from 'react-day-picker';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { UserColumnsWrapper } from './columns';
import { useDeepLink } from '@/hooks/use-deep-link';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';

const userFormSchema = (t: (key: string) => string) => z.object({
  id: z.string().optional(),
  name: z.string().min(1, { message: t('UsersPage.createDialog.validation.nameRequired') }),
  email: z.string().optional().refine(val => {
    if (!val || val.trim() === '') return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  }, { message: t('UsersPage.createDialog.validation.emailInvalid') }),
  phone: z.string().optional().refine(val => {
    if (!val || val.trim() === '') return true;
    return isValidPhoneNumber(val);
  }, { message: t('UsersPage.createDialog.validation.phoneInvalid') }),
  identity_document: z.string()
    .min(1, { message: t('UsersPage.createDialog.validation.identityRequired') })
    .regex(/^\d*$/, { message: t('UsersPage.createDialog.validation.identityInvalid') })
    .max(10, { message: t('UsersPage.createDialog.validation.identityMaxLength') }),
  birth_date: z.string().optional(),
  notes: z.string().optional(),
  is_active: z.boolean().default(false),
  mutual_society_id: z.string().optional(),
}).refine((data) => {
  const hasEmail = data.email && data.email.trim() !== '';
  const hasPhone = data.phone && data.phone.trim() !== '';
  return hasEmail || hasPhone;
}, {
  message: t('UsersPage.createDialog.validation.emailOrPhoneRequired'),
  path: ['email'],
});

type UserFormValues = z.infer<ReturnType<typeof userFormSchema>>;

type GetUsersResponse = {
  users: User[];
  total: number;
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

async function getUsers(pagination: PaginationState, searchQuery: string, onlyDebtors: boolean, onlyActive: boolean, dateRange?: DateRange): Promise<GetUsersResponse> {
  try {
    const query: Record<string, string> = {
      page: (pagination.pageIndex + 1).toString(),
      limit: pagination.pageSize.toString(),
      search: searchQuery,
      filter_type: "PACIENTE",
      only_debtors: String(onlyDebtors),
      only_active: String(onlyActive)
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
      id: String(apiUser.id),
      name: apiUser.name || '',
      email: apiUser.email || '',
      phone_number: apiUser.phone_number || '',
      is_active: apiUser.is_active !== undefined ? apiUser.is_active : true,
      identity_document: apiUser.identity_document,
      birth_date: formatBirthDate(apiUser.birth_date || apiUser.birthday),
      avatar: apiUser.avatar || `https://picsum.photos/seed/${apiUser.id || Math.random()}/40/40`,
      total_invoiced: apiUser.total_invoiced,
      total_paid: apiUser.total_paid,
      current_debt: apiUser.current_debt,
      available_balance: apiUser.available_balance,
      notes: apiUser.notes,
      mutual_society_id: apiUser.mutual_society_id,
      mutual_society_name: apiUser.mutual_society_name,
    }));

    return { users: mappedUsers, total };
  } catch (error) {
    console.error("Failed to fetch users:", error);
    return { users: [], total: 0 };
  }
}

async function fetchCalendarsForAppt(): Promise<CalendarType[]> {
  try {
    const data = await api.get(API_ROUTES.CALENDARS);
    const list = Array.isArray(data) ? data : (data.calendars || data.data || data.result || []);
    return list.map((c: any) => ({
      id: c.id || c.google_calendar_id,
      name: c.name,
      google_calendar_id: c.google_calendar_id,
      is_active: c.is_active,
      color: c.color,
    }));
  } catch { return []; }
}

async function fetchDoctorsForAppt(): Promise<User[]> {
  try {
    const data = await api.get(API_ROUTES.USERS, { filter_type: 'DOCTOR' });
    let list: any[] = [];
    if (Array.isArray(data) && data.length > 0) {
      const first = data[0];
      list = first.json?.data || first.data || [];
    } else if (data?.data) {
      list = data.data;
    }
    return list.map((d: any) => ({ ...d, id: String(d.id) }));
  } catch { return []; }
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

async function getMutualSocietiesList(): Promise<MutualSociety[]> {
  try {
    const data = await api.get(API_ROUTES.MUTUAL_SOCIETIES, { page: '1', limit: '1000' });

    let mutualSocietiesData: any[] = [];

    if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object' && 'id' in data[0] && !('json' in data[0])) {
      mutualSocietiesData = data;
    } else if (Array.isArray(data) && data.length > 0) {
      const firstElement = data[0];
      if (firstElement.json && typeof firstElement.json === 'object') {
        mutualSocietiesData = firstElement.json.data || [];
      } else if (firstElement.data) {
        mutualSocietiesData = firstElement.data;
      }
    } else if (typeof data === 'object' && data !== null) {
      const responseObj = data[0]?.json || data;
      mutualSocietiesData = responseObj.data || [];
    }

    return mutualSocietiesData.map((ms: any) => ({
      id: ms.id,
      name: ms.name,
      description: ms.description,
      code: ms.code,
      is_active: ms.is_active ?? true,
      created_at: ms.created_at,
      updated_at: ms.updated_at,
    })).filter((ms: MutualSociety) => ms.id !== undefined && ms.id !== null && ms.is_active);
  } catch (error) {
    console.error("Failed to fetch mutual societies:", error);
    return [];
  }
}

const NotesTab = ({ user, onUpdate }: { user: User, onUpdate: (notes: string) => void }) => {
  const t = useTranslations();
  const [isEditing, setIsEditing] = React.useState(false);
  const [notes, setNotes] = React.useState(user.notes || '');
  const [isSaving, setIsSaving] = React.useState(false);
  const { toast } = useToast();

  React.useEffect(() => {
    setNotes(user.notes || '');
  }, [user.notes]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onUpdate(notes);
      setIsEditing(false);
      toast({
        title: t('UsersPage.notes.saveSuccess'),
        description: t('UsersPage.notes.saveSuccessDescription'),
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('UsersPage.notes.saveError'),
        description: t('UsersPage.notes.saveErrorDescription'),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setNotes(user.notes || '');
    setIsEditing(false);
  };

  return (
    <Card className="h-full flex flex-col shadow-none border-0">
      <CardHeader className="flex flex-row items-center justify-between flex-none p-4 pb-2">
        <div className="min-w-0 flex-1">
          <CardTitle className="text-lg text-foreground font-bold">{t('UsersPage.notes.title')}</CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            {t('UsersPage.notes.description')}
          </CardDescription>
        </div>
        <div className="flex items-center gap-2 ml-2">
          {!isEditing && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
            >
              {t('UsersPage.notes.edit')}
            </Button>
          )}
          {isEditing && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                disabled={isSaving}
              >
                {t('UsersPage.notes.cancel')}
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? t('UsersPage.notes.saving') : t('UsersPage.notes.save')}
              </Button>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto p-4 pt-2 bg-card">
        {isEditing ? (
          <div className="h-full flex flex-col">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('UsersPage.notes.placeholder')}
              className="flex-1 min-h-[200px] resize-none"
            />
          </div>
        ) : (
          <div className="h-full">
            {notes ? (
              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                {notes}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <p className="text-center mb-4">
                  {t('UsersPage.notes.noNotes')}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                >
                  {t('UsersPage.notes.addFirstNote')}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const UserInfoTab = ({
  user,
  mutualSocieties,
  onSaved,
}: {
  user: User;
  mutualSocieties: MutualSociety[];
  onSaved: (updated: User) => void;
}) => {
  const t = useTranslations();
  const tV = useTranslations('UsersPage.createDialog.validation');
  const { toast } = useToast();
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  const infoForm = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema(tV)),
    defaultValues: {
      id: user.id,
      name: user.name,
      email: user.email || '',
      phone: user.phone_number || '',
      identity_document: user.identity_document || '',
      birth_date: user.birth_date || '',
      notes: user.notes || '',
      is_active: user.is_active,
      mutual_society_id: user.mutual_society_id ? String(user.mutual_society_id) : '',
    },
  });

  React.useEffect(() => {
    infoForm.reset({
      id: user.id,
      name: user.name,
      email: user.email || '',
      phone: user.phone_number || '',
      identity_document: user.identity_document || '',
      birth_date: user.birth_date || '',
      notes: user.notes || '',
      is_active: user.is_active,
      mutual_society_id: user.mutual_society_id ? String(user.mutual_society_id) : '',
    });
    setSaveError(null);
  }, [user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async (data: UserFormValues) => {
    setIsSaving(true);
    setSaveError(null);
    try {
      await upsertUser(data);
      toast({
        title: t('UsersPage.createDialog.editSuccessTitle'),
        description: t('UsersPage.createDialog.editSuccessDescription'),
      });
      onSaved({ ...user, name: data.name, email: data.email || '', phone_number: data.phone || user.phone_number, identity_document: data.identity_document, birth_date: data.birth_date, notes: data.notes, is_active: data.is_active, mutual_society_id: data.mutual_society_id });
    } catch (e: any) {
      setSaveError(e instanceof Error ? e.message : t('UsersPage.createDialog.validation.genericError'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="overflow-y-auto flex-1 min-h-0 pr-1">
      <Form {...infoForm}>
        <form onSubmit={infoForm.handleSubmit(handleSave)} className="space-y-4 p-2">
          {saveError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{saveError}</AlertDescription>
            </Alert>
          )}
          <FormField control={infoForm.control} name="name" render={({ field }) => (
            <FormItem>
              <FormLabel>{t('UsersPage.createDialog.name')}</FormLabel>
              <FormControl><Input placeholder={t('UsersPage.createDialog.namePlaceholder')} {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={infoForm.control} name="email" render={({ field }) => (
            <FormItem>
              <FormLabel>{t('UsersPage.createDialog.email')}</FormLabel>
              <FormControl><Input type="email" placeholder={t('UsersPage.createDialog.emailPlaceholder')} {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={infoForm.control} name="phone" render={({ field }) => (
            <FormItem>
              <FormLabel>{t('UsersPage.createDialog.phone')}</FormLabel>
              <FormControl>
                <PhoneInput {...field} defaultCountry="UY" placeholder={t('UsersPage.createDialog.phonePlaceholder')} onChange={field.onChange} value={field.value} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={infoForm.control} name="identity_document" render={({ field }) => (
            <FormItem>
              <FormLabel>{t('UsersPage.createDialog.identity_document')}</FormLabel>
              <FormControl><Input placeholder={t('UsersPage.createDialog.identity_document_placeholder')} {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={infoForm.control} name="birth_date" render={({ field }) => (
            <FormItem>
              <FormLabel>{t('UsersPage.createDialog.birth_date')}</FormLabel>
              <FormControl>
                <DatePickerInput value={field.value} onChange={field.onChange} placeholder={t('UsersPage.createDialog.birth_date_placeholder')} disabledDays={(date: Date) => date > new Date() || date < new Date('1900-01-01')} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={infoForm.control} name="mutual_society_id" render={({ field }) => (
            <FormItem>
              <FormLabel>{t('UsersPage.mutualSociety.select')}</FormLabel>
              <Select onValueChange={field.onChange} value={field.value || ''}>
                <FormControl>
                  <SelectTrigger><SelectValue placeholder={t('UsersPage.mutualSociety.select')} /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="none">{t('UsersPage.mutualSociety.none')}</SelectItem>
                  {mutualSocieties.map((ms) => (
                    <SelectItem key={ms.id} value={String(ms.id)}>{ms.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={infoForm.control} name="is_active" render={({ field }) => (
            <FormItem className="flex flex-row items-center space-x-3 space-y-0">
              <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
              <FormLabel>{t('UsersPage.createDialog.isActive')}</FormLabel>
            </FormItem>
          )} />
          <Button type="submit" disabled={isSaving} className="w-full">
            {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</> : 'Guardar'}
          </Button>
        </form>
      </Form>
    </div>
  );
};

// Inner component that reads NarrowModeContext from TwoPanelLayout
function UsersTableWithCards({
  columns, users, selectedUser, handleRowSelectionChange, handleCreate,
  loadUsers, isRefreshing, rowSelection, setRowSelection,
  userCount, pagination, setPagination, columnFilters, setColumnFilters,
  filtersOptionList, handleClearFilters, t,
}: {
  columns: any[];
  users: User[];
  selectedUser: User | null;
  handleRowSelectionChange: (rows: User[]) => void;
  handleCreate?: () => void;
  loadUsers: () => void;
  isRefreshing: boolean;
  rowSelection: RowSelectionState;
  setRowSelection: React.Dispatch<React.SetStateAction<RowSelectionState>>;
  userCount: number;
  pagination: PaginationState;
  setPagination: React.Dispatch<React.SetStateAction<PaginationState>>;
  columnFilters: ColumnFiltersState;
  setColumnFilters: React.Dispatch<React.SetStateAction<ColumnFiltersState>>;
  filtersOptionList: any[];
  handleClearFilters: () => void;
  t: (key: string, values?: any) => string;
}) {
  const isViewportNarrow = useViewportNarrow();
  return (
    <DataTable
      columns={columns}
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
      isNarrow={!!selectedUser || isViewportNarrow}
      renderCard={(user: User) => (
        <DataCard
          title={user.name}
          subtitle={user.email || user.phone_number || user.identity_document || ''}
          avatar={user.name ? user.name.slice(0, 2).toUpperCase() : '?'}
          isSelected={selectedUser?.id === user.id}
          showArrow
          onClick={() => handleRowSelectionChange([user])}
          badge={user.is_active
            ? undefined
            : <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-medium bg-muted text-muted-foreground">Inactivo</span>
          }
        />
      )}
      customToolbar={(table: any) => (
        <DataTableAdvancedToolbar
          table={table}
          isCompact={!!selectedUser}
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
  );
}

export default function UsersPage() {
  const t = useTranslations();
  const { hasPermission } = usePermissions();
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
  const [isDischargeDialogOpen, setIsDischargeDialogOpen] = React.useState(false);
  const [dischargeDate, setDischargeDate] = React.useState<string>('');
  const [currentDischarge, setCurrentDischarge] = React.useState<PatientDischarge | null>(null);
  const [isSubmittingDischarge, setIsSubmittingDischarge] = React.useState(false);
  const [isFinancialSummaryDialogOpen, setIsFinancialSummaryDialogOpen] = React.useState(false);
  const [financialSummaryDateRange, setFinancialSummaryDateRange] = React.useState<{ from: string; to: string }>({
    from: '',
    to: '',
  });
  const [isPrintingFinancialSummary, setIsPrintingFinancialSummary] = React.useState(false);
  const [userFinancialData, setUserFinancialData] = React.useState<UserFinancial | null>(null);
  const [isLoadingFinancialData, setIsLoadingFinancialData] = React.useState(false);

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
  const [showOnlyActive, setShowOnlyActive] = React.useState(true);

  // Permission checks
  const canViewList = hasPermission(PATIENTS_PERMISSIONS.VIEW_LIST);
  const canCreate = hasPermission(PATIENTS_PERMISSIONS.CREATE);
  const canToggleStatus = hasPermission(PATIENTS_PERMISSIONS.TOGGLE_STATUS);
  const canSearchDebtors = hasPermission(PATIENTS_PERMISSIONS.SEARCH_DEBTORS);
  const canCopyId = hasPermission(PATIENTS_PERMISSIONS.COPY_ID);
  const canViewDetail = hasPermission(PATIENTS_PERMISSIONS.VIEW_DETAIL);
  const canViewHistory = hasPermission(PATIENTS_PERMISSIONS.VIEW_DETAIL_HISTORY);
  const canViewAppointments = hasPermission(PATIENTS_PERMISSIONS.VIEW_DETAIL_APPOINTMENTS);
  const canViewQuotes = hasPermission(PATIENTS_PERMISSIONS.VIEW_DETAIL_QUOTES);
  const canViewOrders = hasPermission(PATIENTS_PERMISSIONS.VIEW_DETAIL_ORDERS);
  const canViewInvoices = hasPermission(PATIENTS_PERMISSIONS.VIEW_DETAIL_INVOICES);
  const canViewPayments = hasPermission(PATIENTS_PERMISSIONS.VIEW_DETAIL_PAYMENTS);
  const canViewMessages = hasPermission(PATIENTS_PERMISSIONS.VIEW_DETAIL_MESSAGES);
  const canViewNotes = hasPermission(PATIENTS_PERMISSIONS.VIEW_DETAIL_NOTES);
  const canCreateNote = hasPermission(PATIENTS_PERMISSIONS.CREATE_NOTE);
  const canUpdateNote = hasPermission(PATIENTS_PERMISSIONS.UPDATE_NOTE);
  const canDeleteNote = hasPermission(PATIENTS_PERMISSIONS.DELETE_NOTE);

  const [mutualSocieties, setMutualSocieties] = React.useState<MutualSociety[]>([]);
  const [isLoadingMutualSocieties, setIsLoadingMutualSocieties] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState('clinical-history');
  const [deepLinkView, setDeepLinkView] = React.useState<string | undefined>(undefined);
  const [patientAllergies, setPatientAllergies] = React.useState<Array<{ id?: number; alergeno: string; reaccion_descrita: string }>>([]);
  const [patientConditions, setPatientConditions] = React.useState<Array<{ id?: number; nombre: string; nivel_alerta?: number }>>([]);
  const [isPreferencesOpen, setIsPreferencesOpen] = React.useState(false);
  const [createSessionTrigger, setCreateSessionTrigger] = React.useState(0);
  const [createDocumentTrigger, setCreateDocumentTrigger] = React.useState(0);
  const [refreshInvoicesTrigger, setRefreshInvoicesTrigger] = React.useState(0);
  const [refreshQuotesTrigger, setRefreshQuotesTrigger] = React.useState(0);
  const [refreshOrdersTrigger, setRefreshOrdersTrigger] = React.useState(0);
  const [refreshPaymentsTrigger, setRefreshPaymentsTrigger] = React.useState(0);
  const [refreshAppointmentsTrigger, setRefreshAppointmentsTrigger] = React.useState(0);
  const [isAppointmentDialogOpen, setIsAppointmentDialogOpen] = React.useState(false);
  const [isQuoteDialogOpen, setIsQuoteDialogOpen] = React.useState(false);
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = React.useState(false);
  const [isPrepaidDialogOpen, setIsPrepaidDialogOpen] = React.useState(false);
  const [isStatsOpen, setIsStatsOpen] = React.useState(true);
  const [isEmailDialogOpen, setIsEmailDialogOpen] = React.useState(false);
  const [isRightExpanded, setIsRightExpanded] = React.useState(false);
  const [apptCalendars, setApptCalendars] = React.useState<CalendarType[]>([]);
  const [apptDoctors, setApptDoctors] = React.useState<User[]>([]);
  const [apptDoctorServiceMap, setApptDoctorServiceMap] = React.useState<Map<string, Service[]>>(new Map());
  const [checkCalendarAvailability, setCheckCalendarAvailability] = React.useState(true);
  const [checkDoctorAvailability, setCheckDoctorAvailability] = React.useState(true);
  const [isLoadingApptData, setIsLoadingApptData] = React.useState(false);
  const apptDataLoaded = React.useRef(false);
  const router = useRouter();
  const locale = useLocale();

  const loadMutualSocieties = React.useCallback(async () => {
    setIsLoadingMutualSocieties(true);
    const societies = await getMutualSocietiesList();
    setMutualSocieties(societies);
    setIsLoadingMutualSocieties(false);
  }, []);

  const loadApptData = React.useCallback(async () => {
    if (apptDataLoaded.current) return;
    setIsLoadingApptData(true);
    try {
      const [calendars, doctors, services, config] = await Promise.all([
        fetchCalendarsForAppt(),
        fetchDoctorsForAppt(),
        getSalesServices({ limit: 100 }).then(r => r.items.map((s: any) => ({ ...s, id: String(s.id) }))).catch(() => [] as Service[]),
        api.get(API_ROUTES.SYSTEM.CONFIGS).catch(() => []),
      ]);
      setApptCalendars(calendars);
      setApptDoctors(doctors);
      if (Array.isArray(config)) {
        const calCfg = config.find((c: any) => c.key === 'CHECK_CALENDAR_AVAILABILITY');
        const docCfg = config.find((c: any) => c.key === 'CHECK_DOCTOR_AVAILABILITY');
        if (calCfg) setCheckCalendarAvailability(String(calCfg.value).toLowerCase() === 'true');
        if (docCfg) setCheckDoctorAvailability(String(docCfg.value).toLowerCase() === 'true');
      }
      const doctorIds = doctors.map(d => d.id).filter(Boolean);
      const serviceMap = await getUsersServicesBatch(doctorIds);
      setApptDoctorServiceMap(serviceMap);
      apptDataLoaded.current = true;
    } finally {
      setIsLoadingApptData(false);
    }
  }, []);

  const fetchPatientAllergies = React.useCallback(async (userId: string) => {
    try {
      const data = await api.get(API_ROUTES.CLINIC_HISTORY.ALLERGIES, { user_id: userId });
      const allergyData = Array.isArray(data) ? data : (data.antecedentes_alergias || data.data || []);
      setPatientAllergies(allergyData.map((item: any) => ({
        id: Number(item.id) || undefined,
        alergeno: item.alergeno || 'N/A',
        reaccion_descrita: item.reaccion_descrita || '',
      })));
    } catch {
      setPatientAllergies([]);
    }
  }, []);

  const fetchPatientConditions = React.useCallback(async (userId: string) => {
    try {
      const data = await api.get(API_ROUTES.CLINIC_HISTORY.PERSONAL_HISTORY, { user_id: userId });
      const historyData = Array.isArray(data) ? data : (data.antecedentes_personales || data.data || []);
      setPatientConditions(historyData.map((item: any) => ({
        id: Number(item.id ?? item.antecedente_id ?? item.antecedente_personal_id) || undefined,
        nombre: item.padecimiento_nombre || item.nombre || 'N/A',
        nivel_alerta: item.nivel_alerta,
      })));
    } catch {
      setPatientConditions([]);
    }
  }, []);

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema(t)),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      identity_document: '',
      birth_date: '',
      notes: '',
      is_active: true,
    },
  });

  const loadUsers = React.useCallback(async () => {
    setIsRefreshing(true);
    const searchQuery = (columnFilters.find(f => f.id === 'email')?.value as string) || '';
    const { users: fetchedUsers, total } = await getUsers(pagination, searchQuery, showDebtors, showOnlyActive, date);
    setUsers(fetchedUsers);
    setUserCount(total);
    setIsRefreshing(false);
  }, [pagination, columnFilters, date, showDebtors, showOnlyActive]);

  const loadUserRoles = React.useCallback(async (userId: string) => {
    setIsRolesLoading(true);
    const roles = await getRolesForUser(userId);
    setSelectedUserRoles(roles);
    setIsRolesLoading(false);
  }, []);

  const fetchPatientDischarge = React.useCallback(async (userId: string) => {
    try {
      const data = await api.get(API_ROUTES.PATIENT_DISCHARGE, { id: userId });
      if (data && data.appointment_date) {
        setCurrentDischarge({
          id: data.id,
          user_id: userId,
          appointment_date: data.appointment_date,
          created_at: data.created_at
        });
      } else {
        setCurrentDischarge(null);
      }
    } catch (error) {
      console.error("Failed to fetch patient discharge:", error);
      setCurrentDischarge(null);
    }
  }, []);

  const fetchUserFinancialData = React.useCallback(async (userId: string) => {
    setIsLoadingFinancialData(true);
    try {
      const data = await api.get(API_ROUTES.USER_FINANCIAL, { user_id: userId });
      if (data && Array.isArray(data) && data.length > 0) {
        setUserFinancialData(data[0] as UserFinancial);
      } else {
        setUserFinancialData(null);
      }
    } catch (error) {
      console.error("Failed to fetch user financial data:", error);
      setUserFinancialData(null);
    } finally {
      setIsLoadingFinancialData(false);
    }
  }, []);

  const handleSaveDischarge = async () => {
    if (!selectedUser || !dischargeDate) return;

    setIsSubmittingDischarge(true);
    try {
      const payload = {
        id: selectedUser.id,
        appointment_date: dischargeDate
      };
      await api.post(API_ROUTES.PATIENT_DISCHARGE, payload);

      toast({
        title: t('ClinicHistoryPage.discharge.toast.success'),
      });

      setIsDischargeDialogOpen(false);
      setDischargeDate('');
      fetchPatientDischarge(selectedUser.id);
    } catch (error: any) {
      console.error("Error saving discharge:", error);
      toast({
        variant: 'destructive',
        title: t('ClinicHistoryPage.discharge.toast.error'),
        description: error.message || ''
      });
    } finally {
      setIsSubmittingDischarge(false);
    }
  };

  const handleCancelDischarge = async () => {
    if (!selectedUser) return;

    setIsSubmittingDischarge(true);
    try {
      const payload = {
        id: selectedUser.id
      };
      await api.post(API_ROUTES.PATIENT_DISCHARGE_CANCEL, payload);

      toast({
        title: t('ClinicHistoryPage.discharge.toast.cancelSuccess'),
      });

      setCurrentDischarge(null);
    } catch (error: any) {
      console.error("Error cancelling discharge:", error);
      toast({
        variant: 'destructive',
        title: t('ClinicHistoryPage.discharge.toast.cancelError'),
        description: error.message || ''
      });
    } finally {
      setIsSubmittingDischarge(false);
    }
  };

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

  const handlePrintFinancialSummary = () => {
    if (!selectedUser) return;
    setFinancialSummaryDateRange({ from: '', to: '' });
    setIsFinancialSummaryDialogOpen(true);
  };

  const handlePrintFinancialSummaryWithDates = async () => {
    if (!selectedUser) return;
    setIsPrintingFinancialSummary(true);
    try {
      const params: Record<string, string> = { user_id: selectedUser.id };

      if (financialSummaryDateRange.from) {
        const dateFrom = parseISO(financialSummaryDateRange.from);
        dateFrom.setHours(0, 0, 0, 0);
        params.from = dateFrom.toISOString();
      }

      if (financialSummaryDateRange.to) {
        const dateTo = parseISO(financialSummaryDateRange.to);
        dateTo.setHours(23, 59, 59, 999);
        params.to = dateTo.toISOString();
      }

      const blob = await api.getBlob(API_ROUTES.USER_FINANCIAL_SUMMARY_PRINT, params);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `resumen_financiero_${selectedUser.name.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setIsFinancialSummaryDialogOpen(false);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not print the financial summary.',
      });
      console.error(error);
    } finally {
      setIsPrintingFinancialSummary(false);
    }
  };

  const handleCreate = () => {
    setEditingUser(null);
    loadMutualSocieties();
    form.reset({
      name: '',
      email: '',
      phone: '',
      identity_document: '',
      birth_date: '',
      notes: '',
      is_active: true,
      mutual_society_id: '',
    });
    setSubmissionError(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    loadMutualSocieties();
    form.reset({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone_number,
      identity_document: user.identity_document || '',
      birth_date: user.birth_date || '',
      notes: user.notes || '',
      is_active: user.is_active,
      mutual_society_id: user.mutual_society_id?.toString() || '',
    });
    setSubmissionError(null);
    setIsDialogOpen(true);
  };

  const userColumns = UserColumnsWrapper();

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
    if (selectedUser) {
      loadUserRoles(selectedUser.id);
      fetchPatientDischarge(selectedUser.id);
      fetchUserFinancialData(selectedUser.id);
      loadMutualSocieties();
      fetchPatientAllergies(selectedUser.id);
      fetchPatientConditions(selectedUser.id);
    } else {
      setSelectedUserRoles([]);
      setCurrentDischarge(null);
      setUserFinancialData(null);
      setPatientAllergies([]);
      setPatientConditions([]);
      setIsPreferencesOpen(false);
      setCreateSessionTrigger(0);
      setCreateDocumentTrigger(0);
    }
  }, [selectedUser, loadUserRoles, fetchPatientDischarge, fetchUserFinancialData, loadMutualSocieties, fetchPatientAllergies, fetchPatientConditions]);

  const handleCloseDetails = () => {
    setSelectedUser(null);
    setSelectedQuote(null);
    setRowSelection({});
  };

  const handleUpdateNotes = async (notes: string) => {
    if (!selectedUser) return;

    try {
      const updatedUserData = {
        ...selectedUser,
        notes,
      };

      await upsertUser({
        id: selectedUser.id,
        name: selectedUser.name,
        email: selectedUser.email,
        phone: selectedUser.phone_number,
        identity_document: selectedUser.identity_document || '',
        birth_date: selectedUser.birth_date || '',
        notes,
        is_active: selectedUser.is_active,
      });

      setSelectedUser(updatedUserData);

      // Update the user in the users list
      setUsers(prevUsers =>
        prevUsers.map(user =>
          user.id === selectedUser.id ? { ...user, notes } : user
        )
      );

    } catch (error) {
      console.error('Failed to update notes:', error);
      throw error;
    }
  };

  const onSubmit = async (data: UserFormValues) => {
    setSubmissionError(null);
    form.clearErrors();

    try {
      const savedData = await upsertUser(data);
      const isEditing = !!editingUser;
      const savedUserId = data.id || savedData?.id || savedData?.user_id;
      if (data.mutual_society_id && data.mutual_society_id !== 'none' && savedUserId) {
        try {
          await api.post(API_ROUTES.MUTUAL_SOCIETIES_ASSIGN_USER, {
            id: data.mutual_society_id,
            user_id: savedUserId,
          });
          if (selectedUser && savedUserId === selectedUser.id) {
            setSelectedUser({ ...selectedUser, mutual_society_id: data.mutual_society_id });
          }
        } catch {
          // Non-fatal: mutual society assignment failed silently
        }
      }

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
          setSubmissionError(errorData?.message || t('SystemUsersPage.createDialog.validation.genericError'));
        }
      } else if (error.status >= 500) {
        setSubmissionError(t('UsersPage.createDialog.validation.serverError'));
      } else {
        const errorMessage = typeof error.data === 'string' ? error.data : errorData?.message || (error instanceof Error ? error.message : t('UsersPage.createDialog.validation.genericError'));
        setSubmissionError(errorMessage);
      }
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

  const handleClearFilters = () => {
    setDatePreset('allTime');
    setDate(undefined);
    setShowDebtors(false);
    setShowOnlyActive(true);
    setColumnFilters((prev) => prev.filter(f => f.id !== 'email'));
  };

  // ── Deep-link URL navigation (?f=&t=&st=&act=) ──────────────────────────────
  useDeepLink<User>({
    tabMap: {
      'Historia-Clinica': 'clinical-history',
      'Historia_Clinica': 'clinical-history',
      'Servicios': 'services',
      'Presupuestos': 'quotes',
      'Ordenes': 'orders',
      'Facturas': 'invoices',
      'Pagos': 'payments',
      'Citas': 'appointments',
      'Mensajes': 'messages',
      'Historial': 'logs',
      'Notas': 'notes',
    },
    subtabMap: {
      'Anamnesis': 'anamnesis',
      'Timeline': 'timeline',
      'Linea-de-Tiempo': 'timeline',
      'Odontograma': 'odontogram',
      'Documentos': 'documents',
    },
    onFilter: (value) => {
      setPagination((prev) => ({ ...prev, pageIndex: 0 }));
      setColumnFilters([{ id: 'email', value }]);
    },
    items: users,
    isLoading: isRefreshing,
    onAutoSelect: (user) => handleRowSelectionChange([user]),
    setRowSelection,
    onTabChange: (tabId) => setActiveTab(tabId),
    onSubtabChange: (subtabId) => setDeepLinkView(subtabId),
    actionMap: {
      'Cita': () => { loadApptData(); setIsAppointmentDialogOpen(true); },
      'Presupuesto': () => setIsQuoteDialogOpen(true),
      'Factura': () => setIsInvoiceDialogOpen(true),
      'Prepago': () => setIsPrepaidDialogOpen(true),
      'Sesion': () => setCreateSessionTrigger((n) => n + 1),
      'Documento': () => setCreateDocumentTrigger((n) => n + 1),
      // "Crear" is context-sensitive — resolved via current t/st in URL
      'Crear': () => {
        const urlParams = new URLSearchParams(window.location.search);
        const urlTab = urlParams.get('t');
        const urlSubtab = urlParams.get('st');
        if (urlTab === 'Historia-Clinica') {
          if (!urlSubtab || urlSubtab === 'Timeline' || urlSubtab === 'Linea-de-Tiempo') {
            setCreateSessionTrigger((n) => n + 1);
          } else if (urlSubtab === 'Documentos') {
            setCreateDocumentTrigger((n) => n + 1);
          } else {
            setCreateSessionTrigger((n) => n + 1);
          }
        } else if (urlTab === 'Citas') {
          loadApptData();
          setIsAppointmentDialogOpen(true);
        } else if (urlTab === 'Presupuestos') {
          setIsQuoteDialogOpen(true);
        } else if (urlTab === 'Facturas') {
          setIsInvoiceDialogOpen(true);
        } else if (urlTab === 'Pagos') {
          setIsPrepaidDialogOpen(true);
        } else {
          // Default: create patient
          handleCreate();
        }
      },
    },
  });

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
    ...(canSearchDebtors ? [{
      value: 'debtors',
      label: t('UsersPage.filters.showOnlyDebtors'),
      group: 'Status',
      isActive: showDebtors,
      onSelect: () => setShowDebtors(!showDebtors),
    }] : []),
    {
      value: 'active',
      label: t('UsersPage.filters.showOnlyActive'),
      group: 'Status',
      isActive: showOnlyActive,
      onSelect: () => setShowOnlyActive(!showOnlyActive),
    }
  ];

  return (
    <>
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <TwoPanelLayout
          minLeftSize={15}
          isRightPanelOpen={!!selectedUser}
          onBack={handleCloseDetails}
          forceRightOnly={isRightExpanded}
          leftPanel={
            <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm">
              <CardHeader className="flex-none p-4">
                <div className="flex items-start gap-3">
                  <div className="header-icon-circle mt-0.5">
                    <Users className="h-5 w-5" />
                  </div>
                  <div className="flex flex-col text-left">
                    <CardTitle className="text-lg">{t('UsersPage.title')}</CardTitle>
                    <CardDescription className="text-xs">{t('UsersPage.description')}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden flex flex-col min-h-0 p-4 bg-card">
                <UsersTableWithCards
                  columns={showDebtors ? debtorColumns : userColumns}
                  users={users}
                  selectedUser={selectedUser}
                  handleRowSelectionChange={handleRowSelectionChange}
                  handleCreate={canCreate ? handleCreate : undefined}
                  loadUsers={loadUsers}
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
              <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm">
                <CardHeader className="flex-none p-4 pb-2 space-y-0">
                  {/* Row 1: Icon + Name + Action buttons */}
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1 flex items-center gap-2">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              className="header-icon-circle flex-none cursor-default"
                              style={
                                patientAllergies.length > 0
                                  ? { backgroundColor: 'rgb(254 226 226)', color: 'rgb(220 38 38)' }
                                  : patientConditions.length > 0
                                    ? { backgroundColor: 'rgb(254 243 199)', color: 'rgb(217 119 6)' }
                                    : undefined
                              }
                            >
                              {(patientAllergies.length > 0 || patientConditions.length > 0)
                                ? <AlertTriangle className="h-5 w-5" />
                                : <Users className="h-5 w-5" />
                              }
                            </div>
                          </TooltipTrigger>
                          {(patientAllergies.length > 0 || patientConditions.length > 0) && (
                            <TooltipContent>
                              {[
                                patientAllergies.length > 0 ? `${patientAllergies.length} alergia(s)` : '',
                                patientConditions.length > 0 ? `${patientConditions.length} padecimiento(s)` : '',
                              ].filter(Boolean).join(' · ')}
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                      <CardTitle className="text-lg lg:text-xl truncate text-foreground font-bold">
                        {selectedUser.name}
                      </CardTitle>
                    </div>
                    {/* Icon action buttons — reference style */}
                    <div className="flex items-center gap-0.5 ml-2 flex-none">
                      <TooltipProvider>
                        {/* + Crear (quick create) — first position */}
                        <DropdownMenu>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <DropdownMenuTrigger asChild>
                                <button type="button" className="flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                                  <Plus className="h-4 w-4" />
                                </button>
                              </DropdownMenuTrigger>
                            </TooltipTrigger>
                            <TooltipContent>Crear</TooltipContent>
                          </Tooltip>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuLabel className="text-xs text-muted-foreground">Clínico</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => { setActiveTab('clinical-history'); setCreateSessionTrigger(t => t + 1); }}>
                              <Stethoscope className="h-4 w-4 mr-2 text-primary" />Sesión clínica
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setActiveTab('clinical-history'); setCreateDocumentTrigger(t => t + 1); }}>
                              <Upload className="h-4 w-4 mr-2 text-primary" />Documento
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel className="text-xs text-muted-foreground">Financiero</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => setIsQuoteDialogOpen(true)}>
                              <FileText className="h-4 w-4 mr-2 text-emerald-600" />Presupuesto
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setIsInvoiceDialogOpen(true)}>
                              <Receipt className="h-4 w-4 mr-2 text-emerald-600" />Factura
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setIsPrepaidDialogOpen(true)}>
                              <CreditCard className="h-4 w-4 mr-2 text-emerald-600" />Prepago
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel className="text-xs text-muted-foreground">Agenda</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => { loadApptData(); setIsAppointmentDialogOpen(true); }}>
                              <CalendarIcon className="h-4 w-4 mr-2 text-blue-600" />Cita
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Email */}
                        {selectedUser.email && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button type="button" onClick={() => setIsEmailDialogOpen(true)} className="flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                                <Mail className="h-4 w-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>{selectedUser.email}</TooltipContent>
                          </Tooltip>
                        )}

                        {/* WhatsApp */}
                        {selectedUser.phone_number && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <a href={`https://wa.me/${selectedUser.phone_number.replace(/^\+/, '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                                <WhatsAppIcon className="h-4 w-4" />
                              </a>
                            </TooltipTrigger>
                            <TooltipContent>{selectedUser.phone_number}</TooltipContent>
                          </Tooltip>
                        )}

                        {/* Discharge */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className={cn(
                                "flex items-center justify-center h-8 w-8 rounded-lg transition-colors",
                                currentDischarge
                                  ? "text-green-600 hover:bg-green-50"
                                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
                              )}
                              onClick={currentDischarge ? handleCancelDischarge : () => setIsDischargeDialogOpen(true)}
                              disabled={isSubmittingDischarge}
                            >
                              {currentDischarge ? <XCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>{currentDischarge ? t('UsersPage.readmitButton') : t('UsersPage.dischargeButton')}</TooltipContent>
                        </Tooltip>

                        {/* Preferences */}
                        <Popover open={isPreferencesOpen} onOpenChange={setIsPreferencesOpen}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <PopoverTrigger asChild>
                                <button type="button" className={cn("flex items-center justify-center h-8 w-8 rounded-lg transition-colors", isPreferencesOpen ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted")}>
                                  <SlidersHorizontal className="h-4 w-4" />
                                </button>
                              </PopoverTrigger>
                            </TooltipTrigger>
                            <TooltipContent>{t('UsersPage.preferencesButton')}</TooltipContent>
                          </Tooltip>
                          <PopoverContent align="end" className="w-auto p-3 space-y-2">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">{t('UsersPage.preferencesButton')}</p>
                            <UserCommunicationPreferences user={selectedUser} autoSave compact />
                          </PopoverContent>
                        </Popover>

                        {/* Toggle activate / deactivate */}
                        {canToggleStatus && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                className={cn(
                                  "flex items-center justify-center h-8 w-8 rounded-lg transition-colors",
                                  selectedUser.is_active
                                    ? "text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                    : "text-green-600 hover:bg-green-50"
                                )}
                                onClick={() => handleToggleActivate(selectedUser)}
                              >
                                <ToggleLeft className="h-4 w-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>{selectedUser.is_active ? t('UserColumns.deactivate') : t('UserColumns.activate')}</TooltipContent>
                          </Tooltip>
                        )}

                        {/* Expand / Restore */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button type="button" className="flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" onClick={() => setIsRightExpanded(v => !v)}>
                              {isRightExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>{isRightExpanded ? 'Restaurar' : 'Expandir'}</TooltipContent>
                        </Tooltip>

                        {/* Close */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button type="button" className="flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" onClick={handleCloseDetails}>
                              <X className="h-4 w-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>{t('UsersPage.close')}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>

                  {/* Row 2: Demographics + discharge badge */}
                  <div className="flex items-center gap-x-3 gap-y-1 mt-1 ml-10 flex-wrap text-xs text-muted-foreground">
                    {selectedUser.birth_date && (
                      <span className="flex items-center gap-1">
                        <Cake className="h-3 w-3" />
                        {differenceInYears(new Date(), parseISO(selectedUser.birth_date))} años
                      </span>
                    )}
                    {selectedUser.identity_document && (
                      <span className="flex items-center gap-1">
                        <CreditCard className="h-3 w-3" />
                        {selectedUser.identity_document}
                      </span>
                    )}
                    {currentDischarge && (
                      <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-100 gap-1 text-xs font-normal">
                        <CheckCircle className="h-3 w-3" />
                        {t('ClinicHistoryPage.discharge.dischargedBadge', { date: formatDisplayDate(currentDischarge.appointment_date) })}
                      </Badge>
                    )}
                  </div>

                  {/* Row 3: Allergies + conditions */}
                  {(patientAllergies.length > 0 || patientConditions.length > 0) && (
                    <div className="flex items-center gap-1.5 mt-1 ml-10 flex-wrap">
                      {[
                        ...patientAllergies.map(a => ({ label: a.alergeno, type: 'allergy' as const })),
                        ...patientConditions.map(c => ({ label: c.nombre, type: 'condition' as const })),
                      ].slice(0, 3).map((item, i) => (
                        item.type === 'allergy' ? (
                          <Badge key={`a-${i}`} variant="destructive" className="gap-1 text-xs font-normal">
                            <AlertTriangle className="h-3 w-3" />
                            {item.label}
                          </Badge>
                        ) : (
                          <Badge key={`c-${i}`} variant="secondary" className="gap-1 text-xs font-normal bg-amber-100 text-amber-800 hover:bg-amber-100">
                            <Heart className="h-3 w-3" />
                            {item.label}
                          </Badge>
                        )
                      ))}
                      {(patientAllergies.length + patientConditions.length) > 3 && (
                        <button
                          className="text-xs text-primary hover:underline"
                          onClick={() => setActiveTab('clinical-history')}
                        >
                          +{patientAllergies.length + patientConditions.length - 3} más → Anamnesis
                        </button>
                      )}
                    </div>
                  )}

                </CardHeader>
                <CardContent className="flex-1 overflow-hidden flex flex-col min-h-0 p-4 pt-0">
                  {canViewDetail && selectedUser ? (
                    <>
                      <UserFinancialSummaryStats
                        financialData={userFinancialData}
                        isOpen={isStatsOpen}
                        onToggle={() => setIsStatsOpen(v => !v)}
                        onPrint={handlePrintFinancialSummary}
                      />
                      <div className="flex flex-col flex-1 min-h-0 overflow-hidden border-t border-border">
                        {/* Horizontal tab strip */}
                        {(() => {
                          const isMedico = selectedUserRoles.some(role => role.name.toLowerCase() === 'medico' && role.is_active);
                          const userTabs: VerticalTab[] = [
                            { id: 'info', icon: Users, label: 'Información' },
                            ...(canViewHistory ? [{ id: 'clinical-history', icon: Stethoscope, label: t('UsersPage.tabs.clinicalHistory') }] : []),
                            ...(isMedico ? [{ id: 'services', icon: Wrench, label: t('UsersPage.tabs.services') }] : []),
                            { id: 'quotes', icon: FileText, label: t('UsersPage.tabs.quotes') },
                            { id: 'orders', icon: ShoppingCart, label: t('UsersPage.tabs.orders') },
                            { id: 'invoices', icon: Receipt, label: t('UsersPage.tabs.invoices') },
                            { id: 'payments', icon: CreditCard, label: t('UsersPage.tabs.payments') },
                            { id: 'appointments', icon: CalendarIcon, label: t('UsersPage.tabs.appointments') },
                            { id: 'messages', icon: MessageSquare, label: t('UsersPage.tabs.messages') },
                            { id: 'logs', icon: History, label: t('UsersPage.tabs.logs') },
                            { id: 'notes', icon: StickyNote, label: t('UsersPage.tabs.notes') },
                          ];
                          return (
                            <VerticalTabStrip
                              tabs={userTabs}
                              activeTabId={activeTab}
                              onTabClick={(tab) => setActiveTab(tab.id)}
                            />
                          );
                        })()}
                        {/* Tab content */}
                        <div className="flex-1 overflow-hidden flex flex-col min-h-0 p-3">
                          {activeTab === 'info' && (
                            <UserInfoTab
                              user={selectedUser}
                              mutualSocieties={mutualSocieties}
                              onSaved={(updated) => {
                                setSelectedUser(updated);
                                loadUsers();
                              }}
                            />
                          )}
                          {activeTab === 'clinical-history' && (
                            <ClinicHistoryViewer
                              userId={selectedUser.id}
                              userName={selectedUser.name}
                              createSessionTrigger={createSessionTrigger}
                              createDocumentTrigger={createDocumentTrigger}
                              deepLinkView={deepLinkView}
                              onClinicalDataChange={() => {
                                fetchPatientAllergies(selectedUser.id);
                                fetchPatientConditions(selectedUser.id);
                              }}
                            />
                          )}
                          {activeTab === 'services' && selectedUserRoles.some(role => role.name.toLowerCase() === 'medico' && role.is_active) && (
                            <UserServices userId={selectedUser.id} isSalesUser={true} />
                          )}
                          {activeTab === 'quotes' && (
                            <UserQuotes
                              userId={selectedUser.id}
                              onQuoteSelect={setSelectedQuote}
                              refreshTrigger={refreshQuotesTrigger}
                              onDataChange={() => {
                                fetchUserFinancialData(selectedUser.id);
                                loadUsers();
                              }}
                            />
                          )}
                          {activeTab === 'orders' && (
                            <UserOrders
                              userId={selectedUser.id}
                              patient={selectedUser}
                              refreshTrigger={refreshOrdersTrigger}
                              onDataChange={() => {
                                fetchUserFinancialData(selectedUser.id);
                                loadUsers();
                                setRefreshQuotesTrigger(prev => prev + 1);
                              }}
                            />
                          )}
                          {activeTab === 'invoices' && (
                            <UserInvoices
                              userId={selectedUser.id}
                              refreshTrigger={refreshInvoicesTrigger}
                              onDataChange={() => {
                                fetchUserFinancialData(selectedUser.id);
                                loadUsers();
                              }}
                            />
                          )}
                          {activeTab === 'payments' && (
                            <UserPayments
                              userId={selectedUser.id}
                              refreshTrigger={refreshPaymentsTrigger}
                            />
                          )}
                          {activeTab === 'appointments' && (
                            <UserAppointments
                              user={selectedUser}
                              refreshTrigger={refreshAppointmentsTrigger}
                            />
                          )}
                          {activeTab === 'messages' && <UserMessages userId={selectedUser.id} />}
                          {activeTab === 'logs' && <UserLogs userId={selectedUser.id} />}
                          {activeTab === 'notes' && <NotesTab user={selectedUser} onUpdate={handleUpdateNotes} />}
                        </div>
                      </div>
                    </>
                  ) : (<></>)}
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
            <DialogDescription>{editingUser ? t('UsersPage.createDialog.editDescription') : t('UsersPage.createDialog.createDescription')}</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
              <DialogBody className="space-y-4 px-6 py-4">
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
                        <DatePickerInput
                          value={field.value}
                          onChange={field.onChange}
                          placeholder={t('UsersPage.createDialog.birth_date_placeholder')}
                          disabledDays={(date: Date) => date > new Date() || date < new Date('1900-01-01')}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('UsersPage.createDialog.notes.title')}</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={t('UsersPage.createDialog.notes.placeholder')}
                          className="resize-none"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="mutual_society_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('UsersPage.mutualSociety.select')}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ''}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('UsersPage.mutualSociety.select')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">{t('UsersPage.mutualSociety.none')}</SelectItem>
                          {mutualSocieties.map((ms) => (
                            <SelectItem key={ms.id} value={String(ms.id)}>
                              {ms.name}
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
              </DialogBody>
              <DialogFooter>
                <Button type="submit">{editingUser ? t('UsersPage.createDialog.editSave') : t('UsersPage.createDialog.save')}</Button>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>{t('UsersPage.createDialog.cancel')}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDischargeDialogOpen} onOpenChange={setIsDischargeDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t('ClinicHistoryPage.discharge.dialogTitle')}</DialogTitle>
            <DialogDescription>
              {t('ClinicHistoryPage.discharge.dialogDescription')}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-6 px-6 py-4">
            <div className="space-y-3">
              <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                {t('ClinicHistoryPage.discharge.optionsLabel')}
              </Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="rounded-full"
                  onClick={() => setDischargeDate(format(addMonths(new Date(), 1), 'yyyy-MM-dd'))}
                >
                  {t('ClinicHistoryPage.discharge.option1Month')}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="rounded-full"
                  onClick={() => setDischargeDate(format(addMonths(new Date(), 3), 'yyyy-MM-dd'))}
                >
                  {t('ClinicHistoryPage.discharge.option3Months')}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="rounded-full"
                  onClick={() => setDischargeDate(format(addMonths(new Date(), 6), 'yyyy-MM-dd'))}
                >
                  {t('ClinicHistoryPage.discharge.option6Months')}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="rounded-full"
                  onClick={() => setDischargeDate(format(addMonths(new Date(), 12), 'yyyy-MM-dd'))}
                >
                  {t('ClinicHistoryPage.discharge.option1Year')}
                </Button>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                {t('ClinicHistoryPage.discharge.dateLabel')}
              </Label>
              <DatePickerInput
                value={dischargeDate}
                onChange={(value) => setDischargeDate(value)}
                placeholder={t('ClinicHistoryPage.discharge.datePlaceholder')}
                disabledDays={(date: Date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              className="px-8"
              onClick={handleSaveDischarge}
              disabled={!dischargeDate || isSubmittingDischarge}
            >
              {isSubmittingDischarge ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {t('ClinicHistoryPage.discharge.saveButton')}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setIsDischargeDialogOpen(false);
                setDischargeDate('');
              }}
            >
              {t('ClinicHistoryPage.discharge.cancelButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isFinancialSummaryDialogOpen} onOpenChange={setIsFinancialSummaryDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t('UsersPage.financialSummaryDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('UsersPage.financialSummaryDialog.description')}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="grid grid-cols-2 gap-4 px-4 pt-4">
              <div className="space-y-2">
                <Label>{t('UsersPage.financialSummaryDialog.from')}</Label>
                <DatePickerInput
                  value={financialSummaryDateRange.from}
                  onChange={(value) => setFinancialSummaryDateRange(prev => ({ ...prev, from: value }))}
                  placeholder="dd/mm/aaaa"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('UsersPage.financialSummaryDialog.to')}</Label>
                <DatePickerInput
                  value={financialSummaryDateRange.to}
                  onChange={(value) => setFinancialSummaryDateRange(prev => ({ ...prev, to: value }))}
                  placeholder="dd/mm/aaaa"
                />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button onClick={handlePrintFinancialSummaryWithDates} disabled={isPrintingFinancialSummary}>
              {isPrintingFinancialSummary ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Printer className="h-4 w-4 mr-2" />}
              {t('UsersPage.financialSummaryDialog.print')}
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsFinancialSummaryDialogOpen(false)}
            >
              {t('UsersPage.financialSummaryDialog.cancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedUser && (
        <PrepaidFormDialog
          open={isPrepaidDialogOpen}
          onOpenChange={setIsPrepaidDialogOpen}
          initialUser={selectedUser}
          onSaveSuccess={() => {
            setIsPrepaidDialogOpen(false);
            setActiveTab('payments');
            setRefreshPaymentsTrigger(t => t + 1);
            fetchUserFinancialData(selectedUser.id);
            loadUsers();
          }}
        />
      )}

      {selectedUser && (
        <InvoiceFormDialog
          isOpen={isInvoiceDialogOpen}
          onOpenChange={setIsInvoiceDialogOpen}
          isSales={true}
          initialUser={selectedUser}
          onInvoiceCreated={() => {
            setIsInvoiceDialogOpen(false);
            setActiveTab('invoices');
            setRefreshInvoicesTrigger(t => t + 1);
            fetchUserFinancialData(selectedUser.id);
            loadUsers();
          }}
        />
      )}

      {selectedUser && (
        <QuoteFormDialog
          open={isQuoteDialogOpen}
          onOpenChange={setIsQuoteDialogOpen}
          initialData={{ user: selectedUser }}
          onSaveSuccess={() => {
            setIsQuoteDialogOpen(false);
            setActiveTab('quotes');
            setRefreshQuotesTrigger(t => t + 1);
            fetchUserFinancialData(selectedUser.id);
            loadUsers();
          }}
        />
      )}

      {selectedUser && (
        <AppointmentFormDialog
          open={isAppointmentDialogOpen}
          onOpenChange={(open) => {
            setIsAppointmentDialogOpen(open);
          }}
          initialData={{ user: selectedUser }}
          calendars={apptCalendars}
          doctors={apptDoctors}
          doctorServiceMap={apptDoctorServiceMap}
          checkCalendarAvailability={checkCalendarAvailability}
          checkDoctorAvailability={checkDoctorAvailability}
          onSaveSuccess={() => {
            setIsAppointmentDialogOpen(false);
            setActiveTab('appointments');
            setRefreshAppointmentsTrigger(t => t + 1);
            fetchUserFinancialData(selectedUser.id);
            loadUsers();
          }}
        />
      )}

      {selectedUser && (
        <EmailComposerDialog
          open={isEmailDialogOpen}
          onOpenChange={setIsEmailDialogOpen}
          to={selectedUser.email || ''}
          recipientName={selectedUser.name}
        />
      )}
    </>
  );
}
