'use client';

import { InvoiceItemsTable } from '@/components/tables/invoice-items-table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { useCashSessionValidation } from '@/hooks/use-cash-session-validation';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import { Invoice, InvoiceItem, PaymentMethod, Service, UserDetailMode } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';
import { api } from '@/services/api';
import { getPurchaseServices, getSalesServices } from '@/services/services';
import { checkPreferencesByEmails, getDisabledEmails } from '@/hooks/use-communication-preferences';
import { CommunicationWarningDialog } from '@/components/communication-warning-dialog';
import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnDef, RowSelectionState } from '@tanstack/react-table';
import { AlertTriangle, CheckCircle, ChevronDown, CreditCard, Eye, Loader2, Pencil, Printer, Send, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import * as z from 'zod';

// ── Schemas ───────────────────────────────────────────────────────────────────
const itemSchema = z.object({
  service_id: z.string().min(1, 'Selecciona un servicio'),
  quantity: z.coerce.number().min(1, 'Mínimo 1'),
  unit_price: z.coerce.number().min(0, 'Precio inválido'),
});
type ItemFormValues = z.infer<typeof itemSchema>;

const invoiceEditSchema = z.object({
  type: z.enum(['invoice', 'credit_note']),
  currency: z.enum(['USD', 'UYU']),
  is_historical: z.boolean().optional(),
  notes: z.string().optional(),
  items: z.array(z.object({
    id: z.string().optional(),
    service_id: z.string().min(1, 'Selecciona un servicio'),
    quantity: z.coerce.number().min(1, 'Mínimo 1'),
    unit_price: z.coerce.number().min(0, 'Precio inválido'),
    total: z.coerce.number().optional(),
  })).default([]),
});
type InvoiceEditFormValues = z.infer<typeof invoiceEditSchema>;

const paymentSchema = z.object({
  amount: z.coerce.number().min(0.01, 'Monto requerido'),
  payment_method_id: z.string().min(1, 'Selecciona un método de pago'),
  payment_date: z.string().min(1, 'Fecha requerida'),
  notes: z.string().optional(),
  is_historical: z.boolean().optional(),
});
type PaymentFormValues = z.infer<typeof paymentSchema>;

// ── Item total display ────────────────────────────────────────────────────────
function ItemTotalField({ form }: { form: ReturnType<typeof useForm<ItemFormValues>> }) {
  const quantity = useWatch({ control: form.control, name: 'quantity' }) ?? 0;
  const unitPrice = useWatch({ control: form.control, name: 'unit_price' }) ?? 0;
  const total = Number(quantity) * Number(unitPrice);
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">Total</label>
      <Input
        value={new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(total)}
        readOnly
        disabled
        className="bg-muted text-muted-foreground cursor-not-allowed"
      />
    </div>
  );
}

// ── Status helpers ────────────────────────────────────────────────────────────
const STATUS_BADGE: Record<string, any> = { paid: 'success', booked: 'success', sent: 'default', draft: 'outline', overdue: 'destructive' };
const PAYMENT_BADGE: Record<string, any> = { paid: 'success', partial: 'info', partially_paid: 'info', unpaid: 'outline' };

// ── Columns ───────────────────────────────────────────────────────────────────
const getColumns = (t: (key: string) => string, tStatus: (key: string) => string): ColumnDef<Invoice>[] => [
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
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('InvoicesPage.columns.docNo')} />,
    cell: ({ row }) => <div className="font-medium">{row.getValue('doc_no') || `INV-${row.original.id}`}</div>,
  },
  {
    accessorKey: 'order_doc_no',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('InvoicesPage.columns.orderDocNo')} />,
    cell: ({ row }) => {
      const v = row.getValue('order_doc_no') as string;
      return <div className="font-medium">{v || (row.original.order_id ? `ORD-${row.original.order_id}` : '-')}</div>;
    },
  },
  {
    accessorKey: 'total',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('InvoicesPage.columns.total')} />,
    cell: ({ row }) => (
      <div className="font-medium">
        {new Intl.NumberFormat('en-US', { style: 'currency', currency: row.original.currency || 'USD' }).format(parseFloat(row.getValue('total')))}
      </div>
    ),
  },
  {
    accessorKey: 'status',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('InvoicesPage.columns.status')} />,
    cell: ({ row }) => {
      const status = row.getValue('status') as string;
      return <Badge variant={(STATUS_BADGE[status?.toLowerCase()] ?? 'default') as any} className="capitalize">{tStatus(status.toLowerCase())}</Badge>;
    },
  },
  {
    accessorKey: 'payment_status',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('InvoicesPage.columns.payment')} />,
    cell: ({ row }) => {
      const status = row.original.payment_status;
      return <Badge variant={(PAYMENT_BADGE[status?.toLowerCase()] ?? 'default') as any} className="capitalize">{status ? tStatus(status.toLowerCase()) : ''}</Badge>;
    },
  },
  {
    accessorKey: 'due_date',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('InvoicesPage.columns.dueDate')} />,
    cell: ({ row }) => {
      const dueDate = row.original.due_date;
      return <div className="font-medium">{dueDate ? formatDateTime(dueDate) : '-'}</div>;
    },
  },
  {
    accessorKey: 'createdAt',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('InvoicesPage.columns.createdAt')} />,
    cell: ({ row }) => formatDateTime(row.original.createdAt),
  },
];

