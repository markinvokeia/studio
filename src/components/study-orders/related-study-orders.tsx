'use client';

import * as React from 'react';
import { ArrowLeft, ChevronRight, ClipboardList, ExternalLink, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import { StudyOrderDetailPanel } from '@/components/study-orders/study-order-detail-panel';
import { StudyOrderStatusBadge } from '@/components/study-orders/study-order-status-badge';

import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { usePrintDocument } from '@/hooks/usePrintDocument';
import { useToast } from '@/hooks/use-toast';
import { formatDisplayDate } from '@/lib/utils';
import { getStudyOrders } from '@/services/study-orders';

import { STUDY_ORDERS_PERMISSIONS } from '@/constants/permissions';
import type { StudyOrderListItem } from '@/lib/types';

const LIMIT = 50;

export interface RelatedStudyOrdersProps {
    /** Órdenes de este paciente (tab Órdenes de estudio de la ficha del paciente). */
    patientId?: string;
    /** Órdenes que derivó este doctor (tab Órdenes de estudio de la ficha del doctor). */
    doctorId?: string;
}

/**
 * Las órdenes de estudio de un paciente o de un doctor, como tab de su ficha.
 *
 * Alcance:
 *  - Paciente: quien puede abrir la ficha (PATIENTS_VIEW_DETAIL) ve todas sus
 *    órdenes, las haya derivado él o no. Lo resuelve el backend con
 *    `scope=patient`; sin ese permiso cae a las propias.
 *  - Doctor: con VIEW_ALL, las de la clínica; con VIEW_MINE, las propias.
 *
 * Es de consulta: la orden se abre acá mismo, en sólo lectura. Para operarla
 * (agendar, anular, revisar…) hay un atajo a la bandeja, que sólo aparece
 * cuando quien mira puede operarla allá.
 */
export function RelatedStudyOrders({ patientId, doctorId }: RelatedStudyOrdersProps) {
    const t = useTranslations('StudyOrdersPage.related');
    const tCommon = useTranslations('StudyOrdersPage');
    const router = useRouter();
    const locale = useLocale();
    const { toast } = useToast();
    const { user } = useAuth();
    const { hasPermission } = usePermissions();
    const { printStudyOrder } = usePrintDocument();

    const canViewAll = hasPermission(STUDY_ORDERS_PERMISSIONS.VIEW_ALL);
    const canViewMine = hasPermission(STUDY_ORDERS_PERMISSIONS.VIEW_MINE);
    const scope = patientId ? 'patient' : canViewAll ? 'clinic' : 'mine';

    const [orders, setOrders] = React.useState<StudyOrderListItem[]>([]);
    const [total, setTotal] = React.useState(0);
    const [isLoading, setIsLoading] = React.useState(true);
    const [openOrder, setOpenOrder] = React.useState<StudyOrderListItem | null>(null);
    const requestRef = React.useRef(0);

    const load = React.useCallback(async () => {
        // Sólo la última respuesta escribe: cambiar de paciente rápido no puede
        // dejar en pantalla las órdenes del anterior.
        const requestId = ++requestRef.current;
        setIsLoading(true);
        const result = await getStudyOrders({ scope, patientId, doctorId, limit: LIMIT, sort: 'submitted_at:desc' });
        if (requestId !== requestRef.current) return;
        setOrders(result.items);
        setTotal(result.total);
        setIsLoading(false);
    }, [scope, patientId, doctorId]);

    React.useEffect(() => {
        setOpenOrder(null);
        void load();
        const ref = requestRef;
        return () => {
            ref.current++;
        };
    }, [load]);

    /** Dónde se puede operar la orden, si es que se puede: la bandeja de la clínica o Mis Órdenes. */
    const inboxFor = (order: StudyOrderListItem | null): string | null => {
        if (canViewAll) return 'study-orders';
        if (canViewMine && (!order || String(order.doctor_id) === String(user?.id))) return 'study-orders/mine';
        return null;
    };

    const handlePrint = React.useCallback(async (orderId: string) => {
        try {
            await printStudyOrder(orderId);
        } catch (error) {
            toast({
                variant: 'destructive',
                title: tCommon('toast.genericError'),
                description: error instanceof Error && error.message !== 'no_data' ? error.message : undefined,
            });
        }
    }, [printStudyOrder, toast, tCommon]);

    if (openOrder) {
        const inbox = inboxFor(openOrder);
        return (
            <div className="flex h-full min-h-[480px] flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2" onClick={() => setOpenOrder(null)}>
                        <ArrowLeft className="h-4 w-4" />
                        {t('back')}
                    </Button>
                    {inbox && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5"
                            onClick={() => router.push(`/${locale}/${inbox}?orderId=${encodeURIComponent(openOrder.id)}`)}
                        >
                            <ExternalLink className="h-4 w-4" />
                            {t('manageInInbox')}
                        </Button>
                    )}
                </div>
                <div className="min-h-0 flex-1">
                    <StudyOrderDetailPanel
                        orderId={openOrder.id}
                        scope={canViewAll ? 'clinic' : 'mine'}
                        readOnly
                        onClose={() => setOpenOrder(null)}
                        onPrint={(order) => void handlePrint(order.id)}
                    />
                </div>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
            </div>
        );
    }

    const listInbox = inboxFor(null);

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-muted-foreground">
                    {total > orders.length
                        ? t('countPartial', { shown: orders.length, total })
                        : t('count', { count: total })}
                </h3>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => void load()} aria-label={t('refresh')}>
                    <RefreshCw className="h-4 w-4" />
                </Button>
            </div>

            {orders.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-10 text-center">
                    <ClipboardList className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
                    <p className="text-sm text-muted-foreground">{doctorId ? t('emptyDoctor') : t('emptyPatient')}</p>
                </div>
            ) : (
                <ul className="divide-y rounded-lg border">
                    {orders.map((order) => {
                        // En la ficha del paciente importa quién la derivó; en la del doctor, para quién.
                        const counterpart = doctorId
                            ? order.patient_name
                            : order.doctor_name || order.referring_doctor_name;
                        return (
                            <li key={order.id}>
                                <button
                                    type="button"
                                    onClick={() => setOpenOrder(order)}
                                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
                                >
                                    <div className="min-w-0 flex-1 space-y-1">
                                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                            <span className="font-mono text-sm font-semibold">{order.order_number}</span>
                                            <StudyOrderStatusBadge
                                                status={order.board_status}
                                                isOverdue={order.is_overdue}
                                                itemsScheduled={Number(order.items_scheduled)}
                                                itemsTotal={Number(order.items_total)}
                                            />
                                        </div>
                                        {order.items_summary && (
                                            <p className="truncate text-sm">{order.items_summary}</p>
                                        )}
                                        <p className="truncate text-xs text-muted-foreground">
                                            {[
                                                order.submitted_at
                                                    ? t('submittedOn', { date: formatDisplayDate(order.submitted_at) })
                                                    : t('createdOn', { date: formatDisplayDate(order.created_at) }),
                                                counterpart && (doctorId
                                                    ? t('forPatient', { patient: counterpart })
                                                    : tCommon('referredByShort', { doctor: counterpart })),
                                                order.preferred_sede_name,
                                            ].filter(Boolean).join(' · ')}
                                        </p>
                                    </div>
                                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}

            {total > orders.length && listInbox && (
                <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5"
                    onClick={() => router.push(`/${locale}/${listInbox}`)}
                >
                    <ExternalLink className="h-4 w-4" />
                    {t('openInbox')}
                </Button>
            )}
        </div>
    );
}
