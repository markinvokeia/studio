'use client';

import { TwoPanelLayout } from '@/components/layout/two-panel-layout';
import { DataCard } from '@/components/ui/data-card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { DataTable } from '@/components/ui/data-table';
import { DatePickerInput } from '@/components/ui/date-picker';
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
import { VerticalTabStrip } from '@/components/ui/vertical-tab-strip';
import type { VerticalTab } from '@/components/ui/vertical-tab-strip';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { InvoiceFormDialog } from '@/components/tables/invoices-table';
import { PurchasePrepaidFormDialog } from '@/components/purchases/payments/PurchasePrepaidFormDialog';
import { QuoteFormDialog } from '@/components/sales/quotes/QuoteFormDialog';
import { UserCommunicationPreferences } from '@/components/users/user-communication-preferences';
import { UserFinancialSummaryStats } from '@/components/users/user-financial-summary-stats';
import { UserInvoices } from '@/components/users/user-invoices';
import { UserOrders } from '@/components/users/user-orders';
import { UserPayments } from '@/components/users/user-payments';
import { UserQuotes } from '@/components/users/user-quotes';
import { UserServices } from '@/components/users/user-services';
import { PURCHASES_PERMISSIONS } from '@/constants/permissions';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { User, UserFinancial } from '@/lib/types';
import { cn, isValidString } from '@/lib/utils';
import { api } from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnFiltersState, PaginationState, RowSelectionState } from '@tanstack/react-table';
import { format, parseISO } from 'date-fns';
import { isValidPhoneNumber } from 'libphonenumber-js';
import { AlertTriangle, BarChart2, Briefcase, ChevronDown, CreditCard, FileText, Loader2, Mail, MapPin, Maximize2, Minimize2, Phone, Plus, Printer, Receipt, ShoppingCart, SlidersHorizontal, StickyNote, ToggleLeft, UserCircle, Wrench, X } from 'lucide-react';
import { WhatsAppIcon } from '@/components/icons/whatsapp-icon';
import { EmailComposerDialog } from '@/components/email-composer-dialog';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { ProviderColumnsWrapper } from './columns';
import { useDeepLink } from '@/hooks/use-deep-link';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';

const providerFormSchema = (t: (key: string) => string) => z.object({
  id: z.string().optional(),
  name: z.string().min(1, { message: t('ProvidersPage.createDialog.validation.nameRequired') }),
  email: z.string().optional().refine(val => {
    if (!val || val.trim() === '') return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  }, { message: t('ProvidersPage.createDialog.validation.emailInvalid') }),
  phone: z.string().optional().refine(val => {
    if (!val || val.trim() === '') return true;
    return isValidPhoneNumber(val);
  }, { message: t('ProvidersPage.createDialog.validation.phoneInvalid') }),
  alternative_phone: z.string().optional().refine(val => {
    if (!val || val.trim() === '') return true;
    return isValidPhoneNumber(val);
  }, { message: t('ProvidersPage.createDialog.validation.alternativePhoneInvalid') }),
  identity_document: z.string()
    .min(1, { message: t('ProvidersPage.createDialog.validation.identityRequired') })
    .regex(/^\d*$/, { message: t('ProvidersPage.createDialog.validation.identityInvalid') })
    .max(10, { message: t('ProvidersPage.createDialog.validation.identityMaxLength') }),
  address: z.string().optional(),
  notes: z.string().optional(),
  bank_account: z.string().optional(),
  is_active: z.boolean().default(false),
}).refine((data) => {
  const hasEmail = data.email && data.email.trim() !== '';
  const hasPhone = data.phone && data.phone.trim() !== '';
  return hasEmail || hasPhone;
}, {
  message: t('ProvidersPage.createDialog.validation.emailOrPhoneRequired'),
  path: ['email'],
});

type ProviderFormValues = z.infer<ReturnType<typeof providerFormSchema>>;

type GetProvidersResponse = {
  users: User[];
  total: number;
};

async function getProviders(pagination: PaginationState, searchQuery: string): Promise<GetProvidersResponse> {
  try {
    const query = {
      page: (pagination.pageIndex + 1).toString(),
      limit: pagination.pageSize.toString(),
      search: searchQuery,
      filter_type: "PROVEEDOR"
    };
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
      alternative_phone: apiUser.alternative_phone || '',
      address: apiUser.address || '',
      bank_account: apiUser.bank_account || '',
      is_active: apiUser.is_active !== undefined ? apiUser.is_active : true,
      identity_document: apiUser.identity_document,
      notes: apiUser.notes || '',
      avatar: apiUser.avatar || `https://picsum.photos/seed/${apiUser.id || Math.random()}/40/40`,
    }));

    return { users: mappedUsers, total: total };

  } catch (error) {
    console.error("Failed to fetch providers:", error);
    return { users: [], total: 0 };
  }
}

