import { API_ROUTES } from '@/constants/routes';
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
