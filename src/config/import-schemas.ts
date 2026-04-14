import {
  Calendar,
  ClipboardList,
  CreditCard,
  FileText,
  Receipt,
  Stethoscope,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type ImportFieldType = 'text' | 'email' | 'phone' | 'date' | 'boolean' | 'number' | 'enum';

export interface ImportField {
  key: string;
  label: string;
  required: boolean;
  type: ImportFieldType;
  enumValues?: string[];
  hint?: string;
}

export type ImportEntityType =
  | 'patients'
  | 'services'
  | 'quotes'
  | 'invoices'
  | 'payments'
  | 'appointments'
  | 'clinical_sessions';

export interface ImportSchema {
  type: ImportEntityType;
  labelKey: string;
  icon: LucideIcon;
  exampleCsvUrl: string;
  fields: ImportField[];
}

export const IMPORT_SCHEMAS: Record<ImportEntityType, ImportSchema> = {
  patients: {
    type: 'patients',
    labelKey: 'patients',
    icon: Users,
    exampleCsvUrl: 'https://drive.google.com/file/d/1TIMzfYgl4qjU7cepyuzbEiSb-kiwBT28/view?usp=sharing',
    fields: [
      { key: 'name', label: 'Nombre', required: true, type: 'text' },
      { key: 'email', label: 'Email', required: false, type: 'email', hint: 'email o teléfono requerido' },
      { key: 'phone_number', label: 'Teléfono', required: false, type: 'phone', hint: 'email o teléfono requerido' },
      { key: 'identity_document', label: 'Documento de Identidad', required: false, type: 'text' },
      { key: 'internal_id', label: 'ID Interno', required: false, type: 'text' },
      { key: 'birthday', label: 'Fecha de Nacimiento', required: false, type: 'date', hint: 'YYYY-MM-DD' },
      { key: 'address', label: 'Dirección', required: false, type: 'text' },
      { key: 'alternative_phone', label: 'Teléfono Alternativo', required: false, type: 'phone' },
      { key: 'notes', label: 'Notas', required: false, type: 'text' },
      { key: 'rut', label: 'RUT', required: false, type: 'text' },
      { key: 'bank_account', label: 'Cuenta Bancaria', required: false, type: 'text' },
      { key: 'is_active', label: 'Activo', required: false, type: 'boolean', hint: 'true/false (default: true)' },
    ],
  },
  services: {
    type: 'services',
    labelKey: 'services',
    icon: ClipboardList,
    exampleCsvUrl: 'https://drive.google.com/file/d/1Bag4cE5VR2qMECwjc3TYrSd6JoJw21oK/view?usp=sharing',
    fields: [
      { key: 'name', label: 'Nombre', required: true, type: 'text' },
      { key: 'category', label: 'Categoría', required: true, type: 'text' },
      { key: 'price', label: 'Precio', required: true, type: 'number' },
      { key: 'currency', label: 'Moneda', required: false, type: 'enum', enumValues: ['USD', 'UYU'], hint: 'USD o UYU' },
      { key: 'duration_minutes', label: 'Duración (minutos)', required: true, type: 'number' },
      { key: 'description', label: 'Descripción', required: false, type: 'text' },
      { key: 'indications', label: 'Indicaciones', required: false, type: 'text' },
      { key: 'color', label: 'Color', required: false, type: 'text', hint: '#RRGGBB' },
      { key: 'is_active', label: 'Activo', required: false, type: 'boolean', hint: 'true/false (default: true)' },
    ],
  },
  quotes: {
    type: 'quotes',
    labelKey: 'quotes',
    icon: FileText,
    exampleCsvUrl: 'https://drive.google.com/file/d/1C3QlHI4TVkwciXB3IcUWN4O0YpO5Sx9F/view?usp=sharing',
    fields: [
      { key: 'patient_name', label: 'Paciente', required: true, type: 'text' },
      { key: 'service_name', label: 'Servicio', required: true, type: 'text' },
      { key: 'quantity', label: 'Cantidad', required: true, type: 'number' },
      { key: 'unit_price', label: 'Precio Unitario', required: true, type: 'number' },
      { key: 'currency', label: 'Moneda', required: false, type: 'enum', enumValues: ['USD', 'UYU'] },
      { key: 'tooth_number', label: 'Número de Diente', required: false, type: 'number' },
      { key: 'notes', label: 'Notas', required: false, type: 'text' },
      { key: 'status', label: 'Estado', required: false, type: 'enum', enumValues: ['draft', 'sent', 'accepted', 'rejected', 'pending'] },
    ],
  },
  invoices: {
    type: 'invoices',
    labelKey: 'invoices',
    icon: Receipt,
    exampleCsvUrl: 'https://drive.google.com/file/d/1whzx7Tp1nTWrnL4SIFReVlw2w4kOpxOq/view?usp=sharing',
    fields: [
      { key: 'patient_name', label: 'Paciente', required: true, type: 'text' },
      { key: 'service_name', label: 'Servicio', required: true, type: 'text' },
      { key: 'quantity', label: 'Cantidad', required: true, type: 'number' },
      { key: 'unit_price', label: 'Precio Unitario', required: true, type: 'number' },
      { key: 'currency', label: 'Moneda', required: false, type: 'enum', enumValues: ['USD', 'UYU'] },
      { key: 'notes', label: 'Notas', required: false, type: 'text' },
      { key: 'status', label: 'Estado', required: false, type: 'enum', enumValues: ['draft', 'sent', 'paid', 'overdue'] },
    ],
  },
  payments: {
    type: 'payments',
    labelKey: 'payments',
    icon: CreditCard,
    exampleCsvUrl: 'https://drive.google.com/file/d/1CZSvwK-uq6MaHsJggu2_UvLf3hforZmU/view?usp=sharing',
    fields: [
      { key: 'patient_name', label: 'Paciente', required: true, type: 'text' },
      { key: 'amount', label: 'Monto', required: true, type: 'number' },
      { key: 'payment_method', label: 'Método de Pago', required: true, type: 'text' },
      { key: 'date', label: 'Fecha', required: true, type: 'date', hint: 'YYYY-MM-DD' },
      { key: 'currency', label: 'Moneda', required: false, type: 'enum', enumValues: ['USD', 'UYU'] },
      { key: 'notes', label: 'Notas', required: false, type: 'text' },
    ],
  },
  appointments: {
    type: 'appointments',
    labelKey: 'appointments',
    icon: Calendar,
    exampleCsvUrl: 'https://drive.google.com/file/d/12WP_wbz1cezZ-fRQt3PkxmEGkK17qvg-/view?usp=sharing',
    fields: [
      { key: 'patient_name', label: 'Paciente', required: true, type: 'text' },
      { key: 'doctor_name', label: 'Doctor', required: true, type: 'text' },
      { key: 'date', label: 'Fecha', required: true, type: 'date', hint: 'YYYY-MM-DD' },
      { key: 'time', label: 'Hora', required: true, type: 'text', hint: 'HH:mm' },
      { key: 'service_name', label: 'Servicio', required: false, type: 'text' },
      { key: 'calendar', label: 'Calendario', required: false, type: 'text' },
      { key: 'notes', label: 'Notas', required: false, type: 'text' },
    ],
  },
  clinical_sessions: {
    type: 'clinical_sessions',
    labelKey: 'clinicalSessions',
    icon: Stethoscope,
    exampleCsvUrl: 'https://drive.google.com/file/d/1M8L36Z8el4sp0Sfolcg5201wuBjwI_WF/view?usp=sharing',
    fields: [
      { key: 'patient_name', label: 'Paciente', required: true, type: 'text' },
      { key: 'date', label: 'Fecha de Sesión', required: true, type: 'date', hint: 'YYYY-MM-DD' },
      { key: 'doctor_name', label: 'Doctor', required: false, type: 'text' },
      { key: 'diagnosis', label: 'Diagnóstico', required: false, type: 'text' },
      { key: 'procedure', label: 'Procedimiento Realizado', required: false, type: 'text' },
      { key: 'clinical_notes', label: 'Notas Clínicas', required: false, type: 'text' },
      { key: 'next_appointment_plan', label: 'Plan Próxima Cita', required: false, type: 'text' },
      { key: 'next_appointment_date', label: 'Fecha Próxima Cita', required: false, type: 'date', hint: 'YYYY-MM-DD' },
    ],
  },
};

export const IMPORT_ENTITY_ORDER: ImportEntityType[] = [
  'patients',
  'services',
  'quotes',
  'invoices',
  'payments',
  'appointments',
  'clinical_sessions',
];
