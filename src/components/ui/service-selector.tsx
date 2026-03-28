'use client';

import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Service } from '@/lib/types';
import { cn } from '@/lib/utils';
import { getPurchaseServices, getSalesServices } from '@/services/services';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

interface ServiceSelectorProps {
    /** Tipo de servicio: true = sales (clínica), false = purchase (proveedores) */
    isSales?: boolean;
    /** Valor seleccionado (ID del servicio) */
    value?: string;
    /** Callback cuando se selecciona un servicio */
    onValueChange?: (serviceId: string, service?: Service) => void;
    /** Placeholder del input de búsqueda */
    placeholder?: string;
    /** Texto cuando no hay resultados */
    noResultsText?: string;
    /** Texto de búsqueda */
    searchingText?: string;
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
    onValueChange,
    placeholder = 'Buscar servicio...',
    noResultsText = 'No se encontraron servicios.',
    searchingText = 'Buscando...',
    loadingText = 'Cargando...',
    triggerText = 'Seleccionar servicio',
    className,
    disabled = false,
}: ServiceSelectorProps) {
    const t = useTranslations('General');
    const [open, setOpen] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [services, setServices] = React.useState<Service[]>([]);
    const [isLoading, setIsLoading] = React.useState(false);

    const noResultsMessage = noResultsText || t('noResults');
    const searchingMessage = searchingText || t('searching');

    // Fetch services when search query changes (with debounce)
    React.useEffect(() => {
        const handler = setTimeout(async () => {
            // If search is empty and we already have services, don't reload
            if (searchQuery.length === 0 && services.length > 0) {
                return;
            }

            setIsLoading(true);
            try {
                const result = isSales
                    ? await getSalesServices({ search: searchQuery, limit: 50 })
                    : await getPurchaseServices({ search: searchQuery, limit: 50 });

                setServices(result.items.map((s: any) => ({
                    ...s,
                    id: String(s.id),
                    currency: s.currency || 'USD',
                })));
            } catch (error) {
                console.error('Failed to fetch services:', error);
                setServices([]);
            } finally {
                setIsLoading(false);
            }
        }, 300); // Debounce 300ms

        return () => clearTimeout(handler);
    }, [searchQuery, isSales]);

    // Find selected service
    const selectedService = React.useMemo(() => {
        return services.find(s => s.id === value);
    }, [services, value]);

    const handleSelect = (service: Service) => {
        onValueChange?.(service.id, service);
        setOpen(false);
        // Reset search when closing
        setSearchQuery('');
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    className={cn("w-full justify-between", !value && "text-muted-foreground", className)}
                    disabled={disabled}
                >
                    {value && selectedService
                        ? <span className="truncate">{selectedService.name}</span>
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
                                <CommandEmpty>{noResultsMessage}</CommandEmpty>
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
                            </>
                        )}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

export default ServiceSelector;
