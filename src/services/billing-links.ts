import { api } from '@/services/api';
import { API_ROUTES } from '@/constants/routes';

/**
 * Links an invoice to an appointment after Cobro Rápido.
 * Fire-and-forget: logs a warning on failure but never blocks the wizard flow.
 */
export async function linkInvoiceToAppointment(
  invoiceId: string,
  appointmentId: string,
): Promise<void> {
  try {
    await api.post(API_ROUTES.APPOINTMENTS_LINK_INVOICE, {
      appointment_id: appointmentId,
      invoice_id: invoiceId,
    });
  } catch {
    console.warn('[billing-links] Failed to link invoice to appointment', { invoiceId, appointmentId });
  }
}

/**
 * Links an invoice to a clinic session (sesiones_clinicas) after Cobro Rápido.
 */
export async function linkInvoiceToClinicSession(
  invoiceId: string,
  sessionId: string,
): Promise<void> {
  try {
    await api.post(API_ROUTES.CLINIC_SESSIONS_LINK_INVOICE, {
      sesion_id: sessionId,
      invoice_id: invoiceId,
    });
  } catch {
    console.warn('[billing-links] Failed to link invoice to clinic session', { invoiceId, sessionId });
  }
}

/**
 * Links an invoice to an odontogram session (sesiones) after Cobro Rápido.
 */
export async function linkInvoiceToOdontogramSession(
  invoiceId: string,
  sessionId: string,
): Promise<void> {
  try {
    await api.post(API_ROUTES.SESSIONS_LINK_INVOICE, {
      sesion_id: sessionId,
      invoice_id: invoiceId,
    });
  } catch {
    console.warn('[billing-links] Failed to link invoice to odontogram session', { invoiceId, sessionId });
  }
}
