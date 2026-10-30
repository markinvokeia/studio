/**
 * Payment method mapper utility
 * Handles payment method codes from backend
 */

export const PAYMENT_METHOD_CODES = {
  CASH: 'CASH',
  BANK_TRANSFER: 'BANK_TRANSFER',
  CREDIT_CARD: 'CREDIT_CARD',
  DEBIT_CARD: 'DEBIT_CARD',
  MOBILE_PAYMENT: 'MOBILE_PAYMENT',
  MERCADO_PAGO: 'MERCADO_PAGO',
  PE: 'PE',
  CA: 'CA'
} as const;

export type PaymentMethodCode = typeof PAYMENT_METHOD_CODES[keyof typeof PAYMENT_METHOD_CODES];

/**
 * Normalizes a payment method code from backend (trim + uppercase).
 *
 * Clinics can create their own payment methods, so unknown codes are kept as-is
 * instead of being coerced to CASH — that coercion made every custom method count
 * as cash in the cash session, regardless of its `is_cash_equivalent` flag.
 */
export function normalizePaymentMethodCode(code: string | null | undefined): string {
  return (code ?? '').trim().toUpperCase();
}

export function isKnownPaymentMethodCode(code: string | null | undefined): code is PaymentMethodCode {
  return Object.values(PAYMENT_METHOD_CODES).includes(normalizePaymentMethodCode(code) as PaymentMethodCode);
}

/**
 * Whether a payment method counts as physical cash in the cash session.
 * The method's `is_cash_equivalent` flag is the source of truth; the CASH code is
 * only used as a fallback when the backend response doesn't include the flag.
 */
export function isCashEquivalentMethod(code: string | null | undefined, isCashEquivalent?: boolean | null): boolean {
  if (typeof isCashEquivalent === 'boolean') return isCashEquivalent;
  return normalizePaymentMethodCode(code) === PAYMENT_METHOD_CODES.CASH;
}

/**
 * Display label for a payment method: translated for the built-in codes, the
 * method's own name (as configured by the clinic) for custom ones.
 */
export function getPaymentMethodLabel(
  code: string | null | undefined,
  name: string | null | undefined,
  translate: (key: PaymentMethodCode) => string,
): string {
  const normalized = normalizePaymentMethodCode(code);
  if (isKnownPaymentMethodCode(normalized)) return translate(normalized);
  return name || normalized || '-';
}
