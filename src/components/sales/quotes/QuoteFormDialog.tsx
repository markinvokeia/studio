'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogBody,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { ServiceSelector } from '@/components/ui/service-selector';
import { Textarea } from '@/components/ui/textarea';
import { API_ROUTES } from '@/constants/routes';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Clinic, User } from '@/lib/types';
import { api } from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import * as z from 'zod';

const quoteFormSchema = (t: (key: string) => string) => z.object({
    id: z.string().optional(),
    user_id: z.string().min(1, t('validation.userRequired')),
    total: z.coerce.number().min(0, t('validation.totalPositive')),
    currency: z.enum(['UYU', 'USD', 'URU']).default('USD'),
    status: z.enum(['draft', 'sent', 'accepted', 'rejected', 'pending', 'confirmed',
        'Draft', 'Sent', 'Accepted', 'Rejected', 'Pending', 'Confirmed']),
    payment_status: z.enum(['unpaid', 'paid', 'partial', 'partially_paid',
        'not_paid', 'not invoiced', 'not_invoiced']),
    billing_status: z.enum(['not invoiced', 'partially invoiced', 'invoiced',
        'not_invoiced', 'partially_invoiced', 'Pending']),
    exchange_rate: z.coerce.number().min(0.0001, t('validation.exchangeRatePositive')).optional(),
    notes: z.string().optional(),
    items: z.array(z.object({
        id: z.string().optional(),
        service_id: z.string().min(1, t('validation.serviceRequired')),
        quantity: z.coerce.number().int().min(1, t('validation.quantityMinOne')),
        unit_price: z.coerce.number().min(0, t('validation.unitPricePositive')).multipleOf(0.01, t('validation.unitPriceTwoDecimals')),
        total: z.coerce.number().min(0, t('validation.totalPositive')),
        tooth_number: z.coerce.number().int().min(11, t('validation.toothNumberMin')).max(85, t('validation.toothNumberMax')).optional().or(z.literal('')),
    })).default([]),
});

type QuoteFormValues = z.infer<ReturnType<typeof quoteFormSchema>>;

async function upsertQuote(quoteData: QuoteFormValues, isSales: boolean, t: (key: string) => string) {
    const responseData = await api.post(API_ROUTES.SALES.QUOTES_UPSERT, { ...quoteData, is_sales: isSales });
    if (Array.isArray(responseData) && responseData[0]?.code >= 400) {
        const message = responseData[0]?.message ? responseData[0].message : t('errors.failedToSaveQuote');
        throw new Error(message);
    }
    return responseData;
}

async function getClinic(): Promise<Clinic | null> {
    try {
        const data = await api.get(API_ROUTES.CLINIC);
        const clinicsData = Array.isArray(data) ? data : (data.clinics || data.data || data.result || []);
        if (clinicsData.length === 0) return null;
        const apiClinic = clinicsData[0];
        return {
            id: apiClinic.id ? String(apiClinic.id) : '',
            name: apiClinic.name || '',
            location: apiClinic.address || '',
            contact_email: apiClinic.email || '',
            phone_number: apiClinic.phone || '',
            currency: apiClinic.currency || 'UYU',
        };
    } catch {
        return null;
    }
}

export interface QuoteFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialData?: { user?: User };
    onSaveSuccess?: () => void;
    isSales?: boolean;
}

