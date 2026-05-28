'use client';

import * as React from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { AlertTriangle, ArrowLeft, ArrowRight, Box, CalendarIcon, CheckCircle2, ChevronDown, ChevronRight, CreditCard, Loader2, Plus, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { FormattedNumberInput } from '@/components/ui/formatted-number-input';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CASHIER_PERMISSIONS } from '@/constants/permissions';
import { API_ROUTES } from '@/constants/routes';
import { useAuth } from '@/context/AuthContext';
import { useCashSessionValidation } from '@/hooks/use-cash-session-validation';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import type { Credit, Invoice, PaymentMethod } from '@/lib/types';
import { cn, toLocalISOString } from '@/lib/utils';
import { api } from '@/services/api';

// ── Schema ────────────────────────────────────────────────────────────────────

const entrySchema = z.object({
  method: z.string().min(1, 'Método requerido'),
  amount: z.coerce.number().positive('Monto debe ser positivo'),
  payment_currency: z.string(),
  created_at: z.date({ required_error: 'Fecha requerida' }),
});

const formSchema = z.object({
  entries: z.array(entrySchema).min(1),
  exchange_rate: z.coerce.number().optional(),
  notes: z.string().optional(),
  is_historical: z.boolean().optional(),
});

type FormValues = z.infer<typeof formSchema>;

// ── Types ─────────────────────────────────────────────────────────────────────

function extractRawPayment(response: any) {
  if (Array.isArray(response)) return response[0];
  if (response?.data && Array.isArray(response.data)) return response.data[0];
  if (response?.result && Array.isArray(response.result)) return response.result[0];
  if (response?.payment) return response.payment;
  return response?.data ?? response;
}

export interface CreatedPayment {
  docNo?: string;
  transactionId?: string;
  transactionType?: string;
  methodName?: string;
  amount?: number;
  currency?: string;
  date?: string;
  /** True when this payment was created in the current wizard session. */
  isNew?: boolean;
}

export interface PaymentResult {
  payments: CreatedPayment[];
  invoiceDocNo?: string;
  invoiceId?: string;
  totalPaid?: number;
  currency?: string;
  remainingAfterPayment?: number;
  appliedCredits?: Array<{ source_id: string; amount: number; currency: string; type: string }>;
  creditsTotal?: number;
}

interface InvoiceAllocation {
  invoice: Invoice;
  amount: number;
}

