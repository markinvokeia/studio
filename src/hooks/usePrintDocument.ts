'use client';

import { useEffect } from 'react';
import { api } from '@/services/api';
import { API_ROUTES } from '@/constants/routes';
import { fetchQuoteInvoicesForFinancials } from '@/services/quote-financials';
import {
  usePrintDocumentStore,
  type PrintInvoiceRow,
} from '@/stores/print-document-store';
import type { Quote, Invoice, Payment, CreditNote, QuoteItem, InvoiceItem, DocPrintTemplate, FinancialSummaryReport, CajaSessionDetails, PayrollPeriod, PayrollEntry } from '@/lib/types';
import { fetchClinicInfo } from '@/hooks/useClinicInfo';

// ── Data mappers (match patterns in user-quotes.tsx / user-invoices.tsx) ───────

function mapQuoteItems(raw: any[]): QuoteItem[] {
  return raw.map((i) => ({
    id: String(i.id),
    service_id: String(i.service_id),
    service_name: i.service_name || '',
    unit_price: parseFloat(i.unit_price) || 0,
    quantity: parseInt(i.quantity) || 1,
    total: parseFloat(i.total) || 0,
    tooth_number: i.tooth_number ?? undefined,
  }));
}

function mapInvoiceItems(raw: any[]): InvoiceItem[] {
  return raw.map((i) => ({
    id: String(i.id),
    service_id: String(i.service_id),
    service_name: i.service_name || '',
    unit_price: parseFloat(i.unit_price) || 0,
    quantity: parseInt(i.quantity) || 1,
    total: parseFloat(i.total) || 0,
    step_id: i.step_id != null ? String(i.step_id) : undefined,
    steps: i.steps != null ? String(i.steps) : undefined,
  }));
}

function mapInvoicePayments(raw: any[]): Payment[] {
  return raw.map((p) => ({
    id: String(p.id),
    doc_no: p.doc_no || p.payment_doc_no || '',
    payment_doc_no: p.payment_doc_no || p.doc_no || '',
    order_id: String(p.order_id || ''),
    invoice_id: p.invoice_id ? String(p.invoice_id) : null,
    quote_id: p.quote_id ? String(p.quote_id) : null,
    user_name: p.user_name || '',
    payment_date: p.payment_date || p.created_at || '',
    amount_applied: Math.abs(Number(p.amount_applied ?? p.amount ?? 0)),
    source_amount: Number(p.source_amount ?? p.amount ?? 0),
    source_currency: p.source_currency || p.invoice_currency || p.currency || 'UYU',
    exchange_rate: p.exchange_rate ? Number(p.exchange_rate) : undefined,
    payment_method: p.payment_method_name || p.payment_method || p.method || '',
    payment_method_code: p.payment_method_code || '',
    transaction_type: p.transaction_type || 'direct_payment',
    transaction_id: p.transaction_id ? String(p.transaction_id) : null,
    notes: p.notes || '',
    status: p.status || 'completed',
    createdAt: p.created_at || p.createdAt || '',
    updatedAt: p.updated_at || p.updatedAt || '',
    amount: Math.abs(Number(p.amount_applied ?? p.amount ?? 0)),
    method: p.payment_method_name || p.payment_method || p.method || '',
    currency: p.invoice_currency || p.source_currency || p.currency || 'UYU',
    type: p.type || null,
  }));
}

// ── Fetch helpers ──────────────────────────────────────────────────────────────

async function fetchQuoteItems(quoteId: string, isSales: boolean): Promise<QuoteItem[]> {
  try {
    const route = isSales ? API_ROUTES.SALES.QUOTES_ITEMS : API_ROUTES.PURCHASES.QUOTES_ITEMS;
    const data = await api.get(route, { quote_id: quoteId, is_sales: isSales ? 'true' : 'false' });
    const raw = Array.isArray(data) ? data : (data.items || data.data || []);
    return mapQuoteItems(raw);
  } catch {
    return [];
  }
}

