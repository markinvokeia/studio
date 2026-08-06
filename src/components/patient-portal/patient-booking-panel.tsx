'use client';

import { addDays, format, isSameDay, startOfDay } from 'date-fns';
import { enUS, es } from 'date-fns/locale';
import {
  ArrowLeft,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  MapPin,
  Stethoscope,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';

import { WizardStepper, type WizardStep } from '@/components/patient-portal/wizard-stepper';

import { useToast } from '@/hooks/use-toast';
import type { Appointment, ClinicSchedule, User } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  createPatientAppointment,
  fetchBookingSedes,
  fetchPatientDaySlots,
  notifyAppointmentChange,
  reschedulePatientAppointment,
  type BookingAuthMode,
  type BookingSede,
  type BookingSlot,
} from '@/services/patient-booking';
import { fetchPublicSedeSchedules } from '@/services/public-clinic';

/** Cuántos días hacia adelante puede elegir el paciente. */
const DAYS_AHEAD = 30;
/** Días visibles a la vez en la tira de fechas. */
const DAYS_PER_PAGE = 7;

/** Pasos del wizard. `sede` se omite cuando la clínica tiene una sola. */
type BookingStep = 'sede' | 'slot' | 'confirm';

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
  const dateLocale = locale === 'es' ? es : enUS;
  const { toast } = useToast();

  const today = React.useMemo(() => startOfDay(new Date()), []);

  const [schedules, setSchedules] = React.useState<ClinicSchedule[]>([]);
  const [sedes, setSedes] = React.useState<BookingSede[]>([]);
  const [selectedSedeId, setSelectedSedeId] = React.useState<string>('');
  const [isLoadingSetup, setIsLoadingSetup] = React.useState(true);
  const [step, setStep] = React.useState<BookingStep>('sede');
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
      const fetchedSedes = await fetchBookingSedes(authMode);
      if (cancelled) return;
      setSedes(fetchedSedes);
      // Con una sola sede (o ninguna) no se le pregunta nada: arranca en horarios.
      if (fetchedSedes.length === 1) setSelectedSedeId(fetchedSedes[0].id);
      setStep(fetchedSedes.length > 1 ? 'sede' : 'slot');
      setIsLoadingSetup(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [authMode]);

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

  const loadSlots = React.useCallback(
    async (day: Date, clinicSchedules: ClinicSchedule[], calendarIds: string[]) => {
      setIsLoadingSlots(true);
      try {
        setSlots(await fetchPatientDaySlots(day, clinicSchedules, undefined, calendarIds, authMode));
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
    loadSlots(selectedDate, schedules, selectedSede?.calendarIds ?? []);
  }, [isLoadingSetup, step, selectedDate, schedules, selectedSede, loadSlots]);

  const days = React.useMemo(
    () => Array.from({ length: DAYS_PER_PAGE }, (_, i) => addDays(today, pageStart + i)),
    [today, pageStart],
  );

  const availableCount = slots.filter((s) => s.isAvailable).length;

  const steps: WizardStep[] = React.useMemo(() => {
    const base: WizardStep[] = [
      { id: 'slot', label: t('steps.slot') },
      { id: 'confirm', label: t('steps.confirm') },
    ];
    return hasSedeChoice ? [{ id: 'sede', label: t('steps.sede') }, ...base] : base;
  }, [hasSedeChoice, t]);

  const currentStepIndex = steps.findIndex((s) => s.id === step);

  const goBack = () => {
    if (step === 'confirm') {
      setStep('slot');
      return;
    }
    if (step === 'slot' && hasSedeChoice) setStep('sede');
  };

  const handleConfirm = async () => {
    if (!selectedSlot?.isAvailable) return;
    setIsSubmitting(true);
    try {
      const bookedDate = format(selectedDate, 'yyyy-MM-dd');
      const input = { patient, date: bookedDate, slot: selectedSlot, reason, authMode };

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
                    setStep('slot');
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

        {/* ── Paso: horario ────────────────────────────────────────────── */}
        {step === 'slot' && (
          <>
            {/* Contexto mínimo del paso anterior: una línea, no la tarjeta entera. */}
            {hasSedeChoice && selectedSede && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{selectedSede.name}</span>
              </p>
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
