import { API_ROUTES } from '@/constants/routes';
import { normalizeCurrencyCode } from '@/constants/currencies';
import { getWebhookBaseUrl } from '@/lib/runtime-config';
import { api } from '@/services/api';

/**
 * Datos de la clínica que se muestran en membretes, comprobantes y cabeceras.
 *
 * Viven en la tabla `clinic` y se editan en Configuración → Datos de la
 * Clínica. Se cargan una única vez tras el login y se cachean en
 * `clinic-info-store`; no tienen endpoint de preferencias propio.
 */
export interface ClinicInfo {
  name: string;
  logoUrl: string;
  phone?: string;
  address?: string;
  email?: string;
  /** RUT de la clínica — se imprime en el membrete de recetas y comprobantes. */
  rut?: string;
  /**
   * Moneda de trabajo, código ISO 4217 de 3 letras. Es la que usa toda la UI
   * por defecto. `undefined` si la clínica nunca la configuró.
   */
  currency?: string;
  /**
   * Segunda moneda opcional en la que la clínica también acepta operar. Si
   * está configurada, los formularios ofrecen ambas y aparecen el tipo de
   * cambio y las vistas de doble moneda. Vacía ⇒ la clínica opera en moneda
   * única y toda esa UI desaparece.
   */
  secondaryCurrency?: string;
}

export async function fetchClinicInfo(): Promise<ClinicInfo | null> {
  const raw: unknown = await api.get(API_ROUTES.CLINIC);
  const data = Array.isArray(raw) ? (raw as Record<string, unknown>[])[0] : (raw as Record<string, unknown>);
  if (!data) return null;

  const get = (...keys: string[]) => keys.map((k) => data[k]).find((v) => v != null && v !== '') as string | undefined;

  return {
    name: get('name', 'clinic_name', 'nombre') ?? '',
    // Always use the n8n webhook endpoint — it handles Drive auth transparently.
    logoUrl: `${getWebhookBaseUrl()}/clinic/logo`,
    phone: get('phone', 'telefono', 'phone_number', 'tel'),
    address: get('address', 'direccion', 'domicilio'),
    email: get('email', 'correo'),
    rut: get('rut', 'RUT'),
    // Cualquier ISO de 3 letras es válido: la moneda es configurable y no se
    // limita a las dos de Uruguay.
    currency: normalizeCurrencyCode(get('currency', 'moneda')),
    secondaryCurrency: normalizeCurrencyCode(get('secondary_currency', 'moneda_secundaria')),
  };
}
