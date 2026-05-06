import { API_ROUTES } from '@/constants/routes';
import type { Invoice, Quote } from '@/lib/types';
import { api } from './api';

export interface QuoteFinancialSummary {
  amount_invoiced: number;
  amount_pending_invoice: number;
  amount_paid: number;
  amount_pending_payment: number;
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function getInvoiceSign(invoice: Invoice): number {
  return invoice.type?.toLowerCase().includes('credit') ? -1 : 1;
}

export function calculateQuoteFinancialSummary(
  quoteTotal: number,
  invoices: Invoice[],
): QuoteFinancialSummary {
  const amountInvoiced = roundCurrency(
    invoices.reduce((sum, invoice) => sum + getInvoiceSign(invoice) * Number(invoice.total || 0), 0),
  );
  const amountPaid = roundCurrency(
    invoices.reduce((sum, invoice) => sum + getInvoiceSign(invoice) * Number(invoice.paid_amount || 0), 0),
  );

  return {
    amount_invoiced: amountInvoiced,
    amount_pending_invoice: roundCurrency(Math.max(Number(quoteTotal || 0) - amountInvoiced, 0)),
    amount_paid: amountPaid,
    amount_pending_payment: roundCurrency(Math.max(amountInvoiced - amountPaid, 0)),
  };
}

function mapQuoteInvoice(apiInvoice: any, fallbackQuoteId: string): Invoice {
  return {
    id: apiInvoice.id ? String(apiInvoice.id) : '',
    invoice_ref: apiInvoice.invoice_ref || '',
    doc_no: apiInvoice.doc_no || apiInvoice.invoice_doc_no || '',
    order_id: apiInvoice.order_id ? String(apiInvoice.order_id) : '',
    order_doc_no: apiInvoice.order_doc_no || '',
    quote_doc_no: apiInvoice.quote_doc_no || '',
    invoice_doc_no: apiInvoice.invoice_doc_no || apiInvoice.doc_no || '',
    quote_id: apiInvoice.quote_id ? String(apiInvoice.quote_id) : fallbackQuoteId,
    user_name: apiInvoice.user_name || '',
    userEmail: apiInvoice.user_email || apiInvoice.userEmail || '',
    user_id: apiInvoice.user_id ? String(apiInvoice.user_id) : '',
    total: Number(apiInvoice.total || 0),
    currency: apiInvoice.currency || 'USD',
    notes: apiInvoice.notes || '',
    status: apiInvoice.status || 'draft',
    payment_status: apiInvoice.payment_state || apiInvoice.payment_status || 'unpaid',
    paid_amount: Number(apiInvoice.paid_amount || 0),
    type: apiInvoice.type || 'invoice',
    invoice_id: apiInvoice.invoice_id ? String(apiInvoice.invoice_id) : null,
    is_historical: Boolean(apiInvoice.is_historical),
    due_date: apiInvoice.due_date || undefined,
    createdAt: apiInvoice.created_at || apiInvoice.createdAt || '',
    updatedAt: apiInvoice.updated_at || apiInvoice.updatedAt || '',
  };
}

export async function fetchQuoteInvoicesForFinancials(
  quoteId: string,
  isSales: boolean,
): Promise<Invoice[]> {
  if (!quoteId) return [];

  try {
    const endpoint = isSales ? API_ROUTES.SALES.QUOTES_INVOICES : API_ROUTES.PURCHASES.QUOTES_INVOICES;
    const data = await api.get(endpoint, { quote_id: quoteId, is_sales: isSales ? 'true' : 'false' });
    const rawInvoices = Array.isArray(data) ? data : (data.invoices || data.data || []);
    return rawInvoices.map((invoice: any) => mapQuoteInvoice(invoice, quoteId));
  } catch {
    return [];
  }
}

export async function enrichQuotesWithFinancials(
  quotes: Quote[],
  isSales: boolean,
): Promise<Quote[]> {
  const summaries = await Promise.all(
    quotes.map(async (quote) => {
      const invoices = await fetchQuoteInvoicesForFinancials(quote.id, isSales);
      return calculateQuoteFinancialSummary(Number(quote.total || 0), invoices);
    }),
  );

  return quotes.map((quote, index) => ({
    ...quote,
    ...summaries[index],
  }));
}
