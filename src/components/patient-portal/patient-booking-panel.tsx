'use client';

import { addDays, format, isSameDay, startOfDay } from 'date-fns';
import {
  ArrowLeft,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  MapPin,
  Receipt,
  Sparkles,
  Stethoscope,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';

import { ServicePicker } from '@/components/patient-portal/service-picker';
import { WizardStepper, type WizardStep } from '@/components/patient-portal/wizard-stepper';

import { useToast } from '@/hooks/use-toast';
import { formatMoney } from '@/lib/currency';
import type { Appointment, BookableService, ClinicSchedule, User } from '@/lib/types';
import { getDateFnsLocale } from '@/lib/locale';
import { cn } from '@/lib/utils';
import {
  createPatientAppointment,
  fetchBookingSedes,
  fetchPatientDaySlots,
  notifyAppointmentChange,
  reschedulePatientAppointment,
  PATIENT_SLOT_MINUTES,
  type BookingAuthMode,
  type BookingSede,
  type BookingSlot,
} from '@/services/patient-booking';
import {
  fetchBookableServices,
  totalServiceMinutes,
  totalServicePrice,
} from '@/services/patient-services';
import { fetchPublicClinicInfo, fetchPublicSedeSchedules } from '@/services/public-clinic';

/** Cuántos días hacia adelante puede elegir el paciente. */
const DAYS_AHEAD = 30;
/** Días visibles a la vez en la tira de fechas. */
const DAYS_PER_PAGE = 7;

/**
 * Pasos del wizard. `sede` se omite cuando la clínica tiene una sola, y
 * `services` sólo aparece si la clínica habilitó que el paciente elija.
 */
type BookingStep = 'sede' | 'services' | 'slot' | 'confirm';

interface PatientBookingPanelProps {
  patient: User;
  /** Recibe la fecha y hora confirmadas, para el mensaje final. */
  onBooked: (details: { date: string; time: string }) => void;
  /**
   * `'public'` ⇒ el paciente reserva desde la landing sin sesión: se usan los
   * endpoints `_noauth` y se dispara el email de confirmación.
   */
  authMode?: BookingAuthMode;
  /**
   * Presente ⇒ el panel reagenda: al confirmar crea la cita nueva y cancela
   * esta. Ausente ⇒ crea una cita nueva a secas.
   */
  rescheduleFrom?: Appointment | null;
  /** Se renderiza en el footer, junto a la acción principal. */
  secondaryAction?: React.ReactNode;
}

/**
 * Reserva de cita, como wizard de un paso a la vez.
 *
 * Cada paso muestra **sólo** lo que hay que decidir en ese momento —elegir sede
 * avanza a horarios, elegir horario avanza al resumen— para que la pantalla no
 * se llene de lo ya resuelto. Siempre se puede volver atrás.
 *
 * A diferencia de la agenda del staff, acá no se muestran las citas: sólo la
 * disponibilidad. Los horarios ocupados se ven tachados, para que el paciente
 * entienda que el hueco existe pero está tomado.
 */
export function PatientBookingPanel({
  patient,
  onBooked,
  authMode = 'session',
  rescheduleFrom,
  secondaryAction,
}: PatientBookingPanelProps) {
  const t = useTranslations('PatientPortal.booking');
  const locale = useLocale();
  const dateLocale = getDateFnsLocale(locale);
  const { toast } = useToast();

  const today = React.useMemo(() => startOfDay(new Date()), []);

  const [schedules, setSchedules] = React.useState<ClinicSchedule[]>([]);
  const [sedes, setSedes] = React.useState<BookingSede[]>([]);
  const [selectedSedeId, setSelectedSedeId] = React.useState<string>('');
  const [isLoadingSetup, setIsLoadingSetup] = React.useState(true);
  const [step, setStep] = React.useState<BookingStep>('sede');
  /** Configuración de servicios de la clínica, resuelta en el arranque. */
  const [serviceSelectionEnabled, setServiceSelectionEnabled] = React.useState(false);
  const [showPricing, setShowPricing] = React.useState(false);
  const [defaultService, setDefaultService] = React.useState<BookableService | null>(null);
  const [services, setServices] = React.useState<BookableService[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = React.useState<string[]>([]);
  const [servicesFailed, setServicesFailed] = React.useState(false);
  const [pageStart, setPageStart] = React.useState(0);
  const [selectedDate, setSelectedDate] = React.useState<Date>(today);
  const [slots, setSlots] = React.useState<BookingSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = React.useState<BookingSlot | null>(null);
  const [reason, setReason] = React.useState('');
  const [isLoadingSlots, setIsLoadingSlots] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoadingSetup(true);
      // Sedes, configuración y catálogo se piden en paralelo: son tres fuentes
      // independientes y encadenarlas sólo alargaría la pantalla en blanco.
      const [fetchedSedes, clinic] = await Promise.all([
        fetchBookingSedes(authMode),
        fetchPublicClinicInfo(),
      ]);
      if (cancelled) return;

      const selectionEnabled = clinic?.service_selection_enabled === true;
      setSedes(fetchedSedes);
      setServiceSelectionEnabled(selectionEnabled);
      setShowPricing(clinic?.show_pricing === true);
      setDefaultService(clinic?.default_service ?? null);

      // El catálogo se pide siempre que la clínica habilitó elegir, también al
      // reagendar: mover una cita es la ocasión típica para corregir lo que se
      // va a hacer en ella.
      const offersChoice = selectionEnabled;
      let fetchedServices: BookableService[] = [];
      let failed = false;
      if (offersChoice) {
        const result = await fetchBookableServices();
        if (cancelled) return;
        // `null` ⇒ falló la carga: se ofrece reintentar. `[]` ⇒ la clínica no
        // publicó ninguno, y entonces el paso simplemente no aparece.
        failed = result === null;
        fetchedServices = result ?? [];

        // Al reagendar se arranca con los servicios que la cita ya tenía, para
        // que no tocar nada signifique conservarlos. Los que no estén en el
        // catálogo agendable —los pudo haber puesto recepción— se agregan a la
        // lista igual: si no, desaparecerían del resumen sin que nadie lo pida.
        const previous = rescheduleFrom?.services ?? [];
        if (previous.length > 0) {
          const known = new Set(fetchedServices.map((sv) => sv.id));
          const carried = previous
            .filter((sv) => !known.has(String(sv.id)))
            .map((sv) => ({
              id: String(sv.id),
              name: sv.name,
              duration_minutes: sv.duration_minutes || 0,
            }));
          fetchedServices = [...fetchedServices, ...carried].sort((a, b) => a.name.localeCompare(b.name));
          setSelectedServiceIds(previous.map((sv) => String(sv.id)));
        }

        setServices(fetchedServices);
        setServicesFailed(failed);
      }

      // Con una sola sede (o ninguna) no se le pregunta nada. El paso de
      // servicios sólo tiene sentido si además hay algo que elegir.
      if (fetchedSedes.length === 1) setSelectedSedeId(fetchedSedes[0].id);
      const offersServices = offersChoice && (fetchedServices.length > 0 || failed);
      setStep(fetchedSedes.length > 1 ? 'sede' : offersServices ? 'services' : 'slot');
      setIsLoadingSetup(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [authMode, rescheduleFrom]);

  /**
   * La ventana de atención es **por sede**: cada una abre en horarios distintos,
   * así que la grilla de huecos tiene que armarse con los horarios de la sede
   * elegida y no con un horario global de la clínica.
   */
  React.useEffect(() => {
    if (!selectedSedeId) {
      setSchedules([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const fetched = await fetchPublicSedeSchedules(selectedSedeId);
      if (cancelled) return;
      setSchedules(
        fetched.map((s, index) => ({
          id: String(index),
          day_of_week: s.day_of_week,
          start_time: s.start_time,
          end_time: s.end_time,
        })),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedSedeId]);

  const hasSedeChoice = sedes.length > 1;
  const selectedSede = sedes.find((s) => s.id === selectedSedeId);

/** El paso de servicios se ofrece siempre que haya algo que elegir. */
  const hasServiceChoice = serviceSelectionEnabled && (services.length > 0 || servicesFailed);

  const selectedServices = React.useMemo(
    () => services.filter((s) => selectedServiceIds.includes(s.id)),
    [services, selectedServiceIds],
  );

  /**
   * Servicios con los que se crea la cita: los elegidos, o el que la clínica
   * configuró por defecto. El fallback se resuelve acá y no en la capa de
   * servicios para que el resumen que ve el paciente y lo que se manda al
   * backend sean literalmente el mismo dato.
   */
  const effectiveServices = React.useMemo<BookableService[]>(() => {
    if (selectedServices.length > 0) return selectedServices;
    // Al reagendar sin nada marcado se manda vacío y NO el servicio por
    // defecto: si el paciente desmarcó todo lo hizo a propósito, y meterle el
    // default cambiaría el motivo de una cita que ya existía.
    if (rescheduleFrom) return [];
    return defaultService ? [defaultService] : [];
  }, [rescheduleFrom, selectedServices, defaultService]);

  /**
   * Duración del hueco. **No** depende de `showPricing`: que el paciente no vea
   * los minutos no cambia el tiempo que la cita ocupa en la agenda.
   */
  const slotMinutes = totalServiceMinutes(effectiveServices, PATIENT_SLOT_MINUTES);

  const totalPrice = React.useMemo(() => totalServicePrice(effectiveServices), [effectiveServices]);

  const retryServices = React.useCallback(async () => {
    const result = await fetchBookableServices();
    setServices(result ?? []);
    setServicesFailed(result === null);
  }, []);

  /**
   * Marcar o desmarcar un servicio invalida el horario elegido: un hueco de 30
   * minutos no sirve para una cita de 90. Es mejor hacerlo volver a elegir que
   * crearle una cita que no entra.
   */
  const toggleService = React.useCallback((service: BookableService) => {
    setSelectedSlot(null);
    setSelectedServiceIds((prev) =>
      prev.includes(service.id) ? prev.filter((id) => id !== service.id) : [...prev, service.id],
    );
  }, []);

  const loadSlots = React.useCallback(
    async (day: Date, clinicSchedules: ClinicSchedule[], calendarIds: string[], minutes: number) => {
      setIsLoadingSlots(true);
      try {
        // `minutes` define el paso de la grilla Y el `durationInMinutes` con el
        // que el backend decide si el doctor está libre todo ese rato.
        setSlots(await fetchPatientDaySlots(day, clinicSchedules, minutes, calendarIds, authMode));
      } catch (error) {
        console.error('Failed to load slots:', error);
        setSlots([]);
        toast({ variant: 'destructive', title: t('loadError') });
      } finally {
        setIsLoadingSlots(false);
      }
    },
    [authMode, t, toast],
  );

  React.useEffect(() => {
    if (isLoadingSetup || step !== 'slot') return;
    loadSlots(selectedDate, schedules, selectedSede?.calendarIds ?? [], slotMinutes);
  }, [isLoadingSetup, step, selectedDate, schedules, selectedSede, slotMinutes, loadSlots]);

  const days = React.useMemo(
    () => Array.from({ length: DAYS_PER_PAGE }, (_, i) => addDays(today, pageStart + i)),
    [today, pageStart],
  );

  const availableCount = slots.filter((s) => s.isAvailable).length;

  const steps: WizardStep[] = React.useMemo(() => {
    const list: WizardStep[] = [];
    if (hasSedeChoice) list.push({ id: 'sede', label: t('steps.sede') });
    // Los servicios van ANTES de la fecha: de ellos depende cuánto dura la
    // cita, y por lo tanto qué huecos se pueden ofrecer.
    if (hasServiceChoice) list.push({ id: 'services', label: t('steps.services') });
    list.push({ id: 'slot', label: t('steps.slot') });
    list.push({ id: 'confirm', label: t('steps.confirm') });
    return list;
  }, [hasSedeChoice, hasServiceChoice, t]);

  const currentStepIndex = steps.findIndex((s) => s.id === step);

  /** Retrocede al paso anterior de los que realmente se están mostrando. */
  const goBack = () => {
    const previous = steps[currentStepIndex - 1];
    if (previous) setStep(previous.id as BookingStep);
  };

  const handleConfirm = async () => {
    if (!selectedSlot?.isAvailable) return;
    setIsSubmitting(true);
    try {
      const bookedDate = format(selectedDate, 'yyyy-MM-dd');
      const input = {
        patient,
        date: bookedDate,
        slot: selectedSlot,
        reason,
        authMode,
        services: effectiveServices,
        slotMinutes,
      };

      if (rescheduleFrom) {
        const result: any = await reschedulePatientAppointment({ ...input, previous: rescheduleFrom });
        if (result?.__previousStillActive) {
          toast({
            variant: 'destructive',
            title: t('rescheduledPartialTitle'),
            description: t('rescheduledPartialDescription'),
          });
          onBooked({ date: bookedDate, time: selectedSlot.time });
          return;
        }
        toast({ title: t('rescheduledTitle'), description: t('rescheduledDescription') });
      } else {
        const created: any = await createPatientAppointment(input);
        await notifyAppointmentChange({
          event: 'booked',
          appointmentId: created?.id ?? created?.appointment_id,
          patient,
          date: bookedDate,
          time: selectedSlot.time,
          doctorName: selectedSlot.doctorName,
          sedeName: selectedSede?.name || selectedSlot.calendarName,
          reason,
        });
        if (authMode !== 'public') {
          toast({ title: t('successTitle'), description: t('successDescription') });
        }
      }
      onBooked({ date: bookedDate, time: selectedSlot.time });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('errorTitle'),
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingSetup) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-none pb-4">
        {/* El "Volver" del wizard vive acá adentro, pegado al progreso; el del
            contenedor (empezar de cero) queda como enlace al pie. */}
        {currentStepIndex > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mb-2 -ml-2 h-8 gap-1.5 px-2 text-xs text-muted-foreground"
            onClick={goBack}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t('back')}
          </Button>
        )}
        {steps.length > 1 && <WizardStepper steps={steps} currentIndex={Math.max(0, currentStepIndex)} />}
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-0.5">
        {/* ── Paso: sede ───────────────────────────────────────────────── */}
        {step === 'sede' && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">{t('pickSede')}</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {sedes.map((sede) => (
                <button
                  key={sede.id}
                  type="button"
                  onClick={() => {
                    setSelectedSedeId(sede.id);
                    setSelectedSlot(null);
                    // Elegir sede avanza solo: no hace falta un botón extra.
                    setStep(hasServiceChoice ? 'services' : 'slot');
                  }}
                  className={cn(
                    'flex items-start gap-2.5 rounded-xl border-2 p-3 text-left transition-colors',
                    sede.id === selectedSedeId ? 'border-primary bg-primary/5' : 'border-input hover:border-primary/50',
                  )}
                >
                  <MapPin
                    className={cn(
                      'mt-0.5 h-4 w-4 shrink-0',
                      sede.id === selectedSedeId ? 'text-primary' : 'text-muted-foreground',
                    )}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{sede.name}</span>
                    {sede.address && (
                      <span className="block truncate text-xs text-muted-foreground">{sede.address}</span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Paso: servicios ──────────────────────────────────────────── */}
        {step === 'services' && (
          <ServicePicker
            services={services}
            selectedIds={selectedServiceIds}
            onToggle={toggleService}
            hasError={servicesFailed}
            onRetry={retryServices}
            showPricing={showPricing}
          />
        )}

        {/* ── Paso: horario ────────────────────────────────────────────── */}
        {step === 'slot' && (
          <>
            {/* Contexto mínimo del paso anterior: una línea, no la tarjeta entera. */}
            {(hasSedeChoice || effectiveServices.length > 0) && (
              <div className="space-y-1 text-xs text-muted-foreground">
                {hasSedeChoice && selectedSede && (
                  <p className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{selectedSede.name}</span>
                  </p>
                )}
                {effectiveServices.length > 0 && (
                  <p className="flex items-start gap-1.5">
                    <Sparkles className="mt-px h-3.5 w-3.5 shrink-0" />
                    <span className="min-w-0">
                      {effectiveServices.map((sv) => sv.name).join(', ')}
                      {/* La duración se nombra sólo si la clínica muestra los
                          números; igual es la que dimensiona el hueco. */}
                      {showPricing && ` · ${t('minutesShort', { minutes: slotMinutes })}`}
                    </span>
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-sm font-medium">{t('pickDay')}</Label>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-11 w-8 shrink-0"
                  disabled={pageStart === 0}
                  onClick={() => setPageStart((p) => Math.max(0, p - DAYS_PER_PAGE))}
                  aria-label={t('previousDays')}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <div className="grid min-w-0 flex-1 grid-cols-7 gap-1">
                  {days.map((day) => (
                    <button
                      key={day.toISOString()}
                      type="button"
                      onClick={() => setSelectedDate(day)}
                      className={cn(
                        'flex flex-col items-center rounded-lg border-2 py-1.5 transition-colors',
                        isSameDay(day, selectedDate)
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'border-transparent bg-muted/50 text-muted-foreground hover:bg-muted',
                      )}
                    >
                      <span className="text-[10px] uppercase">{format(day, 'EEE', { locale: dateLocale })}</span>
                      <span className="text-base font-bold tabular-nums">{format(day, 'd')}</span>
                    </button>
                  ))}
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-11 w-8 shrink-0"
                  disabled={pageStart + DAYS_PER_PAGE >= DAYS_AHEAD}
                  onClick={() => setPageStart((p) => p + DAYS_PER_PAGE)}
                  aria-label={t('nextDays')}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <Label className="text-sm font-medium">{t('pickTime')}</Label>
                {!isLoadingSlots && slots.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {t('availableCount', { count: availableCount })}
                  </span>
                )}
              </div>

              {isLoadingSlots ? (
                <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <Skeleton key={i} className="h-11 rounded-lg" />
                  ))}
                </div>
              ) : slots.length === 0 ? (
                <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                  {t('closedDay')}
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5">
                    {slots.map((slot) => (
                      <button
                        key={slot.time}
                        type="button"
                        disabled={!slot.isAvailable}
                        onClick={() => {
                          setSelectedSlot(slot);
                          // Elegir horario avanza al resumen.
                          setStep('confirm');
                        }}
                        title={slot.isAvailable ? slot.doctorName : t('slotTaken')}
                        className={cn(
                          'h-11 rounded-lg border-2 text-sm font-semibold tabular-nums transition-colors',
                          slot.isAvailable
                            ? 'border-input bg-background hover:border-primary hover:bg-primary/5'
                            : // Ocupado: se muestra igual, para que el paciente vea
                              // que el horario existe pero no está libre.
                              'cursor-not-allowed border-transparent bg-muted text-muted-foreground/50 line-through',
                        )}
                      >
                        {slot.time}
                      </button>
                    ))}
                  </div>

                  {availableCount === 0 && (
                    <p className="text-center text-sm text-muted-foreground">{t('noneAvailable')}</p>
                  )}
                </>
              )}
            </div>
          </>
        )}

        {/* ── Paso: resumen y motivo ───────────────────────────────────── */}
        {step === 'confirm' && selectedSlot && (
          <div className="space-y-4">
            {rescheduleFrom && (
              <p className="rounded-xl bg-primary/5 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
                {t('replacing', { date: rescheduleFrom.date, time: rescheduleFrom.time })}
              </p>
            )}

            <div className="space-y-3 rounded-xl border bg-muted/30 p-4">
              <p className="text-sm font-semibold">{t('summary.title')}</p>
              <dl className="space-y-2.5 text-sm">
                <SummaryRow
                  icon={Clock}
                  label={t('summary.when')}
                  value={`${format(selectedDate, "EEEE d 'de' MMMM", { locale: dateLocale })} · ${selectedSlot.time}`}
                  capitalize
                />
                {selectedSlot.doctorName && (
                  <SummaryRow icon={Stethoscope} label={t('summary.who')} value={selectedSlot.doctorName} />
                )}
                {(selectedSede?.name || selectedSlot.calendarName) && (
                  <SummaryRow
                    icon={MapPin}
                    label={t('summary.where')}
                    value={selectedSede?.name || selectedSlot.calendarName || ''}
                  />
                )}
                {effectiveServices.length > 0 && (
                  <SummaryRow
                    icon={Sparkles}
                    label={t('summary.services')}
                    value={effectiveServices.map((sv) => sv.name).join(', ')}
                  />
                )}
                {showPricing && (
                  <SummaryRow
                    icon={Clock}
                    label={t('summary.duration')}
                    value={t('minutesShort', { minutes: slotMinutes })}
                  />
                )}
                {showPricing && totalPrice && (
                  <SummaryRow
                    icon={Receipt}
                    label={t('summary.total')}
                    value={formatMoney(totalPrice.amount, totalPrice.currency)}
                  />
                )}
              </dl>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="booking-reason" className="text-sm font-medium">
                {t('reasonLabel')}
              </Label>
              <Textarea
                id="booking-reason"
                rows={3}
                autoFocus
                className="resize-none"
                placeholder={t('reasonPlaceholder')}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">{t('reasonHint')}</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Footer: siempre visible por encima del scroll ─────────────── */}
      <div className="flex-none space-y-1.5 border-t bg-background pt-3">
        {step === 'services' && (
          <>
            <Button
              type="button"
              size="lg"
              className="h-12 w-full text-base"
              onClick={() => setStep('slot')}
            >
              {t('continue')}
            </Button>
            {/* Saltear el paso es válido: la clínica ya definió con qué se crea
                la cita si el paciente no elige nada. */}
            {selectedServiceIds.length === 0 && (
              <p className="text-center text-xs text-muted-foreground">
                {/* Al reagendar no se aplica el servicio por defecto, así que
                    prometerlo acá sería mentirle. */}
                {rescheduleFrom
                  ? t('rescheduleNoServices')
                  : defaultService
                    ? t('defaultServiceNotice', { name: defaultService.name })
                    : t('continueWithoutServices')}
              </p>
            )}
          </>
        )}

        {step === 'confirm' && (
          <>
            <Button
              type="button"
              size="lg"
              className="h-12 w-full text-base"
              disabled={isSubmitting}
              onClick={handleConfirm}
            >
              {isSubmitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <CalendarCheck className="mr-2 h-5 w-5" />
                  {rescheduleFrom ? t('confirmReschedule') : t('confirm')}
                </>
              )}
            </Button>
            <p className="text-center text-xs text-muted-foreground">{t('pendingNotice')}</p>
          </>
        )}

        {secondaryAction}
      </div>
    </div>
  );
}

function SummaryRow({
  icon: Icon,
  label,
  value,
  capitalize,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className={cn('font-medium', capitalize && 'capitalize')}>{value}</dd>
      </div>
    </div>
  );
}
