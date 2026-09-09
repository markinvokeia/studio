import { addMonths, format, isValid, parseISO } from 'date-fns';

import { API_ROUTES } from '@/constants/routes';
import { normalizeAppointmentStatus, normalizeCancellationReason } from '@/constants/appointment-status';
import type { Appointment, AppointmentStatus, Calendar, CancellationReason, User } from '@/lib/types';
import { api } from '@/services/api';

/**
 * Agendas activas para los formularios de cita. Vive acá y no en una pantalla porque
 * lo necesitan varias superficies (el perfil del paciente, su hoja de detalle y el
 * formulario completo).
 */
export async function fetchAppointmentCalendars(): Promise<Calendar[]> {
  try {
    const data = await api.get(API_ROUTES.CALENDARS);
    const list = Array.isArray(data) ? data : (data.calendars || data.data || data.result || []);
    return list.map((c: Record<string, unknown>) => ({
      id: String(c.id),
      name: c.name as string,
      google_calendar_id: c.google_calendar_id as string | undefined,
      is_active: c.is_active as boolean,
      color: c.color as string | undefined,
    }));
  } catch { return []; }
}

/** Doctores para los formularios de cita. La API los devuelve con varias formas. */
export async function fetchAppointmentDoctors(): Promise<User[]> {
  try {
    const data = await api.get(API_ROUTES.USERS, { filter_type: 'DOCTOR' });
    let list: Record<string, unknown>[] = [];
    if (Array.isArray(data) && data.length > 0) {
      const first = data[0];
      list = first.json?.data || first.data || [];
    } else if (data?.data) {
      list = data.data;
    }
    return list.map((d) => ({ ...d, id: String(d.id) }) as User);
  } catch { return []; }
}

export interface SearchAppointmentsParams {
  /** Texto libre. El endpoint exige >= 2 caracteres; con menos devolvemos [] sin pegar. */
  q: string;
  /** Ids de agenda para acotar la búsqueda (normalmente las agendas visibles). */
  calendarSourceIds?: string[];
  /** Tope de resultados (el backend lo capa a 100). */
  limit?: number;
}

/**
 * Búsqueda global de citas por texto — pega al webhook n8n `GET /appointments/search`
 * (ver n8n-workflows/appointments-search.json). Matchea, sin acentos ni mayúsculas,
 * contra campos de la cita (summary/notes/description), del paciente (nombre, email,
 * documento, teléfono), servicios y nº de presupuesto. No está acotada por fecha:
 * ordena por cercanía a hoy y devuelve como mucho `limit` filas.
 *
 * Devuelve las filas crudas del backend, con la MISMA forma que `/users_appointments`,
 * para que la página las mapee con su propio `mapApiAppointmentRow`.
 */
export async function searchAppointments({
  q,
  calendarSourceIds,
  limit,
}: SearchAppointmentsParams): Promise<any[]> {
  const term = q.trim();
  if (term.length < 2) return [];

  const query: Record<string, string> = { q: term };
  if (calendarSourceIds && calendarSourceIds.length > 0) {
    query.calendar_source_ids = calendarSourceIds.join(',');
  }
  if (limit) query.limit = String(limit);

  const data = await api.get(API_ROUTES.APPOINTMENTS_SEARCH, query);

  if (Array.isArray(data) && data.length > 0 && 'json' in data[0]) {
    return data.map((item: any) => item.json);
  }
  return Array.isArray(data) ? data : [];
}

interface UpdateAppointmentStatusParams {
  appointment: Pick<Appointment, 'id' | 'googleEventId' | 'calendar_source_id'>;
  newStatus: AppointmentStatus;
  cancellation_reason?: CancellationReason;
  cancellation_note?: string;
  note?: string;
}

export async function updateAppointmentStatusRequest({
  appointment,
  newStatus,
  cancellation_reason,
  cancellation_note,
  note,
}: UpdateAppointmentStatusParams) {
  const payload = {
    appointment_id: appointment.id,
    google_event_id: appointment.googleEventId,
    calendar_source_id: appointment.calendar_source_id,
    status: newStatus,
    cancellation_reason: newStatus === 'cancelled' ? cancellation_reason : null,
    cancellation_note: cancellation_reason === 'other' ? cancellation_note?.trim() : null,
    note,
  };

  const response = await api.post(API_ROUTES.APPOINTMENTS_UPDATE_STATUS, payload);
  const result = Array.isArray(response) ? response[0] : response;

  if (result?.error || (result?.code && result.code >= 400)) {
    throw new Error(result?.message || 'Failed to update appointment status');
  }

  return result;
}

export interface FuturePatientAppointment {
  id: string;
  date: string; // yyyy-MM-dd
  time: string; // HH:mm
  room: string; // calendar_name / consultorio
  doctorName: string;
  start: Date;
}

/**
 * Fetches a patient's upcoming appointments (from now up to 12 months ahead),
 * excluding cancelled and no-show ones. Used to warn before creating a new
 * appointment for a patient who already has future appointments booked.
 * Reuses the single `/users_appointments` endpoint filtered by `user_id`.
 */