async function upsertProvider(providerData: ProviderFormValues) {
  const data = { ...providerData, filter_type: 'PROVEEDOR', is_sales: false };
  const responseData = await api.post(API_ROUTES.USERS_UPSERT, data);

  if (responseData.error && (responseData.error.error || responseData.code > 200)) {
    const error = new Error('API Error') as any;
    error.status = responseData.code || 500;
    error.data = responseData;
    throw error;
  }

  return responseData;
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
        title: t('ProvidersPage.notes.saveSuccess'),
        description: t('ProvidersPage.notes.saveSuccessDescription'),
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('ProvidersPage.notes.saveError'),
        description: t('ProvidersPage.notes.saveErrorDescription'),
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
          <CardTitle className="text-lg text-foreground font-bold">{t('ProvidersPage.notes.title')}</CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            {t('ProvidersPage.notes.description')}
          </CardDescription>
        </div>
        <div className="flex items-center gap-2 ml-2">
          {!isEditing && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
            >
              {t('ProvidersPage.notes.edit')}
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
                {t('ProvidersPage.notes.cancel')}
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? t('ProvidersPage.notes.saving') : t('ProvidersPage.notes.save')}
              </Button>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto p-4 pt-0 bg-card">
        {isEditing ? (
          <div className="h-full flex flex-col">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('ProvidersPage.notes.placeholder')}
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
                  {t('ProvidersPage.notes.noNotes')}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                >
                  {t('ProvidersPage.notes.addFirstNote')}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

function ProvidersTableNarrow({
  columns, providers, selectedProvider, onRowSelectionChange, onCreate, onRefresh, isRefreshing,
  rowSelection, setRowSelection, providerCount, pagination, setPagination, columnFilters, setColumnFilters, filterPlaceholder,
  isNarrow,
}: {
  columns: any[]; providers: any[]; selectedProvider: any;
  onRowSelectionChange: (rows: any[]) => void; onCreate?: () => void; onRefresh: () => void; isRefreshing: boolean;
  rowSelection: RowSelectionState; setRowSelection: React.Dispatch<React.SetStateAction<RowSelectionState>>;
  providerCount: number; pagination: PaginationState; setPagination: React.Dispatch<React.SetStateAction<PaginationState>>;
  columnFilters: ColumnFiltersState; setColumnFilters: React.Dispatch<React.SetStateAction<ColumnFiltersState>>;
  filterPlaceholder: string;
  isNarrow: boolean;
}) {
  return (
    <DataTable
      columns={columns}
      data={providers}
      filterColumnId="email"
      filterPlaceholder={filterPlaceholder}
      onRowSelectionChange={onRowSelectionChange}
      enableSingleRowSelection={true}
      onCreate={onCreate}
      onRefresh={onRefresh}
      isRefreshing={isRefreshing}
      rowSelection={rowSelection}
      setRowSelection={setRowSelection}
      pageCount={Math.ceil(providerCount / pagination.pageSize)}
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
    />
  );
}

export default function ProvidersPage() {
  return <ProvidersPageContent />;
}

function ProvidersPageContent() {
  const t = useTranslations();
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const isViewportNarrow = useViewportNarrow();

  // Permission checks for UI elements
  const canViewList = hasPermission(PURCHASES_PERMISSIONS.SUPPLIERS_VIEW_LIST);
  const canCreateSupplier = hasPermission(PURCHASES_PERMISSIONS.SUPPLIERS_CREATE);
  const canUpdateSupplier = hasPermission(PURCHASES_PERMISSIONS.SUPPLIERS_UPDATE);
  const canDeleteSupplier = hasPermission(PURCHASES_PERMISSIONS.SUPPLIERS_DELETE);
  const canToggleStatus = hasPermission(PURCHASES_PERMISSIONS.SUPPLIERS_TOGGLE_STATUS);
  const canViewDetail = hasPermission(PURCHASES_PERMISSIONS.SUPPLIERS_VIEW_DETAIL);
  const canViewServices = hasPermission(PURCHASES_PERMISSIONS.SUPPLIERS_VIEW_SERVICES);
  const canViewQuotes = hasPermission(PURCHASES_PERMISSIONS.QUOTES_VIEW_LIST);
  const canViewOrders = hasPermission(PURCHASES_PERMISSIONS.ORDERS_VIEW_LIST);
  const canViewInvoices = hasPermission(PURCHASES_PERMISSIONS.INVOICES_VIEW_LIST);
  const canViewPayments = hasPermission(PURCHASES_PERMISSIONS.PAYMENTS_VIEW_LIST);
  const canCreateQuote = hasPermission(PURCHASES_PERMISSIONS.QUOTES_CREATE);
  const canCreateInvoice = hasPermission(PURCHASES_PERMISSIONS.INVOICES_CREATE);
  const canCreatePayment = hasPermission(PURCHASES_PERMISSIONS.PAYMENTS_CREATE);

  const [providers, setProviders] = React.useState<User[]>([]);
  const [providerCount, setProviderCount] = React.useState(0);
  const [selectedProvider, setSelectedProvider] = React.useState<User | null>(null);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [submissionError, setSubmissionError] = React.useState<string | null>(null);
  const [detailError, setDetailError] = React.useState<string | null>(null);
  const [isSavingDetail, setIsSavingDetail] = React.useState(false);


  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [activeTab, setActiveTab] = React.useState('info');
  const [providerFinancialData, setProviderFinancialData] = React.useState<UserFinancial | null>(null);
  const [isStatsOpen, setIsStatsOpen] = React.useState(true);
  const [isPreferencesOpen, setIsPreferencesOpen] = React.useState(false);
  const [isFinancialSummaryDialogOpen, setIsFinancialSummaryDialogOpen] = React.useState(false);
  const [financialSummaryDateRange, setFinancialSummaryDateRange] = React.useState<{ from: string; to: string }>({
    from: '',
    to: '',
  });
  const [isPrintingFinancialSummary, setIsPrintingFinancialSummary] = React.useState(false);

  // Dialog states for creating documents
  const [isQuoteDialogOpen, setIsQuoteDialogOpen] = React.useState(false);
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = React.useState(false);
  const [isPrepaidDialogOpen, setIsPrepaidDialogOpen] = React.useState(false);
  const [isEmailDialogOpen, setIsEmailDialogOpen] = React.useState(false);
  const [isRightExpanded, setIsRightExpanded] = React.useState(false);

  // Refresh triggers for tabs
  const [refreshQuotesTrigger, setRefreshQuotesTrigger] = React.useState(0);
  const [refreshInvoicesTrigger, setRefreshInvoicesTrigger] = React.useState(0);
  const [refreshPaymentsTrigger, setRefreshPaymentsTrigger] = React.useState(0);
  const [refreshOrdersTrigger, setRefreshOrdersTrigger] = React.useState(0);

  const form = useForm<ProviderFormValues>({
    resolver: zodResolver(providerFormSchema(t)),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      alternative_phone: '',
      identity_document: '',
      address: '',
      notes: '',
      bank_account: '',
      is_active: true,
    },
  });

  const detailForm = useForm<ProviderFormValues>({
    resolver: zodResolver(providerFormSchema(t)),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      alternative_phone: '',
      identity_document: '',
      address: '',
      notes: '',
      bank_account: '',
      is_active: true,
    },
  });

  const loadProviders = React.useCallback(async () => {
    setIsRefreshing(true);
    const searchQuery = (columnFilters.find(f => f.id === 'email')?.value as string) || '';
    const { users: fetchedProviders, total } = await getProviders(pagination, searchQuery);
    setProviders(fetchedProviders);
    setProviderCount(total);
    setIsRefreshing(false);
  }, [pagination, columnFilters]);

  const fetchProviderFinancialData = React.useCallback(async (providerId: string) => {
    try {
      const data = await api.get(API_ROUTES.USER_FINANCIAL, { user_id: providerId });
      if (data && Array.isArray(data) && data.length > 0) {
        setProviderFinancialData(data[0] as UserFinancial);
      } else {
        setProviderFinancialData(null);
      }
    } catch (error) {
      console.error('Failed to fetch provider financial data:', error);
      setProviderFinancialData(null);
    }
  }, []);

  React.useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [columnFilters]);

  React.useEffect(() => {
    const debounce = setTimeout(() => {
      loadProviders();
    }, 500);
    return () => clearTimeout(debounce);
  }, [loadProviders]);

  const handleToggleActivate = async (user: User) => {
    try {
      await api.put(API_ROUTES.USERS_ACTIVATE, {
        user_id: user.id,
        is_active: !user.is_active,
      });

      toast({
        title: 'Success',
        description: `Provider ${user.name} has been ${user.is_active ? 'deactivated' : 'activated'}.`,
      });

      loadProviders();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not update provider status.',
      });
      console.error(error);
    }
  };

  const handleCreate = () => {
    form.reset({
      name: '',
      email: '',
      phone: '',
      alternative_phone: '',
      identity_document: '',
      address: '',
      notes: '',
      bank_account: '',
      is_active: true,
    });
    setSubmissionError(null);
    setIsDialogOpen(true);
  };

  const providerColumns = ProviderColumnsWrapper();

  const handleRowSelectionChange = (selectedRows: User[]) => {
    const user = selectedRows.length > 0 ? selectedRows[0] : null;
    setSelectedProvider(user);
  };

  React.useEffect(() => {
    if (selectedProvider) {
      fetchProviderFinancialData(selectedProvider.id);
      detailForm.reset({
        id: selectedProvider.id,
        name: selectedProvider.name,
        email: selectedProvider.email || '',
        phone: selectedProvider.phone_number || '',
        alternative_phone: selectedProvider.alternative_phone || '',
        identity_document: selectedProvider.identity_document || '',
        address: selectedProvider.address || '',
        notes: selectedProvider.notes || '',
        bank_account: selectedProvider.bank_account || '',
        is_active: selectedProvider.is_active,
      });
      setDetailError(null);
    } else {
      setProviderFinancialData(null);
      setIsPreferencesOpen(false);
      setActiveTab('info');
    }
  }, [fetchProviderFinancialData, selectedProvider, detailForm]);

  const handleCloseDetails = () => {
    setSelectedProvider(null);
    setActiveTab('info');
    setRowSelection({});
  };

  const handlePrintFinancialSummary = () => {
    if (!selectedProvider) return;
    setFinancialSummaryDateRange({ from: '', to: '' });
    setIsFinancialSummaryDialogOpen(true);
  };

  const handlePrintFinancialSummaryWithDates = async () => {
    if (!selectedProvider) return;
    setIsPrintingFinancialSummary(true);
    try {
      const params: Record<string, string> = { user_id: selectedProvider.id };

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
      link.download = `resumen_financiero_${selectedProvider.name.replace(/\s+/g, '_')}.pdf`;
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

  const handleUpdateNotes = async (notes: string) => {
    if (!selectedProvider) return;

    try {
      const updatedProviderData = {
        ...selectedProvider,
        notes,
      };

      await upsertProvider({
        id: selectedProvider.id,
        name: selectedProvider.name,
        email: selectedProvider.email,
        phone: selectedProvider.phone_number,
        alternative_phone: selectedProvider.alternative_phone || '',
        identity_document: selectedProvider.identity_document || '',
        address: selectedProvider.address || '',
        notes,
        bank_account: selectedProvider.bank_account || '',
        is_active: selectedProvider.is_active,
      });

      setSelectedProvider(updatedProviderData);

      setProviders(prevProviders =>
        prevProviders.map(provider =>
          provider.id === selectedProvider.id ? { ...provider, notes } : provider
        )
      );

    } catch (error) {
      console.error('Failed to update notes:', error);
      throw error;
    }
  };

  const onDetailSubmit = async (data: ProviderFormValues) => {
    setDetailError(null);
    detailForm.clearErrors();
    setIsSavingDetail(true);
    try {
      await upsertProvider(data);
      toast({
        title: t('ProvidersPage.createDialog.editSuccessTitle'),
        description: t('ProvidersPage.createDialog.editSuccessDescription'),
      });
      const updated: User = {
        ...selectedProvider!,
        name: data.name,
        email: data.email || '',
        phone_number: data.phone || '',
        alternative_phone: data.alternative_phone || '',
        identity_document: data.identity_document || '',
        address: data.address || '',
        notes: data.notes || '',
        bank_account: data.bank_account || '',
        is_active: data.is_active,
      };
      setSelectedProvider(updated);
      setProviders(prev => prev.map(p => p.id === updated.id ? updated : p));
    } catch (error: any) {
      const errorData = error.data?.error || (Array.isArray(error.data) && error.data[0]?.error);
      setDetailError(errorData?.message || (error instanceof Error ? error.message : t('ProvidersPage.createDialog.validation.genericError')));
    } finally {
      setIsSavingDetail(false);
    }
  };

  const onSubmit = async (data: ProviderFormValues) => {
    setSubmissionError(null);
    form.clearErrors();

    try {
      await upsertProvider(data);
      toast({
        title: t('ProvidersPage.createDialog.createSuccessTitle'),
        description: t('ProvidersPage.createDialog.createSuccessDescription'),
      });
      setIsDialogOpen(false);
      loadProviders();

    } catch (error: any) {
      const errorData = error.data?.error || (Array.isArray(error.data) && error.data[0]?.error);
      if (errorData?.code === 'unique_conflict' && errorData?.conflictedFields) {
        const fields = errorData.conflictedFields.map((f: string) => t(`ProvidersPage.createDialog.validation.fields.${f}`)).join(', ');
        setSubmissionError(t('ProvidersPage.createDialog.validation.uniqueConflict', { fields }));
      } else if ((error.status === 400 || error.status === 409) && errorData?.errors) {
        const errors = Array.isArray(errorData.errors) ? errorData.errors : [];
        if (errors.length > 0) {
          errors.forEach((err: { field: any; message: string }) => {
            if (err.field) {
              form.setError(err.field as keyof ProviderFormValues, {
                type: 'manual',
                message: err.message,
              });
            }
          });
        } else {
          setSubmissionError(errorData?.message || t('SystemUsersPage.createDialog.validation.genericError'));
        }
      } else if (error.status >= 500) {
        setSubmissionError(t('ProvidersPage.createDialog.validation.serverError'));
      } else {
        const errorMessage = typeof error.data === 'string' ? error.data : errorData?.message || (error instanceof Error ? error.message : t('ProvidersPage.createDialog.validation.genericError'));
        setSubmissionError(errorMessage);
      }
    }
  };

  useDeepLink<User>({
    tabMap: {
      'Detalles': 'details',
      'Resumen': 'summary',
      'Servicios': 'services',
      'Presupuestos': 'quotes',
      'Ordenes': 'orders',
      'Facturas': 'invoices',
      'Pagos': 'payments',
      'Notas': 'notes',
    },
    onFilter: (v) => {
      setPagination((prev) => ({ ...prev, pageIndex: 0 }));
      setColumnFilters([{ id: 'email', value: v }]);
    },
    items: providers,
    isLoading: isRefreshing,
    onAutoSelect: (provider) => handleRowSelectionChange([provider]),
    setRowSelection,
    onTabChange: (id) => setActiveTab(id),
    actionMap: {
      'Crear': () => handleCreate(),
      'Presupuesto': () => setIsQuoteDialogOpen(true),
      'Factura': () => setIsInvoiceDialogOpen(true),
      'Prepago': () => setIsPrepaidDialogOpen(true),
    },
  });

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <TwoPanelLayout
        minLeftSize={20}
        isRightPanelOpen={!!selectedProvider && canViewDetail}
        onBack={handleCloseDetails}
        forceRightOnly={isRightExpanded}
        leftPanel={
          <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm">
            <CardHeader className="flex-none p-4">
              <div className="flex items-start gap-3">
                <div className="header-icon-circle mt-0.5">
                  <Briefcase className="h-5 w-5" />
                </div>
                <div className="flex flex-col text-left">
                  <CardTitle className="text-lg">{t('ProvidersPage.title')}</CardTitle>
                  <CardDescription className="text-xs">{t('ProvidersPage.description')}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden p-4 bg-card">
              <ProvidersTableNarrow
                columns={providerColumns}
                providers={providers}
                selectedProvider={selectedProvider}
                onRowSelectionChange={handleRowSelectionChange}
                onCreate={canCreateSupplier ? handleCreate : undefined}
                onRefresh={loadProviders}
                isRefreshing={isRefreshing}
                rowSelection={rowSelection}
                setRowSelection={setRowSelection}
                providerCount={providerCount}
                pagination={pagination}
                setPagination={setPagination}
                columnFilters={columnFilters}
                setColumnFilters={setColumnFilters}
                filterPlaceholder={t('ProvidersPage.filterPlaceholder')}
                isNarrow={!!selectedProvider || isViewportNarrow}
              />
            </CardContent>
          </Card>
        }
        rightPanel={
          selectedProvider && canViewDetail ? (
            <Card className="h-full flex flex-col border-0 lg:border shadow-none lg:shadow-sm">
              <CardHeader className="flex-none p-4 pb-2 space-y-0">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1 flex items-center gap-2">
                    <div className="header-icon-circle flex-none">
                      <Briefcase className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-lg lg:text-xl truncate text-foreground font-bold">
                      {selectedProvider.name}
                    </CardTitle>
                  </div>
                  <div className="flex items-center gap-1 ml-2 flex-none">
                    <TooltipProvider>
                    {/* + Quick create dropdown */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="default" size="sm" className="h-8 gap-1.5 px-3">
                            <Plus className="h-4 w-4" />
                            <span className="hidden sm:inline">{t('ProvidersPage.quickCreate.title')}</span>
                            <ChevronDown className="h-3.5 w-3.5 opacity-70 hidden sm:block" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuLabel className="text-xs text-muted-foreground">{t('ProvidersPage.quickCreate.financial')}</DropdownMenuLabel>
                          {canCreateQuote && (
                            <DropdownMenuItem onClick={() => setIsQuoteDialogOpen(true)}>
                              <FileText className="h-4 w-4 mr-2 text-emerald-600" />
                              {t('ProvidersPage.quickCreate.quote')}
                            </DropdownMenuItem>
                          )}
                          {canCreateInvoice && (
                            <DropdownMenuItem onClick={() => setIsInvoiceDialogOpen(true)}>
                              <Receipt className="h-4 w-4 mr-2 text-emerald-600" />
                              {t('ProvidersPage.quickCreate.invoice')}
                            </DropdownMenuItem>
                          )}
                          {canCreatePayment && (
                            <DropdownMenuItem onClick={() => setIsPrepaidDialogOpen(true)}>
                              <CreditCard className="h-4 w-4 mr-2 text-emerald-600" />
                              {t('ProvidersPage.quickCreate.prepaid')}
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>

                    <Popover open={isPreferencesOpen} onOpenChange={setIsPreferencesOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant={isPreferencesOpen ? 'secondary' : 'outline'}
                          size="sm"
                          className="h-8 gap-1.5 px-3 hover:bg-primary hover:text-primary-foreground hover:border-primary"
                        >
                          <SlidersHorizontal className="h-4 w-4" />
                          <span className="hidden sm:inline">{t('UsersPage.preferencesButton')}</span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-auto p-3 space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
                          {t('UsersPage.preferencesButton')}
                        </p>
                        <UserCommunicationPreferences user={selectedProvider} autoSave compact />
                      </PopoverContent>
                    </Popover>
                    {canToggleStatus && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                              "h-8 w-8 transition-colors",
                              selectedProvider.is_active
                                ? "text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                : "text-green-600 hover:bg-green-50"
                            )}
                            onClick={() => handleToggleActivate(selectedProvider)}
                          >
                            <ToggleLeft className="h-5 w-5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {selectedProvider.is_active ? t('ProviderColumns.deactivate') : t('ProviderColumns.activate')}
                        </TooltipContent>
                      </Tooltip>
                    )}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground transition-colors"
                          onClick={() => setIsRightExpanded(v => !v)}
                        >
                          {isRightExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{isRightExpanded ? 'Restaurar' : 'Expandir'}</TooltipContent>
                    </Tooltip>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive transition-colors"
                      onClick={handleCloseDetails}
                    >
                      <X className="h-5 w-5" />
                      <span className="sr-only">{t('ProvidersPage.close')}</span>
                    </Button>
                    </TooltipProvider>
                  </div>
                </div>

                <div className="flex items-center gap-x-3 gap-y-1 mt-1.5 ml-10 flex-wrap text-xs text-muted-foreground">
                  {isValidString(selectedProvider.email) && (
                    <button
                      type="button"
                      onClick={() => setIsEmailDialogOpen(true)}
                      className="flex items-center gap-1 max-w-[220px] truncate hover:text-foreground hover:underline"
                    >
                      <Mail className="h-3 w-3 flex-none" />
                      {selectedProvider.email}
                    </button>
                  )}
                  {isValidString(selectedProvider.phone_number) && (
                    <a
                      href={`https://wa.me/${String(selectedProvider.phone_number).replace(/^\+/, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 hover:text-foreground hover:underline"
                    >
                      <WhatsAppIcon className="h-3 w-3" />
                      {selectedProvider.phone_number}
                    </a>
                  )}
                  {isValidString(selectedProvider.alternative_phone) && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {selectedProvider.alternative_phone}
                    </span>
                  )}
                  {isValidString(selectedProvider.identity_document) && (
                    <span className="flex items-center gap-1">
                      <CreditCard className="h-3 w-3" />
                      {selectedProvider.identity_document}
                    </span>
                  )}
                  {isValidString(selectedProvider.address) && (
                    <span className="flex items-center gap-1 max-w-[260px] truncate">
                      <MapPin className="h-3 w-3" />
                      {selectedProvider.address}
                    </span>
                  )}
                  <Badge
                    variant="secondary"
                    className={cn(
                      'text-xs font-normal',
                      selectedProvider.is_active
                        ? 'bg-green-100 text-green-800 hover:bg-green-100'
                        : 'bg-red-100 text-red-800 hover:bg-red-100'
                    )}
                  >
                    {selectedProvider.is_active ? t('ProvidersPage.summary.active') : t('ProvidersPage.summary.inactive')}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden flex flex-col min-h-0 p-4 pt-0">
                <UserFinancialSummaryStats
                  financialData={providerFinancialData}
                  isOpen={isStatsOpen}
                  onToggle={() => setIsStatsOpen(v => !v)}
                  onPrint={handlePrintFinancialSummary}
                />
                <div className="flex flex-col flex-1 min-h-0 overflow-hidden border-t border-border">
                  {(() => {
                    const providerTabs: VerticalTab[] = [
                      { id: 'info', icon: UserCircle, label: 'Información' },
                      ...(canViewServices ? [{ id: 'services', icon: Wrench, label: t('UsersPage.tabs.services') }] : []),
                      ...(canViewQuotes ? [{ id: 'quotes', icon: FileText, label: t('UsersPage.tabs.quotes') }] : []),
                      ...(canViewOrders ? [{ id: 'orders', icon: ShoppingCart, label: t('UsersPage.tabs.orders') }] : []),
                      ...(canViewInvoices ? [{ id: 'invoices', icon: Receipt, label: t('UsersPage.tabs.invoices') }] : []),
                      ...(canViewPayments ? [{ id: 'payments', icon: CreditCard, label: t('UsersPage.tabs.payments') }] : []),
                      { id: 'notes', icon: StickyNote, label: t('ProvidersPage.tabs.notes') },
                    ];
                    return (
                      <VerticalTabStrip
                        tabs={providerTabs}
                        activeTabId={activeTab}
                        onTabClick={(tab) => setActiveTab(tab.id)}
                      />
                    );
                  })()}
                  <div className="flex-1 overflow-hidden flex flex-col min-h-0 p-3">
                    {activeTab === 'info' && (
                      <div className="flex-1 overflow-hidden flex flex-col min-h-0 rounded-lg bg-muted/30 p-3">
                      <Card className="h-full flex flex-col shadow-none border-0">
                        <CardContent className="flex-1 overflow-auto p-4 bg-card">
                          <Form {...detailForm}>
                            <form onSubmit={detailForm.handleSubmit(onDetailSubmit)} className="space-y-4">
                              {detailError && (
                                <Alert variant="destructive">
                                  <AlertTriangle className="h-4 w-4" />
                                  <AlertTitle>{t('ProvidersPage.createDialog.validation.errorTitle')}</AlertTitle>
                                  <AlertDescription>{detailError}</AlertDescription>
                                </Alert>
                              )}
                              <FormField control={detailForm.control} name="name" render={({ field }) => (
                                <FormItem><FormLabel>{t('ProvidersPage.createDialog.name')}</FormLabel><FormControl><Input placeholder={t('ProvidersPage.createDialog.namePlaceholder')} {...field} /></FormControl><FormMessage /></FormItem>
                              )} />
                              <FormField control={detailForm.control} name="email" render={({ field }) => (
                                <FormItem><FormLabel>{t('ProvidersPage.createDialog.email')}</FormLabel><FormControl><Input type="email" placeholder={t('ProvidersPage.createDialog.emailPlaceholder')} {...field} /></FormControl><FormMessage /></FormItem>
                              )} />
                              <FormField control={detailForm.control} name="phone" render={({ field }) => (
                                <FormItem><FormLabel>{t('ProvidersPage.createDialog.phone')}</FormLabel><FormControl>
                                  <PhoneInput {...field} defaultCountry="UY" placeholder={t('ProvidersPage.createDialog.phonePlaceholder')} onChange={field.onChange} value={field.value} />
                                </FormControl><FormMessage /></FormItem>
                              )} />
                              <FormField control={detailForm.control} name="identity_document" render={({ field }) => (
                                <FormItem><FormLabel>{t('ProvidersPage.createDialog.identity_document')}</FormLabel><FormControl><Input placeholder={t('ProvidersPage.createDialog.identity_document_placeholder')} {...field} /></FormControl><FormMessage /></FormItem>
                              )} />
                              <FormField control={detailForm.control} name="address" render={({ field }) => (
                                <FormItem><FormLabel>{t('ProvidersPage.createDialog.address')}</FormLabel><FormControl><Input placeholder={t('ProvidersPage.createDialog.addressPlaceholder')} {...field} /></FormControl><FormMessage /></FormItem>
                              )} />
                              <FormField control={detailForm.control} name="alternative_phone" render={({ field }) => (
                                <FormItem><FormLabel>{t('ProvidersPage.createDialog.alternative_phone')}</FormLabel><FormControl>
                                  <PhoneInput {...field} defaultCountry="UY" placeholder={t('ProvidersPage.createDialog.alternative_phonePlaceholder')} onChange={field.onChange} value={field.value} />
                                </FormControl><FormMessage /></FormItem>
                              )} />
                              <FormField control={detailForm.control} name="bank_account" render={({ field }) => (
                                <FormItem><FormLabel>{t('ProvidersPage.createDialog.bank_account')}</FormLabel><FormControl><Input placeholder={t('ProvidersPage.createDialog.bank_accountPlaceholder')} {...field} /></FormControl><FormMessage /></FormItem>
                              )} />
                              <FormField control={detailForm.control} name="is_active" render={({ field }) => (
                                <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                  <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                  <FormLabel>{t('ProvidersPage.createDialog.isActive')}</FormLabel>
                                </FormItem>
                              )} />
                              {canUpdateSupplier && (
                                <div className="flex gap-2 pt-2">
                                  <Button type="submit" disabled={isSavingDetail}>
                                    {isSavingDetail ? t('ProvidersPage.createDialog.editSave') + '...' : t('ProvidersPage.createDialog.editSave')}
                                  </Button>
                                </div>
                              )}
                            </form>
                          </Form>
                        </CardContent>
                      </Card>
                      </div>
                    )}
                    {canViewServices && activeTab === 'services' && (
                      <UserServices userId={selectedProvider.id} isSalesUser={false} />
                    )}
                    {canViewQuotes && activeTab === 'quotes' && (
                      <UserQuotes
                        userId={selectedProvider.id}
                        mode="purchases"
                        refreshTrigger={refreshQuotesTrigger}
                        onDataChange={() => {
                          fetchProviderFinancialData(selectedProvider.id);
                          loadProviders();
                        }}
                      />
                    )}
                    {canViewOrders && activeTab === 'orders' && (
                      <UserOrders
                        userId={selectedProvider.id}
                        patient={selectedProvider}
                        mode="purchases"
                        refreshTrigger={refreshOrdersTrigger}
                        onDataChange={() => {
                          fetchProviderFinancialData(selectedProvider.id);
                          loadProviders();
                        }}
                      />
                    )}
                    {canViewInvoices && activeTab === 'invoices' && (
                      <UserInvoices
                        userId={selectedProvider.id}
                        mode="purchases"
                        refreshTrigger={refreshInvoicesTrigger}
                        onDataChange={() => {
                          fetchProviderFinancialData(selectedProvider.id);
                          loadProviders();
                        }}
                      />
                    )}
                    {canViewPayments && activeTab === 'payments' && (
                      <UserPayments
                        userId={selectedProvider.id}
                        mode="purchases"
                        refreshTrigger={refreshPaymentsTrigger}
                      />
                    )}
                    {activeTab === 'notes' && (
                      <NotesTab user={selectedProvider} onUpdate={handleUpdateNotes} />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null
        }
      />

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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('ProvidersPage.createDialog.title')}</DialogTitle>
            <DialogDescription>{t('ProvidersPage.createDialog.description')}</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
              <DialogBody className="space-y-4 px-6 py-4">
                {submissionError && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>{t('ProvidersPage.createDialog.validation.errorTitle')}</AlertTitle>
                    <AlertDescription>{submissionError}</AlertDescription>
                  </Alert>
                )}
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('ProvidersPage.createDialog.name')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('ProvidersPage.createDialog.namePlaceholder')} {...field} />
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
                      <FormLabel>{t('ProvidersPage.createDialog.email')}</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder={t('ProvidersPage.createDialog.emailPlaceholder')} {...field} />
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
                      <FormLabel>{t('ProvidersPage.createDialog.phone')}</FormLabel>
                      <FormControl>
                        <PhoneInput
                          {...field}
                          defaultCountry="UY"
                          placeholder={t('ProvidersPage.createDialog.phonePlaceholder')}
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
                      <FormLabel>{t('ProvidersPage.createDialog.identity_document')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('ProvidersPage.createDialog.identity_document_placeholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('ProvidersPage.createDialog.address')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('ProvidersPage.createDialog.addressPlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="alternative_phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('ProvidersPage.createDialog.alternative_phone')}</FormLabel>
                      <FormControl>
                        <PhoneInput
                          {...field}
                          defaultCountry="UY"
                          placeholder={t('ProvidersPage.createDialog.alternative_phonePlaceholder')}
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
                  name="bank_account"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('ProvidersPage.createDialog.bank_account')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('ProvidersPage.createDialog.bank_accountPlaceholder')} {...field} />
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
                      <FormLabel>{t('ProvidersPage.createDialog.notes.title')}</FormLabel>
                      <FormControl>
                        <Textarea placeholder={t('ProvidersPage.createDialog.notes.placeholder')} {...field} />
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
                      <FormLabel>{t('ProvidersPage.createDialog.isActive')}</FormLabel>
                    </FormItem>
                  )}
                />
              </DialogBody>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>{t('ProvidersPage.createDialog.cancel')}</Button>
                <Button type="submit">{t('ProvidersPage.createDialog.save')}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {selectedProvider && (
        <PurchasePrepaidFormDialog
          open={isPrepaidDialogOpen}
          onOpenChange={setIsPrepaidDialogOpen}
          initialUser={selectedProvider}
          onSaveSuccess={() => {
            setIsPrepaidDialogOpen(false);
            setActiveTab('payments');
            setRefreshPaymentsTrigger(t => t + 1);
            fetchProviderFinancialData(selectedProvider.id);
            loadProviders();
          }}
        />
      )}

      {selectedProvider && (
        <InvoiceFormDialog
          isOpen={isInvoiceDialogOpen}
          onOpenChange={setIsInvoiceDialogOpen}
          isSales={false}
          initialUser={selectedProvider}
          onInvoiceCreated={() => {
            setIsInvoiceDialogOpen(false);
            setActiveTab('invoices');
            setRefreshInvoicesTrigger(t => t + 1);
            fetchProviderFinancialData(selectedProvider.id);
            loadProviders();
          }}
        />
      )}

      {selectedProvider && (
        <QuoteFormDialog
          open={isQuoteDialogOpen}
          onOpenChange={setIsQuoteDialogOpen}
          isSales={false}
          initialData={{ user: selectedProvider }}
          onSaveSuccess={() => {
            setIsQuoteDialogOpen(false);
            setActiveTab('quotes');
            setRefreshQuotesTrigger(t => t + 1);
            fetchProviderFinancialData(selectedProvider.id);
            loadProviders();
          }}
        />
      )}

      {selectedProvider && (
        <EmailComposerDialog
          open={isEmailDialogOpen}
          onOpenChange={setIsEmailDialogOpen}
          to={selectedProvider.email || ''}
          recipientName={selectedProvider.name}
        />
      )}
    </div>
  );
}
