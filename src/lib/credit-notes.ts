import { API_ROUTES } from '@/constants/routes';
import { CreditNote } from '@/lib/types';
import { api } from '@/services/api';

export async function getCreditNotesForInvoice(
    invoiceId: string,
    userId: string,
    isSales: boolean
): Promise<CreditNote[]> {
    if (!invoiceId || !userId) return [];

    const route = isSales ? API_ROUTES.SALES.INVOICES_ALL : API_ROUTES.PURCHASES.INVOICES_ALL;

    try {
        const data = await api.get(route, {
            user_id: userId,
            type: 'credit_note',
            is_sales: isSales ? 'true' : 'false'
        });

        const invoicesData = Array.isArray(data) ? data : (data.invoices || data.data || []);

        return invoicesData
            .filter((apiInvoice: any) =>
                String(apiInvoice.parent_id) === String(invoiceId) ||
                String(apiInvoice.invoice_id) === String(invoiceId)
            )
            .map((apiInvoice: any) => ({
                id: apiInvoice.id ? String(apiInvoice.id) : 'N/A',
                doc_no: apiInvoice.doc_no || 'N/A',
                invoice_ref: apiInvoice.invoice_ref || 'N/A',
                order_id: apiInvoice.order_id,
                order_doc_no: apiInvoice.order_doc_no || 'N/A',
                quote_id: apiInvoice.quote_id,
                quote_doc_no: apiInvoice.quote_doc_no || 'N/A',
                user_name: apiInvoice.user_name || 'N/A',
                userEmail: apiInvoice.user_email || '',
                user_id: apiInvoice.user_id,
                total: parseFloat(apiInvoice.total) || 0,
                status: apiInvoice.status || 'draft',
                payment_status: apiInvoice.payment_state || apiInvoice.paymentState || 'unpaid',
                paid_amount: apiInvoice.paid_amount || 0,
                type: apiInvoice.type || 'credit_note',
                invoice_id: apiInvoice.invoice_id || apiInvoice.parent_id || null,
                parent_id: apiInvoice.parent_id,
                createdAt: apiInvoice.created_at || new Date().toISOString().split('T')[0],
                updatedAt: apiInvoice.updatedAt || new Date().toISOString().split('T')[0],
                currency: apiInvoice.currency || 'USD',
            }));
    } catch (error) {
        console.error("Failed to fetch credit notes for invoice:", error);
        return [];
    }
}
