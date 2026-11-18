'use client';

import * as React from 'react';
import { format, startOfToday } from 'date-fns';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ArrowRight, Check, FlaskConical, Minus, Pencil, Phone, Plus, Send, Trash2, Zap } from 'lucide-react';
import { useFieldArray, useForm, useWatch, type FieldPath } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { DatePickerInput } from '@/components/ui/date-picker';
import { Dialog, DialogBody, DialogCancelButton, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DoctorSelector } from '@/components/ui/doctor-selector';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ServiceSelector } from '@/components/ui/service-selector';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { UserSelector } from '@/components/ui/user-selector';

import { LabOrderAttachmentPicker } from '@/components/lab-orders/lab-order-attachments';
import { LabStageBadge, nextLabStage, parseTeeth, useLabOrderErrorText } from '@/components/lab-orders/lab-order-shared';
import { LabSelector } from '@/components/lab-orders/lab-selector';
import { LabTeethPicker } from '@/components/lab-orders/lab-teeth-picker';

import { useAuth } from '@/context/AuthContext';
import { useAsyncAction } from '@/hooks/use-async-action';
import { toast } from '@/hooks/use-toast';
import { formatPhoneNumber } from '@/lib/phone-text';
import { cn } from '@/lib/utils';
import { REQUEST_TIMEOUT_MS, isTimeoutError } from '@/services/api';
import { fetchDoctors } from '@/services/doctors';
import { changeLabOrderStage, saveLabOrder, searchLaboratories, uploadLabOrderAttachments } from '@/services/lab-orders';
import { fetchLabStages } from '@/services/lab-stages';

import type { LabOrder, LabStage, Laboratory } from '@/lib/types';

/**
 * La fecha de entrega se fija al enviar la orden al laboratorio (salir de la etapa inicial,
 * script 172). Al editar solo aparece si la orden ya se envió, y mientras siga pendiente
 * no se puede dejar vacía.
 */
function dueDateMode(order?: LabOrder | null): 'hidden' | 'required' | 'optional' {
  if (!order || order.stage_kind === 'initial') return 'hidden';
  return order.stage_kind === 'final' ? 'optional' : 'required';
}

const todayKey = () => format(startOfToday(), 'yyyy-MM-dd');

const labOrderSchema = (t: (key: string) => string, dueDateRequired: boolean) => z.object({
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
  is_urgent: z.boolean(),
  /** Alta: enviarla ya al laboratorio (pasa a la etapa siguiente a la inicial). */
  send: z.boolean(),
  /** Fecha de entrega del envío ('YYYY-MM-DD'). */
  send_due_date: z.string().optional(),
}).refine((v) => v.items.length > 0 || v.work_description.length > 0, {
  path: ['work_description'],
  message: t('form.validation.work'),
}).refine((v) => !dueDateRequired || !!v.due_date, {
  path: ['due_date'],
  message: t('form.validation.dueDate'),
}).refine((v) => !v.send || !!v.laboratory_id, {
  path: ['send'],
  message: t('wizard.validation.sendLab'),
}).refine((v) => !v.send || !!v.send_due_date, {
  path: ['send_due_date'],
  message: t('wizard.validation.sendDueDate'),
}).refine((v) => !v.send || !v.send_due_date || v.send_due_date >= todayKey(), {
  path: ['send_due_date'],
  message: t('wizard.validation.sendDuePast'),
});

type LabOrderFormValues = z.infer<ReturnType<typeof labOrderSchema>>;

/** Datos con los que arranca un alta (desde Mi consultorio o al guardar una sesión clínica). */
export interface LabOrderDraft {
  doctor?: { id: string; name: string } | null;
  /** Laboratorio ya elegido (desde la tarjeta de la sesión → "Editar detalles"). */
  laboratory?: { id: string; name: string } | null;
  items?: Array<{ service_id: string; service_name: string; quantity: number; teeth: number[]; lab_category_id?: string | null }>;
  notes?: string;
  /** Paciente propuesto (por voz): a diferencia de la prop `patient`, se puede cambiar. */
  patient?: { id: string; name: string } | null;
  work_description?: string;
  /** Piezas de la orden cuando no hay servicios. */
  teeth?: number[];
  is_urgent?: boolean;
  /** "Crear y enviar" ya elegido, con su fecha de entrega. */
  send?: boolean;
  send_due_date?: string;
  /** Abrir directo en Revisar (todo lo necesario ya viene cargado). */
  startAtReview?: boolean;
}

/** Lo que la voz puede cambiar de un alta abierta ("que sea urgente", "agregá un perno en la 21"). */
export type LabOrderDraftPatch = Partial<Pick<LabOrderDraft,
  'patient' | 'items' | 'teeth' | 'work_description' | 'laboratory' | 'is_urgent' | 'notes' | 'send' | 'send_due_date'>>;

/** Acceso de la voz al alta abierta: leer cómo está (con lo que se cambió a mano) y corregirla. */
export interface LabOrderDraftControl {
  read: () => LabOrderDraft;
  apply: (patch: LabOrderDraftPatch) => void;
  /** Avisa cada cambio del formulario (a mano o por voz). Devuelve cómo dejar de escuchar. */
  subscribe: (listener: () => void) => () => void;
}

