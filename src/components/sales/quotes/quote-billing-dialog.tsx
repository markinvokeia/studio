'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import * as React from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import * as z from 'zod';
import { AlertTriangle, Loader2, Plus, Receipt, Trash2 } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { API_ROUTES } from '@/constants/routes';
import type { InvoiceItem, Order, Quote, QuoteItem, Service } from '@/lib/types';
import { toLocalISOString } from '@/lib/utils';
import { api } from '@/services/api';
import { calculateQuoteFinancialSummary, fetchQuoteInvoicesForFinancials } from '@/services/quote-financials';
import { useToast } from '@/hooks/use-toast';
import { FormattedNumberInput } from '@/components/ui/formatted-number-input';

type ServiceStepOption = {
  id: string;
  label: string;
};

type QuoteBillingLineOption = {
  quote_item_id: string;
  service_id: string;
  service_name: string;
  quote_item_total: number;
  billed_amount: number;
  pending_amount: number;
};

async function fetchQuoteItemsForBilling(quoteId: string, isSales: boolean): Promise<QuoteItem[]> {
  if (!quoteId) return [];

  try {
    const endpoint = isSales ? API_ROUTES.SALES.QUOTES_ITEMS : API_ROUTES.PURCHASES.QUOTES_ITEMS;
    const data = await api.get(endpoint, { quote_id: quoteId, is_sales: isSales ? 'true' : 'false' });
    const rawItems = Array.isArray(data) ? data : (data.items || data.data || data.result || []);
    return rawItems.map((item: any) => ({
      id: item.id ? String(item.id) : '',
      service_id: String(item.service_id || ''),
      service_name: item.service_name || '',
      unit_price: Number(item.unit_price || 0),
      quantity: Number(item.quantity || 1),
      total: Number(item.total || 0),
      tooth_number: item.tooth_number ? Number(item.tooth_number) : undefined,
    }));
  } catch {
    return [];
  }
}

async function fetchOrderForQuoteBilling(quoteId: string, isSales: boolean): Promise<Order | null> {
  if (!quoteId) return null;

  try {
    const endpoint = isSales ? API_ROUTES.SALES.QUOTES_ORDERS : API_ROUTES.PURCHASES.QUOTES_ORDERS;
    const data = await api.get(endpoint, { quote_id: quoteId, is_sales: isSales ? 'true' : 'false' });
    const rawOrders = Array.isArray(data) ? data : (data.orders || data.data || data.result || []);
    const firstOrder = rawOrders[0];
    if (!firstOrder?.id) return null;

    return {
      id: String(firstOrder.id),
      doc_no: firstOrder.doc_no || '',
      user_id: String(firstOrder.user_id || ''),
      quote_id: firstOrder.quote_id ? String(firstOrder.quote_id) : quoteId,
      quote_doc_no: firstOrder.quote_doc_no || '',
      user_name: firstOrder.user_name || firstOrder.name || '',
      status: firstOrder.status || 'draft',
      createdAt: firstOrder.created_at || firstOrder.createdAt || '',
      updatedAt: firstOrder.updated_at || firstOrder.updatedAt || '',
      currency: firstOrder.currency || 'UYU',
    };
  } catch {
    return null;
  }
}

const getSchema = (t: (key: string) => string) => z.object({
  notes: z.string().optional(),
  items: z.array(z.object({
    quote_item_id: z.string().min(1, t('validation.serviceRequired')),
    step_id: z.string().optional(),
    amount: z.coerce.number().positive(t('validation.amountPositive')),
  })).min(1, t('validation.atLeastOneItem')),
});

type QuoteBillingFormValues = z.infer<ReturnType<typeof getSchema>>;

interface QuoteBillingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quote: Quote | null;
  quoteItems: QuoteItem[];
  orderId?: string | null;
  isSales?: boolean;
  onSuccess?: () => void | Promise<void>;
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normalizeInvoiceItem(apiItem: any): InvoiceItem {
  return {
    id: apiItem.id ? String(apiItem.id) : '',
    service_id: String(apiItem.service_id || apiItem.product_id || ''),
    service_name: apiItem.service_name || apiItem.product_name || apiItem.name || '',
    quantity: Number(apiItem.quantity || apiItem.product_uom_qty || 1),
    unit_price: Number(apiItem.unit_price || apiItem.price_unit || 0),
    total: Number(apiItem.total || apiItem.price_total || 0),
    quote_item_id: apiItem.quote_item_id != null ? String(apiItem.quote_item_id) : undefined,
    step_id: apiItem.step_id != null ? String(apiItem.step_id) : undefined,
  };
}

