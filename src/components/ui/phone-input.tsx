
'use client';

import examples from 'libphonenumber-js/examples.mobile.json';
import { CountryCode, Examples, getExampleNumber, type PhoneNumber } from 'libphonenumber-js/min';
import { Check, ChevronsUpDown, Globe } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import * as React from 'react';
import { flushSync } from 'react-dom';

import { DEFAULT_PHONE_COUNTRY } from '@/lib/countries';
import { filterCountry, getCountryOptions } from '@/lib/country-options';
import {
  applyPhoneEdit,
  applyPhonePaste,
  finishPhoneEdit,
  formatPhoneForDisplay,
  getPhonePrefix,
  isBarePhoneText,
  reinterpretForCountry,
  type PhoneEdit,
} from '@/lib/phone-text';
import { cn } from '@/lib/utils';
import {
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '.';
import { CountryFlag } from './country-flag';
import { ScrollArea } from './scroll-area';

// El ejemplo lo pone el campo según el país elegido: un texto fijo no serviría al cambiarlo.
export type PhoneInputProps = Omit<React.ComponentPropsWithoutRef<typeof Input>, 'onChange' | 'placeholder'> & {
  value?: string;
  onChange: (value: string) => void;
  defaultCountry?: CountryCode;
};

/** Posición en `text` justo después de sus primeros `count` dígitos (o "+"). */
const caretAfterSignificant = (text: string, count: number): number => {
  let seen = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (seen === count) return i;
    if (/[\d+]/.test(text[i])) seen += 1;
  }
  return text.length;
};

