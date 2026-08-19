'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown } from 'lucide-react';

interface SedeSelectorProps {
    value?: string;
    onValueChange: (sedeId: string, sedeName?: string) => void;
    placeholder?: string;
    triggerText?: string;
    emptyText?: string;
    className?: string;
    disabled?: boolean;
}

export function SedeSelector({
    value,
    onValueChange,
    placeholder = 'Buscar sede...',
    triggerText = 'Seleccionar sede...',
    emptyText = 'No hay resultados.',
    className,
    disabled = false,
}: SedeSelectorProps) {
    const { sedes } = useAuth();
    const [open, setOpen] = React.useState(false);

    const selectedSede = sedes.find((s) => s.id === value);

    const handleSelect = (sedeId: string, sedeName: string) => {
        onValueChange(sedeId, sedeName);
        setOpen(false);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    className={cn('w-full justify-between font-normal', !value && 'text-muted-foreground', className)}
                    disabled={disabled}
                >
                    <span className="truncate block">{selectedSede ? selectedSede.name : triggerText}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                    <CommandInput placeholder={placeholder} />
                    <CommandList>
                        <CommandEmpty>{emptyText}</CommandEmpty>
                        <CommandGroup>
                            {sedes.map((sede) => (
                                <CommandItem key={sede.id} value={sede.name} onSelect={() => handleSelect(sede.id, sede.name)}>
                                    <Check className={cn('mr-2 h-4 w-4', value === sede.id ? 'opacity-100' : 'opacity-0')} />
                                    <span className="truncate">{sede.name}</span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

export default SedeSelector;
