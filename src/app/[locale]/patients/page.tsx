'use client';

import { TwoPanelLayout } from '@/components/layout/two-panel-layout';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { CollapsibleTrigger } from '@/components/ui/collapsible';
import { DataCard } from '@/components/ui/data-card';
import { DoctorSelector } from '@/components/ui/doctor-selector';
import { DataTable } from '@/components/ui/data-table';
import { DataTableAdvancedToolbar } from '@/components/ui/data-table-advanced-toolbar';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { DatePickerInput } from '@/components/ui/date-picker';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PhoneInput } from '@/components/ui/phone-input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  PatientDetailMainContent,
  type PatientMacroTab,
} from '@/components/patients/patient-detail-main-content';
import { PatientDetailHeader } from '@/components/patients/patient-detail-header';
import { PatientInfoTab, ResponsibleContactField } from '@/components/patients/patient-info-tab';
import { PatientActionsMenu } from '@/components/patients/patient-actions-menu';
import {
  getDependantContactInfo,
  getMutualSocietiesList,
  getPatientGroupsList,
  upsertUser,
  userFormSchema,
  type DependantContactInfo,
  type UserFormValues,
} from '@/components/patients/patient-form-utils';
import { ToothIcon } from '@/components/users/dental-record/tooth-icon';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AppointmentFormDialog } from '@/components/appointments/AppointmentFormDialog';
import { getCalendarSettings } from '@/components/calendar/calendar-settings-utils';
import { InvoiceFormDialog } from '@/components/tables/invoices-table';
import { PrepaidFormDialog } from '@/components/sales/payments/PrepaidFormDialog';
import { SmartPaymentFormDialog } from '@/components/sales/payments/SmartPaymentFormDialog';
import { QuoteFormDialog } from '@/components/sales/quotes/QuoteFormDialog';
import { AnamnesisViewer, ClinicHistoryViewer, DocumentsViewer } from '@/components/users/clinic-history-viewer';
import { PatientInstructionsSection } from '@/components/medical-instructions/patient-instructions-section';
import { UserCommunicationPreferences } from '@/components/users/user-communication-preferences';
import { PatientFinanceSection } from '@/components/users/patient-finance-section';
import { UserTreatmentPlans, type TreatmentContactContext } from '@/components/users/user-treatment-plans';
import { DentalRecordViewer } from '@/components/users/dental-record/dental-record-viewer';
import { UserOrders } from '@/components/users/user-orders';
import { PATIENTS_PERMISSIONS } from '@/constants/permissions';
import { API_ROUTES } from '@/constants/routes';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useFinanceViewPreference } from '@/hooks/use-finance-view-preference';
import { usePermissions } from '@/hooks/usePermissions';
import { usePrintDocument } from '@/hooks/usePrintDocument';
import { Appointment, Calendar as CalendarType, PatientDischarge, PatientGroup, Service, SessionPrefillData, User, UserRole, MutualSociety } from '@/lib/types';
import { getSalesServices, getUsersServicesBatch } from '@/services/services';
import { cn, formatDisplayDate } from '@/lib/utils';
import { api } from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnDef, ColumnFiltersState, PaginationState, RowSelectionState } from '@tanstack/react-table';
import { addMonths, endOfDay, endOfMonth, endOfWeek, format, parseISO, startOfDay, startOfMonth, startOfWeek } from 'date-fns';
import { isValidPhoneNumber } from 'libphonenumber-js';
import { AlertTriangle, CalendarIcon, Check, CheckCircle, ChevronDown, ChevronsUpDown, ClipboardList, CreditCard, FileText, Loader2, Mail, Maximize2, Minimize2, MoreHorizontal, Plus, Printer, Receipt, ShoppingCart, SlidersHorizontal, Smile, Stethoscope, ToggleLeft, Upload, Users, X, XCircle, Zap } from 'lucide-react';
import { WhatsAppIcon } from '@/components/icons/whatsapp-icon';
import { EmailComposerDialog } from '@/components/email-composer-dialog';
import { WhatsAppComposerDialog } from '@/components/whatsapp-composer-dialog';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';
import { DateRange } from 'react-day-picker';
import { useForm, UseFormReturn } from 'react-hook-form';
import * as z from 'zod';
import { UserColumnsWrapper } from './columns';
import { useDeepLink } from '@/hooks/use-deep-link';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';
import { useBillingWizard } from '@/stores/billing-wizard-store';
import { usePatientLedgerSheet } from '@/stores/patient-ledger-sheet-store';
import { useLicenseStore } from '@/stores/license-store';
import { usePatientDetailNavigation } from '@/hooks/patients/use-patient-detail-navigation';


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

