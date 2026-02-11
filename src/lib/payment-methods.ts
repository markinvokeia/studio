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
  PE: 'PE'
} as const;

export type PaymentMethodCode = typeof PAYMENT_METHOD_CODES[keyof typeof PAYMENT_METHOD_CODES];

/**
 * Validates and normalizes payment method code from backend
 */
export function normalizePaymentMethodCode(code: string | undefined): PaymentMethodCode {
  if (!code) return 'CASH'; // default fallback

  const normalized = code.toUpperCase();

  // Check if it's a valid payment method code
  if (Object.values(PAYMENT_METHOD_CODES).includes(normalized as PaymentMethodCode)) {
    return normalized as PaymentMethodCode;
  }

  // Default fallback
  return 'CASH';
}
