'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CalendarIcon, Check, CreditCard, Loader2, Mail, Printer, Receipt, X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { FormattedNumberInput } from '@/components/ui/formatted-number-input';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ResizableSheet, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/resizable-sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { InvoiceItemsTable } from '@/components/tables/invoice-items-table';
import { PaymentsTable } from '@/components/tables/payments-table';
import { Can } from '@/components/auth/Can';
import { API_ROUTES } from '@/constants/routes';
import { Invoice, InvoiceItem, Payment, PaymentMethod } from '@/lib/types';
import { cn } from '@/lib/utils';
import { api } from '@/services/api';
import { confirmInvoice, sendInvoiceEmail } from '@/services/invoices';
import { useToast } from '@/hooks/use-toast';
import { SHEET_TAB_CLASS, hasValidPayments } from '@/components/appointments/sheet-utils';
import { useCashSessionValidation } from '@/hooks/use-cash-session-validation';
import { DatePicker } from '@/components/ui/date-picker';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { format } from 'date-fns';
import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { VerticalTab } from '../ui/vertical-tab-strip';

// ── Data fetching ────────────────────────────────────────────────────────────

async function fetchInvoiceItems(invoiceId: string): Promise<InvoiceItem[]> {
  try {
    const data = await api.get(API_ROUTES.SALES.INVOICE_ITEMS, { invoice_id: invoiceId, is_sales: 'true' });
    const raw: any[] = Array.isArray(data) ? data : (data.invoice_items || data.data || []);
    return raw.map((a: any) => {
      const rawId = a.service_id || a.product_id;
      return {
        id: String(a.id || `ii_${Math.random().toString(36).slice(2, 9)}`),
        service_id: Array.isArray(rawId) ? String(rawId[0]) : String(rawId || ''),
        service_name: a.service_name || a.product_name || a.name || a.display_name ||
          (Array.isArray(rawId) ? rawId[1] : ''),
        quantity: a.quantity || a.product_uom_qty || 0,
        unit_price: a.unit_price || a.price_unit || 0,
        total: a.total || a.price_total || 0,
      };
    });
  } catch { return []; }
}

async function fetchInvoicePayments(invoiceId: string): Promise<Payment[]> {
  try {
    const data = await api.get(API_ROUTES.SALES.INVOICE_PAYMENTS, { invoice_id: invoiceId, is_sales: 'true' });
    const raw: any[] = Array.isArray(data) ? data : (data.payments || data.data || []);
    if (!hasValidPayments(raw)) return [];
    const isNew = raw[0]?.amount_applied !== undefined && typeof raw[0].amount_applied === 'string';
    return raw.map((a: any) => ({
      id: String(a.transaction_id || a.id || ''),
      doc_no: a.doc_no || String(a.transaction_doc_no || 'N/A'),
      invoice_id: a.invoice_id || null,
      invoice_doc_no: a.invoice_doc_no || '',
      order_id: a.order_id || '',
      order_doc_no: a.order_doc_no || '',
      quote_id: a.quote_id || null,
      user_name: a.user_name || '',
      amount: isNew ? parseFloat(a.amount_applied) : (parseFloat(a.amount_applied) || 0),
      amount_applied: isNew ? parseFloat(a.amount_applied) : (parseFloat(a.amount_applied) || 0),
      source_amount: isNew ? parseFloat(a.source_amount) : (parseFloat(a.source_amount) || 0),
      source_currency: (a.source_currency || 'USD') as 'UYU' | 'USD',
      method: a.payment_method_name || a.payment_method || '',
      payment_method: a.payment_method_name || a.payment_method || '',
      payment_method_code: a.payment_method_code,
      status: a.status || 'completed',
      createdAt: a.payment_date || a.created_at || '',
      updatedAt: a.payment_date || a.updated_at || a.created_at || '',
      payment_date: a.payment_date || a.created_at || '',
      currency: isNew ? a.invoice_currency : (a.source_currency || 'USD'),
      exchange_rate: parseFloat(a.exchange_rate) || 1,
      transaction_type: (a.transaction_type || 'direct_payment') as 'direct_payment' | 'credit_note_allocation' | 'payment_allocation',
      transaction_id: a.transaction_id ? String(a.transaction_id) : null,
      type: (a.type || null) as 'invoice' | 'credit_note' | null,
      notes: a.notes || '',
      is_historical: a.is_historical || false,
    }));
  } catch { return []; }
}

