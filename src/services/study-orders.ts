import { API_ROUTES } from '@/constants/routes';
import type {
    PublicStudyOrder,
    StudyOrder,
    StudyOrderBookingLink,
    StudyOrderFormOptions,
    StudyOrderListItem,
    StudyOrderUpsertPayload,
} from '@/lib/types';
import { api } from './api';

/**
 * Capa de API de las órdenes de estudio.
 *
 * Todos los endpoints nuevos responden con un único sobre:
 *
 *     { code: 200, message: 'OK', data: <payload>, meta?: { total, page, limit } }
 *
 * Es el único de los tres formatos que conviven en el backend que lleva canal de
 * error *y* paginación. `unwrap()` lo desarma en un solo lugar para que ningún
 * componente tenga que repetir la comprobación defensiva; igual tolera que n8n
 * devuelva el objeto suelto o envuelto en un array, que es como responden los
 * flujos viejos.
 */

interface Envelope<T> {
    code?: number;
    message?: string;
    error?: string | boolean;
    data?: T;
    meta?: { total?: number; page?: number; limit?: number };
}

function unwrap<T>(raw: unknown): { data: T; total: number } {
    const body = (Array.isArray(raw) ? raw[0] : raw) as Envelope<T> | null | undefined;

    if (!body) {
        throw new Error('El servidor no devolvió respuesta');
    }

    // n8n puede responder 200 con el error adentro; hay que mirar el cuerpo.
    if (body.error || (typeof body.code === 'number' && body.code >= 400)) {
        throw new Error(
            body.message || (typeof body.error === 'string' ? body.error : 'Error del servidor'),
        );
    }

    // Un flujo que responde el payload pelado sigue funcionando.
    const data = (body.data !== undefined ? body.data : body) as T;
    return { data, total: body.meta?.total ?? (Array.isArray(data) ? data.length : 0) };
}

export type StudyOrderScope = 'mine' | 'clinic';

export interface GetStudyOrdersParams {
    /**
     * `mine` filtra por el doctor del token — el `doctor_id` nunca viaja en el
     * query. `clinic` requiere STUDY_ORDERS_VIEW_ALL: sin ese permiso el
     * backend devuelve igual sólo las propias.
     */
    scope: StudyOrderScope;
    boardStatus?: string;
    search?: string;
    sedeId?: string;
    /** Órdenes de un paciente concreto. Lo usa el selector del diálogo de cita. */
    patientId?: string;
    dateFrom?: string;
    dateTo?: string;
    /** Horas desde el envío sin agendar a partir de las cuales cuenta como atrasada. */
    slaHours?: number;
    sort?: string;
    page?: number;
    limit?: number;
}

export interface StudyOrdersResponse {
    items: StudyOrderListItem[];
    total: number;
}

export async function getStudyOrders(params: GetStudyOrdersParams): Promise<StudyOrdersResponse> {
    const query: Record<string, string> = { scope: params.scope };

    if (params.boardStatus) query.board_status = params.boardStatus;
    if (params.search) query.q = params.search;
    if (params.sedeId) query.sede_id = params.sedeId;
    if (params.patientId) query.patient_id = params.patientId;
    if (params.dateFrom) query.date_from = params.dateFrom;
    if (params.dateTo) query.date_to = params.dateTo;
    if (params.slaHours !== undefined) query.sla_hours = String(params.slaHours);
    if (params.sort) query.sort = params.sort;
    if (params.page) query.page = String(params.page);
    if (params.limit) query.limit = String(params.limit);

    try {
        const raw = await api.get(API_ROUTES.STUDY_ORDERS.LIST, query);
        const { data, total } = unwrap<StudyOrderListItem[]>(raw);
        return { items: Array.isArray(data) ? data : [], total };
    } catch (error) {
        // Un listado que falla no debe romper la pantalla: se muestra vacía.
        console.error('Failed to fetch study orders:', error);
        return { items: [], total: 0 };
    }
}

export async function getStudyOrder(id: string): Promise<StudyOrder | null> {
    try {
        const raw = await api.get(API_ROUTES.STUDY_ORDERS.DETAIL, { id });
        return unwrap<StudyOrder>(raw).data;
    } catch (error) {
        console.error('Failed to fetch study order:', error);
        return null;
    }
}

