'use client';

import { Service } from '@/lib/types';
import { getServices, GetServicesParams, ServicesResponse } from '@/services/services';
import * as React from 'react';

export interface UseServicesOptions extends GetServicesParams {
    /** Si true, carga los servicios automáticamente al montar el componente */
    autoLoad?: boolean;
}

export interface UseServicesReturn {
    /** Lista de servicios */
    services: Service[];
    /** Total de servicios disponibles */
    total: number;
    /** Total de páginas disponibles */
    totalPages: number;
    /** Página actual */
    currentPage: number;
    /** Indica si está cargando */
    isLoading: boolean;
    /** Indica si hay un error */
    error: string | null;
    /** Término de búsqueda actual */
    searchTerm: string;
    /** Función para buscar servicios */
    search: (term: string) => void;
    /** Función para cambiar de página */
    goToPage: (page: number) => void;
    /** Función para cargar/recargar los servicios */
    refresh: () => Promise<void>;
    /** Función para cargar más servicios (próxima página) */
    loadMore: () => void;
    /** Si hay más páginas disponibles */
    hasMore: boolean;
}

/**
 * Hook reutilizable para obtener y gestionar servicios con búsqueda y paginación
 * @param options - Opciones de configuración
 * @returns Funciones y estados para gestionar servicios
 */
export function useServices(options: UseServicesOptions = {}): UseServicesReturn {
    const {
        is_sales = true,
        search: initialSearch = '',
        page: initialPage = 1,
        limit = 50,
        autoLoad = true,
    } = options;

    const [services, setServices] = React.useState<Service[]>([]);
    const [total, setTotal] = React.useState(0);
    const [totalPages, setTotalPages] = React.useState(1);
    const [currentPage, setCurrentPage] = React.useState(initialPage);
    const [searchTerm, setSearchTerm] = React.useState(initialSearch);
    const [isLoading, setIsLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const hasMore = currentPage < totalPages;

    const fetchServices = React.useCallback(async (page: number = currentPage, search: string = searchTerm) => {
        setIsLoading(true);
        setError(null);

        try {
            const result: ServicesResponse = await getServices({
                is_sales,
                search: search || undefined,
                page,
                limit,
            });

            // Si es la primera página, reemplaza los servicios
            // Si es una página siguiente, agrega al final
            if (page === 1) {
                setServices(result.items);
            } else {
                setServices(prev => [...prev, ...result.items]);
            }

            setTotal(result.total);
            setTotalPages(result.total_pages);
            setCurrentPage(page);
        } catch (err) {
            console.error('Error fetching services:', err);
            setError(err instanceof Error ? err.message : 'Error al cargar servicios');
        } finally {
            setIsLoading(false);
        }
    }, [is_sales, limit, currentPage, searchTerm]);

    // Cargar servicios iniciales
    React.useEffect(() => {
        if (autoLoad) {
            fetchServices(1, searchTerm);
        }
    }, []); // Solo se ejecuta una vez al montar

    // Función para buscar
    const search = React.useCallback((term: string) => {
        setSearchTerm(term);
        setCurrentPage(1);
        fetchServices(1, term);
    }, [fetchServices]);

    // Función para ir a una página específica
    const goToPage = React.useCallback((page: number) => {
        if (page >= 1 && page <= totalPages) {
            fetchServices(page, searchTerm);
        }
    }, [fetchServices, totalPages, searchTerm]);

    // Función para cargar más (próxima página)
    const loadMore = React.useCallback(() => {
        if (hasMore && !isLoading) {
            fetchServices(currentPage + 1, searchTerm);
        }
    }, [hasMore, isLoading, currentPage, searchTerm, fetchServices]);

    // Función para refresh
    const refresh = React.useCallback(async () => {
        await fetchServices(1, searchTerm);
    }, [fetchServices, searchTerm]);

    return {
        services,
        total,
        totalPages,
        currentPage,
        isLoading,
        error,
        searchTerm,
        search,
        goToPage,
        refresh,
        loadMore,
        hasMore,
    };
}

export default useServices;
