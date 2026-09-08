'use client';

import * as React from 'react';
import { CalendarDays, ClipboardList, Stethoscope, User } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

import { formatDateTime, formatDisplayDate } from '@/lib/utils';
import type { StudyOrderAppointment } from '@/lib/types';

/**
 * La sesión clínica de una cita de la orden, con el mismo tratamiento que la
 * tarjeta de cita: quién la registró, cuándo, qué hizo y sobre qué cita.
 *
 * Quien la registra puede ser el técnico que tomó el estudio, el doctor o una
 * recepcionista — `sesiones_clinicas.doctor_id` guarda a quien la cargó, no al
 * derivador. Por eso la tarjeta dice "Registrada por" y no "Doctor": nombrar mal
 * a quien hizo el trabajo es peor que no nombrarlo.
 */

export interface StudyOrderSessionCardProps {
    appointment: StudyOrderAppointment;
}

export function StudyOrderSessionCard({ appointment }: StudyOrderSessionCardProps) {
    const t = useTranslations('StudyOrdersPage');
    const session = appointment.session;
    if (!session) return null;

    return (
        <article className="overflow-hidden rounded-lg border">
            <div className="h-1 w-full bg-emerald-500" aria-hidden="true" />

            <div className="space-y-3 p-3">
                <header className="flex flex-wrap items-start justify-between gap-2">
                    <p className="flex items-center gap-1.5 text-sm font-semibold">
                        <Stethoscope className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
                        {t('sessionTab.title')}
                    </p>
                    <Badge variant="success" className="shrink-0">
                        {session.fecha_sesion ? formatDisplayDate(session.fecha_sesion) : ''}
                    </Badge>
                </header>

                <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
                    <Row
                        icon={User}
                        label={t('sessionTab.registeredBy')}
                        value={session.doctor_name}
                    />
                    <Row
                        icon={CalendarDays}
                        label={t('sessionTab.registeredAt')}
                        value={session.fecha_sesion ? formatDateTime(session.fecha_sesion) : null}
                    />
                    <Row
                        icon={ClipboardList}
                        label={t('sessionTab.forAppointment')}
                        value={`${formatDateTime(appointment.start_datetime)}${appointment.sede_name ? ` · ${appointment.sede_name}` : ''}`}
                    />
                </dl>

                {(session.procedimiento_realizado || session.diagnostico) && <Separator />}

                {session.procedimiento_realizado && (
                    <div className="space-y-0.5">
                        <p className="text-xs text-muted-foreground">{t('sessionTab.procedure')}</p>
                        <p className="whitespace-pre-wrap text-sm">{session.procedimiento_realizado}</p>
                    </div>
                )}

                {session.diagnostico && (
                    <div className="space-y-0.5">
                        <p className="text-xs text-muted-foreground">{t('sessionTab.diagnosis')}</p>
                        <p className="whitespace-pre-wrap text-sm">{session.diagnostico}</p>
                    </div>
                )}
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
                <dd className="text-sm">{value}</dd>
            </div>
        </div>
    );
}

export default StudyOrderSessionCard;
