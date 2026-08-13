'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { addMonths, endOfMonth, format, parseISO, startOfMonth } from 'date-fns';
import { Banknote, Calendar, CalendarClock, Check, ChevronDown, CreditCard, FileMinus, FileText, Hash, History, Link2, ListChecks, Loader2, Pencil, Plus, Printer, Receipt, RefreshCw, ScrollText, Search, Stethoscope, StickyNote, Trash2, UserRound, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { DateRange } from 'react-day-picker';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogBody, DialogCancelButton, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DatePickerInput } from '@/components/ui/date-picker';
import { DoctorSelector } from '@/components/ui/doctor-selector';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { FormattedNumberInput } from '@/components/ui/formatted-number-input';
import { Input } from '@/components/ui/input';
import { ServiceSelector } from '@/components/ui/service-selector';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DateRangePresets } from '@/components/reports/date-range-presets';
import { QuoteBillingDialog } from '@/components/sales/quotes/quote-billing-dialog';
import { SALES_PERMISSIONS } from '@/constants/permissions';
import { API_ROUTES } from '@/constants/routes';
import { useAuth } from '@/context/AuthContext';
import { useCashSessionValidation } from '@/hooks/use-cash-session-validation';
import { useClinicInfo } from '@/hooks/useClinicInfo';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { buildPatientLedger, splitLedgerByRange, type LedgerRow, type LedgerRowStatus } from '@/lib/patient-ledger';
import type { Invoice, InvoiceItem, Payment, PaymentMethod, Quote, QuoteItem } from '@/lib/types';
import { cn, formatDisplayDate, preserveTimeIfToday, toLocalISOString } from '@/lib/utils';
import { api } from '@/services/api';
import { fetchPatientLedgerData, type PatientLedgerData } from '@/services/patient-ledger-data';

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
  /** Kept for API compatibility with the tabs finance view; the unified ledger now
   *  creates documents inline from its floating action bar, so these are unused here. */
  onCreateQuote?: () => void;
  onCreateTreatment?: () => void;
  onCreatePayment?: () => void;
  /** Receives the on-screen snapshot (see `VisibleLedger`) so the host prints exactly the
   *  period being shown. It's optional because the tabs finance view has no ledger to
   *  snapshot — there the host gets `undefined` and prints the full statement. */
  onPrintSummary?: (visible?: VisibleLedger) => void;
  onViewStatement?: () => void;
  /** When true, the internal toolbar hides its Print/Refresh icons — used by the
   *  account-statement sheet, which surfaces them in its own header instead. */
  hideToolbarActions?: boolean;
  /** Controlled search term. When provided, the ledger filters by it and hides its own
   *  in-toolbar search box (the host renders the search UI itself, e.g. in a header). */
  searchTerm?: string;
  /** Controlled period filter. When `onDateRangeChange` is provided the ledger becomes
   *  controlled: it filters by `dateRange` and hides its own in-toolbar picker (the host
   *  renders the `DateRangePresets` itself, e.g. in a header). */
  dateRange?: DateRange | undefined;
  onDateRangeChange?: (range: DateRange | undefined) => void;
}

/** What's currently on screen — active date range + the per-currency rows exactly as
 *  displayed (opening-balance row included) — so a host can print a WYSIWYG copy
 *  instead of re-fetching and re-building the whole (unfiltered) ledger itself. */
export interface VisibleLedger {
  dateRange: DateRange | undefined;
  rowsByCurrency: Record<string, LedgerRow[]>;
}

/** Imperative handle so hosts (e.g. the account-statement sheet header) can trigger a
 *  reload without owning the ledger's data-loading state. */
export interface PatientLedgerHandle {
  refresh: () => void;
  getVisibleLedger: () => VisibleLedger;
}

/** Short currency symbol shown in the amount columns: "$" for UYU, "U$" for USD. */
function currencySymbol(currency: string): string {
  if (currency === 'UYU') return '$';
  if (currency === 'USD') return 'U$';
  return currency;
}