/**
 * Catálogo del formulario. Cambia sólo cuando la clínica agrega una opción, así
 * que la pantalla lo pide una vez y lo mantiene en memoria.
 */
export async function getStudyOrderFormOptions(): Promise<StudyOrderFormOptions> {
    const empty: StudyOrderFormOptions = {
        sections: [], modifiers: [], texts: [], region_groups: [], delivery: [],
    };
    try {
        const raw = await api.get(API_ROUTES.STUDY_ORDERS.OPTIONS);
        return { ...empty, ...unwrap<StudyOrderFormOptions>(raw).data };
    } catch (error) {
        console.error('Failed to fetch study order form options:', error);
        return empty;
    }
}

/** Crea o actualiza. El backend rechaza con 409 si la orden ya no está en borrador. */
export async function upsertStudyOrder(payload: StudyOrderUpsertPayload): Promise<StudyOrder> {
    const raw = await api.post(API_ROUTES.STUDY_ORDERS.UPSERT, payload);
    return unwrap<StudyOrder>(raw).data;
}

/** Envía la orden a la clínica. A partir de acá deja de ser editable. */
export async function submitStudyOrder(id: string): Promise<StudyOrder> {
    const raw = await api.post(API_ROUTES.STUDY_ORDERS.SUBMIT, { id });
    return unwrap<StudyOrder>(raw).data;
}

export async function cancelStudyOrder(id: string, reason: string): Promise<StudyOrder> {
    const raw = await api.post(API_ROUTES.STUDY_ORDERS.CANCEL, { id, reason });
    return unwrap<StudyOrder>(raw).data;
}

/** Marca que la clínica tomó la orden: la saca del bucket "nuevas". */
export async function acknowledgeStudyOrder(id: string): Promise<StudyOrder> {
    const raw = await api.post(API_ROUTES.STUDY_ORDERS.ACKNOWLEDGE, { id });
    return unwrap<StudyOrder>(raw).data;
}

/** Sólo borradores. */
export async function deleteStudyOrder(id: string): Promise<void> {
    const raw = await api.delete(API_ROUTES.STUDY_ORDERS.DELETE, { id });
    unwrap<unknown>(raw);
}

export async function linkStudyOrderPatient(id: string, patientId: string): Promise<StudyOrder> {
    const raw = await api.post(API_ROUTES.STUDY_ORDERS.LINK_PATIENT, { id, patient_id: patientId });
    return unwrap<StudyOrder>(raw).data;
}

/**
 * Qué le pasó a la orden, cuando el recálculo por sí solo no puede deducirlo.
 *
 * Cancelar una cita no cambia el estado persistido de la orden — sigue
 * 'submitted' — pero sí devuelve sus líneas a "sin agendar", y de eso el
 * derivador tiene que enterarse. El backend no tiene forma de detectarlo: la
 * vista ya se corrigió sola y no guarda el estado anterior contra el cual
 * comparar. Quien cancela sí lo sabe, así que lo dice.
 */
export type StudyOrderChangeHint = 'appointment_cancelled';

/**
 * Recalcula el estado de la orden contra sus citas y, si ya está todo atendido,
 * la cierra y avisa al derivador. Es idempotente: se puede llamar de más.
 *
 * Se invoca al guardar una sesión clínica y al cancelar una cita. Como esas
 * cosas pasan desde varios lugares, un cron de reconciliación hace de red de
 * seguridad por si algún camino no llama acá.
 *
 * Sin `change`, sólo notifica si el recálculo produjo una transición real
 * (cerró la orden, o la reabrió). Es lo que evita que guardar una sesión de una
 * orden con varios estudios pendientes le mande un aviso al doctor cada vez.
 */
export async function recomputeStudyOrder(
    id: string,
    change?: StudyOrderChangeHint,
    /** Sobre qué cita, para que la bitácora pueda decir cuál se cayó. */
    appointmentId?: string,
): Promise<void> {
    try {
        const raw = await api.post(API_ROUTES.STUDY_ORDERS.RECOMPUTE, {
            id,
            ...(change ? { change } : {}),
            ...(appointmentId ? { appointment_id: appointmentId } : {}),
        });
        unwrap<unknown>(raw);
    } catch (error) {
        // Fire-and-forget, igual que billing-links: el cron lo va a corregir.
        console.warn('Failed to recompute study order status:', error);
    }
}

