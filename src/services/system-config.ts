import { API_ROUTES } from '@/constants/routes';
import type {
  ClinicAutomationSettings,
  GoogleCalendarSyncMode,
  ScheduleExportColumn,
  ScheduleExportMode,
  ScheduleExportSettings,
  SystemConfiguration,
} from '@/lib/types';
import { api, REQUEST_TIMEOUT_MS, type ApiRequestOptions } from '@/services/api';

/**
 * Claves de `system_configurations` que lee n8n y que se editan desde pantallas
 * propias (no desde la tabla genérica de Sistema → Configuración). Ambas se
 * crean desactivadas con database/scripts/133.
 */
export const ALERT_EMAIL_AUTO_SEND_KEY = 'alert_email_auto_send_enabled';
export const GOOGLE_CALENDAR_SYNC_MODE_KEY = 'google_calendar_sync_mode';
/** Asistente guiado: si la mascota se ve (database/scripts/142). Sin la clave, se ve. */
export const HELP_MASCOT_VISIBLE_KEY = 'help_mascot_visible';

/**
 * Formato del Excel de la agenda (json: modo, hoja por sede y columnas del extendido).
 * Sin la clave (lo normal: no hay script que la cree) vale el básico de siempre; la
 * primera vez que se guarda desde Preferencias de Clínica se crea la fila.
 */
export const SCHEDULE_EXPORT_KEY = 'appointment_schedule_export';
const SCHEDULE_EXPORT_DESCRIPTION =
  'Exportar agenda a Excel (json). mode: basic (un calendario, Horario/Nombre/Teléfono con una fila por día) o extended (varios calendarios y sedes). split_by_sede: en extended, una hoja por sede. columns: columnas del extended, en orden.';

export const GOOGLE_CALENDAR_SYNC_MODES: GoogleCalendarSyncMode[] = ['none', 'from_google', 'to_google', 'both'];
export const SCHEDULE_EXPORT_MODES: ScheduleExportMode[] = ['basic', 'extended'];
/** Todas las columnas del extendido, en el orden en que se ofrecen. */
export const SCHEDULE_EXPORT_COLUMNS: ScheduleExportColumn[] = [
  'sede',
  'calendar',
  'date',
  'time',
  'end_time',
  'patient_name',
  'phone',
  'email',
  'doctor',
  'service',
  'status',
  'notes',
];
export const DEFAULT_SCHEDULE_EXPORT_COLUMNS: ScheduleExportColumn[] = ['sede', 'calendar', 'date', 'time', 'patient_name', 'phone'];
export const DEFAULT_SCHEDULE_EXPORT_SETTINGS: ScheduleExportSettings = {
  mode: 'basic',
  split_by_sede: false,
  columns: DEFAULT_SCHEDULE_EXPORT_COLUMNS,
};

export async function fetchSystemConfigs(options?: ApiRequestOptions): Promise<SystemConfiguration[]> {
  const data = await api.get(API_ROUTES.SYSTEM.CONFIGS, undefined, undefined, options);
  const list = Array.isArray(data) ? data : (data?.configs || data?.data || data?.result || []);
  return list as SystemConfiguration[];
}

interface SystemConfigWrite {
  key: string;
  value: string;
  data_type: SystemConfiguration['data_type'];
  description: string;
}

/**
 * Guarda una clave. Relee la lista justo antes para mandar el `id` de la fila
 * existente: sin él el upsert intentaría crear otra fila con la misma clave.
 */
export async function saveSystemConfig(config: SystemConfigWrite, options?: ApiRequestOptions): Promise<void> {
  const existing = (await fetchSystemConfigs({ signal: options?.signal })).find((c) => c.key === config.key);
  const response = await api.post(
    API_ROUTES.SYSTEM.CONFIGS_UPSERT,
    { ...(existing ? { id: existing.id } : {}), ...config, is_public: existing?.is_public ?? false },
    undefined,
    undefined,
    { timeoutMs: REQUEST_TIMEOUT_MS.mutation, ...options }
  );
  const result = Array.isArray(response) ? response[0] : response;
  if (result?.error || (result?.code && result.code >= 400)) {
    throw new Error(result?.message || 'No se pudo guardar la configuración.');
  }
}

export function parseAlertEmailAutoSend(configs: SystemConfiguration[]): boolean {
  const value = configs.find((c) => c.key === ALERT_EMAIL_AUTO_SEND_KEY)?.value;
  return String(value ?? '').trim().toLowerCase() === 'true';
}

export function parseGoogleCalendarSyncMode(configs: SystemConfiguration[]): GoogleCalendarSyncMode {
  const value = String(configs.find((c) => c.key === GOOGLE_CALENDAR_SYNC_MODE_KEY)?.value ?? '').trim().toLowerCase();
  return (GOOGLE_CALENDAR_SYNC_MODES as string[]).includes(value) ? (value as GoogleCalendarSyncMode) : 'none';
}

