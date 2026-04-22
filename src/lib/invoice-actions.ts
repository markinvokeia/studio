import { API_ROUTES } from '@/constants/routes';
import { api } from '@/services/api';
import { toLocalISOString } from '@/lib/utils';

export interface InvoiceOrderParams {
    orderId: string;
    userId: string;
    mode: 'sales' | 'purchases';
    invoiceDate?: Date;
    notes?: string;
}

/**
 * Posts to the order/invoice endpoint for sales or purchases.
 * Does NOT show toasts or update UI state — callers handle that.
 * Throws an Error with a message if the backend returns an error response.
 */
export async function invoiceOrder({
    orderId,
    userId,
    mode,
    invoiceDate = new Date(),
    notes = '',
}: InvoiceOrderParams): Promise<unknown> {
    const isSales = mode === 'sales';
    const endpoint = isSales
        ? API_ROUTES.SALES.ORDER_INVOICE
        : API_ROUTES.PURCHASES.ORDER_INVOICE;

    const payload = {
        order_id: orderId,
        is_sales: isSales,
        query: JSON.stringify({
            order_id: parseInt(orderId, 10),
            invoice_date: toLocalISOString(invoiceDate),
            is_sales: isSales,
            user_id: userId,
            notes,
        }),
    };

    const responseData = await api.post(endpoint, payload);

    if (
        responseData?.error ||
        (responseData?.code && responseData.code >= 400)
    ) {
        const message = responseData?.message ?? 'Error creating invoice';
        throw new Error(message);
    }

    return responseData;
}