/**
 * Se editó una cita: si pertenece a una orden, queda anotado en su historial.
 *
 * Pregunta primero a qué orden pertenece porque ese dato no viaja con la cita, y
 * porque la enorme mayoría de las citas no vienen de una orden: la respuesta es
 * `null` y esto termina en nada. Reusa /link-appointment, que es idempotente —
 * el vínculo no cambia, lo único que cambia es el renglón de la bitácora y el
 * aviso al derivador, que es justamente lo que se busca.
 */
export async function logStudyOrderAppointmentUpdated(appointmentId: string): Promise<void> {
    try {
        const order = await getStudyOrderByAppointment(appointmentId);
        if (!order) return;
        await linkAppointmentToStudyOrder(order.id, appointmentId, 'appointment_updated');
    } catch (error) {
        console.warn('[study-orders] No se pudo registrar la edición de la cita', { appointmentId, error });
    }
}

/**
 * Se guardó la sesión clínica de una cita: si venía de una orden, se recalcula.
 *
 * Sin hint a propósito. Una orden de cinco estudios se atiende en varias
 * sesiones, y de las cuatro primeras el derivador no tiene nada que saber. El
 * recálculo sólo notifica cuando la última cierra la orden — ahí sí, con
 * `change='completed'`, que es el "sus estudios están listos".
 *
 * Va después de que la cita quede en 'completed': es ese estado el que la vista
 * mira para contar la línea como atendida.
 */
export async function recomputeStudyOrderForAppointment(appointmentId: string): Promise<void> {
    try {
        const order = await getStudyOrderByAppointment(appointmentId);
        if (!order) return;
        await recomputeStudyOrder(order.id, undefined, appointmentId);
    } catch (error) {
        console.warn('[study-orders] No se pudo recalcular la orden de la cita atendida', { appointmentId, error });
    }
}

/**
 * Una cita dejó de estar vigente (cancelada, borrada o no-show): si venía de una
 * orden, se recalcula la orden y se le avisa al derivador.
 *
 * Los tres estados van juntos porque son exactamente los que
 * `v_study_orders_board` descuenta al calcular si una línea está agendada: para
 * la orden, un no-show y una cancelación son lo mismo — el estudio no se hizo y
 * hay que volver a agendarlo.
 *
 * Empieza por preguntar a qué orden pertenece la cita porque ese dato no viaja
 * con los datos de la cita. La inmensa mayoría no viene de una orden y la
 * respuesta es `null`, así que esto termina en nada casi siempre.
 *
 * Fire-and-forget: cancelar una cita no puede fallar porque el aviso a la orden
 * falle.
 */
export async function notifyStudyOrderAppointmentDropped(appointmentId: string): Promise<void> {
    try {
        const order = await getStudyOrderByAppointment(appointmentId);
        if (!order) return;
        await recomputeStudyOrder(order.id, 'appointment_cancelled', appointmentId);
    } catch (error) {
        console.warn('[study-orders] No se pudo avisar a la orden de la cita cancelada', { appointmentId, error });
    }
}

/** Lo mínimo para mostrar la orden de una cita ya existente. */
export interface StudyOrderRef {
    id: string;
    order_number: string;
    patient_id?: string | null;
    patient_name: string;
    doctor_id?: string | null;
    doctor_name?: string | null;
    board_status: string;
}

/**
 * A qué orden pertenece una cita.
 *
 * Se consulta aparte porque `study_order_id` no viaja con los datos de la cita:
 * `Get_Appointments` es parte del monolito de la agenda y no se toca para esto.
 * Devuelve `null` cuando la cita no nació de una orden, que es lo habitual.
 */
export async function getStudyOrderByAppointment(appointmentId: string): Promise<StudyOrderRef | null> {
    try {
        const raw = await api.get(API_ROUTES.STUDY_ORDERS.BY_APPOINTMENT, { appointment_id: appointmentId });
        return unwrap<StudyOrderRef | null>(raw).data ?? null;
    } catch (error) {
        console.warn('[study-orders] No se pudo resolver la orden de la cita', { appointmentId, error });
        return null;
    }
}

