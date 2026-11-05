import { api, REQUEST_TIMEOUT_MS } from '@/services/api';
import { API_ROUTES } from '@/constants/routes';

export interface InvoicePaymentSummary {
  docNo?: string;
  transactionId: string;
  transactionType: string;
  methodName?: string;
  amount: number;
  currency: string;
  date?: string;
  notes?: string;
}

/** Payments applied to an invoice, without the failed ones. Throws if they can't be read. */
export async function fetchInvoicePayments(
  invoiceId: string,
  isSales: boolean,
  fallbackCurrency: string,
): Promise<InvoicePaymentSummary[]> {
  const endpoint = isSales ? API_ROUTES.SALES.INVOICE_PAYMENTS : API_ROUTES.PURCHASES.INVOICE_PAYMENTS;
  const data = await api.get(endpoint, { invoice_id: invoiceId, is_sales: isSales ? 'true' : 'false' });
  const raw: Record<string, unknown>[] = Array.isArray(data) ? data : (data.payments || data.data || []);
  return raw
    .filter((p) => p?.status !== 'failed' && (p?.transaction_id || p?.id))
    .map((p) => ({
      docNo: (p.doc_no || p.payment_doc_no || undefined) as string | undefined,
      transactionId: p.transaction_id ? String(p.transaction_id) : String(p.id),
      transactionType: (p.transaction_type || 'direct_payment') as string,
      methodName: (p.payment_method_name || p.method || p.payment_method || undefined) as string | undefined,
      amount: Math.abs(Number(p.amount_applied ?? p.amount ?? 0)),
      currency: (p.currency || fallbackCurrency) as string,
      date: (p.payment_date || p.created_at || undefined) as string | undefined,
      notes: (p.notes || undefined) as string | undefined,
    }));
}

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
