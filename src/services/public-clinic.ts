import { API_ROUTES } from '@/constants/routes';
import type { PublicClinicInfo, PublicClinicSchedule, PublicSede } from '@/lib/types';
import { api } from '@/services/api';

/**
 * Video genérico de Invoke IA, usado mientras la clínica no cargue el suyo.
 * Lo resuelve `resolveVideoEmbed`, así que puede ser un enlace de YouTube.
 */
export const DEFAULT_WELCOME_VIDEO_URL = 'https://youtu.be/9YkCgKVYZ_U';

/**
 * Datos públicos de la clínica para la landing `/patient-login`.
 *
 * Es el único endpoint del portal que se consulta sin token y sin identificar a
 * nadie, así que sólo devuelve información que la clínica ya publica: nombre,
 * dirección, contacto, logo y el video/mensaje de bienvenida.
 *
 * Nunca lanza: si el backend no responde, la landing igual tiene que renderizar
 * con los textos por defecto.
 */
let cachedRequest: Promise<PublicClinicInfo | null> | null = null;

export function fetchPublicClinicInfo(): Promise<PublicClinicInfo | null> {
  // La consultan la landing, el footer del portal y el panel de reserva. Los
  // datos de la clínica no cambian durante una sesión, así que se comparte la
  // misma promesa en vez de pegarle al backend una vez por consumidor.
  if (!cachedRequest) cachedRequest = requestPublicClinicInfo();
  return cachedRequest;
}

async function requestPublicClinicInfo(): Promise<PublicClinicInfo | null> {
  try {
    const data = await api.get(API_ROUTES.PATIENT_AUTH.PUBLIC_CLINIC);
    const raw = Array.isArray(data) ? (data[0]?.json ?? data[0]) : (data?.json ?? data);
    if (!raw || !raw.name) return null;

    /** Normaliza y ordena por día de la semana; el pie los muestra alineados. */
    const normalizeSchedules = (value: any): PublicClinicSchedule[] =>
      (Array.isArray(value) ? value : [])
        .map((s: any) => ({
          day_of_week: Number(s.day_of_week),
          start_time: String(s.start_time ?? '').slice(0, 5),
          end_time: String(s.end_time ?? '').slice(0, 5),
        }))
        .filter((s: PublicClinicSchedule) => !Number.isNaN(s.day_of_week) && s.start_time && s.end_time)
        .sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time));

    const schedules: PublicClinicSchedule[] = Array.isArray(raw.schedules)
      ? raw.schedules
          .map((s: any) => ({
            day_of_week: Number(s.day_of_week),
            start_time: String(s.start_time ?? '').slice(0, 5),
            end_time: String(s.end_time ?? '').slice(0, 5),
          }))
          .filter((s: PublicClinicSchedule) => !Number.isNaN(s.day_of_week) && s.start_time && s.end_time)
      : [];

    // Los nombres siguen las columnas reales de `public.clinic`:
    // address / phone / email. (El baseline de Liquibase declara location /
    // phone_number / contact_email, pero está desactualizado.)
    return {
      name: String(raw.name),
      address: raw.address || null,
      phone: raw.phone || null,
      email: raw.email || null,
      logo_url: raw.logo_url || raw.logo_base64 || null,
      welcome_video_url: raw.welcome_video_url || null,
      welcome_message: raw.welcome_message || null,
      // Se asume habilitado salvo que el backend diga explícitamente que no,
      // para no dejar la landing muerta si la columna todavía no está migrada.
      patient_portal_enabled: raw.patient_portal_enabled !== false,
      online_booking_enabled: raw.online_booking_enabled !== false,
      appointments_only: raw.appointments_only === true,
      schedules,
    };
  } catch (error) {
    console.error('Failed to load public clinic info:', error);
    cachedRequest = null;   // un fallo no se cachea: el próximo consumidor reintenta
    return null;
  }
}

/**
 * Sedes visibles sin sesión, desde `/sedes_noauth`.
 *
 * Es la fuente de identidad y contacto (nombre, dirección, teléfono, email).
 * **No devuelve horarios**: esos salen de `/api/public/clinic`, que los agrupa
 * por `clinic_schedules.sede_id`, y el pie los cruza por id.
 *
 * Nunca lanza: sin sedes el pie cae a los datos sueltos de la clínica.
 */
export async function fetchPublicSedes(): Promise<PublicSede[]> {
  try {
    const data = await api.get(API_ROUTES.PATIENT_AUTH.PUBLIC_SEDES, { page: '1', limit: '200' });
    const raw: any[] = Array.isArray(data) ? data : (data?.sedes || data?.data || data?.result || []);

    return raw
      .filter((s) => s?.is_active !== false)
      .map((s) => ({
        id: String(s.id),
        name: s.name || '',
        address: s.address || null,
        phone: s.phone || null,
        email: s.email || null,
        schedules: [],
      }));
  } catch (error) {
    console.error('Failed to load public sedes:', error);
    return [];
  }
}

/**
 * Horarios de atención de una sede, desde `/schedules_noauth?sede_id=`.
 *
 * El backend devuelve las horas como `HH:MM:SS` y sin ordenar; acá se recortan
 * a `HH:MM` y se ordenan por día y hora de inicio, que es como se muestran.
 *
 * Nunca lanza: sin horarios el pie muestra "a confirmar".
 */
export async function fetchPublicSedeSchedules(sedeId: string): Promise<PublicClinicSchedule[]> {
  if (!sedeId) return [];
  try {
    const data = await api.get(API_ROUTES.PATIENT_AUTH.PUBLIC_SCHEDULES, { sede_id: sedeId });
    const raw: any[] = Array.isArray(data) ? data : (data?.schedules || data?.data || data?.result || []);

    return raw
      .map((s) => ({
        day_of_week: Number(s.day_of_week),
        start_time: String(s.start_time ?? '').slice(0, 5),
        end_time: String(s.end_time ?? '').slice(0, 5),
      }))
      .filter((s) => !Number.isNaN(s.day_of_week) && s.start_time && s.end_time)
      .sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time));
  } catch (error) {
    console.error('Failed to load sede schedules:', error);
    return [];
  }
}
