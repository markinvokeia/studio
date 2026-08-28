'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogBody,
    DialogCancelButton,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { DiscountControl, DocumentTotals } from '@/components/ui/discount-control';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { DatePickerInput } from '@/components/ui/date-picker';
import { DoctorSelector } from '@/components/ui/doctor-selector';
import { SedeSelector } from '@/components/ui/sede-selector';
import { ServiceSelector } from '@/components/ui/service-selector';
import { UserSelector } from '@/components/ui/user-selector';
import { Textarea } from '@/components/ui/textarea';
import { API_ROUTES } from '@/constants/routes';
import { useAuth } from '@/context/AuthContext';
import { useDiscountSettings } from '@/hooks/useDiscountSettings';
import { useToast } from '@/hooks/use-toast';
import {
    buildDiscountedDocument,
    computeDiscountAmount,
    computeGrossTotal,
    computeLineTotals,
    isDiscountWithinLimit,
    roundCurrency,
} from '@/lib/discounts';
import { Clinic, DiscountMode, Quote, TreatmentDetail, User } from '@/lib/types';
import { cn, toLocalISOString } from '@/lib/utils';
import { api } from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { format, parseISO } from 'date-fns';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import * as z from 'zod';

/**
 * `maxDiscountPct` llega de las preferencias de la clínica, así que el esquema
 * se construye en runtime: el tope no se puede escribir como literal.
 */
const quoteFormSchema = (t: (key: string) => string, maxDiscountPct: number) => z.object({
    id: z.string().optional(),
    user_id: z.string().min(1, t('validation.userRequired')),
    doctor_id: z.string().optional(),
    total: z.coerce.number().min(0, t('validation.totalPositive')),
    /** Descuento sobre el total del documento. Sólo con ámbito 'total'. */
    discount_mode: z.enum(['percent', 'amount']).nullish(),
    discount_value: z.coerce.number().min(0).nullish(),
    currency: z.enum(['UYU', 'USD']).default('USD'),
    status: z.enum(['draft', 'sent', 'accepted', 'rejected', 'pending', 'confirmed',
        'Draft', 'Sent', 'Accepted', 'Rejected', 'Pending', 'Confirmed']),
    payment_status: z.enum(['unpaid', 'paid', 'partial', 'partially_paid',
        'not_paid', 'not invoiced', 'not_invoiced']),
    billing_status: z.enum(['not invoiced', 'partially invoiced', 'invoiced',
        'not_invoiced', 'partially_invoiced', 'Pending']),
    exchange_rate: z.coerce.number().min(0.0001, t('validation.exchangeRatePositive')).optional(),
    created_at: z.date({ required_error: t('validation.dateRequired') }),
    notes: z.string().optional(),
    sede_id: z.string().min(1, t('validation.sedeRequired')),
    patient_confirmed: z.boolean().default(false),
    items: z.array(z.object({
        id: z.string().optional(),
        service_id: z.string().min(1, t('validation.serviceRequired')),
        /** Nombre del servicio — solo para display en ServiceSelector pre-cargado */
        service_name: z.string().optional(),
        quantity: z.coerce.number().int().min(1, t('validation.quantityMinOne')),
        unit_price: z.coerce.number().min(0, t('validation.unitPricePositive')).multipleOf(0.01, t('validation.unitPriceTwoDecimals')),
        total: z.coerce.number().min(0, t('validation.totalPositive')),
        tooth_number: z.coerce.number().int().min(11, t('validation.toothNumberMin')).max(85, t('validation.toothNumberMax')).optional().or(z.literal('')),
        /** Flag para diferenciar servicios de sesión actual vs próxima sesión (generado por IA) */
        is_for_next_session: z.boolean().optional(),
        /** Descuento de la línea. Sólo con ámbito 'line'. */
        discount_mode: z.enum(['percent', 'amount']).nullish(),
        discount_value: z.coerce.number().min(0).nullish(),
    })).default([]),
}).superRefine((values, ctx) => {
    // El tope se valida acá y no en cada campo porque para un descuento en
    // importe hace falta la base, que sale de unit_price × quantity.
    (values.items ?? []).forEach((item, index) => {
        const base = computeGrossTotal(item.unit_price, item.quantity);
        if (!isDiscountWithinLimit(base, { mode: item.discount_mode, value: item.discount_value }, maxDiscountPct)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['items', index, 'discount_value'],
                message: t('validation.discountOverLimit'),
            });
        }
    });

    const grossTotal = roundCurrency(
        (values.items ?? []).reduce((sum, item) => sum + computeGrossTotal(item.unit_price, item.quantity), 0),
    );
    if (!isDiscountWithinLimit(grossTotal, { mode: values.discount_mode, value: values.discount_value }, maxDiscountPct)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['discount_value'],
            message: t('validation.discountOverLimit'),
        });
    }
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
    initialData?: { user?: User | null };
    onSaveSuccess?: () => void;
    onQuoteCreated?: (quote: Quote) => void;
    isSales?: boolean;
    /** Servicios pre-cargados por IA desde la sesión clínica (TreatmentDetail con service_id) */
    initialItems?: Pick<TreatmentDetail, 'service_id' | 'service_name' | 'unit_price' | 'quantity' | 'is_for_next_session' | 'numero_diente'>[];
}

