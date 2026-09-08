'use client';

import * as React from 'react';
import { Activity, CalendarClock, CalendarDays, CalendarPlus, FileText, Inbox, Link2, Pencil, Printer, Send, Trash2, User, UserRoundX, X, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { VerticalTabStrip, type VerticalTab } from '@/components/ui/vertical-tab-strip';

import { StudyOrderAppointmentCard } from './study-order-appointment-card';
import { StudyOrderBookingLinkTab } from './study-order-booking-link-tab';
import { StudyOrderStatusBadge } from './study-order-status-badge';
import {
    StudyOrderSummary, labelForDelivery, labelForModifier, labelForText,
    type StudyOrderSummarySection,
} from './study-order-summary';
import { StudyOrderTimeline } from './study-order-timeline';

import { STUDY_ORDERS_PERMISSIONS } from '@/constants/permissions';
import { usePermissions } from '@/hooks/usePermissions';
import { formatDisplayDate } from '@/lib/utils';
import type { StudyOrder, StudyOrderBoardStatus, StudyOrderFormOptions } from '@/lib/types';
import { getStudyOrder, getStudyOrderFormOptions } from '@/services/study-orders';

/**
 * Panel de detalle de una orden. La pestaña "Orden" es la vista precargada de
 * lo que el derivador pidió: los mismos agrupamientos, piezas y modificadores
 * del formulario, en modo lectura.
 */

export interface StudyOrderDetailPanelProps {
    orderId: string;
    scope: 'mine' | 'clinic';
    onClose: () => void;
    /**
     * Acciones de la cabecera. Cada una se muestra sólo si el estado de la orden
     * la admite y el usuario tiene el permiso; el gating vive acá porque el panel
     * tiene el dato fresco, mientras que la fila de la lista puede estar vieja.
     */
    onEdit?: (order: StudyOrder) => void;
    onSubmit?: (order: StudyOrder) => void;
    onDelete?: (order: StudyOrder) => void;
    onAcknowledge?: (order: StudyOrder) => void;
    onSchedule?: (order: StudyOrder) => void;
    /** Mover una cita existente de la orden a otra fecha y hora. */
    onReschedule?: (order: StudyOrder) => void;
    onCancel?: (order: StudyOrder) => void;
    /** Imprime la orden. Disponible en cualquier estado salvo borrador. */
    onPrint?: (order: StudyOrder) => void;
    /** Se incrementa al guardar para forzar la recarga del detalle abierto. */
    refreshKey?: number;
}

/** Reconstruye el estado de bandeja desde el detalle, que no lo trae calculado. */
function deriveBoardStatus(order: StudyOrder): StudyOrderBoardStatus {
    if (order.status === 'cancelled') return 'cancelled';
    if (order.status === 'draft') return 'draft';
    if (order.status === 'completed') return 'completed';

    const live = order.items.filter((i) => !i.is_cancelled);
    if (live.length > 0 && live.every((i) => i.is_completed)) return 'completed';
    if (live.some((i) => i.is_completed)) return 'in_progress';
    if (live.length > 0 && live.every((i) => i.is_scheduled)) return 'scheduled';
    if (live.some((i) => i.is_scheduled)) return 'partially_scheduled';
    return order.acknowledged_at ? 'unscheduled' : 'new';
}

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
    if (value === null || value === undefined || value === '') return null;
    return (
        <div className="space-y-0.5">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-sm">{value}</dd>
        </div>
    );
}

