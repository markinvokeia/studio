import { API_ROUTES } from '@/constants/routes';
import { normalizeApiResponse } from '@/lib/api-utils';
import type { Invoice } from '@/lib/types';
import { api } from './api';

export interface PendingPatientInvoice {
    id: string;
    docNo: string;
    dueDate: string; // yyyy-MM-dd
    amount: number;
    currency: string;
}

/**
 * Fetches a patient's unpaid invoices that have a due date set, sorted by due date ascending.
 * Used to let staff pick which specific invoice a WhatsApp "invoice due" reminder should reference
 * (see whatsapp-template-send-dialog.tsx — the send flow now always requires a specific invoice id,
 * it no longer resolves "nearest due invoice" implicitly server-side).
 */
export async function fetchPatientDueInvoices(userId: string): Promise<PendingPatientInvoice[]> {
    if (!userId) return [];
    try {
        const data = await api.get(API_ROUTES.USER_INVOICES, { user_id: userId });
        const rows: any[] = Array.isArray(data) ? data : (data?.invoices || data?.data || []);
        return rows
            .filter((row) => (row.type || 'invoice') === 'invoice' && (row.payment_state || row.payment_status) !== 'paid' && row.due_date)
            .map((row) => ({
                id: String(row.id),
                docNo: row.doc_no || '',
                dueDate: String(row.due_date).slice(0, 10),
                amount: Number(row.total || 0) - Number(row.paid_amount || 0),
                currency: row.currency || 'UYU',
            }))
            .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    } catch (error) {
        console.error('Failed to fetch patient due invoices:', error);
        return [];
    }
}

// Confirmar factura
export async function confirmInvoice(invoiceId: string): Promise<Invoice> {
    return api.post(API_ROUTES.SALES.INVOICES_CONFIRM, { id: parseInt(invoiceId, 10) }) as Promise<Invoice>;
}

// Enviar factura por email
export async function sendInvoiceEmail(invoiceId: string): Promise<void> {
    return api.post(API_ROUTES.SALES.INVOICE_SEND(invoiceId), {}) as Promise<void>;
}

export interface GetInvoicesParams {
    /** true = sales (clínica/pacientes), false = purchase (proveedores) */
    isSales: boolean;
    /** Usuario (paciente/proveedor) dueño de las facturas */
    userId: string;
    search?: string;
    /** 1-based */
    page?: number;
    limit?: number;
    type?: string;
    status?: string;
}

export interface InvoicesPage {
    items: Invoice[];
    total: number;
}

/**
 * Obtiene facturas paginadas de un usuario desde la API.
 * Usado para seleccionar la "factura padre" al crear una nota de crédito.
 */
export async function getBookedInvoices(params: GetInvoicesParams): Promise<InvoicesPage> {
    const {
        isSales,
        userId,
        search,
        page = 1,
        limit = 10,
        type = 'invoice',
        status = 'booked',
    } = params;

    try {
        const queryParams: Record<string, string> = {
            is_sales: isSales ? 'true' : 'false',
            user_id: String(userId),
            type,
            status,
            page: String(page),
            limit: String(limit),
        };

        if (search && search.trim()) {
            queryParams.search = search.trim();
        }

        const route = isSales ? API_ROUTES.SALES.INVOICES_ALL : API_ROUTES.PURCHASES.INVOICES_ALL;
        const data = await api.get(route, queryParams);

        const normalized = normalizeApiResponse<any>(data);

        const items: Invoice[] = (normalized.items || []).map((apiInvoice: any) => ({
            ...apiInvoice,
            id: apiInvoice.id ? String(apiInvoice.id) : '',
            doc_no: apiInvoice.doc_no || 'N/A',
            user_id: apiInvoice.user_id != null ? String(apiInvoice.user_id) : '',
            user_name: apiInvoice.user_name || 'N/A',
            total: Number(apiInvoice.total) || 0,
            currency: apiInvoice.currency || 'UYU',
        }));

        return { items, total: normalized.total || items.length };
    } catch (error) {
        console.error('Failed to fetch invoices:', error);
        return { items: [], total: 0 };
    }
}
