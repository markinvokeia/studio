import type { PrintTemplateVariable } from './print-template-variables';
import type { EmailTemplateType } from './email-template-defaults';
import type { WhatsappTemplateType } from './whatsapp-template-defaults';

// Re-export so consumers only need one import
export type { EmailTemplateType, WhatsappTemplateType };

// ── Shared variable groups ─────────────────────────────────────────────────────

const CLINIC_VARS: PrintTemplateVariable[] = [
  { key: '{{clinic_name}}',    label: 'Nombre clínica', group: 'clinic' },
  { key: '{{clinic_logo}}',    label: 'Logo (URL)',      group: 'clinic' },
  { key: '{{clinic_address}}', label: 'Dirección',       group: 'clinic' },
  { key: '{{clinic_phone}}',   label: 'Teléfono',        group: 'clinic' },
  { key: '{{clinic_email}}',   label: 'Email',           group: 'clinic' },
];

const PATIENT_VARS: PrintTemplateVariable[] = [
  { key: '{{patient_name}}',  label: 'Paciente', group: 'patient' },
  { key: '{{patient_email}}', label: 'Email',    group: 'patient' },
];

const TREATMENT_VARS: PrintTemplateVariable[] = [
  { key: '{{service_name}}', label: 'Servicio',        group: 'treatment' as any },
  { key: '{{missed_step}}',  label: 'Paso interrumpido', group: 'treatment' as any },
  { key: '{{missed_date}}',  label: 'Fecha del paso',  group: 'treatment' as any },
];

const ALERT_VARS: PrintTemplateVariable[] = [
  { key: '{{alert_title}}',   label: 'Título alerta', group: 'alert' as any },
  { key: '{{alert_summary}}', label: 'Resumen',        group: 'alert' as any },
  { key: '{{alert_date}}',    label: 'Fecha alerta',   group: 'alert' as any },
];

const APPOINTMENT_VARS: PrintTemplateVariable[] = [
  { key: '{{appointment_date}}', label: 'Fecha cita',    group: 'appointment' as any },
  { key: '{{appointment_time}}', label: 'Hora cita',     group: 'appointment' as any },
  { key: '{{doctor_name}}',      label: 'Doctor/a',      group: 'appointment' as any },
  { key: '{{location}}',         label: 'Lugar',         group: 'appointment' as any },
];

const PLAIN_CLINIC_VARS = CLINIC_VARS.filter(
  (v) => v.key !== '{{clinic_logo}}' && v.key !== '{{clinic_address}}'
);
const PLAIN_PATIENT_VARS = PATIENT_VARS.filter((v) => v.key !== '{{patient_email}}');

const TREATMENT_STATUS_VARS: PrintTemplateVariable[] = [
  { key: '{{service_name}}',     label: 'Servicio',          group: 'treatment' as any },
  { key: '{{treatment_status}}', label: 'Estado',            group: 'treatment' as any },
  { key: '{{treatment_date}}',   label: 'Fecha tratamiento', group: 'treatment' as any },
];

// ── Per-type registries ────────────────────────────────────────────────────────

