import { getSalesServices } from '@/services/services';

import type { LabOrderDraft } from '@/components/lab-orders/lab-order-form-dialog';
import type { TreatmentDetail } from '@/lib/types';

type DraftItem = NonNullable<LabOrderDraft['items']>[number];

/** ID del servicio de un tratamiento: el del frontend o el que guarda el backend. */
function treatmentServiceId(treatment: TreatmentDetail): string | null {
  const raw = treatment.service_id ?? treatment.service_catalog_id;
  if (raw === undefined || raw === null || raw === '') return null;
  return String(raw);
}

/**
 * Ítems de una orden de laboratorio a partir de los tratamientos de una sesión clínica.
 *
 * Un "servicio de laboratorio" es un servicio del catálogo con `is_lab` (script 167). Se
 * incluyen también los tratamientos marcados para la próxima sesión (el trabajo se pide hoy
 * y se coloca después). Un mismo servicio en varias piezas queda en UN ítem con todas sus
 * piezas, porque una orden no admite el mismo servicio dos veces; la cantidad es la suma.
 */
export function labItemsFromTreatments(
  treatments: TreatmentDetail[],
  labServices: Map<string, { name: string; lab_category_id?: string | null }>,
): DraftItem[] {
  const byService = new Map<string, DraftItem>();
  for (const treatment of treatments) {
    const serviceId = treatmentServiceId(treatment);
    const service = serviceId ? labServices.get(serviceId) : undefined;
    if (!serviceId || !service) continue;
    const tooth = treatment.numero_diente != null && Number(treatment.numero_diente) > 0 ? Number(treatment.numero_diente) : null;
    const quantity = Number(treatment.quantity) > 0 ? Number(treatment.quantity) : 1;
    const current = byService.get(serviceId);
    if (current) {
      current.quantity += quantity;
      if (tooth !== null && !current.teeth.includes(tooth)) current.teeth.push(tooth);
    } else {
      byService.set(serviceId, {
        service_id: serviceId,
        service_name: treatment.service_name || service.name,
        quantity,
        teeth: tooth !== null ? [tooth] : [],
        lab_category_id: service.lab_category_id ?? null,
      });
    }
  }
  return Array.from(byService.values()).map((item) => ({ ...item, teeth: [...item.teeth].sort((a, b) => a - b) }));
}

/**
 * Servicios de laboratorio entre los tratamientos guardados. Solo consulta el catálogo si
 * algún tratamiento trae servicio. Nunca lanza: ante un error no se ofrece la orden.
 */
export async function findLabItemsInTreatments(treatments: TreatmentDetail[] | undefined): Promise<DraftItem[]> {
  const withService = (treatments ?? []).filter((treatment) => treatmentServiceId(treatment) !== null);
  if (withService.length === 0) return [];
  try {
    const { items } = await getSalesServices({ is_lab: true, limit: 500 });
    const labServices = new Map(
      items
        .filter((service) => service.is_lab !== false)
        .map((service) => [String(service.id), { name: service.name, lab_category_id: service.lab_category_id ?? null }]),
    );
    return labItemsFromTreatments(withService, labServices);
  } catch (error) {
    console.error('Lab services lookup failed:', error);
    return [];
  }
}
