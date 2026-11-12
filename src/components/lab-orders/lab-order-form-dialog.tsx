'use client';

import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { addDays, format } from 'date-fns';
import { Trash2 } from 'lucide-react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { DatePickerInput } from '@/components/ui/date-picker';
import { Dialog, DialogBody, DialogCancelButton, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DoctorSelector } from '@/components/ui/doctor-selector';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { ServiceSelector } from '@/components/ui/service-selector';
import { Textarea } from '@/components/ui/textarea';
import { UserSelector } from '@/components/ui/user-selector';

import { parseTeeth, useLabOrderErrorText } from '@/components/lab-orders/lab-order-shared';
import { LabSelector } from '@/components/lab-orders/lab-selector';

import { useAsyncAction } from '@/hooks/use-async-action';
import { REQUEST_TIMEOUT_MS, isTimeoutError } from '@/services/api';
import { saveLabOrder } from '@/services/lab-orders';

import type { LabOrder } from '@/lib/types';

/** Entrega estimada por defecto al crear una orden: días desde hoy. */
const DEFAULT_DUE_DAYS = 7;

const labOrderSchema = (t: (key: string) => string) => z.object({
  patient_id: z.string().min(1, t('form.validation.patient')),
  patient_name: z.string().optional(),
  doctor_id: z.string().optional(),
  doctor_name: z.string().optional(),
  laboratory_id: z.string().optional(),
  laboratory_name: z.string().optional(),
  /** Servicios de laboratorio (service_catalog.is_lab). */
  items: z.array(z.object({
    service_id: z.string().min(1),
    service_name: z.string(),
    quantity: z.coerce.number().int().min(1, t('form.validation.quantity')).max(99, t('form.validation.quantity')),
    teeth: z.string().refine((value) => parseTeeth(value) !== null, t('form.validation.teeth')),
    notes: z.string().max(500).optional(),
    /** Categoría de laboratorio del servicio: solo para filtrar el selector, no se envía. */
    lab_category_id: z.string().nullable().optional(),
  })),
  work_description: z.string().trim().max(500),
  /** Piezas de la orden: solo cuando no hay servicios (cada servicio lleva las suyas). */
  teeth: z.string().refine((value) => parseTeeth(value) !== null, t('form.validation.teeth')),
  due_date: z.string().optional(),
  notes: z.string().max(2000).optional(),
}).refine((v) => v.items.length > 0 || v.work_description.length > 0, {
  path: ['work_description'],
  message: t('form.validation.work'),
});

type LabOrderFormValues = z.infer<ReturnType<typeof labOrderSchema>>;

function toFormValues(order?: LabOrder | null, patient?: { id: string; name: string } | null): LabOrderFormValues {
  return {
    patient_id: order?.patient_id ?? patient?.id ?? '',
    patient_name: order?.patient_name ?? patient?.name ?? '',
    doctor_id: order?.doctor_id ?? '',
    doctor_name: order?.doctor_name ?? '',
    laboratory_id: order?.laboratory_id ?? '',
    laboratory_name: order?.laboratory_name ?? '',
    items: (order?.items ?? []).map((item) => ({
      service_id: String(item.service_id),
      service_name: item.service_name,
      quantity: item.quantity,
      teeth: item.teeth.join(', '),
      notes: item.notes ?? '',
      lab_category_id: item.lab_category_id,
    })),
    work_description: order?.work_description ?? '',
    teeth: order?.teeth.join(', ') ?? '',
    // Alta: entrega estimada a una semana (fecha local de hoy + 7). En edición, la guardada.
    due_date: order ? (order.due_date ?? '') : format(addDays(new Date(), DEFAULT_DUE_DAYS), 'yyyy-MM-dd'),
    notes: order?.notes ?? '',
  };
}

export interface LabOrderFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Con orden: edición. Sin orden: alta (entra en la etapa inicial). */
  order?: LabOrder | null;
  /** Alta desde la ficha del paciente: el paciente queda fijo. */
  patient?: { id: string; name: string } | null;
  onSaved: (order: LabOrder) => void | Promise<void>;
}

