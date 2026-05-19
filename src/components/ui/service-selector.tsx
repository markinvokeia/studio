'use client';

import { Button } from '@/components/ui/button';
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { API_ROUTES } from '@/constants/routes';
import { Service } from '@/lib/types';
import { cn } from '@/lib/utils';
import { api } from '@/services/api';
import { getPurchaseServices, getSalesServices } from '@/services/services';
import { Check, ChevronsUpDown, Loader2, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

interface ServiceSelectorProps {
    /** Tipo de servicio: true = sales (clínica), false = purchase (proveedores) */
    isSales?: boolean;
    /** Valor seleccionado (ID del servicio) */
    value?: string;
    /** Nombre del servicio ya resuelto para mostrar el valor seleccionado sin depender del catálogo paginado */
    selectedServiceName?: string;
    /** Callback cuando se selecciona un servicio */
    onValueChange?: (serviceId: string, service?: Service) => void;
    /** Placeholder del input de búsqueda */
    placeholder?: string;
    /** Texto cuando no hay resultados */
    noResultsText?: string;
    /** Texto cuando está cargando */
    loadingText?: string;
    /** Texto del botón de-trigger */
    triggerText?: string;
    /** Clases adicionales */
    className?: string;
    /** Si está deshabilitado */
    disabled?: boolean;
}

export function ServiceSelector({
    isSales = true,
    value,
    selectedServiceName,
    onValueChange,
    placeholder = 'Buscar servicio...',
    noResultsText = 'No se encontraron servicios.',
    loadingText = 'Cargando...',
    triggerText = 'Seleccionar servicio',
    className,
    disabled = false,
}: ServiceSelectorProps) {
    const t = useTranslations('General');
    const [open, setOpen] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [services, setServices] = React.useState<Service[]>([]);
    const [selectedServiceCache, setSelectedServiceCache] = React.useState<Service | null>(null);
    const [isLoading, setIsLoading] = React.useState(false);
    const [isCreating, setIsCreating] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);

    const noResultsMessage = noResultsText || t('noResults');

    // Reset create mode when search query changes
    React.useEffect(() => {
        setIsCreating(false);
    }, [searchQuery]);

    const handleOpenChange = (nextOpen: boolean) => {
        if (!nextOpen) setIsCreating(false);
        setOpen(nextOpen);
    };

    // Fetch services when search query changes (with debounce)
    React.useEffect(() => {
        const handler = setTimeout(async () => {
            setIsLoading(true);
            try {
                const result = isSales
                    ? await getSalesServices({ search: searchQuery, limit: 50 })
                    : await getPurchaseServices({ search: searchQuery, limit: 50 });

                setServices(result.items.map((s: any) => ({
                    ...s,
                    id: String(s.id),
                    currency: s.currency || 'UYU',
                })));
            } catch (error) {
                console.error('Failed to fetch services:', error);
                setServices([]);
            } finally {
                setIsLoading(false);
            }
        }, 300);

        return () => clearTimeout(handler);
    }, [searchQuery, isSales]);

    const fallbackSelectedService = React.useMemo<Service | undefined>(() => {
        if (!value || !selectedServiceName) return undefined;
        return {
            id: value,
            name: selectedServiceName,
            category: '',
            price: 0,
            duration_minutes: 0,
            is_active: true,
        };
    }, [selectedServiceName, value]);

    const selectedService = React.useMemo(() => {
        const serviceFromResults = services.find(s => s.id === value);
        if (serviceFromResults) return serviceFromResults;
        if (selectedServiceCache?.id === value) return selectedServiceCache;
        return fallbackSelectedService;
    }, [fallbackSelectedService, selectedServiceCache, services, value]);

    React.useEffect(() => {
        const serviceFromResults = services.find(s => s.id === value);
        if (serviceFromResults) {
            setSelectedServiceCache(serviceFromResults);
        } else if (!value) {
            setSelectedServiceCache(null);
        }
    }, [services, value]);

    const handleSelect = (service: Service) => {
        setSelectedServiceCache(service);
        onValueChange?.(service.id, service);
        setOpen(false);
        setSearchQuery('');
        setIsCreating(false);
    };

    const handleCreateService = async () => {
        const name = searchQuery.trim();
        if (!name) return;
        setIsSaving(true);
        try {
            await api.post(API_ROUTES.PURCHASES.SERVICES_UPSERT, {
                name,
                price: 0,
                currency: 'UYU',
                is_sales: isSales,
                is_active: true,
                duration_minutes: 60,
                category: '',
                description: '',
            });

            // Re-fetch to find and auto-select the newly created service
            const result = isSales
                ? await getSalesServices({ search: name, limit: 50 })
                : await getPurchaseServices({ search: name, limit: 50 });

            const newServices = result.items.map((s: any) => ({
                ...s,
                id: String(s.id),
                currency: s.currency || 'UYU',
            }));
            setServices(newServices);

            const created = newServices.find((s: Service) =>
                s.name.toLowerCase() === name.toLowerCase()
            ) || newServices[0];

            if (created) {
                handleSelect(created);
            }
        } catch (error) {
            console.error('Failed to create service:', error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Popover open={open} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    className={cn("w-full justify-between", !value && "text-muted-foreground", className)}
                    disabled={disabled}
                >
                    {value && selectedService
                        ? <span className="truncate block">{selectedService.name}</span>
                        : triggerText}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command shouldFilter={false}>
                    <CommandInput
                        placeholder={placeholder}
                        value={searchQuery}
                        onValueChange={setSearchQuery}
                    />
                    <CommandList>
                        {isLoading ? (
                            <div className="flex items-center justify-center p-4">
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                <span className="text-sm text-muted-foreground">{loadingText}</span>
                            </div>
                        ) : (
                            <>
                                {/* Results list */}
                                {services.length > 0 && (
                                    <CommandGroup>
                                        {services.map((service) => (
                                            <CommandItem
                                                value={service.name}
                                                key={service.id}
                                                onSelect={() => handleSelect(service)}
                                            >
                                                <Check className={cn("mr-2 h-4 w-4", value === service.id ? "opacity-100" : "opacity-0")} />
                                                <div className="flex flex-col truncate">
                                                    <span className="truncate">{service.name}</span>
                                                    {service.category_name && (
                                                        <span className="text-xs text-muted-foreground truncate">
                                                            {service.category_name}
                                                        </span>
                                                    )}
                                                </div>
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                )}

                                {/* No results message */}
                                {services.length === 0 && (
                                    <p className="py-5 text-center text-sm text-muted-foreground">
                                        {noResultsMessage}
                                    </p>
                                )}

                                {/* Create option — always at bottom when there's a search query */}
                                {searchQuery.trim() && (
                                    <div className={cn("border-t", services.length === 0 && "border-t-0")}>
                                        {isCreating ? (
                                            <div className="p-2 space-y-1.5">
                                                <p className="text-xs text-muted-foreground px-1">
                                                    Este servicio se creará automáticamente
                                                </p>
                                                <div className="flex items-center gap-2 px-1">
                                                    <span className="text-sm flex-1 truncate font-medium">
                                                        "{searchQuery}"
                                                    </span>
                                                    <Button
                                                        size="sm"
                                                        className="bg-green-600 hover:bg-green-700 text-white shrink-0"
                                                        onClick={handleCreateService}
                                                        disabled={isSaving}
                                                        type="button"
                                                    >
                                                        {isSaving && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                                                        Guardar
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <button
                                                className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent cursor-pointer text-left"
                                                onClick={() => setIsCreating(true)}
                                                type="button"
                                            >
                                                <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                                <span className="truncate">Crear "{searchQuery}"</span>
                                            </button>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

export default ServiceSelector;
