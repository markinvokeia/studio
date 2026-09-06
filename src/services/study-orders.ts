import { API_ROUTES } from '@/constants/routes';
import type {
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
 * Recalcula el estado de la orden contra sus citas y, si ya está todo atendido,
 * la cierra y avisa al derivador. Es idempotente: se puede llamar de más.
 *
 * Se invoca al guardar una sesión clínica. Como la sesión se crea desde varios
 * lugares, un cron de reconciliación hace de red de seguridad por si algún
 * camino no llama acá.
 */
export async function recomputeStudyOrder(id: string): Promise<void> {
    try {
        const raw = await api.post(API_ROUTES.STUDY_ORDERS.RECOMPUTE, { id });
        unwrap<unknown>(raw);
    } catch (error) {
        // Fire-and-forget, igual que billing-links: el cron lo va a corregir.
        console.warn('Failed to recompute study order status:', error);
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
        id,
        expires_in_days: options.expiresInDays,
        max_uses: options.maxUses,
    });
    return unwrap<StudyOrderBookingLink>(raw).data;
}
