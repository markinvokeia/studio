'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format, parseISO } from 'date-fns';
import { Banknote, Check, ChevronDown, FileMinus, FileText, ListChecks, Loader2, Plus, Printer, Receipt, RefreshCw, ScrollText, Search, Trash2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

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
import { QuoteBillingDialog } from '@/components/sales/quotes/quote-billing-dialog';
import { SALES_PERMISSIONS } from '@/constants/permissions';
import { API_ROUTES } from '@/constants/routes';
import { useAuth } from '@/context/AuthContext';
import { useCashSessionValidation } from '@/hooks/use-cash-session-validation';
import { useClinicInfo } from '@/hooks/useClinicInfo';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { buildPatientLedger, type LedgerRow, type LedgerRowStatus } from '@/lib/patient-ledger';
import type { PaymentMethod, Quote, QuoteItem } from '@/lib/types';
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
  onPrintSummary?: () => void;
  onViewStatement?: () => void;
  /** When true, the internal toolbar hides its Print/Refresh icons — used by the
   *  account-statement sheet, which surfaces them in its own header instead. */
  hideToolbarActions?: boolean;
  /** Controlled search term. When provided, the ledger filters by it and hides its own
   *  in-toolbar search box (the host renders the search UI itself, e.g. in a header). */
  searchTerm?: string;
}

/** Imperative handle so hosts (e.g. the account-statement sheet header) can trigger a
 *  reload without owning the ledger's data-loading state. */
