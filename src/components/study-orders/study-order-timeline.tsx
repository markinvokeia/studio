'use client';

import * as React from 'react';
import {
    Ban, CalendarClock, CalendarPlus, CalendarX, CheckCircle2, FilePlus2,
    Inbox, Link2, ListChecks, Pencil, RotateCcw, Send, Stethoscope, UserMinus, UserPlus, UserRound,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn, formatDateTime } from '@/lib/utils';
import type { StudyOrderEvent, StudyOrderEventType, StudyOrderFieldChange } from '@/lib/types';

/**
 * Línea de tiempo de la orden: qué pasó, quién lo hizo y cuándo.
 *
 * Se lee de arriba abajo en el orden en que ocurrió, que es como se cuenta una
 * historia. El hito más reciente queda resaltado porque es el que contesta la
 * pregunta que trae a alguien a esta pestaña: "¿en qué quedó?".
 *
 * Los eventos los escribe el backend en `study_order_events`. Un tipo que este
 * archivo no conozca se dibuja igual, con icono y texto neutros, en vez de
 * romper la pestaña: la lista de tipos vive en la base y puede crecer sin que
 * el front se entere.
 */

export interface EventStyle {
    icon: React.ElementType;
    /** Color del punto en la línea. Los hitos malos van en rojo, los buenos en verde. */
    tone: 'neutral' | 'good' | 'bad' | 'accent';
}

/** Compartido con el chatter (study-order-chatter.tsx), que pinta los mismos eventos. */
export const EVENT_STYLES: Record<StudyOrderEventType, EventStyle> = {
    created:               { icon: FilePlus2,     tone: 'neutral' },
    updated:               { icon: Pencil,        tone: 'neutral' },
    submitted:             { icon: Send,          tone: 'accent' },
    acknowledged:          { icon: Inbox,         tone: 'accent' },
    scheduled:             { icon: CalendarPlus,  tone: 'accent' },
    rescheduled:           { icon: CalendarClock, tone: 'neutral' },
    appointment_updated:   { icon: Pencil,        tone: 'neutral' },
    appointment_cancelled: { icon: CalendarX,     tone: 'bad' },
    session_saved:         { icon: Stethoscope,   tone: 'good' },
    completed:             { icon: CheckCircle2,  tone: 'good' },
    reopened:              { icon: RotateCcw,     tone: 'bad' },
    cancelled:             { icon: Ban,           tone: 'bad' },
    link_created:          { icon: Link2,         tone: 'neutral' },
    patient_booked:        { icon: UserRound,     tone: 'accent' },
    review_updated:        { icon: ListChecks,    tone: 'neutral' },
    assigned:              { icon: UserPlus,      tone: 'accent' },
    unassigned:            { icon: UserMinus,     tone: 'neutral' },
};

export const TONE_CLASSES: Record<EventStyle['tone'], string> = {
    neutral: 'bg-muted text-muted-foreground ring-border',
    accent:  'bg-primary/10 text-primary ring-primary/20',
    good:    'bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400',
    bad:     'bg-destructive/10 text-destructive ring-destructive/20',
};

export interface StudyOrderTimelineProps {
    events: StudyOrderEvent[];
}

export function StudyOrderTimeline({ events }: StudyOrderTimelineProps) {
    const t = useTranslations('StudyOrdersPage.timeline');

    if (events.length === 0) {
        return <p className="py-6 text-center text-sm text-muted-foreground">{t('empty')}</p>;
    }

    return (
        <ol className="relative space-y-0">
            {events.map((event, index) => {
                // Un tipo que este archivo no conoce se dibuja igual, en neutro y
                // con su código crudo por texto. next-intl revienta con una clave
                // que no existe, así que la traducción sólo se pide para los
                // tipos declarados arriba.
                const style = EVENT_STYLES[event.event_type];
                const Icon = style?.icon ?? FilePlus2;
                const isLast = index === events.length - 1;

                return (
                    <li key={event.id} className="relative flex gap-3 pb-4 last:pb-0">
                        {/* El hilo que une los hitos. No se dibuja bajo el último,
                            si no la línea queda colgando en el vacío. */}
                        {!isLast && (
                            <span
                                aria-hidden="true"
                                className="absolute left-[13px] top-8 h-[calc(100%-1.5rem)] w-px bg-border"
                            />
                        )}

                        <span
                            className={cn(
                                'relative z-10 mt-0.5 grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full ring-1',
                                TONE_CLASSES[style?.tone ?? 'neutral'],
                            )}
                        >
                            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                        </span>

                        <div
                            className={cn(
                                'min-w-0 flex-1 rounded-lg px-2.5 py-1.5 transition-colors',
                                isLast && 'bg-muted/50',
                            )}
                        >
                            <p className="text-sm font-medium leading-snug">
                                {style ? t(`event.${event.event_type}` as never) : event.event_type}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                                <ActorLabel event={event} />
                                {' · '}
                                <time dateTime={event.created_at}>{formatDateTime(event.created_at)}</time>
                            </p>
                            <EventDetail event={event} />
                        </div>
                    </li>
                );
            })}
        </ol>
    );
}

