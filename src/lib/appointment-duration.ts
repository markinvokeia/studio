import { fetchServicesByIds } from '@/services/services';

import type { Service } from '@/lib/types';

/**
 * Duración en minutos de un servicio para una cita. Precedencia: la duración
 * propia del doctor para ese servicio > la del servicio > la del catálogo.
 * Devuelve 0 si no se conoce ninguna.
 */
export function getServiceDurationMinutes(
    service: Pick<Service, 'id' | 'duration_minutes'>,
    doctorServices?: Pick<Service, 'id' | 'duration_minutes'>[],
    catalog?: Pick<Service, 'id' | 'duration_minutes'>[],
): number {
    const id = String(service.id);
    const doctorDuration = doctorServices?.find((s) => String(s.id) === id)?.duration_minutes;
    if (doctorDuration && doctorDuration > 0) return doctorDuration;
    if (service.duration_minutes && service.duration_minutes > 0) return service.duration_minutes;
    const catalogDuration = catalog?.find((s) => String(s.id) === id)?.duration_minutes;
    return catalogDuration && catalogDuration > 0 ? catalogDuration : 0;
}

/** Suma de las duraciones de los servicios de una cita (ver `getServiceDurationMinutes`). */
export function sumServicesDuration(
    services: Pick<Service, 'id' | 'duration_minutes'>[],
    doctorServices?: Pick<Service, 'id' | 'duration_minutes'>[],
    catalog?: Pick<Service, 'id' | 'duration_minutes'>[],
): number {
    return services.reduce((acc, service) => acc + getServiceDurationMinutes(service, doctorServices, catalog), 0);
}

/**
 * Completa `duration_minutes` en los servicios que llegan sin ella (p. ej. los de
 * una cita existente, que el listado de citas no siempre trae). Primero mira el
 * catálogo en memoria y sólo pide al backend los que sigan faltando. Nunca lanza:
 * si el pedido falla devuelve los servicios tal como llegaron.
 */
export async function withServiceDurations<T extends Pick<Service, 'id' | 'duration_minutes'>>(
    services: T[],
    catalog?: Pick<Service, 'id' | 'duration_minutes'>[],
): Promise<T[]> {
    const fromCatalog = services.map((service) => {
        if (service.duration_minutes && service.duration_minutes > 0) return service;
        const duration = getServiceDurationMinutes(service, undefined, catalog);
        return duration > 0 ? { ...service, duration_minutes: duration } : service;
    });
    const missingIds = fromCatalog
        .filter((service) => !service.duration_minutes || service.duration_minutes <= 0)
        .map((service) => String(service.id));
    if (missingIds.length === 0) return fromCatalog;
    try {
        const fetched = await fetchServicesByIds(missingIds);
        return fromCatalog.map((service) => {
            if (service.duration_minutes && service.duration_minutes > 0) return service;
            const duration = getServiceDurationMinutes(service, undefined, fetched);
            return duration > 0 ? { ...service, duration_minutes: duration } : service;
        });
    } catch (error) {
        console.error('Failed to resolve service durations:', error);
        return fromCatalog;
    }
}
