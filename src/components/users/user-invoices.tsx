'use client';

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
import { Calendar } from '@/components/ui/calendar';
import { DatePickerInput } from '@/components/ui/date-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ServiceSelector } from '@/components/ui/service-selector';
import { ResizableSheet, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/resizable-sheet';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { PURCHASES_PERMISSIONS, SALES_PERMISSIONS } from '@/constants/permissions';
import { API_ROUTES } from '@/constants/routes';
import { usePermissions } from '@/hooks/usePermissions';
import { useCashSessionValidation } from '@/hooks/use-cash-session-validation';
import { useToast } from '@/hooks/use-toast';
import { usePrintDocument } from '@/hooks/usePrintDocument';
import { Invoice, InvoiceItem, Service, UserDetailMode } from '@/lib/types';
import { cn, formatDate, formatDisplayDate, getDocumentFileName, toLocalISOString } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { api } from '@/services/api';
import { getPurchaseServices, getSalesServices } from '@/services/services';
import { checkPreferencesByEmails, getDisabledEmails } from '@/hooks/use-communication-preferences';
import { CommunicationWarningDialog } from '@/components/communication-warning-dialog';
import { InvoicePaymentDialog } from '@/components/invoices/invoice-payment-dialog';
import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnDef, RowSelectionState } from '@tanstack/react-table';
import { AlertTriangle, CalendarIcon, CheckCircle, ChevronDown, CreditCard, Eye, FileMinus2, Loader2, Pencil, Printer, Send, Trash2, Zap } from 'lucide-react';
import { useViewportNarrow } from '@/hooks/use-viewport-narrow';
import { DataCard } from '@/components/ui/data-card';
import { DataListRow } from '@/components/ui/data-list-row';
import { ViewModeToggle } from '@/components/ui/view-mode-toggle';
import { useTableViewMode } from '@/hooks/use-table-view-mode';
import { useBillingWizard } from '@/stores/billing-wizard-store';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import * as z from 'zod';

// ── Schemas ───────────────────────────────────────────────────────────────────
const itemSchema = z.object({
  service_id: z.string().min(1, 'Selecciona un servicio'),
  service_name: z.string().optional(),
  quantity: z.coerce.number().min(1, 'Mínimo 1'),
  unit_price: z.coerce.number().min(0, 'Precio inválido'),
});
type ItemFormValues = z.infer<typeof itemSchema>;

const invoiceEditSchema = z.object({
  type: z.enum(['invoice', 'credit_note']),
  currency: z.enum(['USD', 'UYU']),
  created_at: z.date({ required_error: 'La fecha de factura es obligatoria' }),
  due_date: z.date().optional(),
  is_historical: z.boolean().optional(),
  is_refund: z.boolean().optional(),
  notes: z.string().optional(),
  items: z.array(z.object({
    id: z.string().optional(),
    service_id: z.string().min(1, 'Selecciona un servicio'),
    service_name: z.string().optional(),
    quantity: z.coerce.number().min(1, 'Mínimo 1'),
    unit_price: z.coerce.number().min(0, 'Precio inválido'),
    total: z.coerce.number().optional(),
  })).default([]),
});
type InvoiceEditFormValues = z.infer<typeof invoiceEditSchema>;

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
    accessorKey: 'quote_doc_no',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('InvoicesPage.columns.quoteDocNo')} />,
    cell: ({ row }) => {
      const v = row.getValue('quote_doc_no') as string;
      return <div className="font-medium">{v || '-'}</div>;
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
      return <div className="font-medium">{dueDate ? formatDisplayDate(dueDate) : '-'}</div>;
    },
  },
  {
    accessorKey: 'createdAt',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('InvoicesPage.columns.createdAt')} />,
    cell: ({ row }) => formatDisplayDate(row.original.createdAt),
  },
  {
    accessorKey: 'external_id',
    header: ({ column }) => <DataTableColumnHeader column={column} title={t('InvoicesPage.columns.externalId')} />,
    cell: ({ row }) => (
      <span className="font-mono text-xs text-muted-foreground">
        {row.original.external_id ?? '—'}
      </span>
    ),
  },
];

// ── Invoice-detail inner table columns ────────────────────────────────────────
const fmtCurrency = (v: number, currency?: string) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(v || 0);

