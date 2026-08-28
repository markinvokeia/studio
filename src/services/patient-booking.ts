import { addDays, format, parse, startOfDay } from 'date-fns';

import { API_ROUTES } from '@/constants/routes';
import { getBusinessWindow } from '@/components/calendar/calendar-gaps';
import type { Appointment, ClinicSchedule, User } from '@/lib/types';
import { api } from '@/services/api';
import { updateAppointmentStatusRequest } from '@/services/appointments';
import { toLocalISOString } from '@/lib/utils';

/** Duración por defecto de una cita solicitada por el paciente. */
export const PATIENT_SLOT_MINUTES = 30;

/**
 * `true` cuando el paciente reserva desde la landing, sin haberse autenticado
 * (registro nuevo, o modo "sólo citas"). En ese caso se usan las variantes
 * `_noauth` de los webhooks de citas, que ya existen en el workflow de agenda.
 */
export type BookingAuthMode = 'session' | 'public';

const availabilityRoute = (mode: BookingAuthMode) =>
  mode === 'public' ? API_ROUTES.PATIENT_AUTH.PUBLIC_AVAILABILITY : API_ROUTES.APPOINTMENTS_AVAILABILITY;

const upsertRoute = (mode: BookingAuthMode) =>
  mode === 'public' ? API_ROUTES.PATIENT_AUTH.PUBLIC_APPOINTMENT_UPSERT : API_ROUTES.APPOINTMENTS_UPSERT;

export interface BookingSlot {
  /** `HH:mm` de inicio. */
  time: string;
  /** `false` ⇒ el horario existe en la agenda pero está ocupado o sin doctor libre. */
  isAvailable: boolean;
  /** Doctor y consultorio que quedan libres en ese horario (sólo si `isAvailable`). */
  doctorId?: string;
  doctorName?: string;
  doctorEmail?: string;
  calendarSourceId?: string;
  calendarName?: string;
}

export interface BookingSede {
  id: string;
  name: string;
  address?: string;
  /** Calendarios (consultorios) de esta sede. Es lo que acota la búsqueda de huecos. */
  calendarIds: string[];
}

/**
 * Sedes con consultorios activos, para que el paciente elija dónde atenderse.
 *
 * Los huecos que devuelve `/appointments_availability` vienen con
 * `calendar_source_id`, y cada calendario pertenece a una sede: filtrar por
 * sede es, en los hechos, filtrar por sus calendarios.
 *
 * Devuelve `[]` ante cualquier fallo — con una sola sede (o ninguna) el panel
 * simplemente no muestra el selector.
 */