async function fetchInvoiceItems(invoiceId: string, isSales: boolean): Promise<InvoiceItem[]> {
  if (!invoiceId) return [];

  try {
    const endpoint = isSales ? API_ROUTES.SALES.INVOICE_ITEMS : API_ROUTES.PURCHASES.INVOICE_ITEMS;
    const data = await api.get(endpoint, { invoice_id: invoiceId, is_sales: isSales ? 'true' : 'false' });
    const rawItems = Array.isArray(data) ? data : (data.invoice_items || data.data || data.result || []);
    return rawItems.map((item: any) => normalizeInvoiceItem(item));
  } catch {
    return [];
  }
}

async function fetchServiceSteps(serviceId: string): Promise<ServiceStepOption[]> {
  if (!serviceId) return [];

  try {
    const response = await api.get(API_ROUTES.SERVICES_STEPS, { service_id: serviceId });
    const rawSteps: any[] = Array.isArray(response)
      ? response
      : Array.isArray(response?.[0]?.items)
        ? response[0].items
        : Array.isArray(response?.items)
          ? response.items
          : [];

    return rawSteps
      .map((step: any) => ({
        id: String(step.position || ''),
        label: [step.position ? `${step.position}.` : null, step.step_name || step.name || 'Paso'].filter(Boolean).join(' '),
      }))
      .filter((step: ServiceStepOption) => step.id);
  } catch {
    return [];
  }
}

