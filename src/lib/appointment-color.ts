import type { Appointment, AppointmentColorSource, CalendarColorSources } from '@/lib/types';

/** Por defecto cuentan todos los niveles: es el comportamiento previo a que fuera configurable. */
export const DEFAULT_COLOR_SOURCES: CalendarColorSources = {
  service: true,
  doctor: true,
  calendar: true,
};

/** Blanco cuenta como "sin color" en toda la cadena. */
export const isWhiteColor = (color: string | null | undefined): boolean => {
  if (!color) return true;
  const n = color.toLowerCase().replace(/\s/g, '');
  return n === '#ffffff' || n === '#fff' || n === 'white' || n === 'rgb(255,255,255)' || n === 'rgba(255,255,255,1)' || n === 'hsl(0,0%,100%)';
};

/**
 * Cadena de color de una cita: color propio > servicio > doctor > calendario.
 * Los niveles heredables desactivados en `sources` se saltan; el color propio
 * no es configurable y siempre gana. Devuelve además qué nivel ganó, que el
 * calendario usa para distinguir un color asignado de uno heredado.
 */
export function resolveAppointmentColor({
  ownColor,
  serviceColor,
  doctorColor,
  calendarColor,
  sources = DEFAULT_COLOR_SOURCES,
}: {
  ownColor?: string | null;
  serviceColor?: string | null;
  doctorColor?: string | null;
  calendarColor?: string | null;
  sources?: CalendarColorSources;
}): { color: string | undefined; colorSource: AppointmentColorSource } {
  if (ownColor && !isWhiteColor(ownColor)) return { color: ownColor, colorSource: 'appointment' };
  if (sources.service && serviceColor && !isWhiteColor(serviceColor)) return { color: serviceColor, colorSource: 'service' };
  if (sources.doctor && doctorColor && !isWhiteColor(doctorColor)) return { color: doctorColor, colorSource: 'doctor' };
  if (sources.calendar && calendarColor && !isWhiteColor(calendarColor)) return { color: calendarColor, colorSource: 'calendar' };
  return { color: undefined, colorSource: 'none' };
}

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
