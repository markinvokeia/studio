'use client';

import * as React from 'react';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { useCurrencySettings } from '@/hooks/useCurrencySettings';
import { getCurrency } from '@/constants/currencies';
import { cn } from '@/lib/utils';

interface CurrencySelectProps {
  value?: string;
  onChange: (value: string) => void;
  /**
   * Moneda con la que se guardó el registro que se está editando. Si ya no es
   * una de las que la clínica ofrece, se añade igualmente a la lista para no
   * cambiársela en silencio al guardar.
   */
  savedCurrency?: string | null;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  id?: string;
}

/**
 * Selector de moneda de los formularios de venta, compra y cobro.
 *
 * Sustituye a los ~20 desplegables que tenían `UYU`/`USD` escritos a mano: las
 * opciones salen de la configuración de la clínica. Cuando la clínica opera en
 * moneda única no hay nada que elegir, así que se renderiza como texto en vez
 * de un desplegable de un solo elemento.
 */
export function CurrencySelect({
  value,
  onChange,
  savedCurrency,
  disabled,
  className,
  placeholder,
  id,
}: CurrencySelectProps) {
  const { optionsFor } = useCurrencySettings();
  const options = optionsFor(savedCurrency ?? value);

  /**
   * Siembra el valor cuando el formulario no trae ninguno.
   *
   * Importa sobre todo con moneda única, donde el control es estático y el
   * usuario no puede elegir: sin esto el campo quedaría vacío para siempre y
   * la validación bloquearía el guardado sin explicar por qué.
   */
  const onChangeRef = React.useRef(onChange);
  React.useEffect(() => { onChangeRef.current = onChange; });
  React.useEffect(() => {
    if (!value && options.length > 0) onChangeRef.current(options[0]);
  }, [value, options]);

  if (options.length === 1) {
    return (
      <div
        id={id}
        data-testid="currency-select-static"
        className={cn(
          'flex h-10 items-center rounded-md border border-input bg-muted/40 px-3 text-sm text-muted-foreground',
          className,
        )}
      >
        {options[0]}
      </div>
    );
  }

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={id} className={className} data-testid="currency-select">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((code) => (
          <SelectItem key={code} value={code}>
            {code} <span className="text-muted-foreground">· {getCurrency(code).symbol}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
