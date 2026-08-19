import type { PrintTemplateVariable } from '@/lib/print-template-variables';
import type { PrescriptionItem } from '@/lib/types';

export const PRESCRIPTION_TEMPLATE_VARIABLES: PrintTemplateVariable[] = [
  { key: '{{patient_name}}', label: 'Nombre del paciente', group: 'patient' },
  { key: '{{patient_document}}', label: 'Documento (C.I.)', group: 'patient' },
  { key: '{{patient_birthday}}', label: 'Fecha de nacimiento', group: 'patient' },
  { key: '{{patient_age}}', label: 'Edad', group: 'patient' },
  { key: '{{patient_address}}', label: 'Domicilio', group: 'patient' },
  { key: '{{patient_mutual_society}}', label: 'Mutualista', group: 'patient' },
  { key: '{{doctor_name}}', label: 'Doctor', group: 'document' },
  { key: '{{date}}', label: 'Fecha', group: 'document' },
  { key: '{{diagnosis}}', label: 'Diagnóstico', group: 'document' },
  { key: '{{notes}}', label: 'Notas', group: 'document' },
  { key: '{{clinic_name}}', label: 'Nombre clínica', group: 'clinic' },
  { key: '{{clinic_logo}}', label: 'Logo (URL)', group: 'clinic' },
  { key: '{{clinic_address}}', label: 'Dirección', group: 'clinic' },
  { key: '{{clinic_phone}}', label: 'Teléfono', group: 'clinic' },
  { key: '{{clinic_email}}', label: 'Email', group: 'clinic' },
  { key: '{{clinic_rut}}', label: 'RUT', group: 'clinic' },
  { key: '{{clinic_header}}', label: 'Membrete completo', group: 'clinic' },
  { key: '{{clinic_footer}}', label: 'Pie de página completo', group: 'clinic' },
  { key: '{{medications_table}}', label: 'Tabla de medicamentos', group: 'tables' },
  { key: '{{medications_list}}', label: 'Lista de medicamentos (Rp.)', group: 'tables' },
  { key: '{{doctor_signature}}', label: 'Firma del doctor', group: 'tables' },
];

export const PRESCRIPTION_TEMPLATE_VARIABLE_GROUP_ORDER: PrintTemplateVariable['group'][] = [
  'patient',
  'document',
  'clinic',
  'tables',
];

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Datos de clínica que necesitan el membrete y el pie. */
export interface ClinicHeaderData {
  name?: string;
  logoUrl?: string;
  address?: string;
  phone?: string;
  email?: string;
  rut?: string;
}

export interface ClinicBlockLabels {
  /** Prefijo del teléfono, p. ej. "Tel." */
  phonePrefix: string;
  /** Prefijo del identificador fiscal, p. ej. "RUT" */
  taxIdPrefix: string;
  /** Leyenda legal del pie. */
  footerNote: string;
}

export interface MedicationsTableLabels {
  medication: string;
  presentation: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
  /** Sufijo de la duración, p. ej. "días". */
  days: string;
}

function usableItems(items: PrescriptionItem[]): PrescriptionItem[] {
  return items.filter((item) => item.medicamento_texto?.trim());
}

function durationText(item: PrescriptionItem, days: string): string {
  return item.duracion_dias != null && String(item.duracion_dias) !== ''
    ? `${item.duracion_dias} ${days}`
    : '';
}

/**
 * Tabla HTML que reemplaza a `{{medications_table}}`. Estilos inline porque el
 * HTML se guarda tal cual y se reimprime fuera del árbol de Tailwind — mismo
 * criterio que `buildItemsTable` de los documentos de venta.
 */
export function buildMedicationsTable(items: PrescriptionItem[], labels: MedicationsTableLabels): string {
  const usable = usableItems(items);
  if (usable.length === 0) return '';

  const th = 'style="text-align:left;padding:6px 8px;border-bottom:2px solid #d1d5db;font-size:0.7rem;text-transform:uppercase;letter-spacing:0.03em;color:#6b7280;"';
  const td = 'style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:0.8125rem;vertical-align:top;"';

  const rows = usable
    .map((item) => {
      const medication = [item.medicamento_texto, item.cantidad ? `(${item.cantidad})` : '']
        .filter(Boolean)
        .join(' ');
      const instructions = [item.via_administracion, item.indicaciones].filter(Boolean).join(' · ');

      return `<tr>
  <td ${td}><strong>${escapeHtml(medication)}</strong></td>
  <td ${td}>${escapeHtml(item.presentacion || '')}</td>
  <td ${td}>${escapeHtml(item.dosis || '')}</td>
  <td ${td}>${escapeHtml(item.frecuencia || '')}</td>
  <td ${td}>${escapeHtml(durationText(item, labels.days))}</td>
  <td ${td}>${escapeHtml(instructions)}</td>
</tr>`;
    })
    .join('\n');

  // La clase `rx-med-table` la usa globals.css para restituir estos mismos
  // separadores al imprimir, donde las reglas genéricas de tabla los pisarían.
  return `<table class="rx-med-table" style="width:100%;border-collapse:collapse;margin:0.5rem 0;">
<thead><tr>
  <th ${th}>${escapeHtml(labels.medication)}</th>
  <th ${th}>${escapeHtml(labels.presentation)}</th>
  <th ${th}>${escapeHtml(labels.dosage)}</th>
  <th ${th}>${escapeHtml(labels.frequency)}</th>
  <th ${th}>${escapeHtml(labels.duration)}</th>
  <th ${th}>${escapeHtml(labels.instructions)}</th>
</tr></thead>
<tbody>
${rows}
</tbody>
</table>`;
}

