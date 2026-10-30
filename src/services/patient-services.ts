import { API_ROUTES } from '@/constants/routes';
import { getWebhookBaseUrl } from '@/lib/runtime-config';
import type { BookableService, CurrencyCode } from '@/lib/types';
import { api } from '@/services/api';

/**
 * Servicios que el paciente puede auto-agendar desde el portal.
 *
 * El catálogo completo no sirve acá: la clínica marca con `bookable_online`
 * qué subconjunto es ofrecible sin que intervenga recepción. Una cirugía está
 * en el catálogo pero no es algo que un paciente reserve solo.
 *
 * **Siempre se usa `/services_noauth`, con sesión o sin ella.** Antes, con
 * sesión, se pedía a `/services`: ese flujo devuelve el catálogo entero y NO
 * incluye `bookable_online`, así que el filtro del cliente descartaba todos los
 * servicios y el paso aparecía vacío. `/services_noauth` es la proyección hecha
 * para esto: filtra en SQL, trae la duración y el estado de la imagen, y decide
 * del lado del servidor si los precios se exponen. Al ser público, un paciente
 * logueado lo puede consultar igual.
 *
 * Contrato: docs/patient-portal.md §2.10
 */

/** Duración mínima de una cita. Un servicio sin duración cargada cae acá. */
export const MIN_SERVICE_MINUTES = 15;

/** n8n devuelve indistintamente `[...]`, `{data:[...]}` o `[{json:{...}}]`. */
function unwrapList(data: any): any[] {
  if (Array.isArray(data)) {
    if (data.length > 0 && 'json' in data[0]) return data.map((i: any) => i.json);
    return data;
  }
  return data?.services || data?.data || data?.result || [];
}

export function mapBookableService(raw: any): BookableService | null {
  const id = raw?.id != null ? String(raw.id) : '';
  const name = String(raw?.name ?? '').trim();
  if (!id || !name) return null;

  const duration = Number(raw.duration_minutes);
  const price = raw.price == null ? null : Number(raw.price);

  return {
    id,
    name,
    description: raw.description || null,
    duration_minutes: Number.isFinite(duration) && duration > 0 ? duration : MIN_SERVICE_MINUTES,
    // `price` ausente no es 0: es "la clínica no muestra precios". Se distingue
    // con `null` para que la UI no imprima un precio que nadie configuró.
    price: price != null && Number.isFinite(price) ? price : null,
    currency: (raw.currency as CurrencyCode) || null,
    // `undefined` a propósito cuando el backend no lo manda: no es lo mismo
    // que "no tiene imagen". Ver `serviceImageUrl`.
    has_image: typeof raw.has_image === 'boolean' ? raw.has_image : undefined,
    image_updated_at: raw.image_updated_at || null,
  };
}

/**
 * Nunca lanza: si la lista no carga, el paso de servicios no se ofrece y la
 * reserva sigue funcionando con el servicio por defecto de la clínica.
 *
 * Devuelve **`null` ante un fallo** y `[]` cuando la clínica no publicó ningún
 * servicio agendable. No es lo mismo: lo primero merece un reintento, lo
 * segundo es una configuración legítima y el paso simplemente no aparece.
 */
export async function fetchBookableServices(): Promise<BookableService[] | null> {
  try {
    const data = await api.get(API_ROUTES.PATIENT_AUTH.PUBLIC_SERVICES);
    const rows = unwrapList(data);

    return rows
      .map(mapBookableService)
      .filter((s): s is BookableService => s !== null)
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Failed to load bookable services:', error);
    return null;
  }
}

/**
 * URL de la imagen del servicio. Siempre el webhook de n8n —que resuelve la
 * auth de Drive— y nunca un enlace directo a Drive, igual que el logo de la
 * clínica y la firma del doctor.
 *
 * La URL la arma el cliente a partir del id, y no la manda el backend, por la
 * misma razón que con `/clinic/logo`: la base del webhook es configuración de
 * entorno (`runtime-config`), y el backend no tiene por qué saber con qué host
 * lo están consultando.
 *
 * Lo que sí decide el backend es **si hay imagen**: con `has_image: false` no se
 * pide nada y la tarjeta va directo al placeholder. Si el campo no viene, se
 * pide igual y el 204 resuelve — esconder una imagen que existe es peor que un
 * request de más.
 */
export function serviceImageUrl(
  service: Pick<BookableService, 'id' | 'has_image' | 'image_updated_at'>,
): string | null {
  if (service.has_image === false) return null;
  const params = new URLSearchParams({ service_id: service.id });
  // Si la clínica reemplaza la imagen, el navegador no se queda con la anterior.
  if (service.image_updated_at) params.set('v', String(service.image_updated_at));
  return `${getWebhookBaseUrl()}${API_ROUTES.SERVICE_IMAGE}?${params.toString()}`;
}

/**
 * Suma de duraciones. Es lo que dimensiona el hueco de la agenda.
 *
 * Una suma de cero cae al `fallback` y no al mínimo: pasa cuando los servicios
 * se resolvieron sólo por id (p. ej. al reagendar, si el backend no devolvió la
 * duración), y encoger la cita a 15 minutos por falta de dato sería peor que
 * usar la duración genérica.
 */
export function totalServiceMinutes(services: BookableService[], fallback: number): number {
  if (services.length === 0) return fallback;
  const total = services.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
  if (total <= 0) return fallback;
  return Math.max(MIN_SERVICE_MINUTES, total);
}

/**
 * Total a pagar por los servicios elegidos.
 *
 * Devuelve `null` —y la UI omite el total— cuando no hay precios cargados o
 * cuando los servicios mezclan monedas: sumar pesos con dólares daría un
 * número que no significa nada.
 */
export function totalServicePrice(
  services: BookableService[],
): { amount: number; currency: CurrencyCode | null } | null {
  const priced = services.filter((s) => s.price != null);
  if (priced.length === 0) return null;

  const currencies = new Set(priced.map((s) => s.currency || ''));
  if (currencies.size > 1) return null;

  return {
    amount: priced.reduce((sum, s) => sum + (s.price ?? 0), 0),
    currency: priced[0].currency ?? null,
  };
}
