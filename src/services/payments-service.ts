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

function hasValidPayments(paymentsData: any[]): boolean {
  if (!Array.isArray(paymentsData) || paymentsData.length === 0) {
    return false;
  }
  
  const firstItem = paymentsData[0];
  
  if (!firstItem || typeof firstItem !== 'object') {
    return false;
  }

  const isNewFormat = firstItem.amount_applied !== undefined && typeof firstItem.amount_applied === 'string';
  const isOldFormat = firstItem.amount !== undefined || firstItem.converted_amount !== undefined;

  return isNewFormat || isOldFormat;
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

  const isNewFormat = apiPayment.amount_applied !== undefined && typeof apiPayment.amount_applied === 'string';

  return {
    id: apiPayment.transaction_id ? String(apiPayment.transaction_id) : 'N/A',
    doc_no: apiPayment.doc_no || (apiPayment.transaction_doc_no ? String(apiPayment.transaction_doc_no) : 'N/A'),
    order_id: apiPayment.order_id || '',
    order_doc_no: apiPayment.order_doc_no || 'N/A',
    invoice_doc_no: apiPayment.invoice_doc_no || 'N/A',
    invoice_id: apiPayment.invoice_id || null,
    quote_id: apiPayment.quote_id || '',
    user_name: apiPayment.user_name || 'N/A',
    userEmail: apiPayment.user_email || '',
    amount: isNewFormat ? parseFloat(apiPayment.amount_applied) : parseFloat(apiPayment.amount),
    method: apiPayment.payment_method_name || normalizePaymentMethod(apiPayment.method),
    status: apiPayment.status || 'completed',
    createdAt: apiPayment.payment_date || apiPayment.created_at,
    updatedAt: apiPayment.payment_date || apiPayment.created_at,
    currency: apiPayment.invoice_currency || apiPayment.source_currency || apiPayment.currency || 'USD',
    payment_date: apiPayment.payment_date || apiPayment.created_at,
    amount_applied: isNewFormat ? parseFloat(apiPayment.amount_applied) : parseFloat(apiPayment.converted_amount || apiPayment.amount_applied),
    source_amount: isNewFormat ? parseFloat(apiPayment.source_amount) : parseFloat(apiPayment.amount),
    source_currency: apiPayment.source_currency || apiPayment.currency || 'USD',
    exchange_rate: isNewFormat ? parseFloat(apiPayment.exchange_rate) : parseFloat(apiPayment.exchange_rate || '1'),
    payment_method: apiPayment.payment_method_name || apiPayment.payment_method || apiPayment.method || 'N/A',
    payment_method_code: apiPayment.payment_method_code,
    transaction_type: apiPayment.transaction_type || 'direct_payment',
    transaction_id: apiPayment.transaction_id ? String(apiPayment.transaction_id) : 'N/A',
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

    if (!hasValidPayments(paymentsData)) {
      return { payments: [], totalPages: 0 };
    }

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

    if (!hasValidPayments(paymentsData)) {
      return { payments: [], totalPages: 0 };
    }

    return {
      payments: paymentsData.map(mapApiPaymentToPayment),
      totalPages
    };
  } catch (error) {
    console.error("Failed to fetch purchase payments:", error);
    return { payments: [], totalPages: 0 };
  }
}