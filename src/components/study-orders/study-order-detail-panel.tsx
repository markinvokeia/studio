'use client';

import * as React from 'react';
import { Activity, CalendarClock, CalendarDays, CalendarPlus, FileText, Inbox, Link2, Pencil, Send, Trash2, User, X, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { VerticalTabStrip, type VerticalTab } from '@/components/ui/vertical-tab-strip';

import { StudyOrderStatusBadge } from './study-order-status-badge';
import { ToothGridPicker } from './tooth-grid-picker';

import { STUDY_ORDERS_PERMISSIONS } from '@/constants/permissions';
import { usePermissions } from '@/hooks/usePermissions';
import { formatDateTime } from '@/lib/utils';
import type { StudyOrder, StudyOrderBoardStatus } from '@/lib/types';
import { getStudyOrder } from '@/services/study-orders';

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
    onEdit, onSubmit, onDelete, onAcknowledge, onSchedule, onReschedule, onCancel,
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
        if (isClinic && isSubmitted && onSchedule && can(STUDY_ORDERS_PERMISSIONS.SCHEDULE)) {
            actions.push({ key: 'schedule', label: t('actions.schedule'), icon: CalendarPlus, onClick: () => onSchedule(order), variant: 'default' });
        }
        // Reagendar aparece cuando hay una cita que todavía se puede mover: una
        // ya atendida o cancelada no se toca.
        const hasMovable = (order.appointments ?? []).some(
            (a) => !['completed', 'cancelled', 'deleted', 'no_show'].includes(a.status),
        );
        if (isClinic && hasMovable && onReschedule && can(STUDY_ORDERS_PERMISSIONS.SCHEDULE)) {
            actions.push({ key: 'reschedule', label: t('actions.reschedule'), icon: CalendarClock, onClick: () => onReschedule(order), variant: 'default' });
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
    }, [order, scope, hasPermission, t, onEdit, onSubmit, onDelete, onAcknowledge, onSchedule, onReschedule, onCancel]);

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
                {activeTab === 'order' && (
                    <>
                        <dl className="grid grid-cols-2 gap-3">
                            <Field label={t('form.patientDocument')} value={order.patient_document} />
                            <Field label={t('form.patientPhone')} value={order.patient_phone} />
                            <Field label={t('columns.doctor')} value={order.doctor_name} />
                            <Field label={t('form.preferredSede')} value={order.preferred_sede_name} />
                        </dl>

                        {order.delivery_methods.length > 0 && (
                            <div className="space-y-1.5">
                                <p className="text-xs text-muted-foreground">{t('form.deliverySection')}</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {order.delivery_methods.map((method) => (
                                        <Badge key={method} variant="outline">{method}</Badge>
                                    ))}
                                </div>
                            </div>
                        )}

                        <Separator />

                        {itemsBySection.map(([sectionCode, items]) => (
                            <div key={sectionCode} className="space-y-2">
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    {sectionCode}
                                </p>
                                <ul className="space-y-1.5">
                                    {items.map((item) => (
                                        <li key={item.id} className="text-sm">
                                            <div className="flex items-start justify-between gap-2">
                                                <span className={item.is_cancelled ? 'line-through opacity-60' : ''}>
                                                    {item.service_name}
                                                </span>
                                                {item.is_completed ? (
                                                    <Badge variant="success" className="shrink-0">{t('status.completed')}</Badge>
                                                ) : item.is_scheduled ? (
                                                    <Badge variant="default" className="shrink-0">{t('status.scheduled')}</Badge>
                                                ) : null}
                                            </div>
                                            {Object.values(item.modifiers ?? {}).flat().length > 0 && (
                                                <p className="mt-0.5 text-xs text-muted-foreground">
                                                    {Object.values(item.modifiers).flat().join(' · ')}
                                                </p>
                                            )}
                                            {item.notes && (
                                                <p className="mt-0.5 text-xs italic text-muted-foreground">{item.notes}</p>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                                {order.regions[sectionCode]?.length > 0 && (
                                    <ToothGridPicker
                                        value={order.regions[sectionCode]}
                                        onChange={() => { /* sólo lectura */ }}
                                        disabled
                                        testIdPrefix={`detail-tooth-${sectionCode.toLowerCase()}`}
                                    />
                                )}
                            </div>
                        ))}

                        {order.clinical_notes && (
                            <>
                                <Separator />
                                <div className="space-y-1">
                                    <p className="text-xs text-muted-foreground">{t('form.clinicalNotes')}</p>
                                    <p className="whitespace-pre-wrap text-sm">{order.clinical_notes}</p>
                                </div>
                            </>
                        )}
                    </>
                )}

                {activeTab === 'appointments' && (
                    <ul className="space-y-2">
                        {(order.appointments ?? []).map((appointment) => (
                            <li key={appointment.id} className="rounded-md border p-3 text-sm">
                                <div className="flex items-center justify-between gap-2">
                                    <span>{formatDateTime(appointment.start_datetime)}</span>
                                    <Badge variant="outline">{appointment.status}</Badge>
                                </div>
                                {appointment.sede_name && (
                                    <p className="mt-1 text-xs text-muted-foreground">{appointment.sede_name}</p>
                                )}
                            </li>
                        ))}
                        {(order.appointments ?? []).length === 0 && (
                            <p className="text-sm text-muted-foreground">{t('noResults')}</p>
                        )}
                    </ul>
                )}

                {activeTab === 'patient' && (
                    <dl className="grid grid-cols-2 gap-3">
                        <Field label={t('form.patientName')} value={order.patient_name} />
                        <Field label={t('form.patientDocument')} value={order.patient_document} />
                        <Field label={t('form.patientPhone')} value={order.patient_phone} />
                        <Field label={t('form.patientEmail')} value={order.patient_email} />
                    </dl>
                )}

                {activeTab === 'link' && (
                    <p className="text-sm text-muted-foreground">{t('actions.shareLink')}</p>
                )}

                {activeTab === 'activity' && (
                    <dl className="space-y-3">
                        <Field label={t('columns.submittedAt')} value={order.submitted_at ? formatDateTime(order.submitted_at) : null} />
                        <Field label={t('actions.acknowledge')} value={order.acknowledged_at ? formatDateTime(order.acknowledged_at) : null} />
                        <Field label={t('status.completed')} value={order.completed_at ? formatDateTime(order.completed_at) : null} />
                        <Field label={t('status.cancelled')} value={order.cancelled_at ? formatDateTime(order.cancelled_at) : null} />
                        <Field label={t('cancelDialog.reasonLabel')} value={order.cancellation_reason} />
                    </dl>
                )}
            </CardContent>
        </Card>
    );
}

export default StudyOrderDetailPanel;
