'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { cn, formatDisplayDate } from '@/lib/utils';
import type { StudyOrderBoardStatus, StudyOrderListItem } from '@/lib/types';
import { getStudyOrder, getStudyOrderByAppointment, getStudyOrders } from '@/services/study-orders';
import { useStudyOrderScheduling } from '@/stores/study-order-scheduling-store';

/**
 * Selector de la orden de estudio a la que pertenece una cita.
 *
 * Trae las órdenes del paciente y pone arriba las que todavía no están
 * agendadas, que son las que el operario está buscando. Cada opción muestra el
 * número y el estado, para no tener que abrir la orden para saber en qué anda.
 *
 * Al elegir una, devuelve sus servicios por `onServicesResolved` para que el
 * diálogo los cargue en la cita. Resolverlos acá, después de montar, evita la
 * carrera que tenía la precarga por `initialData`: cuando el diálogo se abre
 * desde un deep link, los servicios todavía no habían llegado.
 *
 * El selector también manda su elección al store de la operación en curso. Es
 * lo que mantiene una sola fuente de verdad: el guardado ata la cita leyendo el
 * store, así que si el operario pone "Sin orden asociada" acá, el aviso
 * desaparece y la cita no se ata. Antes el selector y el aviso podían decir
 * cosas distintas.
 */

/** Las que faltan agendar primero; dentro de cada grupo, lo más nuevo arriba. */
const STATUS_RANK: Record<StudyOrderBoardStatus, number> = {
    new: 0,
    unscheduled: 0,
    partially_scheduled: 1,
    scheduled: 2,
    in_progress: 3,
    completed: 4,
    draft: 5,
    cancelled: 6,
};

export interface StudyOrderPickerProps {
    patientId?: string | null;
    value?: string | null;
    onChange: (orderId: string | null) => void;
    /** Servicios de la orden elegida, ya resueltos contra el catálogo. */
    onServicesResolved?: (serviceIds: string[]) => void;
    disabled?: boolean;
    /**
     * Modo compacto para la tarjeta inline del calendario: sin etiqueta y con
     * el mismo alto y tipografía que los demás selectores de esa tarjeta, donde
     * ningún campo lleva label.
     */
    compact?: boolean;
    /**
     * Cita que se está editando. Al abrirla se consulta qué orden tiene atada y
     * se muestra seleccionada: ese dato no viene con los datos de la cita.
     */
    appointmentId?: string | null;
}