export function QuoteBillingDialog({
  open,
  onOpenChange,
  quote,
  quoteItems,
  orderId,
  isSales = true,
  onSuccess,
}: QuoteBillingDialogProps) {
  const t = useTranslations('QuoteBillingDialog');
  const tQuotes = useTranslations('QuotesPage');
  const { toast } = useToast();

  const schema = React.useMemo(() => getSchema(t), [t]);
  const form = useForm<QuoteBillingFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      notes: '',
      items: [],
    },
  });
  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  const [lineOptions, setLineOptions] = React.useState<QuoteBillingLineOption[]>([]);
  const [stepOptions, setStepOptions] = React.useState<Record<string, ServiceStepOption[]>>({});
  const [isLoadingContext, setIsLoadingContext] = React.useState(false);
  const [submissionError, setSubmissionError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [resolvedOrderId, setResolvedOrderId] = React.useState<string | null>(orderId ?? null);

  const watchedItems = useWatch({ control: form.control, name: 'items' });
  const selectedItems = React.useMemo(() => watchedItems ?? [], [watchedItems]);
  const invoiceTotal = React.useMemo(
    () => roundCurrency(selectedItems.reduce((sum, item) => sum + Number(item?.amount || 0), 0)),
    [selectedItems],
  );

  const pendingQuoteAmount = quote?.amount_pending_invoice ?? 0;

  React.useEffect(() => {
    setResolvedOrderId(orderId ?? null);
  }, [orderId]);

  React.useEffect(() => {
    if (!open || !quote) return;

    let isCurrent = true;
    setIsLoadingContext(true);
    setSubmissionError(null);

    const loadDialogContext = async () => {
      const resolvedOrder = orderId ? null : await fetchOrderForQuoteBilling(quote.id, isSales);
      const sourceQuoteItems = quoteItems.length > 0
        ? quoteItems
        : await fetchQuoteItemsForBilling(quote.id, isSales);
      const invoices = await fetchQuoteInvoicesForFinancials(quote.id, isSales);
      const invoiceItemsGroups = await Promise.all(
        invoices.map((invoice) => fetchInvoiceItems(invoice.id, isSales)),
      );
      if (!isCurrent) return;
      setResolvedOrderId(orderId ?? resolvedOrder?.id ?? null);

      const billedAmountByQuoteItem = new Map<string, number>();
      const billedAmountByService = new Map<string, number>();

      invoiceItemsGroups.flat().forEach((item) => {
        const itemTotal = Number(item.total || 0);
        if (item.quote_item_id != null) {
          const key = String(item.quote_item_id);
          billedAmountByQuoteItem.set(key, roundCurrency((billedAmountByQuoteItem.get(key) || 0) + itemTotal));
        } else if (item.service_id) {
          const key = String(item.service_id);
          billedAmountByService.set(key, roundCurrency((billedAmountByService.get(key) || 0) + itemTotal));
        }
      });

      const options = sourceQuoteItems.map((item) => {
        const billedByItem = billedAmountByQuoteItem.get(String(item.id));
        const billedFallback = billedByItem == null ? billedAmountByService.get(String(item.service_id)) || 0 : billedByItem;
        const pendingAmount = roundCurrency(Math.max(Number(item.total || 0) - billedFallback, 0));

        return {
          quote_item_id: String(item.id),
          service_id: String(item.service_id),
          service_name: item.service_name,
          quote_item_total: Number(item.total || 0),
          billed_amount: roundCurrency(billedFallback),
          pending_amount: pendingAmount,
        };
      });

      const summary = calculateQuoteFinancialSummary(Number(quote.total || 0), invoices);
      const defaultItems = options
        .filter((item) => item.pending_amount > 0)
        .slice(0, 1)
        .map((item) => ({
          quote_item_id: item.quote_item_id,
          step_id: '',
          amount: item.pending_amount,
        }));

      setLineOptions(options);
      replace(defaultItems);
      form.reset({
        notes: '',
        items: defaultItems,
      });

      if (!quote.amount_pending_invoice || Math.abs(quote.amount_pending_invoice - summary.amount_pending_invoice) > 0.009) {
        // The list view may still be stale; local dialog uses fresh data for validation.
      }

      setIsLoadingContext(false);
    };

    loadDialogContext().catch(() => {
      if (!isCurrent) return;
      setLineOptions([]);
      replace([]);
      setIsLoadingContext(false);
    });

    return () => {
      isCurrent = false;
    };
  }, [open, orderId, quote, quoteItems, isSales, form, replace]);

  React.useEffect(() => {
    selectedItems.forEach((item, index) => {
      const selectedLine = lineOptions.find((option) => option.quote_item_id === item.quote_item_id);
      const selectedServiceId = selectedLine?.service_id;
      if (!selectedServiceId) return;

      if (stepOptions[selectedServiceId] !== undefined) return;

      fetchServiceSteps(selectedServiceId).then((steps) => {
        setStepOptions((previous) => ({
          ...previous,
          [selectedServiceId]: steps,
        }));

        if (steps.length === 0 && form.getValues(`items.${index}.step_id`)) {
          form.setValue(`items.${index}.step_id`, '');
        }
      });
    });
  }, [selectedItems, lineOptions, stepOptions, form]);

  const getLineOption = React.useCallback((quoteItemId: string) => {
    return lineOptions.find((option) => option.quote_item_id === quoteItemId);
  }, [lineOptions]);

  const validateDraft = (values: QuoteBillingFormValues): string | null => {
    if (!quote) return t('errors.missingQuote');

    if (invoiceTotal > pendingQuoteAmount + 0.009) {
      return t('validation.totalExceeded');
    }

    const draftAmountByItem = new Map<string, number>();
    values.items.forEach((item) => {
      const key = String(item.quote_item_id);
      draftAmountByItem.set(key, roundCurrency((draftAmountByItem.get(key) || 0) + Number(item.amount || 0)));
    });

    for (const [quoteItemId, draftAmount] of draftAmountByItem.entries()) {
      const option = getLineOption(quoteItemId);
      if (!option) {
        return t('validation.serviceRequired');
      }
      if (draftAmount > option.pending_amount + 0.009) {
        return t('validation.itemExceeded', { service: option.service_name });
      }
    }

    return null;
  };

  const handleAddItem = () => {
    const nextOption = lineOptions.find((option) => option.pending_amount > 0);
    append({
      quote_item_id: nextOption?.quote_item_id || '',
      step_id: '',
      amount: nextOption?.pending_amount || 0,
    });
  };

  const handleSubmit = async (values: QuoteBillingFormValues) => {
    if (!quote) return;

    setSubmissionError(null);
    if (!resolvedOrderId) {
      setSubmissionError(t('errors.missingOrder'));
      return;
    }
    const validationError = validateDraft(values);
    if (validationError) {
      setSubmissionError(validationError);
      return;
    }

    setIsSubmitting(true);
    try {
      const billingQuery = {
        quote_id: Number(quote.id),
        user_id: quote.user_id,
        currency: quote.currency || 'UYU',
        invoice_date: toLocalISOString(new Date()),
        notes: values.notes || '',
        items: values.items.map((item) => {
          const selectedLine = getLineOption(item.quote_item_id);
          return {
            quote_item_id: Number(item.quote_item_id),
            service_id: Number(selectedLine?.service_id || 0),
            step_id: item.step_id ? Number(item.step_id) : null,
            amount: Number(item.amount || 0),
          };
        }),
      };

      const payload = {
        order_id: resolvedOrderId,
        is_sales: isSales,
        query: JSON.stringify(billingQuery),
      };

      const endpoint = isSales ? API_ROUTES.SALES.ORDER_INVOICE : API_ROUTES.PURCHASES.ORDER_INVOICE;
      const response = await api.post(endpoint, payload);
      if (response?.error && response?.code >= 400) {
        throw new Error(response.message || t('errors.generic'));
      }
      if (Array.isArray(response) && response[0]?.code >= 400) {
        throw new Error(response[0]?.message || t('errors.generic'));
      }

      toast({
        title: t('success.title'),
        description: t('success.description', { quote: quote.doc_no || quote.id }),
      });

      onOpenChange(false);
      await onSuccess?.();
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : t('errors.generic'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent maxWidth="4xl">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col flex-1 overflow-hidden">
            <DialogHeader>
              <div className="flex items-start gap-3">
                <div className="header-icon-circle mt-0.5">
                  <Receipt className="h-5 w-5" />
                </div>
                <div className="flex flex-col text-left">
                  <DialogTitle>{t('title')}</DialogTitle>
                  <p className="text-sm text-muted-foreground">
                    {t('description', { quote: quote?.doc_no || quote?.id || '—' })}
                  </p>
                </div>
              </div>
            </DialogHeader>
            <DialogBody className="space-y-4 py-4 px-6">
              {submissionError && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>{t('errors.title')}</AlertTitle>
                  <AlertDescription>{submissionError}</AlertDescription>
                </Alert>
              )}

              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">{t('summary.quoteTotal')}</p>
                  <p className="text-base font-semibold">
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: quote?.currency || 'USD' }).format(Number(quote?.total || 0))}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">{t('summary.invoiced')}</p>
                  <p className="text-base font-semibold">
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: quote?.currency || 'USD' }).format(Number(quote?.amount_invoiced || 0))}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">{t('summary.pendingInvoice')}</p>
                  <p className="text-base font-semibold">
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: quote?.currency || 'USD' }).format(pendingQuoteAmount)}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">{t('summary.invoiceTotal')}</p>
                  <p className="text-base font-semibold">
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: quote?.currency || 'USD' }).format(invoiceTotal)}
                  </p>
                </div>
              </div>

              {isLoadingContext ? (
                <div className="flex min-h-[220px] items-center justify-center rounded-lg border border-dashed">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">{t('loading')}</span>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">{t('items.title')}</p>
                      <p className="text-xs text-muted-foreground">{t('items.description')}</p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={handleAddItem} disabled={lineOptions.every((item) => item.pending_amount <= 0)}>
                      <Plus className="mr-2 h-4 w-4" />
                      {t('items.add')}
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {fields.map((field, index) => {
                      const selectedLine = getLineOption(selectedItems[index]?.quote_item_id || '');
                      const serviceSteps = selectedLine ? (stepOptions[selectedLine.service_id] || []) : [];
                      return (
                        <div key={field.id} className="grid gap-3 rounded-lg border p-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_160px_auto]">
                          <FormField
                            control={form.control}
                            name={`items.${index}.quote_item_id`}
                            render={({ field: lineField }) => (
                              <FormItem>
                                <FormLabel>{t('items.service')}</FormLabel>
                                <Select
                                  onValueChange={(value) => {
                                    lineField.onChange(value);
                                    form.setValue(`items.${index}.step_id`, '');
                                    const option = getLineOption(value);
                                    if (option && Number(form.getValues(`items.${index}.amount`) || 0) <= 0) {
                                      form.setValue(`items.${index}.amount`, option.pending_amount);
                                    }
                                  }}
                                  value={lineField.value}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder={t('items.selectService')} />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {lineOptions.map((option) => (
                                      <SelectItem key={option.quote_item_id} value={option.quote_item_id}>
                                        {option.service_name} · {new Intl.NumberFormat('en-US', { style: 'currency', currency: quote?.currency || 'USD' }).format(option.pending_amount)}
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
                            name={`items.${index}.step_id`}
                            render={({ field: stepField }) => (
                              <FormItem>
                                <FormLabel>{t('items.step')}</FormLabel>
                                <Select onValueChange={stepField.onChange} value={stepField.value || ''} disabled={!selectedLine || serviceSteps.length === 0}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder={serviceSteps.length > 0 ? t('items.selectStep') : t('items.noSteps')} />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {serviceSteps.map((step) => (
                                      <SelectItem key={step.id} value={step.id}>
                                        {step.label}
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
                            name={`items.${index}.amount`}
                            render={({ field: amountField }) => (
                              <FormItem>
                                <FormLabel>{t('items.amount')}</FormLabel>
                                <FormControl>
                                  <FormattedNumberInput
                                    value={amountField.value}
                                    onChange={amountField.onChange}
                                  />
                                </FormControl>
                                {selectedLine && (
                                  <p className="text-xs text-muted-foreground">
                                    {t('items.maxAvailable', {
                                      amount: new Intl.NumberFormat('en-US', {
                                        style: 'currency',
                                        currency: quote?.currency || 'USD',
                                      }).format(selectedLine.pending_amount),
                                    })}
                                  </p>
                                )}
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <div className="flex items-end">
                            <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length === 1}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{tQuotes('quoteDialog.notes')}</FormLabel>
                        <FormControl>
                          <Textarea {...field} placeholder={tQuotes('quoteDialog.notesPlaceholder')} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting || isLoadingContext || pendingQuoteAmount <= 0}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('save')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