function toFormValues(order?: LabOrder | null, patient?: { id: string; name: string } | null, draft?: LabOrderDraft | null): LabOrderFormValues {
  const fromDraft = !order ? draft : null;
  return {
    patient_id: order?.patient_id ?? patient?.id ?? fromDraft?.patient?.id ?? '',
    patient_name: order?.patient_name ?? patient?.name ?? fromDraft?.patient?.name ?? '',
    doctor_id: order?.doctor_id ?? fromDraft?.doctor?.id ?? '',
    doctor_name: order?.doctor_name ?? fromDraft?.doctor?.name ?? '',
    laboratory_id: order?.laboratory_id ?? fromDraft?.laboratory?.id ?? '',
    laboratory_name: order?.laboratory_name ?? fromDraft?.laboratory?.name ?? '',
    items: order
      ? order.items.map((item) => ({
        service_id: String(item.service_id),
        service_name: item.service_name,
        quantity: item.quantity,
        teeth: item.teeth.join(', '),
        notes: item.notes ?? '',
        lab_category_id: item.lab_category_id,
      }))
      : (fromDraft?.items ?? []).map((item) => ({
        service_id: String(item.service_id),
        service_name: item.service_name,
        quantity: Math.min(99, Math.max(1, Math.round(item.quantity) || 1)),
        teeth: item.teeth.join(', '),
        notes: '',
        lab_category_id: item.lab_category_id ?? null,
      })),
    work_description: order?.work_description ?? fromDraft?.work_description ?? '',
    teeth: order?.teeth.join(', ') ?? fromDraft?.teeth?.join(', ') ?? '',
    due_date: order?.due_date ?? '',
    notes: order?.notes ?? fromDraft?.notes ?? '',
    is_urgent: order?.is_urgent ?? fromDraft?.is_urgent ?? false,
    send: fromDraft?.send ?? false,
    send_due_date: fromDraft?.send_due_date ?? '',
  };
}

// ──── Pasos ────

type WizardStep = 'patient' | 'work' | 'laboratory' | 'review';

const STEPS: WizardStep[] = ['patient', 'work', 'laboratory', 'review'];

/** Campos que se validan al salir de cada paso. */
const STEP_FIELDS: Record<WizardStep, FieldPath<LabOrderFormValues>[]> = {
  patient: ['patient_id'],
  work: ['items', 'work_description', 'teeth'],
  laboratory: [],
  review: ['due_date', 'notes', 'send', 'send_due_date'],
};

/** Paso donde se corrige un error de validación del guardado. */
function stepOfField(field: string): WizardStep {
  const step = STEPS.find((s) => STEP_FIELDS[s].some((f) => field === f || field.startsWith(`${f}.`)));
  return step ?? 'review';
}

/** Con qué paso arranca: lo que ya viene cargado (paciente, servicios de la sesión) se da por hecho. */
function initialProgress(values: LabOrderFormValues, isEdit: boolean, atReview = false): { step: WizardStep; visited: WizardStep[] } {
  const workDone = values.items.length > 0 || values.work_description.trim().length > 0;
  if (isEdit || (atReview && values.patient_id && workDone)) return { step: 'review', visited: ['patient', 'work', 'laboratory'] };
  if (!values.patient_id) return { step: 'patient', visited: [] };
  if (values.items.length > 0) return { step: 'laboratory', visited: ['patient', 'work'] };
  return { step: 'work', visited: ['patient'] };
}

export interface LabOrderFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Con orden: edición (abre en Revisar). Sin orden: alta (entra en la etapa inicial o se envía). */
  order?: LabOrder | null;
  /** Alta desde la ficha del paciente: el paciente queda fijo. */
  patient?: { id: string; name: string } | null;
  /** Alta: doctor, servicios y notas precargados. Se ignora al editar. */
  draft?: LabOrderDraft | null;
  /** El doctor precargado no se puede cambiar (sin permiso para elegir otro). */
  lockDoctor?: boolean;
  /** Texto bajo el título del alta (por ejemplo, de qué sesión viene). */
  description?: string;
  onSaved: (order: LabOrder) => void | Promise<void>;
  /** Cada cambio de este número pulsa "Crear" (lo usa la confirmación por voz). */
  submitSignal?: number;
  /** El guardado pedido no salió: el error del servidor, o null si faltan datos del formulario. */
  onSubmitFailed?: (message: string | null) => void;
  /** Alta abierta por voz: recibe el acceso para leerla y corregirla (null al cerrarse). */
  voiceControl?: (control: LabOrderDraftControl | null) => void;
}

/**
 * Alta y edición de una orden de laboratorio como un flujo guiado: Paciente → Trabajo →
 * Laboratorio → Revisar, con el resumen al costado. Al crearla se puede enviar en el mismo
 * paso (fecha de entrega incluida). La etapa de una orden existente se mueve desde el detalle.
 */