/** Alta y edición de una orden de laboratorio. La etapa no se edita acá: se mueve desde el detalle. */
export function LabOrderFormDialog({ open, onOpenChange, order, patient, onSaved }: LabOrderFormDialogProps) {
  const t = useTranslations('LabOrdersPage');
  const errorText = useLabOrderErrorText();
  const [submissionError, setSubmissionError] = React.useState<string | null>(null);
  const isEdit = Boolean(order);
  const patientLocked = Boolean(patient) && !isEdit;

  const form = useForm<LabOrderFormValues>({
    resolver: zodResolver(labOrderSchema(t)),
    defaultValues: toFormValues(order, patient),
  });

  // Nombres de lo elegido, para que los selectores muestren la selección sin volver a buscarla.
  const [patientName, doctorName, laboratoryName] = useWatch({
    control: form.control,
    name: ['patient_name', 'doctor_name', 'laboratory_name'],
  });

  const items = useFieldArray({ control: form.control, name: 'items' });
  const hasItems = items.fields.length > 0;
  const chosenServiceIds = items.fields.map((item) => item.service_id);

  // Categorías de los servicios elegidos: con una sola, el selector de laboratorio arranca filtrado.
  const watchedItems = useWatch({ control: form.control, name: 'items' });
  const labCategoryIds = React.useMemo(
    () => Array.from(new Set((watchedItems ?? []).map((item) => item.lab_category_id).filter((id): id is string => !!id))),
    [watchedItems],
  );

  const addService = (serviceId: string, serviceName: string, labCategoryId: string | null = null) => {
    if (!serviceId || chosenServiceIds.includes(serviceId)) return;
    // El primer servicio hereda las piezas que ya se habían escrito para la orden.
    const inheritedTeeth = items.fields.length === 0 ? form.getValues('teeth') : '';
    items.append({ service_id: serviceId, service_name: serviceName, quantity: 1, teeth: inheritedTeeth, notes: '', lab_category_id: labCategoryId });
    if (inheritedTeeth) form.setValue('teeth', '', { shouldDirty: true });
    form.clearErrors('work_description');
  };

  React.useEffect(() => {
    if (!open) return;
    form.reset(toFormValues(order, patient));
    setSubmissionError(null);
    // Solo al abrir: un refetch de la orden mientras se edita no debe pisar lo escrito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const save = useAsyncAction(
    (values: LabOrderFormValues) => saveLabOrder({
      ...(order ? { id: order.id } : {}),
      patient_id: values.patient_id,
      doctor_id: values.doctor_id || null,
      laboratory_id: values.laboratory_id || null,
      work_description: values.work_description.trim() || null,
      // Con servicios, el backend calcula las piezas de la orden (unión de las de cada servicio).
      teeth: values.items.length > 0 ? [] : parseTeeth(values.teeth) ?? [],
      due_date: values.due_date || null,
      notes: values.notes?.trim() || null,
      items: values.items.map((item) => ({
        service_id: Number(item.service_id),
        quantity: item.quantity,
        teeth: parseTeeth(item.teeth) ?? [],
        notes: item.notes?.trim() || null,
      })),
    }, { timeoutMs: REQUEST_TIMEOUT_MS.mutation }),
    {
      onSuccess: async (saved) => {
        await onSaved(saved);
        onOpenChange(false);
      },
      onError: (error) => {
        setSubmissionError(isTimeoutError(error) ? t('form.timeoutMaybeSaved') : errorText(error));
      },
      showErrorToast: false,
    },
  );

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && save.isPending) return; onOpenChange(next); }}>
      <DialogContent className="sm:max-w-xl" confirmOnClose isDirty={form.formState.isDirty}>
        <DialogHeader>
          <DialogTitle>{isEdit ? t('form.editTitle', { id: order!.id }) : t('form.createTitle')}</DialogTitle>
          {!isEdit && <DialogDescription>{t('form.createDescription')}</DialogDescription>}
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(save.run)} className="flex min-h-0 flex-1 flex-col">
            <DialogBody className="space-y-4 px-6 py-4">
              <FormField control={form.control} name="patient_id" render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>{t('form.patient')}</FormLabel>
                  <FormControl>
                    <UserSelector
                      filterType="PACIENTE"
                      value={field.value}
                      selectedUserName={patientName}
                      onValueChange={(id, user) => {
                        field.onChange(id);
                        form.setValue('patient_name', user?.name ?? '');
                      }}
                      placeholder={t('form.searchPatient')}
                      triggerText={t('form.selectPatient')}
                      disabled={patientLocked || save.isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="doctor_id" render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>{t('form.doctor')}</FormLabel>
                    <FormControl>
                      <DoctorSelector
                        value={field.value}
                        selectedDoctorName={doctorName}
                        onValueChange={(id, doctor) => {
                          field.onChange(id);
                          form.setValue('doctor_name', doctor?.name ?? '');
                        }}
                        placeholder={t('form.searchDoctor')}
                        triggerText={t('form.selectDoctor')}
                        disabled={save.isPending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="laboratory_id" render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>{t('form.laboratory')}</FormLabel>
                    <FormControl>
                      <LabSelector
                        value={field.value}
                        selectedName={laboratoryName}
                        categoryIds={labCategoryIds}
                        clearable
                        onValueChange={(id, lab) => {
                          field.onChange(id);
                          form.setValue('laboratory_name', lab?.name ?? '', { shouldDirty: true });
                        }}
                        triggerText={t('form.selectLaboratory')}
                        disabled={save.isPending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <section data-help-id="lab-orders.section.services" className="space-y-2">
                <div>
                  <p className="text-sm font-medium">{t('form.services')}</p>
                  <p className="text-xs text-muted-foreground">{t('form.servicesHint')}</p>
                </div>
                {items.fields.map((item, index) => (
                  <div key={item.id} className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 break-words text-sm font-medium">{item.service_name}</p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        data-help-id="lab-orders.btn.remove-service"
                        className="-mr-1 -mt-1 h-7 w-7 shrink-0 hover:bg-destructive/10 hover:text-destructive"
                        aria-label={t('form.removeService', { name: item.service_name })}
                        onClick={() => items.remove(index)}
                        disabled={save.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[5rem_minmax(0,1fr)_minmax(0,1.4fr)]">
                      <FormField control={form.control} name={`items.${index}.quantity`} render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">{t('form.quantity')}</FormLabel>
                          <FormControl>
                            <Input {...field} type="number" min={1} max={99} inputMode="numeric" className="h-9" disabled={save.isPending} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name={`items.${index}.teeth`} render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">{t('form.teeth')}</FormLabel>
                          <FormControl>
                            <Input {...field} inputMode="numeric" className="h-9" placeholder={t('form.teethPlaceholder')} disabled={save.isPending} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name={`items.${index}.notes`} render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">{t('form.itemNotes')}</FormLabel>
                          <FormControl>
                            <Input {...field} maxLength={500} className="h-9" placeholder={t('form.itemNotesPlaceholder')} disabled={save.isPending} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                  </div>
                ))}
                <div data-help-id="lab-orders.btn.add-service">
                  <ServiceSelector
                    isLab
                    excludeIds={chosenServiceIds}
                    value=""
                    onValueChange={(id, service) => addService(id, service?.name ?? '', service?.lab_category_id ?? null)}
                    placeholder={t('form.searchService')}
                    triggerText={hasItems ? t('form.addAnotherService') : t('form.addService')}
                    noResultsText={t('form.noLabServices')}
                    emptyText={t('form.noLabServicesYet')}
                    disabled={save.isPending}
                  />
                </div>
                {hasItems && <p className="text-xs text-muted-foreground">{t('form.teethHint')}</p>}
              </section>

              <FormField control={form.control} name="work_description" render={({ field }) => (
                <FormItem>
                  <FormLabel>{hasItems ? t('form.workOptional') : t('form.work')}</FormLabel>
                  <FormControl>
                    <Input {...field} maxLength={500} placeholder={t('form.workPlaceholder')} disabled={save.isPending} />
                  </FormControl>
                  {!hasItems && <FormDescription>{t('form.workHint')}</FormDescription>}
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid gap-4 sm:grid-cols-2">
                {!hasItems && (
                  <FormField control={form.control} name="teeth" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('form.teeth')}</FormLabel>
                      <FormControl>
                        <Input {...field} inputMode="numeric" placeholder={t('form.teethPlaceholder')} disabled={save.isPending} />
                      </FormControl>
                      <FormDescription>{t('form.teethHint')}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}

                <FormField control={form.control} name="due_date" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('form.dueDate')}</FormLabel>
                    <FormControl>
                      <DatePickerInput value={field.value} onChange={field.onChange} disabled={save.isPending} />
                    </FormControl>
                    <FormDescription>{t('form.dueDateHint')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('form.notes')}</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} maxLength={2000} placeholder={t('form.notesPlaceholder')} disabled={save.isPending} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {submissionError && (
                <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {submissionError}
                </p>
              )}
            </DialogBody>
            <DialogFooter>
              <DialogCancelButton disabled={save.isPending}>{t('form.cancel')}</DialogCancelButton>
              <Button type="submit" loading={save.isPending}>{isEdit ? t('form.saveChanges') : t('form.create')}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