interface StepPaymentProps {
  invoice: Invoice;
  /** When provided, payment is distributed across these invoices instead of a single invoice */
  invoices?: Invoice[];
  isSales: boolean;
  onPaymentSuccess: (result: PaymentResult) => void;
  onSkipPayment: (invoiceDocNo?: string) => void;
  isSubmitting: boolean;
  setIsSubmitting: (v: boolean) => void;
  /** When true, hides "Solo facturar" — invoice already exists, this step is collect-only */
  paymentOnly?: boolean;
  /** When true, shows a "Factura creada" indicator on the invoice summary */
  invoiceJustCreated?: boolean;
  /** Called when the internal credit sub-step changes (0 = credit selection, 1 = payment form) */
  onSubStepChange?: (subStep: 0 | 1) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtCurrency(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('es-UY', { style: 'currency', currency }).format(amount);
}

function fmtDateTime(dateStr?: string): string | null {
  if (!dateStr) return null;
  try {
    return new Intl.DateTimeFormat('es-UY', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(dateStr));
  } catch {
    return null;
  }
}

interface InvoiceLineItem {
  id: string;
  description: string;
  toothNumber?: number;
  quantity: number;
  total: number;
}

interface InvoicePaymentEntry {
  id: string;
  docNo?: string;
  method?: string;
  date?: string;
  amount: number;
  currency: string;
}

interface InvoiceDetail {
  items: InvoiceLineItem[];
  payments: InvoicePaymentEntry[];
}

async function fetchInvoiceDetail(
  invoiceId: string,
  isSales: boolean,
  fallbackCurrency: string,
): Promise<InvoiceDetail> {
  const itemsEndpoint = isSales ? API_ROUTES.SALES.INVOICE_ITEMS : API_ROUTES.PURCHASES.INVOICE_ITEMS;
  const paymentsEndpoint = isSales ? API_ROUTES.SALES.INVOICE_PAYMENTS : API_ROUTES.PURCHASES.INVOICE_PAYMENTS;
  const params = { invoice_id: invoiceId, is_sales: isSales ? 'true' : 'false' };
  const [itemsData, paymentsData] = await Promise.all([
    api.get(itemsEndpoint, params).catch(() => []),
    api.get(paymentsEndpoint, params).catch(() => []),
  ]);
  const rawItems: any[] = Array.isArray(itemsData) ? itemsData : (itemsData.invoice_items || itemsData.data || []);
  const rawPayments: any[] = Array.isArray(paymentsData) ? paymentsData : (paymentsData.payments || paymentsData.data || []);
  const items: InvoiceLineItem[] = rawItems.map((item: any) => ({
    id: String(item.id || item.invoice_item_id || Math.random()),
    description: item.service_name || item.description || item.name || `Servicio #${item.service_id}`,
    toothNumber: item.tooth_number ? Number(item.tooth_number) : undefined,
    quantity: Number(item.quantity || 1),
    total: Math.abs(Number(item.total || item.amount || 0)),
  }));
  const payments: InvoicePaymentEntry[] = rawPayments
    .filter((p: any) => p?.status !== 'failed' && (p?.transaction_id || p?.id))
    .map((p: any) => ({
      id: String(p.transaction_id ?? p.id),
      docNo: p.doc_no || p.payment_doc_no || undefined,
      method: p.method || p.payment_method || undefined,
      date: p.payment_date || p.created_at || undefined,
      amount: Math.abs(Number(p.amount_applied ?? p.amount ?? 0)),
      currency: p.currency || fallbackCurrency,
    }));
  return { items, payments };
}

function calcEquivalent(amount: number, fromCurrency: string, toCurrency: string, rate: number): number {
  if (fromCurrency === toCurrency || !rate) return amount;
  if (toCurrency === 'USD' && fromCurrency === 'UYU') return amount / rate;
  if (toCurrency === 'UYU' && fromCurrency === 'USD') return amount * rate;
  return amount;
}

function distributePayment(invoices: Invoice[], total: number): InvoiceAllocation[] {
  const result: InvoiceAllocation[] = [];
  let remaining = total;
  for (const inv of invoices) {
    if (remaining <= 0.001) break;
    const pending = Math.max(0, (inv.total || 0) - (inv.paid_amount || 0));
    const allocated = Math.min(pending, remaining);
    if (allocated > 0.001) {
      result.push({ invoice: inv, amount: allocated });
      remaining -= allocated;
    }
  }
  return result;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function StepPayment({
  invoice,
  invoices,
  isSales,
  onPaymentSuccess,
  onSkipPayment,
  isSubmitting,
  setIsSubmitting,
  paymentOnly = false,
  invoiceJustCreated = false,
  onSubStepChange,
}: StepPaymentProps) {
  const isMultiInvoice = !!invoices && invoices.length > 0;
  const t = useTranslations('InvoicesPage');
  const locale = useLocale();
  const { user, checkActiveSession, activeCashSession } = useAuth();
  const { validateActiveSession } = useCashSessionValidation();
  const { hasPermission } = usePermissions();
  const { toast } = useToast();
  const canAccessCashier = hasPermission(CASHIER_PERMISSIONS.VIEW_MENU);

  const [paymentMethods, setPaymentMethods] = React.useState<PaymentMethod[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [isNoSessionAlertOpen, setIsNoSessionAlertOpen] = React.useState(false);

  // ── Credit state ──
  const [userCredits, setUserCredits] = React.useState<Credit[]>([]);
  const [appliedCredits, setAppliedCredits] = React.useState<Map<string, number>>(new Map());
  const [creditSubStep, setCreditSubStep] = React.useState<0 | 1>(1);
  const [isLoadingCredits, setIsLoadingCredits] = React.useState(true);
  const [creditSubmitError, setCreditSubmitError] = React.useState<string | null>(null);
  const [creditCapWarning, setCreditCapWarning] = React.useState(false);

  // ── Invoice detail state ──
  const [invoiceDetailExpanded, setInvoiceDetailExpanded] = React.useState(false);
  const [invoiceDetail, setInvoiceDetail] = React.useState<InvoiceDetail | null | undefined>(undefined);
  const invoiceDetailLoadedRef = React.useRef(false);

  const sessionExchangeRate = React.useMemo<number>(() => {
    const rate = activeCashSession?.data?.opening_details?.date_rate;
    return rate && Number(rate) > 0 ? Number(rate) : 1;
  }, [activeCashSession]);

  const invoiceCurrency = invoice.currency || 'USD';
  const paidAmount = invoice.paid_amount || 0;
  const pendingAmount = isMultiInvoice
    ? invoices!.reduce((sum, inv) => sum + Math.max(0, (inv.total || 0) - (inv.paid_amount || 0)), 0)
    : Math.max(0, (invoice.total || 0) - paidAmount);

  // ── Credits total (converted to invoice currency) ──
  const creditsTotalConverted = React.useMemo(() => {
    return Array.from(appliedCredits.entries()).reduce((sum, [id, amount]) => {
      const credit = userCredits.find((c) => c.source_id === id);
      if (!credit) return sum;
      return sum + calcEquivalent(amount, credit.currency, invoiceCurrency, sessionExchangeRate);
    }, 0);
  }, [appliedCredits, userCredits, invoiceCurrency, sessionExchangeRate]);

  const pendingAmountAfterCredits = Math.max(0, pendingAmount - creditsTotalConverted);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      entries: [
        {
          method: '',
          amount: pendingAmount,
          payment_currency: invoiceCurrency,
          created_at: new Date(),
        },
      ],
      exchange_rate: sessionExchangeRate,
      notes: '',
      is_historical: false,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'entries',
  });

  const watchedEntries = useWatch({ control: form.control, name: 'entries' });
  const watchedExchangeRate = useWatch({ control: form.control, name: 'exchange_rate' });

  // Sync exchange rate with session rate when dialog opens
  React.useEffect(() => {
    form.setValue('exchange_rate', sessionExchangeRate);
  }, [sessionExchangeRate, form]);

  // When transitioning to sub-step 1 or when credits change, sync entries[0].amount
  React.useEffect(() => {
    if (creditSubStep === 1) {
      form.setValue('entries.0.amount', pendingAmountAfterCredits);
    }
  }, [pendingAmountAfterCredits, creditSubStep]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch payment methods
  React.useEffect(() => {
    api.get(API_ROUTES.PAYMENT_METHODS).then((data) => {
      const raw = Array.isArray(data) ? data : (data.payment_methods || data.data || []);
      setPaymentMethods(raw.map((m: any) => ({ ...m, id: String(m.id) })));
    }).catch(() => {});
  }, []);

  // Fetch user credits (skip for credit_note type invoices)
  React.useEffect(() => {
    const userId = invoice.user_id;
    if (!userId || invoice.type === 'credit_note') {
      setIsLoadingCredits(false);
      setCreditSubStep(1);
      onSubStepChange?.(1);
      return;
    }
    setIsLoadingCredits(true);
    api.get(API_ROUTES.USER_CREDIT, { user_id: userId })
      .then((data: any) => {
        const valid: Credit[] = Array.isArray(data)
          ? data.filter((c: any) => c?.source_id && c?.available_balance !== undefined && Number(c.available_balance) > 0)
          : [];
        setUserCredits(valid);
        if (valid.length > 0) {
          setCreditSubStep(0);
          onSubStepChange?.(0);
        } else {
          setCreditSubStep(1);
          onSubStepChange?.(1);
        }
      })
      .catch(() => {
        setCreditSubStep(1);
        onSubStepChange?.(1);
      })
      .finally(() => setIsLoadingCredits(false));
  }, [invoice.user_id, invoice.type]); // eslint-disable-line react-hooks/exhaustive-deps

  // Whether any entry uses a different currency than the invoice
  const hasCrossCurrency = React.useMemo(
    () => (watchedEntries || []).some((e) => e.payment_currency && e.payment_currency !== invoiceCurrency),
    [watchedEntries, invoiceCurrency],
  );

  // Total of all entries converted to invoice currency
  const totalInInvoiceCurrency = React.useMemo(() => {
    const rate = watchedExchangeRate || sessionExchangeRate || 1;
    return (watchedEntries || []).reduce((sum, entry) => {
      const amount = Number(entry.amount) || 0;
      return sum + calcEquivalent(amount, entry.payment_currency || invoiceCurrency, invoiceCurrency, rate);
    }, 0);
  }, [watchedEntries, watchedExchangeRate, sessionExchangeRate, invoiceCurrency]);

  const remainingAfterPayment = Math.max(
    0,
    Math.round((pendingAmountAfterCredits - totalInInvoiceCurrency) * 100) / 100,
  );

  const invoiceDistribution = React.useMemo(() => {
    if (!isMultiInvoice) return [];
    return distributePayment(invoices!, totalInInvoiceCurrency);
  }, [isMultiInvoice, invoices, totalInInvoiceCurrency]);

  const handleAddEntry = () => {
    append({
      method: '',
      amount: Math.max(0, remainingAfterPayment),
      payment_currency: invoiceCurrency,
      created_at: new Date(),
    });
  };

  const handleToggleInvoiceDetail = async () => {
    if (isMultiInvoice) return;
    setInvoiceDetailExpanded((v) => !v);
    if (invoiceDetailLoadedRef.current) return;
    invoiceDetailLoadedRef.current = true;
    setInvoiceDetail(null);
    try {
      const detail = await fetchInvoiceDetail(invoice.id, isSales, invoiceCurrency);
      setInvoiceDetail(detail);
    } catch {
      setInvoiceDetail({ items: [], payments: [] });
    }
  };

  // Build the credit_payment array for the API payload
  const buildCreditPayload = () =>
    Array.from(appliedCredits.entries()).map(([id, amount]) => {
      const credit = userCredits.find((c) => c.source_id === id);
      return {
        source_id: id,
        amount,
        type: credit?.type || 'prepaid',
        currency: credit?.currency || invoiceCurrency,
        exchange_rate: credit?.currency === invoiceCurrency ? 1 : sessionExchangeRate,
      };
    });

  // Submit when credits cover 100% of pending (no cash payment needed)
  const handleCreditOnlySubmit = async () => {
    const isHistorical = form.getValues('is_historical') || false;
    let sessionId: string | null = null;
    if (!isHistorical) {
      const sessionValidation = await validateActiveSession();
      if (!sessionValidation.isValid) {
        setIsNoSessionAlertOpen(true);
        return;
      }
      sessionId = sessionValidation.sessionId || null;
    }

    setCreditSubmitError(null);
    setIsSubmitting(true);

    const endpoint = isSales ? API_ROUTES.SALES.INVOICE_PAYMENT : API_ROUTES.PURCHASES.INVOICE_PAYMENT;
    const createdPayments: CreatedPayment[] = [];

    try {
      const payload = {
        cash_session_id: sessionId,
        user,
        client_user: {
          id: invoice.user_id,
          name: invoice.user_name || '',
          email: invoice.userEmail || '',
        },
        credit_payment: buildCreditPayload(),
        query: {
          invoice_id: parseInt(invoice.id, 10),
          payment_date: toLocalISOString(new Date()),
          amount: 0,
          converted_amount: 0,
          method: 'Credit',
          payment_method_id: '',
          status: 'completed',
          user_id: invoice.user_id,
          invoice_currency: invoiceCurrency,
          payment_currency: invoiceCurrency,
          exchange_rate: 1,
          is_sales: isSales,
          total_paid: creditsTotalConverted,
          notes: '',
          is_historical: isHistorical,
        },
      };

      const response = await api.post(endpoint, payload);
      if (response?.error || (response?.code && response.code >= 400)) {
        throw new Error(response.message || 'Error al registrar el pago con créditos');
      }
      const rawPayment = extractRawPayment(response);
      createdPayments.push({
        docNo: rawPayment?.doc_no || rawPayment?.payment_doc_no,
        transactionId: rawPayment?.transaction_id != null ? String(rawPayment.transaction_id) : (rawPayment?.id != null ? String(rawPayment.id) : undefined),
        transactionType: rawPayment?.transaction_type || 'credit_note_allocation',
        methodName: 'Crédito',
        amount: creditsTotalConverted,
        currency: invoiceCurrency,
        date: toLocalISOString(new Date()),
      });

      if (!isHistorical) await checkActiveSession();
      onPaymentSuccess({
        payments: createdPayments,
        invoiceDocNo: invoice.doc_no || invoice.invoice_doc_no,
        invoiceId: invoice.id,
        totalPaid: creditsTotalConverted,
        remainingAfterPayment: Math.max(0, pendingAmount - creditsTotalConverted),
        currency: invoiceCurrency,
        appliedCredits: buildCreditPayload(),
        creditsTotal: creditsTotalConverted,
      });
    } catch (err) {
      setCreditSubmitError(err instanceof Error ? err.message : 'Error al registrar el pago con créditos');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Advance from credit sub-step 0 to payment form sub-step 1
  const goToPaymentSubStep = () => {
    // If credits cover 100%, submit directly without showing the form
    if (pendingAmountAfterCredits <= 0 && appliedCredits.size > 0) {
      handleCreditOnlySubmit();
      return;
    }
    form.setValue('entries.0.amount', pendingAmountAfterCredits);
    setCreditSubStep(1);
    onSubStepChange?.(1);
  };

  const handleSubmitPayments = async (values: FormValues) => {
    let sessionId: string | null = null;

    if (!values.is_historical) {
      const sessionValidation = await validateActiveSession();
      if (!sessionValidation.isValid) {
        setIsNoSessionAlertOpen(true);
        return;
      }
      sessionId = sessionValidation.sessionId || null;
    }

    const rate = values.exchange_rate || sessionExchangeRate || 1;
    const endpoint = isSales ? API_ROUTES.SALES.INVOICE_PAYMENT : API_ROUTES.PURCHASES.INVOICE_PAYMENT;
    const creditPayload = buildCreditPayload();

    setError(null);
    setIsSubmitting(true);

    const createdPayments: CreatedPayment[] = [];

    try {
      if (isMultiInvoice) {
        // Distribute total cash across selected invoices; credits go with the first invoice only
        const totalCashConverted = values.entries.reduce((sum, entry) => {
          return sum + calcEquivalent(Number(entry.amount), entry.payment_currency, invoiceCurrency, rate);
        }, 0);
        const distribution = distributePayment(invoices!, totalCashConverted);
        const firstEntry = values.entries[0];
        const selectedMethod = paymentMethods.find((pm) => pm.id === firstEntry.method);

        for (let i = 0; i < distribution.length; i++) {
          const { invoice: inv, amount: allocatedAmount } = distribution[i];
          const isFirst = i === 0;
          // Credits go with the first invoice only; total_paid includes credits for that invoice
          const totalPaidForInvoice = isFirst
            ? allocatedAmount + creditsTotalConverted
            : allocatedAmount;

          const payload = {
            cash_session_id: sessionId,
            user,
            client_user: {
              id: inv.user_id,
              name: inv.user_name || '',
              email: inv.userEmail || '',
            },
            credit_payment: isFirst ? creditPayload : [],
            query: {
              invoice_id: parseInt(inv.id, 10),
              payment_date: toLocalISOString(firstEntry.created_at),
              amount: allocatedAmount,
              converted_amount: allocatedAmount,
              method: selectedMethod?.name || '',
              payment_method_id: firstEntry.method,
              status: 'completed',
              user_id: inv.user_id,
              invoice_currency: inv.currency || invoiceCurrency,
              payment_currency: inv.currency || invoiceCurrency,
              exchange_rate: 1,
              is_sales: isSales,
              total_paid: totalPaidForInvoice,
              notes: values.notes || '',
              is_historical: values.is_historical || false,
            },
          };

          const response = await api.post(endpoint, payload);
          if (response?.error || (response?.code && response.code >= 400)) {
            throw new Error(response.message || `Error al registrar pago para factura #${inv.doc_no || inv.id}`);
          }
          const rawPayment = extractRawPayment(response);
          createdPayments.push({
            docNo: rawPayment?.doc_no || rawPayment?.payment_doc_no,
            transactionId: rawPayment?.transaction_id != null ? String(rawPayment.transaction_id) : (rawPayment?.id != null ? String(rawPayment.id) : undefined),
            transactionType: rawPayment?.transaction_type || 'direct_payment',
            methodName: selectedMethod?.name,
            amount: allocatedAmount,
            currency: inv.currency || invoiceCurrency,
            date: toLocalISOString(firstEntry.created_at),
          });
        }

        if (!values.is_historical) await checkActiveSession();
        const multiPaid = distribution.reduce((s, d) => s + d.amount, 0);
        const totalWithCredits = multiPaid + creditsTotalConverted;
        onPaymentSuccess({
          payments: createdPayments,
          invoiceDocNo: invoices![0].doc_no || invoices![0].invoice_doc_no,
          invoiceId: invoices![0].id,
          totalPaid: totalWithCredits,
          remainingAfterPayment: Math.max(0, Math.round((pendingAmount - totalWithCredits) * 100) / 100),
          currency: invoiceCurrency,
          appliedCredits: creditPayload,
          creditsTotal: creditsTotalConverted,
        });
      } else {
        // Single invoice: one POST per payment entry, credits on first entry
        for (let i = 0; i < values.entries.length; i++) {
          const entry = values.entries[i];
          const isFirst = i === 0;
          const selectedMethod = paymentMethods.find((pm) => pm.id === entry.method);
          const convertedAmount = calcEquivalent(
            Number(entry.amount),
            entry.payment_currency,
            invoiceCurrency,
            rate,
          );

          const payload = {
            cash_session_id: sessionId,
            user,
            client_user: {
              id: invoice.user_id,
              name: invoice.user_name || '',
              email: invoice.userEmail || '',
            },
            credit_payment: isFirst ? creditPayload : [],
            query: {
              invoice_id: parseInt(invoice.id, 10),
              payment_date: toLocalISOString(entry.created_at),
              amount: Number(entry.amount),
              converted_amount: convertedAmount,
              method: selectedMethod?.name || '',
              payment_method_id: entry.method,
              status: 'completed',
              user_id: invoice.user_id,
              invoice_currency: invoiceCurrency,
              payment_currency: entry.payment_currency,
              exchange_rate: entry.payment_currency !== invoiceCurrency ? rate : 1,
              is_sales: isSales,
              total_paid: isFirst ? convertedAmount + creditsTotalConverted : convertedAmount,
              notes: values.notes || '',
              is_historical: values.is_historical || false,
            },
          };

          const response = await api.post(endpoint, payload);
          if (response?.error || (response?.code && response.code >= 400)) {
            throw new Error(response.message || `Error al registrar pago con ${selectedMethod?.name || entry.method}`);
          }
          const rawPayment = extractRawPayment(response);
          createdPayments.push({
            docNo: rawPayment?.doc_no || rawPayment?.payment_doc_no,
            transactionId: rawPayment?.transaction_id != null ? String(rawPayment.transaction_id) : (rawPayment?.id != null ? String(rawPayment.id) : undefined),
            transactionType: rawPayment?.transaction_type || 'direct_payment',
            methodName: selectedMethod?.name,
            amount: Number(entry.amount),
            currency: entry.payment_currency,
            date: toLocalISOString(entry.created_at),
          });
        }

        if (!values.is_historical) await checkActiveSession();
        const cashPaidTotal = (watchedEntries || []).reduce((sum, entry) => {
          return sum + calcEquivalent(Number(entry.amount) || 0, entry.payment_currency || invoiceCurrency, invoiceCurrency, values.exchange_rate || sessionExchangeRate || 1);
        }, 0);
        const totalWithCredits = cashPaidTotal + creditsTotalConverted;
        onPaymentSuccess({
          payments: createdPayments,
          invoiceDocNo: invoice.doc_no || invoice.invoice_doc_no,
          invoiceId: invoice.id,
          totalPaid: totalWithCredits,
          remainingAfterPayment: Math.max(0, Math.round((pendingAmount - totalWithCredits) * 100) / 100),
          currency: invoiceCurrency,
          appliedCredits: creditPayload,
          creditsTotal: creditsTotalConverted,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar el pago');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Invoice detail expandable panel ──
  const renderDetailPanel = () => {
    if (isMultiInvoice || !invoiceDetailExpanded) return null;
    return (
      <div className="border-t divide-y text-xs">
        {invoiceDetail === null ? (
          <div className="px-4 py-3 flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Cargando detalle...</span>
          </div>
        ) : !invoiceDetail || (invoiceDetail.items.length === 0 && invoiceDetail.payments.length === 0) ? (
          <p className="px-4 py-3 text-muted-foreground italic">Sin detalle disponible.</p>
        ) : (
          <>
            {invoiceDetail.items.length > 0 && (
              <div className="px-4 py-2.5 space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Servicios facturados</p>
                {invoiceDetail.items.map((item) => (
                  <div key={item.id} className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-foreground">
                      {item.description}
                      {item.toothNumber ? <span className="ml-1 text-muted-foreground">D.{item.toothNumber}</span> : null}
                      {item.quantity > 1 ? <span className="ml-1 text-muted-foreground">×{item.quantity}</span> : null}
                    </span>
                    <span className="tabular-nums shrink-0">{fmtCurrency(item.total, invoiceCurrency)}</span>
                  </div>
                ))}
              </div>
            )}
            {invoiceDetail.payments.length > 0 && (
              <div className="px-4 py-2.5 space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Cobros registrados</p>
                {invoiceDetail.payments.map((pmt) => (
                  <div key={pmt.id} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      {pmt.docNo && <span className="font-medium">#{pmt.docNo} </span>}
                      {pmt.method && <span className="text-muted-foreground">{pmt.method}</span>}
                      {pmt.date && <span className="text-muted-foreground ml-1">· {fmtDateTime(pmt.date)}</span>}
                    </div>
                    <span className="tabular-nums shrink-0 text-emerald-700 font-medium">{fmtCurrency(pmt.amount, pmt.currency)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="px-4 py-2.5 space-y-1">
              <div className="flex justify-between font-semibold">
                <span>Total factura</span>
                <span className="tabular-nums">{fmtCurrency(invoice.total || 0, invoiceCurrency)}</span>
              </div>
              {(invoice.paid_amount || 0) > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Cobrado</span>
                  <span className="tabular-nums text-emerald-700">{fmtCurrency(invoice.paid_amount || 0, invoiceCurrency)}</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    );
  };

  // ── Already fully paid (before wizard opened) ──
  if (pendingAmount <= 0) {
    return (
      <div className="flex flex-col gap-3">
        <div className="rounded-lg border px-4 py-3 text-sm space-y-1 bg-muted/30">
          {isMultiInvoice ? (
            <div className="flex justify-between text-muted-foreground">
              <span>{invoices!.length} factura{invoices!.length !== 1 ? 's' : ''} seleccionada{invoices!.length !== 1 ? 's' : ''}</span>
              <span className="font-medium">{invoices!.map((inv) => `#${inv.doc_no || inv.id}`).join(', ')}</span>
            </div>
          ) : (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Factura</span>
              <span className="font-medium">#{invoice.doc_no || invoice.id}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-3 py-2.5 text-sm text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>Ya ha sido completamente facturado y pagado.</span>
        </div>
      </div>
    );
  }

  // ── Loading credits ──
  if (isLoadingCredits) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Sub-step 0: Credit selection ──
  // Max amount that can be applied from a specific credit without total exceeding pendingAmount.
  // Sums all OTHER applied credits first, then the remaining room is capped at the credit's own balance.
  const getMaxApplicable = (creditId: string, creditCurrency: string, creditMaxBalance: number): number => {
    const otherTotal = Array.from(appliedCredits.entries()).reduce((sum, [id, amount]) => {
      if (id === creditId) return sum;
      const c = userCredits.find((uc) => uc.source_id === id);
      if (!c) return sum;
      return sum + calcEquivalent(amount, c.currency, invoiceCurrency, sessionExchangeRate);
    }, 0);
    const remainingInInvoiceCurrency = Math.max(0, pendingAmount - otherTotal);
    const remainingInCreditCurrency = calcEquivalent(remainingInInvoiceCurrency, invoiceCurrency, creditCurrency, sessionExchangeRate);
    return Math.min(creditMaxBalance, remainingInCreditCurrency);
  };

  if (creditSubStep === 0) {
    const allCoversCost = pendingAmountAfterCredits <= 0 && appliedCredits.size > 0;

    return (
      <div className="space-y-4">
        {creditSubmitError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{creditSubmitError}</AlertDescription>
          </Alert>
        )}

        {/* Invoice summary */}
        <div className="rounded-lg border text-sm bg-muted/30 overflow-hidden">
          <div className="px-4 py-3 space-y-1">
            {isMultiInvoice ? (
              <div className="flex justify-between text-muted-foreground">
                <span>{invoices!.length} factura{invoices!.length !== 1 ? 's' : ''} seleccionada{invoices!.length !== 1 ? 's' : ''}</span>
                <span className="font-medium">{invoices!.map((inv) => `#${inv.doc_no || inv.id}`).join(', ')}</span>
              </div>
            ) : (
              <div className="flex justify-between items-center">
                <span className={cn('flex items-center gap-1.5', invoiceJustCreated ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground')}>
                  {invoiceJustCreated && <CheckCircle2 className="h-3.5 w-3.5" />}
                  {invoiceJustCreated ? 'Factura creada' : 'Factura'}{' '}
                  <span className="font-medium text-foreground">#{invoice.doc_no || invoice.id}</span>
                </span>
                <button
                  type="button"
                  onClick={handleToggleInvoiceDetail}
                  className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors ml-2"
                >
                  {invoiceDetail === null ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : invoiceDetailExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                  <span>Detalle</span>
                </button>
              </div>
            )}
            <div className="flex justify-between font-semibold">
              <span>Pendiente de cobro</span>
              <span className="tabular-nums text-primary">{fmtCurrency(pendingAmount, invoiceCurrency)}</span>
            </div>
          </div>
          {renderDetailPanel()}
        </div>

        {/* Credits list */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <h4 className="text-sm font-semibold">Créditos disponibles</h4>
          </div>
          <div className="max-h-52 overflow-y-auto space-y-2 pr-0.5">
              {userCredits.map((credit) => {
                const isChecked = appliedCredits.has(credit.source_id);
                const maxAmount = Number(credit.available_balance) || 0;
                const currentAmount = appliedCredits.get(credit.source_id) || 0;

                return (
                  <div key={credit.source_id} className="rounded-md border p-3 space-y-1.5">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id={`credit-${credit.source_id}`}
                        checked={isChecked}
                        onCheckedChange={(checked) => {
                          const next = new Map(appliedCredits);
                          if (checked) {
                            next.set(credit.source_id, getMaxApplicable(credit.source_id, credit.currency, maxAmount));
                          } else {
                            next.delete(credit.source_id);
                            setCreditCapWarning(false);
                          }
                          setAppliedCredits(next);
                        }}
                      />
                      <Label htmlFor={`credit-${credit.source_id}`} className="flex-1 text-xs cursor-pointer">
                        <span className="font-medium">
                          {credit.type === 'credit_note' ? 'Nota de crédito' : 'Referencia de pago'}
                        </span>{' '}
                        <span className="text-muted-foreground">#{credit.source_id} ({credit.currency})</span>
                      </Label>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <FormattedNumberInput
                          value={currentAmount}
                          onChange={(val) => {
                            if (!isChecked) return;
                            const next = new Map(appliedCredits);
                            const maxApplicable = getMaxApplicable(credit.source_id, credit.currency, maxAmount);
                            const entered = Number(val) || 0;
                            if (entered > maxApplicable) setCreditCapWarning(true);
                            next.set(credit.source_id, Math.min(entered, maxApplicable));
                            setAppliedCredits(next);
                          }}
                          disabled={!isChecked}
                          placeholder="0.00"
                          className="h-7 w-24 text-xs"
                        />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          / {fmtCurrency(maxAmount, credit.currency)}
                        </span>
                      </div>
                    </div>
                    {isChecked && credit.currency !== invoiceCurrency && currentAmount > 0 && (
                      <div className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground pl-7">
                        <span>≈ {fmtCurrency(calcEquivalent(currentAmount, credit.currency, invoiceCurrency, sessionExchangeRate), invoiceCurrency)}</span>
                        {sessionExchangeRate !== 1 && (
                          <span className="opacity-60">· 1 USD = {sessionExchangeRate} UYU</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>

        {/* Credits summary */}
        {appliedCredits.size > 0 && (
          <div className="rounded-md bg-muted px-3 py-2.5 text-sm space-y-1">
            {Array.from(appliedCredits.entries()).map(([id, amount]) => {
              const credit = userCredits.find((c) => c.source_id === id);
              if (!amount) return null;
              const converted = calcEquivalent(amount, credit?.currency || invoiceCurrency, invoiceCurrency, sessionExchangeRate);
              return (
                <div key={id} className="flex justify-between text-xs text-muted-foreground">
                  <span>#{id} ({credit?.currency})</span>
                  <div className="text-right">
                    <span>{fmtCurrency(amount, credit?.currency || invoiceCurrency)}</span>
                    {credit?.currency !== invoiceCurrency && (
                      <span className="ml-1 text-muted-foreground">≈ {fmtCurrency(converted, invoiceCurrency)}</span>
                    )}
                  </div>
                </div>
              );
            })}
            <div className="border-t pt-1 flex justify-between font-semibold">
              <span>Total créditos a aplicar</span>
              <span className="tabular-nums text-emerald-600">{fmtCurrency(creditsTotalConverted, invoiceCurrency)}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>Pendiente a pagar</span>
              <span className={cn('tabular-nums', allCoversCost ? 'text-emerald-600' : 'text-primary')}>
                {fmtCurrency(pendingAmountAfterCredits, invoiceCurrency)}
              </span>
            </div>
          </div>
        )}

        {/* Cap warning */}
        {creditCapWarning && (
          <Alert variant="default" className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertDescription className="text-amber-700 dark:text-amber-300 text-xs">
              El monto fue ajustado al máximo necesario para cubrir el saldo pendiente.
            </AlertDescription>
          </Alert>
        )}

        {/* Sub-step navigation buttons */}
        <div className="flex gap-2 justify-end pt-1">
          <Button
            variant="outline"
            size="sm"
            disabled={isSubmitting}
            onClick={() => {
              setAppliedCredits(new Map());
              setCreditCapWarning(false);
              form.setValue('entries.0.amount', pendingAmount);
              setCreditSubStep(1);
              onSubStepChange?.(1);
            }}
          >
            Omitir créditos
          </Button>
          <Button
            size="sm"
            disabled={isSubmitting}
            onClick={goToPaymentSubStep}
          >
            {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
            {allCoversCost ? 'Cobrar con créditos' : 'Siguiente →'}
          </Button>
        </div>

        {/* No session alert (reused here too) */}
        <AlertDialog open={isNoSessionAlertOpen} onOpenChange={setIsNoSessionAlertOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <div className="flex items-start gap-3">
                <div className="header-icon-circle mt-0.5">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                </div>
                <div className="flex flex-col text-left">
                  <AlertDialogTitle>{t('noSessionDialog.title')}</AlertDialogTitle>
                  <AlertDialogDescription>{t('noSessionDialog.description')}</AlertDialogDescription>
                </div>
              </div>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              {canAccessCashier && (
                <Link href={`/${locale}/cashier`} passHref>
                  <Button>
                    <Box className="mr-2 h-4 w-4" />
                    Abrir sesión de caja
                  </Button>
                </Link>
              )}
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // ── Sub-step 1: Payment form ──
  return (
    <>
      {/* Back to credit selection */}
      {userCredits.length > 0 && (
        <button
          type="button"
          onClick={() => { setCreditSubStep(0); onSubStepChange?.(0); }}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft className="h-3 w-3" />
          Volver a créditos
        </button>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmitPayments)} id="billing-payment-form" className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Invoice summary + applied credits banner */}
          <div className={cn(
            'rounded-lg border text-sm overflow-hidden',
            invoiceJustCreated
              ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
              : 'bg-muted/30',
          )}>
            <div className="px-4 py-3 space-y-1">
              {isMultiInvoice ? (
                <div className="flex justify-between text-muted-foreground">
                  <span>{invoices!.length} factura{invoices!.length !== 1 ? 's' : ''} seleccionada{invoices!.length !== 1 ? 's' : ''}</span>
                  <span className="font-medium">{invoices!.map((inv) => `#${inv.doc_no || inv.id}`).join(', ')}</span>
                </div>
              ) : (
                <div className="flex justify-between items-center">
                  <span className={cn('flex items-center gap-1.5', invoiceJustCreated ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground')}>
                    {invoiceJustCreated && <CheckCircle2 className="h-3.5 w-3.5" />}
                    {invoiceJustCreated ? 'Factura creada' : 'Factura'}{' '}
                    <span className="font-medium text-foreground">#{invoice.doc_no || invoice.id}</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleToggleInvoiceDetail}
                    className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors ml-2"
                  >
                    {invoiceDetail === null ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : invoiceDetailExpanded ? (
                      <ChevronDown className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" />
                    )}
                    <span>Detalle</span>
                  </button>
                </div>
              )}
              {/* Show applied credits deduction */}
              {creditsTotalConverted > 0 && (
                <div className="flex justify-between text-xs text-emerald-700 dark:text-emerald-400">
                  <span className="flex items-center gap-1">
                    <CreditCard className="h-3 w-3" />
                    Créditos aplicados
                  </span>
                  <span className="tabular-nums">− {fmtCurrency(creditsTotalConverted, invoiceCurrency)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold">
                <span>Pendiente de cobro</span>
                <span className="tabular-nums text-primary">
                  {fmtCurrency(pendingAmountAfterCredits, invoiceCurrency)}
                </span>
              </div>
            </div>
            {renderDetailPanel()}
          </div>

          {/* Payment entries */}
          <div className="space-y-3">
            {fields.map((field, index) => (
              <div key={field.id} className="rounded-lg border p-3 space-y-2">
                {/* Row: Remove button if multiple entries */}
                {fields.length > 1 && (
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-medium text-muted-foreground">
                      Método {index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}

                {/* Line 1: Date | Currency */}
                <div className="grid grid-cols-2 gap-2">
                  <FormField
                    control={form.control}
                    name={`entries.${index}.created_at`}
                    render={({ field: f }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Fecha</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                size="sm"
                                className={cn(
                                  'w-full h-8 pl-2 text-left text-xs font-normal',
                                  !f.value && 'text-muted-foreground',
                                )}
                              >
                                {f.value ? format(f.value, 'dd/MM/yyyy') : 'Seleccionar'}
                                <CalendarIcon className="ml-auto h-3 w-3 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <DatePicker
                              mode="single"
                              selected={f.value}
                              onSelect={f.onChange}
                              disabled={(date: Date) => date > new Date() || date < new Date('1900-01-01')}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`entries.${index}.payment_currency`}
                    render={({ field: f }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Moneda</FormLabel>
                        <Select onValueChange={f.onChange} value={f.value}>
                          <FormControl>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="USD">USD</SelectItem>
                            <SelectItem value="UYU">UYU</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Line 2: Method | Amount */}
                <div className="grid grid-cols-2 gap-2">
                  <FormField
                    control={form.control}
                    name={`entries.${index}.method`}
                    render={({ field: f }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Método de pago</FormLabel>
                        <Select onValueChange={f.onChange} value={f.value}>
                          <FormControl>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Seleccionar..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {paymentMethods.map((m) => (
                              <SelectItem key={m.id} value={m.id}>
                                {m.name}
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
                    name={`entries.${index}.amount`}
                    render={({ field: f }) => (
                      <FormItem>
                        <FormLabel className="text-xs">
                          Monto ({watchedEntries?.[index]?.payment_currency || invoiceCurrency})
                        </FormLabel>
                        <FormControl>
                          <FormattedNumberInput
                            value={f.value}
                            onChange={f.onChange}
                            placeholder="0.00"
                            className="h-8 text-xs"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Add payment method button */}
          <button
            type="button"
            onClick={handleAddEntry}
            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed py-2 text-xs text-muted-foreground hover:text-foreground hover:border-border transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Agregar otro método de pago
          </button>

          {/* Exchange rate (shown if any cross-currency entry) */}
          {hasCrossCurrency && (
            <div className="rounded-md border bg-muted/30 p-3">
              <FormField
                control={form.control}
                name="exchange_rate"
                render={({ field: f }) => (
                  <FormItem>
                    <FormLabel className="text-xs">
                      Tipo de cambio (UYU por 1 USD)
                    </FormLabel>
                    <FormControl>
                      <FormattedNumberInput
                        value={f.value}
                        onChange={f.onChange}
                        placeholder="0.00"
                        className="h-8 text-xs"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                Aplica a todos los pagos con moneda distinta a {invoiceCurrency}
              </p>
            </div>
          )}

          {/* Notes */}
          <FormField
            control={form.control}
            name="notes"
            render={({ field: f }) => (
              <FormItem>
                <FormLabel className="text-xs">Notas (opcional)</FormLabel>
                <FormControl>
                  <Input
                    {...f}
                    value={f.value || ''}
                    placeholder="Observaciones del cobro..."
                    className="h-8 text-xs"
                  />
                </FormControl>
              </FormItem>
            )}
          />

          {/* Distribution preview for multi-invoice mode */}
          {isMultiInvoice && invoiceDistribution.length > 0 && (
            <div className="rounded-lg border overflow-hidden text-sm">
              <div className="px-3 py-2 bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Distribución del pago
              </div>
              <div className="divide-y">
                {invoiceDistribution.map(({ invoice: inv, amount }) => (
                  <div key={inv.id} className="flex justify-between px-3 py-2">
                    <span className="text-muted-foreground">Factura #{inv.doc_no || inv.id}</span>
                    <span className="font-medium tabular-nums">{fmtCurrency(amount, inv.currency || invoiceCurrency)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Summary */}
          <div className="rounded-md bg-muted px-3 py-2.5 text-sm space-y-1">
            {hasCrossCurrency && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Total (equivalente en {invoiceCurrency})</span>
                <span className="tabular-nums">{fmtCurrency(totalInInvoiceCurrency, invoiceCurrency)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold">
              <span>Pendiente tras este cobro</span>
              <span className={cn('tabular-nums', remainingAfterPayment > 0 ? 'text-amber-600' : 'text-emerald-600')}>
                {fmtCurrency(remainingAfterPayment, invoiceCurrency)}
              </span>
            </div>
          </div>
        </form>
      </Form>

      {/* No session alert */}
      <AlertDialog open={isNoSessionAlertOpen} onOpenChange={setIsNoSessionAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-start gap-3">
              <div className="header-icon-circle mt-0.5">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
              </div>
              <div className="flex flex-col text-left">
                <AlertDialogTitle>{t('noSessionDialog.title')}</AlertDialogTitle>
                <AlertDialogDescription>{t('noSessionDialog.description')}</AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            {canAccessCashier && (
              <Link href={`/${locale}/cashier`} passHref>
                <Button>
                  <Box className="mr-2 h-4 w-4" />
                  Abrir sesión de caja
                </Button>
              </Link>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
