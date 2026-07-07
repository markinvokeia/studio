'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePickerInput } from '@/components/ui/date-picker';
import { Dialog, DialogBody, DialogCancelButton, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { FormattedNumberInput } from '@/components/ui/formatted-number-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { API_ROUTES } from '@/constants/routes';
import { useAuth } from '@/context/AuthContext';
import { useCashSessionValidation } from '@/hooks/use-cash-session-validation';
import { useToast } from '@/hooks/use-toast';
import { useClinicInfo } from '@/hooks/useClinicInfo';
import { Credit, Invoice, PaymentMethod, User } from '@/lib/types';
import { toLocalISOString } from '@/lib/utils';
import { api } from '@/services/api';
import { fetchPatientLedgerData } from '@/services/patient-ledger-data';
import { zodResolver } from '@hookform/resolvers/zod';
import { format, parseISO } from 'date-fns';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

const smartPaymentFormSchema = (t: (key: string) => string) => z.object({
  payment_amount: z.coerce.number().min(0, t('validation.amountNonNegative')),
  payment_method_id: z.string().optional(),
  created_at: z.date({ required_error: t('validation.dateRequired') }),
  currency: z.enum(['UYU', 'USD']),
  notes: z.string().optional(),
  is_historical: z.boolean().default(false),
}).refine(
  (data) => Number(data.payment_amount) <= 0 || !!data.payment_method_id,
  { message: t('validation.methodRequired'), path: ['payment_method_id'] }
);

type SmartPaymentFormValues = z.infer<ReturnType<typeof smartPaymentFormSchema>>;

interface PendingInvoice {
  invoice: Invoice;
  remaining: number;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

async function getPaymentMethods(): Promise<PaymentMethod[]> {
  try {
    const data = await api.get(API_ROUTES.CASHIER.PAYMENT_METHODS);
    const methodsData = Array.isArray(data) ? data : (data.payment_methods || data.data || []);
    return methodsData.map((m: any) => ({ ...m, id: String(m.id) }));
  } catch {
    return [];
  }
}

/** Fetches the real remaining balance for a partially-paid invoice — the ledger's
 *  `paid_amount` field isn't always populated, so we go straight to its payments. */
async function getInvoiceRemaining(invoice: Invoice): Promise<number> {
  const status = String(invoice.payment_status || '').toLowerCase();
  if (status === 'unpaid') return invoice.total || 0;
  try {
    const data = await api.get(API_ROUTES.SALES.INVOICE_PAYMENTS, { invoice_id: invoice.id, is_sales: 'true' });
    const list = Array.isArray(data) ? data : (data.payments || data.data || []);
    const paid = list.reduce((sum: number, p: any) => {
      if (p?.status === 'failed') return sum;
      const applied = parseFloat(p?.amount_applied ?? p?.amount ?? 0);
      return sum + (Number.isFinite(applied) ? applied : 0);
    }, 0);
    return Math.max(0, round2((invoice.total || 0) - paid));
  } catch {
    return Math.max(0, round2((invoice.total || 0) - (invoice.paid_amount || 0)));
  }
}

export interface SmartPaymentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialUser?: User | null;
  onSaveSuccess?: () => void;
}

/**
 * Registers a payment for a patient without picking an invoice: the amount is applied
 * to their unpaid/partial invoices oldest-first (FIFO), and whatever is left over (or
 * the whole amount, if nothing is pending) is booked as a prepayment/credit.
 */
export function SmartPaymentFormDialog({ open, onOpenChange, initialUser, onSaveSuccess }: SmartPaymentFormDialogProps) {
  const t = useTranslations('PaymentsPage');
  const tValidation = useTranslations('InvoicesPage');
  const { toast } = useToast();
  const { user, checkActiveSession } = useAuth();
  const { validateActiveSession, showCashSessionError } = useCashSessionValidation();
  const clinicInfo = useClinicInfo();

  const [paymentMethods, setPaymentMethods] = React.useState<PaymentMethod[]>([]);
  const [pendingInvoices, setPendingInvoices] = React.useState<PendingInvoice[]>([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = React.useState(false);
  const [credits, setCredits] = React.useState<Credit[]>([]);
  const [useCredit, setUseCredit] = React.useState(true);
  const [submissionError, setSubmissionError] = React.useState<string | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = React.useState(false);
  const [pendingData, setPendingData] = React.useState<SmartPaymentFormValues | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<SmartPaymentFormValues>({
    resolver: zodResolver(smartPaymentFormSchema(tValidation)),
    defaultValues: {
      payment_amount: 0,
      payment_method_id: '',
      created_at: new Date(),
      currency: clinicInfo?.currency ?? 'UYU',
      notes: '',
      is_historical: false,
    },
  });

  const watchedAmount = form.watch('payment_amount');
  const watchedCurrency = form.watch('currency');

  React.useEffect(() => {
    if (!open) return;
    setSubmissionError(null);
    setUseCredit(true);
    form.reset({
      payment_amount: 0,
      payment_method_id: '',
      created_at: new Date(),
      currency: clinicInfo?.currency ?? 'UYU',
      notes: '',
      is_historical: false,
    });
    getPaymentMethods().then(setPaymentMethods);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  React.useEffect(() => {
    if (!open || !initialUser?.id) return;
    let active = true;
    api.get(API_ROUTES.USER_CREDIT, { user_id: initialUser.id })
      .then((data) => {
        if (!active) return;
        const valid = Array.isArray(data)
          ? data.filter((c: any) => c && c.source_id && c.available_balance !== undefined)
          : [];
        setCredits(valid);
      })
      .catch(() => { if (active) setCredits([]); });
    return () => { active = false; };
  }, [open, initialUser?.id]);

  React.useEffect(() => {
    if (!open || !initialUser?.id) return;
    let active = true;
    setIsLoadingInvoices(true);
    (async () => {
      const data = await fetchPatientLedgerData(initialUser.id);
      const eligible = data.invoices
        .filter((inv) => (inv.type || 'invoice') !== 'credit_note')
        .filter((inv) => (inv.currency || 'USD') === watchedCurrency)
        .filter((inv) => ['unpaid', 'partial', 'partially_paid'].includes(String(inv.payment_status || '').toLowerCase()))
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      const withRemaining = await Promise.all(eligible.map(async (invoice) => ({
        invoice,
        remaining: await getInvoiceRemaining(invoice),
      })));

      if (active) setPendingInvoices(withRemaining.filter((p) => p.remaining > 0.005));
      if (active) setIsLoadingInvoices(false);
    })();
    return () => { active = false; };
  }, [open, initialUser?.id, watchedCurrency]);

  const creditsInCurrency = React.useMemo(
    () => credits.filter((c) => c.currency === watchedCurrency),
    [credits, watchedCurrency]
  );
  const totalCreditAvailable = React.useMemo(
    () => round2(creditsInCurrency.reduce((sum, c) => sum + (Number(c.available_balance) || 0), 0)),
    [creditsInCurrency]
  );

  const allocation = React.useMemo(() => {
    const creditPool = (useCredit ? creditsInCurrency : []).map((c) => ({
      source_id: c.source_id,
      type: c.type,
      currency: c.currency,
      remaining: Number(c.available_balance) || 0,
    }));
    let cashRemaining = Number(watchedAmount) || 0;
    const applied: {
      invoice: Invoice;
      cashAmount: number;
      creditAmount: number;
      creditBreakdown: { source_id: string; amount: number; type: string; currency: string }[];
    }[] = [];

    for (const p of pendingInvoices) {
      const hasCredit = creditPool.some((c) => c.remaining > 0);
      if (cashRemaining <= 0 && !hasCredit) break;
      let need = p.remaining;
      const creditBreakdown: { source_id: string; amount: number; type: string; currency: string }[] = [];
      let creditAmount = 0;
      for (const c of creditPool) {
        if (need <= 0) break;
        if (c.remaining <= 0) continue;
        const take = round2(Math.min(need, c.remaining));
        if (take <= 0) continue;
        creditBreakdown.push({ source_id: c.source_id, amount: take, type: c.type, currency: c.currency });
        c.remaining = round2(c.remaining - take);
        creditAmount = round2(creditAmount + take);
        need = round2(need - take);
      }
      const cashAmount = round2(Math.min(need, cashRemaining));
      cashRemaining = round2(cashRemaining - cashAmount);
      if (creditAmount > 0 || cashAmount > 0) {
        applied.push({ invoice: p.invoice, cashAmount, creditAmount, creditBreakdown });
      }
    }

    return { applied, leftover: Math.max(0, cashRemaining) };
  }, [pendingInvoices, watchedAmount, creditsInCurrency, useCredit]);

  const onSubmit = (data: SmartPaymentFormValues) => {
    const hasCreditToUse = useCredit && totalCreditAvailable > 0;
    if ((Number(data.payment_amount) || 0) <= 0 && !hasCreditToUse) {
      setSubmissionError(tValidation('validation.noPaymentAmount'));
      return;
    }
    setSubmissionError(null);
    setPendingData(data);
    setIsConfirmOpen(true);
  };

  const handleConfirm = async () => {
    if (!pendingData || !user || !initialUser || isSubmitting) return;
    setIsSubmitting(true);
    try {
      let sessionId: string | null = null;
      if (!pendingData.is_historical) {
        const validation = await validateActiveSession();
        if (!validation.isValid) {
          showCashSessionError(validation.error);
          return;
        }
        sessionId = validation.sessionId ?? null;
      }

      const selectedMethod = paymentMethods.find((pm) => pm.id === pendingData.payment_method_id);
      const clientUser = { id: initialUser.id, name: initialUser.name, email: initialUser.email || '' };
      const basePayload = {
        cash_session_id: sessionId,
        user,
        client_user: clientUser,
      };
      const baseQuery = {
        payment_date: toLocalISOString(pendingData.created_at),
        method: selectedMethod?.name,
        payment_method_id: pendingData.payment_method_id,
        status: 'completed' as const,
        user_id: initialUser.id,
        is_sales: true,
        invoice_currency: pendingData.currency,
        payment_currency: pendingData.currency,
        exchange_rate: 1,
        notes: pendingData.notes || '',
        is_historical: pendingData.is_historical,
      };

      for (const { invoice, cashAmount, creditAmount, creditBreakdown } of allocation.applied) {
        await api.post(API_ROUTES.SALES.INVOICE_PAYMENT, {
          ...basePayload,
          credit_payment: creditBreakdown.map((c) => ({
            source_id: c.source_id,
            amount: c.amount,
            type: c.type,
            currency: c.currency,
            exchange_rate: 1,
          })),
          query: {
            ...baseQuery,
            invoice_id: parseInt(invoice.id, 10),
            amount: cashAmount,
            converted_amount: cashAmount,
            total_paid: round2(cashAmount + creditAmount),
          },
        });
      }

      if (allocation.leftover > 0) {
        await api.post(API_ROUTES.SALES.INVOICE_PAYMENT, {
          ...basePayload,
          query: {
            ...baseQuery,
            amount: allocation.leftover,
            is_prepaid: true,
          },
        });
      }

      toast({ title: t('prepaidDialog.toasts.successTitle'), description: t('smartPaymentDialog.toasts.successDescription') });
      await checkActiveSession();
      setIsConfirmOpen(false);
      onOpenChange(false);
      onSaveSuccess?.();
    } catch (error) {
      setIsConfirmOpen(false);
      setSubmissionError(error instanceof Error ? error.message : t('prepaidDialog.toasts.errorDescription'));
      toast({ variant: 'destructive', title: t('prepaidDialog.toasts.errorTitle'), description: error instanceof Error ? error.message : t('prepaidDialog.toasts.errorDescription') });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isHistorical = form.watch('is_historical');
  const hasAmount = Number(watchedAmount) > 0;

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!isConfirmOpen) onOpenChange(o); }}>
        <DialogContent confirmOnClose isDirty={form.formState.isDirty}>
          <DialogHeader>
            <DialogTitle>{t('smartPaymentDialog.title')}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
              <DialogBody className="space-y-4 px-6 py-4">
                {submissionError && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{submissionError}</AlertDescription>
                  </Alert>
                )}

                <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
                  {initialUser?.name}
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <FormField control={form.control} name="payment_amount" render={({ field: { onChange, value } }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>{t('smartPaymentDialog.amount')}</FormLabel>
                      <FormControl>
                        <FormattedNumberInput value={value} onChange={onChange} placeholder="0.00" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="currency" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('smartPaymentDialog.currency')}</FormLabel>
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

                <FormField control={form.control} name="payment_method_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('smartPaymentDialog.paymentMethod')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder={t('smartPaymentDialog.selectMethod')} /></SelectTrigger></FormControl>
                      <SelectContent>
                        {paymentMethods.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="created_at" render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>{t('smartPaymentDialog.paymentDate')}</FormLabel>
                    <FormControl>
                      <DatePickerInput
                        value={field.value ? format(field.value, 'yyyy-MM-dd') : ''}
                        onChange={(iso) => field.onChange(iso ? parseISO(iso) : undefined)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* Available credit */}
                {totalCreditAvailable > 0 && (
                  <div className="flex items-center justify-between rounded-md border p-3 bg-muted/50">
                    <div className="flex items-center gap-2">
                      <Checkbox id="use-credit" checked={useCredit} onCheckedChange={(v) => setUseCredit(!!v)} />
                      <label htmlFor="use-credit" className="text-sm cursor-pointer">
                        {t('smartPaymentDialog.useAvailableCredit')}
                      </label>
                    </div>
                    <span className="text-sm font-medium tabular-nums">
                      {new Intl.NumberFormat('es-UY', { style: 'currency', currency: watchedCurrency }).format(totalCreditAvailable)}
                    </span>
                  </div>
                )}

                {/* Allocation preview */}
                {(hasAmount || (useCredit && totalCreditAvailable > 0)) && (
                  <div className="rounded-md border p-3 space-y-2 bg-muted/50">
                    <h4 className="text-sm font-semibold">{t('smartPaymentDialog.allocationPreview')}</h4>
                    {isLoadingInvoices ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />{t('smartPaymentDialog.loadingInvoices')}
                      </div>
                    ) : (
                      <>
                        {allocation.applied.length === 0 && (
                          <p className="text-sm text-muted-foreground">{t('smartPaymentDialog.noPendingInvoices')}</p>
                        )}
                        {allocation.applied.map(({ invoice, cashAmount, creditAmount }) => (
                          <div key={invoice.id} className="flex justify-between text-sm">
                            <span>
                              #{invoice.doc_no || invoice.id}
                              {creditAmount > 0 && (
                                <span className="text-xs text-muted-foreground ml-1">
                                  ({t('smartPaymentDialog.fromCredit')}: {new Intl.NumberFormat('es-UY', { style: 'currency', currency: watchedCurrency }).format(creditAmount)})
                                </span>
                              )}
                            </span>
                            <span className="tabular-nums">
                              {new Intl.NumberFormat('es-UY', { style: 'currency', currency: watchedCurrency }).format(round2(cashAmount + creditAmount))}
                            </span>
                          </div>
                        ))}
                        {allocation.leftover > 0 && (
                          <div className="flex justify-between text-sm font-medium pt-2 border-t">
                            <span>{t('smartPaymentDialog.prepaidRemainder')}</span>
                            <span className="tabular-nums">
                              {new Intl.NumberFormat('es-UY', { style: 'currency', currency: watchedCurrency }).format(allocation.leftover)}
                            </span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                <FormField control={form.control} name="notes" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('smartPaymentDialog.notes')}</FormLabel>
                    <FormControl>
                      <Textarea placeholder={t('smartPaymentDialog.notesPlaceholder')} {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="is_historical" render={({ field }) => (
                  <>
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>{t('smartPaymentDialog.isHistorical')}</FormLabel>
                        <p className="text-xs text-muted-foreground">{t('smartPaymentDialog.isHistoricalDescription')}</p>
                      </div>
                    </FormItem>
                    {isHistorical && (
                      <Alert className="bg-amber-50 border-amber-200">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        <AlertTitle className="text-amber-800 text-sm">{t('smartPaymentDialog.isHistoricalWarning')}</AlertTitle>
                        <AlertDescription className="text-amber-700 text-xs">{t('smartPaymentDialog.isHistoricalDescription')}</AlertDescription>
                      </Alert>
                    )}
                  </>
                )} />
              </DialogBody>
              <DialogFooter>
                <DialogCancelButton variant="outline">{t('smartPaymentDialog.cancel')}</DialogCancelButton>
                <Button type="submit">{t('smartPaymentDialog.save')}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('smartPaymentDialog.confirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('smartPaymentDialog.confirmDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('smartPaymentDialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={isSubmitting}>{t('smartPaymentDialog.confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
