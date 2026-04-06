import { API_ROUTES } from '@/constants/routes';
import { normalizeApiResponse } from '@/lib/api-utils';
import { Service, UserServicesEntry } from '@/lib/types';
import { api } from './api';

export interface ServicesResponse {
    items: Service[];
    total: number;
    total_pages: number;
}

export interface GetServicesParams {
    is_sales?: boolean;
    search?: string;
    page?: number;
    limit?: number;
}

/**
 * Obtiene servicios desde la API
 * @param params - Parámetros de filtrado y paginación
 * @returns Lista de servicios con metadatos de paginación
 */
export async function getServices(params: GetServicesParams = {}): Promise<ServicesResponse> {
    try {
        const queryParams: Record<string, string> = {};

        if (params.is_sales !== undefined) {
            queryParams.is_sales = String(params.is_sales);
        }

        if (params.search) {
            queryParams.search = params.search;
        }

        if (params.page) {
            queryParams.page = String(params.page);
        }

        if (params.limit) {
            queryParams.limit = String(params.limit);
        }

        const data = await api.get(API_ROUTES.SERVICES, queryParams);

        // El endpoint retorna un array con la estructura [response]
        // normalizeApiResponse ahora maneja correctamente este formato
        const normalized = normalizeApiResponse(data);

        // normalizeApiResponse devuelve: { items: [...], total: X }
        const items = (normalized.items || []) as Service[];
        const total = normalized.total || 0;
        const total_pages = Math.ceil(total / (params.limit || 50)) || 1;

        // Mapear los servicios para asegurar que id sea string
        const mappedServices = items.map((service: any) => ({
            ...service,
            id: String(service.id),
            currency: service.currency || 'USD',
            category_id: service.category_id ? String(service.category_id) : undefined,
            category_name: service.category_name || service.category || '',
        }));

        return {
            items: mappedServices,
            total,
            total_pages,
        };
    } catch (error) {
        console.error('Failed to fetch services:', error);
        return { items: [], total: 0, total_pages: 1 };
    }
}

/**
 * Obtiene servicios de venta (clínica)
 */
export async function getSalesServices(params: Omit<GetServicesParams, 'is_sales'> = {}): Promise<ServicesResponse> {
    return getServices({ ...params, is_sales: true });
}

/**
 * Obtiene servicios de compra (proveedores)
 */
export async function getPurchaseServices(params: Omit<GetServicesParams, 'is_sales'> = {}): Promise<ServicesResponse> {
    return getServices({ ...params, is_sales: false });
}

/**
 * Obtiene servicios asignados a un doctor/usuario específico
 */
export async function getUserServices(userId: string): Promise<Service[]> {
    try {
        const data = await api.get(API_ROUTES.USER_SERVICES, { user_id: userId });
        const userServicesData = Array.isArray(data) ? data : (data.user_services || data.data || []);
        return userServicesData.map((s: any) => ({
            ...s,
            id: String(s.id),
            currency: s.currency || 'USD',
        }));
    } catch (error) {
        console.error('Failed to fetch user services:', error);
        return [];
    }
}

/**
 * Obtiene servicios asignados a múltiples doctores/usuarios en una sola petición
 * @param userIds - Lista de IDs de usuarios
 * @returns Map con user_id como clave y sus servicios como valor
 */
export async function getUsersServicesBatch(userIds: string[]): Promise<Map<string, Service[]>> {
    const serviceMap = new Map<string, Service[]>();
    if (userIds.length === 0) return serviceMap;

    try {
        const data = await api.get(API_ROUTES.USERS_SERVICES, {
            users_ids: userIds.join(','),
        });

        const entries: UserServicesEntry[] = Array.isArray(data) ? data : (data.data || []);

        for (const entry of entries) {
            const services = (entry.services || []).map((s: any) => ({
                ...s,
                id: String(s.id),
                currency: s.currency || 'USD',
                duration_minutes: s.duration_minutes || 30,
            }));
            serviceMap.set(entry.user_id, services);
        }

        // Asegurar que todos los userIds solicitados tengan una entrada (aunque sea vacía)
        for (const userId of userIds) {
            if (!serviceMap.has(userId)) {
                serviceMap.set(userId, []);
            }
        }

        return serviceMap;
    } catch (error) {
        console.error('Failed to fetch users services batch:', error);
        // Retornar map vacío con entradas para cada userId
        for (const userId of userIds) {
            serviceMap.set(userId, []);
        }
        return serviceMap;
    }
}
