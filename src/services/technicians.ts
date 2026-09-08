import { API_ROUTES } from '@/constants/routes';
import { api } from './api';

/**
 * Técnicos y operadores: quién ejecuta cada cita.
 *
 * `appointments.technician_id` no es `assignee_id`. Este último es el odontólogo
 * DERIVADOR, y es lo que hace que la cita aparezca en la agenda de quien mandó
 * al paciente. El técnico es otra persona y contesta otra pregunta: "¿qué me
 * toca hoy?".
 *
 * La asignación va por un endpoint propio y no dentro de `/appointments/upsert`
 * por lo mismo de siempre: ese flujo es el monolito compartido de la agenda, con
 * sincronización a Google y notificaciones adentro. Mismo patrón que
 * `billing-links.ts` y `linkAppointmentToStudyOrder`.
 */

interface Envelope<T> {
    code?: number;
    message?: string;
    error?: string | boolean;
    data?: T;
}

function unwrap<T>(raw: unknown): T {
    const body = (Array.isArray(raw) ? raw[0] : raw) as Envelope<T> | null | undefined;
    if (!body) throw new Error('El servidor no devolvió respuesta');
    if (body.error || (typeof body.code === 'number' && body.code >= 400)) {
        throw new Error(body.message || 'Error del servidor');
    }
    return (body.data !== undefined ? body.data : body) as T;
}

export interface TechnicianTask {
    appointment_id: string;
    patient_id?: string | null;
    patient_name?: string | null;
    patient_email?: string | null;
    patient_phone?: string | null;
    doctor_id?: string | null;
    doctor_name?: string | null;
    doctor_email?: string | null;
    technician_id?: string | null;
    technician_name?: string | null;
    summary?: string | null;
    description?: string | null;
    notes?: string | null;
    status?: string | null;
    start_time: string;
    end_time?: string | null;
    created_at?: string | null;
    google_event_id?: string | null;
    calendar_source_id?: string | null;
    calendar_name?: string | null;
    google_calendar_id?: string | null;
    color?: string | null;
    quote_id?: string | null;
    /** De qué orden de estudio nació la cita, si nació de una. */
    study_order_id?: string | null;
    study_order_number?: string | null;
    services?: Array<{ id: string; name: string; price?: number | null }>;
}

/**
 * Asigna el técnico que ejecuta la cita. Con `technicianId` vacío, lo quita.
 *
 * El backend admite dos caminos: quien tiene `APPOINTMENTS_ASSIGN_TECHNICIAN`
 * asigna a cualquiera; sin ese permiso, uno puede tomar para sí una cita libre
 * pero no quitarle una ya tomada a otro.
 */
export async function assignAppointmentTechnician(
    appointmentId: string,
    technicianId: string | null,
): Promise<void> {
    const raw = await api.post(API_ROUTES.APPOINTMENTS_ASSIGN_TECHNICIAN, {
        appointment_id: appointmentId,
        technician_id: technicianId ?? '',
    });
    unwrap<unknown>(raw);
}

/**
 * Las tareas de un técnico en un rango: lo asignado a él más lo que caiga en un
 * calendario al que tenga acceso.
 *
 * `technicianId` sólo lo respeta el backend si quien pregunta puede asignar
 * (recepción mirando la carga de alguien). Sin ese permiso se ignora y devuelve
 * lo del sujeto del token — el panel de uno nunca puede pedir el de otro.
 *
 * Devuelve `[]` ante cualquier fallo: un panel vacío es mejor que una pantalla
 * rota, y el técnico puede simplemente no tener nada asignado.
 */
export async function fetchTechnicianTasks(params: {
    from: string;
    to: string;
    technicianId?: string;
}): Promise<TechnicianTask[]> {
    try {
        const query: Record<string, string> = { from: params.from, to: params.to };
        if (params.technicianId) query.technician_id = params.technicianId;
        const raw = await api.get(API_ROUTES.APPOINTMENTS_TECHNICIAN_TASKS, query);
        const data = unwrap<TechnicianTask[]>(raw);
        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.error('Failed to fetch technician tasks:', error);
        return [];
    }
}

/**
 * Qué técnico tiene asignada cada cita de una lista.
 *
 * El calendario carga sus citas y pregunta acá de una sola vez por todas las
 * visibles: `technician_id` no viaja con los datos de la cita porque
 * `Get_Appointments` es el monolito compartido de la agenda.
 *
 * Devuelve un Map para que el consumidor pregunte por id sin recorrer. Las citas
 * sin técnico no vienen en la respuesta y se leen por ausencia.
 */
export async function fetchAppointmentTechnicians(
    appointmentIds: string[],
): Promise<Map<string, { id: string; name: string }>> {
    const result = new Map<string, { id: string; name: string }>();
    if (appointmentIds.length === 0) return result;
    try {
        const raw = await api.get(API_ROUTES.APPOINTMENTS_TECHNICIANS, {
            appointment_ids: appointmentIds.join(','),
        });
        const rows = unwrap<Array<{ appointment_id: string; technician_id: string; technician_name: string }>>(raw);
        for (const row of Array.isArray(rows) ? rows : []) {
            if (row?.appointment_id && row.technician_id) {
                result.set(String(row.appointment_id), { id: String(row.technician_id), name: row.technician_name ?? '' });
            }
        }
    } catch (error) {
        // `warn` y no `error`: si esto falla, el menú contextual no marca al
        // técnico actual y nada más — la agenda sigue funcionando. Con `error`,
        // el overlay de Next en desarrollo lo muestra como si algo se hubiera
        // roto, y no es el caso.
        console.warn('Failed to fetch appointment technicians:', error);
    }
    return result;
}

/** Los usuarios con rol operador, para los selectores de técnico. */
export interface TechnicianOption {
    id: string;
    name: string;
    email?: string | null;
    color?: string | null;
}

export async function fetchTechnicians(search = ''): Promise<TechnicianOption[]> {
    try {
        const raw = await api.get(API_ROUTES.USERS, {
            page: '1',
            limit: '200',
            search,
            // Lo resuelve get_users_filtered contra el rol 'operador'.
            filter_type: 'OPERADOR',
            only_active: 'true',
        });

        // `/users` es un flujo viejo y responde en varias formas según el camino.
        const body = Array.isArray(raw) ? raw[0] : raw;
        const rows: unknown[] = Array.isArray(body?.json?.data) ? body.json.data
            : Array.isArray(body?.data) ? body.data
            : Array.isArray(raw) ? (raw as unknown[])
            : [];

        return rows.map((row) => {
            const user = row as Record<string, unknown>;
            return {
                id: String(user.id ?? ''),
                name: String(user.name ?? ''),
                email: (user.email as string) ?? null,
                color: (user.color as string) ?? null,
            };
        }).filter((technician) => technician.id && technician.name);
    } catch (error) {
        console.error('Failed to fetch technicians:', error);
        return [];
    }
}
