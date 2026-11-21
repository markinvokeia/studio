import { useVoiceCommand } from '@/stores/voice-command-store';

import type { Appointment } from '@/lib/types';

/**
 * Foco de la conversación: la última cita (y su paciente) que se eligió por voz. Los pedidos
 * siguientes que no nombran otra («marcala como llegó», «abrí su cuenta», «¿cuánto debe?») actúan
 * sobre ella. Se limpia con «olvidá esa cita», al elegir otra o a los 30 minutos sin usarla.
 */

const FOCUS_TTL_MS = 30 * 60 * 1000;

interface Focus {
  appointment: Appointment;
  at: number;
}

let focus: Focus | null = null;

const label = (appt: Appointment) => appt.patientName || appt.summary || String(appt.id);

export function setAppointmentFocus(appointment: Appointment | null) {
  focus = appointment ? { appointment, at: Date.now() } : null;
  useVoiceCommand.getState().set({ focusLabel: appointment ? label(appointment) : null });
}

/** La cita en foco (vigente), o null. Usarla la renueva. */
export function getAppointmentFocus(): Appointment | null {
  if (!focus) return null;
  if (Date.now() - focus.at > FOCUS_TTL_MS) {
    setAppointmentFocus(null);
    return null;
  }
  focus.at = Date.now();
  return focus.appointment;
}

export function hasAppointmentFocus(): boolean {
  return !!focus && Date.now() - focus.at <= FOCUS_TTL_MS;
}

/** Con la cita actualizada (la pantalla recargó): mantiene el foco con los datos nuevos. */
export function refreshAppointmentFocus(find: (id: string) => Appointment | undefined) {
  if (!focus) return;
  const fresh = find(String(focus.appointment.id));
  if (fresh) focus.appointment = fresh;
}

/**
 * Ley: lo que está seleccionado en la pantalla es de lo que se habla, salvo que se nombre otra
 * cosa. La pantalla llama a esto con lo que muestra seleccionado (la tarjeta o el detalle de una
 * cita abiertos) en cada render: al cambiar la selección pasa a ser el foco; al soltarla, el foco
 * que había puesto se suelta (si la voz eligió otra cosa mientras tanto, se respeta esa).
 */
let uiSelectedId: string | null = null;
export function syncUiSelection(appointment: Appointment | null) {
  const id = appointment ? String(appointment.id) : null;
  if (id === uiSelectedId) return;
  const previous = uiSelectedId;
  uiSelectedId = id;
  if (appointment) setAppointmentFocus(appointment);
  else if (previous && focus && String(focus.appointment.id) === previous) setAppointmentFocus(null);
}

/** Solo para las pruebas: olvidar la selección de la pantalla. */
export function resetUiSelection() {
  uiSelectedId = null;
}