function mapApiUser(apiUser: any): User {
  return {
    id: String(apiUser.id),
    name: apiUser.name || '',
    email: apiUser.email || '',
    phone_number: apiUser.phone_number || '',
    is_active: apiUser.is_active !== undefined ? apiUser.is_active : true,
    internal_id: apiUser.internal_id ?? null,
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
    is_dependent: apiUser.is_dependent ?? apiUser.is_dependant ?? false,
    responsible_contact_id: apiUser.responsible_contact_id ? String(apiUser.responsible_contact_id) : undefined,
    responsible_contact_name: apiUser.responsible_contact_name || undefined,
  };
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

    const mappedUsers = usersData.map(mapApiUser);

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
      id: String(c.id),
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


const NotesTab = ({ user, onUpdate }: { user: User; onUpdate: (notes: string) => void }) => {
  const t = useTranslations();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = React.useState(false);
  const [notes, setNotes] = React.useState(user.notes || '');
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    setNotes(user.notes || '');
  }, [user.notes]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onUpdate(notes);
      setIsEditing(false);
      toast({ title: t('UsersPage.notes.saveSuccess'), description: t('UsersPage.notes.saveSuccessDescription') });
    } catch {
      toast({ variant: 'destructive', title: t('UsersPage.notes.saveError'), description: t('UsersPage.notes.saveErrorDescription') });
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
          <CardDescription className="text-sm text-muted-foreground">{t('UsersPage.notes.description')}</CardDescription>
        </div>
        <div className="flex items-center gap-2 ml-2">
          {!isEditing && (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              {t('UsersPage.notes.edit')}
            </Button>
          )}
          {isEditing && (
            <>
              <Button variant="outline" size="sm" onClick={handleCancel} disabled={isSaving}>
                {t('UsersPage.notes.cancel')}
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving}>
                {isSaving ? t('UsersPage.notes.saving') : t('UsersPage.notes.save')}
              </Button>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto p-4 pt-2">
        {isEditing ? (
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('UsersPage.notes.placeholder')}
            className="min-h-[200px] resize-none w-full"
          />
        ) : notes ? (
          <div className="whitespace-pre-wrap text-sm leading-relaxed">{notes}</div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
            <p className="text-center">{t('UsersPage.notes.noNotes')}</p>
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              {t('UsersPage.notes.addFirstNote')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
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
      rowCount={userCount}
      pagination={pagination}
      onPaginationChange={setPagination}
      manualPagination={true}
      columnFilters={columnFilters}
      onColumnFiltersChange={setColumnFilters}
      isNarrow={!!selectedUser || isViewportNarrow}
      renderCard={(user: User, _isSelected: boolean) => (
        <DataCard isSelected={_isSelected}
          title={user.name}
          subtitle={user.email || user.phone_number || user.identity_document || ''}
          avatar={user.name ? user.name.slice(0, 2).toUpperCase() : '?'}
          showArrow
          onClick={() => handleRowSelectionChange([user])}
          badge={user.is_active
            ? undefined
            : <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-medium bg-muted text-muted-foreground">Inactivo</span>
          }
        />
      )}
      customToolbar={(table: any, pagination: React.ReactNode) => (
        <DataTableAdvancedToolbar
          table={table}
          isCompact={!!selectedUser}
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
          onCreate={handleCreate}
          onRefresh={loadUsers}
          isRefreshing={isRefreshing}
          extraButtons={null}
          columnTranslations={{
            internal_id: t('UserColumns.internal_id'),
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
        internal_id: t('UserColumns.internal_id'),
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
  const { user: currentUser } = useAuth();
  const { hasPermission } = usePermissions();
  const [financeView] = useFinanceViewPreference(currentUser?.id);
  const { toast } = useToast();
  const { open: openBillingWizard } = useBillingWizard();
  const { open: openAccountStatement } = usePatientLedgerSheet();
  const { printFinancialSummary } = usePrintDocument();
  const searchParams = useSearchParams();
  const initialQ = searchParams.get('q') ?? '';
  const [users, setUsers] = React.useState<any[]>([]);
  const [userCount, setUserCount] = React.useState(0);
  const [selectedUser, setSelectedUser] = React.useState<User | null>(null);
  const [selectedUserRoles, setSelectedUserRoles] = React.useState<UserRole[]>([]);
  const [isRolesLoading, setIsRolesLoading] = React.useState(false);
  const [editingUser, setEditingUser] = React.useState<User | null>(null);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [submissionError, setSubmissionError] = React.useState<string | null>(null);
  const [isDischargeDialogOpen, setIsDischargeDialogOpen] = React.useState(false);
  const [dischargeDate, setDischargeDate] = React.useState<string>('');
  const [dischargePreset, setDischargePreset] = React.useState<number | null>(null);
  const [currentDischarge, setCurrentDischarge] = React.useState<PatientDischarge | null>(null);
  const [isSubmittingDischarge, setIsSubmittingDischarge] = React.useState(false);
  const [isFinancialSummaryDialogOpen, setIsFinancialSummaryDialogOpen] = React.useState(false);
  const [financialSummaryDateRange, setFinancialSummaryDateRange] = React.useState<{ from: string; to: string }>({
    from: '',
    to: '',
  });
  const [isPrintingFinancialSummary, setIsPrintingFinancialSummary] = React.useState(false);

  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const latestUsersRequestRef = React.useRef(0);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    initialQ ? [{ id: 'email', value: initialQ }] : []
  );
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
  const [patientGroups, setPatientGroups] = React.useState<PatientGroup[]>([]);
  const [isLoadingPatientGroups, setIsLoadingPatientGroups] = React.useState(false);
  const [deepLinkView, setDeepLinkView] = React.useState<string | undefined>(undefined);
  const {
    activeTab,
    setActiveTab,
    activeInfoSubTab,
    setActiveInfoSubTab,
    activeClinicalSubTab,
    setActiveClinicalSubTab,
    openClinicalAnamnesis,
    openClinicalHistory,
    openClinicalDocuments,
  } = usePatientDetailNavigation({
    deepLinkView,
    selectedUserId: selectedUser?.id,
  });
  const [patientAllergies, setPatientAllergies] = React.useState<Array<{ id?: number; alergeno: string; reaccion_descrita: string }>>([]);
  const [patientConditions, setPatientConditions] = React.useState<Array<{ id?: number; nombre: string; nivel_alerta?: number }>>([]);
  const [isPreferencesOpen, setIsPreferencesOpen] = React.useState(false);
  const [createSessionTrigger, setCreateSessionTrigger] = React.useState(0);
  const [createOdontogramTrigger, setCreateOdontogramTrigger] = React.useState(0);
  const [sessionPrefill, setSessionPrefill] = React.useState<SessionPrefillData | null>(null);
  const [createDocumentTrigger, setCreateDocumentTrigger] = React.useState(0);
  const [refreshInvoicesTrigger, setRefreshInvoicesTrigger] = React.useState(0);
  const [refreshQuotesTrigger, setRefreshQuotesTrigger] = React.useState(0);
  const [refreshOrdersTrigger, setRefreshOrdersTrigger] = React.useState(0);
  const [refreshPaymentsTrigger, setRefreshPaymentsTrigger] = React.useState(0);
  const [isAppointmentDialogOpen, setIsAppointmentDialogOpen] = React.useState(false);
  const [editingAppointmentForPlan, setEditingAppointmentForPlan] = React.useState<Appointment | null>(null);
  const [editSessionId, setEditSessionId] = React.useState<number | null>(null);
  const [isQuoteDialogOpen, setIsQuoteDialogOpen] = React.useState(false);
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = React.useState(false);
  const [isPrepaidDialogOpen, setIsPrepaidDialogOpen] = React.useState(false);
  const [isSmartPaymentDialogOpen, setIsSmartPaymentDialogOpen] = React.useState(false);
  const [isEmailDialogOpen, setIsEmailDialogOpen] = React.useState(false);
  const [isWhatsAppDialogOpen, setIsWhatsAppDialogOpen] = React.useState(false);
  const [treatmentContactCtx, setTreatmentContactCtx] = React.useState<TreatmentContactContext | null>(null);
  const [isRightExpanded, setIsRightExpanded] = React.useState(false);
  const [dependantContactInfo, setDependantContactInfo] = React.useState<DependantContactInfo | null>(null);
  const [apptCalendars, setApptCalendars] = React.useState<CalendarType[]>([]);
  const [apptDoctors, setApptDoctors] = React.useState<User[]>([]);
  const [apptDoctorServiceMap, setApptDoctorServiceMap] = React.useState<Map<string, Service[]>>(new Map());
  const [checkCalendarAvailability, setCheckCalendarAvailability] = React.useState(false);
  const [checkDoctorAvailability, setCheckDoctorAvailability] = React.useState(false);
  const [isLoadingApptData, setIsLoadingApptData] = React.useState(false);
  const apptDataLoaded = React.useRef(false);
  const router = useRouter();
  const locale = useLocale();
  const effectivePatientEmail = selectedUser?.is_dependent
    ? dependantContactInfo?.email || selectedUser.email
    : selectedUser?.email;
  const effectivePatientPhone = selectedUser?.is_dependent
    ? dependantContactInfo?.phone_number || selectedUser.phone_number
    : selectedUser?.phone_number;

  const loadMutualSocieties = React.useCallback(async () => {
    setIsLoadingMutualSocieties(true);
    const societies = await getMutualSocietiesList();
    setMutualSocieties(societies);
    setIsLoadingMutualSocieties(false);
  }, []);

  const loadPatientGroups = React.useCallback(async () => {
    setIsLoadingPatientGroups(true);
    const groups = await getPatientGroupsList();
    setPatientGroups(groups);
    setIsLoadingPatientGroups(false);
  }, []);

  const loadApptData = React.useCallback(async () => {
    if (apptDataLoaded.current) return;
    setIsLoadingApptData(true);
    try {
      const [calendars, doctors, services, calendarSettings] = await Promise.all([
        fetchCalendarsForAppt(),
        fetchDoctorsForAppt(),
        getSalesServices({ limit: 100 }).then(r => r.items.map((s: any) => ({ ...s, id: String(s.id) }))).catch(() => [] as Service[]),
        getCalendarSettings(),
      ]);
      setApptCalendars(calendars);
      setApptDoctors(doctors);
      setCheckCalendarAvailability(calendarSettings.check_availability);
      setCheckDoctorAvailability(calendarSettings.filter_doctors_by_service);
      const doctorIds = doctors.map(d => d.id).filter(Boolean);
      const serviceMap = await getUsersServicesBatch(doctorIds);
      setApptDoctorServiceMap(serviceMap);
      apptDataLoaded.current = true;
    } finally {
      setIsLoadingApptData(false);
    }
  }, []);

  const handleViewApptFromPlan = React.useCallback(async (appointmentId: string, scheduledDate?: string, serviceId?: string, serviceName?: string) => {
    await loadApptData();
    try {
      // Use the scheduled_date day as the search window; fall back to ±1 year if unknown
      const baseDate = scheduledDate ? new Date(scheduledDate) : new Date();
      const start = new Date(baseDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(baseDate);
      end.setHours(23, 59, 59, 999);
      const fmt = (d: Date) => format(d, 'yyyy-MM-dd HH:mm:ss');

      const calendarIds = apptCalendars.map(c => c.id).join(',');
      const query: Record<string, string> = {
        startingDateAndTime: fmt(start),
        endingDateAndTime: fmt(end),
        user_id: String(selectedUser?.id ?? ''),
        appointment_id: appointmentId,
      };
      if (calendarIds) query.calendar_source_ids = calendarIds;

      const data = await api.get(API_ROUTES.USERS_APPOINTMENTS, query);
      let rows: any[] = Array.isArray(data) && data.length > 0 && 'json' in data[0]
        ? data.map((r: any) => r.json)
        : (Array.isArray(data) ? data : []);

      // Find the specific appointment by id
      const raw = rows.find((r: any) =>
        String(r.appointment_id ?? r.id ?? '') === String(appointmentId)
      ) ?? rows[0];

      if (!raw) throw new Error('not found');

      const cal = apptCalendars.find(c =>
        String(c.id) === String(raw.calendar_source_id) ||
        c.google_calendar_id === raw.google_calendar_id
      );
      const startNode = raw.start_time ?? raw.start;
      const startStr: string = typeof startNode === 'string' ? startNode : (startNode?.dateTime ?? '');
      const endNode = raw.end_time ?? raw.end;

      const appt: Appointment = {
        id: String(raw.appointment_id ?? raw.id ?? appointmentId),
        patientId: String(raw.patient_id ?? raw.patientId ?? ''),
        patientName: raw.patient_name ?? raw.patientName ?? '',
        patientEmail: raw.patient_email ?? raw.patientEmail,
        patientPhone: raw.patient_phone ?? raw.patientPhone,
        doctorId: String(raw.doctor_id ?? raw.assignee_id ?? ''),
        doctorName: raw.doctor_name ?? raw.assignee_name ?? '',
        doctorEmail: raw.doctor_email,
        summary: raw.summary ?? raw.service_name ?? '',
        notes: raw.notes ?? raw.description ?? '',
        date: startStr ? startStr.split('T')[0].replace(' ', 'T').split('T')[0] : (scheduledDate ?? ''),
        time: startStr && startStr.includes('T') ? startStr.split('T')[1].slice(0, 5) : '',
        status: raw.status ?? 'scheduled',
        calendar_source_id: cal ? String(cal.id) : String(raw.calendar_source_id ?? ''),
        google_calendar_id: raw.google_calendar_id,
        googleEventId: raw.google_event_id ?? raw.googleEventId,
        calendar_name: cal?.name ?? raw.calendar_name,
        start: typeof startNode === 'string' ? { dateTime: startNode } : startNode,
        end: typeof endNode === 'string' ? { dateTime: endNode } : endNode,
        services: Array.isArray(raw.services) && raw.services.length > 0
          ? raw.services.map((s: any) => ({ id: String(s.id), name: s.name ?? '' }))
          : (serviceId ? [{ id: serviceId, name: serviceName ?? '' } as any] : []),
        quote_id: raw.quote_id,
        quote_doc_no: raw.quote_doc_no,
        invoice_id: raw.invoice_id != null ? String(raw.invoice_id) : null,
      };
      setEditingAppointmentForPlan(appt);
      setIsAppointmentDialogOpen(true);
    } catch {
      // Fallback: open create dialog
      setEditingAppointmentForPlan(null);
      setIsAppointmentDialogOpen(true);
    }
  }, [loadApptData, apptCalendars, selectedUser]);

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
      mutual_society_id: '',
      is_dependent: false,
      responsible_contact_id: null,
      doctor_id: null,
      sex: null,
      group_id: null,
    },
  });
  const isDependent = form.watch('is_dependent');
  const [selectedGuardianDisplayName, setSelectedGuardianDisplayName] = React.useState('');
  const [selectedDoctorDisplayName, setSelectedDoctorDisplayName] = React.useState('');

  React.useEffect(() => {
    if (!isDependent && form.getValues('responsible_contact_id') !== null) {
      form.setValue('responsible_contact_id', null);
      setSelectedGuardianDisplayName('');
    }
  }, [form, isDependent]);

  React.useEffect(() => {
    let cancelled = false;

    const loadEditingGuardianName = async () => {
      if (!editingUser?.is_dependent || editingUser.responsible_contact_name || !editingUser.responsible_contact_id) {
        return;
      }

      const contactInfo = await getDependantContactInfo(editingUser.id);
      if (!cancelled && contactInfo?.name) {
        setSelectedGuardianDisplayName(contactInfo.name);
      }
    };

    loadEditingGuardianName();

    return () => {
      cancelled = true;
    };
  }, [editingUser]);

  const loadUsers = React.useCallback(async () => {
    const requestId = latestUsersRequestRef.current + 1;
    latestUsersRequestRef.current = requestId;
    setIsRefreshing(true);
    const searchQuery = (columnFilters.find(f => f.id === 'email')?.value as string) || '';
    const { users: fetchedUsers, total } = await getUsers(pagination, searchQuery, showDebtors, showOnlyActive, date);
    if (latestUsersRequestRef.current !== requestId) {
      return;
    }
    setUsers(fetchedUsers);
    setUserCount(total);
    setIsRefreshing(false);
  }, [pagination, columnFilters, date, showDebtors, showOnlyActive]);

  const loadUserRoles = React.useCallback(async (userId: string) => {
    setIsRolesLoading(true);
    setSelectedUserRoles([]);
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
      setDischargePreset(null);
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

  React.useEffect(() => {
    let cancelled = false;

    const loadDependantContact = async () => {
      if (!selectedUser?.is_dependent) {
        setDependantContactInfo(null);
        return;
      }

      const contactInfo = await getDependantContactInfo(selectedUser.id);
      if (!cancelled) {
        setDependantContactInfo(contactInfo);
      }
    };

    loadDependantContact();

    return () => {
      cancelled = true;
    };
  }, [selectedUser?.id, selectedUser?.is_dependent]);

  const handleToggleActivate = async (user: User) => {
    try {
      await api.put(API_ROUTES.USERS_ACTIVATE, {
        user_id: user.id,
        is_active: !user.is_active,
      });

      const isNowActive = !user.is_active;
      toast({
        title: t(isNowActive ? 'UserColumns.activateSuccess' : 'UserColumns.deactivateSuccess'),
        description: t(isNowActive ? 'UserColumns.activateSuccessDescription' : 'UserColumns.deactivateSuccessDescription', { name: user.name }),
      });

      if (selectedUser?.id === user.id) {
        setSelectedUser({ ...selectedUser, is_active: isNowActive });
      }
      loadUsers();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('UserColumns.toggleStatusError'),
        description: t('UserColumns.toggleStatusErrorDescription'),
      });
      console.error(error);
    }
  };

  const handleUpdateNotes = async (notes: string) => {
    if (!selectedUser) return;
    const updatedUser = { ...selectedUser, notes };
    await upsertUser({
      id: selectedUser.id,
      name: selectedUser.name,
      email: selectedUser.email || '',
      phone: selectedUser.phone_number || '',
      identity_document: selectedUser.identity_document || '',
      birth_date: selectedUser.birth_date || '',
      notes,
      is_active: selectedUser.is_active,
      mutual_society_id: selectedUser.mutual_society_id ? String(selectedUser.mutual_society_id) : '',
      is_dependent: selectedUser.is_dependent ?? false,
      responsible_contact_id: selectedUser.responsible_contact_id || null,
      doctor_id: selectedUser.doctor_id || null,
      sex: selectedUser.sex ?? null,
      group_id: selectedUser.group_id || null,
    });
    setSelectedUser(updatedUser);
    setUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, notes } : u));
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
      await printFinancialSummary(selectedUser.id, financialSummaryDateRange);
      setIsFinancialSummaryDialogOpen(false);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: t('UsersPage.financialSummaryDialog.errorTitle'),
        description: error?.message === 'no_data'
          ? t('UsersPage.financialSummaryDialog.errorNoData')
          : t('UsersPage.financialSummaryDialog.errorGeneric'),
      });
    } finally {
      setIsPrintingFinancialSummary(false);
    }
  };

  const handleCreate = async () => {
    const { license, canAddMonthlyPatient } = useLicenseStore.getState();
    if (license) {
      try {
        const now = new Date();
        const dateFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        const dateTo = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        const data = await api.get(API_ROUTES.REPORTS.NUEVOS_PACIENTES, { date_from: dateFrom, date_to: dateTo });
        const count: number = data?.data?.summary?.num_nuevos ?? data?.summary?.num_nuevos ?? 0;
        if (!canAddMonthlyPatient(count)) {
          toast({
            variant: 'destructive',
            title: t('License.enforcement.limitReachedTitle'),
            description: t('License.enforcement.patientMonthlyLimitReached', { max: license.maxMonthlyNewPatients }),
          });
          return;
        }
      } catch {
        // non-critical: allow creating if check fails
      }
    }

    setEditingUser(null);
    loadMutualSocieties();
    loadPatientGroups();
    form.reset({
      name: '',
      email: '',
      phone: '',
      identity_document: '',
      birth_date: '',
      notes: '',
      is_active: true,
      mutual_society_id: '',
      is_dependent: false,
      responsible_contact_id: null,
      doctor_id: null,
      sex: null,
      group_id: null,
    });
    setSelectedGuardianDisplayName('');
    setSelectedDoctorDisplayName('');
    setSubmissionError(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    loadMutualSocieties();
    loadPatientGroups();
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
      is_dependent: user.is_dependent ?? false,
      responsible_contact_id: user.responsible_contact_id || null,
      doctor_id: user.doctor_id || null,
      sex: user.sex ?? null,
      group_id: user.group_id || null,
    });
    setSelectedGuardianDisplayName(user.responsible_contact_name || '');
    setSelectedDoctorDisplayName(user.doctor_name || '');
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
        return debt ? `UYU ${Number(debt).toFixed(2)}` : '-';
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
      loadMutualSocieties();
      loadPatientGroups();
      fetchPatientAllergies(selectedUser.id);
      fetchPatientConditions(selectedUser.id);
    } else {
      setSelectedUserRoles([]);
      setCurrentDischarge(null);
      setPatientAllergies([]);
      setPatientConditions([]);
      setIsPreferencesOpen(false);
      setCreateSessionTrigger(0);
      setCreateOdontogramTrigger(0);
      setCreateDocumentTrigger(0);
    }
  }, [selectedUser, loadUserRoles, fetchPatientDischarge, loadMutualSocieties, loadPatientGroups, fetchPatientAllergies, fetchPatientConditions]);

  const handleCloseDetails = () => {
    setSelectedUser(null);
    setRowSelection({});
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
      if (selectedUser && savedUserId === selectedUser.id) {
        setSelectedUser({
          ...selectedUser,
          name: data.name,
          email: data.email || '',
          phone_number: data.phone || '',
          identity_document: data.identity_document,
          birth_date: data.birth_date,
          notes: data.notes,
          is_active: data.is_active,
          mutual_society_id: data.mutual_society_id,
          is_dependent: data.is_dependent,
          responsible_contact_id: data.responsible_contact_id || undefined,
          responsible_contact_name: data.is_dependent ? selectedGuardianDisplayName || undefined : undefined,
          doctor_id: data.doctor_id || null,
          doctor_name: selectedDoctorDisplayName || undefined,
          sex: data.sex ?? null,
          group_id: data.group_id || null,
          group_name: patientGroups.find((g) => String(g.id) === data.group_id)?.name || undefined,
        });
      }
      setIsDialogOpen(false);
      if (!isEditing) {
        setPagination(prev => ({ ...prev, pageIndex: 0 }));
        if (pagination.pageIndex === 0) loadUsers();
      } else {
        loadUsers();
      }

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
      'Información': 'info',
      'Informacion': 'info',
      'Historia-Clinica': 'clinical',
      'Historia_Clinica': 'clinical',
      'Servicios': 'clinical',
      'Documentos': 'clinical',
      'Presupuestos': 'financial',
      'Ordenes': 'financial',
      'Facturas': 'financial',
      'Pagos': 'financial',
      'Mensajes': 'clinical',
      'Historial': 'clinical',
      'Notas': 'info',
      'Citas': 'clinical',
    },
    subtabMap: {
      'Anamnesis': 'anamnesis',
      'Timeline': 'timeline',
      'Linea-de-Tiempo': 'timeline',
      'Documentos': 'documents',
      'Tratamientos': 'treatments',
    },
    onFilter: (value) => {
      setPagination((prev) => ({ ...prev, pageIndex: 0 }));
      setColumnFilters([{ id: 'email', value }]);
    },
    items: users,
    isLoading: isRefreshing,
    onAutoSelect: (user) => handleRowSelectionChange([user]),
    setRowSelection,
    onTabChange: (tabId) => setActiveTab(tabId as PatientMacroTab),
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
                <PatientDetailHeader
                  user={selectedUser}
                  allergies={patientAllergies}
                  conditions={patientConditions}
                  dependantContactInfo={dependantContactInfo}
                  effectivePatientEmail={effectivePatientEmail}
                  effectivePatientPhone={effectivePatientPhone}
                  currentDischarge={currentDischarge}
                  onOpenAnamnesis={openClinicalAnamnesis}
                  actions={(
                    <TooltipProvider>
                      <PatientActionsMenu
                        isActive={!!selectedUser.is_active}
                        hasDischarge={!!currentDischarge}
                        hasEmail={!!effectivePatientEmail}
                        hasPhone={!!effectivePatientPhone}
                        isBusy={isSubmittingDischarge}
                        showActivate={canToggleStatus}
                        onCreateClinicalSession={() => { openClinicalHistory(); setCreateSessionTrigger(n => n + 1); }}
                        onCreateOdontogram={() => { openClinicalHistory(); setCreateOdontogramTrigger(n => n + 1); }}
                        onCreateDocument={() => { openClinicalDocuments(); setCreateDocumentTrigger(n => n + 1); }}
                        onQuickBill={() => openBillingWizard({ patientId: selectedUser.id, patientName: selectedUser.name })}
                        onCreateQuote={() => setIsQuoteDialogOpen(true)}
                        onCreateInvoice={() => setIsInvoiceDialogOpen(true)}
                        onCreatePrepaid={() => setIsPrepaidDialogOpen(true)}
                        onCreateAppointment={() => { loadApptData(); setIsAppointmentDialogOpen(true); }}
                        onEmail={() => setIsEmailDialogOpen(true)}
                        onWhatsApp={() => setIsWhatsAppDialogOpen(true)}
                        onToggleDischarge={currentDischarge ? handleCancelDischarge : () => setIsDischargeDialogOpen(true)}
                        onToggleActivate={() => handleToggleActivate(selectedUser)}
                        onPreferences={() => setIsPreferencesOpen(true)}
                      />

                      {/* Expand/collapse button — always visible */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            onClick={() => setIsRightExpanded(v => !v)}
                          >
                            {isRightExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>{isRightExpanded ? 'Restaurar' : 'Expandir'}</TooltipContent>
                      </Tooltip>

                      {/* Close button — always visible */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button type="button" className="flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" onClick={handleCloseDetails}>
                            <X className="h-4 w-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>{t('UsersPage.close')}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                />
                <CardContent className="flex-1 overflow-hidden flex flex-col min-h-0 p-4 pt-0">
                  {canViewDetail && selectedUser ? (
                    <>
                      <PatientDetailMainContent
                        activeTab={activeTab}
                        onActiveTabChange={setActiveTab}
                        activeClinicalSubTab={activeClinicalSubTab}
                        onClinicalSubTabChange={setActiveClinicalSubTab}
                        showDocuments={canViewHistory}
                        showNotes={canViewNotes}
                        activeInfoSubTab={activeInfoSubTab}
                        onInfoSubTabChange={setActiveInfoSubTab}
                        infoContent={
                          <PatientInfoTab
                            userId={selectedUser.id}
                            user={selectedUser}
                            mutualSocieties={mutualSocieties}
                            showNotes={false}
                            onSaved={(updated) => {
                              setSelectedUser(updated)
                              loadUsers()
                            }}
                          />
                        }
                        notesContent={
                          <NotesTab
                            user={selectedUser}
                            onUpdate={handleUpdateNotes}
                          />
                        }
                        anamnesisContent={
                          <AnamnesisViewer
                            userId={selectedUser.id}
                            onClinicalDataChange={() => {
                              fetchPatientAllergies(selectedUser.id)
                              fetchPatientConditions(selectedUser.id)
                            }}
                          />
                        }
                        clinicalHistoryContent={
                          <ClinicHistoryViewer
                            userId={selectedUser.id}
                            userName={selectedUser.name}
                            createSessionTrigger={createSessionTrigger}
                            createOdontogramTrigger={createOdontogramTrigger}
                            sessionPrefill={sessionPrefill}
                            editSessionId={editSessionId}
                            onEditAppointment={(appt) => {
                              setEditingAppointmentForPlan(appt);
                              loadApptData();
                              setIsAppointmentDialogOpen(true);
                            }}
                            onSessionCreated={async (sesionId, stepId) => {
                              if (stepId) {
                                try {
                                  await api.post(API_ROUTES.TREATMENT_PLANS.SEQUENCE_ADD_SESSION, { id: stepId, sesion_id: sesionId })
                                } catch (e) {
                                  console.error('Failed to link session to step', e)
                                }
                              }
                              setEditSessionId(null)
                            }}
                            onClinicalDataChange={() => {
                              fetchPatientAllergies(selectedUser.id)
                              fetchPatientConditions(selectedUser.id)
                              setSessionPrefill(null)
                            }}
                          />
                        }
                        treatmentPlansContent={
                          <UserTreatmentPlans
                            userId={selectedUser.id}
                            userName={selectedUser.name}
                            onCreateAppointment={() => { loadApptData(); setIsAppointmentDialogOpen(true) }}
                            onViewAppointment={(appointmentId, scheduledDate, serviceId, serviceName) => handleViewApptFromPlan(appointmentId, scheduledDate, serviceId, serviceName)}
                            onViewSession={(sesionId) => {
                              setEditSessionId(sesionId)
                              setActiveTab('clinical')
                              setActiveClinicalSubTab('clinical-history')
                            }}
                            onContact={(ctx) => { setTreatmentContactCtx(ctx); setIsWhatsAppDialogOpen(true); }}
                          />
                        }
                        medicalInstructionsContent={
                          <PatientInstructionsSection
                            userId={selectedUser.id}
                            userName={selectedUser.name}
                          />
                        }
                        documentsContent={<DocumentsViewer userId={selectedUser.id} createTrigger={createDocumentTrigger} />}
                        ledgerContent={
                          <PatientFinanceSection
                            userId={selectedUser.id}
                            viewMode={financeView}
                            refreshQuotesTrigger={refreshQuotesTrigger}
                            refreshInvoicesTrigger={refreshInvoicesTrigger}
                            refreshPaymentsTrigger={refreshPaymentsTrigger}
                            onCreateQuote={() => setIsQuoteDialogOpen(true)}
                            onCreateTreatment={() => setIsInvoiceDialogOpen(true)}
                            onCreatePayment={() => setIsSmartPaymentDialogOpen(true)}
                            onPrintSummary={handlePrintFinancialSummary}
                            onViewStatement={() => openAccountStatement(selectedUser.id, selectedUser.name)}
                            onDataChange={() => loadUsers()}
                          />
                        }
                      />
                    </>
                  ) : (<></>)}
                </CardContent>
              </Card>
            )
          }
        />
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent confirmOnClose isDirty={form.formState.isDirty}>
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
                  name="sex"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('UsersPage.createDialog.sex')}</FormLabel>
                      <Select onValueChange={(value) => field.onChange(value === 'none' ? null : value)} value={field.value || 'none'}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('UsersPage.createDialog.sex')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">{t('UsersPage.createDialog.sexNone')}</SelectItem>
                          <SelectItem value="male">{t('UsersPage.createDialog.sexMale')}</SelectItem>
                          <SelectItem value="female">{t('UsersPage.createDialog.sexFemale')}</SelectItem>
                        </SelectContent>
                      </Select>
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
                  name="group_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('UsersPage.patientGroup.select')}</FormLabel>
                      <Select onValueChange={(value) => field.onChange(value === 'none' ? null : value)} value={field.value || 'none'}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('UsersPage.patientGroup.select')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">{t('UsersPage.patientGroup.none')}</SelectItem>
                          {patientGroups.map((g) => (
                            <SelectItem key={g.id} value={String(g.id)}>
                              {g.name}
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
                  name="doctor_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('UsersPage.createDialog.doctor')}</FormLabel>
                      <FormControl>
                        <DoctorSelector
                          value={field.value || undefined}
                          selectedDoctorName={selectedDoctorDisplayName}
                          onValueChange={(doctorId, doctor) => {
                            field.onChange(doctorId || null);
                            setSelectedDoctorDisplayName(doctor?.name || '');
                          }}
                          placeholder={t('UsersPage.createDialog.searchDoctor')}
                          triggerText={t('UsersPage.createDialog.selectDoctor')}
                        />
                      </FormControl>
                      {field.value && (
                        <Button type="button" variant="ghost" size="sm" className="h-auto px-2 py-1 text-xs" onClick={() => { field.onChange(null); setSelectedDoctorDisplayName(''); }}>
                          {t('UsersPage.createDialog.clearDoctor')}
                        </Button>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="is_dependent"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel>{t('UsersPage.createDialog.isDependent')}</FormLabel>
                    </FormItem>
                  )}
                />
                {isDependent ? (
                  <ResponsibleContactField
                    form={form}
                    currentUserId={editingUser?.id}
                    initialDisplayName={selectedGuardianDisplayName}
                    onDisplayNameChange={setSelectedGuardianDisplayName}
                  />
                ) : null}
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
                <DialogCancelButton>{t('UsersPage.createDialog.cancel')}</DialogCancelButton>
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
                {([1, 3, 6, 12] as const).map((months) => (
                  <Button
                    key={months}
                    variant={dischargePreset === months ? 'default' : 'secondary'}
                    size="sm"
                    className="rounded-full"
                    onClick={() => {
                      setDischargeDate(format(addMonths(new Date(), months), 'yyyy-MM-dd'));
                      setDischargePreset(months);
                    }}
                  >
                    {months === 1
                      ? t('ClinicHistoryPage.discharge.option1Month')
                      : months === 3
                      ? t('ClinicHistoryPage.discharge.option3Months')
                      : months === 6
                      ? t('ClinicHistoryPage.discharge.option6Months')
                      : t('ClinicHistoryPage.discharge.option1Year')}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                {t('ClinicHistoryPage.discharge.dateLabel')}
              </Label>
              <DatePickerInput
                value={dischargeDate}
                onChange={(value) => { setDischargeDate(value); setDischargePreset(null); }}
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
                setDischargePreset(null);
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
            <div className="grid grid-cols-2 gap-4 px-4 pt-4 pb-4">
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

      <Dialog open={isPreferencesOpen} onOpenChange={setIsPreferencesOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{t('UserCommunicationPreferences.title')}</DialogTitle>
            <DialogDescription>{t('UserCommunicationPreferences.description')}</DialogDescription>
          </DialogHeader>
          <DialogBody className="px-6 py-4">
            {selectedUser && <UserCommunicationPreferences user={selectedUser} autoSave compact />}
          </DialogBody>
        </DialogContent>
      </Dialog>

      {selectedUser && (
        <PrepaidFormDialog
          open={isPrepaidDialogOpen}
          onOpenChange={setIsPrepaidDialogOpen}
          initialUser={selectedUser}
          onSaveSuccess={() => {
            setIsPrepaidDialogOpen(false);
            setActiveTab('financial');
            setRefreshPaymentsTrigger(t => t + 1);
            loadUsers();
          }}
        />
      )}

      {selectedUser && (
        <SmartPaymentFormDialog
          open={isSmartPaymentDialogOpen}
          onOpenChange={setIsSmartPaymentDialogOpen}
          initialUser={selectedUser}
          onSaveSuccess={() => {
            setIsSmartPaymentDialogOpen(false);
            setActiveTab('financial');
            setRefreshInvoicesTrigger(t => t + 1);
            setRefreshPaymentsTrigger(t => t + 1);
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
            setActiveTab('financial');
            setRefreshInvoicesTrigger(t => t + 1);
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
            setActiveTab('financial');
            setRefreshQuotesTrigger(t => t + 1);
            loadUsers();
          }}
        />
      )}

      {selectedUser && (
        <AppointmentFormDialog
          open={isAppointmentDialogOpen}
          onOpenChange={(open) => {
            setIsAppointmentDialogOpen(open);
            if (!open) setEditingAppointmentForPlan(null);
          }}
          editingAppointment={editingAppointmentForPlan}
          initialData={editingAppointmentForPlan ? undefined : { user: selectedUser }}
          readOnlyFields={{ user: true }}
          calendars={apptCalendars}
          doctors={apptDoctors}
          doctorServiceMap={apptDoctorServiceMap}
          checkCalendarAvailability={checkCalendarAvailability}
          checkDoctorAvailability={checkDoctorAvailability}
          onSaveSuccess={() => {
            setIsAppointmentDialogOpen(false);
            setEditingAppointmentForPlan(null);
            loadUsers();
          }}
        />
      )}

      {selectedUser && (
        <EmailComposerDialog
          open={isEmailDialogOpen}
          onOpenChange={setIsEmailDialogOpen}
          to={effectivePatientEmail || ''}
          userId={selectedUser.id}
          recipientName={selectedUser.name}
        />
      )}

      {selectedUser && (
        <WhatsAppComposerDialog
          open={isWhatsAppDialogOpen}
          onOpenChange={(v) => { setIsWhatsAppDialogOpen(v); if (!v) setTreatmentContactCtx(null); }}
          phone={effectivePatientPhone || ''}
          recipientName={selectedUser.name}
          treatmentContext={treatmentContactCtx ?? undefined}
        />
      )}
    </>
  );
}
