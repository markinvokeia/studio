'use client';

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
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DatePicker } from '@/components/ui/date-picker';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { FormattedNumberInput } from '@/components/ui/formatted-number-input';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { CASHIER_PERMISSIONS } from '@/constants/permissions';
import { API_ROUTES } from '@/constants/routes';
import { useAuth } from '@/context/AuthContext';
import { useCashSessionValidation } from '@/hooks/use-cash-session-validation';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import { Credit, Invoice, PaymentMethod } from '@/lib/types';
import { cn } from '@/lib/utils';
import { api } from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { format, formatISO } from 'date-fns';
import { AlertTriangle, ArrowRight, Box, CalendarIcon, CreditCard } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import * as React from 'react';
import { useForm, useWatch } from 'react-hook-form';
import * as z from 'zod';

// ── Schema ────────────────────────────────────────────────────────────────────

const paymentFormSchema = (t: (key: string) => string) =>
  z
    .object({
      amount: z.coerce.number().min(0, t('validation.amountPositive')),
      method: z.string().optional(),
      status: z.enum(['pending', 'completed', 'failed']),
      payment_date: z.date({ required_error: t('validation.dateRequired') }),
      invoice_currency: z.string(),
      payment_currency: z.string(),
      exchange_rate: z.coerce.number().optional(),
      notes: z.string().optional(),
      is_historical: z.boolean().optional(),
    })
    .refine(
      (data) => {
        if (data.amount > 0 && !data.method) return false;
        return true;
      },
      { message: 'Method is required when paying an amount.', path: ['method'] }
    )
    .refine(
      (data) => {
        if (data.invoice_currency !== data.payment_currency) {
          return data.exchange_rate && data.exchange_rate > 0;
        }
        return true;
      },
      {
        message: 'Exchange rate is required when currencies are different.',
        path: ['exchange_rate'],
      }
    );

type PaymentFormValues = z.infer<ReturnType<typeof paymentFormSchema>>;

// ── Props ─────────────────────────────────────────────────────────────────────