export function LabOrderFormDialog({ open, onOpenChange, order, patient, draft, lockDoctor = false, description, onSaved, submitSignal, onSubmitFailed, voiceControl }: LabOrderFormDialogProps) {
  const t = useTranslations('LabOrdersPage');
  const errorText = useLabOrderErrorText();
  const [submissionError, setSubmissionError] = React.useState<string | null>(null);
  const isEdit = Boolean(order);
  const doctorLocked = lockDoctor && !isEdit && Boolean(draft?.doctor?.id);
  const patientLocked = Boolean(patient) && !isEdit;
  const dueMode = dueDateMode(order);
  /** Alta: archivos que se suben apenas se crea la orden. En la edición se manejan desde el detalle. */
  const [pendingFiles, setPendingFiles] = React.useState<File[]>([]);
  const [step, setStep] = React.useState<WizardStep>('patient');
  const [visited, setVisited] = React.useState<Set<WizardStep>>(new Set());
  /** Etapa inicial y la siguiente (a la que va "Crear y enviar"); null si no hay a dónde enviarla. */
  const [stages, setStages] = React.useState<{ initial: LabStage; send: LabStage } | null>(null);
  /** La persona quitó el laboratorio: no volver a proponer el único sugerido. */
  const [labCleared, setLabCleared] = React.useState(false);

  const form = useForm<LabOrderFormValues>({
    resolver: zodResolver(labOrderSchema(t, dueMode === 'required')),
    defaultValues: toFormValues(order, patient, draft),
  });

  const items = useFieldArray({ control: form.control, name: 'items' });
  const hasItems = items.fields.length > 0;
  const chosenServiceIds = items.fields.map((item) => item.service_id);

  const values = useWatch({ control: form.control }) as LabOrderFormValues;
  const watchedItems = React.useMemo(() => values.items ?? [], [values.items]);

  // Categorías de los servicios elegidos: con una sola, los laboratorios aparecen filtrados por ella.
  const labCategoryIds = React.useMemo(
    () => Array.from(new Set(watchedItems.map((item) => item.lab_category_id).filter((id): id is string => !!id))),
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
    const initial = toFormValues(order, patient, draft);
    form.reset(initial);
    const progress = initialProgress(initial, Boolean(order), Boolean(draft?.startAtReview));
    setStep(progress.step);
    setVisited(new Set(progress.visited));
    setSubmissionError(null);
    setPendingFiles([]);
    setLabCleared(false);
    // Solo al abrir: un refetch de la orden mientras se edita no debe pisar lo escrito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Alta sin doctor: si quien la crea es doctor, la orden es suya (se puede cambiar).
  const { user } = useAuth();
  const userId = user?.id != null ? String(user.id) : '';
  React.useEffect(() => {
    if (!open || isEdit || !userId || form.getValues('doctor_id')) return;
    let active = true;
    fetchDoctors().then((doctors) => {
      const me = doctors.find((d) => d.id === userId);
      if (!active || !me || form.getValues('doctor_id')) return;
      form.setValue('doctor_id', me.id);
      form.setValue('doctor_name', me.name);
    });
    return () => { active = false; };
  }, [open, isEdit, userId, form]);

  // Alta: a qué etapa la llevaría "Crear y enviar". Sin respuesta, la opción no aparece.
  React.useEffect(() => {
    if (!open || isEdit) return;
    let active = true;
    fetchLabStages({ timeoutMs: REQUEST_TIMEOUT_MS.mutation })
      .then((list) => {
        const activeStages = list.filter((s) => s.is_active);
        const initial = activeStages.find((s) => s.kind === 'initial');
        const next = initial ? nextLabStage(activeStages, initial.id) : null;
        if (active) setStages(initial && next && next.kind === 'intermediate' ? { initial, send: next } : null);
      })
      .catch(() => { if (active) setStages(null); });
    return () => { active = false; };
  }, [open, isEdit]);

  const stepValid = React.useCallback((s: WizardStep): boolean => {
    if (s === 'patient') return !!values.patient_id;
    if (s === 'work') return watchedItems.length > 0 || !!values.work_description?.trim();
    return s === 'laboratory';
  }, [values.patient_id, values.work_description, watchedItems.length]);
  const isDone = (s: WizardStep) => visited.has(s) && stepValid(s);

  const sending = !isEdit && !!stages && values.send;

  /** Lo que falta para poder crear (o enviar), en palabras. */
  const missing = [
    !values.patient_id && t('wizard.missingItems.patient'),
    !stepValid('work') && t('wizard.missingItems.work'),
    sending && !values.laboratory_id && t('wizard.missingItems.laboratory'),
    sending && !values.send_due_date && t('wizard.missingItems.dueDate'),
  ].filter((m): m is string => !!m);

  const stepIndex = STEPS.indexOf(step);
  const nextTarget: WizardStep = isEdit ? 'review' : STEPS[Math.min(stepIndex + 1, STEPS.length - 1)];

  /** Ir a otro paso. Hacia adelante se valida el actual y no se saltean pasos sin completar. */
  const goTo = async (target: WizardStep) => {
    const to = STEPS.indexOf(target);
    if (to > stepIndex) {
      if (STEP_FIELDS[step].length > 0 && !(await form.trigger(STEP_FIELDS[step]))) return;
      const nextVisited = new Set(visited).add(step);
      setVisited(nextVisited);
      const blocked = STEPS.slice(0, to).some((s) => s !== step && !(nextVisited.has(s) && stepValid(s)));
      if (blocked) return;
    }
    setSubmissionError(null);
    setStep(target);
  };

  const saveOrder = (formValues: LabOrderFormValues) => saveLabOrder({
    ...(order ? { id: order.id } : {}),
    patient_id: formValues.patient_id,
    doctor_id: formValues.doctor_id || null,
    laboratory_id: formValues.laboratory_id || null,
    work_description: formValues.work_description.trim() || null,
    // Con servicios, el backend calcula las piezas de la orden (unión de las de cada servicio).
    teeth: formValues.items.length > 0 ? [] : parseTeeth(formValues.teeth) ?? [],
    // Sin la clave el backend deja la fecha guardada (alta u orden todavía no enviada).
    ...(dueMode !== 'hidden' ? { due_date: formValues.due_date || null } : {}),
    notes: formValues.notes?.trim() || null,
    is_urgent: formValues.is_urgent,
    items: formValues.items.map((item) => ({
      service_id: Number(item.service_id),
      quantity: item.quantity,
      teeth: parseTeeth(item.teeth) ?? [],
      notes: item.notes?.trim() || null,
    })),
  }, { timeoutMs: REQUEST_TIMEOUT_MS.mutation });

  const save = useAsyncAction(
    async (formValues: LabOrderFormValues) => {
      let saved = await saveOrder(formValues);
      if (isEdit) return saved;
      // La orden ya existe: si los archivos o el envío fallan no se pierde el alta, se avisa
      // y se termina desde el detalle.
      if (pendingFiles.length > 0) {
        try {
          const attachments = await uploadLabOrderAttachments(saved.id, pendingFiles, { timeoutMs: REQUEST_TIMEOUT_MS.longRunning });
          saved = { ...saved, attachments_count: attachments.length };
        } catch (error) {
          toast({ variant: 'destructive', title: t('attachments.createdWithoutFilesTitle'), description: t('attachments.createdWithoutFiles', { id: saved.id }) });
          console.error('Lab order attachments upload failed:', error);
        }
      }
      if (formValues.send && stages) {
        try {
          const sent = await changeLabOrderStage(saved.id, stages.send.id, saved.current_stage_id, { timeoutMs: REQUEST_TIMEOUT_MS.mutation }, {
            laboratoryId: formValues.laboratory_id || null,
            dueDate: formValues.send_due_date || null,
          });
          saved = { ...sent, attachments_count: saved.attachments_count };
        } catch (error) {
          toast({
            variant: 'destructive',
            title: t('wizard.sendFailedTitle'),
            description: t('wizard.sendFailed', { id: saved.id, error: errorText(error) }),
          });
          console.error('Lab order send after create failed:', error);
        }
      }
      return saved;
    },
    {
      onSuccess: async (saved) => {
        await onSaved(saved);
        onOpenChange(false);
      },
      onError: (error) => {
        const message = isTimeoutError(error) ? t('form.timeoutMaybeSaved') : errorText(error);
        setSubmissionError(message);
        onSubmitFailed?.(message);
      },
      showErrorToast: false,
    },
  );

  // Un error de un paso anterior (no debería pasar, pero los datos pueden cambiar) lleva a ese paso.
  const onInvalid = (errors: Record<string, unknown>) => {
    onSubmitFailed?.(null);
    const first = Object.keys(errors)[0];
    if (first) {
      const target = stepOfField(first);
      if (target !== 'review') setStep(target);
    }
  };

  // "Sí" por voz: el mismo envío que el botón Crear (con su validación).
  const lastSignalRef = React.useRef(submitSignal);
  React.useEffect(() => {
    if (submitSignal === lastSignalRef.current) return;
    lastSignalRef.current = submitSignal;
    if (!open || save.isPending) return;
    setStep('review');
    void form.handleSubmit(save.run, onInvalid)();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitSignal]);

  // Voz: leer el alta como está ahora y aplicarle correcciones (siempre con el estado del último render).
  const draftControlRef = React.useRef<LabOrderDraftControl | null>(null);
  const draftControl: LabOrderDraftControl = {
    read: () => {
      const v = form.getValues();
      return {
        patient: v.patient_id ? { id: v.patient_id, name: v.patient_name ?? '' } : null,
        doctor: v.doctor_id ? { id: v.doctor_id, name: v.doctor_name ?? '' } : null,
        laboratory: v.laboratory_id ? { id: v.laboratory_id, name: v.laboratory_name ?? '' } : null,
        items: v.items.map((item) => ({
          service_id: item.service_id,
          service_name: item.service_name,
          quantity: Number(item.quantity) || 1,
          teeth: parseTeeth(item.teeth) ?? [],
          lab_category_id: item.lab_category_id ?? null,
        })),
        work_description: v.work_description,
        teeth: v.items.length > 0 ? [] : parseTeeth(v.teeth) ?? [],
        is_urgent: v.is_urgent,
        notes: v.notes ?? '',
        // Sin etapa a la que enviar, "Crear y enviar" no existe.
        send: Boolean(stages) && v.send,
        send_due_date: v.send_due_date ?? '',
      };
    },
    apply: (patch) => {
      const opts = { shouldDirty: true, shouldValidate: false };
      if (patch.patient !== undefined) {
        form.setValue('patient_id', patch.patient?.id ?? '', opts);
        form.setValue('patient_name', patch.patient?.name ?? '', opts);
      }
      if (patch.items !== undefined) {
        // Las notas de cada trabajo (escritas a mano) se conservan.
        const before = form.getValues('items');
        items.replace(patch.items.map((item) => ({
          service_id: String(item.service_id),
          service_name: item.service_name,
          quantity: Math.min(99, Math.max(1, Math.round(item.quantity) || 1)),
          teeth: item.teeth.join(', '),
          notes: before.find((b) => b.service_id === String(item.service_id))?.notes ?? '',
          lab_category_id: item.lab_category_id ?? null,
        })));
      }
      if (patch.teeth !== undefined) form.setValue('teeth', patch.teeth.join(', '), opts);
      if (patch.work_description !== undefined) form.setValue('work_description', patch.work_description, opts);
      if (patch.laboratory !== undefined) {
        form.setValue('laboratory_id', patch.laboratory?.id ?? '', opts);
        form.setValue('laboratory_name', patch.laboratory?.name ?? '', opts);
        if (!patch.laboratory) setLabCleared(true);
      }
      if (patch.is_urgent !== undefined) form.setValue('is_urgent', patch.is_urgent, opts);
      if (patch.notes !== undefined) form.setValue('notes', patch.notes, opts);
      if (patch.send !== undefined) form.setValue('send', patch.send, opts);
      if (patch.send_due_date !== undefined) form.setValue('send_due_date', patch.send_due_date, opts);
      form.clearErrors();
      setSubmissionError(null);
      setStep('review');
    },
    subscribe: (listener) => form.subscribe({ formState: { values: true }, callback: () => listener() }),
  };
  React.useEffect(() => {
    draftControlRef.current = draftControl;
  });
  React.useEffect(() => {
    if (!open || isEdit || !voiceControl) return;
    voiceControl({
      read: () => draftControlRef.current!.read(),
      apply: (patch) => draftControlRef.current!.apply(patch),
      subscribe: (listener) => draftControlRef.current!.subscribe(listener),
    });
    return () => voiceControl(null);
  }, [open, isEdit, voiceControl]);

  const submitLabel = isEdit ? t('form.saveChanges') : sending ? t('wizard.createAndSend') : t('form.create');

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && save.isPending) return; onOpenChange(next); }}>
      <DialogContent maxWidth="3xl" confirmOnClose isDirty={form.formState.isDirty || pendingFiles.length > 0}>
        <DialogHeader>
          <DialogTitle>{isEdit ? t('form.editTitle', { id: order!.id }) : t('form.createTitle')}</DialogTitle>
          {!isEdit && <DialogDescription>{description ?? t('form.createDescription')}</DialogDescription>}
        </DialogHeader>

        <div className="shrink-0 space-y-1.5 border-b border-border px-6 py-2.5">
          <nav aria-label={t('wizard.stepsLabel')} data-help-id="lab-orders.section.wizard-steps" className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none]">
            {STEPS.map((s, i) => {
              const isOn = s === step;
              const done = isDone(s) && !isOn;
              return (
                <React.Fragment key={s}>
                  {i > 0 && <span className="h-px w-3 shrink-0 bg-border sm:w-5" aria-hidden />}
                  <button
                    type="button"
                    data-help-id={`lab-orders.btn.step-${s}`}
                    onClick={() => void goTo(s)}
                    disabled={save.isPending}
                    aria-current={isOn ? 'step' : undefined}
                    className={cn(
                      'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full py-1 pl-1 pr-2.5 text-xs font-medium transition-colors sm:text-[13px]',
                      isOn ? 'bg-primary/10 text-primary dark:text-foreground' : 'text-muted-foreground hover:bg-muted',
                    )}
                  >
                    <span
                      className={cn(
                        'grid h-5 w-5 place-items-center rounded-full border text-[11px] font-semibold',
                        isOn ? 'border-primary bg-primary text-primary-foreground'
                          : done ? 'border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-muted',
                      )}
                    >
                      {done ? <Check className="h-3 w-3" /> : i + 1}
                    </span>
                    <span className={cn(!isOn && 'max-sm:hidden')}>{t(`wizard.steps.${s}`)}</span>
                  </button>
                </React.Fragment>
              );
            })}
          </nav>
          <p className={cn('text-xs', missing.length > 0 ? 'text-muted-foreground' : 'text-emerald-700 dark:text-emerald-400')} aria-live="polite">
            {missing.length > 0
              ? t('wizard.missing', { items: missing.join(', ') })
              : isEdit ? t('wizard.readyEdit') : sending ? t('wizard.readySend', { stage: stages!.send.name }) : t('wizard.ready')}
          </p>
        </div>

        <Form {...form}>
          <form
            onSubmit={(event) => {
              // Enter en un campo de un paso intermedio avanza en vez de guardar.
              if (step !== 'review') {
                event.preventDefault();
                void goTo(nextTarget);
                return;
              }
              void form.handleSubmit(save.run, onInvalid)(event);
            }}
            onKeyDown={(event) => {
              // Sin botón submit en los pasos intermedios y con 2+ campos, el navegador no envía
              // el formulario con Enter: se avanza a mano. Solo campos de este formulario (los
              // buscadores de los selectores están en un portal y también burbujean acá).
              if (event.key !== 'Enter' || step === 'review' || event.nativeEvent.isComposing) return;
              const target = event.target;
              if (!(target instanceof HTMLInputElement) || !event.currentTarget.contains(target)) return;
              event.preventDefault();
              void goTo(nextTarget);
            }}
            className="flex min-h-0 flex-1 flex-col"
          >
            <DialogBody className="px-6 py-4">
              <div className={cn('grid gap-6', step !== 'review' && 'lg:grid-cols-[minmax(0,1fr)_14rem]')}>
                <div className="min-w-0 space-y-4 sm:min-h-[20rem]">
                  {step === 'patient' && (
                    <>
                      <StepHeading title={t('wizard.patientTitle')} hint={t('wizard.patientHint')} />
                      <FormField control={form.control} name="patient_id" render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>{t('form.patient')}</FormLabel>
                          <FormControl>
                            <UserSelector
                              filterType="PACIENTE"
                              value={field.value}
                              selectedUserName={values.patient_name}
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
                      <FormField control={form.control} name="doctor_id" render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>{t('form.doctor')}</FormLabel>
                          <FormControl>
                            <DoctorSelector
                              value={field.value}
                              selectedDoctorName={values.doctor_name}
                              onValueChange={(id, doctor) => {
                                field.onChange(id);
                                form.setValue('doctor_name', doctor?.name ?? '');
                              }}
                              placeholder={t('form.searchDoctor')}
                              triggerText={t('form.selectDoctor')}
                              disabled={doctorLocked || save.isPending}
                            />
                          </FormControl>
                          <FormDescription>{t('wizard.doctorHint')}</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </>
                  )}

                  {step === 'work' && (
                    <>
                      <StepHeading title={t('wizard.workTitle')} hint={t('form.servicesHint')} />
                      <section data-help-id="lab-orders.section.services" className="space-y-2">
                        {items.fields.map((item, index) => (
                          <div key={item.id} className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
                            <div className="flex items-start justify-between gap-2">
                              <p className="min-w-0 flex-1 break-words pt-1 text-sm font-medium">{item.service_name}</p>
                              {/* Cantidad compacta junto al nombre: casi siempre es 1. No se calcula de
                                  las piezas porque un puente de 3 piezas es 1 trabajo, no 3. */}
                              <FormField control={form.control} name={`items.${index}.quantity`} render={({ field }) => (
                                <FormItem className="space-y-0">
                                  <div className="flex items-center rounded-md border border-border bg-background">
                                    <button
                                      type="button"
                                      className="grid h-7 w-7 place-items-center text-muted-foreground hover:text-foreground disabled:opacity-40"
                                      aria-label={t('form.quantityLess')}
                                      disabled={save.isPending || Number(field.value) <= 1}
                                      onClick={() => field.onChange(Math.max(1, Number(field.value) - 1))}
                                    >
                                      <Minus className="h-3 w-3" />
                                    </button>
                                    <FormControl>
                                      <Input
                                        {...field}
                                        type="number"
                                        min={1}
                                        max={99}
                                        inputMode="numeric"
                                        aria-label={t('form.quantity')}
                                        className="h-7 w-9 border-0 px-0 text-center text-sm shadow-none [appearance:textfield] focus-visible:ring-0 [&::-webkit-inner-spin-button]:appearance-none"
                                        disabled={save.isPending}
                                      />
                                    </FormControl>
                                    <button
                                      type="button"
                                      className="grid h-7 w-7 place-items-center text-muted-foreground hover:text-foreground disabled:opacity-40"
                                      aria-label={t('form.quantityMore')}
                                      disabled={save.isPending || Number(field.value) >= 99}
                                      onClick={() => field.onChange(Math.min(99, Number(field.value) + 1))}
                                    >
                                      <Plus className="h-3 w-3" />
                                    </button>
                                  </div>
                                  <FormMessage />
                                </FormItem>
                              )} />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                data-help-id="lab-orders.btn.remove-service"
                                className="-mr-1 h-7 w-7 shrink-0 hover:bg-destructive/10 hover:text-destructive"
                                aria-label={t('form.removeService', { name: item.service_name })}
                                onClick={() => items.remove(index)}
                                disabled={save.isPending}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                              <FormField control={form.control} name={`items.${index}.teeth`} render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs">{t('form.teeth')}</FormLabel>
                                  <div className="flex gap-1.5">
                                    <FormControl>
                                      <Input {...field} inputMode="numeric" className="h-9" placeholder={t('form.teethPlaceholder')} disabled={save.isPending} />
                                    </FormControl>
                                    <LabTeethPicker
                                      value={field.value}
                                      onChange={(next) => form.setValue(`items.${index}.teeth`, next, { shouldDirty: true, shouldValidate: true })}
                                      disabled={save.isPending}
                                    />
                                  </div>
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

                      {/* Con servicios, lo extra va en Notas (Revisar): la descripción solo se ve si
                          ya tenía algo. Sin servicios es la forma de describir el trabajo. */}
                      {(!hasItems || !!values.work_description?.trim()) && (
                      <FormField control={form.control} name="work_description" render={({ field }) => (
                        <FormItem>
                          <FormLabel>{hasItems ? t('form.workOptional') : t('wizard.workAlternative')}</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              onChange={(event) => {
                                field.onChange(event);
                                // "Agregá un servicio o describí el trabajo" se va apenas hay descripción.
                                if (event.target.value.trim()) form.clearErrors('work_description');
                              }}
                              maxLength={500}
                              placeholder={t('form.workPlaceholder')}
                              disabled={save.isPending}
                            />
                          </FormControl>
                          {!hasItems && <FormDescription>{t('form.workHint')}</FormDescription>}
                          <FormMessage />
                        </FormItem>
                      )} />
                      )}

                      {!hasItems && (
                        <FormField control={form.control} name="teeth" render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('form.teeth')}</FormLabel>
                            <div className="flex gap-1.5">
                              <FormControl>
                                <Input {...field} inputMode="numeric" placeholder={t('form.teethPlaceholder')} disabled={save.isPending} />
                              </FormControl>
                              <LabTeethPicker
                                value={field.value}
                                onChange={(next) => form.setValue('teeth', next, { shouldDirty: true, shouldValidate: true })}
                                disabled={save.isPending}
                              />
                            </div>
                            <FormDescription>{t('form.teethHint')}</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )} />
                      )}
                    </>
                  )}

                  {step === 'laboratory' && (
                    <>
                      <StepHeading title={t('wizard.labTitle')} hint={t('wizard.labHint')} />
                      <FormField control={form.control} name="laboratory_id" render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>{t('form.laboratory')}</FormLabel>
                          <FormControl>
                            <LabSelector
                              value={field.value}
                              selectedName={values.laboratory_name}
                              categoryIds={labCategoryIds}
                              clearable
                              onValueChange={(id, lab) => {
                                field.onChange(id);
                                form.setValue('laboratory_name', lab?.name ?? '', { shouldDirty: true });
                                if (!id) setLabCleared(true);
                              }}
                              triggerText={t('form.selectLaboratory')}
                              disabled={save.isPending}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <LabSuggestions
                        categoryIds={labCategoryIds}
                        value={values.laboratory_id ?? ''}
                        disabled={save.isPending}
                        autoPickSingle={!isEdit && !labCleared}
                        onPick={(lab) => {
                          form.setValue('laboratory_id', lab.id, { shouldDirty: true });
                          form.setValue('laboratory_name', lab.name, { shouldDirty: true });
                        }}
                      />
                      {!values.laboratory_id && !isEdit && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          data-help-id="lab-orders.btn.lab-later"
                          className="text-muted-foreground"
                          onClick={() => void goTo('review')}
                          disabled={save.isPending}
                        >
                          {t('wizard.labLater')}
                        </Button>
                      )}
                    </>
                  )}

                  {step === 'review' && (
                    <>
                      <StepHeading title={t('wizard.reviewTitle')} hint={isEdit ? t('wizard.reviewHintEdit') : t('wizard.reviewHint')} />
                      <div data-help-id="lab-orders.section.review" className="divide-y divide-border rounded-lg border border-border">
                        <ReviewRow label={t('wizard.steps.patient')} onEdit={() => void goTo('patient')} editLabel={t('wizard.edit')} disabled={save.isPending}>
                          <p className="font-medium">{values.patient_name || '—'}</p>
                          {values.doctor_name && <p className="text-xs text-muted-foreground">{values.doctor_name}</p>}
                        </ReviewRow>
                        <ReviewRow label={t('wizard.steps.work')} onEdit={() => void goTo('work')} editLabel={t('wizard.edit')} disabled={save.isPending}>
                          <WorkSummary items={watchedItems} description={values.work_description} teeth={values.teeth} />
                        </ReviewRow>
                        <ReviewRow label={t('wizard.steps.laboratory')} onEdit={() => void goTo('laboratory')} editLabel={t('wizard.edit')} disabled={save.isPending}>
                          {values.laboratory_name
                            ? <p className="font-medium">{values.laboratory_name}</p>
                            : <p className="text-muted-foreground">{t('wizard.labPending')}</p>}
                        </ReviewRow>
                      </div>

                      {dueMode !== 'hidden' && (
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
                      )}

                      {!isEdit && stages && (
                        <FormField control={form.control} name="send" render={({ field }) => (
                          <FormItem data-help-id="lab-orders.section.send-choice" className="space-y-2">
                            <FormLabel>{t('wizard.sendTitle')}</FormLabel>
                            <FormControl>
                              <RadioGroup
                                value={field.value ? 'send' : 'keep'}
                                onValueChange={(next) => {
                                  field.onChange(next === 'send');
                                  form.clearErrors(['send', 'send_due_date']);
                                }}
                                disabled={save.isPending}
                                className="gap-2"
                              >
                                <SendOption value="keep" checked={!field.value} title={t('wizard.keepOption')} hint={t('wizard.keepHint')} stage={stages.initial} />
                                <SendOption value="send" checked={field.value} title={t('wizard.sendOption')} hint={t('wizard.sendHint')} stage={stages.send} />
                              </RadioGroup>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      )}

                      {sending && (
                        <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
                          {!values.laboratory_id && (
                            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                              <span className="text-destructive">{t('wizard.validation.sendLab')}</span>
                              <Button type="button" size="sm" variant="outline" onClick={() => void goTo('laboratory')} disabled={save.isPending}>
                                {t('wizard.chooseLab')}
                              </Button>
                            </div>
                          )}
                          <FormField control={form.control} name="send_due_date" render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('form.dueDate')}</FormLabel>
                              <FormControl>
                                <DatePickerInput value={field.value} onChange={field.onChange} disabled={save.isPending} />
                              </FormControl>
                              <FormDescription>{t('wizard.sendDueDateHint')}</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )} />
                        </div>
                      )}

                      <FormField control={form.control} name="notes" render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('form.notes')}</FormLabel>
                          <FormControl>
                            <Textarea {...field} rows={2} maxLength={2000} placeholder={t('form.notesPlaceholder')} disabled={save.isPending} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />

                      {/* Adjuntos y urgente, lado a lado: son opcionales y no deberían alargar el paso. */}
                      <div className={cn('grid gap-3', !isEdit && 'sm:grid-cols-2 sm:items-start')}>
                      {!isEdit && (
                        <LabOrderAttachmentPicker files={pendingFiles} onChange={setPendingFiles} disabled={save.isPending} compact />
                      )}

                      <FormField control={form.control} name="is_urgent" render={({ field }) => (
                        <FormItem
                          className={cn(
                            'flex flex-row items-center justify-between gap-3 space-y-0 rounded-lg border p-3 transition-colors sm:mt-6',
                            field.value ? 'border-destructive/50 bg-destructive/5' : 'border-border',
                          )}
                        >
                          <div className="min-w-0 space-y-0.5">
                            <FormLabel className="flex items-center gap-1.5">
                              <Zap className={cn('h-4 w-4', field.value ? 'fill-current text-destructive' : 'text-muted-foreground')} aria-hidden="true" />
                              {t('form.urgent')}
                            </FormLabel>
                            <FormDescription className="text-xs">{t('form.urgentHint')}</FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              data-help-id="lab-orders.toggle.urgent"
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              disabled={save.isPending}
                            />
                          </FormControl>
                        </FormItem>
                      )} />
                      </div>

                      {submissionError && (
                        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                          {submissionError}
                        </p>
                      )}
                    </>
                  )}
                </div>

                {step !== 'review' && (
                  <aside data-help-id="lab-orders.section.wizard-summary" className="hidden h-fit space-y-3 rounded-lg border border-border bg-muted/30 p-3 text-sm lg:block">
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t('wizard.summaryTitle')}</h3>
                    <SummaryItem label={t('form.patient')}>{values.patient_name || '—'}</SummaryItem>
                    <SummaryItem label={t('form.doctor')}>{values.doctor_name || '—'}</SummaryItem>
                    <SummaryItem label={t('columns.work')}>
                      <WorkSummary items={watchedItems} description={values.work_description} teeth={values.teeth} compact />
                    </SummaryItem>
                    <SummaryItem label={t('form.laboratory')}>{values.laboratory_name || '—'}</SummaryItem>
                    {values.is_urgent && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
                        <Zap className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                        {t('form.urgent')}
                      </span>
                    )}
                  </aside>
                )}
              </div>
            </DialogBody>
            <DialogFooter className="gap-2">
              <DialogCancelButton disabled={save.isPending}>{t('form.cancel')}</DialogCancelButton>
              {stepIndex > 0 && (
                <Button type="button" variant="outline" onClick={() => void goTo(STEPS[stepIndex - 1])} disabled={save.isPending} className="gap-1">
                  <ArrowLeft className="h-4 w-4" />
                  {t('wizard.back')}
                </Button>
              )}
              {/* Keys distintas: si React reutilizara el mismo <button> y le cambiara el type a
                  submit durante el clic de "Continuar", el navegador enviaría el formulario. */}
              {step !== 'review' ? (
                <Button key="next" type="button" data-help-id="lab-orders.btn.step-next" onClick={() => void goTo(nextTarget)} className="gap-1">
                  {isEdit ? t('wizard.backToReview') : t('wizard.continue')}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button key="submit" type="submit" loading={save.isPending} className="gap-1.5">
                  {sending && <Send className="h-4 w-4" />}
                  {submitLabel}
                </Button>
              )}
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function StepHeading({ title, hint }: { title: string; hint: string }) {
  return (
    <div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}

function SummaryItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="break-words">{children}</div>
    </div>
  );
}

