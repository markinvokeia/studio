import { API_ROUTES } from '@/constants/routes';
import { mapLineDiscountFields } from '@/lib/discounts';
import type { Invoice, InvoiceItem, Payment, Quote, QuoteItem } from '@/lib/types';
import { api } from './api';
import { mapApiPaymentToPayment } from './payments-service';

function normalizeQuote(raw: any, userId: string): Quote {
  return {
    id: String(raw.id),
    doc_no: raw.doc_no || undefined,
    user_id: raw.user_id || userId,
    doctor_id: raw.doctor_id != null ? String(raw.doctor_id) : undefined,
    doctor_name: raw.doctor_name || undefined,
    total: Number(raw.total_presupuesto ?? raw.total ?? 0),
    status: (String(raw.status || 'draft').toLowerCase() as Quote['status']),
    payment_status: (String(raw.payment_status || 'unpaid').toLowerCase() as Quote['payment_status']),
    billing_status: String(raw.billing_status || 'not invoiced').toLowerCase(),
    currency: (raw.currency || 'USD') as Quote['currency'],
    notes: raw.notes || '',
    createdAt: raw.createdAt || raw.created_at || new Date().toISOString(),
    exchange_rate: raw.exchange_rate != null ? Number(raw.exchange_rate) : undefined,
    amount_invoiced: Number(raw.monto_facturado ?? raw.amount_invoiced ?? 0),
    amount_paid: Number(raw.monto_pagado ?? raw.amount_paid ?? 0),
    amount_pending_invoice: Number(raw.pendiente_facturar ?? raw.amount_pending_invoice ?? 0),
    amount_pending_payment: Number(raw.pendiente_pago_facturado ?? raw.amount_pending_payment ?? 0),
    external_id: raw.external_id ?? null,
  };
}

function normalizeInvoice(raw: any, userId: string): Invoice {
  return {
    id: String(raw.id),
    invoice_ref: raw.invoice_ref || '',
    doc_no: raw.doc_no || undefined,
    invoice_doc_no: raw.invoice_doc_no || raw.doc_no || undefined,
    order_id: raw.order_id != null ? String(raw.order_id) : '',
    quote_id: raw.quote_id != null ? String(raw.quote_id) : '',
    quote_doc_no: raw.quote_doc_no || undefined,
    user_id: raw.user_id != null ? String(raw.user_id) : userId,
    user_name: raw.user_name || '',
    doctor_id: raw.doctor_id != null ? String(raw.doctor_id) : undefined,
    doctor_name: raw.doctor_name || undefined,
    total: parseFloat(raw.total) || 0,
    currency: (raw.currency || 'USD') as Invoice['currency'],
    notes: raw.notes || '',
    status: raw.status || 'draft',
    payment_status: raw.payment_state || raw.payment_status || 'unpaid',
    paid_amount: raw.paid_amount != null ? parseFloat(raw.paid_amount) : undefined,
    type: raw.type || 'invoice',
    parent_id: raw.parent_id ? String(raw.parent_id) : undefined,
    is_historical: Boolean(raw.is_historical),
    createdAt: raw.created_at || raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updated_at || raw.updatedAt || '',
  };
}

function normalizeQuoteItem(raw: any): QuoteItem {
  return {
    id: String(raw.id),
    service_id: String(raw.service_id),
    service_name: raw.service_name || '',
    unit_price: parseFloat(raw.unit_price) || 0,
    quantity: parseInt(raw.quantity, 10) || 1,
    total: parseFloat(raw.total) || 0,
    tooth_number: raw.tooth_number ?? undefined,
    ...mapLineDiscountFields(raw),
  };
}

function normalizeInvoiceItem(raw: any): InvoiceItem {
  return {
    id: String(raw.id),
    service_id: String(raw.service_id),
    service_name: raw.service_name || '',
    unit_price: parseFloat(raw.unit_price) || 0,
    quantity: parseInt(raw.quantity, 10) || 1,
    total: parseFloat(raw.total) || 0,
    tooth_number: raw.tooth_number ?? undefined,
    quote_item_id: raw.quote_item_id != null ? String(raw.quote_item_id) : undefined,
    step_id: raw.step_id != null ? String(raw.step_id) : undefined,
    steps: raw.steps != null ? String(raw.steps) : undefined,
    ...mapLineDiscountFields(raw),
  };
}

export interface PatientLedgerData {
  quotes: Quote[];
  invoices: Invoice[];
  payments: Payment[];
  quoteItemsByQuote: Record<string, QuoteItem[]>;
  invoiceItemsByInvoice: Record<string, InvoiceItem[]>;
}

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { data: PatientLedgerData; expiresAt: number }>();

async function fetchPatientLedgerDataUncached(userId: string): Promise<PatientLedgerData> {
  const [rawQuotesInvoices, rawPayments] = await Promise.all([
    api.get(API_ROUTES.USER_QUOTES_INVOICES, { user_id: userId }).catch(() => []),
    api.get(API_ROUTES.USER_PAYMENTS, { user_id: userId }).catch(() => []),
  ]);

  const root = Array.isArray(rawQuotesInvoices) ? rawQuotesInvoices[0] : rawQuotesInvoices;
  const quotesArr: any[] = (root?.quotes || []).filter((q: any) => q && q.id != null);
  const invoicesArr: any[] = (root?.invoices || []).filter((i: any) => i && i.id != null);

  const quotes: Quote[] = quotesArr.map((q) => normalizeQuote(q, userId));
  const invoices: Invoice[] = invoicesArr.map((i) => normalizeInvoice(i, userId));

  const quoteItemsByQuote: Record<string, QuoteItem[]> = {};
  for (const q of quotesArr) {
    quoteItemsByQuote[String(q.id)] = (q.quote_items || [])
      .filter((item: any) => item != null)
      .map(normalizeQuoteItem);
  }

  const invoiceItemsByInvoice: Record<string, InvoiceItem[]> = {};
  for (const i of invoicesArr) {
    invoiceItemsByInvoice[String(i.id)] = (i.invoice_items || [])
      .filter((item: any) => item != null)
      .map(normalizeInvoiceItem);
  }

  const paymentsArr = Array.isArray(rawPayments) ? rawPayments : ((rawPayments as any)?.payments || []);
  const payments: Payment[] = paymentsArr.filter((p: any) => p && p.transaction_id != null).map(mapApiPaymentToPayment);

  return { quotes, invoices, payments, quoteItemsByQuote, invoiceItemsByInvoice };
}

/**
 * Fetches everything the patient account ledger needs in 2 requests: quotes+invoices (each with
 * their items nested, via `USER_QUOTES_INVOICES`) and payments. Results are cached per patient
 * for `CACHE_TTL_MS` so switching sub-tabs and back doesn't re-fetch; pass `forceRefresh` right
 * after a create/edit action to bypass the cache.
 */
export async function fetchPatientLedgerData(userId: string, options?: { forceRefresh?: boolean }): Promise<PatientLedgerData> {
  if (!userId) {
    return { quotes: [], invoices: [], payments: [], quoteItemsByQuote: {}, invoiceItemsByInvoice: {} };
  }

  const cacheKey = userId;
  const cached = cache.get(cacheKey);
  if (!options?.forceRefresh && cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const data = await fetchPatientLedgerDataUncached(userId);
  cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  return data;
}