export function QuoteFormDialog({ open, onOpenChange, initialData, onSaveSuccess, isSales = true }: QuoteFormDialogProps) {
    const t = useTranslations('QuotesPage');
    const { toast } = useToast();
    const { activeCashSession } = useAuth();

    const [clinic, setClinic] = React.useState<Clinic | null>(null);
    const [submissionError, setSubmissionError] = React.useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const form = useForm<QuoteFormValues>({
        resolver: zodResolver(quoteFormSchema(t)),
        mode: 'onBlur',
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: 'items',
    });

    const getSessionExchangeRate = React.useCallback(() => {
        if (!activeCashSession?.data?.opening_details?.date_rate) return 1;
        return activeCashSession.data.opening_details.date_rate;
    }, [activeCashSession]);

    // Load clinic once
    React.useEffect(() => {
        getClinic().then(setClinic);
    }, []);

    // Reset form when dialog opens
    React.useEffect(() => {
        if (!open) return;
        const defaultCurrency = clinic?.currency || 'UYU';
        const sessionRate = getSessionExchangeRate();
        form.reset(
            {
                user_id: initialData?.user?.id || '',
                total: 0,
                currency: defaultCurrency as any,
                status: 'draft',
                payment_status: 'unpaid',
                billing_status: 'not invoiced',
                exchange_rate: 1,
                notes: '',
                items: [],
            },
            {
                keepErrors: false, keepDirty: false, keepIsSubmitted: false,
                keepTouched: false, keepIsValid: false, keepSubmitCount: false,
            }
        );
        // Set exchange rate based on currency vs clinic currency
        if (defaultCurrency !== (clinic?.currency || 'UYU')) {
            form.setValue('exchange_rate', sessionRate);
        }
        setSubmissionError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const watchedCurrency = form.watch('currency');
    const watchedExchangeRate = form.watch('exchange_rate');
    const isClinicCurrency = watchedCurrency === (clinic?.currency || 'UYU');

    React.useEffect(() => {
        if (isClinicCurrency) {
            if (watchedExchangeRate !== 1) form.setValue('exchange_rate', 1);
        } else {
            const sessionRate = getSessionExchangeRate();
            if (watchedExchangeRate === 1 || !watchedExchangeRate) {
                form.setValue('exchange_rate', sessionRate);
            }
        }
    }, [isClinicCurrency, watchedExchangeRate, form, getSessionExchangeRate]);

    // Recalculate total when items change
    const watchedItems = form.watch('items');
    React.useEffect(() => {
        const items = watchedItems || [];
        const newTotal = items.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
        const currentTotal = form.getValues('total') || 0;
        if (Math.abs(newTotal - currentTotal) > 0.001) {
            form.setValue('total', newTotal, { shouldDirty: true });
        }
    }, [watchedItems, form]);

    const handleAddItem = () => {
        append({ service_id: '', quantity: 1, unit_price: 0, total: 0, tooth_number: '' });
    };

    const onSubmit = async (values: QuoteFormValues) => {
        if (isSubmitting) return;
        setIsSubmitting(true);
        setSubmissionError(null);
        try {
            if (!values.items || values.items.length === 0) {
                throw new Error(t('quoteDialog.atLeastOneItem'));
            }
            const itemsToSubmit = values.items.map(item => ({
                id: item.id,
                service_id: item.service_id,
                quantity: item.quantity,
                unit_price: item.unit_price,
                total: item.total,
                tooth_number: item.tooth_number ? Number(item.tooth_number) : null,
            }));
            const normalizeBilling = (s: string) =>
                s === 'not_invoiced' ? 'not invoiced' : s === 'partially_invoiced' ? 'partially invoiced' : s;

            const payload = { ...values, billing_status: normalizeBilling(values.billing_status), items: itemsToSubmit };
            await upsertQuote(payload as any, isSales, t);
            toast({ title: t('toast.quoteCreated'), description: t('toast.quoteSaveSuccess') });
            onOpenChange(false);
            onSaveSuccess?.();
        } catch (error) {
            setSubmissionError(error instanceof Error ? error.message : t('toast.quoteError'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const prefilledUser = initialData?.user;

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!isSubmitting) onOpenChange(o); }}>
            <DialogContent showMaximize={true} maxWidth="6xl">
                <DialogHeader>
                    <DialogTitle>{t('quoteDialog.createTitle')}</DialogTitle>
                    <DialogDescription>{t('quoteDialog.description')}</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
                        <DialogBody className="space-y-4 py-4 px-6">
                            {submissionError && (
                                <Alert variant="destructive">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertTitle>{t('errors.errorTitle')}</AlertTitle>
                                    <AlertDescription>{submissionError}</AlertDescription>
                                </Alert>
                            )}

                            {/* User field — locked if pre-filled from context */}
                            {prefilledUser ? (
                                <FormField
                                    control={form.control}
                                    name="user_id"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('quoteDialog.user')}</FormLabel>
                                            <FormControl>
                                                <Input value={prefilledUser.name} readOnly disabled className="bg-muted cursor-not-allowed" />
                                            </FormControl>
                                            <input type="hidden" {...field} value={prefilledUser.id} />
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            ) : (
                                <FormField
                                    control={form.control}
                                    name="user_id"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('quoteDialog.user')}</FormLabel>
                                            <FormControl>
                                                <Input placeholder={t('quoteDialog.selectUser')} {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <FormField
                                    control={form.control}
                                    name="total"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('quoteDialog.total')}</FormLabel>
                                            <FormControl>
                                                <Input type="number" readOnly className="bg-muted cursor-not-allowed" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="currency"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('quoteDialog.currency')}</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger><SelectValue placeholder={t('quoteDialog.selectCurrency')} /></SelectTrigger>
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
                                <FormField
                                    control={form.control}
                                    name="exchange_rate"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('quoteDialog.exchangeRate')}</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    placeholder={t('placeholders.exchangeRate')}
                                                    value={field.value ? Number(field.value).toFixed(2) : ''}
                                                    disabled={isClinicCurrency}
                                                    onChange={(e) => {
                                                        if (isClinicCurrency) {
                                                            field.onChange(1);
                                                        } else {
                                                            field.onChange(parseFloat(e.target.value) || 0);
                                                        }
                                                    }}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <FormField
                                control={form.control}
                                name="notes"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('quoteDialog.notes')}</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder={t('quoteDialog.notesPlaceholder')}
                                                {...field}
                                                value={field.value || ''}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <Card>
                                <CardHeader>
                                    <div className="flex justify-between items-center">
                                        <CardTitle>{t('quoteDialog.items.title')}</CardTitle>
                                        <Button type="button" size="sm" variant="outline" onClick={handleAddItem}>
                                            {t('quoteDialog.addItem')}
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="bg-card">
                                    <div className="space-y-4">
                                        {/* Mobile: stacked card per item */}
                                        <div className="md:hidden space-y-3">
                                            {fields.map((fieldItem, index) => (
                                                <div key={fieldItem.id} className="rounded-lg border bg-muted/30 p-3 space-y-3">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="text-xs font-medium text-muted-foreground">{t('quoteDialog.items.title')} #{index + 1}</span>
                                                        <Button type="button" variant="destructive" size="icon" className="h-7 w-7 shrink-0" onClick={() => remove(index)}>
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                    <FormField control={form.control} name={`items.${index}.service_id`} render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel className="text-xs">{t('quoteDialog.items.service')}</FormLabel>
                                                            <ServiceSelector
                                                                isSales={isSales}
                                                                value={field.value}
                                                                onValueChange={(serviceId, service) => {
                                                                    field.onChange(serviceId);
                                                                    if (service) {
                                                                        const quantity = form.getValues(`items.${index}.quantity`) || 1;
                                                                        const servicePrice = Number(service.price);
                                                                        form.setValue(`items.${index}.unit_price`, servicePrice, { shouldDirty: true, shouldValidate: true });
                                                                        form.setValue(`items.${index}.total`, servicePrice * quantity, { shouldDirty: true, shouldValidate: true });
                                                                    }
                                                                }}
                                                                placeholder={t('itemDialog.searchService')}
                                                                noResultsText={t('itemDialog.noServiceFound')}
                                                                triggerText={t('quoteDialog.items.selectService')}
                                                            />
                                                            <FormMessage />
                                                        </FormItem>
                                                    )} />
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <FormField control={form.control} name={`items.${index}.quantity`} render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel className="text-xs">{t('quoteDialog.items.quantity')}</FormLabel>
                                                                <FormControl>
                                                                    <Input type="number" step="1" min="1" {...field}
                                                                        onChange={(e) => {
                                                                            const rounded = e.target.value === '' ? '' : Math.round(Number(e.target.value));
                                                                            field.onChange(e);
                                                                            const price = form.getValues(`items.${index}.unit_price`) || 0;
                                                                            const newQty = rounded === '' ? 0 : rounded;
                                                                            form.setValue(`items.${index}.quantity`, newQty, { shouldValidate: true });
                                                                            form.setValue(`items.${index}.total`, price * newQty, { shouldDirty: true });
                                                                        }}
                                                                    />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )} />
                                                        <FormField control={form.control} name={`items.${index}.unit_price`} render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel className="text-xs">{t('quoteDialog.items.unitPrice')}</FormLabel>
                                                                <FormControl>
                                                                    <Input type="number" step="0.01" min="0" {...field}
                                                                        onChange={(e) => {
                                                                            field.onChange(e);
                                                                            const quantity = form.getValues(`items.${index}.quantity`) || 1;
                                                                            const newPrice = Number(e.target.value);
                                                                            form.setValue(`items.${index}.total`, Math.round(newPrice * quantity * 100) / 100, { shouldDirty: true });
                                                                        }}
                                                                    />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )} />
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <FormField control={form.control} name={`items.${index}.total`} render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel className="text-xs">{t('quoteDialog.items.total')}</FormLabel>
                                                                <FormControl>
                                                                    <Input type="number" {...field} readOnly disabled />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )} />
                                                        <FormField control={form.control} name={`items.${index}.tooth_number`} render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel className="text-xs">{t('quoteDialog.items.toothNumber')}</FormLabel>
                                                                <FormControl>
                                                                    <Input type="number" placeholder="-" {...field}
                                                                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : '')}
                                                                    />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )} />
                                                    </div>
                                                </div>
                                            ))}
                                            {fields.length === 0 && (
                                                <p className="text-center text-sm text-muted-foreground py-4">{t('quoteDialog.items.empty')}</p>
                                            )}
                                        </div>
                                        {/* Desktop: table */}
                                        <table className="hidden md:table w-full table-fixed text-sm">
                                            <thead>
                                                <tr className="text-muted-foreground text-center">
                                                    <th className="text-left font-semibold p-2">{t('quoteDialog.items.service')}</th>
                                                    <th className="font-semibold p-2 w-24">{t('quoteDialog.items.quantity')}</th>
                                                    <th className="font-semibold p-2 w-28">{t('quoteDialog.items.unitPrice')}</th>
                                                    <th className="font-semibold p-2 w-28">{t('quoteDialog.items.total')}</th>
                                                    <th className="font-semibold p-2 w-24">{t('quoteDialog.items.toothNumber')}</th>
                                                    <th className="p-2 w-10"></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {fields.map((fieldItem, index) => (
                                                    <tr key={fieldItem.id} className="align-top">
                                                        <td className="p-1 max-w-0">
                                                            <FormField control={form.control} name={`items.${index}.service_id`} render={({ field }) => (
                                                                <FormItem>
                                                                    <ServiceSelector
                                                                        isSales={isSales}
                                                                        value={field.value}
                                                                        onValueChange={(serviceId, service) => {
                                                                            field.onChange(serviceId);
                                                                            if (service) {
                                                                                const quantity = form.getValues(`items.${index}.quantity`) || 1;
                                                                                const servicePrice = Number(service.price);
                                                                                form.setValue(`items.${index}.unit_price`, servicePrice, { shouldDirty: true, shouldValidate: true });
                                                                                form.setValue(`items.${index}.total`, servicePrice * quantity, { shouldDirty: true, shouldValidate: true });
                                                                            }
                                                                        }}
                                                                        placeholder={t('itemDialog.searchService')}
                                                                        noResultsText={t('itemDialog.noServiceFound')}
                                                                        triggerText={t('quoteDialog.items.selectService')}
                                                                    />
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )} />
                                                        </td>
                                                        <td className="p-1">
                                                            <FormField control={form.control} name={`items.${index}.quantity`} render={({ field }) => (
                                                                <FormItem>
                                                                    <FormControl>
                                                                        <Input type="number" step="1" min="1" {...field}
                                                                            onChange={(e) => {
                                                                                const rounded = e.target.value === '' ? '' : Math.round(Number(e.target.value));
                                                                                field.onChange(e);
                                                                                const price = form.getValues(`items.${index}.unit_price`) || 0;
                                                                                const newQty = rounded === '' ? 0 : rounded;
                                                                                form.setValue(`items.${index}.quantity`, newQty, { shouldValidate: true });
                                                                                form.setValue(`items.${index}.total`, price * newQty, { shouldDirty: true });
                                                                            }}
                                                                        />
                                                                    </FormControl>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )} />
                                                        </td>
                                                        <td className="p-1">
                                                            <FormField control={form.control} name={`items.${index}.unit_price`} render={({ field }) => (
                                                                <FormItem>
                                                                    <FormControl>
                                                                        <Input type="number" step="0.01" min="0" {...field}
                                                                            onChange={(e) => {
                                                                                field.onChange(e);
                                                                                const quantity = form.getValues(`items.${index}.quantity`) || 1;
                                                                                const newPrice = Number(e.target.value);
                                                                                form.setValue(`items.${index}.total`, Math.round(newPrice * quantity * 100) / 100, { shouldDirty: true });
                                                                            }}
                                                                        />
                                                                    </FormControl>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )} />
                                                        </td>
                                                        <td className="p-1">
                                                            <FormField control={form.control} name={`items.${index}.total`} render={({ field }) => (
                                                                <FormItem>
                                                                    <FormControl>
                                                                        <Input type="number" {...field} readOnly disabled />
                                                                    </FormControl>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )} />
                                                        </td>
                                                        <td className="p-1">
                                                            <FormField control={form.control} name={`items.${index}.tooth_number`} render={({ field }) => (
                                                                <FormItem>
                                                                    <FormControl>
                                                                        <Input type="number" placeholder="-" {...field}
                                                                            onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : '')}
                                                                        />
                                                                    </FormControl>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )} />
                                                        </td>
                                                        <td className="p-1 text-center">
                                                            <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)}>
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        <FormMessage>{form.formState.errors.items?.root?.message}</FormMessage>
                                        <div className="text-right pt-2">
                                            <span className="font-semibold text-lg">
                                                {t('quoteDialog.total')}: {new Intl.NumberFormat('en-US', {
                                                    style: 'currency',
                                                    currency: form.watch('currency') || 'USD',
                                                }).format(fields.reduce((sum, _, i) => sum + (Number(form.getValues(`items.${i}.total`)) || 0), 0))}
                                            </span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </DialogBody>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                                {t('quoteDialog.cancel')}
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {isSubmitting ? t('quoteDialog.saving') : t('quoteDialog.save')}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