export async function fetchBookingSedes(authMode: BookingAuthMode = 'session'): Promise<BookingSede[]> {
  // Sin sesión hay que usar las variantes públicas: `/sedes` y `/calendars`
  // exigen token y devolvían vacío, por eso el selector no aparecía nunca.
  const sedesRoute = authMode === 'public' ? API_ROUTES.PATIENT_AUTH.PUBLIC_SEDES : API_ROUTES.SEDES;
  const calendarsRoute =
    authMode === 'public' ? API_ROUTES.PATIENT_AUTH.PUBLIC_CALENDARS : API_ROUTES.CALENDARS;

  try {
    const sedesData = await api.get(sedesRoute, { page: '1', limit: '200' });
    const rawSedes: any[] = Array.isArray(sedesData)
      ? sedesData
      : (sedesData?.sedes || sedesData?.data || sedesData?.result || []);

    const active = rawSedes.filter((s: any) => s.is_active !== false);
    if (active.length === 0) return [];

    /** Algunos backends ya devuelven los consultorios dentro de la sede. */
    const embeddedIds = (sede: any): string[] => {
      const raw = sede.calendar_ids ?? sede.calendar_source_ids ?? sede.calendars;
      if (Array.isArray(raw)) {
        return raw.map((c: any) => String(typeof c === 'object' ? (c?.id ?? '') : c)).filter(Boolean);
      }
      if (typeof raw === 'string' && raw.trim()) return raw.split(',').map((v) => v.trim()).filter(Boolean);
      return [];
    };

    const hasEmbedded = active.some((s) => embeddedIds(s).length > 0);

    // Sólo se consultan los calendarios si la sede no los trae ya.
    let bySede = new Map<string, string[]>();
    if (!hasEmbedded) {
      try {
        const calendarsData = await api.get(calendarsRoute);
        const rawCalendars: any[] = Array.isArray(calendarsData)
          ? calendarsData
          : (calendarsData?.calendars || calendarsData?.data || calendarsData?.result || []);

        for (const c of rawCalendars) {
          if (c?.is_active === false || c?.sede_id == null) continue;
          const key = String(c.sede_id);
          bySede.set(key, [...(bySede.get(key) ?? []), String(c.id)]);
        }
      } catch (error) {
        // Sin calendarios se pierde el filtrado por sede, pero la elección del
        // paciente igual se registra: es mejor que no ofrecer sedes.
        console.error('Failed to load calendars for the sede filter:', error);
        bySede = new Map();
      }
    }

    const sedes: BookingSede[] = active.map((s: any) => ({
      id: String(s.id),
      name: s.name || '',
      address: s.address || undefined,
      calendarIds: hasEmbedded ? embeddedIds(s) : (bySede.get(String(s.id)) ?? []),
    }));

    // Descartar sedes sin consultorios sólo tiene sentido si el vínculo existe.
    // Si NINGUNA sede lo tiene, el dato no está cargado y filtrar dejaría al
    // paciente sin ninguna opción — que es justo el bug que se está corrigiendo.
    const anyLinked = sedes.some((s) => s.calendarIds.length > 0);
    return anyLinked ? sedes.filter((s) => s.calendarIds.length > 0) : sedes;
  } catch (error) {
    console.error('Failed to load sedes:', error);
    return [];
  }
}

/**
 * Huecos libres de un día, ya cruzados contra el horario de atención.
 *
 * `/appointments_availability` en modo sugerencias (es decir, **sin**
 * `mode: 'checkAvailability'`) devuelve únicamente los horarios en los que hay
 * algún doctor libre. Para poder mostrarle al paciente también los que están
 * ocupados —en gris, como pide la UI— se arma la grilla completa del día a
 * partir del horario de la clínica y se marca como disponible sólo lo que el
 * backend devolvió.
 *
 * Reutiliza `getBusinessWindow` del calendario, así el portal y la agenda del
 * staff interpretan `clinic_schedules` exactamente igual.
 */
export async function fetchPatientDaySlots(
  day: Date,
  schedules: ClinicSchedule[],
  slotMinutes: number = PATIENT_SLOT_MINUTES,
  /** Acota la búsqueda a los consultorios de una sede. Vacío ⇒ todas. */
  calendarSourceIds: string[] = [],
  authMode: BookingAuthMode = 'session',
): Promise<BookingSlot[]> {
  const dayStart = startOfDay(day);
  const { startMin, endMin } = getBusinessWindow(dayStart, schedules);

  // Sin ventana de atención ese día (p. ej. domingo) no hay nada que ofrecer.
  if (endMin <= startMin) return [];

  const suggestions = await fetchSuggestedTimes(dayStart, slotMinutes, calendarSourceIds, authMode);
  const dayKey = format(dayStart, 'yyyy-MM-dd');
  const now = new Date();

  const slots: BookingSlot[] = [];
  for (let minutes = startMin; minutes + slotMinutes <= endMin; minutes += slotMinutes) {
    const time = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
    const slotDate = parse(`${dayKey} ${time}`, 'yyyy-MM-dd HH:mm', new Date());

    // Un horario ya pasado no se ofrece ni como ocupado: sólo confunde.
    if (slotDate.getTime() <= now.getTime()) continue;

    const match = suggestions.find((s) => s.time === time);
    slots.push(
      match
        ? {
            time,
            isAvailable: true,
            doctorId: match.doctorId,
            doctorName: match.doctorName,
            doctorEmail: match.doctorEmail,
            calendarSourceId: match.calendarSourceId,
            calendarName: match.calendarName,
          }
        : { time, isAvailable: false },
    );
  }

  return slots;
}

