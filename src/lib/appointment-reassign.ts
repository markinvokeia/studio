import { api } from '@/services/api';
import { API_ROUTES } from '@/constants/routes';
import type { Appointment, Calendar as CalendarType, Service, User } from '@/lib/types';

const CALENDAR_COLORS = [
  'hsl(210, 80%, 55%)',
  'hsl(150, 70%, 45%)',
  'hsl(340, 80%, 60%)',
  'hsl(45, 90%, 55%)',
  'hsl(270, 70%, 65%)',
  'hsl(180, 60%, 40%)',
  'hsl(0, 75%, 55%)',
];

/** Change applied to an appointment by the quick-edit pickers. */
export interface AppointmentReassignChange {
  doctor?: User;
  calendar?: CalendarType;
  /** Quote to link, or `null` to unlink. Omit to leave the current quote untouched. */
  quote?: { id: string; doc_no?: string } | null;
  /** New start datetime as a local ISO string (no timezone). */
  start?: string;
  /** New end datetime as a local ISO string (no timezone). */
  end?: string;
  /** New notes; omit to leave the current notes untouched. */
  notes?: string;
  /** New service list; omit to leave the current services untouched. */
  services?: Service[];
}

// Backend stores datetimes as local ISO strings (no timezone). Strip any trailing
// 'Z' so the upsert keeps the original time instead of shifting it.
const stripZ = (value?: string): string | undefined => (value ? value.replace(/Z$/, '') : value);

/**
 * Builds the `appointments/upsert` payload for a doctor or room (calendar)
 * reassignment. Reuses the full appointment data and only swaps the changed
 * field, mirroring the update payload produced by the appointment form.
 */
export function buildReassignPayload(appointment: Appointment, change: AppointmentReassignChange) {
  const { doctor, calendar } = change;
  return {
    mode: 'update' as const,
    appointment_id: appointment.id,
    google_event_id: appointment.googleEventId,
    start: change.start ?? stripZ(appointment.start?.dateTime),
    end: change.end ?? stripZ(appointment.end?.dateTime),
    old_calendar_source_id: appointment.calendar_source_id,
    calendar_source_id: calendar ? String(calendar.id) : appointment.calendar_source_id,
    doctor_id: doctor ? String(doctor.id) : appointment.doctorId,
    doctor_name: doctor ? doctor.name : appointment.doctorName,
    doctor_email: doctor ? (doctor.email ?? '') : (appointment.doctorEmail ?? ''),
    patient_id: appointment.patientId,
    patient_name: appointment.patientName,
    patient_email: appointment.patientEmail,
    patient_phone: appointment.patientPhone,
    summary: change.services
      ? (change.services.length ? `${appointment.patientName} - ${change.services.map((s) => s.name).join(', ')}` : appointment.patientName)
      : appointment.summary,
    service_ids: (change.services ?? appointment.services ?? []).filter((s) => s.id).map((s) => s.id),
    service_names: (change.services ?? appointment.services ?? []).map((s) => s.name).join(', '),
    notes: change.notes !== undefined ? change.notes : (appointment.notes ?? ''),
    quote_id: change.quote !== undefined
      ? (change.quote ? String(change.quote.id) : null)
      : (appointment.quote_id ?? null),
  };
}

/**
 * Upserts an appointment with a new doctor or room and returns the locally
 * merged appointment so callers can update UI optimistically without refetching.
 */
export async function reassignAppointmentField(
  appointment: Appointment,
  change: AppointmentReassignChange,
): Promise<Appointment> {
  const payload = buildReassignPayload(appointment, change);
  const response = await api.post(API_ROUTES.APPOINTMENTS_UPSERT, payload);
  const result = Array.isArray(response) ? response[0] : response;
  if (result?.error || (result?.code && result.code >= 400)) {
    throw new Error(result?.message || 'Failed to update appointment');
  }

  const updated: Appointment = { ...appointment };
  if (change.doctor) {
    updated.doctorId = String(change.doctor.id);
    updated.doctorName = change.doctor.name;
    updated.doctorEmail = change.doctor.email ?? '';
  }
  if (change.calendar) {
    updated.calendar_source_id = String(change.calendar.id);
    updated.calendar_name = change.calendar.name;
  }
  if (change.quote !== undefined) {
    updated.quote_id = change.quote ? String(change.quote.id) : undefined;
    updated.quote_doc_no = change.quote?.doc_no;
  }
  if (change.start) {
    updated.start = { dateTime: change.start };
    updated.date = change.start.slice(0, 10);
    updated.time = change.start.slice(11, 16);
  }
  if (change.end) {
    updated.end = { dateTime: change.end };
  }
  if (change.notes !== undefined) {
    updated.notes = change.notes;
  }
  if (change.services) {
    updated.services = change.services;
    updated.summary = change.services.length
      ? `${appointment.patientName} - ${change.services.map((s) => s.name).join(', ')}`
      : appointment.patientName;
  }
  return updated;
}

/** Fetches the doctor list used by the quick-edit pickers. */
export async function fetchReassignDoctors(): Promise<User[]> {
  try {
    const data = await api.get(API_ROUTES.USERS, { filter_type: 'DOCTOR' });
    let doctorsData: any[] = [];
    if (Array.isArray(data) && data.length > 0) {
      const firstElement = data[0];
      if (firstElement.json && typeof firstElement.json === 'object') {
        doctorsData = firstElement.json.data || [];
      } else if (firstElement.data) {
        doctorsData = firstElement.data;
      }
    } else if (typeof data === 'object' && data !== null && data.data) {
      doctorsData = data.data;
    }
    return doctorsData.map((d: any) => ({ ...d, id: String(d.id) }));
  } catch (error) {
    console.error('Failed to fetch doctors:', error);
    return [];
  }
}

/** Fetches the room (calendar) list used by the quick-edit pickers. */
export async function fetchReassignCalendars(): Promise<CalendarType[]> {
  try {
    const data = await api.get(API_ROUTES.CALENDARS);
    const calendarsData = Array.isArray(data) ? data : (data.calendars || data.data || data.result || []);
    return calendarsData.map((apiCalendar: any, index: number) => ({
      id: String(apiCalendar.id),
      name: apiCalendar.name,
      google_calendar_id: apiCalendar.google_calendar_id,
      is_active: apiCalendar.is_active,
      color: apiCalendar.color || CALENDAR_COLORS[index % CALENDAR_COLORS.length],
      sede_id: apiCalendar.sede_id ? String(apiCalendar.sede_id) : undefined,
      sede_name: apiCalendar.sede_name || undefined,
    }));
  } catch (error) {
    console.error('Failed to fetch calendars:', error);
    return [];
  }
}
