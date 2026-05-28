import type { PrintDocumentType } from '@/stores/print-document-store';

export interface PrintTemplateVariable {
  key: string;   // the {{token}} to insert
  label: string; // display label in the toolbar
  group: 'clinic' | 'document' | 'patient' | 'tables';
}

// ── Shared variable groups ─────────────────────────────────────────────────────

const CLINIC_VARS: PrintTemplateVariable[] = [
  { key: '{{clinic_name}}',    label: 'Nombre clínica',  group: 'clinic' },
  { key: '{{clinic_logo}}',    label: 'Logo (URL)',       group: 'clinic' },
  { key: '{{clinic_address}}', label: 'Dirección',        group: 'clinic' },
  { key: '{{clinic_phone}}',   label: 'Teléfono',         group: 'clinic' },
  { key: '{{clinic_email}}',   label: 'Email',            group: 'clinic' },
];

const SHARED_DOCUMENT: PrintTemplateVariable[] = [
  { key: '{{doc_no}}',      label: 'Nro. Documento',    group: 'document' },
  { key: '{{date}}',        label: 'Fecha',             group: 'document' },
  { key: '{{currency}}',    label: 'Moneda',            group: 'document' },
  { key: '{{status}}',      label: 'Estado',            group: 'document' },
  { key: '{{generated_at}}', label: 'Fecha generación', group: 'document' },
  { key: '{{notes}}',       label: 'Notas',             group: 'document' },
];

const SHARED_PATIENT: PrintTemplateVariable[] = [
  { key: '{{patient_name}}', label: 'Paciente', group: 'patient' },
];

const SHARED_PAYMENT_FIELDS: PrintTemplateVariable[] = [
  { key: '{{amount}}',           label: 'Monto',           group: 'document' },
  { key: '{{method}}',           label: 'Método de pago',  group: 'document' },
  { key: '{{transaction_type}}', label: 'Tipo',            group: 'document' },
  { key: '{{reference}}',        label: 'Referencia',      group: 'document' },
  { key: '{{exchange_rate}}',    label: 'Tipo de cambio',  group: 'document' },
];

// ── Per-type registries ────────────────────────────────────────────────────────

export const PRINT_TEMPLATE_VARIABLES: Record<PrintDocumentType, PrintTemplateVariable[]> = {
  invoice: [
    ...CLINIC_VARS,
    ...SHARED_DOCUMENT,
    { key: '{{due_date}}',       label: 'Vencimiento',    group: 'document' },
    { key: '{{payment_status}}', label: 'Estado de pago', group: 'document' },
    { key: '{{reference}}',      label: 'Referencia',     group: 'document' },
    { key: '{{total}}',          label: 'Total',          group: 'document' },
    { key: '{{paid}}',           label: 'Pagado',         group: 'document' },
    { key: '{{pending}}',        label: 'Pendiente',      group: 'document' },
    ...SHARED_PATIENT,
    { key: '{{items_table}}',    label: 'Tabla de ítems', group: 'tables' },
    { key: '{{payments_table}}', label: 'Tabla de pagos', group: 'tables' },
  ],
  quote: [
    ...CLINIC_VARS,
    ...SHARED_DOCUMENT,
    { key: '{{payment_status}}',   label: 'Estado de pago',      group: 'document' },
    { key: '{{total}}',            label: 'Total',               group: 'document' },
    { key: '{{amount_invoiced}}',  label: 'Facturado',           group: 'document' },
    { key: '{{pending_invoice}}',  label: 'Pend. Factura',       group: 'document' },
    { key: '{{amount_paid}}',      label: 'Pagado',              group: 'document' },
    { key: '{{pending_payment}}',  label: 'Pend. Pago',          group: 'document' },
    ...SHARED_PATIENT,
    { key: '{{items_table}}',      label: 'Tabla de servicios',  group: 'tables' },
    { key: '{{invoices_section}}', label: 'Sección de facturas', group: 'tables' },
  ],
  payment: [
    ...CLINIC_VARS,
    ...SHARED_DOCUMENT,
    ...SHARED_PAYMENT_FIELDS,
    ...SHARED_PATIENT,
  ],
  credit_note: [
    ...CLINIC_VARS,
    ...SHARED_DOCUMENT,
    { key: '{{original_invoice}}', label: 'Factura original', group: 'document' },
    { key: '{{reference}}',        label: 'Referencia',       group: 'document' },
    { key: '{{total}}',            label: 'Total acreditado', group: 'document' },
    ...SHARED_PATIENT,
    { key: '{{items_table}}',      label: 'Tabla de ítems',   group: 'tables' },
  ],
  prepayment: [
    ...CLINIC_VARS,
    ...SHARED_DOCUMENT,
    { key: '{{amount}}',         label: 'Monto',          group: 'document' },
    { key: '{{method}}',         label: 'Método de pago', group: 'document' },
    { key: '{{exchange_rate}}',  label: 'Tipo de cambio', group: 'document' },
    ...SHARED_PATIENT,
  ],
};