/**
 * Lista numerada estilo "Rp." — el formato clásico de receta manuscrita
 * uruguaya, más natural que una tabla cuando hay pocos fármacos.
 */
export function buildMedicationsList(items: PrescriptionItem[], labels: MedicationsTableLabels): string {
  const usable = usableItems(items);
  if (usable.length === 0) return '';

  const entries = usable
    .map((item, index) => {
      const heading = [item.medicamento_texto, item.presentacion].filter(Boolean).join(' — ');
      const posology = [
        item.dosis,
        item.frecuencia,
        durationText(item, labels.days),
        item.via_administracion,
      ].filter(Boolean).join(' · ');
      const extra = [item.cantidad, item.indicaciones].filter(Boolean).join(' · ');

      return `<li style="margin:0 0 0.6rem 0;">
  <span style="font-weight:600;font-size:0.875rem;">${index + 1}. ${escapeHtml(heading)}</span>
  ${posology ? `<div style="font-size:0.8125rem;color:#374151;margin-left:1.1rem;">${escapeHtml(posology)}</div>` : ''}
  ${extra ? `<div style="font-size:0.75rem;color:#6b7280;margin-left:1.1rem;">${escapeHtml(extra)}</div>` : ''}
</li>`;
    })
    .join('\n');

  return `<ol style="list-style:none;padding:0;margin:0.5rem 0;">
${entries}
</ol>`;
}

/**
 * Membrete que reemplaza a `{{clinic_header}}`: logo, nombre, dirección,
 * contacto y RUT. Se ofrece como variable para que quien edite el contenido de
 * una receta pueda insertarlo sin escribir HTML a mano.
 *
 * Los campos vacíos se omiten en lugar de dejar etiquetas huérfanas
 * («Tel.  · », «RUT »).
 */
export function buildClinicHeader(clinic: ClinicHeaderData | null | undefined, labels: ClinicBlockLabels): string {
  const data = clinic ?? {};
  const logo = data.logoUrl
    ? `<img src="${data.logoUrl}" alt="" style="height:4rem;max-width:130px;object-fit:contain;flex-shrink:0;" onerror="this.style.display='none'" />`
    : '';

  const contact = [
    data.phone ? `${escapeHtml(labels.phonePrefix)} ${escapeHtml(data.phone)}` : '',
    data.email ? escapeHtml(data.email) : '',
  ].filter(Boolean).join(' · ');

  const lines = [
    `<p style="margin:0;font-size:1.25rem;font-weight:700;letter-spacing:-0.01em;">${escapeHtml(data.name || '')}</p>`,
    data.address ? `<p style="margin:0.1rem 0 0;font-size:0.75rem;color:#4b5563;">${escapeHtml(data.address)}</p>` : '',
    contact ? `<p style="margin:0;font-size:0.75rem;color:#4b5563;">${contact}</p>` : '',
    data.rut ? `<p style="margin:0;font-size:0.7rem;color:#6b7280;">${escapeHtml(labels.taxIdPrefix)} ${escapeHtml(data.rut)}</p>` : '',
  ].filter(Boolean).join('\n    ');

  return `<div style="display:flex;align-items:center;gap:1rem;padding-bottom:0.75rem;border-bottom:3px solid #1f2937;">
  ${logo}
  <div style="flex:1;min-width:0;">
    ${lines}
  </div>
</div>`;
}

/** Pie que reemplaza a `{{clinic_footer}}`: contacto de la clínica y leyenda legal. */
export function buildClinicFooter(clinic: ClinicHeaderData | null | undefined, labels: ClinicBlockLabels): string {
  const data = clinic ?? {};
  const contact = [
    data.name ? escapeHtml(data.name) : '',
    data.address ? escapeHtml(data.address) : '',
    data.phone ? `${escapeHtml(labels.phonePrefix)} ${escapeHtml(data.phone)}` : '',
  ].filter(Boolean).join(' · ');

  return `<div style="margin-top:2rem;padding-top:0.5rem;border-top:1px solid #d1d5db;text-align:center;">
  ${contact ? `<p style="margin:0;font-size:0.7rem;color:#6b7280;">${contact}</p>` : ''}
  <p style="margin:0.15rem 0 0;font-size:0.65rem;color:#9ca3af;">${escapeHtml(labels.footerNote)}</p>
</div>`;
}

/**
 * Bloque de firma que reemplaza a `{{doctor_signature}}`. `signatureUrl` apunta
 * al webhook n8n (`/users/signature?user_id=…`), nunca a Drive directo.
 */
export function buildSignatureBlock(options: {
  signatureUrl?: string | null;
  doctorName?: string;
  label?: string;
}): string {
  // La firma es el elemento que valida la receta: se reserva un bloque amplio
  // (8rem de alto × 440px) para que se lea con claridad en el papel.
  const image = options.signatureUrl
    ? `<img src="${options.signatureUrl}" alt="" style="height:8rem;max-width:440px;object-fit:contain;display:block;margin:0 auto 0.35rem;" onerror="this.style.display='none'" />`
    : '';

  return `<div style="margin-top:2.5rem;text-align:center;">
${image}
  <div style="border-top:1px solid #9ca3af;width:440px;max-width:100%;margin:0 auto;padding-top:0.35rem;">
    <p style="margin:0;font-size:0.9375rem;font-weight:600;">${escapeHtml(options.doctorName || '')}</p>
    ${options.label ? `<p style="margin:0;font-size:0.75rem;color:#6b7280;">${escapeHtml(options.label)}</p>` : ''}
  </div>
</div>`;
}
