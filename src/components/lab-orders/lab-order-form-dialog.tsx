'use client';

import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { DatePickerInput } from '@/components/ui/date-picker';
import { Dialog, DialogBody, DialogCancelButton, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DoctorSelector } from '@/components/ui/doctor-selector';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { UserSelector } from '@/components/ui/user-selector';

import { parseTeeth, useLabOrderErrorText } from '@/components/lab-orders/lab-order-shared';

import { useAsyncAction } from '@/hooks/use-async-action';
import { REQUEST_TIMEOUT_MS, isTimeoutError } from '@/services/api';
import { saveLabOrder } from '@/services/lab-orders';

import type { LabOrder } from '@/lib/types';

const labOrderSchema = (t: (key: string) => string) => z.object({
  patient_id: z.string().min(1, t('form.validation.patient')),
  patient_name: z.string().optional(),
  doctor_id: z.string().optional(),
  doctor_name: z.string().optional(),
  laboratory_id: z.string().optional(),
  laboratory_name: z.string().optional(),
  work_description: z.string().trim().min(1, t('form.validation.work')).max(500),
  teeth: z.string().refine((value) => parseTeeth(value) !== null, t('form.validation.teeth')),
  due_date: z.string().optional(),
  notes: z.string().max(2000).optional(),
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
    work_description: order?.work_description ?? '',
    teeth: order?.teeth.join(', ') ?? '',
    due_date: order?.due_date ?? '',
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
      work_description: values.work_description.trim(),
      teeth: parseTeeth(values.teeth) ?? [],
      due_date: values.due_date || null,
      notes: values.notes?.trim() || null,
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
                      <UserSelector
                        filterType="PROVEEDOR"
                        isSales={false}
                        value={field.value}
                        selectedUserName={laboratoryName}
                        onValueChange={(id, user) => {
                          field.onChange(id);
                          form.setValue('laboratory_name', user?.name ?? '');
                        }}
                        placeholder={t('form.searchLaboratory')}
                        triggerText={t('form.selectLaboratory')}
                        disabled={save.isPending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="work_description" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('form.work')}</FormLabel>
                  <FormControl>
                    <Input {...field} maxLength={500} placeholder={t('form.workPlaceholder')} disabled={save.isPending} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid gap-4 sm:grid-cols-2">
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