/** Always two decimals (e.g. 25 → "25,00", 25.5 → "25,50"), thousands-separated. */
function fmtNumber2(amount: number): string {
  return (amount || 0).toLocaleString('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Always renders a number — including "<symbol>0,00" for a zero amount — so balances and
 *  Debe/Haber cells never show a dash. */
function fmtAmountZero(amount: number, currency: string) {
  return `${currencySymbol(currency)}${fmtNumber2(amount)}`;
}

const STATUS_VARIANT: Record<LedgerRowStatus, 'secondary' | 'outline' | 'warning' | 'success' | 'destructive'> = {
  presupuestado: 'outline',
  facturado: 'secondary',
  parcial: 'warning',
  pagado: 'success',
  notaCredito: 'warning',
};

function RowKindIcon({ row }: { row: LedgerRow }) {
  if (row.kind === 'balance') {
    return <History className="h-4 w-4 shrink-0 text-muted-foreground" />;
  }
  if (row.kind === 'payment') {
    return <Banknote className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />;
  }
  if (row.status === 'notaCredito') {
    return <FileMinus className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />;
  }
  // Presupuesto icon for both unbilled presupuestos and invoices billed from a quote
  // (they carry `quoteDocNo`); standalone treatments (direct invoices) keep the receipt.
  if (row.status === 'presupuestado' || row.quoteDocNo) {
    return <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />;
  }
  return <Receipt className="h-4 w-4 shrink-0 text-foreground/70" />;
}

/**
 * The document-number line under a row's title. Quote-backed invoices show both the
 * originating presupuesto and the invoice ("Presupuesto: … | Factura: …"); everything
 * else shows its own single document number, labelled by kind.
 */
function docNumbersLabel(row: LedgerRow, t: (key: string) => string): string | null {
  if (row.kind === 'balance') return null;
  if (row.kind === 'payment') return row.docNo ? `${t('docLine.payment')}: ${row.docNo}` : null;
  if (row.status === 'notaCredito') return row.docNo ? `${t('docLine.creditNote')}: ${row.docNo}` : null;
  if (row.status === 'presupuestado') return row.docNo ? `${t('docLine.quote')}: ${row.docNo}` : null;
  if (row.quoteDocNo) return `${t('docLine.quote')}: ${row.quoteDocNo} | ${t('docLine.treatment')}: ${row.docNo || '—'}`;
  return row.docNo ? `${t('docLine.treatment')}: ${row.docNo}` : null;
}

/**
 * Odontosys-style color coding for the ledger cards: green for payments, red (+ a "P"
 * badge) for unbilled presupuestos, light amber for credit notes.
 */
function cardAccentClass(row: LedgerRow): string {
  if (row.kind === 'balance') {
    return 'bg-slate-100 border-slate-300 dark:bg-slate-900/40 dark:border-slate-700/60';
  }
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

/** Whether a row originated from a presupuesto — either an unbilled quote line, or an
 *  invoice billed from a quote (it carries `quoteDocNo`). Standalone treatments/invoices
 *  with no `quote_doc_no` are not "from a quote". */
function isFromQuote(row: LedgerRow): boolean {
  return row.status === 'presupuestado' || !!row.quoteDocNo || !!row.quoteId;
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

/** Shared badge shape for every status pill so they're the same size whether or not the
 *  row has a state-change dropdown (payments/credit notes don't). */
const STATUS_BADGE_CLASS = 'flex h-6 w-full items-center justify-center gap-1 px-1.5 text-[10px]';

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
  const fromQuote = isFromQuote(row);
  const options: { key: LedgerItemState; enabled: boolean; onSelect: () => void }[] = [
    // A standalone treatment/invoice (no quote_doc_no) never offers "Presupuesto" — it
    // wasn't born from one, so it can't revert to one.
    ...(fromQuote ? [{
      key: 'presupuesto' as const,
      enabled: current === 'enCurso' && !!row.quoteId && canRevertToPresupuesto,
      onSelect: () => onRevertToPresupuesto(row),
    }] : []),
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
    <div className="w-full" onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Badge
            variant={STATUS_CONTROL_VARIANT[current]}
            className={cn(STATUS_BADGE_CLASS, 'cursor-pointer select-none', busy && 'pointer-events-none opacity-60')}
          >
            {t(`statusControl.${current}`)}
            <ChevronDown className="h-3 w-3 shrink-0 opacity-70" />
          </Badge>
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

const creditNoteSchema = z.object({
  quantity: z.coerce.number().int().min(1),
  unit_price: z.coerce.number().min(0),
  notes: z.string().optional(),
});
type CreditNoteFormValues = z.infer<typeof creditNoteSchema>;

const INVOICEABLE_QUOTE_STATUSES = ['accepted', 'confirmed'];
const CONFIRMABLE_QUOTE_STATUSES = ['draft', 'pending', 'sent'];

async function getPaymentMethods(): Promise<PaymentMethod[]> {
  try {
    const data = await api.get(API_ROUTES.CASHIER.PAYMENT_METHODS);
    const methodsData = Array.isArray(data) ? data : (data.payment_methods || data.data || []);
    return methodsData.map((m: any) => ({ ...m, id: String(m.id) }));
  } catch {
    return [];
  }
}

// ── Payment ↔ invoice allocation lookups ────────────────────────────────────
// Powers the small "linked documents" popover on payment/invoice rows: which
// treatments a payment covered, or which payment(s) covered a treatment.

/** One line in the allocations popover — deliberately thin, just enough to show and
 *  cross-reference against `LedgerRow.docNo` for the on-screen highlight. */
type LiteAllocation = {
  key: string;
  docNo: string;
  amount: number;
  currency: string;
  date: string;
};

/** For a payment: every invoice/treatment it was applied to, and how much. */
async function fetchPaymentAllocations(paymentId: string): Promise<LiteAllocation[]> {
  try {
    const data = await api.get(API_ROUTES.SALES.PAYMENT_ALLOCATIONS, { payment_id: paymentId });
    const raw: any[] = Array.isArray(data) ? data : (data.allocations || data.data || []);
    return raw
      .filter((a) => a && a.allocation_id != null)
      .map((a) => ({
        key: String(a.allocation_id),
        docNo: a.factura_doc_no || '',
        amount: Math.abs(parseFloat(a.monto_aplicado_a_factura || '0')),
        currency: a.moneda_allocation || a.moneda_factura || '',
        date: a.fecha_aplicacion || '',
      }));
  } catch {
    return [];
  }
}

/** For an invoice/treatment: every payment applied to it, and how much. */
async function fetchInvoicePaymentsList(invoiceId: string): Promise<LiteAllocation[]> {
  try {
    const data = await api.get(API_ROUTES.SALES.INVOICE_PAYMENTS, { invoice_id: invoiceId, is_sales: 'true' });
    const raw: any[] = Array.isArray(data) ? data : (data.payments || data.data || []);
    return raw
      // Empty responses come back as `[{ success: true }]`; skip those ack objects.
      .filter((p) =>
        p && typeof p === 'object' && p.status !== 'failed' &&
        (p.id != null || p.amount_applied != null || p.amount != null || p.doc_no || p.payment_doc_no)
      )
      .map((p) => ({
        key: String(p.transaction_id || p.id || `${invoiceId}-${p.payment_date || Math.random()}`),
        docNo: p.doc_no || String(p.transaction_doc_no || ''),
        amount: Math.abs(parseFloat(p.amount_applied ?? p.amount ?? '0')),
        currency: p.source_currency || p.invoice_currency || '',
        date: p.payment_date || p.created_at || '',
      }));
  } catch {
    return [];
  }
}

/**
 * Small "linked documents" icon shown on payment rows (which treatments it paid) and on
 * billed treatment rows (which payment(s) covered it). Fetches lazily on first open and
 * caches per-row for the component's lifetime; while open, tells the parent which doc
 * numbers to highlight elsewhere in the visible ledger.
 */
function RowAllocationsPopover({
  row,
  invoiceDocNoById,
  serviceLabelByDocNo,
  onHighlight,
}: {
  row: LedgerRow;
  /** `invoiceId -> doc_no` lookup, needed to label the payment's own directly-linked invoice
   *  (it isn't returned by `PAYMENT_ALLOCATIONS`, see below). */
  invoiceDocNoById: Map<string, string>;
  /** `doc_no -> service name(s)` lookup — on a payment row, the popover lists what was paid
   *  for (service name), not the invoice's document number. */
  serviceLabelByDocNo: Map<string, string>;
  onHighlight: (docNos: Set<string> | null) => void;
}) {
  const t = useTranslations('PatientLedger');
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const cacheRef = React.useRef<LiteAllocation[] | null>(null);
  const [items, setItems] = React.useState<LiteAllocation[] | null>(null);

  const handleOpenChange = async (next: boolean) => {
    setOpen(next);
    if (!next) {
      onHighlight(null);
      return;
    }
    if (cacheRef.current) {
      setItems(cacheRef.current);
      onHighlight(new Set(cacheRef.current.map((a) => a.docNo).filter(Boolean)));
      return;
    }
    setLoading(true);
    let data: LiteAllocation[];
    if (row.kind === 'payment') {
      // `PAYMENT_ALLOCATIONS` only returns the *extra* invoices a split payment was spread
      // onto (via `invoice_allocations` at creation time) — the payment's own directly-paid
      // invoice (`row.invoiceId`, every row here being a `direct_payment`) never shows up
      // there, so it has to be prepended from the row itself.
      const extra = await fetchPaymentAllocations(row.paymentId!);
      const direct: LiteAllocation[] = row.invoiceId
        ? [{
          key: `direct-${row.invoiceId}`,
          docNo: invoiceDocNoById.get(row.invoiceId) || '',
          amount: row.haber,
          currency: row.currency,
          date: row.date,
        }]
        : [];
      data = [...direct, ...extra];
    } else {
      data = await fetchInvoicePaymentsList(row.invoiceId!);
    }
    cacheRef.current = data;
    setItems(data);
    setLoading(false);
    onHighlight(new Set(data.map((a) => a.docNo).filter(Boolean)));
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          title={t(row.kind === 'payment' ? 'allocationsPopover.paidTreatments' : 'allocationsPopover.paidBy')}
          className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Link2 className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2.5" align="start" onClick={(e) => e.stopPropagation()}>
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">
          {t(row.kind === 'payment' ? 'allocationsPopover.paidTreatments' : 'allocationsPopover.paidBy')}
        </p>
        {loading ? (
          <div className="flex items-center gap-2 py-1 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />{t('allocationsPopover.loading')}
          </div>
        ) : !items || items.length === 0 ? (
          <p className="py-1 text-xs text-muted-foreground">{t('allocationsPopover.empty')}</p>
        ) : (
          <div className="space-y-1">
            {items.map((a) => (
              <div key={a.key} className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate">
                  {row.kind === 'payment' ? (a.docNo && serviceLabelByDocNo.get(a.docNo)) || `#${a.docNo || '—'}` : `#${a.docNo || '—'}`}
                </span>
                <span className="shrink-0 tabular-nums font-medium">{fmtAmountZero(a.amount, a.currency)}</span>
              </div>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ── Inline editor primitives ──────────────────────────────────────────────────

/** Green confirm (submit) + red circular cancel — shared by every inline editor. */
function EditorControls({ submitting, onCancel, disabled }: { submitting: boolean; onCancel: () => void; disabled?: boolean }) {
  const t = useTranslations('PatientLedger');
  return (
    <>
      <Button
        type="submit"
        size="icon"
        disabled={submitting || disabled}
        title={t('inline.confirm')}
        className="h-7 w-7 rounded-full bg-emerald-600 text-white hover:bg-emerald-700"
      >
        {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
      </Button>
      <Button
        type="button"
        size="icon"
        variant="outline"
        disabled={submitting}
        onClick={onCancel}
        title={t('inline.cancel')}
        className="h-7 w-7 rounded-full border-red-400 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </>
  );
}

/** Small leading icon that keeps an inline-editor field identifiable even after a chosen
 *  value replaces its placeholder. The wrapped control must leave room for it — add
 *  `pl-7` to that control's own className. */
function FieldIcon({ icon: Icon, children, className }: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('relative', className)}>
      <Icon className="pointer-events-none absolute left-2 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      {children}
    </div>
  );
}

/** Tooth glyph for the "Pieza" field — lucide-react has no dental icon. */
function ToothIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M12 5.5c-1.5-1.6-3.3-2.3-5-2C4.6 4 3.3 6.2 3.6 9c.2 1.6.7 2.6 1 4 .4 1.7.3 3.6.9 5.3.3.8.8 1.7 1.6 1.7 1.2 0 1.3-2.2 1.6-3.6.3-1.4.6-2.7 1.7-2.7s1.4 1.3 1.7 2.7c.3 1.4.4 3.6 1.6 3.6.8 0 1.3-.9 1.6-1.7.6-1.7.5-3.6.9-5.3.3-1.4.8-2.4 1-4 .3-2.8-1-5-3.4-5.5-1.7-.3-3.5.4-5 2Z" />
    </svg>
  );
}

/**
 * Combined currency + amount control. Collapsed, it reads as just the currency symbol
 * ($ / U$) next to the amount, so the row stays compact. Clicking it expands an inline
 * currency selector beside the amount input, where there's room to change either; it
 * collapses again once focus/click moves elsewhere. When `currencyLocked` (edit mode, or
 * a credit note bound to one currency) the selector never shows — only the amount edits.
 */
function CurrencyAmountInput({ amount, currency, onAmountChange, onCurrencyChange, currencyLocked, placeholder, ariaLabel, className }: {
  amount: number;
  currency: 'UYU' | 'USD';
  onAmountChange: (v: number) => void;
  onCurrencyChange?: (c: 'UYU' | 'USD') => void;
  currencyLocked?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      {currencyLocked || !onCurrencyChange ? (
        <span className="flex h-8 shrink-0 items-center px-1 text-xs font-medium text-muted-foreground">{currencySymbol(currency)}</span>
      ) : (
        <Select value={currency} onValueChange={(v) => onCurrencyChange(v as 'UYU' | 'USD')}>
          <SelectTrigger className="h-8 w-[5.5rem] shrink-0 px-2 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="UYU">$ UYU</SelectItem>
            <SelectItem value="USD">U$ USD</SelectItem>
          </SelectContent>
        </Select>
      )}
      <FormattedNumberInput
        value={amount}
        onChange={onAmountChange}
        placeholder={placeholder || '0.00'}
        className="h-8 min-w-[5.5rem] flex-1 text-right text-sm"
        aria-label={ariaLabel}
      />
    </div>
  );
}

/**
 * Inline-editor frame: a highlighted card whose header states the action ("Nuevo/Editar
 * <tipo>") with the save/cancel controls pinned top-right, and the fields laid out on up
 * to two wrapping lines below. `flex-wrap` keeps every field readable at any width
 * instead of clipping or overflowing the ledger columns.
 */
function InlineEditorShell({ title, controls, line1, line2, belowSlot }: {
  title: React.ReactNode;
  controls: React.ReactNode;
  line1: React.ReactNode;
  line2?: React.ReactNode;
  /** Optional full-width area rendered below both lines (e.g. the payment allocations). */
  belowSlot?: React.ReactNode;
}) {
  return (
    <div className="relative rounded-lg border border-primary/50 bg-primary/5 px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
      {/* Header: "Nuevo/Editar <tipo>" on the left, sticky save/cancel top-right. */}
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-primary">{title}</span>
        <div className="flex shrink-0 items-center gap-1">{controls}</div>
      </div>
      <div className="flex flex-wrap items-center gap-2">{line1}</div>
      {line2 && <div className="mt-2 flex flex-wrap items-center gap-2">{line2}</div>}
      {belowSlot}
    </div>
  );
}

const quoteEditorSchema = z.object({
  created_at: z.date(),
  due_date: z.date().optional(),
  currency: z.enum(['UYU', 'USD']),
  service_id: z.string().min(1),
  service_name: z.string().optional(),
  tooth_number: z.string().optional(),
  quantity: z.coerce.number().int().min(1),
  unit_price: z.coerce.number().min(0),
  doctor_id: z.string().optional(),
  description: z.string().optional(),
});
type QuoteEditorValues = z.infer<typeof quoteEditorSchema>;

/**
 * Inline create/edit editor for a Presupuesto (`quote`) or Tratamiento (`invoice`) line.
 * Enables the Debe editor; Haber is disabled. In edit mode (`editRow` set) which underlying
 * document gets updated depends on the row itself, not the `doc` prop:
 * - An unbilled presupuesto (`editRow.status === 'presupuestado'`) upserts the line via
 *   `QUOTES_LINES_UPSERT` (by id, matching `quote/lines/upsert`'s own contract — it
 *   recalculates the quote's total itself). That endpoint only touches `quote_items`, not
 *   the quote's own doctor/notes, so those are saved separately via a `QUOTES_UPSERT` patch
 *   run *before* the line upsert — carrying over the quote's other required fields unchanged
 *   plus every sibling item as-is (the backend needs `items` present to process the request
 *   at all; the edited line's own new values are applied right after by the line upsert, so
 *   it always has the last word on that line and on the recalculated total).
 * - A billed treatment with no payments yet (`facturado`) re-sends the whole invoice via
 *   `INVOICES_UPSERT` by id, passing every sibling item so nothing is lost — this preserves
 *   item ids for anything not being edited, and the invoice's date/doctor/notes are real
 *   fields on that same call, so they stay editable here.
 * - A billed treatment that already has payments and/or credit-note allocations against it
 *   (`parcial`/`pagado`) upserts just this one line via `INVOICE_ITEMS_EDIT_WITH_REALLOCATION`
 *   instead — changing the total there would otherwise leave those allocations pointing at
 *   an amount that no longer exists, so the backend releases them and re-applies as much as
 *   still fits (FIFO), before recalculating the invoice's total. That endpoint only touches
 *   the one line, so date/doctor/notes aren't offered here (no document-level fields to send).
 */
function QuoteInvoiceInlineEditor({ doc, editRow, editInvoice, editQuote, editItems, userId, currency, onCancel, onSaved }: {
  doc: 'quote' | 'invoice';
  editRow?: LedgerRow;
  /** The full invoice behind `editRow` — only set when editing a billed treatment. Its
   *  date/doctor/notes are only editable here for an unpaid (`facturado`) invoice, where
   *  they're real fields on `INVOICES_UPSERT`; an already-paid invoice edits through a
   *  line-only endpoint with no equivalent document-level fields. */
  editInvoice?: Invoice;
  /** The full quote behind `editRow` — only set when editing an unbilled presupuesto line.
   *  Supplies doctor/notes prefill and the other required fields (`total`, `status`, etc.)
   *  that must be carried over unchanged on the `QUOTES_UPSERT` doctor/notes patch. */
  editQuote?: Quote;
  /** Every sibling item of the quote/invoice being edited. Only actually needed (all of
   *  them) for the whole-invoice resend path; the line-only edit paths just look up this
   *  one item in it for prefill (e.g. `tooth_number`, which isn't on `LedgerRow`). */
  editItems?: (QuoteItem | InvoiceItem)[];
  userId: string;
  currency: string;
  onCancel: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const t = useTranslations('PatientLedger');
  const { toast } = useToast();
  const isEdit = !!editRow;
  const editKind: 'quote' | 'invoice' | 'invoice-reallocate' = editRow?.status === 'presupuestado'
    ? 'quote'
    : (editRow?.status === 'parcial' || editRow?.status === 'pagado')
      ? 'invoice-reallocate'
      : 'invoice';
  // Date/doctor/notes are always shown and editable, regardless of payment status. For
  // an already-paid invoice reallocation edit, they're saved via a document-level
  // INVOICES_UPSERT patch (siblings unchanged, so the total doesn't move and existing
  // payment/credit-note allocations aren't touched) run *before* the line-only
  // reallocation call — mirroring the presupuesto pattern above. A presupuesto's date
  // stays read-only since `quote/lines/upsert` has no date field of its own.
  const isDateReadOnly = isEdit && editKind === 'quote';
  const [submitting, setSubmitting] = React.useState(false);
  const editItem = editItems?.find((i) => i.id === editRow?.itemId);
  const [doctorName, setDoctorName] = React.useState(editInvoice?.doctor_name || editQuote?.doctor_name || editRow?.doctorName || '');

  const form = useForm<QuoteEditorValues>({
    resolver: zodResolver(quoteEditorSchema),
    defaultValues: {
      created_at: editInvoice?.createdAt ? new Date(editInvoice.createdAt) : editRow?.date ? new Date(editRow.date) : new Date(),
      // New treatments default their due date to one month out; editing an existing one
      // just carries over whatever it already has (or nothing, if it never had one).
      due_date: editInvoice?.due_date
        ? new Date(editInvoice.due_date)
        : editRow?.dueDate
          ? new Date(editRow.dueDate)
          : (!isEdit && doc === 'invoice')
            ? addMonths(new Date(), 1)
            : undefined,
      currency: ((editInvoice?.currency || editQuote?.currency || editRow?.currency) as 'UYU' | 'USD' | undefined) || (currency as 'UYU' | 'USD'),
      service_id: editItem?.service_id || editRow?.serviceId || '',
      service_name: editItem?.service_name || editRow?.label || '',
      tooth_number: (editItem as QuoteItem | undefined)?.tooth_number != null ? String((editItem as QuoteItem).tooth_number) : '',
      quantity: editItem?.quantity || editRow?.quantity || 1,
      unit_price: editItem?.unit_price ?? editRow?.unitPrice ?? 0,
      doctor_id: editInvoice?.doctor_id || editQuote?.doctor_id || editRow?.doctorId || '',
      description: editInvoice?.notes || editQuote?.notes || editRow?.notes || '',
    },
  });
  const watchedName = form.watch('service_name');
  const createdAt = form.watch('created_at');
  const dueDate = form.watch('due_date');
  const selectedCurrency = form.watch('currency');

  const onSubmit = async (values: QuoteEditorValues) => {
    if (submitting) return;
    // Only a billed treatment (`doc === 'invoice'`) offers a due date at all — a
    // presupuesto has no invoice behind it yet, so `values.due_date` stays undefined there.
    if (values.due_date && values.due_date <= values.created_at) {
      toast({ title: t('errors.dueDateBeforeIssue'), variant: 'destructive' });
      return;
    }
    if (values.tooth_number && Number(values.tooth_number) < 0) {
      toast({ title: t('errors.negativeTooth'), variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const qty = values.quantity || 1;
      const tooth = values.tooth_number ? Number(values.tooth_number) : null;
      const createdAtIso = toLocalISOString(preserveTimeIfToday(values.created_at));
      const dueDateIso = values.due_date ? toLocalISOString(preserveTimeIfToday(values.due_date)) : undefined;
      if (isEdit && editKind === 'quote') {
        // doctor/notes live on the quote itself, not on quote_items — patched first via a
        // QUOTES_UPSERT by id, carrying over the quote's other required columns unchanged
        // (omitting them would null/blank them out server-side) *and* every sibling item
        // as-is (the backend requires `items` to complete the request at all; the edited
        // line's own new values are applied right after by the line upsert below, so it
        // always has the last word on that line and on the recalculated total).
        if (editQuote) {
          const siblingItems = (editItems || []).map((i) => ({
            id: i.id,
            service_id: i.service_id,
            quantity: i.quantity,
            unit_price: i.unit_price,
            total: i.total,
            tooth_number: (i as QuoteItem).tooth_number ?? null,
          }));
          const quoteRes = await api.post(API_ROUTES.SALES.QUOTES_UPSERT, {
            id: editQuote.id,
            user_id: editQuote.user_id,
            doctor_id: values.doctor_id || undefined,
            total: editQuote.total,
            currency: editQuote.currency,
            status: editQuote.status,
            payment_status: editQuote.payment_status,
            billing_status: editQuote.billing_status,
            exchange_rate: editQuote.exchange_rate ?? 1,
            created_at: editQuote.createdAt,
            notes: values.description || '',
            items: siblingItems,
            is_sales: true,
          });
          if (Array.isArray(quoteRes) && quoteRes[0]?.code >= 400) throw new Error(quoteRes[0]?.message);
        }
        // A single quote_items row, matched by id — `quote/lines/upsert` recalculates the
        // quote's own total itself, and doesn't touch (or need) the sibling items at all.
        const res = await api.post(API_ROUTES.SALES.QUOTES_LINES_UPSERT, {
          id: editRow!.itemId,
          quote_id: editRow!.quoteId,
          service_id: values.service_id,
          quantity: qty,
          unit_price: values.unit_price,
          total: qty * values.unit_price,
          tooth_number: tooth,
        });
        if (Array.isArray(res) && res[0]?.code >= 400) throw new Error(res[0]?.message);
        toast({ title: t('toasts.itemUpdated') });
      } else if (isEdit && editKind === 'invoice-reallocate') {
        // Document-level fields (date/doctor/notes) aren't accepted by the reallocation
        // endpoint below, so patch them first via INVOICES_UPSERT — same pattern as the
        // quote branch above: every sibling item is sent back unchanged (by id) so the
        // total doesn't move, which leaves the existing payment/credit-note allocations
        // untouched. The line's own quantity/price change is applied right after by the
        // reallocation call, which recalculates the total itself.
        if (editInvoice) {
          const siblingItems = (editItems || []).map((i) => ({
            id: i.id,
            service_id: i.service_id,
            quantity: i.quantity,
            unit_price: i.unit_price,
            total: i.total,
            tooth_number: (i as QuoteItem).tooth_number ?? null,
          }));
          const invoiceRes = await api.post(API_ROUTES.SALES.INVOICES_UPSERT, {
            id: editInvoice.id,
            user_id: editInvoice.user_id,
            doctor_id: values.doctor_id || undefined,
            total: editInvoice.total,
            currency: editInvoice.currency,
            created_at: createdAtIso,
            due_date: dueDateIso,
            notes: values.description || '',
            is_historical: editInvoice.is_historical ?? false,
            items: siblingItems,
            type: 'invoice',
            is_sales: true,
          });
          if (Array.isArray(invoiceRes) && invoiceRes[0]?.code >= 400) throw new Error(invoiceRes[0]?.message);
        }
        // A single invoice_items row, matched by id — the backend releases whatever
        // payment_allocations/invoice_allocations already pointed at this invoice, edits
        // the line, recalculates the total, and re-applies as much of what was released as
        // still fits (FIFO), before responding with what didn't fit as `released_amount`.
        const res = await api.post(API_ROUTES.SALES.INVOICE_ITEMS_EDIT_WITH_REALLOCATION, {
          invoice_id: editRow!.invoiceId,
          item_id: editRow!.itemId,
          service_id: values.service_id,
          quantity: qty,
          unit_price: values.unit_price,
          total: qty * values.unit_price,
          tooth_number: tooth,
        });
        const result = Array.isArray(res) ? res[0] : res;
        if (result?.error || (typeof result?.code === 'number' && result.code >= 400)) {
          throw new Error(result?.message);
        }
        const released = Number(result?.released_amount) || 0;
        toast({
          title: t('toasts.itemUpdated'),
          description: released > 0.005 ? t('toasts.releasedCredit', { amount: fmtAmountZero(released, values.currency) }) : undefined,
        });
      } else if (isEdit) {
        // Re-send the whole invoice (all sibling items preserved by id), overriding the
        // edited line, so the invoice-level fields (date, doctor, notes) and the line
        // save together.
        const items = (editItems && editItems.length > 0 ? editItems : (editItem ? [editItem] : []))
          .map((i) => i.id === editRow!.itemId
            ? { id: i.id, service_id: values.service_id, quantity: qty, unit_price: values.unit_price, total: qty * values.unit_price, tooth_number: tooth }
            : { id: i.id, service_id: i.service_id, quantity: i.quantity, unit_price: i.unit_price, total: i.total, tooth_number: (i as QuoteItem).tooth_number ?? null });
        const total = items.reduce((sum, i) => sum + (i.total || 0), 0);
        const res = await api.post(API_ROUTES.SALES.INVOICES_UPSERT, {
          id: editRow!.invoiceId,
          user_id: userId,
          ...(values.doctor_id ? { doctor_id: values.doctor_id } : {}),
          total,
          currency: values.currency,
          created_at: createdAtIso,
          due_date: dueDateIso,
          notes: values.description || '',
          is_historical: editInvoice?.is_historical ?? false,
          items,
          type: 'invoice',
          is_sales: true,
        });
        if (Array.isArray(res) && res[0]?.code >= 400) throw new Error(res[0]?.message);
        toast({ title: t('toasts.itemUpdated') });
      } else {
        const item = {
          service_id: values.service_id,
          service_name: values.service_name,
          quantity: qty,
          unit_price: values.unit_price,
          total: qty * values.unit_price,
          tooth_number: tooth,
        };
        if (doc === 'quote') {
          const res = await api.post(API_ROUTES.SALES.QUOTES_UPSERT, {
            user_id: userId,
            doctor_id: values.doctor_id || undefined,
            total: qty * values.unit_price,
            currency: values.currency,
            status: 'draft',
            payment_status: 'unpaid',
            billing_status: 'not invoiced',
            exchange_rate: 1,
            created_at: createdAtIso,
            notes: values.description || '',
            patient_confirmed: false,
            items: [item],
            is_sales: true,
          });
          if (Array.isArray(res) && res[0]?.code >= 400) throw new Error(res[0]?.message);
          toast({ title: t('toasts.quoteCreated') });
        } else {
          const res = await api.post(API_ROUTES.SALES.INVOICES_UPSERT, {
            user_id: userId,
            doctor_id: values.doctor_id || undefined,
            total: qty * values.unit_price,
            currency: values.currency,
            created_at: createdAtIso,
            due_date: dueDateIso,
            notes: values.description || '',
            is_historical: false,
            items: [item],
            type: 'invoice',
            is_sales: true,
          });
          if (Array.isArray(res) && res[0]?.code >= 400) throw new Error(res[0]?.message);
          toast({ title: t('toasts.treatmentCreated') });
        }
      }
      await onSaved();
    } catch (e: any) {
      toast({ title: e?.message || t(isEdit ? 'toasts.itemUpdateError' : doc === 'quote' ? 'toasts.quoteCreateError' : 'toasts.treatmentCreateError'), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const editorTitle = `${t(isEdit ? 'inline.edit' : 'inline.new')} ${t(doc === 'quote' ? 'inline.addQuote' : 'inline.addTreatment')}`;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <InlineEditorShell
        title={editorTitle}
        controls={<EditorControls submitting={submitting} onCancel={onCancel} />}
        // Line 1: creation date · service · quantity · price+currency.
        line1={
          <>
            {isDateReadOnly ? (
              <FieldIcon icon={Calendar} className="w-36">
                <span className="flex h-8 items-center pl-7 text-xs text-muted-foreground">{formatDisplayDate(editRow!.date)}</span>
              </FieldIcon>
            ) : (
              <FieldIcon icon={Calendar} className="w-36">
                <DatePickerInput
                  value={format(createdAt, 'yyyy-MM-dd')}
                  onChange={(iso) => iso && form.setValue('created_at', parseISO(iso))}
                  className="h-8 pl-7 text-xs"
                />
              </FieldIcon>
            )}
            <FieldIcon icon={Stethoscope} className="min-w-[10rem] flex-1">
              <ServiceSelector
                isSales
                value={form.watch('service_id')}
                selectedServiceName={watchedName}
                onValueChange={(serviceId, service) => {
                  form.setValue('service_id', serviceId, { shouldValidate: true });
                  if (service) {
                    form.setValue('service_name', service.name);
                    form.setValue('unit_price', Number(service.price) || 0);
                    // Currency defaults to the service's own currency on a new line; on an
                    // existing one the currency is fixed, so leave it untouched.
                    if (!isEdit && service.currency) {
                      form.setValue('currency', service.currency, { shouldValidate: true });
                    }
                  }
                }}
                placeholder={t('fields.searchService')}
                triggerText={t('fields.selectService')}
                className="h-8 pl-7"
              />
            </FieldIcon>
            <FieldIcon icon={Hash} className="w-[5.5rem]">
              <Input
                type="number"
                min={1}
                placeholder={t('fields.quantity')}
                aria-label={t('fields.quantity')}
                className="h-8 pl-7 text-sm"
                {...form.register('quantity')}
              />
            </FieldIcon>
            {/* Single price+currency control: currency defaults to the service's and only
                surfaces its selector when the field is clicked to edit (edit mode keeps it
                fixed). */}
            <CurrencyAmountInput
              amount={form.watch('unit_price')}
              currency={selectedCurrency}
              onAmountChange={(v) => form.setValue('unit_price', v, { shouldValidate: true })}
              onCurrencyChange={(c) => form.setValue('currency', c, { shouldValidate: true })}
              currencyLocked={isEdit}
              ariaLabel={t('fields.price')}
              className="w-52"
            />
          </>
        }
        // Line 2: due date (billed treatments only) · doctor · notes · tooth.
        line2={
          <>
            {/* Due date only applies to a billed treatment — a presupuesto has no invoice
                behind it yet, so `doc === 'quote'` never renders this. */}
            {doc === 'invoice' && (
              <FieldIcon icon={CalendarClock} className="w-36">
                <DatePickerInput
                  value={dueDate ? format(dueDate, 'yyyy-MM-dd') : undefined}
                  onChange={(iso) => form.setValue('due_date', iso ? parseISO(iso) : undefined, { shouldValidate: true })}
                  disabledDays={(date) => date <= createdAt}
                  placeholder={t('fields.dueDate')}
                  className="h-8 pl-7 text-xs"
                />
              </FieldIcon>
            )}
            <FieldIcon icon={UserRound} className="min-w-[10rem] flex-1">
              <DoctorSelector
                value={form.watch('doctor_id')}
                selectedDoctorName={doctorName}
                onValueChange={(doctorId, doctor) => {
                  form.setValue('doctor_id', doctorId);
                  setDoctorName(doctor?.name || '');
                }}
                placeholder={t('fields.searchDoctor')}
                triggerText={t('fields.selectDoctor')}
                className="h-8 pl-7"
              />
            </FieldIcon>
            <FieldIcon icon={StickyNote} className="min-w-[10rem] flex-1">
              <Input
                placeholder={t('fields.notes')}
                aria-label={t('fields.notes')}
                className="h-8 pl-7 text-sm"
                {...form.register('description')}
              />
            </FieldIcon>
            <FieldIcon icon={ToothIcon} className="w-[6.5rem]">
              <Input
                type="number"
                min={0}
                placeholder={t('fields.tooth')}
                aria-label={t('fields.tooth')}
                className="h-8 pl-7 text-sm"
                {...form.register('tooth_number')}
              />
            </FieldIcon>
          </>
        }
      />
    </form>
  );
}

const paymentEditorSchema = z.object({
  created_at: z.date(),
  currency: z.enum(['UYU', 'USD']),
  payment_amount: z.coerce.number().positive(),
  payment_method_id: z.string().min(1),
  notes: z.string().optional(),
  is_historical: z.boolean().default(false),
});
type PaymentEditorValues = z.infer<typeof paymentEditorSchema>;

/** A patient invoice with an outstanding balance, offered as a payment allocation target. */
export type PendingInvoiceLite = {
  id: string;
  docNo: string;
  date: string;
  pending: number;
  currency: string;
};

/**
 * Inline editor for a Nuevo Pago — creates a single payment via `INVOICE_PAYMENT`
 * (`is_prepaid: true`), always sending `invoice_allocations` so the backend books it against
 * outstanding invoices (in the payment's currency). By default this allocation is FIFO
 * (oldest pending invoice first) computed silently — the panel isn't shown. If the user
 * picks "seleccionar tratamientos pendientes" they take over that distribution by hand
 * (still starting from the same FIFO default). The allocated sum may be less than the total
 * payment — the remainder is booked as credit via `is_prepaid: true` — but it can never
 * exceed it.
 *
 * In edit mode (`editRow`/`editPayment` set) saving instead calls
 * `PAYMENT_EDIT_WITH_REALLOCATION`: the backend updates the payment row in place (so no
 * duplicate "payment received" email, and the original cash session isn't lost), then
 * releases and re-applies (FIFO) whatever invoice allocations the payment already had
 * against the new amount. Because reallocation is automatic, the "seleccionar tratamientos
 * pendientes" panel — which is for choosing new allocations — doesn't apply here and is
 * hidden in edit mode.
 */
function PaymentInlineEditor({ userId, patientName, patientEmail, currency, pendingInvoices, editRow, editPayment, onCancel, onSaved }: {
  userId: string;
  patientName?: string;
  patientEmail?: string;
  currency: string;
  pendingInvoices: PendingInvoiceLite[];
  editRow?: LedgerRow;
  editPayment?: Payment;
  onCancel: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const t = useTranslations('PatientLedger');
  const { toast } = useToast();
  const { user: operator, checkActiveSession } = useAuth();
  const { validateActiveSession, showCashSessionError } = useCashSessionValidation();
  const isEdit = !!editRow;
  const [submitting, setSubmitting] = React.useState(false);
  const [paymentMethods, setPaymentMethods] = React.useState<PaymentMethod[]>([]);

  const form = useForm<PaymentEditorValues>({
    resolver: zodResolver(paymentEditorSchema),
    defaultValues: {
      created_at: editPayment?.payment_date ? new Date(editPayment.payment_date) : new Date(),
      currency: (editPayment?.source_currency as 'UYU' | 'USD' | undefined) || (currency as 'UYU' | 'USD'),
      payment_amount: editPayment ? Math.abs(editPayment.amount_applied ?? editPayment.source_amount ?? 0) : 0,
      payment_method_id: editPayment?.payment_method_id || '',
      notes: editPayment?.notes || '',
      is_historical: editPayment?.is_historical || false,
    },
  });

  React.useEffect(() => {
    void getPaymentMethods().then((methods) => {
      setPaymentMethods(methods);
      // The payment list endpoint that feeds `editPayment` only reliably carries the
      // method's denormalized code/name, not always its id (unlike a fresh payment, whose
      // id comes straight from `INVOICE_PAYMENT`'s own response) — once the methods are
      // loaded, resolve the id by code/name so the select still preselects correctly.
      if (isEdit && editPayment && !methods.some((m) => m.id === form.getValues('payment_method_id'))) {
        const matched = methods.find((m) =>
          (editPayment.payment_method_code && m.code === editPayment.payment_method_code)
          || (editPayment.payment_method && m.name.toLowerCase() === editPayment.payment_method.toLowerCase()));
        if (matched) form.setValue('payment_method_id', matched.id, { shouldValidate: true });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const createdAt = form.watch('created_at');
  const isHistorical = form.watch('is_historical');
  const amount = form.watch('payment_amount') || 0;
  const selectedCurrency = form.watch('currency');

  // Pending invoices in this payment's currency, oldest first (FIFO distribution order).
  const sortedPending = React.useMemo(
    () => pendingInvoices
      .filter((p) => p.currency === selectedCurrency)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [pendingInvoices, selectedCurrency],
  );

  // Allocation state: `alloc[invoiceId] = amount`. Presence = the invoice is included.
  const [showAllocations, setShowAllocations] = React.useState(false);
  const [alloc, setAlloc] = React.useState<Record<string, number>>({});
  const [allocManual, setAllocManual] = React.useState(false);

  const distributeFifo = React.useCallback((total: number): Record<string, number> => {
    let remaining = round2(total);
    const result: Record<string, number> = {};
    for (const inv of sortedPending) {
      if (remaining <= 0.005) break;
      const take = round2(Math.min(inv.pending, remaining));
      if (take > 0.005) { result[inv.id] = take; remaining = round2(remaining - take); }
    }
    return result;
  }, [sortedPending]);

  // Auto-redistribute (oldest first) whenever the total changes, until the user edits.
  React.useEffect(() => {
    if (showAllocations && !allocManual) setAlloc(distributeFifo(amount));
  }, [showAllocations, allocManual, amount, distributeFifo]);

  // Switching currency invalidates any manual allocation (it's keyed to the previous
  // currency's invoices) — fall back to a fresh FIFO distribution in the new currency.
  React.useEffect(() => {
    setAllocManual(false);
  }, [selectedCurrency]);

  const allocated = round2(Object.values(alloc).reduce((s, a) => s + a, 0));
  // Positive `difference` = leftover (amount > allocated) — goes to the patient's credit,
  // not an error. Negative = over-allocation (allocated > amount) — that's invalid, the
  // payment can't cover more than what's being paid.
  const difference = round2(amount - allocated);
  const allocOverage = showAllocations && difference < -0.005;
  const allocLeftover = showAllocations && difference > 0.005;
  // Per-row: an allocation can never exceed what that treatment actually still owes,
  // regardless of how the total payment compares — flagged inline, not silently clamped,
  // so the user sees exactly which row is the problem.
  const rowExceedsPending = React.useCallback(
    (inv: PendingInvoiceLite) => (alloc[inv.id] ?? 0) > inv.pending + 0.005,
    [alloc],
  );
  const hasInvalidAllocation = showAllocations && (allocOverage || sortedPending.some(rowExceedsPending));

  const toggleInvoice = (inv: PendingInvoiceLite) => {
    setAllocManual(true);
    setAlloc((prev) => {
      const next = { ...prev };
      if (inv.id in next) { delete next[inv.id]; return next; }
      const others = round2(Object.values(next).reduce((s, a) => s + a, 0));
      next[inv.id] = round2(Math.min(inv.pending, Math.max(0, amount - others)));
      return next;
    });
  };

  // Not clamped to `inv.pending`/`amount` here — an over-limit value is kept as typed so
  // the row can show a visible error instead of silently rewriting what the user entered.
  const setInvoiceAmount = (inv: PendingInvoiceLite, value: number) => {
    setAllocManual(true);
    setAlloc((prev) => ({ ...prev, [inv.id]: round2(Math.max(0, value || 0)) }));
  };

  const toggleAllocationsPanel = () => {
    if (showAllocations) {
      setShowAllocations(false);
      setAlloc({});
      setAllocManual(false);
    } else {
      setShowAllocations(true);
      setAllocManual(false); // triggers a fresh FIFO distribution via the effect
    }
  };

  const onSubmit = async (values: PaymentEditorValues) => {
    if (submitting || !operator) return;
    if (isEdit) {
      if (!editRow?.paymentId) return;
      setSubmitting(true);
      try {
        const res = await api.post(API_ROUTES.SALES.PAYMENT_EDIT_WITH_REALLOCATION, {
          payment_id: editRow.paymentId,
          payment_date: toLocalISOString(preserveTimeIfToday(values.created_at)),
          amount: values.payment_amount,
          payment_method_id: values.payment_method_id,
          notes: values.notes || '',
          is_historical: values.is_historical,
        });
        const result = Array.isArray(res) ? res[0] : res;
        if (result?.error || (typeof result?.code === 'number' && result.code >= 400)) {
          throw new Error(result?.message);
        }
        const released = Number(result?.released_amount) || 0;
        toast({
          title: t('toasts.paymentUpdated'),
          description: released > 0.005 ? t('toasts.releasedCredit', { amount: fmtAmountZero(released, values.currency) }) : undefined,
        });
        await checkActiveSession();
        await onSaved();
      } catch (e: any) {
        toast({ title: e?.message || t('toasts.paymentUpdateError'), variant: 'destructive' });
      } finally {
        setSubmitting(false);
      }
      return;
    }
    // Manual mode uses whatever the user built in `alloc`; otherwise (panel never opened)
    // fall back to a silent FIFO distribution over the pending invoices — same default the
    // manual panel itself starts from, just applied without the user opening it.
    const allocSource = showAllocations ? alloc : distributeFifo(values.payment_amount);
    const invoiceAllocations = Object.entries(allocSource)
      .filter(([, a]) => a > 0.005)
      .map(([id, a]) => ({ invoice_id: Number(id), amount: a }));
    if (showAllocations) {
      if (invoiceAllocations.length === 0) {
        toast({ title: t('allocations.noneSelected'), variant: 'destructive' });
        return;
      }
      const overPending = sortedPending.find(rowExceedsPending);
      if (overPending) {
        toast({ title: t('allocations.exceedsPending'), variant: 'destructive' });
        return;
      }
      // Allocated may be less than the payment (the rest becomes credit) but never more.
      if (round2(allocated - values.payment_amount) > 0.005) {
        toast({ title: t('allocations.mismatch', { amount: fmtAmountZero(round2(allocated - values.payment_amount), values.currency) }), variant: 'destructive' });
        return;
      }
    }
    setSubmitting(true);
    try {
      let sessionId: string | null = null;
      if (!values.is_historical) {
        const validation = await validateActiveSession();
        if (!validation.isValid) {
          showCashSessionError(validation.error);
          return;
        }
        sessionId = validation.sessionId ?? null;
      }
      const method = paymentMethods.find((m) => m.id === values.payment_method_id);
      const res: any = await api.post(API_ROUTES.SALES.INVOICE_PAYMENT, {
        cash_session_id: sessionId,
        user: operator,
        client_user: { id: userId, name: patientName || '', email: patientEmail || '' },
        // One payment; when present, the backend allocates it to these invoices.
        ...(invoiceAllocations.length > 0 ? { invoice_allocations: invoiceAllocations } : {}),
        query: {
          payment_date: toLocalISOString(preserveTimeIfToday(values.created_at)),
          amount: values.payment_amount,
          method: method?.name,
          payment_method_id: values.payment_method_id,
          status: 'completed',
          user_id: userId,
          is_sales: true,
          is_prepaid: true,
          invoice_currency: values.currency,
          payment_currency: values.currency,
          exchange_rate: 1,
          notes: values.notes || '',
          is_historical: values.is_historical,
        },
      });
      if (res?.error && res?.code >= 400) throw new Error(res.message);
      if (Array.isArray(res) && res[0]?.code >= 400) throw new Error(res[0]?.message);
      toast({ title: t('toasts.paymentCreated') });
      await checkActiveSession();
      await onSaved();
    } catch (e: any) {
      toast({ title: e?.message || t('toasts.paymentCreateError'), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <InlineEditorShell
        title={`${t(isEdit ? 'inline.edit' : 'inline.new')} ${t('inline.addPayment')}`}
        controls={<EditorControls submitting={submitting} onCancel={onCancel} disabled={hasInvalidAllocation} />}
        // Line 1: date · payment method · amount+currency (the "haber").
        line1={
          <>
            <FieldIcon icon={Calendar} className="w-36">
              <DatePickerInput
                value={format(createdAt, 'yyyy-MM-dd')}
                onChange={(iso) => iso && form.setValue('created_at', parseISO(iso))}
                className="h-8 pl-7 text-xs"
              />
            </FieldIcon>
            <FieldIcon icon={CreditCard} className="min-w-[10rem] flex-1">
              <Select value={form.watch('payment_method_id')} onValueChange={(v) => form.setValue('payment_method_id', v, { shouldValidate: true })}>
                <SelectTrigger className="h-8 pl-7 text-sm"><SelectValue placeholder={t('fields.selectMethod')} /></SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </FieldIcon>
            {/* Amount + currency: shows just "$/U$ 0,00" until clicked, then reveals the
                currency selector alongside the amount (fixed currency in edit mode). */}
            <CurrencyAmountInput
              amount={form.watch('payment_amount')}
              currency={selectedCurrency}
              onAmountChange={(v) => form.setValue('payment_amount', v, { shouldValidate: true })}
              onCurrencyChange={(c) => form.setValue('currency', c, { shouldValidate: true })}
              currencyLocked={isEdit}
              ariaLabel={t('fields.amount')}
              className="w-52"
            />
          </>
        }
        // Line 2: notes · historical · pending-treatment picker.
        line2={
          <>
            <FieldIcon icon={StickyNote} className="min-w-[10rem] flex-1">
              <Input
                placeholder={t('fields.notes')}
                aria-label={t('fields.notes')}
                className="h-8 pl-7 text-sm"
                {...form.register('notes')}
              />
            </FieldIcon>
            <label className="flex h-8 cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
              <Checkbox checked={isHistorical} onCheckedChange={(c) => form.setValue('is_historical', !!c)} />
              <History className="h-3.5 w-3.5" />
              {t('fields.historical')}
            </label>
            {!isEdit && (
              <Button
                type="button"
                size="sm"
                variant={showAllocations ? 'secondary' : 'outline'}
                className="h-8 shrink-0 gap-1.5 text-xs"
                onClick={toggleAllocationsPanel}
                disabled={sortedPending.length === 0}
              >
                <ListChecks className="h-3.5 w-3.5" />{t('inline.selectPending')}
              </Button>
            )}
          </>
        }
        belowSlot={!isEdit && showAllocations && (
          <div className="mt-3 rounded-md border border-border bg-background/70 p-2.5">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-medium">{t('allocations.title')}</span>
              <span className={cn('tabular-nums', allocOverage ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400')}>
                {t('allocations.allocated')}: {fmtAmountZero(allocated, selectedCurrency)} / {fmtAmountZero(amount, selectedCurrency)}
                {allocOverage && ` · ${t('allocations.exceeds', { amount: fmtAmountZero(Math.abs(difference), selectedCurrency) })}`}
              </span>
            </div>
            {allocLeftover && (
              <div className="mb-2 text-xs text-muted-foreground">
                {t('allocations.leftoverCredit', { amount: fmtAmountZero(difference, selectedCurrency) })}
              </div>
            )}
            {sortedPending.length === 0 ? (
              <div className="py-2 text-center text-xs text-muted-foreground">{t('allocations.noPending')}</div>
            ) : (
              <div className="space-y-1.5">
                {sortedPending.map((inv) => {
                  const included = inv.id in alloc;
                  const rowInvalid = included && rowExceedsPending(inv);
                  return (
                    <div key={inv.id} className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2 text-xs">
                        <Checkbox checked={included} onCheckedChange={() => toggleInvoice(inv)} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{t('docLine.treatment')}: {inv.docNo}</div>
                          <div className="truncate text-muted-foreground">
                            {formatDisplayDate(inv.date)} · {t('allocations.pending')}: {fmtAmountZero(inv.pending, inv.currency)}
                          </div>
                        </div>
                        <FormattedNumberInput
                          value={included ? alloc[inv.id] : 0}
                          onChange={(v) => setInvoiceAmount(inv, v)}
                          placeholder="0.00"
                          className={cn(
                            'h-7 w-24 shrink-0 text-right text-xs',
                            !included && 'opacity-50',
                            rowInvalid && 'border-destructive text-destructive focus-visible:ring-destructive',
                          )}
                        />
                      </div>
                      {rowInvalid && (
                        <div className="pl-6 text-[11px] text-destructive">{t('allocations.exceedsPending')}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      />
    </form>
  );
}

/**
 * Inline editor for an existing (structured) credit note. There's no "update credit note"
 * endpoint, so saving undoes the original (`CREDIT_NOTE_UNDO`) and creates a replacement
 * (`INVOICES_UPSERT`, `type: 'credit_note'`) against the same parent invoice with the
 * edited quantity/price/notes — the service itself isn't editable, since this note is
 * crediting one specific line.
 */
function CreditNoteInlineEditor({ row, userId, parentInvoiceId, maxCreditable, onCancel, onSaved }: {
  row: LedgerRow;
  userId: string;
  parentInvoiceId: string;
  /** What this note could total including its own current amount (about to be replaced) —
   *  i.e. `getMaxCreditableForInvoice(parentInvoiceId) + row's own current total`. */
  maxCreditable: number;
  onCancel: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const t = useTranslations('PatientLedger');
  const { toast } = useToast();
  const [submitting, setSubmitting] = React.useState(false);

  const form = useForm<CreditNoteFormValues>({
    resolver: zodResolver(creditNoteSchema),
    defaultValues: {
      quantity: row.quantity || 1,
      unit_price: row.unitPrice || 0,
      notes: row.notes || '',
    },
  });
  const quantity = form.watch('quantity') || 0;
  const unitPrice = form.watch('unit_price') || 0;

  const onSubmit = async (values: CreditNoteFormValues) => {
    if (submitting || !row.invoiceId || !row.itemId || !row.serviceId) return;
    const total = values.quantity * values.unit_price;
    if (total > maxCreditable + 0.01) {
      form.setError('unit_price', { message: t('dialogs.creditNote.exceedsMax', { max: maxCreditable.toFixed(2) }) });
      return;
    }
    setSubmitting(true);
    try {
      const undoRes = await api.post(API_ROUTES.SALES.CREDIT_NOTE_UNDO, {}, undefined, { credit_note_id: row.invoiceId });
      if (Array.isArray(undoRes) && undoRes[0]?.code >= 400) throw new Error(undoRes[0]?.message);
      const res = await api.post(API_ROUTES.SALES.INVOICES_UPSERT, {
        user_id: userId,
        type: 'credit_note',
        parent_id: parentInvoiceId,
        currency: row.currency,
        total,
        notes: values.notes || '',
        is_sales: true,
        items: [{ service_id: row.serviceId, quantity: values.quantity, unit_price: values.unit_price, total }],
      });
      if (Array.isArray(res) && res[0]?.code >= 400) throw new Error(res[0]?.message);
      toast({ title: t('toasts.creditNoteUpdated') });
      await onSaved();
    } catch (e: any) {
      toast({ title: e?.message || t('toasts.creditNoteUpdateError'), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <InlineEditorShell
        title={`${t('inline.edit')} ${t('docLine.creditNote')}`}
        controls={<EditorControls submitting={submitting} onCancel={onCancel} />}
        // Line 1: date (read-only) · credited service (read-only) · quantity · unit price ·
        // resulting credit total.
        line1={
          <>
            <FieldIcon icon={Calendar} className="w-36">
              <span className="flex h-8 items-center pl-7 text-xs text-muted-foreground">{formatDisplayDate(row.date)}</span>
            </FieldIcon>
            <FieldIcon icon={Stethoscope} className="min-w-[10rem] flex-1">
              <span className="flex h-8 min-w-0 items-center truncate pl-7 text-sm">{row.label}</span>
            </FieldIcon>
            <FieldIcon icon={Hash} className="w-[5.5rem]">
              <Input
                type="number"
                min={1}
                aria-label={t('dialogs.creditNote.quantity')}
                className="h-8 pl-7 text-sm"
                {...form.register('quantity')}
              />
            </FieldIcon>
            <CurrencyAmountInput
              amount={form.watch('unit_price')}
              currency={row.currency as 'UYU' | 'USD'}
              onAmountChange={(v) => form.setValue('unit_price', v, { shouldValidate: true })}
              currencyLocked
              ariaLabel={t('dialogs.creditNote.unitPrice')}
              className="w-36"
            />
            <span className="flex h-8 items-center gap-1 text-sm font-medium tabular-nums text-muted-foreground">
              = {currencySymbol(row.currency)}{fmtNumber2(round2(quantity * unitPrice))}
            </span>
          </>
        }
        line2={
          <FieldIcon icon={StickyNote} className="min-w-[10rem] flex-1">
            <Input
              placeholder={t('fields.notes')}
              aria-label={t('fields.notes')}
              className="h-8 pl-7 text-sm"
              {...form.register('notes')}
            />
          </FieldIcon>
        }
      />
    </form>
  );
}

export const PatientLedger = React.forwardRef<PatientLedgerHandle, PatientLedgerProps>(function PatientLedger({ userId, patientName, patientEmail, refreshTrigger, onPrintSummary, onViewStatement, hideToolbarActions, searchTerm: searchTermProp, dateRange: dateRangeProp, onDateRangeChange }: PatientLedgerProps, ref) {
  const t = useTranslations('PatientLedger');
  const { toast } = useToast();
  const { user: operator } = useAuth();
  const clinicInfo = useClinicInfo();
  const { validateActiveSession, showCashSessionError } = useCashSessionValidation();
  const { hasPermission } = usePermissions();
  const canInvoiceQuote = hasPermission(SALES_PERMISSIONS.INVOICES_CREATE) || hasPermission(SALES_PERMISSIONS.ORDERS_INVOICE_FROM_ORDER);
  const canConfirmQuote = hasPermission(SALES_PERMISSIONS.QUOTES_CONFIRM);
  const canCreatePaymentPerm = hasPermission(SALES_PERMISSIONS.PAYMENTS_CREATE);
  const canCreateQuote = hasPermission(SALES_PERMISSIONS.QUOTES_CREATE);
  const canCreateTreatment = hasPermission(SALES_PERMISSIONS.INVOICES_CREATE);
  const canCreateCreditNote = hasPermission(SALES_PERMISSIONS.INVOICES_CREATE);
  const canRevertInvoice = hasPermission(SALES_PERMISSIONS.INVOICES_DELETE);
  const canDeleteQuote = hasPermission(SALES_PERMISSIONS.QUOTES_DELETE);
  const canDeletePayment = hasPermission(SALES_PERMISSIONS.PAYMENTS_CREATE);
  const canDeleteCreditNote = hasPermission(SALES_PERMISSIONS.INVOICES_DELETE);
  const canEditQuote = hasPermission(SALES_PERMISSIONS.QUOTES_UPDATE);
  const canEditInvoice = hasPermission(SALES_PERMISSIONS.INVOICES_UPDATE);
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
  // Period filter — controllable by a host (the account-statement sheet renders the
  // picker in its header). Defaults to "Todo el tiempo" (undefined = no date filter).
  const [internalDateRange, setInternalDateRange] = React.useState<DateRange | undefined>(undefined);
  const isDateRangeControlled = onDateRangeChange !== undefined;
  const dateRange = isDateRangeControlled ? dateRangeProp : internalDateRange;
  const setDateRange = isDateRangeControlled ? onDateRangeChange : setInternalDateRange;

  const [billingQuote, setBillingQuote] = React.useState<Quote | null>(null);
  const [billingItemId, setBillingItemId] = React.useState<string | null>(null);
  const [creditNoteRow, setCreditNoteRow] = React.useState<LedgerRow | null>(null);
  /** Set instead of `creditNoteRow` when editing an existing credit note (as opposed to
   *  creating a new one against the invoice it targets) — see the shared dialog below. */
  const [editingCreditNoteRow, setEditingCreditNoteRow] = React.useState<LedgerRow | null>(null);
  const [isSubmittingCreditNote, setIsSubmittingCreditNote] = React.useState(false);

  // Inline editing state: `createDoc` drives the floating-bar → inline-create editor;
  // `selectedRowId` drives row selection (action bar with Facturar/Editar/Nota de
  // crédito/Eliminar); `editingItemRowId`/`editingPaymentRowId` swap a specific row's
  // static display for its inline editor, pre-filled, in place.
  const [createDoc, setCreateDoc] = React.useState<'quote' | 'invoice' | 'payment' | null>(null);
  const [selectedRowId, setSelectedRowId] = React.useState<string | null>(null);
  const [editingItemRowId, setEditingItemRowId] = React.useState<string | null>(null);
  const [editingPaymentRowId, setEditingPaymentRowId] = React.useState<string | null>(null);
  const [searchOpen, setSearchOpen] = React.useState(false);
  // Doc numbers to ring-highlight while a row's "linked documents" popover is open —
  // see `RowAllocationsPopover`. Cleared when the popover closes.
  const [highlightedDocNos, setHighlightedDocNos] = React.useState<Set<string> | null>(null);

  const load = React.useCallback(async (forceRefresh: boolean) => {
    if (!userId) return;
    setIsLoading(true);
    const data = await fetchPatientLedgerData(userId, { forceRefresh });
    setLedgerData(data);
    const grouped = buildPatientLedger(data);
    setLedgerByCurrency(grouped);
    // Prefer the currency already selected, else the clinic's configured default (even if
    // this patient has no rows in it yet), else whichever currency the data happens to have.
    setCurrency((prev) => {
      if (prev && grouped[prev]) return prev;
      if (clinicInfo?.currency) return clinicInfo.currency;
      return Object.keys(grouped)[0] || null;
    });
    setIsLoading(false);
  }, [userId, clinicInfo]);

  React.useEffect(() => {
    const forceRefresh = prevRefreshTrigger.current !== refreshTrigger;
    prevRefreshTrigger.current = refreshTrigger;
    void load(forceRefresh);
  }, [load, refreshTrigger]);

  const handleManualRefresh = React.useCallback(() => { void load(true); }, [load]);

  // Both supported currencies are always offered in the toggle, regardless of whether this
  // patient has rows in either — the filter must stay usable (and default correctly, see
  // `load` above) even for a patient with no records yet.
  const currencies = React.useMemo(() => {
    const keys = new Set(Object.keys(ledgerByCurrency));
    keys.add('UYU');
    keys.add('USD');
    if (clinicInfo?.currency) keys.add(clinicInfo.currency);
    return Array.from(keys);
  }, [ledgerByCurrency, clinicInfo]);
  const rows = React.useMemo(
    () => (currency ? ledgerByCurrency[currency] || [] : []),
    [currency, ledgerByCurrency],
  );

  // The active period's rows, prefixed with a synthetic "Saldo anterior" row when the
  // account has history before `dateRange.from` — see `splitLedgerByRange`.
  const rowsInRange = React.useMemo(
    () => (dateRange?.from && dateRange?.to ? splitLedgerByRange(rows, { from: dateRange.from, to: dateRange.to }) : rows),
    [rows, dateRange],
  );

  // Same split, applied to every currency — used by hosts (e.g. the print button) that
  // need a WYSIWYG snapshot of what's currently on screen, not just the active tab.
  const rowsInRangeByCurrency = React.useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return ledgerByCurrency;
    const range = { from: dateRange.from, to: dateRange.to };
    const result: Record<string, LedgerRow[]> = {};
    for (const [cur, curRows] of Object.entries(ledgerByCurrency)) {
      result[cur] = splitLedgerByRange(curRows, range);
    }
    return result;
  }, [ledgerByCurrency, dateRange]);

  const visibleLedger = React.useMemo<VisibleLedger>(
    () => ({ dateRange, rowsByCurrency: rowsInRangeByCurrency }),
    [dateRange, rowsInRangeByCurrency],
  );

  React.useImperativeHandle(ref, () => ({
    refresh: () => { void load(true); },
    getVisibleLedger: () => visibleLedger,
  }), [load, visibleLedger]);

  // Currency used by the inline create editor (ledger's own currency, else clinic default).
  const editorCurrency = currency || clinicInfo?.currency || 'UYU';

  // Reset transient inline state whenever the underlying rows change (after a reload).
  const closeInline = React.useCallback(() => {
    setCreateDoc(null);
    setSelectedRowId(null);
    setEditingItemRowId(null);
    setEditingPaymentRowId(null);
    setEditingCreditNoteRow(null);
  }, []);
  const handleInlineSaved = React.useCallback(async () => { closeInline(); await load(true); }, [closeInline, load]);

  // ── Row actions ──────────────────────────────────────────────────────────────
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

  const handleEditCreditNote = React.useCallback((row: LedgerRow) => {
    setEditingCreditNoteRow(row);
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
        doctor_id: row.doctorId,
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

  /**
   * En curso → Finalizado: applies whatever of the patient's available credit fits (built
   * up via "Nuevo Pago", which now only ever creates a prepayment/credit — never applies
   * cash to an invoice directly), then forces the row's status to Finalizado regardless of
   * whether that covered the whole balance. This is a manual staff action — clicking
   * "Finalizado" means "treat this as finalized", not "only if the numbers happen to add
   * up" — so any gap not covered by credit is left uncollected rather than blocking the
   * status change. The force itself goes through `INVOICE_PAYMENT_STATE_SET`, which only
   * touches `invoices.payment_state` (not `paid_amount`) — see
   * `docs/finalizado-manual-tratamiento.md`.
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

      let stillPending = 0;
      if (remaining > 0.005) {
        const creditsRes: any = await api.get(API_ROUTES.USER_CREDIT, { user_id: userId });
        const credits = (Array.isArray(creditsRes) ? creditsRes : [])
          .filter((c: any) => c && c.source_id && (c.currency || row.currency) === row.currency && parseFloat(c.available_balance) > 0.005);
        const totalAvailable = round2(credits.reduce((sum: number, c: any) => sum + parseFloat(c.available_balance), 0));

        if (totalAvailable > 0.005) {
          const amountToApply = round2(Math.min(totalAvailable, remaining));
          await postCreditAllocation({ userId, patientName, patientEmail, operator, row, amount: amountToApply, credits, sessionId: validation.sessionId });
          stillPending = round2(remaining - amountToApply);
        } else {
          stillPending = remaining;
        }
      }

      const stateRes = await api.post(API_ROUTES.SALES.INVOICE_PAYMENT_STATE_SET, {
        invoice_id: Number(row.invoiceId),
        payment_state: 'paid',
      });
      const stateResult = Array.isArray(stateRes) ? stateRes[0] : stateRes;
      if (stateResult?.error || (typeof stateResult?.code === 'number' && stateResult.code >= 400)) {
        throw new Error(stateResult?.message);
      }

      toast({
        title: t('toasts.itemFinalized'),
        description: stillPending > 0.005 ? t('toasts.itemFinalizedManualDesc', { pending: fmtAmountZero(stillPending, row.currency) }) : undefined,
      });
      await load(true);
    } catch (e: any) {
      toast({ title: e?.message || t('toasts.itemFinalizeError'), variant: 'destructive' });
    } finally {
      setIsMarkingFinalized(false);
    }
  }, [userId, patientName, patientEmail, ledgerData, load, t, toast, isMarkingFinalized, validateActiveSession, showCashSessionError, operator]);

  /**
   * Finalizado → En curso: undoes every real payment transaction applied to this invoice
   * (if any — a "Finalizado" forced with no credit behind it has none), then always forces
   * `payment_state` back to `unpaid` via `INVOICE_PAYMENT_STATE_SET`. That force is needed
   * regardless of whether anything was undone: since `handleMarkFinalized` can finalize a
   * row purely by force (no real payment created), there may be nothing to revert here, and
   * without the force the row would just stay stuck on Finalizado forever.
   */
  const handleUnmarkFinalized = React.useCallback(async (row: LedgerRow) => {
    if (!row.invoiceId || isUnmarkingFinalized) return;
    setIsUnmarkingFinalized(true);
    try {
      const payments = (ledgerData?.payments || []).filter((p) => p.invoice_id === row.invoiceId);
      for (const p of payments) {
        const res = await api.post(API_ROUTES.SALES.PAYMENT_UNDO, {}, undefined, {
          transaction_id: p.id,
          transaction_type: p.transaction_type,
        });
        if (Array.isArray(res) && res[0]?.code >= 400) throw new Error(res[0]?.message);
      }

      const stateRes = await api.post(API_ROUTES.SALES.INVOICE_PAYMENT_STATE_SET, {
        invoice_id: Number(row.invoiceId),
        payment_state: 'unpaid',
      });
      const stateResult = Array.isArray(stateRes) ? stateRes[0] : stateRes;
      if (stateResult?.error || (typeof stateResult?.code === 'number' && stateResult.code >= 400)) {
        throw new Error(stateResult?.message);
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
      return <Badge variant="info" className={STATUS_BADGE_CLASS}>{t('status.pago')}</Badge>;
    }
    if (row.status === 'notaCredito') {
      return <Badge variant={STATUS_VARIANT.notaCredito} className={STATUS_BADGE_CLASS}>{t('status.notaCredito')}</Badge>;
    }
    if (!row.status) return null;
    return (
      <LedgerRowStatusControl
        row={row}
        canSetEnCurso={canConfirmQuote}
        canSetFinalizado={canCreatePaymentPerm}
        canRevertToEnCurso={canDeletePayment}
        canRevertToPresupuesto={canRevertInvoice}
        busy={isMarkingEnCurso || isMarkingFinalized || isUnmarkingFinalized || isRevertingInvoice}
        onSetEnCurso={handleMarkEnCurso}
        onSetFinalizado={handleMarkFinalized}
        onRevertToEnCurso={handleUnmarkFinalized}
        onRevertToPresupuesto={handleRevertInvoice}
        t={t}
      />
    );
  }, [t, canConfirmQuote, canCreatePaymentPerm, canDeletePayment, canRevertInvoice, isMarkingEnCurso, isMarkingFinalized, isUnmarkingFinalized, isRevertingInvoice, handleMarkEnCurso, handleMarkFinalized, handleUnmarkFinalized, handleRevertInvoice]);

  /** Routes a selected row's "Eliminar" to the right existing delete handler by kind. */
  const handleDeleteRow = React.useCallback((row: LedgerRow) => {
    if (row.kind === 'payment') return handleDeletePayment(row);
    if (row.status === 'notaCredito') return handleDeleteCreditNote(row);
    if (row.status === 'presupuestado') return handleDeleteQuote(row);
    return handleDeleteInvoice(row);
  }, [handleDeletePayment, handleDeleteCreditNote, handleDeleteQuote, handleDeleteInvoice]);

  /** Centered action buttons shown attached under a selected row — the same actions the
   *  old "…" menu held (custom invoice, credit note, delete), plus a Cancelar to deselect.
   *  Returns a fragment; the row's merged card container provides border/background. */
  const renderSelectionActions = React.useCallback((row: LedgerRow) => {
    const isUnbilledQuoteItem = row.kind === 'item' && row.status === 'presupuestado';
    const isInvoiceItem = row.kind === 'item' && !!row.status && row.status !== 'presupuestado' && row.status !== 'notaCredito';
    const isPayment = row.kind === 'payment';
    const isCreditNote = row.kind === 'item' && row.status === 'notaCredito';
    const quoteStatus = (row.quoteStatus || '').toLowerCase();
    const showInvoice = isUnbilledQuoteItem && INVOICEABLE_QUOTE_STATUSES.includes(quoteStatus) && canInvoiceQuote;
    const showCreateCreditNote = isInvoiceItem && !!row.invoiceId && getMaxCreditableForInvoice(row.invoiceId) > 0.005 && canCreateCreditNote;
    // A billed treatment with payments/allocations already against it (parcial/pagado)
    // edits through INVOICE_ITEMS_EDIT_WITH_REALLOCATION instead of the whole-invoice
    // resend — see QuoteInvoiceInlineEditor's editKind — so it's just as editable as an
    // unpaid one now.
    const showEditItem =
      (isUnbilledQuoteItem && canEditQuote) ||
      (isInvoiceItem && canEditInvoice);
    // Payments with allocations now edit through PAYMENT_EDIT_WITH_REALLOCATION (which
    // releases and re-applies them FIFO), same as pure prepayments/credit — see
    // PaymentInlineEditor's editKind. Credit-note-derived rows stay excluded: they're
    // auto-derived bookkeeping, not something the user created directly.
    const showEditPayment = isPayment && row.transactionType !== 'credit_note_allocation' && canCreatePaymentPerm;
    // Only structured credit notes (with their own itemId/serviceId) carry enough
    // information to be resent on edit; the rare lump-sum ones stay delete-only.
    const showEditCreditNote = isCreditNote && !!row.itemId && !!row.serviceId && canCreateCreditNote;
    const canDelete =
      (isUnbilledQuoteItem && canDeleteQuote) ||
      (isPayment && canDeletePayment) ||
      (isCreditNote && canDeleteCreditNote) ||
      (isInvoiceItem && canRevertInvoice);
    return (
      <>
        {showInvoice && (
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => handleInvoice(row)}>
            <FileText className="h-3.5 w-3.5" />{t('actions.invoiceCustom')}
          </Button>
        )}
        {showEditItem && (
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => { setSelectedRowId(null); setEditingItemRowId(row.id); }}>
            <Pencil className="h-3.5 w-3.5" />{t('actions.edit')}
          </Button>
        )}
        {showEditPayment && (
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => { setSelectedRowId(null); setEditingPaymentRowId(row.id); }}>
            <Pencil className="h-3.5 w-3.5" />{t('actions.edit')}
          </Button>
        )}
        {showEditCreditNote && (
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => { setSelectedRowId(null); handleEditCreditNote(row); }}>
            <Pencil className="h-3.5 w-3.5" />{t('actions.edit')}
          </Button>
        )}
        {showCreateCreditNote && (
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => handleCreditNote(row)}>
            <FileMinus className="h-3.5 w-3.5" />{t('actions.creditNote')}
          </Button>
        )}
        {canDelete && (
          <Button size="sm" variant="outline" className="gap-1.5 text-xs text-destructive hover:text-destructive" onClick={() => handleDeleteRow(row)}>
            <Trash2 className="h-3.5 w-3.5" />{t('inline.delete')}
          </Button>
        )}
        <Button size="sm" variant="ghost" className="text-xs" onClick={() => setSelectedRowId(null)}>
          {t('inline.cancel')}
        </Button>
      </>
    );
  }, [canInvoiceQuote, canCreateCreditNote, canDeleteQuote, canDeletePayment, canDeleteCreditNote, canRevertInvoice, canEditQuote, canEditInvoice, canCreatePaymentPerm, getMaxCreditableForInvoice, handleInvoice, handleCreditNote, handleEditCreditNote, handleDeleteRow, t]);

  // Search may be controlled by a host (the sheet renders the search box in its header);
  // otherwise the ledger keeps its own state and shows an expandable search in the toolbar.
  const [internalSearch, setInternalSearch] = React.useState('');
  const isSearchControlled = searchTermProp !== undefined;
  const search = isSearchControlled ? searchTermProp! : internalSearch;
  const filteredRows = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rowsInRange;
    // The opening-balance row is a summary anchor, not a searchable document — a search
    // term never hides it, so "before this period" context stays visible either way.
    return rowsInRange.filter((row) => row.kind === 'balance' || row.label.toLowerCase().includes(term) || (row.docNo || '').toLowerCase().includes(term));
  }, [rowsInRange, search]);

  // Column totals for the footer, scoped to the active period. A presupuesto with no
  // invoice behind it isn't a debt yet, so its Debe is shown in the row but excluded from
  // Total Debe (same rule the running balance uses); the synthetic opening-balance row is
  // a starting point, not a movement, so it's excluded from both sides too. The final
  // balance is the last running balance (positive = debt, negative = credit in favour) —
  // already the account's true balance as of the period end, not a period-only delta.
  const totals = React.useMemo(() => ({
    totalDebe: round2(rowsInRange.reduce((s, r) => s + (r.kind === 'balance' || r.status === 'presupuestado' ? 0 : r.debe), 0)),
    totalHaber: round2(rowsInRange.reduce((s, r) => s + (r.kind === 'balance' ? 0 : r.haber), 0)),
    finalBalance: rowsInRange.length > 0 ? rowsInRange[rowsInRange.length - 1].runningBalance : 0,
  }), [rowsInRange]);

  // `invoiceId -> doc_no`, used to label a direct payment's own invoice in the allocations
  // popover (see `RowAllocationsPopover`).
  const invoiceDocNoById = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const i of ledgerData?.invoices || []) {
      map.set(i.id, i.doc_no || i.invoice_doc_no || i.id);
    }
    return map;
  }, [ledgerData]);

  // `doc_no -> "Service A, Service B"`, so a payment's allocations popover can show what
  // was actually paid for instead of a bare invoice number — same fallback order as the
  // ledger row label itself (`buildPatientLedger`) for invoices with no item breakdown.
  const serviceLabelByDocNo = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const i of ledgerData?.invoices || []) {
      const docNo = i.doc_no || i.invoice_doc_no || i.id;
      const names = (ledgerData?.invoiceItemsByInvoice[i.id] || []).map((it) => it.service_name).filter(Boolean);
      map.set(docNo, names.length > 0 ? names.join(', ') : (i.notes || i.invoice_ref || docNo));
    }
    return map;
  }, [ledgerData]);

  // Invoices with an outstanding balance — offered as targets for a payment's allocations.
  const pendingInvoices = React.useMemo<PendingInvoiceLite[]>(() => {
    return (ledgerData?.invoices || [])
      .filter((i) => (i.type || 'invoice') !== 'credit_note')
      .map((i) => ({
        id: i.id,
        docNo: i.doc_no || i.invoice_doc_no || i.id,
        date: i.createdAt,
        pending: round2((i.total || 0) - (i.paid_amount || 0)),
        currency: i.currency || 'USD',
      }))
      .filter((p) => p.pending > 0.005);
  }, [ledgerData]);

  const searchInputRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => { if (searchOpen) searchInputRef.current?.focus(); }, [searchOpen]);

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      {!isDateRangeControlled && <DateRangePresets value={dateRange} onChange={setDateRange} allowAllTime />}
      {!isSearchControlled && (
        <div className="flex items-center">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 shrink-0 p-0"
            onClick={() => { if (searchOpen && internalSearch) setInternalSearch(''); setSearchOpen((v) => !v); }}
            title={t('search')}
          >
            <Search className="h-3.5 w-3.5" />
          </Button>
          <Input
            ref={searchInputRef}
            value={internalSearch}
            onChange={(e) => setInternalSearch(e.target.value)}
            onBlur={() => { if (!internalSearch) setSearchOpen(false); }}
            placeholder={t('search')}
            className={cn(
              'h-8 text-xs transition-all duration-200',
              searchOpen ? 'ml-1 w-48 opacity-100' : 'w-0 border-0 p-0 opacity-0',
            )}
            tabIndex={searchOpen ? 0 : -1}
          />
        </div>
      )}
      {onViewStatement && (
        <Button size="sm" variant="ghost" className="gap-1.5 text-xs" onClick={onViewStatement}>
          <ScrollText className="h-3.5 w-3.5" />{t('viewStatement')}
        </Button>
      )}
      <Select value={currency ?? undefined} onValueChange={setCurrency}>
        <SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          {currencies.map((c) => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
        </SelectContent>
      </Select>
      {!hideToolbarActions && (
        <div className="ml-auto flex items-center gap-1">
          {onPrintSummary && (
            /* Hand the host the on-screen snapshot so the PDF honours the active period
               filter instead of re-fetching the whole statement. */
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => onPrintSummary(visibleLedger)}>
              <Printer className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={handleManualRefresh}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
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
        <CardContent className="patient-ledger-container flex-1 flex flex-col min-h-0 gap-3 p-4">
          {toolbar}

          {/* Below a ~640px *panel* width (a container query on `patient-ledger-container`
              above, not the viewport — the sidebar routinely leaves this panel narrow even
              on a wide window) the rows switch to a stacked card layout, so the sticky
              header and the horizontal-scroll-forcing min-width only kick in above that. */}
          <div className="min-h-0 flex-1 overflow-auto">
            {/* px-2 gives the selected-row ring room so it isn't clipped by the scroll
                container's edges; header and rows share the padding so columns stay aligned. */}
            <div className="patient-ledger-row-min-w w-full px-2">
              <div className="patient-ledger-col-header sticky top-0 z-10 items-center gap-3 bg-card px-3 py-2 text-xs font-medium text-muted-foreground">
                <div className="w-32 shrink-0">{t('columns.date')}</div>
                <div className="min-w-[10rem] flex-1">{t('columns.treatment')}</div>
                <div className="w-24 shrink-0 text-right">{t('columns.debit')}</div>
                <div className="w-24 shrink-0 text-right">{t('columns.credit')}</div>
                <div className="w-24 shrink-0 text-right">{t('columns.balance')}</div>
              </div>

              {filteredRows.length === 0 ? (
                <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">{t('empty')}</div>
              ) : (
                <div className="space-y-2 py-1">
                  {filteredRows.map((row) => {
                    const isBalanceRow = row.kind === 'balance';
                    const selected = !isBalanceRow && selectedRowId === row.id;

                    // A row being edited swaps its whole static display for the matching
                    // inline editor, pre-filled, in the same slot — same visual position,
                    // no dialog. QuoteInvoiceInlineEditor derives its own editKind from
                    // `row.status`, so it doesn't need to be told apart here.
                    if (editingItemRowId === row.id) {
                      return (
                        <div key={row.id} className="rounded-lg">
                          <QuoteInvoiceInlineEditor
                            doc={row.status === 'presupuestado' ? 'quote' : 'invoice'}
                            editRow={row}
                            editInvoice={row.invoiceId ? ledgerData?.invoices.find((i) => i.id === row.invoiceId) : undefined}
                            editQuote={row.status === 'presupuestado' ? ledgerData?.quotes.find((q) => q.id === row.quoteId) : undefined}
                            // For the presupuesto case only this one item's own fields
                            // (notably tooth_number, which isn't on LedgerRow) are needed
                            // for prefill — QUOTES_LINES_UPSERT doesn't touch siblings, so
                            // there's no need to resend the whole set on save.
                            editItems={row.status === 'presupuestado'
                              ? ledgerData?.quoteItemsByQuote[row.quoteId || '']
                              : ledgerData?.invoiceItemsByInvoice[row.invoiceId || '']}
                            userId={userId}
                            currency={row.currency}
                            onCancel={() => setEditingItemRowId(null)}
                            onSaved={async () => { setEditingItemRowId(null); await load(true); }}
                          />
                        </div>
                      );
                    }
                    if (editingPaymentRowId === row.id) {
                      return (
                        <div key={row.id} className="rounded-lg">
                          <PaymentInlineEditor
                            userId={userId}
                            patientName={patientName}
                            patientEmail={patientEmail}
                            currency={row.currency}
                            pendingInvoices={pendingInvoices}
                            editRow={row}
                            editPayment={ledgerData?.payments.find((p) => p.id === row.paymentId)}
                            onCancel={() => setEditingPaymentRowId(null)}
                            onSaved={async () => { setEditingPaymentRowId(null); await load(true); }}
                          />
                        </div>
                      );
                    }
                    if (editingCreditNoteRow?.id === row.id) {
                      const creditNoteInvoice = row.invoiceId ? ledgerData?.invoices.find((i) => i.id === row.invoiceId) : undefined;
                      const parentInvoiceId = creditNoteInvoice?.parent_id;
                      // Falls back to the normal row below if the parent can't be resolved
                      // (shouldn't happen for a structured credit note, but avoids a dead end).
                      if (parentInvoiceId) {
                        return (
                          <div key={row.id} className="rounded-lg">
                            <CreditNoteInlineEditor
                              row={row}
                              userId={userId}
                              parentInvoiceId={parentInvoiceId}
                              maxCreditable={getMaxCreditableForInvoice(parentInvoiceId) + (creditNoteInvoice?.total || 0)}
                              onCancel={() => setEditingCreditNoteRow(null)}
                              onSaved={async () => { setEditingCreditNoteRow(null); await load(true); }}
                            />
                          </div>
                        );
                      }
                    }

                    // Only rows that can actually have a payment↔invoice link show the
                    // popover: direct payments, and billed treatments (not unbilled
                    // presupuestos or credit notes, which don't carry `invoice_payments`).
                    const showAllocationsLink = row.kind === 'payment'
                      ? !!row.paymentId
                      : row.kind === 'item' && !!row.invoiceId && ['facturado', 'parcial', 'pagado'].includes(row.status || '');
                    const isHighlighted = !selected && !!row.docNo && highlightedDocNos?.has(row.docNo);
                    return (
                      // Wrapper carries the selection ring so it wraps the row AND its
                      // attached action bar as one unit, un-clipped by the scroll edges.
                      <div
                        key={row.id}
                        className={cn(
                          'rounded-lg',
                          selected && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
                          isHighlighted && 'ring-2 ring-amber-400 ring-offset-2 ring-offset-background',
                        )}
                      >
                        <div
                          role={isBalanceRow ? undefined : 'button'}
                          tabIndex={isBalanceRow ? undefined : 0}
                          onClick={isBalanceRow ? undefined : () => { setCreateDoc(null); setEditingItemRowId(null); setEditingPaymentRowId(null); setEditingCreditNoteRow(null); setSelectedRowId(selected ? null : row.id); }}
                          onKeyDown={isBalanceRow ? undefined : (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCreateDoc(null); setEditingItemRowId(null); setEditingPaymentRowId(null); setEditingCreditNoteRow(null); setSelectedRowId(selected ? null : row.id); } }}
                          className={cn(
                            // Below `sm` this wraps onto two lines: date/title on the first,
                            // Debe/Haber/Saldo (as a full-width mini-grid, see below) on the
                            // second — no more forced horizontal scroll to see the balance.
                            'flex flex-wrap items-center gap-3 border px-3 py-2.5',
                            isBalanceRow ? 'cursor-default italic' : 'cursor-pointer',
                            cardAccentClass(row),
                            selected ? 'rounded-t-lg border-b-0' : 'rounded-lg',
                          )}
                        >
                          <div className="flex w-32 shrink-0 flex-col gap-1">
                            <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDisplayDate(row.date)}</span>
                            {renderStatusCell(row)}
                          </div>
                          <div className="flex min-w-[10rem] flex-1 items-center gap-2">
                            <RowKindIcon row={row} />
                            {row.status === 'presupuestado' && <PresupuestoBadge />}
                            <div className="flex min-w-0 flex-1 flex-col">
                              <span className="truncate text-sm font-medium">
                                {isBalanceRow ? t('openingBalance.label') : row.label}
                              </span>
                              {isBalanceRow ? (
                                <span className="truncate text-xs text-muted-foreground">{t('openingBalance.hint')}</span>
                              ) : (
                                <>
                                  {docNumbersLabel(row, t) && (
                                    <span className="truncate text-xs text-muted-foreground">{docNumbersLabel(row, t)}</span>
                                  )}
                                  {row.dueDate && (
                                    <span className="truncate text-xs text-muted-foreground">{t('docLine.dueDate')}: {formatDisplayDate(row.dueDate)}</span>
                                  )}
                                  {row.notes && (
                                    <span className="truncate text-[11px] italic text-muted-foreground/80">{row.notes}</span>
                                  )}
                                </>
                              )}
                            </div>
                            {showAllocationsLink && (
                              <RowAllocationsPopover row={row} invoiceDocNoById={invoiceDocNoById} serviceLabelByDocNo={serviceLabelByDocNo} onHighlight={setHighlightedDocNos} />
                            )}
                          </div>
                          {/* Debe/Haber/Saldo: `patient-ledger-amounts` becomes `display:contents`
                              once the panel is wide enough, so these three cells rejoin the row
                              as plain fixed-width columns (matching the header above) with no
                              extra box of their own; below that width it's a real full-width flex
                              row that forces itself onto a new line, and each cell gets its own
                              label since the column header is hidden there. */}
                          <div className="patient-ledger-amounts w-full items-center gap-2 border-t border-border/60 pt-2">
                            <div className="patient-ledger-amount-cell text-sm tabular-nums">
                              <div className="patient-ledger-amount-label text-[9px] font-medium uppercase tracking-wide text-muted-foreground">{t('columns.debit')}</div>
                              {fmtAmountZero(row.debe, row.currency)}
                              {row.status === 'presupuestado' && (
                                <div className="text-[10px] font-normal not-italic text-muted-foreground">{t('footer.notCounted')}</div>
                              )}
                            </div>
                            <div className="patient-ledger-amount-cell text-sm tabular-nums">
                              <div className="patient-ledger-amount-label text-[9px] font-medium uppercase tracking-wide text-muted-foreground">{t('columns.credit')}</div>
                              {fmtAmountZero(row.haber, row.currency)}
                            </div>
                            <div className="patient-ledger-amount-cell text-sm font-semibold tabular-nums">
                              <div className="patient-ledger-amount-label text-[9px] font-medium uppercase tracking-wide text-muted-foreground">{t('columns.balance')}</div>
                              {fmtAmountZero(row.runningBalance, row.currency)}
                            </div>
                          </div>
                        </div>
                        {selected && (
                          <div
                            className="flex flex-wrap items-center justify-center gap-2 rounded-b-lg border border-t-0 border-border bg-muted/40 px-3 py-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {renderSelectionActions(row)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Inline create editor — shown just above the footer when a "+" in the footer
              is clicked; otherwise nothing renders here. */}
          {createDoc !== null && (
            <div className="shrink-0">
              {createDoc === 'payment' ? (
                <PaymentInlineEditor
                  userId={userId}
                  patientName={patientName}
                  patientEmail={patientEmail}
                  currency={editorCurrency}
                  pendingInvoices={pendingInvoices}
                  onCancel={() => setCreateDoc(null)}
                  onSaved={handleInlineSaved}
                />
              ) : (
                <QuoteInvoiceInlineEditor
                  doc={createDoc}
                  userId={userId}
                  currency={editorCurrency}
                  onCancel={() => setCreateDoc(null)}
                  onSaved={handleInlineSaved}
                />
              )}
            </div>
          )}

          {/* Footer: create buttons; Total Debe / Total Haber / Saldo Final. Below the same
              panel-width threshold as the rows, the totals drop to their own full-width
              3-column row under the buttons (still no horizontal scroll needed); above it
              they sit inline on the right, each aligned under its ledger column (pr-5
              matches the rows' right inset: wrapper px-2 + card px-3). */}
          <div className="patient-ledger-footer flex shrink-0 gap-3 border-t pl-1 pr-5 pt-3">
            <div className="flex flex-1 flex-wrap items-center gap-2">
              {canCreateQuote && (
                <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => { setSelectedRowId(null); setEditingItemRowId(null); setEditingPaymentRowId(null); setEditingCreditNoteRow(null); setCreateDoc('quote'); }}>
                  <Plus className="h-3.5 w-3.5" /><FileText className="h-3.5 w-3.5" />{t('inline.addQuote')}
                </Button>
              )}
              {canCreateTreatment && (
                <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => { setSelectedRowId(null); setEditingItemRowId(null); setEditingPaymentRowId(null); setEditingCreditNoteRow(null); setCreateDoc('invoice'); }}>
                  <Plus className="h-3.5 w-3.5" /><Receipt className="h-3.5 w-3.5" />{t('inline.addTreatment')}
                </Button>
              )}
              {canCreatePaymentPerm && (
                <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => { setSelectedRowId(null); setEditingItemRowId(null); setEditingPaymentRowId(null); setEditingCreditNoteRow(null); setCreateDoc('payment'); }}>
                  <Plus className="h-3.5 w-3.5" /><Banknote className="h-3.5 w-3.5" />{t('inline.addPayment')}
                </Button>
              )}
            </div>
            <div className="patient-ledger-footer-totals grid grid-cols-3 gap-2">
              <div className="patient-ledger-footer-total-cell text-right">
                <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{t('footer.totalDebit')}</div>
                <div className="text-sm font-semibold tabular-nums">{fmtAmountZero(totals.totalDebe, currency || 'USD')}</div>
              </div>
              <div className="patient-ledger-footer-total-cell text-right">
                <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{t('footer.totalCredit')}</div>
                <div className="text-sm font-semibold tabular-nums">{fmtAmountZero(totals.totalHaber, currency || 'USD')}</div>
              </div>
              <div className="patient-ledger-footer-total-cell text-right">
                <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{t('footer.finalBalance')}</div>
                <div
                  className={cn(
                    'text-sm font-semibold tabular-nums',
                    totals.finalBalance > 0.005
                      ? 'text-red-600 dark:text-red-400'
                      : totals.finalBalance < -0.005
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-foreground',
                  )}
                >
                  {fmtAmountZero(totals.finalBalance, currency || 'USD')}
                </div>
              </div>
            </div>
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

      <Dialog
        open={!!creditNoteRow}
        onOpenChange={(open) => { if (!open) setCreditNoteRow(null); }}
      >
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

    </>
  );
});
PatientLedger.displayName = 'PatientLedger';