function getInvoiceItemColumns(currency: string | undefined, opts: {
  canUpdateItem: boolean;
  canDeleteItem: boolean;
  onEdit: (item: InvoiceItem) => void;
  onDelete: (item: InvoiceItem) => void;
}): ColumnDef<InvoiceItem>[] {
  const cols: ColumnDef<InvoiceItem>[] = [
    {
      accessorKey: 'service_name',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Servicio" />,
      cell: ({ row }) => <span className="font-medium">{row.original.service_name || '-'}</span>,
    },
    {
      accessorKey: 'quantity',
      size: 90,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Cantidad" />,
    },
    {
      accessorKey: 'unit_price',
      size: 120,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Precio unit." />,
      cell: ({ row }) => fmtCurrency(row.original.unit_price, currency),
    },
    {
      accessorKey: 'total',
      size: 120,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Total" />,
      cell: ({ row }) => <span className="font-medium tabular-nums">{fmtCurrency(row.original.total, currency)}</span>,
    },
  ];
  if (opts.canUpdateItem || opts.canDeleteItem) {
    cols.push({
      id: 'actions',
      size: 90,
      header: () => null,
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          {opts.canUpdateItem && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => opts.onEdit(row.original)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          {opts.canDeleteItem && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => opts.onDelete(row.original)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ),
    });
  }
  return cols;
}

function getInvoicePaymentColumns(): ColumnDef<any>[] {
  return [
    {
      accessorKey: 'doc_no',
      header: ({ column }) => <DataTableColumnHeader column={column} title="N° Pago" />,
      cell: ({ row }) => <span className="font-medium">{row.original.doc_no || `Pago #${row.original.id}`}</span>,
    },
    {
      accessorKey: 'date',
      size: 120,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Fecha" />,
      cell: ({ row }) => row.original.date ? formatDisplayDate(row.original.date) : '-',
    },
    {
      accessorKey: 'method',
      size: 140,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Método" />,
      cell: ({ row }) => row.original.method || '-',
    },
    {
      accessorKey: 'currency',
      size: 90,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Moneda" />,
      cell: ({ row }) => row.original.currency || '-',
    },
    {
      accessorKey: 'amount',
      size: 120,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Monto" />,
      cell: ({ row }) => <span className="font-medium tabular-nums">{fmtCurrency(row.original.amount, row.original.currency)}</span>,
    },
  ];
}

// ── Data fetching ─────────────────────────────────────────────────────────────
async function getInvoicesForUser(userId: string): Promise<Invoice[]> {
  if (!userId) return [];

  const normalizeQuoteDocNo = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const trimmedValue = value.trim();
    if (!trimmedValue || trimmedValue === 'N/A') return null;
    return trimmedValue;
  };

  try {
    const data = await api.get(API_ROUTES.USER_INVOICES, { user_id: userId });
    const invoicesData = Array.isArray(data) ? data : (data.invoices || data.data || []);
    const invoices = invoicesData.map((d: any) => ({
      id: d.id.toString(),
      invoice_ref: d.invoice_ref || 'N/A',
      doc_no: d.doc_no || null,
      order_id: d.order_id?.toString() ?? 'N/A',
      order_doc_no: d.order_doc_no || 'N/A',
      quote_id: d.quote_id?.toString() ?? 'N/A',
      quote_doc_no: normalizeQuoteDocNo(d.quote_doc_no),
      user_id: d.user_id?.toString() ?? userId,
      user_name: d.user_name || '',
      type: d.type || 'invoice',
      parent_id: d.parent_id ? String(d.parent_id) : undefined,
      total: parseFloat(d.total),
      status: d.status,
      payment_status: d.payment_state || d.payment_status,
      notes: d.notes || '',
      createdAt: d.created_at,
      updatedAt: d.updated_at,
      currency: d.currency || 'USD',
      is_historical: d.is_historical || false,
      due_date: d.due_date || null,
      paid_amount: d.paid_amount != null ? parseFloat(d.paid_amount) : undefined,
      external_id: d.external_id ?? null,
    }));

    const needsQuoteFallback = invoices.some((invoice: Invoice) =>
      !invoice.quote_doc_no && invoice.quote_id && invoice.quote_id !== 'N/A'
    );

    if (!needsQuoteFallback) {
      return invoices;
    }

    try {
      const quotesData = await api.get(API_ROUTES.USER_QUOTES, { user_id: userId });
      const quotes = Array.isArray(quotesData) ? quotesData : (quotesData.user_quotes || quotesData.quotes || quotesData.data || []);
      const quoteDocNoById = new Map<string, string>();

      quotes.forEach((quote: any) => {
        const quoteId = quote.id?.toString();
        const quoteDocNo = normalizeQuoteDocNo(quote.quote_doc_no || quote.doc_no);

        if (quoteId && quoteDocNo) {
          quoteDocNoById.set(quoteId, quoteDocNo);
        }
      });

      return invoices.map((invoice: Invoice) => ({
        ...invoice,
        quote_doc_no: invoice.quote_doc_no || (invoice.quote_id !== 'N/A' ? quoteDocNoById.get(invoice.quote_id) : undefined) || null,
      }));
    } catch {
      return invoices;
    }
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
  const { open: openBillingWizard } = useBillingWizard();
  const { printInvoice } = usePrintDocument();
  const isViewportNarrow = useViewportNarrow();
  const [viewMode, setViewMode] = useTableViewMode('invoices-list', 'table');
  const showToggle = !isViewportNarrow;
  const useListView = !isViewportNarrow && viewMode === 'list';
  const [detailItemsViewMode, setDetailItemsViewMode] = useTableViewMode('invoice-detail-items', 'table');
  const [detailPaymentsViewMode, setDetailPaymentsViewMode] = useTableViewMode('invoice-detail-payments', 'table');
  const detailItemsListView = !isViewportNarrow && detailItemsViewMode === 'list';
  const detailPaymentsListView = !isViewportNarrow && detailPaymentsViewMode === 'list';
  const isSales = mode === 'sales';
  const [invoices, setInvoices] = React.useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [selectedInvoice, setSelectedInvoice] = React.useState<Invoice | null>(null);
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = React.useState(false);
  const [invoiceForPayment, setInvoiceForPayment] = React.useState<Invoice | null>(null);

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

  // Payments
  const [invoicePayments, setInvoicePayments] = React.useState<any[]>([]);
  const [isLoadingPayments, setIsLoadingPayments] = React.useState(false);
  const [services, setServices] = React.useState<Service[]>([]);

  // Item dialogs
  const [isItemDialogOpen, setIsItemDialogOpen] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState<InvoiceItem | null>(null);
  const [deletingItem, setDeletingItem] = React.useState<InvoiceItem | null>(null);
  const [isSubmittingItem, setIsSubmittingItem] = React.useState(false);

  // Record-level dialogs
  const [isEditInvoiceOpen, setIsEditInvoiceOpen] = React.useState(false);
  const [isSubmittingInvoice, setIsSubmittingInvoice] = React.useState(false);
  const [isCreditNoteOpen, setIsCreditNoteOpen] = React.useState(false);
  const [isSubmittingCreditNote, setIsSubmittingCreditNote] = React.useState(false);
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
  const canCreateInvoice = hasPermission(isSales ? SALES_PERMISSIONS.INVOICES_CREATE : PURCHASES_PERMISSIONS.INVOICES_CREATE);
  const canEditItems = isDraft && (canAddItem || canUpdateItem || canDeleteItem);

  const invoicePaymentColumns = React.useMemo<ColumnDef<any>[]>(() => [
    { accessorKey: 'doc_no', header: 'N° Pago', size: 130, cell: ({ row }: any) => row.original.doc_no ? `#${row.original.doc_no}` : '-' },
    { accessorKey: 'date', header: 'Fecha', size: 100, cell: ({ row }: any) => row.original.date ? formatDisplayDate(row.original.date) : '-' },
    { accessorKey: 'method', header: 'Método', size: 130, cell: ({ row }: any) => row.original.method || '-' },
    { accessorKey: 'currency', header: 'Moneda', size: 80 },
    { accessorKey: 'amount', header: 'Monto', size: 130, cell: ({ row }: any) => new Intl.NumberFormat('en-US', { style: 'currency', currency: row.original.currency || 'USD' }).format(row.original.amount) },
  ], []);

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
      const rawData = Array.isArray(data) ? data : (data.items || data.data || []);
      // Empty responses come back as `[{ success: true }]`; skip those ack objects.
      const raw = rawData.filter((i: any) => i && typeof i === 'object' && (i.id != null || i.service_id != null || i.service_name));
      setInvoiceItems(raw.map((i: any) => ({
        id: String(i.id),
        service_id: String(i.service_id),
        service_name: i.service_name || '',
        unit_price: parseFloat(i.unit_price) || 0,
        quantity: parseInt(i.quantity) || 1,
        total: parseFloat(i.total) || 0,
        step_id: i.step_id != null ? String(i.step_id) : undefined,
        steps: i.steps != null ? String(i.steps) : undefined,
      })));
    } catch {
      setInvoiceItems([]);
    } finally {
      setIsLoadingItems(false);
    }
  }, [isSales]);

  const loadInvoicePayments = React.useCallback(async (invoiceId: string) => {
    setIsLoadingPayments(true);
    try {
      const data = await api.get(
        isSales ? API_ROUTES.SALES.INVOICE_PAYMENTS : API_ROUTES.PURCHASES.INVOICE_PAYMENTS,
        { invoice_id: invoiceId }
      );
      const rawData = Array.isArray(data) ? data : (data.payments || data.data || []);
      // Empty responses come back as `[{ success: true }]`; skip those ack objects.
      const raw = rawData.filter((p: any) =>
        p && typeof p === 'object' &&
        (p.id != null || p.amount_applied != null || p.amount != null || p.doc_no || p.payment_doc_no)
      );
      setInvoicePayments(raw.map((p: any, idx: number) => ({
        id: p.id != null ? String(p.id) : (p.doc_no || p.payment_doc_no || String(idx)),
        amount: Math.abs(Number(p.amount_applied ?? p.amount ?? 0)),
        currency: p.invoice_currency || p.source_currency || p.currency || 'UYU',
        method: p.payment_method_name || p.method || p.payment_method || '',
        date: p.payment_date || p.created_at || p.date || '',
        doc_no: p.doc_no || p.payment_doc_no || '',
      })));
    } catch {
      setInvoicePayments([]);
    } finally {
      setIsLoadingPayments(false);
    }
  }, [isSales]);

  const loadServices = React.useCallback(async () => {
    if (services.length > 0) return;
    try {
      const data = await (isSales ? getSalesServices({ limit: 500 }) : getPurchaseServices({ limit: 500 }));
      setServices(data.items || []);
    } catch { /* silent */ }
  }, [isSales, services.length]);

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
    loadInvoicePayments(invoice.id);
  }, [loadItems, loadInvoicePayments]);

  // ── Record actions ──────────────────────────────────────────────────────────
  const handlePrint = () => {
    if (!selectedInvoice) return;
    printInvoice(selectedInvoice, isSales);
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
  const { fields: editInvoiceItemFields, append: appendEditInvoiceItem, remove: removeEditInvoiceItem } = useFieldArray({
    control: invoiceEditForm.control,
    name: 'items',
  });

  React.useEffect(() => {
    if (!isEditInvoiceOpen || !selectedInvoice) return;
    const mappedItems = invoiceItems.map(i => ({
      id: i.id,
      service_id: i.service_id,
      service_name: i.service_name || '',
      quantity: i.quantity,
      unit_price: i.unit_price,
      total: i.total,
    }));
    invoiceEditForm.reset({
      type: (selectedInvoice.type as 'invoice' | 'credit_note') ?? 'invoice',
      currency: (selectedInvoice.currency as 'USD' | 'UYU') ?? 'USD',
      created_at: selectedInvoice.createdAt ? parseISO(formatDate(selectedInvoice.createdAt)) : new Date(),
      due_date: selectedInvoice.due_date ? parseISO(formatDate(selectedInvoice.due_date)) : undefined,
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
        service_name: i.service_name || '',
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
        created_at: values.created_at ? toLocalISOString(values.created_at) : undefined,
        due_date: values.due_date ? toLocalISOString(values.due_date) : undefined,
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

  // ── Credit note form ─────────────────────────────────────────────────────────
  const creditNoteForm = useForm<InvoiceEditFormValues>({ resolver: zodResolver(invoiceEditSchema) });
  const { fields: creditNoteItemFields, append: appendCreditNoteItem, remove: removeCreditNoteItem } = useFieldArray({
    control: creditNoteForm.control,
    name: 'items',
  });

  React.useEffect(() => {
    if (!isCreditNoteOpen || !selectedInvoice) return;
    creditNoteForm.reset({
      type: 'credit_note',
      currency: (selectedInvoice.currency as 'USD' | 'UYU') ?? 'UYU',
      created_at: new Date(),
      due_date: undefined,
      is_historical: false,
      is_refund: false,
      notes: '',
      items: invoiceItems.map(i => ({
        id: undefined,
        service_id: i.service_id,
        service_name: i.service_name || '',
        quantity: i.quantity,
        unit_price: i.unit_price,
        total: i.total,
      })),
    });
    if (invoiceItems.length === 0) loadItems(selectedInvoice.id);
    loadServices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCreditNoteOpen, selectedInvoice]);

  React.useEffect(() => {
    if (!isCreditNoteOpen || invoiceItems.length === 0) return;
    const current = creditNoteForm.getValues('items');
    if (current.length === 0) {
      creditNoteForm.setValue('items', invoiceItems.map(i => ({
        id: undefined,
        service_id: i.service_id,
        service_name: i.service_name || '',
        quantity: i.quantity,
        unit_price: i.unit_price,
        total: i.total,
      })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceItems, isCreditNoteOpen]);

  const watchedCreditNoteCurrency = creditNoteForm.watch('currency');

  const handleSubmitCreditNote = async (values: InvoiceEditFormValues) => {
    if (!selectedInvoice) return;
    setIsSubmittingCreditNote(true);
    try {
      const calculatedTotal = (values.items || []).reduce((sum, i) => sum + (Number(i.total) || 0), 0);
      const response = await api.post(isSales ? API_ROUTES.SALES.INVOICES_UPSERT : API_ROUTES.PURCHASES.INVOICES_UPSERT, {
        user_id: selectedInvoice.user_id,
        type: 'credit_note',
        invoice_id: selectedInvoice.id,
        currency: values.currency,
        total: calculatedTotal,
        order_id: selectedInvoice.order_id !== 'N/A' ? selectedInvoice.order_id : undefined,
        quote_id: selectedInvoice.quote_id !== 'N/A' ? selectedInvoice.quote_id : undefined,
        created_at: values.created_at ? toLocalISOString(values.created_at) : undefined,
        due_date: values.due_date ? toLocalISOString(values.due_date) : undefined,
        notes: values.notes || '',
        is_historical: values.is_historical ?? false,
        is_sales: isSales,
        items: (values.items || []).map(i => ({
          service_id: i.service_id,
          quantity: i.quantity,
          unit_price: i.unit_price,
          total: i.total,
        })),
      });
      toast({ title: 'Nota de crédito creada' });
      setIsCreditNoteOpen(false);
      await loadInvoices(true);
      onDataChange?.();

      if (values.is_refund) {
        const raw = Array.isArray(response) ? response[0] : (response?.data ?? response);
        const now = new Date().toISOString();
        const creditNoteInvoice: Invoice = {
          id: String(raw?.invoice_id || raw?.id || raw?.credit_note_id || ''),
          invoice_ref: String(raw?.invoice_ref || raw?.doc_no || ''),
          doc_no: raw?.doc_no || raw?.invoice_doc_no || undefined,
          order_id: selectedInvoice.order_id,
          quote_id: selectedInvoice.quote_id,
          user_name: selectedInvoice.user_name,
          userEmail: selectedInvoice.userEmail,
          user_id: selectedInvoice.user_id,
          total: calculatedTotal,
          currency: values.currency,
          status: 'booked',
          payment_status: 'unpaid',
          paid_amount: 0,
          type: 'credit_note',
          is_historical: values.is_historical ?? false,
          createdAt: now,
          updatedAt: now,
        };
        setInvoiceForPayment(creditNoteInvoice);
        setIsPaymentDialogOpen(true);
      }
    } catch (e: any) {
      toast({ title: e?.message || 'Error al crear nota de crédito', variant: 'destructive' });
    } finally {
      setIsSubmittingCreditNote(false);
    }
  };

  // ── Item form ────────────────────────────────────────────────────────────────
  const itemForm = useForm<ItemFormValues>({ resolver: zodResolver(itemSchema) });

  React.useEffect(() => {
    if (!isItemDialogOpen) return;
    editingItem
      ? itemForm.reset({ service_id: editingItem.service_id, service_name: editingItem.service_name || '', quantity: editingItem.quantity, unit_price: editingItem.unit_price })
      : itemForm.reset({ service_id: '', service_name: '', quantity: 1, unit_price: 0 });
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
          onClick={() => {
            if (!selectedInvoice) return;
            if (selectedInvoice.type === 'credit_note') {
              setInvoiceForPayment(selectedInvoice);
              setIsPaymentDialogOpen(true);
            } else {
              openBillingWizard(
                {
                  invoiceId: selectedInvoice.id,
                  invoice: selectedInvoice,
                  patientId: selectedInvoice.user_id,
                  patientName: selectedInvoice.user_name,
                  isSales,
                },
                () => { loadInvoices(true); onDataChange?.(); },
              );
            }
          }}
        >
          <Zap className="h-3.5 w-3.5" />
          Cobrar
        </Button>
      )}
      {/* Print y Enviar son siempre visibles; Editar es condicional */}
      {(true) && (
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
            {!isDraft && selectedInvoice?.type !== 'credit_note' && canCreateInvoice && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { loadItems(selectedInvoice.id); setIsCreditNoteOpen(true); }}>
                  <FileMinus2 className="h-4 w-4 mr-2" />
                  Nota de crédito
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
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
            isNarrow={isViewportNarrow || useListView}
            viewControls={showToggle ? <ViewModeToggle value={viewMode} onChange={setViewMode} /> : undefined}
            cardListClassName={useListView ? 'gap-0 px-0 py-0 rounded-md border' : undefined}
            renderCard={(invoice: Invoice, _isSelected: boolean) => {
              const badgeGroup = (
                <div className="flex gap-1 flex-wrap justify-end">
                  <Badge variant={(STATUS_BADGE[invoice.status?.toLowerCase()] ?? 'default') as any} className="capitalize text-[10px]">
                    {tStatus(invoice.status?.toLowerCase() || '')}
                  </Badge>
                  {invoice.payment_status && (
                    <Badge variant={(PAYMENT_BADGE[invoice.payment_status?.toLowerCase()] ?? 'outline') as any} className="capitalize text-[10px]">
                      {tStatus(invoice.payment_status?.toLowerCase() || '')}
                    </Badge>
                  )}
                </div>
              );
              if (useListView) {
                return (
                  <DataListRow
                    isSelected={_isSelected}
                    onClick={() => handleRowSelectionChange([invoice])}
                    title={invoice.doc_no || `INV-${invoice.id}`}
                    badge={badgeGroup}
                    meta={(
                      <>
                        <span>{formatDisplayDate(invoice.createdAt)}</span>
                        <span className="font-medium text-foreground">{t('InvoicesPage.columns.total')}: {invoice.total != null ? `${invoice.currency || 'USD'} ${Number(invoice.total).toFixed(2)}` : '-'}</span>
                        {invoice.quote_doc_no ? <span>{t('InvoicesPage.columns.quoteDocNo')}: {invoice.quote_doc_no}</span> : null}
                        {invoice.due_date ? <span>{t('InvoicesPage.columns.dueDate')}: {formatDisplayDate(invoice.due_date)}</span> : null}
                      </>
                    )}
                  />
                );
              }
              return (
                <DataCard isSelected={_isSelected}
                  title={invoice.doc_no || `INV-${invoice.id}`}
                  subtitle={formatDisplayDate(invoice.createdAt)}
                  badge={badgeGroup}
                  fields={[
                    { label: t('InvoicesPage.columns.total'), value: invoice.total != null ? `${invoice.currency || 'USD'} ${Number(invoice.total).toFixed(2)}` : '-', primary: true },
                    { label: t('InvoicesPage.columns.quoteDocNo'), value: invoice.quote_doc_no || '-' },
                    { label: t('InvoicesPage.columns.dueDate'), value: invoice.due_date ? formatDisplayDate(invoice.due_date) : '-' },
                  ]}
                />
              );
            }}
            columnTranslations={{
              doc_no: t('InvoicesPage.columns.docNo'),
              quote_doc_no: t('InvoicesPage.columns.quoteDocNo'),
              total: t('InvoicesPage.columns.total'),
              status: t('InvoicesPage.columns.status'),
              payment_status: t('InvoicesPage.columns.payment'),
              due_date: t('InvoicesPage.columns.dueDate'),
              createdAt: t('InvoicesPage.columns.createdAt'),
              external_id: t('InvoicesPage.columns.externalId'),
            }}
          />
        </CardContent>
      </Card>

      {/* ── Detail Sheet ── */}
      <ResizableSheet
        open={isSheetOpen}
        onOpenChange={(open: boolean) => {
          setIsSheetOpen(open);
          if (!open) { setRowSelection({}); setSelectedInvoice(null); setInvoiceItems([]); setInvoicePayments([]); }
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
                <div className="flex items-start justify-between gap-4 pr-10 sm:pr-20">
                  <div className="flex items-center gap-3">
                    <div>
                      <SheetTitle className="text-2xl font-bold text-card-foreground">{selectedInvoice.doc_no || `INV-${selectedInvoice.id}`}</SheetTitle>
                      {selectedInvoice.type === 'credit_note' ? (
                        <SheetDescription className="text-sm text-muted-foreground mt-0.5">
                          Nota de crédito
                          {selectedInvoice.parent_id && (() => {
                            const parent = invoices.find(inv => inv.id === selectedInvoice.parent_id);
                            const parentLabel = parent?.doc_no || `#${selectedInvoice.parent_id}`;
                            return <> · Relacionada a: <span className="font-medium text-foreground">{parentLabel}</span></>;
                          })()}
                        </SheetDescription>
                      ) : (() => {
                        const creditNote = invoices.find(inv => inv.type === 'credit_note' && inv.parent_id === selectedInvoice.id);
                        return (
                          <SheetDescription className="text-sm text-muted-foreground mt-0.5">
                            Factura
                            {creditNote && (
                              <> · Relacionada a: <span className="font-medium text-foreground">Nota de crédito {creditNote.doc_no || `#${creditNote.id}`}</span></>
                            )}
                          </SheetDescription>
                        );
                      })()}
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
                    <span className="text-xs text-muted-foreground">{t('InvoicesPage.columns.quoteDocNo')}:</span>
                    <span className="text-sm">{selectedInvoice.quote_doc_no || '-'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{t('InvoicesPage.columns.dueDate')}:</span>
                    <span className="text-sm">{selectedInvoice.due_date ? formatDisplayDate(selectedInvoice.due_date) : '-'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Creado:</span>
                    <span className="text-sm">{formatDisplayDate(selectedInvoice.createdAt)}</span>
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
                <Button
                  variant="default"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() =>
                    selectedInvoice &&
                    openBillingWizard(
                      {
                        invoiceId: selectedInvoice.id,
                        invoice: selectedInvoice,
                        patientId: selectedInvoice.user_id,
                        patientName: selectedInvoice.user_name,
                        isSales,
                      },
                      () => { loadInvoices(true); onDataChange?.(); },
                    )
                  }
                >
                  <Zap className="h-3.5 w-3.5" />
                  Cobrar
                </Button>
              )}
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

            {/* Tabs: Items + Payments */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <Tabs defaultValue="items" className="flex-1 flex flex-col min-h-0">
                <div className="px-6 py-2">
                  <TabsList className="gap-1 rounded-xl border border-border bg-muted/30 p-1 h-auto">
                    <TabsTrigger value="items" className="rounded-lg border border-transparent px-3 py-2 text-xs font-medium whitespace-nowrap text-muted-foreground hover:bg-background/60 hover:text-foreground data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
                      Ítems
                    </TabsTrigger>
                    <TabsTrigger value="payments" className="rounded-lg border border-transparent px-3 py-2 text-xs font-medium whitespace-nowrap text-muted-foreground hover:bg-background/60 hover:text-foreground data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm flex items-center gap-1.5">
                      <CreditCard className="h-3.5 w-3.5" />
                      Pagos
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="items" className="flex-1 overflow-hidden mt-0 px-4 py-3 data-[state=active]:flex data-[state=active]:flex-col data-[state=inactive]:hidden">
                  <DataTable
                    columns={getInvoiceItemColumns(selectedInvoice.currency, {
                      canUpdateItem,
                      canDeleteItem,
                      onEdit: (item) => { setEditingItem(item); setIsItemDialogOpen(true); loadServices(); },
                      onDelete: (item) => setDeletingItem(item),
                    })}
                    data={invoiceItems}
                    isLoading={isLoadingItems}
                    useGlobalFilter
                    filterPlaceholder={t('OrderItemsTable.filterPlaceholder')}
                    isNarrow={isViewportNarrow || detailItemsListView}
                    viewControls={showToggle ? <ViewModeToggle value={detailItemsViewMode} onChange={setDetailItemsViewMode} /> : undefined}
                    cardListClassName={detailItemsListView ? 'gap-0 px-0 py-0 rounded-md border' : undefined}
                    renderCard={(item: InvoiceItem) => {
                      const actionsEl = canEditItems ? (
                        <>
                          {canUpdateItem && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingItem(item); setIsItemDialogOpen(true); loadServices(); }}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {canDeleteItem && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeletingItem(item)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </>
                      ) : undefined;
                      if (detailItemsListView) {
                        return (
                          <DataListRow
                            title={item.service_name || '-'}
                            meta={(
                              <>
                                <span>Cantidad: {item.quantity}</span>
                                <span>Precio unit.: {fmtCurrency(item.unit_price, selectedInvoice.currency)}</span>
                                <span className="font-medium text-foreground">Total: {fmtCurrency(item.total, selectedInvoice.currency)}</span>
                              </>
                            )}
                            actions={actionsEl}
                          />
                        );
                      }
                      return (
                        <DataCard
                          title={item.service_name || '-'}
                          subtitle={item.steps || item.step_id || undefined}
                          fields={[
                            { label: 'Cantidad', value: String(item.quantity) },
                            { label: 'Precio unit.', value: fmtCurrency(item.unit_price, selectedInvoice.currency) },
                            { label: 'Total', value: fmtCurrency(item.total, selectedInvoice.currency), primary: true },
                          ]}
                          actions={actionsEl}
                        />
                      );
                    }}
                  />
                </TabsContent>

                <TabsContent value="payments" className="flex-1 overflow-hidden mt-0 px-4 py-3 data-[state=active]:flex data-[state=active]:flex-col data-[state=inactive]:hidden">
                  <DataTable
                    columns={getInvoicePaymentColumns()}
                    data={invoicePayments}
                    isLoading={isLoadingPayments}
                    useGlobalFilter
                    filterPlaceholder={t('OrderItemsTable.filterPlaceholder')}
                    isNarrow={isViewportNarrow || detailPaymentsListView}
                    viewControls={showToggle ? <ViewModeToggle value={detailPaymentsViewMode} onChange={setDetailPaymentsViewMode} /> : undefined}
                    cardListClassName={detailPaymentsListView ? 'gap-0 px-0 py-0 rounded-md border' : undefined}
                    renderCard={(payment: any) => detailPaymentsListView ? (
                      <DataListRow
                        title={payment.doc_no || `Pago #${payment.id}`}
                        meta={(
                          <>
                            {payment.date ? <span>{formatDisplayDate(payment.date)}</span> : null}
                            <span>Método: {payment.method || '-'}</span>
                            {payment.currency ? <span>Moneda: {payment.currency}</span> : null}
                            <span className="font-medium text-foreground">Monto: {fmtCurrency(payment.amount, payment.currency)}</span>
                          </>
                        )}
                      />
                    ) : (
                      <DataCard
                        title={payment.doc_no || `Pago #${payment.id}`}
                        subtitle={payment.date ? formatDisplayDate(payment.date) : undefined}
                        fields={[
                          { label: 'Método', value: payment.method || '-' },
                          { label: 'Moneda', value: payment.currency || '-' },
                          { label: 'Monto', value: fmtCurrency(payment.amount, payment.currency), primary: true },
                        ]}
                      />
                    )}
                  />
                </TabsContent>
              </Tabs>
            </div>

            {/* ── Financial Footer ── */}
            {(() => {
              const paidAmt = Number(selectedInvoice.paid_amount) || 0;
              const pendingAmt = Math.max(0, selectedInvoice.total - paidAmt);
              const cur = selectedInvoice.currency || 'USD';
              const fmt = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(v);
              return (
                <div className="flex-none border-t bg-muted/30 px-6 py-3">
                  <div className="grid grid-cols-3 gap-x-4 gap-y-3">
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-0.5">Total</p>
                      <p className="text-sm font-semibold tabular-nums">{fmt(selectedInvoice.total)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-0.5">Pagado</p>
                      <p className={`text-sm font-semibold tabular-nums ${paidAmt > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                        {fmt(paidAmt)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-0.5">Saldo pendiente</p>
                      <p className={`text-sm font-semibold tabular-nums ${pendingAmt > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {fmt(pendingAmt)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </ResizableSheet>

      {/* ── Edit invoice dialog ── */}
      <Dialog open={isEditInvoiceOpen} onOpenChange={setIsEditInvoiceOpen}>
        <DialogContent maxWidth="4xl">
          <Form {...invoiceEditForm}>
            <form onSubmit={invoiceEditForm.handleSubmit(handleSubmitInvoiceEdit)} className="flex flex-col flex-1 overflow-hidden" onKeyDown={(e) => { if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') { e.preventDefault(); if ((e.target as HTMLInputElement).name?.startsWith('items.')) { loadServices(); appendEditInvoiceItem({ service_id: '', quantity: 1, unit_price: 0, total: 0 }); } } }}>
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

                {/* Invoice date + Due date */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={invoiceEditForm.control} name="created_at" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha de Factura</FormLabel>
                      <FormControl>
                        <DatePickerInput
                          value={field.value ? format(field.value, 'yyyy-MM-dd') : ''}
                          onChange={(iso) => field.onChange(iso ? parseISO(iso) : undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={invoiceEditForm.control} name="due_date" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('InvoicesPage.columns.dueDate')}</FormLabel>
                      <FormControl>
                        <DatePickerInput
                          value={field.value ? format(field.value, 'yyyy-MM-dd') : ''}
                          onChange={(iso) => field.onChange(iso ? parseISO(iso) : undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

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
                          Agregar Artículo
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
                                        selectedServiceName={invoiceEditForm.getValues(`items.${index}.service_name`) || undefined}
                                        onValueChange={(serviceId, service) => {
                                          field.onChange(serviceId);
                                          if (service) {
                                            const qty = invoiceEditForm.getValues(`items.${index}.quantity`) || 1;
                                            invoiceEditForm.setValue(`items.${index}.service_name`, service.name);
                                            invoiceEditForm.setValue(`items.${index}.unit_price`, Number(service.price));
                                            invoiceEditForm.setValue(`items.${index}.total`, Number(service.price) * qty);
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
                                            invoiceEditForm.setValue(`items.${index}.total`, qty * price);
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
                                            invoiceEditForm.setValue(`items.${index}.total`, qty * price);
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
                      <div className="mt-4 flex justify-end border-t border-dashed px-4 pb-4 pt-4">
                        <div className="text-right">
                          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                            Total
                          </p>
                          <p className="text-2xl font-semibold">
                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: watchedEditInvoiceCurrency || 'USD' }).format(
                              editInvoiceItemFields.reduce((sum, _, i) => sum + (Number(invoiceEditForm.getValues(`items.${i}.total`)) || 0), 0)
                            )}
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Notes */}
                <FormField control={invoiceEditForm.control} name="notes" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notas <span className="text-muted-foreground">(opcional)</span></FormLabel>
                    <FormControl><Textarea rows={2} placeholder="Observaciones..." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

              </DialogBody>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditInvoiceOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={isSubmittingInvoice}>
                  {isSubmittingInvoice && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Guardar
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
                    <ServiceSelector
                      isSales={isSales}
                      value={field.value}
                      selectedServiceName={itemForm.getValues('service_name') || editingItem?.service_name || undefined}
                      onValueChange={(serviceId, service) => {
                        field.onChange(serviceId);
                        if (service) {
                          itemForm.setValue('service_name', service.name);
                          if (!editingItem) itemForm.setValue('unit_price', service.price);
                        }
                      }}
                      placeholder="Seleccionar servicio"
                      triggerText="Seleccionar servicio"
                    />
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

      {/* ── Credit note dialog ── */}
      <Dialog open={isCreditNoteOpen} onOpenChange={setIsCreditNoteOpen}>
        <DialogContent maxWidth="4xl">
          <Form {...creditNoteForm}>
            <form onSubmit={creditNoteForm.handleSubmit(handleSubmitCreditNote)} className="flex flex-col flex-1 overflow-hidden" onKeyDown={(e) => { if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') { e.preventDefault(); if ((e.target as HTMLInputElement).name?.startsWith('items.')) { loadServices(); appendCreditNoteItem({ service_id: '', quantity: 1, unit_price: 0, total: 0 }); } } }}>
              <DialogHeader>
                <div className="flex items-start gap-3">
                  <div className="header-icon-circle mt-0.5">
                    <FileMinus2 className="h-5 w-5" />
                  </div>
                  <div className="flex flex-col text-left">
                    <DialogTitle>Nueva nota de crédito</DialogTitle>
                    <DialogDescription>
                      Factura referenciada: {selectedInvoice?.doc_no}. Monto pagado disponible:{' '}
                      <span className="font-medium text-foreground">
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: selectedInvoice?.currency || 'USD' }).format(Number(selectedInvoice?.paid_amount) || 0)}
                      </span>
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              <DialogBody className="space-y-4 py-4 px-6">
                {/* Currency + Date */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={creditNoteForm.control} name="currency" render={({ field }) => (
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
                  <FormField control={creditNoteForm.control} name="created_at" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha</FormLabel>
                      <FormControl>
                        <DatePickerInput
                          value={field.value ? format(field.value, 'yyyy-MM-dd') : ''}
                          onChange={(iso) => field.onChange(iso ? parseISO(iso) : undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                {/* Items */}
                <Card>
                  <CardContent className="p-0">
                    <div className="flex items-center justify-between px-4 pt-4 pb-2">
                      <p className="text-sm font-semibold">Ítems</p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => { loadServices(); appendCreditNoteItem({ service_id: '', quantity: 1, unit_price: 0, total: 0 }); }}
                      >
                        Agregar Artículo
                      </Button>
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
                            {creditNoteItemFields.map((fieldItem, index) => (
                              <tr key={fieldItem.id} className="align-top border-b last:border-0">
                                <td className="p-1">
                                  <FormField control={creditNoteForm.control} name={`items.${index}.service_id`} render={({ field }) => (
                                    <FormItem>
                                      <ServiceSelector
                                        isSales={isSales}
                                        value={field.value}
                                        selectedServiceName={creditNoteForm.getValues(`items.${index}.service_name`) || undefined}
                                        onValueChange={(serviceId, service) => {
                                          field.onChange(serviceId);
                                          if (service) {
                                            const qty = creditNoteForm.getValues(`items.${index}.quantity`) || 1;
                                            creditNoteForm.setValue(`items.${index}.service_name`, service.name);
                                            creditNoteForm.setValue(`items.${index}.unit_price`, Number(service.price));
                                            creditNoteForm.setValue(`items.${index}.total`, Number(service.price) * qty);
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
                                  <FormField control={creditNoteForm.control} name={`items.${index}.quantity`} render={({ field }) => (
                                    <FormItem>
                                      <FormControl>
                                        <Input type="number" step="1" min="1" {...field}
                                          onChange={e => {
                                            field.onChange(e);
                                            const qty = parseInt(e.target.value) || 0;
                                            const price = creditNoteForm.getValues(`items.${index}.unit_price`) || 0;
                                            creditNoteForm.setValue(`items.${index}.total`, qty * price);
                                          }}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )} />
                                </td>
                                <td className="p-1">
                                  <FormField control={creditNoteForm.control} name={`items.${index}.unit_price`} render={({ field }) => (
                                    <FormItem>
                                      <FormControl>
                                        <Input type="number" step="0.01" min="0" {...field}
                                          onChange={e => {
                                            field.onChange(e);
                                            const price = parseFloat(e.target.value) || 0;
                                            const qty = creditNoteForm.getValues(`items.${index}.quantity`) || 0;
                                            creditNoteForm.setValue(`items.${index}.total`, qty * price);
                                          }}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )} />
                                </td>
                                <td className="p-1">
                                  <FormField control={creditNoteForm.control} name={`items.${index}.total`} render={({ field }) => (
                                    <FormItem>
                                      <FormControl>
                                        <Input
                                          readOnly
                                          disabled
                                          value={new Intl.NumberFormat('en-US', { style: 'currency', currency: watchedCreditNoteCurrency || 'USD' }).format(Number(field.value) || 0)}
                                          className="bg-muted text-muted-foreground cursor-not-allowed"
                                        />
                                      </FormControl>
                                    </FormItem>
                                  )} />
                                </td>
                                <td className="p-1 text-center">
                                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => removeCreditNoteItem(index)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </td>
                              </tr>
                            ))}
                            {creditNoteItemFields.length === 0 && (
                              <tr><td colSpan={5} className="text-center text-muted-foreground text-xs py-4">Sin ítems. Agrega uno con el botón superior.</td></tr>
                            )}
                          </tbody>
                        </table>
                      )}
                    </div>
                    {creditNoteItemFields.length > 0 && (
                      <div className="mt-4 flex justify-between items-end border-t border-dashed px-4 pb-4 pt-4">
                        <p className="text-xs text-muted-foreground">
                          Máximo permitido:{' '}
                          <span className="font-medium text-foreground">
                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: selectedInvoice?.currency || 'USD' }).format(Number(selectedInvoice?.paid_amount) || 0)}
                          </span>
                        </p>
                        <div className="text-right">
                          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Total</p>
                          <p className={`text-2xl font-semibold ${creditNoteItemFields.reduce((sum, _, i) => sum + (Number(creditNoteForm.getValues(`items.${i}.total`)) || 0), 0) > (Number(selectedInvoice?.paid_amount) || 0) ? 'text-destructive' : ''}`}>
                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: watchedCreditNoteCurrency || 'USD' }).format(
                              creditNoteItemFields.reduce((sum, _, i) => sum + (Number(creditNoteForm.getValues(`items.${i}.total`)) || 0), 0)
                            )}
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Notes */}
                <FormField control={creditNoteForm.control} name="notes" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notas <span className="text-muted-foreground">(opcional)</span></FormLabel>
                    <FormControl><Textarea rows={2} placeholder="Motivo de la nota de crédito..." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* Refund */}
                <FormField control={creditNoteForm.control} name="is_refund" render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox checked={field.value ?? false} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Devolución directa al cliente</FormLabel>
                      <p className="text-xs text-muted-foreground">
                        Al crear la nota de crédito se abrirá el formulario de pago para registrar la devolución.
                      </p>
                    </div>
                  </FormItem>
                )} />
              </DialogBody>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreditNoteOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={isSubmittingCreditNote}>
                  {isSubmittingCreditNote && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Crear nota de crédito
                </Button>
              </DialogFooter>
            </form>
          </Form>
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

      {/* ── Credit note payment dialog ── */}
      <InvoicePaymentDialog
        isOpen={isPaymentDialogOpen}
        onClose={() => { setIsPaymentDialogOpen(false); setInvoiceForPayment(null); }}
        invoice={invoiceForPayment}
        isSales={isSales}
        onSuccess={() => { loadInvoices(true); onDataChange?.(); }}
      />
    </>
  );
}
