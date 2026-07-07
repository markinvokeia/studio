'use client';

import * as React from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Banknote, CheckCircle2, FileMinus, FilePlus2, FileText, Loader2, MoreHorizontal, Pencil, Printer, Receipt, ScrollText, Trash2, Undo2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Dialog, DialogBody, DialogCancelButton, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InvoicePaymentDialog } from '@/components/invoices/invoice-payment-dialog';
import { QuoteBillingDialog } from '@/components/sales/quotes/quote-billing-dialog';
import { SALES_PERMISSIONS } from '@/constants/permissions';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { buildPatientLedger, type LedgerRow, type LedgerRowStatus } from '@/lib/patient-ledger';
import type { Invoice, Quote, Service } from '@/lib/types';
import { formatDisplayDate } from '@/lib/utils';
import { api } from '@/services/api';
import { fetchPatientLedgerData, type PatientLedgerData } from '@/services/patient-ledger-data';
import { getSalesServices } from '@/services/services';

interface PatientLedgerProps {
  userId: string;
  refreshTrigger?: number;
  onCreateQuote?: () => void;
  onCreateTreatment?: () => void;
  onCreatePayment?: () => void;
  onPrintSummary?: () => void;
  onViewStatement?: () => void;
}

function fmtAmount(amount: number, currency: string) {
  if (!amount) return '—';
  return `${currency} ${amount.toLocaleString('es-UY', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

const STATUS_VARIANT: Record<LedgerRowStatus, 'secondary' | 'outline' | 'warning' | 'success' | 'destructive'> = {
  presupuestado: 'outline',
  facturado: 'secondary',
  parcial: 'warning',
  pagado: 'success',
  notaCredito: 'destructive',
};

function RowKindIcon({ row }: { row: LedgerRow }) {
  if (row.kind === 'payment') {
    return <Banknote className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />;
  }
  if (row.status === 'notaCredito') {
    return <FileMinus className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />;
  }
  if (row.status === 'presupuestado') {
    return <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />;
  }
  return <Receipt className="h-4 w-4 shrink-0 text-foreground/70" />;
}

function ledgerRowClassName(row: LedgerRow): string {
  if (row.kind === 'payment') return 'bg-blue-50/60 dark:bg-blue-950/20';
  if (row.status === 'notaCredito') return 'bg-red-50/60 dark:bg-red-950/20';
  if (row.status === 'presupuestado') return 'bg-muted/30';
  return '';
}

const editItemSchema = z.object({
  service_id: z.string().min(1),
  quantity: z.coerce.number().int().min(1),
  unit_price: z.coerce.number().min(0),
});
type EditItemFormValues = z.infer<typeof editItemSchema>;

const creditNoteSchema = z.object({
  quantity: z.coerce.number().int().min(1),
  unit_price: z.coerce.number().min(0),
  notes: z.string().optional(),
});
type CreditNoteFormValues = z.infer<typeof creditNoteSchema>;

interface RowActionsMenuProps {
  row: LedgerRow;
  canEdit: boolean;
  canInvoice: boolean;
  canConfirmQuote: boolean;
  canPay: boolean;
  canCreateCreditNote: boolean;
  canRevertInvoice: boolean;
  canDeleteQuote: boolean;
  canDeletePayment: boolean;
  canDeleteCreditNote: boolean;
  getMaxCreditable: (invoiceId: string) => number;
  onEdit: (row: LedgerRow) => void;
  onInvoice: (row: LedgerRow) => void;
  onConfirmQuote: (row: LedgerRow) => void;
  onPay: (row: LedgerRow) => void;
  onCreditNote: (row: LedgerRow) => void;
  onRevertInvoice: (row: LedgerRow) => void;
  onDeleteQuote: (row: LedgerRow) => void;
  onDeletePayment: (row: LedgerRow) => void;
  onDeleteCreditNote: (row: LedgerRow) => void;
  t: (key: string) => string;
}

const INVOICEABLE_QUOTE_STATUSES = ['accepted', 'confirmed'];
const CONFIRMABLE_QUOTE_STATUSES = ['draft', 'pending', 'sent'];

function RowActionsMenu({ row, canEdit, canInvoice, canConfirmQuote, canPay, canCreateCreditNote, canRevertInvoice, canDeleteQuote, canDeletePayment, canDeleteCreditNote, getMaxCreditable, onEdit, onInvoice, onConfirmQuote, onPay, onCreditNote, onRevertInvoice, onDeleteQuote, onDeletePayment, onDeleteCreditNote, t }: RowActionsMenuProps) {
  const isUnbilledQuoteItem = row.kind === 'item' && row.status === 'presupuestado';
  const isInvoiceItem = row.kind === 'item' && !!row.status && row.status !== 'presupuestado' && row.status !== 'notaCredito';
  const isPayment = row.kind === 'payment';
  const isCreditNote = row.kind === 'item' && row.status === 'notaCredito';
  const showPay = isInvoiceItem && row.status !== 'pagado';
  const quoteStatus = (row.quoteStatus || '').toLowerCase();
  const showInvoice = isUnbilledQuoteItem && INVOICEABLE_QUOTE_STATUSES.includes(quoteStatus);
  const showConfirmQuote = isUnbilledQuoteItem && CONFIRMABLE_QUOTE_STATUSES.includes(quoteStatus);
  const showRevert = isInvoiceItem;
  const showDeleteQuote = isUnbilledQuoteItem;
  const showDeletePayment = isPayment;
  const showDeleteCreditNote = isCreditNote;
  const showCreateCreditNote = isInvoiceItem && !!row.invoiceId && getMaxCreditable(row.invoiceId) > 0.005;
  const hasDestructiveAction = (showRevert && canRevertInvoice) || (showDeleteQuote && canDeleteQuote) || (showDeletePayment && canDeletePayment) || (showDeleteCreditNote && canDeleteCreditNote);
  const showEdit = isUnbilledQuoteItem && canEdit;
  const hasAnyAction = showEdit || (showConfirmQuote && canConfirmQuote) || (showInvoice && canInvoice) || (showPay && canPay) || (showCreateCreditNote && canCreateCreditNote) || hasDestructiveAction;

  if (!hasAnyAction) return <div className="h-8 w-8" />;

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <span className="sr-only">{t('actions.openMenu')}</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {showEdit && (
            <DropdownMenuItem onClick={() => onEdit(row)}>
              <Pencil className="mr-2 h-4 w-4" />{t('actions.edit')}
            </DropdownMenuItem>
          )}
          {showConfirmQuote && canConfirmQuote && (
            <DropdownMenuItem onClick={() => onConfirmQuote(row)}>
              <CheckCircle2 className="mr-2 h-4 w-4" />{t('actions.confirmQuote')}
            </DropdownMenuItem>
          )}
          {showInvoice && canInvoice && (
            <DropdownMenuItem onClick={() => onInvoice(row)}>
              <FileText className="mr-2 h-4 w-4" />{t('actions.invoice')}
            </DropdownMenuItem>
          )}
          {showPay && canPay && (
            <DropdownMenuItem onClick={() => onPay(row)}>
              <Receipt className="mr-2 h-4 w-4" />{t('actions.pay')}
            </DropdownMenuItem>
          )}
          {showCreateCreditNote && canCreateCreditNote && (
            <DropdownMenuItem onClick={() => onCreditNote(row)}>
              <FileMinus className="mr-2 h-4 w-4" />{t('actions.creditNote')}
            </DropdownMenuItem>
          )}
          {hasDestructiveAction && <DropdownMenuSeparator />}
          {showRevert && canRevertInvoice && (
            <DropdownMenuItem onClick={() => onRevertInvoice(row)}>
              <Undo2 className="mr-2 h-4 w-4" />{t('actions.revertToQuote')}
            </DropdownMenuItem>
          )}
          {showDeleteQuote && canDeleteQuote && (
            <DropdownMenuItem onClick={() => onDeleteQuote(row)} className="text-destructive focus:text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />{t('actions.deleteQuote')}
            </DropdownMenuItem>
          )}
          {showDeletePayment && canDeletePayment && (
            <DropdownMenuItem onClick={() => onDeletePayment(row)} className="text-destructive focus:text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />{t('actions.deletePayment')}
            </DropdownMenuItem>
          )}
          {showDeleteCreditNote && canDeleteCreditNote && (
            <DropdownMenuItem onClick={() => onDeleteCreditNote(row)} className="text-destructive focus:text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />{t('actions.deleteCreditNote')}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function PatientLedger({ userId, refreshTrigger, onCreateQuote, onCreateTreatment, onCreatePayment, onPrintSummary, onViewStatement }: PatientLedgerProps) {
  const t = useTranslations('PatientLedger');
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const canEditItem = hasPermission(SALES_PERMISSIONS.QUOTES_UPDATE_ITEM);
  const canInvoiceQuote = hasPermission(SALES_PERMISSIONS.INVOICES_CREATE) || hasPermission(SALES_PERMISSIONS.ORDERS_INVOICE_FROM_ORDER);
  const canConfirmQuote = hasPermission(SALES_PERMISSIONS.QUOTES_CONFIRM);
  const canCreatePaymentPerm = hasPermission(SALES_PERMISSIONS.PAYMENTS_CREATE);
  const canCreateCreditNote = hasPermission(SALES_PERMISSIONS.INVOICES_CREATE);
  const canRevertInvoice = hasPermission(SALES_PERMISSIONS.INVOICES_DELETE);
  const canDeleteQuote = hasPermission(SALES_PERMISSIONS.QUOTES_DELETE);
  const canDeletePayment = hasPermission(SALES_PERMISSIONS.PAYMENTS_CREATE);
  const canDeleteCreditNote = hasPermission(SALES_PERMISSIONS.INVOICES_DELETE);
  const [isConfirmingQuote, setIsConfirmingQuote] = React.useState(false);
  const [isRevertingInvoice, setIsRevertingInvoice] = React.useState(false);
  const [isDeletingQuote, setIsDeletingQuote] = React.useState(false);
  const [isDeletingPayment, setIsDeletingPayment] = React.useState(false);
  const [isDeletingCreditNote, setIsDeletingCreditNote] = React.useState(false);

  const [ledgerByCurrency, setLedgerByCurrency] = React.useState<Record<string, LedgerRow[]>>({});
  const [ledgerData, setLedgerData] = React.useState<PatientLedgerData | null>(null);
  const [currency, setCurrency] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const prevRefreshTrigger = React.useRef(refreshTrigger);

  const [services, setServices] = React.useState<Service[]>([]);
  const loadServices = React.useCallback(async () => {
    if (services.length > 0) return;
    try {
      const data = await getSalesServices({ limit: 500 });
      setServices(data.items || []);
    } catch { /* silent */ }
  }, [services.length]);

  const [billingQuote, setBillingQuote] = React.useState<Quote | null>(null);
  const [billingItemId, setBillingItemId] = React.useState<string | null>(null);
  const [paymentInvoice, setPaymentInvoice] = React.useState<Invoice | null>(null);
  const [editingRow, setEditingRow] = React.useState<LedgerRow | null>(null);
  const [isSubmittingEdit, setIsSubmittingEdit] = React.useState(false);
  const [creditNoteRow, setCreditNoteRow] = React.useState<LedgerRow | null>(null);
  const [isSubmittingCreditNote, setIsSubmittingCreditNote] = React.useState(false);

  const load = React.useCallback(async (forceRefresh: boolean) => {
    if (!userId) return;
    setIsLoading(true);
    const data = await fetchPatientLedgerData(userId, { forceRefresh });
    setLedgerData(data);
    const grouped = buildPatientLedger(data);
    setLedgerByCurrency(grouped);
    setCurrency((prev) => (prev && grouped[prev] ? prev : Object.keys(grouped)[0] || null));
    setIsLoading(false);
  }, [userId]);

  React.useEffect(() => {
    const forceRefresh = prevRefreshTrigger.current !== refreshTrigger;
    prevRefreshTrigger.current = refreshTrigger;
    void load(forceRefresh);
  }, [load, refreshTrigger]);

  const handleManualRefresh = React.useCallback(() => { void load(true); }, [load]);

  const currencies = Object.keys(ledgerByCurrency);
  const rows = currency ? ledgerByCurrency[currency] || [] : [];

  // ── Row actions ──────────────────────────────────────────────────────────────
  const handleEdit = React.useCallback((row: LedgerRow) => {
    void loadServices();
    setEditingRow(row);
  }, [loadServices]);

  const handleInvoice = React.useCallback((row: LedgerRow) => {
    const quote = ledgerData?.quotes.find((q) => q.id === row.quoteId) || null;
    setBillingQuote(quote);
    setBillingItemId(row.itemId || null);
  }, [ledgerData]);

  const handlePay = React.useCallback((row: LedgerRow) => {
    const invoice = ledgerData?.invoices.find((i) => i.id === row.invoiceId) || null;
    setPaymentInvoice(invoice);
  }, [ledgerData]);

  // The max a new credit note can total for a given invoice: its total minus
  // whatever's already been credited against it (credit notes are `Invoice` rows
  // with `type: 'credit_note'` and `parent_id` pointing back to the original).
  const getMaxCreditableForInvoice = React.useCallback((invoiceId: string): number => {
    const invoice = ledgerData?.invoices.find((i) => i.id === invoiceId && (i.type || 'invoice') !== 'credit_note');
    if (!invoice) return 0;
    const alreadyCredited = (ledgerData?.invoices || [])
      .filter((i) => i.type === 'credit_note' && String(i.parent_id) === String(invoiceId))
      .reduce((sum, cn) => sum + (cn.total || 0), 0);
    return Math.max(0, Math.round(((invoice.total || 0) - alreadyCredited) * 100) / 100);
  }, [ledgerData]);

  const handleCreditNote = React.useCallback((row: LedgerRow) => {
    setCreditNoteRow(row);
  }, []);

  const handleConfirmQuote = React.useCallback(async (row: LedgerRow) => {
    if (!row.quoteId || isConfirmingQuote) return;
    setIsConfirmingQuote(true);
    try {
      const res = await api.post(API_ROUTES.SALES.QUOTE_CONFIRM, {
        quote_number: row.quoteId,
        confirm_reject: 'confirm',
        is_sales: true,
        notes: '',
      });
      if (Array.isArray(res) && res[0]?.code >= 400) throw new Error(res[0]?.message);
      toast({ title: t('toasts.quoteConfirmed') });
      await load(true);
    } catch (e: any) {
      toast({ title: e?.message || t('toasts.quoteConfirmError'), variant: 'destructive' });
    } finally {
      setIsConfirmingQuote(false);
    }
  }, [isConfirmingQuote, load, t, toast]);

  const [confirmAction, setConfirmAction] = React.useState<{ row: LedgerRow; type: 'quote' | 'payment' | 'creditNote' | 'revertInvoice' } | null>(null);

  const handleRevertInvoice = React.useCallback((row: LedgerRow) => {
    setConfirmAction({ row, type: 'revertInvoice' });
  }, []);

  const handleDeleteQuote = React.useCallback((row: LedgerRow) => {
    setConfirmAction({ row, type: 'quote' });
  }, []);

  const handleDeletePayment = React.useCallback((row: LedgerRow) => {
    setConfirmAction({ row, type: 'payment' });
  }, []);

  const handleDeleteCreditNote = React.useCallback((row: LedgerRow) => {
    setConfirmAction({ row, type: 'creditNote' });
  }, []);

  const isConfirmActionBusy = isRevertingInvoice || isDeletingQuote || isDeletingPayment || isDeletingCreditNote;

  const handleConfirmAction = React.useCallback(async () => {
    if (!confirmAction) return;
    const { row, type } = confirmAction;
    if (type === 'revertInvoice') {
      if (!row.invoiceId || isRevertingInvoice) return;
      setIsRevertingInvoice(true);
      try {
        const res = await api.post(API_ROUTES.SALES.INVOICE_UNDO, {}, undefined, { invoice_id: row.invoiceId });
        if (Array.isArray(res) && res[0]?.code >= 400) throw new Error(res[0]?.message);
        toast({ title: t('toasts.invoiceReverted') });
        setConfirmAction(null);
        await load(true);
      } catch (e: any) {
        toast({ title: e?.message || t('toasts.invoiceRevertError'), variant: 'destructive' });
      } finally {
        setIsRevertingInvoice(false);
      }
    } else if (type === 'quote') {
      if (!row.quoteId || isDeletingQuote) return;
      setIsDeletingQuote(true);
      try {
        const res = await api.post(API_ROUTES.SALES.QUOTE_UNDO, {}, undefined, { quote_id: row.quoteId });
        if (Array.isArray(res) && res[0]?.code >= 400) throw new Error(res[0]?.message);
        toast({ title: t('toasts.quoteDeleted') });
        setConfirmAction(null);
        await load(true);
      } catch (e: any) {
        toast({ title: e?.message || t('toasts.quoteDeleteError'), variant: 'destructive' });
      } finally {
        setIsDeletingQuote(false);
      }
    } else if (type === 'payment') {
      if (!row.paymentId || !row.transactionType || isDeletingPayment) return;
      setIsDeletingPayment(true);
      try {
        const res = await api.post(API_ROUTES.SALES.PAYMENT_UNDO, {}, undefined, {
          transaction_id: row.paymentId,
          transaction_type: row.transactionType,
        });
        if (Array.isArray(res) && res[0]?.code >= 400) throw new Error(res[0]?.message);
        toast({ title: t('toasts.paymentDeleted') });
        setConfirmAction(null);
        await load(true);
      } catch (e: any) {
        toast({ title: e?.message || t('toasts.paymentDeleteError'), variant: 'destructive' });
      } finally {
        setIsDeletingPayment(false);
      }
    } else {
      if (!row.invoiceId || isDeletingCreditNote) return;
      setIsDeletingCreditNote(true);
      try {
        const res = await api.post(API_ROUTES.SALES.CREDIT_NOTE_UNDO, {}, undefined, { credit_note_id: row.invoiceId });
        if (Array.isArray(res) && res[0]?.code >= 400) throw new Error(res[0]?.message);
        toast({ title: t('toasts.creditNoteDeleted') });
        setConfirmAction(null);
        await load(true);
      } catch (e: any) {
        toast({ title: e?.message || t('toasts.creditNoteDeleteError'), variant: 'destructive' });
      } finally {
        setIsDeletingCreditNote(false);
      }
    }
  }, [confirmAction, isRevertingInvoice, isDeletingQuote, isDeletingPayment, isDeletingCreditNote, load, t, toast]);

  const editForm = useForm<EditItemFormValues>({ resolver: zodResolver(editItemSchema) });
  React.useEffect(() => {
    if (!editingRow) return;
    editForm.reset({
      service_id: editingRow.serviceId || '',
      quantity: editingRow.quantity || 1,
      unit_price: editingRow.unitPrice || 0,
    });
  }, [editingRow, editForm]);

  const handleSubmitEdit = async (values: EditItemFormValues) => {
    if (!editingRow?.quoteId || !editingRow.itemId) return;
    setIsSubmittingEdit(true);
    try {
      const res = await api.post(API_ROUTES.SALES.QUOTES_LINES_UPSERT, {
        id: editingRow.itemId,
        quote_id: editingRow.quoteId,
        service_id: values.service_id,
        quantity: values.quantity,
        unit_price: values.unit_price,
        total: values.quantity * values.unit_price,
        tooth_number: null,
        is_sales: true,
      });
      if (Array.isArray(res) && res[0]?.code >= 400) throw new Error(res[0]?.message);
      toast({ title: t('toasts.itemUpdated') });
      setEditingRow(null);
      await load(true);
    } catch (e: any) {
      toast({ title: e?.message || t('toasts.itemUpdateError'), variant: 'destructive' });
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const creditNoteForm = useForm<CreditNoteFormValues>({ resolver: zodResolver(creditNoteSchema) });
  React.useEffect(() => {
    if (!creditNoteRow) return;
    creditNoteForm.reset({
      quantity: creditNoteRow.quantity || 1,
      unit_price: creditNoteRow.unitPrice || 0,
      notes: '',
    });
  }, [creditNoteRow, creditNoteForm]);

  const handleSubmitCreditNote = async (values: CreditNoteFormValues) => {
    if (!creditNoteRow?.invoiceId || !creditNoteRow.serviceId) return;
    const total = values.quantity * values.unit_price;
    const maxCreditable = getMaxCreditableForInvoice(creditNoteRow.invoiceId);
    if (total > maxCreditable + 0.01) {
      creditNoteForm.setError('unit_price', {
        message: t('dialogs.creditNote.exceedsMax', { max: maxCreditable.toFixed(2) }),
      });
      return;
    }
    setIsSubmittingCreditNote(true);
    try {
      const res = await api.post(API_ROUTES.SALES.INVOICES_UPSERT, {
        user_id: userId,
        type: 'credit_note',
        parent_id: creditNoteRow.invoiceId,
        currency: creditNoteRow.currency,
        total,
        notes: values.notes || '',
        is_sales: true,
        items: [{
          service_id: creditNoteRow.serviceId,
          quantity: values.quantity,
          unit_price: values.unit_price,
          total,
        }],
      });
      if (Array.isArray(res) && res[0]?.code >= 400) throw new Error(res[0]?.message);
      toast({ title: t('toasts.creditNoteCreated') });
      setCreditNoteRow(null);
      await load(true);
    } catch (e: any) {
      toast({ title: e?.message || t('toasts.creditNoteError'), variant: 'destructive' });
    } finally {
      setIsSubmittingCreditNote(false);
    }
  };

  const baseColumns = React.useMemo<ColumnDef<LedgerRow>[]>(() => [
    {
      accessorKey: 'date',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.date')} />,
      cell: ({ row }) => <span className="whitespace-nowrap text-sm">{formatDisplayDate(row.original.date)}</span>,
    },
    {
      accessorKey: 'label',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.treatment')} />,
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <RowKindIcon row={row.original} />
          <div className="flex flex-col">
            <span className="font-medium">{row.original.label}</span>
            {row.original.docNo && <span className="text-xs text-muted-foreground">#{row.original.docNo}</span>}
          </div>
        </div>
      ),
    },
    {
      id: 'status',
      header: () => t('columns.status'),
      cell: ({ row }) => {
        if (row.original.kind === 'payment') {
          return <Badge variant="info">{t('status.pago')}</Badge>;
        }
        const status = row.original.status;
        if (!status) return null;
        return <Badge variant={STATUS_VARIANT[status]}>{t(`status.${status}`)}</Badge>;
      },
    },
    {
      accessorKey: 'debe',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.debit')} />,
      cell: ({ row }) => <span className="tabular-nums">{fmtAmount(row.original.debe, row.original.currency)}</span>,
    },
    {
      accessorKey: 'haber',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.credit')} />,
      cell: ({ row }) => <span className="tabular-nums">{fmtAmount(row.original.haber, row.original.currency)}</span>,
    },
    {
      accessorKey: 'runningBalance',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('columns.balance')} />,
      cell: ({ row }) => <span className="font-semibold tabular-nums">{fmtAmount(row.original.runningBalance, row.original.currency)}</span>,
    },
  ], [t]);

  const columns = React.useMemo<ColumnDef<LedgerRow>[]>(() => [
    ...baseColumns,
    {
      id: 'actions',
      header: () => null,
      cell: ({ row }) => (
        <RowActionsMenu
          row={row.original}
          canEdit={canEditItem}
          canInvoice={canInvoiceQuote}
          canConfirmQuote={canConfirmQuote}
          canPay={canCreatePaymentPerm}
          canCreateCreditNote={canCreateCreditNote}
          canRevertInvoice={canRevertInvoice}
          canDeleteQuote={canDeleteQuote}
          canDeletePayment={canDeletePayment}
          canDeleteCreditNote={canDeleteCreditNote}
          getMaxCreditable={getMaxCreditableForInvoice}
          onEdit={handleEdit}
          onInvoice={handleInvoice}
          onConfirmQuote={handleConfirmQuote}
          onPay={handlePay}
          onCreditNote={handleCreditNote}
          onRevertInvoice={handleRevertInvoice}
          onDeleteQuote={handleDeleteQuote}
          onDeletePayment={handleDeletePayment}
          onDeleteCreditNote={handleDeleteCreditNote}
          t={t}
        />
      ),
    },
  ], [baseColumns, canEditItem, canInvoiceQuote, canConfirmQuote, canCreatePaymentPerm, canCreateCreditNote, canRevertInvoice, canDeleteQuote, canDeletePayment, canDeleteCreditNote, getMaxCreditableForInvoice, handleEdit, handleInvoice, handleConfirmQuote, handlePay, handleCreditNote, handleRevertInvoice, handleDeleteQuote, handleDeletePayment, handleDeleteCreditNote, t]);

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      {onCreateQuote && (
        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={onCreateQuote}>
          <FileText className="h-3.5 w-3.5" />{t('newQuote')}
        </Button>
      )}
      {onCreateTreatment && (
        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={onCreateTreatment}>
          <FilePlus2 className="h-3.5 w-3.5" />{t('newTreatment')}
        </Button>
      )}
      {onCreatePayment && (
        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={onCreatePayment}>
          <Receipt className="h-3.5 w-3.5" />{t('newPayment')}
        </Button>
      )}
      {onViewStatement && (
        <Button size="sm" variant="ghost" className="gap-1.5 text-xs" onClick={onViewStatement}>
          <ScrollText className="h-3.5 w-3.5" />{t('viewStatement')}
        </Button>
      )}
      {onPrintSummary && (
        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={onPrintSummary}>
          <Printer className="h-3.5 w-3.5" />
        </Button>
      )}
      {currencies.length > 1 && (
        <Select value={currency ?? undefined} onValueChange={setCurrency}>
          <SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {currencies.map((c) => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <div className="space-y-4 pt-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  return (
    <>
      <Card className="h-full flex flex-col min-h-0">
        <CardContent className="flex-1 flex flex-col min-h-0 p-4">
          <DataTable
            columns={columns}
            data={rows}
            filterColumnId="label"
            onRefresh={handleManualRefresh}
            extraButtons={toolbar}
            getRowClassName={ledgerRowClassName}
            columnTranslations={{
              date: t('columns.date'),
              label: t('columns.treatment'),
              debe: t('columns.debit'),
              haber: t('columns.credit'),
              runningBalance: t('columns.balance'),
            }}
          />
        </CardContent>
      </Card>

      <QuoteBillingDialog
        open={!!billingQuote}
        onOpenChange={(open) => { if (!open) { setBillingQuote(null); setBillingItemId(null); } }}
        quote={billingQuote}
        quoteItems={[]}
        onlyQuoteItemId={billingItemId ?? undefined}
        isSales
        onSuccess={async () => { setBillingQuote(null); setBillingItemId(null); await load(true); }}
      />

      <InvoicePaymentDialog
        isOpen={!!paymentInvoice}
        onClose={() => setPaymentInvoice(null)}
        invoice={paymentInvoice}
        isSales
        onSuccess={async () => { setPaymentInvoice(null); await load(true); }}
      />

      <Dialog open={!!editingRow} onOpenChange={(open) => { if (!open) setEditingRow(null); }}>
        <DialogContent className="sm:max-w-[480px]" confirmOnClose isDirty={editForm.formState.isDirty}>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleSubmitEdit)}>
              <DialogHeader>
                <DialogTitle>{t('dialogs.editItem.title')}</DialogTitle>
                <DialogDescription>{t('dialogs.editItem.description')}</DialogDescription>
              </DialogHeader>
              <DialogBody className="space-y-4 py-4 px-6">
                <FormField control={editForm.control} name="service_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('dialogs.editItem.service')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder={t('dialogs.editItem.service')} /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {services.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={editForm.control} name="quantity" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('dialogs.editItem.quantity')}</FormLabel>
                      <FormControl><Input type="number" min={1} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={editForm.control} name="unit_price" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('dialogs.editItem.unitPrice')}</FormLabel>
                      <FormControl><Input type="number" min={0} step="0.01" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </DialogBody>
              <DialogFooter>
                <DialogCancelButton disabled={isSubmittingEdit}>{t('dialogs.editItem.cancel')}</DialogCancelButton>
                <Button type="submit" disabled={isSubmittingEdit}>
                  {isSubmittingEdit && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('dialogs.editItem.save')}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!creditNoteRow} onOpenChange={(open) => { if (!open) setCreditNoteRow(null); }}>
        <DialogContent className="sm:max-w-[480px]" confirmOnClose isDirty={creditNoteForm.formState.isDirty}>
          <Form {...creditNoteForm}>
            <form onSubmit={creditNoteForm.handleSubmit(handleSubmitCreditNote)}>
              <DialogHeader>
                <DialogTitle>{t('dialogs.creditNote.title')}</DialogTitle>
                <DialogDescription>{t('dialogs.creditNote.description', { service: creditNoteRow?.label || '' })}</DialogDescription>
              </DialogHeader>
              <DialogBody className="space-y-4 py-4 px-6">
                {creditNoteRow?.invoiceId && (
                  <p className="text-xs text-muted-foreground">
                    {t('dialogs.creditNote.maxCreditable', { max: getMaxCreditableForInvoice(creditNoteRow.invoiceId).toFixed(2) })}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={creditNoteForm.control} name="quantity" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('dialogs.creditNote.quantity')}</FormLabel>
                      <FormControl><Input type="number" min={1} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={creditNoteForm.control} name="unit_price" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('dialogs.creditNote.unitPrice')}</FormLabel>
                      <FormControl><Input type="number" min={0} step="0.01" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={creditNoteForm.control} name="notes" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('dialogs.creditNote.notes')}</FormLabel>
                    <FormControl><Textarea {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </DialogBody>
              <DialogFooter>
                <DialogCancelButton disabled={isSubmittingCreditNote}>{t('dialogs.creditNote.cancel')}</DialogCancelButton>
                <Button type="submit" disabled={isSubmittingCreditNote}>
                  {isSubmittingCreditNote && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('dialogs.creditNote.save')}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmAction} onOpenChange={(open) => { if (!open) setConfirmAction(null); }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>
              {confirmAction?.type === 'quote' && t('dialogs.deleteQuote.title')}
              {confirmAction?.type === 'payment' && t('dialogs.deletePayment.title')}
              {confirmAction?.type === 'creditNote' && t('dialogs.deleteCreditNote.title')}
              {confirmAction?.type === 'revertInvoice' && t('dialogs.revertInvoice.title')}
            </DialogTitle>
            <DialogDescription>
              {confirmAction?.type === 'quote' && t('dialogs.deleteQuote.description')}
              {confirmAction?.type === 'payment' && t('dialogs.deletePayment.description')}
              {confirmAction?.type === 'creditNote' && t('dialogs.deleteCreditNote.description')}
              {confirmAction?.type === 'revertInvoice' && t('dialogs.revertInvoice.description')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)} disabled={isConfirmActionBusy}>
              {t('dialogs.deleteQuote.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleConfirmAction} disabled={isConfirmActionBusy}>
              {isConfirmActionBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {confirmAction?.type === 'revertInvoice' ? t('dialogs.revertInvoice.confirm') : t('dialogs.deleteQuote.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