function ReviewRow({ label, onEdit, editLabel, disabled, children }: {
  label: string;
  onEdit: () => void;
  editLabel: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 px-3 py-2.5 text-sm">
      <span className="w-24 shrink-0 text-xs font-medium text-muted-foreground">{label}</span>
      <div className="min-w-0 flex-1 break-words">{children}</div>
      <Button type="button" variant="ghost" size="sm" className="-my-1 h-7 shrink-0 gap-1 px-2 text-xs" onClick={onEdit} disabled={disabled}>
        <Pencil className="h-3 w-3" />
        {editLabel}
      </Button>
    </div>
  );
}

/** Servicios ("Corona ×2 · Piezas 11, 21") o, sin ellos, la descripción y sus piezas. */
function WorkSummary({ items, description, teeth, compact = false }: {
  items: LabOrderFormValues['items'];
  description?: string;
  teeth?: string;
  compact?: boolean;
}) {
  const t = useTranslations('LabOrdersPage');
  if (items.length === 0 && !description?.trim()) return <span className="text-muted-foreground">—</span>;
  return (
    <ul className={cn('space-y-0.5', compact && 'text-[13px]')}>
      {items.map((item) => (
        <li key={item.service_id}>
          <span className="font-medium">{item.service_name}</span>
          {Number(item.quantity) > 1 && <span className="text-muted-foreground"> ×{item.quantity}</span>}
          {item.teeth?.trim() && <span className="block text-xs text-muted-foreground">{t('teethShort', { teeth: item.teeth })}</span>}
        </li>
      ))}
      {description?.trim() && (
        <li className={cn(items.length > 0 && 'text-muted-foreground')}>
          {description}
          {items.length === 0 && teeth?.trim() && <span className="block text-xs text-muted-foreground">{t('teethShort', { teeth })}</span>}
        </li>
      )}
    </ul>
  );
}