/** Quién lo hizo. Sin persona detrás, se dice qué fue en vez de dejarlo vacío. */
export function ActorLabel({ event }: { event: StudyOrderEvent }) {
    const t = useTranslations('StudyOrdersPage.timeline');
    if (event.actor_name) return <span className="font-medium text-foreground">{event.actor_name}</span>;
    if (event.actor_kind === 'patient') return <>{t('actorPatient')}</>;
    return <>{t('actorSystem')}</>;
}

/**
 * El detalle que trae el evento en su metadata. Sólo se pintan las claves que
 * este archivo sabe leer: el resto se ignora en silencio, que es preferible a
 * volcar un JSON crudo en la cara del usuario.
 */
export function EventDetail({ event }: { event: StudyOrderEvent }) {
    const t = useTranslations('StudyOrdersPage.timeline');
    const meta = event.metadata ?? {};

    const reason = typeof meta.reason === 'string' ? meta.reason : null;
    const toStart = typeof meta.to_start === 'string' ? meta.to_start : null;
    const procedure = typeof meta.procedimiento_realizado === 'string' ? meta.procedimiento_realizado : null;
    // Punto a revisar marcado: qué dato, cómo quedó y la nota, si dejó una.
    const reviewStatus = event.event_type === 'review_updated' && typeof meta.status === 'string' ? meta.status : null;
    const reviewLabel = reviewStatus
        ? [meta.label, meta.value].filter((v) => typeof v === 'string' && v).join(': ')
        : null;
    const reviewNote = reviewStatus && typeof meta.note === 'string' ? meta.note : null;
    // Asignación: a quién (y a quién se le sacó, si tenía otro responsable).
    const assignee = event.event_type === 'assigned' && typeof meta.assignee_name === 'string' ? meta.assignee_name : null;
    const previousAssignee = (event.event_type === 'assigned' || event.event_type === 'unassigned')
        && typeof meta.previous_assignee_name === 'string' ? meta.previous_assignee_name : null;

    // Edición de la orden: qué campos cambiaron, "anterior → nuevo" (como el tracking de Odoo).
    const changes = event.event_type === 'updated' ? readFieldChanges(meta.changes) : [];

    const hasSummary = !!(reason || toStart || procedure || reviewStatus || assignee || previousAssignee);
    if (!hasSummary && changes.length === 0) return null;

    return (
        <>
            {changes.length > 0 && <FieldChanges changes={changes} />}
            {hasSummary && (
                <p className="mt-1 text-xs text-muted-foreground">
                    {reviewStatus && (
                        <span>
                            {reviewLabel}
                            {' → '}
                            {['pending', 'confirmed', 'corrected', 'dismissed'].includes(reviewStatus)
                                ? t(`reviewStatus.${reviewStatus}` as never)
                                : reviewStatus}
                            {reviewNote && <span className="italic"> · {reviewNote}</span>}
                        </span>
                    )}
                    {assignee && <span>{t('assignedTo', { name: assignee })}</span>}
                    {assignee && previousAssignee && ' · '}
                    {previousAssignee && <span className="italic">{t('previouslyAssigned', { name: previousAssignee })}</span>}
                    {toStart && <span className="italic">{t('movedTo', { date: formatDateTime(toStart) })}</span>}
                    {reason && <span className="italic">{reason}</span>}
                    {procedure && <span className="italic">{procedure}</span>}
                </p>
            )}
        </>
    );
}

/** Campos que registra el upsert (study-orders-sql.mjs, CTE `tracked`). Uno desconocido se muestra con su código. */
const TRACKED_FIELDS = [
    'patient_name', 'patient_document', 'patient_phone', 'patient_email', 'preferred_sede',
    'referring_doctor_name', 'delivery_methods', 'clinical_notes', 'services_added', 'services_removed',
] as const;

/** La metadata viene de la base: se valida la forma antes de pintarla. */
function readFieldChanges(raw: unknown): StudyOrderFieldChange[] {
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((c) => {
        if (!c || typeof c !== 'object' || typeof (c as { field?: unknown }).field !== 'string') return [];
        const { field, old: before, new: after } = c as { field: string; old?: unknown; new?: unknown };
        return [{
            field,
            old: typeof before === 'string' ? before : null,
            new: typeof after === 'string' ? after : null,
        }];
    });
}

function FieldChanges({ changes }: { changes: StudyOrderFieldChange[] }) {
    const t = useTranslations('StudyOrdersPage.timeline');
    const label = (field: string) => (TRACKED_FIELDS as readonly string[]).includes(field)
        ? t(`fields.${field}` as never)
        : field;

    return (
        <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
            {changes.map((change) => (
                <li key={change.field} className="break-words">
                    <span>{label(change.field)}: </span>
                    {/* Estudios agregados o quitados: una lista, no un valor que se reemplaza. */}
                    {change.field === 'services_added' || change.field === 'services_removed' ? (
                        <span className="text-foreground">{change.new ?? change.old}</span>
                    ) : (
                        <>
                            <span className={cn(!change.old && 'italic')}>{change.old || t('emptyValue')}</span>
                            <span aria-hidden="true"> → </span>
                            <span className={cn('font-medium text-foreground', !change.new && 'italic')}>
                                {change.new || t('emptyValue')}
                            </span>
                        </>
                    )}
                </li>
            ))}
        </ul>
    );
}

export default StudyOrderTimeline;