// Va aparte para armar la lista de países recién al abrir el selector, no en cada campo de la página.
const CountryPicker = ({ selected, onSelect }: { selected?: CountryCode; onSelect: (code: CountryCode) => void }) => {
  const t = useTranslations('PhoneInput');
  const locale = useLocale();
  const options = React.useMemo(() => getCountryOptions(locale), [locale]);

  // `defaultValue` deja resaltado el país actual y cmdk lo lleva a la vista al montar; sin él
  // resalta el primero de la lista (Afganistán) y el elegido queda fuera de la vista.
  return (
    <Command filter={filterCountry} defaultValue={selected}>
      <CommandInput placeholder={t('searchCountry')} />
      <CommandList>
        {/* Radix envuelve el contenido en un `display: table` que crece con el nombre más largo y
            dejaba el prefijo fuera de la vista: así las filas miden lo que el selector. */}
        <ScrollArea className="h-56 [&_[data-radix-scroll-area-viewport]>div]:!block">
          <CommandEmpty>{t('noCountryFound')}</CommandEmpty>
          <CommandGroup>
            {options.map((c) => (
              <CommandItem key={c.code} value={c.code} keywords={c.searchNames} onSelect={() => onSelect(c.code)}>
                <Check className={cn('mr-2 h-4 w-4', selected === c.code ? 'opacity-100' : 'opacity-0')} />
                <CountryFlag country={c.code} className="mr-2" />
                <span className="min-w-0 truncate" title={c.name}>{c.name}</span>
                <span className="ml-auto shrink-0 pl-2 text-gray-400">{c.dialLabel}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </ScrollArea>
      </CommandList>
    </Command>
  );
};

export const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(({
  className,
  value: valueProp,
  onChange,
  onBlur,
  onFocus,
  onPaste,
  defaultCountry = DEFAULT_PHONE_COUNTRY,
  ...rest
}, ref) => {
  const [open, setOpen] = React.useState(false);
  const [country, setCountry] = React.useState<CountryCode | undefined>(defaultCountry);
  const [inputValue, setInputValue] = React.useState('');
  const [alternative, setAlternative] = React.useState<PhoneNumber | undefined>(undefined);

  const inputRef = React.useRef<HTMLInputElement>(null);
  React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

  // Último valor que entregó el propio input: el efecto no debe re-sincronizarlo
  // (reformatearlo o vaciarlo) mientras el usuario escribe.
  const lastEmittedRef = React.useRef<string | undefined>(undefined);
  // El prefijo actual lo puso el campo, no el usuario (ver `PhoneEdit.assumed`).
  const assumedRef = React.useRef(true);
  // Un valor cargado y sin tocar no se reescribe al salir: seguiría igual y marcaría el formulario.
  const touchedRef = React.useRef(false);
  // País elegido a mano: un campo vacío vuelve a él. El reconocido al escribir no se conserva,
  // porque el próximo número se leería con el país del anterior.
  const pickedCountryRef = React.useRef<CountryCode | null>(null);

  const t = useTranslations('PhoneInput');
  const locale = useLocale();
  const countryName = React.useCallback(
    (code: CountryCode) => {
      try {
        return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code;
      } catch {
        return code;
      }
    },
    [locale],
  );

  React.useEffect(() => {
    if (valueProp !== undefined && valueProp === lastEmittedRef.current) return;
    lastEmittedRef.current = undefined;
    touchedRef.current = false;
    pickedCountryRef.current = null;
    setAlternative(undefined);
    if (valueProp) {
      const display = formatPhoneForDisplay(valueProp, defaultCountry);
      assumedRef.current = false;
      // Lo que no se puede leer como teléfono no deja la bandera del registro anterior.
      setCountry(display.country ?? defaultCountry);
      setInputValue(display.text);
    } else {
      const focused = !!inputRef.current && document.activeElement === inputRef.current;
      assumedRef.current = true;
      setInputValue(focused ? getPhonePrefix(defaultCountry) : '');
      setCountry(defaultCountry);
    }
  }, [valueProp, defaultCountry]);

  const emit = (value: string) => {
    lastEmittedRef.current = value;
    onChange(value);
  };

  const applyEdit = (edit: PhoneEdit) => {
    assumedRef.current = edit.assumed;
    touchedRef.current = true;
    setInputValue(edit.text);
    setCountry(edit.text ? edit.country : (pickedCountryRef.current ?? defaultCountry));
    setAlternative(edit.alternative);
    if (edit.value !== (lastEmittedRef.current ?? valueProp ?? '')) emit(edit.value);
  };

  const handleCountryChange = (countryCode: CountryCode) => {
    pickedCountryRef.current = countryCode;
    // Render síncrono para poder enfocar ya, sin esperar la animación de cierre (se perderían las
    // primeras teclas): antes del render `handleFocus` vería el campo vacío y volvería a poner
    // el prefijo del país anterior.
    flushSync(() => {
      applyEdit(reinterpretForCountry(inputValue, country, countryCode));
      setOpen(false);
    });
    inputRef.current?.focus();
  };

  const applyAlternative = (number: PhoneNumber) => {
    applyEdit({
      text: number.formatInternational(),
      value: number.format('E.164'),
      country: number.country,
      assumed: false,
    });
  };

  // Se escribe directo en el DOM junto con el cursor: si React lo hiciera después, el cursor
  // saltaría al final al editar en medio del número.
  const writeInput = (input: HTMLInputElement, text: string, caret: number) => {
    input.value = text;
    input.setSelectionRange(caret, caret);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const typed = input.value;
    const caret = input.selectionStart ?? typed.length;
    // Sin "+" ya no queda el prefijo del número anterior (se reemplazó todo): los dígitos se leen
    // con el país elegido a mano o el de por defecto, no con el del número que se está pisando.
    const readCountry = typed.includes('+')
      ? country ?? defaultCountry
      : pickedCountryRef.current ?? defaultCountry;
    const edit = applyPhoneEdit(typed, {
      country: readCountry,
      previousText: inputValue,
      assumed: assumedRef.current,
      countryPicked: !!pickedCountryRef.current,
    });
    const significantBefore = (typed.slice(0, caret).match(/[\d+]/g) ?? []).length;
    writeInput(input, edit.text, caret === typed.length ? edit.text.length : caretAfterSignificant(edit.text, significantBefore));
    applyEdit(edit);
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (!inputValue && !rest.readOnly) {
      const prefix = getPhonePrefix(country ?? defaultCountry);
      assumedRef.current = !pickedCountryRef.current;
      writeInput(e.target, prefix, prefix.length);
      setInputValue(prefix);
    }
    onFocus?.(e);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    onPaste?.(e);
    const input = e.currentTarget;
    const replacesAll = isBarePhoneText(inputValue)
      || (input.selectionStart === 0 && input.selectionEnd === inputValue.length);
    if (!replacesAll) return;
    const edit = applyPhonePaste(e.clipboardData.getData('text'), country ?? defaultCountry);
    if (!edit) return;
    e.preventDefault();
    writeInput(input, edit.text, edit.text.length);
    applyEdit(edit);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (isBarePhoneText(inputValue)) {
      // Un prefijo solo no es un teléfono: no cuenta para "correo o teléfono obligatorio".
      setInputValue('');
      assumedRef.current = true;
      setCountry(pickedCountryRef.current ?? defaultCountry);
      if ((lastEmittedRef.current ?? valueProp ?? '') !== '') emit('');
    } else if (touchedRef.current) {
      const edit = finishPhoneEdit(inputValue, country, assumedRef.current);
      assumedRef.current = false;
      touchedRef.current = false;
      setInputValue(edit.text);
      if (edit.country) setCountry(edit.country);
      // Una vez formateado ya no se puede volver a detectar: se conserva la sugerencia.
      if (edit.alternative) setAlternative(edit.alternative);
      if (edit.value !== lastEmittedRef.current) emit(edit.value);
    }
    onBlur?.(e);
  };

  const placeholder = React.useMemo(
    () => getExampleNumber(country ?? defaultCountry, examples as Examples)?.formatInternational(),
    [country, defaultCountry],
  );

  return (
    <div className={className}>
      <div
        className={cn(
          'flex h-full min-h-9 w-full items-stretch rounded-md border border-input bg-background shadow-sm transition-colors',
          'focus-within:ring-1 focus-within:ring-ring',
          'has-[input[aria-invalid=true]]:border-destructive has-[input[aria-invalid=true]]:focus-within:ring-destructive',
          'has-[input:disabled]:opacity-50',
        )}
      >
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              role="combobox"
              aria-expanded={open}
              aria-label={country ? countryName(country) : undefined}
              disabled={rest.disabled}
              className="h-auto shrink-0 gap-1 rounded-e-none px-2"
            >
              {country ? (
                <CountryFlag country={country} alt="" />
              ) : (
                <Globe className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[300px] p-0"
            onCloseAutoFocus={(e) => {
              // Tras elegir el país se sigue escribiendo el número, sin volver a hacer clic.
              e.preventDefault();
              inputRef.current?.focus();
            }}
          >
            <CountryPicker selected={country} onSelect={handleCountryChange} />
          </PopoverContent>
        </Popover>
        <Input
          inputMode="tel"
          {...rest}
          ref={inputRef}
          className="h-auto border-0 bg-transparent pl-1 shadow-none focus-visible:ring-0"
          placeholder={placeholder}
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onPaste={handlePaste}
          onBlur={handleBlur}
        />
      </div>
      {alternative?.country && (
        <p className="mt-1 text-xs text-muted-foreground">
          {t('ambiguous', {
            country: countryName(alternative.country),
            number: alternative.formatInternational(),
          })}{' '}
          <button
            type="button"
            className="font-medium text-primary underline-offset-2 hover:underline"
            onClick={() => applyAlternative(alternative)}
          >
            {t('useAlternative', { callingCode: alternative.countryCallingCode })}
          </button>
        </p>
      )}
    </div>
  );
});
PhoneInput.displayName = 'PhoneInput';

export * from './input';