async function fetchInvoiceItems(invoiceId: string, isSales: boolean): Promise<InvoiceItem[]> {
  try {
    const route = isSales ? API_ROUTES.SALES.INVOICE_ITEMS : API_ROUTES.PURCHASES.INVOICE_ITEMS;
    const data = await api.get(route, { invoice_id: invoiceId, is_sales: isSales ? 'true' : 'false' });
    const raw = Array.isArray(data) ? data : (data.items || data.data || []);
    return mapInvoiceItems(raw);
  } catch {
    return [];
  }
}

async function fetchInvoicePayments(invoiceId: string, isSales: boolean): Promise<Payment[]> {
  try {
    const route = isSales ? API_ROUTES.SALES.INVOICE_PAYMENTS : API_ROUTES.PURCHASES.INVOICE_PAYMENTS;
    const data = await api.get(route, { invoice_id: invoiceId });
    const raw = Array.isArray(data) ? data : (data.payments || data.data || []);
    return mapInvoicePayments(raw);
  } catch {
    return [];
  }
}

// ── Print trigger ──────────────────────────────────────────────────────────────

function waitForFrame(): Promise<void> {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  );
}

// Waits for all <img> elements inside the print container to finish loading.
// This guarantees the logo (and any other images) are rendered before the
// browser print dialog opens. Falls back after 4 s to avoid blocking forever.
function waitForImages(): Promise<void> {
  return new Promise((resolve) => {
    const container = document.querySelector('[data-print-container]');
    if (!container) { resolve(); return; }
    const images = Array.from(container.querySelectorAll<HTMLImageElement>('img'));
    const unloaded = images.filter((img) => !img.complete);
    if (unloaded.length === 0) { resolve(); return; }
    let pending = unloaded.length;
    const done = () => { if (--pending <= 0) resolve(); };
    unloaded.forEach((img) => {
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
    });
    setTimeout(resolve, 4000);
  });
}

function triggerPrint(deactivate: () => void): void {
  const restore = () => {
    deactivate();
    window.removeEventListener('afterprint', restore);
  };
  window.addEventListener('afterprint', restore);
  window.print();
}

// ── Public hook ────────────────────────────────────────────────────────────────

