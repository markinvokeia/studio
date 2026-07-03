import type { PrintTemplateVariable } from '@/lib/print-template-variables';

export const MEDICAL_INSTRUCTION_TEMPLATE_VARIABLES: PrintTemplateVariable[] = [
  { key: '{{patient_name}}', label: 'Nombre del paciente', group: 'patient' },
  { key: '{{doctor_name}}', label: 'Doctor', group: 'document' },
  { key: '{{clinic_name}}', label: 'Nombre clínica', group: 'clinic' },
  { key: '{{clinic_address}}', label: 'Dirección', group: 'clinic' },
  { key: '{{clinic_phone}}', label: 'Teléfono', group: 'clinic' },
  { key: '{{tooth_number}}', label: 'Pieza dental', group: 'document' },
  { key: '{{date}}', label: 'Fecha', group: 'document' },
];

export const MEDICAL_INSTRUCTION_TEMPLATE_VARIABLE_GROUP_ORDER: PrintTemplateVariable['group'][] = [
  'patient',
  'document',
  'clinic',
];
