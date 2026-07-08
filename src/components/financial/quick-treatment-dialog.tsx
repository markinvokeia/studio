'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format, parseISO } from 'date-fns';
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
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
import { DatePickerInput } from '@/components/ui/date-picker';
import { DoctorSelector } from '@/components/ui/doctor-selector';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { ServiceSelector } from '@/components/ui/service-selector';
import { Textarea } from '@/components/ui/textarea';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import type { Clinic, User } from '@/lib/types';
import { preserveTimeIfToday, toLocalISOString } from '@/lib/utils';
import { api } from '@/services/api';

async function getClinicCurrency(): Promise<string> {
  try {
    const data = await api.get(API_ROUTES.CLINIC);
    const clinicsData = Array.isArray(data) ? data : (data.clinics || data.data || data.result || []);
    const clinic: Partial<Clinic> | undefined = clinicsData[0];
    return clinic?.currency || 'UYU';
  } catch {
    return 'UYU';
  }
}

const quickTreatmentSchema = (t: (key: string) => string) => z.object({
  created_at: z.date({ required_error: t('validation.dateRequired') }),
  tooth_number: z.coerce.number().int().min(11, t('validation.toothNumberMin')).max(85, t('validation.toothNumberMax')).optional().or(z.literal('')),
  service_id: z.string().min(1, t('validation.serviceRequired')),
  service_name: z.string().optional(),
  description: z.string().optional(),
  unit_price: z.coerce.number().min(0, t('validation.pricePositive')),
  doctor_id: z.string().optional(),
  keep_open: z.boolean().default(false),
});
type QuickTreatmentFormValues = z.infer<ReturnType<typeof quickTreatmentSchema>>;

export interface QuickTreatmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 'quote' creates a Presupuesto (doesn't affect the balance until confirmed + billed);
   *  'invoice' creates a Tratamiento — a direct invoice that affects the balance immediately. */
  mode: 'quote' | 'invoice';
  patient: User;
  isSales?: boolean;
  onSaveSuccess?: () => void;
}

/**
 * Single-item quick entry for the "Clásico" (unified) patient ledger — mirrors the
 * Odontosys "Nuevo Presupuesto"/"Nuevo Tratamiento" modal (one line, keep-open-to-add-
 * another) instead of the full multi-line Quote/Invoice builder used elsewhere in the app.
 */
