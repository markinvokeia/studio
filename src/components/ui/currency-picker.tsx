'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import { CURRENCIES, getCurrency } from '@/constants/currencies';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown, X } from 'lucide-react';

interface CurrencyPickerProps {
  value?: string;
  onChange: (value: string | undefined) => void;
  /** Código a excluir (p. ej. la principal, al elegir la secundaria). */
  exclude?: string;
  /** Permite dejarlo vacío. Se usa para la moneda secundaria, que es opcional. */
  clearable?: boolean;
  placeholder?: string;
  clearLabel?: string;
  emptyLabel?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  id?: string;
}

/**
 * Selector del catálogo completo de monedas, con búsqueda. Solo se usa en
 * Configuración → Datos de la Clínica, que es el único sitio donde se elige
 * entre todas las monedas; el resto de la app usa `CurrencySelect`, que ofrece
 * únicamente las que la clínica configuró.
 */
export function CurrencyPicker({
  value,
  onChange,
  exclude,
  clearable = false,
  placeholder = 'Seleccionar moneda',
  clearLabel = 'Sin moneda secundaria',
  emptyLabel = 'No se encontró la moneda',
  searchPlaceholder = 'Buscar por código o nombre…',
  disabled,
  id,
}: CurrencyPickerProps) {
  const [open, setOpen] = React.useState(false);

  const options = React.useMemo(
    () => CURRENCIES.filter((c) => c.code !== exclude),
    [exclude],
  );

  const selected = value ? getCurrency(value) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
          data-testid="currency-picker"
        >
          {selected ? (
            <span className="truncate">
              <span className="font-medium">{selected.code}</span>
              <span className="text-muted-foreground"> · {selected.name}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command
          filter={(itemValue, search) => {
            // `itemValue` es "CODE NOMBRE", así que buscar por cualquiera de
            // los dos funciona sin mantener un índice aparte.
            return itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
          }}
        >
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyLabel}</CommandEmpty>
            <CommandGroup>
              {clearable && (
                <CommandItem
                  value="__clear__"
                  onSelect={() => {
                    onChange(undefined);
                    setOpen(false);
                  }}
                >
                  <X className="mr-2 h-4 w-4 opacity-50" />
                  <span className="text-muted-foreground">{clearLabel}</span>
                </CommandItem>
              )}
              {options.map((currency) => (
                <CommandItem
                  key={currency.code}
                  value={`${currency.code} ${currency.name}`}
                  onSelect={() => {
                    onChange(currency.code);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn('mr-2 h-4 w-4', value === currency.code ? 'opacity-100' : 'opacity-0')}
                  />
                  <span className="font-medium w-12">{currency.code}</span>
                  <span className="truncate">{currency.name}</span>
                  <span className="ml-auto text-muted-foreground">{currency.symbol}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
