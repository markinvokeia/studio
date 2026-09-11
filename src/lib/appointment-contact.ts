import type { Appointment, ResponsibleContact } from '@/lib/types';

/**
 * Normaliza el sub-json `responsible_contact` que trae el backend (`Get_Appointments`,
 * `Search_Appointments`) cuando el paciente de la cita tiene un responsable/tutor
 * asociado. `null`/objeto sin `id` significa que el paciente no tiene responsable.
 */
export function normalizeResponsibleContact(raw: any): ResponsibleContact | null {
  if (!raw || typeof raw !== 'object' || raw.id == null) return null;
  return {
    id: String(raw.id),
    name: raw.name || '',
    email: raw.email ?? null,
    phone_number: raw.phone_number ?? null,
    address: raw.address ?? null,
  };
}

/** Email/teléfono a mostrar para una cita, y si vienen del responsable del paciente. */
export interface EffectiveAppointmentContact {
  email?: string;
  phone?: string;
  /** El email/teléfono resuelto vino del responsable, no del paciente. */
  fromResponsibleContact: boolean;
}

/**
 * Resuelve el contacto a mostrar para una cita: si el paciente no tiene email
 * y/o teléfono propio pero tiene un responsable asociado, usa el del
 * responsable. Mismo criterio que `effectivePatientEmail`/`effectivePatientPhone`
 * en la ficha de paciente (`src/app/[locale]/patients/page.tsx`).
 */
export function getEffectiveAppointmentContact(appointment: Pick<Appointment, 'patientEmail' | 'patientPhone' | 'responsibleContact'>): EffectiveAppointmentContact {
  const responsible = appointment.responsibleContact;
  const email = appointment.patientEmail || responsible?.email || undefined;
  const phone = appointment.patientPhone || responsible?.phone_number || undefined;
  const fromResponsibleContact = Boolean(
    responsible && ((!appointment.patientEmail && email) || (!appointment.patientPhone && phone)),
  );

  return { email: email || undefined, phone: phone || undefined, fromResponsibleContact };
}

/**
 * Aplica a la lista de citas los datos frescos de un paciente recién editado
 * (nombre/email/teléfono y, si aplica, el responsable ya resuelto). Se usa
 * cuando se guarda el formulario de paciente desde "Datos del paciente" (citas)
 * o desde el sheet de detalle: esa edición no dispara el SSE `calendar_changed`
 * (no es un cambio de cita), así que sin esto la agenda queda con el teléfono
 * o el responsable viejo hasta el próximo refetch completo.
 */
export function patchAppointmentsForPatient(
  appointments: Appointment[],
  patient: { id: string; name?: string; email?: string | null; phone_number?: string | null },
  responsibleContact: ResponsibleContact | null,
): Appointment[] {
  let changed = false;
  const next = appointments.map((a) => {
    if (a.patientId !== patient.id) return a;
    changed = true;
    return {
      ...a,
      patientName: patient.name || a.patientName,
      patientEmail: patient.email || undefined,
      patientPhone: patient.phone_number || undefined,
      responsibleContact,
    };
  });
  return changed ? next : appointments;
}
