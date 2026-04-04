'use client';

import { QuoteItemsTable } from '@/components/tables/quote-items-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ServiceSelector } from '@/components/ui/service-selector';
import { ResizableSheet, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/resizable-sheet';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { PURCHASES_PERMISSIONS, SALES_PERMISSIONS } from '@/constants/permissions';
import { API_ROUTES } from '@/constants/routes';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import { checkPreferencesByEmails, getDisabledEmails } from '@/hooks/use-communication-preferences';
import { CommunicationWarningDialog } from '@/components/communication-warning-dialog';
import { Quote, QuoteItem, Service, UserDetailMode } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';
import { api } from '@/services/api';
import { getPurchaseServices, getSalesServices } from '@/services/services';
import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnDef, RowSelectionState } from '@tanstack/react-table';
import { CheckCircle, ChevronDown, Eye, Loader2, Pencil, Printer, Send, Trash2, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import * as z from 'zod';

// ── Schemas ───────────────────────────────────────────────────────────────────
const itemSchema = z.object({
  service_id: z.string().min(1, 'Selecciona un servicio'),
  quantity: z.coerce.number().min(1, 'Mínimo 1'),
  unit_price: z.coerce.number().min(0, 'Precio inválido'),
  tooth_number: z.coerce.number().optional(),
});
type ItemFormValues = z.infer<typeof itemSchema>;

const quoteEditSchema = z.object({
  currency: z.enum(['USD', 'UYU']),
  exchange_rate: z.coerce.number().min(0.0001, 'Tasa de cambio inválida'),
  notes: z.string().optional(),
  items: z.array(z.object({
    id: z.string().optional(),
    service_id: z.string().min(1, 'Selecciona un servicio'),
    quantity: z.coerce.number().int().min(1, 'Mínimo 1'),
    unit_price: z.coerce.number().min(0, 'Precio inválido'),
    total: z.coerce.number().min(0),
    tooth_number: z.coerce.number().int().optional().or(z.literal('')),
  })).default([]),
});
type QuoteEditFormValues = z.infer<typeof quoteEditSchema>;

// ── Columns ───────────────────────────────────────────────────────────────────
const getColumns = (t: (key: string) => string): ColumnDef<Quote>[] => [
  {
    id: 'select',
    header: () => null,
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Seleccionar fila"
        onClick={(e) => e.stopPropagation()}
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'doc_no',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('QuoteColumns.quoteId')} />,
  },
  {
    accessorKey: 'total',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('QuoteColumns.total')} />,
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue('total'));
      return <div className="font-medium">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.round(amount * 100) / 100)}</div>;
    },
  },
  {
    accessorKey: 'status',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('UserColumns.status')} />,
    cell: ({ row }) => {
      const status = row.getValue('status') as string;
      const variant = ({ accepted: 'success', confirmed: 'success', sent: 'default', pending: 'info', draft: 'outline', rejected: 'destructive' }[status.toLowerCase()] ?? 'default') as any;
      return <Badge variant={variant} className="capitalize">{t(`QuotesPage.quoteDialog.${status.toLowerCase()}`)}</Badge>;
    },
  },
  {
    accessorKey: 'payment_status',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('Navigation.Payments')} />,
    cell: ({ row }) => {
      const status = (row.getValue('payment_status') as string).toLowerCase().trim();
      const keyMap: Record<string, string> = { paid: 'paid', partial: 'partial', 'partially paid': 'partiallyPaid', partially_paid: 'partiallyPaid', unpaid: 'unpaid' };
      const variant = ({ paid: 'success', partial: 'info', 'partially paid': 'info', unpaid: 'outline' }[status] ?? 'default') as any;
      return <Badge variant={variant} className="capitalize">{t(`QuotesPage.quoteDialog.${keyMap[status] || 'unpaid'}`)}</Badge>;
    },
  },
  {
    accessorKey: 'billing_status',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('QuoteColumns.billingStatus')} />,
    cell: ({ row }) => {
      const status = (row.getValue('billing_status') as string).toLowerCase().trim();
      const keyMap: Record<string, string> = { invoiced: 'invoiced', 'partially invoiced': 'partiallyInvoiced', partially_invoiced: 'partiallyInvoiced', 'not invoiced': 'notInvoiced', not_invoiced: 'notInvoiced' };
      const variant = ({ invoiced: 'success', 'partially invoiced': 'info', 'not invoiced': 'outline' }[status] ?? 'default') as any;
      return <Badge variant={variant} className="capitalize">{t(`QuotesPage.quoteDialog.${keyMap[status] || 'notInvoiced'}`)}</Badge>;
    },
  },
  {
    accessorKey: 'currency',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('QuoteColumns.currency')} />,
    cell: ({ row }) => {
      const currency = row.getValue('currency') as string;
      return <div className="font-medium">{currency || 'USD'}</div>;
    },
  },
  {
    accessorKey: 'exchange_rate',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('QuoteColumns.exchangeRate')} />,
    cell: ({ row }) => {
      const rate = row.getValue('exchange_rate') as number;
      return <div className="font-medium">{rate || '-'}</div>;
    },
  },
  {
    accessorKey: 'createdAt',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('QuoteColumns.createdAt')} />,
    cell: ({ row }) => formatDateTime(row.original.createdAt),
  },
];

// ── Data fetching ─────────────────────────────────────────────────────────────
async function getQuotesForUser(userId: string): Promise<Quote[]> {
  if (!userId) return [];
  try {
    const data = await api.get(API_ROUTES.USER_QUOTES, { user_id: userId });
    const raw = Array.isArray(data) ? data : (data.user_quotes || data.data || data.result || []);
    return raw.map((q: any) => ({
      id: q.id ? String(q.id) : `qt_${Math.random().toString(36).substr(2, 9)}`,
      doc_no: q.doc_no || 'N/A',
      user_id: q.user_id || 'N/A',
      total: q.total || 0,
      status: q.status || 'draft',
      payment_status: q.payment_status || 'unpaid',
      billing_status: q.billing_status || 'not invoiced',
      currency: q.currency || 'USD',
      exchange_rate: q.exchange_rate || 1,
      notes: q.notes || '',
      createdAt: q.createdAt || q.created_at || new Date().toISOString().split('T')[0],
    }));
  } catch {
    return [];
  }
}

