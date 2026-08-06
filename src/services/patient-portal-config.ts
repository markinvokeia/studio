import { API_ROUTES } from '@/constants/routes';
import type { PatientPortalConfig } from '@/lib/types';
import { api } from '@/services/api';

/**
 * Ajustes de Configuración → Portal del Paciente.
 *
 * Viven en la tabla `clinic` pero se administran aparte de los Datos de la
 * Clínica: son ajustes de producto (¿el portal está abierto?, ¿se puede
 * reservar?, ¿sólo reservar?) y no datos fiscales o de contacto.
 *
 * La lectura reutiliza el endpoint público — son los mismos campos que ya
 * consume la landing, así no hace falta un GET nuevo. La escritura sí tiene su
 * propio endpoint, **sólo de actualización**: nunca crea clínicas.
 */

export const DEFAULT_PATIENT_PORTAL_CONFIG: PatientPortalConfig = {
  patient_portal_enabled: false,
  online_booking_enabled: true,
  appointments_only: false,
  welcome_video_url: '',
  welcome_message: '',
};

export async function fetchPatientPortalConfig(): Promise<PatientPortalConfig> {
  const data = await api.get(API_ROUTES.PATIENT_AUTH.PUBLIC_CLINIC);
  const raw = Array.isArray(data) ? (data[0]?.json ?? data[0]) : (data?.json ?? data);

  if (!raw) return DEFAULT_PATIENT_PORTAL_CONFIG;

  return {
    patient_portal_enabled: raw.patient_portal_enabled === true,
    online_booking_enabled: raw.online_booking_enabled !== false,
    appointments_only: raw.appointments_only === true,
    welcome_video_url: raw.welcome_video_url ?? '',
    welcome_message: raw.welcome_message ?? '',
  };
}

export async function updatePatientPortalConfig(config: PatientPortalConfig): Promise<void> {
  const response = await api.post(API_ROUTES.PATIENT_PORTAL_CONFIG, {
    patient_portal_enabled: config.patient_portal_enabled,
    online_booking_enabled: config.online_booking_enabled,
    appointments_only: config.appointments_only,
    // Cadena vacía ⇒ NULL en la BD ⇒ el portal cae a sus valores por defecto
    // (video genérico de Invoke IA y copy traducido).
    welcome_video_url: config.welcome_video_url.trim() || null,
    welcome_message: config.welcome_message.trim() || null,
  });

  const result = Array.isArray(response) ? response[0] : response;
  if (result?.error || (result?.code && result.code >= 400)) {
    throw new Error(result?.message || 'No se pudo guardar la configuración.');
  }
}
