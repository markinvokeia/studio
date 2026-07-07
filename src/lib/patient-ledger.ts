import type { Invoice, InvoiceItem, Payment, Quote, QuoteItem } from '@/lib/types';

export type LedgerRowStatus = 'presupuestado' | 'facturado' | 'parcial' | 'pagado' | 'notaCredito';

export type LedgerRow = {
  id: string;
  date: string;
  kind: 'item' | 'payment';
  label: string;
  docNo?: string;
  quoteId?: string;
  invoiceId?: string;
  /** Underlying Payment id — present for `kind: 'payment'` rows only. */
  paymentId?: string;
  /** The payment's transaction kind — a payment row can be a direct payment, a
   *  credit-note allocation, or a payment allocation; reverting it needs to know
   *  which one so the backend hits the right table. */
  transactionType?: Payment['transaction_type'];
  status?: LedgerRowStatus;
  currency: string;
  debe: number;
  haber: number;
  runningBalance: number;
  /** Underlying QuoteItem/InvoiceItem id — present for `kind: 'item'` rows only. */
  itemId?: string;
  serviceId?: string;
  quantity?: number;
  unitPrice?: number;
  /** The parent Quote's own status (draft/pending/accepted/confirmed/rejected) — only
   *  'accepted'/'confirmed' quotes have an Order behind them and can be invoiced. */
  quoteStatus?: string;
};

function round2(n: number): number {
  const r = Math.round((n + Number.EPSILON) * 100) / 100;
  return Object.is(r, -0) ? 0 : r;
}

function invoiceRowStatus(invoice: Invoice): LedgerRowStatus {
  const paymentStatus = String(invoice.payment_status || '').toLowerCase();
  if (paymentStatus === 'paid') return 'pagado';
  if (paymentStatus === 'partial' || paymentStatus === 'partially_paid') return 'parcial';
  return 'facturado';
}

/**
 * Builds the patient's unified account ledger (one row per service item, plus one
 * row per payment), resolving each QuoteItem against its InvoiceItem (matched via
 * `quote_item_id`) so an already-billed service shows as an invoice row instead of
 * a pending quote row. Rows are grouped by currency and carry a running balance,
 * mirroring the legacy "Cuentas" timeline (Debe/Haber/Saldo).
 */
