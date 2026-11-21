import { addYears, format } from 'date-fns';

import api from '@/services/api';
import { fetchPatientLedgerData } from '@/services/patient-ledger-data';
import { getTreatmentSequences } from '@/services/treatment-plans';

import { API_ROUTES } from '@/constants/routes';

/**
 * Lo que se sabe de un paciente para contestar preguntas por voz («¿cuántas veces faltó?», «¿cuánto
 * debe?», «¿en qué está el presupuesto?»). Se arma con los mismos endpoints que el perfil del
 * paciente y el estado de cuenta: historial de citas, finanzas por moneda, presupuestos, facturas,
 * pagos y planes de tratamiento. Solo se pide lo que hace falta para la pregunta (`needs`).
 */

export type PatientFactsNeed = 'appointments' | 'financial' | 'ledger' | 'treatments';

export interface PatientFactAppointment {
  /** Inicio en hora local, 'yyyy-MM-ddTHH:mm'. */
  start: string;
  status: string;
  doctorName?: string;
  cancellationReason?: string | null;
}

export interface PatientFacts {
  patientId: string;
  patientName: string;
  appointments?: PatientFactAppointment[];
  /** Por moneda: deuda, pagado, facturado, saldo a favor. */
  financial?: Array<{ currency: string; debt: number; paid: number; invoiced: number; credit: number }>;
  payments?: Array<{ date: string; amount: number; currency: string; method: string }>;
  quotes?: Array<{ docNo: string; status: string; billingStatus: string; paymentStatus: string; total: number; currency: string; date: string }>;
  invoices?: Array<{ docNo: string; status: string; paymentStatus: string; total: number; paid: number; currency: string; date: string }>;
  treatments?: Array<{ name: string; status: string; done: number; total: number; nextStep: string | null; nextDate: string | null; doctorName?: string }>;
}

const rowsOf = (data: unknown): any[] => {
  if (Array.isArray(data)) return data.length && data[0] && typeof data[0] === 'object' && 'json' in data[0] ? data.map((d: any) => d.json) : data;
  const d = data as { data?: unknown[] } | null;
  return Array.isArray(d?.data) ? d!.data : [];
};

async function loadAppointments(patientId: string): Promise<PatientFactAppointment[]> {
  const now = new Date();
  const fmt = (d: Date) => format(d, 'yyyy-MM-dd HH:mm:ss');
  const data = await api.get(API_ROUTES.USERS_APPOINTMENTS, {
    startingDateAndTime: fmt(addYears(now, -10)),
    endingDateAndTime: fmt(addYears(now, 2)),
    user_id: patientId,
  });
  return rowsOf(data).flatMap((a: any) => {
    const node = a?.start_time ?? a?.start;
    const raw = typeof node === 'string' ? node : node?.dateTime;
    if (!raw) return [];
    return [{
      start: String(raw).replace(/Z$/, '').replace(' ', 'T').slice(0, 16),
      status: String(a.status ?? 'scheduled'),
      doctorName: a.doctor_name ?? a.doctorName ?? undefined,
      cancellationReason: a.cancellation_reason ?? null,
    }];
  });
}

async function loadFinancial(patientId: string): Promise<NonNullable<PatientFacts['financial']>> {
  const raw = await api.get(API_ROUTES.USER_FINANCIAL, { user_id: patientId });
  const fin = Array.isArray(raw) ? raw[0] : raw;
  const byCurrency = (fin?.financial_data ?? {}) as Record<string, any>;
  return Object.entries(byCurrency).map(([currency, d]) => ({
    currency,
    debt: Number(d?.current_debt ?? 0),
    paid: Number(d?.total_paid ?? 0),
    invoiced: Number(d?.total_invoiced ?? 0),
    credit: Number(d?.available_balance ?? 0),
  }));
}

/** Los datos del paciente para lo que se preguntó. Lo que falla queda sin cargar (no rompe la respuesta). */
export async function loadPatientFacts(patient: { id: string; name: string }, needs: PatientFactsNeed[]): Promise<PatientFacts> {
  const facts: PatientFacts = { patientId: patient.id, patientName: patient.name };
  const want = new Set(needs);
  await Promise.all([
    want.has('appointments') && loadAppointments(patient.id).then((v) => { facts.appointments = v; }).catch(() => {}),
    want.has('financial') && loadFinancial(patient.id).then((v) => { facts.financial = v; }).catch(() => {}),
    want.has('ledger') && fetchPatientLedgerData(patient.id).then((ledger) => {
      facts.payments = ledger.payments.map((p) => ({ date: p.payment_date, amount: Number(p.amount_applied ?? p.source_amount ?? 0), currency: String(p.source_currency ?? ''), method: p.payment_method ?? '' }));
      facts.quotes = ledger.quotes.map((q) => ({ docNo: q.doc_no ?? q.quote_doc_no ?? q.id, status: q.status, billingStatus: q.billing_status, paymentStatus: q.payment_status, total: Number(q.total ?? 0), currency: String(q.currency ?? ''), date: q.createdAt }));
      facts.invoices = ledger.invoices.map((i) => ({ docNo: i.doc_no ?? i.invoice_doc_no ?? i.id, status: i.status, paymentStatus: i.payment_status, total: Number(i.total ?? 0), paid: Number(i.paid_amount ?? 0), currency: String(i.currency ?? ''), date: i.createdAt }));
    }).catch(() => {}),
    want.has('treatments') && getTreatmentSequences(patient.id).then((list) => {
      facts.treatments = list.map((t) => {
        const steps = t.steps ?? [];
        const next = steps.find((s) => s.status === 'pending' || s.status === 'scheduled');
        return {
          name: t.service_name,
          status: t.status,
          done: steps.filter((s) => s.status === 'completed').length,
          total: steps.length,
          nextStep: next?.step_name ?? null,
          nextDate: next?.scheduled_date ?? null,
          doctorName: t.doctor_name,
        };
      });
    }).catch(() => {}),
  ]);
  return facts;
}
