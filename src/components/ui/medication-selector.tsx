'use client';

import { Button } from '@/components/ui/button';
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import { CLINIC_CATALOG_PERMISSIONS } from '@/constants/permissions';
import { usePermissions } from '@/hooks/usePermissions';
import { Medication } from '@/lib/types';
import { cn } from '@/lib/utils';
import { createMedication, getMedicationsCatalog } from '@/services/medications';

import { Check, ChevronsUpDown, Loader2, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

interface MedicationSelectorProps {
    /** ID del medicamento seleccionado (del catálogo). */
    value?: string;
    /** Nombre ya resuelto, para pintar la selección sin depender del catálogo paginado. */
    selectedMedicationName?: string;
    onValueChange?: (medicationId: string, medication?: Medication) => void;
    className?: string;
    disabled?: boolean;
}

/**
 * Combobox del catálogo de medicamentos con alta *on the fly*: si el término
 * buscado no existe, ofrece crearlo (genérico + comercial) y lo auto-selecciona
 * tras refrescar. Mismo patrón que `ServiceSelector`.
 */
export function MedicationSelector({
    value,
    selectedMedicationName,
    onValueChange,
    className,
    disabled = false,
}: MedicationSelectorProps) {
    const t = useTranslations('MedicationSelector');
    const { hasPermission } = usePermissions();
    const canCreate = hasPermission(CLINIC_CATALOG_PERMISSIONS.MEDICATIONS_CREATE);

    const [open, setOpen] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [medications, setMedications] = React.useState<Medication[]>([]);
    const [selectedCache, setSelectedCache] = React.useState<Medication | null>(null);
    const [isLoading, setIsLoading] = React.useState(false);

    const [isCreating, setIsCreating] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);
    const [createError, setCreateError] = React.useState<string | null>(null);
    const [newCommercialName, setNewCommercialName] = React.useState('');

    // Salir del modo "crear" en cuanto cambia la búsqueda: el término mostrado
    // en el mini-formulario dejaría de coincidir.
    React.useEffect(() => {
        setIsCreating(false);
        setCreateError(null);
        setNewCommercialName('');
    }, [searchQuery]);

    const handleOpenChange = (nextOpen: boolean) => {
        if (!nextOpen) {
            setIsCreating(false);
            setCreateError(null);
        }
        setOpen(nextOpen);
    };

    React.useEffect(() => {
        if (!open) return;
        const handler = setTimeout(async () => {
            setIsLoading(true);
            const { items } = await getMedicationsCatalog({ search: searchQuery, limit: 50 });
            setMedications(items);
            setIsLoading(false);
        }, 300);

        return () => clearTimeout(handler);
    }, [searchQuery, open]);

    const fallbackSelected = React.useMemo<Medication | undefined>(() => {
        if (!value || !selectedMedicationName) return undefined;
        return { id: value, nombre_generico: selectedMedicationName };
    }, [selectedMedicationName, value]);

    const selectedMedication = React.useMemo(() => {
        const fromResults = medications.find((m) => m.id === value);
        if (fromResults) return fromResults;
        if (selectedCache?.id === value) return selectedCache;
        return fallbackSelected;
    }, [fallbackSelected, medications, selectedCache, value]);

    const handleSelect = (medication: Medication) => {
        setSelectedCache(medication);
        onValueChange?.(medication.id, medication);
        setOpen(false);
        setSearchQuery('');
        setIsCreating(false);
    };

    const handleCreate = async () => {
        const nombre = searchQuery.trim();
        if (!nombre) return;
        setIsSaving(true);
        setCreateError(null);
        try {
            await createMedication({ nombre_generico: nombre, nombre_comercial: newCommercialName.trim() });

            // Refetch para recuperar el id que asignó el backend y auto-seleccionar.
            const { items } = await getMedicationsCatalog({ search: nombre, limit: 50 });
            setMedications(items);

            const created = items.find((m) => m.nombre_generico.toLowerCase() === nombre.toLowerCase()) || items[0];
            if (created) {
                handleSelect(created);
            } else {
                setCreateError(t('createError'));
            }
        } catch (error) {
            setCreateError(error instanceof Error ? error.message : t('createError'));
        } finally {
            setIsSaving(false);
        }
    };

    const trimmedQuery = searchQuery.trim();
    const showCreateRow =
        canCreate &&
        !!trimmedQuery &&
        !medications.some((m) => m.nombre_generico.toLowerCase() === trimmedQuery.toLowerCase());

    return (
        <Popover open={open} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    className={cn('w-full justify-between', !value && 'text-muted-foreground', className)}
                    disabled={disabled}
                >
                    {selectedMedication
                        ? <span className="truncate block">{selectedMedication.nombre_generico}</span>
                        : t('trigger')}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command shouldFilter={false}>
                    <CommandInput
                        placeholder={t('searchPlaceholder')}
                        value={searchQuery}
                        onValueChange={setSearchQuery}
                    />
                    <CommandList>
                        {isLoading ? (
                            <div className="flex items-center justify-center p-4">
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                <span className="text-sm text-muted-foreground">{t('loading')}</span>
                            </div>
                        ) : (
                            <>
                                {medications.length > 0 && (
                                    <CommandGroup>
                                        {medications.map((medication) => (
                                            <CommandItem
                                                value={medication.nombre_generico}
                                                key={medication.id}
                                                onSelect={() => handleSelect(medication)}
                                            >
                                                <Check className={cn('mr-2 h-4 w-4', value === medication.id ? 'opacity-100' : 'opacity-0')} />
                                                <div className="flex flex-col truncate">
                                                    <span className="truncate">{medication.nombre_generico}</span>
                                                    {medication.nombre_comercial && (
                                                        <span className="text-xs text-muted-foreground truncate">
                                                            {medication.nombre_comercial}
                                                        </span>
                                                    )}
                                                </div>
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                )}

                                {medications.length === 0 && (
                                    <p className="py-5 text-center text-sm text-muted-foreground">
                                        {t('noResults')}
                                    </p>
                                )}

                                {showCreateRow && (
                                    <div className={cn('border-t', medications.length === 0 && 'border-t-0')}>
                                        {isCreating ? (
                                            <div className="space-y-2 p-2">
                                                <p className="px-1 text-xs text-muted-foreground">{t('createHint')}</p>
                                                <div className="space-y-1.5 px-1">
                                                    <p className="truncate text-sm font-medium">&ldquo;{trimmedQuery}&rdquo;</p>
                                                    <Input
                                                        className="h-8"
                                                        placeholder={t('commercialNamePlaceholder')}
                                                        value={newCommercialName}
                                                        onChange={(e) => setNewCommercialName(e.target.value)}
                                                    />
                                                    {createError && (
                                                        <p className="text-xs text-destructive">{createError}</p>
                                                    )}
                                                    <Button
                                                        size="sm"
                                                        className="w-full"
                                                        onClick={handleCreate}
                                                        disabled={isSaving}
                                                        type="button"
                                                    >
                                                        {isSaving && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                                                        {t('save')}
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <button
                                                className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                                                onClick={() => setIsCreating(true)}
                                                type="button"
                                            >
                                                <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                                <span className="truncate">{t('create', { name: trimmedQuery })}</span>
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
