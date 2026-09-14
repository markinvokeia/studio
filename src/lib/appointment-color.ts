import type { Appointment } from '@/lib/types';

/**
 * Color que le pertenece a la cita, para reenviarlo en un upsert.
 *
 * `appointments/upsert` reescribe la fila entera: la columna `color` que no viaja
 * en el payload queda vacía. Los guardados que no son "elegir color" —mover o
 * redimensionar por arrastre, reasignar doctor o consultorio, editar desde el
 * formulario— tienen que devolverlo tal cual estaba o le borran al usuario la
 * etiqueta que había puesto.
 *
 * Se devuelve SOLO el color propio, nunca el heredado: `appointment.color` ya
 * viene resuelto por la cadena cita > servicio > doctor > consultorio, así que
 * mandarlo sin mirar convertiría el color del doctor en una etiqueta propia de la
 * cita, que es un cambio de significado (y de cómo la pinta el calendario).
 * `colorId` es el id de la paleta de Google, que es lo que el backend guarda;
 * `colorSource` cubre las filas viejas o importadas con un hex suelto.
 */
export function getOwnAppointmentColor(appointment: Appointment | null | undefined): string | undefined {
  if (!appointment) return undefined;
  if (appointment.colorId) return appointment.colorId;
  return appointment.colorSource === 'appointment' ? (appointment.color || undefined) : undefined;
}
