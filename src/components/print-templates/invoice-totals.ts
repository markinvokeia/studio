import type { Invoice, Payment } from '@/lib/types';

export interface InvoiceTotals {
  total: number;
  paid: number;
  pending: number;
  /** Payment status derived from the actual payments, kept consistent with the amounts shown. */
  paymentStatus: string;
}

/**
 * Computes the totals shown on an invoice print document.
 *
 * The `paid_amount` carried on the invoice row can be stale right after a quick
 * payment (it still reads 0 while a payment already exists). The payments array,
 * however, is fetched fresh at print time, so we treat it as the source of truth:
 * we sum `amount_applied` (always denominated in the invoice currency) and only
 * fall back to `invoice.paid_amount` when no payments came back. The payment
 * status is then derived from total vs paid so the badge, the totals, and the
 * payments table never contradict each other.
 */
export function computeInvoiceTotals(
  invoice: Pick<Invoice, 'total' | 'paid_amount' | 'payment_status'>,
  payments: Array<Pick<Payment, 'amount_applied' | 'amount'>>,
): InvoiceTotals {
  const total = Number(invoice.total || 0);

  const paidFromPayments = payments.reduce(
    (sum, p) => sum + Math.abs(Number(p.amount_applied ?? p.amount ?? 0)),
    0,
  );
  const paid = paidFromPayments > 0 ? paidFromPayments : Number(invoice.paid_amount || 0);
  const pending = Math.max(total - paid, 0);

  const paymentStatus =
    total > 0 && paid >= total
      ? 'paid'
      : paid > 0
        ? 'partial'
        : (invoice.payment_status || 'unpaid');

  return { total, paid, pending, paymentStatus };
}
