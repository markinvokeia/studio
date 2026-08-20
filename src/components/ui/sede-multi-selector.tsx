'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown } from 'lucide-react';

export type SedeOption = { id: string; name: string };

interface SedeMultiSelectorProps {
    values?: string[];
    onValuesChange: (sedeIds: string[], sedes: SedeOption[]) => void;
    placeholder?: string;
    triggerText?: string;
    emptyText?: string;
    className?: string;
    disabled?: boolean;
}

export function SedeMultiSelector({
    values,
    onValuesChange,
    placeholder = 'Buscar sede...',
    triggerText = 'Seleccionar',
    emptyText = 'No hay resultados.',
    className,
    disabled = false,
}: SedeMultiSelectorProps) {
    const { sedes } = useAuth();
    const ids = values ?? [];

    const [open, setOpen] = React.useState(false);

    const sedesMap = React.useMemo(() => {
        const map = new Map<string, SedeOption>();
        for (const sede of sedes) map.set(sede.id, { id: sede.id, name: sede.name });
        return map;
    }, [sedes]);

    const handleSelect = (sede: SedeOption) => {
        const isSelected = ids.includes(sede.id);
        const nextIds = isSelected ? ids.filter((id) => id !== sede.id) : [...ids, sede.id];
        const nextSedes = nextIds.map((id) => sedesMap.get(id)).filter((s): s is SedeOption => Boolean(s));
        onValuesChange(nextIds, nextSedes);
    };

    const triggerLabel = ids.length === 0
        ? triggerText
        : ids.length === 1
            ? (sedesMap.get(ids[0])?.name ?? triggerText)
            : `${ids.length} sedes seleccionadas`;

    const hasSelection = ids.length > 0;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    className={cn('w-full justify-between', !hasSelection && 'text-muted-foreground', className)}
                    disabled={disabled}
                >
                    <span className="truncate block">{triggerLabel}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                    <CommandInput placeholder={placeholder} />
                    <CommandList>
                        <CommandEmpty>{emptyText}</CommandEmpty>
                        <CommandGroup>
                            {sedes.map((sede) => {
                                const isChecked = ids.includes(sede.id);
                                return (
                                    <CommandItem key={sede.id} value={sede.name} onSelect={() => handleSelect({ id: sede.id, name: sede.name })}>
                                        <Check className={cn('mr-2 h-4 w-4', isChecked ? 'opacity-100' : 'opacity-0')} />
                                        <span className="truncate">{sede.name}</span>
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

export default SedeMultiSelector;
