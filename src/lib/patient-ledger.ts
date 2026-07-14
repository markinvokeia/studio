import type { Invoice, InvoiceItem, Payment, Quote, QuoteItem } from '@/lib/types';

export type LedgerRowStatus = 'presupuestado' | 'facturado' | 'parcial' | 'pagado' | 'notaCredito';

export type LedgerRow = {
  id: string;
  date: string;
  /** 'balance' is a synthetic summary row (see `splitLedgerByRange`) — not a real
   *  quote/invoice/payment, never clickable, carries no id back to any document. */
  kind: 'item' | 'payment' | 'balance';
  label: string;
  docNo?: string;
  /** The originating quote's doc number, present on quote-backed invoice rows so the
   *  ledger can show "Presupuesto: <quoteDocNo> | Factura: <docNo>". */
  quoteDocNo?: string;
  /** The document's free-text notes (quote/invoice/payment) — shown under the doc line. */
  notes?: string;
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
  /** The parent Quote's doctor_id — carried through so billing a presupuesto (Presupuesto →
   *  En curso) can propagate it onto the resulting Invoice instead of leaving it unset. */
  doctorId?: string;
  /** Denormalized doctor name matching `doctorId`, for display/prefill without an extra
   *  lookup (e.g. the inline editor's DoctorSelector). */
  doctorName?: string;
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
          // The quote's date, not the invoice's — billing a presupuesto shouldn't move
          // its row down the timeline to "now"; it stays where it was originally quoted.
          date: quote.createdAt,
          kind: 'item',
          label: item.service_name || quoteItem.service_name,
          docNo: invoice.doc_no || invoice.invoice_doc_no,
          quoteDocNo: quote.doc_no,
          notes: quote.notes || invoice.notes || undefined,
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
          doctorId: invoice.doctor_id || quote.doctor_id || undefined,
          doctorName: invoice.doctor_name || quote.doctor_name || undefined,
        });
      } else {
        const currency = quote.currency || 'USD';
        pushRow(currency, {
          id: `quote-item-${quoteItem.id}`,
          date: quote.createdAt,
          kind: 'item',
          label: quoteItem.service_name,
          docNo: quote.doc_no,
          notes: quote.notes || undefined,
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
          doctorId: quote.doctor_id || undefined,
          doctorName: quote.doctor_name || undefined,
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
          // A `quote_doc_no` means this invoice was billed from a presupuesto even when
          // its line didn't resolve via `quote_item_id` above — show it as quote-backed.
          quoteDocNo: invoice.quote_doc_no || undefined,
          notes: invoice.notes || undefined,
          invoiceId: invoice.id,
          status: invoiceRowStatus(invoice),
          currency,
          debe: round2(item.total || 0),
          haber: 0,
          itemId: item.id,
          serviceId: item.service_id,
          quantity: item.quantity,
          unitPrice: item.unit_price,
          doctorId: invoice.doctor_id || undefined,
          doctorName: invoice.doctor_name || undefined,
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
          notes: creditNote.notes || undefined,
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
    // Allocations (spending existing credit/prepaid balance or a credit note against an
    // invoice) are bookkeeping entries for money the ledger already counted once — as the
    // original direct payment/credit note row. Showing them too would both double the
    // running balance and read as a second, separate payment (see e.g. a "Finalizado"
    // credit allocation showing up right after the prepayment that funded it).
    if ((payment.transaction_type || 'direct_payment') !== 'direct_payment') continue;
    const currency = payment.currency || payment.source_currency || 'USD';
    pushRow(currency, {
      id: `payment-${payment.id}`,
      date: payment.payment_date || payment.createdAt,
      kind: 'payment',
      label: payment.payment_method || payment.method || 'Pago',
      docNo: payment.doc_no || payment.payment_doc_no,
      notes: payment.notes || undefined,
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
    // Ascending by created_at (quote/invoice `createdAt`, payment `payment_date` — both
    // ultimately fall back to the record's `created_at`) so the running balance below
    // reads chronologically and the last row is always the patient's final balance.
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

/**
 * Splits a currency's full (already-sorted, already-cumulative) ledger rows into a
 * `[from, to]` window, prefixing a synthetic "Saldo anterior" row when there's history
 * before `from` — its `runningBalance` is just the last pre-range row's balance, since
 * `rows` already carries the account's true cumulative balance from the very start.
 * `to` is treated as inclusive through the end of that calendar day.
 */
export function splitLedgerByRange(rows: LedgerRow[], range: { from: Date; to: Date }): LedgerRow[] {
  // Normalized to the full calendar day, not the literal Date objects — presets like
  // "Hoy" hand back `new Date()` (the current time-of-day, not midnight), which would
  // otherwise push every row from earlier today into "before the range".
  const fromTime = new Date(range.from.getFullYear(), range.from.getMonth(), range.from.getDate(), 0, 0, 0, 0).getTime();
  const toTime = new Date(range.to.getFullYear(), range.to.getMonth(), range.to.getDate(), 23, 59, 59, 999).getTime();

  const before: LedgerRow[] = [];
  const inRange: LedgerRow[] = [];
  for (const row of rows) {
    const t = new Date(row.date).getTime();
    if (t < fromTime) before.push(row);
    else if (t <= toTime) inRange.push(row);
  }

  if (before.length === 0) return inRange;

  const openingBalance = before[before.length - 1].runningBalance;
  const openingRow: LedgerRow = {
    id: `opening-balance-${range.from.toISOString()}`,
    date: range.from.toISOString(),
    kind: 'balance',
    // Renderers special-case `kind === 'balance'` and show a translated label instead
    // of this — kept only as a non-empty fallback for anything that reads it directly.
    label: 'Saldo anterior',
    currency: rows[0]?.currency || 'USD',
    debe: openingBalance > 0 ? openingBalance : 0,
    haber: openingBalance < 0 ? -openingBalance : 0,
    runningBalance: openingBalance,
  };
  return [openingRow, ...inRange];
}