// ── Status helpers ─────────────────────────────────────────────────────────

function statusVariant(status: string): 'success' | 'destructive' | 'info' | 'outline' | 'default' {
  switch (status.toLowerCase()) {
    case 'confirmed': case 'posted': case 'paid': return 'success';
    case 'cancelled': case 'cancel': return 'destructive';
    case 'draft': return 'outline';
    default: return 'default';
  }
}

function paymentVariant(status: string): 'success' | 'info' | 'outline' | 'default' {
  switch (status.toLowerCase()) {
    case 'paid': return 'success';
    case 'partial': case 'partially_paid': return 'info';
    default: return 'outline';
  }
}

// ── Payment Form Schema ───────────────────────────────────────────────────────

const paymentFormSchema = (t: (key: string) => string) => z.object({
  amount: z.coerce.number().min(0, t('validation.amountPositive')),
  method: z.string().optional(),
  status: z.enum(['pending', 'completed', 'failed']),
  payment_date: z.date({
    required_error: t('validation.dateRequired'),
  }),
  invoice_currency: z.string(),
  payment_currency: z.string(),
  exchange_rate: z.coerce.number().optional(),
  notes: z.string().optional(),
  is_historical: z.boolean().optional(),
}).refine(data => {
  if (data.amount > 0 && !data.method) {
    return false;
  }
  return true;
}, {
  message: 'Method is required when paying an amount.',
  path: ['method'],
}).refine(data => {
  if (data.invoice_currency !== data.payment_currency) {
    return data.exchange_rate && data.exchange_rate > 0;
  }
  return true;
}, {
  message: 'Exchange rate is required when currencies are different.',
  path: ['exchange_rate'],
});

type PaymentFormValues = z.infer<ReturnType<typeof paymentFormSchema>>;

// ── Component ────────────────────────────────────────────────────────────────

interface InvoiceDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice;
  onDataChange?: () => void;
}