interface SuggestedTime {
  time: string;
  doctorId: string;
  doctorName: string;
  doctorEmail: string;
  calendarSourceId: string;
  calendarName: string;
}

/**
 * Llama al generador de sugerencias del backend. Omitir `mode` es lo que lo
 * hace devolver `suggestedTimes` en vez de un simple sí/no
 * (ver `docs/n8n-flows/Agent_Availability2.json`).
 */
async function fetchSuggestedTimes(
  dayStart: Date,
  slotMinutes: number,
  calendarSourceIds: string[],
  authMode: BookingAuthMode,
): Promise<SuggestedTime[]> {
  try {
    const params: Record<string, string> = {
      startingDateAndTime: toLocalISOString(dayStart),
      endingDateAndTime: toLocalISOString(addDays(dayStart, 1)),
      durationInMinutes: String(slotMinutes),
    };
    if (calendarSourceIds.length > 0) {
      params.calendar_source_ids = calendarSourceIds.join(',');
    }

    const data = await api.get(availabilityRoute(authMode), params);

    const result = Array.isArray(data) ? (data[0]?.json ?? data[0]) : data;
    const raw: any[] = Array.isArray(result?.suggestedTimes) ? result.suggestedTimes : [];
    const dayKey = format(dayStart, 'yyyy-MM-dd');

    return raw
      .filter((s) => !s.fecha_cita || String(s.fecha_cita).startsWith(dayKey))
      .map((s) => ({
        time: String(s.hora_cita ?? '').slice(0, 5),
        doctorId: String(s.user_id ?? ''),
        doctorName: String(s.user_name ?? ''),
        doctorEmail: String(s.user_email ?? ''),
        calendarSourceId: String(s.calendar_source_id ?? ''),
        calendarName: String(s.calendar_name ?? ''),
      }))
      .filter((s) => s.time);
  } catch (error) {
    console.error('Failed to load availability suggestions:', error);
    return [];
  }
}

export interface CreatePatientAppointmentInput {
  patient: User;
  date: string; // yyyy-MM-dd
  slot: BookingSlot;
  /** Lo que le pasa al paciente, en sus palabras. */
  reason: string;
  slotMinutes?: number;
  authMode?: BookingAuthMode;
}

/**
 * Crea la cita solicitada por el paciente reutilizando `/appointments/upsert`
 * con el mismo payload que arma `AppointmentFormDialog`.
 *
 * El backend fuerza `status='pending'` para tokens de paciente, de modo que la
 * cita queda a confirmar por recepción (ver docs/patient-portal.md §1).
 */
export async function createPatientAppointment({
  patient,
  date,
  slot,
  reason,
  slotMinutes = PATIENT_SLOT_MINUTES,
  authMode = 'session',
}: CreatePatientAppointmentInput) {
  const start = parse(`${date} ${slot.time}`, 'yyyy-MM-dd HH:mm', new Date());
  const end = new Date(start.getTime() + slotMinutes * 60_000);

  const payload = {
    start: toLocalISOString(start),
    end: toLocalISOString(end),
    mode: 'create',
    doctor_id: slot.doctorId ?? '',
    doctor_name: slot.doctorName ?? '',
    doctor_email: slot.doctorEmail ?? '',
    patient_id: patient.id,
    patient_name: patient.name,
    patient_email: patient.email ?? '',
    patient_phone: patient.phone_number ?? '',
    summary: `${patient.name} - Solicitud del paciente`,
    service_ids: [] as string[],
    service_names: '',
    notes: reason.trim(),
    calendar_source_id: slot.calendarSourceId ?? '',
    quote_id: null,
    // El backend lo vuelve a forzar; se manda explícito para dejar la intención clara.
    status: 'pending',
  };

  const response = await api.post(upsertRoute(authMode), payload);
  const result = Array.isArray(response) ? response[0] : response;

  if (result?.error || (result?.code && result.code >= 400)) {
    throw new Error(result?.message || 'No se pudo crear la cita.');
  }

  return result;
}

