import { API_ROUTES } from '@/constants/routes';
import type { ClinicAutomationSettings, GoogleCalendarSyncMode, SystemConfiguration } from '@/lib/types';
import { api, REQUEST_TIMEOUT_MS, type ApiRequestOptions } from '@/services/api';

/**
 * Claves de `system_configurations` que lee n8n y que se editan desde pantallas
 * propias (no desde la tabla genérica de Sistema → Configuración). Ambas se
 * crean desactivadas con database/scripts/133.
 */
export const ALERT_EMAIL_AUTO_SEND_KEY = 'alert_email_auto_send_enabled';
export const GOOGLE_CALENDAR_SYNC_MODE_KEY = 'google_calendar_sync_mode';

export const GOOGLE_CALENDAR_SYNC_MODES: GoogleCalendarSyncMode[] = ['none', 'from_google', 'to_google', 'both'];

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

export const DEFAULT_CLINIC_AUTOMATION_SETTINGS: ClinicAutomationSettings = {
  alert_email_auto_send_enabled: false,
  google_calendar_sync_mode: 'none',
};

export async function fetchClinicAutomationSettings(options?: ApiRequestOptions): Promise<ClinicAutomationSettings> {
  const configs = await fetchSystemConfigs(options);
  return {
    alert_email_auto_send_enabled: parseAlertEmailAutoSend(configs),
    google_calendar_sync_mode: parseGoogleCalendarSyncMode(configs),
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
}
