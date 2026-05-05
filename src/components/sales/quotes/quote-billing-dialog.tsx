'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import * as React from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import * as z from 'zod';
import { AlertTriangle, ChevronsUpDown, Loader2, Plus, Receipt, Trash2, X } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
  name: string;
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
    step_ids: z.array(z.string()).default([]),
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
    steps: apiItem.steps != null ? String(apiItem.steps) : undefined,
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
        name: step.step_name || step.name || 'Paso',
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
  const [stepPopoverOpenIndex, setStepPopoverOpenIndex] = React.useState<number | null>(null);

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
      const fetchedQuoteItems = await fetchQuoteItemsForBilling(quote.id, isSales);
      const sourceQuoteItems = fetchedQuoteItems.length > 0
        ? fetchedQuoteItems
        : quoteItems;
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
        .map((item) => ({
          quote_item_id: item.quote_item_id,
          step_ids: [],
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

        if (steps.length === 0 && form.getValues(`items.${index}.step_ids`).length > 0) {
          form.setValue(`items.${index}.step_ids`, []);
        }
      });
    });
  }, [selectedItems, lineOptions, stepOptions, form]);

  const getLineOption = React.useCallback((quoteItemId: string) => {
    return lineOptions.find((option) => option.quote_item_id === quoteItemId);
  }, [lineOptions]);

  const getSelectedStepLabels = React.useCallback((serviceId: string | undefined, stepIds: string[] | undefined) => {
    if (!serviceId || !stepIds?.length) return [];

    const serviceSteps = stepOptions[serviceId] || [];
    return stepIds
      .map((stepId) => serviceSteps.find((step) => step.id === stepId))
      .filter((step): step is ServiceStepOption => Boolean(step));
  }, [stepOptions]);

  const selectedQuoteItemIds = React.useMemo(
    () => new Set(selectedItems.map((item) => String(item?.quote_item_id || '')).filter(Boolean)),
    [selectedItems],
  );

  const getSelectableLineOptions = React.useCallback((currentQuoteItemId?: string) => {
    return lineOptions.filter((option) => (
      option.pending_amount > 0 && (
        option.quote_item_id === currentQuoteItemId ||
        !selectedQuoteItemIds.has(option.quote_item_id)
      )
    ));
  }, [lineOptions, selectedQuoteItemIds]);

  const canAddMoreLines = React.useMemo(
    () => getSelectableLineOptions().length > 0,
    [getSelectableLineOptions],
  );

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
    const nextOption = getSelectableLineOptions()[0];
    if (!nextOption) return;

    append({
      quote_item_id: nextOption.quote_item_id,
      step_ids: [],
      amount: nextOption.pending_amount,
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
          const serviceSteps = selectedLine ? (stepOptions[selectedLine.service_id] || []) : [];
          const stepNames = item.step_ids
            .map((stepId) => serviceSteps.find((step) => step.id === stepId)?.name)
            .filter((name): name is string => Boolean(name));

          return {
            quote_item_id: Number(item.quote_item_id),
            service_id: Number(selectedLine?.service_id || 0),
            step_names: stepNames,
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

              <div className="grid gap-3 md:grid-cols-3">
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
              </div>

              {isLoadingContext ? (
                <div className="flex min-h-[220px] items-center justify-center rounded-lg border border-dashed">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">{t('loading')}</span>
                </div>
              ) : (
                <div className="space-y-3">
                  <Card>
                    <CardContent className="space-y-3 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">{t('items.title')}</p>
                          <p className="text-xs text-muted-foreground">{t('items.description')}</p>
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={handleAddItem} disabled={!canAddMoreLines}>
                          <Plus className="mr-2 h-4 w-4" />
                          {t('items.add')}
                        </Button>
                      </div>

                      <div className="space-y-3">
                        {fields.map((field, index) => {
                          const selectedLine = getLineOption(selectedItems[index]?.quote_item_id || '');
                          const selectableOptions = getSelectableLineOptions(selectedLine?.quote_item_id);
                          const serviceSteps = selectedLine ? (stepOptions[selectedLine.service_id] || []) : [];
                          return (
                            <div key={field.id}>
                              <div className="space-y-2">
                                <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_160px_auto] md:items-start">
                                <FormField
                                  control={form.control}
                                  name={`items.${index}.quote_item_id`}
                                  render={({ field: lineField }) => (
                                    <FormItem className="space-y-2">
                                      <FormLabel className="text-xs">{t('items.service')}</FormLabel>
                                      <Select
                                        onValueChange={(value) => {
                                          lineField.onChange(value);
                                          form.setValue(`items.${index}.step_ids`, []);
                                          const option = getLineOption(value);
                                          if (option) {
                                            form.setValue(`items.${index}.amount`, option.pending_amount);
                                          }
                                        }}
                                        value={lineField.value}
                                      >
                                        <FormControl>
                                          <SelectTrigger className="h-10">
                                            <SelectValue placeholder={t('items.selectService')} />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          {lineOptions.map((option) => (
                                            <SelectItem
                                              key={option.quote_item_id}
                                              value={option.quote_item_id}
                                              disabled={!selectableOptions.some((selectableOption) => selectableOption.quote_item_id === option.quote_item_id)}
                                            >
                                              <div className="flex w-full items-center justify-between gap-2">
                                                <span>
                                                  {option.service_name} · {new Intl.NumberFormat('en-US', { style: 'currency', currency: quote?.currency || 'USD' }).format(option.pending_amount)}
                                                </span>
                                                {option.pending_amount <= 0 ? (
                                                  <Badge variant="outline" className="text-[10px] uppercase tracking-[0.16em]">
                                                    {t('items.fullyInvoiced')}
                                                  </Badge>
                                                ) : null}
                                              </div>
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
                                  name={`items.${index}.step_ids`}
                                  render={({ field: stepField }) => (
                                    <FormItem className="space-y-2">
                                      <FormLabel className="text-xs">{t('items.step')}</FormLabel>
                                      <FormControl>
                                        <div className="space-y-2">
                                          {!selectedLine || serviceSteps.length === 0 ? (
                                            <Button variant="outline" className="h-10 w-full justify-start" disabled>
                                              {t('items.noSteps')}
                                              <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                          ) : (
                                            <>
                                              <Popover open={stepPopoverOpenIndex === index} onOpenChange={(openState) => setStepPopoverOpenIndex(openState ? index : null)}>
                                                <PopoverTrigger asChild>
                                                  <Button variant="outline" className="h-10 w-full justify-start">
                                                    {stepField.value?.length
                                                      ? t('items.stepsSelected', { count: stepField.value.length })
                                                      : t('items.selectStep')}
                                                    <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
                                                  </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                                                  <Command>
                                                    <CommandInput placeholder={t('items.searchStepPlaceholder')} />
                                                    <CommandList>
                                                      <CommandEmpty>{t('items.noSteps')}</CommandEmpty>
                                                      <CommandGroup>
                                                        {serviceSteps.map((step) => {
                                                          const isChecked = stepField.value?.includes(step.id) ?? false;

                                                          return (
                                                            <CommandItem
                                                              key={step.id}
                                                              value={step.label}
                                                              onSelect={() => {
                                                                const currentValue = stepField.value || [];
                                                                stepField.onChange(
                                                                  isChecked
                                                                    ? currentValue.filter((value) => value !== step.id)
                                                                    : [...currentValue, step.id],
                                                                );
                                                              }}
                                                            >
                                                              <Checkbox checked={isChecked} className="mr-2" />
                                                              <span>{step.label}</span>
                                                            </CommandItem>
                                                          );
                                                        })}
                                                      </CommandGroup>
                                                    </CommandList>
                                                  </Command>
                                                </PopoverContent>
                                              </Popover>

                                              {stepField.value?.length ? (
                                                <div className="rounded-md border p-2">
                                                  <p className="text-xs text-muted-foreground">{t('items.selectedSteps')}</p>
                                                  <div className="mt-1 flex flex-wrap gap-1">
                                                    {getSelectedStepLabels(selectedLine.service_id, stepField.value).map((step) => (
                                                      <Badge key={step.id} variant="secondary">
                                                        {step.label}
                                                        <Button
                                                          type="button"
                                                          variant="ghost"
                                                          size="icon"
                                                          className="ml-1 h-4 w-4 hover:bg-transparent"
                                                          onClick={() => {
                                                            stepField.onChange((stepField.value || []).filter((value) => value !== step.id));
                                                          }}
                                                        >
                                                          <X className="h-3 w-3" />
                                                        </Button>
                                                      </Badge>
                                                    ))}
                                                  </div>
                                                </div>
                                              ) : null}
                                            </>
                                          )}
                                        </div>
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />

                                <FormField
                                  control={form.control}
                                  name={`items.${index}.amount`}
                                  render={({ field: amountField }) => (
                                    <FormItem className="space-y-2">
                                      <FormLabel className="text-xs">{t('items.amount')}</FormLabel>
                                      <FormControl>
                                        <FormattedNumberInput
                                          value={amountField.value}
                                          onChange={amountField.onChange}
                                          disabled={!selectedLine || selectedLine.pending_amount <= 0}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />

                                <div className="flex items-start pt-6">
                                  <Button
                                    type="button"
                                    variant="destructive"
                                    size="icon"
                                    className="bg-red-600 text-white hover:bg-red-700"
                                    onClick={() => remove(index)}
                                    disabled={fields.length === 1}
                                  >
                                    <Trash2 className="h-4 w-4 text-white" />
                                  </Button>
                                </div>
                              </div>

                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pl-0 text-xs text-muted-foreground md:pl-0">
                                  <span>
                                    {t('items.pending')}: <span className="font-medium text-foreground">
                                      {new Intl.NumberFormat('en-US', {
                                        style: 'currency',
                                        currency: quote?.currency || 'USD',
                                      }).format(selectedLine?.pending_amount || 0)}
                                    </span>
                                  </span>
                                  <span>
                                    {t('items.invoiced')}: <span className="font-medium text-foreground">
                                      {new Intl.NumberFormat('en-US', {
                                        style: 'currency',
                                        currency: quote?.currency || 'USD',
                                      }).format(selectedLine?.billed_amount || 0)}
                                    </span>
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex justify-end border-t border-dashed border-border/80 pt-4">
                        <div className="flex min-w-[260px] items-end justify-between gap-6 text-right">
                          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground/80">
                            <Receipt className="h-3.5 w-3.5" />
                            <span>{t('summary.invoiceTotal')}</span>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground/70">total</p>
                            <p className="text-2xl font-semibold leading-none text-foreground">
                              {new Intl.NumberFormat('en-US', { style: 'currency', currency: quote?.currency || 'USD' }).format(invoiceTotal)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

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
