import { API_ROUTES } from '@/constants/routes';
import { normalizeApiResponse } from '@/lib/api-utils';
import { Medication } from '@/lib/types';
import api from '@/services/api';

export interface MedicationsResponse {
  items: Medication[];
  total: number;
}

export interface GetMedicationsParams {
  search?: string;
  page?: number;
  limit?: number;
}

function mapMedication(raw: any): Medication {
  return {
    id: String(raw.id),
    nombre_generico: raw.nombre_generico,
    nombre_comercial: raw.nombre_comercial || undefined,
  };
}

/**
 * Catálogo de medicamentos. El webhook n8n envuelve la respuesta en
 * `[{ json: { data, total_items } }]` además de los formatos que ya cubre
 * `normalizeApiResponse`, así que se desenvuelve esa capa primero.
 */
export async function getMedicationsCatalog({
  search = '',
  page = 1,
  limit = 50,
}: GetMedicationsParams = {}): Promise<MedicationsResponse> {
  try {
    const data = await api.get(API_ROUTES.CLINIC_CATALOG.MEDICATIONS, {
      search,
      page: String(page),
      limit: String(limit),
    });

    const unwrapped = Array.isArray(data) && data[0]?.json ? data[0].json : data;
    const { items, total } = normalizeApiResponse<any>(unwrapped);

    return {
      items: items.map(mapMedication).filter((m) => m.id && m.id !== 'undefined' && m.nombre_generico),
      total,
    };
  } catch (error) {
    console.error('Failed to fetch medications catalog:', error);
    return { items: [], total: 0 };
  }
}

/** Alta rápida desde un combobox. Lanza si el backend responde con error. */
export async function createMedication(medication: {
  nombre_generico: string;
  nombre_comercial?: string;
}): Promise<void> {
  const response = await api.post(API_ROUTES.CLINIC_CATALOG.MEDICATIONS_UPSERT, {
    nombre_generico: medication.nombre_generico,
    nombre_comercial: medication.nombre_comercial || '',
  });
  if (Array.isArray(response) && response[0]?.code >= 400) {
    throw new Error(response[0]?.message || 'Failed to create medication');
  }
}