function SendOption({ value, checked, title, hint, stage }: { value: string; checked: boolean; title: string; hint: string; stage: LabStage }) {
  const id = `lab-order-send-${value}`;
  return (
    <label
      htmlFor={id}
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
        checked ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50',
      )}
    >
      <RadioGroupItem id={id} value={value} className="mt-0.5" />
      <span className="min-w-0 space-y-1">
        <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
          {title}
          <LabStageBadge name={stage.name} color={stage.color} />
        </span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </label>
  );
}

/**
 * Laboratorios para elegir con un toque: los de la categoría de los servicios (si es una sola)
 * o los primeros de la lista. El selector de arriba queda para buscar o dar de alta otro.
 */
function LabSuggestions({ categoryIds, value, onPick, disabled, autoPickSingle = false }: {
  categoryIds: string[];
  value: string;
  onPick: (lab: Laboratory) => void;
  disabled?: boolean;
  /** Si hay uno solo posible y no hay ninguno elegido, se elige solo (se puede quitar). */
  autoPickSingle?: boolean;
}) {
  const t = useTranslations('LabOrdersPage');
  const categoryId = categoryIds.length === 1 ? categoryIds[0] : null;
  const [labs, setLabs] = React.useState<Laboratory[] | null>(null);

  React.useEffect(() => {
    const controller = new AbortController();
    setLabs(null);
    searchLaboratories({ categoryId, limit: 6 }, { signal: controller.signal, timeoutMs: REQUEST_TIMEOUT_MS.mutation })
      .then(setLabs)
      .catch(() => { if (!controller.signal.aborted) setLabs([]); });
    return () => controller.abort();
  }, [categoryId]);

  React.useEffect(() => {
    if (autoPickSingle && !value && labs?.length === 1) onPick(labs[0]);
    // onPick cambia en cada render; alcanza con reaccionar a la lista y a lo elegido.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labs, value, autoPickSingle]);

  const categoryName = categoryId
    ? labs?.flatMap((lab) => lab.categories).find((c) => c.id === categoryId)?.name
    : null;

  return (
    <section data-help-id="lab-orders.section.lab-suggestions" className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">
        {categoryName ? t('wizard.labSuggestedFor', { category: categoryName }) : t('wizard.labSuggested')}
      </p>
      {labs === null ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : labs.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('wizard.labNone')}</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {labs.map((lab) => {
            const selected = lab.id === value;
            return (
              <button
                key={lab.id}
                type="button"
                onClick={() => onPick(lab)}
                disabled={disabled}
                aria-pressed={selected}
                className={cn(
                  'flex min-w-0 items-start gap-2.5 rounded-lg border p-3 text-left transition-colors disabled:opacity-60',
                  selected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:bg-muted/50',
                )}
              >
                <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-full', selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                  {selected ? <Check className="h-4 w-4" /> : <FlaskConical className="h-4 w-4" />}
                </span>
                <span className="min-w-0 space-y-0.5">
                  <span className="block truncate text-sm font-medium">{lab.name}</span>
                  {lab.categories.length > 0 && (
                    <span className="block truncate text-xs text-muted-foreground">{lab.categories.map((c) => c.name).join(', ')}</span>
                  )}
                  {lab.phone_number && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Phone className="h-3 w-3" aria-hidden="true" />
                      {formatPhoneNumber(lab.phone_number)}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
