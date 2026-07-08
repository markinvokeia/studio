'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Banknote, Check, ChevronDown, FileMinus, FilePlus2, FileText, Loader2, MoreHorizontal, Pencil, Printer, Receipt, RefreshCw, ScrollText, Search, Trash2 } from 'lucide-react';
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
import { Dialog, DialogBody, DialogCancelButton, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { QuoteBillingDialog } from '@/components/sales/quotes/quote-billing-dialog';
import { SALES_PERMISSIONS } from '@/constants/permissions';
import { API_ROUTES } from '@/constants/routes';
import { useAuth } from '@/context/AuthContext';
import { useCashSessionValidation } from '@/hooks/use-cash-session-validation';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { buildPatientLedger, type LedgerRow, type LedgerRowStatus } from '@/lib/patient-ledger';
import type { Quote, Service } from '@/lib/types';
import { cn, formatDisplayDate, toLocalISOString } from '@/lib/utils';
import { api } from '@/services/api';
import { fetchPatientLedgerData, type PatientLedgerData } from '@/services/patient-ledger-data';
import { getSalesServices } from '@/services/services';

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Shared by the full and partial "Finalizado" credit allocations: spends `amount` out of
 * `credits` (oldest/first-listed first) against `row.invoiceId` via a credit-only
 * `INVOICE_PAYMENT` (no cash). Throws on a backend error; caller handles toasts/reload.
 */
async function postCreditAllocation(params: {
  userId: string;
  patientName?: string;
  patientEmail?: string;
  operator: unknown;
  row: LedgerRow;
  amount: number;
  credits: { source_id: string; type: string; currency: string; available_balance: string }[];
  sessionId?: string;
}): Promise<void> {
  const { userId, patientName, patientEmail, operator, row, amount, credits, sessionId } = params;
  let need = amount;
  const creditBreakdown: { source_id: string; amount: number; type: string; currency: string }[] = [];
  for (const c of credits) {
    if (need <= 0) break;
    const available = parseFloat(c.available_balance);
    const take = round2(Math.min(need, available));
    if (take <= 0) continue;
    creditBreakdown.push({ source_id: c.source_id, amount: take, type: c.type, currency: c.currency || row.currency });
    need = round2(need - take);
  }

  const res: any = await api.post(API_ROUTES.SALES.INVOICE_PAYMENT, {
    cash_session_id: sessionId,
    user: operator,
    client_user: { id: userId, name: patientName || '', email: patientEmail || '' },
    credit_payment: creditBreakdown,
    query: {
      invoice_id: parseInt(row.invoiceId!, 10),
      amount: 0,
      converted_amount: 0,
      total_paid: amount,
      payment_date: toLocalISOString(new Date()),
      method: 'Credit',
      status: 'completed',
      user_id: userId,
      is_sales: true,
      invoice_currency: row.currency,
      payment_currency: row.currency,
      exchange_rate: 1,
      notes: '',
      is_historical: false,
    },
  });
  if (res?.error && res?.code >= 400) throw new Error(res.message);
  if (Array.isArray(res) && res[0]?.code >= 400) throw new Error(res[0]?.message);
}

interface PatientLedgerProps {
  userId: string;
  /** Used to build `client_user` for the "Finalizado" credit-allocation payment. */
  patientName?: string;
  patientEmail?: string;
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
  notaCredito: 'warning',
};

function RowKindIcon({ row }: { row: LedgerRow }) {
  if (row.kind === 'payment') {
    return <Banknote className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />;
  }
  if (row.status === 'notaCredito') {
    return <FileMinus className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />;
  }
  if (row.status === 'presupuestado') {
    return <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />;
  }
  return <Receipt className="h-4 w-4 shrink-0 text-foreground/70" />;
}

/**
 * Odontosys-style color coding for the ledger cards: green for payments, red (+ a "P"
 * badge) for unbilled presupuestos, light amber for credit notes.
 */
function cardAccentClass(row: LedgerRow): string {
  if (row.kind === 'payment') {
    return 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/25 dark:border-emerald-900/50';
  }
  if (row.status === 'notaCredito') {
    return 'bg-amber-50 border-amber-200 dark:bg-amber-950/25 dark:border-amber-900/50';
  }
  if (row.status === 'presupuestado') {
    return 'bg-rose-100 border-rose-300 dark:bg-rose-950/40 dark:border-rose-800/60';
  }
  return 'bg-muted/40 border-border';
}

/** Small "P" marker on presupuesto cards — mirrors Odontosys' own presupuesto tag. */
function PresupuestoBadge() {
  return (
    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold leading-none text-white dark:bg-rose-500">
      P
    </span>
  );
}

/** The three states shown in the inline status control: "presupuesto" is an unconfirmed,
 *  unbilled quote line; "enCurso" is a quote confirmed AND billed (one step — confirming
 *  always bills immediately) whose invoice isn't paid yet; "finalizado" means that single
 *  invoice line has been paid in full (via an allocation against the patient's credit). */
type LedgerItemState = 'presupuesto' | 'enCurso' | 'finalizado';

function getLedgerItemState(row: LedgerRow): LedgerItemState {
  if (row.status === 'presupuestado') return 'presupuesto';
  if (row.status === 'pagado') return 'finalizado';
  return 'enCurso';
}

const STATUS_CONTROL_VARIANT: Record<LedgerItemState, 'destructive' | 'warning' | 'success'> = {
  presupuesto: 'destructive',
  enCurso: 'warning',
  finalizado: 'success',
};

interface LedgerRowStatusControlProps {
  row: LedgerRow;
  /** Presupuesto → En curso: confirm the quote and bill it in one step. */
  canSetEnCurso: boolean;
  /** En curso → Finalizado: pay the invoice in full from the patient's available credit. */
  canSetFinalizado: boolean;
  /** Finalizado → En curso: undo the payment(s) that covered this invoice. */
  canRevertToEnCurso: boolean;
  /** En curso → Presupuesto: revert the invoice back to its (unbilled) quote — only
   *  possible when there's a quote behind it; standalone invoices delete instead, from
   *  the "…" menu. */
  canRevertToPresupuesto: boolean;
  busy: boolean;
  onSetEnCurso: (row: LedgerRow) => void;
  onSetFinalizado: (row: LedgerRow) => void;
  onRevertToEnCurso: (row: LedgerRow) => void;
  onRevertToPresupuesto: (row: LedgerRow) => void;
  t: (key: string) => string;
}

/**
 * Inline status pill: one control per row cycling Presupuesto → En curso → Finalizado
 * (and back one step at a time), replacing the separate "Confirm/Invoice/Pay/Revert"
 * menu entries. Only adjacent transitions are offered — jumping two steps at once (e.g.
 * Presupuesto straight to Finalizado) isn't exposed to keep each action's effect obvious.
 */
function LedgerRowStatusControl({ row, canSetEnCurso, canSetFinalizado, canRevertToEnCurso, canRevertToPresupuesto, busy, onSetEnCurso, onSetFinalizado, onRevertToEnCurso, onRevertToPresupuesto, t }: LedgerRowStatusControlProps) {
  const current = getLedgerItemState(row);
  const options: { key: LedgerItemState; enabled: boolean; onSelect: () => void }[] = [
    {
      key: 'presupuesto',
      enabled: current === 'enCurso' && !!row.quoteId && canRevertToPresupuesto,
      onSelect: () => onRevertToPresupuesto(row),
    },
    {
      key: 'enCurso',
      enabled: (current === 'presupuesto' && canSetEnCurso) || (current === 'finalizado' && canRevertToEnCurso),
      onSelect: () => (current === 'presupuesto' ? onSetEnCurso(row) : onRevertToEnCurso(row)),
    },
    {
      key: 'finalizado',
      enabled: current === 'enCurso' && canSetFinalizado,
      onSelect: () => onSetFinalizado(row),
    },
  ];

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 gap-1 px-1.5" disabled={busy}>
            <Badge variant={STATUS_CONTROL_VARIANT[current]}>{t(`statusControl.${current}`)}</Badge>
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {options.map((option) => (
            <DropdownMenuItem
              key={option.key}
              disabled={option.key === current || !option.enabled}
              onClick={option.onSelect}
            >
              {option.key === current ? <Check className="mr-2 h-4 w-4" /> : <span className="mr-2 inline-block h-4 w-4" />}
              {t(`statusControl.${option.key}`)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
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
  canCreateCreditNote: boolean;
  canDeleteQuote: boolean;
  canDeletePayment: boolean;
  canDeleteCreditNote: boolean;
  canDeleteInvoice: boolean;
  getMaxCreditable: (invoiceId: string) => number;
  onEdit: (row: LedgerRow) => void;
  onInvoice: (row: LedgerRow) => void;
  onCreditNote: (row: LedgerRow) => void;
  onDeleteQuote: (row: LedgerRow) => void;
  onDeletePayment: (row: LedgerRow) => void;
  onDeleteCreditNote: (row: LedgerRow) => void;
  onDeleteInvoice: (row: LedgerRow) => void;
  t: (key: string) => string;
}

const INVOICEABLE_QUOTE_STATUSES = ['accepted', 'confirmed'];
const CONFIRMABLE_QUOTE_STATUSES = ['draft', 'pending', 'sent'];

/**
 * The "…" menu now only holds actions that don't fit the Presupuesto/En curso/Finalizado
 * status cycle (which lives in the inline `LedgerRowStatusControl` instead, including
 * paying — that's what marking a row "Finalizado" does now): editing an unbilled line, a
 * custom/partial billing (vs. the status control's one-click full-amount invoice), credit
 * notes, and deletions.
 */
function RowActionsMenu({ row, canEdit, canInvoice, canCreateCreditNote, canDeleteQuote, canDeletePayment, canDeleteCreditNote, canDeleteInvoice, getMaxCreditable, onEdit, onInvoice, onCreditNote, onDeleteQuote, onDeletePayment, onDeleteCreditNote, onDeleteInvoice, t }: RowActionsMenuProps) {
  const isUnbilledQuoteItem = row.kind === 'item' && row.status === 'presupuestado';
  const isInvoiceItem = row.kind === 'item' && !!row.status && row.status !== 'presupuestado' && row.status !== 'notaCredito';
  const isPayment = row.kind === 'payment';
  const isCreditNote = row.kind === 'item' && row.status === 'notaCredito';
  const quoteStatus = (row.quoteStatus || '').toLowerCase();
  const showInvoice = isUnbilledQuoteItem && INVOICEABLE_QUOTE_STATUSES.includes(quoteStatus);
  const showDeleteQuote = isUnbilledQuoteItem;
  const showDeletePayment = isPayment;
  const showDeleteCreditNote = isCreditNote;
  // Any billed document (En curso or Finalizado) can be deleted outright from here —
  // for a standalone invoice (no quote) that's just the invoice; for a quote-backed one
  // it removes the invoice AND its underlying quote, since "delete" means the whole
  // document is gone, not just reverted back to a still-alive presupuesto.
  const showDeleteInvoice = isInvoiceItem;
  const showCreateCreditNote = isInvoiceItem && !!row.invoiceId && getMaxCreditable(row.invoiceId) > 0.005;
  const hasDestructiveAction = (showDeleteQuote && canDeleteQuote) || (showDeletePayment && canDeletePayment) || (showDeleteCreditNote && canDeleteCreditNote) || (showDeleteInvoice && canDeleteInvoice);
  const showEdit = isUnbilledQuoteItem && canEdit;
  const hasAnyAction = showEdit || (showInvoice && canInvoice) || (showCreateCreditNote && canCreateCreditNote) || hasDestructiveAction;

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
          {showInvoice && canInvoice && (
            <DropdownMenuItem onClick={() => onInvoice(row)}>
              <FileText className="mr-2 h-4 w-4" />{t('actions.invoiceCustom')}
            </DropdownMenuItem>
          )}
          {showCreateCreditNote && canCreateCreditNote && (
            <DropdownMenuItem onClick={() => onCreditNote(row)}>
              <FileMinus className="mr-2 h-4 w-4" />{t('actions.creditNote')}
            </DropdownMenuItem>
          )}
          {hasDestructiveAction && <DropdownMenuSeparator />}
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
          {showDeleteInvoice && canDeleteInvoice && (
            <DropdownMenuItem onClick={() => onDeleteInvoice(row)} className="text-destructive focus:text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />{t('actions.deleteInvoice')}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function PatientLedger({ userId, patientName, patientEmail, refreshTrigger, onCreateQuote, onCreateTreatment, onCreatePayment, onPrintSummary, onViewStatement }: PatientLedgerProps) {
  const t = useTranslations('PatientLedger');
  const { toast } = useToast();
  const { user: operator } = useAuth();
  const { validateActiveSession, showCashSessionError } = useCashSessionValidation();
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
  const [isRevertingInvoice, setIsRevertingInvoice] = React.useState(false);
  const [isDeletingQuote, setIsDeletingQuote] = React.useState(false);
  const [isDeletingPayment, setIsDeletingPayment] = React.useState(false);
  const [isDeletingCreditNote, setIsDeletingCreditNote] = React.useState(false);
  const [isMarkingFinalized, setIsMarkingFinalized] = React.useState(false);
  const [isUnmarkingFinalized, setIsUnmarkingFinalized] = React.useState(false);

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
  const rows = React.useMemo(
    () => (currency ? ledgerByCurrency[currency] || [] : []),
    [currency, ledgerByCurrency],
  );

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

  const [isMarkingEnCurso, setIsMarkingEnCurso] = React.useState(false);

  /**
   * Presupuesto → En curso, in one click: confirms the quote (if it isn't already) and
   * immediately bills its single line for the full amount. There's no intermediate
   * "confirmed but unbilled" resting state in this model — confirming always bills.
   */
  const handleMarkEnCurso = React.useCallback(async (row: LedgerRow) => {
    if (!row.quoteId || !row.itemId || !row.serviceId || isMarkingEnCurso) return;
    setIsMarkingEnCurso(true);
    try {
      const quoteStatus = (row.quoteStatus || '').toLowerCase();
      if (CONFIRMABLE_QUOTE_STATUSES.includes(quoteStatus)) {
        const confirmRes = await api.post(API_ROUTES.SALES.QUOTE_CONFIRM, {
          quote_number: row.quoteId,
          confirm_reject: 'confirm',
          is_sales: true,
          notes: '',
        });
        if (Array.isArray(confirmRes) && confirmRes[0]?.code >= 400) throw new Error(confirmRes[0]?.message);
      }

      const ordersRes: any = await api.get(API_ROUTES.SALES.QUOTES_ORDERS, { quote_id: row.quoteId, is_sales: 'true' });
      const orders = Array.isArray(ordersRes) ? ordersRes : (ordersRes?.orders || ordersRes?.data || ordersRes?.result || []);
      const orderId = orders[0]?.id;
      if (!orderId) throw new Error(t('toasts.markEnCursoError'));

      const billingQuery = {
        quote_id: Number(row.quoteId),
        user_id: userId,
        currency: row.currency,
        invoice_date: toLocalISOString(new Date()),
        notes: '',
        items: [{
          quote_item_id: Number(row.itemId),
          service_id: Number(row.serviceId),
          step_names: [] as string[],
          amount: row.debe,
        }],
      };
      const invoiceRes: any = await api.post(API_ROUTES.SALES.ORDER_INVOICE, {
        order_id: String(orderId),
        is_sales: true,
        query: JSON.stringify(billingQuery),
      });
      if (invoiceRes?.error && invoiceRes?.code >= 400) throw new Error(invoiceRes.message);
      if (Array.isArray(invoiceRes) && invoiceRes[0]?.code >= 400) throw new Error(invoiceRes[0]?.message);

      toast({ title: t('toasts.markedEnCurso') });
      await load(true);
    } catch (e: any) {
      toast({ title: e?.message || t('toasts.markEnCursoError'), variant: 'destructive' });
    } finally {
      setIsMarkingEnCurso(false);
    }
  }, [userId, load, t, toast, isMarkingEnCurso]);

  interface PartialFinalizeContext {
    row: LedgerRow;
    /** Total available credit — less than what's owed, hence the confirm prompt. */
    amount: number;
    credits: { source_id: string; type: string; currency: string; available_balance: string }[];
    sessionId?: string;
  }
  const [partialFinalizeContext, setPartialFinalizeContext] = React.useState<PartialFinalizeContext | null>(null);
  const [isConfirmingPartialFinalize, setIsConfirmingPartialFinalize] = React.useState(false);

  /**
   * En curso → Finalizado: pays the invoice's single line in full, purely from the
   * patient's available credit (built up via "Nuevo Pago", which now only ever creates a
   * prepayment/credit — never applies cash to an invoice directly). When the available
   * credit falls short, this doesn't error out — it hands off to a confirm dialog that
   * lets the user apply whatever credit exists as a partial payment instead (leaving the
   * row at "En curso", since it isn't fully paid).
   */
  const handleMarkFinalized = React.useCallback(async (row: LedgerRow) => {
    if (!row.invoiceId || isMarkingFinalized) return;
    setIsMarkingFinalized(true);
    try {
      const validation = await validateActiveSession();
      if (!validation.isValid) {
        showCashSessionError(validation.error);
        return;
      }

      const alreadyApplied = (ledgerData?.payments || [])
        .filter((p) => p.invoice_id === row.invoiceId)
        .reduce((sum, p) => sum + Math.abs(Number(p.amount_applied ?? p.amount ?? 0)), 0);
      const remaining = round2(row.debe - alreadyApplied);
      if (remaining <= 0.005) {
        toast({ title: t('toasts.alreadyFinalized') });
        return;
      }

      const creditsRes: any = await api.get(API_ROUTES.USER_CREDIT, { user_id: userId });
      const credits = (Array.isArray(creditsRes) ? creditsRes : [])
        .filter((c: any) => c && c.source_id && (c.currency || row.currency) === row.currency && parseFloat(c.available_balance) > 0.005);
      const totalAvailable = round2(credits.reduce((sum: number, c: any) => sum + parseFloat(c.available_balance), 0));

      if (totalAvailable + 0.005 < remaining) {
        setPartialFinalizeContext({ row, amount: totalAvailable, credits, sessionId: validation.sessionId });
        return;
      }

      await postCreditAllocation({ userId, patientName, patientEmail, operator, row, amount: remaining, credits, sessionId: validation.sessionId });
      toast({ title: t('toasts.itemFinalized') });
      await load(true);
    } catch (e: any) {
      toast({ title: e?.message || t('toasts.itemFinalizeError'), variant: 'destructive' });
    } finally {
      setIsMarkingFinalized(false);
    }
  }, [userId, patientName, patientEmail, ledgerData, load, t, toast, isMarkingFinalized, validateActiveSession, showCashSessionError, operator]);

  /** Applies whatever credit is available (less than what's owed) after the user confirms
   *  the "can't be paid in full" prompt — the row stays at its current status, since the
   *  invoice ends up partially, not fully, paid. */
  const handleConfirmPartialFinalize = React.useCallback(async () => {
    if (!partialFinalizeContext || isConfirmingPartialFinalize) return;
    const { row, amount, credits, sessionId } = partialFinalizeContext;
    setIsConfirmingPartialFinalize(true);
    try {
      if (amount <= 0.005) {
        toast({ title: t('toasts.noCreditToApply') });
      } else {
        await postCreditAllocation({ userId, patientName, patientEmail, operator, row, amount, credits, sessionId });
        toast({ title: t('toasts.itemPartiallyFinalized') });
        await load(true);
      }
      setPartialFinalizeContext(null);
    } catch (e: any) {
      toast({ title: e?.message || t('toasts.itemFinalizeError'), variant: 'destructive' });
    } finally {
      setIsConfirmingPartialFinalize(false);
    }
  }, [partialFinalizeContext, isConfirmingPartialFinalize, userId, patientName, patientEmail, operator, load, t, toast]);

  /** Finalizado → En curso: undoes every payment transaction applied to this invoice,
   *  returning their amounts to the patient's credit pool and the invoice to unpaid. */
  const handleUnmarkFinalized = React.useCallback(async (row: LedgerRow) => {
    if (!row.invoiceId || isUnmarkingFinalized) return;
    setIsUnmarkingFinalized(true);
    try {
      const payments = (ledgerData?.payments || []).filter((p) => p.invoice_id === row.invoiceId);
      if (payments.length === 0) throw new Error(t('toasts.noPaymentsToUndo'));
      for (const p of payments) {
        const res = await api.post(API_ROUTES.SALES.PAYMENT_UNDO, {}, undefined, {
          transaction_id: p.id,
          transaction_type: p.transaction_type,
        });
        if (Array.isArray(res) && res[0]?.code >= 400) throw new Error(res[0]?.message);
      }
      toast({ title: t('toasts.itemUnfinalized') });
      await load(true);
    } catch (e: any) {
      toast({ title: e?.message || t('toasts.itemUnfinalizeError'), variant: 'destructive' });
    } finally {
      setIsUnmarkingFinalized(false);
    }
  }, [ledgerData, load, t, toast, isUnmarkingFinalized]);

  const [confirmAction, setConfirmAction] = React.useState<{ row: LedgerRow; type: 'quote' | 'payment' | 'creditNote' | 'revertInvoice' | 'deleteInvoice' | 'deleteInvoiceAndQuote' } | null>(null);

  /** Status control's "Presupuesto" option — only reachable for a quote-backed invoice
   *  (revert it back to its still-alive, unbilled quote via INVOICE_UNDO). */
  const handleRevertInvoice = React.useCallback((row: LedgerRow) => {
    setConfirmAction({ row, type: 'revertInvoice' });
  }, []);

  /** The "…" menu's "Eliminar" — for any billed document (En curso or Finalizado),
   *  regardless of whether it has a quote behind it. A standalone invoice is simply
   *  deleted (INVOICE_UNDO); a quote-backed one is deleted along with its quote, since
   *  deleting here means the whole document is gone, not reverted to a live presupuesto. */
  const handleDeleteInvoice = React.useCallback((row: LedgerRow) => {
    setConfirmAction({ row, type: row.quoteId ? 'deleteInvoiceAndQuote' : 'deleteInvoice' });
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
    if (type === 'revertInvoice' || type === 'deleteInvoice') {
      if (!row.invoiceId || isRevertingInvoice) return;
      setIsRevertingInvoice(true);
      try {
        const res = await api.post(API_ROUTES.SALES.INVOICE_UNDO, {}, undefined, { invoice_id: row.invoiceId });
        if (Array.isArray(res) && res[0]?.code >= 400) throw new Error(res[0]?.message);
        toast({ title: t(type === 'deleteInvoice' ? 'toasts.invoiceDeleted' : 'toasts.invoiceReverted') });
        setConfirmAction(null);
        await load(true);
      } catch (e: any) {
        toast({ title: e?.message || t(type === 'deleteInvoice' ? 'toasts.invoiceDeleteError' : 'toasts.invoiceRevertError'), variant: 'destructive' });
      } finally {
        setIsRevertingInvoice(false);
      }
    } else if (type === 'deleteInvoiceAndQuote') {
      // Deleting a quote-backed document entirely: revert the invoice back to its quote
      // first (INVOICE_UNDO), then delete that now-unbilled quote (QUOTE_UNDO) — same two
      // primitives the app already exposes separately, just chained into one action.
      if (!row.invoiceId || !row.quoteId || isRevertingInvoice) return;
      setIsRevertingInvoice(true);
      try {
        const revertRes = await api.post(API_ROUTES.SALES.INVOICE_UNDO, {}, undefined, { invoice_id: row.invoiceId });
        if (Array.isArray(revertRes) && revertRes[0]?.code >= 400) throw new Error(revertRes[0]?.message);
        const deleteRes = await api.post(API_ROUTES.SALES.QUOTE_UNDO, {}, undefined, { quote_id: row.quoteId });
        if (Array.isArray(deleteRes) && deleteRes[0]?.code >= 400) throw new Error(deleteRes[0]?.message);
        toast({ title: t('toasts.invoiceDeleted') });
        setConfirmAction(null);
        await load(true);
      } catch (e: any) {
        toast({ title: e?.message || t('toasts.invoiceDeleteError'), variant: 'destructive' });
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

  const renderStatusCell = React.useCallback((row: LedgerRow) => {
    if (row.kind === 'payment') {
      return <Badge variant="info">{t('status.pago')}</Badge>;
    }
    if (row.status === 'notaCredito') {
      return <Badge variant={STATUS_VARIANT.notaCredito}>{t('status.notaCredito')}</Badge>;
    }
    if (!row.status) return null;
    return (
      <LedgerRowStatusControl
        row={row}
        canSetEnCurso={canConfirmQuote}
        canSetFinalizado={canCreatePaymentPerm}
        canRevertToEnCurso={canDeletePayment}
        canRevertToPresupuesto={canRevertInvoice}
        busy={isMarkingEnCurso || isMarkingFinalized || isConfirmingPartialFinalize || isUnmarkingFinalized || isRevertingInvoice}
        onSetEnCurso={handleMarkEnCurso}
        onSetFinalizado={handleMarkFinalized}
        onRevertToEnCurso={handleUnmarkFinalized}
        onRevertToPresupuesto={handleRevertInvoice}
        t={t}
      />
    );
  }, [t, canConfirmQuote, canCreatePaymentPerm, canDeletePayment, canRevertInvoice, isMarkingEnCurso, isMarkingFinalized, isConfirmingPartialFinalize, isUnmarkingFinalized, isRevertingInvoice, handleMarkEnCurso, handleMarkFinalized, handleUnmarkFinalized, handleRevertInvoice]);

  const renderActionsCell = React.useCallback((row: LedgerRow) => (
    <RowActionsMenu
      row={row}
      canEdit={canEditItem}
      canInvoice={canInvoiceQuote}
      canCreateCreditNote={canCreateCreditNote}
      canDeleteQuote={canDeleteQuote}
      canDeletePayment={canDeletePayment}
      canDeleteCreditNote={canDeleteCreditNote}
      canDeleteInvoice={canRevertInvoice}
      getMaxCreditable={getMaxCreditableForInvoice}
      onEdit={handleEdit}
      onInvoice={handleInvoice}
      onCreditNote={handleCreditNote}
      onDeleteQuote={handleDeleteQuote}
      onDeletePayment={handleDeletePayment}
      onDeleteCreditNote={handleDeleteCreditNote}
      onDeleteInvoice={handleDeleteInvoice}
      t={t}
    />
  ), [canEditItem, canInvoiceQuote, canCreateCreditNote, canDeleteQuote, canDeletePayment, canDeleteCreditNote, canRevertInvoice, getMaxCreditableForInvoice, handleEdit, handleInvoice, handleCreditNote, handleDeleteQuote, handleDeletePayment, handleDeleteCreditNote, handleDeleteInvoice, t]);

  const [searchTerm, setSearchTerm] = React.useState('');
  const filteredRows = React.useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => row.label.toLowerCase().includes(term) || (row.docNo || '').toLowerCase().includes(term));
  }, [rows, searchTerm]);

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={t('search')}
          className="h-8 w-48 pl-8 text-xs"
        />
      </div>
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
      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 ml-auto" onClick={handleManualRefresh}>
        <RefreshCw className="h-3.5 w-3.5" />
      </Button>
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
        <CardContent className="flex-1 flex flex-col min-h-0 gap-3 p-4">
          {toolbar}

          {/* Both axes scroll on this one container so the sticky header stays column-
              aligned with the cards when the panel is too narrow to fit every column —
              Tailwind's `sm:` breakpoints track viewport width, not this (often-narrower)
              panel's own width, so they can't be relied on here; a horizontal scrollbar
              is more reliable than trying to squeeze/wrap the columns at any width. */}
          <div className="min-h-0 flex-1 overflow-auto">
            <div className="w-full min-w-max">
              <div className="sticky top-0 z-10 flex items-center gap-3 bg-card px-3 py-2 text-xs font-medium text-muted-foreground">
                <div className="w-20 shrink-0">{t('columns.date')}</div>
                <div className="min-w-[10rem] flex-1">{t('columns.treatment')}</div>
                <div className="w-32 shrink-0 text-center">{t('columns.status')}</div>
                <div className="w-20 shrink-0 text-right">{t('columns.debit')}</div>
                <div className="w-20 shrink-0 text-right">{t('columns.credit')}</div>
                <div className="w-24 shrink-0 text-right">{t('columns.balance')}</div>
                <div className="w-8 shrink-0" />
              </div>

              {filteredRows.length === 0 ? (
                <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">{t('empty')}</div>
              ) : (
                <div className="space-y-2 py-1">
                  {filteredRows.map((row) => (
                    <div
                      key={row.id}
                      className={cn('flex items-center gap-3 rounded-lg border px-3 py-2.5', cardAccentClass(row))}
                    >
                      <div className="w-20 shrink-0 whitespace-nowrap text-sm text-muted-foreground">
                        {formatDisplayDate(row.date)}
                      </div>
                      <div className="flex min-w-[10rem] flex-1 items-center gap-2">
                        <RowKindIcon row={row} />
                        {row.status === 'presupuestado' && <PresupuestoBadge />}
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate text-sm font-medium">{row.label}</span>
                          {row.docNo && <span className="truncate text-xs text-muted-foreground">#{row.docNo}</span>}
                        </div>
                      </div>
                      <div className="flex w-32 shrink-0 justify-center">{renderStatusCell(row)}</div>
                      <div className="w-20 shrink-0 text-right text-sm tabular-nums">{fmtAmount(row.debe, row.currency)}</div>
                      <div className="w-20 shrink-0 text-right text-sm tabular-nums">{fmtAmount(row.haber, row.currency)}</div>
                      <div className="w-24 shrink-0 text-right text-sm font-semibold tabular-nums">{fmtAmount(row.runningBalance, row.currency)}</div>
                      <div className="w-8 shrink-0">{renderActionsCell(row)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-2 border-t px-1 pt-3">
            <span className="text-sm font-medium text-muted-foreground">{t('finalBalance')}</span>
            <span className="text-lg font-semibold tabular-nums">
              {fmtAmount(rows.length > 0 ? rows[rows.length - 1].runningBalance : 0, currency || 'USD')}
            </span>
          </div>
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
              {confirmAction?.type === 'deleteInvoice' && t('dialogs.deleteInvoice.title')}
              {confirmAction?.type === 'deleteInvoiceAndQuote' && t('dialogs.deleteInvoiceAndQuote.title')}
            </DialogTitle>
          </DialogHeader>
          <DialogBody className="px-6 py-4">
            <p className="text-sm text-muted-foreground">
              {confirmAction?.type === 'quote' && t('dialogs.deleteQuote.description')}
              {confirmAction?.type === 'payment' && t('dialogs.deletePayment.description')}
              {confirmAction?.type === 'creditNote' && t('dialogs.deleteCreditNote.description')}
              {confirmAction?.type === 'revertInvoice' && t('dialogs.revertInvoice.description')}
              {confirmAction?.type === 'deleteInvoice' && t('dialogs.deleteInvoice.description')}
              {confirmAction?.type === 'deleteInvoiceAndQuote' && t('dialogs.deleteInvoiceAndQuote.description')}
            </p>
          </DialogBody>
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

      <Dialog open={!!partialFinalizeContext} onOpenChange={(open) => { if (!open && !isConfirmingPartialFinalize) setPartialFinalizeContext(null); }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{t('dialogs.partialFinalize.title')}</DialogTitle>
          </DialogHeader>
          <DialogBody className="px-6 py-4">
            <p className="text-sm text-muted-foreground">{t('dialogs.partialFinalize.description')}</p>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPartialFinalizeContext(null)} disabled={isConfirmingPartialFinalize}>
              {t('dialogs.partialFinalize.cancel')}
            </Button>
            <Button onClick={handleConfirmPartialFinalize} disabled={isConfirmingPartialFinalize}>
              {isConfirmingPartialFinalize && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('dialogs.partialFinalize.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