export function StudyOrderPicker({
    patientId,
    value,
    onChange,
    onServicesResolved,
    disabled = false,
    compact = false,
    appointmentId,
}: StudyOrderPickerProps) {
    const t = useTranslations('StudyOrdersPage');
    const tStatus = useTranslations('StudyOrdersPage.status');

    const [orders, setOrders] = React.useState<StudyOrderListItem[]>([]);
    const [isLoading, setIsLoading] = React.useState(false);
    const { start: startScheduling, clear: clearScheduling } = useStudyOrderScheduling();

    // Los callbacks van por ref para no re-disparar la carga cuando el padre
    // recrea la función en cada render.
    const onServicesRef = React.useRef(onServicesResolved);
    const onChangeRef = React.useRef(onChange);
    React.useEffect(() => {
        onServicesRef.current = onServicesResolved;
        onChangeRef.current = onChange;
    });

    React.useEffect(() => {
        if (!patientId) {
            setOrders([]);
            return;
        }
        let cancelled = false;
        setIsLoading(true);
        void getStudyOrders({ scope: 'clinic', patientId, limit: 50 }).then(({ items }) => {
            if (cancelled) return;
            const sorted = [...items].sort((a, b) => {
                const rank = STATUS_RANK[a.board_status] - STATUS_RANK[b.board_status];
                if (rank !== 0) return rank;
                return (b.submitted_at ?? b.created_at).localeCompare(a.submitted_at ?? a.created_at);
            });
            setOrders(sorted);
            setIsLoading(false);
        });
        return () => { cancelled = true; };
    }, [patientId]);

    /** Trae las líneas de una orden y las devuelve como ids de servicio. */
    const resolveServices = React.useCallback(async (orderId: string) => {
        // Sin quien reciba los servicios no hace falta traer el detalle. Es el
        // caso de editar una cita: sus servicios ya están guardados y el padre
        // omite `onServicesResolved` justamente para que no se pisen.
        if (!onServicesRef.current) return;
        const order = await getStudyOrder(orderId);
        if (!order) return;
        // Se priorizan las líneas que faltan agendar; si están todas
        // agendadas se ofrecen igual todas, que es el caso de reagendar.
        const pending = order.items.filter((i) => !i.is_cancelled && !i.is_scheduled);
        const chosen = pending.length > 0 ? pending : order.items.filter((i) => !i.is_cancelled);
        onServicesRef.current?.(chosen.map((i) => i.service_id));
    }, []);

    // Al abrir una cita existente se busca su orden y se muestra seleccionada,
    // sin tocar los servicios: la cita ya tiene los suyos guardados.
    const resolvedForAppointmentRef = React.useRef<string | null>(null);
    React.useEffect(() => {
        if (!appointmentId || resolvedForAppointmentRef.current === appointmentId) return;
        resolvedForAppointmentRef.current = appointmentId;
        void getStudyOrderByAppointment(appointmentId).then((order) => {
            if (order) onChangeRef.current(order.id);
        });
    }, [appointmentId]);

    // Cuando la orden llega preseleccionada (se entró desde "Agendar"), sus
    // estudios se cargan solos: el operario no tiene que volver a elegirla.
    //
    // Sólo corre si el padre pasó `onServicesResolved`, que es su forma de decir
    // "esta cita es nueva". Editando una existente los servicios ya están
    // guardados y no hay que tocarlos.
    const autoResolvedRef = React.useRef<string | null>(null);
    React.useEffect(() => {
        if (!value || autoResolvedRef.current === value) return;
        autoResolvedRef.current = value;
        void resolveServices(value);
    }, [value, resolveServices]);

    // Al elegir una orden se traen sus líneas y se devuelven al diálogo.
    const handleChange = React.useCallback((next: string) => {
        const orderId = next === '__none__' ? null : next;
        onChange(orderId);

        if (!orderId) {
            // Sin orden: se corta la operación, así el aviso no queda diciendo
            // que la cita se va a atar a algo que el operario acaba de quitar.
            onServicesRef.current?.([]);
            clearScheduling();
            return;
        }

        const chosen = orders.find((o) => o.id === orderId);
        if (chosen) {
            startScheduling({
                orderId: chosen.id,
                orderNumber: chosen.order_number,
                patientId: chosen.patient_id,
                patientName: chosen.patient_name,
                doctorId: chosen.doctor_id,
                doctorName: chosen.doctor_name,
                serviceIds: [],
            });
        }

        void resolveServices(orderId);
    }, [onChange, resolveServices, orders, startScheduling, clearScheduling]);

    if (!patientId) return null;

    const select = (
        <Select value={value ?? '__none__'} onValueChange={handleChange} disabled={disabled}>
            <SelectTrigger
                className={cn(
                    compact && 'h-7 px-2 text-xs font-normal [&>span]:truncate [&>span]:text-muted-foreground',
                )}
            >
                <SelectValue placeholder={t('scheduling.orderPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="__none__">{t('scheduling.noOrder')}</SelectItem>
                {orders.map((order) => (
                    <SelectItem key={order.id} value={order.id}>
                        <span className="font-mono">{order.order_number}</span>
                        {' \u00b7 '}
                        {tStatus(order.board_status)}
                        {' \u00b7 '}
                        <span className="text-muted-foreground">
                            {formatDisplayDate(order.submitted_at ?? order.created_at)}
                        </span>
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );

    // En la tarjeta inline ningún campo lleva etiqueta: el icono del `Field` que
    // lo envuelve es lo que identifica al campo.
    if (compact) return select;

    return (
        <div className="space-y-1.5">
            <Label className="flex items-center gap-2">
                {t('scheduling.orderField')}
                {isLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            </Label>
            {select}
            {orders.length === 0 && !isLoading && (
                <p className="text-xs text-muted-foreground">{t('scheduling.noOrdersForPatient')}</p>
            )}
        </div>
    );
}

export default StudyOrderPicker;
