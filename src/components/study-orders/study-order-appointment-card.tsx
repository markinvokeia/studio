'use client';

import * as React from 'react';
import {
    CalendarDays, Clock, FileText, MapPin, Monitor, StickyNote, Stethoscope, User,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

import { formatDateTime, formatDisplayDate } from '@/lib/utils';
import type { StudyOrderAppointment } from '@/lib/types';

/**
 * Una cita de la orden, con todo lo que muestra el panel del calendario.
 *
 * La idea es no obligar a saltar de pantalla: quien está mirando la orden quiere
 * saber cuándo, dónde, con quién, qué estudios y qué se registró, sin abrir la
 * agenda. Es sólo lectura — editar sigue siendo trabajo del calendario, que es
 * donde se ven los huecos y los choques.
 */

/** `HH:mm` sin pasar por Date: el string viene sin zona y convertirlo la corre. */
function timeOf(iso: string): string {
    return (iso.replace('Z', '').split('T')[1] ?? '').slice(0, 5);
}

function durationMinutes(start: string, end: string): number {
    const a = new Date(start.replace('Z', ''));
    const b = new Date(end.replace('Z', ''));
    return Math.max(0, Math.round((b.getTime() - a.getTime()) / 60000));
}

const STATUS_TONE: Record<string, 'default' | 'secondary' | 'destructive' | 'success' | 'outline'> = {
    scheduled: 'default',
    confirmed: 'default',
    arrived: 'default',
    in_progress: 'default',
    completed: 'success',
    attended_late: 'success',
    cancelled: 'destructive',
    no_show: 'destructive',
    deleted: 'destructive',
};

export interface StudyOrderAppointmentCardProps {
    appointment: StudyOrderAppointment;
}

export function StudyOrderAppointmentCard({ appointment }: StudyOrderAppointmentCardProps) {
    // Etiquetas propias en vez de las del módulo de citas: ahí `services` y
    // `summary` no existen, y depender del árbol de claves de otro módulo hace
    // que renombrar allá rompa esto sin aviso.
    const t = useTranslations('StudyOrdersPage');
    const tStatus = useTranslations('AppointmentStatus');

    const minutes = durationMinutes(appointment.start_datetime, appointment.end_datetime);
    const services = appointment.services ?? [];

    return (
        <article className="overflow-hidden rounded-lg border">
            {/* Franja del color de la cita: es el mismo dato que el calendario usa
                para distinguirlas de un vistazo. */}
            <div
                className="h-1 w-full"
                style={{ backgroundColor: appointment.color || 'hsl(var(--primary))' }}
                aria-hidden="true"
            />

            <div className="space-y-3 p-3">
                <header className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                        <p className="flex items-center gap-1.5 text-sm font-semibold">
                            <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                            {formatDisplayDate(appointment.start_datetime)}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            {timeOf(appointment.start_datetime)}–{timeOf(appointment.end_datetime)}
                            {minutes > 0 && ` · ${t('appointmentCard.minutes', { minutes })}`}
                        </p>
                    </div>
                    <Badge variant={STATUS_TONE[appointment.status] ?? 'outline'} className="shrink-0">
                        {tStatus(appointment.status)}
                    </Badge>
                </header>

                <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
                    <Row icon={User} label={t('appointmentCard.doctor')} value={appointment.doctor_name} />
                    <Row icon={MapPin} label={t('appointmentCard.sede')} value={appointment.sede_name} />
                    <Row icon={Monitor} label={t('appointmentCard.calendar')} value={appointment.calendar_name} />
                    <Row icon={FileText} label={t('appointmentCard.summary')} value={appointment.summary} />
                </dl>

                {services.length > 0 && (
                    <div className="space-y-1.5">
                        <p className="text-xs text-muted-foreground">{t('appointmentCard.services')}</p>
                        <div className="flex flex-wrap gap-1.5">
                            {services.map((service) => (
                                <Badge key={service.id} variant="secondary" className="font-normal">
                                    {service.name}
                                    {service.duration_minutes ? (
                                        <span className="ml-1 opacity-60">{service.duration_minutes}′</span>
                                    ) : null}
                                </Badge>
                            ))}
                        </div>
                    </div>
                )}

                {appointment.notes && (
                    <div className="flex items-start gap-2 rounded-md bg-muted/50 p-2">
                        <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <p className="whitespace-pre-wrap text-xs">{appointment.notes}</p>
                    </div>
                )}

                {/* Por qué se cayó. Sin esto, una cita cancelada en la orden es un
                    badge rojo sin explicación. */}
                {(appointment.cancellation_reason || appointment.cancellation_note) && (
                    <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2">
                        <p className="text-xs font-medium text-destructive">
                            {appointment.cancellation_reason}
                        </p>
                        {appointment.cancellation_note && (
                            <p className="mt-0.5 text-xs italic text-muted-foreground">
                                {appointment.cancellation_note}
                            </p>
                        )}
                    </div>
                )}

                {appointment.session && (
                    <>
                        <Separator />
                        <div className="space-y-1">
                            <p className="flex items-center gap-1.5 text-xs font-medium">
                                <Stethoscope className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                                {t('appointmentCard.session')}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {appointment.session.doctor_name}
                                {appointment.session.fecha_sesion && ` · ${formatDateTime(appointment.session.fecha_sesion)}`}
                            </p>
                            {appointment.session.procedimiento_realizado && (
                                <p className="text-xs">{appointment.session.procedimiento_realizado}</p>
                            )}
                            {appointment.session.diagnostico && (
                                <p className="text-xs italic text-muted-foreground">{appointment.session.diagnostico}</p>
                            )}
                        </div>
                    </>
                )}

                <footer className="flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
                    <span>#{appointment.id}</span>
                    {appointment.created_at && (
                        <span>{t('appointmentCard.createdAt', { date: formatDateTime(appointment.created_at) })}</span>
                    )}
                    {appointment.imported_from_google && <span>{t('appointmentCard.fromGoogle')}</span>}
                </footer>
            </div>
        </article>
    );
}

function Row({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value?: string | null }) {
    if (!value) return null;
    return (
        <div className="flex items-start gap-2">
            <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="min-w-0">
                <dt className="text-[11px] text-muted-foreground">{label}</dt>
                <dd className="truncate text-sm">{value}</dd>
            </div>
        </div>
    );
}

export default StudyOrderAppointmentCard;
