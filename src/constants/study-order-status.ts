import type { StudyOrderStatus } from '@/lib/types';

/**
 * Los nueve estados de una orden de estudio, en el orden en que avanza. La matriz de transiciones
 * vive en la base (`study_order_transition_allowed`, migración 179): esto solo decide qué ofrece la
 * pantalla, el backend lo vuelve a validar.
 */
export const STUDY_ORDER_STATUSES: StudyOrderStatus[] = [
  'draft', 'confirmed', 'pending_scheduling', 'scheduled', 'patient_present',
  'in_execution', 'completed', 'delivered', 'cancelled',
];

/** El camino normal, sin la anulación. */
export const STUDY_ORDER_PATH = STUDY_ORDER_STATUSES.filter((s) => s !== 'cancelled');

/** Confirmada y todavía con estudios por hacer: se puede agendar, mandar el link y registrar sesiones. */
export const isStudyOrderOpen = (status: StudyOrderStatus): boolean =>
  ['confirmed', 'pending_scheduling', 'scheduled', 'patient_present', 'in_execution'].includes(status);

/** Se puede anular: ya es una orden y el estudio no empezó. Un borrador se elimina. */
export const isStudyOrderCancellable = (status: StudyOrderStatus): boolean =>
  ['confirmed', 'pending_scheduling', 'scheduled', 'patient_present'].includes(status);

/** Los mueve la cita, nunca una persona a mano. */
export const isAppointmentDrivenStatus = (status: StudyOrderStatus): boolean =>
  ['patient_present', 'in_execution', 'completed'].includes(status);

/** Valores anteriores a los nueve estados: siguen en notificaciones ya guardadas. */
const LEGACY_STATUS: Record<string, StudyOrderStatus> = {
  submitted: 'confirmed',
  new: 'confirmed',
  unscheduled: 'confirmed',
  partially_scheduled: 'pending_scheduling',
  in_progress: 'in_execution',
};

export function normalizeStudyOrderStatus(value: unknown): StudyOrderStatus {
  const raw = String(value ?? '');
  if ((STUDY_ORDER_STATUSES as string[]).includes(raw)) return raw as StudyOrderStatus;
  return LEGACY_STATUS[raw] ?? 'confirmed';
}

/**
 * Qué partes del módulo se muestran. C02.1 (25-nov-2026) entrega la ficha y los nueve estados con su
 * historial; C09.1a (26-nov-2026), la orden manual con frente y dorso y su pestaña en la ficha del paciente; lo demás está construido pero llega en otros cortes: para mostrarlo, poner `true`.
 * El tipo es `boolean` a propósito: con literales, TypeScript marcaría código muerto.
 */
export const STUDY_ORDERS_FEATURES: Record<
  | 'whatsapp' | 'importOrder' | 'review' | 'originals' | 'chatter' | 'assign' | 'acknowledge' | 'overdue'
  | 'bookingLink' | 'sessions' | 'reschedule' | 'print' | 'patientPortal' | 'patientTab' | 'doctorTab',
  boolean
> = {
  /** Órdenes que entran por WhatsApp y filtro de origen. */
  whatsapp: false,
  /** Importar una orden leyendo sus fotos o PDF. */
  importOrder: false,
  /** Puntos a revisar que deja el asistente. */
  review: false,
  /** Originales de WhatsApp o de la importación. */
  originals: false,
  /** Mensajes, notas y seguidores (necesita la migración 132). Apagado, Actividad es el historial. */
  chatter: false,
  /** Responsable de revisar la orden. */
  assign: false,
  /** "Tomar" y el filtro Nuevas. */
  acknowledge: false,
  /** Marca y filtro de atrasadas. */
  overdue: false,
  /** Link para que el paciente se agende solo. */
  bookingLink: false,
  /** Sesión clínica dentro de la orden. */
  sessions: false,
  /** Reagendar desde la orden: se hace en la agenda. */
  reschedule: false,
  print: false,
  /** "Mis órdenes" en el portal del paciente. */
  patientPortal: false,
  /** Pestaña de órdenes en la ficha del paciente (C09.1a). */
  patientTab: true,
  /** Pestaña de órdenes en la ficha del doctor. */
  doctorTab: false,
};
