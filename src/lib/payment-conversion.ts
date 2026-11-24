import { convertAmount } from '@/lib/currency';

/**
 * Reparto de un pago entre facturas cuando puede haber conversión de moneda.
 *
 * El pago conserva su monto y su moneda (es lo que entró a la caja). Lo convertido
 * vive en cada aplicación: `amount` es lo que consume del pago, en la moneda del pago,
 * y `target_amount` es lo que descuenta de la factura, en la moneda de la factura.
 *
 * Regla de negocio: un pago con conversión debe quedar aplicado por completo, sin
 * sobrante. Un sobrante dejaría al paciente con saldo en otra moneda sin que nadie lo
 * haya decidido. Los pagos sin conversión siguen admitiendo saldo a favor.
 */

const EPSILON = 0.005;

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** El par de monedas de la clínica y su tasa: unidades de `primary` por unidad de `secondary`. */
export interface CurrencyPair {
  primary: string;
  secondary?: string;
  rate: number;
}

export interface AllocatableInvoice {
  id: string;
  /** Saldo pendiente, en la moneda de la factura. */
  pending: number;
  currency: string;
  date: string;
}

export interface PaymentAllocationPayload {
  invoice_id: number;
  /** Lo que consume del pago, en la moneda del pago. */
  amount: number;
  /** Lo que descuenta de la factura, en la moneda de la factura. */
  target_amount: number;
  exchange_rate: number;
}

/**
 * Solo se convierte dentro del par de la clínica: la tasa de la sesión de caja es la de
 * ese par, así que aplicarla a una tercera moneda inventaría un importe.
 */
export function canConvertBetween(from: string, to: string, pair: Pick<CurrencyPair, 'primary' | 'secondary'>): boolean {
  if (!pair.secondary || from === to) return false;
  const inPair = (code: string) => code === pair.primary || code === pair.secondary;
  return inPair(from) && inPair(to);
}

/** Facturas a las que se puede aplicar el pago: primero las de su moneda, luego las convertibles; las más antiguas primero. */
export function sortAllocatableInvoices<T extends AllocatableInvoice>(
  invoices: T[],
  paymentCurrency: string,
  pair: Pick<CurrencyPair, 'primary' | 'secondary'>,
): T[] {
  return invoices
    .filter((inv) => inv.currency === paymentCurrency || canConvertBetween(paymentCurrency, inv.currency, pair))
    .sort((a, b) => {
      const aCross = a.currency === paymentCurrency ? 0 : 1;
      const bCross = b.currency === paymentCurrency ? 0 : 1;
      if (aCross !== bCross) return aCross - bCross;
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
}

/** El pendiente de la factura expresado en la moneda del pago. Sin tasa válida, una factura de otra moneda vale 0. */
export function pendingInPaymentCurrency(invoice: AllocatableInvoice, paymentCurrency: string, pair: CurrencyPair): number {
  if (invoice.currency === paymentCurrency) return round2(invoice.pending);
  if (!(pair.rate > 0)) return 0;
  return round2(convertAmount(invoice.pending, invoice.currency, paymentCurrency, pair.rate, pair.primary));
}

/**
 * Lo que descuenta de la factura una aplicación de `amount` (moneda del pago). Si cubre el
 * pendiente devuelve el pendiente exacto: redondear el importe convertido podría dejar la
 * factura debiendo un centavo.
 */
export function targetAmountFor(amount: number, invoice: AllocatableInvoice, paymentCurrency: string, pair: CurrencyPair): number {
  if (invoice.currency === paymentCurrency) return round2(amount);
  if (amount >= pendingInPaymentCurrency(invoice, paymentCurrency, pair) - EPSILON) return round2(invoice.pending);
  return round2(convertAmount(amount, paymentCurrency, invoice.currency, pair.rate, pair.primary));
}

/** Reparte `amount` entre las facturas en el orden recibido. Devuelve, por factura, lo que consume en la moneda del pago. */
export function distributeFifo(
  amount: number,
  invoices: AllocatableInvoice[],
  paymentCurrency: string,
  pair: CurrencyPair,
): Record<string, number> {
  let remaining = round2(amount);
  const result: Record<string, number> = {};
  for (const invoice of invoices) {
    if (remaining <= EPSILON) break;
    const take = round2(Math.min(pendingInPaymentCurrency(invoice, paymentCurrency, pair), remaining));
    if (take > EPSILON) {
      result[invoice.id] = take;
      remaining = round2(remaining - take);
    }
  }
  return result;
}

/** Arma el `invoice_allocations` del pago a partir del reparto por factura. */
export function buildAllocationsPayload(
  allocation: Record<string, number>,
  invoices: AllocatableInvoice[],
  paymentCurrency: string,
  pair: CurrencyPair,
): PaymentAllocationPayload[] {
  const payload: PaymentAllocationPayload[] = [];
  for (const invoice of invoices) {
    const amount = allocation[invoice.id];
    if (!(amount > EPSILON)) continue;
    const isCross = invoice.currency !== paymentCurrency;
    payload.push({
      invoice_id: Number(invoice.id),
      amount: round2(amount),
      target_amount: targetAmountFor(amount, invoice, paymentCurrency, pair),
      exchange_rate: isCross ? pair.rate : 1,
    });
  }
  return payload;
}

/** Máximo que admite un pago: la suma de lo pendiente en facturas a las que se puede aplicar. */
export function maxPayableAmount(invoices: AllocatableInvoice[], paymentCurrency: string, pair: CurrencyPair): number {
  return round2(invoices.reduce((sum, invoice) => sum + pendingInPaymentCurrency(invoice, paymentCurrency, pair), 0));
}

/** ¿Este reparto toca alguna factura de otra moneda? */
export function allocationHasConversion(
  allocation: Record<string, number>,
  invoices: AllocatableInvoice[],
  paymentCurrency: string,
): boolean {
  return invoices.some((invoice) => invoice.currency !== paymentCurrency && (allocation[invoice.id] ?? 0) > EPSILON);
}
