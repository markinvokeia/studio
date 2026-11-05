'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import { cn } from '@/lib/utils';

import type { MeasurementUnit } from '@/lib/types';

interface MeasurementUnitSelectProps {
  units: MeasurementUnit[];
  value?: string | null;
  onChange: (unitId: string | null) => void;
  /** The unit saved on the record: listed even when it was deactivated, so it isn't changed silently */
  savedUnitId?: string | null;
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  clearLabel?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  'aria-invalid'?: React.AriaAttributes['aria-invalid'];
}

/**
 * Unit of measure of a service (ml, U, mg…) picked from the catalog of units, with search.
 * Not tied to the aesthetic record: any module that measures a service uses it.
 */
export const MeasurementUnitSelect = React.forwardRef<HTMLButtonElement, MeasurementUnitSelectProps>(function MeasurementUnitSelect(
  { units, value, onChange, savedUnitId, placeholder, searchPlaceholder, emptyText, clearLabel, disabled, id, className, 'aria-invalid': ariaInvalid },
  ref,
) {
  const [open, setOpen] = React.useState(false);
  const options = units.filter((u) => u.isActive || u.id === savedUnitId || u.id === value);
  const selected = units.find((u) => u.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={ref}
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={ariaInvalid}
          disabled={disabled}
          className={cn('h-10 w-full justify-between font-normal', !selected && 'text-muted-foreground', (ariaInvalid === true || ariaInvalid === 'true') && 'border-destructive', className)}
        >
          <span className="truncate">{selected ? `${selected.name} (${selected.symbol})` : placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[14rem] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((unit) => (
                <CommandItem
                  key={unit.id}
                  value={`${unit.name} ${unit.symbol} ${unit.code}`}
                  onSelect={() => { onChange(unit.id); setOpen(false); }}
                >
                  <Check className={cn('mr-2 h-4 w-4', unit.id === value ? 'opacity-100' : 'opacity-0')} />
                  <span className="flex-1 truncate">{unit.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{unit.symbol}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            {clearLabel && value && (
              <CommandGroup>
                <CommandItem value="__clear__" onSelect={() => { onChange(null); setOpen(false); }} className="text-muted-foreground">
                  <X className="mr-2 h-4 w-4" />{clearLabel}
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
});
