import { API_ROUTES } from '@/constants/routes';
import type { PatientPortalConfig } from '@/lib/types';
import { api, type ApiRequestOptions } from '@/services/api';

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
  service_selection_enabled: false,
  default_service_id: '',
  show_pricing: false,
  welcome_video_url: '',
  welcome_message: '',
};

export async function fetchPatientPortalConfig(options?: ApiRequestOptions): Promise<PatientPortalConfig> {
  const data = await api.get(API_ROUTES.PATIENT_AUTH.PUBLIC_CLINIC, undefined, undefined, options);
  const raw = Array.isArray(data) ? (data[0]?.json ?? data[0]) : (data?.json ?? data);

  if (!raw) return DEFAULT_PATIENT_PORTAL_CONFIG;

  return {
    patient_portal_enabled: raw.patient_portal_enabled === true,
    online_booking_enabled: raw.online_booking_enabled !== false,
    appointments_only: raw.appointments_only === true,
    service_selection_enabled: raw.service_selection_enabled === true,
    // El endpoint público devuelve el servicio por defecto ya resuelto (con
    // nombre y duración); acá sólo interesa el id, que es lo que se guarda.
    default_service_id: raw.default_service?.id != null ? String(raw.default_service.id) : '',
    show_pricing: raw.show_pricing === true,
    welcome_video_url: raw.welcome_video_url ?? '',
    welcome_message: raw.welcome_message ?? '',
  };
}

export async function updatePatientPortalConfig(config: PatientPortalConfig, options?: ApiRequestOptions): Promise<void> {
  const response = await api.post(API_ROUTES.PATIENT_PORTAL_CONFIG, {
    patient_portal_enabled: config.patient_portal_enabled,
    online_booking_enabled: config.online_booking_enabled,
    appointments_only: config.appointments_only,
    service_selection_enabled: config.service_selection_enabled,
    show_pricing: config.show_pricing,
    // El id es entero en la BD; vacío ⇒ NULL ⇒ la reserva se crea sin servicio.
    default_service_id: config.default_service_id ? Number(config.default_service_id) : null,
    // Cadena vacía ⇒ NULL en la BD ⇒ el portal cae a sus valores por defecto
    // (video genérico de Invoke IA y copy traducido).
    welcome_video_url: config.welcome_video_url.trim() || null,
    welcome_message: config.welcome_message.trim() || null,
  }, undefined, undefined, options);

  const result = Array.isArray(response) ? response[0] : response;
  if (result?.error || (result?.code && result.code >= 400)) {
    throw new Error(result?.message || 'No se pudo guardar la configuración.');
  }
}
