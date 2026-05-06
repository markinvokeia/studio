import { API_ROUTES } from '@/constants/routes';
import { QuoteItem, Quote, Service } from '@/lib/types';
import { api } from './api';

async function getWorkflowStepsByServiceId(serviceId: string): Promise<Service['treatment_steps']> {
    if (!serviceId) return [];

    try {
        const response = await api.get(API_ROUTES.SERVICES_STEPS, { service_id: serviceId });
        const rawSteps: any[] = Array.isArray(response)
            ? response
            : Array.isArray(response?.[0]?.items)
                ? response[0].items
                : Array.isArray(response?.items)
                    ? response.items
                    : [];

        return rawSteps
            .map((step: any) => ({
                position: Number(step.position ?? 0),
                name: step.step_name || step.name || '',
                offset_days_from_prev: Number(step.offset_days_from_prev ?? step.offset_min_days ?? 0),
                duration_minutes: Number(step.duration_minutes ?? 60),
                notes: step.notes || '',
            }))
            .filter(step => step.position > 0 && step.name);
    } catch (error) {
        console.error(`Failed to fetch workflow steps for service ${serviceId}:`, error);
        return [];
    }
}

/**
 * Get services from a quote's items directly.
 * Fetches the quote items (which already contain service info) and maps them to Service objects.
 * This works regardless of whether the quote has a confirmed order or not.
 *
 * @param quoteId - The ID of the quote
 * @returns Array of Service objects derived from the quote items
 */
export async function getServicesByQuoteId(quoteId: string): Promise<Service[]> {
    if (!quoteId) return [];

    try {
        const data = await api.get(API_ROUTES.SALES.QUOTES_ITEMS, {
            quote_id: quoteId,
            is_sales: 'true',
        });

        const itemsRaw: any[] = Array.isArray(data)
            ? data
            : (data.items || data.data || []);

        const uniqueServiceIds = [...new Set(
            itemsRaw
                .filter((item: any) => item && item.service_id != null)
                .map((item: any) => String(item.service_id))
        )];

        const workflowStepsEntries = await Promise.all(
            uniqueServiceIds.map(async serviceId => [serviceId, await getWorkflowStepsByServiceId(serviceId)] as const)
        );
        const workflowStepsByServiceId = new Map<string, Service['treatment_steps']>(workflowStepsEntries);

        const services: Service[] = itemsRaw
            .filter((item: any) => item && item.service_id != null)
            .map((item: any): Service => {
                const serviceId = String(item.service_id);
                const treatmentSteps = workflowStepsByServiceId.get(serviceId) || [];

                return {
                    id: serviceId,
                    name: item.service_name || '',
                    category: 'general',
                    duration_minutes: Number(item.duration_minutes || 30),
                    price: parseFloat(item.unit_price) || 0,
                    is_active: true,
                    service_type: treatmentSteps.length > 0 ? 'workflow' : 'single',
                    treatment_steps: treatmentSteps,
                };
            });

        return services;
    } catch (error) {
        console.error('Failed to fetch services by quote ID:', error);
        throw error;
    }
}

/**
 * Get quote items by quote ID.
 * Fetches the items associated with a specific quote.
 *
 * @param quoteId - The ID of the quote
 * @returns Array of QuoteItem objects
 */
export async function getQuoteItems(quoteId: string): Promise<QuoteItem[]> {
    if (!quoteId) return [];

    try {
        const data = await api.get(API_ROUTES.SALES.QUOTES_ITEMS, {
            quote_id: quoteId,
            is_sales: 'true',
        });

        const items: QuoteItem[] = Array.isArray(data)
            ? data
            : (data.items || data.data || []);

        return items;
    } catch (error) {
        console.error('Failed to fetch quote items:', error);
        throw error;
    }
}

// Confirmar presupuesto
export async function confirmQuote(quoteId: string): Promise<Quote> {
    return api.post(API_ROUTES.SALES.QUOTE_CONFIRM_URL(quoteId), {}) as Promise<Quote>;
}

// Rechazar presupuesto
export async function rejectQuote(quoteId: string): Promise<Quote> {
    return api.post(API_ROUTES.SALES.QUOTE_REJECT_URL(quoteId), {}) as Promise<Quote>;
}

// Enviar presupuesto por email
export async function sendQuoteEmail(quoteId: string): Promise<void> {
    return api.post(API_ROUTES.SALES.QUOTE_SEND_URL(quoteId), {}) as Promise<void>;
}

// Obtener URL de impresión
export function getQuotePrintUrl(quoteId: string): string {
    return API_ROUTES.SALES.QUOTE_PRINT_URL(quoteId);
}
