'use client';

import * as React from 'react';
import { addDays, format, isSameDay, startOfDay } from 'date-fns';
import { es as esLocale } from 'date-fns/locale';
import {
    CalendarCheck, ChevronLeft, ChevronRight, ClipboardList,
    Loader2, MapPin, TriangleAlert,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

import { cn, toLocalISOString } from '@/lib/utils';
import type { ClinicSchedule, PublicStudyOrder } from '@/lib/types';
import {
    fetchBookingSedes, fetchPatientDaySlots,
    type BookingSede, type BookingSlot,
} from '@/services/patient-booking';
import { fetchPublicSedeSchedules } from '@/services/public-clinic';
import { bookPublicStudyOrder, getPublicStudyOrder } from '@/services/study-orders';

/**
 * Auto-agendamiento del paciente para una orden de estudio.
 *
 * Ruta pública: el paciente llega con el link que le pasó la clínica y no tiene
 * cuenta. Lo que autoriza es el token de la URL, que el backend valida contra
 * `study_order_booking_tokens` en cada llamada.
 *
 * No reusa `PatientBookingPanel` aunque se le parezca: ese componente exige un
 * `User` con sesión y confirma contra `/appointments/upsert`, que no ata la cita
 * a la orden ni consume el token. Acá el paso final va por
 * `/study-orders/public-book_noauth`, que hace las tres cosas en una sentencia.
 * Los pasos previos —sedes, horarios de atención y huecos— sí salen de los
 * mismos servicios en modo `public`, así que la disponibilidad que ve el
 * paciente es exactamente la que ve el portal.
 *
 * Un link vencido, revocado, agotado o inventado cae todo en la misma pantalla:
 * el backend no los distingue a propósito.
 */

const DAYS_PER_PAGE = 7;
const DAYS_AHEAD = 60;

type Step = 'sede' | 'slot' | 'done';

export default function StudyOrderBookingPage() {
    const params = useParams();
    const locale = useLocale();
    const t = useTranslations('StudyOrderBooking');

    const token = String(params?.token ?? '');
    const dateLocale = locale === 'es' ? esLocale : undefined;
    const today = React.useMemo(() => startOfDay(new Date()), []);

    const [order, setOrder] = React.useState<PublicStudyOrder | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);

    const [sedes, setSedes] = React.useState<BookingSede[]>([]);
    const [selectedSedeId, setSelectedSedeId] = React.useState<string>('');
    const [schedules, setSchedules] = React.useState<ClinicSchedule[]>([]);

    const [step, setStep] = React.useState<Step>('sede');
    const [pageStart, setPageStart] = React.useState(0);
    const [selectedDate, setSelectedDate] = React.useState<Date>(today);
    const [slots, setSlots] = React.useState<BookingSlot[]>([]);
    const [isLoadingSlots, setIsLoadingSlots] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [bookingError, setBookingError] = React.useState<string | null>(null);
    const [booked, setBooked] = React.useState<{ date: Date; time: string } | null>(null);

    // ── Carga inicial: la orden y las sedes, en paralelo ─────────────────────
    React.useEffect(() => {
        if (!token) { setIsLoading(false); return; }
        let cancelled = false;
        void Promise.all([getPublicStudyOrder(token), fetchBookingSedes('public')])
            .then(([fetchedOrder, fetchedSedes]) => {
                if (cancelled) return;
                setOrder(fetchedOrder);
                setSedes(fetchedSedes);
                if (fetchedOrder) {
                    // La sede sugerida por el derivador viene preseleccionada, pero
                    // el paciente puede cambiarla: es una sugerencia, no una orden.
                    const preferred = fetchedOrder.preferred_sede_id != null
                        ? fetchedSedes.find((s) => s.id === String(fetchedOrder.preferred_sede_id))
                        : undefined;
                    const only = fetchedSedes.length === 1 ? fetchedSedes[0] : undefined;
                    const chosen = preferred ?? only;
                    if (chosen) { setSelectedSedeId(chosen.id); setStep('slot'); }
                }
                setIsLoading(false);
            });
        return () => { cancelled = true; };
    }, [token]);

    // La ventana de atención es por sede: cada una abre a horas distintas.
    React.useEffect(() => {
        if (!selectedSedeId) { setSchedules([]); return; }
        let cancelled = false;
        void fetchPublicSedeSchedules(selectedSedeId).then((fetched) => {
            if (cancelled) return;
            setSchedules(fetched.map((s, index) => ({
                id: String(index),
                day_of_week: s.day_of_week,
                start_time: s.start_time,
                end_time: s.end_time,
            })) as ClinicSchedule[]);
        });
        return () => { cancelled = true; };
    }, [selectedSedeId]);

    const selectedSede = sedes.find((s) => s.id === selectedSedeId);

    /**
     * Cuánto dura el turno: la suma de los estudios pendientes. Si el catálogo no
     * tiene duración cargada se cae a media hora, que es el paso de la grilla.
     */
    const durationMin = React.useMemo(() => {
        const total = (order?.pending_services ?? [])
            .reduce((acc, s) => acc + (s.duration_minutes ?? 0), 0);
        return total > 0 ? total : 30;
    }, [order]);

    React.useEffect(() => {
        if (step !== 'slot' || !selectedSede) return;
        let cancelled = false;
        setIsLoadingSlots(true);
        void fetchPatientDaySlots(selectedDate, schedules, undefined, selectedSede.calendarIds, 'public')
            .then((fetched) => { if (!cancelled) setSlots(fetched); })
            .catch(() => { if (!cancelled) setSlots([]); })
            .finally(() => { if (!cancelled) setIsLoadingSlots(false); });
        return () => { cancelled = true; };
    }, [step, selectedDate, schedules, selectedSede]);

    const days = React.useMemo(
        () => Array.from({ length: DAYS_PER_PAGE }, (_, i) => addDays(today, pageStart + i)),
        [today, pageStart],
    );

    const handleConfirm = React.useCallback(async (slot: BookingSlot) => {
        if (!slot.calendarSourceId) return;
        setBookingError(null);
        setIsSubmitting(true);
        try {
            const [hours, minutes] = slot.time.split(':').map(Number);
            const start = new Date(selectedDate);
            start.setHours(hours, minutes, 0, 0);
            const end = new Date(start.getTime() + durationMin * 60_000);

            await bookPublicStudyOrder({
                token,
                calendarSourceId: slot.calendarSourceId,
                // toLocalISOString y no toISOString: mandar UTC corre el turno
                // tres horas en Uruguay.
                start: toLocalISOString(start),
                end: toLocalISOString(end),
            });

            setBooked({ date: start, time: slot.time });
            setStep('done');
        } catch (error) {
            setBookingError(error instanceof Error ? error.message : t('bookingError'));
        } finally {
            setIsSubmitting(false);
        }
    }, [selectedDate, durationMin, token, t]);

    // ── Estados terminales ───────────────────────────────────────────────────

    if (isLoading) {
        return (
            <Shell>
                <Card>
                    <CardHeader className="space-y-3">
                        <Skeleton className="h-6 w-48" />
                        <Skeleton className="h-4 w-full" />
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </CardContent>
                </Card>
            </Shell>
        );
    }

    if (!order) {
        return (
            <Shell>
                <Card>
                    <CardHeader className="items-center text-center">
                        <span className="mb-2 grid h-14 w-14 place-items-center rounded-full bg-destructive/10 text-destructive">
                            <TriangleAlert className="h-7 w-7" aria-hidden="true" />
                        </span>
                        <CardTitle>{t('invalidTitle')}</CardTitle>
                        <CardDescription>{t('invalidBody')}</CardDescription>
                    </CardHeader>
                </Card>
            </Shell>
        );
    }

    if (step === 'done' && booked) {
        return (
            <Shell>
                <Card>
                    <CardHeader className="items-center text-center">
                        <span className="mb-2 grid h-14 w-14 place-items-center rounded-full bg-emerald-500/10 text-emerald-600">
                            <CalendarCheck className="h-7 w-7" aria-hidden="true" />
                        </span>
                        <CardTitle>{t('doneTitle')}</CardTitle>
                        <CardDescription>
                            {t('doneBody', {
                                date: format(booked.date, "EEEE d 'de' MMMM", { locale: dateLocale }),
                                time: booked.time,
                                sede: selectedSede?.name ?? '',
                            })}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-center text-sm text-muted-foreground">{t('doneHint')}</p>
                    </CardContent>
                </Card>
            </Shell>
        );
    }

    // ── Flujo ────────────────────────────────────────────────────────────────

    return (
        <Shell>
            <Card>
                <CardHeader>
                    <div className="flex items-start gap-3">
                        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                            <ClipboardList className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                            <CardTitle className="text-lg">
                                {t('greeting', { name: order.patient_first_name })}
                            </CardTitle>
                            <CardDescription>
                                {order.doctor_name
                                    ? t('introWithDoctor', { doctor: order.doctor_name })
                                    : t('intro')}
                            </CardDescription>
                        </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                        {order.pending_services.map((service) => (
                            <Badge key={service.id} variant="secondary" className="font-normal">
                                {service.name}
                            </Badge>
                        ))}
                    </div>
                </CardHeader>

                <CardContent className="space-y-4">
                    {step === 'sede' && (
                        <div className="space-y-2">
                            <p className="text-sm font-medium">{t('chooseSede')}</p>
                            {sedes.length === 0 && (
                                <p className="text-sm text-muted-foreground">{t('noSedes')}</p>
                            )}
                            {sedes.map((sede) => (
                                <button
                                    key={sede.id}
                                    type="button"
                                    onClick={() => { setSelectedSedeId(sede.id); setStep('slot'); }}
                                    className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent"
                                >
                                    <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-medium">{sede.name}</span>
                                        {sede.address && (
                                            <span className="block truncate text-xs text-muted-foreground">{sede.address}</span>
                                        )}
                                    </span>
                                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                                </button>
                            ))}
                        </div>
                    )}

                    {step === 'slot' && (
                        <div className="space-y-4">
                            {sedes.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() => setStep('sede')}
                                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                                >
                                    <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                                    {selectedSede?.name}
                                </button>
                            )}

                            <div className="flex items-center gap-1">
                                <Button
                                    variant="ghost" size="icon" className="h-8 w-8 shrink-0"
                                    disabled={pageStart === 0}
                                    onClick={() => setPageStart((p) => Math.max(0, p - DAYS_PER_PAGE))}
                                    aria-label={t('previousDays')}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <div className="grid flex-1 grid-cols-7 gap-1">
                                    {days.map((day) => {
                                        const isSelected = isSameDay(day, selectedDate);
                                        return (
                                            <button
                                                key={day.toISOString()}
                                                type="button"
                                                onClick={() => setSelectedDate(day)}
                                                className={cn(
                                                    'rounded-md border py-1.5 text-center transition-colors',
                                                    isSelected
                                                        ? 'border-primary bg-primary text-primary-foreground'
                                                        : 'hover:bg-accent',
                                                )}
                                            >
                                                <span className="block text-[10px] uppercase opacity-70">
                                                    {format(day, 'EEE', { locale: dateLocale })}
                                                </span>
                                                <span className="block text-sm font-semibold">{format(day, 'd')}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                                <Button
                                    variant="ghost" size="icon" className="h-8 w-8 shrink-0"
                                    disabled={pageStart + DAYS_PER_PAGE >= DAYS_AHEAD}
                                    onClick={() => setPageStart((p) => p + DAYS_PER_PAGE)}
                                    aria-label={t('nextDays')}
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>

                            {isLoadingSlots ? (
                                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                                    {Array.from({ length: 8 }).map((_, i) => (
                                        <Skeleton key={i} className="h-9 w-full" />
                                    ))}
                                </div>
                            ) : slots.filter((s) => s.isAvailable).length === 0 ? (
                                <p className="py-6 text-center text-sm text-muted-foreground">{t('noSlots')}</p>
                            ) : (
                                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                                    {slots.filter((s) => s.isAvailable).map((slot) => (
                                        <Button
                                            key={slot.time}
                                            variant="outline"
                                            disabled={isSubmitting}
                                            onClick={() => void handleConfirm(slot)}
                                        >
                                            {isSubmitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                                            {slot.time}
                                        </Button>
                                    ))}
                                </div>
                            )}

                            <p className="text-center text-xs text-muted-foreground">
                                {t('durationHint', { minutes: durationMin })}
                            </p>

                            {bookingError && (
                                <p className="text-center text-sm text-destructive" role="alert">{bookingError}</p>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </Shell>
    );
}

function Shell({ children }: { children: React.ReactNode }) {
    return (
        <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
            <div className="w-full max-w-lg">{children}</div>
        </main>
    );
}