/**
 * Reagenda una cita del paciente: crea la nueva y recién entonces cancela la
 * anterior con motivo `reschedule`.
 *
 * **El orden importa.** Si se cancelara primero y la creación fallara, el
 * paciente se quedaría sin ninguna cita. Creando primero, el peor caso es que
 * queden dos citas —recuperable por recepción— en vez de ninguna.
 *
 * Se hace acá, en dos pasos, y no con `/appointments/reschedule`, porque ese
 * endpoint mueve la misma cita conservando doctor y consultorio; el paciente en
 * cambio elige un hueco libre cualquiera, que puede caer en otro profesional o
 * en otra sede.
 */
export async function reschedulePatientAppointment({
  previous,
  ...createInput
}: CreatePatientAppointmentInput & { previous: Appointment }) {
  const created = await createPatientAppointment(createInput);

  await notifyAppointmentChange({
    event: 'rescheduled',
    appointmentId: (created as any)?.id ?? (created as any)?.appointment_id,
    patient: createInput.patient,
    date: createInput.date,
    time: createInput.slot.time,
    doctorName: createInput.slot.doctorName,
    sedeName: createInput.slot.calendarName,
    reason: createInput.reason,
    previousDate: previous.date,
    previousTime: previous.time,
  });

  try {
    await updateAppointmentStatusRequest({
      appointment: previous,
      newStatus: 'cancelled',
      // NO usar 'reschedule': el flujo `/appointments/update_status` lo rechaza
      // explícitamente ("can only be set by the reschedule endpoint") y por eso
      // la cita vieja quedaba activa. Los motivos aceptados son:
      // late | in_time | no_notice | by_doctor | by_clinic | other.
      // 'in_time' es el que corresponde a una cancelación hecha por el propio
      // paciente con antelación — el mismo que usa el diálogo de cancelar.
      cancellation_reason: 'in_time',
    });
  } catch (error) {
    // La cita nueva ya existe: no se revierte. Se informa para que el paciente
    // sepa que la vieja sigue en pie y la clínica pueda resolverlo.
    console.error('Failed to cancel the previous appointment while rescheduling:', error);
    return { ...created, __previousStillActive: true };
  }

  return created;
}

/** Qué le pasó a la cita. Define el asunto y el cuerpo del correo. */
export type AppointmentNotifyEvent = 'booked' | 'rescheduled' | 'cancelled';

export interface NotifyAppointmentInput {
  event: AppointmentNotifyEvent;
  appointmentId?: string;
  patient: Pick<User, 'id' | 'name' | 'email'>;
  date: string;
  time: string;
  doctorName?: string;
  sedeName?: string;
  reason?: string;
  /** Sólo en `rescheduled`: fecha y hora que se dejaron atrás. */
  previousDate?: string;
  previousTime?: string;
}

/**
 * Avisa al paciente y a la clínica de cualquier cambio que el paciente haga
 * sobre una cita: reservarla, reagendarla o cancelarla.
 *
 * Es un flujo aparte y no un agregado a `/appointments/upsert`: ese endpoint lo
 * usa toda la app (agenda del staff incluida) y cambiarlo mandaría correos en
 * situaciones donde hoy no se manda.
 *
 * **Nunca lanza.** La operación sobre la cita ya se completó y el paciente ya
 * vio la confirmación en pantalla; que falle el correo no puede hacer que
 * parezca que la cita falló.
 */
export async function notifyAppointmentChange(input: NotifyAppointmentInput): Promise<void> {
  try {
    await api.post(API_ROUTES.PATIENT_AUTH.APPOINTMENT_NOTIFY, {
      event: input.event,
      appointment_id: input.appointmentId ?? null,
      patient_id: input.patient.id,
      patient_name: input.patient.name,
      patient_email: input.patient.email,
      date: input.date,
      time: input.time,
      doctor_name: input.doctorName ?? '',
      sede_name: input.sedeName ?? '',
      reason: input.reason ?? '',
      previous_date: input.previousDate ?? null,
      previous_time: input.previousTime ?? null,
    });
  } catch (error) {
    console.error(`Failed to send the "${input.event}" appointment email:`, error);
  }
}