export function StudyOrderDetailPanel({
    orderId, scope, onClose, refreshKey = 0,
    onEdit, onSubmit, onDelete, onAcknowledge, onSchedule, onReschedule, onCancel, onPrint,
}: StudyOrderDetailPanelProps) {
    const t = useTranslations('StudyOrdersPage');
    const { hasPermission } = usePermissions();

    const [order, setOrder] = React.useState<StudyOrder | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [activeTab, setActiveTab] = React.useState('order');

    React.useEffect(() => {
        let cancelled = false;
        setIsLoading(true);
        void getStudyOrder(orderId).then((result) => {
            if (cancelled) return;
            setOrder(result);
            setIsLoading(false);
        });
        // Evita que una respuesta lenta de la orden anterior pise a la actual.
        return () => { cancelled = true; };
    }, [orderId, refreshKey]);

    const tabs = React.useMemo<VerticalTab[]>(
        () => [
            { id: 'order', icon: FileText, label: t('tabs.order') },
            ...(scope === 'clinic' && hasPermission(STUDY_ORDERS_PERMISSIONS.SCHEDULE)
                ? [{ id: 'appointments', icon: CalendarDays, label: t('tabs.appointments') }]
                : []),
            ...(scope === 'clinic'
                ? [{ id: 'patient', icon: User, label: t('tabs.patient') }]
                : []),
            ...(hasPermission(STUDY_ORDERS_PERMISSIONS.SHARE_LINK)
                ? [{ id: 'link', icon: Link2, label: t('tabs.link') }]
                : []),
            { id: 'activity', icon: Activity, label: t('tabs.activity') },
        ],
        [t, scope, hasPermission],
    );

    /** Agrupa las líneas por sección, respetando el orden del formulario. */
    const itemsBySection = React.useMemo(() => {
        if (!order) return [];
        const map = new Map<string, StudyOrder['items']>();
        for (const item of order.items) {
            const bucket = map.get(item.section_code);
            if (bucket) bucket.push(item);
            else map.set(item.section_code, [item]);
        }
        return Array.from(map.entries());
    }, [order]);

    /**
     * Mismas reglas que las acciones de la fila: qué se puede hacer depende del
     * estado de la orden, no de la vista desde la que se la mire.
     */
    const headerActions = React.useMemo(() => {
        if (!order) return [];
        const isDraft = order.status === 'draft';
        const isSubmitted = order.status === 'submitted';
        const isClinic = scope === 'clinic';
        const can = (code: string) => hasPermission(code);

        const actions: Array<{
            key: string; label: string; icon: React.ElementType;
            onClick: () => void; variant: 'default' | 'destructive';
            /** Motivo por el que no se puede usar. Presente = botón gris con tooltip. */
            disabledReason?: string;
        }> = [];

        if (isDraft && onEdit && can(STUDY_ORDERS_PERMISSIONS.UPDATE)) {
            actions.push({ key: 'edit', label: t('actions.edit'), icon: Pencil, onClick: () => onEdit(order), variant: 'default' });
        }
        if (isDraft && onSubmit && can(STUDY_ORDERS_PERMISSIONS.SUBMIT)) {
            actions.push({ key: 'submit', label: t('actions.submit'), icon: Send, onClick: () => onSubmit(order), variant: 'default' });
        }

        // Tomar y agendar son trabajo de la clínica: no aparecen en Mis Órdenes
        // ni siquiera para un administrador, que sí tiene los permisos.
        if (isClinic && isSubmitted && !order.acknowledged_at && onAcknowledge && can(STUDY_ORDERS_PERMISSIONS.ACKNOWLEDGE)) {
            actions.push({ key: 'ack', label: t('actions.acknowledge'), icon: Inbox, onClick: () => onAcknowledge(order), variant: 'default' });
        }
        // Con todas las líneas ya cubiertas por una cita, la orden sale del
        // panel: mover o reprogramar esa cita es trabajo del calendario, que es
        // donde se ven los huecos, las sedes y los choques de agenda. Acá sólo
        // se ofrece agendar mientras quede algo sin agendar.
        const activeItems = (order.items ?? []).filter((i) => !i.is_cancelled);
        const isFullyScheduled = activeItems.length > 0 && activeItems.every((i) => i.is_scheduled);

        if (isClinic && isSubmitted && !isFullyScheduled && onSchedule && can(STUDY_ORDERS_PERMISSIONS.SCHEDULE)) {
            actions.push({ key: 'schedule', label: t('actions.schedule'), icon: CalendarPlus, onClick: () => onSchedule(order), variant: 'default' });
        }
        // Reagendar aparece cuando hay una cita que todavía se puede mover: una
        // ya atendida o cancelada no se toca.
        const hasMovable = (order.appointments ?? []).some(
            (a) => !['completed', 'cancelled', 'deleted', 'no_show'].includes(a.status),
        );
        if (isClinic && hasMovable && !isFullyScheduled && onReschedule && can(STUDY_ORDERS_PERMISSIONS.SCHEDULE)) {
            actions.push({ key: 'reschedule', label: t('actions.reschedule'), icon: CalendarClock, onClick: () => onReschedule(order), variant: 'default' });
        }

        // Imprimir: cualquiera que pueda ver la orden puede llevársela en papel.
        // No se ofrece en borrador — lo que no se envió todavía puede cambiar, y
        // un papel con una orden que después se editó es peor que ningún papel.
        if (!isDraft && onPrint) {
            actions.push({ key: 'print', label: t('actions.print'), icon: Printer, onClick: () => onPrint(order), variant: 'default' });
        }

        if (isDraft && onDelete && can(STUDY_ORDERS_PERMISSIONS.DELETE)) {
            actions.push({ key: 'delete', label: t('actions.delete'), icon: Trash2, onClick: () => onDelete(order), variant: 'destructive' });
        }

        // Anular: la clínica siempre; el derivador sólo mientras nadie la haya
        // tomado. Ya tomada, el botón queda a la vista pero gris y explica por qué
        // — es más útil que esconderlo y dejar al doctor buscándolo.
        if (isSubmitted && onCancel) {
            const clinicMayCancel = isClinic && can(STUDY_ORDERS_PERMISSIONS.CANCEL);
            const ownerMayCancel = !isClinic;
            if (clinicMayCancel || ownerMayCancel) {
                const blocked = ownerMayCancel && !clinicMayCancel && !!order.acknowledged_at;
                actions.push({
                    key: 'cancel',
                    label: t('actions.cancel'),
                    icon: XCircle,
                    onClick: () => onCancel(order),
                    variant: 'destructive',
                    disabledReason: blocked ? t('actions.cancelBlocked') : undefined,
                });
            }
        }

        return actions;
    }, [order, scope, hasPermission, t, onEdit, onSubmit, onDelete, onAcknowledge, onSchedule, onReschedule, onCancel, onPrint]);

    if (isLoading) {
        return (
            <Card className="flex h-full flex-col border-0 shadow-none lg:border lg:shadow-sm">
                <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
                <CardContent className="space-y-3">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-32 w-full" />
                </CardContent>
            </Card>
        );
    }

    if (!order) {
        return (
            <Card className="flex h-full flex-col items-center justify-center border-0 shadow-none lg:border lg:shadow-sm">
                <p className="text-sm text-muted-foreground">{t('noResults')}</p>
            </Card>
        );
    }

    return (
        <Card className="flex h-full flex-col border-0 shadow-none lg:border lg:shadow-sm">
            <CardHeader className="flex flex-col gap-3 space-y-0 pb-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="font-mono text-base tabular-nums">{order.order_number}</CardTitle>
                        <StudyOrderStatusBadge status={deriveBoardStatus(order)} />
                    </div>
                    <p className="truncate text-sm text-muted-foreground">{order.patient_name}</p>
                </div>
                {/* En mobile la botonera cae debajo del número; en escritorio va a la derecha. */}
                <div className="flex flex-wrap items-center gap-1.5 sm:shrink-0 sm:justify-end">
                    {headerActions.map(({ key, label, icon: Icon, onClick, variant, disabledReason }) => {
                        const button = (
                            <Button
                                key={key}
                                variant={variant}
                                size="sm"
                                onClick={onClick}
                                disabled={!!disabledReason}
                            >
                                <Icon className="mr-2 h-4 w-4" />
                                {label}
                            </Button>
                        );
                        if (!disabledReason) return button;
                        return (
                            <TooltipProvider key={key} delayDuration={200}>
                                <Tooltip>
                                    {/* Un botón deshabilitado no emite eventos de puntero:
                                        el envoltorio es lo que hace que el tooltip aparezca. */}
                                    <TooltipTrigger asChild>
                                        <span className="inline-flex cursor-not-allowed">{button}</span>
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-xs">{disabledReason}</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        );
                    })}
                    <Button variant="ghost" size="icon" onClick={onClose} aria-label={t('submitDialog.cancel')}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </CardHeader>

            <VerticalTabStrip tabs={tabs} activeTabId={activeTab} onTabClick={(tab) => setActiveTab(tab.id)} />

            <CardContent className="flex-1 space-y-4 overflow-y-auto pt-4">
                {activeTab === 'order' && <OrderTab order={order} />}

                {activeTab === 'appointments' && (
                    <div className="space-y-3">
                        {(order.appointments ?? []).map((appointment) => (
                            <StudyOrderAppointmentCard key={appointment.id} appointment={appointment} />
                        ))}
                        {(order.appointments ?? []).length === 0 && (
                            <p className="py-6 text-center text-sm text-muted-foreground">
                                {t('appointmentCard.none')}
                            </p>
                        )}
                    </div>
                )}

                {activeTab === 'patient' && <PatientTab order={order} />}

                {activeTab === 'link' && (
                    <StudyOrderBookingLinkTab order={order} />
                )}

                {activeTab === 'activity' && <StudyOrderTimeline events={order.events ?? []} />}
            </CardContent>
        </Card>
    );
}

/**
 * Ficha del paciente, sólo lectura y sólo datos básicos.
 *
 * Nada financiero a propósito: la pestaña contesta "a quién estoy atendiendo",
 * no "cuánto debe". Para lo otro está el estado de cuenta, que tiene su propio
 * permiso.
 *
 * Cuando la orden todavía no está vinculada a una ficha —el derivador la cargó
 * a mano— se muestran igual los datos sueltos que trae la orden, avisando que
 * son eso. Esconderlos sería peor: son los únicos que hay.
 */
function PatientTab({ order }: { order: StudyOrder }) {
    const t = useTranslations('StudyOrdersPage');
    const p = order.patient;

    if (!p) {
        return (
            <div className="space-y-3">
                <div className="flex items-start gap-2.5 rounded-lg border border-dashed p-3">
                    <UserRoundX className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <p className="text-sm text-muted-foreground">{t('patientTab.notLinked')}</p>
                </div>
                <dl className="grid grid-cols-2 gap-3">
                    <Field label={t('form.patientName')} value={order.patient_name} />
                    <Field label={t('form.patientDocument')} value={order.patient_document} />
                    <Field label={t('form.patientPhone')} value={order.patient_phone} />
                    <Field label={t('form.patientEmail')} value={order.patient_email} />
                </dl>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {p.name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
                </span>
                <div className="min-w-0">
                    <p className="truncate font-semibold">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                        {[p.internal_id, p.identity_document].filter(Boolean).join(' · ')}
                    </p>
                </div>
                {p.is_active === false && (
                    <Badge variant="destructive" className="ml-auto shrink-0">{t('patientTab.inactive')}</Badge>
                )}
            </div>

            <Separator />

            <dl className="grid grid-cols-2 gap-3">
                <Field label={t('patientTab.birthday')} value={birthdayLabel(p.birthday, t)} />
                <Field label={t('patientTab.sex')} value={p.sex} />
                <Field label={t('form.patientPhone')} value={p.phone_number} />
                <Field label={t('patientTab.alternativePhone')} value={p.alternative_phone} />
                <Field label={t('form.patientEmail')} value={p.email} />
                <Field label={t('patientTab.mutualSociety')} value={p.mutual_society_name} />
                <Field label={t('patientTab.assignedDoctor')} value={p.assigned_doctor_name} />
            </dl>

            {p.address && (
                <>
                    <Separator />
                    <Field label={t('patientTab.address')} value={p.address} />
                </>
            )}
        </div>
    );
}

/**
 * Fecha de nacimiento con la edad al lado, que es lo que se mira en la clínica.
 * La fecha se corta antes de parsear: `new Date` sobre un ISO con zona puede
 * correr el día y cambiar la edad justo en el cumpleaños.
 */
function birthdayLabel(
    birthday: string | null | undefined,
    t: ReturnType<typeof useTranslations<'StudyOrdersPage'>>,
): string | null {
    if (!birthday) return null;
    const shown = formatDisplayDate(birthday);
    const born = new Date(`${birthday.replace('Z', '').split('T')[0]}T00:00:00`);
    if (Number.isNaN(born.getTime())) return shown;

    const now = new Date();
    let age = now.getFullYear() - born.getFullYear();
    const beforeBirthday = now.getMonth() < born.getMonth()
        || (now.getMonth() === born.getMonth() && now.getDate() < born.getDate());
    if (beforeBirthday) age -= 1;

    return age >= 0 && age < 130 ? `${shown} (${t('patientTab.years', { age })})` : shown;
}

/**
 * La orden, con el mismo resumen que el derivador confirmó al enviarla.
 *
 * Comparte componente con el último paso del asistente a propósito: lo que se
 * revisa antes de mandar y lo que se lee después tiene que ser idéntico. Antes
 * esta pestaña maquetaba lo suyo y, además, mostraba los códigos crudos de las
 * secciones y los modificadores; el catálogo que los traduce es el mismo que
 * arma el formulario, así que se pide acá y se resuelven igual que allá.
 */
function OrderTab({ order }: { order: StudyOrder }) {
    const t = useTranslations('StudyOrdersPage');
    const [options, setOptions] = React.useState<StudyOrderFormOptions | null>(null);

    React.useEffect(() => {
        let cancelled = false;
        void getStudyOrderFormOptions().then((fetched) => {
            if (!cancelled) setOptions(fetched);
        });
        return () => { cancelled = true; };
    }, []);

    /**
     * Las líneas guardadas, agrupadas por sección. Se recorre el catálogo y no
     * las líneas para respetar el orden del formulario; una sección cuyo código
     * ya no exista en el catálogo se agrega igual al final, con su código por
     * nombre, para que una orden vieja no pierda contenido en pantalla.
     */
    const sections = React.useMemo<StudyOrderSummarySection[]>(() => {
        const itemsByCode = new Map<string, StudyOrder['items']>();
        for (const item of order.items) {
            const bucket = itemsByCode.get(item.section_code);
            if (bucket) bucket.push(item);
            else itemsByCode.set(item.section_code, [item]);
        }

        const toSummary = (code: string, name: string, color?: string | null): StudyOrderSummarySection => ({
            code,
            name,
            color,
            teeth: order.regions?.[code] ?? [],
            items: (itemsByCode.get(code) ?? []).map((item) => ({
                id: item.id,
                name: item.service_name,
                modifiers: Object.values(item.modifiers ?? {}).flat()
                    .map((mod) => labelForModifier(options, mod)),
                notes: item.notes,
                isCancelled: item.is_cancelled,
                isScheduled: item.is_scheduled,
                isCompleted: item.is_completed,
            })),
        });

        const known = options?.sections ?? [];
        const knownCodes = new Set(known.map((s) => s.code));
        const orphanCodes = [...itemsByCode.keys(), ...Object.keys(order.regions ?? {})]
            .filter((code) => !knownCodes.has(code));

        return [
            ...known.map((section) => toSummary(section.code, section.name, section.color)),
            ...Array.from(new Set(orphanCodes)).map((code) => toSummary(code, code)),
        ];
    }, [order, options]);

    const texts = React.useMemo(
        () => Object.entries(order.texts ?? {})
            .filter(([, value]) => (value ?? '').trim())
            .map(([code, value]) => ({ label: labelForText(options, code), value })),
        [order.texts, options],
    );

    return (
        <StudyOrderSummary
            patientName={order.patient_name}
            patientDocument={order.patient_document}
            patientPhone={order.patient_phone}
            patientEmail={order.patient_email}
            deliveryLabels={(order.delivery_methods ?? []).map((code) => labelForDelivery(options, code))}
            sections={sections}
            texts={texts}
            clinicalNotes={order.clinical_notes}
            header={
                <dl className="mt-3 grid grid-cols-2 gap-3 border-t pt-3">
                    <Field label={t('columns.doctor')} value={order.doctor_name} />
                    <Field label={t('form.preferredSede')} value={order.preferred_sede_name} />
                </dl>
            }
        />
    );
}

export default StudyOrderDetailPanel;