// ── Data fetching ─────────────────────────────────────────────────────────────
async function getInvoicesForUser(userId: string): Promise<Invoice[]> {
  if (!userId) return [];
  try {
    const data = await api.get(API_ROUTES.USER_INVOICES, { user_id: userId });
    const invoicesData = Array.isArray(data) ? data : (data.invoices || data.data || []);
    return invoicesData.map((d: any) => ({
      id: d.id.toString(),
      invoice_ref: d.invoice_ref || 'N/A',
      doc_no: d.doc_no || null,
      order_id: d.order_id?.toString() ?? 'N/A',
      order_doc_no: d.order_doc_no || 'N/A',
      quote_id: d.quote_id?.toString() ?? 'N/A',
      user_id: d.user_id?.toString() ?? userId,
      user_name: d.user_name || '',
      type: d.type || 'invoice',
      total: parseFloat(d.total),
      status: d.status,
      payment_status: d.payment_state || d.payment_status,
      notes: d.notes || '',
      createdAt: d.created_at,
      updatedAt: d.updated_at,
      currency: d.currency || 'USD',
      is_historical: d.is_historical || false,
      due_date: d.due_date || null,
    }));
  } catch (error) {
    console.error('Failed to fetch user invoices:', error);
    return [];
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
interface UserInvoicesProps {
  userId: string;
  mode?: UserDetailMode;
  onDataChange?: () => void;
  refreshTrigger?: number;
}

export function UserInvoices({ userId, mode = 'sales', onDataChange, refreshTrigger }: UserInvoicesProps) {
  const t = useTranslations();
  const tStatus = useTranslations('InvoicesPage.status');
  const tInvoices = useTranslations('InvoicesPage');
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const { validateActiveSession, showCashSessionError } = useCashSessionValidation();
  const isSales = mode === 'sales';
  const [invoices, setInvoices] = React.useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [selectedInvoice, setSelectedInvoice] = React.useState<Invoice | null>(null);
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);

  // Sync selectedInvoice when invoices array changes
  React.useEffect(() => {
    if (selectedInvoice && invoices.length > 0) {
      const updatedInvoice = invoices.find(inv => inv.id === selectedInvoice.id);
      if (updatedInvoice) {
        const hasChanges =
          updatedInvoice.status !== selectedInvoice.status ||
          updatedInvoice.payment_status !== selectedInvoice.payment_status ||
          updatedInvoice.total !== selectedInvoice.total;
        if (hasChanges) {
          setSelectedInvoice(updatedInvoice);
        }
      } else {
        setSelectedInvoice(null);
        setRowSelection({});
      }
    }
  }, [invoices]);

  // Items
  const [invoiceItems, setInvoiceItems] = React.useState<InvoiceItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = React.useState(false);
  const [services, setServices] = React.useState<Service[]>([]);

  // Item dialogs
  const [isItemDialogOpen, setIsItemDialogOpen] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState<InvoiceItem | null>(null);
  const [deletingItem, setDeletingItem] = React.useState<InvoiceItem | null>(null);
  const [isSubmittingItem, setIsSubmittingItem] = React.useState(false);

  // Record-level dialogs
  const [isEditInvoiceOpen, setIsEditInvoiceOpen] = React.useState(false);
  const [isSubmittingInvoice, setIsSubmittingInvoice] = React.useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = React.useState(false);
  const [isSubmittingPayment, setIsSubmittingPayment] = React.useState(false);
  const [paymentMethods, setPaymentMethods] = React.useState<PaymentMethod[]>([]);

  // Email dialog states
  const [isSendEmailDialogOpen, setIsSendEmailDialogOpen] = React.useState(false);
  const [selectedInvoiceForEmail, setSelectedInvoiceForEmail] = React.useState<Invoice | null>(null);
  const [emailRecipients, setEmailRecipients] = React.useState('');
  const [isSendingEmail, setIsSendingEmail] = React.useState(false);
  const [isWarningDialogOpen, setIsWarningDialogOpen] = React.useState(false);
  const [disabledEmails, setDisabledEmails] = React.useState<string[]>([]);

  const columns = React.useMemo(() => getColumns(t, tStatus), [t, tStatus]);
  const isDraft = selectedInvoice?.status?.toLowerCase() === 'draft';
  const isBookedUnpaid = selectedInvoice?.status?.toLowerCase() === 'booked'
    && !['paid'].includes(selectedInvoice?.payment_status?.toLowerCase() || '');
  const canConfirmInvoice = hasPermission(isSales ? SALES_PERMISSIONS.INVOICES_CONFIRM : PURCHASES_PERMISSIONS.INVOICES_CONFIRM);
  const canUpdateInvoice = hasPermission(isSales ? SALES_PERMISSIONS.INVOICES_UPDATE : PURCHASES_PERMISSIONS.INVOICES_UPDATE);
  const canAddItem = hasPermission(isSales ? SALES_PERMISSIONS.INVOICES_ADD_ITEM : PURCHASES_PERMISSIONS.INVOICES_ADD_ITEM);
  const canUpdateItem = hasPermission(isSales ? SALES_PERMISSIONS.INVOICES_UPDATE_ITEM : PURCHASES_PERMISSIONS.INVOICES_UPDATE_ITEM);
  const canDeleteItem = hasPermission(isSales ? SALES_PERMISSIONS.INVOICES_DELETE_ITEM : PURCHASES_PERMISSIONS.INVOICES_DELETE_ITEM);
  const canCreatePayment = hasPermission(isSales ? SALES_PERMISSIONS.PAYMENTS_CREATE : PURCHASES_PERMISSIONS.PAYMENTS_CREATE);
  const canEditItems = isDraft && (canAddItem || canUpdateItem || canDeleteItem);

  // ── Data loading ────────────────────────────────────────────────────────────
  const loadInvoices = React.useCallback(async (silent = false) => {
    if (!userId) return;
    silent ? setIsRefreshing(true) : setIsLoading(true);
    const data = await getInvoicesForUser(userId);
    setInvoices(data);
    silent ? setIsRefreshing(false) : setIsLoading(false);
  }, [userId]);

  const loadItems = React.useCallback(async (invoiceId: string) => {
    setIsLoadingItems(true);
    try {
      const data = await api.get(
        isSales ? API_ROUTES.SALES.INVOICE_ITEMS : API_ROUTES.PURCHASES.INVOICE_ITEMS,
        { invoice_id: invoiceId, is_sales: isSales ? 'true' : 'false' }
      );
      const raw = Array.isArray(data) ? data : (data.items || data.data || []);
      setInvoiceItems(raw.map((i: any) => ({
        id: String(i.id),
        service_id: String(i.service_id),
        service_name: i.service_name || '',
        unit_price: parseFloat(i.unit_price) || 0,
        quantity: parseInt(i.quantity) || 1,
        total: parseFloat(i.total) || 0,
      })));
    } catch {
      setInvoiceItems([]);
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

  const loadPaymentMethods = React.useCallback(async () => {
    if (paymentMethods.length > 0) return;
    try {
      const data = await api.get(API_ROUTES.PAYMENT_METHODS);
      const raw = Array.isArray(data) ? data : (data.payment_methods || data.data || []);
      setPaymentMethods(raw.map((m: any) => ({ id: String(m.id), name: m.name, code: m.code, is_cash_equivalent: m.is_cash_equivalent, is_active: m.is_active })));
    } catch { /* silent */ }
  }, [paymentMethods.length]);

  React.useEffect(() => { loadInvoices(); }, [loadInvoices]);

  // Efecto para refrescar cuando cambia refreshTrigger
  React.useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      loadInvoices(true);
    }
  }, [refreshTrigger]);

  // ── Row selection ────────────────────────────────────────────────────────────
  const handleRowSelectionChange = React.useCallback((selectedRows: Invoice[]) => {
    const invoice = selectedRows[0] ?? null;
    setSelectedInvoice(invoice);
    if (!invoice) { setIsSheetOpen(false); setInvoiceItems([]); }
  }, []);

  const handleOpenSheet = React.useCallback((invoice: Invoice) => {
    setIsSheetOpen(true);
    loadItems(invoice.id);
  }, [loadItems]);

  // ── Record actions ──────────────────────────────────────────────────────────
  const handlePrint = async () => {
    if (!selectedInvoice) return;
    try {
      const blob = await api.getBlob(
        isSales ? API_ROUTES.SALES.API_INVOICE_PRINT : API_ROUTES.PURCHASES.API_INVOICE_PRINT,
        { id: selectedInvoice.id }
      );
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: 'Error al imprimir', variant: 'destructive' });
    }
  };

  const handleSendEmailClick = (invoice: Invoice) => {
    setSelectedInvoiceForEmail(invoice);
    setEmailRecipients(invoice.userEmail || '');
    setIsSendEmailDialogOpen(true);
  };

  const handleConfirmSendEmail = async () => {
    if (!selectedInvoiceForEmail) return;

    const emails = emailRecipients
      .split(',')
      .map(e => e.trim())
      .filter(e => e);

    if (emails.length === 0) {
      toast({ title: tInvoices('sendEmailDialog.errorNoEmail'), variant: 'destructive' });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = emails.filter(e => !emailRegex.test(e));
    if (invalidEmails.length > 0) {
      toast({ title: tInvoices('sendEmailDialog.errorInvalidEmails', { emails: invalidEmails.join(', ') }), variant: 'destructive' });
      return;
    }

    // Verificar preferencias de comunicación
    const preferences = await checkPreferencesByEmails(emails, 'email', 'billing');
    const disabled = getDisabledEmails(preferences);

    if (disabled.length > 0) {
      setDisabledEmails(disabled);
      setIsWarningDialogOpen(true);
      return;
    }

    await sendEmail(emails);
  };

  const sendEmail = async (emails: string[]) => {
    if (!selectedInvoiceForEmail) return;

    setIsSendingEmail(true);
    try {
      await api.post(
        isSales ? API_ROUTES.SALES.API_INVOICE_SEND : API_ROUTES.PURCHASES.API_INVOICE_SEND,
        { invoiceId: selectedInvoiceForEmail.id, emails }
      );
      toast({ title: tInvoices('sendEmailDialog.success') });
      setIsSendEmailDialogOpen(false);
      setSelectedInvoiceForEmail(null);
      setEmailRecipients('');
    } catch {
      toast({ title: tInvoices('sendEmailDialog.error'), variant: 'destructive' });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleWarningConfirm = async () => {
    setIsWarningDialogOpen(false);
    await sendEmail(emailRecipients.split(',').map(e => e.trim()).filter(e => e));
  };

  const handleConfirm = async () => {
    if (!selectedInvoice || !canConfirmInvoice) return;
    try {
      await api.post(
        isSales ? API_ROUTES.SALES.INVOICES_CONFIRM : API_ROUTES.PURCHASES.INVOICES_CONFIRM,
        { id: parseInt(selectedInvoice.id, 10) }
      );
      toast({ title: 'Factura confirmada' });
      await loadInvoices(true);
      onDataChange?.();
    } catch {
      toast({ title: 'Error al confirmar', variant: 'destructive' });
    }
  };

  // ── Edit invoice form ─────────────────────────────────────────────────────────
  const invoiceEditForm = useForm<InvoiceEditFormValues>({ resolver: zodResolver(invoiceEditSchema) });
  const { fields: editInvoiceItemFields, append: appendEditInvoiceItem, remove: removeEditInvoiceItem, update: updateEditInvoiceItem } = useFieldArray({
    control: invoiceEditForm.control,
    name: 'items',
  });

  React.useEffect(() => {
    if (!isEditInvoiceOpen || !selectedInvoice) return;
    const mappedItems = invoiceItems.map(i => ({
      id: i.id,
      service_id: i.service_id,
      quantity: i.quantity,
      unit_price: i.unit_price,
      total: i.total,
    }));
    invoiceEditForm.reset({
      type: (selectedInvoice.type as 'invoice' | 'credit_note') ?? 'invoice',
      currency: (selectedInvoice.currency as 'USD' | 'UYU') ?? 'USD',
      is_historical: selectedInvoice.is_historical ?? false,
      notes: selectedInvoice.notes ?? '',
      items: mappedItems,
    });
    if (invoiceItems.length === 0) loadItems(selectedInvoice.id);
    loadServices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditInvoiceOpen, selectedInvoice]);

  // Re-populate items into form once loaded
  React.useEffect(() => {
    if (!isEditInvoiceOpen || invoiceItems.length === 0) return;
    const current = invoiceEditForm.getValues('items');
    if (current.length === 0) {
      invoiceEditForm.setValue('items', invoiceItems.map(i => ({
        id: i.id,
        service_id: i.service_id,
        quantity: i.quantity,
        unit_price: i.unit_price,
        total: i.total,
      })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceItems, isEditInvoiceOpen]);

  const watchedEditInvoiceCurrency = invoiceEditForm.watch('currency');

  const handleSubmitInvoiceEdit = async (values: InvoiceEditFormValues) => {
    if (!selectedInvoice) return;
    setIsSubmittingInvoice(true);
    try {
      const calculatedTotal = (values.items || []).reduce((sum, i) => sum + (Number(i.total) || 0), 0);
      await api.post(isSales ? API_ROUTES.SALES.INVOICES_UPSERT : API_ROUTES.PURCHASES.INVOICES_UPSERT, {
        id: selectedInvoice.id,
        user_id: selectedInvoice.user_id,
        type: values.type,
        currency: values.currency,
        total: calculatedTotal,
        order_id: selectedInvoice.order_id !== 'N/A' ? selectedInvoice.order_id : undefined,
        quote_id: selectedInvoice.quote_id !== 'N/A' ? selectedInvoice.quote_id : undefined,
        notes: values.notes || '',
        is_historical: values.is_historical ?? false,
        is_sales: isSales,
        items: (values.items || []).map(i => ({
          id: i.id,
          service_id: i.service_id,
          quantity: i.quantity,
          unit_price: i.unit_price,
          total: i.total,
        })),
      });
      toast({ title: 'Factura actualizada' });
      setIsEditInvoiceOpen(false);
      await loadInvoices(true);
      loadItems(selectedInvoice.id);
      onDataChange?.();
    } catch (e: any) {
      toast({ title: e?.message || 'Error al actualizar', variant: 'destructive' });
    } finally {
      setIsSubmittingInvoice(false);
    }
  };

  // ── Payment form ──────────────────────────────────────────────────────────────
  const paymentForm = useForm<PaymentFormValues>({ resolver: zodResolver(paymentSchema) });

  React.useEffect(() => {
    if (!isPaymentDialogOpen || !selectedInvoice) return;
    paymentForm.reset({
      amount: selectedInvoice.total,
      payment_method_id: '',
      payment_date: new Date().toISOString().split('T')[0],
      notes: '',
      is_historical: selectedInvoice.is_historical || false
    });
    loadPaymentMethods();
  }, [isPaymentDialogOpen, loadPaymentMethods, paymentForm, selectedInvoice]);

  const handleSubmitPayment = async (values: PaymentFormValues) => {
    if (!selectedInvoice) return;

    let cashSessionId: string | null = null;

    // Validate cash session only for non-historical payments
    if (!values.is_historical) {
      const { isValid, sessionId, error } = await validateActiveSession();
      if (!isValid) {
        showCashSessionError(error);
        return;
      }
      cashSessionId = sessionId || null;
    }

    setIsSubmittingPayment(true);
    try {
      const method = paymentMethods.find(m => m.id === values.payment_method_id);
      const paymentDate = new Date(values.payment_date).toISOString();
      await api.post(isSales ? API_ROUTES.SALES.INVOICE_PAYMENT : API_ROUTES.PURCHASES.INVOICE_PAYMENT, {
        cash_session_id: cashSessionId,
        credit_payment: [],
        client_user: { id: userId, name: '', email: '' },
        query: {
          invoice_id: parseInt(selectedInvoice.id, 10),
          payment_date: paymentDate,
          amount: values.amount,
          converted_amount: values.amount,
          method: method?.name || '',
          payment_method_id: values.payment_method_id,
          status: 'completed',
          user_id: userId,
          invoice_currency: selectedInvoice.currency || 'USD',
          payment_currency: selectedInvoice.currency || 'USD',
          exchange_rate: 1,
          is_sales: isSales,
          total_paid: values.amount,
          notes: values.notes || '',
          is_historical: values.is_historical || false,
        },
      });
      toast({ title: 'Pago registrado' });
      setIsPaymentDialogOpen(false);
      await loadInvoices(true);
      onDataChange?.();
    } catch (e: any) {
      toast({ title: e?.message || 'Error al registrar el pago', variant: 'destructive' });
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // ── Item form ────────────────────────────────────────────────────────────────
  const itemForm = useForm<ItemFormValues>({ resolver: zodResolver(itemSchema) });

  React.useEffect(() => {
    if (!isItemDialogOpen) return;
    editingItem
      ? itemForm.reset({ service_id: editingItem.service_id, quantity: editingItem.quantity, unit_price: editingItem.unit_price })
      : itemForm.reset({ service_id: '', quantity: 1, unit_price: 0 });
  }, [isItemDialogOpen, editingItem, itemForm]);

  const handleSubmitItem = async (values: ItemFormValues) => {
    if (!selectedInvoice) return;
    setIsSubmittingItem(true);
    try {
      await api.post(isSales ? API_ROUTES.SALES.INVOICES_ITEMS_UPSERT : API_ROUTES.PURCHASES.INVOICES_ITEMS_UPSERT, {
        ...(editingItem ? { id: parseInt(editingItem.id, 10) } : {}),
        invoice_id: parseInt(selectedInvoice.id, 10),
        service_id: parseInt(values.service_id, 10),
        quantity: values.quantity,
        unit_price: values.unit_price,
        total: values.quantity * values.unit_price,
        is_sales: isSales,
      });
      toast({ title: editingItem ? 'Ítem actualizado' : 'Ítem agregado' });
      setIsItemDialogOpen(false);
      loadItems(selectedInvoice.id);
      onDataChange?.();
    } catch {
      toast({ title: 'Error al guardar ítem', variant: 'destructive' });
    } finally {
      setIsSubmittingItem(false);
    }
  };

  const handleConfirmDeleteItem = async () => {
    if (!deletingItem) return;
    try {
      await api.post(
        isSales ? API_ROUTES.SALES.INVOICES_ITEMS_DELETE : API_ROUTES.PURCHASES.INVOICES_ITEMS_DELETE,
        { id: parseInt(deletingItem.id, 10) }
      );
      toast({ title: 'Ítem eliminado' });
      setDeletingItem(null);
      if (selectedInvoice) loadItems(selectedInvoice.id);
      onDataChange?.();
    } catch {
      toast({ title: 'Error al eliminar', variant: 'destructive' });
    }
  };

  // ── Toolbar actions ───────────────────────────────────────────────────────────
  const toolbarActions = selectedInvoice ? (
    <div className="flex items-center gap-1.5">
      {/* Acciones principales fuera del dropdown */}
      {isDraft && canConfirmInvoice && (
        <Button
          variant="default"
          size="sm"
          className="h-8 gap-1.5 text-xs bg-green-600 hover:bg-green-700 text-white"
          onClick={handleConfirm}
        >
          <CheckCircle className="h-3.5 w-3.5" />
          Confirmar
        </Button>
      )}
      {isBookedUnpaid && canCreatePayment && (
        <Button
          variant="default"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => setIsPaymentDialogOpen(true)}
        >
          <CreditCard className="h-3.5 w-3.5" />
          Agregar pago
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
            Acciones
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Imprimir
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleSendEmailClick(selectedInvoice)}>
            <Send className="h-4 w-4 mr-2" />
            Enviar
          </DropdownMenuItem>
          {isDraft && canUpdateInvoice && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setIsEditInvoiceOpen(true)}>
                <Pencil className="h-4 w-4 mr-2" />
                Editar
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => handleOpenSheet(selectedInvoice)}>
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
            data={invoices}
            filterColumnId="doc_no"
            filterPlaceholder={t('InvoicesPage.filterPlaceholder')}
            onRowSelectionChange={handleRowSelectionChange}
            enableSingleRowSelection
            rowSelection={rowSelection}
            setRowSelection={setRowSelection}
            onRefresh={() => loadInvoices(true)}
            isRefreshing={isRefreshing}
            extraButtons={toolbarActions}
            columnTranslations={{
              doc_no: t('InvoicesPage.columns.docNo'),
              order_doc_no: t('InvoicesPage.columns.orderDocNo'),
              total: t('InvoicesPage.columns.total'),
              status: t('InvoicesPage.columns.status'),
              payment_status: t('InvoicesPage.columns.payment'),
              due_date: t('InvoicesPage.columns.dueDate'),
              createdAt: t('InvoicesPage.columns.createdAt'),
            }}
          />
        </CardContent>
      </Card>

      {/* ── Detail Sheet ── */}
      <ResizableSheet
        open={isSheetOpen}
        onOpenChange={(open: boolean) => {
          setIsSheetOpen(open);
          if (!open) { setRowSelection({}); setSelectedInvoice(null); setInvoiceItems([]); }
        }}
        defaultWidth={800}
        minWidth={560}
        maxWidth={1400}
        storageKey="user-invoices-sheet-width"
      >
        {selectedInvoice && (
          <>
            {/* Header estilo ficha del paciente */}
            <div className="flex-none bg-card shadow-sm border-b border-border">
              {/* Título y badges principales */}
              <div className="px-6 py-4 border-b border-border/50">
                <div className="flex items-start justify-between gap-4 pr-10">
                  <div className="flex items-center gap-3">
                    <div>
                      <SheetTitle className="text-2xl font-bold text-card-foreground">{selectedInvoice.doc_no || `INV-${selectedInvoice.id}`}</SheetTitle>
                      <SheetDescription className="text-sm text-muted-foreground mt-0.5">Factura</SheetDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    <Badge variant={(STATUS_BADGE[selectedInvoice.status?.toLowerCase()] ?? 'default') as any} className="capitalize">
                      {tStatus(selectedInvoice.status?.toLowerCase() || '')}
                    </Badge>
                    {selectedInvoice.payment_status && (
                      <Badge variant={(PAYMENT_BADGE[selectedInvoice.payment_status?.toLowerCase()] ?? 'outline') as any} className="capitalize">
                        {tStatus(selectedInvoice.payment_status?.toLowerCase() || '')}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Información del documento integrada en el header */}
              <div className="px-6 py-3">
                <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Total:</span>
                    <span className="font-semibold text-sm">{new Intl.NumberFormat('en-US', { style: 'currency', currency: selectedInvoice.currency || 'USD' }).format(selectedInvoice.total)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Orden:</span>
                    <span className="text-sm">{selectedInvoice.order_doc_no !== 'N/A' ? selectedInvoice.order_doc_no : '-'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Creado:</span>
                    <span className="text-sm">{formatDateTime(selectedInvoice.createdAt)}</span>
                  </div>
                  {selectedInvoice.notes && (
                    <div className="flex items-center gap-2 w-full mt-1">
                      <span className="text-xs text-muted-foreground">Notas:</span>
                      <span className="text-sm text-muted-foreground italic">{selectedInvoice.notes}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="px-6 py-3 flex items-center gap-2 flex-wrap border-b bg-muted/30">
              {/* Acciones principales */}
              {isDraft && canConfirmInvoice && (
                <Button variant="default" size="sm" className="h-8 gap-1.5 text-xs bg-green-600 hover:bg-green-700 text-white" onClick={handleConfirm}>
                  <CheckCircle className="h-3.5 w-3.5" />
                  Confirmar
                </Button>
              )}
              {isBookedUnpaid && canCreatePayment && (
                <Button variant="default" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setIsPaymentDialogOpen(true)}>
                  <CreditCard className="h-3.5 w-3.5" />
                  Agregar pago
                </Button>
              )}
              {(isDraft || isBookedUnpaid) && <Separator orientation="vertical" className="h-6 mx-1" />}
              {/* Acciones secundarias */}
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={handlePrint}>
                <Printer className="h-3.5 w-3.5" />
                Imprimir
              </Button>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => handleSendEmailClick(selectedInvoice)}>
                <Send className="h-3.5 w-3.5" />
                Enviar
              </Button>
              {isDraft && (
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setIsEditInvoiceOpen(true)}>
                  <Pencil className="h-3.5 w-3.5" />
                  Editar
                </Button>
              )}
            </div>

            {/* Items */}
            <div className="flex-1 flex flex-col overflow-hidden px-4 py-3">
              <p className="text-sm font-semibold mb-2">Ítems de la factura</p>
              <div className="flex-1 overflow-hidden">
                <InvoiceItemsTable
                  items={invoiceItems}
                  isLoading={isLoadingItems}
                  canEdit={canEditItems}
                  onEdit={canUpdateItem ? (item) => { setEditingItem(item); setIsItemDialogOpen(true); loadServices(); } : undefined}
                  onDelete={canDeleteItem ? setDeletingItem : undefined}
                />
              </div>
            </div>
          </>
        )}
      </ResizableSheet>

      {/* ── Edit invoice dialog ── */}
      <Dialog open={isEditInvoiceOpen} onOpenChange={setIsEditInvoiceOpen}>
        <DialogContent maxWidth="4xl">
          <Form {...invoiceEditForm}>
            <form onSubmit={invoiceEditForm.handleSubmit(handleSubmitInvoiceEdit)} className="flex flex-col flex-1 overflow-hidden">
              <DialogHeader>
                <DialogTitle>Editar factura</DialogTitle>
                <DialogDescription>Modifica los datos de la factura {selectedInvoice?.doc_no}.</DialogDescription>
              </DialogHeader>
              <DialogBody className="space-y-4 py-4 px-6">
                {/* Type + Currency */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={invoiceEditForm.control} name="type" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="invoice">Factura</SelectItem>
                          <SelectItem value="credit_note">Nota de crédito</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={invoiceEditForm.control} name="currency" render={({ field }) => (
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
                </div>

                {/* Notes */}
                <FormField control={invoiceEditForm.control} name="notes" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notas <span className="text-muted-foreground">(opcional)</span></FormLabel>
                    <FormControl><Textarea rows={2} placeholder="Observaciones..." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* Is historical */}
                <FormField control={invoiceEditForm.control} name="is_historical" render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 py-1">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>{t('InvoicesPage.paymentDialog.isHistorical')}</FormLabel>
                    </div>
                  </FormItem>
                )} />

                {/* Items */}
                <Card>
                  <CardContent className="p-0">
                    <div className="flex items-center justify-between px-4 pt-4 pb-2">
                      <p className="text-sm font-semibold">Ítems de la factura</p>
                      {canAddItem && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => { loadServices(); appendEditInvoiceItem({ service_id: '', quantity: 1, unit_price: 0, total: 0 }); }}
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
                              <th className="p-2 w-10"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {editInvoiceItemFields.map((fieldItem, index) => (
                              <tr key={fieldItem.id} className="align-top border-b last:border-0">
                                <td className="p-1">
                                  <FormField control={invoiceEditForm.control} name={`items.${index}.service_id`} render={({ field }) => (
                                    <FormItem>
                                      <ServiceSelector
                                        isSales={isSales}
                                        value={field.value}
                                        onValueChange={(serviceId, service) => {
                                          field.onChange(serviceId);
                                          if (service) {
                                            const qty = invoiceEditForm.getValues(`items.${index}.quantity`) || 1;
                                            updateEditInvoiceItem(index, { ...invoiceEditForm.getValues(`items.${index}`), service_id: serviceId, unit_price: Number(service.price), total: Number(service.price) * qty });
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
                                  <FormField control={invoiceEditForm.control} name={`items.${index}.quantity`} render={({ field }) => (
                                    <FormItem>
                                      <FormControl>
                                        <Input type="number" step="1" min="1" {...field}
                                          onChange={e => {
                                            field.onChange(e);
                                            const qty = parseInt(e.target.value) || 0;
                                            const price = invoiceEditForm.getValues(`items.${index}.unit_price`) || 0;
                                            updateEditInvoiceItem(index, { ...invoiceEditForm.getValues(`items.${index}`), quantity: qty, total: qty * price });
                                          }}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )} />
                                </td>
                                <td className="p-1">
                                  <FormField control={invoiceEditForm.control} name={`items.${index}.unit_price`} render={({ field }) => (
                                    <FormItem>
                                      <FormControl>
                                        <Input type="number" step="0.01" min="0" {...field}
                                          onChange={e => {
                                            field.onChange(e);
                                            const price = parseFloat(e.target.value) || 0;
                                            const qty = invoiceEditForm.getValues(`items.${index}.quantity`) || 0;
                                            updateEditInvoiceItem(index, { ...invoiceEditForm.getValues(`items.${index}`), unit_price: price, total: qty * price });
                                          }}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )} />
                                </td>
                                <td className="p-1">
                                  <FormField control={invoiceEditForm.control} name={`items.${index}.total`} render={({ field }) => (
                                    <FormItem>
                                      <FormControl>
                                        <Input
                                          readOnly
                                          disabled
                                          value={new Intl.NumberFormat('en-US', { style: 'currency', currency: watchedEditInvoiceCurrency || 'USD' }).format(Number(field.value) || 0)}
                                          className="bg-muted text-muted-foreground cursor-not-allowed"
                                        />
                                      </FormControl>
                                    </FormItem>
                                  )} />
                                </td>
                                <td className="p-1 text-center">
                                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => removeEditInvoiceItem(index)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </td>
                              </tr>
                            ))}
                            {editInvoiceItemFields.length === 0 && (
                              <tr><td colSpan={5} className="text-center text-muted-foreground text-xs py-4">Sin ítems. Agrega uno con el botón superior.</td></tr>
                            )}
                          </tbody>
                        </table>
                      )}
                    </div>
                    {editInvoiceItemFields.length > 0 && (
                      <div className="flex justify-end px-4 pb-3">
                        <span className="text-sm font-semibold">
                          Total: {new Intl.NumberFormat('en-US', { style: 'currency', currency: watchedEditInvoiceCurrency || 'USD' }).format(
                            editInvoiceItemFields.reduce((sum, _, i) => sum + (Number(invoiceEditForm.getValues(`items.${i}.total`)) || 0), 0)
                          )}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </DialogBody>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditInvoiceOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={isSubmittingInvoice}>
                  {isSubmittingInvoice && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Guardar cambios
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Add payment dialog ── */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Agregar pago</DialogTitle>
            <DialogDescription>Registra un pago para la factura {selectedInvoice?.doc_no}.</DialogDescription>
          </DialogHeader>
          <Form {...paymentForm}>
            <form onSubmit={paymentForm.handleSubmit(handleSubmitPayment)}>
              <div className="px-6 py-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={paymentForm.control} name="amount" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monto</FormLabel>
                      <FormControl><Input type="number" min={0.01} step="0.01" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={paymentForm.control} name="payment_date" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={paymentForm.control} name="payment_method_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Método de pago</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar método" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {paymentMethods.filter(m => m.is_active).map(m => (
                          <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={paymentForm.control} name="notes" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notas <span className="text-muted-foreground">(opcional)</span></FormLabel>
                    <FormControl><Textarea rows={2} placeholder="Observaciones..." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField
                  control={paymentForm.control}
                  name="is_historical"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 py-2">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>{t('InvoicesPage.paymentDialog.isHistorical')}</FormLabel>
                      </div>
                    </FormItem>
                  )}
                />
                {paymentForm.watch('is_historical') && (
                  <Alert variant="warning" className="bg-amber-50 border-amber-200">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertTitle className="text-amber-800">{t('InvoicesPage.paymentDialog.isHistorical')}</AlertTitle>
                    <AlertDescription className="text-amber-700">
                      {t('InvoicesPage.paymentDialog.isHistoricalDescription')}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={isSubmittingPayment}>
                  {isSubmittingPayment && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Registrar pago
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Item create/edit dialog ── */}
      <Dialog open={isItemDialogOpen} onOpenChange={setIsItemDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar ítem' : 'Agregar ítem'}</DialogTitle>
            <DialogDescription>Completa los datos del ítem de la factura.</DialogDescription>
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
            <DialogTitle>{tInvoices('sendEmailDialog.title')}</DialogTitle>
            <DialogDescription>
              {tInvoices('sendEmailDialog.description', { id: selectedInvoiceForEmail?.id || '' })}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 px-6">
            <Label htmlFor="email-recipients">{tInvoices('sendEmailDialog.recipients')}</Label>
            <Input
              id="email-recipients"
              value={emailRecipients}
              onChange={(e) => setEmailRecipients(e.target.value)}
              placeholder={tInvoices('sendEmailDialog.placeholder')}
            />
            <p className="text-sm text-muted-foreground mt-1">
              {tInvoices('sendEmailDialog.helperText')}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSendEmailDialogOpen(false)}>
              {tInvoices('sendEmailDialog.cancel')}
            </Button>
            <Button onClick={handleConfirmSendEmail} disabled={isSendingEmail}>
              {isSendingEmail ? tInvoices('sendEmailDialog.sending') : tInvoices('sendEmailDialog.send')}
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