// ── Item total display (read-only, computed from quantity × unit_price) ───────
function ItemTotalField({ form }: { form: ReturnType<typeof useForm<ItemFormValues>> }) {
  const quantity = useWatch({ control: form.control, name: 'quantity' }) ?? 0;
  const unitPrice = useWatch({ control: form.control, name: 'unit_price' }) ?? 0;
  const total = (Number(quantity) * Number(unitPrice));
  const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(total);
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">Total</label>
      <Input value={formatted} readOnly disabled className="bg-muted text-muted-foreground cursor-not-allowed" />
    </div>
  );
}

// ── Status helpers ────────────────────────────────────────────────────────────
const STATUS_BADGE: Record<string, any> = { accepted: 'success', confirmed: 'success', sent: 'default', pending: 'info', draft: 'outline', rejected: 'destructive' };
const PAYMENT_BADGE: Record<string, any> = { paid: 'success', partial: 'info', partially_paid: 'info', unpaid: 'outline' };
const BILLING_BADGE: Record<string, any> = { invoiced: 'success', partially_invoiced: 'info', 'partially invoiced': 'info', 'not invoiced': 'outline', not_invoiced: 'outline' };

// ── Component ─────────────────────────────────────────────────────────────────
interface UserQuotesProps {
  userId: string;
  onQuoteSelect?: (quote: Quote | null) => void;
  mode?: UserDetailMode;
  onDataChange?: () => void;
  refreshTrigger?: number;
}

