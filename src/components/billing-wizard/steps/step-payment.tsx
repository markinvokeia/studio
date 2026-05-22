'use client';

import * as React from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { AlertTriangle, ArrowRight, Box, CalendarIcon, CheckCircle2, Plus, X } from 'lucide-react';
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
import { DatePicker } from '@/components/ui/date-picker';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { FormattedNumberInput } from '@/components/ui/formatted-number-input';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { CASHIER_PERMISSIONS } from '@/constants/permissions';
import { API_ROUTES } from '@/constants/routes';
import { useAuth } from '@/context/AuthContext';
import { useCashSessionValidation } from '@/hooks/use-cash-session-validation';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import type { Invoice, PaymentMethod } from '@/lib/types';
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
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtCurrency(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('es-UY', { style: 'currency', currency }).format(amount);
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

  const sessionExchangeRate = React.useMemo<number>(() => {
    const rate = activeCashSession?.data?.opening_details?.date_rate;
    return rate && Number(rate) > 0 ? Number(rate) : 1;
  }, [activeCashSession]);

  const invoiceCurrency = invoice.currency || 'USD';
  const paidAmount = invoice.paid_amount || 0;
  const pendingAmount = isMultiInvoice
    ? invoices!.reduce((sum, inv) => sum + Math.max(0, (inv.total || 0) - (inv.paid_amount || 0)), 0)
    : Math.max(0, (invoice.total || 0) - paidAmount);

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

  // When fresh invoice data arrives (paid_amount updated), reset the first
  // entry's amount to the recalculated pendingAmount so the field stays in sync.
  React.useEffect(() => {
    form.setValue('entries.0.amount', pendingAmount);
  }, [pendingAmount]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch payment methods
  React.useEffect(() => {
    api.get(API_ROUTES.PAYMENT_METHODS).then((data) => {
      const raw = Array.isArray(data) ? data : (data.payment_methods || data.data || []);
      setPaymentMethods(raw.map((m: any) => ({ ...m, id: String(m.id) })));
    }).catch(() => {});
  }, []);

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
    Math.round((pendingAmount - totalInInvoiceCurrency) * 100) / 100,
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

    setError(null);
    setIsSubmitting(true);

    const createdPayments: CreatedPayment[] = [];

    try {
      if (isMultiInvoice) {
        // Distribute total across selected invoices; use first entry's method for all
        const totalConverted = values.entries.reduce((sum, entry) => {
          return sum + calcEquivalent(Number(entry.amount), entry.payment_currency, invoiceCurrency, rate);
        }, 0);
        const distribution = distributePayment(invoices!, totalConverted);
        const firstEntry = values.entries[0];
        const selectedMethod = paymentMethods.find((pm) => pm.id === firstEntry.method);

        for (const { invoice: inv, amount: allocatedAmount } of distribution) {
          const payload = {
            cash_session_id: sessionId,
            user,
            client_user: {
              id: inv.user_id,
              name: inv.user_name || '',
              email: inv.userEmail || '',
            },
            credit_payment: [],
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
              total_paid: allocatedAmount,
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
        onPaymentSuccess({
          payments: createdPayments,
          invoiceDocNo: invoices![0].doc_no || invoices![0].invoice_doc_no,
          invoiceId: invoices![0].id,
          totalPaid: multiPaid,
          remainingAfterPayment: Math.max(0, Math.round((pendingAmount - multiPaid) * 100) / 100),
          currency: invoiceCurrency,
        });
      } else {
        // Single invoice: one POST per payment entry
        for (const entry of values.entries) {
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
            credit_payment: [],
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
              total_paid: convertedAmount,
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
        const paidTotal = (watchedEntries || []).reduce((sum, entry) => {
          return sum + calcEquivalent(Number(entry.amount) || 0, entry.payment_currency || invoiceCurrency, invoiceCurrency, values.exchange_rate || sessionExchangeRate || 1);
        }, 0);
        onPaymentSuccess({
          payments: createdPayments,
          invoiceDocNo: invoice.doc_no || invoice.invoice_doc_no,
          invoiceId: invoice.id,
          totalPaid: paidTotal,
          remainingAfterPayment: Math.max(0, Math.round((pendingAmount - paidTotal) * 100) / 100),
          currency: invoiceCurrency,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar el pago');
    } finally {
      setIsSubmitting(false);
    }
  };

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

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmitPayments)} id="billing-payment-form" className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Invoice summary */}
          <div className={cn(
            'rounded-lg border px-4 py-3 text-sm space-y-1',
            invoiceJustCreated
              ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
              : 'bg-muted/30',
          )}>
            {isMultiInvoice ? (
              <>
                <div className="flex justify-between text-muted-foreground">
                  <span>{invoices!.length} factura{invoices!.length !== 1 ? 's' : ''} seleccionada{invoices!.length !== 1 ? 's' : ''}</span>
                  <span className="font-medium">
                    {invoices!.map((inv) => `#${inv.doc_no || inv.id}`).join(', ')}
                  </span>
                </div>
              </>
            ) : (
              <div className="flex justify-between items-center">
                <span className={cn('flex items-center gap-1.5', invoiceJustCreated ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground')}>
                  {invoiceJustCreated && <CheckCircle2 className="h-3.5 w-3.5" />}
                  {invoiceJustCreated ? 'Factura creada' : 'Factura'}
                </span>
                <span className="font-medium">#{invoice.doc_no || 'NUEVA'}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold">
              <span>Pendiente de cobro</span>
              <span className="tabular-nums text-primary">
                {fmtCurrency(pendingAmount, invoiceCurrency)}
              </span>
            </div>
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
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
