import { API_ROUTES } from '@/constants/routes';
import { Payment } from '@/lib/types';
import api from '@/services/api';

export type { Payment };

export interface PaymentListResponse {
  payments: Payment[];
  totalPages: number;
}

export interface PaymentSearchParams {
  page?: number;
  limit?: number;
  search?: string;
}

export function normalizePaymentMethod(method: string | undefined): string {
  if (!method) return 'N/A';

  const lowerMethod = method.toLowerCase().trim();

  // Cash/Efectivo mappings
  if (lowerMethod.includes('efectivo') || lowerMethod.includes('cash')) {
    return 'efectivo'; // Translation key
  }

  // Debit Card mappings
  if (lowerMethod.includes('debit') || lowerMethod.includes('débito')) {
    return 'tarjeta_de_debito'; // Translation key
  }

  // Credit Card mappings
  if (lowerMethod.includes('credit') && !lowerMethod.includes('debit')) {
    return 'tarjeta_de_credito'; // Translation key
  }

  // Transfer/Bank Transfer mappings
  if (lowerMethod.includes('transfer') || lowerMethod.includes('banco')) {
    return 'transferencia_bancaria'; // Translation key
  }

  // Mercado Pago
  if (lowerMethod.includes('mercado pago')) {
    return 'mercado_pago'; // Translation key
  }

  // Mobile Payment
  if (lowerMethod.includes('mobile')) {
    return 'pago_movil'; // Translation key
  }

  // Return original if no mapping found
  return method;
}

function mapApiPaymentToPayment(apiPayment: any): Payment {
  let paymentType: 'invoice' | 'credit_note' | null = null;
  if (apiPayment.invoice_id) {
    paymentType = 'invoice';
  }

  return {
    id: String(apiPayment.id),
    doc_no: apiPayment.doc_no,
    order_id: apiPayment.order_id,
    order_doc_no: apiPayment.order_doc_no,
    invoice_doc_no: apiPayment.invoice_doc_no,
    invoice_id: apiPayment.invoice_id,
    quote_id: apiPayment.quote_id,
    user_name: apiPayment.user_name,
    userEmail: apiPayment.user_email,
    amount: parseFloat(apiPayment.amount),
    method: normalizePaymentMethod(apiPayment.method),
    status: apiPayment.status,
    createdAt: apiPayment.created_at,
    updatedAt: apiPayment.created_at,
    currency: apiPayment.currency,
    payment_date: apiPayment.created_at,
    amount_applied: parseFloat(apiPayment.converted_amount),
    source_amount: parseFloat(apiPayment.amount),
    source_currency: apiPayment.currency,
    exchange_rate: parseFloat(apiPayment.exchange_rate),
    payment_method: apiPayment.method,
    transaction_type: apiPayment.transaction_type,
    transaction_id: apiPayment.transaction_id,
    reference_doc_id: apiPayment.reference_doc_id,
    type: paymentType,
  };
}

export async function getSalesPayments(params: PaymentSearchParams = {}): Promise<PaymentListResponse> {
  try {
    const { page = 1, limit = 10, search = '' } = params;

    const requestParams = {
      is_sales: 'true',
      page: page.toString(),
      limit: limit.toString(),
      ...(search && { search })
    };

    const data = await api.get(API_ROUTES.SALES.PAYMENTS_ALL, requestParams);

    const paginationData = Array.isArray(data) && data.length > 0 ? data[0] : data;
    const paymentsData = paginationData.data || [];
    const totalPages = paginationData.pages || Math.ceil((paginationData.total || paymentsData.length) / limit);

    return {
      payments: paymentsData.map(mapApiPaymentToPayment),
      totalPages
    };
  } catch (error) {
    console.error("Failed to fetch sales payments:", error);
    return { payments: [], totalPages: 0 };
  }
}

export async function getPurchasePayments(params: PaymentSearchParams = {}): Promise<PaymentListResponse> {
  try {
    const { page = 1, limit = 10, search = '' } = params;

    const requestParams = {
      is_sales: 'false',
      page: page.toString(),
      limit: limit.toString(),
      ...(search && { search })
    };

    const data = await api.get(API_ROUTES.PURCHASES.PAYMENTS_ALL, requestParams);

    const paginationData = Array.isArray(data) && data.length > 0 ? data[0] : data;
    const paymentsData = paginationData.data || [];
    const totalPages = paginationData.pages || Math.ceil((paginationData.total || paymentsData.length) / limit);

    return {
      payments: paymentsData.map(mapApiPaymentToPayment),
      totalPages
    };
  } catch (error) {
    console.error("Failed to fetch purchase payments:", error);
    return { payments: [], totalPages: 0 };
  }
}