export function UserQuotes({ userId, onQuoteSelect, mode = 'sales', onDataChange, refreshTrigger }: UserQuotesProps) {
  const t = useTranslations();
  const tQuotes = useTranslations('QuotesPage');
  const { toast } = useToast();
  const { activeCashSession } = useAuth();
  const { hasPermission } = usePermissions();
  const isSales = mode === 'sales';
  const [userQuotes, setUserQuotes] = React.useState<Quote[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [selectedQuote, setSelectedQuote] = React.useState<Quote | null>(null);
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);

  // Sync selectedQuote when userQuotes array changes
  React.useEffect(() => {
    if (selectedQuote && userQuotes.length > 0) {
      const updatedQuote = userQuotes.find(q => q.id === selectedQuote.id);
      if (updatedQuote) {
        const hasChanges =
          updatedQuote.status !== selectedQuote.status ||
          updatedQuote.total !== selectedQuote.total;
        if (hasChanges) {
          setSelectedQuote(updatedQuote);
        }
      } else {
        setSelectedQuote(null);
        setRowSelection({});
      }
    }
  }, [userQuotes]);

  // Items
  const [quoteItems, setQuoteItems] = React.useState<QuoteItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = React.useState(false);
  const [services, setServices] = React.useState<Service[]>([]);

  // Item dialogs
  const [isItemDialogOpen, setIsItemDialogOpen] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState<QuoteItem | null>(null);
  const [deletingItem, setDeletingItem] = React.useState<QuoteItem | null>(null);
  const [isSubmittingItem, setIsSubmittingItem] = React.useState(false);

  // Record-level dialogs
  const [isEditQuoteOpen, setIsEditQuoteOpen] = React.useState(false);
  const [isSubmittingQuote, setIsSubmittingQuote] = React.useState(false);
  const [isDeletingQuote, setIsDeletingQuote] = React.useState(false);
  const [confirmAction, setConfirmAction] = React.useState<'confirm' | 'reject' | null>(null);
  const [actionNotes, setActionNotes] = React.useState('');
  const [isSubmittingAction, setIsSubmittingAction] = React.useState(false);

  // Email dialog states
  const [isSendEmailDialogOpen, setIsSendEmailDialogOpen] = React.useState(false);
  const [selectedQuoteForEmail, setSelectedQuoteForEmail] = React.useState<Quote | null>(null);
  const [emailRecipients, setEmailRecipients] = React.useState('');
  const [isSendingEmail, setIsSendingEmail] = React.useState(false);
  const [isWarningDialogOpen, setIsWarningDialogOpen] = React.useState(false);
  const [disabledEmails, setDisabledEmails] = React.useState<string[]>([]);

  const columns = React.useMemo(() => getColumns(t), [t]);
  const isDraft = selectedQuote?.status?.toLowerCase() === 'draft';
  const canUpdateQuote = hasPermission(isSales ? SALES_PERMISSIONS.QUOTES_UPDATE : PURCHASES_PERMISSIONS.QUOTES_UPDATE);
  const canDeleteQuote = hasPermission(isSales ? SALES_PERMISSIONS.QUOTES_DELETE : PURCHASES_PERMISSIONS.QUOTES_DELETE);
  const canConfirmQuote = hasPermission(isSales ? SALES_PERMISSIONS.QUOTES_CONFIRM : PURCHASES_PERMISSIONS.QUOTES_CONFIRM);
  const canRejectQuote = isSales
    ? hasPermission(SALES_PERMISSIONS.QUOTES_REJECT)
    : canConfirmQuote;
  const canPrintQuote = isSales ? hasPermission(SALES_PERMISSIONS.QUOTES_PRINT) : false;
  const canSendQuote = isSales ? hasPermission(SALES_PERMISSIONS.QUOTES_SEND_EMAIL) : false;
  const canAddItem = hasPermission(isSales ? SALES_PERMISSIONS.QUOTES_ADD_ITEM : PURCHASES_PERMISSIONS.QUOTES_CREATE);
  const canUpdateItem = hasPermission(isSales ? SALES_PERMISSIONS.QUOTES_UPDATE_ITEM : PURCHASES_PERMISSIONS.QUOTES_UPDATE);
  const canDeleteItem = hasPermission(isSales ? SALES_PERMISSIONS.QUOTES_DELETE_ITEM : PURCHASES_PERMISSIONS.QUOTES_DELETE);
  const canEditItems = canUpdateItem && ['draft', 'pending'].includes(selectedQuote?.status?.toLowerCase() || '');
  const canSend = canSendQuote;

  // ── Data loading ────────────────────────────────────────────────────────────
  const loadQuotes = React.useCallback(async (silent = false) => {
    if (!userId) return;
    silent ? setIsRefreshing(true) : setIsLoading(true);
    const data = await getQuotesForUser(userId);
    setUserQuotes(data);
    silent ? setIsRefreshing(false) : setIsLoading(false);
  }, [userId]);

  const loadItems = React.useCallback(async (quoteId: string) => {
    setIsLoadingItems(true);
    try {
      const data = await api.get(
        isSales ? API_ROUTES.SALES.QUOTES_ITEMS : API_ROUTES.PURCHASES.QUOTES_ITEMS,
        { quote_id: quoteId, is_sales: isSales ? 'true' : 'false' }
      );
      const raw = Array.isArray(data) ? data : (data.items || data.data || []);
      setQuoteItems(raw.map((i: any) => ({
        id: String(i.id),
        service_id: String(i.service_id),
        service_name: i.service_name || '',
        unit_price: parseFloat(i.unit_price) || 0,
        quantity: parseInt(i.quantity) || 1,
        total: parseFloat(i.total) || 0,
        tooth_number: i.tooth_number ?? undefined,
      })));
    } catch {
      setQuoteItems([]);
    } finally {
      setIsLoadingItems(false);
    }
  }, [isSales]);

  const loadServices = React.useCallback(async () => {
    if (services.length > 0) return;
    try {
      const data = await (isSales ? getSalesServices({ limit: 500 }) : getPurchaseServices({ limit: 500 }));
      setServices(data.items || []);
    } catch { /* silent */ }
  }, [isSales, services.length]);

  React.useEffect(() => { loadQuotes(); }, [loadQuotes]);

  // Efecto para refrescar cuando cambia refreshTrigger
  React.useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      loadQuotes(true);
    }
  }, [refreshTrigger]);

  // ── Row selection ────────────────────────────────────────────────────────────
  const handleRowSelectionChange = React.useCallback((selectedRows: Quote[]) => {
    const quote = selectedRows[0] ?? null;
    setSelectedQuote(quote);
    if (!quote) {
      setIsSheetOpen(false);
      setQuoteItems([]);
    }
    onQuoteSelect?.(quote);
  }, [onQuoteSelect]);

  const handleOpenSheet = React.useCallback((quote: Quote) => {
    setIsSheetOpen(true);
    loadItems(quote.id);
    loadServices();
  }, [loadItems, loadServices]);

  // ── Record actions ──────────────────────────────────────────────────────────
  const handlePrint = async () => {
    if (!selectedQuote || !canPrintQuote) return;
    try {
      const blob = await api.getBlob(API_ROUTES.PURCHASES.QUOTES_PRINT, { quote_id: selectedQuote.id });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: 'Error al imprimir', variant: 'destructive' });
    }
  };

  const handleSend = async () => {
    if (!selectedQuote || !canSendQuote) return;
    try {
      await api.post(API_ROUTES.PURCHASES.QUOTES_SEND, { quote_id: selectedQuote.id, is_sales: isSales });
      toast({ title: 'Presupuesto enviado' });
      await loadQuotes(true);
    } catch {
      toast({ title: 'Error al enviar', variant: 'destructive' });
    }
  };

  const handleSendEmailClick = (quote: Quote) => {
    setSelectedQuoteForEmail(quote);
    setEmailRecipients(quote.userEmail || '');
    setIsSendEmailDialogOpen(true);
  };

  const sendEmail = async (emails: string[]) => {
    if (!selectedQuoteForEmail) return;

    setIsSendingEmail(true);
    try {
      await api.post(
        API_ROUTES.PURCHASES.QUOTES_SEND,
        {
          quote_id: selectedQuoteForEmail.id,
          is_sales: isSales,
          emails,
        }
      );
      toast({ title: tQuotes('sendEmailDialog.success') });
      setIsSendEmailDialogOpen(false);
      setSelectedQuoteForEmail(null);
      setEmailRecipients('');
    } catch {
      toast({ title: tQuotes('sendEmailDialog.error'), variant: 'destructive' });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleConfirmSendEmail = async () => {
    if (!selectedQuoteForEmail) return;

    const emails = emailRecipients
      .split(',')
      .map(e => e.trim())
      .filter(e => e);

    if (emails.length === 0) {
      toast({ title: tQuotes('sendEmailDialog.errorNoEmail'), variant: 'destructive' });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = emails.filter(e => !emailRegex.test(e));
    if (invalidEmails.length > 0) {
      toast({ title: tQuotes('sendEmailDialog.errorInvalidEmails', { emails: invalidEmails.join(', ') }), variant: 'destructive' });
      return;
    }

    // Check communication preferences
    const preferences = await checkPreferencesByEmails(emails, 'email', 'billing');
    const disabled = getDisabledEmails(preferences);

    if (disabled.length > 0) {
      setDisabledEmails(disabled);
      setIsWarningDialogOpen(true);
      return;
    }

    await sendEmail(emails);
  };

  const handleWarningConfirm = async () => {
    setIsWarningDialogOpen(false);
    await sendEmail(emailRecipients.split(',').map(e => e.trim()).filter(e => e));
  };

  const handleConfirmAction = async () => {
    if (!selectedQuote || !confirmAction) return;
    setIsSubmittingAction(true);
    try {
      const route = confirmAction === 'confirm'
        ? (isSales ? API_ROUTES.SALES.QUOTE_CONFIRM : API_ROUTES.PURCHASES.QUOTE_CONFIRM)
        : (isSales ? API_ROUTES.SALES.QUOTE_REJECT : API_ROUTES.PURCHASES.QUOTE_REJECT);
      const res = await api.post(route, {
        quote_number: selectedQuote.id,
        confirm_reject: confirmAction,
        is_sales: isSales,
        notes: actionNotes,
      });
      if (Array.isArray(res) && res[0]?.code >= 400) throw new Error(res[0]?.message || 'Error');
      toast({ title: confirmAction === 'confirm' ? 'Presupuesto confirmado' : 'Presupuesto rechazado' });
      setConfirmAction(null);
      setActionNotes('');
      await loadQuotes(true);
      onDataChange?.();
    } catch (e: any) {
      toast({ title: e?.message || 'Error al procesar la acción', variant: 'destructive' });
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleDeleteQuote = async () => {
    if (!selectedQuote) return;
    try {
      const res = await api.delete(
        isSales ? API_ROUTES.SALES.QUOTE_DELETE : API_ROUTES.PURCHASES.QUOTE_DELETE,
        { id: selectedQuote.id, is_sales: isSales }
      );
      if (Array.isArray(res) && res[0]?.code >= 400) throw new Error(res[0]?.message || 'Error');
      toast({ title: 'Presupuesto eliminado' });
      setIsDeletingQuote(false);
      setIsSheetOpen(false);
      setRowSelection({});
      setSelectedQuote(null);
      onQuoteSelect?.(null);
      await loadQuotes(true);
      onDataChange?.();
    } catch (e: any) {
      toast({ title: e?.message || 'Error al eliminar', variant: 'destructive' });
    }
  };

  // ── Quote edit form ──────────────────────────────────────────────────────────
  const getSessionExchangeRate = React.useCallback(() => {
    if (!activeCashSession?.data?.opening_details?.date_rate) return 1;
    return activeCashSession.data.opening_details.date_rate;
  }, [activeCashSession]);

  const quoteEditForm = useForm<QuoteEditFormValues>({ resolver: zodResolver(quoteEditSchema) });
  const { fields: editItemFields, append: appendEditItem, remove: removeEditItem, update: updateEditItem } = useFieldArray({
    control: quoteEditForm.control,
    name: 'items',
  });

  React.useEffect(() => {
    if (!isEditQuoteOpen || !selectedQuote) return;
    const currency = (selectedQuote.currency as 'USD' | 'UYU') ?? 'USD';
    const exchangeRate = currency === 'UYU' ? 1 : (selectedQuote.exchange_rate || getSessionExchangeRate());
    const mappedItems = quoteItems.map(i => ({
      id: i.id,
      service_id: i.service_id,
      quantity: i.quantity,
      unit_price: i.unit_price,
      total: i.total,
      tooth_number: i.tooth_number ?? ('' as const),
    }));
    quoteEditForm.reset({ currency, exchange_rate: exchangeRate, notes: selectedQuote.notes ?? '', items: mappedItems });
    if (quoteItems.length === 0) loadItems(selectedQuote.id);
    loadServices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditQuoteOpen, selectedQuote]);

  // Auto-update exchange_rate when currency changes
  const watchedEditCurrency = quoteEditForm.watch('currency');
  const watchedEditExchangeRate = quoteEditForm.watch('exchange_rate');
  React.useEffect(() => {
    if (!isEditQuoteOpen) return;
    if (watchedEditCurrency === 'UYU') {
      if (watchedEditExchangeRate !== 1) quoteEditForm.setValue('exchange_rate', 1);
    } else {
      const sessionRate = getSessionExchangeRate();
      if (!watchedEditExchangeRate || watchedEditExchangeRate === 1) {
        quoteEditForm.setValue('exchange_rate', sessionRate);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedEditCurrency, isEditQuoteOpen]);

  // Re-populate items into form once loaded
  React.useEffect(() => {
    if (!isEditQuoteOpen || quoteItems.length === 0) return;
    const current = quoteEditForm.getValues('items');
    if (current.length === 0) {
      quoteEditForm.setValue('items', quoteItems.map(i => ({
        id: i.id,
        service_id: i.service_id,
        quantity: i.quantity,
        unit_price: i.unit_price,
        total: i.total,
        tooth_number: i.tooth_number ?? ('' as const),
      })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteItems, isEditQuoteOpen]);

  const handleSubmitQuoteEdit = async (values: QuoteEditFormValues) => {
    if (!selectedQuote) return;
    setIsSubmittingQuote(true);
    try {
      const calculatedTotal = values.items.reduce((sum, i) => sum + (Number(i.total) || 0), 0);
      const res = await api.post(isSales ? API_ROUTES.SALES.QUOTES_UPSERT : API_ROUTES.PURCHASES.QUOTES_UPSERT, {
        id: selectedQuote.id,
        user_id: selectedQuote.user_id,
        total: calculatedTotal,
        status: selectedQuote.status,
        payment_status: selectedQuote.payment_status,
        billing_status: selectedQuote.billing_status,
        currency: values.currency,
        exchange_rate: values.exchange_rate,
        notes: values.notes || '',
        items: values.items.map(i => ({
          id: i.id,
          service_id: i.service_id,
          quantity: i.quantity,
          unit_price: i.unit_price,
          total: i.total,
          tooth_number: isSales && i.tooth_number ? Number(i.tooth_number) : null,
        })),
        is_sales: isSales,
      });
      if (Array.isArray(res) && res[0]?.code >= 400) throw new Error(res[0]?.message || 'Error');
      toast({ title: 'Presupuesto actualizado' });
      setIsEditQuoteOpen(false);
      await loadQuotes(true);
      loadItems(selectedQuote.id);
      onDataChange?.();
    } catch (e: any) {
      toast({ title: e?.message || 'Error al actualizar', variant: 'destructive' });
    } finally {
      setIsSubmittingQuote(false);
    }
  };

  // ── Item form ────────────────────────────────────────────────────────────────
  const itemForm = useForm<ItemFormValues>({ resolver: zodResolver(itemSchema) });

  React.useEffect(() => {
    if (!isItemDialogOpen) return;
    if (editingItem) {
      itemForm.reset({ service_id: editingItem.service_id, quantity: editingItem.quantity, unit_price: editingItem.unit_price, tooth_number: editingItem.tooth_number });
    } else {
      itemForm.reset({ service_id: '', quantity: 1, unit_price: 0 });
    }
  }, [isItemDialogOpen, editingItem, itemForm]);

  const handleSubmitItem = async (values: ItemFormValues) => {
    if (!selectedQuote) return;
    setIsSubmittingItem(true);
    try {
      const res = await api.post(isSales ? API_ROUTES.SALES.QUOTES_LINES_UPSERT : API_ROUTES.PURCHASES.QUOTES_LINES_UPSERT, {
        ...(editingItem ? { id: editingItem.id } : {}),
        quote_id: selectedQuote.id,
        service_id: values.service_id,
        quantity: values.quantity,
        unit_price: values.unit_price,
        total: values.quantity * values.unit_price,
        tooth_number: isSales ? (values.tooth_number || null) : null,
        is_sales: isSales,
      });
      if (Array.isArray(res) && res[0]?.code >= 400) throw new Error(res[0]?.message || 'Error');
      toast({ title: editingItem ? 'Ítem actualizado' : 'Ítem agregado' });
      setIsItemDialogOpen(false);
      loadItems(selectedQuote.id);
      onDataChange?.();
    } catch (e: any) {
      toast({ title: e?.message || 'Error al guardar ítem', variant: 'destructive' });
    } finally {
      setIsSubmittingItem(false);
    }
  };

  const handleConfirmDeleteItem = async () => {
    if (!deletingItem || !selectedQuote) return;
    try {
      const res = await api.delete(
        isSales ? API_ROUTES.SALES.QUOTES_LINES_DELETE : API_ROUTES.PURCHASES.QUOTES_LINES_DELETE,
        { id: deletingItem.id, quote_id: selectedQuote.id, is_sales: isSales }
      );
      if (Array.isArray(res) && res[0]?.code >= 400) throw new Error(res[0]?.message || 'Error');
      toast({ title: 'Ítem eliminado' });
      setDeletingItem(null);
      loadItems(selectedQuote.id);
      onDataChange?.();
    } catch (e: any) {
      toast({ title: e?.message || 'Error al eliminar', variant: 'destructive' });
    }
  };

  // ── Toolbar actions ───────────────────────────────────────────────────────────
  const toolbarActions = selectedQuote ? (
    <div className="flex items-center gap-1.5">
      {/* Acciones principales fuera del dropdown */}
      {isDraft && canConfirmQuote && (
        <>
          <Button
            variant="default"
            size="sm"
            className="h-8 gap-1.5 text-xs bg-green-600 hover:bg-green-700 text-white"
            onClick={() => { setConfirmAction('confirm'); setActionNotes(''); }}
          >
            <CheckCircle className="h-3.5 w-3.5" />
            Confirmar
          </Button>
        </>
      )}
      {isDraft && canRejectQuote && (
        <>
          <Button
            variant="destructive"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => { setConfirmAction('reject'); setActionNotes(''); }}
          >
            <XCircle className="h-3.5 w-3.5" />
            Rechazar
          </Button>
        </>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
            Acciones
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canPrintQuote && (
            <DropdownMenuItem onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </DropdownMenuItem>
          )}
          {canSend && (
            <DropdownMenuItem onClick={() => handleSendEmailClick(selectedQuote)}>
              <Send className="h-4 w-4 mr-2" />
              Enviar
            </DropdownMenuItem>
          )}
          {isDraft && (canUpdateQuote || canDeleteQuote) && (
            <>
              <DropdownMenuSeparator />
              {canUpdateQuote && (
                <DropdownMenuItem onClick={() => setIsEditQuoteOpen(true)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Editar
                </DropdownMenuItem>
              )}
              {canDeleteQuote && (
                <DropdownMenuItem onClick={() => setIsDeletingQuote(true)} className="text-destructive focus:text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar
                </DropdownMenuItem>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => handleOpenSheet(selectedQuote)}>
        <Eye className="h-3.5 w-3.5" />
        Ver detalles
      </Button>
    </div>
  ) : null;

  // ── Render ───────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-2 pt-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  return (
    <>
      <Card className="flex-1 flex flex-col min-h-0 shadow-none border-0">
        <CardContent className="flex-1 flex flex-col min-h-0 p-0">
          <DataTable
            columns={columns}
            data={userQuotes}
            filterColumnId="doc_no"
            filterPlaceholder={t('UserQuotes.filterPlaceholder')}
            onRowSelectionChange={handleRowSelectionChange}
            enableSingleRowSelection
            rowSelection={rowSelection}
            setRowSelection={setRowSelection}
            onRefresh={() => loadQuotes(true)}
            isRefreshing={isRefreshing}
            extraButtons={toolbarActions}
            columnTranslations={{
              doc_no: t('QuoteColumns.quoteId'),
              total: t('QuoteColumns.total'),
              status: t('UserColumns.status'),
              payment_status: t('Navigation.Payments'),
              billing_status: t('QuoteColumns.billingStatus'),
              currency: t('QuoteColumns.currency'),
              exchange_rate: t('QuoteColumns.exchangeRate'),
            }}
          />
        </CardContent>
      </Card>

      {/* ── Detail Sheet ── */}
      <ResizableSheet
        open={isSheetOpen}
        onOpenChange={(open) => {
          setIsSheetOpen(open);
          if (!open) { setRowSelection({}); setSelectedQuote(null); setQuoteItems([]); onQuoteSelect?.(null); }
        }}
        defaultWidth={800}
        minWidth={560}
        maxWidth={1400}
        storageKey="user-quotes-sheet-width"
      >
        {selectedQuote && (
          <>
            {/* Header estilo ficha del paciente */}
            <div className="flex-none bg-card shadow-sm border-b border-border">
              {/* Título y badges principales */}
              <div className="px-6 py-4 border-b border-border/50">
                <div className="flex items-start justify-between gap-4 pr-10">
                  <div className="flex items-center gap-3">
                    <div>
                      <SheetTitle className="text-2xl font-bold text-card-foreground">{selectedQuote.doc_no}</SheetTitle>
                      <SheetDescription className="text-sm text-muted-foreground mt-0.5">Presupuesto</SheetDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    <Badge variant={(STATUS_BADGE[selectedQuote.status.toLowerCase()] ?? 'default') as any} className="capitalize">
                      {t(`QuotesPage.quoteDialog.${selectedQuote.status.toLowerCase()}`)}
                    </Badge>
                    <Badge variant={(PAYMENT_BADGE[selectedQuote.payment_status.toLowerCase()] ?? 'outline') as any} className="capitalize">
                      {(() => {
                        const status = selectedQuote.payment_status.toLowerCase().trim();
                        const keyMap: Record<string, string> = { paid: 'paid', partial: 'partial', 'partially paid': 'partiallyPaid', partially_paid: 'partiallyPaid', unpaid: 'unpaid' };
                        return t(`QuotesPage.quoteDialog.${keyMap[status] || 'unpaid'}`);
                      })()}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Información del documento integrada en el header */}
              <div className="px-6 py-3">
                <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Total:</span>
                    <span className="font-semibold text-sm">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(selectedQuote.total)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Facturación:</span>
                    <Badge variant={(BILLING_BADGE[selectedQuote.billing_status.toLowerCase()] ?? 'outline') as any} className="text-xs font-normal capitalize">
                      {(() => {
                        const status = selectedQuote.billing_status.toLowerCase().trim();
                        const keyMap: Record<string, string> = { invoiced: 'invoiced', 'partially invoiced': 'partiallyInvoiced', partially_invoiced: 'partiallyInvoiced', 'not invoiced': 'notInvoiced', not_invoiced: 'notInvoiced' };
                        return t(`QuotesPage.quoteDialog.${keyMap[status] || 'notInvoiced'}`);
                      })()}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Creado:</span>
                    <span className="text-sm">{formatDateTime(selectedQuote.createdAt)}</span>
                  </div>
                  {selectedQuote.notes && (
                    <div className="flex items-center gap-2 w-full mt-1">
                      <span className="text-xs text-muted-foreground">Notas:</span>
                      <span className="text-sm text-muted-foreground italic">{selectedQuote.notes}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="px-6 py-3 flex items-center gap-2 flex-wrap border-b bg-muted/30">
              {/* Acciones principales */}
              {isDraft && canConfirmQuote && (
                <Button variant="default" size="sm" className="h-8 gap-1.5 text-xs bg-green-600 hover:bg-green-700 text-white" onClick={() => { setConfirmAction('confirm'); setActionNotes(''); }}>
                  <CheckCircle className="h-3.5 w-3.5" />
                  Confirmar
                </Button>
              )}
              {isDraft && canRejectQuote && (
                <Button variant="destructive" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => { setConfirmAction('reject'); setActionNotes(''); }}>
                  <XCircle className="h-3.5 w-3.5" />
                  Rechazar
                </Button>
              )}
              {(canPrintQuote || canSend || (isDraft && (canUpdateQuote || canDeleteQuote))) && (
                <Separator orientation="vertical" className="h-6 mx-1" />
              )}
              {/* Acciones secundarias */}
              {canPrintQuote && (
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={handlePrint}>
                  <Printer className="h-3.5 w-3.5" />
                  Imprimir
                </Button>
              )}
              {canSend && (
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => handleSendEmailClick(selectedQuote)}>
                  <Send className="h-3.5 w-3.5" />
                  Enviar
                </Button>
              )}
              {isDraft && canUpdateQuote && (
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setIsEditQuoteOpen(true)}>
                  <Pencil className="h-3.5 w-3.5" />
                  Editar
                </Button>
              )}
              {isDraft && canDeleteQuote && (
                <Button variant="destructive" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setIsDeletingQuote(true)}>
                  <Trash2 className="h-3.5 w-3.5" />
                  Eliminar
                </Button>
              )}
            </div>

            {/* Items */}
            <div className="flex-1 flex flex-col overflow-hidden px-4 py-3">
              <p className="text-sm font-semibold mb-2">Ítems del presupuesto</p>
              <div className="flex-1 overflow-hidden">
                <QuoteItemsTable
                  items={quoteItems}
                  isLoading={isLoadingItems}
                  canEdit={canEditItems}
                  onCreate={canAddItem ? () => { setEditingItem(null); setIsItemDialogOpen(true); loadServices(); } : () => { }}
                  onEdit={canUpdateItem ? (item) => { setEditingItem(item); setIsItemDialogOpen(true); loadServices(); } : () => { }}
                  onDelete={canDeleteItem ? setDeletingItem : () => { }}
                  onRefresh={() => loadItems(selectedQuote.id)}
                  showToothNumber={isSales}
                />
              </div>
            </div>
          </>
        )}
      </ResizableSheet>

      {/* ── Edit quote dialog ── */}
      <Dialog open={isEditQuoteOpen} onOpenChange={setIsEditQuoteOpen}>
        <DialogContent maxWidth="4xl">
          <Form {...quoteEditForm}>
            <form onSubmit={quoteEditForm.handleSubmit(handleSubmitQuoteEdit)} className="flex flex-col flex-1 overflow-hidden">
              <DialogHeader>
                <DialogTitle>Editar presupuesto</DialogTitle>
                <DialogDescription>Modifica los datos del presupuesto {selectedQuote?.doc_no}.</DialogDescription>
              </DialogHeader>
              <DialogBody className="space-y-4 py-4 px-6">
                {/* Currency + Exchange rate */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={quoteEditForm.control} name="currency" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Moneda</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="UYU">UYU</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={quoteEditForm.control} name="exchange_rate" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de cambio</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0.0001"
                          disabled={watchedEditCurrency === 'UYU'}
                          {...field}
                          value={watchedEditCurrency === 'UYU' ? '1.00' : (field.value ?? '')}
                          onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                          className={watchedEditCurrency === 'UYU' ? 'bg-muted text-muted-foreground cursor-not-allowed' : ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                {/* Notes */}
                <FormField control={quoteEditForm.control} name="notes" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notas <span className="text-muted-foreground">(opcional)</span></FormLabel>
                    <FormControl><Textarea rows={2} placeholder="Observaciones..." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* Items */}
                <Card>
                  <CardContent className="p-0">
                    <div className="flex items-center justify-between px-4 pt-4 pb-2">
                      <p className="text-sm font-semibold">Ítems del presupuesto</p>
                      {canAddItem && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => { loadServices(); appendEditItem({ service_id: '', quantity: 1, unit_price: 0, total: 0, tooth_number: '' as any }); }}
                        >
                          Agregar ítem
                        </Button>
                      )}
                    </div>
                    <div className="overflow-x-auto px-4 pb-4">
                      {isLoadingItems ? (
                        <div className="space-y-2 py-2">
                          <Skeleton className="h-8 w-full" />
                          <Skeleton className="h-8 w-full" />
                        </div>
                      ) : (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-muted-foreground text-center border-b">
                              <th className="text-left font-semibold p-2">Servicio</th>
                              <th className="font-semibold p-2 w-24">Cantidad</th>
                              <th className="font-semibold p-2 w-28">Precio unit.</th>
                              <th className="font-semibold p-2 w-28">Total</th>
                              {isSales && <th className="font-semibold p-2 w-24">N° diente</th>}
                              <th className="p-2 w-10"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {editItemFields.map((fieldItem, index) => (
                              <tr key={fieldItem.id} className="align-top border-b last:border-0">
                                <td className="p-1">
                                  <FormField control={quoteEditForm.control} name={`items.${index}.service_id`} render={({ field }) => (
                                    <FormItem>
                                      <ServiceSelector
                                        isSales={isSales}
                                        value={field.value}
                                        onValueChange={(serviceId, service) => {
                                          field.onChange(serviceId);
                                          if (service) {
                                            const qty = quoteEditForm.getValues(`items.${index}.quantity`) || 1;
                                            updateEditItem(index, { ...quoteEditForm.getValues(`items.${index}`), service_id: serviceId, unit_price: Number(service.price), total: Number(service.price) * qty });
                                          }
                                        }}
                                        placeholder="Buscar servicio..."
                                        noResultsText="Sin resultados"
                                        triggerText="Seleccionar servicio"
                                      />
                                      <FormMessage />
                                    </FormItem>
                                  )} />
                                </td>
                                <td className="p-1">
                                  <FormField control={quoteEditForm.control} name={`items.${index}.quantity`} render={({ field }) => (
                                    <FormItem>
                                      <FormControl>
                                        <Input type="number" step="1" min="1" {...field}
                                          onChange={e => {
                                            field.onChange(e);
                                            const qty = parseInt(e.target.value) || 0;
                                            const price = quoteEditForm.getValues(`items.${index}.unit_price`) || 0;
                                            updateEditItem(index, { ...quoteEditForm.getValues(`items.${index}`), quantity: qty, total: qty * price });
                                          }}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )} />
                                </td>
                                <td className="p-1">
                                  <FormField control={quoteEditForm.control} name={`items.${index}.unit_price`} render={({ field }) => (
                                    <FormItem>
                                      <FormControl>
                                        <Input type="number" step="0.01" min="0" {...field}
                                          onChange={e => {
                                            field.onChange(e);
                                            const price = parseFloat(e.target.value) || 0;
                                            const qty = quoteEditForm.getValues(`items.${index}.quantity`) || 0;
                                            updateEditItem(index, { ...quoteEditForm.getValues(`items.${index}`), unit_price: price, total: qty * price });
                                          }}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )} />
                                </td>
                                <td className="p-1">
                                  <FormField control={quoteEditForm.control} name={`items.${index}.total`} render={({ field }) => (
                                    <FormItem>
                                      <FormControl>
                                        <Input
                                          readOnly
                                          disabled
                                          value={new Intl.NumberFormat('en-US', { style: 'currency', currency: watchedEditCurrency || 'USD' }).format(Number(field.value) || 0)}
                                          className="bg-muted text-muted-foreground cursor-not-allowed"
                                        />
                                      </FormControl>
                                    </FormItem>
                                  )} />
                                </td>
                                {isSales && (
                                  <td className="p-1">
                                    <FormField control={quoteEditForm.control} name={`items.${index}.tooth_number`} render={({ field }) => (
                                      <FormItem>
                                        <FormControl>
                                          <Input
                                            type="number"
                                            min={11}
                                            max={85}
                                            placeholder="—"
                                            {...field}
                                            value={field.value ?? ''}
                                            onChange={e => field.onChange(e.target.value === '' ? '' : parseInt(e.target.value))}
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )} />
                                  </td>
                                )}
                                <td className="p-1 text-center">
                                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => removeEditItem(index)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </td>
                              </tr>
                            ))}
                            {editItemFields.length === 0 && (
                              <tr><td colSpan={isSales ? 6 : 5} className="text-center text-muted-foreground text-xs py-4">Sin ítems. Agrega uno con el botón superior.</td></tr>
                            )}
                          </tbody>
                        </table>
                      )}
                    </div>
                    {editItemFields.length > 0 && (
                      <div className="flex justify-end px-4 pb-3">
                        <span className="text-sm font-semibold">
                          Total: {new Intl.NumberFormat('en-US', { style: 'currency', currency: watchedEditCurrency || 'USD' }).format(
                            editItemFields.reduce((sum, _, i) => sum + (Number(quoteEditForm.getValues(`items.${i}.total`)) || 0), 0)
                          )}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </DialogBody>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditQuoteOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={isSubmittingQuote}>
                  {isSubmittingQuote && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Guardar cambios
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Confirm / Reject dialog ── */}
      <Dialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>{confirmAction === 'confirm' ? 'Confirmar presupuesto' : 'Rechazar presupuesto'}</DialogTitle>
            <DialogDescription>
              {confirmAction === 'confirm'
                ? `¿Confirmar el presupuesto ${selectedQuote?.doc_no}?`
                : `¿Rechazar el presupuesto ${selectedQuote?.doc_no}? Esta acción no se puede deshacer.`}
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 py-4 space-y-2">
            <label className="text-sm font-medium">Notas <span className="text-muted-foreground">(opcional)</span></label>
            <Textarea rows={3} placeholder="Agrega una observación..." value={actionNotes} onChange={e => setActionNotes(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)}>Cancelar</Button>
            <Button
              variant={confirmAction === 'reject' ? 'destructive' : 'default'}
              onClick={handleConfirmAction}
              disabled={isSubmittingAction}
            >
              {isSubmittingAction && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {confirmAction === 'confirm' ? 'Confirmar' : 'Rechazar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete quote dialog ── */}
      <Dialog open={isDeletingQuote} onOpenChange={setIsDeletingQuote}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Eliminar presupuesto</DialogTitle>
            <DialogDescription>¿Estás seguro de que deseas eliminar <strong>{selectedQuote?.doc_no}</strong>? Esta acción no se puede deshacer.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeletingQuote(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteQuote}>
              <Trash2 className="h-4 w-4 mr-2" />
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Item create/edit dialog ── */}
      <Dialog open={isItemDialogOpen} onOpenChange={setIsItemDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar ítem' : 'Agregar ítem'}</DialogTitle>
            <DialogDescription>Completa los datos del ítem del presupuesto.</DialogDescription>
          </DialogHeader>
          <Form {...itemForm}>
            <form onSubmit={itemForm.handleSubmit(handleSubmitItem)}>
              <div className="px-6 py-4 space-y-4">
                <FormField control={itemForm.control} name="service_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Servicio</FormLabel>
                    <Select onValueChange={(val) => {
                      field.onChange(val);
                      const svc = services.find(s => s.id === val);
                      if (svc && !editingItem) itemForm.setValue('unit_price', svc.price);
                    }} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar servicio" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {services.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={itemForm.control} name="quantity" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cantidad</FormLabel>
                      <FormControl><Input type="number" min={1} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={itemForm.control} name="unit_price" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Precio unitario</FormLabel>
                      <FormControl><Input type="number" min={0} step="0.01" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <ItemTotalField form={itemForm} />
                {isSales && (
                  <FormField control={itemForm.control} name="tooth_number" render={({ field }) => (
                    <FormItem>
                      <FormLabel>N° de diente <span className="text-muted-foreground">(opcional)</span></FormLabel>
                      <FormControl>
                        <Input type="number" min={1} max={99} placeholder="—" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? undefined : e.target.value)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsItemDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={isSubmittingItem}>
                  {isSubmittingItem && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingItem ? 'Guardar cambios' : 'Agregar'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Delete item dialog ── */}
      <Dialog open={!!deletingItem} onOpenChange={(open) => !open && setDeletingItem(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Eliminar ítem</DialogTitle>
            <DialogDescription>¿Estás seguro de que deseas eliminar <strong>{deletingItem?.service_name}</strong>? Esta acción no se puede deshacer.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingItem(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleConfirmDeleteItem}>
              <Trash2 className="h-4 w-4 mr-2" />
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Email Dialog ── */}
      <Dialog open={isSendEmailDialogOpen} onOpenChange={setIsSendEmailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tQuotes('sendEmailDialog.title')}</DialogTitle>
            <DialogDescription>
              {tQuotes('sendEmailDialog.description', { id: selectedQuoteForEmail?.id || '' })}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 px-6">
            <Label htmlFor="email-recipients">{tQuotes('sendEmailDialog.recipients')}</Label>
            <Input
              id="email-recipients"
              value={emailRecipients}
              onChange={(e) => setEmailRecipients(e.target.value)}
              placeholder={tQuotes('sendEmailDialog.placeholder')}
            />
            <p className="text-sm text-muted-foreground mt-1">
              {tQuotes('sendEmailDialog.helperText')}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSendEmailDialogOpen(false)}>
              {tQuotes('sendEmailDialog.cancel')}
            </Button>
            <Button onClick={handleConfirmSendEmail} disabled={isSendingEmail}>
              {isSendingEmail ? tQuotes('sendEmailDialog.sending') : tQuotes('sendEmailDialog.send')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Warning Dialog ── */}
      <CommunicationWarningDialog
        open={isWarningDialogOpen}
        onOpenChange={setIsWarningDialogOpen}
        disabledItems={disabledEmails}
        onConfirm={handleWarningConfirm}
      />
    </>
  );
}
