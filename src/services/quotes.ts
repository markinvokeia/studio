import { API_ROUTES } from '@/constants/routes';
import { Order, OrderItem, Service } from '@/lib/types';
import { api } from './api';

/**
 * Get order services by quote ID
 * Fetches the order associated with a quote and returns the pending order items mapped to Service objects
 * 
 * @param quoteId - The ID of the quote to get order services for
 * @returns Array of Service objects from pending order items
 */
export async function getOrderServicesByQuoteId(quoteId: string): Promise<Service[]> {
    if (!quoteId) return [];

    try {
        // Step 1: Get the order associated with the quote
        const orderData = await api.get(API_ROUTES.SALES.QUOTES_ORDERS, { quote_id: quoteId });
        const ordersRaw = Array.isArray(orderData) 
            ? orderData 
            : (orderData.orders || orderData.data || orderData.result || []);
        
        // Filter to find the first order with valid id (quotes have only one order)
        const orders: Order[] = ordersRaw
            .filter((o: any) => o && o.id != null)
            .map((o: any) => ({
                id: String(o.id),
                doc_no: o.doc_no,
                user_id: o.user_id,
                quote_id: o.quote_id,
                quote_doc_no: o.quote_doc_no,
                user_name: o.user_name,
                currency: o.currency,
                status: o.status,
                is_invoiced: o.is_invoiced,
                notes: o.notes,
                createdAt: o.created_at || o.createdAt,
                updatedAt: o.updated_at || o.updatedAt,
            }));

        if (orders.length === 0) {
            return [];
        }

        const order = orders[0];

        // Step 2: Get the order items
        const itemsData = await api.get(API_ROUTES.SALES.ORDER_ITEMS, { order_id: order.id });
        const itemsRaw = Array.isArray(itemsData) 
            ? itemsData 
            : (itemsData.order_items || itemsData.data || itemsData.result || []);

        // Step 3: Filter items by pending status (not completed or cancelled)
        const pendingItems: OrderItem[] = itemsRaw
            .filter((item: any) => {
                if (!item || !item.status) return false;
                const status = item.status.toLowerCase();
                return status !== 'completed' && status !== 'cancelled';
            })
            .map((item: any): OrderItem => ({
                id: item.order_item_id ? String(item.order_item_id) : String(item.id),
                service_id: item.service_id || item.serviceId || '',
                service_name: item.service_name || '',
                quantity: item.quantity || 1,
                unit_price: item.unit_price || 0,
                total: item.total || 0,
                tooth_number: item.tooth_number ? Number(item.tooth_number) : undefined,
                status: item.status || 'scheduled',
                scheduled_date: item.scheduled_date,
                completed_date: item.completed_date,
                invoiced_date: item.invoiced_date,
            }));

        // Step 4: Map OrderItem to Service
        // Note: OrderItem doesn't have category or duration_minutes, so we use defaults
        // Use item.service_id to reference the actual service from the catalog
        const services: Service[] = pendingItems.map(item => ({
            id: item.service_id,
            name: item.service_name,
            category: 'general',
            duration_minutes: 30,
            price: item.unit_price,
            is_active: true,
        }));

        return services;
    } catch (error) {
        console.error('Failed to fetch order services by quote ID:', error);
        throw error;
    }
}