export function parseHelpMascotVisible(configs: SystemConfiguration[]): boolean {
  const value = configs.find((c) => c.key === HELP_MASCOT_VISIBLE_KEY)?.value;
  return String(value ?? 'true').trim().toLowerCase() !== 'false';
}

/**
 * Lee la clave tolerando valores viejos o a medio escribir: lo que falta o no se
 * reconoce toma el valor por defecto, y las columnas desconocidas o repetidas se
 * descartan (si no queda ninguna, van las de por defecto).
 */
export function parseScheduleExportSettings(configs: SystemConfiguration[]): ScheduleExportSettings {
  const raw: unknown = configs.find((c) => c.key === SCHEDULE_EXPORT_KEY)?.value;
  let obj: Record<string, unknown> = {};
  try {
    const parsed = typeof raw === 'string' ? (raw.trim() ? JSON.parse(raw) : {}) : raw;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) obj = parsed as Record<string, unknown>;
  } catch {
    /* JSON inválido: por defecto */
  }
  const columns = Array.isArray(obj.columns)
    ? Array.from(new Set(obj.columns.filter((c): c is ScheduleExportColumn =>
        (SCHEDULE_EXPORT_COLUMNS as unknown[]).includes(c))))
    : [];
  return {
    mode: obj.mode === 'extended' ? 'extended' : 'basic',
    split_by_sede: obj.split_by_sede === true,
    columns: columns.length ? columns : DEFAULT_SCHEDULE_EXPORT_COLUMNS,
  };
}

/**
 * Formato del Excel de la agenda para el diálogo de exportar. Si no se puede leer
 * (sin permiso sobre `/configs`, red caída) se exporta en básico: nunca bloquea.
 */
export async function fetchScheduleExportSettings(options?: ApiRequestOptions): Promise<ScheduleExportSettings> {
  try {
    return parseScheduleExportSettings(await fetchSystemConfigs(options));
  } catch (error) {
    if (options?.signal?.aborted) throw error;
    console.warn('[schedule-export] no se pudo leer el formato; se usa el básico', error);
    return DEFAULT_SCHEDULE_EXPORT_SETTINGS;
  }
}

export const DEFAULT_CLINIC_AUTOMATION_SETTINGS: ClinicAutomationSettings = {
  alert_email_auto_send_enabled: false,
  google_calendar_sync_mode: 'none',
  help_mascot_visible: true,
  appointment_schedule_export: DEFAULT_SCHEDULE_EXPORT_SETTINGS,
};

export async function fetchClinicAutomationSettings(options?: ApiRequestOptions): Promise<ClinicAutomationSettings> {
  const configs = await fetchSystemConfigs(options);
  return {
    alert_email_auto_send_enabled: parseAlertEmailAutoSend(configs),
    google_calendar_sync_mode: parseGoogleCalendarSyncMode(configs),
    help_mascot_visible: parseHelpMascotVisible(configs),
    appointment_schedule_export: parseScheduleExportSettings(configs),
  };
}

/** Guarda solo las claves que cambiaron respecto de `previous`, una tras otra. */
export async function updateClinicAutomationSettings(
  next: ClinicAutomationSettings,
  previous: ClinicAutomationSettings,
  options?: ApiRequestOptions
): Promise<void> {
  if (next.alert_email_auto_send_enabled !== previous.alert_email_auto_send_enabled) {
    await saveSystemConfig({
      key: ALERT_EMAIL_AUTO_SEND_KEY,
      value: next.alert_email_auto_send_enabled ? 'true' : 'false',
      data_type: 'boolean',
      description: 'Interruptor general del envío automático de emails de alertas. Con false no se envía ningún email automático aunque la regla tenga auto_send_email.',
    }, options);
  }
  if (next.google_calendar_sync_mode !== previous.google_calendar_sync_mode) {
    await saveSystemConfig({
      key: GOOGLE_CALENDAR_SYNC_MODE_KEY,
      value: next.google_calendar_sync_mode,
      data_type: 'string',
      description: 'Sincronización con Google Calendar: none (no sincroniza), from_google (Google → app), to_google (app → Google), both (ambas).',
    }, options);
  }
  if (next.help_mascot_visible !== previous.help_mascot_visible) {
    await saveSystemConfig({
      key: HELP_MASCOT_VISIBLE_KEY,
      value: next.help_mascot_visible ? 'true' : 'false',
      data_type: 'boolean',
      description: 'Asistente guiado: si la mascota se ve en pantalla. Con false las guías funcionan igual (resaltado, globo, barra y lista de pasos) pero sin la mascota, y al asistente se entra por el ícono de ayuda.',
    }, options);
  }
  if (JSON.stringify(next.appointment_schedule_export) !== JSON.stringify(previous.appointment_schedule_export)) {
    await saveSystemConfig({
      key: SCHEDULE_EXPORT_KEY,
      value: JSON.stringify(next.appointment_schedule_export),
      data_type: 'json',
      description: SCHEDULE_EXPORT_DESCRIPTION,
    }, options);
  }
}