export interface PatientLedgerHandle {
  refresh: () => void;
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

function fmtAmount(amount: number, currency: string) {
  if (!amount) return '—';
  return `${currencySymbol(currency)}${fmtNumber2(amount)}`;
}

/** Like `fmtAmount` but renders 0 as "<symbol>0,00" instead of a dash — used for the
 *  Debe/Haber columns, which should always show a number (0 when the side doesn't apply). */
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

// ── Inline editor primitives ──────────────────────────────────────────────────

/** Green confirm (submit) + red circular cancel — shared by every inline editor. */
function EditorControls({ submitting, onCancel }: { submitting: boolean; onCancel: () => void }) {
  const t = useTranslations('PatientLedger');
  return (
    <>
      <Button
        type="submit"
        size="icon"
        disabled={submitting}
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

/**
 * Lays out an inline editor line on the same column grid as the ledger rows so the
 * Debe/Haber editors always sit under the Debit/Credit columns, whatever the document
 * type. Secondary fields flow onto an aligned second line that leaves the Debe/Haber/
 * controls columns empty so nothing shifts.
 */
function InlineEditorShell({ docLabel, dateSlot, mainSlot, debeSlot, haberSlot, controls, secondLine, belowSlot }: {
  docLabel: React.ReactNode;
  dateSlot: React.ReactNode;
  mainSlot: React.ReactNode;
  debeSlot: React.ReactNode;
  haberSlot: React.ReactNode;
  controls: React.ReactNode;
  secondLine?: React.ReactNode;
  /** Optional full-width area rendered below both lines (e.g. the payment allocations). */
  belowSlot?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-primary/50 bg-primary/5 px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
      {/* Line 1: date · main fields · Debe · Haber · confirm/cancel */}
      <div className="flex items-center gap-3">
        <div className="w-32 shrink-0 text-sm text-muted-foreground">{dateSlot}</div>
        <div className="min-w-[10rem] flex-1">{mainSlot}</div>
        <div className="w-24 shrink-0">{debeSlot}</div>
        <div className="w-24 shrink-0">{haberSlot}</div>
        <div className="flex w-24 shrink-0 items-center justify-end gap-1">{controls}</div>
      </div>
      {/* Line 2: type badge (under the date) · secondary fields */}
      {secondLine && (
        <div className="mt-2 flex items-start gap-3">
          <div className="flex w-32 shrink-0 items-center">
            <Badge variant="outline" className="text-[10px]">{docLabel}</Badge>
          </div>
          <div className="flex min-w-[10rem] flex-1 flex-wrap items-center gap-2">{secondLine}</div>
          <div className="w-24 shrink-0" />
          <div className="w-24 shrink-0" />
          <div className="w-24 shrink-0" />
        </div>
      )}
      {belowSlot}
    </div>
  );
}

/** A disabled "0" placeholder for the Debe/Haber column that's not active in a given
 *  editor, keeping the row visually complete and aligned. */
function DisabledAmountCell() {
  return <div className="flex h-8 items-center justify-end pr-1 text-sm text-muted-foreground">0,00</div>;
}

const quoteEditorSchema = z.object({
  created_at: z.date(),
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
 * Enables the Debe editor; Haber is disabled. In edit mode (`editRow` set) it shows the
 * full field set pre-filled from the quote + its item, and saves the whole quote via
 * `QUOTES_UPSERT` by id — passing every sibling item so nothing is lost — the same
 * upsert-by-id pattern the standalone quote editor uses.
 */
function QuoteInvoiceInlineEditor({ doc, editRow, editQuote, editItems, userId, currency, onCancel, onSaved }: {
  doc: 'quote' | 'invoice';
  editRow?: LedgerRow;
  /** The full quote behind `editRow` (for quote-level fields: date, doctor, notes). */
  editQuote?: Quote;
  /** Every item of that quote, so the whole set is re-sent on save (no data loss). */
  editItems?: QuoteItem[];
  userId: string;
  currency: string;
  onCancel: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const t = useTranslations('PatientLedger');
  const { toast } = useToast();
  const isEdit = !!editRow;
  const [submitting, setSubmitting] = React.useState(false);
  const editItem = editItems?.find((i) => i.id === editRow?.itemId);
  const [doctorName, setDoctorName] = React.useState(editQuote?.doctor_name || '');

  const form = useForm<QuoteEditorValues>({
    resolver: zodResolver(quoteEditorSchema),
    defaultValues: {
      created_at: editQuote?.createdAt ? new Date(editQuote.createdAt) : editRow?.date ? new Date(editRow.date) : new Date(),
      service_id: editItem?.service_id || editRow?.serviceId || '',
      service_name: editItem?.service_name || editRow?.label || '',
      tooth_number: editItem?.tooth_number != null ? String(editItem.tooth_number) : '',
      quantity: editItem?.quantity || editRow?.quantity || 1,
      unit_price: editItem?.unit_price ?? editRow?.unitPrice ?? 0,
      doctor_id: editQuote?.doctor_id || '',
      description: editQuote?.notes || '',
    },
  });
  const watchedName = form.watch('service_name');
  const createdAt = form.watch('created_at');

  const onSubmit = async (values: QuoteEditorValues) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const qty = values.quantity || 1;
      const tooth = values.tooth_number ? Number(values.tooth_number) : null;
      const createdAtIso = toLocalISOString(preserveTimeIfToday(values.created_at));
      if (isEdit) {
        // Re-send the whole quote (all sibling items preserved), overriding the edited
        // line, so quote-level fields (date, doctor, notes) and the line save together.
        const items = (editItems && editItems.length > 0 ? editItems : (editItem ? [editItem] : []))
          .map((i) => i.id === editRow!.itemId
            ? { id: i.id, service_id: values.service_id, quantity: qty, unit_price: values.unit_price, total: qty * values.unit_price, tooth_number: tooth }
            : { id: i.id, service_id: i.service_id, quantity: i.quantity, unit_price: i.unit_price, total: i.total, tooth_number: i.tooth_number ?? null });
        const total = items.reduce((sum, i) => sum + (i.total || 0), 0);
        const res = await api.post(API_ROUTES.SALES.QUOTES_UPSERT, {
          id: editRow!.quoteId,
          user_id: userId,
          // Only send doctor_id when set, so an unknown original doctor is never blanked.
          ...(values.doctor_id ? { doctor_id: values.doctor_id } : {}),
          total,
          currency,
          status: 'draft',
          payment_status: 'unpaid',
          billing_status: 'not invoiced',
          exchange_rate: editQuote?.exchange_rate ?? 1,
          created_at: createdAtIso,
          notes: values.description || '',
          patient_confirmed: false,
          items,
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
            currency,
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
            currency,
            created_at: createdAtIso,
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

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <InlineEditorShell
        docLabel={t(doc === 'quote' ? 'inline.addQuote' : 'inline.addTreatment')}
        dateSlot={
          <DatePickerInput
            value={format(createdAt, 'yyyy-MM-dd')}
            onChange={(iso) => iso && form.setValue('created_at', parseISO(iso))}
            className="h-8 text-xs"
          />
        }
        mainSlot={
          <div className="flex items-center gap-2">
            <div className="min-w-[8rem] flex-1">
              <ServiceSelector
                isSales
                value={form.watch('service_id')}
                selectedServiceName={watchedName}
                onValueChange={(serviceId, service) => {
                  form.setValue('service_id', serviceId, { shouldValidate: true });
                  if (service) {
                    form.setValue('service_name', service.name);
                    form.setValue('unit_price', Number(service.price) || 0);
                  }
                }}
                placeholder={t('fields.searchService')}
                triggerText={t('fields.selectService')}
                className="h-8"
              />
            </div>
            <Input
              type="number"
              placeholder={t('fields.tooth')}
              aria-label={t('fields.tooth')}
              className="h-8 w-16 shrink-0 text-sm"
              {...form.register('tooth_number')}
            />
            <Input
              type="number"
              min={1}
              placeholder={t('fields.quantity')}
              aria-label={t('fields.quantity')}
              className="h-8 w-14 shrink-0 text-sm"
              {...form.register('quantity')}
            />
          </div>
        }
        debeSlot={
          <Input
            type="number"
            step="0.01"
            min="0"
            aria-label={t('fields.price')}
            className="h-8 text-right text-sm"
            {...form.register('unit_price')}
          />
        }
        haberSlot={<DisabledAmountCell />}
        controls={<EditorControls submitting={submitting} onCancel={onCancel} />}
        secondLine={
          <>
            <div className="min-w-[10rem] flex-1">
              <DoctorSelector
                value={form.watch('doctor_id')}
                selectedDoctorName={doctorName}
                onValueChange={(doctorId, doctor) => {
                  form.setValue('doctor_id', doctorId);
                  setDoctorName(doctor?.name || '');
                }}
                placeholder={t('fields.searchDoctor')}
                triggerText={t('fields.selectDoctor')}
                className="h-8"
              />
            </div>
            <Input
              placeholder={t('fields.notes')}
              aria-label={t('fields.notes')}
              className="h-8 min-w-[10rem] flex-1 text-sm"
              {...form.register('description')}
            />
          </>
        }
      />
    </form>
  );
}

const paymentEditorSchema = z.object({
  created_at: z.date(),
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
 * (`is_prepaid: true`). When the user picks "seleccionar tratamientos pendientes" it
 * additionally sends `invoice_allocations` so the backend books that one payment against
 * the chosen invoices (oldest-first by default, user-adjustable, sum must equal the total).
 */
function PaymentInlineEditor({ userId, patientName, patientEmail, currency, pendingInvoices, onCancel, onSaved }: {
  userId: string;
  patientName?: string;
  patientEmail?: string;
  currency: string;
  pendingInvoices: PendingInvoiceLite[];
  onCancel: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const t = useTranslations('PatientLedger');
  const { toast } = useToast();
  const { user: operator, checkActiveSession } = useAuth();
  const { validateActiveSession, showCashSessionError } = useCashSessionValidation();
  const [submitting, setSubmitting] = React.useState(false);
  const [paymentMethods, setPaymentMethods] = React.useState<PaymentMethod[]>([]);

  React.useEffect(() => { void getPaymentMethods().then(setPaymentMethods); }, []);

  const form = useForm<PaymentEditorValues>({
    resolver: zodResolver(paymentEditorSchema),
    defaultValues: { created_at: new Date(), payment_amount: 0, payment_method_id: '', notes: '', is_historical: false },
  });
  const createdAt = form.watch('created_at');
  const isHistorical = form.watch('is_historical');
  const amount = form.watch('payment_amount') || 0;

  // Pending invoices in this payment's currency, oldest first (FIFO distribution order).
  const sortedPending = React.useMemo(
    () => pendingInvoices
      .filter((p) => p.currency === currency)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [pendingInvoices, currency],
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

  const allocated = round2(Object.values(alloc).reduce((s, a) => s + a, 0));
  const difference = round2(amount - allocated);
  const allocMismatch = showAllocations && Math.abs(difference) > 0.005;

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

  const setInvoiceAmount = (inv: PendingInvoiceLite, value: number) => {
    setAllocManual(true);
    setAlloc((prev) => ({ ...prev, [inv.id]: round2(Math.max(0, Math.min(inv.pending, value || 0))) }));
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
    const invoiceAllocations = Object.entries(alloc)
      .filter(([, a]) => a > 0.005)
      .map(([id, a]) => ({ invoice_id: Number(id), amount: a }));
    if (showAllocations) {
      if (invoiceAllocations.length === 0 || Math.abs(round2(values.payment_amount - allocated)) > 0.005) {
        toast({ title: t('allocations.mismatch', { amount: fmtAmountZero(difference, currency) }), variant: 'destructive' });
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
          invoice_currency: currency,
          payment_currency: currency,
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
        docLabel={t('inline.addPayment')}
        dateSlot={
          <DatePickerInput
            value={format(createdAt, 'yyyy-MM-dd')}
            onChange={(iso) => iso && form.setValue('created_at', parseISO(iso))}
            className="h-8 text-xs"
          />
        }
        mainSlot={
          <Select value={form.watch('payment_method_id')} onValueChange={(v) => form.setValue('payment_method_id', v, { shouldValidate: true })}>
            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder={t('fields.selectMethod')} /></SelectTrigger>
            <SelectContent>
              {paymentMethods.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
            </SelectContent>
          </Select>
        }
        debeSlot={<DisabledAmountCell />}
        haberSlot={
          <FormattedNumberInput
            value={form.watch('payment_amount')}
            onChange={(v) => form.setValue('payment_amount', v, { shouldValidate: true })}
            placeholder="0.00"
            className="h-8 text-right text-sm"
          />
        }
        controls={<EditorControls submitting={submitting} onCancel={onCancel} />}
        secondLine={
          <>
            <Input
              placeholder={t('fields.notes')}
              aria-label={t('fields.notes')}
              className="h-8 min-w-[8rem] flex-1 text-sm"
              {...form.register('notes')}
            />
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
              <Checkbox checked={isHistorical} onCheckedChange={(c) => form.setValue('is_historical', !!c)} />
              {t('fields.historical')}
            </label>
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
          </>
        }
        belowSlot={showAllocations && (
          <div className="mt-3 rounded-md border border-border bg-background/70 p-2.5">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-medium">{t('allocations.title')}</span>
              <span className={cn('tabular-nums', allocMismatch ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400')}>
                {t('allocations.allocated')}: {fmtAmountZero(allocated, currency)} / {fmtAmountZero(amount, currency)}
                {allocMismatch && ` · ${t('allocations.difference', { amount: fmtAmountZero(difference, currency) })}`}
              </span>
            </div>
            {sortedPending.length === 0 ? (
              <div className="py-2 text-center text-xs text-muted-foreground">{t('allocations.noPending')}</div>
            ) : (
              <div className="space-y-1.5">
                {sortedPending.map((inv) => {
                  const included = inv.id in alloc;
                  return (
                    <div key={inv.id} className="flex items-center gap-2 text-xs">
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
                        className={cn('h-7 w-24 shrink-0 text-right text-xs', !included && 'opacity-50')}
                      />
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

export const PatientLedger = React.forwardRef<PatientLedgerHandle, PatientLedgerProps>(function PatientLedger({ userId, patientName, patientEmail, refreshTrigger, onPrintSummary, onViewStatement, hideToolbarActions, searchTerm: searchTermProp }: PatientLedgerProps, ref) {
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

  const [billingQuote, setBillingQuote] = React.useState<Quote | null>(null);
  const [billingItemId, setBillingItemId] = React.useState<string | null>(null);
  const [creditNoteRow, setCreditNoteRow] = React.useState<LedgerRow | null>(null);
  const [isSubmittingCreditNote, setIsSubmittingCreditNote] = React.useState(false);

  // Inline editing state: `createDoc` drives the floating-bar → inline-create editor;
  // `selectedRowId` drives row selection (inline presupuesto edit + action bar).
  const [createDoc, setCreateDoc] = React.useState<'quote' | 'invoice' | 'payment' | null>(null);
  const [selectedRowId, setSelectedRowId] = React.useState<string | null>(null);
  const [searchOpen, setSearchOpen] = React.useState(false);

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

  React.useImperativeHandle(ref, () => ({ refresh: () => { void load(true); } }), [load]);

  const currencies = Object.keys(ledgerByCurrency);
  const rows = React.useMemo(
    () => (currency ? ledgerByCurrency[currency] || [] : []),
    [currency, ledgerByCurrency],
  );

  // Currency used by the inline create editor (ledger's own currency, else clinic default).
  const editorCurrency = currency || clinicInfo?.currency || 'UYU';

  // Reset transient inline state whenever the underlying rows change (after a reload).
  const closeInline = React.useCallback(() => { setCreateDoc(null); setSelectedRowId(null); }, []);
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

  /**
   * En curso → Finalizado: pays the invoice's single line in full, purely from the
   * patient's available credit (built up via "Nuevo Pago", which now only ever creates a
   * prepayment/credit — never applies cash to an invoice directly). When the available
   * credit falls short, the action is silently a no-op — the row stays at its current
   * status without any warning dialog or toast.
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
  }, [canInvoiceQuote, canCreateCreditNote, canDeleteQuote, canDeletePayment, canDeleteCreditNote, canRevertInvoice, getMaxCreditableForInvoice, handleInvoice, handleCreditNote, handleDeleteRow, t]);

  // Search may be controlled by a host (the sheet renders the search box in its header);
  // otherwise the ledger keeps its own state and shows an expandable search in the toolbar.
  const [internalSearch, setInternalSearch] = React.useState('');
  const isSearchControlled = searchTermProp !== undefined;
  const search = isSearchControlled ? searchTermProp! : internalSearch;
  const filteredRows = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => row.label.toLowerCase().includes(term) || (row.docNo || '').toLowerCase().includes(term));
  }, [rows, search]);

  // Column totals for the footer. A presupuesto with no invoice behind it isn't a debt
  // yet, so its Debe is shown in the row but excluded from Total Debe (same rule the
  // running balance uses). The final balance is the last running balance (positive =
  // debt, negative = credit in favour).
  const totals = React.useMemo(() => ({
    totalDebe: round2(rows.reduce((s, r) => s + (r.status === 'presupuestado' ? 0 : r.debe), 0)),
    totalHaber: round2(rows.reduce((s, r) => s + r.haber, 0)),
    finalBalance: rows.length > 0 ? rows[rows.length - 1].runningBalance : 0,
  }), [rows]);

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

  const showToolbar = !isSearchControlled || !!onViewStatement || currencies.length > 1 || !hideToolbarActions;

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
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
      {currencies.length > 1 && (
        <Select value={currency ?? undefined} onValueChange={setCurrency}>
          <SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {currencies.map((c) => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
      {!hideToolbarActions && (
        <div className="ml-auto flex items-center gap-1">
          {onPrintSummary && (
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={onPrintSummary}>
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
        <CardContent className="flex-1 flex flex-col min-h-0 gap-3 p-4">
          {showToolbar && toolbar}

          {/* Both axes scroll on this one container so the sticky header stays column-
              aligned with the cards when the panel is too narrow to fit every column —
              Tailwind's `sm:` breakpoints track viewport width, not this (often-narrower)
              panel's own width, so they can't be relied on here; a horizontal scrollbar
              is more reliable than trying to squeeze/wrap the columns at any width. */}
          <div className="min-h-0 flex-1 overflow-auto">
            {/* px-2 gives the selected-row ring room so it isn't clipped by the scroll
                container's edges; header and rows share the padding so columns stay aligned. */}
            <div className="w-full min-w-max px-2">
              <div className="sticky top-0 z-10 flex items-center gap-3 bg-card px-3 py-2 text-xs font-medium text-muted-foreground">
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
                    const selected = selectedRowId === row.id;
                    return (
                      // Wrapper carries the selection ring so it wraps the row AND its
                      // attached action bar as one unit, un-clipped by the scroll edges.
                      <div key={row.id} className={cn('rounded-lg', selected && 'ring-2 ring-primary ring-offset-2 ring-offset-background')}>
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => { setCreateDoc(null); setSelectedRowId(selected ? null : row.id); }}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCreateDoc(null); setSelectedRowId(selected ? null : row.id); } }}
                          className={cn(
                            'flex cursor-pointer items-center gap-3 border px-3 py-2.5',
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
                            <div className="flex min-w-0 flex-col">
                              <span className="truncate text-sm font-medium">{row.label}</span>
                              {docNumbersLabel(row, t) && (
                                <span className="truncate text-xs text-muted-foreground">{docNumbersLabel(row, t)}</span>
                              )}
                              {row.notes && (
                                <span className="truncate text-[11px] italic text-muted-foreground/80">{row.notes}</span>
                              )}
                            </div>
                          </div>
                          <div className="w-24 shrink-0 text-right text-sm tabular-nums">
                            {fmtAmountZero(row.debe, row.currency)}
                            {row.status === 'presupuestado' && (
                              <div className="text-[10px] font-normal not-italic text-muted-foreground">{t('footer.notCounted')}</div>
                            )}
                          </div>
                          <div className="w-24 shrink-0 text-right text-sm tabular-nums">{fmtAmountZero(row.haber, row.currency)}</div>
                          <div className="w-24 shrink-0 text-right text-sm font-semibold tabular-nums">{fmtAmount(row.runningBalance, row.currency)}</div>
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

          {/* Footer: create buttons on the left; Total Debe / Total Haber / Saldo Final
              column totals on the right, each aligned under its ledger column (pr-5 matches
              the rows' right inset: wrapper px-2 + card px-3). */}
          <div className="flex shrink-0 items-end gap-3 border-t pl-1 pr-5 pt-3">
            <div className="flex flex-1 flex-wrap items-center gap-2">
              {canCreateQuote && (
                <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => { setSelectedRowId(null); setCreateDoc('quote'); }}>
                  <Plus className="h-3.5 w-3.5" /><FileText className="h-3.5 w-3.5" />{t('inline.addQuote')}
                </Button>
              )}
              {canCreateTreatment && (
                <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => { setSelectedRowId(null); setCreateDoc('invoice'); }}>
                  <Plus className="h-3.5 w-3.5" /><Receipt className="h-3.5 w-3.5" />{t('inline.addTreatment')}
                </Button>
              )}
              {canCreatePaymentPerm && (
                <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => { setSelectedRowId(null); setCreateDoc('payment'); }}>
                  <Plus className="h-3.5 w-3.5" /><Banknote className="h-3.5 w-3.5" />{t('inline.addPayment')}
                </Button>
              )}
            </div>
            <div className="w-24 shrink-0 text-right">
              <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{t('footer.totalDebit')}</div>
              <div className="text-sm font-semibold tabular-nums">{fmtAmountZero(totals.totalDebe, currency || 'USD')}</div>
            </div>
            <div className="w-24 shrink-0 text-right">
              <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{t('footer.totalCredit')}</div>
              <div className="text-sm font-semibold tabular-nums">{fmtAmountZero(totals.totalHaber, currency || 'USD')}</div>
            </div>
            <div className="w-24 shrink-0 text-right">
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

    </>
  );
});
PatientLedger.displayName = 'PatientLedger';
