'use client';

import { Button } from '@/components/ui/button';
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SALES_PERMISSIONS } from '@/constants/permissions';
import { API_ROUTES } from '@/constants/routes';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import { Service } from '@/lib/types';
import { cn } from '@/lib/utils';
import { api, isTimeoutError, REQUEST_TIMEOUT_MS } from '@/services/api';
import { getPurchaseServices, getSalesServices, setServiceIsLab } from '@/services/services';
import { Check, ChevronsUpDown, Loader2, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { getClinicCurrency } from '@/stores/clinic-info-store';

interface ServiceSelectorProps {
    /** Tipo de servicio: true = sales (clínica), false = purchase (proveedores) */
    isSales?: boolean;
    /**
     * Solo trabajos de laboratorio (service_catalog.is_lab). Un servicio creado
     * desde el selector queda marcado como trabajo de laboratorio.
     */
    isLab?: boolean;
    /** IDs que no se ofrecen (p. ej. los que ya están en la lista). */
    excludeIds?: string[];
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
    /** Texto cuando el catálogo no tiene ninguno (sin búsqueda). Por defecto, `noResultsText`. */
    emptyText?: string;
    /** Texto cuando está cargando */
    loadingText?: string;
    /** Texto del botón de-trigger */
    triggerText?: string;
    /** Clases adicionales */
    className?: string;
    /** Si está deshabilitado */
    disabled?: boolean;
    /** Marca el campo como inválido (borde rojo). `FormControl` lo pasa solo. */
    'aria-invalid'?: React.AriaAttributes['aria-invalid'];
}

/**
 * Altura aproximada que el popover intenta ocupar. Si hacia abajo hay menos que
 * esto y hacia arriba hay más espacio, el desplegable se abre hacia arriba.
 */
const DESIRED_POPOVER_HEIGHT = 320;

export function ServiceSelector({
    isSales = true,
    isLab,
    excludeIds,
    value,
    selectedServiceName,
    onValueChange,
    placeholder: placeholderProp,
    noResultsText,
    emptyText,
    loadingText: loadingTextProp,
    triggerText: triggerTextProp,
    className,
    disabled = false,
    'aria-invalid': ariaInvalid,
}: ServiceSelectorProps) {
    const t = useTranslations('EntitySelectors');
    const placeholder = placeholderProp ?? t('searchService');
    const loadingText = loadingTextProp ?? t('loading');
    const triggerText = triggerTextProp ?? t('selectService');
    const { hasPermission } = usePermissions();
    const { toast } = useToast();
    const canCreateService = hasPermission(SALES_PERMISSIONS.SERVICES_CREATE);
    const triggerRef = React.useRef<HTMLButtonElement>(null);
    const [side, setSide] = React.useState<'top' | 'bottom'>('bottom');
    const [open, setOpen] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [services, setServices] = React.useState<Service[]>([]);
    const [selectedServiceCache, setSelectedServiceCache] = React.useState<Service | null>(null);
    const [isLoading, setIsLoading] = React.useState(false);
    const [isCreating, setIsCreating] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);
    /** Nombre del servicio a crear: arranca con lo buscado y se puede corregir. */
    const [createName, setCreateName] = React.useState('');

    const noResultsMessage = noResultsText || t('noServices');

    // Reset create mode when search query changes
    React.useEffect(() => {
        setIsCreating(false);
    }, [searchQuery]);

    const handleOpenChange = (nextOpen: boolean) => {
        if (nextOpen) {
            // Decide el lado al abrir: si abajo no entra un desplegable cómodo y
            // arriba hay más aire, se abre hacia arriba. Radix mantiene su propia
            // detección de colisión encima de esto como red de seguridad.
            const rect = triggerRef.current?.getBoundingClientRect();
            if (rect) {
                const spaceBelow = window.innerHeight - rect.bottom;
                const spaceAbove = rect.top;
                setSide(spaceBelow < DESIRED_POPOVER_HEIGHT && spaceAbove > spaceBelow ? 'top' : 'bottom');
            }
        } else {
            // No se cierra a mitad de un alta.
            if (isSaving) return;
            setIsCreating(false);
        }
        setOpen(nextOpen);
    };

    // Fetch services when search query changes (with debounce)
    React.useEffect(() => {
        const handler = setTimeout(async () => {
            setIsLoading(true);
            try {
                const result = isSales
                    ? await getSalesServices({ search: searchQuery, limit: 50, is_lab: isLab })
                    : await getPurchaseServices({ search: searchQuery, limit: 50, is_lab: isLab });

                setServices(result.items.map((s: any) => ({
                    ...s,
                    id: String(s.id),
                    currency: s.currency || getClinicCurrency(),
                })));
            } catch (error) {
                console.error('Failed to fetch services:', error);
                setServices([]);
            } finally {
                setIsLoading(false);
            }
        }, 300);

        return () => clearTimeout(handler);
    }, [searchQuery, isSales, isLab]);

    const visibleServices = React.useMemo(() => {
        if (!excludeIds?.length) return services;
        const hidden = new Set(excludeIds);
        return services.filter((s) => !hidden.has(s.id) || s.id === value);
    }, [excludeIds, services, value]);

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

    const startCreate = () => {
        setCreateName(searchQuery.trim());
        setIsCreating(true);
    };

    const fetchByName = async (name: string, lab?: boolean): Promise<Service[]> => {
        const result = isSales
            ? await getSalesServices({ search: name, limit: 50, is_lab: lab })
            : await getPurchaseServices({ search: name, limit: 50, is_lab: lab });
        return result.items.map((s: any) => ({
            ...s,
            id: String(s.id),
            currency: s.currency || getClinicCurrency(),
        }));
    };

    const sameName = (name: string) => (s: Service) => s.name.trim().toLowerCase() === name.toLowerCase();

    const handleCreateService = async () => {
        const name = createName.trim();
        if (!name || !canCreateService || isSaving) return;
        setIsSaving(true);
        try {
            // Trabajo de laboratorio: si el servicio ya existe en el catálogo sin la marca,
            // se marca ese en vez de crear otro con el mismo nombre.
            let created = isLab ? (await fetchByName(name, false)).find(sameName(name)) : undefined;

            if (!created) {
                await api.post(API_ROUTES.PURCHASES.SERVICES_UPSERT, {
                    name,
                    price: 0,
                    currency: getClinicCurrency(),
                    is_sales: isSales,
                    is_active: true,
                    duration_minutes: 60,
                    category: '',
                    description: '',
                }, undefined, undefined, { timeoutMs: REQUEST_TIMEOUT_MS.mutation });

                // El alta no devuelve el id: se busca por nombre para seleccionarlo.
                const found = await fetchByName(name);
                setServices(found);
                created = found.find(sameName(name));
            }

            if (!created) {
                toast({ variant: 'destructive', title: t('createServiceError') });
                return;
            }
            // El alta no persiste is_lab (lo escribe su propio endpoint).
            if (isLab && !created.is_lab) {
                if (await setServiceIsLab(created.id, true)) {
                    created = { ...created, is_lab: true };
                } else {
                    toast({ variant: 'destructive', title: t('labFlagError', { name: created.name }) });
                }
            }
            handleSelect(created);
        } catch (error) {
            console.error('Failed to create service:', error);
            toast({
                variant: 'destructive',
                title: t('createServiceError'),
                description: isTimeoutError(error) ? t('createTimeout') : undefined,
            });
        } finally {
            setIsSaving(false);
        }
    };

    const hasQuery = Boolean(searchQuery.trim());
    // Crear: al buscar algo, o cuando no hay nada para elegir aunque no se haya escrito nada.
    const showCreate = canCreateService && (hasQuery || isCreating || visibleServices.length === 0);

    return (
        <Popover open={open} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
                <Button
                    ref={triggerRef}
                    variant="outline"
                    role="combobox"
                    className={cn("w-full justify-between", !value && "text-muted-foreground", className)}
                    disabled={disabled}
                    aria-invalid={ariaInvalid}
                >
                    {value && selectedService
                        ? <span className="truncate block">{selectedService.name}</span>
                        : triggerText}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start" side={side}>
                <Command shouldFilter={false}>
                    <CommandInput
                        placeholder={placeholder}
                        value={searchQuery}
                        onValueChange={setSearchQuery}
                    />
                    <CommandList className="max-h-[320px]">
                        {isLoading ? (
                            <div className="flex items-center justify-center p-4">
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                <span className="text-sm text-muted-foreground">{loadingText}</span>
                            </div>
                        ) : (
                            <>
                                {/* Results list */}
                                {visibleServices.length > 0 && (
                                    <CommandGroup>
                                        {visibleServices.map((service) => (
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
                                {visibleServices.length === 0 && !isCreating && (
                                    <p className="py-5 px-3 text-center text-sm text-muted-foreground">
                                        {!hasQuery && services.length === 0 && emptyText ? emptyText : noResultsMessage}
                                    </p>
                                )}

                                {/* Crear: solo para quien puede dar de alta servicios (es el mismo
                                    alta que desde el catálogo, con otra puerta). */}
                                {showCreate && (
                                    <div className={cn("border-t", visibleServices.length === 0 && !isCreating && "border-t-0")}>
                                        {isCreating ? (
                                            <div className="p-2 space-y-1.5">
                                                <p className="text-xs text-muted-foreground px-1">
                                                    {isLab ? t('labServiceWillBeCreated') : t('serviceWillBeCreated')}
                                                </p>
                                                {/* Las teclas no deben llegar al Command: Enter elegiría un resultado. */}
                                                <div className="flex items-center gap-2" onKeyDown={(e) => e.stopPropagation()}>
                                                    <Input
                                                        value={createName}
                                                        onChange={(e) => setCreateName(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') { e.preventDefault(); void handleCreateService(); }
                                                            if (e.key === 'Escape') { e.preventDefault(); setIsCreating(false); }
                                                        }}
                                                        placeholder={t('serviceNamePlaceholder')}
                                                        aria-label={t('serviceNamePlaceholder')}
                                                        className="h-8 text-sm"
                                                        maxLength={200}
                                                        disabled={isSaving}
                                                        autoFocus
                                                    />
                                                    <Button
                                                        size="sm"
                                                        className="bg-green-600 hover:bg-green-700 text-white shrink-0"
                                                        onClick={() => void handleCreateService()}
                                                        disabled={isSaving || !createName.trim()}
                                                        type="button"
                                                    >
                                                        {isSaving && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                                                        {t('save')}
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <button
                                                className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent cursor-pointer text-left"
                                                onClick={startCreate}
                                                type="button"
                                            >
                                                <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                                <span className="truncate">
                                                    {hasQuery ? t('createNamed', { name: searchQuery.trim() }) : t('createService')}
                                                </span>
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