export function InvoiceDetailSheet({ open, onOpenChange, invoice, onDataChange }: InvoiceDetailSheetProps) {
  const t = useTranslations('InvoicesPage');
  const { toast } = useToast();
  const { validateActiveSession } = useCashSessionValidation();
  const [activeTab, setActiveTab] = React.useState('items');
  const [isLoading, setIsLoading] = React.useState(true);
  const [actionLoading, setActionLoading] = React.useState<string | null>(null);
  const [isPrinting, setIsPrinting] = React.useState(false);
  const [refreshKey, setRefreshKey] = React.useState(0);

  // Local state for invoice header (updated optimistically after actions)
  const [currentInvoice, setCurrentInvoice] = React.useState<Invoice | null>(null);

  // Sync from prop when the invoice changes (e.g. sheet reopened with different invoice)
  React.useEffect(() => {
    setCurrentInvoice(invoice);
  }, [invoice]);

  // Payment dialog state
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = React.useState(false);
  const [isNoSessionAlertOpen, setIsNoSessionAlertOpen] = React.useState(false);
  const [paymentSubmissionError, setPaymentSubmissionError] = React.useState<string | null>(null);
  const [paymentMethods, setPaymentMethods] = React.useState<PaymentMethod[]>([]);

  const [items, setItems] = React.useState<InvoiceItem[]>([]);
  const [payments, setPayments] = React.useState<Payment[]>([]);

  // Payment form
  const paymentForm = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema(t)),
    defaultValues: {
      status: 'completed',
      notes: '',
    }
  });

  const watchedAmount = paymentForm.watch('amount');
  const watchedPaymentCurrency = paymentForm.watch('payment_currency');
  const watchedInvoiceCurrency = paymentForm.watch('invoice_currency');
  const watchedExchangeRate = paymentForm.watch('exchange_rate');

  const showExchangeRate = watchedInvoiceCurrency && watchedPaymentCurrency && watchedInvoiceCurrency !== watchedPaymentCurrency;

  const equivalentAmount = React.useMemo(() => {
    if (!showExchangeRate || !watchedAmount || !watchedExchangeRate) return null;
    if (watchedInvoiceCurrency === 'USD' && watchedPaymentCurrency === 'UYU') {
      return watchedAmount / watchedExchangeRate;
    }
    if (watchedInvoiceCurrency === 'UYU' && watchedPaymentCurrency === 'USD') {
      return watchedAmount * watchedExchangeRate;
    }
    return null;
  }, [showExchangeRate, watchedAmount, watchedExchangeRate, watchedInvoiceCurrency, watchedPaymentCurrency]);

  React.useEffect(() => {
    if (!open || !invoice?.id) return;
    let active = true;
    setIsLoading(true);
    Promise.all([
      fetchInvoiceItems(invoice.id),
      fetchInvoicePayments(invoice.id),
    ]).then(([i, p]) => {
      if (!active) return;
      setItems(i);
      setPayments(p);
      setIsLoading(false);
    });
    return () => { active = false; };
  }, [open, invoice?.id, refreshKey]);

  // Derived state from current invoice data
  const currentInvoiceData = currentInvoice || invoice;

  // Fetch payment methods
  const fetchPaymentMethods = React.useCallback(async () => {
    try {
      const data = await api.get(API_ROUTES.PAYMENT_METHODS);
      const methodsData = Array.isArray(data) ? data : (data.methods || data.data || []);
      setPaymentMethods(methodsData.map((m: any) => ({ ...m, id: String(m.id) })));
    } catch { setPaymentMethods([]); }
  }, []);

  const handleOpenPaymentDialog = React.useCallback(async () => {
    fetchPaymentMethods();
    paymentForm.reset({
      amount: invoice.total - (invoice.paid_amount || 0),
      method: '',
      status: 'completed',
      payment_date: new Date(),
      invoice_currency: invoice.currency || 'USD',
      payment_currency: invoice.currency || 'USD',
      exchange_rate: 1,
      is_historical: invoice.is_historical || false,
    });
    setIsPaymentDialogOpen(true);
  }, [invoice, paymentForm, fetchPaymentMethods]);

  const handlePaymentSubmit = async (values: PaymentFormValues) => {
    if (!invoice) return;

    // Validate cash session if not historical
    let sessionId: string | null = null;

    if (!values.is_historical) {
      const sessionValidation = await validateActiveSession();
      if (!sessionValidation.isValid) {
        setIsNoSessionAlertOpen(true);
        return;
      }
      sessionId = sessionValidation.sessionId || null;
    }

    setActionLoading('payment');
    setPaymentSubmissionError(null);

    const selectedMethod = paymentMethods.find(pm => pm.id === values.method);

    try {
      const payload = {
        cash_session_id: sessionId,
        user: { id: invoice.user_id, name: invoice.user_name },
        client_user: { id: invoice.user_id, name: invoice.user_name },
        query: {
          invoice_id: parseInt(invoice.id, 10),
          payment_date: values.payment_date.toISOString(),
          amount: values.amount,
          converted_amount: showExchangeRate && equivalentAmount ? equivalentAmount : values.amount,
          method: selectedMethod?.name || 'Credit',
          payment_method_id: values.method,
          status: values.status,
          user_id: invoice.user_id,
          invoice_currency: invoice.currency,
          payment_currency: values.payment_currency,
          exchange_rate: values.exchange_rate || 1,
          is_sales: true,
          total_paid: values.amount,
          notes: values.notes || '',
          is_historical: values.is_historical || false
        }
      };

      await api.post(API_ROUTES.SALES.INVOICE_PAYMENT, payload);

      // Update header state optimistically
      const amountInInvoiceCurrency = showExchangeRate && equivalentAmount ? equivalentAmount : values.amount;
      setCurrentInvoice(prev => {
        const base = prev || invoice;
        const newPaidAmount = (base.paid_amount || 0) + amountInInvoiceCurrency;
        const newPaymentStatus = newPaidAmount >= base.total ? 'paid' : 'partial';
        return { ...base, paid_amount: newPaidAmount, payment_status: newPaymentStatus };
      });

      toast({ title: t('paymentDialog.success') || 'Pago registrado correctamente' });
      setIsPaymentDialogOpen(false);
      setRefreshKey(prev => prev + 1);
      onDataChange?.();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error al registrar pago';
      setPaymentSubmissionError(errorMessage);
    } finally {
      setActionLoading(null);
    }
  };

  const handleConfirm = React.useCallback(async () => {
    setActionLoading('confirm');
    try {
      await confirmInvoice(currentInvoiceData.id);
      // Update header state optimistically: confirmed invoices move to 'booked'
      setCurrentInvoice(prev => ({ ...(prev || invoice), status: 'booked' }));
      toast({ title: t('actions.confirmSuccess') || 'Factura confirmada' });
      setRefreshKey(prev => prev + 1);
      onDataChange?.();
    } catch {
      toast({ variant: 'destructive', title: t('actions.confirmError') || 'Error al confirmar' });
    } finally {
      setActionLoading(null);
    }
  }, [currentInvoiceData?.id, invoice, toast, onDataChange, t]);

  const handlePrint = React.useCallback(async () => {
    setIsPrinting(true);
    try {
      const blob = await api.getBlob(API_ROUTES.SALES.API_INVOICE_PRINT, { id: invoice.id });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `factura-${invoice.doc_no || invoice.invoice_ref || invoice.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast({ variant: 'destructive', title: t('actions.printError') || 'Error al descargar' });
    } finally {
      setIsPrinting(false);
    }
  }, [invoice.id, invoice.doc_no, invoice.invoice_ref, toast, t]);

  const handleSendEmail = React.useCallback(async () => {
    setActionLoading('email');
    try {
      await sendInvoiceEmail(currentInvoiceData.id);
      toast({ title: t('actions.emailSuccess') || 'Factura enviada por email' });
    } catch {
      toast({ variant: 'destructive', title: t('actions.emailError') || 'Error al enviar' });
    } finally {
      setActionLoading(null);
    }
  }, [currentInvoiceData?.id, toast, t]);

  const docLabel = currentInvoiceData.doc_no || currentInvoiceData.invoice_ref || currentInvoiceData.id;
  const totalFormatted = new Intl.NumberFormat('es-UY', {
    style: 'currency',
    currency: currentInvoiceData.currency || 'USD',
    minimumFractionDigits: 2,
  }).format(currentInvoiceData.total || 0);

  const canShowConfirmAction = currentInvoiceData.status === 'draft';
  const canShowPaymentAction = currentInvoiceData.status === 'booked' && currentInvoiceData.payment_status !== 'paid';

  const tabs: VerticalTab[] = [
    { id: 'items', icon: Check, label: t('InvoiceItemsTable.title') },
    { id: 'payments', icon: CreditCard, label: t('tabs.payments') },
  ];

  return (
    <ResizableSheet
      open={open}
      onOpenChange={onOpenChange}
      defaultWidth={800}
      minWidth={480}
      maxWidth={1200}
      storageKey="invoice-detail-sheet-width"
    >
      <div className="flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex-none border-b border-border bg-card px-6 py-4 pr-14">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted shrink-0">
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <SheetTitle className="text-lg font-semibold">
                    {t('columns.docNo')}: {docLabel}
                  </SheetTitle>
                  <Badge variant={statusVariant(currentInvoiceData.status)} className="text-xs capitalize">
                    {currentInvoiceData.status}
                  </Badge>
                  <Badge variant={paymentVariant(currentInvoiceData.payment_status || '')} className="text-xs capitalize">
                    {currentInvoiceData.payment_status?.replace(/_/g, ' ')}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  {currentInvoiceData.user_name && (
                    <span className="text-sm text-muted-foreground">{currentInvoiceData.user_name}</span>
                  )}
                  <span className="text-sm font-medium">{totalFormatted}</span>
                </div>
                <SheetDescription className="sr-only">{t('title')}</SheetDescription>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0 px-6 py-3">
          {isLoading ? (
            <div className="space-y-3 pt-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
              <TabsList className="bg-transparent p-0 border-b border-border rounded-none gap-0 overflow-x-auto overflow-y-hidden flex-nowrap shrink-0 justify-start h-auto">
                <TabsTrigger value="items" className={SHEET_TAB_CLASS}>{t('InvoiceItemsTable.title')}</TabsTrigger>
                <TabsTrigger value="payments" className={SHEET_TAB_CLASS}>{t('tabs.payments')}</TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-auto mt-3">
                <TabsContent value="items" className="m-0">
                  <InvoiceItemsTable items={items} canEdit={false} />
                </TabsContent>
                <TabsContent value="payments" className="m-0">
                  <PaymentsTable payments={payments} />
                </TabsContent>
              </div>
            </Tabs>
          )}
        </div>

        {/* Footer with Actions */}
        <SheetFooter className="flex-col gap-2 sm:flex-row border-t border-border px-6 py-4">
          <div className="flex gap-2 flex-wrap">
            <Can permission="SALES_INVOICES_PRINT">
              <Button variant="outline" size="sm" onClick={handlePrint} disabled={isPrinting}>
                {isPrinting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
                {t('actions.print') || 'Imprimir'}
              </Button>
            </Can>
            <Can permission="SALES_INVOICES_SEND_EMAIL">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSendEmail}
                disabled={actionLoading === 'email'}
              >
                {actionLoading === 'email' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                {t('actions.sendEmail') || 'Enviar Email'}
              </Button>
            </Can>
          </div>

          {canShowConfirmAction && (
            <Can permission="SALES_INVOICES_CONFIRM">
              <Button
                size="sm"
                onClick={handleConfirm}
                disabled={actionLoading === 'confirm'}
              >
                {actionLoading === 'confirm' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                {t('actions.confirm') || 'Confirmar'}
              </Button>
            </Can>
          )}

          {canShowPaymentAction && (
            <Can permission="SALES_PAYMENTS_CREATE">
              <Button size="sm" onClick={handleOpenPaymentDialog}>
                <CreditCard className="mr-2 h-4 w-4" />
                {t('actions.registerPayment') || 'Registrar Pago'}
              </Button>
            </Can>
          )}
        </SheetFooter>
      </div>

      {/* Complete Payment Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent maxWidth="2xl">
          <Form {...paymentForm}>
            <form onSubmit={paymentForm.handleSubmit(handlePaymentSubmit)} className="flex flex-col flex-1 w-full overflow-hidden">
              <DialogHeader>
                <div className="flex items-start gap-3">
                  <div className="header-icon-circle mt-0.5">
                    <CreditCard className="h-5 w-5" />
                  </div>
                  <div className="flex flex-col text-left">
                    <DialogTitle>{t('paymentDialog.title')}</DialogTitle>
                    <DialogDescription>
                      {t('paymentDialog.description', { invoiceId: docLabel })}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              <div className="space-y-4 py-4 px-6">
                {paymentSubmissionError && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>{t('toast.error')}</AlertTitle>
                    <AlertDescription>{paymentSubmissionError}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-4 pt-4 border-t">
                  <h4 className="font-semibold text-sm">{t('paymentDialog.manualPayment')}</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={paymentForm.control}
                      name="method"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('paymentDialog.method')}</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={t('paymentDialog.selectMethod')} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {paymentMethods.map(method => (
                                <SelectItem key={method.id} value={method.id}>{method.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={paymentForm.control}
                      name="payment_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('paymentDialog.date')}</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant={"outline"}
                                  className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {field.value ? (
                                    format(field.value, "PPP")
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
                                  date > new Date() || date < new Date("1900-01-01")
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
                      control={paymentForm.control}
                      name="amount"
                      render={({ field: { onChange, value } }) => (
                        <FormItem>
                          <FormLabel>{t('paymentDialog.amount')} ({watchedPaymentCurrency})</FormLabel>
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
                      control={paymentForm.control}
                      name="payment_currency"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('paymentDialog.currency')}</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
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

                {showExchangeRate && (
                  <div className="grid grid-cols-2 gap-4 rounded-md border p-4 mt-4">
                    <FormField
                      control={paymentForm.control}
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
                        <FormLabel>{t('paymentDialog.equivalentAmount')} ({watchedInvoiceCurrency})</FormLabel>
                        <FormControl>
                          <Input type="number" value={equivalentAmount.toFixed(2)} readOnly disabled />
                        </FormControl>
                      </FormItem>
                    )}
                  </div>
                )}

                <div className="rounded-md border p-4 bg-muted/50 space-y-3 mt-4">
                  <h4 className="font-semibold text-sm">{t('paymentDialog.summary')}</h4>
                  {watchedAmount > 0 && (
                    <div className="space-y-1 pt-2 border-t">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{t('paymentDialog.manualPayment')}:</span>
                        <div className="flex flex-col items-end">
                          <span>{new Intl.NumberFormat('en-US', { style: 'currency', currency: watchedPaymentCurrency || 'USD' }).format(watchedAmount)}</span>
                          {watchedPaymentCurrency !== invoice.currency && equivalentAmount && (
                            <span className="text-xs text-muted-foreground">
                              ≈ {new Intl.NumberFormat('en-US', { style: 'currency', currency: invoice.currency || 'USD' }).format(equivalentAmount)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-2 border-t font-semibold">
                    <span>{t('paymentDialog.totalPayment')}:</span>
                    <span>
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: invoice.currency || 'USD' }).format(showExchangeRate && equivalentAmount ? equivalentAmount : (watchedAmount || 0))}
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center bg-muted p-3 rounded-md">
                  <span className="font-semibold text-lg">{t('paymentDialog.remainingAmount')}</span>
                  <span className="font-bold text-lg">{new Intl.NumberFormat('en-US', { style: 'currency', currency: invoice.currency || 'USD' }).format(invoice.total - (invoice.paid_amount || 0))}</span>
                </div>

                <FormField
                  control={paymentForm.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('paymentDialog.notes')}</FormLabel>
                      <FormControl>
                        <Textarea placeholder={t('paymentDialog.notesPlaceholder')} {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={paymentForm.control}
                  name="is_historical"
                  render={({ field }) => (
                    <>
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>
                            {t('paymentDialog.isHistorical')}
                          </FormLabel>
                          <p className="text-xs text-muted-foreground">
                            {t('paymentDialog.isHistoricalDescription')}
                          </p>
                        </div>
                      </FormItem>
                      {field.value && (
                        <Alert variant="default" className="bg-amber-50 border-amber-200">
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                          <AlertTitle className="text-amber-800 text-sm">{t('paymentDialog.isHistoricalWarning')}</AlertTitle>
                          <AlertDescription className="text-amber-700 text-xs">
                            {t('paymentDialog.isHistoricalDescription')}
                          </AlertDescription>
                        </Alert>
                      )}
                    </>
                  )}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setIsPaymentDialogOpen(false)}>{t('paymentDialog.cancel')}</Button>
                <Button type="submit">{t('paymentDialog.add')}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* No Cash Session Alert Dialog */}
      <AlertDialog open={isNoSessionAlertOpen} onOpenChange={setIsNoSessionAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-start gap-3">
              <div className="header-icon-circle mt-0.5">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
              </div>
              <div className="flex flex-col text-left">
                <AlertDialogTitle>{t('noSessionDialog.title')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('noSessionDialog.description')}
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('paymentDialog.cancel')}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ResizableSheet>
  );
}