export function QuoteFormDialog({ open, onOpenChange, initialData, onSaveSuccess, onQuoteCreated, isSales = true, initialItems }: QuoteFormDialogProps) {
    const t = useTranslations('QuotesPage');
    const { toast } = useToast();
    const { activeCashSession, activeSede } = useAuth();

    const [clinic, setClinic] = React.useState<Clinic | null>(null);
    const [submissionError, setSubmissionError] = React.useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [doctorName, setDoctorName] = React.useState('');

    const discounts = useDiscountSettings();

    const schema = React.useMemo(() => quoteFormSchema(t, discounts.maxPct), [t, discounts.maxPct]);
    const form = useForm<QuoteFormValues>({
        resolver: zodResolver(schema),
        mode: 'onBlur',
    });

    /**
     * Único punto donde se recalcula el importe de una línea. Cada handler
     * (servicio, cantidad, precio, descuento) escribe su campo y llama acá, en
     * vez de repetir la multiplicación —que ahora además lleva descuento— en
     * seis sitios distintos.
     */
    const recalcLine = React.useCallback((index: number) => {
        const item = form.getValues(`items.${index}`);
        if (!item) return;
        // Con ámbito 'total' la línea no lleva descuento propio: el del documento
        // se reparte recién al guardar.
        const lineDiscount = discounts.showLineDiscount
            ? { mode: item.discount_mode, value: item.discount_value }
            : null;
        const { total } = computeLineTotals(item.unit_price, item.quantity, lineDiscount);
        form.setValue(`items.${index}.total`, total, { shouldDirty: true });
    }, [form, discounts.showLineDiscount]);

    /** Aplica o quita el descuento de una línea y deja su importe al día. */
    const setLineDiscount = React.useCallback((index: number, next: { mode: DiscountMode | null | undefined; value: number | null | undefined }) => {
        form.setValue(`items.${index}.discount_mode`, next.mode ?? null, { shouldDirty: true });
        form.setValue(`items.${index}.discount_value`, next.value ?? null, { shouldDirty: true, shouldValidate: true });
        recalcLine(index);
    }, [form, recalcLine]);

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

    // Reset form when dialog opens — pre-carga ítems IA si están disponibles
    React.useEffect(() => {
        if (!open) return;
        const defaultCurrency = clinic?.currency || 'UYU';
        const sessionRate = getSessionExchangeRate();
        // Los ítems precargados por IA entran sin descuento: aplicarlo es una
        // decisión del usuario, no algo que se herede del servicio.
        const preloadedItems = initialItems?.filter(i => i.service_id).map(i => ({
            service_id: i.service_id!,
            service_name: i.service_name ?? '',
            quantity: i.quantity ?? 1,
            unit_price: i.unit_price ?? 0,
            total: computeLineTotals(i.unit_price ?? 0, i.quantity ?? 1).total,
            tooth_number: (i.numero_diente ?? '') as number | '',
            is_for_next_session: i.is_for_next_session ?? false,
            discount_mode: null,
            discount_value: null,
        })) ?? [];
        form.reset(
            {
                user_id: initialData?.user?.id || '',
                doctor_id: '',
                total: 0,
                // El descuento al total se muestra en 0 y sólo cuenta si se teclea.
                discount_mode: null,
                discount_value: null,
                currency: defaultCurrency as any,
                status: 'draft',
                payment_status: 'unpaid',
                billing_status: 'not invoiced',
                exchange_rate: 1,
                created_at: new Date(),
                notes: '',
                sede_id: activeSede?.id || '',
                patient_confirmed: false,
                items: preloadedItems,
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
        setDoctorName('');
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
    // useWatch (y no form.watch) para que el total del documento se recalcule
    // en cuanto cambia el importe de UNA linea, sin esperar a otra edicion.
    const watchedItems = useWatch({ control: form.control, name: 'items' }) ?? [];
    const watchedDiscountMode = form.watch('discount_mode');
    const watchedDiscountValue = form.watch('discount_value');

    /**
     * Importes del documento.
     *
     * Con ámbito 'line' las líneas ya vienen netas y el total es su suma. Con
     * ámbito 'total' las líneas están en bruto y el descuento se aplica acá;
     * el reparto entre líneas se hace al guardar, no mientras se edita.
     */
    /**
     * Totales del documento, SIEMPRE derivados de precio × cantidad y del
     * descuento aplicado. No se lee `item.total` a propósito: ese campo es sólo
     * para mostrar y puede quedar desfasado si un handler no lo recalculó.
     */
    const documentTotals = React.useMemo(() => {
        const items = watchedItems || [];
        let gross = 0;
        let lineDiscounts = 0;
        for (const item of items) {
            const lineGross = computeGrossTotal(item?.unit_price, item?.quantity);
            gross += lineGross;
            if (discounts.showLineDiscount) {
                lineDiscounts += computeDiscountAmount(lineGross, { mode: item?.discount_mode, value: item?.discount_value });
            }
        }
        const grossTotal = roundCurrency(gross);
        const netAfterLines = roundCurrency(grossTotal - roundCurrency(lineDiscounts));

        if (!discounts.showTotalDiscount) {
            return { grossTotal, discountAmount: roundCurrency(grossTotal - netAfterLines), total: netAfterLines };
        }
        const discountAmount = computeDiscountAmount(grossTotal, { mode: watchedDiscountMode, value: watchedDiscountValue });
        return { grossTotal, discountAmount, total: roundCurrency(grossTotal - discountAmount) };
    }, [watchedItems, discounts.showLineDiscount, discounts.showTotalDiscount, watchedDiscountMode, watchedDiscountValue]);

    React.useEffect(() => {
        const currentTotal = form.getValues('total') || 0;
        if (Math.abs(documentTotals.total - currentTotal) > 0.001) {
            form.setValue('total', documentTotals.total, { shouldDirty: true });
        }
    }, [documentTotals.total, form]);

    const handleAddItem = () => {
        // Sin descuento: que la clínica los tenga habilitados no significa que se
        // apliquen a todo. Se pide línea por línea con el botón «Aplicar descuentos».
        append({
            service_id: '',
            quantity: 1,
            unit_price: 0,
            total: 0,
            tooth_number: '',
            discount_mode: null,
            discount_value: null,
        });
    };

    const onSubmit = async (values: QuoteFormValues) => {
        if (isSubmitting) return;
        setIsSubmitting(true);
        setSubmissionError(null);
        try {
            if (!values.items || values.items.length === 0) {
                throw new Error(t('quoteDialog.atLeastOneItem'));
            }
            // Los importes definitivos (y el reparto del descuento del total
            // entre las líneas) se resuelven acá, no mientras se edita.
            const { items: itemsToSubmit, document } = buildDiscountedDocument(
                values.items.map(item => ({
                    id: item.id,
                    service_id: item.service_id,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    tooth_number: item.tooth_number ? Number(item.tooth_number) : null,
                    // Flag de sesión para el backend (ignorado si aún no tiene soporte)
                    is_for_next_session: item.is_for_next_session ?? false,
                    discount_mode: item.discount_mode,
                    discount_value: item.discount_value,
                })),
                {
                    enabled: discounts.enabled,
                    scope: discounts.scope,
                    documentDiscount: { mode: values.discount_mode, value: values.discount_value },
                },
            );

            const normalizeBilling = (s: string) =>
                s === 'not_invoiced' ? 'not invoiced' : s === 'partially_invoiced' ? 'partially invoiced' : s;

            const payload = {
                ...values,
                status: 'draft',
                billing_status: normalizeBilling(values.billing_status),
                created_at: toLocalISOString(values.created_at),
                items: itemsToSubmit,
                ...document,
            };
            const response = await upsertQuote(payload as any, isSales, t);
            const quoteData = Array.isArray(response) ? response[0]?.data : response?.data;
            const quoteId = quoteData?.id ? String(quoteData.id) : null;

            if (values.patient_confirmed && quoteId) {
                const confirmResponse = await api.post(API_ROUTES.SALES.QUOTE_CONFIRM, {
                    quote_number: quoteId,
                    confirm_reject: 'confirm',
                    is_sales: isSales,
                    notes: '',
                });
                if (Array.isArray(confirmResponse) && confirmResponse[0]?.code >= 400) {
                    throw new Error(confirmResponse[0]?.message || t('toast.quoteError'));
                }
            }

            toast({ title: t('toast.quoteCreated'), description: t('toast.quoteSaveSuccess') });
            onOpenChange(false);
            onSaveSuccess?.();
            if (onQuoteCreated && quoteData) {
                onQuoteCreated({
                    id: quoteId!,
                    doc_no: quoteData.doc_no || 'N/A',
                    user_id: quoteData.user_id,
                    total: parseFloat(quoteData.total) || 0,
                    status: values.patient_confirmed ? 'confirmed' : (quoteData.status || 'draft'),
                    payment_status: quoteData.payment_status || 'unpaid',
                    billing_status: quoteData.billing_status || 'not invoiced',
                    currency: quoteData.currency || 'USD',
                    exchange_rate: parseFloat(quoteData.exchange_rate) || 1,
                    notes: quoteData.notes || '',
                    createdAt: quoteData.created_at || new Date().toISOString(),
                });
            }
        } catch (error) {
            setSubmissionError(error instanceof Error ? error.message : t('toast.quoteError'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const prefilledUser = initialData?.user;

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!isSubmitting) onOpenChange(o); }}>
            <DialogContent showMaximize={true} maxWidth="6xl" confirmOnClose isDirty={form.formState.isDirty}>
                <DialogHeader>
                    <DialogTitle>{t('quoteDialog.createTitle')}</DialogTitle>
                    <DialogDescription>{t('quoteDialog.description')}</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden" onKeyDown={(e) => { if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') { e.preventDefault(); if ((e.target as HTMLInputElement).name?.startsWith('items.')) handleAddItem(); } }}>
                        <DialogBody className="space-y-4 py-4 px-6">
                            {submissionError && (
                                <Alert variant="destructive">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertTitle>{t('errors.errorTitle')}</AlertTitle>
                                    <AlertDescription>{submissionError}</AlertDescription>
                                </Alert>
                            )}

                            {/* Row: Patient · Date · Currency */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                                                    <UserSelector
                                                        filterType="PACIENTE"
                                                        isSales={true}
                                                        value={field.value}
                                                        onValueChange={(userId) => form.setValue('user_id', userId)}
                                                        triggerText={t('quoteDialog.selectUser')}
                                                        placeholder={t('quoteDialog.selectUser')}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                )}
                                <FormField
                                    control={form.control}
                                    name="created_at"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('quoteDialog.createdAt')}</FormLabel>
                                            <FormControl>
                                                <DatePickerInput
                                                    value={field.value ? format(field.value, 'yyyy-MM-dd') : ''}
                                                    onChange={(iso) => field.onChange(iso ? parseISO(iso) : undefined)}
                                                />
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
                            </div>

                            {/* Doctor field */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <FormField
                                    control={form.control}
                                    name="doctor_id"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('quoteDialog.doctor')}</FormLabel>
                                            <FormControl>
                                                <DoctorSelector
                                                    value={field.value}
                                                    selectedDoctorName={doctorName}
                                                    onValueChange={(doctorId, doctor) => {
                                                        field.onChange(doctorId);
                                                        setDoctorName(doctor?.name || '');
                                                    }}
                                                    placeholder={t('quoteDialog.searchDoctor')}
                                                    triggerText={t('quoteDialog.selectDoctor')}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="sede_id"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('quoteDialog.sede')}</FormLabel>
                                            <FormControl>
                                                <SedeSelector
                                                    value={field.value}
                                                    onValueChange={(sedeId) => field.onChange(sedeId)}
                                                    triggerText={t('quoteDialog.selectSede')}
                                                    placeholder={t('quoteDialog.searchSede')}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            {/* Exchange rate — only when currencies differ */}
                            {!isClinicCurrency && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                                                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            )}

                            {/* Total kept in form state but not shown (auto-calculated from items) */}
                            <input type="hidden" {...form.register('total')} />

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
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="text-xs font-medium text-muted-foreground">{t('quoteDialog.items.title')} #{index + 1}</span>
                                                            {watchedItems?.[index]?.is_for_next_session === true && (
                                                                <span className="rounded-full bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-300">
                                                                    {t('quoteDialog.items.nextSessionBadge')}
                                                                </span>
                                                            )}
                                                            {watchedItems?.[index]?.is_for_next_session === false && watchedItems?.[index]?.service_id && (
                                                                <span className="rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                                                                    {t('quoteDialog.items.currentSessionBadge')}
                                                                </span>
                                                            )}
                                                        </div>
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
                                                                selectedServiceName={watchedItems?.[index]?.service_name}
                                                                onValueChange={(serviceId, service) => {
                                                                    field.onChange(serviceId);
                                                                    if (service) {
                                                                        const servicePrice = Number(service.price);
                                                                        form.setValue(`items.${index}.service_name`, service.name, { shouldDirty: true });
                                                                        form.setValue(`items.${index}.unit_price`, servicePrice, { shouldDirty: true, shouldValidate: true });
                                                                        recalcLine(index);
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
                                                                            form.setValue(`items.${index}.quantity`, rounded === '' ? 0 : rounded, { shouldValidate: true });
                                                                            recalcLine(index);
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
                                                                            form.setValue(`items.${index}.unit_price`, Number(e.target.value), { shouldDirty: true });
                                                                            recalcLine(index);
                                                                        }}
                                                                    />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )} />
                                                    </div>
                                                    {discounts.showLineDiscount && (
                                                        <DiscountControl
                                                            mode={watchedItems?.[index]?.discount_mode}
                                                            value={watchedItems?.[index]?.discount_value}
                                                            base={computeGrossTotal(watchedItems?.[index]?.unit_price ?? 0, watchedItems?.[index]?.quantity ?? 0)}
                                                            currency={watchedCurrency || 'UYU'}
                                                            maxPct={discounts.maxPct}
                                                            defaultPct={discounts.defaultPct}
                                                            canApply={discounts.canApply}
                                                            onApply={(next) => setLineDiscount(index, next)}
                                                            onRemove={() => setLineDiscount(index, { mode: null, value: null })}
                                                        />
                                                    )}
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
                                                    {discounts.showLineDiscount && <th className="p-2 w-24"></th>}
                                                    <th className="font-semibold p-2 w-24">{t('quoteDialog.items.toothNumber')}</th>
                                                    <th className="p-2 w-10"></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {fields.map((fieldItem, index) => (
                                                    <React.Fragment key={fieldItem.id}>
                                                    <tr className="align-top">
                                                        <td className="p-1 max-w-0">
                                                            <FormField control={form.control} name={`items.${index}.service_id`} render={({ field }) => (
                                                                <FormItem>
                                                                    <ServiceSelector
                                                                        isSales={isSales}
                                                                        value={field.value}
                                                                        selectedServiceName={watchedItems?.[index]?.service_name}
                                                                        onValueChange={(serviceId, service) => {
                                                                            field.onChange(serviceId);
                                                                            if (service) {
                                                                                const servicePrice = Number(service.price);
                                                                                form.setValue(`items.${index}.service_name`, service.name, { shouldDirty: true });
                                                                                form.setValue(`items.${index}.unit_price`, servicePrice, { shouldDirty: true, shouldValidate: true });
                                                                                recalcLine(index);
                                                                            }
                                                                        }}
                                                                        placeholder={t('itemDialog.searchService')}
                                                                        noResultsText={t('itemDialog.noServiceFound')}
                                                                        triggerText={t('quoteDialog.items.selectService')}
                                                                    />
                                                                    {/* Badge de sesión generado por IA */}
                                                                    {watchedItems?.[index]?.is_for_next_session === true && (
                                                                        <span className="inline-flex items-center mt-1 rounded-full bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-300">
                                                                            {t('quoteDialog.items.nextSessionBadge')}
                                                                        </span>
                                                                    )}
                                                                    {watchedItems?.[index]?.is_for_next_session === false && watchedItems?.[index]?.service_id && (
                                                                        <span className="inline-flex items-center mt-1 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                                                                            {t('quoteDialog.items.currentSessionBadge')}
                                                                        </span>
                                                                    )}
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
                                                                                form.setValue(`items.${index}.quantity`, rounded === '' ? 0 : rounded, { shouldValidate: true });
                                                                                recalcLine(index);
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
                                                                                form.setValue(`items.${index}.unit_price`, Number(e.target.value), { shouldDirty: true });
                                                                                recalcLine(index);
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
                                                        {discounts.showLineDiscount && (
                                                            <td className="p-1">
                                                                <DiscountControl
                                                                    mode={watchedItems?.[index]?.discount_mode}
                                                                    value={watchedItems?.[index]?.discount_value}
                                                                    base={computeGrossTotal(watchedItems?.[index]?.unit_price ?? 0, watchedItems?.[index]?.quantity ?? 0)}
                                                                    currency={watchedCurrency || 'UYU'}
                                                                    maxPct={discounts.maxPct}
                                                                    defaultPct={discounts.defaultPct}
                                                                    canApply={discounts.canApply}
                                                                    onApply={(next) => setLineDiscount(index, next)}
                                                                    onRemove={() => setLineDiscount(index, { mode: null, value: null })}
                                                                />
                                                            </td>
                                                        )}
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
                                                    </React.Fragment>
                                                ))}
                                            </tbody>
                                        </table>
                                        <FormMessage>{form.formState.errors.items?.root?.message}</FormMessage>

                                        <div className="flex flex-col items-end gap-2 pt-3">
                                            {/* Con ámbito de documento el campo se ofrece directo, en 0:
                                                no hay una línea concreta a la que colgarlo. */}
                                            {discounts.showTotalDiscount && (
                                                <DiscountControl
                                                    mode={watchedDiscountMode}
                                                    value={watchedDiscountValue}
                                                    base={documentTotals.grossTotal}
                                                    currency={watchedCurrency || 'UYU'}
                                                    maxPct={discounts.maxPct}
                                                    defaultPct={discounts.defaultPct}
                                                    canApply={discounts.canApply}
                                                    onApply={(next) => {
                                                        form.setValue('discount_mode', next.mode ?? null, { shouldDirty: true });
                                                        form.setValue('discount_value', next.value ?? null, { shouldDirty: true, shouldValidate: true });
                                                    }}
                                                    onRemove={() => {
                                                        form.setValue('discount_mode', null, { shouldDirty: true });
                                                        form.setValue('discount_value', null, { shouldDirty: true, shouldValidate: true });
                                                    }}
                                                />
                                            )}
                                            <DocumentTotals
                                                grossTotal={documentTotals.grossTotal}
                                                discountAmount={documentTotals.discountAmount}
                                                total={documentTotals.total}
                                                currency={watchedCurrency || 'UYU'}
                                            />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Notes — after items */}
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

                            {/* Patient confirmed flag */}
                            <FormField
                                control={form.control}
                                name="patient_confirmed"
                                render={({ field }) => (
                                    <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-4 py-3">
                                        <Checkbox
                                            id="patient_confirmed"
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                            className="mt-0.5"
                                        />
                                        <div className="flex flex-col gap-0.5">
                                            <label htmlFor="patient_confirmed" className="text-sm font-medium cursor-pointer leading-none">
                                                {t('quoteDialog.patientConfirmed')}
                                            </label>
                                            <p className="text-xs text-muted-foreground">
                                                {t('quoteDialog.patientConfirmedNote')}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            />
                        </DialogBody>
                        <DialogFooter>
                            <DialogCancelButton variant="outline" disabled={isSubmitting}>
                                {t('quoteDialog.cancel')}
                            </DialogCancelButton>
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