export const EMAIL_TEMPLATE_VARIABLES: Record<EmailTemplateType, PrintTemplateVariable[]> = {
  email_invoice: [
    ...CLINIC_VARS,
    { key: '{{doc_no}}',      label: 'Nro. Factura',   group: 'document' },
    { key: '{{date}}',        label: 'Fecha',           group: 'document' },
    { key: '{{status}}',      label: 'Estado',          group: 'document' },
    { key: '{{currency}}',    label: 'Moneda',          group: 'document' },
    { key: '{{total}}',       label: 'Total',           group: 'document' },
    ...PATIENT_VARS,
    { key: '{{items_table}}', label: 'Tabla de ítems',  group: 'tables' },
  ],
  email_quote: [
    ...CLINIC_VARS,
    { key: '{{doc_no}}',      label: 'Nro. Presupuesto', group: 'document' },
    { key: '{{date}}',        label: 'Fecha',             group: 'document' },
    { key: '{{currency}}',    label: 'Moneda',            group: 'document' },
    { key: '{{total}}',       label: 'Total',             group: 'document' },
    ...PATIENT_VARS,
    { key: '{{items_table}}', label: 'Tabla de ítems',    group: 'tables' },
  ],
  email_quote_approved: [
    ...CLINIC_VARS,
    { key: '{{doc_no}}',       label: 'Nro. Presupuesto', group: 'document' },
    { key: '{{date}}',         label: 'Fecha',             group: 'document' },
    { key: '{{currency}}',     label: 'Moneda',            group: 'document' },
    { key: '{{exchange_rate}}', label: 'Tipo de cambio',   group: 'document' },
    { key: '{{total}}',        label: 'Total',             group: 'document' },
    ...PATIENT_VARS,
    { key: '{{items_table}}',  label: 'Tabla de ítems',    group: 'tables' },
  ],
  email_quote_rejected: [
    ...CLINIC_VARS,
    { key: '{{doc_no}}', label: 'Nro. Presupuesto', group: 'document' },
    { key: '{{date}}',   label: 'Fecha',             group: 'document' },
    ...PATIENT_VARS,
  ],
  email_payment: [
    ...CLINIC_VARS,
    { key: '{{doc_no}}',   label: 'Nro. Recibo',    group: 'document' },
    { key: '{{date}}',     label: 'Fecha',           group: 'document' },
    { key: '{{currency}}', label: 'Moneda',          group: 'document' },
    { key: '{{amount}}',   label: 'Monto',           group: 'document' },
    { key: '{{method}}',   label: 'Método de pago',  group: 'document' },
    ...PATIENT_VARS,
  ],
  email_appointment_reminder: [
    ...CLINIC_VARS,
    ...PATIENT_VARS,
    ...APPOINTMENT_VARS,
  ],
  email_appointment_confirmation: [
    ...CLINIC_VARS,
    ...PATIENT_VARS,
    ...APPOINTMENT_VARS,
  ],
  email_patient_general: [
    ...CLINIC_VARS,
    ...PATIENT_VARS,
  ],
  email_alert_followup: [
    ...CLINIC_VARS.filter((v) => v.key !== '{{clinic_logo}}' && v.key !== '{{clinic_address}}'),
    ...PATIENT_VARS.filter((v) => v.key !== '{{patient_email}}'),
    ...ALERT_VARS,
  ],
  email_financial_summary: [
    ...CLINIC_VARS,
    ...PATIENT_VARS,
    { key: '{{date_from}}',      label: 'Desde',              group: 'document' },
    { key: '{{date_to}}',        label: 'Hasta',              group: 'document' },
    { key: '{{movements_table}}', label: 'Tabla movimientos', group: 'tables' },
  ],
  email_treatment_update: [
    ...CLINIC_VARS,
    ...PATIENT_VARS,
    ...TREATMENT_STATUS_VARS,
  ],
  email_password_reset: [
    ...PLAIN_CLINIC_VARS,
    { key: '{{user_name}}',  label: 'Usuario',  group: 'patient' as any },
    { key: '{{reset_link}}', label: 'Enlace',   group: 'document' },
  ],
};

export const WHATSAPP_TEMPLATE_VARIABLES: Record<WhatsappTemplateType, PrintTemplateVariable[]> = {
  whatsapp_patient_general:       [...PLAIN_CLINIC_VARS, ...PLAIN_PATIENT_VARS],
  whatsapp_alert_followup:        [...PLAIN_CLINIC_VARS, ...PLAIN_PATIENT_VARS, ...ALERT_VARS],
  whatsapp_appointment_reminder:  [...PLAIN_CLINIC_VARS, ...PLAIN_PATIENT_VARS, ...APPOINTMENT_VARS],
  whatsapp_treatment_interrupted: [...PLAIN_CLINIC_VARS, ...PLAIN_PATIENT_VARS, ...TREATMENT_VARS],
};