export function buildPatientLedger(params: {
  quotes: Quote[];
  quoteItemsByQuote: Record<string, QuoteItem[]>;
  invoices: Invoice[];
  invoiceItemsByInvoice: Record<string, InvoiceItem[]>;
  payments: Payment[];
}): Record<string, LedgerRow[]> {
  const { quotes, quoteItemsByQuote, invoices, invoiceItemsByInvoice, payments } = params;

  const invoiceItemByQuoteItemId = new Map<string, { item: InvoiceItem; invoice: Invoice }>();
  for (const invoice of invoices) {
    const items = invoiceItemsByInvoice[invoice.id] || [];
    for (const item of items) {
      if (item.quote_item_id != null) {
        invoiceItemByQuoteItemId.set(String(item.quote_item_id), { item, invoice });
      }
    }
  }

  const rowsByCurrency: Record<string, Omit<LedgerRow, 'runningBalance'>[]> = {};
  const pushRow = (currency: string, row: Omit<LedgerRow, 'runningBalance'>) => {
    (rowsByCurrency[currency] ||= []).push(row);
  };

  const billedInvoiceItemIds = new Set<string>();

  for (const quote of quotes) {
    const items = quoteItemsByQuote[quote.id] || [];
    for (const quoteItem of items) {
      const billed = invoiceItemByQuoteItemId.get(String(quoteItem.id));
      if (billed) {
        const { item, invoice } = billed;
        billedInvoiceItemIds.add(String(item.id));
        const currency = invoice.currency || quote.currency || 'USD';
        pushRow(currency, {
          id: `invoice-item-${item.id}`,
          date: invoice.createdAt,
          kind: 'item',
          label: item.service_name || quoteItem.service_name,
          docNo: invoice.doc_no || invoice.invoice_doc_no,
          quoteId: quote.id,
          invoiceId: invoice.id,
          status: invoiceRowStatus(invoice),
          currency,
          debe: round2(item.total || 0),
          haber: 0,
          itemId: item.id,
          serviceId: item.service_id,
          quantity: item.quantity,
          unitPrice: item.unit_price,
        });
      } else {
        const currency = quote.currency || 'USD';
        pushRow(currency, {
          id: `quote-item-${quoteItem.id}`,
          date: quote.createdAt,
          kind: 'item',
          label: quoteItem.service_name,
          docNo: quote.doc_no,
          quoteId: quote.id,
          status: 'presupuestado',
          currency,
          debe: round2(quoteItem.total || 0),
          haber: 0,
          itemId: quoteItem.id,
          serviceId: quoteItem.service_id,
          quantity: quoteItem.quantity,
          unitPrice: quoteItem.unit_price,
          quoteStatus: quote.status,
        });
      }
    }
  }

  // Invoices with no quote behind them at all (created directly, without an order
  // or a quote) never surface above since we only walk quote items — show their
  // lines (or the invoice itself, if it has no item breakdown) directly here.
  for (const invoice of invoices) {
    if ((invoice.type || 'invoice') === 'credit_note') continue;
    const items = invoiceItemsByInvoice[invoice.id] || [];
    const standaloneItems = items.filter((item) => !billedInvoiceItemIds.has(String(item.id)));
    const currency = invoice.currency || 'USD';

    if (standaloneItems.length > 0) {
      for (const item of standaloneItems) {
        pushRow(currency, {
          id: `invoice-item-${item.id}`,
          date: invoice.createdAt,
          kind: 'item',
          label: item.service_name,
          docNo: invoice.doc_no || invoice.invoice_doc_no,
          invoiceId: invoice.id,
          status: invoiceRowStatus(invoice),
          currency,
          debe: round2(item.total || 0),
          haber: 0,
          itemId: item.id,
          serviceId: item.service_id,
          quantity: item.quantity,
          unitPrice: item.unit_price,
        });
      }
    } else if (items.length === 0) {
      pushRow(currency, {
        id: `invoice-${invoice.id}`,
        date: invoice.createdAt,
        kind: 'item',
        label: invoice.notes || invoice.invoice_ref || invoice.doc_no || invoice.id,
        docNo: invoice.doc_no || invoice.invoice_doc_no,
        invoiceId: invoice.id,
        status: invoiceRowStatus(invoice),
        currency,
        debe: round2(invoice.total || 0),
        haber: 0,
      });
    }
  }

  // Credit notes are `Invoice` rows with `type: 'credit_note'` — they reduce the
  // balance (haber), so they're pushed separately from regular invoices/items above.
  for (const creditNote of invoices) {
    if ((creditNote.type || 'invoice') !== 'credit_note') continue;
    const items = invoiceItemsByInvoice[creditNote.id] || [];
    const currency = creditNote.currency || 'USD';

    if (items.length > 0) {
      for (const item of items) {
        pushRow(currency, {
          id: `credit-note-item-${item.id}`,
          date: creditNote.createdAt,
          kind: 'item',
          label: item.service_name,
          docNo: creditNote.doc_no || creditNote.invoice_doc_no,
          invoiceId: creditNote.id,
          status: 'notaCredito',
          currency,
          debe: 0,
          haber: round2(item.total || 0),
          itemId: item.id,
          serviceId: item.service_id,
          quantity: item.quantity,
          unitPrice: item.unit_price,
        });
      }
    } else {
      pushRow(currency, {
        id: `credit-note-${creditNote.id}`,
        date: creditNote.createdAt,
        kind: 'item',
        label: creditNote.notes || creditNote.invoice_ref || creditNote.doc_no || creditNote.id,
        docNo: creditNote.doc_no || creditNote.invoice_doc_no,
        invoiceId: creditNote.id,
        status: 'notaCredito',
        currency,
        debe: 0,
        haber: round2(creditNote.total || 0),
      });
    }
  }

  for (const payment of payments) {
    const currency = payment.currency || payment.source_currency || 'USD';
    pushRow(currency, {
      id: `payment-${payment.id}`,
      date: payment.payment_date || payment.createdAt,
      kind: 'payment',
      label: payment.payment_method || payment.method || 'Pago',
      docNo: payment.doc_no || payment.payment_doc_no,
      invoiceId: payment.invoice_id || undefined,
      paymentId: payment.id,
      transactionType: payment.transaction_type,
      currency,
      debe: 0,
      haber: round2(Math.abs(payment.amount_applied ?? payment.amount ?? 0)),
    });
  }

  const result: Record<string, LedgerRow[]> = {};
  for (const [currency, rows] of Object.entries(rowsByCurrency)) {
    const sorted = [...rows].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let balance = 0;
    result[currency] = sorted.map((row) => {
      // A quoted-but-not-yet-invoiced item isn't a debt yet — its amount shows in
      // the row for reference, but only invoices, payments and credit notes move
      // the running balance.
      if (row.status !== 'presupuestado') {
        balance = round2(balance + row.debe - row.haber);
      }
      return { ...row, runningBalance: balance };
    });
  }
  return result;
}
