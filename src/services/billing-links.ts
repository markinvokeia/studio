import { api, REQUEST_TIMEOUT_MS } from '@/services/api';
import { API_ROUTES } from '@/constants/routes';

interface LinkInvoiceOptions {
  /** Re-lanza el error en vez de tragárselo. Úsalo en acciones del usuario que
   *  muestran feedback (la UI no puede confirmar un vínculo que falló). El default
   *  sigue siendo fire-and-forget para los flujos del wizard. */
  propagateErrors?: boolean;
}

/**
 * Links an invoice to an appointment after Cobro Rápido.
 * Fire-and-forget por defecto: loguea el fallo pero no bloquea el wizard.
 */
export async function linkInvoiceToAppointment(
  invoiceId: string,
  appointmentId: string,
  options: LinkInvoiceOptions = {},
): Promise<void> {
  try {
    await api.post(API_ROUTES.APPOINTMENTS_LINK_INVOICE, {
      appointment_id: appointmentId,
      invoice_id: invoiceId,
    }, undefined, undefined, { timeoutMs: REQUEST_TIMEOUT_MS.mutation });
  } catch (error) {
    console.warn('[billing-links] Failed to link invoice to appointment', { invoiceId, appointmentId });
    if (options.propagateErrors) throw error;
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
    }, undefined, undefined, { timeoutMs: REQUEST_TIMEOUT_MS.mutation });
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
    }, undefined, undefined, { timeoutMs: REQUEST_TIMEOUT_MS.mutation });
  } catch {
    console.warn('[billing-links] Failed to link invoice to odontogram session', { invoiceId, sessionId });
  }
}
