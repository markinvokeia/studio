'use client';

import * as React from 'react';
import { addDays, format, isSameDay, startOfDay } from 'date-fns';
import { es as esLocale } from 'date-fns/locale';
import {
    ArrowDown, CalendarCheck, ChevronLeft, ChevronRight, ClipboardList, Globe,
    Loader2, MapPin, TriangleAlert,
} from 'lucide-react';
import Image from 'next/image';
import { usePathname, useParams, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';

import { UsFlagIcon } from '@/components/icons/us-flag-icon';
import { UyFlagIcon } from '@/components/icons/uy-flag-icon';
import { ClinicFooter } from '@/components/patient-portal/clinic-footer';
import { WelcomeVideo } from '@/components/patient-portal/welcome-video';

import { cn, toLocalISOString } from '@/lib/utils';
import { resolveVideoEmbed } from '@/lib/video-embed';
import type { ClinicSchedule, PublicClinicInfo, PublicStudyOrder } from '@/lib/types';
import {
    fetchBookingSedes, fetchPatientDaySlots,
    type BookingSede, type BookingSlot,
} from '@/services/patient-booking';
import { DEFAULT_WELCOME_VIDEO_URL, fetchPublicClinicInfo, fetchPublicSedeSchedules } from '@/services/public-clinic';
import { bookPublicStudyOrder, getPublicStudyOrder } from '@/services/study-orders';

/**
 * Auto-agendamiento del paciente para una orden de estudio.
 *
 * Ruta pública: el paciente llega con el link que le pasó la clínica y no tiene
 * cuenta. Lo que autoriza es el token de la URL, que el backend valida contra
 * `study_order_booking_tokens` en cada llamada.
 *
 * El armado visual es el mismo que la landing del portal —bienvenida y video a
 * la izquierda, lo accionable a la derecha— a propósito: para el paciente es la
 * misma clínica, y llegar por un link de WhatsApp a una pantalla que no se
 * parece en nada al portal se siente como haber caído en otro sitio.
 *
 * No reusa `PatientBookingPanel` aunque los pasos se le parezcan: ese componente
 * exige un `User` con sesión y confirma contra `/appointments/upsert`, que no
 * ata la cita a la orden ni consume el token. El paso final va por
 * `/study-orders/public-book_noauth`, que hace las tres cosas en una sentencia.
 * Los pasos previos —sedes, horarios de atención y huecos— sí salen de los
 * mismos servicios en modo `public`, así que la disponibilidad que ve el
 * paciente es exactamente la que ve el portal.
 */

const DAYS_PER_PAGE = 7;
const DAYS_AHEAD = 60;
const STEPS_ANCHOR = 'reservar';
const INVOKEIA_LOGO = 'https://www.invokeia.com/assets/InvokeIA_C@4x-4T0dztu0.webp';

type Step = 'sede' | 'slot' | 'done';

export default function StudyOrderBookingPage() {
    const params = useParams();
    const pathname = usePathname();
    const router = useRouter();
    const locale = useLocale();
    const t = useTranslations('StudyOrderBooking');
    const tHeader = useTranslations('Header');

    const token = String(params?.token ?? '');
    const dateLocale = locale === 'es' ? esLocale : undefined;
    const today = React.useMemo(() => startOfDay(new Date()), []);

    const [clinic, setClinic] = React.useState<PublicClinicInfo | null>(null);
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

    // ── Carga inicial: la orden, las sedes y la clínica, en paralelo ─────────
    React.useEffect(() => {
        if (!token) { setIsLoading(false); return; }
        let cancelled = false;
        void Promise.all([getPublicStudyOrder(token), fetchBookingSedes('public'), fetchPublicClinicInfo()])
            .then(([fetchedOrder, fetchedSedes, clinicInfo]) => {
                if (cancelled) return;
                setOrder(fetchedOrder);
                setSedes(fetchedSedes);
                setClinic(clinicInfo);
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

    const onSelectLocale = (newLocale: string) => {
        localStorage.setItem('locale', newLocale);
        router.replace(pathname.replace(`/${locale}`, `/${newLocale}`));
    };

    const clinicName = clinic?.name || t('genericClinicName');
    const configuredVideo = clinic?.welcome_video_url ?? '';
    const videoUrl =
        resolveVideoEmbed(configuredVideo).kind === 'none' ? DEFAULT_WELCOME_VIDEO_URL : configuredVideo;

    // ── Armazón ──────────────────────────────────────────────────────────────

    return (
        <div className="flex h-[100dvh] flex-col overflow-hidden bg-background text-foreground">
            <header className="flex-none border-b bg-card/60 backdrop-blur">
                <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-2.5 sm:px-6">
                    <ClinicLogo clinic={clinic} isLoading={isLoading} />
                    <div className="min-w-0 flex-1">
                        {isLoading ? (
                            <Skeleton className="h-4 w-36" />
                        ) : (
                            <p className="truncate text-sm font-bold leading-tight sm:text-base">{clinicName}</p>
                        )}
                        <p className="truncate text-[11px] text-muted-foreground">{t('header.tagline')}</p>
                    </div>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0">
                                <Globe className="h-[1.05rem] w-[1.05rem]" />
                                <span className="sr-only">{tHeader('toggleLanguage')}</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => onSelectLocale('es')} disabled={locale === 'es'}>
                                <span className="flex items-center gap-2">
                                    <UyFlagIcon className="h-4 w-4" />
                                    {tHeader('spanish')}
                                </span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => onSelectLocale('en')} disabled={locale === 'en'}>
                                <span className="flex items-center gap-2">
                                    <UsFlagIcon className="h-4 w-4" />
                                    {tHeader('english')}
                                </span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </header>

            <main className="relative min-h-0 flex-1 overflow-y-auto lg:overflow-hidden">
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_55%_at_50%_0%,hsl(var(--primary)/0.12),transparent_70%)]"
                />
                <div className="relative mx-auto grid w-full max-w-6xl gap-8 px-4 py-6 sm:px-6 lg:h-full lg:grid-cols-[1fr_minmax(0,26rem)] lg:items-center lg:gap-14 lg:py-0">
                    {/* Bienvenida + video: lo mismo que ve en el portal. */}
                    <section className="space-y-5 text-center lg:text-left">
                        <div className="space-y-3">
                            <h1 className="text-3xl font-extrabold leading-[1.1] tracking-tight sm:text-4xl xl:text-5xl">
                                {isLoading ? (
                                    <Skeleton className="mx-auto h-11 w-4/5 lg:mx-0" />
                                ) : order ? (
                                    t('hero.title', { name: order.patient_first_name })
                                ) : (
                                    t('invalidTitle')
                                )}
                            </h1>
                            <p className="mx-auto max-w-prose text-sm text-muted-foreground sm:text-base lg:mx-0">
                                {order
                                    ? (order.doctor_name
                                        ? t('introWithDoctor', { doctor: order.doctor_name })
                                        : t('intro'))
                                    : t('invalidBody')}
                            </p>
                        </div>

                        <WelcomeVideo url={videoUrl} title={t('hero.videoTitle', { clinic: clinicName })} />

                        {order && (
                            <div className="space-y-2">
                                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                    {t('hero.studies', { order: order.order_number })}
                                </p>
                                <div className="flex flex-wrap justify-center gap-1.5 lg:justify-start">
                                    {order.pending_services.map((service) => (
                                        <Badge key={service.id} variant="secondary" className="font-normal">
                                            {service.name}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* En móvil los pasos quedan abajo: se ofrece un salto directo. */}
                        {order && step !== 'done' && (
                            <Button
                                variant="outline"
                                size="lg"
                                className="h-12 w-full lg:hidden"
                                onClick={() =>
                                    document.getElementById(STEPS_ANCHOR)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                                }
                            >
                                {t('hero.cta')}
                                <ArrowDown className="ml-2 h-4 w-4" />
                            </Button>
                        )}
                    </section>

                    {/* Los pasos. Sin marco: comparten superficie con la bienvenida. */}
                    <section
                        id={STEPS_ANCHOR}
                        className="scroll-mt-4 pb-6 lg:max-h-full lg:overflow-y-auto lg:py-8 lg:pl-10 lg:pr-1 lg:[border-left:1px_solid_hsl(var(--border))]"
                    >
                        {isLoading ? (
                            <div className="space-y-3">
                                <Skeleton className="h-5 w-40" />
                                <Skeleton className="h-11 w-full" />
                                <Skeleton className="h-11 w-full" />
                            </div>
                        ) : !order ? (
                            <InvalidLink />
                        ) : step === 'done' && booked ? (
                            <Done
                                date={format(booked.date, "EEEE d 'de' MMMM", { locale: dateLocale })}
                                time={booked.time}
                                sede={selectedSede?.name ?? ''}
                            />
                        ) : (
                            <div className="space-y-4">
                                {step === 'sede' && (
                                    <div className="space-y-2">
                                        <h2 className="text-lg font-bold">{t('chooseSede')}</h2>
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
                                        <div className="space-y-1">
                                            <h2 className="text-lg font-bold">{t('chooseSlot')}</h2>
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
                                        </div>

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
                            </div>
                        )}
                    </section>
                </div>
            </main>

            <ClinicFooter />
        </div>
    );
}

// ── Piezas de presentación ───────────────────────────────────────────────────

function InvalidLink() {
    const t = useTranslations('StudyOrderBooking');
    return (
        <div className="space-y-3 text-center lg:text-left">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-destructive/10 text-destructive lg:mx-0">
                <TriangleAlert className="h-7 w-7" aria-hidden="true" />
            </span>
            <h2 className="text-xl font-bold">{t('invalidTitle')}</h2>
            <p className="text-sm text-muted-foreground">{t('invalidBody')}</p>
        </div>
    );
}

function Done({ date, time, sede }: { date: string; time: string; sede: string }) {
    const t = useTranslations('StudyOrderBooking');
    return (
        <div className="space-y-3 text-center lg:text-left">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-500/10 text-emerald-600 lg:mx-0">
                <CalendarCheck className="h-7 w-7" aria-hidden="true" />
            </span>
            <h2 className="text-xl font-bold">{t('doneTitle')}</h2>
            <p className="text-sm text-muted-foreground">{t('doneBody', { date, time, sede })}</p>
            <p className="text-xs text-muted-foreground">{t('doneHint')}</p>
        </div>
    );
}

/** Logo de la clínica, con el isotipo de Invoke IA como respaldo. */
function ClinicLogo({ clinic, isLoading }: { clinic: PublicClinicInfo | null; isLoading: boolean }) {
    if (isLoading) return <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />;
    const src = clinic?.logo_url || INVOKEIA_LOGO;
    return (
        <span className="relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <Image src={src} alt="" fill sizes="36px" className="object-contain p-0.5" unoptimized />
            <ClipboardList className="h-4 w-4 text-muted-foreground opacity-0" aria-hidden="true" />
        </span>
    );
}
