import { API_ROUTES } from '@/constants/routes';
import type { ClinicPreferences } from '@/lib/types';
import { api } from '@/services/api';

/**
 * Preferencias de Configuración → Preferencias de Clínica.
 *
 * Viven en su propia tabla (`clinic_preferences`), no en `clinic`: son ajustes
 * de producto que el frontend carga una única vez tras el login y cachea en
 * `clinic-preferences-store`. Por eso tienen endpoint propio y no viajan con
 * los Datos de la Clínica.
 */

export const DEFAULT_CLINIC_PREFERENCES: ClinicPreferences = {
  discounts_enabled: false,
  discount_scope: 'line',
  default_discount_pct: 0,
  max_discount_pct: 100,
};

/** Acota un porcentaje al rango que acepta el CHECK de la tabla. */
function toPct(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(100, Math.max(0, n));
}

export async function fetchClinicPreferences(): Promise<ClinicPreferences> {
  const data = await api.get(API_ROUTES.CLINIC_PREFERENCES.GET);
  const raw = Array.isArray(data) ? (data[0]?.json ?? data[0]) : (data?.json ?? data);

  if (!raw) return DEFAULT_CLINIC_PREFERENCES;

  return {
    discounts_enabled: raw.discounts_enabled === true,
    discount_scope: raw.discount_scope === 'total' ? 'total' : 'line',
    default_discount_pct: toPct(raw.default_discount_pct, 0),
    max_discount_pct: toPct(raw.max_discount_pct, 100),
  };
}

export async function updateClinicPreferences(prefs: ClinicPreferences): Promise<void> {
  const response = await api.post(API_ROUTES.CLINIC_PREFERENCES.UPSERT, {
    discounts_enabled: prefs.discounts_enabled,
    discount_scope: prefs.discount_scope,
    default_discount_pct: prefs.default_discount_pct,
    max_discount_pct: prefs.max_discount_pct,
  });

  const result = Array.isArray(response) ? response[0] : response;
  if (result?.error || (result?.code && result.code >= 400)) {
    throw new Error(result?.message || 'No se pudieron guardar las preferencias.');
  }
}
