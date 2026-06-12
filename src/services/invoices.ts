import { API_ROUTES } from '@/constants/routes';
import { normalizeApiResponse } from '@/lib/api-utils';
import type { Invoice } from '@/lib/types';
import { api } from './api';

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
