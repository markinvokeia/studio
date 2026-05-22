import { addDays, format } from 'date-fns';
import { api } from '@/services/api';
import { API_ROUTES } from '@/constants/routes';
import type { Invoice } from '@/lib/types';

export interface AppointmentBillingState {
  invoice_id: string | null;
  quote_id: string | null;
  quote_doc_no: string | null;
  /** Full invoice object built from the same response — has accurate paid_amount. */
  invoice: Invoice | null;
}

export interface SessionBillingState {
  invoice_id: string | null;
  quote_id: string | null;
}

function normalizeAppointmentList(data: unknown): any[] {
  if (!Array.isArray(data)) return [];
  if (data.length > 0 && 'json' in (data[0] as Record<string, unknown>)) {
    return data.map((d: any) => d.json);
  }
  return data as any[];
}

function buildInvoiceFromRecord(rec: any, fallbackUserId: string): Invoice {
  return {
    id: String(rec.id),
    invoice_ref: rec.invoice_ref || '',
    doc_no: rec.doc_no || rec.invoice_doc_no || '',
    invoice_doc_no: rec.invoice_doc_no || rec.doc_no || '',
    order_id: String(rec.order_id || ''),
    order_doc_no: rec.order_doc_no || '',
    quote_doc_no: rec.quote_doc_no || '',
    quote_id: String(rec.quote_id || ''),
    user_id: String(rec.user_id || fallbackUserId),
    user_name: rec.user_name || '',
    userEmail: rec.user_email || rec.userEmail || '',
    total: Number(rec.total || 0),
    currency: rec.currency || 'USD',
    status: rec.status || 'booked',
    payment_status: rec.payment_state || rec.payment_status || 'unpaid',
    paid_amount: Number(rec.paid_amount || 0),
    type: rec.type || 'invoice',
    notes: rec.notes || '',
    is_historical: rec.is_historical ?? false,
    due_date: rec.due_date || '',
    createdAt: rec.created_at || rec.createdAt || '',
    updatedAt: rec.updated_at || rec.updatedAt || '',
  };
}

/**
 * Fetches fresh appointment data from the backend to check the current
 * invoice_id / quote_id before opening Cobro Rápido.
 *
 * Also looks for the associated invoice record in the same response (the
 * endpoint returns mixed appointment + invoice data) so callers get accurate
 * paid_amount without a second API round-trip.
 *
 * Returns all-null fields on any error so callers fall back to a safe freeform
 * flow rather than blocking.
 */
export async function fetchAppointmentBillingState(
  patientId: string,
  appointmentId: string,
  appointmentDate: string, // 'yyyy-MM-dd' — used to build a ±1-day fetch window
): Promise<AppointmentBillingState> {
  const fallback: AppointmentBillingState = { invoice_id: null, quote_id: null, quote_doc_no: null, invoice: null };
  try {
    const base = new Date(`${appointmentDate}T12:00:00`);
    const fmt = (d: Date) => format(d, 'yyyy-MM-dd HH:mm:ss');
    const data = await api.get(API_ROUTES.USERS_APPOINTMENTS, {
      user_id: patientId,
      startingDateAndTime: fmt(addDays(base, -1)),
      endingDateAndTime: fmt(addDays(base, 1)),
    });
    const raw = normalizeAppointmentList(data);
    const appt = raw.find((a: any) =>
      String(a.appointment_id ?? a.appointmentId ?? a.appointmentid ?? a.id) === String(appointmentId),
    );
    if (!appt) return fallback;

    const invoiceId = appt.invoice_id != null ? String(appt.invoice_id) : null;

    // Look for the invoice record in the same response array so we get the
    // current paid_amount without an extra USER_INVOICES round-trip.
    let invoice: Invoice | null = null;
    if (invoiceId) {
      const invRec = raw.find(
        (r: any) => String(r.id) === invoiceId && (r.type === 'invoice' || r.doc_no?.startsWith('INV-')),
      );
      if (invRec) {
        invoice = buildInvoiceFromRecord(invRec, patientId);
      }
    }

    return {
      invoice_id: invoiceId,
      quote_id: appt.quote_id != null ? String(appt.quote_id) : null,
      quote_doc_no: appt.quote_doc_no ?? null,
      invoice,
    };
  } catch {
    return fallback;
  }
}

/**
 * Fetches fresh session data to check current invoice_id / quote_id before
 * opening Cobro Rápido from a session context.
 */
export async function fetchSessionBillingState(
  patientId: string,
  sessionId: string,
): Promise<SessionBillingState> {
  const fallback: SessionBillingState = { invoice_id: null, quote_id: null };
  try {
    const data = await api.get(API_ROUTES.CLINIC_HISTORY.PATIENT_SESSIONS, { user_id: patientId });
    const raw: any[] = Array.isArray(data) ? data : (data?.patient_sessions ?? data?.data ?? []);
    const session = raw.find((s: any) => String(s.sesion_id) === String(sessionId));
    if (!session) return fallback;
    return {
      invoice_id: session.invoice_id != null ? String(session.invoice_id) : null,
      quote_id: session.quote_id != null ? String(session.quote_id) : null,
    };
  } catch {
    return fallback;
  }
}
