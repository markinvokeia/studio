import { API_ROUTES } from '@/constants/routes';
import type { ClinicInfo } from '@/hooks/useClinicInfo';
import {
  buildClinicFooter,
  buildClinicHeader,
  buildMedicationsList,
  buildMedicationsTable,
  buildSignatureBlock,
  type ClinicBlockLabels,
  type MedicationsTableLabels,
} from '@/lib/prescription-template-variables';
import { getWebhookBaseUrl } from '@/lib/runtime-config';
import type { PrescriptionItem } from '@/lib/types';
import { formatDisplayDate } from '@/lib/utils';

/**
 * URL de la firma de un doctor — siempre por webhook, nunca Drive directo.
 *
 * `cacheKey` fuerza una URL distinta tras subir una firma nueva: sin él el
 * navegador reutiliza la respuesta anterior (a menudo un 204 «sin firma») y la
 * receta se seguiría viendo sin firmar.
 */
export function getDoctorSignatureUrl(doctorId?: string | null, cacheKey?: string | number): string | null {
  if (!doctorId) return null;
  const base = `${getWebhookBaseUrl()}${API_ROUTES.USER_SIGNATURE}?user_id=${encodeURIComponent(doctorId)}`;
  return cacheKey ? `${base}&v=${encodeURIComponent(String(cacheKey))}` : base;
}

/** Los tokens que no estén en el mapa se dejan intactos, no se vacían. */
export function substitutePrescriptionTokens(html: string, vars: Record<string, string>): string {
  return html.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`);
}

/** Edad en años cumplidos a partir de la fecha de nacimiento ('yyyy-MM-dd'). */
export function computeAge(birthDate?: string | null): string {
  if (!birthDate) return '';
  const iso = String(birthDate).split('T')[0];
  const parsed = new Date(iso + 'T00:00:00');
  if (isNaN(parsed.getTime())) return '';
  const today = new Date();
  let age = today.getFullYear() - parsed.getFullYear();
  const monthDiff = today.getMonth() - parsed.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < parsed.getDate())) age -= 1;
  return age >= 0 ? String(age) : '';
}

export interface PrescriptionPatientInfo {
  name?: string;
  identity_document?: string;
  birth_date?: string;
  address?: string;
  mutual_society_name?: string;
}

export interface PrescriptionVarSource {
  patient?: PrescriptionPatientInfo | null;
  doctorId?: string | null;
  doctorName?: string;
  fecha?: string;
  diagnostico?: string;
  notas?: string;
  items?: PrescriptionItem[];
  clinic?: ClinicInfo | null;
  /** Invalida la caché del navegador para la firma. Ver `getDoctorSignatureUrl`. */
  signatureCacheKey?: string | number;
}

export interface PrescriptionLabels extends MedicationsTableLabels, ClinicBlockLabels {
  signature: string;
}

/**
 * Mapa de variables de una receta.
 *
 * `includeDerived: false` deja sin resolver `{{medications_table}}`,
 * `{{medications_list}}` y `{{doctor_signature}}` — son datos derivados de los
 * ítems y del doctor, y se guardan como tokens para que editar un medicamento
 * se refleje siempre. La vista previa y la impresión los resuelven en vivo.
 */
export function buildPrescriptionVars(
  source: PrescriptionVarSource,
  labels: PrescriptionLabels,
  includeDerived = true,
): Record<string, string> {
  const { patient, clinic } = source;
  const items = source.items ?? [];

  const base: Record<string, string> = {
    patient_name: patient?.name || '',
    patient_document: patient?.identity_document || '',
    patient_birthday: patient?.birth_date ? formatDisplayDate(patient.birth_date) : '',
    patient_age: computeAge(patient?.birth_date),
    patient_address: patient?.address || '',
    patient_mutual_society: patient?.mutual_society_name || '',
    doctor_name: source.doctorName || '',
    date: source.fecha ? formatDisplayDate(source.fecha) : '',
    diagnosis: source.diagnostico || '',
    notes: source.notas || '',
    clinic_name: clinic?.name || '',
    clinic_logo: clinic?.logoUrl || '',
    clinic_address: clinic?.address || '',
    clinic_phone: clinic?.phone || '',
    clinic_email: clinic?.email || '',
    clinic_rut: clinic?.rut || '',
    clinic_header: buildClinicHeader(clinic, labels),
    clinic_footer: buildClinicFooter(clinic, labels),
  };

  if (!includeDerived) return base;

  return {
    ...base,
    medications_table: buildMedicationsTable(items, labels),
    medications_list: buildMedicationsList(items, labels),
    doctor_signature: buildSignatureBlock({
      signatureUrl: getDoctorSignatureUrl(source.doctorId, source.signatureCacheKey),
      doctorName: source.doctorName,
      label: labels.signature,
    }),
  };
}

/** Contenido final de una receta, con todas las variables resueltas. */
export function renderPrescriptionHtml(
  contentHtml: string,
  source: PrescriptionVarSource,
  labels: PrescriptionLabels,
): string {
  return substitutePrescriptionTokens(contentHtml, buildPrescriptionVars(source, labels, true));
}