/**
 * Ata una cita recién creada a su orden.
 *
 * Va DESPUÉS de `/appointments/upsert` y no adentro: ese endpoint es un monolito
 * compartido por todo el módulo de citas, con sync a Google Calendar y
 * notificaciones, y agregarle una columna para esto arriesgaría la agenda
 * entera. Es el mismo patrón que `linkInvoiceToAppointment` en billing-links.
 *
 * Fire-and-forget: si falla, la cita queda creada igual y se puede atar después
 * desde la orden. Nunca debe romper el guardado de una cita.
 */
export async function linkAppointmentToStudyOrder(
    orderId: string,
    appointmentId: string,
    /**
     * Qué contar en la bitácora. `scheduled` cuando la cita nace atada a la
     * orden; `appointment_updated` cuando se editó una que ya lo estaba. El
     * endpoint es idempotente, así que la segunda llamada no cambia el vínculo:
     * lo único que cambia es el renglón del historial y a quién se le avisa.
     */
    eventType: 'scheduled' | 'appointment_updated' = 'scheduled',
): Promise<void> {
    try {
        const raw = await api.post(API_ROUTES.STUDY_ORDERS.LINK_APPOINTMENT, {
            order_id: orderId,
            appointment_id: appointmentId,
            event_type: eventType,
        });
        unwrap<unknown>(raw);
    } catch (error) {
        console.warn('[study-orders] No se pudo atar la cita a la orden', { orderId, appointmentId, error });
    }
}

/**
 * Mueve una cita de la orden: cambia sólo fecha y hora, sobre la misma fila.
 *
 * No pasa por `/appointments/reschedule` a propósito: ese flujo crea una cita
 * nueva y cancela la vieja sin copiar `study_order_id`, con lo cual la orden
 * quedaría sin cita. Ojo: este camino tampoco empuja el cambio a Google Calendar.
 */
export async function rescheduleStudyOrderAppointment(params: {
    orderId: string;
    appointmentId: string;
    start: string;
    end: string;
}): Promise<void> {
    const raw = await api.post(API_ROUTES.STUDY_ORDERS.RESCHEDULE, {
        order_id: params.orderId,
        appointment_id: params.appointmentId,
        start: params.start,
        end: params.end,
    });
    unwrap<unknown>(raw);
}

/** Genera el link del paciente. El token en claro sólo se ve en esta respuesta. */
export async function createStudyOrderBookingLink(
    id: string,
    options: { expiresInDays?: number; maxUses?: number } = {},
): Promise<StudyOrderBookingLink> {
    const raw = await api.post(API_ROUTES.STUDY_ORDERS.BOOKING_TOKEN, {
        order_id: id,
        days_valid: options.expiresInDays,
        max_uses: options.maxUses,
    });
    return unwrap<StudyOrderBookingLink>(raw).data;
}

/**
 * Lo que ve el paciente al abrir el link, sin tener cuenta.
 *
 * El backend devuelve deliberadamente poco: primer nombre, número de orden,
 * estudios pendientes y sede sugerida. Cualquiera con el link ve esto, así que
 * no viajan documento, teléfono, mail ni las notas clínicas del derivador.
 *
 * Un link vencido, revocado, agotado o inventado devuelve `null` — el backend
 * no distingue entre esos casos a propósito, para no confirmarle a un curioso
 * que el token existió.
 */
export async function getPublicStudyOrder(token: string): Promise<PublicStudyOrder | null> {
    try {
        const raw = await api.get(API_ROUTES.STUDY_ORDERS.PUBLIC_DETAIL, { token });
        return unwrap<PublicStudyOrder>(raw).data ?? null;
    } catch {
        return null;
    }
}

/** El paciente confirma el horario. Devuelve el id de la cita creada. */
export async function bookPublicStudyOrder(params: {
    token: string;
    calendarSourceId: string;
    start: string;
    end: string;
    summary?: string;
}): Promise<{ appointment_id: string; order_number: string }> {
    const raw = await api.post(API_ROUTES.STUDY_ORDERS.PUBLIC_BOOK, {
        token: params.token,
        calendar_source_id: params.calendarSourceId,
        start: params.start,
        end: params.end,
        summary: params.summary,
    });
    return unwrap<{ appointment_id: string; order_number: string }>(raw).data;
}