export function QuickTreatmentDialog({ open, onOpenChange, mode, patient, isSales = true, onSaveSuccess }: QuickTreatmentDialogProps) {
  const t = useTranslations('QuickTreatmentDialog');
  const { toast } = useToast();

  const [currency, setCurrency] = React.useState('UYU');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [doctorName, setDoctorName] = React.useState('');
  const [showDescription, setShowDescription] = React.useState(false);

  const schema = React.useMemo(() => quickTreatmentSchema(t), [t]);
  const form = useForm<QuickTreatmentFormValues>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
  });
  const watchedServiceName = form.watch('service_name');

  const resetForCurrentMode = React.useCallback((keepDoctor: boolean) => {
    form.reset({
      created_at: new Date(),
      tooth_number: '',
      service_id: '',
      service_name: '',
      description: '',
      unit_price: 0,
      doctor_id: keepDoctor ? form.getValues('doctor_id') : '',
      keep_open: form.getValues('keep_open') || false,
    });
    if (!keepDoctor) setDoctorName('');
    setShowDescription(false);
  }, [form]);

  React.useEffect(() => {
    if (!open) return;
    getClinicCurrency().then(setCurrency);
    resetForCurrentMode(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onSubmit = async (values: QuickTreatmentFormValues) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const item = {
        service_id: values.service_id,
        service_name: values.service_name,
        quantity: 1,
        unit_price: values.unit_price,
        total: values.unit_price,
        tooth_number: values.tooth_number ? Number(values.tooth_number) : null,
      };
      const createdAt = toLocalISOString(preserveTimeIfToday(values.created_at));

      if (mode === 'quote') {
        const res = await api.post(API_ROUTES.SALES.QUOTES_UPSERT, {
          user_id: patient.id,
          doctor_id: values.doctor_id || undefined,
          total: values.unit_price,
          currency,
          status: 'draft',
          payment_status: 'unpaid',
          billing_status: 'not invoiced',
          exchange_rate: 1,
          created_at: createdAt,
          notes: values.description || '',
          patient_confirmed: false,
          items: [item],
          is_sales: isSales,
        });
        if (Array.isArray(res) && res[0]?.code >= 400) throw new Error(res[0]?.message || t('errors.saveQuote'));
        toast({ title: t('toasts.quoteCreated') });
      } else {
        const res = await api.post(API_ROUTES.SALES.INVOICES_UPSERT, {
          user_id: patient.id,
          doctor_id: values.doctor_id || undefined,
          total: values.unit_price,
          currency,
          created_at: createdAt,
          notes: values.description || '',
          is_historical: false,
          items: [item],
          type: 'invoice',
          is_sales: isSales,
        });
        if (Array.isArray(res) && res[0]?.code >= 400) throw new Error(res[0]?.message || t('errors.saveInvoice'));
        toast({ title: t('toasts.treatmentCreated') });
      }

      onSaveSuccess?.();
      if (values.keep_open) {
        resetForCurrentMode(true);
      } else {
        onOpenChange(false);
      }
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : t(mode === 'quote' ? 'errors.saveQuote' : 'errors.saveInvoice'),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!isSubmitting) onOpenChange(o); }}>
      <DialogContent className="sm:max-w-[480px]" confirmOnClose isDirty={form.formState.isDirty}>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>{t(mode === 'quote' ? 'titleQuote' : 'titleTreatment')}</DialogTitle>
              <DialogDescription>{patient.name}</DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-4 py-4 px-6">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="created_at" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('fields.date')}</FormLabel>
                    <FormControl>
                      <DatePickerInput
                        value={field.value ? format(field.value, 'yyyy-MM-dd') : ''}
                        onChange={(iso) => field.onChange(iso ? parseISO(iso) : undefined)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="tooth_number" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('fields.tooth')}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="-"
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : '')}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="service_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('fields.treatment')}</FormLabel>
                  <ServiceSelector
                    isSales={isSales}
                    value={field.value}
                    selectedServiceName={watchedServiceName}
                    onValueChange={(serviceId, service) => {
                      field.onChange(serviceId);
                      if (service) {
                        form.setValue('service_name', service.name, { shouldDirty: true });
                        form.setValue('unit_price', Number(service.price) || 0, { shouldDirty: true, shouldValidate: true });
                      }
                    }}
                    placeholder={t('fields.searchTreatment')}
                    triggerText={t('fields.selectTreatment')}
                  />
                  <FormMessage />
                </FormItem>
              )} />

              <button
                type="button"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setShowDescription((v) => !v)}
              >
                {showDescription ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {t(showDescription ? 'fields.hideDescription' : 'fields.showDescription')}
              </button>
              {showDescription && (
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea {...field} value={field.value || ''} rows={3} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              )}

              <FormField control={form.control} name="unit_price" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('fields.price')} ({currency})</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" min="0" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="doctor_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('fields.doctor')}</FormLabel>
                  <FormControl>
                    <DoctorSelector
                      value={field.value}
                      selectedDoctorName={doctorName}
                      onValueChange={(doctorId, doctor) => {
                        field.onChange(doctorId);
                        setDoctorName(doctor?.name || '');
                      }}
                      placeholder={t('fields.searchDoctor')}
                      triggerText={t('fields.selectDoctor')}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="keep_open" render={({ field }) => (
                <div className="flex items-center gap-2">
                  <Checkbox id="keep_open" checked={field.value} onCheckedChange={field.onChange} />
                  <label htmlFor="keep_open" className="text-sm cursor-pointer">{t('fields.keepOpen')}</label>
                </div>
              )} />
            </DialogBody>
            <DialogFooter>
              <DialogCancelButton variant="outline" disabled={isSubmitting}>
                {t('cancel')}
              </DialogCancelButton>
              <Button type="submit" disabled={isSubmitting}>
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