export function usePrintDocument() {
  const { activate, deactivate, customTemplatesLoaded, setCustomTemplates } = usePrintDocumentStore();

  // Preload clinic info so PrintReportHeader has data ready when print fires.
  useEffect(() => { fetchClinicInfo(); }, []);

  // Load custom templates once per session (store persists across hook instances).
  useEffect(() => {
    if (customTemplatesLoaded) return;
    api.get(API_ROUTES.PRINT_TEMPLATES)
      .then((data: unknown) => {
        const raw = Array.isArray(data) ? data : [];
        setCustomTemplates(raw as DocPrintTemplate[]);
      })
      .catch(() => {
        // Silently fall back to React templates if the endpoint isn't available yet.
        setCustomTemplates([]);
      });
  }, [customTemplatesLoaded, setCustomTemplates]);

  async function printQuote(quote: Quote, isSales: boolean): Promise<void> {
    const [items, invoices] = await Promise.all([
      fetchQuoteItems(quote.id, isSales),
      fetchQuoteInvoicesForFinancials(quote.id, isSales),
    ]);

    const invoiceRows: PrintInvoiceRow[] = await Promise.all(
      invoices.map(async (invoice) => {
        const [invoiceItems, payments] = await Promise.all([
          fetchInvoiceItems(invoice.id, isSales),
          fetchInvoicePayments(invoice.id, isSales),
        ]);
        return { ...invoice, items: invoiceItems, payments };
      })
    );

    activate('quote', { quote, items, invoices: invoiceRows, isSales });
    await waitForFrame();
    await waitForImages();
    triggerPrint(deactivate);
  }

  async function printInvoice(invoice: Invoice, isSales: boolean): Promise<void> {
    const [items, payments] = await Promise.all([
      fetchInvoiceItems(invoice.id, isSales),
      fetchInvoicePayments(invoice.id, isSales),
    ]);

    activate('invoice', { invoice, items, payments, creditNotes: [], isSales });
    await waitForFrame();
    await waitForImages();
    triggerPrint(deactivate);
  }

  async function printPayment(payment: Payment, isSales: boolean): Promise<void> {
    activate('payment', { payment, isSales });
    await waitForFrame();
    await waitForImages();
    triggerPrint(deactivate);
  }

  async function printCreditNote(creditNote: CreditNote, isSales: boolean): Promise<void> {
    const items = await fetchInvoiceItems(creditNote.id, isSales);
    activate('credit_note', { creditNote, items, isSales });
    await waitForFrame();
    await waitForImages();
    triggerPrint(deactivate);
  }

  async function printPrepayment(prepayment: Payment, isSales: boolean): Promise<void> {
    activate('prepayment', { prepayment, isSales });
    await waitForFrame();
    await waitForImages();
    triggerPrint(deactivate);
  }

  async function printFinancialSummary(
    userId: string,
    dateRange?: { from?: string; to?: string },
  ): Promise<void> {
    const params: Record<string, string> = { user_id: userId };
    if (dateRange?.from) {
      const d = new Date(dateRange.from);
      d.setHours(0, 0, 0, 0);
      params.from = d.toISOString();
    }
    if (dateRange?.to) {
      const d = new Date(dateRange.to);
      d.setHours(23, 59, 59, 999);
      params.to = d.toISOString();
    }
    const [raw] = await Promise.all([
      api.get(API_ROUTES.USER_FINANCIAL_SUMMARY_PRINT, params),
      fetchClinicInfo(),
    ]);
    const report = (Array.isArray(raw) ? raw[0] : raw) as FinancialSummaryReport;
    if (!report?.history_by_currency) {
      throw new Error('no_data');
    }
    activate('financial_summary', { report, dateRange });
    await waitForFrame();
    await waitForImages();
    triggerPrint(deactivate);
  }

  async function printCajaApertura(sessionId: number | string): Promise<void> {
    const raw = await api.get(API_ROUTES.CASHIER.SESSIONS_DETAILS, { cash_session_id: String(sessionId) });
    const details = (Array.isArray(raw) ? raw[0] : raw) as CajaSessionDetails;
    activate('caja_apertura', { details });
    await waitForFrame();
    await waitForImages();
    triggerPrint(deactivate);
  }

  async function printCajaCierre(sessionId: number | string): Promise<void> {
    const raw = await api.get(API_ROUTES.CASHIER.SESSIONS_DETAILS, { cash_session_id: String(sessionId) });
    const details = (Array.isArray(raw) ? raw[0] : raw) as CajaSessionDetails;
    activate('caja_cierre', { details });
    await waitForFrame();
    await waitForImages();
    triggerPrint(deactivate);
  }

  async function printCajaSesion(sessionId: number | string): Promise<void> {
    const raw = await api.get(API_ROUTES.CASHIER.SESSIONS_DETAILS, { cash_session_id: String(sessionId) });
    const details = (Array.isArray(raw) ? raw[0] : raw) as CajaSessionDetails;
    activate('caja_sesion', { details });
    await waitForFrame();
    await waitForImages();
    triggerPrint(deactivate);
  }

  async function printPayrollPeriod(period: PayrollPeriod, entries: PayrollEntry[]): Promise<void> {
    await fetchClinicInfo();
    activate('payroll_period', { period, entries });
    await waitForFrame();
    await waitForImages();
    triggerPrint(deactivate);
  }

  async function printPayrollReceipts(period: PayrollPeriod, entries: PayrollEntry[]): Promise<void> {
    await fetchClinicInfo();
    activate('payroll_receipt', { period, entries });
    await waitForFrame();
    await waitForImages();
    triggerPrint(deactivate);
  }

  async function printPayrollReport(payload: { title: string; subtitle?: string; columns: string[]; rows: (string | number)[][] }): Promise<void> {
    await fetchClinicInfo();
    activate('payroll_report', payload);
    await waitForFrame();
    await waitForImages();
    triggerPrint(deactivate);
  }

  return { printQuote, printInvoice, printPayment, printCreditNote, printPrepayment, printFinancialSummary, printCajaApertura, printCajaCierre, printCajaSesion, printPayrollPeriod, printPayrollReceipts, printPayrollReport };

}