interface InvoicePaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  isSales: boolean;
  onSuccess: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function InvoicePaymentDialog({
  isOpen,
  onClose,
  invoice,
  isSales,
  onSuccess,
}: InvoicePaymentDialogProps) {
  const t = useTranslations('InvoicesPage');
  const locale = useLocale();
  const { user, checkActiveSession, activeCashSession } = useAuth();
  const { validateActiveSession } = useCashSessionValidation();
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const canAccessCashier = hasPermission(CASHIER_PERMISSIONS.VIEW_MENU);

  const [paymentMethods, setPaymentMethods] = React.useState<PaymentMethod[]>([]);
  const [userCredits, setUserCredits] = React.useState<Credit[]>([]);
  const [appliedCredits, setAppliedCredits] = React.useState<Map<string, number>>(new Map());
  const [companyCurrency, setCompanyCurrency] = React.useState<string>('USD');
  const [paidAmount, setPaidAmount] = React.useState<number>(0);
  const [paymentSubmissionError, setPaymentSubmissionError] = React.useState<string | null>(null);
  const [isNoSessionAlertOpen, setIsNoSessionAlertOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema(t)),
    defaultValues: { status: 'completed', notes: '' },
  });

  const sessionExchangeRate = React.useMemo<number>(() => {
    const rate = activeCashSession?.data?.opening_details?.date_rate;
    return rate && Number(rate) > 0 ? Number(rate) : 1;
  }, [activeCashSession]);

  const watchedAmount = useWatch({ control: form.control, name: 'amount' });
  const watchedPaymentCurrency = useWatch({ control: form.control, name: 'payment_currency' });
  const watchedInvoiceCurrency = useWatch({ control: form.control, name: 'invoice_currency' });
  const watchedExchangeRate = useWatch({ control: form.control, name: 'exchange_rate' });

  const showExchangeRate =
    !!watchedInvoiceCurrency &&
    !!watchedPaymentCurrency &&
    watchedInvoiceCurrency !== watchedPaymentCurrency;

  const equivalentAmount = React.useMemo(() => {
    if (!showExchangeRate || !watchedAmount || !watchedExchangeRate) return null;
    if (watchedInvoiceCurrency === 'USD' && watchedPaymentCurrency === 'UYU')
      return watchedAmount / watchedExchangeRate;
    if (watchedInvoiceCurrency === 'UYU' && watchedPaymentCurrency === 'USD')
      return watchedAmount * watchedExchangeRate;
    return null;
  }, [showExchangeRate, watchedAmount, watchedExchangeRate, watchedInvoiceCurrency, watchedPaymentCurrency]);

  // Keep exchange_rate in sync with session rate
  React.useEffect(() => {
    const isSameAsClinicCurrency = watchedInvoiceCurrency === companyCurrency;
    if (showExchangeRate && watchedInvoiceCurrency !== watchedPaymentCurrency) {
      form.setValue('exchange_rate', isSameAsClinicCurrency ? 1 : sessionExchangeRate);
    } else if (!showExchangeRate) {
      form.setValue('exchange_rate', 1);
    }
  }, [showExchangeRate, sessionExchangeRate, form, watchedInvoiceCurrency, watchedPaymentCurrency, companyCurrency]);

  // ── Credits total with currency conversion ───────────────────────────────
  const creditsTotalInInvoiceCurrency = React.useMemo(() => {
    if (!invoice) return 0;
    const invoiceCurrency = invoice.currency || 'USD';
    return Array.from(appliedCredits.entries()).reduce((sum, [creditId, amount]) => {
      const credit = userCredits.find((c) => c.source_id === creditId);
      if (!credit) return sum;
      let converted = amount;
      if (credit.currency !== invoiceCurrency) {
        if (invoiceCurrency === 'USD' && credit.currency === 'UYU')
          converted = amount / sessionExchangeRate;
        else if (invoiceCurrency === 'UYU' && credit.currency === 'USD')
          converted = amount * sessionExchangeRate;
      }
      return sum + converted;
    }, 0);
  }, [appliedCredits, userCredits, invoice, sessionExchangeRate]);

  // Auto-adjust payment amount when credits change
  React.useEffect(() => {
    if (!invoice || !isOpen) return;
    const invoiceTotal = invoice.total || 0;
    const invoiceCurrency = invoice.currency || 'USD';
    const remainingBalance = Math.max(0, invoiceTotal - paidAmount - creditsTotalInInvoiceCurrency);
    const paymentCurrency = form.getValues('payment_currency') || invoiceCurrency;
    let amountToSet = remainingBalance;
    if (paymentCurrency !== invoiceCurrency && sessionExchangeRate > 0) {
      if (invoiceCurrency === 'USD' && paymentCurrency === 'UYU')
        amountToSet = remainingBalance * sessionExchangeRate;
      else if (invoiceCurrency === 'UYU' && paymentCurrency === 'USD')
        amountToSet = remainingBalance / sessionExchangeRate;
    }
    form.setValue('amount', Math.round(amountToSet * 100) / 100);
  }, [creditsTotalInInvoiceCurrency, invoice, isOpen, form, sessionExchangeRate, appliedCredits.size, paidAmount]);

  // Remaining amount (live, as user types)
  const remainingAmountToPay = React.useMemo(() => {
    if (!invoice) return 0;
    const invoiceTotal = invoice.total || 0;
    let paymentAmountInInvoiceCurrency = 0;
    if (watchedAmount) {
      paymentAmountInInvoiceCurrency =
        showExchangeRate && equivalentAmount ? equivalentAmount : watchedAmount;
    }
    const balance =
      invoiceTotal - paidAmount - paymentAmountInInvoiceCurrency - creditsTotalInInvoiceCurrency;
    const rounded = Math.round(balance * 100) / 100;
    return rounded === 0 ? 0 : rounded;
  }, [invoice, watchedAmount, showExchangeRate, equivalentAmount, creditsTotalInInvoiceCurrency, paidAmount]);

  // ── Data loading ──────────────────────────────────────────────────────────
  const fetchPaymentMethods = React.useCallback(async () => {
    try {
      const data = await api.get(API_ROUTES.PAYMENT_METHODS);
      const raw = Array.isArray(data) ? data : data.payment_methods || data.data || [];
      setPaymentMethods(raw.map((m: any) => ({ ...m, id: String(m.id) })));
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not load payment methods.' });
    }
  }, [toast]);

  const fetchUserCredits = React.useCallback(async (userId: string) => {
    try {
      const data = await api.get(API_ROUTES.USER_CREDIT, { user_id: userId });
      const valid = Array.isArray(data)
        ? data.filter((c: any) => c && c.source_id && c.available_balance !== undefined)
        : [];
      setUserCredits(valid);
    } catch {
      setUserCredits([]);
    }
  }, []);

  const fetchInvoicePaidAmount = React.useCallback(async (invoiceId: string) => {
    try {
      const route = isSales ? API_ROUTES.SALES.INVOICE_PAYMENTS : API_ROUTES.PURCHASES.INVOICE_PAYMENTS;
      const data = await api.get(route, { invoice_id: invoiceId, is_sales: isSales ? 'true' : 'false' });
      const paymentsData = Array.isArray(data) ? data : (data.payments || data.data || []);
      const total = paymentsData.reduce((sum: number, p: any) => {
        if (p?.status === 'failed') return sum;
        const applied = parseFloat(p?.amount_applied ?? p?.amount ?? 0);
        return sum + (Number.isFinite(applied) ? applied : 0);
      }, 0);
      setPaidAmount(Math.round(total * 100) / 100);
    } catch {
      setPaidAmount(0);
    }
  }, [isSales]);

  // Initialize form when dialog opens
  React.useEffect(() => {
    if (!isOpen || !invoice) return;
    const invoiceCurrency = invoice.currency || 'USD';
    form.reset({
      amount: Math.max(0, (invoice.total || 0) - (invoice.paid_amount || 0)),
      method: '',
      status: 'completed',
      payment_date: new Date(),
      invoice_currency: invoiceCurrency,
      payment_currency: invoiceCurrency,
      exchange_rate: 1,
      is_historical: invoice.is_historical || false,
    });
    setAppliedCredits(new Map());
    setUserCredits([]);
    setPaidAmount(invoice.paid_amount || 0);
    setPaymentSubmissionError(null);

    fetchPaymentMethods();
    fetchUserCredits(invoice.user_id);
    fetchInvoicePaidAmount(invoice.id);

    api.get(API_ROUTES.CLINIC).then((clinicData) => {
      setCompanyCurrency(clinicData.currency || 'USD');
    }).catch(() => {});
  }, [isOpen, invoice, fetchPaymentMethods, fetchUserCredits, fetchInvoicePaidAmount, form]);

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (values: PaymentFormValues) => {
    if (!invoice) return;

    let sessionId: string | null = null;

    if (!values.is_historical) {
      const sessionValidation = await validateActiveSession();
      if (!sessionValidation.isValid) {
        setIsNoSessionAlertOpen(true);
        return;
      }
      sessionId = sessionValidation.sessionId || null;
    }

    const totalCredits = Array.from(appliedCredits.values()).reduce((a, b) => a + b, 0);
    if (values.amount <= 0 && totalCredits <= 0) {
      setPaymentSubmissionError(t('validation.noPaymentAmount'));
      return;
    }

    const invoiceTotal = invoice.total || 0;
    const invoiceCurrency = invoice.currency || 'USD';

    let paymentAmountInInvoiceCurrency = 0;
    if (values.amount) {
      paymentAmountInInvoiceCurrency =
        showExchangeRate && equivalentAmount ? equivalentAmount : values.amount;
    }

    // Recalculate inside submit to use latest sessionExchangeRate
    const creditsTotalConverted = Array.from(appliedCredits.entries()).reduce(
      (sum, [creditId, amount]) => {
        const credit = userCredits.find((c) => c.source_id === creditId);
        if (!credit) return sum;
        let converted = amount;
        if (credit.currency !== invoiceCurrency) {
          if (invoiceCurrency === 'USD' && credit.currency === 'UYU')
            converted = amount / sessionExchangeRate;
          else if (invoiceCurrency === 'UYU' && credit.currency === 'USD')
            converted = amount * sessionExchangeRate;
        }
        return sum + converted;
      },
      0
    );

    const remainingBalance = invoiceTotal - paidAmount;
    const totalAttemptedPayment = paymentAmountInInvoiceCurrency + creditsTotalConverted;

    if (creditsTotalConverted > remainingBalance + 0.01) {
      setPaymentSubmissionError(t('validation.overpayment'));
      return;
    }
    if (values.amount <= 0 && totalAttemptedPayment > remainingBalance + 0.01) {
      setPaymentSubmissionError(t('validation.overpayment'));
      return;
    }

    setPaymentSubmissionError(null);
    setIsSubmitting(true);

    const selectedMethod = paymentMethods.find((pm) => pm.id === values.method);
    const convertedAmount =
      showExchangeRate && equivalentAmount ? equivalentAmount : values.amount;

    try {
      const payload = {
        cash_session_id: sessionId,
        user,
        client_user: {
          id: invoice.user_id,
          name: invoice.user_name || '',
          email: invoice.userEmail || '',
        },
        credit_payment: Array.from(appliedCredits.entries()).map(([id, amount]) => {
          const credit = userCredits.find((c) => c.source_id === id);
          const exchangeRate = credit?.currency === invoiceCurrency ? 1 : sessionExchangeRate;
          return {
            source_id: id,
            amount,
            type: credit?.type,
            currency: credit?.currency,
            exchange_rate: exchangeRate,
          };
        }),
        query: {
          invoice_id: parseInt(invoice.id, 10),
          payment_date: formatISO(values.payment_date),
          amount: values.amount,
          converted_amount: convertedAmount,
          method: selectedMethod?.name || 'Credit',
          payment_method_id: values.method,
          status: values.status,
          user_id: invoice.user_id,
          invoice_currency: invoiceCurrency,
          payment_currency: values.payment_currency,
          exchange_rate: values.exchange_rate || 1,
          is_sales: isSales,
          total_paid: totalAttemptedPayment,
          notes: values.notes || '',
          is_historical: values.is_historical || false,
        },
      };

      const endpoint = isSales
        ? API_ROUTES.SALES.INVOICE_PAYMENT
        : API_ROUTES.PURCHASES.INVOICE_PAYMENT;
      const responseData = await api.post(endpoint, payload);

      if (responseData.error || (responseData.code && responseData.code >= 400)) {
        throw new Error(responseData.message || 'Failed to add payment.');
      }

      toast({
        title: t('paymentDialog.success'),
        description: t('paymentDialog.successDescription', {
          invoiceId: invoice.doc_no || invoice.id,
        }),
      });

      if (!values.is_historical) {
        await checkActiveSession();
      }

      onSuccess();
      onClose();
    } catch (error) {
      setPaymentSubmissionError(
        error instanceof Error ? error.message : 'Failed to add payment.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent maxWidth="2xl">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className="flex flex-col flex-1 w-full overflow-hidden"
            >
              <DialogHeader>
                <div className="flex items-start gap-3">
                  <div className="header-icon-circle mt-0.5">
                    <CreditCard className="h-5 w-5" />
                  </div>
                  <div className="flex flex-col text-left">
                    <DialogTitle>{t('paymentDialog.title')}</DialogTitle>
                    <DialogDescription>
                      {t('paymentDialog.description', {
                        invoiceId: invoice?.doc_no || invoice?.id,
                      })}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <DialogBody className="space-y-4 py-4 px-6">
                {paymentSubmissionError && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>{t('toast.error')}</AlertTitle>
                    <AlertDescription>{paymentSubmissionError}</AlertDescription>
                  </Alert>
                )}

                {/* Credits */}
                {invoice?.type !== 'credit_note' && userCredits.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-semibold">{t('paymentDialog.useCredits')}</h4>
                    <ScrollArea className="h-32 border rounded-md p-2">
                      {userCredits.map((credit) => (
                        <div
                          key={credit.source_id}
                          className="flex items-center justify-between p-2"
                        >
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id={`credit-${credit.source_id}`}
                              checked={appliedCredits.has(credit.source_id)}
                              onCheckedChange={(checked) => {
                                const next = new Map(appliedCredits);
                                if (checked) {
                                  next.set(
                                    credit.source_id,
                                    Number(credit.available_balance) || 0
                                  );
                                } else {
                                  next.delete(credit.source_id);
                                }
                                setAppliedCredits(next);
                              }}
                            />
                            <Label htmlFor={`credit-${credit.source_id}`}>
                              {credit.type === 'credit_note'
                                ? t('paymentDialog.creditNote')
                                : t('paymentDialog.paymentRef')}{' '}
                              #{credit.source_id} ({credit.currency})
                            </Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              className="h-8 w-24"
                              max={Number(credit.available_balance) || 0}
                              value={appliedCredits.get(credit.source_id) || ''}
                              disabled={!appliedCredits.has(credit.source_id)}
                              onChange={(e) => {
                                const next = new Map(appliedCredits);
                                next.set(
                                  credit.source_id,
                                  Math.min(
                                    Number(e.target.value),
                                    Number(credit.available_balance) || 0
                                  )
                                );
                                setAppliedCredits(next);
                              }}
                            />
                            <span className="text-sm text-muted-foreground">
                              / {Number(credit.available_balance).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </ScrollArea>
                  </div>
                )}

                {/* Payment fields */}
                <div className="space-y-4 pt-4 border-t">
                  <h4 className="font-semibold text-sm">{t('paymentDialog.manualPayment')}</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="method"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('paymentDialog.method')}</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={t('paymentDialog.selectMethod')} />
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
                      name="payment_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('paymentDialog.date')}</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    'w-full pl-3 text-left font-normal',
                                    !field.value && 'text-muted-foreground'
                                  )}
                                >
                                  {field.value ? (
                                    format(field.value, 'PPP')
                                  ) : (
                                    <span>{t('paymentDialog.pickDate')}</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <DatePicker
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                disabled={(date: Date) =>
                                  date > new Date() || date < new Date('1900-01-01')
                                }
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
                      name="amount"
                      render={({ field: { onChange, value } }) => (
                        <FormItem>
                          <FormLabel>
                            {t('paymentDialog.amount')} ({watchedPaymentCurrency})
                          </FormLabel>
                          <FormControl>
                            <FormattedNumberInput
                              value={value}
                              onChange={onChange}
                              placeholder="0.00"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="payment_currency"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('paymentDialog.currency')}</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={t('paymentDialog.selectCurrency')} />
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
                </div>

                {/* Exchange rate */}
                {showExchangeRate && (
                  <div className="grid grid-cols-2 gap-4 rounded-md border p-4">
                    <FormField
                      control={form.control}
                      name="exchange_rate"
                      render={({ field: { onChange, value } }) => (
                        <FormItem>
                          <FormLabel>{t('paymentDialog.exchangeRate')}</FormLabel>
                          <FormControl>
                            <FormattedNumberInput
                              value={value}
                              onChange={onChange}
                              placeholder="0.00"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {equivalentAmount !== null && (
                      <FormItem>
                        <FormLabel>
                          {t('paymentDialog.equivalentAmount')} ({watchedInvoiceCurrency})
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            value={equivalentAmount.toFixed(2)}
                            readOnly
                            disabled
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  </div>
                )}

                {/* Summary */}
                <div className="rounded-md border p-4 bg-muted/50 space-y-3">
                  <h4 className="font-semibold text-sm">{t('paymentDialog.summary')}</h4>

                  {showExchangeRate && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {t('paymentDialog.exchangeRateApplied')}:
                      </span>
                      <span>{Number(sessionExchangeRate).toFixed(2)}</span>
                    </div>
                  )}

                  {appliedCredits.size > 0 && (
                    <div className="space-y-1">
                      <span className="text-xs font-medium text-muted-foreground">
                        {t('paymentDialog.creditsApplied')}:
                      </span>
                      {Array.from(appliedCredits.entries()).map(([id, amount]) => {
                        const credit = userCredits.find((c) => c.source_id === id);
                        const invoiceCurrency = invoice?.currency || 'USD';
                        let converted = amount;
                        if (credit && credit.currency !== invoiceCurrency) {
                          if (invoiceCurrency === 'USD' && credit.currency === 'UYU')
                            converted = amount / sessionExchangeRate;
                          else if (invoiceCurrency === 'UYU' && credit.currency === 'USD')
                            converted = amount * sessionExchangeRate;
                        }
                        return (
                          <div key={id} className="flex justify-between text-sm pl-2">
                            <span>
                              #{id} ({credit?.currency})
                            </span>
                            <div className="flex flex-col items-end">
                              <span>
                                {new Intl.NumberFormat('en-US', {
                                  style: 'currency',
                                  currency: credit?.currency || 'USD',
                                }).format(amount)}
                              </span>
                              {credit?.currency !== invoiceCurrency && (
                                <span className="text-xs text-muted-foreground">
                                  ≈{' '}
                                  {new Intl.NumberFormat('en-US', {
                                    style: 'currency',
                                    currency: invoiceCurrency,
                                  }).format(converted)}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {(watchedAmount ?? 0) > 0 && (
                    <div className="space-y-1 pt-2 border-t">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{t('paymentDialog.manualPayment')}:</span>
                        <div className="flex flex-col items-end">
                          <span>
                            {new Intl.NumberFormat('en-US', {
                              style: 'currency',
                              currency: watchedPaymentCurrency || 'USD',
                            }).format(watchedAmount ?? 0)}
                          </span>
                          {watchedPaymentCurrency !== (invoice?.currency || 'USD') &&
                            equivalentAmount && (
                              <span className="text-xs text-muted-foreground">
                                ≈{' '}
                                {new Intl.NumberFormat('en-US', {
                                  style: 'currency',
                                  currency: invoice?.currency || 'USD',
                                }).format(equivalentAmount)}
                              </span>
                            )}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-2 border-t font-semibold">
                    <span>{t('paymentDialog.totalPayment')}:</span>
                    <span>
                      {(() => {
                        const invoiceCurrency = invoice?.currency || 'USD';
                        let total = creditsTotalInInvoiceCurrency;
                        if (watchedAmount) {
                          total +=
                            showExchangeRate && equivalentAmount
                              ? equivalentAmount
                              : Number(watchedAmount);
                        }
                        return new Intl.NumberFormat('en-US', {
                          style: 'currency',
                          currency: invoiceCurrency,
                        }).format(Math.round(total * 100) / 100);
                      })()}
                    </span>
                  </div>
                </div>

                {/* Remaining */}
                <div className="flex justify-between items-center bg-muted p-3 rounded-md">
                  <span className="font-semibold text-lg">
                    {t('paymentDialog.remainingAmount')}
                  </span>
                  <span className="font-bold text-lg">
                    {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: invoice?.currency || 'USD',
                    }).format(remainingAmountToPay)}
                  </span>
                </div>

                {/* Notes */}
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('paymentDialog.notes')}</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={t('paymentDialog.notesPlaceholder')}
                          {...field}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Historical */}
                <FormField
                  control={form.control}
                  name="is_historical"
                  render={({ field }) => (
                    <>
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>{t('paymentDialog.isHistorical')}</FormLabel>
                          <p className="text-xs text-muted-foreground">
                            {t('paymentDialog.isHistoricalDescription')}
                          </p>
                        </div>
                      </FormItem>
                      {field.value && (
                        <Alert variant="default" className="bg-amber-50 border-amber-200">
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                          <AlertTitle className="text-amber-800 text-sm">
                            {t('paymentDialog.isHistoricalWarning')}
                          </AlertTitle>
                          <AlertDescription className="text-amber-700 text-xs">
                            {t('paymentDialog.isHistoricalDescription')}
                          </AlertDescription>
                        </Alert>
                      )}
                    </>
                  )}
                />
              </DialogBody>

              <DialogFooter>
                <Button variant="outline" type="button" onClick={onClose}>
                  {t('paymentDialog.cancel')}
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {t('paymentDialog.add')}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* No cash session alert */}
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
            <AlertDialogCancel>{t('paymentDialog.cancel')}</AlertDialogCancel>
            {canAccessCashier && (
              <Link href={`/${locale}/cashier`} passHref>
                <Button>
                  <Box className="mr-2 h-4 w-4" />
                  {t('noSessionDialog.openCashSession')}
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