export async function fetchFuturePatientAppointments(
  userId: string,
  calendars: Calendar[] = [],
): Promise<FuturePatientAppointment[]> {
  if (!userId) return [];

  const now = new Date();
  const formatDateForAPI = (date: Date) => format(date, 'yyyy-MM-dd HH:mm:ss');

  try {
    const query: Record<string, string> = {
      startingDateAndTime: formatDateForAPI(now),
      endingDateAndTime: formatDateForAPI(addMonths(now, 12)),
      user_id: String(userId),
    };

    const data = await api.get(API_ROUTES.USERS_APPOINTMENTS, query);

    let rows: any[] = [];
    if (Array.isArray(data) && data.length > 0 && 'json' in data[0]) {
      rows = data.map((item) => item.json);
    } else if (Array.isArray(data)) {
      rows = data;
    }

    const appointments = rows
      .map((apiAppt: any): FuturePatientAppointment | null => {
        const startNode = apiAppt.start_time || apiAppt.start;
        const startStr = typeof startNode === 'string' ? startNode : startNode?.dateTime;
        if (!startStr) return null;

        const start = parseISO(startStr.replace(/Z$/, ''));
        if (Number.isNaN(start.getTime())) return null;
        if (start.getTime() <= now.getTime()) return null;

        const status = normalizeAppointmentStatus(apiAppt.status);
        if (status === 'cancelled' || status === 'no_show') return null;

        const calendarSourceId = apiAppt.calendar_source_id != null ? String(apiAppt.calendar_source_id) : '';
        const calendar = calendars.find((c) => String(c.id) === calendarSourceId);
        const room = apiAppt.organizer?.displayName || calendar?.name || apiAppt.calendar_name || '';
        const doctorName = apiAppt.doctor_name || apiAppt.doctorName || apiAppt.doctorname || '';

        return {
          id: String(apiAppt.appointment_id || apiAppt.appointmentId || apiAppt.appointmentid || apiAppt.id || ''),
          date: format(start, 'yyyy-MM-dd'),
          time: format(start, 'HH:mm'),
          room,
          doctorName,
          start,
        };
      })
      .filter((a): a is FuturePatientAppointment => a !== null)
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    return appointments;
  } catch (error) {
    console.error('Failed to fetch future patient appointments:', error);
    return [];
  }
}

/**
 * Citas futuras de un paciente como objetos `Appointment` completos, listos para
 * alimentar `AppointmentFormDialog` (reagendar) y `updateAppointmentStatusRequest`
 * (cancelar) — a diferencia de `fetchFuturePatientAppointments`, que devuelve una
 * proyección mínima para el aviso previo a crear una cita.
 *
 * Lo usa el portal del paciente (/my-profile → Mis Citas). Reutiliza el mismo
 * `/users_appointments?user_id=` y el mapeo defensivo de nombres snake/camel que
 * ya aplica `PatientAppointmentsHistorySheet`.
 */
export async function fetchUpcomingPatientAppointments(
  userId: string,
  userName = '',
  calendars: Calendar[] = [],
): Promise<Appointment[]> {
  if (!userId) return [];

  const now = new Date();
  const formatRange = (d: Date) => format(d, 'yyyy-MM-dd HH:mm:ss');

  const data = await api.get(API_ROUTES.USERS_APPOINTMENTS, {
    startingDateAndTime: formatRange(now),
    endingDateAndTime: formatRange(addMonths(now, 12)),
    user_id: String(userId),
  });

  let rows: any[] = [];
  if (Array.isArray(data) && data.length > 0 && 'json' in data[0]) {
    rows = data.map((item: any) => item.json);
  } else if (Array.isArray(data)) {
    rows = data;
  }

  const parseDateTime = (value?: string): Date | null => {
    if (!value) return null;
    const parsed = parseISO(value.replace(/Z$/, ''));
    return isValid(parsed) ? parsed : null;
  };

  return rows
    .map((apiAppt: any): Appointment | null => {
      const startNode = apiAppt.start_time || apiAppt.start;
      const startStr = typeof startNode === 'string' ? startNode : startNode?.dateTime;
      const start = parseDateTime(startStr);
      if (!start || start.getTime() <= now.getTime()) return null;

      const status = normalizeAppointmentStatus(apiAppt.status);
      if (status === 'cancelled' || status === 'no_show') return null;

      const endNode = apiAppt.end_time || apiAppt.end;
      const calendarSourceId = apiAppt.calendar_source_id != null ? String(apiAppt.calendar_source_id) : '';
      const calendar = calendars.find((c) => String(c.id) === calendarSourceId);

      return {
        id: String(apiAppt.appointment_id || apiAppt.appointmentId || apiAppt.appointmentid || apiAppt.id || ''),
        patientId: String(userId),
        patientName: apiAppt.patient_name || apiAppt.patientName || apiAppt.patientname || userName,
        patientEmail: apiAppt.patient_email || apiAppt.patientEmail,
        patientPhone: apiAppt.patient_phone || apiAppt.patientPhone,
        doctorId: String(apiAppt.doctor_id || apiAppt.doctorId || apiAppt.doctorid || ''),
        doctorName: apiAppt.doctor_name || apiAppt.doctorName || apiAppt.doctorname || '',
        doctorEmail: apiAppt.doctor_email || apiAppt.doctorEmail,
        summary: apiAppt.summary || '',
        service_name: apiAppt.service_name || apiAppt.serviceName,
        date: format(start, 'yyyy-MM-dd'),
        time: format(start, 'HH:mm'),
        status,
        cancellation_reason: normalizeCancellationReason(
          apiAppt.cancellation_reason || apiAppt.cancellationReason || apiAppt.cancellationreason,
        ),
        // Necesario para cancelar/reagendar: el backend sincroniza con Google Calendar.
        // Mismos fallbacks que el mapeo de la agenda, incluido el último a `id`.
        googleEventId:
          apiAppt.google_event_id || apiAppt.googleEventId || apiAppt.googleeventid || apiAppt.id,
        calendar_source_id: calendarSourceId,
        calendar_name: apiAppt.organizer?.displayName || calendar?.name || apiAppt.calendar_name,
        start: typeof startNode === 'string' ? { dateTime: startNode } : startNode,
        end: typeof endNode === 'string' ? { dateTime: endNode } : endNode,
      } as Appointment;
    })
    .filter((a): a is Appointment => a !== null)
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
}
